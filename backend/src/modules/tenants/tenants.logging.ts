import { logger } from "../../shared/logging/logger";

type TenantsLogLevel = "info" | "warn" | "error";

export const TENANTS_LOG_EVENTS = {
  TENANT_NAME_UPDATED: "tenant.name.updated",
  TENANT_STATUS_UPDATED: "tenant.status.updated",
  COMPUTER_REGISTRATION_SECRET_REISSUED:
    "tenant.computer_registration_secret.reissued",
  CURRENT_TENANT_READ: "current_tenant_read",
  CURRENT_TENANT_UPDATED: "current_tenant_updated",
  TENANT_LIST_READ: "tenant_list_read",
  TENANT_DETAIL_READ: "tenant_detail_read",
  TENANT_UPDATED: "tenant_updated",
} as const;

export type TenantsLogEvent =
  (typeof TENANTS_LOG_EVENTS)[keyof typeof TENANTS_LOG_EVENTS];

type ForbiddenTenantsLogBodyFields = {
  body?: never;
  req?: never;
  requestBody?: never;
  rawBody?: never;
  headers?: never;
  rawHeaders?: never;
  requestHeaders?: never;
  authorization?: never;
  token?: never;
  accessToken?: never;
  refreshToken?: never;
  deviceToken?: never;
  deviceTokenHash?: never;
  bearerToken?: never;
  cookie?: never;
  setCookie?: never;
};

export type TenantsEventLogInput = {
  requestId?: string;
  event: TenantsLogEvent;
  level?: TenantsLogLevel;
  actorUserId?: string;
  actorRole?: string;
  actorTenantId?: string | null;
  userId?: string;
  tenantId?: string | null;
  role?: string;
  targetTenantId?: string;
  status?: string;
  oldStatus?: string;
  newStatus?: string;
  reasonLength?: number;
  ip?: string;
  userAgent?: string;
} & ForbiddenTenantsLogBodyFields;

export type TenantNameUpdatedLogInput = {
  requestId?: string;
  actorUserId?: string;
  actorRole?: string;
  actorTenantId?: string | null;
  targetTenantId: string;
} & ForbiddenTenantsLogBodyFields;

export type TenantStatusUpdatedLogInput = {
  requestId?: string;
  actorUserId?: string;
  actorRole?: string;
  actorTenantId?: string | null;
  targetTenantId: string;
  oldStatus: string;
  newStatus: string;
} & ForbiddenTenantsLogBodyFields;

export type ComputerRegistrationSecretReissuedLogInput = {
  requestId?: string;
  actorUserId?: string;
  actorRole?: string;
  actorTenantId?: string | null;
  targetTenantId: string;
  status?: string;
  reasonLength?: number;
} & ForbiddenTenantsLogBodyFields;

const rawBodyFieldKeys = ["body", "req", "requestBody", "rawBody"] as const;
const rawHeaderFieldKeys = [
  "headers",
  "rawHeaders",
  "requestHeaders",
  "authorization",
] as const;
const tokenFieldKeys = [
  "token",
  "accessToken",
  "refreshToken",
  "deviceToken",
  "deviceTokenHash",
  "bearerToken",
  "cookie",
  "setCookie",
] as const;

export class TenantsLoggingService {
  public logTenantNameUpdated(input: TenantNameUpdatedLogInput): void {
    this.logTenantsEvent({
      requestId: input.requestId,
      event: TENANTS_LOG_EVENTS.TENANT_NAME_UPDATED,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      actorTenantId: input.actorTenantId,
      userId: input.actorUserId,
      role: input.actorRole,
      tenantId: input.actorTenantId,
      targetTenantId: input.targetTenantId,
    });
  }

  public logTenantStatusUpdated(input: TenantStatusUpdatedLogInput): void {
    this.logTenantsEvent({
      requestId: input.requestId,
      event: TENANTS_LOG_EVENTS.TENANT_STATUS_UPDATED,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      actorTenantId: input.actorTenantId,
      userId: input.actorUserId,
      role: input.actorRole,
      tenantId: input.actorTenantId,
      targetTenantId: input.targetTenantId,
      status: input.newStatus,
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
    });
  }

  public logComputerRegistrationSecretReissued(
    input: ComputerRegistrationSecretReissuedLogInput,
  ): void {
    this.logTenantsEvent({
      requestId: input.requestId,
      event: TENANTS_LOG_EVENTS.COMPUTER_REGISTRATION_SECRET_REISSUED,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      actorTenantId: input.actorTenantId,
      userId: input.actorUserId,
      role: input.actorRole,
      tenantId: input.actorTenantId,
      targetTenantId: input.targetTenantId,
      status: input.status,
      reasonLength: input.reasonLength,
    });
  }

  public logTenantsEvent(input: TenantsEventLogInput): void {
    const actorUserId = input.actorUserId ?? input.userId;
    const actorRole = input.actorRole ?? input.role;
    const actorTenantId = input.actorTenantId ?? input.tenantId;

    const hasRawBodyField = rawBodyFieldKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    );
    const hasRawHeaderField = rawHeaderFieldKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    );
    const hasTokenField = tokenFieldKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    );

    // Never spread caller input into payload to avoid leaking raw request data.
    const payload = {
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      event: input.event,
      actorUserId,
      actorRole,
      actorTenantId,
      userId: input.userId,
      tenantId: input.tenantId,
      role: input.role,
      targetTenantId: input.targetTenantId,
      status: input.status,
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
      reasonLength: input.reasonLength,
      ip: input.ip,
      userAgent: input.userAgent,
      droppedRawRequestBody: hasRawBodyField || undefined,
      droppedRawRequestHeaders: hasRawHeaderField || undefined,
      droppedSensitiveTokens: hasTokenField || undefined,
    };

    const level = input.level ?? "info";
    if (level === "error") {
      logger.error(payload, "tenants event");
      return;
    }

    if (level === "warn") {
      logger.warn(payload, "tenants event");
      return;
    }

    logger.info(payload, "tenants event");
  }
}

export const tenantsLoggingService = new TenantsLoggingService();
