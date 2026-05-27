import type { Express } from "express";
import { createHmac } from "node:crypto";
import { SignJWT } from "jose";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  role?: "shop_admin" | "staff" | "super_admin";
  tenantId?: string | null;
}): Promise<string> =>
  new SignJWT({
    sub: "admin_1",
    tenantId: input.tenantId === undefined ? "tenant_1" : input.tenantId,
    role: input.role ?? "shop_admin",
    tokenType: "access",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET));

const hashDeviceToken = (token: string): string =>
  createHmac("sha256", process.env.DEVICE_TOKEN_HASH_SECRET ?? "")
    .update(token)
    .digest("hex");

setTestEnv();

const prismaMock = {
  blockRule: {
    count: vi.fn(async () => 0),
    create: vi.fn(),
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async () => null),
    update: vi.fn(),
    delete: vi.fn(),
  },
  computer: {
    findUnique: vi.fn(async () => null),
  },
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(prismaMock),
  ),
};

const loggerSpy = vi.fn(() => undefined);

const blockRuleRecord = {
  id: "rule_1",
  tenantId: "tenant_1",
  type: "URL" as const,
  value: "*.facebook.com",
  label: "Facebook",
  reason: null,
  status: "ACTIVE" as const,
  priority: 0,
  createdBy: "admin_1",
  createdAt: new Date("2026-05-27T00:00:00.000Z"),
  updatedAt: new Date("2026-05-27T00:00:00.000Z"),
};

let app: Express;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  prismaMock.blockRule.count.mockReset();
  prismaMock.blockRule.count.mockResolvedValue(0);
  prismaMock.blockRule.create.mockReset();
  prismaMock.blockRule.findMany.mockReset();
  prismaMock.blockRule.findMany.mockResolvedValue([]);
  prismaMock.blockRule.findFirst.mockReset();
  prismaMock.blockRule.findFirst.mockResolvedValue(null);
  prismaMock.blockRule.update.mockReset();
  prismaMock.blockRule.delete.mockReset();
  prismaMock.computer.findUnique.mockReset();
  prismaMock.computer.findUnique.mockResolvedValue(null);
  prismaMock.$transaction.mockReset();
  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: unknown) => Promise<unknown>) => callback(prismaMock),
  );

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

describe.sequential("Block rules API tests", () => {
  it("requires admin JWT for block-rules admin endpoints", async () => {
    const response = await request(app).get("/api/block-rules");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("allows shop_admin to create a block rule in own tenant", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin" });
    prismaMock.blockRule.create.mockResolvedValueOnce(blockRuleRecord);

    const response = await request(app)
      .post("/api/block-rules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        type: "URL",
        value: "*.facebook.com",
        label: "Facebook",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe("rule_1");
    expect(prismaMock.blockRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant_1",
          createdBy: "admin_1",
        }),
      }),
    );
  });

  it("lists block rules with tenant-scoped filters", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin" });
    prismaMock.blockRule.count.mockResolvedValueOnce(1);
    prismaMock.blockRule.findMany.mockResolvedValueOnce([blockRuleRecord]);

    const response = await request(app)
      .get("/api/block-rules")
      .query({
        type: "URL",
        status: "ACTIVE",
        q: "facebook",
        sort: "priority:desc",
      })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(prismaMock.blockRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { tenantId: "tenant_1" },
            { type: "URL" },
            { status: "ACTIVE" },
            {
              OR: [
                { value: { contains: "facebook" } },
                { label: { contains: "facebook" } },
              ],
            },
          ],
        },
        orderBy: { priority: "desc" },
      }),
    );
  });

  it("gets one block rule by id inside tenant scope", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin" });
    prismaMock.blockRule.findFirst.mockResolvedValueOnce(blockRuleRecord);

    const response = await request(app)
      .get("/api/block-rules/rule_1")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe("rule_1");
    expect(prismaMock.blockRule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "rule_1",
          tenantId: "tenant_1",
        },
      }),
    );
  });

  it("returns 404 for cross-tenant or missing block rule detail", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin" });
    prismaMock.blockRule.findFirst.mockResolvedValueOnce(null);

    const response = await request(app)
      .get("/api/block-rules/rule_other")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("updates only allowed block rule fields", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin" });
    prismaMock.blockRule.findFirst.mockResolvedValueOnce(blockRuleRecord);
    prismaMock.blockRule.update.mockResolvedValueOnce({
      ...blockRuleRecord,
      status: "DISABLED",
      priority: 20,
    });

    const response = await request(app)
      .patch("/api/block-rules/rule_1")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "DISABLED",
        priority: 20,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("DISABLED");
    expect(prismaMock.blockRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rule_1" },
        data: {
          status: "DISABLED",
          priority: 20,
        },
      }),
    );
  });

  it("rejects unknown update fields", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin" });

    const response = await request(app)
      .patch("/api/block-rules/rule_1")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        tenantId: "tenant_hacker",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(prismaMock.blockRule.update).not.toHaveBeenCalled();
  });

  it("deletes block rule inside tenant scope", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin" });
    prismaMock.blockRule.findFirst.mockResolvedValueOnce(blockRuleRecord);
    prismaMock.blockRule.delete.mockResolvedValueOnce(blockRuleRecord);

    const response = await request(app)
      .delete("/api/block-rules/rule_1")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe("rule_1");
    expect(prismaMock.blockRule.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rule_1" },
      }),
    );
  });

  it("batch creates up to 50 rules in one transaction", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin" });
    const secondRule = {
      ...blockRuleRecord,
      id: "rule_2",
      type: "PROCESS" as const,
      value: "steam.exe",
      label: "Steam",
    };
    prismaMock.blockRule.create
      .mockResolvedValueOnce(blockRuleRecord)
      .mockResolvedValueOnce(secondRule);

    const response = await request(app)
      .post("/api/block-rules/batch")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        rules: [
          { type: "URL", value: "*.facebook.com", label: "Facebook" },
          { type: "PROCESS", value: "steam.exe", label: "Steam" },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.items).toHaveLength(2);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.blockRule.create).toHaveBeenCalledTimes(2);
  });

  it("rejects duplicate values inside batch payload", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin" });

    const response = await request(app)
      .post("/api/block-rules/batch")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        rules: [
          { type: "URL", value: "*.facebook.com" },
          { type: "URL", value: "*.facebook.com" },
        ],
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
    expect(prismaMock.blockRule.create).not.toHaveBeenCalled();
  });

  it("rejects staff role on admin endpoints", async () => {
    const accessToken = await buildAccessToken({ role: "staff" });

    const response = await request(app)
      .post("/api/block-rules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ type: "URL", value: "*.facebook.com" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("returns active rules to authenticated computer clients only", async () => {
    const deviceToken = "device-token";
    prismaMock.computer.findUnique.mockResolvedValueOnce({
      id: "computer_1",
      tenantId: "tenant_1",
      status: "ACTIVE",
      deviceTokenHash: hashDeviceToken(deviceToken),
    });
    prismaMock.blockRule.findMany.mockResolvedValueOnce([blockRuleRecord]);

    const response = await request(app)
      .get("/api/block-rules/active")
      .set("x-computer-id", "computer_1")
      .set("Authorization", `Bearer ${deviceToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(prismaMock.blockRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant_1",
          status: "ACTIVE",
        },
      }),
    );
  });

  it("rejects invalid computer device token for active rules", async () => {
    prismaMock.computer.findUnique.mockResolvedValueOnce({
      id: "computer_1",
      tenantId: "tenant_1",
      status: "ACTIVE",
      deviceTokenHash: hashDeviceToken("expected-token"),
    });

    const response = await request(app)
      .get("/api/block-rules/active")
      .set("x-computer-id", "computer_1")
      .set("Authorization", "Bearer wrong-token");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(prismaMock.blockRule.findMany).not.toHaveBeenCalled();
  });
});
