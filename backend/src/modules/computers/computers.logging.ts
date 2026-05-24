import { logger } from "../../shared/logging/logger";
import type { AuthRole } from "../../shared/middleware/auth-context";

type ComputersLogLevel = "info" | "warn" | "error";

export const COMPUTERS_LOG_EVENTS = {
  REGISTERED: "computer.registered",
  REGISTER_FAILED: "computer.register.failed",
  REGISTER_CONFLICT: "computer.register.conflict",
  LISTED: "computer.listed",
  VIEWED: "computer.viewed",
  UPDATED: "computer.updated",
  TOKEN_REISSUED: "computer.token.reissued",
  RATE_LIMIT_HIT: "computer.register.rate_limit_hit",
} as const;

type ComputersLogEvent =
  (typeof COMPUTERS_LOG_EVENTS)[keyof typeof COMPUTERS_LOG_EVENTS];

type ForbiddenComputersLogFields = {
  body?: never;
  req?: never;
  requestBody?: never;
  rawBody?: never;
  authorization?: never;
  headers?: never;
  registrationSecretHash?: never;
  deviceToken?: never;
  deviceTokenHash?: never;
  registrationSecret?: never;
};

export type ComputersLogContext = {
  requestId?: string;
  tenantId?: string | null;
  computerId?: string;
  actorUserId?: string;
  actorRole?: AuthRole;
  ip?: string;
  userAgent?: string;
};

export type ComputersEventLogInput = {
  event: ComputersLogEvent;
  level?: ComputersLogLevel;
  status?: string;
  reason?: string;
  key?: string;
  tenantCode?: string;
} & ComputersLogContext &
  ForbiddenComputersLogFields;

export type ComputerRegisteredLogInput = {
  status?: string;
} & ComputersLogContext &
  ForbiddenComputersLogFields;

export type ComputerRegisterFailedLogInput = {
  status?: string;
  reason?: string;
} & ComputersLogContext &
  ForbiddenComputersLogFields;

export type ComputerRegisterConflictLogInput = {
  status?: string;
  reason?: string;
} & ComputersLogContext &
  ForbiddenComputersLogFields;

export type ComputerListedLogInput = {
  status?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  filterStatus?: string;
  sort?: "createdAt:desc" | "createdAt:asc" | "name:asc" | "name:desc";
  hasQuery?: boolean;
  qLength?: number;
} & ComputersLogContext &
  ForbiddenComputersLogFields;

export type ComputerViewedLogInput = {
  status?: string;
} & ComputersLogContext &
  ForbiddenComputersLogFields;

export type ComputerUpdatedLogInput = {
  status?: string;
  updatedFieldNames: string[];
} & ComputersLogContext &
  ForbiddenComputersLogFields;

export type ComputerTokenReissuedLogInput = {
  status?: string;
  reason?: string;
} & ComputersLogContext &
  ForbiddenComputersLogFields;

const rawBodyFieldKeys = ["body", "req", "requestBody", "rawBody"] as const;
const sensitivePayloadFieldKeys = [
  "authorization",
  "headers",
  "registrationSecret",
  "registrationSecretHash",
  "deviceToken",
  "deviceTokenHash",
] as const;

const getDefaultLevelByEvent = (event: ComputersLogEvent): ComputersLogLevel => {
  if (
    event === COMPUTERS_LOG_EVENTS.RATE_LIMIT_HIT ||
    event === COMPUTERS_LOG_EVENTS.REGISTER_FAILED ||
    event === COMPUTERS_LOG_EVENTS.REGISTER_CONFLICT
  ) {
    return "warn";
  }

  return "info";
};

export class ComputersLoggingService {
  public logComputersEvent(input: ComputersEventLogInput): void {
    const hasRawBodyField = rawBodyFieldKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    );
    const hasSensitiveField = sensitivePayloadFieldKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    );

    // Build payload explicitly to prevent leaking request bodies or secrets.
    const payload = {
      requestId: input.requestId,
      tenantId: input.tenantId,
      computerId: input.computerId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      event: input.event,
      status: input.status,
      reason: input.reason,
      key: input.key,
      ip: input.ip,
      userAgent: input.userAgent,
      tenantCode: input.tenantCode,
      page:
        "page" in input && typeof input.page === "number" ? input.page : undefined,
      pageSize:
        "pageSize" in input && typeof input.pageSize === "number"
          ? input.pageSize
          : undefined,
      total:
        "total" in input && typeof input.total === "number" ? input.total : undefined,
      filterStatus:
        "filterStatus" in input && typeof input.filterStatus === "string"
          ? input.filterStatus
          : undefined,
      sort:
        "sort" in input && typeof input.sort === "string" ? input.sort : undefined,
      hasQuery:
        "hasQuery" in input && typeof input.hasQuery === "boolean"
          ? input.hasQuery
          : undefined,
      qLength:
        "qLength" in input && typeof input.qLength === "number"
          ? input.qLength
          : undefined,
      droppedRawRequestBody: hasRawBodyField || hasSensitiveField || undefined,
    };

    const level = input.level ?? getDefaultLevelByEvent(input.event);

    if (level === "error") {
      logger.error(payload, "computers event");
      return;
    }

    if (level === "warn") {
      logger.warn(payload, "computers event");
      return;
    }

    logger.info(payload, "computers event");
  }

  public logRateLimitEvent(input: ComputersEventLogInput): void {
    this.logComputersEvent(input);
  }

  public logComputerRegistered(input: ComputerRegisteredLogInput): void {
    this.logComputersEvent({
      ...input,
      event: COMPUTERS_LOG_EVENTS.REGISTERED,
    });
  }

  public logComputerRegisterFailed(input: ComputerRegisterFailedLogInput): void {
    this.logComputersEvent({
      ...input,
      event: COMPUTERS_LOG_EVENTS.REGISTER_FAILED,
    });
  }

  public logComputerRegisterConflict(
    input: ComputerRegisterConflictLogInput,
  ): void {
    this.logComputersEvent({
      ...input,
      event: COMPUTERS_LOG_EVENTS.REGISTER_CONFLICT,
    });
  }

  public logComputerListed(input: ComputerListedLogInput): void {
    this.logComputersEvent({
      ...input,
      event: COMPUTERS_LOG_EVENTS.LISTED,
      reason: input.total !== undefined ? "list_query_executed" : undefined,
      key:
        input.total !== undefined && input.page !== undefined
          ? `p${input.page}:n${input.total}`
          : undefined,
    });
  }

  public logComputerViewed(input: ComputerViewedLogInput): void {
    this.logComputersEvent({
      ...input,
      event: COMPUTERS_LOG_EVENTS.VIEWED,
    });
  }

  public logComputerUpdated(input: ComputerUpdatedLogInput): void {
    const uniqueFieldNames = [...new Set(input.updatedFieldNames.map((name) => name.trim()))]
      .filter((name) => name.length > 0);

    this.logComputersEvent({
      ...input,
      event: COMPUTERS_LOG_EVENTS.UPDATED,
      reason: `updated_fields:${uniqueFieldNames.join(",") || "none"}`,
    });
  }

  public logComputerTokenReissued(
    input: ComputerTokenReissuedLogInput,
  ): void {
    this.logComputersEvent({
      ...input,
      event: COMPUTERS_LOG_EVENTS.TOKEN_REISSUED,
    });
  }
}

export const computersLoggingService = new ComputersLoggingService();
