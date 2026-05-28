import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/shared/prisma/prisma.client", () => ({
  prisma: {
    computer: {
      updateMany: vi.fn(),
    },
  },
}));
import {
  parseAdminComputerControlPayload,
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

  it("Task 255: admin:computer-control accepts unlock timed payload", () => {
    const payload = parseAdminComputerControlPayload({
      computerId: "computer-1",
      action: "unlock",
      mode: "timed",
      durationMinutes: 120,
    });

    expect(payload).toEqual({
      computerId: "computer-1",
      action: "unlock",
      mode: "timed",
      durationMinutes: 120,
    });
  });

  it("Task 256: admin:computer-control rejects lock with duration fields", () => {
    expect(() =>
      parseAdminComputerControlPayload({
        computerId: "computer-1",
        action: "lock",
        mode: "timed",
        durationMinutes: 10,
      }),
    ).toThrow();
  });

  it("Task 257: admin:computer-control rejects unlock timed without duration", () => {
    expect(() =>
      parseAdminComputerControlPayload({
        computerId: "computer-1",
        action: "unlock",
        mode: "timed",
      }),
    ).toThrow();
  });
});
