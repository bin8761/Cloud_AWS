import { describe, expect, it, vi } from "vitest";

import { mapComputerToResponse } from "../../src/modules/computers/computers.mapper";
import {
  listComputersQuerySchema,
  macAddressSchema,
  reissueDeviceTokenSchema,
  registerComputerSchema,
  tenantCodeSchema,
  updateComputerSchema,
} from "../../src/modules/computers/computers.schema";

vi.mock("../../src/modules/auth/auth.password", () => ({
  authPasswordService: {
    hashPassword: vi.fn(),
    comparePassword: vi.fn(async () => false),
  },
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

describe("Computers unit tests (Task 323-344)", () => {
  it("Task 325: tenantCodeSchema trims and normalizes uppercase", () => {
    const parsed = tenantCodeSchema.parse("  cyber01  ");

    expect(parsed).toBe("CYBER01");
  });

  it("Task 326: macAddressSchema accepts valid formats", () => {
    expect(macAddressSchema.parse("AA:BB:CC:DD:EE:FF")).toBe("AA:BB:CC:DD:EE:FF");
    expect(macAddressSchema.parse("aa-bb-cc-dd-ee-ff")).toBe("AA:BB:CC:DD:EE:FF");
    expect(macAddressSchema.parse("aabbccddeeff")).toBe("AA:BB:CC:DD:EE:FF");
  });

  it("Task 327: macAddressSchema rejects invalid formats", () => {
    expect(macAddressSchema.safeParse("AA:BB:CC:DD:EE").success).toBe(false);
    expect(macAddressSchema.safeParse("AA:BB:CC:DD:EE:GG").success).toBe(false);
    expect(macAddressSchema.safeParse("AA.BB.CC.DD.EE.FF").success).toBe(false);
  });

  it("Task 328: macAddressSchema normalizes to uppercase canonical format", () => {
    expect(macAddressSchema.parse("  aa-bb-cc-dd-ee-ff  ")).toBe("AA:BB:CC:DD:EE:FF");
    expect(macAddressSchema.parse("aAbBcCdDeEfF")).toBe("AA:BB:CC:DD:EE:FF");
  });

  it("Task 329: registerComputerSchema is strict object", () => {
    expect(
      registerComputerSchema.safeParse({
        tenantCode: "cyber01",
        registrationSecret: "secret",
        macAddress: "AA:BB:CC:DD:EE:FF",
        name: "PC-01",
      }).success,
    ).toBe(true);

    expect(
      registerComputerSchema.safeParse({
        tenantCode: "cyber01",
        registrationSecret: "secret",
        macAddress: "AA:BB:CC:DD:EE:FF",
        extraField: "not-allowed",
      }).success,
    ).toBe(false);
  });

  it("Task 330: registerComputerSchema rejects tenantId/deviceToken/deviceTokenHash", () => {
    const validPayload = {
      tenantCode: "cyber01",
      registrationSecret: "secret",
      macAddress: "AA:BB:CC:DD:EE:FF",
    };

    expect(
      registerComputerSchema.safeParse({
        ...validPayload,
        tenantId: "tenant_1",
      }).success,
    ).toBe(false);
    expect(
      registerComputerSchema.safeParse({
        ...validPayload,
        deviceToken: "plain-token",
      }).success,
    ).toBe(false);
    expect(
      registerComputerSchema.safeParse({
        ...validPayload,
        deviceTokenHash: "hashed-token",
      }).success,
    ).toBe(false);
  });

  it("Task 331: listComputersQuerySchema defaults page/pageSize", () => {
    const parsed = listComputersQuerySchema.parse({});

    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
  });

  it("Task 332: listComputersQuerySchema rejects pageSize > 100", () => {
    expect(listComputersQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it("Task 333: listComputersQuerySchema validates status enum", () => {
    expect(listComputersQuerySchema.parse({ status: "ACTIVE" }).status).toBe("ACTIVE");
    expect(listComputersQuerySchema.parse({ status: "INACTIVE" }).status).toBe("INACTIVE");
    expect(listComputersQuerySchema.parse({ status: "BLOCKED" }).status).toBe("BLOCKED");
    expect(listComputersQuerySchema.safeParse({ status: "DISABLED" }).success).toBe(false);
  });

  it("Task 334: listComputersQuerySchema trims q and enforces max length", () => {
    expect(listComputersQuerySchema.parse({ q: "  front desk pc  " }).q).toBe("front desk pc");
    expect(listComputersQuerySchema.parse({ q: "   " }).q).toBeUndefined();
    expect(listComputersQuerySchema.safeParse({ q: "a".repeat(101) }).success).toBe(false);
  });

  it("Task 335: listComputersQuerySchema enforces sort allowlist", () => {
    expect(listComputersQuerySchema.parse({ sort: "createdAt:desc" }).sort).toBe("createdAt:desc");
    expect(listComputersQuerySchema.parse({ sort: "createdAt:asc" }).sort).toBe("createdAt:asc");
    expect(listComputersQuerySchema.parse({ sort: "name:asc" }).sort).toBe("name:asc");
    expect(listComputersQuerySchema.parse({ sort: "name:desc" }).sort).toBe("name:desc");
    expect(listComputersQuerySchema.safeParse({ sort: "updatedAt:desc" }).success).toBe(false);
  });

  it("Task 336: updateComputerSchema requires at least one field", () => {
    expect(updateComputerSchema.safeParse({}).success).toBe(false);
    expect(updateComputerSchema.safeParse({ name: "Counter PC" }).success).toBe(true);
  });

  it("Task 337: updateComputerSchema rejects sensitive fields", () => {
    expect(updateComputerSchema.safeParse({ tenantId: "tenant_1" }).success).toBe(false);
    expect(updateComputerSchema.safeParse({ macAddress: "AA:BB:CC:DD:EE:FF" }).success).toBe(false);
    expect(updateComputerSchema.safeParse({ deviceToken: "plain-token" }).success).toBe(false);
    expect(updateComputerSchema.safeParse({ deviceTokenHash: "hashed-token" }).success).toBe(false);
    expect(updateComputerSchema.safeParse({ lastSeenAt: "2026-05-23T00:00:00.000Z" }).success).toBe(
      false,
    );
    expect(updateComputerSchema.safeParse({ createdAt: "2026-05-23T00:00:00.000Z" }).success).toBe(
      false,
    );
    expect(updateComputerSchema.safeParse({ updatedAt: "2026-05-23T00:00:00.000Z" }).success).toBe(
      false,
    );
  });

  it("Task 338: reissueDeviceTokenSchema trims reason and enforces max length", () => {
    expect(reissueDeviceTokenSchema.parse({ reason: "  Reinstall client app  " }).reason).toBe(
      "Reinstall client app",
    );
    expect(reissueDeviceTokenSchema.safeParse({ reason: "a".repeat(201) }).success).toBe(false);
  });

  it("Task 339: mapComputerToResponse omits deviceTokenHash", () => {
    const mapped = mapComputerToResponse({
      id: "computer_1",
      tenantId: "tenant_1",
      name: "PC-01",
      macAddress: "AA:BB:CC:DD:EE:FF",
      status: "ACTIVE",
      lastSeenAt: null,
      notes: null,
      createdAt: new Date("2026-05-23T00:00:00.000Z"),
      updatedAt: new Date("2026-05-23T01:00:00.000Z"),
      ...( { deviceTokenHash: "hidden_hash" } as Record<string, unknown> ),
    } as never);

    expect((mapped as Record<string, unknown>).deviceTokenHash).toBeUndefined();
  });

  it("Task 340: mapComputerToResponse includes approved DTO fields", () => {
    const createdAt = new Date("2026-05-23T00:00:00.000Z");
    const updatedAt = new Date("2026-05-23T01:00:00.000Z");

    const mapped = mapComputerToResponse({
      id: "computer_2",
      tenantId: "tenant_1",
      name: "Front Desk PC",
      macAddress: "AA:BB:CC:DD:EE:11",
      status: "INACTIVE",
      lastSeenAt: new Date("2026-05-23T02:00:00.000Z"),
      notes: "Near cashier",
      createdAt,
      updatedAt,
    });

    expect(mapped).toEqual({
      id: "computer_2",
      tenantId: "tenant_1",
      name: "Front Desk PC",
      macAddress: "AA:BB:CC:DD:EE:11",
      status: "INACTIVE",
      lastSeenAt: "2026-05-23T02:00:00.000Z",
      notes: "Near cashier",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("Task 341: TenantSecretStrategy accepts a correct secret", async () => {
    const { TenantSecretStrategy } = await import(
      "../../src/modules/computers/registration-auth.strategy"
    );
    const strategy = new TenantSecretStrategy({
      comparePassword: async (rawPassword, passwordHash) =>
        rawPassword === "correct-secret" && passwordHash === "stored-hash",
    });

    await expect(strategy.verify("correct-secret", "stored-hash")).resolves.toBe(true);
  });

  it("Task 342: TenantSecretStrategy rejects an incorrect secret", async () => {
    const { TenantSecretStrategy } = await import(
      "../../src/modules/computers/registration-auth.strategy"
    );
    const strategy = new TenantSecretStrategy({
      comparePassword: async () => false,
    });

    await expect(strategy.verify("wrong-secret", "stored-hash")).resolves.toBe(false);
  });

  it("Task 343: TenantSecretStrategy rejects missing stored secret hash", async () => {
    const { TenantSecretStrategy } = await import(
      "../../src/modules/computers/registration-auth.strategy"
    );
    const strategy = new TenantSecretStrategy({
      comparePassword: async () => true,
    });

    await expect(strategy.verify("any-secret", null)).resolves.toBe(false);
  });

  it("Task 344: local token helpers generate high-entropy token and stable-safe hash behavior", async () => {
    const { generateDeviceToken, hashDeviceToken } = await import(
      "../../src/modules/computers/computers.service"
    );

    const tokenA = generateDeviceToken();
    const tokenB = generateDeviceToken();

    expect(tokenA).not.toBe(tokenB);
    expect(tokenA.length).toBeGreaterThan(20);
    expect(tokenB.length).toBeGreaterThan(20);

    const hashA1 = hashDeviceToken(tokenA);
    const hashA2 = hashDeviceToken(tokenA);
    const hashB = hashDeviceToken(tokenB);

    expect(hashA1).toBe(hashA2);
    expect(hashA1).not.toBe(tokenA);
    expect(hashB).not.toBe(tokenB);
    expect(hashA1).not.toBe(hashB);
  });
});
