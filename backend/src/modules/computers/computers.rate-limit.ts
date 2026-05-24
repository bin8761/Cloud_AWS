import type { Request } from "express";

import { env } from "../../config/env";
import { createRateLimitMiddleware } from "../../shared/rate-limit/rate-limit.middleware";
import { createRateLimitStore } from "../../shared/rate-limit/rate-limit-store.factory";
import { COMPUTERS_LOG_EVENTS, computersLoggingService } from "./computers.logging";
import { normalizeTenantCode } from "./computers.schema";

const COMPUTERS_REGISTER_IP_TENANT_KEY_PREFIX = "computers:register-ip-tenant";
const UNKNOWN_IP_KEY_PART = "unknown-ip";
const MISSING_TENANT_CODE_KEY_PART = "missing-tenant-code";
const REGISTER_RATE_LIMIT_CAPACITY = 5;
const REGISTER_RATE_LIMIT_REFILL_TOKENS = 1;
const REGISTER_RATE_LIMIT_REFILL_WINDOW_SECONDS = 10 * 60;
const REGISTER_RATE_LIMIT_REASON = "register_rate_limit_hit";
const TOO_MANY_REQUESTS_STATUS = "TOO_MANY_REQUESTS";

const computersRateLimitStore = createRateLimitStore({
  type: env.rateLimit.store,
});

const normalizeIpForKey = (ip: string | undefined): string => {
  if (!ip) {
    return UNKNOWN_IP_KEY_PART;
  }

  const normalizedIp = ip.trim();
  return normalizedIp.length > 0 ? normalizedIp : UNKNOWN_IP_KEY_PART;
};

const readTenantCodeFromBody = (request: Request): string | undefined => {
  const body = request.body as Record<string, unknown> | undefined;
  const tenantCodeValue = body?.tenantCode;

  if (typeof tenantCodeValue !== "string") {
    return undefined;
  }

  const trimmedTenantCode = tenantCodeValue.trim();
  if (!trimmedTenantCode) {
    return undefined;
  }

  return normalizeTenantCode(trimmedTenantCode);
};

const getRequestUserAgent = (request: Request): string | undefined => {
  const userAgentHeader = request.headers["user-agent"];

  if (typeof userAgentHeader === "string") {
    return userAgentHeader;
  }

  return userAgentHeader?.[0];
};

export const buildComputersRegisterIpTenantCodeRateLimitKey = (
  ip: string | undefined,
  tenantCode: string | undefined,
): string => {
  const normalizedIp = normalizeIpForKey(ip);
  const normalizedTenantCode = tenantCode ? normalizeTenantCode(tenantCode) : undefined;

  return `${COMPUTERS_REGISTER_IP_TENANT_KEY_PREFIX}:${normalizedIp}:${normalizedTenantCode ?? MISSING_TENANT_CODE_KEY_PART}`;
};

export const computersRegisterIpTenantCodeRateLimitKeyStrategy = (
  request: Request,
): string => {
  const tenantCode = readTenantCodeFromBody(request);
  return buildComputersRegisterIpTenantCodeRateLimitKey(request.ip, tenantCode);
};

const registerComputerRateLimitExceededHandler = (request: Request, key: string): void => {
  computersLoggingService.logRateLimitEvent({
    requestId: request.requestId,
    event: COMPUTERS_LOG_EVENTS.RATE_LIMIT_HIT,
    status: TOO_MANY_REQUESTS_STATUS,
    reason: REGISTER_RATE_LIMIT_REASON,
    key,
    ip: request.ip,
    userAgent: getRequestUserAgent(request),
    tenantCode: readTenantCodeFromBody(request),
  });
};

export const registerComputerRateLimitMiddleware = createRateLimitMiddleware({
  store: computersRateLimitStore,
  keyStrategy: computersRegisterIpTenantCodeRateLimitKeyStrategy,
  capacity: REGISTER_RATE_LIMIT_CAPACITY,
  refillTokens: REGISTER_RATE_LIMIT_REFILL_TOKENS,
  refillWindowSeconds: REGISTER_RATE_LIMIT_REFILL_WINDOW_SECONDS,
  onRateLimitExceeded: ({ request, key }) => {
    registerComputerRateLimitExceededHandler(request, key);
  },
});
