import type { Express } from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const setTestEnv = (): void => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "3001";
  process.env.DATABASE_URL = "mysql://root:password@localhost:3306/cloudcms_test";
  process.env.CORS_ORIGIN = "http://localhost:5173";
  process.env.LOG_LEVEL = "silent";
  process.env.JSON_BODY_LIMIT = "1mb";
  process.env.URLENCODED_BODY_LIMIT = "1mb";
  process.env.RATE_LIMIT_DEFAULT_CAPACITY = "100";
  process.env.RATE_LIMIT_DEFAULT_REFILL_TOKENS = "10";
  process.env.RATE_LIMIT_DEFAULT_REFILL_WINDOW_SECONDS = "60";
  process.env.RATE_LIMIT_STORE = "memory";
  process.env.JWT_ACCESS_SECRET = "test-jwt-access-secret";
  process.env.JWT_ACCESS_TOKEN_TTL_SECONDS = "3600";
  process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret";
  process.env.DEVICE_TOKEN_HASH_SECRET = "test-device-token-hash-secret";
  process.env.REFRESH_TOKEN_TTL_DAYS = "14";
  process.env.VERIFICATION_CODE_TTL_SECONDS = "600";
  process.env.PENDING_REGISTRATION_TTL_SECONDS = "1200";
  process.env.AUTH_BCRYPT_COST = "4";
  process.env.AWS_REGION = "ap-southeast-1";
  process.env.S3_BUCKET_NAME = "cloudcms-test-bucket";
};

setTestEnv();

const checkDatabaseConnectionMock = vi.fn(async () => undefined);
const loggerInfoSpy = vi.fn(() => undefined);
const loggerWarnSpy = vi.fn(() => undefined);
const loggerErrorSpy = vi.fn(() => undefined);

let app: Express;

beforeAll(async () => {
  vi.resetModules();

  vi.doMock("../../src/shared/prisma/prisma.client", () => ({
    prisma: {},
    disconnectPrisma: vi.fn(async () => undefined),
    checkDatabaseConnection: checkDatabaseConnectionMock,
  }));

  vi.doMock("../../src/shared/logging/logger", () => ({
    logger: {
      info: loggerInfoSpy,
      warn: loggerWarnSpy,
      error: loggerErrorSpy,
    },
  }));

  ({ app } = await import("../../src/app"));
});

beforeEach(() => {
  vi.clearAllMocks();
  checkDatabaseConnectionMock.mockResolvedValue(undefined);
});

describe("Foundation health and fallback API behavior", () => {
  it("GET /health returns HTTP 200 and success response", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(checkDatabaseConnectionMock).not.toHaveBeenCalled();
  });

  it("GET /api/health/runtime returns safe runtime metadata", async () => {
    const response = await request(app).get("/api/health/runtime");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.data.environment).toBe("string");
    expect(typeof response.body.data.nodeVersion).toBe("string");
    expect(typeof response.body.data.uptimeSeconds).toBe("number");
    expect(typeof response.body.data.memory).toBe("object");
  });

  it("GET /api/health/db returns mysql health payload when prisma check succeeds", async () => {
    checkDatabaseConnectionMock.mockResolvedValueOnce(undefined);
    const response = await request(app).get("/api/health/db");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.database).toBe("mysql");
  });

  it("GET /api/health/db returns DATABASE_ERROR when prisma check fails", async () => {
    checkDatabaseConnectionMock.mockRejectedValueOnce(new Error("db down"));
    const response = await request(app).get("/api/health/db");

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("DATABASE_ERROR");
    expect(JSON.stringify(response.body)).not.toContain(
      "mysql://root:password@localhost:3306/cloudcms_test",
    );
  });

  it("unknown route returns NOT_FOUND with standard error response shape", async () => {
    const response = await request(app).get("/api/unknown-endpoint");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("sets request id header and logs method/path/status/latency/requestId", async () => {
    const response = await request(app).get("/health");
    const headerRequestId = response.headers["x-request-id"];
    expect(typeof headerRequestId).toBe("string");

    const [payload] = loggerInfoSpy.mock.calls.at(-1) ?? [];
    expect(payload.requestId).toBe(headerRequestId);
    expect(payload.method).toBe("GET");
    expect(payload.path).toContain("/health");
    expect(payload.statusCode).toBe(200);
    expect(typeof payload.durationMs).toBe("number");
  });
});
