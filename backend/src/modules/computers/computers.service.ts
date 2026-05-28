import { createHmac, randomBytes } from "node:crypto";
import { TenantStatus, type Prisma } from "@prisma/client";

import { env } from "../../config/env";
import { AppError } from "../../shared/errors/app-error";
import type { ErrorCode } from "../../shared/errors/error-code";
import { prisma } from "../../shared/prisma/prisma.client";
import { authPasswordService } from "../auth/auth.password";
import { computersLoggingService } from "./computers.logging";
import { mapComputerListResponse, mapComputerToResponse } from "./computers.mapper";
import { normalizeMacAddress, normalizeTenantCode } from "./computers.schema";
import { TenantSecretStrategy } from "./registration-auth.strategy";
import type {
  ComputerListResponse,
  ComputerResponse,
  ComputerTokenResponse,
  ComputersAuthContext,
  ListComputersInput,
  ReissueDeviceTokenInput,
  RegisterComputerInput,
  RegisterComputerRequestContext,
  UpdateComputerInput,
} from "./computers.types";

const DEVICE_TOKEN_BYTES = 48;
const COMPUTER_REGISTRATION_SECRET_BYTES = 32;
const COMPUTER_REGISTRATION_SECRET_PREFIX = "crs_live_";

export const generateDeviceToken = (): string =>
  randomBytes(DEVICE_TOKEN_BYTES).toString("base64url");

export const generateComputerRegistrationSecret = (): string =>
  `${COMPUTER_REGISTRATION_SECRET_PREFIX}${randomBytes(
    COMPUTER_REGISTRATION_SECRET_BYTES,
  ).toString("base64url")}`;

export const hashDeviceToken = (deviceToken: string): string =>
  createHmac("sha256", env.computers.deviceTokenHashSecret)
    .update(deviceToken)
    .digest("hex");

export const hashRegistrationSecret = async (
  registrationSecret: string,
): Promise<string> => authPasswordService.hashPassword(registrationSecret);

export const compareRegistrationSecret = async (input: {
  plainRegistrationSecret: string;
  registrationSecretHash: string;
}): Promise<boolean> =>
  authPasswordService.comparePassword(
    input.plainRegistrationSecret,
    input.registrationSecretHash,
  );

type TenantScopedComputerLookup = {
  id: string;
  tenantId: string;
};

type RegisterComputerTenant = {
  id: string;
  code: string;
  status: TenantStatus;
  computerRegistrationSecretHash: string | null;
};

type SafeComputerMapperSource = Parameters<typeof mapComputerToResponse>[0];
type SafeComputerListMapperSource = ReadonlyArray<SafeComputerMapperSource>;
type ComputerSortInput =
  | "createdAt:desc"
  | "createdAt:asc"
  | "name:asc"
  | "name:desc";

const DUPLICATE_COMPUTER_CONFLICT_MESSAGE =
  "A computer with this MAC address already exists for the tenant.";

const SAFE_COMPUTER_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  macAddress: true,
  status: true,
  lastSeenAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ComputerSelect;

export class ComputersService {
  constructor(
    private readonly prismaClient = prisma,
    private readonly registrationSecretStrategy = new TenantSecretStrategy(),
    private readonly logService = computersLoggingService,
  ) {}

  // Task 166-170 dependency scaffold: imported/wired for upcoming service methods.
  private readonly mappers = {
    mapComputerToResponse,
    mapComputerListResponse,
  };

  public async registerComputer(
    input: RegisterComputerInput,
    requestContext: RegisterComputerRequestContext = {},
  ): Promise<ComputerTokenResponse> {
    const tenant = await this.findActiveTenantByTenantCodeOrThrowNotFound(
      input.tenantCode,
      requestContext,
    );

    await this.verifyRegistrationSecretOrThrowUnauthorized({
      submittedSecret: input.registrationSecret,
      tenant,
      requestContext,
    });

    const normalizedMacAddress = normalizeMacAddress(input.macAddress);
    await this.assertComputerMacAddressAvailable({
      tenantId: tenant.id,
      macAddress: normalizedMacAddress,
      requestContext,
    });

    const deviceToken = generateDeviceToken();
    const deviceTokenHash = hashDeviceToken(deviceToken);
    const computer = await this.createRegisteredComputerOrThrowConflict({
      tenantId: tenant.id,
      macAddress: normalizedMacAddress,
      name: input.name,
      deviceTokenHash,
      requestContext,
    });

    this.logService.logComputerRegistered({
      requestId: requestContext.requestId,
      tenantId: tenant.id,
      computerId: computer.id,
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
      status: "success",
    });

    return {
      computer: this.toSafeComputerResponse(computer),
      deviceToken,
    };
  }

  public async listComputers(
    authContext: ComputersAuthContext,
    input: ListComputersInput,
  ): Promise<ComputerListResponse> {
    const baseListFilter = this.buildBaseComputerListFilter(authContext);
    const statusFilter: Prisma.ComputerWhereInput =
      input.status === undefined ? {} : { status: input.status };
    const searchFilter = this.buildComputerListSearchFilter(input.q);
    const where: Prisma.ComputerWhereInput = {
      AND: [baseListFilter, statusFilter, searchFilter],
    };
    const orderBy = this.buildComputerListOrderBy(input.sort);
    const skip = (input.page - 1) * input.pageSize;
    const take = input.pageSize;

    const total = await this.prismaClient.computer.count({
      where,
    });

    const items = await this.prismaClient.computer.findMany({
      where,
      orderBy,
      skip,
      take,
      select: SAFE_COMPUTER_SELECT,
    });

    const listResponse = this.toSafeComputerListResponse({
      items,
      page: input.page,
      pageSize: input.pageSize,
      total,
    });

    this.logService.logComputerListed({
      requestId: undefined,
      tenantId: this.assertTenantIdFromAuthContext(authContext),
      actorUserId: authContext.userId,
      actorRole: authContext.role,
      ip: undefined,
      userAgent: undefined,
      status: "success",
      page: input.page,
      pageSize: input.pageSize,
      total,
      filterStatus: input.status,
      sort: input.sort ?? "createdAt:desc",
      hasQuery: typeof input.q === "string" && input.q.trim().length > 0,
      qLength: typeof input.q === "string" ? input.q.trim().length : undefined,
    });

    return listResponse;
  }

  public async getComputerById(
    authContext: ComputersAuthContext,
    id: string,
  ): Promise<ComputerResponse> {
    const where = this.buildTenantScopedComputerLookupFilter({
      authContext,
      computerId: id,
    });

    const computer = await this.prismaClient.computer.findFirst({
      where,
      select: SAFE_COMPUTER_SELECT,
    });

    const accessibleComputer = this.requireAccessibleComputerOrThrowNotFound(computer);
    const response = this.toSafeComputerResponse(accessibleComputer);

    this.logService.logComputerViewed({
      requestId: undefined,
      tenantId: where.tenantId,
      computerId: accessibleComputer.id,
      actorUserId: authContext.userId,
      actorRole: authContext.role,
      ip: undefined,
      userAgent: undefined,
      status: "success",
    });

    return response;
  }

  public async updateComputerById(
    authContext: ComputersAuthContext,
    id: string,
    input: UpdateComputerInput,
  ): Promise<ComputerResponse> {
    const where = this.buildTenantScopedComputerLookupFilter({
      authContext,
      computerId: id,
    });

    const targetComputer = await this.prismaClient.computer.findFirst({
      where,
      select: SAFE_COMPUTER_SELECT,
    });

    const accessibleComputer =
      this.requireAccessibleComputerOrThrowNotFound(targetComputer);
    const updateData: Prisma.ComputerUpdateInput = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    const updatedComputer = await this.prismaClient.computer.update({
      where: {
        id: accessibleComputer.id,
      },
      data: updateData,
      select: SAFE_COMPUTER_SELECT,
    });

    const updatedFieldNames = Object.keys(updateData).filter(
      (fieldName): fieldName is "name" | "status" | "notes" =>
        fieldName === "name" || fieldName === "status" || fieldName === "notes",
    );

    this.logService.logComputerUpdated({
      requestId: undefined,
      tenantId: where.tenantId,
      computerId: updatedComputer.id,
      actorUserId: authContext.userId,
      actorRole: authContext.role,
      ip: undefined,
      userAgent: undefined,
      status: "success",
      updatedFieldNames,
    });

    return this.toSafeComputerResponse(updatedComputer);
  }

  public async reissueDeviceToken(
    authContext: ComputersAuthContext,
    id: string,
    input: ReissueDeviceTokenInput,
  ): Promise<ComputerTokenResponse> {
    const where = this.buildTenantScopedComputerLookupFilter({
      authContext,
      computerId: id,
    });

    const deviceToken = generateDeviceToken();
    const deviceTokenHash = hashDeviceToken(deviceToken);

    const updateResult = await this.prismaClient.computer.updateMany({
      where: {
        id: where.id,
        tenantId: where.tenantId,
      },
      data: {
        deviceTokenHash,
      },
    });

    if (updateResult.count !== 1) {
      throw this.createServiceError(404, "NOT_FOUND", "Computer not found.");
    }

    const reissuedComputer = await this.prismaClient.computer.findFirst({
      where,
      select: SAFE_COMPUTER_SELECT,
    });

    const accessibleComputer =
      this.requireAccessibleComputerOrThrowNotFound(reissuedComputer);

    const normalizedReason = input.reason?.trim();

    this.logService.logComputerTokenReissued({
      requestId: undefined,
      tenantId: where.tenantId,
      computerId: accessibleComputer.id,
      actorUserId: authContext.userId,
      actorRole: authContext.role,
      ip: undefined,
      userAgent: undefined,
      status: "success",
      reason: normalizedReason && normalizedReason.length > 0 ? normalizedReason : undefined,
    });

    return {
      computer: this.toSafeComputerResponse(accessibleComputer),
      deviceToken,
    };
  }

  private async findActiveTenantByTenantCodeOrThrowNotFound(
    tenantCode: string,
    requestContext: RegisterComputerRequestContext,
  ): Promise<RegisterComputerTenant> {
    const normalizedTenantCode = normalizeTenantCode(tenantCode);
    const tenant = await this.prismaClient.tenant.findFirst({
      where: {
        code: normalizedTenantCode,
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        status: true,
        computerRegistrationSecretHash: true,
      },
    });

    return this.requireActiveTenantOrThrowNotFound(tenant, requestContext);
  }

  private async verifyRegistrationSecretOrThrowUnauthorized(input: {
    submittedSecret: string;
    tenant: RegisterComputerTenant;
    requestContext: RegisterComputerRequestContext;
  }): Promise<void> {
    const isValidRegistrationSecret =
      await this.registrationSecretStrategy.verify(
        input.submittedSecret,
        input.tenant.computerRegistrationSecretHash,
      );

    if (!isValidRegistrationSecret) {
      this.logService.logComputerRegisterFailed({
        requestId: input.requestContext.requestId,
        tenantId: input.tenant.id,
        ip: input.requestContext.ip,
        userAgent: input.requestContext.userAgent,
        status: "failure",
        reason: "invalid_registration_secret",
      });

      throw this.createServiceError(
        401,
        "UNAUTHORIZED",
        "Invalid registration secret.",
      );
    }
  }

  private async assertComputerMacAddressAvailable(input: {
    tenantId: string;
    macAddress: string;
    requestContext: RegisterComputerRequestContext;
  }): Promise<void> {
    const existingComputer = await this.prismaClient.computer.findFirst({
      where: {
        tenantId: input.tenantId,
        macAddress: input.macAddress,
      },
      select: {
        id: true,
      },
    });

    if (existingComputer) {
      this.logService.logComputerRegisterConflict({
        requestId: input.requestContext.requestId,
        tenantId: input.tenantId,
        computerId: existingComputer.id,
        ip: input.requestContext.ip,
        userAgent: input.requestContext.userAgent,
        status: "conflict",
        reason: "duplicate_mac_address",
      });

      throw this.createDuplicateComputerRegistrationConflictError();
    }
  }

  private async createRegisteredComputerOrThrowConflict(input: {
    tenantId: string;
    macAddress: string;
    name?: string;
    deviceTokenHash: string;
    requestContext: RegisterComputerRequestContext;
  }): Promise<SafeComputerMapperSource> {
    try {
      return await this.prismaClient.computer.create({
        data: {
          tenantId: input.tenantId,
          macAddress: input.macAddress,
          ...(input.name === undefined ? {} : { name: input.name }),
          deviceTokenHash: input.deviceTokenHash,
        },
        select: SAFE_COMPUTER_SELECT,
      });
    } catch (error) {
      if (this.isTenantMacAddressUniqueConstraintError(error)) {
        this.logService.logComputerRegisterConflict({
          requestId: input.requestContext.requestId,
          tenantId: input.tenantId,
          ip: input.requestContext.ip,
          userAgent: input.requestContext.userAgent,
          status: "conflict",
          reason: "duplicate_mac_address_unique_race",
        });
      }

      this.mapDuplicateComputerRegistrationError(error);
    }
  }

  private requireActiveTenantOrThrowNotFound(
    tenant: RegisterComputerTenant | null | undefined,
    requestContext: RegisterComputerRequestContext,
  ): RegisterComputerTenant {
    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      this.logService.logComputerRegisterFailed({
        requestId: requestContext.requestId,
        tenantId: tenant?.id,
        ip: requestContext.ip,
        userAgent: requestContext.userAgent,
        status: "failure",
        reason: "tenant_not_active_or_not_found",
      });

      throw this.createServiceError(
        404,
        "NOT_FOUND",
        "Tenant code does not resolve to an active tenant.",
      );
    }

    return tenant;
  }

  // Task 171: reject admin requests that do not have trusted tenant scope in auth context.
  private assertTenantIdFromAuthContext(authContext: ComputersAuthContext): string {
    const tenantId = authContext.tenantId;

    if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
      throw this.createServiceError(403, "FORBIDDEN", "Tenant context is required.");
    }

    return tenantId;
  }

  // Task 198-199: derive list scope only from trusted auth context.
  private buildBaseComputerListFilter(
    authContext: ComputersAuthContext,
  ): Prisma.ComputerWhereInput {
    const tenantId = this.assertTenantIdFromAuthContext(authContext);

    return {
      tenantId,
    };
  }

  // Task 172 + 178: always build lookup filters from trusted auth context, never client scope.
  private buildTenantScopedComputerLookupFilter(input: {
    authContext: ComputersAuthContext;
    computerId: string;
  }): TenantScopedComputerLookup {
    const tenantId = this.assertTenantIdFromAuthContext(input.authContext);

    return {
      id: input.computerId,
      tenantId,
    };
  }

  // Task 173: unify not-found mapping for missing/cross-tenant/inaccessible records.
  private requireAccessibleComputerOrThrowNotFound<T>(
    computer: T | null | undefined,
  ): T {
    if (!computer) {
      throw this.createServiceError(404, "NOT_FOUND", "Computer not found.");
    }

    return computer;
  }

  // Task 179: never return raw Prisma rows (which may include deviceTokenHash).
  private toSafeComputerResponse(computer: SafeComputerMapperSource): ComputerResponse {
    return this.mappers.mapComputerToResponse(computer);
  }

  // Task 179: list mapping helper that returns API DTO only.
  private toSafeComputerListResponse(input: {
    items: SafeComputerListMapperSource;
    page: number;
    pageSize: number;
    total: number;
  }): ComputerListResponse {
    return this.mappers.mapComputerListResponse(input);
  }

  // Task 174: map duplicate registration attempts to a deterministic conflict error.
  private createDuplicateComputerRegistrationConflictError(): AppError {
    return this.createServiceError(
      409,
      "CONFLICT",
      DUPLICATE_COMPUTER_CONFLICT_MESSAGE,
      {
        field: "macAddress",
      },
    );
  }

  // Task 175: detect Prisma unique-constraint conflicts for (tenantId, macAddress).
  private isTenantMacAddressUniqueConstraintError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    const prismaError = error as {
      code?: unknown;
      meta?: {
        target?: unknown;
      };
    };

    if (prismaError.code !== "P2002") {
      return false;
    }

    const target = prismaError.meta?.target;
    if (!Array.isArray(target)) {
      return false;
    }

    const targetFields = target.filter(
      (value): value is string => typeof value === "string",
    );

    return (
      targetFields.includes("tenantId") && targetFields.includes("macAddress")
    );
  }

  private mapDuplicateComputerRegistrationError(error: unknown): never {
    if (this.isTenantMacAddressUniqueConstraintError(error)) {
      throw this.createDuplicateComputerRegistrationConflictError();
    }

    throw error;
  }

  // Task 176: build strict allowlisted sorting for computer list queries.
  private buildComputerListOrderBy(
    sort: "createdAt:desc" | "createdAt:asc" | "name:asc" | "name:desc" | undefined,
  ): Prisma.ComputerOrderByWithRelationInput {
    const allowlistedSortMap: Record<
      ComputerSortInput,
      Prisma.ComputerOrderByWithRelationInput
    > = {
      "createdAt:desc": { createdAt: "desc" },
      "createdAt:asc": { createdAt: "asc" },
      "name:asc": { name: "asc" },
      "name:desc": { name: "desc" },
    };

    if (!sort) {
      return allowlistedSortMap["createdAt:desc"];
    }

    return allowlistedSortMap[sort] ?? allowlistedSortMap["createdAt:desc"];
  }

  // Task 177: build literal-search filters for `name` and `macAddress` only.
  private buildComputerListSearchFilter(
    q: string | undefined,
  ): Prisma.ComputerWhereInput {
    if (typeof q !== "string") {
      return {};
    }

    const normalizedQuery = q.trim();
    if (normalizedQuery.length === 0) {
      return {};
    }

    return {
      OR: [
        {
          name: {
            contains: normalizedQuery,
          },
        },
        {
          macAddress: {
            contains: normalizedQuery,
          },
        },
      ],
    };
  }

  private createServiceError(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ): AppError {
    return new AppError(statusCode, code, message, details);
  }
}

export const computersService = new ComputersService();
