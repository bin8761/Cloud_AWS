import { describe, expect, it } from "vitest";
import {
  selectBlockedOrInactiveComputerCount,
  selectOfflineComputerCount,
  selectOnlineComputerCount,
  selectTotalComputerCount,
} from "./dashboardSelectors";
import type { ComputerRowViewModel } from "../computers/computers.types";

function createRow(
  id: string,
  realtimeLabel: ComputerRowViewModel["realtimeLabel"] = "Offline",
  adminStatusLabel: ComputerRowViewModel["adminStatusLabel"] = "Active",
): ComputerRowViewModel {
  return {
    computer: {
      id,
      tenantId: "tenant-1",
      name: "PC",
      macAddress: "AA:BB:CC:DD:EE:FF",
      status: "ACTIVE",
      lastSeenAt: null,
      notes: null,
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z",
    },
    presence: {
      online: false,
      lastSeenAt: null,
      source: "rest",
      receivedAt: "2026-05-27T00:00:00.000Z",
    },
    displayName: "PC",
    adminStatusLabel,
    realtimeLabel,
  };
}

describe("selectTotalComputerCount", () => {
  it("returns total number of rows", () => {
    const rows: ComputerRowViewModel[] = [
      createRow("computer-1"),
      createRow("computer-2"),
      createRow("computer-3"),
    ];

    expect(selectTotalComputerCount(rows)).toBe(3);
  });

  it("returns 0 for empty list", () => {
    expect(selectTotalComputerCount([])).toBe(0);
  });
});

describe("selectOnlineComputerCount", () => {
  it("counts only rows with Online realtime label", () => {
    const rows: ComputerRowViewModel[] = [
      createRow("computer-1", "Online"),
      createRow("computer-2", "Offline"),
      createRow("computer-3", "Online"),
      createRow("computer-4", "Unavailable"),
    ];

    expect(selectOnlineComputerCount(rows)).toBe(2);
  });

  it("returns 0 for empty list", () => {
    expect(selectOnlineComputerCount([])).toBe(0);
  });
});

describe("selectOfflineComputerCount", () => {
  it("counts only rows with Offline realtime label", () => {
    const rows: ComputerRowViewModel[] = [
      createRow("computer-1", "Offline"),
      createRow("computer-2", "Offline"),
      createRow("computer-3", "Online"),
    ];

    expect(selectOfflineComputerCount(rows)).toBe(2);
  });

  it("does not infer Unavailable or Reconnecting rows as Offline", () => {
    const rows: ComputerRowViewModel[] = [
      createRow("computer-1", "Unavailable"),
      createRow("computer-2", "Reconnecting"),
      createRow("computer-3", "Online"),
    ];

    expect(selectOfflineComputerCount(rows)).toBe(0);
  });

  it("returns 0 for empty list", () => {
    expect(selectOfflineComputerCount([])).toBe(0);
  });
});

describe("selectBlockedOrInactiveComputerCount", () => {
  it("counts rows with Blocked or Inactive admin status", () => {
    const rows: ComputerRowViewModel[] = [
      createRow("computer-1", "Online", "Blocked"),
      createRow("computer-2", "Offline", "Inactive"),
      createRow("computer-3", "Offline", "Active"),
      createRow("computer-4", "Unavailable", "Blocked"),
    ];

    expect(selectBlockedOrInactiveComputerCount(rows)).toBe(3);
  });

  it("is independent from realtime offline status", () => {
    const rows: ComputerRowViewModel[] = [
      createRow("computer-1", "Offline", "Active"),
      createRow("computer-2", "Reconnecting", "Active"),
      createRow("computer-3", "Unavailable", "Inactive"),
    ];

    expect(selectBlockedOrInactiveComputerCount(rows)).toBe(1);
  });

  it("returns 0 for empty list", () => {
    expect(selectBlockedOrInactiveComputerCount([])).toBe(0);
  });
});
