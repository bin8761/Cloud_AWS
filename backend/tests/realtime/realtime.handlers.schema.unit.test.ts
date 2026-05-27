import { describe, expect, it } from "vitest";
import {
  parseAdminWatchTenantPayload,
  parseClientHeartbeatPayload,
} from "../../src/modules/realtime/realtime.handlers";

describe("Realtime handler schema unit tests (Task 215-220)", () => {
  it("Task 215: admin:watch-tenant accepts empty object payload", () => {
    expect(parseAdminWatchTenantPayload({})).toEqual({});
  });

  it("Task 216: admin:watch-tenant rejects unknown fields", () => {
    expect(() =>
      parseAdminWatchTenantPayload({ tenantId: "tenant-1" }),
    ).toThrow();
  });

  it("Task 217: client:heartbeat accepts valid ISO sentAt", () => {
    const payload = parseClientHeartbeatPayload({
      sentAt: "2026-05-25T10:11:12.000Z",
    });

    expect(payload).toEqual({
      sentAt: "2026-05-25T10:11:12.000Z",
    });
  });

  it("Task 218: client:heartbeat rejects missing sentAt", () => {
    expect(() => parseClientHeartbeatPayload({})).toThrow();
  });

  it("Task 219: client:heartbeat rejects invalid sentAt", () => {
    expect(() =>
      parseClientHeartbeatPayload({ sentAt: "not-an-iso-datetime" }),
    ).toThrow();
  });

  it("Task 220: client:heartbeat rejects unknown fields", () => {
    expect(() =>
      parseClientHeartbeatPayload({
        sentAt: "2026-05-25T10:11:12.000Z",
        computerId: "computer-1",
      }),
    ).toThrow();
  });
});

