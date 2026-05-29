import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaBlockRuleCountMock,
  prismaBlockRuleCreateMock,
  prismaBlockRuleFindManyMock,
  prismaBlockRuleFindFirstMock,
  prismaBlockRuleUpdateMock,
  prismaBlockRuleDeleteMock,
  prismaComputerFindUniqueMock,
  prismaTransactionMock,
  emitBlockRulesUpdatedMock,
} = vi.hoisted(() => ({
  prismaBlockRuleCountMock: vi.fn(),
  prismaBlockRuleCreateMock: vi.fn(),
  prismaBlockRuleFindManyMock: vi.fn(),
  prismaBlockRuleFindFirstMock: vi.fn(),
  prismaBlockRuleUpdateMock: vi.fn(),
  prismaBlockRuleDeleteMock: vi.fn(),
  prismaComputerFindUniqueMock: vi.fn(),
  prismaTransactionMock: vi.fn(),
  emitBlockRulesUpdatedMock: vi.fn(),
}));

vi.mock("../../src/shared/prisma/prisma.client", () => ({
  prisma: {
    blockRule: {
      count: prismaBlockRuleCountMock,
      create: prismaBlockRuleCreateMock,
      findMany: prismaBlockRuleFindManyMock,
      findFirst: prismaBlockRuleFindFirstMock,
      update: prismaBlockRuleUpdateMock,
      delete: prismaBlockRuleDeleteMock,
    },
    computer: {
      findUnique: prismaComputerFindUniqueMock,
    },
    $transaction: prismaTransactionMock,
  },
}));

vi.mock("../../src/modules/computers/computers.service", () => ({
  hashDeviceToken: (token: string) => `hash:${token}`,
}));

vi.mock("../../src/modules/block-rules/block-rules.logging", () => ({
  blockRulesLoggingService: {
    logBlockRuleCreated: vi.fn(),
    logBlockRuleBatchCreated: vi.fn(),
    logBlockRuleListed: vi.fn(),
    logBlockRuleViewed: vi.fn(),
    logBlockRuleUpdated: vi.fn(),
    logBlockRuleDeleted: vi.fn(),
    logActiveRulesFetched: vi.fn(),
  },
}));

import {
  createBlockRuleSchema,
  updateBlockRuleSchema,
} from "../../src/modules/block-rules/block-rules.schema";
import {
  BlockRulesService,
  setBlockRulesRealtimeGateway,
} from "../../src/modules/block-rules/block-rules.service";

const authContext = {
  userId: "admin_1",
  role: "shop_admin" as const,
  tenantId: "tenant_1",
  tokenType: "access" as const,
};

const blockRuleRecord = {
  id: "rule_1",
  tenantId: "tenant_1",
  type: "URL" as const,
  value: "*.facebook.com",
  label: "Facebook",
  reason: "No social browsing",
  status: "ACTIVE" as const,
  priority: 10,
  createdBy: "admin_1",
  createdAt: new Date("2026-05-27T00:00:00.000Z"),
  updatedAt: new Date("2026-05-27T00:01:00.000Z"),
};

const createService = () =>
  new BlockRulesService({
    blockRule: {
      count: prismaBlockRuleCountMock,
      create: prismaBlockRuleCreateMock,
      findMany: prismaBlockRuleFindManyMock,
      findFirst: prismaBlockRuleFindFirstMock,
      update: prismaBlockRuleUpdateMock,
      delete: prismaBlockRuleDeleteMock,
    },
    computer: {
      findUnique: prismaComputerFindUniqueMock,
    },
    $transaction: prismaTransactionMock,
  } as never);

describe("Block rules unit tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setBlockRulesRealtimeGateway({
      emitComputerOnline: vi.fn(),
      emitComputerOffline: vi.fn(),
      emitBlockRulesUpdated: emitBlockRulesUpdatedMock,
    });
  });

  it("validates create and update payloads strictly", () => {
    expect(
      createBlockRuleSchema.parse({
        type: "URL",
        value: "  *.facebook.com  ",
        priority: "7",
      }),
    ).toMatchObject({
      type: "URL",
      value: "*.facebook.com",
      priority: 7,
    });
    expect(createBlockRuleSchema.safeParse({ type: "DOMAIN", value: "x" }).success).toBe(false);
    expect(updateBlockRuleSchema.safeParse({}).success).toBe(false);
    expect(updateBlockRuleSchema.safeParse({ tenantId: "tenant_hacker" }).success).toBe(false);
  });

  it("creates tenant-scoped rule and broadcasts sync event", async () => {
    const service = createService();
    prismaBlockRuleCountMock.mockResolvedValueOnce(0);
    prismaBlockRuleCreateMock.mockResolvedValueOnce(blockRuleRecord);

    const result = await service.createBlockRule(authContext, {
      type: "URL",
      value: "*.facebook.com",
      label: "Facebook",
      reason: "No social browsing",
      priority: 10,
    });

    expect(prismaBlockRuleCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant_1",
          createdBy: "admin_1",
        }),
      }),
    );
    expect(emitBlockRulesUpdatedMock).toHaveBeenCalledWith(
      "tenant_1",
      expect.objectContaining({ action: "created", tenantId: "tenant_1" }),
    );
    expect(result.createdAt).toBe("2026-05-27T00:00:00.000Z");
  });

  it("rejects duplicate tenant type value conflicts", async () => {
    const service = createService();
    prismaBlockRuleCountMock.mockResolvedValueOnce(0);
    prismaBlockRuleCreateMock.mockRejectedValueOnce({
      code: "P2002",
      meta: { target: ["tenantId", "type", "value"] },
    });

    await expect(
      service.createBlockRule(authContext, {
        type: "PROCESS",
        value: "steam.exe",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
  });

  it("enforces 500 rules per tenant", async () => {
    const service = createService();
    prismaBlockRuleCountMock.mockResolvedValueOnce(500);

    await expect(
      service.createBlockRule(authContext, {
        type: "KEYWORD",
        value: "game",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
  });

  it("lists rules with tenant filters, search, sort, and pagination", async () => {
    const service = createService();
    prismaBlockRuleCountMock.mockResolvedValueOnce(1);
    prismaBlockRuleFindManyMock.mockResolvedValueOnce([blockRuleRecord]);

    const result = await service.listBlockRules(authContext, {
      page: 2,
      pageSize: 10,
      type: "URL",
      status: "ACTIVE",
      q: "facebook",
      sort: "priority:desc",
    });

    expect(prismaBlockRuleFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: { priority: "desc" },
      }),
    );
    expect(result.totalPages).toBe(1);
  });

  it("authenticates active computer device token for client fetch", async () => {
    const service = createService();
    prismaComputerFindUniqueMock.mockResolvedValueOnce({
      id: "computer_1",
      tenantId: "tenant_1",
      status: "ACTIVE",
      deviceTokenHash: "hash:raw-token",
    });

    await expect(
      service.authenticateComputerByDeviceToken({
        computerId: "computer_1",
        deviceToken: "raw-token",
      }),
    ).resolves.toEqual({
      computerId: "computer_1",
      tenantId: "tenant_1",
    });
  });
});
