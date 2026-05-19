import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env";
import { AppError } from "../errors/app-error";
import type { RateLimitStore } from "./rate-limit.store";
import type { TokenBucketConfig } from "./token-bucket";

type CreateRateLimitMiddlewareOptions = {
  store: RateLimitStore;
  config?: TokenBucketConfig;
  keyStrategy?: (request: Request) => string;
  capacity?: number;
  refillTokens?: number;
  refillWindowSeconds?: number;
  includeHealthEndpoints?: boolean;
};

const buildDefaultRateLimitKey = (request: Request): string => {
  return `${request.method}:${request.path}:${request.ip}`;
};

const isHealthEndpoint = (request: Request): boolean => {
  return request.path === "/health" || request.path.startsWith("/api/health");
};

const resolveBucketState = (
  store: RateLimitStore,
  key: string,
  config: TokenBucketConfig,
  nowMs: number,
): { tokens: number; lastRefillAtMs: number } => {
  const state =
    store.get(key) ?? {
      tokens: config.capacity,
      lastRefillAtMs: nowMs,
    };

  const refillWindowMs = config.refillWindowSeconds * 1000;
  const elapsedMs = nowMs - state.lastRefillAtMs;
  const elapsedWindows = Math.floor(elapsedMs / refillWindowMs);

  if (elapsedWindows <= 0) {
    return state;
  }

  return {
    tokens: Math.min(state.tokens + elapsedWindows * config.refillTokens, config.capacity),
    lastRefillAtMs: state.lastRefillAtMs + elapsedWindows * refillWindowMs,
  };
};

export const createRateLimitMiddleware = (
  options: CreateRateLimitMiddlewareOptions,
) => {
  const baseConfig: TokenBucketConfig = options.config ?? {
    capacity: env.rateLimit.defaultCapacity,
    refillTokens: env.rateLimit.defaultRefillTokens,
    refillWindowSeconds: env.rateLimit.defaultRefillWindowSeconds,
  };

  const effectiveConfig: TokenBucketConfig = {
    capacity: options.capacity ?? baseConfig.capacity,
    refillTokens: options.refillTokens ?? baseConfig.refillTokens,
    refillWindowSeconds: options.refillWindowSeconds ?? baseConfig.refillWindowSeconds,
  };

  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!options.includeHealthEndpoints && isHealthEndpoint(request)) {
      next();
      return;
    }

    const nowMs = Date.now();
    const key = options.keyStrategy?.(request) ?? buildDefaultRateLimitKey(request);
    const bucketState = resolveBucketState(options.store, key, effectiveConfig, nowMs);

    if (bucketState.tokens <= 0) {
      options.store.set(key, bucketState);
      next(
        new AppError(429, "RATE_LIMITED", "Too many requests. Please try again later.", {
          key,
        }),
      );
      return;
    }

    options.store.set(key, {
      ...bucketState,
      tokens: bucketState.tokens - 1,
    });

    next();
  };
};
