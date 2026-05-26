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
  lockScreenAsset: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
};

const loggerInfoSpy = vi.fn(() => undefined);
const loggerWarnSpy = vi.fn(() => undefined);
const loggerErrorSpy = vi.fn(() => undefined);

let app: Express;
const tenantId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const assetId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

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

  // Mock fs/promises inside the service
  vi.doMock("fs/promises", () => ({
    default: {
      unlink: vi.fn(async () => undefined),
    },
  }));

  ({ app } = await import("../../src/app.js"));
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Assets API tests (Person 5)", () => {
  it("GET /api/assets without token returns 401", async () => {
    const response = await request(app).get("/api/assets");
    expect(response.status).toBe(401);
  });

  it("POST /api/assets/upload without token returns 401", async () => {
    const response = await request(app).post("/api/assets/upload");
    expect(response.status).toBe(401);
  });

  it("shop_admin can list assets of their tenant", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    const mockAsset = {
      id: assetId,
      tenantId,
      fileName: "wallpaper.png",
      filePath: "uploads/lockscreen/tenant_1_123.png",
      fileSize: 1024,
      mimeType: "image/png",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaMock.lockScreenAsset.findMany as any).mockResolvedValueOnce([mockAsset]);

    const response = await request(app)
      .get("/api/assets")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].id).toBe(assetId);
  });

  it("staff can list assets of their tenant", async () => {
    const token = await buildAccessToken({ role: "staff", tenantId });
    (prismaMock.lockScreenAsset.findMany as any).mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/assets")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("super_admin cannot view tenant assets in shop context", async () => {
    const token = await buildAccessToken({ role: "super_admin", tenantId });
    const response = await request(app)
      .get("/api/assets")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it("shop_admin can toggle active status of asset", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    const mockAsset = {
      id: assetId,
      tenantId,
      fileName: "wallpaper.png",
      filePath: "uploads/lockscreen/tenant_1_123.png",
      fileSize: 1024,
      mimeType: "image/png",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaMock.lockScreenAsset.findFirst as any).mockResolvedValueOnce(mockAsset);
    (prismaMock.lockScreenAsset.update as any).mockResolvedValueOnce({
      ...mockAsset,
      isActive: false,
    });

    const response = await request(app)
      .patch(`/api/assets/${assetId}/active`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.isActive).toBe(false);
  });

  it("shop_admin can delete asset", async () => {
    const token = await buildAccessToken({ role: "shop_admin", tenantId });
    const mockAsset = {
      id: assetId,
      tenantId,
      fileName: "wallpaper.png",
      filePath: "uploads/lockscreen/tenant_1_123.png",
      fileSize: 1024,
      mimeType: "image/png",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaMock.lockScreenAsset.findFirst as any).mockResolvedValueOnce(mockAsset);
    (prismaMock.lockScreenAsset.delete as any).mockResolvedValueOnce(mockAsset);

    const response = await request(app)
      .delete(`/api/assets/${assetId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
