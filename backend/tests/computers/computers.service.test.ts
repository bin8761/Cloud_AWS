import { TenantStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaTenantFindFirstMock,
  prismaComputerFindFirstMock,
  prismaComputerCreateMock,
  prismaComputerCountMock,
  prismaComputerFindManyMock,
  prismaComputerUpdateManyMock,
  prismaComputerUpdateMock,
  logComputerRegisteredMock,
  logComputerRegisterFailedMock,
  logComputerRegisterConflictMock,
} = vi.hoisted(() => ({
  prismaTenantFindFirstMock: vi.fn(),
  prismaComputerFindFirstMock: vi.fn(),
  prismaComputerCreateMock: vi.fn(),
  prismaComputerCountMock: vi.fn(),
  prismaComputerFindManyMock: vi.fn(),
  prismaComputerUpdateManyMock: vi.fn(),
  prismaComputerUpdateMock: vi.fn(),
  logComputerRegisteredMock: vi.fn(),
  logComputerRegisterFailedMock: vi.fn(),
  logComputerRegisterConflictMock: vi.fn(),
}));

vi.mock("../../src/config/env", () => ({
  env: {
    logging: {
      level: "silent",
    },
    computers: {
      deviceTokenHashSecret: "unit-test-device-token-secret",
    },
  },
}));

vi.mock("../../src/modules/auth/auth.password", () => ({
  authPasswordService: {
    hashPassword: vi.fn(),
    comparePassword: vi.fn(async () => false),
  },
}));

vi.mock("../../src/shared/prisma/prisma.client", () => ({
  prisma: {
    tenant: {
      findFirst: prismaTenantFindFirstMock,
    },
    computer: {
      findFirst: prismaComputerFindFirstMock,
      create: prismaComputerCreateMock,
      count: prismaComputerCountMock,
      findMany: prismaComputerFindManyMock,
      updateMany: prismaComputerUpdateManyMock,
      update: prismaComputerUpdateMock,
    },
  },
}));

vi.mock("../../src/modules/computers/computers.logging", () => ({
  computersLoggingService: {
    logComputerRegistered: logComputerRegisteredMock,
    logComputerRegisterFailed: logComputerRegisterFailedMock,
    logComputerRegisterConflict: logComputerRegisterConflictMock,
    logComputerListed: vi.fn(),
    logComputerViewed: vi.fn(),
    logComputerUpdated: vi.fn(),
    logComputerTokenReissued: vi.fn(),
  },
}));

import { ComputersService } from "../../src/modules/computers/computers.service";

const baseTenant = {
  id: "tenant_1",
  code: "CYBER01",
  status: TenantStatus.ACTIVE,
  computerRegistrationSecretHash: "stored-secret-hash",
};

const baseCreatedComputer = {
  id: "computer_1",
  tenantId: "tenant_1",
  name: "Front Desk PC",
  macAddress: "AA:BB:CC:DD:EE:FF",
  status: "ACTIVE" as const,
  lastSeenAt: null,
  notes: null,
  createdAt: new Date("2026-05-23T00:00:00.000Z"),
  updatedAt: new Date("2026-05-23T00:01:00.000Z"),
};

const createService = (verifyResult: boolean) =>
  new ComputersService(
    {
      tenant: {
        findFirst: prismaTenantFindFirstMock,
      },
      computer: {
        findFirst: prismaComputerFindFirstMock,
        create: prismaComputerCreateMock,
        count: prismaComputerCountMock,
        findMany: prismaComputerFindManyMock,
        updateMany: prismaComputerUpdateManyMock,
        update: prismaComputerUpdateMock,
      },
    } as never,
    {
      verify: vi.fn(async () => verifyResult),
    },
    {
      logComputerRegistered: logComputerRegisteredMock,
      logComputerRegisterFailed: logComputerRegisterFailedMock,
      logComputerRegisterConflict: logComputerRegisterConflictMock,
      logComputerListed: vi.fn(),
      logComputerViewed: vi.fn(),
      logComputerUpdated: vi.fn(),
      logComputerTokenReissued: vi.fn(),
    } as never,
  );

describe("Computers service tests - register flow (Task 345-353)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Task 346: register looks up tenant by normalized code", async () => {
    const service = createService(true);
    prismaTenantFindFirstMock.mockResolvedValueOnce(baseTenant);
    prismaComputerFindFirstMock.mockResolvedValueOnce(null);
    prismaComputerCreateMock.mockResolvedValueOnce(baseCreatedComputer);

    await service.registerComputer({
      tenantCode: "  cyber01  ",
      registrationSecret: "valid-secret",
      macAddress: "aa-bb-cc-dd-ee-ff",
      name: "Front Desk PC",
    });

    expect(prismaTenantFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          code: "CYBER01",
          deletedAt: null,
        }),
      }),
    );
  });

  it("Task 347: register rejects unknown tenant code", async () => {
    const service = createService(true);
    prismaTenantFindFirstMock.mockResolvedValueOnce(null);

    await expect(
      service.registerComputer({
        tenantCode: "UNKNOWN",
        registrationSecret: "any-secret",
        macAddress: "AA:BB:CC:DD:EE:FF",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
  });

  it("Task 348: register rejects inactive tenant with final error mapping", async () => {
    const service = createService(true);
    prismaTenantFindFirstMock.mockResolvedValueOnce({
      ...baseTenant,
      status: TenantStatus.SUSPENDED,
    });

    await expect(
      service.registerComputer({
        tenantCode: "CYBER01",
        registrationSecret: "any-secret",
        macAddress: "AA:BB:CC:DD:EE:FF",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
  });

  it("Task 349: register rejects invalid registration secret", async () => {
    const service = createService(false);
    prismaTenantFindFirstMock.mockResolvedValueOnce(baseTenant);

    await expect(
      service.registerComputer({
        tenantCode: "CYBER01",
        registrationSecret: "wrong-secret",
        macAddress: "AA:BB:CC:DD:EE:FF",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", statusCode: 401 });
  });

  it("Task 350: register detects duplicate (tenantId, macAddress)", async () => {
    const service = createService(true);
    prismaTenantFindFirstMock.mockResolvedValueOnce(baseTenant);
    prismaComputerFindFirstMock.mockResolvedValueOnce({ id: "existing_computer" });

    await expect(
      service.registerComputer({
        tenantCode: "CYBER01",
        registrationSecret: "valid-secret",
        macAddress: "AA:BB:CC:DD:EE:FF",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
  });

  it("Task 351: register stores token hash and not plain token", async () => {
    const service = createService(true);
    prismaTenantFindFirstMock.mockResolvedValueOnce(baseTenant);
    prismaComputerFindFirstMock.mockResolvedValueOnce(null);
    prismaComputerCreateMock.mockResolvedValueOnce(baseCreatedComputer);

    const result = await service.registerComputer({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
      name: "Front Desk PC",
    });

    const createArg = prismaComputerCreateMock.mock.calls[0][0];
    expect(createArg.data.deviceTokenHash).toBeTypeOf("string");
    expect(createArg.data.deviceTokenHash.length).toBeGreaterThan(0);
    expect(createArg.data.deviceTokenHash).not.toBe(result.deviceToken);
  });

  it("Task 352: register returns safe DTO and one-time plain token", async () => {
    const service = createService(true);
    prismaTenantFindFirstMock.mockResolvedValueOnce(baseTenant);
    prismaComputerFindFirstMock.mockResolvedValueOnce(null);
    prismaComputerCreateMock.mockResolvedValueOnce(baseCreatedComputer);

    const result = await service.registerComputer({
      tenantCode: "CYBER01",
      registrationSecret: "valid-secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
      name: "Front Desk PC",
    });

    expect(result.deviceToken).toBeTypeOf("string");
    expect(result.deviceToken.length).toBeGreaterThan(20);
    expect(result.computer).toEqual({
      id: "computer_1",
      tenantId: "tenant_1",
      name: "Front Desk PC",
      macAddress: "AA:BB:CC:DD:EE:FF",
      status: "ACTIVE",
      lastSeenAt: null,
      notes: null,
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:01:00.000Z",
    });
    expect((result.computer as Record<string, unknown>).deviceTokenHash).toBeUndefined();
  });

  it("Task 353: Prisma unique conflict maps to 409 CONFLICT", async () => {
    const service = createService(true);
    prismaTenantFindFirstMock.mockResolvedValueOnce(baseTenant);
    prismaComputerFindFirstMock.mockResolvedValueOnce(null);
    prismaComputerCreateMock.mockRejectedValueOnce({
      code: "P2002",
      meta: {
        target: ["tenantId", "macAddress"],
      },
    });

    await expect(
      service.registerComputer({
        tenantCode: "CYBER01",
        registrationSecret: "valid-secret",
        macAddress: "AA:BB:CC:DD:EE:FF",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
  });

  it("Task 354: list builds tenant-scoped filters", async () => {
    const service = createService(true);
    prismaComputerCountMock.mockResolvedValueOnce(1);
    prismaComputerFindManyMock.mockResolvedValueOnce([baseCreatedComputer]);

    await service.listComputers(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      {
        page: 1,
        pageSize: 20,
      },
    );

    expect(prismaComputerCountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { tenantId: "tenant_1" },
            {},
            {},
          ],
        },
      }),
    );
    expect(prismaComputerFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { tenantId: "tenant_1" },
            {},
            {},
          ],
        },
      }),
    );
  });

  it("Task 355: list applies pagination", async () => {
    const service = createService(true);
    prismaComputerCountMock.mockResolvedValueOnce(25);
    prismaComputerFindManyMock.mockResolvedValueOnce([baseCreatedComputer]);

    await service.listComputers(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      {
        page: 2,
        pageSize: 10,
      },
    );

    expect(prismaComputerFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
  });

  it("Task 356: list applies status filter", async () => {
    const service = createService(true);
    prismaComputerCountMock.mockResolvedValueOnce(1);
    prismaComputerFindManyMock.mockResolvedValueOnce([baseCreatedComputer]);

    await service.listComputers(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      {
        page: 1,
        pageSize: 20,
        status: "BLOCKED",
      },
    );

    expect(prismaComputerCountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { tenantId: "tenant_1" },
            { status: "BLOCKED" },
            {},
          ],
        },
      }),
    );
  });

  it("Task 357: list applies q search over name and MAC address", async () => {
    const service = createService(true);
    prismaComputerCountMock.mockResolvedValueOnce(1);
    prismaComputerFindManyMock.mockResolvedValueOnce([baseCreatedComputer]);

    await service.listComputers(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      {
        page: 1,
        pageSize: 20,
        q: "front",
      },
    );

    expect(prismaComputerFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { tenantId: "tenant_1" },
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

  it("Task 358: list applies allowed sort values", async () => {
    const service = createService(true);
    prismaComputerCountMock.mockResolvedValue(1);
    prismaComputerFindManyMock.mockResolvedValue([baseCreatedComputer]);

    await service.listComputers(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      {
        page: 1,
        pageSize: 20,
        sort: "createdAt:asc",
      },
    );
    expect(prismaComputerFindManyMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "asc" },
      }),
    );

    await service.listComputers(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      {
        page: 1,
        pageSize: 20,
        sort: "name:desc",
      },
    );
    expect(prismaComputerFindManyMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: { name: "desc" },
      }),
    );
  });

  it("Task 359: detail scopes by id + tenantId", async () => {
    const service = createService(true);
    prismaComputerFindFirstMock.mockResolvedValueOnce(baseCreatedComputer);

    await service.getComputerById(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      "computer_1",
    );

    expect(prismaComputerFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "computer_1",
          tenantId: "tenant_1",
        },
      }),
    );
  });

  it("Task 360: detail returns NOT_FOUND for cross-tenant computer", async () => {
    const service = createService(true);
    prismaComputerFindFirstMock.mockResolvedValueOnce(null);

    await expect(
      service.getComputerById(
        {
          userId: "admin_1",
          role: "shop_admin",
          tenantId: "tenant_1",
          tokenType: "access",
        },
        "computer_other_tenant",
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
  });

  it("Task 361: update applies only allowlisted fields", async () => {
    const service = createService(true);
    prismaComputerFindFirstMock.mockResolvedValueOnce(baseCreatedComputer);
    prismaComputerUpdateMock.mockResolvedValueOnce({
      ...baseCreatedComputer,
      name: "Updated Name",
      status: "INACTIVE",
      notes: "Updated Notes",
    });

    await service.updateComputerById(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      "computer_1",
      {
        name: "Updated Name",
        status: "INACTIVE",
        notes: "Updated Notes",
        ...( { tenantId: "tenant_hacker" } as unknown as Record<string, string> ),
      } as never,
    );

    expect(prismaComputerUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "computer_1" },
        data: expect.objectContaining({
          name: "Updated Name",
          status: "INACTIVE",
          notes: "Updated Notes",
        }),
      }),
    );
    expect(prismaComputerUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          tenantId: "tenant_hacker",
        }),
      }),
    );
  });

  it("Task 362: update scopes by id + tenantId", async () => {
    const service = createService(true);
    prismaComputerFindFirstMock.mockResolvedValueOnce(baseCreatedComputer);
    prismaComputerUpdateMock.mockResolvedValueOnce(baseCreatedComputer);

    await service.updateComputerById(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      "computer_1",
      {
        name: "Updated Name",
      },
    );

    expect(prismaComputerFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "computer_1",
          tenantId: "tenant_1",
        },
      }),
    );
  });

  it("Task 363: update returns NOT_FOUND for cross-tenant computer", async () => {
    const service = createService(true);
    prismaComputerFindFirstMock.mockResolvedValueOnce(null);

    await expect(
      service.updateComputerById(
        {
          userId: "admin_1",
          role: "shop_admin",
          tenantId: "tenant_1",
          tokenType: "access",
        },
        "computer_other_tenant",
        {
          name: "Updated Name",
        },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
  });

  it("Task 364: reissue replaces stored token hash", async () => {
    const service = createService(true);
    prismaComputerUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    prismaComputerFindFirstMock.mockResolvedValueOnce(baseCreatedComputer);

    const result = await service.reissueDeviceToken(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      "computer_1",
      {},
    );

    const updateManyArg = prismaComputerUpdateManyMock.mock.calls[0][0];
    expect(updateManyArg.data.deviceTokenHash).toBeTypeOf("string");
    expect(updateManyArg.data.deviceTokenHash.length).toBeGreaterThan(0);
    expect(updateManyArg.data.deviceTokenHash).not.toBe(result.deviceToken);
  });

  it("Task 365: reissue returns a new plain token once", async () => {
    const service = createService(true);
    prismaComputerUpdateManyMock.mockResolvedValue({ count: 1 });
    prismaComputerFindFirstMock.mockResolvedValue(baseCreatedComputer);

    const first = await service.reissueDeviceToken(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      "computer_1",
      {},
    );
    const second = await service.reissueDeviceToken(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      "computer_1",
      {},
    );

    expect(first.deviceToken).toBeTypeOf("string");
    expect(second.deviceToken).toBeTypeOf("string");
    expect(first.deviceToken).not.toBe(second.deviceToken);
  });

  it("Task 366: reissue scopes by id + tenantId", async () => {
    const service = createService(true);
    prismaComputerUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    prismaComputerFindFirstMock.mockResolvedValueOnce(baseCreatedComputer);

    await service.reissueDeviceToken(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      "computer_1",
      {},
    );

    expect(prismaComputerUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: "computer_1",
        tenantId: "tenant_1",
      },
      data: expect.objectContaining({
        deviceTokenHash: expect.any(String),
      }),
    });
    expect(prismaComputerFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "computer_1",
          tenantId: "tenant_1",
        },
      }),
    );
  });

  it("Task 367: service outputs never include deviceTokenHash", async () => {
    const service = createService(true);

    prismaComputerCountMock.mockResolvedValueOnce(1);
    prismaComputerFindManyMock.mockResolvedValueOnce([
      {
        ...baseCreatedComputer,
        ...( { deviceTokenHash: "hidden_hash" } as Record<string, unknown> ),
      },
    ]);
    const listResult = await service.listComputers(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      {
        page: 1,
        pageSize: 20,
      },
    );

    prismaComputerUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    prismaComputerFindFirstMock.mockResolvedValueOnce({
      ...baseCreatedComputer,
      ...( { deviceTokenHash: "hidden_hash_2" } as Record<string, unknown> ),
    });
    const reissueResult = await service.reissueDeviceToken(
      {
        userId: "admin_1",
        role: "shop_admin",
        tenantId: "tenant_1",
        tokenType: "access",
      },
      "computer_1",
      {},
    );

    expect((listResult.items[0] as Record<string, unknown>).deviceTokenHash).toBeUndefined();
    expect((reissueResult.computer as Record<string, unknown>).deviceTokenHash).toBeUndefined();
  });
});
