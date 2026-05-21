import type { Express } from "express";
import { SignJWT } from "jose";
import type { Response as SupertestResponse } from "supertest";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type AuthRole = "super_admin" | "shop_admin" | "staff";
type TenantStatus = "ACTIVE" | "SUSPENDED";

type TenantRecord = {
  id: string;
  code: string;
  name: string;
  status: TenantStatus;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaState = {
  tenants: Map<string, TenantRecord>;
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

const selectTenantFields = (
  tenant: TenantRecord,
  select: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  if (!select) {
    return { ...tenant };
  }

  const selected: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(select)) {
    if (value === true) {
      selected[key] = tenant[key as keyof TenantRecord];
    }
  }

  return selected;
};

const matchesTenantWhereClause = (tenant: TenantRecord, where: any): boolean => {
  if (!where || typeof where !== "object") {
    return true;
  }

  if (typeof where.id === "string" && tenant.id !== where.id) {
    return false;
  }

  if (where.deletedAt === null && tenant.deletedAt !== null) {
    return false;
  }

  if (typeof where.status === "string" && tenant.status !== where.status) {
    return false;
  }

  if (Array.isArray(where.OR) && where.OR.length > 0) {
    const matchesAnyOr = where.OR.some((orClause: any) => {
      if (!orClause || typeof orClause !== "object") {
        return false;
      }

      const nameContains = orClause?.name?.contains;
      if (typeof nameContains === "string" && tenant.name.includes(nameContains)) {
        return true;
      }

      const codeContains = orClause?.code?.contains;
      if (typeof codeContains === "string" && tenant.code.includes(codeContains)) {
        return true;
      }

      return false;
    });

    if (!matchesAnyOr) {
      return false;
    }
  }

  return true;
};

const queryTenantsForList = (
  tenants: Map<string, TenantRecord>,
  args: any,
): TenantRecord[] => {
  const where = args?.where ?? {};
  const orderBy = args?.orderBy;
  const skip = typeof args?.skip === "number" ? args.skip : 0;
  const take = typeof args?.take === "number" ? args.take : undefined;

  const filteredItems = Array.from(tenants.values()).filter((tenant) =>
    matchesTenantWhereClause(tenant, where),
  );

  if (
    orderBy &&
    typeof orderBy === "object" &&
    orderBy.createdAt === "desc"
  ) {
    filteredItems.sort((left, right) => {
      return right.createdAt.getTime() - left.createdAt.getTime();
    });
  }

  const paginatedItems =
    typeof take === "number"
      ? filteredItems.slice(skip, skip + take)
      : filteredItems.slice(skip);

  return paginatedItems;
};

const countTenantsForList = (
  tenants: Map<string, TenantRecord>,
  args: any,
): number => {
  const where = args?.where ?? {};
  return Array.from(tenants.values()).filter((tenant) =>
    matchesTenantWhereClause(tenant, where),
  ).length;
};

const createPrismaMock = (): { prismaMock: any; prismaState: PrismaState } => {
  const tenants = new Map<string, TenantRecord>();

  const tenantModel = {
    findUnique: vi.fn(async (args: any): Promise<any> => {
      const where = args?.where ?? {};
      if (typeof where.id !== "string") {
        return null;
      }

      const tenant = tenants.get(where.id);
      if (!tenant) {
        return null;
      }

      return selectTenantFields(tenant, args?.select);
    }),
    findFirst: vi.fn(async (args: any): Promise<any> => {
      const where = args?.where ?? {};
      const candidateId = where.id;
      const requiresNotDeleted = where.deletedAt === null;

      for (const tenant of tenants.values()) {
        if (typeof candidateId === "string" && tenant.id !== candidateId) {
          continue;
        }

        if (requiresNotDeleted && tenant.deletedAt !== null) {
          continue;
        }

        return selectTenantFields(tenant, args?.select);
      }

      return null;
    }),
    findMany: vi.fn(async (args: any): Promise<any[]> => {
      const selectedItems = queryTenantsForList(tenants, args);
      return selectedItems.map((tenant) =>
        selectTenantFields(tenant, args?.select),
      );
    }),
    count: vi.fn(async (args: any): Promise<number> =>
      countTenantsForList(tenants, args),
    ),
    create: vi.fn(),
    updateMany: vi.fn(async (args: any) => {
      const where = args?.where ?? {};
      const data = args?.data ?? {};
      const candidateId = where.id;
      const requiresNotDeleted = where.deletedAt === null;

      const nextName = data.name;
      const nextStatus = data.status;
      const hasUpdatableFields =
        nextName !== undefined || nextStatus !== undefined;
      if (!hasUpdatableFields) {
        return { count: 0 };
      }

      let updatedCount = 0;
      for (const [tenantId, tenant] of tenants.entries()) {
        if (typeof candidateId === "string" && tenant.id !== candidateId) {
          continue;
        }

        if (requiresNotDeleted && tenant.deletedAt !== null) {
          continue;
        }

        tenants.set(tenantId, {
          ...tenant,
          ...(typeof nextName === "string" ? { name: nextName } : {}),
          ...(typeof nextStatus === "string"
            ? { status: nextStatus as TenantStatus }
            : {}),
          updatedAt: new Date(),
        });
        updatedCount += 1;
      }

      return { count: updatedCount };
    }),
  };

  const userModel = {
    findUnique: vi.fn(async () => null),
    create: vi.fn(),
    update: vi.fn(),
  };

  const refreshTokenModel = {
    findUnique: vi.fn(async () => null),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(async () => ({ count: 0 })),
  };

  const verificationCodeModel = {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(async () => ({ count: 0 })),
  };

  const pendingTenantRegistrationModel = {
    findUnique: vi.fn(async () => null),
    create: vi.fn(),
    update: vi.fn(),
  };

  const transactionClient = {
    tenant: tenantModel,
    user: userModel,
    refreshToken: refreshTokenModel,
    verificationCode: verificationCodeModel,
    pendingTenantRegistration: pendingTenantRegistrationModel,
  };

  const prismaMock = {
    tenant: tenantModel,
    user: userModel,
    refreshToken: refreshTokenModel,
    verificationCode: verificationCodeModel,
    pendingTenantRegistration: pendingTenantRegistrationModel,
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(transactionClient),
    ),
  };

  const prismaState: PrismaState = {
    tenants,
    reset: () => {
      tenants.clear();
    },
  };

  return { prismaMock, prismaState };
};

const createTenant = (overrides: Partial<TenantRecord> = {}): TenantRecord => ({
  id: "tenant_1",
  code: "TENANT_1",
  name: "Tenant One",
  status: "ACTIVE",
  deletedAt: null,
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-05-02T00:00:00.000Z"),
  ...overrides,
});

const clearMockCalls = (model: Record<string, unknown>): void => {
  for (const value of Object.values(model)) {
    if (
      typeof value === "function" &&
      "mockClear" in value &&
      typeof (value as { mockClear?: unknown }).mockClear === "function"
    ) {
      (value as { mockClear: () => void }).mockClear();
    }
  }
};

setTestEnv();

const loggerInfoSpy = vi.fn(() => undefined);
const loggerWarnSpy = vi.fn(() => undefined);
const loggerErrorSpy = vi.fn(() => undefined);
const { prismaMock, prismaState } = createPrismaMock();

let app: Express;

type LoggerPayload = Record<string, unknown>;

const getTenantsEventLogs = (): LoggerPayload[] =>
  loggerInfoSpy.mock.calls
    .filter(([, message]) => message === "tenants event")
    .map(([payload]) => payload as LoggerPayload);

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

const assertNotFound = (response: SupertestResponse): void => {
  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe("NOT_FOUND");
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
  prismaState.reset();
  loggerInfoSpy.mockClear();
  loggerWarnSpy.mockClear();
  loggerErrorSpy.mockClear();
  clearMockCalls(prismaMock.tenant);
  clearMockCalls(prismaMock.user);
  clearMockCalls(prismaMock.refreshToken);
  clearMockCalls(prismaMock.verificationCode);
  clearMockCalls(prismaMock.pendingTenantRegistration);
  prismaMock.$transaction.mockClear();
});

describe.sequential("Tenants API authentication tests (Task 210->215)", () => {
  it("Task 210: create tenants API test file scaffold", () => {
    expect(typeof app).toBe("function");
  });

  it("Task 211: GET /api/tenants/me without token returns 401", async () => {
    const response = await request(app).get("/api/tenants/me");

    assertUnauthorized(response);
  });

  it("Task 212: GET /api/tenants without token returns 401", async () => {
    const response = await request(app).get("/api/tenants");

    assertUnauthorized(response);
  });

  it("Task 213: malformed bearer token on Tenants API returns 401", async () => {
    const response = await request(app)
      .get("/api/tenants/me")
      .set("Authorization", "Bearer token-part-one token-part-two");

    assertUnauthorized(response);
  });

  it("Task 214: invalid access token on Tenants API returns 401", async () => {
    const invalidAccessToken = await buildAccessToken({
      secret: "wrong-jwt-access-secret",
    });

    const response = await request(app)
      .get("/api/tenants/me")
      .set("Authorization", `Bearer ${invalidAccessToken}`);

    assertUnauthorized(response);
  });

  it("Task 215: expired access token on Tenants API returns 401", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiredAccessToken = await buildAccessToken({
      issuedAt: nowSeconds - 120,
      expiresAt: nowSeconds - 60,
    });

    const response = await request(app)
      .get("/api/tenants/me")
      .set("Authorization", `Bearer ${expiredAccessToken}`);

    assertUnauthorized(response);
  });
});

describe.sequential("Current tenant API tests (Task 216->222)", () => {
  it("Task 216: shop_admin can call GET /api/tenants/me", async () => {
    const shopAdminTenant = createTenant({
      id: "tenant_shop_admin_1",
      code: "TENANT_SHOP_ADMIN_1",
      name: "Shop Admin Tenant",
    });
    prismaState.tenants.set(shopAdminTenant.id, shopAdminTenant);

    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: shopAdminTenant.id,
    });

    const response = await request(app)
      .get("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant).toMatchObject({
      id: shopAdminTenant.id,
      code: shopAdminTenant.code,
      name: shopAdminTenant.name,
      status: shopAdminTenant.status,
      createdAt: shopAdminTenant.createdAt.toISOString(),
      updatedAt: shopAdminTenant.updatedAt.toISOString(),
    });
  });

  it("Task 217: staff can call GET /api/tenants/me", async () => {
    const staffTenant = createTenant({
      id: "tenant_staff_1",
      code: "TENANT_STAFF_1",
      name: "Staff Tenant",
      status: "SUSPENDED",
    });
    prismaState.tenants.set(staffTenant.id, staffTenant);

    const accessToken = await buildAccessToken({
      role: "staff",
      tenantId: staffTenant.id,
    });

    const response = await request(app)
      .get("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant).toMatchObject({
      id: staffTenant.id,
      code: staffTenant.code,
      name: staffTenant.name,
      status: staffTenant.status,
    });
  });

  it("Task 218: GET /api/tenants/me uses req.authContext.tenantId", async () => {
    const tenantFromAuthContext = createTenant({
      id: "tenant_from_auth_context",
      code: "TENANT_FROM_AUTH",
      name: "Tenant From Auth Context",
    });
    const otherTenant = createTenant({
      id: "tenant_from_client_input",
      code: "TENANT_CLIENT_INPUT",
      name: "Tenant From Client Input",
    });
    prismaState.tenants.set(tenantFromAuthContext.id, tenantFromAuthContext);
    prismaState.tenants.set(otherTenant.id, otherTenant);

    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: tenantFromAuthContext.id,
    });

    const response = await request(app)
      .get("/api/tenants/me")
      .query({ id: otherTenant.id, tenantId: otherTenant.id })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant.id).toBe(tenantFromAuthContext.id);
    expect(response.body.data.tenant.id).not.toBe(otherTenant.id);

    expect(prismaMock.tenant.findFirst).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        id: tenantFromAuthContext.id,
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it("Task 219: GET /api/tenants/me returns 403 when tenant id is missing", async () => {
    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: null,
    });

    const response = await request(app)
      .get("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`);

    assertForbidden(response);
  });

  it("Task 220: GET /api/tenants/me returns 404 when current tenant is missing", async () => {
    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: "tenant_missing_1",
    });

    const response = await request(app)
      .get("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`);

    assertNotFound(response);
  });

  it("Task 221: GET /api/tenants/me returns 404 for deleted tenant", async () => {
    const deletedTenant = createTenant({
      id: "tenant_deleted_1",
      code: "TENANT_DELETED_1",
      name: "Deleted Tenant",
      deletedAt: new Date("2026-05-03T00:00:00.000Z"),
    });
    prismaState.tenants.set(deletedTenant.id, deletedTenant);

    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: deletedTenant.id,
    });

    const response = await request(app)
      .get("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`);

    assertNotFound(response);
  });

  it("Task 222: GET /api/tenants/me response does not expose deletedAt", async () => {
    const tenant = createTenant({
      id: "tenant_no_deleted_at_1",
      code: "TENANT_NO_DELETED_AT_1",
      name: "No DeletedAt Tenant",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "staff",
      tenantId: tenant.id,
    });

    const response = await request(app)
      .get("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant).not.toHaveProperty("deletedAt");
  });
});

describe.sequential("Current tenant update API tests (Task 223->233)", () => {
  it("Task 223: shop_admin can update own tenant name through PATCH /api/tenants/me", async () => {
    const shopAdminTenant = createTenant({
      id: "tenant_patch_shop_admin_1",
      code: "TENANT_PATCH_SHOP_ADMIN_1",
      name: "Tenant Before Update",
    });
    prismaState.tenants.set(shopAdminTenant.id, shopAdminTenant);

    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: shopAdminTenant.id,
    });

    const response = await request(app)
      .patch("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Tenant After Update",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant).toMatchObject({
      id: shopAdminTenant.id,
      code: shopAdminTenant.code,
      name: "Tenant After Update",
      status: shopAdminTenant.status,
    });
  });

  it("Task 224: staff cannot call PATCH /api/tenants/me", async () => {
    const accessToken = await buildAccessToken({
      role: "staff",
      tenantId: "tenant_staff_patch_1",
    });

    const response = await request(app)
      .patch("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Staff Cannot Update",
      });

    assertForbidden(response);
  });

  it("Task 225: super_admin without tenant id cannot call PATCH /api/tenants/me", async () => {
    const accessToken = await buildAccessToken({
      role: "super_admin",
      tenantId: null,
    });

    const response = await request(app)
      .patch("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Super Admin Without Tenant Context",
      });

    assertForbidden(response);
  });

  it("Task 226: PATCH /api/tenants/me trims name", async () => {
    const tenant = createTenant({
      id: "tenant_patch_trim_name_1",
      code: "TENANT_PATCH_TRIM_NAME_1",
      name: "Tenant Before Trim Update",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: tenant.id,
    });

    const response = await request(app)
      .patch("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "   Tenant Name After Trim   ",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant.name).toBe("Tenant Name After Trim");
    expect(prismaMock.tenant.updateMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        id: tenant.id,
      },
      data: {
        name: "Tenant Name After Trim",
      },
    });
  });

  it("Task 227: PATCH /api/tenants/me rejects empty name", async () => {
    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: "tenant_patch_empty_name_1",
    });

    const response = await request(app)
      .patch("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "   ",
      });

    assertValidationError(response);
  });

  it("Task 228: PATCH /api/tenants/me rejects overlong name", async () => {
    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: "tenant_patch_overlong_name_1",
    });

    const response = await request(app)
      .patch("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "a".repeat(121),
      });

    assertValidationError(response);
  });

  it("Task 229: PATCH /api/tenants/me rejects status", async () => {
    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: "tenant_patch_reject_status_1",
    });

    const response = await request(app)
      .patch("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Valid Name",
        status: "SUSPENDED",
      });

    assertValidationError(response);
  });

  it("Task 230: PATCH /api/tenants/me rejects code", async () => {
    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: "tenant_patch_reject_code_1",
    });

    const response = await request(app)
      .patch("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Valid Name",
        code: "TENANT_CODE_MUTATION",
      });

    assertValidationError(response);
  });

  it("Task 231: PATCH /api/tenants/me rejects id, deletedAt, createdAt, and updatedAt", async () => {
    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: "tenant_patch_reject_protected_fields_1",
    });

    const response = await request(app)
      .patch("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Valid Name",
        id: "tenant_override_id",
        deletedAt: "2026-05-03T00:00:00.000Z",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-02T00:00:00.000Z",
      });

    assertValidationError(response);
  });

  it("Task 232: PATCH /api/tenants/me does not accept target tenant id from the client", async () => {
    const tenantFromAuthContext = createTenant({
      id: "tenant_patch_auth_context_1",
      code: "TENANT_PATCH_AUTH_CONTEXT_1",
      name: "Tenant From Auth Context",
    });
    const otherTenant = createTenant({
      id: "tenant_patch_client_input_1",
      code: "TENANT_PATCH_CLIENT_INPUT_1",
      name: "Tenant From Client Input",
    });
    prismaState.tenants.set(tenantFromAuthContext.id, tenantFromAuthContext);
    prismaState.tenants.set(otherTenant.id, otherTenant);

    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: tenantFromAuthContext.id,
    });

    const response = await request(app)
      .patch("/api/tenants/me")
      .query({ tenantId: otherTenant.id })
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Updated By Auth Context Tenant",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant.id).toBe(tenantFromAuthContext.id);
    expect(response.body.data.tenant.id).not.toBe(otherTenant.id);
    expect(prismaState.tenants.get(tenantFromAuthContext.id)?.name).toBe(
      "Updated By Auth Context Tenant",
    );
    expect(prismaState.tenants.get(otherTenant.id)?.name).toBe(
      "Tenant From Client Input",
    );
  });

  it("Task 233: PATCH /api/tenants/me response does not expose deletedAt", async () => {
    const tenant = createTenant({
      id: "tenant_patch_no_deleted_at_1",
      code: "TENANT_PATCH_NO_DELETED_AT_1",
      name: "Tenant Before Update",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: tenant.id,
    });

    const response = await request(app)
      .patch("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Tenant After Update",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant).not.toHaveProperty("deletedAt");
  });
});

describe.sequential("Super-admin list API tests (Task 234->250)", () => {
  it("Task 234: super_admin can call GET /api/tenants", async () => {
    const activeTenant = createTenant({
      id: "tenant_list_super_admin_active_1",
      code: "TENANT_LIST_SUPER_ADMIN_ACTIVE_1",
      name: "Tenant List Active 1",
    });
    prismaState.tenants.set(activeTenant.id, activeTenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.items)).toBe(true);
  });

  it("Task 235: tenant list defaults to page = 1", async () => {
    const tenant = createTenant({
      id: "tenant_list_default_page_1",
      code: "TENANT_LIST_DEFAULT_PAGE_1",
      name: "Tenant Default Page",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.page).toBe(1);
  });

  it("Task 236: tenant list defaults to pageSize = 20", async () => {
    const tenant = createTenant({
      id: "tenant_list_default_page_size_1",
      code: "TENANT_LIST_DEFAULT_PAGE_SIZE_1",
      name: "Tenant Default PageSize",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.pageSize).toBe(20);
  });

  it("Task 237: tenant list rejects pageSize > 100", async () => {
    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .query({ pageSize: "101" })
      .set("Authorization", `Bearer ${accessToken}`);

    assertValidationError(response);
  });

  it("Task 238: tenant list supports status=ACTIVE", async () => {
    const activeTenant = createTenant({
      id: "tenant_list_status_active_1",
      code: "TENANT_LIST_STATUS_ACTIVE_1",
      name: "Tenant Active Filter Match",
      status: "ACTIVE",
    });
    const suspendedTenant = createTenant({
      id: "tenant_list_status_active_2",
      code: "TENANT_LIST_STATUS_ACTIVE_2",
      name: "Tenant Active Filter Miss",
      status: "SUSPENDED",
    });
    prismaState.tenants.set(activeTenant.id, activeTenant);
    prismaState.tenants.set(suspendedTenant.id, suspendedTenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .query({ status: "ACTIVE" })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.total).toBe(1);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].id).toBe(activeTenant.id);
  });

  it("Task 239: tenant list supports status=SUSPENDED", async () => {
    const activeTenant = createTenant({
      id: "tenant_list_status_suspended_1",
      code: "TENANT_LIST_STATUS_SUSPENDED_1",
      name: "Tenant Suspended Filter Miss",
      status: "ACTIVE",
    });
    const suspendedTenant = createTenant({
      id: "tenant_list_status_suspended_2",
      code: "TENANT_LIST_STATUS_SUSPENDED_2",
      name: "Tenant Suspended Filter Match",
      status: "SUSPENDED",
    });
    prismaState.tenants.set(activeTenant.id, activeTenant);
    prismaState.tenants.set(suspendedTenant.id, suspendedTenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .query({ status: "SUSPENDED" })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.total).toBe(1);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].id).toBe(suspendedTenant.id);
  });

  it("Task 240: tenant list rejects invalid status", async () => {
    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .query({ status: "ARCHIVED" })
      .set("Authorization", `Bearer ${accessToken}`);

    assertValidationError(response);
  });

  it("Task 241: tenant list supports q search over tenant name", async () => {
    const targetTenant = createTenant({
      id: "tenant_list_q_name_1",
      code: "TENANT_LIST_Q_NAME_1",
      name: "Cloud Atlas Name Match",
    });
    const otherTenant = createTenant({
      id: "tenant_list_q_name_2",
      code: "TENANT_LIST_Q_NAME_2",
      name: "Different Name",
    });
    prismaState.tenants.set(targetTenant.id, targetTenant);
    prismaState.tenants.set(otherTenant.id, otherTenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .query({ q: "Atlas" })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.total).toBe(1);
    expect(response.body.data.items[0].id).toBe(targetTenant.id);
  });

  it("Task 242: tenant list supports q search over tenant code", async () => {
    const targetTenant = createTenant({
      id: "tenant_list_q_code_1",
      code: "TENANT_CODE_TARGET_242",
      name: "Tenant Name By Code Search",
    });
    const otherTenant = createTenant({
      id: "tenant_list_q_code_2",
      code: "TENANT_CODE_OTHER_242",
      name: "Tenant Name Not Matched",
    });
    prismaState.tenants.set(targetTenant.id, targetTenant);
    prismaState.tenants.set(otherTenant.id, otherTenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .query({ q: "TARGET_242" })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.total).toBe(1);
    expect(response.body.data.items[0].id).toBe(targetTenant.id);
  });

  it("Task 243: tenant list rejects overlong q", async () => {
    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .query({ q: "a".repeat(101) })
      .set("Authorization", `Bearer ${accessToken}`);

    assertValidationError(response);
  });

  it("Task 244: tenant list rejects invalid page", async () => {
    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .query({ page: "0" })
      .set("Authorization", `Bearer ${accessToken}`);

    assertValidationError(response);
  });

  it("Task 245: tenant list rejects invalid pageSize", async () => {
    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .query({ pageSize: "0" })
      .set("Authorization", `Bearer ${accessToken}`);

    assertValidationError(response);
  });

  it("Task 246: tenant list returns items, page, pageSize, and total", async () => {
    const firstTenant = createTenant({
      id: "tenant_list_shape_1",
      code: "TENANT_LIST_SHAPE_1",
      name: "Tenant List Shape 1",
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    const secondTenant = createTenant({
      id: "tenant_list_shape_2",
      code: "TENANT_LIST_SHAPE_2",
      name: "Tenant List Shape 2",
      createdAt: new Date("2026-05-02T00:00:00.000Z"),
    });
    const thirdTenant = createTenant({
      id: "tenant_list_shape_3",
      code: "TENANT_LIST_SHAPE_3",
      name: "Tenant List Shape 3",
      createdAt: new Date("2026-05-03T00:00:00.000Z"),
    });
    prismaState.tenants.set(firstTenant.id, firstTenant);
    prismaState.tenants.set(secondTenant.id, secondTenant);
    prismaState.tenants.set(thirdTenant.id, thirdTenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .query({ page: "2", pageSize: "1" })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      page: 2,
      pageSize: 1,
      total: 3,
    });
    expect(response.body.data.items).toHaveLength(1);
  });

  it("Task 247: tenant list response does not expose deletedAt", async () => {
    const tenant = createTenant({
      id: "tenant_list_no_deleted_at_1",
      code: "TENANT_LIST_NO_DELETED_AT_1",
      name: "Tenant Without DeletedAt In Response",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).not.toHaveProperty("deletedAt");
  });

  it("Task 248: tenant list excludes tenants where deletedAt is not null", async () => {
    const visibleTenant = createTenant({
      id: "tenant_list_not_deleted_1",
      code: "TENANT_LIST_NOT_DELETED_1",
      name: "Visible Tenant",
      deletedAt: null,
    });
    const deletedTenant = createTenant({
      id: "tenant_list_deleted_1",
      code: "TENANT_LIST_DELETED_1",
      name: "Deleted Tenant",
      deletedAt: new Date("2026-05-04T00:00:00.000Z"),
    });
    prismaState.tenants.set(visibleTenant.id, visibleTenant);
    prismaState.tenants.set(deletedTenant.id, deletedTenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.total).toBe(1);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].id).toBe(visibleTenant.id);
  });

  it("Task 249: shop_admin cannot call GET /api/tenants", async () => {
    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: "tenant_shop_admin_list_1",
    });

    const response = await request(app)
      .get("/api/tenants")
      .set("Authorization", `Bearer ${accessToken}`);

    assertForbidden(response);
  });

  it("Task 250: staff cannot call GET /api/tenants", async () => {
    const accessToken = await buildAccessToken({
      role: "staff",
      tenantId: "tenant_staff_list_1",
    });

    const response = await request(app)
      .get("/api/tenants")
      .set("Authorization", `Bearer ${accessToken}`);

    assertForbidden(response);
  });
});

describe.sequential("Super-admin detail API tests (Task 251->257)", () => {
  it("Task 251: super_admin can call GET /api/tenants/:id", async () => {
    const tenant = createTenant({
      id: "tenant_detail_super_admin_1",
      code: "TENANT_DETAIL_SUPER_ADMIN_1",
      name: "Tenant Detail Super Admin",
      status: "SUSPENDED",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant).toMatchObject({
      id: tenant.id,
      code: tenant.code,
      name: tenant.name,
      status: tenant.status,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
    });
  });

  it("Task 252: unknown tenant detail returns 404", async () => {
    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants/tenant_detail_missing_1")
      .set("Authorization", `Bearer ${accessToken}`);

    assertNotFound(response);
  });

  it("Task 253: deleted tenant detail returns 404", async () => {
    const deletedTenant = createTenant({
      id: "tenant_detail_deleted_1",
      code: "TENANT_DETAIL_DELETED_1",
      name: "Tenant Detail Deleted",
      deletedAt: new Date("2026-05-05T00:00:00.000Z"),
    });
    prismaState.tenants.set(deletedTenant.id, deletedTenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get(`/api/tenants/${deletedTenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    assertNotFound(response);
  });

  it("Task 254: invalid id returns 400", async () => {
    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants/%20")
      .set("Authorization", `Bearer ${accessToken}`);

    assertValidationError(response);
  });

  it("Task 255: tenant detail response does not expose deletedAt", async () => {
    const tenant = createTenant({
      id: "tenant_detail_no_deleted_at_1",
      code: "TENANT_DETAIL_NO_DELETED_AT_1",
      name: "Tenant Detail No DeletedAt",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant).not.toHaveProperty("deletedAt");
  });

  it("Task 256: shop_admin cannot call GET /api/tenants/:id", async () => {
    const tenant = createTenant({
      id: "tenant_detail_forbidden_shop_admin_1",
      code: "TENANT_DETAIL_FORBIDDEN_SHOP_ADMIN_1",
      name: "Tenant Detail Forbidden Shop Admin",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: "tenant_shop_admin_detail_1",
    });

    const response = await request(app)
      .get(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    assertForbidden(response);
  });

  it("Task 257: staff cannot call GET /api/tenants/:id", async () => {
    const tenant = createTenant({
      id: "tenant_detail_forbidden_staff_1",
      code: "TENANT_DETAIL_FORBIDDEN_STAFF_1",
      name: "Tenant Detail Forbidden Staff",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "staff",
      tenantId: "tenant_staff_detail_1",
    });

    const response = await request(app)
      .get(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    assertForbidden(response);
  });
});

describe.sequential("Super-admin update API tests (Task 258->273)", () => {
  it("Task 258: super_admin can update tenant name", async () => {
    const tenant = createTenant({
      id: "tenant_update_super_admin_name_1",
      code: "TENANT_UPDATE_SUPER_ADMIN_NAME_1",
      name: "Tenant Name Before Update",
      status: "ACTIVE",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Tenant Name After Update",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant).toMatchObject({
      id: tenant.id,
      code: tenant.code,
      name: "Tenant Name After Update",
      status: tenant.status,
    });
  });

  it("Task 259: super_admin can update tenant status to ACTIVE", async () => {
    const tenant = createTenant({
      id: "tenant_update_super_admin_status_active_1",
      code: "TENANT_UPDATE_SUPER_ADMIN_STATUS_ACTIVE_1",
      name: "Tenant Status To Active",
      status: "SUSPENDED",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "ACTIVE",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant.status).toBe("ACTIVE");
  });

  it("Task 260: super_admin can update tenant status to SUSPENDED", async () => {
    const tenant = createTenant({
      id: "tenant_update_super_admin_status_suspended_1",
      code: "TENANT_UPDATE_SUPER_ADMIN_STATUS_SUSPENDED_1",
      name: "Tenant Status To Suspended",
      status: "ACTIVE",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "SUSPENDED",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant.status).toBe("SUSPENDED");
  });

  it("Task 261: super_admin can update name and status in one request", async () => {
    const tenant = createTenant({
      id: "tenant_update_super_admin_name_status_1",
      code: "TENANT_UPDATE_SUPER_ADMIN_NAME_STATUS_1",
      name: "Tenant Before Name Status Update",
      status: "ACTIVE",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Tenant After Name Status Update",
        status: "SUSPENDED",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant).toMatchObject({
      id: tenant.id,
      name: "Tenant After Name Status Update",
      status: "SUSPENDED",
    });
  });

  it("Task 262: empty update body returns 400", async () => {
    const tenant = createTenant({
      id: "tenant_update_empty_body_1",
      code: "TENANT_UPDATE_EMPTY_BODY_1",
      name: "Tenant Empty Body",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    assertValidationError(response);
  });

  it("Task 263: invalid status returns 400", async () => {
    const tenant = createTenant({
      id: "tenant_update_invalid_status_1",
      code: "TENANT_UPDATE_INVALID_STATUS_1",
      name: "Tenant Invalid Status",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "ARCHIVED",
      });

    assertValidationError(response);
  });

  it("Task 264: empty name returns 400", async () => {
    const tenant = createTenant({
      id: "tenant_update_empty_name_1",
      code: "TENANT_UPDATE_EMPTY_NAME_1",
      name: "Tenant Empty Name",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "   ",
      });

    assertValidationError(response);
  });

  it("Task 265: overlong name returns 400", async () => {
    const tenant = createTenant({
      id: "tenant_update_overlong_name_1",
      code: "TENANT_UPDATE_OVERLONG_NAME_1",
      name: "Tenant Overlong Name",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "a".repeat(121),
      });

    assertValidationError(response);
  });

  it("Task 266: unknown fields return 400", async () => {
    const tenant = createTenant({
      id: "tenant_update_unknown_fields_1",
      code: "TENANT_UPDATE_UNKNOWN_FIELDS_1",
      name: "Tenant Unknown Fields",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Valid Name",
        unknownField: "unexpected",
      });

    assertValidationError(response);
  });

  it("Task 267: attempts to update code return 400", async () => {
    const tenant = createTenant({
      id: "tenant_update_code_mutation_1",
      code: "TENANT_UPDATE_CODE_MUTATION_1",
      name: "Tenant Code Mutation",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Valid Name",
        code: "TENANT_SHOULD_NOT_CHANGE",
      });

    assertValidationError(response);
  });

  it("Task 268: attempts to update id, deletedAt, createdAt, or updatedAt return 400", async () => {
    const tenant = createTenant({
      id: "tenant_update_protected_fields_1",
      code: "TENANT_UPDATE_PROTECTED_FIELDS_1",
      name: "Tenant Protected Fields",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Valid Name",
        id: "tenant_override_id",
        deletedAt: "2026-05-06T00:00:00.000Z",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-02T00:00:00.000Z",
      });

    assertValidationError(response);
  });

  it("Task 269: updating unknown tenant returns 404", async () => {
    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch("/api/tenants/tenant_update_unknown_1")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Tenant Unknown Update",
      });

    assertNotFound(response);
  });

  it("Task 270: updating deleted tenant returns 404", async () => {
    const deletedTenant = createTenant({
      id: "tenant_update_deleted_1",
      code: "TENANT_UPDATE_DELETED_1",
      name: "Tenant Update Deleted",
      deletedAt: new Date("2026-05-06T00:00:00.000Z"),
    });
    prismaState.tenants.set(deletedTenant.id, deletedTenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${deletedTenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Tenant Update Deleted Attempt",
      });

    assertNotFound(response);
  });

  it("Task 271: shop_admin cannot call PATCH /api/tenants/:id", async () => {
    const tenant = createTenant({
      id: "tenant_update_forbidden_shop_admin_1",
      code: "TENANT_UPDATE_FORBIDDEN_SHOP_ADMIN_1",
      name: "Tenant Forbidden Shop Admin",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: "tenant_shop_admin_update_1",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Should Not Be Allowed",
      });

    assertForbidden(response);
  });

  it("Task 272: staff cannot call PATCH /api/tenants/:id", async () => {
    const tenant = createTenant({
      id: "tenant_update_forbidden_staff_1",
      code: "TENANT_UPDATE_FORBIDDEN_STAFF_1",
      name: "Tenant Forbidden Staff",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "staff",
      tenantId: "tenant_staff_update_1",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Should Not Be Allowed",
      });

    assertForbidden(response);
  });

  it("Task 273: super-admin update response does not expose deletedAt", async () => {
    const tenant = createTenant({
      id: "tenant_update_no_deleted_at_1",
      code: "TENANT_UPDATE_NO_DELETED_AT_1",
      name: "Tenant Update No DeletedAt",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Tenant Updated No DeletedAt",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant).not.toHaveProperty("deletedAt");
  });
});

describe.sequential("Security and logging tests (Task 274->284)", () => {
  it("Task 274: tenant name update logs include requestId", async () => {
    const tenant = createTenant({
      id: "tenant_logging_request_id_name_1",
      code: "TENANT_LOGGING_REQUEST_ID_NAME_1",
      name: "Tenant Logging RequestId Name",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const requestId = "req-tenants-274";
    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("x-request-id", requestId)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Tenant Logging RequestId Name Updated",
      });

    expect(response.status).toBe(200);
    const nameUpdateLog = getTenantsEventLogs().find(
      (entry) => entry.event === "tenant.name.updated",
    );

    expect(nameUpdateLog).toBeDefined();
    expect(nameUpdateLog?.requestId).toBe(requestId);
  });

  it("Task 275: tenant status update logs include requestId", async () => {
    const tenant = createTenant({
      id: "tenant_logging_request_id_status_1",
      code: "TENANT_LOGGING_REQUEST_ID_STATUS_1",
      name: "Tenant Logging RequestId Status",
      status: "ACTIVE",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const requestId = "req-tenants-275";
    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("x-request-id", requestId)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "SUSPENDED",
      });

    expect(response.status).toBe(200);
    const statusUpdateLog = getTenantsEventLogs().find(
      (entry) => entry.event === "tenant.status.updated",
    );

    expect(statusUpdateLog).toBeDefined();
    expect(statusUpdateLog?.requestId).toBe(requestId);
  });

  it("Task 276: tenant update logs include actor role and target tenant id", async () => {
    const tenant = createTenant({
      id: "tenant_logging_actor_target_1",
      code: "TENANT_LOGGING_ACTOR_TARGET_1",
      name: "Tenant Logging Actor Target",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Tenant Logging Actor Target Updated",
      });

    expect(response.status).toBe(200);
    const nameUpdateLog = getTenantsEventLogs().find(
      (entry) => entry.event === "tenant.name.updated",
    );

    expect(nameUpdateLog).toBeDefined();
    expect(nameUpdateLog?.actorRole).toBe("super_admin");
    expect(nameUpdateLog?.targetTenantId).toBe(tenant.id);
  });

  it("Task 277: tenant status update logs include oldStatus and newStatus", async () => {
    const tenant = createTenant({
      id: "tenant_logging_old_new_status_1",
      code: "TENANT_LOGGING_OLD_NEW_STATUS_1",
      name: "Tenant Logging Old New Status",
      status: "ACTIVE",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "SUSPENDED",
      });

    expect(response.status).toBe(200);
    const statusUpdateLog = getTenantsEventLogs().find(
      (entry) => entry.event === "tenant.status.updated",
    );

    expect(statusUpdateLog).toBeDefined();
    expect(statusUpdateLog?.oldStatus).toBe("ACTIVE");
    expect(statusUpdateLog?.newStatus).toBe("SUSPENDED");
  });

  it("Task 278: Tenants logs do not include authorization headers", async () => {
    const tenant = createTenant({
      id: "tenant_logging_no_authorization_1",
      code: "TENANT_LOGGING_NO_AUTHORIZATION_1",
      name: "Tenant Logging No Authorization",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Tenant Logging Authorization Updated",
      });

    expect(response.status).toBe(200);
    const nameUpdateLog = getTenantsEventLogs().find(
      (entry) => entry.event === "tenant.name.updated",
    );

    expect(nameUpdateLog).toBeDefined();
    expect(nameUpdateLog).not.toHaveProperty("authorization");
  });

  it("Task 279: Tenants logs do not include access tokens", async () => {
    const tenant = createTenant({
      id: "tenant_logging_no_access_token_1",
      code: "TENANT_LOGGING_NO_ACCESS_TOKEN_1",
      name: "Tenant Logging No Access Token",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Tenant Logging Access Token Updated",
      });

    expect(response.status).toBe(200);
    const nameUpdateLog = getTenantsEventLogs().find(
      (entry) => entry.event === "tenant.name.updated",
    );

    expect(nameUpdateLog).toBeDefined();
    expect(nameUpdateLog).not.toHaveProperty("accessToken");
    expect(nameUpdateLog).not.toHaveProperty("token");
    expect(nameUpdateLog).not.toHaveProperty("bearerToken");
  });

  it("Task 280: Tenants logs do not include refresh tokens", async () => {
    const tenant = createTenant({
      id: "tenant_logging_no_refresh_token_1",
      code: "TENANT_LOGGING_NO_REFRESH_TOKEN_1",
      name: "Tenant Logging No Refresh Token",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", "refreshToken=refresh-token-280")
      .send({
        name: "Tenant Logging Refresh Token Updated",
      });

    expect(response.status).toBe(200);
    const nameUpdateLog = getTenantsEventLogs().find(
      (entry) => entry.event === "tenant.name.updated",
    );

    expect(nameUpdateLog).toBeDefined();
    expect(nameUpdateLog).not.toHaveProperty("refreshToken");
    expect(nameUpdateLog).not.toHaveProperty("cookie");
    expect(nameUpdateLog).not.toHaveProperty("setCookie");
  });

  it("Task 281: Tenants logs do not include raw request headers", async () => {
    const tenant = createTenant({
      id: "tenant_logging_no_raw_headers_1",
      code: "TENANT_LOGGING_NO_RAW_HEADERS_1",
      name: "Tenant Logging No Raw Headers",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-secret-header", "raw-header-should-not-leak")
      .send({
        name: "Tenant Logging Raw Headers Updated",
      });

    expect(response.status).toBe(200);
    const nameUpdateLog = getTenantsEventLogs().find(
      (entry) => entry.event === "tenant.name.updated",
    );

    expect(nameUpdateLog).toBeDefined();
    expect(nameUpdateLog).not.toHaveProperty("headers");
    expect(nameUpdateLog).not.toHaveProperty("rawHeaders");
    expect(nameUpdateLog).not.toHaveProperty("requestHeaders");
  });

  it("Task 282: Tenants logs do not include raw request bodies", async () => {
    const tenant = createTenant({
      id: "tenant_logging_no_raw_body_1",
      code: "TENANT_LOGGING_NO_RAW_BODY_1",
      name: "Tenant Logging No Raw Body",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Tenant Logging Raw Body Updated",
      });

    expect(response.status).toBe(200);
    const nameUpdateLog = getTenantsEventLogs().find(
      (entry) => entry.event === "tenant.name.updated",
    );

    expect(nameUpdateLog).toBeDefined();
    expect(nameUpdateLog).not.toHaveProperty("body");
    expect(nameUpdateLog).not.toHaveProperty("rawBody");
    expect(nameUpdateLog).not.toHaveProperty("requestBody");
    expect(nameUpdateLog).not.toHaveProperty("req");
  });

  it("Task 283: Tenants responses never expose deletedAt", async () => {
    const currentTenant = createTenant({
      id: "tenant_response_no_deleted_at_current_1",
      code: "TENANT_RESPONSE_NO_DELETED_AT_CURRENT_1",
      name: "Tenant Response No DeletedAt Current",
    });
    const targetTenant = createTenant({
      id: "tenant_response_no_deleted_at_target_1",
      code: "TENANT_RESPONSE_NO_DELETED_AT_TARGET_1",
      name: "Tenant Response No DeletedAt Target",
      status: "SUSPENDED",
    });
    prismaState.tenants.set(currentTenant.id, currentTenant);
    prismaState.tenants.set(targetTenant.id, targetTenant);

    const shopAdminToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: currentTenant.id,
    });
    const superAdminToken = await buildAccessToken({
      role: "super_admin",
    });

    const currentTenantResponse = await request(app)
      .get("/api/tenants/me")
      .set("Authorization", `Bearer ${shopAdminToken}`);
    const currentTenantUpdateResponse = await request(app)
      .patch("/api/tenants/me")
      .set("Authorization", `Bearer ${shopAdminToken}`)
      .send({
        name: "Tenant Current Updated Name",
      });
    const listResponse = await request(app)
      .get("/api/tenants")
      .set("Authorization", `Bearer ${superAdminToken}`);
    const detailResponse = await request(app)
      .get(`/api/tenants/${targetTenant.id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);
    const updateByIdResponse = await request(app)
      .patch(`/api/tenants/${targetTenant.id}`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        name: "Tenant Target Updated Name",
      });

    expect(currentTenantResponse.status).toBe(200);
    expect(currentTenantUpdateResponse.status).toBe(200);
    expect(listResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(updateByIdResponse.status).toBe(200);

    expect(currentTenantResponse.body.data.tenant).not.toHaveProperty("deletedAt");
    expect(currentTenantUpdateResponse.body.data.tenant).not.toHaveProperty(
      "deletedAt",
    );
    for (const item of listResponse.body.data.items as Array<Record<string, unknown>>) {
      expect(item).not.toHaveProperty("deletedAt");
    }
    expect(detailResponse.body.data.tenant).not.toHaveProperty("deletedAt");
    expect(updateByIdResponse.body.data.tenant).not.toHaveProperty("deletedAt");
  });

  it("Task 284: Tenants responses never expose protected mutable fields beyond the approved DTO", async () => {
    const currentTenant = createTenant({
      id: "tenant_response_contract_current_1",
      code: "TENANT_RESPONSE_CONTRACT_CURRENT_1",
      name: "Tenant Response Contract Current",
    });
    const targetTenant = createTenant({
      id: "tenant_response_contract_target_1",
      code: "TENANT_RESPONSE_CONTRACT_TARGET_1",
      name: "Tenant Response Contract Target",
      status: "SUSPENDED",
    });
    prismaState.tenants.set(currentTenant.id, currentTenant);
    prismaState.tenants.set(targetTenant.id, targetTenant);

    const shopAdminToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: currentTenant.id,
    });
    const superAdminToken = await buildAccessToken({
      role: "super_admin",
    });

    const approvedTenantKeys = [
      "code",
      "createdAt",
      "id",
      "name",
      "status",
      "updatedAt",
    ];

    const getCurrentResponse = await request(app)
      .get("/api/tenants/me")
      .set("Authorization", `Bearer ${shopAdminToken}`);
    const patchCurrentResponse = await request(app)
      .patch("/api/tenants/me")
      .set("Authorization", `Bearer ${shopAdminToken}`)
      .send({
        name: "Tenant Response Contract Current Updated",
      });
    const listResponse = await request(app)
      .get("/api/tenants")
      .set("Authorization", `Bearer ${superAdminToken}`);
    const detailResponse = await request(app)
      .get(`/api/tenants/${targetTenant.id}`)
      .set("Authorization", `Bearer ${superAdminToken}`);
    const patchByIdResponse = await request(app)
      .patch(`/api/tenants/${targetTenant.id}`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        status: "ACTIVE",
      });

    expect(getCurrentResponse.status).toBe(200);
    expect(patchCurrentResponse.status).toBe(200);
    expect(listResponse.status).toBe(200);
    expect(detailResponse.status).toBe(200);
    expect(patchByIdResponse.status).toBe(200);

    expect(Object.keys(getCurrentResponse.body.data.tenant).sort()).toEqual(
      approvedTenantKeys,
    );
    expect(Object.keys(patchCurrentResponse.body.data.tenant).sort()).toEqual(
      approvedTenantKeys,
    );
    expect(Object.keys(detailResponse.body.data.tenant).sort()).toEqual(
      approvedTenantKeys,
    );
    expect(Object.keys(patchByIdResponse.body.data.tenant).sort()).toEqual(
      approvedTenantKeys,
    );

    expect(Object.keys(listResponse.body.data).sort()).toEqual([
      "items",
      "page",
      "pageSize",
      "total",
    ]);
    for (const item of listResponse.body.data.items as Array<Record<string, unknown>>) {
      expect(Object.keys(item).sort()).toEqual(approvedTenantKeys);
    }
  });
});

describe.sequential("Security bypass hardening tests (extra)", () => {
  it("Bypass 01: refresh token cannot access Tenants protected APIs", async () => {
    const refreshLikeToken = await buildAccessToken({
      role: "super_admin",
      tokenType: "refresh",
    });

    const response = await request(app)
      .get("/api/tenants")
      .set("Authorization", `Bearer ${refreshLikeToken}`);

    assertUnauthorized(response);
  });

  it("Bypass 02: token with invalid role cannot access Tenants APIs", async () => {
    const forgedRoleToken = await new SignJWT({
      sub: "user_auth_test_invalid_role_1",
      tenantId: null,
      role: "tenant_owner",
      tokenType: "access",
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
      .get("/api/tenants")
      .set("Authorization", `Bearer ${forgedRoleToken}`);

    assertUnauthorized(response);
  });

  it("Bypass 03: shop_admin cannot escalate role via custom header", async () => {
    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: "tenant_bypass_escalate_header_1",
    });

    const response = await request(app)
      .get("/api/tenants")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-role", "super_admin");

    assertForbidden(response);
  });

  it("Bypass 04: /me update ignores forged tenant header and only uses auth context tenant", async () => {
    const tenantFromAuthContext = createTenant({
      id: "tenant_bypass_auth_context_1",
      code: "TENANT_BYPASS_AUTH_CONTEXT_1",
      name: "Tenant From Auth Context",
    });
    const otherTenant = createTenant({
      id: "tenant_bypass_header_attempt_1",
      code: "TENANT_BYPASS_HEADER_ATTEMPT_1",
      name: "Tenant From Forged Header",
    });
    prismaState.tenants.set(tenantFromAuthContext.id, tenantFromAuthContext);
    prismaState.tenants.set(otherTenant.id, otherTenant);

    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: tenantFromAuthContext.id,
    });

    const response = await request(app)
      .patch("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-tenant-id", otherTenant.id)
      .send({
        name: "Updated By Auth Context Only",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant.id).toBe(tenantFromAuthContext.id);
    expect(response.body.data.tenant.id).not.toBe(otherTenant.id);
    expect(prismaState.tenants.get(tenantFromAuthContext.id)?.name).toBe(
      "Updated By Auth Context Only",
    );
    expect(prismaState.tenants.get(otherTenant.id)?.name).toBe(
      "Tenant From Forged Header",
    );
  });

  it("Bypass 05: duplicated page query params are rejected to avoid parser bypass", async () => {
    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants?page=1&page=2")
      .set("Authorization", `Bearer ${accessToken}`);

    assertValidationError(response);
  });

  it("Bypass 06: type-confusion payload for name is rejected", async () => {
    const tenant = createTenant({
      id: "tenant_bypass_type_confusion_name_1",
      code: "TENANT_BYPASS_TYPE_CONFUSION_NAME_1",
      name: "Tenant Type Confusion Name",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: { value: "not-a-string" },
      });

    assertValidationError(response);
  });

  it("Bypass 07: lowercase status cannot bypass enum validation", async () => {
    const tenant = createTenant({
      id: "tenant_bypass_lowercase_status_1",
      code: "TENANT_BYPASS_LOWERCASE_STATUS_1",
      name: "Tenant Lowercase Status",
      status: "ACTIVE",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "active",
      });

    assertValidationError(response);
  });

  it("Bypass 08: SQL-like search payload does not break tenant list query handling", async () => {
    const tenant = createTenant({
      id: "tenant_bypass_sql_like_search_1",
      code: "TENANT_BYPASS_SQL_LIKE_SEARCH_1",
      name: "Safe Tenant",
      status: "ACTIVE",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .query({ q: "' OR 1=1 --" })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("items");
    expect(response.body.data).toHaveProperty("total");
  });
});

describe.sequential("SQL injection hardening tests (extra)", () => {
  const sqlInjectionPayloads = [
    "' OR 1=1 --",
    "' OR '1'='1",
    "%' OR '%'='%",
    "\" OR \"1\"=\"1",
    "'; DROP TABLE Tenant; --",
    "tenant_1' UNION SELECT id,code,name,status FROM User --",
  ];

  it.each(sqlInjectionPayloads)(
    "SQL 01: list q treats SQL payload as literal search input: %s",
    async (payload) => {
      const firstTenant = createTenant({
        id: "tenant_sql_q_literal_1",
        code: "TENANT_SQL_Q_LITERAL_1",
        name: "Tenant SQL Literal One",
      });
      const secondTenant = createTenant({
        id: "tenant_sql_q_literal_2",
        code: "TENANT_SQL_Q_LITERAL_2",
        name: "Tenant SQL Literal Two",
      });
      prismaState.tenants.set(firstTenant.id, firstTenant);
      prismaState.tenants.set(secondTenant.id, secondTenant);

      const accessToken = await buildAccessToken({
        role: "super_admin",
      });

      const response = await request(app)
        .get("/api/tenants")
        .query({ q: payload })
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(0);
      expect(response.body.data.items).toEqual([]);
    },
  );

  it("SQL 02: list q SQL payload is passed to Prisma as data, not a raw query string", async () => {
    const payload = "' OR 1=1 --";
    const tenant = createTenant({
      id: "tenant_sql_prisma_data_1",
      code: "TENANT_SQL_PRISMA_DATA_1",
      name: "Tenant SQL Prisma Data",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .query({ q: payload })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(prismaMock.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          OR: [{ name: { contains: payload } }, { code: { contains: payload } }],
        },
      }),
    );
  });

  it("SQL 03: tenant detail id injection does not resolve an existing tenant", async () => {
    const tenant = createTenant({
      id: "tenant_sql_detail_target_1",
      code: "TENANT_SQL_DETAIL_TARGET_1",
      name: "Tenant SQL Detail Target",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });
    const injectedId = encodeURIComponent(`${tenant.id}' OR '1'='1`);

    const response = await request(app)
      .get(`/api/tenants/${injectedId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    assertNotFound(response);
  });

  it("SQL 04: tenant update id injection cannot update the target tenant", async () => {
    const tenant = createTenant({
      id: "tenant_sql_update_target_1",
      code: "TENANT_SQL_UPDATE_TARGET_1",
      name: "Tenant SQL Update Target",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });
    const injectedId = encodeURIComponent(`${tenant.id}' OR '1'='1`);

    const response = await request(app)
      .patch(`/api/tenants/${injectedId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Should Not Update",
      });

    assertNotFound(response);
    expect(prismaState.tenants.get(tenant.id)?.name).toBe(
      "Tenant SQL Update Target",
    );
  });

  it("SQL 05: current tenant name SQL payload is stored as a literal value", async () => {
    const tenant = createTenant({
      id: "tenant_sql_current_name_1",
      code: "TENANT_SQL_CURRENT_NAME_1",
      name: "Tenant SQL Current Name",
      status: "ACTIVE",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const payload = "'; UPDATE Tenant SET status='SUSPENDED'; --";
    const accessToken = await buildAccessToken({
      role: "shop_admin",
      tenantId: tenant.id,
    });

    const response = await request(app)
      .patch("/api/tenants/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: payload,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant.name).toBe(payload);
    expect(response.body.data.tenant.status).toBe("ACTIVE");
    expect(prismaState.tenants.get(tenant.id)?.name).toBe(payload);
    expect(prismaState.tenants.get(tenant.id)?.status).toBe("ACTIVE");
  });

  it("SQL 06: super-admin tenant name SQL payload is stored as a literal value", async () => {
    const tenant = createTenant({
      id: "tenant_sql_admin_name_1",
      code: "TENANT_SQL_ADMIN_NAME_1",
      name: "Tenant SQL Admin Name",
      status: "ACTIVE",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const payload = "'; DELETE FROM Tenant WHERE '1'='1'; --";
    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: payload,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.tenant.name).toBe(payload);
    expect(response.body.data.tenant.status).toBe("ACTIVE");
    expect(prismaState.tenants.get(tenant.id)?.name).toBe(payload);
    expect(prismaState.tenants.get(tenant.id)?.status).toBe("ACTIVE");
  });

  it("SQL 07: status field rejects SQL-like enum injection", async () => {
    const tenant = createTenant({
      id: "tenant_sql_status_injection_1",
      code: "TENANT_SQL_STATUS_INJECTION_1",
      name: "Tenant SQL Status Injection",
      status: "ACTIVE",
    });
    prismaState.tenants.set(tenant.id, tenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .patch(`/api/tenants/${tenant.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "ACTIVE'; DROP TABLE Tenant; --",
      });

    assertValidationError(response);
    expect(prismaState.tenants.get(tenant.id)?.status).toBe("ACTIVE");
  });

  it("SQL 08: SQL-like q payload still excludes soft-deleted tenants", async () => {
    const visibleTenant = createTenant({
      id: "tenant_sql_visible_1",
      code: "TENANT_SQL_VISIBLE_1",
      name: "Visible Tenant",
      deletedAt: null,
    });
    const deletedTenant = createTenant({
      id: "tenant_sql_deleted_1",
      code: "TENANT_SQL_DELETED_1",
      name: "' OR 1=1 --",
      deletedAt: new Date("2026-05-07T00:00:00.000Z"),
    });
    prismaState.tenants.set(visibleTenant.id, visibleTenant);
    prismaState.tenants.set(deletedTenant.id, deletedTenant);

    const accessToken = await buildAccessToken({
      role: "super_admin",
    });

    const response = await request(app)
      .get("/api/tenants")
      .query({ q: "' OR 1=1 --" })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.total).toBe(0);
    expect(response.body.data.items).toEqual([]);
  });
});
