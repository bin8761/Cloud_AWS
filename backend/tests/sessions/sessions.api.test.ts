import type { Express } from "express";
import { SignJWT } from "jose";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type AuthRole = "super_admin" | "shop_admin" | "staff";

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

const buildAccessToken = async (input: {
  role?: AuthRole;
  tenantId?: string | null;
}): Promise<string> =>
  new SignJWT({
    sub: "user_sessions_test_1",
    tenantId: input.tenantId === undefined ? "tenant_sessions_test_1" : input.tenantId,
    role: input.role ?? "shop_admin",
    tokenType: "access",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET ?? "test-jwt-access-secret"));

setTestEnv();

const tenantId = "tenant_sessions_test_1";
const computerId = "computer_sessions_test_1";
const sessionId = "session_test_1";

const prismaMock = {
  session: {
    findFirst: vi.fn(async () => null as any),
    findMany: vi.fn(async () => [] as any[]),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(async () => 0),
  },
  computer: {
    findFirst: vi.fn(async () => null as any),
  },
  usageLog: {
    create: vi.fn(),
  },
  dailyUsageSummary: {
    upsert: vi.fn(),
  },
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(prismaMock),
  ),
};

const loggerSpy = vi.fn(() => undefined);

let app: Express;

beforeAll(async () => {
  vi.resetModules();

  vi.doMock("../../src/shared/prisma/prisma.client", () => ({
    prisma: prismaMock,
    disconnectPrisma: vi.fn(async () => undefined),
    checkDatabaseConnection: vi.fn(async () => undefined),
  }));

  vi.doMock("../../src/shared/logging/logger", () => ({
    logger: {
      info: loggerSpy,
      warn: loggerSpy,
      error: loggerSpy,
    },
  }));

  ({ app } = await import("../../src/app"));
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.session.findFirst.mockReset();
  prismaMock.session.findFirst.mockResolvedValue(null);
  prismaMock.session.findMany.mockReset();
  prismaMock.session.findMany.mockResolvedValue([]);
  prismaMock.session.create.mockReset();
  prismaMock.session.update.mockReset();
  prismaMock.computer.findFirst.mockReset();
  prismaMock.computer.findFirst.mockResolvedValue(null);
  prismaMock.$transaction.mockReset();
  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: unknown) => Promise<unknown>) => callback(prismaMock),
  );
});

const mockComputer = {
  id: computerId,
  tenantId,
  name: "PC-01",
  macAddress: "AA:BB:CC:DD:EE:01",
  status: "ACTIVE",
};

const mockSession = {
  id: sessionId,
  tenantId,
  computerId,
  startedAt: new Date(),
  endedAt: null,
  status: "ACTIVE",
  durationMinutes: null,
  totalAmount: null,
};

describe("Sessions API - Authentication", () => {
  it("POST /api/sessions/start without token returns 401", async () => {
    const response = await request(app).post("/api/sessions/start");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/sessions/end without token returns 401", async () => {
    const response = await request(app).post("/api/sessions/end");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("GET /api/sessions/active without token returns 401", async () => {
    const response = await request(app).get("/api/sessions/active");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("Sessions API - Authorization", () => {
  it("staff cannot start a session", async () => {
    const token = await buildAccessToken({ role: "staff", tenantId });
    const response = await request(app)
      .post("/api/sessions/start")
      .set("Authorization", `Bearer ${token}`)
      .send({ computerId, pricePerHour: 10000 });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("shop_admin without tenantId receives 403", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId: null });
    const response = await request(app)
      .post("/api/sessions/start")
      .set("Authorization", `Bearer ${token}`)
      .send({ computerId, pricePerHour: 10000 });

    expect(response.status).toBe(403);
  });
});

describe("Sessions API - Start Session", () => {
  it("shop_admin can start a session successfully", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.session.findFirst.mockResolvedValueOnce(null);
    prismaMock.computer.findFirst.mockResolvedValueOnce(mockComputer);
    prismaMock.session.create.mockResolvedValueOnce(mockSession);

    const response = await request(app)
      .post("/api/sessions/start")
      .set("Authorization", `Bearer ${token}`)
      .send({ computerId, pricePerHour: 10000 });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ACTIVE");
  });

  it("returns 409 if computer already has an active session", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.session.findFirst.mockResolvedValueOnce(mockSession);

    const response = await request(app)
      .post("/api/sessions/start")
      .set("Authorization", `Bearer ${token}`)
      .send({ computerId, pricePerHour: 10000 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("returns 404 if computer does not belong to tenant", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.session.findFirst.mockResolvedValueOnce(null);
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);

    const response = await request(app)
      .post("/api/sessions/start")
      .set("Authorization", `Bearer ${token}`)
      .send({ computerId, pricePerHour: 10000 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for missing computerId", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    const response = await request(app)
      .post("/api/sessions/start")
      .set("Authorization", `Bearer ${token}`)
      .send({ pricePerHour: 10000 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid pricePerHour", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    const response = await request(app)
      .post("/api/sessions/start")
      .set("Authorization", `Bearer ${token}`)
      .send({ computerId, pricePerHour: -1 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Sessions API - End Session", () => {
  it("shop_admin can end an active session", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    const startedAt = new Date(Date.now() - 60 * 60 * 1000);
    const endedSession = {
      ...mockSession,
      status: "ENDED",
      endedAt: new Date(),
      durationMinutes: 60,
      totalAmount: 10000,
    };

    prismaMock.session.findFirst.mockResolvedValueOnce({
      ...mockSession,
      startedAt,
    });
    prismaMock.$transaction.mockImplementationOnce(async () => [endedSession]);

    const response = await request(app)
      .post("/api/sessions/end")
      .set("Authorization", `Bearer ${token}`)
      .send({ sessionId, pricePerHour: 10000 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("returns 404 if session not found or not active", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.session.findFirst.mockResolvedValueOnce(null);

    const response = await request(app)
      .post("/api/sessions/end")
      .set("Authorization", `Bearer ${token}`)
      .send({ sessionId: "nonexistent", pricePerHour: 10000 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for missing sessionId", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    const response = await request(app)
      .post("/api/sessions/end")
      .set("Authorization", `Bearer ${token}`)
      .send({ pricePerHour: 10000 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Sessions API - Active Sessions", () => {
  it("shop_admin can list active sessions", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.session.findMany.mockResolvedValueOnce([
      {
        ...mockSession,
        computer: { id: computerId, name: "PC-01", macAddress: "AA:BB:CC:DD:EE:01" },
      },
    ]);

    const response = await request(app)
      .get("/api/sessions/active")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("active sessions are scoped to caller tenant", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.session.findMany.mockResolvedValueOnce([]);

    await request(app)
      .get("/api/sessions/active")
      .set("Authorization", `Bearer ${token}`);

    expect(prismaMock.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId,
          status: "ACTIVE",
        }),
      }),
    );
  });
});