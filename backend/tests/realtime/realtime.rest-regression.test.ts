import type { Express, NextFunction, Request, Response } from "express";
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

const listComputersMock = vi.fn();

let app: Express;
let healthService: {
  setRealtimeHealthProvider: (provider: (() => Record<string, number>) | undefined) => void;
};

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

  vi.doMock("../../src/modules/auth/auth.middleware", () => ({
    authRequired: (req: Request, _res: Response, next: NextFunction) => {
      req.authContext = {
        userId: "admin-1",
        tenantId: "tenant-1",
        role: "shop_admin",
        tokenType: "access",
      };
      next();
    },
  }));

  vi.doMock("../../src/modules/auth/auth.rbac", () => ({
    requireRole:
      () =>
      (_req: Request, _res: Response, next: NextFunction): void => {
        next();
      },
    requireTenantUser: (_req: Request, _res: Response, next: NextFunction): void => {
      next();
    },
  }));

  vi.doMock("../../src/modules/computers/computers.service", () => ({
    computersService: {
      registerComputer: vi.fn(),
      listComputers: listComputersMock,
      getComputerById: vi.fn(),
      updateComputerById: vi.fn(),
      reissueDeviceToken: vi.fn(),
    },
  }));

  ({ app } = await import("../../src/app"));
  ({ healthService } = await import("../../src/modules/health/health.service"));
});

beforeEach(() => {
  vi.clearAllMocks();
  checkDatabaseConnectionMock.mockResolvedValue(undefined);
  listComputersMock.mockResolvedValue({
    items: [
      {
        id: "computer-1",
        tenantId: "tenant-1",
        name: "POS 1",
        status: "ACTIVE",
        metadata: null,
        createdAt: "2026-05-25T00:00:00.000Z",
        updatedAt: "2026-05-25T00:00:00.000Z",
        lastSeenAt: "2026-05-25T01:02:03.000Z",
      },
    ],
    page: 1,
    pageSize: 20,
    totalItems: 1,
    totalPages: 1,
  });
  healthService.setRealtimeHealthProvider(undefined);
});

describe("Realtime REST regression tests (Task 255-260)", () => {
  it("Task 255: /api/health/runtime still returns existing runtime fields", async () => {
    const response = await request(app).get("/api/health/runtime");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(typeof response.body.data.environment).toBe("string");
    expect(typeof response.body.data.nodeVersion).toBe("string");
    expect(typeof response.body.data.uptimeSeconds).toBe("number");
    expect(typeof response.body.data.memory).toBe("object");
  });

  it("Task 256: /api/health/runtime includes realtime counters after provider registration", async () => {
    healthService.setRealtimeHealthProvider(() => ({
      activeSockets: 2,
      onlineComputers: 1,
      adminSockets: 1,
      heartbeatAccepted: 4,
      heartbeatRateLimited: 1,
      authFailures: 0,
      heartbeatTimeouts: 0,
    }));

    const response = await request(app).get("/api/health/runtime");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.realtime).toEqual({
      activeSockets: 2,
      onlineComputers: 1,
      adminSockets: 1,
      heartbeatAccepted: 4,
      heartbeatRateLimited: 1,
      authFailures: 0,
      heartbeatTimeouts: 0,
    });
  });

  it("Task 257: /api/health/runtime omits realtime when provider is not registered", async () => {
    healthService.setRealtimeHealthProvider(undefined);
    const response = await request(app).get("/api/health/runtime");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.realtime).toBeUndefined();
  });

  it("Task 258: /api/computers responses still include lastSeenAt", async () => {
    const response = await request(app).get("/api/computers");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items[0].lastSeenAt).toBe("2026-05-25T01:02:03.000Z");
  });

  it("Task 259: /api/computers responses never include deviceTokenHash", async () => {
    const response = await request(app).get("/api/computers");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items[0].deviceTokenHash).toBeUndefined();
  });

  it("Task 260: no /api/realtime/health route exists", async () => {
    const response = await request(app).get("/api/realtime/health");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});

