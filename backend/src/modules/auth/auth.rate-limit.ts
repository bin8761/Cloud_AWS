import type { Request } from "express";
import { env } from "../../config/env";
import {
  createRateLimitMiddleware,
  type RateLimitExceededContext,
} from "../../shared/rate-limit/rate-limit.middleware";
import { createRateLimitStore } from "../../shared/rate-limit/rate-limit-store.factory";
import { AUTH_LOG_EVENTS, authLoggingService } from "./auth.logging";
import { normalizeEmail } from "./auth.schema";

type EmailBodyField = "adminEmail" | "email";

const AUTH_IP_EMAIL_KEY_PREFIX = "auth:ip-email";
const AUTH_REGISTRATION_IP_KEY_PREFIX = "auth:registration-ip";
const AUTH_TOKEN_FAMILY_IP_KEY_PREFIX = "auth:token-family-ip";
const AUTH_LOGOUT_IP_KEY_PREFIX = "auth:logout-ip";
const RATE_LIMITED_STATUS = "RATE_LIMITED";
const UNKNOWN_IP_KEY_PART = "unknown-ip";
const MISSING_EMAIL_KEY_PART = "missing-email";
const MISSING_REGISTRATION_ID_KEY_PART = "missing-registration-id";
const MISSING_TOKEN_FAMILY_KEY_PART = "missing-token-family";
const REGISTER_TENANT_RATE_LIMIT_CAPACITY = 3;
const REGISTER_TENANT_RATE_LIMIT_REFILL_TOKENS = 1;
const REGISTER_TENANT_RATE_LIMIT_REFILL_WINDOW_SECONDS = 20 * 60;
const REGISTER_TENANT_VERIFY_RATE_LIMIT_CAPACITY = 5;
const REGISTER_TENANT_VERIFY_RATE_LIMIT_REFILL_TOKENS = 1;
// Task 167 decision: MVP uses token-bucket approximation instead of a custom
// auth-specific "block-until-expiry" helper for verify-code limiting.
const REGISTER_TENANT_VERIFY_RATE_LIMIT_REFILL_WINDOW_SECONDS = 5 * 60;
const REGISTER_TENANT_RESEND_RATE_LIMIT_CAPACITY = 1;
const REGISTER_TENANT_RESEND_RATE_LIMIT_REFILL_TOKENS = 1;
const REGISTER_TENANT_RESEND_RATE_LIMIT_REFILL_WINDOW_SECONDS = 60;
const LOGIN_RATE_LIMIT_CAPACITY = 5;
const LOGIN_RATE_LIMIT_REFILL_TOKENS = 1;
const LOGIN_RATE_LIMIT_REFILL_WINDOW_SECONDS = 3 * 60;
const REFRESH_RATE_LIMIT_CAPACITY = 30;
const REFRESH_RATE_LIMIT_REFILL_TOKENS = 1;
const REFRESH_RATE_LIMIT_REFILL_WINDOW_SECONDS = 2;
const LOGOUT_RATE_LIMIT_CAPACITY = 30;
const LOGOUT_RATE_LIMIT_REFILL_TOKENS = 1;
const LOGOUT_RATE_LIMIT_REFILL_WINDOW_SECONDS = 2;
const REGISTER_TENANT_RATE_LIMIT_REASON = "register_tenant_rate_limit_hit";
const REGISTER_TENANT_VERIFY_RATE_LIMIT_REASON = "register_tenant_verify_rate_limit_hit";
const REGISTER_TENANT_RESEND_RATE_LIMIT_REASON = "register_tenant_resend_rate_limit_hit";
const LOGIN_RATE_LIMIT_REASON = "login_rate_limit_hit";
const REFRESH_RATE_LIMIT_REASON = "refresh_rate_limit_hit";
const LOGOUT_RATE_LIMIT_REASON = "logout_rate_limit_hit";

const authRateLimitStore = createRateLimitStore({
  type: env.rateLimit.store,
});

const normalizeIpForKey = (ip: string | undefined): string => {
  if (!ip) {
    return UNKNOWN_IP_KEY_PART;
  }

  const normalizedIp = ip.trim();
  return normalizedIp.length > 0 ? normalizedIp : UNKNOWN_IP_KEY_PART;
};

const readBodyEmailField = (request: Request, field: EmailBodyField): string | null => {
  const body = request.body as Record<string, unknown> | undefined;
  const value = body?.[field];

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const getRequestUserAgent = (request: Request): string | undefined => {
  const userAgentHeader = request.headers["user-agent"];

  if (typeof userAgentHeader === "string") {
    return userAgentHeader;
  }

  return userAgentHeader?.[0];
};

const getRateLimitEmailHash = (
  request: Request,
  field: EmailBodyField,
): string | undefined => {
  const email = readBodyEmailField(request, field);

  if (!email) {
    return undefined;
  }

  return authLoggingService.hashEmail(normalizeEmail(email));
};

const logRateLimitHit = (
  context: RateLimitExceededContext,
  reason: string,
  emailHash?: string,
): void => {
  authLoggingService.logAuthEvent({
    requestId: context.request.requestId,
    event: AUTH_LOG_EVENTS.RATE_LIMIT_HIT,
    status: RATE_LIMITED_STATUS,
    reason,
    emailHash,
    ip: context.request.ip,
    userAgent: getRequestUserAgent(context.request),
  });
};

export const buildAuthIpNormalizedEmailRateLimitKey = (
  ip: string | undefined,
  email: string | undefined,
): string => {
  const normalizedIp = normalizeIpForKey(ip);
  const normalizedEmail = email ? normalizeEmail(email) : MISSING_EMAIL_KEY_PART;
  return `${AUTH_IP_EMAIL_KEY_PREFIX}:${normalizedIp}:${normalizedEmail}`;
};

export const createAuthIpEmailRateLimitKeyStrategy = (
  field: EmailBodyField,
): ((request: Request) => string) => {
  return (request: Request): string => {
    const email = readBodyEmailField(request, field) ?? undefined;
    return buildAuthIpNormalizedEmailRateLimitKey(request.ip, email);
  };
};

export const registerTenantIpEmailRateLimitKeyStrategy =
  createAuthIpEmailRateLimitKeyStrategy("adminEmail");

export const loginIpEmailRateLimitKeyStrategy =
  createAuthIpEmailRateLimitKeyStrategy("email");

export const buildAuthRegistrationIdIpRateLimitKey = (
  ip: string | undefined,
  registrationId: string | undefined,
): string => {
  const normalizedIp = normalizeIpForKey(ip);
  const normalizedRegistrationId = registrationId?.trim() || MISSING_REGISTRATION_ID_KEY_PART;
  return `${AUTH_REGISTRATION_IP_KEY_PREFIX}:${normalizedRegistrationId}:${normalizedIp}`;
};

export const registerTenantVerifyIdIpRateLimitKeyStrategy = (
  request: Request,
): string => {
  const body = request.body as Record<string, unknown> | undefined;
  const registrationIdValue = body?.registrationId;
  const registrationId =
    typeof registrationIdValue === "string" ? registrationIdValue : undefined;

  return buildAuthRegistrationIdIpRateLimitKey(request.ip, registrationId);
};

export const buildAuthTokenFamilyOrIpRateLimitKey = (
  ip: string | undefined,
  tokenFamilyId: string | undefined,
): string => {
  const normalizedIp = normalizeIpForKey(ip);
  const normalizedFamilyId = tokenFamilyId?.trim();

  if (normalizedFamilyId) {
    return `${AUTH_TOKEN_FAMILY_IP_KEY_PREFIX}:${normalizedFamilyId}`;
  }

  return `${AUTH_TOKEN_FAMILY_IP_KEY_PREFIX}:${MISSING_TOKEN_FAMILY_KEY_PART}:${normalizedIp}`;
};

export const refreshTokenFamilyOrIpRateLimitKeyStrategy = (
  request: Request,
): string => {
  const body = request.body as Record<string, unknown> | undefined;
  const tokenFamilyValue = body?.tokenFamilyId;
  const tokenFamilyId = typeof tokenFamilyValue === "string" ? tokenFamilyValue : undefined;

  return buildAuthTokenFamilyOrIpRateLimitKey(request.ip, tokenFamilyId);
};

export const buildAuthLogoutIpRateLimitKey = (ip: string | undefined): string => {
  const normalizedIp = normalizeIpForKey(ip);
  return `${AUTH_LOGOUT_IP_KEY_PREFIX}:${normalizedIp}`;
};

export const logoutIpRateLimitKeyStrategy = (request: Request): string => {
  return buildAuthLogoutIpRateLimitKey(request.ip);
};

const registerTenantRateLimitExceededHandler = (
  context: RateLimitExceededContext,
): void => {
  logRateLimitHit(
    context,
    REGISTER_TENANT_RATE_LIMIT_REASON,
    getRateLimitEmailHash(context.request, "adminEmail"),
  );
};

const registerTenantVerifyRateLimitExceededHandler = (
  context: RateLimitExceededContext,
): void => {
  logRateLimitHit(context, REGISTER_TENANT_VERIFY_RATE_LIMIT_REASON);
};

const registerTenantResendRateLimitExceededHandler = (
  context: RateLimitExceededContext,
): void => {
  logRateLimitHit(context, REGISTER_TENANT_RESEND_RATE_LIMIT_REASON);
};

const loginRateLimitExceededHandler = (context: RateLimitExceededContext): void => {
  logRateLimitHit(
    context,
    LOGIN_RATE_LIMIT_REASON,
    getRateLimitEmailHash(context.request, "email"),
  );
};

const refreshRateLimitExceededHandler = (context: RateLimitExceededContext): void => {
  logRateLimitHit(context, REFRESH_RATE_LIMIT_REASON);
};

const logoutRateLimitExceededHandler = (context: RateLimitExceededContext): void => {
  logRateLimitHit(context, LOGOUT_RATE_LIMIT_REASON);
};

export const registerTenantRateLimitMiddleware = createRateLimitMiddleware({
  store: authRateLimitStore,
  keyStrategy: registerTenantIpEmailRateLimitKeyStrategy,
  capacity: REGISTER_TENANT_RATE_LIMIT_CAPACITY,
  refillTokens: REGISTER_TENANT_RATE_LIMIT_REFILL_TOKENS,
  refillWindowSeconds: REGISTER_TENANT_RATE_LIMIT_REFILL_WINDOW_SECONDS,
  onRateLimitExceeded: registerTenantRateLimitExceededHandler,
});

export const registerTenantVerifyRateLimitMiddleware = createRateLimitMiddleware({
  store: authRateLimitStore,
  keyStrategy: registerTenantVerifyIdIpRateLimitKeyStrategy,
  capacity: REGISTER_TENANT_VERIFY_RATE_LIMIT_CAPACITY,
  refillTokens: REGISTER_TENANT_VERIFY_RATE_LIMIT_REFILL_TOKENS,
  refillWindowSeconds: REGISTER_TENANT_VERIFY_RATE_LIMIT_REFILL_WINDOW_SECONDS,
  onRateLimitExceeded: registerTenantVerifyRateLimitExceededHandler,
});

export const registerTenantResendRateLimitMiddleware = createRateLimitMiddleware({
  store: authRateLimitStore,
  keyStrategy: registerTenantVerifyIdIpRateLimitKeyStrategy,
  capacity: REGISTER_TENANT_RESEND_RATE_LIMIT_CAPACITY,
  refillTokens: REGISTER_TENANT_RESEND_RATE_LIMIT_REFILL_TOKENS,
  refillWindowSeconds: REGISTER_TENANT_RESEND_RATE_LIMIT_REFILL_WINDOW_SECONDS,
  onRateLimitExceeded: registerTenantResendRateLimitExceededHandler,
});

export const loginRateLimitMiddleware = createRateLimitMiddleware({
  store: authRateLimitStore,
  keyStrategy: loginIpEmailRateLimitKeyStrategy,
  capacity: LOGIN_RATE_LIMIT_CAPACITY,
  refillTokens: LOGIN_RATE_LIMIT_REFILL_TOKENS,
  refillWindowSeconds: LOGIN_RATE_LIMIT_REFILL_WINDOW_SECONDS,
  onRateLimitExceeded: loginRateLimitExceededHandler,
});

export const refreshRateLimitMiddleware = createRateLimitMiddleware({
  store: authRateLimitStore,
  keyStrategy: refreshTokenFamilyOrIpRateLimitKeyStrategy,
  capacity: REFRESH_RATE_LIMIT_CAPACITY,
  refillTokens: REFRESH_RATE_LIMIT_REFILL_TOKENS,
  refillWindowSeconds: REFRESH_RATE_LIMIT_REFILL_WINDOW_SECONDS,
  onRateLimitExceeded: refreshRateLimitExceededHandler,
});

export const logoutRateLimitMiddleware = createRateLimitMiddleware({
  store: authRateLimitStore,
  keyStrategy: logoutIpRateLimitKeyStrategy,
  capacity: LOGOUT_RATE_LIMIT_CAPACITY,
  refillTokens: LOGOUT_RATE_LIMIT_REFILL_TOKENS,
  refillWindowSeconds: LOGOUT_RATE_LIMIT_REFILL_WINDOW_SECONDS,
  onRateLimitExceeded: logoutRateLimitExceededHandler,
});
