import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaTenantFindFirstMock,
  prismaTenantCountMock,
  prismaTenantFindManyMock,
  prismaTenantUpdateManyMock,
  logTenantNameUpdatedMock,
  logTenantStatusUpdatedMock,
} = vi.hoisted(() => ({
  prismaTenantFindFirstMock: vi.fn(),
  prismaTenantCountMock: vi.fn(),
  prismaTenantFindManyMock: vi.fn(),
  prismaTenantUpdateManyMock: vi.fn(),
  logTenantNameUpdatedMock: vi.fn(),
  logTenantStatusUpdatedMock: vi.fn(),
}));

vi.mock("../../src/shared/prisma/prisma.client", () => ({
  prisma: {
    tenant: {
      findFirst: prismaTenantFindFirstMock,
      count: prismaTenantCountMock,
      findMany: prismaTenantFindManyMock,
      updateMany: prismaTenantUpdateManyMock,
    },
  },
}));

vi.mock("../../src/modules/tenants/tenants.logging", () => ({
  tenantsLoggingService: {
    logTenantNameUpdated: logTenantNameUpdatedMock,
    logTenantStatusUpdated: logTenantStatusUpdatedMock,
  },
}));

import { TenantsService } from "../../src/modules/tenants/tenants.service";

type TenantRecord = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: Date;
  updatedAt: Date;
};

const createTenant = (overrides: Partial<TenantRecord> = {}): TenantRecord => ({
  id: "tenant_1",
  code: "TENANT_1",
  name: "Tenant One",
  status: "ACTIVE",
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-05-02T00:00:00.000Z"),
  ...overrides,
});

describe("Tenants service tests (Task 204->209)", () => {
  let service: TenantsService;

  beforeEach(() => {
    prismaTenantFindFirstMock.mockReset();
    prismaTenantCountMock.mockReset();
    prismaTenantFindManyMock.mockReset();
    prismaTenantUpdateManyMock.mockReset();
    logTenantNameUpdatedMock.mockReset();
    logTenantStatusUpdatedMock.mockReset();

    prismaTenantCountMock.mockResolvedValue(0);
    prismaTenantFindManyMock.mockResolvedValue([]);
    prismaTenantUpdateManyMock.mockResolvedValue({ count: 1 });

    service = new TenantsService();
  });

  it("Task 204: listTenants builds pagination correctly", async () => {
    const tenantA = createTenant({ id: "tenant_a" });
    const tenantB = createTenant({ id: "tenant_b", code: "TENANT_B" });
    prismaTenantCountMock.mockResolvedValue(2);
    prismaTenantFindManyMock.mockResolvedValue([tenantA, tenantB]);

    const result = await service.listTenants({
      page: 3,
      pageSize: 10,
      status: "ACTIVE",
      q: "  tenant  ",
    });

    expect(prismaTenantCountMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        OR: [{ name: { contains: "tenant" } }, { code: { contains: "tenant" } }],
      },
    });
    expect(prismaTenantFindManyMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        OR: [{ name: { contains: "tenant" } }, { code: { contains: "tenant" } }],
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: 20,
      take: 10,
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(result).toMatchObject({
      page: 3,
      pageSize: 10,
      total: 2,
    });
  });

  it("Task 205: listTenants always filters deletedAt: null", async () => {
    prismaTenantCountMock.mockResolvedValue(0);
    prismaTenantFindManyMock.mockResolvedValue([]);

    await service.listTenants({
      page: 1,
      pageSize: 20,
    });

    expect(prismaTenantCountMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
      },
    });
    expect(prismaTenantFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
        },
      }),
    );
  });

  it("Task 206: updateCurrentTenantName uses auth context tenant id", async () => {
    const currentTenant = createTenant({ id: "tenant_ctx" });
    const updatedTenant = createTenant({
      id: "tenant_ctx",
      name: "Renamed Tenant",
      updatedAt: new Date("2026-05-03T00:00:00.000Z"),
    });
    prismaTenantFindFirstMock
      .mockResolvedValueOnce(currentTenant)
      .mockResolvedValueOnce(updatedTenant);
    prismaTenantUpdateManyMock.mockResolvedValue({ count: 1 });

    await service.updateCurrentTenantName(
      {
        userId: "user_1",
        role: "shop_admin",
        tenantId: "  tenant_ctx  ",
      },
      {
        name: "Renamed Tenant",
      },
    );

    expect(prismaTenantFindFirstMock).toHaveBeenNthCalledWith(1, {
      where: {
        deletedAt: null,
        id: "tenant_ctx",
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
    expect(prismaTenantUpdateManyMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        id: "tenant_ctx",
      },
      data: {
        name: "Renamed Tenant",
      },
    });
    expect(logTenantNameUpdatedMock).toHaveBeenCalledWith({
      actorUserId: "user_1",
      actorRole: "shop_admin",
      actorTenantId: "  tenant_ctx  ",
      targetTenantId: "tenant_ctx",
    });
  });

  it("Task 207: updateTenantById only applies allowlisted fields", async () => {
    const targetTenant = createTenant({ id: "tenant_allowlist", status: "ACTIVE" });
    const updatedTenant = createTenant({
      id: "tenant_allowlist",
      name: "New Name",
      status: "SUSPENDED",
    });
    prismaTenantFindFirstMock
      .mockResolvedValueOnce(targetTenant)
      .mockResolvedValueOnce(updatedTenant);
    prismaTenantUpdateManyMock.mockResolvedValue({ count: 1 });

    await service.updateTenantById(
      {
        userId: "super_1",
        role: "super_admin",
        tenantId: null,
      },
      "tenant_allowlist",
      {
        name: "New Name",
        status: "SUSPENDED",
        code: "MUST_NOT_APPLY",
        id: "MUST_NOT_APPLY",
      } as unknown as Parameters<TenantsService["updateTenantById"]>[2],
    );

    expect(prismaTenantUpdateManyMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        id: "tenant_allowlist",
      },
      data: {
        name: "New Name",
        status: "SUSPENDED",
      },
    });
  });

  it("Task 208: updateTenantById throws NOT_FOUND for missing tenants", async () => {
    prismaTenantFindFirstMock.mockResolvedValueOnce(null);

    await expect(
      service.updateTenantById(
        {
          userId: "super_1",
          role: "super_admin",
          tenantId: null,
        },
        "missing_tenant",
        {
          name: "Renamed",
        },
      ),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
    expect(prismaTenantUpdateManyMock).not.toHaveBeenCalled();
  });

  it("Task 209: updateTenantById throws NOT_FOUND for deleted tenants", async () => {
    prismaTenantFindFirstMock.mockResolvedValueOnce(
      createTenant({ id: "tenant_soft_deleted" }),
    );
    prismaTenantUpdateManyMock.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.updateTenantById(
        {
          userId: "super_1",
          role: "super_admin",
          tenantId: null,
        },
        "tenant_soft_deleted",
        {
          name: "New Name",
        },
      ),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
  });
});
