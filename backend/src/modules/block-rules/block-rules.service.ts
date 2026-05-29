import { ComputerStatus, type Prisma } from "@prisma/client";

import { AppError } from "../../shared/errors/app-error";
import type { ErrorCode } from "../../shared/errors/error-code";
import { prisma } from "../../shared/prisma/prisma.client";
import { hashDeviceToken } from "../computers/computers.service";
import type { RealtimeGatewayPublicApi } from "../realtime";
import { blockRulesLoggingService } from "./block-rules.logging";
import { mapBlockRuleListResponse, mapBlockRuleToResponse } from "./block-rules.mapper";
import type {
  BatchCreateBlockRulesInput,
  BlockRuleListResponse,
  BlockRuleResponse,
  BlockRulesAuthContext,
  BlockRulesUpdatedAction,
  CreateBlockRuleInput,
  ListBlockRulesInput,
  UpdateBlockRuleInput,
} from "./block-rules.types";

const MAX_RULES_PER_TENANT = 500;
const DUPLICATE_BLOCK_RULE_MESSAGE =
  "A block rule with this type and value already exists for the tenant.";

const SAFE_BLOCK_RULE_SELECT = {
  id: true,
  tenantId: true,
  type: true,
  value: true,
  label: true,
  reason: true,
  status: true,
  priority: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BlockRuleSelect;

const COMPUTER_DEVICE_TOKEN_SELECT = {
  id: true,
  tenantId: true,
  status: true,
  deviceTokenHash: true,
} satisfies Prisma.ComputerSelect;

type SafeBlockRuleMapperSource = Parameters<typeof mapBlockRuleToResponse>[0];
type BlockRuleSortInput =
  | "createdAt:desc"
  | "createdAt:asc"
  | "priority:desc"
  | "priority:asc";

let realtimeGateway: RealtimeGatewayPublicApi | undefined;

export const setBlockRulesRealtimeGateway = (
  gateway: RealtimeGatewayPublicApi | undefined,
): void => {
  realtimeGateway = gateway;
};

export class BlockRulesService {
  constructor(
    private readonly prismaClient = prisma,
    private readonly logService = blockRulesLoggingService,
  ) {}

  public async createBlockRule(
    authContext: BlockRulesAuthContext,
    input: CreateBlockRuleInput,
  ): Promise<BlockRuleResponse> {
    const tenantId = this.assertTenantIdFromAuthContext(authContext);
    await this.assertRuleCapacityAvailable(tenantId, 1);

    const rule = await this.createBlockRuleOrThrowConflict({
      tenantId,
      input,
      createdBy: authContext.userId,
    });

    this.logService.logBlockRuleCreated({
      tenantId,
      blockRuleId: rule.id,
      actorUserId: authContext.userId,
      actorRole: authContext.role,
      status: "success",
    });
    this.broadcastRulesUpdated(tenantId, "created");

    return this.toSafeBlockRuleResponse(rule);
  }

  public async batchCreateBlockRules(
    authContext: BlockRulesAuthContext,
    input: BatchCreateBlockRulesInput,
  ): Promise<BlockRuleListResponse> {
    const tenantId = this.assertTenantIdFromAuthContext(authContext);
    await this.assertRuleCapacityAvailable(tenantId, input.rules.length);
    this.assertNoDuplicateRulesInsideBatch(input.rules);

    const createdRules = await this.prismaClient.$transaction(async (tx) => {
      const items: SafeBlockRuleMapperSource[] = [];

      for (const ruleInput of input.rules) {
        const createdRule = await tx.blockRule.create({
          data: {
            tenantId,
            type: ruleInput.type,
            value: ruleInput.value,
            label: ruleInput.label,
            reason: ruleInput.reason,
            priority: ruleInput.priority ?? 0,
            createdBy: authContext.userId,
          },
          select: SAFE_BLOCK_RULE_SELECT,
        });
        items.push(createdRule);
      }

      return items;
    }).catch((error: unknown) => this.mapDuplicateBlockRuleError(error));

    this.logService.logBlockRuleBatchCreated({
      tenantId,
      actorUserId: authContext.userId,
      actorRole: authContext.role,
      status: "success",
      count: createdRules.length,
    });
    this.broadcastRulesUpdated(tenantId, "batch-created");

    return mapBlockRuleListResponse({
      items: createdRules,
      page: 1,
      pageSize: createdRules.length,
      total: createdRules.length,
    });
  }

  public async listBlockRules(
    authContext: BlockRulesAuthContext,
    input: ListBlockRulesInput,
  ): Promise<BlockRuleListResponse> {
    const tenantId = this.assertTenantIdFromAuthContext(authContext);
    const where: Prisma.BlockRuleWhereInput = {
      AND: [
        { tenantId },
        input.type === undefined ? {} : { type: input.type },
        input.status === undefined ? {} : { status: input.status },
        this.buildBlockRuleListSearchFilter(input.q),
      ],
    };
    const skip = (input.page - 1) * input.pageSize;
    const take = input.pageSize;

    const total = await this.prismaClient.blockRule.count({ where });
    const items = await this.prismaClient.blockRule.findMany({
      where,
      orderBy: this.buildBlockRuleListOrderBy(input.sort),
      skip,
      take,
      select: SAFE_BLOCK_RULE_SELECT,
    });

    this.logService.logBlockRuleListed({
      tenantId,
      actorUserId: authContext.userId,
      actorRole: authContext.role,
      status: "success",
      page: input.page,
      pageSize: input.pageSize,
      total,
      filterType: input.type,
      filterStatus: input.status,
      sort: input.sort ?? "createdAt:desc",
      hasQuery: typeof input.q === "string" && input.q.trim().length > 0,
      qLength: typeof input.q === "string" ? input.q.trim().length : undefined,
    });

    return mapBlockRuleListResponse({
      items,
      page: input.page,
      pageSize: input.pageSize,
      total,
    });
  }

  public async getBlockRuleById(
    authContext: BlockRulesAuthContext,
    id: string,
  ): Promise<BlockRuleResponse> {
    const tenantId = this.assertTenantIdFromAuthContext(authContext);
    const rule = await this.findTenantScopedBlockRuleOrThrow({ tenantId, id });

    this.logService.logBlockRuleViewed({
      tenantId,
      blockRuleId: rule.id,
      actorUserId: authContext.userId,
      actorRole: authContext.role,
      status: "success",
    });

    return this.toSafeBlockRuleResponse(rule);
  }

  public async updateBlockRuleById(
    authContext: BlockRulesAuthContext,
    id: string,
    input: UpdateBlockRuleInput,
  ): Promise<BlockRuleResponse> {
    const tenantId = this.assertTenantIdFromAuthContext(authContext);
    const targetRule = await this.findTenantScopedBlockRuleOrThrow({ tenantId, id });
    const updateData: Prisma.BlockRuleUpdateInput = {};

    if (input.value !== undefined) {
      updateData.value = input.value;
    }
    if (input.label !== undefined) {
      updateData.label = input.label;
    }
    if (input.reason !== undefined) {
      updateData.reason = input.reason;
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }
    if (input.priority !== undefined) {
      updateData.priority = input.priority;
    }

    const updatedRule = await this.prismaClient.blockRule.update({
      where: {
        id: targetRule.id,
      },
      data: updateData,
      select: SAFE_BLOCK_RULE_SELECT,
    }).catch((error: unknown) => this.mapDuplicateBlockRuleError(error));

    this.logService.logBlockRuleUpdated({
      tenantId,
      blockRuleId: updatedRule.id,
      actorUserId: authContext.userId,
      actorRole: authContext.role,
      status: "success",
      reason: `updated_fields:${Object.keys(updateData).join(",") || "none"}`,
    });
    this.broadcastRulesUpdated(tenantId, "updated");

    return this.toSafeBlockRuleResponse(updatedRule);
  }

  public async deleteBlockRuleById(
    authContext: BlockRulesAuthContext,
    id: string,
  ): Promise<BlockRuleResponse> {
    const tenantId = this.assertTenantIdFromAuthContext(authContext);
    const targetRule = await this.findTenantScopedBlockRuleOrThrow({ tenantId, id });
    const deletedRule = await this.prismaClient.blockRule.delete({
      where: {
        id: targetRule.id,
      },
      select: SAFE_BLOCK_RULE_SELECT,
    });

    this.logService.logBlockRuleDeleted({
      tenantId,
      blockRuleId: deletedRule.id,
      actorUserId: authContext.userId,
      actorRole: authContext.role,
      status: "success",
    });
    this.broadcastRulesUpdated(tenantId, "deleted");

    return this.toSafeBlockRuleResponse(deletedRule);
  }

  public async getActiveRulesForClient(
    authContext: BlockRulesAuthContext,
  ): Promise<BlockRuleResponse[]> {
    const tenantId = this.assertTenantIdFromAuthContext(authContext);
    const computerId = this.assertComputerIdFromAuthContext(authContext);

    const items = await this.prismaClient.blockRule.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      select: SAFE_BLOCK_RULE_SELECT,
    });

    this.logService.logActiveRulesFetched({
      tenantId,
      computerId,
      status: "success",
      count: items.length,
    });

    return items.map((rule) => this.toSafeBlockRuleResponse(rule));
  }

  public async authenticateComputerByDeviceToken(input: {
    computerId: string;
    deviceToken: string;
  }): Promise<BlockRulesAuthContext> {
    const computer = await this.prismaClient.computer.findUnique({
      where: {
        id: input.computerId,
      },
      select: COMPUTER_DEVICE_TOKEN_SELECT,
    });

    if (!computer || computer.status !== ComputerStatus.ACTIVE) {
      throw this.createServiceError(401, "UNAUTHORIZED", "Invalid device token.");
    }

    if (hashDeviceToken(input.deviceToken) !== computer.deviceTokenHash) {
      throw this.createServiceError(401, "UNAUTHORIZED", "Invalid device token.");
    }

    return {
      computerId: computer.id,
      tenantId: computer.tenantId,
    };
  }

  private async assertRuleCapacityAvailable(
    tenantId: string,
    incomingCount: number,
  ): Promise<void> {
    const existingCount = await this.prismaClient.blockRule.count({
      where: {
        tenantId,
      },
    });

    if (existingCount + incomingCount > MAX_RULES_PER_TENANT) {
      throw this.createServiceError(
        409,
        "CONFLICT",
        `Block rule limit exceeded. Maximum ${MAX_RULES_PER_TENANT} rules per tenant.`,
        {
          maxRules: MAX_RULES_PER_TENANT,
        },
      );
    }
  }

  private async createBlockRuleOrThrowConflict(input: {
    tenantId: string;
    input: CreateBlockRuleInput;
    createdBy?: string;
  }): Promise<SafeBlockRuleMapperSource> {
    try {
      return await this.prismaClient.blockRule.create({
        data: {
          tenantId: input.tenantId,
          type: input.input.type,
          value: input.input.value,
          label: input.input.label,
          reason: input.input.reason,
          priority: input.input.priority ?? 0,
          createdBy: input.createdBy,
        },
        select: SAFE_BLOCK_RULE_SELECT,
      });
    } catch (error) {
      this.mapDuplicateBlockRuleError(error);
    }
  }

  private async findTenantScopedBlockRuleOrThrow(input: {
    tenantId: string;
    id: string;
  }): Promise<SafeBlockRuleMapperSource> {
    const rule = await this.prismaClient.blockRule.findFirst({
      where: {
        id: input.id,
        tenantId: input.tenantId,
      },
      select: SAFE_BLOCK_RULE_SELECT,
    });

    if (!rule) {
      throw this.createServiceError(404, "NOT_FOUND", "Block rule not found.");
    }

    return rule;
  }

  private assertNoDuplicateRulesInsideBatch(rules: CreateBlockRuleInput[]): void {
    const seenKeys = new Set<string>();

    for (const rule of rules) {
      const key = `${rule.type}:${rule.value}`;
      if (seenKeys.has(key)) {
        throw this.createDuplicateBlockRuleConflictError();
      }
      seenKeys.add(key);
    }
  }

  private assertTenantIdFromAuthContext(authContext: BlockRulesAuthContext): string {
    const tenantId = authContext.tenantId;

    if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
      throw this.createServiceError(403, "FORBIDDEN", "Tenant context is required.");
    }

    return tenantId;
  }

  private assertComputerIdFromAuthContext(authContext: BlockRulesAuthContext): string {
    const computerId = authContext.computerId;

    if (typeof computerId !== "string" || computerId.trim().length === 0) {
      throw this.createServiceError(401, "UNAUTHORIZED", "Computer context is required.");
    }

    return computerId;
  }

  private toSafeBlockRuleResponse(
    rule: SafeBlockRuleMapperSource,
  ): BlockRuleResponse {
    return mapBlockRuleToResponse(rule);
  }

  private buildBlockRuleListOrderBy(
    sort: BlockRuleSortInput | undefined,
  ): Prisma.BlockRuleOrderByWithRelationInput {
    const allowlistedSortMap: Record<
      BlockRuleSortInput,
      Prisma.BlockRuleOrderByWithRelationInput
    > = {
      "createdAt:desc": { createdAt: "desc" },
      "createdAt:asc": { createdAt: "asc" },
      "priority:desc": { priority: "desc" },
      "priority:asc": { priority: "asc" },
    };

    return sort ? allowlistedSortMap[sort] : allowlistedSortMap["createdAt:desc"];
  }

  private buildBlockRuleListSearchFilter(
    q: string | undefined,
  ): Prisma.BlockRuleWhereInput {
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
          value: {
            contains: normalizedQuery,
          },
        },
        {
          label: {
            contains: normalizedQuery,
          },
        },
      ],
    };
  }

  private broadcastRulesUpdated(
    tenantId: string,
    action: BlockRulesUpdatedAction,
  ): void {
    realtimeGateway?.emitBlockRulesUpdated(tenantId, {
      action,
      tenantId,
      timestamp: new Date().toISOString(),
    });
  }

  private createDuplicateBlockRuleConflictError(): AppError {
    return this.createServiceError(
      409,
      "CONFLICT",
      DUPLICATE_BLOCK_RULE_MESSAGE,
      {
        field: "value",
      },
    );
  }

  private isTenantTypeValueUniqueConstraintError(error: unknown): boolean {
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
      targetFields.includes("tenantId") &&
      targetFields.includes("type") &&
      targetFields.includes("value")
    );
  }

  private mapDuplicateBlockRuleError(error: unknown): never {
    if (this.isTenantTypeValueUniqueConstraintError(error)) {
      throw this.createDuplicateBlockRuleConflictError();
    }

    throw error;
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

export const blockRulesService = new BlockRulesService();
