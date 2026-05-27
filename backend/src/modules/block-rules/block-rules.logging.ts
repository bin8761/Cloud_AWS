import { logger } from "../../shared/logging/logger";
import type { AuthRole } from "../../shared/middleware/auth-context";

type BlockRulesLogLevel = "info" | "warn" | "error";

export const BLOCK_RULES_LOG_EVENTS = {
  CREATED: "block-rule.created",
  BATCH_CREATED: "block-rule.batch-created",
  LISTED: "block-rule.listed",
  VIEWED: "block-rule.viewed",
  UPDATED: "block-rule.updated",
  DELETED: "block-rule.deleted",
  ACTIVE_FETCHED: "block-rule.active-fetched",
  RATE_LIMIT_HIT: "block-rule.rate_limit_hit",
} as const;

type BlockRulesLogEvent =
  (typeof BLOCK_RULES_LOG_EVENTS)[keyof typeof BLOCK_RULES_LOG_EVENTS];

type ForbiddenBlockRulesLogFields = {
  body?: never;
  req?: never;
  requestBody?: never;
  rawBody?: never;
  authorization?: never;
  headers?: never;
  deviceToken?: never;
  deviceTokenHash?: never;
};

export type BlockRulesLogContext = {
  requestId?: string;
  tenantId?: string | null;
  blockRuleId?: string;
  computerId?: string;
  actorUserId?: string;
  actorRole?: AuthRole;
  ip?: string;
  userAgent?: string;
};

export type BlockRulesEventLogInput = {
  event: BlockRulesLogEvent;
  level?: BlockRulesLogLevel;
  status?: string;
  reason?: string;
  key?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  count?: number;
  filterType?: string;
  filterStatus?: string;
  sort?: string;
  hasQuery?: boolean;
  qLength?: number;
} & BlockRulesLogContext &
  ForbiddenBlockRulesLogFields;

type BlockRulesSpecificEventLogInput = Omit<BlockRulesEventLogInput, "event">;

const rawBodyFieldKeys = ["body", "req", "requestBody", "rawBody"] as const;
const sensitivePayloadFieldKeys = [
  "authorization",
  "headers",
  "deviceToken",
  "deviceTokenHash",
] as const;

const getDefaultLevelByEvent = (
  event: BlockRulesLogEvent,
): BlockRulesLogLevel =>
  event === BLOCK_RULES_LOG_EVENTS.RATE_LIMIT_HIT ? "warn" : "info";

export class BlockRulesLoggingService {
  public logBlockRulesEvent(input: BlockRulesEventLogInput): void {
    const hasRawBodyField = rawBodyFieldKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    );
    const hasSensitiveField = sensitivePayloadFieldKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    );

    const payload = {
      requestId: input.requestId,
      tenantId: input.tenantId,
      blockRuleId: input.blockRuleId,
      computerId: input.computerId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      event: input.event,
      status: input.status,
      reason: input.reason,
      key: input.key,
      ip: input.ip,
      userAgent: input.userAgent,
      page: input.page,
      pageSize: input.pageSize,
      total: input.total,
      count: input.count,
      filterType: input.filterType,
      filterStatus: input.filterStatus,
      sort: input.sort,
      hasQuery: input.hasQuery,
      qLength: input.qLength,
      droppedRawRequestBody: hasRawBodyField || hasSensitiveField || undefined,
    };

    const level = input.level ?? getDefaultLevelByEvent(input.event);
    if (level === "error") {
      logger.error(payload, "block rules event");
      return;
    }

    if (level === "warn") {
      logger.warn(payload, "block rules event");
      return;
    }

    logger.info(payload, "block rules event");
  }

  public logRateLimitEvent(input: BlockRulesEventLogInput): void {
    this.logBlockRulesEvent(input);
  }

  public logBlockRuleCreated(input: BlockRulesSpecificEventLogInput): void {
    this.logBlockRulesEvent({ ...input, event: BLOCK_RULES_LOG_EVENTS.CREATED });
  }

  public logBlockRuleBatchCreated(input: BlockRulesSpecificEventLogInput): void {
    this.logBlockRulesEvent({
      ...input,
      event: BLOCK_RULES_LOG_EVENTS.BATCH_CREATED,
    });
  }

  public logBlockRuleListed(input: BlockRulesSpecificEventLogInput): void {
    this.logBlockRulesEvent({ ...input, event: BLOCK_RULES_LOG_EVENTS.LISTED });
  }

  public logBlockRuleViewed(input: BlockRulesSpecificEventLogInput): void {
    this.logBlockRulesEvent({ ...input, event: BLOCK_RULES_LOG_EVENTS.VIEWED });
  }

  public logBlockRuleUpdated(input: BlockRulesSpecificEventLogInput): void {
    this.logBlockRulesEvent({ ...input, event: BLOCK_RULES_LOG_EVENTS.UPDATED });
  }

  public logBlockRuleDeleted(input: BlockRulesSpecificEventLogInput): void {
    this.logBlockRulesEvent({ ...input, event: BLOCK_RULES_LOG_EVENTS.DELETED });
  }

  public logActiveRulesFetched(input: BlockRulesSpecificEventLogInput): void {
    this.logBlockRulesEvent({
      ...input,
      event: BLOCK_RULES_LOG_EVENTS.ACTIVE_FETCHED,
    });
  }
}

export const blockRulesLoggingService = new BlockRulesLoggingService();
