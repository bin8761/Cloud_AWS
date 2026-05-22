import { logger } from "../../shared/logging/logger";

type UsersLogLevel = "info" | "warn" | "error";

export const USERS_LOG_EVENTS = {
  STAFF_CREATED: "user.staff.created",
  STAFF_UPDATED: "user.staff.updated",
  STAFF_STATUS_UPDATED: "user.staff.status.updated",
  STAFF_PASSWORD_RESET: "user.staff.password.reset",
} as const;

export type UsersLogEvent =
  (typeof USERS_LOG_EVENTS)[keyof typeof USERS_LOG_EVENTS];

type ForbiddenUsersLogSensitiveFields = {
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
  bearerToken?: never;
  cookie?: never;
  setCookie?: never;
  password?: never;
  rawPassword?: never;
  newPassword?: never;
  currentPassword?: never;
  passwordHash?: never;
};

export type UsersEventLogInput = {
  requestId?: string;
  event: UsersLogEvent;
  level?: UsersLogLevel;
  actorUserId?: string;
  actorRole?: string;
  actorTenantId?: string | null;
  targetUserId?: string;
  targetTenantId?: string | null;
  oldStatus?: string;
  newStatus?: string;
  changedFields?: string[];
} & ForbiddenUsersLogSensitiveFields;

export type StaffCreatedLogInput = {
  requestId?: string;
  actorUserId?: string;
  actorRole?: string;
  actorTenantId?: string | null;
  targetUserId: string;
  targetTenantId?: string | null;
};

export type StaffUpdatedLogInput = {
  requestId?: string;
  actorUserId?: string;
  actorRole?: string;
  actorTenantId?: string | null;
  targetUserId: string;
  targetTenantId?: string | null;
  changedFields?: string[];
};

export type StaffStatusUpdatedLogInput = {
  requestId?: string;
  actorUserId?: string;
  actorRole?: string;
  actorTenantId?: string | null;
  targetUserId: string;
  targetTenantId?: string | null;
  oldStatus: string;
  newStatus: string;
  changedFields?: string[];
};

export type StaffPasswordResetLogInput = {
  requestId?: string;
  actorUserId?: string;
  actorRole?: string;
  actorTenantId?: string | null;
  targetUserId: string;
  targetTenantId?: string | null;
  changedFields?: string[];
};

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
  "bearerToken",
  "cookie",
  "setCookie",
] as const;
const passwordFieldKeys = [
  "password",
  "rawPassword",
  "newPassword",
  "currentPassword",
  "passwordHash",
] as const;

export class UsersLoggingService {
  public logStaffCreated(input: StaffCreatedLogInput): void {
    this.logUsersEvent({
      requestId: input.requestId,
      event: USERS_LOG_EVENTS.STAFF_CREATED,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      actorTenantId: input.actorTenantId,
      targetUserId: input.targetUserId,
      targetTenantId: input.targetTenantId,
    });
  }

  public logStaffUpdated(input: StaffUpdatedLogInput): void {
    this.logUsersEvent({
      requestId: input.requestId,
      event: USERS_LOG_EVENTS.STAFF_UPDATED,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      actorTenantId: input.actorTenantId,
      targetUserId: input.targetUserId,
      targetTenantId: input.targetTenantId,
      changedFields: input.changedFields,
    });
  }

  public logStaffStatusUpdated(input: StaffStatusUpdatedLogInput): void {
    this.logUsersEvent({
      requestId: input.requestId,
      event: USERS_LOG_EVENTS.STAFF_STATUS_UPDATED,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      actorTenantId: input.actorTenantId,
      targetUserId: input.targetUserId,
      targetTenantId: input.targetTenantId,
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
      changedFields: input.changedFields,
    });
  }

  public logStaffPasswordReset(input: StaffPasswordResetLogInput): void {
    this.logUsersEvent({
      requestId: input.requestId,
      event: USERS_LOG_EVENTS.STAFF_PASSWORD_RESET,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      actorTenantId: input.actorTenantId,
      targetUserId: input.targetUserId,
      targetTenantId: input.targetTenantId,
      changedFields: input.changedFields,
    });
  }

  public logUsersEvent(input: UsersEventLogInput): void {
    const hasRawBodyField = rawBodyFieldKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    );
    const hasRawHeaderField = rawHeaderFieldKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    );
    const hasTokenField = tokenFieldKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    );
    const hasPasswordField = passwordFieldKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    );

    // Never spread caller input into payload to avoid leaking sensitive values.
    const payload = {
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      event: input.event,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      actorTenantId: input.actorTenantId,
      targetUserId: input.targetUserId,
      targetTenantId: input.targetTenantId,
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
      changedFields: input.changedFields,
      droppedRawRequestBody: hasRawBodyField || undefined,
      droppedRawRequestHeaders: hasRawHeaderField || undefined,
      droppedSensitiveTokens: hasTokenField || undefined,
      droppedPasswordData: hasPasswordField || undefined,
    };

    const level = input.level ?? "info";
    if (level === "error") {
      logger.error(payload, "users event");
      return;
    }

    if (level === "warn") {
      logger.warn(payload, "users event");
      return;
    }

    logger.info(payload, "users event");
  }
}

export const usersLoggingService = new UsersLoggingService();
