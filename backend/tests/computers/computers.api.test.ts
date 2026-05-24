import type { Express } from "express";
import { SignJWT } from "jose";
import type { Response as SupertestResponse } from "supertest";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type AuthRole = "super_admin" | "shop_admin" | "staff";
const { comparePasswordMock } = vi.hoisted(() => ({
  comparePasswordMock: vi.fn(async () => false),
}));

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

const assertNotFound = (response: SupertestResponse): void => {
  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe("NOT_FOUND");
};

const assertConflict = (response: SupertestResponse): void => {
  expect(response.status).toBe(409);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe("CONFLICT");
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
    tenantId: input.tenantId === undefined ? "tenant_1" : input.tenantId,
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
  computer: {
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
const tenantId = "tenant_1";
const computerId = "computer_1";
let registerRequestSequence = 0;

const nextRegisterTestIp = (): string => {
  registerRequestSequence += 1;
  return `203.0.113.${(registerRequestSequence % 240) + 1}`;
};

const postRegister = (
  body: Record<string, unknown>,
  ip: string = nextRegisterTestIp(),
) =>
  request(app)
    .post("/api/computers/register")
    .set("x-forwarded-for", ip)
    .send(body);

const computerRecord = {
  id: computerId,
  tenantId,
  name: "Front Desk PC",
  macAddress: "AA:BB:CC:DD:EE:FF",
  status: "ACTIVE" as const,
  lastSeenAt: null,
  notes: null,
  createdAt: new Date("2026-05-23T00:00:00.000Z"),
  updatedAt: new Date("2026-05-23T00:00:00.000Z"),
};

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  registerRequestSequence = 0;
  comparePasswordMock.mockReset();
  comparePasswordMock.mockResolvedValue(false);

  prismaMock.tenant.findUnique.mockReset();
  prismaMock.tenant.findUnique.mockResolvedValue(null);
  prismaMock.tenant.findFirst.mockReset();
  prismaMock.tenant.findFirst.mockResolvedValue(null);
  prismaMock.tenant.findMany.mockReset();
  prismaMock.tenant.findMany.mockResolvedValue([]);
  prismaMock.tenant.count.mockReset();
  prismaMock.tenant.count.mockResolvedValue(0);
  prismaMock.tenant.create.mockReset();
  prismaMock.tenant.update.mockReset();
  prismaMock.tenant.updateMany.mockReset();
  prismaMock.tenant.updateMany.mockResolvedValue({ count: 0 });

  prismaMock.user.findUnique.mockReset();
  prismaMock.user.findUnique.mockResolvedValue(null);
  prismaMock.user.findFirst.mockReset();
  prismaMock.user.findFirst.mockResolvedValue(null);
  prismaMock.user.findMany.mockReset();
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.user.count.mockReset();
  prismaMock.user.count.mockResolvedValue(0);
  prismaMock.user.create.mockReset();
  prismaMock.user.update.mockReset();
  prismaMock.user.updateMany.mockReset();
  prismaMock.user.updateMany.mockResolvedValue({ count: 0 });

  prismaMock.computer.findUnique.mockReset();
  prismaMock.computer.findUnique.mockResolvedValue(null);
  prismaMock.computer.findFirst.mockReset();
  prismaMock.computer.findFirst.mockResolvedValue(null);
  prismaMock.computer.findMany.mockReset();
  prismaMock.computer.findMany.mockResolvedValue([]);
  prismaMock.computer.count.mockReset();
  prismaMock.computer.count.mockResolvedValue(0);
  prismaMock.computer.create.mockReset();
  prismaMock.computer.update.mockReset();
  prismaMock.computer.updateMany.mockReset();
  prismaMock.computer.updateMany.mockResolvedValue({ count: 0 });

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

  vi.doMock("../../src/modules/auth/auth.password", () => ({
    authPasswordService: {
      hashPassword: vi.fn(),
      comparePassword: comparePasswordMock,
    },
  }));

  ({ app } = await import("../../src/app"));
  app.set("trust proxy", true);
});

describe.sequential("Computers API authentication and authorization tests (Task 368-382)", () => {
  it("Task 368: create computers API test file scaffold", () => {
    expect(typeof app).toBe("function");
  });

  it("Task 369: POST /api/computers/register does not require admin JWT", async () => {
    comparePasswordMock.mockResolvedValueOnce(true);
    prismaMock.tenant.findFirst.mockResolvedValueOnce({
      id: tenantId,
      code: "CYBER01",
      status: "ACTIVE",
      computerRegistrationSecretHash: "$2a$04$2Y9CL5V4xHnWjCwYjFhnfOVUbSZx7u2L6V2K4Ih2wQk84Z6s9sojK",
    });
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);
    prismaMock.computer.create.mockResolvedValueOnce(computerRecord);

    const response = await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
      name: "Front Desk PC",
    });

    expect(response.status).not.toBe(401);
  });

  it("Task 370: missing token on GET /api/computers returns 401 UNAUTHORIZED", async () => {
    const response = await request(app).get("/api/computers");
    assertUnauthorized(response);
  });

  it("Task 371: missing token on GET /api/computers/:id returns 401 UNAUTHORIZED", async () => {
    const response = await request(app).get(`/api/computers/${computerId}`);
    assertUnauthorized(response);
  });

  it("Task 372: missing token on PATCH /api/computers/:id returns 401 UNAUTHORIZED", async () => {
    const response = await request(app).patch(`/api/computers/${computerId}`).send({
      name: "Updated Name",
    });
    assertUnauthorized(response);
  });

  it("Task 373: missing token on POST /api/computers/:id/reissue-token returns 401 UNAUTHORIZED", async () => {
    const response = await request(app)
      .post(`/api/computers/${computerId}/reissue-token`)
      .send({});
    assertUnauthorized(response);
  });

  it("Task 374: malformed bearer token on admin endpoints returns 401 UNAUTHORIZED", async () => {
    const response = await request(app)
      .get("/api/computers")
      .set("Authorization", "Bearer token-part-one token-part-two");
    assertUnauthorized(response);
  });

  it("Task 375: invalid access token on admin endpoints returns 401 UNAUTHORIZED", async () => {
    const invalidAccessToken = await buildAccessToken({
      secret: "wrong-jwt-access-secret",
    });

    const response = await request(app)
      .get("/api/computers")
      .set("Authorization", `Bearer ${invalidAccessToken}`);
    assertUnauthorized(response);
  });

  it("Task 376: expired access token on admin endpoints returns 401 UNAUTHORIZED", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiredAccessToken = await buildAccessToken({
      issuedAt: nowSeconds - 120,
      expiresAt: nowSeconds - 60,
    });

    const response = await request(app)
      .get("/api/computers")
      .set("Authorization", `Bearer ${expiredAccessToken}`);
    assertUnauthorized(response);
  });

  it("Task 377: refresh-token-type JWT cannot access admin endpoints", async () => {
    const refreshTypeToken = await buildAccessToken({
      tokenType: "refresh",
    });

    const response = await request(app)
      .get("/api/computers")
      .set("Authorization", `Bearer ${refreshTypeToken}`);
    assertUnauthorized(response);
  });

  it("Task 378: shop_admin can access list/detail/update/reissue inside own tenant", async () => {
    const accessToken = await buildAccessToken({ role: "shop_admin", tenantId });
    prismaMock.computer.count.mockResolvedValueOnce(1);
    prismaMock.computer.findMany.mockResolvedValueOnce([computerRecord]);
    prismaMock.computer.findFirst
      .mockResolvedValueOnce(computerRecord)
      .mockResolvedValueOnce(computerRecord)
      .mockResolvedValueOnce(computerRecord);
    prismaMock.computer.update.mockResolvedValueOnce({
      ...computerRecord,
      name: "Updated Name",
    });
    prismaMock.computer.updateMany.mockResolvedValueOnce({ count: 1 });

    const listResponse = await request(app)
      .get("/api/computers")
      .set("Authorization", `Bearer ${accessToken}`);
    const detailResponse = await request(app)
      .get(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    const patchResponse = await request(app)
      .patch(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Updated Name" });
    const reissueResponse = await request(app)
      .post(`/api/computers/${computerId}/reissue-token`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ reason: "Reinstall client" });

    expect(listResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(patchResponse.status).toBe(200);
    expect(reissueResponse.status).toBe(200);
  });

  it("Task 379: staff cannot access any Computers admin endpoint", async () => {
    const accessToken = await buildAccessToken({ role: "staff", tenantId });
    const [listResponse, detailResponse, patchResponse, reissueResponse] =
      await Promise.all([
        request(app)
          .get("/api/computers")
          .set("Authorization", `Bearer ${accessToken}`),
        request(app)
          .get(`/api/computers/${computerId}`)
          .set("Authorization", `Bearer ${accessToken}`),
        request(app)
          .patch(`/api/computers/${computerId}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ name: "Blocked" }),
        request(app)
          .post(`/api/computers/${computerId}/reissue-token`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({}),
      ]);

    assertForbidden(listResponse);
    assertForbidden(detailResponse);
    assertForbidden(patchResponse);
    assertForbidden(reissueResponse);
  });

  it("Task 380: super_admin cannot access any Computers admin endpoint in MVP", async () => {
    const accessToken = await buildAccessToken({ role: "super_admin", tenantId });
    const [listResponse, detailResponse, patchResponse, reissueResponse] =
      await Promise.all([
        request(app)
          .get("/api/computers")
          .set("Authorization", `Bearer ${accessToken}`),
        request(app)
          .get(`/api/computers/${computerId}`)
          .set("Authorization", `Bearer ${accessToken}`),
        request(app)
          .patch(`/api/computers/${computerId}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ name: "Blocked" }),
        request(app)
          .post(`/api/computers/${computerId}/reissue-token`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({}),
      ]);

    assertForbidden(listResponse);
    assertForbidden(detailResponse);
    assertForbidden(patchResponse);
    assertForbidden(reissueResponse);
  });

  it("Task 381: authenticated shop_admin without tenant context receives 403 FORBIDDEN", async () => {
    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: null,
    });
    const [listResponse, detailResponse, patchResponse, reissueResponse] =
      await Promise.all([
        request(app)
          .get("/api/computers")
          .set("Authorization", `Bearer ${accessToken}`),
        request(app)
          .get(`/api/computers/${computerId}`)
          .set("Authorization", `Bearer ${accessToken}`),
        request(app)
          .patch(`/api/computers/${computerId}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ name: "No Tenant" }),
        request(app)
          .post(`/api/computers/${computerId}/reissue-token`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({}),
      ]);

    assertForbidden(listResponse);
    assertForbidden(detailResponse);
    assertForbidden(patchResponse);
    assertForbidden(reissueResponse);
  });

  it("Task 382: device-token-only clients cannot access admin endpoints", async () => {
    const deviceLikeToken = await new SignJWT({
      sub: "device_client_1",
      tenantId,
      role: "shop_admin",
      tokenType: "device",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(
        new TextEncoder().encode(
          process.env.JWT_ACCESS_SECRET ?? "test-jwt-access-secret",
        ),
      );

    const response = await request(app)
      .get("/api/computers")
      .set("Authorization", `Bearer ${deviceLikeToken}`);
    assertUnauthorized(response);
  });
});

describe.sequential("Computers register API tests (Task 383-397)", () => {
  it("Task 383: valid register creates a computer", async () => {
    comparePasswordMock.mockResolvedValueOnce(true);
    prismaMock.tenant.findFirst.mockResolvedValueOnce({
      id: tenantId,
      code: "CYBER01",
      status: "ACTIVE",
      computerRegistrationSecretHash: "stored-secret-hash",
    });
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);
    prismaMock.computer.create.mockResolvedValueOnce(computerRecord);

    const response = await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
      name: "Front Desk PC",
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(prismaMock.computer.create).toHaveBeenCalledTimes(1);
  });

  it("Task 384: valid register returns plain device token", async () => {
    comparePasswordMock.mockResolvedValueOnce(true);
    prismaMock.tenant.findFirst.mockResolvedValueOnce({
      id: tenantId,
      code: "CYBER01",
      status: "ACTIVE",
      computerRegistrationSecretHash: "stored-secret-hash",
    });
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);
    prismaMock.computer.create.mockResolvedValueOnce(computerRecord);

    const response = await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
      name: "Front Desk PC",
    });

    expect(response.status).toBe(200);
    expect(typeof response.body.data.deviceToken).toBe("string");
    expect(response.body.data.deviceToken.length).toBeGreaterThan(20);
  });

  it("Task 385: register response does not include deviceTokenHash", async () => {
    comparePasswordMock.mockResolvedValueOnce(true);
    prismaMock.tenant.findFirst.mockResolvedValueOnce({
      id: tenantId,
      code: "CYBER01",
      status: "ACTIVE",
      computerRegistrationSecretHash: "stored-secret-hash",
    });
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);
    prismaMock.computer.create.mockResolvedValueOnce({
      ...computerRecord,
      deviceTokenHash: "should-not-leak",
    });

    const response = await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
      name: "Front Desk PC",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.computer.deviceTokenHash).toBeUndefined();
  });

  it("Task 386: plain device token is not persisted", async () => {
    comparePasswordMock.mockResolvedValueOnce(true);
    prismaMock.tenant.findFirst.mockResolvedValueOnce({
      id: tenantId,
      code: "CYBER01",
      status: "ACTIVE",
      computerRegistrationSecretHash: "stored-secret-hash",
    });
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);
    prismaMock.computer.create.mockResolvedValueOnce(computerRecord);

    const response = await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
      name: "Front Desk PC",
    });

    const createArgs = prismaMock.computer.create.mock.calls[0][0];
    expect(createArgs.data.deviceToken).toBeUndefined();
    expect(createArgs.data.deviceTokenHash).not.toBe(response.body.data.deviceToken);
  });

  it("Task 387: device token hash is persisted", async () => {
    comparePasswordMock.mockResolvedValueOnce(true);
    prismaMock.tenant.findFirst.mockResolvedValueOnce({
      id: tenantId,
      code: "CYBER01",
      status: "ACTIVE",
      computerRegistrationSecretHash: "stored-secret-hash",
    });
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);
    prismaMock.computer.create.mockResolvedValueOnce(computerRecord);

    await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
      name: "Front Desk PC",
    });

    const createArgs = prismaMock.computer.create.mock.calls[0][0];
    expect(typeof createArgs.data.deviceTokenHash).toBe("string");
    expect(createArgs.data.deviceTokenHash.length).toBeGreaterThan(0);
  });

  it("Task 388: register normalizes tenant code", async () => {
    comparePasswordMock.mockResolvedValueOnce(true);
    prismaMock.tenant.findFirst.mockResolvedValueOnce({
      id: tenantId,
      code: "CYBER01",
      status: "ACTIVE",
      computerRegistrationSecretHash: "stored-secret-hash",
    });
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);
    prismaMock.computer.create.mockResolvedValueOnce(computerRecord);

    await postRegister({
      tenantCode: "  cyber01  ",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
      name: "Front Desk PC",
    });

    expect(prismaMock.tenant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          code: "CYBER01",
        }),
      }),
    );
  });

  it("Task 389: register normalizes MAC address", async () => {
    comparePasswordMock.mockResolvedValueOnce(true);
    prismaMock.tenant.findFirst.mockResolvedValueOnce({
      id: tenantId,
      code: "CYBER01",
      status: "ACTIVE",
      computerRegistrationSecretHash: "stored-secret-hash",
    });
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);
    prismaMock.computer.create.mockResolvedValueOnce(computerRecord);

    await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "aa-bb-cc-dd-ee-ff",
      name: "Front Desk PC",
    });

    expect(prismaMock.computer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          macAddress: "AA:BB:CC:DD:EE:FF",
        }),
      }),
    );
  });

  it("Task 390: invalid tenant code returns 404 NOT_FOUND", async () => {
    prismaMock.tenant.findFirst.mockResolvedValueOnce(null);

    const response = await postRegister({
      tenantCode: "UNKNOWN",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
    });

    assertNotFound(response);
  });

  it("Task 391: inactive tenant returns final selected error mapping", async () => {
    prismaMock.tenant.findFirst.mockResolvedValueOnce({
      id: tenantId,
      code: "CYBER01",
      status: "SUSPENDED",
      computerRegistrationSecretHash: "stored-secret-hash",
    });

    const response = await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
    });

    assertNotFound(response);
  });

  it("Task 392: invalid registration secret returns 401 UNAUTHORIZED", async () => {
    comparePasswordMock.mockResolvedValueOnce(false);
    prismaMock.tenant.findFirst.mockResolvedValueOnce({
      id: tenantId,
      code: "CYBER01",
      status: "ACTIVE",
      computerRegistrationSecretHash: "stored-secret-hash",
    });

    const response = await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "invalid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
    });

    assertUnauthorized(response);
  });

  it("Task 393: duplicate (tenantId, macAddress) returns 409 CONFLICT", async () => {
    comparePasswordMock.mockResolvedValueOnce(true);
    prismaMock.tenant.findFirst.mockResolvedValueOnce({
      id: tenantId,
      code: "CYBER01",
      status: "ACTIVE",
      computerRegistrationSecretHash: "stored-secret-hash",
    });
    prismaMock.computer.findFirst.mockResolvedValueOnce({ id: "existing_computer" });

    const response = await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
    });

    assertConflict(response);
  });

  it("Task 394: register rejects crafted tenantId", async () => {
    const response = await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
      tenantId: "tenant_hacker",
    });

    assertValidationError(response);
  });

  it("Task 395: register rejects crafted deviceTokenHash", async () => {
    const response = await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
      deviceTokenHash: "crafted-hash",
    });

    assertValidationError(response);
  });

  it("Task 396: register rejects unknown fields", async () => {
    const response = await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
      unknownField: "forbidden",
    });

    assertValidationError(response);
  });

  it("Task 397: register rate-limit returns 429 TOO_MANY_REQUESTS when exceeded", async () => {
    comparePasswordMock.mockResolvedValue(true);
    prismaMock.tenant.findFirst.mockImplementation(async () => ({
      id: tenantId,
      code: "CYBER01",
      status: "ACTIVE",
      computerRegistrationSecretHash: "stored-secret-hash",
    }));
    prismaMock.computer.findFirst.mockImplementation(async () => null);
    let sequence = 0;
    prismaMock.computer.create.mockImplementation(async () => {
      sequence += 1;
      return {
        ...computerRecord,
        id: `computer_${sequence}`,
        macAddress: `AA:BB:CC:DD:EE:${String(sequence).padStart(2, "0")}`,
      };
    });

    const responses = await Promise.all(
      Array.from({ length: 6 }).map((_, index) =>
        postRegister(
          {
            tenantCode: "CYBER01",
            registrationSecret: "valid-secret",
            macAddress: `AA:BB:CC:DD:EE:${String(index + 1).padStart(2, "0")}`,
            name: "Front Desk PC",
          },
          "198.51.100.10",
        ),
      ),
    );

    const rateLimitedResponse = responses.find((response) => response.status === 429);
    expect(rateLimitedResponse).toBeDefined();
    expect(rateLimitedResponse?.body.success).toBe(false);
    expect(rateLimitedResponse?.body.error.code).toBe("TOO_MANY_REQUESTS");
  });
});

describe.sequential("Computers list/detail/update/reissue API tests (Task 398-430)", () => {
  const buildShopAdminToken = () => buildAccessToken({ role: "shop_admin", tenantId });

  it("Task 398: list returns only computers from caller tenant", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.count.mockResolvedValueOnce(1);
    prismaMock.computer.findMany.mockResolvedValueOnce([computerRecord]);

    const response = await request(app)
      .get("/api/computers")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(prismaMock.computer.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([expect.objectContaining({ tenantId })]),
        }),
      }),
    );
  });

  it("Task 399: list defaults to page=1 and pageSize=20", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.count.mockResolvedValueOnce(1);
    prismaMock.computer.findMany.mockResolvedValueOnce([computerRecord]);

    const response = await request(app)
      .get("/api/computers")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.page).toBe(1);
    expect(response.body.data.pageSize).toBe(20);
    expect(prismaMock.computer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
      }),
    );
  });

  it("Task 400: pageSize > 100 returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildShopAdminToken();
    const response = await request(app)
      .get("/api/computers?pageSize=101")
      .set("Authorization", `Bearer ${accessToken}`);
    assertValidationError(response);
  });

  it("Task 401: status filter works for ACTIVE", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.count.mockResolvedValueOnce(1);
    prismaMock.computer.findMany.mockResolvedValueOnce([computerRecord]);

    const response = await request(app)
      .get("/api/computers?status=ACTIVE")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(prismaMock.computer.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ tenantId }, { status: "ACTIVE" }, {}],
        },
      }),
    );
  });

  it("Task 402: status filter works for INACTIVE", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.count.mockResolvedValueOnce(0);
    prismaMock.computer.findMany.mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/computers?status=INACTIVE")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(prismaMock.computer.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ tenantId }, { status: "INACTIVE" }, {}],
        },
      }),
    );
  });

  it("Task 403: status filter works for BLOCKED", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.count.mockResolvedValueOnce(0);
    prismaMock.computer.findMany.mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/computers?status=BLOCKED")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(prismaMock.computer.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ tenantId }, { status: "BLOCKED" }, {}],
        },
      }),
    );
  });

  it("Task 404: invalid status returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildShopAdminToken();
    const response = await request(app)
      .get("/api/computers?status=DISABLED")
      .set("Authorization", `Bearer ${accessToken}`);
    assertValidationError(response);
  });

  it("Task 405: q searches over computer name", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.count.mockResolvedValueOnce(1);
    prismaMock.computer.findMany.mockResolvedValueOnce([computerRecord]);

    const response = await request(app)
      .get("/api/computers?q=front")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(prismaMock.computer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { tenantId },
            {},
            {
              OR: [
                { name: { contains: "front" } },
                { macAddress: { contains: "front" } },
              ],
            },
          ],
        },
      }),
    );
  });

  it("Task 406: q searches over MAC address", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.count.mockResolvedValueOnce(1);
    prismaMock.computer.findMany.mockResolvedValueOnce([computerRecord]);

    const response = await request(app)
      .get("/api/computers?q=AA:BB")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(prismaMock.computer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { tenantId },
            {},
            {
              OR: [
                { name: { contains: "AA:BB" } },
                { macAddress: { contains: "AA:BB" } },
              ],
            },
          ],
        },
      }),
    );
  });

  it("Task 407: sort allowlist works", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.count.mockResolvedValue(1);
    prismaMock.computer.findMany.mockResolvedValue([computerRecord]);

    await request(app)
      .get("/api/computers?sort=createdAt:asc")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(prismaMock.computer.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "asc" },
      }),
    );

    await request(app)
      .get("/api/computers?sort=name:desc")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(prismaMock.computer.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: { name: "desc" },
      }),
    );
  });

  it("Task 408: unknown query fields are rejected", async () => {
    const accessToken = await buildShopAdminToken();
    const response = await request(app)
      .get("/api/computers?tenantId=tenant_hacker")
      .set("Authorization", `Bearer ${accessToken}`);
    assertValidationError(response);
  });

  it("Task 409: list response does not expose deviceTokenHash", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.count.mockResolvedValueOnce(1);
    prismaMock.computer.findMany.mockResolvedValueOnce([
      { ...computerRecord, deviceTokenHash: "hidden_hash" },
    ]);

    const response = await request(app)
      .get("/api/computers")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items[0].deviceTokenHash).toBeUndefined();
  });

  it("Task 410: detail returns one computer in caller tenant", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.findFirst.mockResolvedValueOnce(computerRecord);

    const response = await request(app)
      .get(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(computerId);
  });

  it("Task 411: unknown computer id returns 404 NOT_FOUND", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);

    const response = await request(app)
      .get("/api/computers/computer_not_found")
      .set("Authorization", `Bearer ${accessToken}`);

    assertNotFound(response);
  });

  it("Task 412: cross-tenant computer id returns 404 NOT_FOUND", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);

    const response = await request(app)
      .get("/api/computers/computer_other_tenant")
      .set("Authorization", `Bearer ${accessToken}`);

    assertNotFound(response);
  });

  it("Task 413: detail response does not expose deviceTokenHash", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.findFirst.mockResolvedValueOnce({
      ...computerRecord,
      deviceTokenHash: "hidden_hash",
    });

    const response = await request(app)
      .get(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.deviceTokenHash).toBeUndefined();
  });

  it("Task 414: update accepts name", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.findFirst.mockResolvedValueOnce(computerRecord);
    prismaMock.computer.update.mockResolvedValueOnce({
      ...computerRecord,
      name: "Updated Name",
    });

    const response = await request(app)
      .patch(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Updated Name" });

    expect(response.status).toBe(200);
  });

  it("Task 415: update accepts status", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.findFirst.mockResolvedValueOnce(computerRecord);
    prismaMock.computer.update.mockResolvedValueOnce({
      ...computerRecord,
      status: "INACTIVE",
    });

    const response = await request(app)
      .patch(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(200);
  });

  it("Task 416: update accepts notes", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.findFirst.mockResolvedValueOnce(computerRecord);
    prismaMock.computer.update.mockResolvedValueOnce({
      ...computerRecord,
      notes: "Updated notes",
    });

    const response = await request(app)
      .patch(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ notes: "Updated notes" });

    expect(response.status).toBe(200);
  });

  it("Task 417: update accepts multiple allowed fields in one request", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.findFirst.mockResolvedValueOnce(computerRecord);
    prismaMock.computer.update.mockResolvedValueOnce({
      ...computerRecord,
      name: "Updated Name",
      status: "BLOCKED",
      notes: "Updated notes",
    });

    const response = await request(app)
      .patch(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Updated Name",
        status: "BLOCKED",
        notes: "Updated notes",
      });

    expect(response.status).toBe(200);
  });

  it("Task 418: empty patch body returns 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildShopAdminToken();
    const response = await request(app)
      .patch(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});
    assertValidationError(response);
  });

  it("Task 419: unknown patch fields return 400 VALIDATION_ERROR", async () => {
    const accessToken = await buildShopAdminToken();
    const response = await request(app)
      .patch(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ unknownField: "forbidden" });
    assertValidationError(response);
  });

  it("Task 420: patch rejects tenantId", async () => {
    const accessToken = await buildShopAdminToken();
    const response = await request(app)
      .patch(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tenantId: "tenant_hacker" });
    assertValidationError(response);
  });

  it("Task 421: patch rejects macAddress", async () => {
    const accessToken = await buildShopAdminToken();
    const response = await request(app)
      .patch(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ macAddress: "AA:BB:CC:DD:EE:FF" });
    assertValidationError(response);
  });

  it("Task 422: patch rejects deviceTokenHash", async () => {
    const accessToken = await buildShopAdminToken();
    const response = await request(app)
      .patch(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ deviceTokenHash: "crafted" });
    assertValidationError(response);
  });

  it("Task 423: patch rejects timestamps and lastSeenAt", async () => {
    const accessToken = await buildShopAdminToken();
    const response = await request(app)
      .patch(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        lastSeenAt: "2026-05-23T00:00:00.000Z",
        createdAt: "2026-05-23T00:00:00.000Z",
        updatedAt: "2026-05-23T00:00:00.000Z",
      });
    assertValidationError(response);
  });

  it("Task 424: cross-tenant update returns 404 NOT_FOUND", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);

    const response = await request(app)
      .patch("/api/computers/computer_other_tenant")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Updated Name" });

    assertNotFound(response);
  });

  it("Task 425: update response does not expose deviceTokenHash", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.findFirst.mockResolvedValueOnce(computerRecord);
    prismaMock.computer.update.mockResolvedValueOnce({
      ...computerRecord,
      name: "Updated Name",
      deviceTokenHash: "hidden_hash",
    });

    const response = await request(app)
      .patch(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Updated Name" });

    expect(response.status).toBe(200);
    expect(response.body.data.deviceTokenHash).toBeUndefined();
  });

  it("Task 426: reissue returns a new plain token once", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.computer.findFirst.mockResolvedValue(computerRecord);

    const first = await request(app)
      .post(`/api/computers/${computerId}/reissue-token`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});
    const second = await request(app)
      .post(`/api/computers/${computerId}/reissue-token`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(typeof first.body.data.deviceToken).toBe("string");
    expect(typeof second.body.data.deviceToken).toBe("string");
    expect(first.body.data.deviceToken).not.toBe(second.body.data.deviceToken);
  });

  it("Task 427: reissue replaces stored token hash", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.computer.findFirst.mockResolvedValueOnce(computerRecord);

    const response = await request(app)
      .post(`/api/computers/${computerId}/reissue-token`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(200);
    const updateManyArgs = prismaMock.computer.updateMany.mock.calls[0][0];
    expect(typeof updateManyArgs.data.deviceTokenHash).toBe("string");
    expect(updateManyArgs.data.deviceTokenHash.length).toBeGreaterThan(0);
    expect(updateManyArgs.data.deviceTokenHash).not.toBe(response.body.data.deviceToken);
  });

  it("Task 428: cross-tenant reissue returns 404 NOT_FOUND", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.updateMany.mockResolvedValueOnce({ count: 0 });

    const response = await request(app)
      .post("/api/computers/computer_other_tenant/reissue-token")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    assertNotFound(response);
  });

  it("Task 429: reissue response does not expose deviceTokenHash", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.computer.findFirst.mockResolvedValueOnce({
      ...computerRecord,
      deviceTokenHash: "hidden_hash",
    });

    const response = await request(app)
      .post(`/api/computers/${computerId}/reissue-token`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.data.computer.deviceTokenHash).toBeUndefined();
  });

  it("Task 430: reissue logs computer.token.reissued", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.computer.findFirst.mockResolvedValueOnce(computerRecord);

    const response = await request(app)
      .post(`/api/computers/${computerId}/reissue-token`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ reason: "Reinstall client app" });

    expect(response.status).toBe(200);
    const eventCall = loggerInfoSpy.mock.calls.find(
      (call) => call[0]?.event === "computer.token.reissued",
    );
    expect(eventCall).toBeDefined();
  });
});

describe.sequential("Computers security and logging tests (Task 431-444)", () => {
  const buildShopAdminToken = () => buildAccessToken({ role: "shop_admin", tenantId });

  it("Task 431: register logs never include registration secret", async () => {
    const leakedSecret = "DoNotLeakThisSecret";
    comparePasswordMock.mockResolvedValueOnce(false);
    prismaMock.tenant.findFirst.mockResolvedValueOnce({
      id: tenantId,
      code: "CYBER01",
      status: "ACTIVE",
      computerRegistrationSecretHash: "stored-secret-hash",
    });

    const response = await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: leakedSecret,
      macAddress: "AA:BB:CC:DD:EE:FF",
    });

    expect(response.status).toBe(401);
    const serializedLogs = JSON.stringify({
      info: loggerInfoSpy.mock.calls,
      warn: loggerWarnSpy.mock.calls,
      error: loggerErrorSpy.mock.calls,
    });
    expect(serializedLogs).not.toContain(leakedSecret);
  });

  it("Task 432: register logs never include plain device token", async () => {
    comparePasswordMock.mockResolvedValueOnce(true);
    prismaMock.tenant.findFirst.mockResolvedValueOnce({
      id: tenantId,
      code: "CYBER01",
      status: "ACTIVE",
      computerRegistrationSecretHash: "stored-secret-hash",
    });
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);
    prismaMock.computer.create.mockResolvedValueOnce(computerRecord);

    const response = await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
    });

    expect(response.status).toBe(200);
    const plainToken = response.body.data.deviceToken as string;
    const serializedLogs = JSON.stringify({
      info: loggerInfoSpy.mock.calls,
      warn: loggerWarnSpy.mock.calls,
      error: loggerErrorSpy.mock.calls,
    });
    expect(serializedLogs).not.toContain(plainToken);
  });

  it("Task 433: register logs never include token hash", async () => {
    comparePasswordMock.mockResolvedValueOnce(true);
    prismaMock.tenant.findFirst.mockResolvedValueOnce({
      id: tenantId,
      code: "CYBER01",
      status: "ACTIVE",
      computerRegistrationSecretHash: "stored-secret-hash",
    });
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);
    prismaMock.computer.create.mockResolvedValueOnce(computerRecord);

    const response = await postRegister({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
    });
    expect(response.status).toBe(200);

    const createArgs = prismaMock.computer.create.mock.calls[0][0];
    const tokenHash = createArgs.data.deviceTokenHash as string;
    const serializedLogs = JSON.stringify({
      info: loggerInfoSpy.mock.calls,
      warn: loggerWarnSpy.mock.calls,
      error: loggerErrorSpy.mock.calls,
    });
    expect(serializedLogs).not.toContain(tokenHash);
  });

  it("Task 434: reissue logs never include plain device token", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.computer.findFirst.mockResolvedValueOnce(computerRecord);

    const response = await request(app)
      .post(`/api/computers/${computerId}/reissue-token`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ reason: "Reinstall client" });

    expect(response.status).toBe(200);
    const plainToken = response.body.data.deviceToken as string;
    const serializedLogs = JSON.stringify({
      info: loggerInfoSpy.mock.calls,
      warn: loggerWarnSpy.mock.calls,
      error: loggerErrorSpy.mock.calls,
    });
    expect(serializedLogs).not.toContain(plainToken);
  });

  it("Task 435: reissue logs never include token hash", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.computer.findFirst.mockResolvedValueOnce(computerRecord);

    const response = await request(app)
      .post(`/api/computers/${computerId}/reissue-token`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ reason: "Reinstall client" });
    expect(response.status).toBe(200);

    const updateManyArgs = prismaMock.computer.updateMany.mock.calls[0][0];
    const tokenHash = updateManyArgs.data.deviceTokenHash as string;
    const serializedLogs = JSON.stringify({
      info: loggerInfoSpy.mock.calls,
      warn: loggerWarnSpy.mock.calls,
      error: loggerErrorSpy.mock.calls,
    });
    expect(serializedLogs).not.toContain(tokenHash);
  });

  it("Task 436: computers logs never include authorization headers", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.count.mockResolvedValueOnce(0);
    prismaMock.computer.findMany.mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/computers")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(200);

    const [payload] = loggerInfoSpy.mock.calls.at(-1) ?? [];
    expect(payload.authorization).toBeUndefined();
    expect(payload.headers).toBeUndefined();
  });

  it("Task 437: computers logs never include raw request bodies", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.findFirst.mockResolvedValueOnce(computerRecord);
    prismaMock.computer.update.mockResolvedValueOnce({
      ...computerRecord,
      name: "Updated Name",
    });

    const response = await request(app)
      .patch(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Updated Name" });
    expect(response.status).toBe(200);

    const [payload] = loggerInfoSpy.mock.calls.at(-1) ?? [];
    expect(payload.body).toBeUndefined();
    expect(payload.rawBody).toBeUndefined();
    expect(payload.requestBody).toBeUndefined();
    expect(payload.req).toBeUndefined();
  });

  it("Task 438: tenant isolation remains enforced with crafted params", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.findFirst.mockResolvedValueOnce(computerRecord);

    const response = await request(app)
      .get(`/api/computers/${computerId}?tenantId=tenant_hacker`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(200);

    expect(prismaMock.computer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: computerId,
          tenantId,
        },
      }),
    );
  });

  it("Task 439: tenant isolation remains enforced with crafted body fields", async () => {
    const accessToken = await buildShopAdminToken();

    const response = await request(app)
      .patch(`/api/computers/${computerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Updated Name",
        tenantId: "tenant_hacker",
      });

    assertValidationError(response);
    expect(prismaMock.computer.update).not.toHaveBeenCalled();
  });

  it("Task 440: SQL-like q payload is treated as literal search input", async () => {
    const accessToken = await buildShopAdminToken();
    const payload = "' OR 1=1 --";
    prismaMock.computer.count.mockResolvedValueOnce(0);
    prismaMock.computer.findMany.mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/computers")
      .query({ q: payload })
      .set("Authorization", `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect(prismaMock.computer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { tenantId },
            {},
            {
              OR: [
                { name: { contains: payload } },
                { macAddress: { contains: payload } },
              ],
            },
          ],
        },
      }),
    );
  });

  it("Task 441: SQL-like id does not resolve an existing computer", async () => {
    const accessToken = await buildShopAdminToken();
    prismaMock.computer.findFirst.mockResolvedValueOnce(null);
    const injectedId = encodeURIComponent(`${computerId}' OR '1'='1`);

    const response = await request(app)
      .get(`/api/computers/${injectedId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    assertNotFound(response);
  });

  it("Task 442: duplicated query parameters are rejected", async () => {
    const accessToken = await buildShopAdminToken();
    const response = await request(app)
      .get("/api/computers?page=1&page=2")
      .set("Authorization", `Bearer ${accessToken}`);
    assertValidationError(response);
  });

  it("Task 443: lowercase status cannot bypass enum validation", async () => {
    const accessToken = await buildShopAdminToken();
    const response = await request(app)
      .get("/api/computers?status=active")
      .set("Authorization", `Bearer ${accessToken}`);
    assertValidationError(response);
  });

  it("Task 444: MAC address alone cannot authenticate admin endpoints", async () => {
    const response = await request(app)
      .get("/api/computers")
      .set("x-mac-address", "AA:BB:CC:DD:EE:FF");
    assertUnauthorized(response);
  });
});

