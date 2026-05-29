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
    sub: "user_usage_test_1",
    tenantId: input.tenantId === undefined ? "tenant_usage_test_1" : input.tenantId,
    role: input.role ?? "shop_admin",
    tokenType: "access",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET ?? "test-jwt-access-secret"));

setTestEnv();

const tenantId = "tenant_usage_test_1";
const computerId = "computer_usage_test_1";

const prismaMock = {
  dailyUsageSummary: {
    findMany: vi.fn(async () => [] as any[]),
  },
  session: {
    findMany: vi.fn(async () => [] as any[]),
    count: vi.fn(async () => 0),
  },
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
  prismaMock.dailyUsageSummary.findMany.mockReset();
  prismaMock.dailyUsageSummary.findMany.mockResolvedValue([]);
  prismaMock.session.findMany.mockReset();
  prismaMock.session.findMany.mockResolvedValue([]);
  prismaMock.session.count.mockReset();
  prismaMock.session.count.mockResolvedValue(0);
});

const mockSummary = {
  id: "summary_1",
  tenantId,
  computerId,
  date: new Date("2026-05-01"),
  totalMinutes: 120,
  totalAmount: 20000,
  sessionCount: 2,
  updatedAt: new Date(),
};

const mockSession = {
  id: "session_1",
  tenantId,
  computerId,
  startedAt: new Date("2026-05-01T08:00:00.000Z"),
  endedAt: new Date("2026-05-01T10:00:00.000Z"),
  status: "ENDED",
  durationMinutes: 120,
  totalAmount: 20000,
  computer: { id: computerId, name: "PC-01", macAddress: "AA:BB:CC:DD:EE:01" },
};

describe("Usage API - Authentication", () => {
  it("GET /api/usage/dashboard without token returns 401", async () => {
    const response = await request(app).get("/api/usage/dashboard");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("GET /api/usage/sessions without token returns 401", async () => {
    const response = await request(app).get("/api/usage/sessions");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("Usage API - Authorization", () => {
  it("staff cannot access dashboard", async () => {
    const token = await buildAccessToken({ role: "staff", tenantId });
    const response = await request(app)
      .get("/api/usage/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("shop_admin without tenantId receives 403", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId: null });
    const response = await request(app)
      .get("/api/usage/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });
});

describe("Usage API - Dashboard", () => {
  it("shop_admin can get dashboard data", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.dailyUsageSummary.findMany.mockResolvedValueOnce([mockSummary]);

    const response = await request(app)
      .get("/api/usage/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("dailyData");
    expect(response.body.data).toHaveProperty("totalRevenue");
    expect(response.body.data).toHaveProperty("totalSessions");
    expect(response.body.data).toHaveProperty("totalMinutes");
    expect(response.body.data).toHaveProperty("days");
  });

  it("dashboard defaults to 7 days", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.dailyUsageSummary.findMany.mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/usage/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.days).toBe(7);
  });

  it("dashboard supports ?days=14", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.dailyUsageSummary.findMany.mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/usage/dashboard?days=14")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.days).toBe(14);
  });

  it("dashboard supports ?days=30", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.dailyUsageSummary.findMany.mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/usage/dashboard?days=30")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.days).toBe(30);
  });

  it("dashboard is scoped to caller tenant", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.dailyUsageSummary.findMany.mockResolvedValueOnce([]);

    await request(app)
      .get("/api/usage/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(prismaMock.dailyUsageSummary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
  });

  it("dashboard returns empty dailyData when no records", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.dailyUsageSummary.findMany.mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/usage/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.dailyData).toHaveLength(0);
    expect(response.body.data.totalRevenue).toBe(0);
    expect(response.body.data.totalSessions).toBe(0);
  });

  it("dashboard aggregates multiple summaries by date correctly", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    const summaries = [
      { ...mockSummary, id: "s1", computerId: "pc1", totalAmount: 10000, sessionCount: 1, totalMinutes: 60 },
      { ...mockSummary, id: "s2", computerId: "pc2", totalAmount: 15000, sessionCount: 2, totalMinutes: 90 },
    ];
    prismaMock.dailyUsageSummary.findMany.mockResolvedValueOnce(summaries);

    const response = await request(app)
      .get("/api/usage/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.totalRevenue).toBeCloseTo(25000, 0);
    expect(response.body.data.totalSessions).toBe(3);
    expect(response.body.data.totalMinutes).toBe(150);
  });
});

describe("Usage API - Session History", () => {
  it("shop_admin can list session history", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.session.findMany.mockResolvedValueOnce([mockSession]);
    prismaMock.session.count.mockResolvedValueOnce(1);

    const response = await request(app)
      .get("/api/usage/sessions")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("sessions");
    expect(response.body.data).toHaveProperty("total");
    expect(response.body.data).toHaveProperty("page");
    expect(response.body.data).toHaveProperty("pageSize");
    expect(response.body.data).toHaveProperty("totalPages");
  });

  it("session history defaults to page=1 and pageSize=20", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.session.findMany.mockResolvedValueOnce([]);
    prismaMock.session.count.mockResolvedValueOnce(0);

    const response = await request(app)
      .get("/api/usage/sessions")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.page).toBe(1);
    expect(response.body.data.pageSize).toBe(20);
  });

  it("session history supports pagination", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.session.findMany.mockResolvedValueOnce([]);
    prismaMock.session.count.mockResolvedValueOnce(0);

    const response = await request(app)
      .get("/api/usage/sessions?page=2&pageSize=10")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.page).toBe(2);
    expect(response.body.data.pageSize).toBe(10);
  });

  it("session history is scoped to caller tenant", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.session.findMany.mockResolvedValueOnce([]);
    prismaMock.session.count.mockResolvedValueOnce(0);

    await request(app)
      .get("/api/usage/sessions")
      .set("Authorization", `Bearer ${token}`);

    expect(prismaMock.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
  });

  it("session history is sorted by startedAt desc", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.session.findMany.mockResolvedValueOnce([]);
    prismaMock.session.count.mockResolvedValueOnce(0);

    await request(app)
      .get("/api/usage/sessions")
      .set("Authorization", `Bearer ${token}`);

    expect(prismaMock.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { startedAt: "desc" },
      }),
    );
  });
});