import { describe, expect, it } from "vitest";

import {
  listTenantsQuerySchema,
  tenantNameSchema,
  tenantStatusSchema,
} from "../../src/modules/tenants/tenants.schema";
import { mapTenantDto } from "../../src/modules/tenants/tenants.types";

describe("Tenants unit tests (Task 191->203)", () => {
  it("Task 192: mapTenantDto omits deletedAt", () => {
    const mapped = mapTenantDto({
      id: "tenant_1",
      code: "TENANT_1",
      name: "Tenant One",
      status: "ACTIVE",
      deletedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    });

    expect(mapped).not.toHaveProperty("deletedAt");
  });

  it("Task 193: mapTenantDto includes expected fields", () => {
    const createdAt = new Date("2026-02-01T00:00:00.000Z");
    const updatedAt = new Date("2026-02-02T00:00:00.000Z");

    const mapped = mapTenantDto({
      id: "tenant_2",
      code: "TENANT_2",
      name: "Tenant Two",
      status: "SUSPENDED",
      createdAt,
      updatedAt,
    });

    expect(mapped).toEqual({
      id: "tenant_2",
      code: "TENANT_2",
      name: "Tenant Two",
      status: "SUSPENDED",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("Task 194: tenantNameSchema accepts valid input", () => {
    const parsed = tenantNameSchema.parse("  Valid Tenant Name  ");

    expect(parsed).toBe("Valid Tenant Name");
  });

  it("Task 195: tenantNameSchema rejects empty string", () => {
    expect(() => tenantNameSchema.parse("   ")).toThrow();
  });

  it("Task 196: tenantNameSchema rejects max length overflow", () => {
    const tooLongName = "a".repeat(121);

    expect(() => tenantNameSchema.parse(tooLongName)).toThrow();
  });

  it("Task 197: tenantStatusSchema accepts ACTIVE and SUSPENDED", () => {
    expect(tenantStatusSchema.parse("ACTIVE")).toBe("ACTIVE");
    expect(tenantStatusSchema.parse("SUSPENDED")).toBe("SUSPENDED");
  });

  it("Task 198: tenantStatusSchema rejects invalid status", () => {
    expect(() => tenantStatusSchema.parse("PENDING")).toThrow();
  });

  it("Task 199: list query defaults page and pageSize", () => {
    const parsed = listTenantsQuerySchema.parse({});

    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
  });

  it("Task 200: list query rejects invalid page", () => {
    expect(() => listTenantsQuerySchema.parse({ page: "0" })).toThrow();
  });

  it("Task 201: list query rejects invalid pageSize", () => {
    expect(() => listTenantsQuerySchema.parse({ pageSize: "0" })).toThrow();
  });

  it("Task 202: list query rejects pageSize > 100", () => {
    expect(() => listTenantsQuerySchema.parse({ pageSize: "101" })).toThrow();
  });

  it("Task 203: list query trims q", () => {
    const parsed = listTenantsQuerySchema.parse({ q: "  tenant-code  " });

    expect(parsed.q).toBe("tenant-code");
  });
});

