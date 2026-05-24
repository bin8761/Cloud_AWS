import { afterEach, describe, expect, it, vi } from "vitest";

const BASE_ENV = {
  NODE_ENV: "test",
  PORT: "3001",
  DATABASE_URL: "mysql://root:password@localhost:3306/cloudcms_test",
  CORS_ORIGIN: "http://localhost:5173",
  LOG_LEVEL: "silent",
  JSON_BODY_LIMIT: "1mb",
  URLENCODED_BODY_LIMIT: "1mb",
  RATE_LIMIT_DEFAULT_CAPACITY: "100",
  RATE_LIMIT_DEFAULT_REFILL_TOKENS: "10",
  RATE_LIMIT_DEFAULT_REFILL_WINDOW_SECONDS: "60",
  RATE_LIMIT_STORE: "memory",
  JWT_ACCESS_SECRET: "test-jwt-access-secret",
  JWT_ACCESS_TOKEN_TTL_SECONDS: "3600",
  JWT_REFRESH_SECRET: "test-jwt-refresh-secret",
  DEVICE_TOKEN_HASH_SECRET: "test-device-token-hash-secret",
  REFRESH_TOKEN_TTL_DAYS: "14",
  VERIFICATION_CODE_TTL_SECONDS: "600",
  PENDING_REGISTRATION_TTL_SECONDS: "1200",
  AUTH_BCRYPT_COST: "4",
  AWS_REGION: "ap-southeast-1",
  S3_BUCKET_NAME: "cloudcms-test-bucket",
};

const ORIGINAL_ENV = { ...process.env };

const withBaseEnv = (overrides?: Record<string, string | undefined>): void => {
  process.env = { ...ORIGINAL_ENV, ...BASE_ENV, ...overrides };
};

describe("Foundation env config", () => {
  afterEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  it("fails startup validation when required env key is missing", async () => {
    withBaseEnv({ JWT_ACCESS_SECRET: undefined });

    await expect(import("../../src/config/env")).rejects.toThrow(
      "Environment validation failed at startup",
    );
  });

  it("fails startup validation when PORT is invalid", async () => {
    withBaseEnv({ PORT: "0" });

    await expect(import("../../src/config/env")).rejects.toThrow(
      "Environment validation failed at startup",
    );
  });

  it("parses positive rate-limit env values", async () => {
    withBaseEnv({
      RATE_LIMIT_DEFAULT_CAPACITY: "101",
      RATE_LIMIT_DEFAULT_REFILL_TOKENS: "7",
      RATE_LIMIT_DEFAULT_REFILL_WINDOW_SECONDS: "120",
    });

    const { env } = await import("../../src/config/env");

    expect(env.rateLimit.defaultCapacity).toBe(101);
    expect(env.rateLimit.defaultRefillTokens).toBe(7);
    expect(env.rateLimit.defaultRefillWindowSeconds).toBe(120);
  });
});

