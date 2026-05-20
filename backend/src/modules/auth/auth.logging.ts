import { createHash } from "node:crypto";
import { logger } from "../../shared/logging/logger";
import type { AuthRole } from "./auth.types";

const MASK_CHAR = "*";

type AuthLogLevel = "info" | "warn" | "error";

export const AUTH_LOG_EVENTS = {
  REGISTER_TENANT_REQUESTED: "register_tenant_requested",
  REGISTER_TENANT_VERIFICATION_SENT: "register_tenant_verification_sent",
  REGISTER_TENANT_VERIFICATION_FAILED: "register_tenant_verification_failed",
  REGISTER_TENANT_COMPLETED: "register_tenant_completed",
  LOGIN_SUCCEEDED: "login_succeeded",
  LOGIN_FAILED: "login_failed",
  REFRESH_SUCCEEDED: "refresh_succeeded",
  REFRESH_FAILED: "refresh_failed",
  LOGOUT_COMPLETED: "logout_completed",
  ME_LOADED: "me_loaded",
  AUTH_TOKEN_INVALID: "auth_token_invalid",
  AUTH_TOKEN_EXPIRED: "auth_token_expired",
  RATE_LIMIT_HIT: "rate_limit_hit",
} as const;

export type AuthLogEvent =
  (typeof AUTH_LOG_EVENTS)[keyof typeof AUTH_LOG_EVENTS];

type ForbiddenAuthLogBodyFields = {
  body?: never;
  req?: never;
  requestBody?: never;
  rawBody?: never;
};

export type AuthEventLogInput = {
  requestId: string;
  event: AuthLogEvent;
  level?: AuthLogLevel;
  userId?: string;
  tenantId?: string | null;
  role?: AuthRole;
  maskedEmail?: string;
  emailHash?: string;
  reason?: string;
  status?: string;
  ip?: string;
  userAgent?: string;
  durationMs?: number;
} & ForbiddenAuthLogBodyFields;

const rawBodyFieldKeys = ["body", "req", "requestBody", "rawBody"] as const;

const maskSegment = (segment: string): string => {
  if (segment.length <= 1) {
    return MASK_CHAR;
  }

  return `${segment[0]}${MASK_CHAR.repeat(segment.length - 1)}`;
};

const getDefaultLevelByEvent = (event: AuthLogEvent): AuthLogLevel => {
  if (
    event === AUTH_LOG_EVENTS.LOGIN_FAILED ||
    event === AUTH_LOG_EVENTS.REFRESH_FAILED ||
    event === AUTH_LOG_EVENTS.REGISTER_TENANT_VERIFICATION_FAILED ||
    event === AUTH_LOG_EVENTS.AUTH_TOKEN_INVALID ||
    event === AUTH_LOG_EVENTS.AUTH_TOKEN_EXPIRED ||
    event === AUTH_LOG_EVENTS.RATE_LIMIT_HIT
  ) {
    return "warn";
  }

  return "info";
};

export class AuthLoggingService {
  public maskEmail(email: string): string {
    const normalizedEmail = email.trim().toLowerCase();
    const atIndex = normalizedEmail.indexOf("@");

    if (atIndex <= 0 || atIndex === normalizedEmail.length - 1) {
      return MASK_CHAR.repeat(Math.max(normalizedEmail.length, 1));
    }

    const localPart = normalizedEmail.slice(0, atIndex);
    const domainPart = normalizedEmail.slice(atIndex + 1);

    return `${maskSegment(localPart)}@${maskSegment(domainPart)}`;
  }

  public hashEmail(email: string): string {
    return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  }

  public logAuthEvent(input: AuthEventLogInput): void {
    const hasRawBodyField = rawBodyFieldKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    );

    // Never spread caller input into log payload to avoid request-body leakage.
    const payload = {
      requestId: input.requestId,
      event: input.event,
      userId: input.userId,
      tenantId: input.tenantId,
      role: input.role,
      maskedEmail: input.maskedEmail,
      emailHash: input.emailHash,
      reason: input.reason,
      status: input.status,
      ip: input.ip,
      userAgent: input.userAgent,
      durationMs: input.durationMs,
      droppedRawRequestBody: hasRawBodyField || undefined,
    };

    const level = input.level ?? getDefaultLevelByEvent(input.event);

    if (level === "error") {
      logger.error(payload, "auth event");
      return;
    }

    if (level === "warn") {
      logger.warn(payload, "auth event");
      return;
    }

    logger.info(payload, "auth event");
  }
}

export const authLoggingService = new AuthLoggingService();
