import { describe, expect, it } from "vitest";
import {
  createStaffUserSchema,
  listStaffUsersQuerySchema,
  staffEmailSchema,
  staffFullNameSchema,
  staffStatusSchema,
  updateStaffUserSchema,
} from "../../src/modules/users/users.schema";
import { mapStaffUserDto } from "../../src/modules/users/users.types";

describe("Users unit tests (Task 277->284)", () => {
  it("Task 277/278: mapStaffUserDto omits passwordHash/deletedAt/relations", () => {
    const now = new Date("2026-05-22T00:00:00.000Z");
    const input = {
      id: "user_1",
      tenantId: "tenant_1",
      email: "staff@example.com",
      fullName: "Staff User",
      role: "STAFF" as const,
      status: "ACTIVE" as const,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
      passwordHash: "hash",
      deletedAt: now,
      refreshTokens: [{ id: "rt1" }],
    };

    const dto = mapStaffUserDto(input as never);
    expect(dto).toMatchObject({
      id: "user_1",
      tenantId: "tenant_1",
      role: "STAFF",
      status: "ACTIVE",
    });
    expect((dto as Record<string, unknown>).passwordHash).toBeUndefined();
    expect((dto as Record<string, unknown>).deletedAt).toBeUndefined();
    expect((dto as Record<string, unknown>).refreshTokens).toBeUndefined();
  });

  it("Task 279: staffEmailSchema normalizes and validates", () => {
    expect(staffEmailSchema.parse("  Staff.New@Example.COM  ")).toBe("staff.new@example.com");
    expect(staffEmailSchema.safeParse("bad-email").success).toBe(false);
  });

  it("Task 280: staffFullNameSchema trims and enforces length", () => {
    expect(staffFullNameSchema.parse("  Alice  ")).toBe("Alice");
    expect(staffFullNameSchema.safeParse(" ").success).toBe(false);
    expect(staffFullNameSchema.safeParse("A".repeat(121)).success).toBe(false);
  });

  it("Task 281: staffStatusSchema accepts only ACTIVE/DISABLED", () => {
    expect(staffStatusSchema.parse("ACTIVE")).toBe("ACTIVE");
    expect(staffStatusSchema.parse("DISABLED")).toBe("DISABLED");
    expect(staffStatusSchema.safeParse("LOCKED").success).toBe(false);
  });

  it("Task 282: createStaffUserSchema is strict and rejects protected fields", () => {
    expect(
      createStaffUserSchema.safeParse({
        email: "staff@example.com",
        fullName: "Staff User",
        password: "Temp@123456",
      }).success,
    ).toBe(true);

    expect(
      createStaffUserSchema.safeParse({
        email: "staff@example.com",
        fullName: "Staff User",
        password: "Temp@123456",
        role: "SUPER_ADMIN",
      }).success,
    ).toBe(false);
  });

  it("Task 283: updateStaffUserSchema requires at least one field and rejects protected fields", () => {
    expect(updateStaffUserSchema.safeParse({}).success).toBe(false);
    expect(updateStaffUserSchema.safeParse({ fullName: "Updated" }).success).toBe(true);
    expect(updateStaffUserSchema.safeParse({ email: "x@example.com" }).success).toBe(false);
  });

  it("Task 284: listStaffUsersQuerySchema defaults/parses/caps/normalizes q", () => {
    const parsedDefault = listStaffUsersQuerySchema.parse({});
    expect(parsedDefault.page).toBe(1);
    expect(parsedDefault.pageSize).toBe(20);

    const parsed = listStaffUsersQuerySchema.parse({
      page: "2",
      pageSize: "50",
      q: "  hello  ",
    });
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(50);
    expect(parsed.q).toBe("hello");
    expect(listStaffUsersQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(listStaffUsersQuerySchema.parse({ q: "   " }).q).toBeUndefined();
  });
});

