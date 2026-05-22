import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaUserFindUniqueMock,
  prismaUserCreateMock,
  prismaUserCountMock,
  prismaUserFindManyMock,
  prismaUserFindFirstMock,
  prismaUserUpdateMock,
  hashPasswordMock,
} = vi.hoisted(() => ({
  prismaUserFindUniqueMock: vi.fn(),
  prismaUserCreateMock: vi.fn(),
  prismaUserCountMock: vi.fn(),
  prismaUserFindManyMock: vi.fn(),
  prismaUserFindFirstMock: vi.fn(),
  prismaUserUpdateMock: vi.fn(),
  hashPasswordMock: vi.fn(),
}));

vi.mock("../../src/shared/prisma/prisma.client", () => ({
  prisma: {
    user: {
      findUnique: prismaUserFindUniqueMock,
      create: prismaUserCreateMock,
      count: prismaUserCountMock,
      findMany: prismaUserFindManyMock,
      findFirst: prismaUserFindFirstMock,
      update: prismaUserUpdateMock,
    },
  },
}));

vi.mock("../../src/modules/auth/auth.password", () => ({
  authPasswordService: {
    hashPassword: hashPasswordMock,
  },
}));

vi.mock("../../src/modules/users/users.logging", () => ({
  USERS_LOG_EVENTS: {
    STAFF_CREATED: "user.staff.created",
    STAFF_UPDATED: "user.staff.updated",
    STAFF_STATUS_UPDATED: "user.staff.status.updated",
    STAFF_PASSWORD_RESET: "user.staff.password.reset",
  },
  usersLoggingService: {
    logStaffCreated: vi.fn(),
    logStaffUpdated: vi.fn(),
    logStaffStatusUpdated: vi.fn(),
    logStaffPasswordReset: vi.fn(),
  },
}));

import { usersService } from "../../src/modules/users/users.service";

const authContext = {
  userId: "shop_admin_1",
  role: "shop_admin" as const,
  tenantId: "tenant_1",
  tokenType: "access" as const,
  requestId: "req_1",
};

const dtoRecord = {
  id: "staff_1",
  tenantId: "tenant_1",
  email: "staff@example.com",
  fullName: "Staff User",
  role: "STAFF" as const,
  status: "ACTIVE" as const,
  lastLoginAt: null,
  createdAt: new Date("2026-05-22T00:00:00.000Z"),
  updatedAt: new Date("2026-05-22T00:00:00.000Z"),
};

describe("Users service tests (Task 285->294)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Task 285/286/287: createStaffUser hashes password and creates STAFF only", async () => {
    prismaUserFindUniqueMock.mockResolvedValueOnce(null);
    hashPasswordMock.mockResolvedValueOnce("hashed_pwd");
    prismaUserCreateMock.mockResolvedValueOnce(dtoRecord);

    await usersService.createStaffUser(authContext, {
      email: " Staff@Example.com ",
      fullName: "Staff User",
      password: "Temp@123456",
    });

    expect(hashPasswordMock).toHaveBeenCalledWith("Temp@123456");
    expect(prismaUserCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant_1",
          email: "staff@example.com",
          role: "STAFF",
          status: "ACTIVE",
          passwordHash: "hashed_pwd",
        }),
      }),
    );
  });

  it("Task 288: createStaffUser returns CONFLICT for duplicate email", async () => {
    prismaUserFindUniqueMock.mockResolvedValueOnce({ id: "existing_1" });
    await expect(
      usersService.createStaffUser(authContext, {
        email: "staff@example.com",
        fullName: "Staff User",
        password: "Temp@123456",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
  });

  it("Task 289/290: listStaffUsers builds pagination and staff tenant filter", async () => {
    prismaUserCountMock.mockResolvedValueOnce(1);
    prismaUserFindManyMock.mockResolvedValueOnce([dtoRecord]);

    await usersService.listStaffUsers(authContext, {
      page: 2,
      pageSize: 10,
      q: "abc",
    });

    expect(prismaUserCountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant_1",
          role: "STAFF",
          deletedAt: null,
        }),
      }),
    );
    expect(prismaUserFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
  });

  it("Task 291: getStaffUserById returns NOT_FOUND for cross-tenant or non-STAFF", async () => {
    prismaUserFindFirstMock.mockResolvedValueOnce(null);
    await expect(usersService.getStaffUserById(authContext, "staff_x")).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
  });

  it("Task 292/293: updateStaffUserById applies allowlisted fields and hashes password", async () => {
    prismaUserFindFirstMock
      .mockResolvedValueOnce({ id: "staff_1", fullName: "Old", status: "ACTIVE" })
      .mockResolvedValueOnce({ ...dtoRecord, fullName: "New", status: "DISABLED" });
    hashPasswordMock.mockResolvedValueOnce("hashed_reset_pwd");
    prismaUserUpdateMock.mockResolvedValueOnce({});

    await usersService.updateStaffUserById(authContext, "staff_1", {
      fullName: "New",
      status: "DISABLED",
      password: "Temp@999999",
    });

    expect(hashPasswordMock).toHaveBeenCalledWith("Temp@999999");
    expect(prismaUserUpdateMock).toHaveBeenCalledWith({
      where: { id: "staff_1" },
      data: {
        fullName: "New",
        status: "DISABLED",
        passwordHash: "hashed_reset_pwd",
      },
    });
  });

  it("Task 294: updateStaffUserById returns NOT_FOUND for missing/deleted/cross-tenant/non-STAFF", async () => {
    prismaUserFindFirstMock.mockResolvedValueOnce(null);
    await expect(
      usersService.updateStaffUserById(authContext, "staff_missing", {
        fullName: "Updated",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
  });
});

describe("Users service security hardening tests (extra)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("simulates duplicate race: second create attempt is rejected", async () => {
    prismaUserFindUniqueMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "existing_2" });
    hashPasswordMock.mockResolvedValue("hashed_pwd");
    prismaUserCreateMock.mockResolvedValue(dtoRecord);

    await usersService.createStaffUser(authContext, {
      email: "staff@example.com",
      fullName: "Staff User",
      password: "Temp@123456",
    });

    await expect(
      usersService.createStaffUser(authContext, {
        email: "staff@example.com",
        fullName: "Staff User",
        password: "Temp@123456",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("never trusts caller tenantId-like fields in update patch", async () => {
    prismaUserFindFirstMock
      .mockResolvedValueOnce({ id: "staff_2", fullName: "Old", status: "ACTIVE" })
      .mockResolvedValueOnce({ ...dtoRecord, id: "staff_2", fullName: "Safe" });
    prismaUserUpdateMock.mockResolvedValueOnce({});

    await usersService.updateStaffUserById(authContext, "staff_2", {
      fullName: "Safe",
      // extra runtime field should be ignored by allowlist builder
      ...( { tenantId: "tenant_hacker" } as unknown as Record<string, string> ),
    } as never);

    expect(prismaUserUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          tenantId: "tenant_hacker",
        }),
      }),
    );
  });
});
