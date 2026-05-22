import type { Express } from "express";
import { SignJWT } from "jose";
import type { Response as SupertestResponse } from "supertest";
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
  process.env.REFRESH_TOKEN_TTL_DAYS = "14";
  process.env.VERIFICATION_CODE_TTL_SECONDS = "600";
  process.env.PENDING_REGISTRATION_TTL_SECONDS = "1200";
  process.env.AUTH_BCRYPT_COST = "4";
  process.env.AWS_REGION = "ap-southeast-1";
  process.env.S3_BUCKET_NAME = "cloudcms-test-bucket";
};

const assertUnauthorized = (response: SupertestResponse): void => {
  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe("UNAUTHORIZED");
};

const assertForbidden = (response: SupertestResponse): void => {
  expect(response.status).toBe(403);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe("FORBIDDEN");
};

const assertValidationError = (response: SupertestResponse): void => {
  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe("VALIDATION_ERROR");
};

const buildAccessToken = async (input: {
  role?: AuthRole;
  tenantId?: string | null;
  tokenType?: "access" | "refresh";
  secret?: string;
  issuedAt?: number;
  expiresAt?: number;
}): Promise<string> => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const issuedAt = input.issuedAt ?? nowSeconds;
  const expiresAt = input.expiresAt ?? nowSeconds + 3_600;

  return new SignJWT({
    sub: "user_auth_test_1",
    tenantId:
      input.tenantId === undefined ? "tenant_auth_test_1" : input.tenantId,
    role: input.role ?? "shop_admin",
    tokenType: input.tokenType ?? "access",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(
      new TextEncoder().encode(
        input.secret ?? process.env.JWT_ACCESS_SECRET ?? "test-jwt-access-secret",
      ),
    );
};

setTestEnv();

const prismaMock = {
  tenant: {
    findUnique: vi.fn(async () => null),
    findFirst: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
  user: {
    findUnique: vi.fn(async () => null),
    findFirst: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
  refreshToken: {
    findUnique: vi.fn(async () => null),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
  verificationCode: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
  pendingTenantRegistration: {
    findUnique: vi.fn(async () => null),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(prismaMock),
  ),
};

const loggerInfoSpy = vi.fn(() => undefined);
const loggerWarnSpy = vi.fn(() => undefined);
const loggerErrorSpy = vi.fn(() => undefined);

let app: Express;
const staffUserId = "user_staff_test_1";
const tenantId = "tenant_auth_test_1";
const buildStaffUserDto = (
  input: {
    id: string;
    tenantId: string;
  } & Partial<{
    email: string;
    fullName: string;
    status: "ACTIVE" | "DISABLED";
    createdAt: Date;
  }>,
) => ({
  id: input.id,
  tenantId: input.tenantId,
  email: input.email ?? "staff@example.com",
  fullName: input.fullName ?? "Staff User",
  role: "STAFF",
  status: input.status ?? "ACTIVE",
  lastLoginAt: null,
  createdAt: input.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});
const buildCreateStaffPayload = () => ({
  email: "staff.new@example.com",
  fullName: "Staff New",
  password: "Temp@123456",
});

beforeAll(async () => {
  vi.resetModules();

  vi.doMock("../../src/shared/prisma/prisma.client", () => ({
    prisma: prismaMock,
    disconnectPrisma: vi.fn(async () => undefined),
    checkDatabaseConnection: vi.fn(async () => undefined),
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
});

describe.sequential("Users API authentication tests (Task 196->201)", () => {
  it("Task 196: create users API test file scaffold", () => {
    expect(typeof app).toBe("function");
  });

  it("Task 197: missing token on GET /api/users returns 401 UNAUTHORIZED", async () => {
    const response = await request(app).get("/api/users");

    assertUnauthorized(response);
  });

  it("Task 198: missing token on POST /api/users returns 401 UNAUTHORIZED", async () => {
    const response = await request(app).post("/api/users").send({
      email: "staff@example.com",
      fullName: "Staff User",
      password: "Temp@123456",
    });

    assertUnauthorized(response);
  });

  it("Task 199: malformed bearer token on Users API returns 401 UNAUTHORIZED", async () => {
    const response = await request(app)
      .get("/api/users")
      .set("Authorization", "Bearer token-part-one token-part-two");

    assertUnauthorized(response);
  });

  it("Task 200: invalid access token on Users API returns 401 UNAUTHORIZED", async () => {
    const invalidAccessToken = await buildAccessToken({
      secret: "wrong-jwt-access-secret",
    });

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${invalidAccessToken}`);

    assertUnauthorized(response);
  });

  it("Task 201: expired access token on Users API returns 401 UNAUTHORIZED", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiredAccessToken = await buildAccessToken({
      issuedAt: nowSeconds - 120,
      expiresAt: nowSeconds - 60,
    });

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${expiredAccessToken}`);

    assertUnauthorized(response);
  });
});

describe.sequential("Users API authorization tests (Task 202->208)", () => {
  it("Task 202: shop_admin can access POST /api/users", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_created_1", tenantId }),
    );

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: "staff.new@example.com",
        fullName: "Staff New",
        password: "Temp@123456",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("Task 203: shop_admin can access GET /api/users", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.count.mockResolvedValueOnce(1);
    prismaMock.user.findMany.mockResolvedValueOnce([
      buildStaffUserDto({ id: staffUserId, tenantId }),
    ]);

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("Task 204: shop_admin can access GET /api/users/:id", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst.mockResolvedValueOnce(
      buildStaffUserDto({ id: staffUserId, tenantId }),
    );

    const response = await request(app)
      .get(`/api/users/${staffUserId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("Task 205: shop_admin can access PATCH /api/users/:id", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst
      .mockResolvedValueOnce({
        id: staffUserId,
        fullName: "Staff User",
        status: "ACTIVE",
      })
      .mockResolvedValueOnce(buildStaffUserDto({ id: staffUserId, tenantId }));
    prismaMock.user.update.mockResolvedValueOnce({});

    const response = await request(app)
      .patch(`/api/users/${staffUserId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Staff User Updated",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("Task 206: staff cannot access any /api/users endpoint", async () => {
    const accessToken = await buildAccessToken({ role: "staff", tenantId });

    const [listResponse, createResponse, detailResponse, patchResponse] =
      await Promise.all([
        request(app)
          .get("/api/users")
          .set("Authorization", `Bearer ${accessToken}`),
        request(app)
          .post("/api/users")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            email: "blocked.staff@example.com",
            fullName: "Blocked Staff",
            password: "Temp@123456",
          }),
        request(app)
          .get(`/api/users/${staffUserId}`)
          .set("Authorization", `Bearer ${accessToken}`),
        request(app)
          .patch(`/api/users/${staffUserId}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ fullName: "Blocked" }),
      ]);

    assertForbidden(listResponse);
    assertForbidden(createResponse);
    assertForbidden(detailResponse);
    assertForbidden(patchResponse);
  });

  it("Task 207: super_admin cannot access any /api/users endpoint in MVP", async () => {
    const accessToken = await buildAccessToken({ role: "super_admin", tenantId });

    const [listResponse, createResponse, detailResponse, patchResponse] =
      await Promise.all([
        request(app)
          .get("/api/users")
          .set("Authorization", `Bearer ${accessToken}`),
        request(app)
          .post("/api/users")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            email: "blocked.superadmin@example.com",
            fullName: "Blocked Super Admin",
            password: "Temp@123456",
          }),
        request(app)
          .get(`/api/users/${staffUserId}`)
          .set("Authorization", `Bearer ${accessToken}`),
        request(app)
          .patch(`/api/users/${staffUserId}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ fullName: "Blocked" }),
      ]);

    assertForbidden(listResponse);
    assertForbidden(createResponse);
    assertForbidden(detailResponse);
    assertForbidden(patchResponse);
  });

  it("Task 208: shop_admin without tenant context receives 403 FORBIDDEN", async () => {
    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: null,
    });

    const [listResponse, createResponse, detailResponse, patchResponse] =
      await Promise.all([
        request(app)
          .get("/api/users")
          .set("Authorization", `Bearer ${accessToken}`),
        request(app)
          .post("/api/users")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            email: "no.tenant@example.com",
            fullName: "No Tenant",
            password: "Temp@123456",
          }),
        request(app)
          .get(`/api/users/${staffUserId}`)
          .set("Authorization", `Bearer ${accessToken}`),
        request(app)
          .patch(`/api/users/${staffUserId}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ fullName: "No Tenant" }),
      ]);

    assertForbidden(listResponse);
    assertForbidden(createResponse);
    assertForbidden(detailResponse);
    assertForbidden(patchResponse);
  });
});

describe.sequential("Create Staff API tests (Task 209->221)", () => {
  it("Task 209: shop_admin can create staff with email/fullName/password", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_created_209", tenantId }),
    );

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(buildCreateStaffPayload());

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.id).toBe("user_staff_created_209");
  });

  it("Task 210: created staff uses caller tenantId", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_created_210", tenantId }),
    );

    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(buildCreateStaffPayload());

    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.user.create.mock.calls[0][0];
    expect(createArgs.data.tenantId).toBe(tenantId);
  });

  it("Task 211: created staff has role STAFF", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_created_211", tenantId }),
    );

    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(buildCreateStaffPayload());

    const createArgs = prismaMock.user.create.mock.calls[0][0];
    expect(createArgs.data.role).toBe("STAFF");
  });

  it("Task 212: created staff has status ACTIVE", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_created_212", tenantId }),
    );

    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(buildCreateStaffPayload());

    const createArgs = prismaMock.user.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe("ACTIVE");
  });

  it("Task 213: staff email is trimmed and lowercased", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_created_213", tenantId }),
    );

    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...buildCreateStaffPayload(),
        email: "  Staff.New@Example.COM  ",
      });

    const createArgs = prismaMock.user.create.mock.calls[0][0];
    expect(createArgs.data.email).toBe("staff.new@example.com");
  });

  it("Task 214: password is stored as a hash", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const rawPassword = "Temp@123456";
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_created_214", tenantId }),
    );

    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...buildCreateStaffPayload(),
        password: rawPassword,
      });

    const createArgs = prismaMock.user.create.mock.calls[0][0];
    expect(typeof createArgs.data.passwordHash).toBe("string");
    expect(createArgs.data.passwordHash).not.toBe(rawPassword);
  });

  it("Task 215: raw password is not persisted", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_created_215", tenantId }),
    );

    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(buildCreateStaffPayload());

    const createArgs = prismaMock.user.create.mock.calls[0][0];
    expect(createArgs.data.password).toBeUndefined();
  });

  it("Task 216: duplicate email returns 409 CONFLICT", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "existing_user_1" });

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(buildCreateStaffPayload());

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("Task 217: invalid email returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...buildCreateStaffPayload(),
        email: "not-an-email",
      });

    assertValidationError(response);
  });

  it("Task 218: empty or overlong fullName returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const overlongFullName = "A".repeat(121);

    const [emptyNameResponse, overlongNameResponse] = await Promise.all([
      request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          ...buildCreateStaffPayload(),
          fullName: "   ",
        }),
      request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          ...buildCreateStaffPayload(),
          fullName: overlongFullName,
        }),
    ]);

    assertValidationError(emptyNameResponse);
    assertValidationError(overlongNameResponse);
  });

  it("Task 219: weak or missing password returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });

    const [weakPasswordResponse, missingPasswordResponse] = await Promise.all([
      request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          ...buildCreateStaffPayload(),
          password: "weak",
        }),
      request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          email: "staff.new@example.com",
          fullName: "Staff New",
        }),
    ]);

    assertValidationError(weakPasswordResponse);
    assertValidationError(missingPasswordResponse);
  });

  it("Task 220: create rejects protected fields", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const protectedFields = [
      "tenantId",
      "role",
      "status",
      "passwordHash",
      "id",
      "deletedAt",
      "createdAt",
      "updatedAt",
      "lastLoginAt",
    ];

    for (const field of protectedFields) {
      const response = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          ...buildCreateStaffPayload(),
          [field]: "forbidden-value",
        });

      assertValidationError(response);
    }
  });

  it("Task 221: create response does not expose sensitive fields", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_created_221", tenantId }),
    );

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(buildCreateStaffPayload());

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.user.deletedAt).toBeUndefined();
    expect(response.body.data.user.refreshTokens).toBeUndefined();
    expect(response.body.data.user.accessToken).toBeUndefined();
    expect(response.body.data.user.refreshToken).toBeUndefined();
  });
});

describe.sequential("Staff List API tests (Task 222->239)", () => {
  it("Task 222: shop_admin can list staff in own tenant", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.count.mockResolvedValueOnce(1);
    prismaMock.user.findMany.mockResolvedValueOnce([
      buildStaffUserDto({ id: "user_staff_list_222", tenantId }),
    ]);

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toHaveLength(1);
  });

  it("Task 223: list defaults to page=1 and pageSize=20", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.count.mockResolvedValueOnce(0);
    prismaMock.user.findMany.mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.page).toBe(1);
    expect(response.body.data.pageSize).toBe(20);
    const findManyArgs = prismaMock.user.findMany.mock.calls[0][0];
    expect(findManyArgs.skip).toBe(0);
    expect(findManyArgs.take).toBe(20);
  });

  it("Task 224: pageSize > 100 returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const response = await request(app)
      .get("/api/users?pageSize=101")
      .set("Authorization", `Bearer ${accessToken}`);

    assertValidationError(response);
  });

  it("Task 225: list supports status=ACTIVE", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.count.mockResolvedValueOnce(1);
    prismaMock.user.findMany.mockResolvedValueOnce([
      buildStaffUserDto({ id: "user_staff_active_225", tenantId, status: "ACTIVE" }),
    ]);

    const response = await request(app)
      .get("/api/users?status=ACTIVE")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const countArgs = prismaMock.user.count.mock.calls[0][0];
    expect(countArgs.where.status).toBe("ACTIVE");
  });

  it("Task 226: list supports status=DISABLED", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.count.mockResolvedValueOnce(1);
    prismaMock.user.findMany.mockResolvedValueOnce([
      buildStaffUserDto({
        id: "user_staff_disabled_226",
        tenantId,
        status: "DISABLED",
      }),
    ]);

    const response = await request(app)
      .get("/api/users?status=DISABLED")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const countArgs = prismaMock.user.count.mock.calls[0][0];
    expect(countArgs.where.status).toBe("DISABLED");
  });

  it("Task 227: invalid status returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const response = await request(app)
      .get("/api/users?status=LOCKED")
      .set("Authorization", `Bearer ${accessToken}`);

    assertValidationError(response);
  });

  it("Task 228: q searches over email", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.count.mockResolvedValueOnce(1);
    prismaMock.user.findMany.mockResolvedValueOnce([
      buildStaffUserDto({
        id: "user_staff_email_228",
        tenantId,
        email: "search.me@example.com",
      }),
    ]);

    const response = await request(app)
      .get("/api/users?q=search.me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const countArgs = prismaMock.user.count.mock.calls[0][0];
    expect(countArgs.where.OR[0].email.contains).toBe("search.me");
  });

  it("Task 229: q searches over fullName", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.count.mockResolvedValueOnce(1);
    prismaMock.user.findMany.mockResolvedValueOnce([
      buildStaffUserDto({
        id: "user_staff_name_229",
        tenantId,
        fullName: "Alice Search",
      }),
    ]);

    const response = await request(app)
      .get("/api/users?q=Alice")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const countArgs = prismaMock.user.count.mock.calls[0][0];
    expect(countArgs.where.OR[1].fullName.contains).toBe("Alice");
  });

  it("Task 230: q is trimmed and empty search is omitted", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.count.mockResolvedValueOnce(0);
    prismaMock.user.findMany.mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/users?q=%20%20%20")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const countArgs = prismaMock.user.count.mock.calls[0][0];
    expect(countArgs.where.OR).toBeUndefined();
  });

  it("Task 231: overlong q returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const response = await request(app)
      .get(`/api/users?q=${"a".repeat(101)}`)
      .set("Authorization", `Bearer ${accessToken}`);

    assertValidationError(response);
  });

  it("Task 232: invalid page returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const response = await request(app)
      .get("/api/users?page=0")
      .set("Authorization", `Bearer ${accessToken}`);

    assertValidationError(response);
  });

  it("Task 233: invalid pageSize returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const response = await request(app)
      .get("/api/users?pageSize=0")
      .set("Authorization", `Bearer ${accessToken}`);

    assertValidationError(response);
  });

  it("Task 234: list sorts by createdAt desc", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.count.mockResolvedValueOnce(2);
    prismaMock.user.findMany.mockResolvedValueOnce([
      buildStaffUserDto({ id: "user_staff_new", tenantId }),
      buildStaffUserDto({ id: "user_staff_old", tenantId }),
    ]);

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const findManyArgs = prismaMock.user.findMany.mock.calls[0][0];
    expect(findManyArgs.orderBy).toEqual({ createdAt: "desc" });
  });

  it("Task 235: list returns items/page/pageSize/total", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.count.mockResolvedValueOnce(1);
    prismaMock.user.findMany.mockResolvedValueOnce([
      buildStaffUserDto({ id: "user_staff_235", tenantId }),
    ]);

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.page).toBeTypeOf("number");
    expect(response.body.data.pageSize).toBeTypeOf("number");
    expect(response.body.data.total).toBeTypeOf("number");
  });

  it("Task 236: list excludes users where deletedAt is not null", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.count.mockResolvedValueOnce(0);
    prismaMock.user.findMany.mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const countArgs = prismaMock.user.count.mock.calls[0][0];
    expect(countArgs.where.deletedAt).toBeNull();
  });

  it("Task 237: list excludes SHOP_ADMIN and SUPER_ADMIN users", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.count.mockResolvedValueOnce(0);
    prismaMock.user.findMany.mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const countArgs = prismaMock.user.count.mock.calls[0][0];
    expect(countArgs.where.role).toBe("STAFF");
  });

  it("Task 238: list excludes staff from other tenants", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.count.mockResolvedValueOnce(0);
    prismaMock.user.findMany.mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const countArgs = prismaMock.user.count.mock.calls[0][0];
    expect(countArgs.where.tenantId).toBe(tenantId);
  });

  it("Task 239: list response does not expose passwordHash/deletedAt/token material", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.count.mockResolvedValueOnce(1);
    prismaMock.user.findMany.mockResolvedValueOnce([
      buildStaffUserDto({ id: "user_staff_239", tenantId }),
    ]);

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items[0].passwordHash).toBeUndefined();
    expect(response.body.data.items[0].deletedAt).toBeUndefined();
    expect(response.body.data.items[0].refreshTokens).toBeUndefined();
    expect(response.body.data.items[0].accessToken).toBeUndefined();
    expect(response.body.data.items[0].refreshToken).toBeUndefined();
  });
});

describe.sequential("Staff Detail API tests (Task 240->247)", () => {
  it("Task 240: shop_admin can get staff detail in own tenant", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_240", tenantId }),
    );

    const response = await request(app)
      .get("/api/users/user_staff_240")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.id).toBe("user_staff_240");
  });

  it("Task 241: unknown staff id returns 404 NOT_FOUND", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst.mockResolvedValueOnce(null);

    const response = await request(app)
      .get("/api/users/user_not_found_241")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("Task 242: deleted staff returns 404 NOT_FOUND", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst.mockResolvedValueOnce(null);

    const response = await request(app)
      .get("/api/users/user_deleted_242")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("Task 243: staff from another tenant returns 404 NOT_FOUND", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst.mockResolvedValueOnce(null);

    const response = await request(app)
      .get("/api/users/user_other_tenant_243")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("Task 244: SHOP_ADMIN target returns 404 NOT_FOUND", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst.mockResolvedValueOnce(null);

    const response = await request(app)
      .get("/api/users/user_shop_admin_target_244")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("Task 245: SUPER_ADMIN target returns 404 NOT_FOUND", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst.mockResolvedValueOnce(null);

    const response = await request(app)
      .get("/api/users/user_super_admin_target_245")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("Task 246: invalid id returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const response = await request(app)
      .get("/api/users/%20%20")
      .set("Authorization", `Bearer ${accessToken}`);

    assertValidationError(response);
  });

  it("Task 247: detail response does not expose passwordHash/deletedAt/token material", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_247", tenantId }),
    );

    const response = await request(app)
      .get("/api/users/user_staff_247")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.user.deletedAt).toBeUndefined();
    expect(response.body.data.user.refreshTokens).toBeUndefined();
    expect(response.body.data.user.accessToken).toBeUndefined();
    expect(response.body.data.user.refreshToken).toBeUndefined();
  });
});

describe.sequential("Staff Update API tests (Task 248->266)", () => {
  it("Task 248: shop_admin can update staff fullName", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst
      .mockResolvedValueOnce({ id: "user_staff_248", fullName: "Old", status: "ACTIVE" })
      .mockResolvedValueOnce(
        buildStaffUserDto({ id: "user_staff_248", tenantId, fullName: "New Name" }),
      );
    prismaMock.user.update.mockResolvedValueOnce({});

    const response = await request(app)
      .patch("/api/users/user_staff_248")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ fullName: "New Name" });

    expect(response.status).toBe(200);
    expect(response.body.data.user.fullName).toBe("New Name");
  });

  it("Task 249: shop_admin can update status to ACTIVE", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst
      .mockResolvedValueOnce({ id: "user_staff_249", fullName: "User", status: "DISABLED" })
      .mockResolvedValueOnce(
        buildStaffUserDto({ id: "user_staff_249", tenantId, status: "ACTIVE" }),
      );
    prismaMock.user.update.mockResolvedValueOnce({});

    const response = await request(app)
      .patch("/api/users/user_staff_249")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "ACTIVE" });

    expect(response.status).toBe(200);
    expect(response.body.data.user.status).toBe("ACTIVE");
  });

  it("Task 250: shop_admin can update status to DISABLED", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst
      .mockResolvedValueOnce({ id: "user_staff_250", fullName: "User", status: "ACTIVE" })
      .mockResolvedValueOnce(
        buildStaffUserDto({ id: "user_staff_250", tenantId, status: "DISABLED" }),
      );
    prismaMock.user.update.mockResolvedValueOnce({});

    const response = await request(app)
      .patch("/api/users/user_staff_250")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "DISABLED" });

    expect(response.status).toBe(200);
    expect(response.body.data.user.status).toBe("DISABLED");
  });

  it("Task 251: shop_admin can reset staff password", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst
      .mockResolvedValueOnce({ id: "user_staff_251", fullName: "User", status: "ACTIVE" })
      .mockResolvedValueOnce(buildStaffUserDto({ id: "user_staff_251", tenantId }));
    prismaMock.user.update.mockResolvedValueOnce({});

    const response = await request(app)
      .patch("/api/users/user_staff_251")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ password: "Temp@654321" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("Task 252: password reset stores a hash", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const rawPassword = "Temp@654321";
    prismaMock.user.findFirst
      .mockResolvedValueOnce({ id: "user_staff_252", fullName: "User", status: "ACTIVE" })
      .mockResolvedValueOnce(buildStaffUserDto({ id: "user_staff_252", tenantId }));
    prismaMock.user.update.mockResolvedValueOnce({});

    await request(app)
      .patch("/api/users/user_staff_252")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ password: rawPassword });

    const updateArgs = prismaMock.user.update.mock.calls[0][0];
    expect(typeof updateArgs.data.passwordHash).toBe("string");
    expect(updateArgs.data.passwordHash).not.toBe(rawPassword);
  });

  it("Task 253: password reset does not persist raw password", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst
      .mockResolvedValueOnce({ id: "user_staff_253", fullName: "User", status: "ACTIVE" })
      .mockResolvedValueOnce(buildStaffUserDto({ id: "user_staff_253", tenantId }));
    prismaMock.user.update.mockResolvedValueOnce({});

    await request(app)
      .patch("/api/users/user_staff_253")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ password: "Temp@654321" });

    const updateArgs = prismaMock.user.update.mock.calls[0][0];
    expect(updateArgs.data.password).toBeUndefined();
  });

  it("Task 254: PATCH can update multiple allowed fields", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst
      .mockResolvedValueOnce({ id: "user_staff_254", fullName: "Old", status: "ACTIVE" })
      .mockResolvedValueOnce(
        buildStaffUserDto({
          id: "user_staff_254",
          tenantId,
          fullName: "Multi Update",
          status: "DISABLED",
        }),
      );
    prismaMock.user.update.mockResolvedValueOnce({});

    const response = await request(app)
      .patch("/api/users/user_staff_254")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ fullName: "Multi Update", status: "DISABLED", password: "Temp@654321" });

    expect(response.status).toBe(200);
    const updateArgs = prismaMock.user.update.mock.calls[0][0];
    expect(updateArgs.data.fullName).toBe("Multi Update");
    expect(updateArgs.data.status).toBe("DISABLED");
    expect(typeof updateArgs.data.passwordHash).toBe("string");
  });

  it("Task 255: empty patch body returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const response = await request(app)
      .patch("/api/users/user_staff_255")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    assertValidationError(response);
  });

  it("Task 256: unknown patch fields return 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const response = await request(app)
      .patch("/api/users/user_staff_256")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nickname: "unknown-field" });

    assertValidationError(response);
  });

  it("Task 257: invalid status returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const response = await request(app)
      .patch("/api/users/user_staff_257")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "LOCKED" });

    assertValidationError(response);
  });

  it("Task 258: empty or overlong fullName returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const [emptyResponse, overlongResponse] = await Promise.all([
      request(app)
        .patch("/api/users/user_staff_258")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ fullName: "   " }),
      request(app)
        .patch("/api/users/user_staff_258")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ fullName: "A".repeat(121) }),
    ]);

    assertValidationError(emptyResponse);
    assertValidationError(overlongResponse);
  });

  it("Task 259: weak password returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const response = await request(app)
      .patch("/api/users/user_staff_259")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ password: "weak" });

    assertValidationError(response);
  });

  it("Task 260: patch rejects protected fields", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const fields = [
      "email",
      "tenantId",
      "role",
      "passwordHash",
      "id",
      "deletedAt",
      "createdAt",
      "updatedAt",
      "lastLoginAt",
    ];
    for (const field of fields) {
      const response = await request(app)
        .patch("/api/users/user_staff_260")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ [field]: "forbidden" });
      assertValidationError(response);
    }
  });

  it("Task 261: unknown staff id returns 404 NOT_FOUND", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    const response = await request(app)
      .patch("/api/users/user_not_found_261")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ fullName: "Update" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("Task 262: deleted staff returns 404 NOT_FOUND", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    const response = await request(app)
      .patch("/api/users/user_deleted_262")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ fullName: "Update" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("Task 263: staff from another tenant returns 404 NOT_FOUND", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    const response = await request(app)
      .patch("/api/users/user_other_tenant_263")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ fullName: "Update" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("Task 264: SHOP_ADMIN target returns 404 NOT_FOUND", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    const response = await request(app)
      .patch("/api/users/user_shop_admin_target_264")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ fullName: "Update" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("Task 265: SUPER_ADMIN target returns 404 NOT_FOUND", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    const response = await request(app)
      .patch("/api/users/user_super_admin_target_265")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ fullName: "Update" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("Task 266: update response does not expose passwordHash/deletedAt/token material", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst
      .mockResolvedValueOnce({ id: "user_staff_266", fullName: "Old", status: "ACTIVE" })
      .mockResolvedValueOnce(
        buildStaffUserDto({ id: "user_staff_266", tenantId, fullName: "Updated" }),
      );
    prismaMock.user.update.mockResolvedValueOnce({});

    const response = await request(app)
      .patch("/api/users/user_staff_266")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ fullName: "Updated" });

    expect(response.status).toBe(200);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.user.deletedAt).toBeUndefined();
    expect(response.body.data.user.refreshTokens).toBeUndefined();
    expect(response.body.data.user.accessToken).toBeUndefined();
    expect(response.body.data.user.refreshToken).toBeUndefined();
  });
});

describe.sequential("Security and Logging tests (Task 267->276)", () => {
  it("Task 267: staff create logs include requestId when available", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_267", tenantId }),
    );

    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-request-id", "req-users-267")
      .send(buildCreateStaffPayload());

    expect(loggerInfoSpy).toHaveBeenCalled();
    const eventCall = loggerInfoSpy.mock.calls.find(
      (call) => call[0]?.event === "user.staff.created",
    );
    expect(eventCall).toBeDefined();
    expect(eventCall?.[0]?.requestId).toBe("req-users-267");
  });

  it("Task 268: staff update logs include actor role and target user id", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst
      .mockResolvedValueOnce({ id: "user_staff_268", fullName: "Old", status: "ACTIVE" })
      .mockResolvedValueOnce(
        buildStaffUserDto({ id: "user_staff_268", tenantId, fullName: "Updated" }),
      );
    prismaMock.user.update.mockResolvedValueOnce({});

    await request(app)
      .patch("/api/users/user_staff_268")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ fullName: "Updated" });

    const eventCall = loggerInfoSpy.mock.calls.find(
      (call) => call[0]?.event === "user.staff.updated",
    );
    expect(eventCall).toBeDefined();
    expect(eventCall?.[0]?.actorRole).toBe("shop_admin");
    expect(eventCall?.[0]?.targetUserId).toBe("user_staff_268");
  });

  it("Task 269: staff status update logs include oldStatus and newStatus", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst
      .mockResolvedValueOnce({ id: "user_staff_269", fullName: "User", status: "DISABLED" })
      .mockResolvedValueOnce(
        buildStaffUserDto({ id: "user_staff_269", tenantId, status: "ACTIVE" }),
      );
    prismaMock.user.update.mockResolvedValueOnce({});

    await request(app)
      .patch("/api/users/user_staff_269")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "ACTIVE" });

    const eventCall = loggerInfoSpy.mock.calls.find(
      (call) => call[0]?.event === "user.staff.status.updated",
    );
    expect(eventCall).toBeDefined();
    expect(eventCall?.[0]?.oldStatus).toBe("DISABLED");
    expect(eventCall?.[0]?.newStatus).toBe("ACTIVE");
  });

  it("Task 270: password reset logs do not include raw password or password hash", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findFirst
      .mockResolvedValueOnce({ id: "user_staff_270", fullName: "User", status: "ACTIVE" })
      .mockResolvedValueOnce(buildStaffUserDto({ id: "user_staff_270", tenantId }));
    prismaMock.user.update.mockResolvedValueOnce({});

    await request(app)
      .patch("/api/users/user_staff_270")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ password: "Temp@654321" });

    const eventCall = loggerInfoSpy.mock.calls.find(
      (call) => call[0]?.event === "user.staff.password.reset",
    );
    expect(eventCall).toBeDefined();
    expect(eventCall?.[0]?.password).toBeUndefined();
    expect(eventCall?.[0]?.passwordHash).toBeUndefined();
  });

  it("Task 271: logs do not include authorization headers", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_271", tenantId }),
    );

    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(buildCreateStaffPayload());

    const [payload] = loggerInfoSpy.mock.calls.at(-1) ?? [];
    expect(payload.authorization).toBeUndefined();
    expect(payload.headers).toBeUndefined();
  });

  it("Task 272: logs do not include access tokens or refresh tokens", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_272", tenantId }),
    );

    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(buildCreateStaffPayload());

    const [payload] = loggerInfoSpy.mock.calls.at(-1) ?? [];
    expect(payload.accessToken).toBeUndefined();
    expect(payload.refreshToken).toBeUndefined();
    expect(payload.token).toBeUndefined();
  });

  it("Task 273: logs do not include raw request headers", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_273", tenantId }),
    );

    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(buildCreateStaffPayload());

    const [payload] = loggerInfoSpy.mock.calls.at(-1) ?? [];
    expect(payload.rawHeaders).toBeUndefined();
    expect(payload.requestHeaders).toBeUndefined();
  });

  it("Task 274: logs do not include raw request body", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_274", tenantId }),
    );

    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(buildCreateStaffPayload());

    const [payload] = loggerInfoSpy.mock.calls.at(-1) ?? [];
    expect(payload.body).toBeUndefined();
    expect(payload.rawBody).toBeUndefined();
    expect(payload.requestBody).toBeUndefined();
  });

  it("Task 275: client-supplied tenantId cannot affect create/list/detail/update scope", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });

    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_275_create", tenantId }),
    );
    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(buildCreateStaffPayload());
    const createArgs = prismaMock.user.create.mock.calls.at(-1)?.[0];
    expect(createArgs?.data?.tenantId).toBe(tenantId);

    prismaMock.user.count.mockResolvedValueOnce(0);
    prismaMock.user.findMany.mockResolvedValueOnce([]);
    await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${accessToken}`);
    const listCountArgs = prismaMock.user.count.mock.calls.at(-1)?.[0];
    expect(listCountArgs?.where?.tenantId).toBe(tenantId);

    prismaMock.user.findFirst.mockResolvedValueOnce(
      buildStaffUserDto({ id: "user_staff_275_detail", tenantId }),
    );
    await request(app)
      .get("/api/users/user_staff_275_detail")
      .set("Authorization", `Bearer ${accessToken}`);
    const detailArgs = prismaMock.user.findFirst.mock.calls.at(-1)?.[0];
    expect(detailArgs?.where?.tenantId).toBe(tenantId);

    prismaMock.user.findFirst
      .mockResolvedValueOnce({
        id: "user_staff_275_update",
        fullName: "Old",
        status: "ACTIVE",
      })
      .mockResolvedValueOnce(
        buildStaffUserDto({ id: "user_staff_275_update", tenantId, fullName: "New" }),
      );
    prismaMock.user.update.mockResolvedValueOnce({});
    await request(app)
      .patch("/api/users/user_staff_275_update")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ fullName: "New" });
    const updateLookupArgs = prismaMock.user.findFirst.mock.calls.at(-2)?.[0];
    expect(updateLookupArgs?.where?.tenantId).toBe(tenantId);
  });

  it("Task 276: client-supplied role-like data cannot create or mutate non-STAFF users", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });

    const createResponse = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...buildCreateStaffPayload(),
        role: "SUPER_ADMIN",
      });
    assertValidationError(createResponse);

    const patchResponse = await request(app)
      .patch("/api/users/user_staff_276")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        role: "SHOP_ADMIN",
      });
    assertValidationError(patchResponse);
  });
});

describe.sequential("Security hardening tests (extra)", () => {
  it("rejects injection-like payloads for create and update body", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const payloads = [
      { email: { $ne: "" }, fullName: "A", password: "Temp@123456" },
      { email: "ok@example.com", fullName: { $gt: "" }, password: "Temp@123456" },
      { email: "ok@example.com", fullName: "A", password: { $regex: ".*" } },
    ];

    for (const payload of payloads) {
      const createResponse = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(payload);
      assertValidationError(createResponse);
    }

    const patchResponse = await request(app)
      .patch("/api/users/user_staff_extra_1")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ fullName: { $ne: "" } });
    assertValidationError(patchResponse);
  });

  it("rejects query abuse inputs for pagination and search", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    const queries = [
      "/api/users?page=-100",
      "/api/users?pageSize=1000000",
      `/api/users?q=${encodeURIComponent("' OR 1=1 --")}${"a".repeat(120)}`,
    ];

    for (const query of queries) {
      const response = await request(app)
        .get(query)
        .set("Authorization", `Bearer ${accessToken}`);
      assertValidationError(response);
    }
  });

  it("rejects crafted query parameters outside allowlist", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });

    const response = await request(app)
      .get("/api/users?tenantId=tenant_hacker&role=SUPER_ADMIN&deletedAt=notnull")
      .set("Authorization", `Bearer ${accessToken}`);

    assertValidationError(response);
    expect(prismaMock.user.count).not.toHaveBeenCalled();
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });
});
