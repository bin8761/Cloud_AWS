import { beforeEach, describe, expect, it } from "vitest";
import {
  applyComputerOfflineEvent,
  applyComputerOnlineEvent,
  applyTenantWatchSnapshot,
  getRealtimeStateSnapshot,
  markRealtimeDisconnected,
  markRealtimeReconnecting,
  markRealtimeUnavailable,
  resetRealtimeState,
} from "./realtime.store";

describe("realtime.store reducers", () => {
  beforeEach(() => {
    resetRealtimeState();
  });

  it("applies tenant watch snapshot to presence map", () => {
    applyTenantWatchSnapshot(["computer-1", "computer-2"]);
    const state = getRealtimeStateSnapshot();

    expect(state.presenceByComputerId["computer-1"]?.online).toBe(true);
    expect(state.presenceByComputerId["computer-2"]?.online).toBe(true);
  });

  it("updates matching computer on online event", () => {
    applyComputerOnlineEvent({
      tenantId: "tenant-1",
      computerId: "computer-1",
      lastSeenAt: "2026-05-28T10:00:00.000Z",
    });
    const state = getRealtimeStateSnapshot();

    expect(state.presenceByComputerId["computer-1"]?.online).toBe(true);
    expect(state.presenceByComputerId["computer-1"]?.source).toBe("socket-event");
  });

  it("updates matching computer on offline event", () => {
    applyComputerOfflineEvent({
      tenantId: "tenant-1",
      computerId: "computer-1",
      lastSeenAt: "2026-05-28T11:00:00.000Z",
    });
    const state = getRealtimeStateSnapshot();

    expect(state.presenceByComputerId["computer-1"]?.online).toBe(false);
    expect(state.presenceByComputerId["computer-1"]?.source).toBe("socket-event");
  });

  it("sets reconnecting connection status", () => {
    markRealtimeReconnecting();
    expect(getRealtimeStateSnapshot().connectionStatus).toBe("reconnecting");
  });

  it("sets disconnected connection status", () => {
    markRealtimeDisconnected();
    expect(getRealtimeStateSnapshot().connectionStatus).toBe("disconnected");
  });

  it("sets unavailable status on failed watch ack path", () => {
    markRealtimeUnavailable({
      status: 500,
      code: "WATCH_ACK_FAILED",
      message: "Watch failed",
    });

    const state = getRealtimeStateSnapshot();
    expect(state.connectionStatus).toBe("unavailable");
    expect(state.error?.code).toBe("WATCH_ACK_FAILED");
  });

  it("keeps recent event feed bounded at 50 items", () => {
    for (let index = 0; index < 60; index += 1) {
      applyComputerOnlineEvent({
        tenantId: "tenant-1",
        computerId: `computer-${index}`,
        lastSeenAt: "2026-05-28T12:00:00.000Z",
      });
    }

    const state = getRealtimeStateSnapshot();
    expect(state.recentEventFeed).toHaveLength(50);
    expect(state.recentEventFeed[0]?.payload.computerId).toBe("computer-59");
  });
});
