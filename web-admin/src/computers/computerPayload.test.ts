import { describe, expect, it } from "vitest";
import { buildUpdateComputerPayload } from "./computerPayload";

describe("buildUpdateComputerPayload", () => {
  it("includes only allowlisted fields for update payload", () => {
    const payload = buildUpdateComputerPayload({
      name: "PC-01",
      status: "ACTIVE",
      notes: "Near cashier",
      tenantId: "tenant-1",
      macAddress: "AA:BB:CC:DD:EE:FF",
      deviceToken: "plain-token",
      deviceTokenHash: "hashed-token",
      lastSeenAt: "2026-05-27T00:00:00.000Z",
      createdAt: "2026-05-26T00:00:00.000Z",
      updatedAt: "2026-05-27T01:00:00.000Z",
    });

    expect(payload).toEqual({
      name: "PC-01",
      status: "ACTIVE",
      notes: "Near cashier",
    });
    expect(payload).not.toHaveProperty("tenantId");
    expect(payload).not.toHaveProperty("macAddress");
    expect(payload).not.toHaveProperty("deviceToken");
    expect(payload).not.toHaveProperty("deviceTokenHash");
    expect(payload).not.toHaveProperty("lastSeenAt");
    expect(payload).not.toHaveProperty("createdAt");
    expect(payload).not.toHaveProperty("updatedAt");
  });
});
