import type { Request } from "express";

import { env } from "../../config/env";
import { createRateLimitMiddleware } from "../../shared/rate-limit/rate-limit.middleware";
import { createRateLimitStore } from "../../shared/rate-limit/rate-limit-store.factory";
import {
  BLOCK_RULES_LOG_EVENTS,
  blockRulesLoggingService,
} from "./block-rules.logging";

const blockRulesRateLimitStore = createRateLimitStore({
  type: env.rateLimit.store,
});

const UNKNOWN_IP_KEY_PART = "unknown-ip";
const BLOCK_RULES_BATCH_KEY_PREFIX = "block-rules:batch";
const BLOCK_RULES_ACTIVE_KEY_PREFIX = "block-rules:active";

const normalizeIpForKey = (ip: string | undefined): string => {
  const normalizedIp = ip?.trim();
  return normalizedIp && normalizedIp.length > 0 ? normalizedIp : UNKNOWN_IP_KEY_PART;
};

const getRequestUserAgent = (request: Request): string | undefined => {
  const userAgentHeader = request.headers["user-agent"];
  return typeof userAgentHeader === "string" ? userAgentHeader : userAgentHeader?.[0];
};

export const blockRulesBatchCreateRateLimitMiddleware = createRateLimitMiddleware({
  store: blockRulesRateLimitStore,
  keyStrategy: (request) =>
    `${BLOCK_RULES_BATCH_KEY_PREFIX}:${request.authContext?.tenantId ?? "no-tenant"}:${request.authContext?.userId ?? normalizeIpForKey(request.ip)}`,
  capacity: 10,
  refillTokens: 1,
  refillWindowSeconds: 60,
  onRateLimitExceeded: ({ request, key }) => {
    blockRulesLoggingService.logRateLimitEvent({
      requestId: request.requestId,
      event: BLOCK_RULES_LOG_EVENTS.RATE_LIMIT_HIT,
      status: "TOO_MANY_REQUESTS",
      reason: "batch_create_rate_limit_hit",
      key,
      tenantId: request.authContext?.tenantId,
      actorUserId: request.authContext?.userId,
      actorRole: request.authContext?.role,
      ip: request.ip,
      userAgent: getRequestUserAgent(request),
    });
  },
});

export const blockRulesActiveFetchRateLimitMiddleware = createRateLimitMiddleware({
  store: blockRulesRateLimitStore,
  keyStrategy: (request) =>
    `${BLOCK_RULES_ACTIVE_KEY_PREFIX}:${request.authContext?.computerId ?? normalizeIpForKey(request.ip)}`,
  capacity: 30,
  refillTokens: 10,
  refillWindowSeconds: 60,
  onRateLimitExceeded: ({ request, key }) => {
    blockRulesLoggingService.logRateLimitEvent({
      requestId: request.requestId,
      event: BLOCK_RULES_LOG_EVENTS.RATE_LIMIT_HIT,
      status: "TOO_MANY_REQUESTS",
      reason: "active_fetch_rate_limit_hit",
      key,
      tenantId: request.authContext?.tenantId,
      computerId: request.authContext?.computerId,
      ip: request.ip,
      userAgent: getRequestUserAgent(request),
    });
  },
});
