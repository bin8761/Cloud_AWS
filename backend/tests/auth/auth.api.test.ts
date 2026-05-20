import type { Express } from "express";
import { createHmac } from "node:crypto";
import {
  TenantStatus,
  UserRole,
  UserStatus,
  VerificationPurpose,
  VerificationTargetType,
} from "@prisma/client";
import { SignJWT } from "jose";
import type { Response as SupertestResponse } from "supertest";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type TenantRecord = {
  id: string;
  code: string;
  name: string;
  status: TenantStatus;
};

type UserRecord = {
  id: string;
  tenantId: string | null;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: Date | null;
};

type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
};

type VerificationCodeRecord = {
  id: string;
  targetType: VerificationTargetType;
  target: string;
  purpose: VerificationPurpose;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
  lastSentAt: Date;
};

type PendingTenantRegistrationRecord = {
  id: string;
  verificationCodeId: string;
  tenantName: string;
  tenantCode: string;
  adminFullName: string;
  adminEmail: string;
  adminPasswordHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

type PrismaState = {
  tenants: Map<string, TenantRecord>;
  users: Map<string, UserRecord>;
  refreshTokens: Map<string, RefreshTokenRecord>;
  verificationCodes: Map<string, VerificationCodeRecord>;
  pendingRegistrations: Map<string, PendingTenantRegistrationRecord>;
  reset: () => void;
};

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

const createPrismaMock = (): { prismaMock: any; prismaState: PrismaState } => {
  const tenants = new Map<string, TenantRecord>();
  const users = new Map<string, UserRecord>();
  const refreshTokens = new Map<string, RefreshTokenRecord>();
  const verificationCodes = new Map<string, VerificationCodeRecord>();
  const pendingRegistrations = new Map<string, PendingTenantRegistrationRecord>();

  let sequence = 1;

  const nextId = (prefix: string): string => {
    const id = `${prefix}_${sequence}`;
    sequence += 1;
    return id;
  };

  const findTenantByCode = (code: string): TenantRecord | undefined => {
    for (const tenant of tenants.values()) {
      if (tenant.code === code) {
        return tenant;
      }
    }

    return undefined;
  };

  const findUserByEmail = (email: string): UserRecord | undefined => {
    for (const user of users.values()) {
      if (user.email === email) {
        return user;
      }
    }

    return undefined;
  };

  const findRefreshTokenByHash = (tokenHash: string): RefreshTokenRecord | undefined => {
    for (const refreshToken of refreshTokens.values()) {
      if (refreshToken.tokenHash === tokenHash) {
        return refreshToken;
      }
    }

    return undefined;
  };

  const tenantModel = {
    findUnique: async (args: any): Promise<any> => {
      const where = args?.where ?? {};
      if (typeof where.id === "string") {
        return tenants.get(where.id) ?? null;
      }

      if (typeof where.code === "string") {
        return findTenantByCode(where.code) ?? null;
      }

      return null;
    },
    create: async (args: any): Promise<any> => {
      const data = args?.data ?? {};
      const tenant: TenantRecord = {
        id: nextId("tenant"),
        code: data.code,
        name: data.name,
        status: data.status,
      };

      tenants.set(tenant.id, tenant);
      return tenant;
    },
  };

  const userModel = {
    findUnique: async (args: any): Promise<any> => {
      const where = args?.where ?? {};
      let user: UserRecord | undefined;

      if (typeof where.id === "string") {
        user = users.get(where.id);
      }

      if (!user && typeof where.email === "string") {
        user = findUserByEmail(where.email);
      }

      if (!user) {
        return null;
      }

      const tenant = user.tenantId ? tenants.get(user.tenantId) ?? null : null;
      return {
        ...user,
        tenant,
      };
    },
    create: async (args: any): Promise<any> => {
      const data = args?.data ?? {};
      const user: UserRecord = {
        id: nextId("user"),
        tenantId: data.tenantId ?? null,
        email: data.email,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        role: data.role,
        status: data.status,
        lastLoginAt: null,
      };

      users.set(user.id, user);
      return {
        ...user,
        tenant: user.tenantId ? tenants.get(user.tenantId) ?? null : null,
      };
    },
    update: async (args: any): Promise<any> => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      const user = users.get(where.id);

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      const updated: UserRecord = {
        ...user,
        ...data,
      };
      users.set(updated.id, updated);

      return {
        ...updated,
        tenant: updated.tenantId ? tenants.get(updated.tenantId) ?? null : null,
      };
    },
  };

  const verificationCodeModel = {
    create: async (args: any): Promise<any> => {
      const data = args?.data ?? {};
      const verificationCode: VerificationCodeRecord = {
        id: nextId("verification"),
        targetType: data.targetType,
        target: data.target,
        purpose: data.purpose,
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
        consumedAt: data.consumedAt ?? null,
        attemptCount: data.attemptCount ?? 0,
        lastSentAt: data.lastSentAt,
      };

      verificationCodes.set(verificationCode.id, verificationCode);
      return verificationCode;
    },
    update: async (args: any): Promise<any> => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      const verificationCode = verificationCodes.get(where.id);

      if (!verificationCode) {
        throw new Error("VERIFICATION_CODE_NOT_FOUND");
      }

      const updated: VerificationCodeRecord = {
        ...verificationCode,
        ...data,
      };
      verificationCodes.set(updated.id, updated);
      return updated;
    },
    updateMany: async (args: any): Promise<{ count: number }> => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      const verificationCode = verificationCodes.get(where.id);

      if (!verificationCode) {
        return { count: 0 };
      }

      if (where.consumedAt === null && verificationCode.consumedAt !== null) {
        return { count: 0 };
      }

      const incrementValue = data?.attemptCount?.increment;
      const updated: VerificationCodeRecord = {
        ...verificationCode,
        attemptCount:
          typeof incrementValue === "number"
            ? verificationCode.attemptCount + incrementValue
            : verificationCode.attemptCount,
      };
      verificationCodes.set(updated.id, updated);

      return { count: 1 };
    },
  };

  const pendingTenantRegistrationModel = {
    findUnique: async (args: any): Promise<any> => {
      const where = args?.where ?? {};
      const pendingRegistration = pendingRegistrations.get(where.id);

      if (!pendingRegistration) {
        return null;
      }

      const verificationCode =
        verificationCodes.get(pendingRegistration.verificationCodeId) ?? null;

      return {
        ...pendingRegistration,
        verificationCode,
      };
    },
    create: async (args: any): Promise<any> => {
      const data = args?.data ?? {};
      const pendingRegistration: PendingTenantRegistrationRecord = {
        id: nextId("registration"),
        verificationCodeId: data.verificationCodeId,
        tenantName: data.tenantName,
        tenantCode: data.tenantCode,
        adminFullName: data.adminFullName,
        adminEmail: data.adminEmail,
        adminPasswordHash: data.adminPasswordHash,
        expiresAt: data.expiresAt,
        consumedAt: data.consumedAt ?? null,
      };

      pendingRegistrations.set(pendingRegistration.id, pendingRegistration);
      return pendingRegistration;
    },
    update: async (args: any): Promise<any> => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      const pendingRegistration = pendingRegistrations.get(where.id);

      if (!pendingRegistration) {
        throw new Error("PENDING_REGISTRATION_NOT_FOUND");
      }

      const updated: PendingTenantRegistrationRecord = {
        ...pendingRegistration,
        ...data,
      };
      pendingRegistrations.set(updated.id, updated);

      return updated;
    },
  };

  const refreshTokenModel = {
    findUnique: async (args: any): Promise<any> => {
      const where = args?.where ?? {};
      let refreshToken: RefreshTokenRecord | undefined;

      if (typeof where.id === "string") {
        refreshToken = refreshTokens.get(where.id);
      }

      if (!refreshToken && typeof where.tokenHash === "string") {
        refreshToken = findRefreshTokenByHash(where.tokenHash);
      }

      if (!refreshToken) {
        return null;
      }

      const user = users.get(refreshToken.userId);
      const tenant = user?.tenantId ? tenants.get(user.tenantId) ?? null : null;

      return {
        ...refreshToken,
        user: user
          ? {
              ...user,
              tenant,
            }
          : null,
      };
    },
    create: async (args: any): Promise<any> => {
      const data = args?.data ?? {};
      const refreshToken: RefreshTokenRecord = {
        id: nextId("refresh"),
        userId: data.userId,
        tokenHash: data.tokenHash,
        familyId: data.familyId,
        expiresAt: data.expiresAt,
        revokedAt: data.revokedAt ?? null,
        replacedByTokenId: data.replacedByTokenId ?? null,
      };

      refreshTokens.set(refreshToken.id, refreshToken);
      return refreshToken;
    },
    update: async (args: any): Promise<any> => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      const refreshToken = refreshTokens.get(where.id);

      if (!refreshToken) {
        throw new Error("REFRESH_TOKEN_NOT_FOUND");
      }

      const updated: RefreshTokenRecord = {
        ...refreshToken,
        ...data,
      };
      refreshTokens.set(updated.id, updated);

      return updated;
    },
    updateMany: async (args: any): Promise<{ count: number }> => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      const refreshToken = refreshTokens.get(where.id);

      if (!refreshToken) {
        return { count: 0 };
      }

      if (where.revokedAt === null && refreshToken.revokedAt !== null) {
        return { count: 0 };
      }

      const updated: RefreshTokenRecord = {
        ...refreshToken,
        ...data,
      };
      refreshTokens.set(updated.id, updated);

      return { count: 1 };
    },
  };

  const transactionClient = {
    tenant: {
      create: tenantModel.create,
    },
    user: {
      create: userModel.create,
    },
    verificationCode: {
      create: verificationCodeModel.create,
      update: verificationCodeModel.update,
    },
    pendingTenantRegistration: {
      create: pendingTenantRegistrationModel.create,
      update: pendingTenantRegistrationModel.update,
    },
    refreshToken: {
      create: refreshTokenModel.create,
      update: refreshTokenModel.update,
    },
  };

  const prismaMock = {
    tenant: tenantModel,
    user: userModel,
    refreshToken: refreshTokenModel,
    verificationCode: verificationCodeModel,
    pendingTenantRegistration: pendingTenantRegistrationModel,
    $transaction: async <T>(callback: (transaction: any) => Promise<T>): Promise<T> => {
      return callback(transactionClient);
    },
  };

  const prismaState: PrismaState = {
    tenants,
    users,
    refreshTokens,
    verificationCodes,
    pendingRegistrations,
    reset: () => {
      tenants.clear();
      users.clear();
      refreshTokens.clear();
      verificationCodes.clear();
      pendingRegistrations.clear();
    },
  };

  return {
    prismaMock,
    prismaState,
  };
};

const buildDifferentVerificationCode = (verificationCode: string): string => {
  return verificationCode === "000000" ? "999999" : "000000";
};

const assertNoSecrets = (payload: unknown): void => {
  const serializedPayload = JSON.stringify(payload);
  expect(serializedPayload).not.toContain("passwordHash");
  expect(serializedPayload).not.toContain("tokenHash");
  expect(serializedPayload).not.toContain("codeHash");
};

setTestEnv();

const sendVerificationCodeSpy = vi.fn(async () => undefined);
const loggerInfoSpy = vi.fn(() => undefined);
const loggerWarnSpy = vi.fn(() => undefined);
const loggerErrorSpy = vi.fn(() => undefined);
const { prismaMock, prismaState } = createPrismaMock();

let app: Express;
let uniqueCounter = 1;

beforeAll(async () => {
  vi.resetModules();

  vi.doMock("../../src/shared/email/email-sender.factory", () => ({
    createEmailSender: () => ({
      sendVerificationCode: sendVerificationCodeSpy,
    }),
  }));

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
  prismaState.reset();
  sendVerificationCodeSpy.mockClear();
  loggerInfoSpy.mockClear();
  loggerWarnSpy.mockClear();
  loggerErrorSpy.mockClear();
});

type RegisterTenantPayload = {
  tenantName: string;
  tenantCode: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
};

const createRegisterTenantPayload = (
  overrides: Partial<RegisterTenantPayload> = {},
): RegisterTenantPayload => {
  const suffix = uniqueCounter;
  uniqueCounter += 1;

  return {
    tenantName: `Tenant ${suffix}`,
    tenantCode: `TENANT_${suffix}`,
    adminFullName: `Admin ${suffix}`,
    adminEmail: `admin${suffix}@example.com`,
    adminPassword: "Password1!",
    ...overrides,
  };
};

const registerTenantAndReadCode = async (
  payload: RegisterTenantPayload,
): Promise<{
  response: SupertestResponse;
  registrationId: string;
  verificationCode: string;
}> => {
  const callIndex = sendVerificationCodeSpy.mock.calls.length;
  const response = await request(app).post("/api/auth/register-tenant").send(payload);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const registrationId = response.body.data.registrationId as string;
  const sendCall = sendVerificationCodeSpy.mock.calls[callIndex];
  const verificationCode = sendCall?.[1] as string | undefined;

  expect(typeof verificationCode).toBe("string");

  return {
    response,
    registrationId,
    verificationCode: verificationCode ?? "",
  };
};

const verifyTenantRegistration = async (
  registrationId: string,
  verificationCode: string,
): Promise<SupertestResponse> => {
  return request(app).post("/api/auth/register-tenant/verify").send({
    registrationId,
    verificationCode,
  });
};

const getSerializedLoggerCalls = (): string => {
  return JSON.stringify({
    info: loggerInfoSpy.mock.calls,
    warn: loggerWarnSpy.mock.calls,
    error: loggerErrorSpy.mock.calls,
  });
};

const getLastWarnPayload = (): Record<string, unknown> => {
  const calls = loggerWarnSpy.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return (calls[calls.length - 1]?.[0] ?? {}) as Record<string, unknown>;
};

const nextUniqueEmail = (prefix: string): string => {
  const suffix = uniqueCounter;
  uniqueCounter += 1;
  return `${prefix}${suffix}@example.com`;
};

describe.sequential("Auth API tests (Task 310->327)", () => {
  it("Task 310: POST /api/auth/register-tenant success", async () => {
    const payload = createRegisterTenantPayload();
    const response = await request(app).post("/api/auth/register-tenant").send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      registrationId: expect.any(String),
      email: payload.adminEmail.toLowerCase(),
      expiresInSeconds: expect.any(Number),
      resendAfterSeconds: expect.any(Number),
    });
  });

  it("Task 311: register-tenant calls mock EmailSender", async () => {
    const payload = createRegisterTenantPayload({ adminEmail: "ADMIN+X@Example.COM" });
    const response = await request(app).post("/api/auth/register-tenant").send(payload);

    expect(response.status).toBe(200);
    expect(sendVerificationCodeSpy).toHaveBeenCalledTimes(1);
    expect(sendVerificationCodeSpy).toHaveBeenCalledWith(
      "admin+x@example.com",
      expect.any(String),
      VerificationPurpose.REGISTER_TENANT,
    );
  });

  it("Task 343: register-tenant calls sendVerificationCode with correct email", async () => {
    const payload = createRegisterTenantPayload({ adminEmail: "Upper+Email@Example.COM" });
    const response = await request(app).post("/api/auth/register-tenant").send(payload);

    expect(response.status).toBe(200);
    expect(sendVerificationCodeSpy).toHaveBeenCalledTimes(1);

    const firstCall = sendVerificationCodeSpy.mock.calls[0];
    expect(firstCall?.[0]).toBe("upper+email@example.com");
  });

  it("Task 344: register-tenant calls sendVerificationCode with REGISTER_TENANT purpose", async () => {
    const payload = createRegisterTenantPayload();
    const response = await request(app).post("/api/auth/register-tenant").send(payload);

    expect(response.status).toBe(200);
    expect(sendVerificationCodeSpy).toHaveBeenCalledTimes(1);

    const firstCall = sendVerificationCodeSpy.mock.calls[0];
    expect(firstCall?.[2]).toBe(VerificationPurpose.REGISTER_TENANT);
  });

  it("Task 312: invalid register-tenant payload", async () => {
    const payload = createRegisterTenantPayload({ adminPassword: "weak" });
    const response = await request(app).post("/api/auth/register-tenant").send(payload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("Task 313: duplicate tenant code", async () => {
    const first = createRegisterTenantPayload({ tenantCode: "DUP_CODE" });
    const second = createRegisterTenantPayload({ tenantCode: "DUP_CODE" });

    const registered = await registerTenantAndReadCode(first);
    const verifyResponse = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(verifyResponse.status).toBe(200);

    const response = await request(app).post("/api/auth/register-tenant").send(second);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("CONFLICT");
    expect(response.body.error.details).toMatchObject({
      field: "tenantCode",
    });
  });

  it("Task 314: duplicate admin email", async () => {
    const sharedEmail = "duplicate-admin@example.com";
    const first = createRegisterTenantPayload({ adminEmail: sharedEmail });
    const second = createRegisterTenantPayload({ adminEmail: sharedEmail });

    const registered = await registerTenantAndReadCode(first);
    const verifyResponse = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(verifyResponse.status).toBe(200);

    const response = await request(app).post("/api/auth/register-tenant").send(second);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("CONFLICT");
    expect(response.body.error.details).toMatchObject({
      field: "adminEmail",
    });
  });

  it("Task 315: POST /api/auth/register-tenant/verify success", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);

    const response = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      tenant: {
        id: expect.any(String),
        code: payload.tenantCode,
        name: payload.tenantName,
        status: TenantStatus.ACTIVE,
      },
      user: {
        id: expect.any(String),
        email: payload.adminEmail.toLowerCase(),
        fullName: payload.adminFullName,
        role: "shop_admin",
        tenantId: expect.any(String),
      },
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
  });

  it("Task 316: wrong verification code", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);

    const wrongCode = buildDifferentVerificationCode(registered.verificationCode);
    const response = await verifyTenantRegistration(registered.registrationId, wrongCode);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("Task 317: expired verification code", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);

    const pendingRegistration = prismaState.pendingRegistrations.get(
      registered.registrationId,
    );
    expect(pendingRegistration).toBeDefined();

    const verificationCode = pendingRegistration
      ? prismaState.verificationCodes.get(pendingRegistration.verificationCodeId)
      : undefined;
    expect(verificationCode).toBeDefined();

    if (verificationCode) {
      verificationCode.expiresAt = new Date(Date.now() - 1_000);
      prismaState.verificationCodes.set(verificationCode.id, verificationCode);
    }

    const response = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("Task 318: login after registration verification", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);
    const verifyResponse = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(verifyResponse.status).toBe(200);

    const response = await request(app).post("/api/auth/login").send({
      email: payload.adminEmail,
      password: payload.adminPassword,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      user: {
        id: expect.any(String),
        email: payload.adminEmail.toLowerCase(),
        role: "shop_admin",
      },
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
  });

  it("Task 319: invalid login credentials", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);
    const verifyResponse = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(verifyResponse.status).toBe(200);

    const response = await request(app).post("/api/auth/login").send({
      email: payload.adminEmail,
      password: "WrongPassword1!",
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("Task 320: GET /api/auth/me with valid access token", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);
    const verifyResponse = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(verifyResponse.status).toBe(200);

    const accessToken = verifyResponse.body.data.accessToken as string;
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      user: {
        id: expect.any(String),
        email: payload.adminEmail.toLowerCase(),
        role: "shop_admin",
      },
      tenant: {
        id: expect.any(String),
        code: payload.tenantCode,
        name: payload.tenantName,
        status: TenantStatus.ACTIVE,
      },
    });
  });

  it("Task 321: GET /api/auth/me without token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("Task 322: GET /api/auth/me with malformed token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer malformed.token.value");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("Task 323: POST /api/auth/refresh with valid refresh token", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);
    const verifyResponse = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(verifyResponse.status).toBe(200);

    const oldRefreshToken = verifyResponse.body.data.refreshToken as string;
    const response = await request(app).post("/api/auth/refresh").send({
      refreshToken: oldRefreshToken,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).not.toBe(oldRefreshToken);
  });

  it("Task 324: refresh with revoked refresh token", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);
    const verifyResponse = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(verifyResponse.status).toBe(200);

    const oldRefreshToken = verifyResponse.body.data.refreshToken as string;
    const firstRefresh = await request(app).post("/api/auth/refresh").send({
      refreshToken: oldRefreshToken,
    });

    expect(firstRefresh.status).toBe(200);

    const secondRefresh = await request(app).post("/api/auth/refresh").send({
      refreshToken: oldRefreshToken,
    });

    expect(secondRefresh.status).toBe(401);
    expect(secondRefresh.body.success).toBe(false);
    expect(secondRefresh.body.error.code).toBe("UNAUTHORIZED");
  });

  it("Task 325: POST /api/auth/logout idempotency", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);
    const verifyResponse = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(verifyResponse.status).toBe(200);

    const refreshToken = verifyResponse.body.data.refreshToken as string;
    const firstLogout = await request(app).post("/api/auth/logout").send({
      refreshToken,
    });
    const secondLogout = await request(app).post("/api/auth/logout").send({
      refreshToken,
    });

    expect(firstLogout.status).toBe(200);
    expect(secondLogout.status).toBe(200);
    expect(firstLogout.body.data).toEqual({ loggedOut: true });
    expect(secondLogout.body.data).toEqual({ loggedOut: true });
  });

  it("Task 326: responses exclude passwordHash/tokenHash/codeHash", async () => {
    const payload = createRegisterTenantPayload();

    const registerResponse = await request(app).post("/api/auth/register-tenant").send(payload);
    expect(registerResponse.status).toBe(200);
    assertNoSecrets(registerResponse.body);

    const registrationId = registerResponse.body.data.registrationId as string;
    const verificationCode = sendVerificationCodeSpy.mock.calls[0]?.[1] as string;

    const verifyResponse = await verifyTenantRegistration(registrationId, verificationCode);
    expect(verifyResponse.status).toBe(200);
    assertNoSecrets(verifyResponse.body);

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: payload.adminEmail,
      password: payload.adminPassword,
    });
    expect(loginResponse.status).toBe(200);
    assertNoSecrets(loginResponse.body);

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${verifyResponse.body.data.accessToken as string}`);
    expect(meResponse.status).toBe(200);
    assertNoSecrets(meResponse.body);
  });

  it("Task 327: auth route rate limits return RATE_LIMITED", async () => {
    const payload = createRegisterTenantPayload({
      adminEmail: "ratelimit@example.com",
      tenantCode: "RATE_LIMIT_TENANT",
    });

    const responses = await Promise.all([
      request(app).post("/api/auth/register-tenant").send(payload),
      request(app).post("/api/auth/register-tenant").send(payload),
      request(app).post("/api/auth/register-tenant").send(payload),
      request(app).post("/api/auth/register-tenant").send(payload),
    ]);
    const successResponses = responses.filter((response) => response.status === 200);
    const rateLimitedResponses = responses.filter((response) => response.status === 429);

    expect(successResponses).toHaveLength(3);
    expect(rateLimitedResponses).toHaveLength(1);
    expect(rateLimitedResponses[0].body.success).toBe(false);
    expect(rateLimitedResponses[0].body.error.code).toBe("RATE_LIMITED");
  });
});


describe.sequential("Auth security/logging tests (Task 328->341)", () => {
  it("Task 328: login failure does not reveal whether email exists", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);
    const verifyResponse = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(verifyResponse.status).toBe(200);

    const wrongPasswordResponse = await request(app).post("/api/auth/login").send({
      email: payload.adminEmail,
      password: "WrongPassword1!",
    });
    const unknownEmailResponse = await request(app).post("/api/auth/login").send({
      email: nextUniqueEmail("missing-user-"),
      password: "WrongPassword1!",
    });

    expect(wrongPasswordResponse.status).toBe(401);
    expect(unknownEmailResponse.status).toBe(401);
    expect(wrongPasswordResponse.body.error.code).toBe("UNAUTHORIZED");
    expect(unknownEmailResponse.body.error.code).toBe("UNAUTHORIZED");
    expect(wrongPasswordResponse.body.error.message).toBe(
      unknownEmailResponse.body.error.message,
    );
  });

  it("Task 329: verification failure uses generic invalid-or-expired message", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);

    const wrongCodeResponse = await verifyTenantRegistration(
      registered.registrationId,
      buildDifferentVerificationCode(registered.verificationCode),
    );
    const missingRegistrationResponse = await verifyTenantRegistration(
      "missing-registration-id",
      "123456",
    );

    expect(wrongCodeResponse.status).toBe(401);
    expect(missingRegistrationResponse.status).toBe(401);
    expect(wrongCodeResponse.body.error.code).toBe("UNAUTHORIZED");
    expect(missingRegistrationResponse.body.error.code).toBe("UNAUTHORIZED");
    expect(wrongCodeResponse.body.error.message).toBe(
      "The verification code is invalid or expired.",
    );
    expect(missingRegistrationResponse.body.error.message).toBe(
      wrongCodeResponse.body.error.message,
    );
  });

  it("Task 330: expired access token is rejected", async () => {
    const { env } = await import("../../src/config/env");
    const expiredToken = await new SignJWT({
      sub: "expired-user-id",
      tenantId: null,
      role: "shop_admin",
      tokenType: "access",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(env.auth.jwtAccessSecret));

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("Task 331: revoked refresh token cannot be reused", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);
    const verifyResponse = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(verifyResponse.status).toBe(200);

    const oldRefreshToken = verifyResponse.body.data.refreshToken as string;
    const firstRefresh = await request(app).post("/api/auth/refresh").send({
      refreshToken: oldRefreshToken,
    });
    const secondRefresh = await request(app).post("/api/auth/refresh").send({
      refreshToken: oldRefreshToken,
    });

    expect(firstRefresh.status).toBe(200);
    expect(secondRefresh.status).toBe(401);
    expect(secondRefresh.body.error.code).toBe("UNAUTHORIZED");
    expect(secondRefresh.body.error.message).toBe(
      "The refresh token is invalid or expired.",
    );
  });

  it("Task 332: consumed verification code cannot be reused", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);

    const firstVerify = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );
    const secondVerify = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(firstVerify.status).toBe(200);
    expect(secondVerify.status).toBe(401);
    expect(secondVerify.body.error.code).toBe("UNAUTHORIZED");
    expect(secondVerify.body.error.message).toBe(
      "The verification code is invalid or expired.",
    );
  });

  it("Task 333: tenant registration cannot create super_admin", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);

    const verifyResponse = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.data.user.role).toBe("shop_admin");
    expect(verifyResponse.body.data.user.role).not.toBe("super_admin");
  });

  it("Task 334: tenant registration cannot create staff", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);

    const verifyResponse = await verifyTenantRegistration(
      registered.registrationId,
      registered.verificationCode,
    );

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.data.user.role).toBe("shop_admin");
    expect(verifyResponse.body.data.user.role).not.toBe("staff");
  });

  it("Task 335: auth failure logs include requestId", async () => {
    const requestId = "req-login-failed-001";
    const response = await request(app)
      .post("/api/auth/login")
      .set("x-request-id", requestId)
      .send({
        email: nextUniqueEmail("missing-log-"),
        password: "WrongPassword1!",
      });

    expect(response.status).toBe(401);

    const warnPayload = getLastWarnPayload();
    expect(warnPayload.event).toBe("login_failed");
    expect(warnPayload.requestId).toBe(requestId);
  });

  it("Task 336: auth logs use maskedEmail or emailHash", async () => {
    const loginEmail = nextUniqueEmail("masked-email-");
    const response = await request(app).post("/api/auth/login").send({
      email: loginEmail,
      password: "WrongPassword1!",
    });

    expect(response.status).toBe(401);

    const warnPayload = getLastWarnPayload();
    expect(warnPayload.event).toBe("login_failed");
    expect(warnPayload.maskedEmail).toEqual(expect.any(String));
    expect(warnPayload.emailHash).toEqual(expect.any(String));
    expect(warnPayload.maskedEmail).not.toBe(loginEmail);
    expect(warnPayload.emailHash).not.toBe(loginEmail);
  });

  it("Task 337: logs do not include raw password", async () => {
    const leakedPassword = "LeakMe123!";
    const response = await request(app).post("/api/auth/login").send({
      email: nextUniqueEmail("no-password-leak-"),
      password: leakedPassword,
    });

    expect(response.status).toBe(401);

    const serializedLogs = getSerializedLoggerCalls();
    expect(serializedLogs).not.toContain(leakedPassword);
  });

  it("Task 338: logs do not include access token", async () => {
    const leakedAccessToken = "access-token-should-not-appear";
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${leakedAccessToken}`);

    expect(response.status).toBe(401);

    const serializedLogs = getSerializedLoggerCalls();
    expect(serializedLogs).not.toContain(leakedAccessToken);
  });

  it("Task 339: logs do not include refresh token", async () => {
    const leakedRefreshToken = "refresh-token-should-not-appear";
    const response = await request(app).post("/api/auth/refresh").send({
      refreshToken: leakedRefreshToken,
    });

    expect(response.status).toBe(401);

    const serializedLogs = getSerializedLoggerCalls();
    expect(serializedLogs).not.toContain(leakedRefreshToken);
  });

  it("Task 340: logs do not include verification code", async () => {
    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);
    const leakedVerificationCode = "654321";

    const response = await verifyTenantRegistration(
      registered.registrationId,
      leakedVerificationCode,
    );

    expect(response.status).toBe(401);

    const serializedLogs = getSerializedLoggerCalls();
    expect(serializedLogs).not.toContain(leakedVerificationCode);
  });

  it("Task 341: logs do not include token hash or code hash", async () => {
    const { env } = await import("../../src/config/env");
    const leakedRefreshToken = "refresh-hash-target-token";
    const leakedVerificationCode = "112233";

    const leakedRefreshTokenHash = createHmac("sha256", env.auth.jwtRefreshSecret)
      .update(leakedRefreshToken)
      .digest("hex");
    const leakedVerificationCodeHash = createHmac("sha256", env.auth.jwtRefreshSecret)
      .update(leakedVerificationCode)
      .digest("hex");

    const refreshResponse = await request(app).post("/api/auth/refresh").send({
      refreshToken: leakedRefreshToken,
    });
    expect(refreshResponse.status).toBe(401);

    const payload = createRegisterTenantPayload();
    const registered = await registerTenantAndReadCode(payload);
    const verifyResponse = await verifyTenantRegistration(
      registered.registrationId,
      leakedVerificationCode,
    );
    expect(verifyResponse.status).toBe(401);

    const serializedLogs = getSerializedLoggerCalls();
    expect(serializedLogs).not.toContain("tokenHash");
    expect(serializedLogs).not.toContain("codeHash");
    expect(serializedLogs).not.toContain(leakedRefreshTokenHash);
    expect(serializedLogs).not.toContain(leakedVerificationCodeHash);
  });
});

