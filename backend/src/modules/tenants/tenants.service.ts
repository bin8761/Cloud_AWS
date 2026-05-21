import type { AuthRole } from "../auth/auth.types";
import { AppError } from "../../shared/errors/app-error";
import { prisma } from "../../shared/prisma/prisma.client";
import { tenantsLoggingService } from "./tenants.logging";
import { mapTenantDto } from "./tenants.types";
import type {
  GetCurrentTenantOutput,
  GetTenantByIdOutput,
  ListTenantsInput,
  ListTenantsOutput,
  UpdateCurrentTenantInput,
  UpdateCurrentTenantOutput,
  UpdateTenantByIdInput,
  UpdateTenantByIdOutput,
} from "./tenants.types";

const NOT_FOUND_STATUS_CODE = 404;
const FORBIDDEN_STATUS_CODE = 403;
const FORBIDDEN_MESSAGE = "You do not have permission to access this resource.";
const TENANT_NOT_FOUND_MESSAGE =
  "The tenant does not exist or has been deleted.";
const createForbiddenError = () =>
  new AppError(FORBIDDEN_STATUS_CODE, "FORBIDDEN", FORBIDDEN_MESSAGE);
const createNotFoundTenantError = () =>
  new AppError(
    NOT_FOUND_STATUS_CODE,
    "NOT_FOUND",
    TENANT_NOT_FOUND_MESSAGE,
  );

type TenantsAuthContext = {
  userId?: string;
  tenantId?: string | null;
  role?: AuthRole;
  requestId?: string;
};

const assertTenantIdFromAuthContext = (
  authContext: TenantsAuthContext | undefined,
): string => {
  const tenantId = authContext?.tenantId;
  if (typeof tenantId !== "string") {
    throw createForbiddenError();
  }

  const normalizedTenantId = tenantId.trim();
  if (!normalizedTenantId) {
    throw createForbiddenError();
  }

  return normalizedTenantId;
};

const createBaseTenantWhere = (): { deletedAt: null } => ({
  deletedAt: null,
});

type TenantDtoSource = Parameters<typeof mapTenantDto>[0];

const mapGetCurrentTenantOutput = (
  tenant: TenantDtoSource,
): GetCurrentTenantOutput => ({
  tenant: mapTenantDto(tenant),
});

const mapUpdateCurrentTenantOutput = (
  tenant: TenantDtoSource,
): UpdateCurrentTenantOutput => ({
  tenant: mapTenantDto(tenant),
});

const mapGetTenantByIdOutput = (tenant: TenantDtoSource): GetTenantByIdOutput => ({
  tenant: mapTenantDto(tenant),
});

const mapUpdateTenantByIdOutput = (
  tenant: TenantDtoSource,
): UpdateTenantByIdOutput => ({
  tenant: mapTenantDto(tenant),
});

const mapListTenantsOutput = (input: {
  items: ReadonlyArray<TenantDtoSource>;
  page: number;
  pageSize: number;
  total: number;
}): ListTenantsOutput => ({
  items: input.items.map((tenant) => mapTenantDto(tenant)),
  page: input.page,
  pageSize: input.pageSize,
  total: input.total,
});

const tenantDtoSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

const normalizeTenantListSearchQuery = (
  value: string | undefined,
): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    return undefined;
  }

  const MAX_QUERY_LENGTH = 100;
  return normalizedValue.slice(0, MAX_QUERY_LENGTH);
};

export class TenantsService {
  public async getCurrentTenant(
    tenantId: string | null | undefined,
  ): Promise<GetCurrentTenantOutput> {
    const normalizedTenantId =
      typeof tenantId === "string" ? tenantId.trim() : "";
    if (!normalizedTenantId) {
      throw createForbiddenError();
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        ...createBaseTenantWhere(),
        id: normalizedTenantId,
      },
      select: tenantDtoSelect,
    });

    if (!tenant) {
      throw createNotFoundTenantError();
    }

    return mapGetCurrentTenantOutput(tenant);
  }

  public async updateCurrentTenantName(
    authContext: TenantsAuthContext | undefined,
    input: UpdateCurrentTenantInput,
  ): Promise<UpdateCurrentTenantOutput> {
    const tenantId = assertTenantIdFromAuthContext(authContext);

    const currentTenant = await prisma.tenant.findFirst({
      where: {
        ...createBaseTenantWhere(),
        id: tenantId,
      },
      select: tenantDtoSelect,
    });
    if (!currentTenant) {
      throw createNotFoundTenantError();
    }

    const updateResult = await prisma.tenant.updateMany({
      where: {
        ...createBaseTenantWhere(),
        id: tenantId,
      },
      data: {
        name: input.name,
      },
    });
    if (updateResult.count === 0) {
      throw createNotFoundTenantError();
    }

    const updatedTenant = await prisma.tenant.findFirst({
      where: {
        ...createBaseTenantWhere(),
        id: tenantId,
      },
      select: tenantDtoSelect,
    });
    if (!updatedTenant) {
      throw createNotFoundTenantError();
    }

    tenantsLoggingService.logTenantNameUpdated({
      ...(authContext?.requestId === undefined
        ? {}
        : { requestId: authContext.requestId }),
      actorUserId: authContext?.userId,
      actorRole: authContext?.role,
      actorTenantId: authContext?.tenantId ?? null,
      targetTenantId: tenantId,
    });

    return mapUpdateCurrentTenantOutput(updatedTenant);
  }

  public async listTenants(input: ListTenantsInput): Promise<ListTenantsOutput> {
    const searchQuery = normalizeTenantListSearchQuery(input.q);
    const skip = (input.page - 1) * input.pageSize;
    const where = {
      ...createBaseTenantWhere(),
      ...(input.status ? { status: input.status } : {}),
      ...(searchQuery
        ? {
            OR: [
              { name: { contains: searchQuery } },
              { code: { contains: searchQuery } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.tenant.count({
        where,
      }),
      prisma.tenant.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: input.pageSize,
        select: tenantDtoSelect,
      }),
    ]);

    return mapListTenantsOutput({
      items,
      page: input.page,
      pageSize: input.pageSize,
      total,
    });
  }

  public async getTenantById(id: string): Promise<GetTenantByIdOutput> {
    const normalizedTenantId = id.trim();
    if (!normalizedTenantId) {
      throw createNotFoundTenantError();
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        ...createBaseTenantWhere(),
        id: normalizedTenantId,
      },
      select: tenantDtoSelect,
    });

    if (!tenant) {
      throw createNotFoundTenantError();
    }

    return mapGetTenantByIdOutput(tenant);
  }

  public async updateTenantById(
    authContext: TenantsAuthContext | undefined,
    id: string,
    input: UpdateTenantByIdInput,
  ): Promise<UpdateTenantByIdOutput> {
    const normalizedTenantId = id.trim();
    if (!normalizedTenantId) {
      throw createNotFoundTenantError();
    }

    const targetTenant = await prisma.tenant.findFirst({
      where: {
        ...createBaseTenantWhere(),
        id: normalizedTenantId,
      },
      select: tenantDtoSelect,
    });
    if (!targetTenant) {
      throw createNotFoundTenantError();
    }

    const updateData: {
      name?: UpdateTenantByIdInput["name"];
      status?: UpdateTenantByIdInput["status"];
    } = {};
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    const hasNoAllowedUpdates = Object.keys(updateData).length === 0;
    if (hasNoAllowedUpdates) {
      return mapUpdateTenantByIdOutput(targetTenant);
    }

    const updateResult = await prisma.tenant.updateMany({
      where: {
        ...createBaseTenantWhere(),
        id: normalizedTenantId,
      },
      data: updateData,
    });
    if (updateResult.count === 0) {
      throw createNotFoundTenantError();
    }

    const updatedTenant = await prisma.tenant.findFirst({
      where: {
        ...createBaseTenantWhere(),
        id: normalizedTenantId,
      },
      select: tenantDtoSelect,
    });
    if (!updatedTenant) {
      throw createNotFoundTenantError();
    }

    if (updatedTenant.name !== targetTenant.name) {
      tenantsLoggingService.logTenantNameUpdated({
        ...(authContext?.requestId === undefined
          ? {}
          : { requestId: authContext.requestId }),
        actorUserId: authContext?.userId,
        actorRole: authContext?.role,
        actorTenantId: authContext?.tenantId ?? null,
        targetTenantId: normalizedTenantId,
      });
    }

    if (updatedTenant.status !== targetTenant.status) {
      tenantsLoggingService.logTenantStatusUpdated({
        ...(authContext?.requestId === undefined
          ? {}
          : { requestId: authContext.requestId }),
        actorUserId: authContext?.userId,
        actorRole: authContext?.role,
        actorTenantId: authContext?.tenantId ?? null,
        targetTenantId: normalizedTenantId,
        oldStatus: targetTenant.status,
        newStatus: updatedTenant.status,
      });
    }

    return mapUpdateTenantByIdOutput(updatedTenant);
  }
}

export const tenantsService = new TenantsService();
