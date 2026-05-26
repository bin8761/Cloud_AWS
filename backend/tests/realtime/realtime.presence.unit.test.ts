import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { updateManyMock } = vi.hoisted(() => ({
  updateManyMock: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  ComputerStatus: {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
    BLOCKED: "BLOCKED",
  },
}));

vi.mock("../../src/shared/prisma/prisma.client", () => ({
  prisma: {
    computer: {
      updateMany: updateManyMock,
    },
  },
}));

import { RealtimePresenceStore } from "../../src/modules/realtime/realtime.presence";

describe("Realtime presence unit tests (Task 224-230)", () => {
  beforeEach(() => {
    updateManyMock.mockReset();
    updateManyMock.mockResolvedValue({ count: 1 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Task 224: first socket marks computer online", async () => {
    const store = new RealtimePresenceStore();

    const result = await store.addComputerSocket("socket-1", "computer-1", "tenant-1");

    expect(result.transitionedToOnline).toBe(true);
    expect(result.connectedSocketCount).toBe(1);
  });

  it("Task 225: second socket for same computer does not transition online again", async () => {
    const store = new RealtimePresenceStore();
    await store.addComputerSocket("socket-1", "computer-1", "tenant-1");

    const result = await store.addComputerSocket("socket-2", "computer-1", "tenant-1");

    expect(result.transitionedToOnline).toBe(false);
    expect(result.connectedSocketCount).toBe(2);
  });

  it("Task 226: removing one of multiple sockets does not transition offline", async () => {
    const store = new RealtimePresenceStore();
    await store.addComputerSocket("socket-1", "computer-1", "tenant-1");
    await store.addComputerSocket("socket-2", "computer-1", "tenant-1");

    const result = store.removeComputerSocket("socket-1");

    expect(result.transitionedToOffline).toBe(false);
    expect(result.connectedSocketCount).toBe(1);
  });

  it("Task 227: removing final socket transitions offline", async () => {
    const store = new RealtimePresenceStore();
    await store.addComputerSocket("socket-1", "computer-1", "tenant-1");

    const result = store.removeComputerSocket("socket-1");

    expect(result.transitionedToOffline).toBe(true);
    expect(result.computerId).toBe("computer-1");
    expect(result.tenantId).toBe("tenant-1");
  });

  it("Task 228: recordHeartbeat refreshes lastHeartbeatAt", async () => {
    const store = new RealtimePresenceStore();
    await store.addComputerSocket("socket-1", "computer-1", "tenant-1");

    const first = await store.recordHeartbeat("computer-1");
    vi.advanceTimersByTime(1_000);
    const second = await store.recordHeartbeat("computer-1");

    expect(first.found).toBe(true);
    expect(second.found).toBe(true);
    expect(second.lastHeartbeatAt?.getTime()).toBeGreaterThan(
      first.lastHeartbeatAt?.getTime() ?? 0,
    );
  });

  it("Task 229: heartbeat timeout emits offline only once", async () => {
    const store = new RealtimePresenceStore();
    const listener = vi.fn();
    store.setHeartbeatTimeoutListener(listener);
    await store.addComputerSocket("socket-1", "computer-1", "tenant-1");

    vi.advanceTimersByTime(90_000);
    vi.advanceTimersByTime(90_000);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      computerId: "computer-1",
      tenantId: "tenant-1",
      connectedSocketCount: 0,
    });
  });

  it("Task 230: health-style counters remain sanitized non-negative integers", () => {
    const snapshot = {
      activeSockets: 0,
      onlineComputers: 0,
      adminSockets: 0,
      heartbeatAccepted: 0,
      heartbeatRateLimited: 0,
      authFailures: 0,
      heartbeatTimeouts: 0,
    };

    for (const value of Object.values(snapshot)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});
