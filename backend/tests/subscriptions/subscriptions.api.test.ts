import type { Express } from "express";
import { SignJWT } from "jose";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type AuthRole = "super_admin" | "shop_admin" | "staff";

const setTestEnv = (): void => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "3001";
  process.env.DATABASE_URL = "mysql://root:password@localhost:3306/cloudcms_test";
  process.env.JWT_ACCESS_SECRET = "test-jwt-access-secret";
  process.env.LOG_LEVEL = "silent";
};

const buildAccessToken = async (input: {
  role?: AuthRole;
  tenantId?: string | null;
}): Promise<string> => {
  return new SignJWT({
    sub: "user_auth_test_1",
    tenantId: input.tenantId === undefined ? "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" : input.tenantId,
    role: input.role ?? "shop_admin",
    tokenType: "access",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET || "test-jwt-access-secret"));
};

setTestEnv();

const prismaMock = {
  subscription: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
  },
};

const loggerInfoSpy = vi.fn(() => undefined);
const loggerWarnSpy = vi.fn(() => undefined);
const loggerErrorSpy = vi.fn(() => undefined);

let app: Express;
const tenantId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const targetTenantId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const subId = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

beforeAll(async () => {
  vi.resetModules();

  vi.doMock("../../src/shared/prisma/prisma.client", () => ({
    prisma: prismaMock,
    disconnectPrisma: vi.fn(async () => undefined),
  }));

  vi.doMock("../../src/shared/logging/logger", () => ({
    logger: {
      info: loggerInfoSpy,
      warn: loggerWarnSpy,
      error: loggerErrorSpy,
    },
  }));

  ({ app } = await import("../../src/app.js"));
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Subscriptions API tests (Person 5)", () => {
  it("GET /api/subscriptions/me without token returns 401", async () => {
    const response = await request(app).get("/api/subscriptions/me");
    expect(response.status).toBe(401);
  });

  it("shop_admin can view their subscription status", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    const mockSub = {
      id: subId,
      tenantId,
      status: "ACTIVE",
      maxComputers: 25,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaMock.subscription.findUnique as any).mockResolvedValueOnce(mockSub);

    const response = await request(app)
      .get("/api/subscriptions/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(subId);
    expect(response.body.data.maxComputers).toBe(25);
  });

  it("staff can view their subscription status", async () => {
    const token = await buildAccessToken({ role: "staff", tenantId });
    const mockSub = {
      id: subId,
      tenantId,
      status: "ACTIVE",
      maxComputers: 20,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaMock.subscription.findUnique as any).mockResolvedValueOnce(mockSub);

    const response = await request(app)
      .get("/api/subscriptions/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
  });

  it("super_admin can create subscription for tenant", async () => {
    const token = await buildAccessToken({ role: "super_admin", tenantId: null });
    const expiresAt = new Date("2030-01-01T00:00:00.000Z").toISOString();

    (prismaMock.tenant.findUnique as any).mockResolvedValueOnce({ id: targetTenantId });
    (prismaMock.subscription.findUnique as any).mockResolvedValueOnce(null);
    (prismaMock.subscription.create as any).mockResolvedValueOnce({
      id: subId,
      tenantId: targetTenantId,
      status: "ACTIVE",
      maxComputers: 15,
      expiresAt: new Date(expiresAt),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tenantId: targetTenantId,
        status: "ACTIVE",
        maxComputers: 15,
        expiresAt,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(subId);
    expect(prismaMock.subscription.create).toHaveBeenCalledTimes(1);
  });

  it("shop_admin cannot create subscription", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    const response = await request(app)
      .post("/api/subscriptions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tenantId,
        status: "ACTIVE",
        maxComputers: 10,
        expiresAt: new Date().toISOString(),
      });

    expect(response.status).toBe(403);
  });

  it("super_admin can update subscription", async () => {
    const token = await buildAccessToken({ role: "super_admin", tenantId: null });
    const mockSub = {
      id: subId,
      tenantId,
      status: "ACTIVE",
      maxComputers: 20,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaMock.subscription.findUnique as any).mockResolvedValueOnce(mockSub);
    (prismaMock.subscription.update as any).mockResolvedValueOnce({
      ...mockSub,
      status: "EXPIRED",
    });

    const response = await request(app)
      .patch(`/api/subscriptions/${subId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "EXPIRED",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("EXPIRED");
  });
});
