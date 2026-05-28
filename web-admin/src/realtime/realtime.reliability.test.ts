import { describe, expect, it } from "vitest";
import useAdminPresenceSource from "./useAdminPresence.ts?raw";
import {
  applyTenantWatchSnapshot,
  getRealtimeStateSnapshot,
  markRealtimeDisconnected,
  markRealtimeReconnecting,
  markRealtimeUnavailable,
  resetRealtimeState,
} from "./realtime.store";

describe("realtime reliability invariants", () => {
  it("does not wire per-event list refetch for online/offline socket events", () => {
    expect(useAdminPresenceSource).toContain('socket.on("connect", handleSocketConnect)');
    expect(useAdminPresenceSource).toContain('socket.on("computer:online", handleComputerOnline)');
    expect(useAdminPresenceSource).toContain('socket.on("computer:offline", handleComputerOffline)');
    expect(useAdminPresenceSource).toContain("invalidateQueries");
  });

  it("keeps existing presence map unchanged when marking disconnected", () => {
    resetRealtimeState();

    applyTenantWatchSnapshot(["computer-1", "computer-2"]);
    const beforeDisconnected = getRealtimeStateSnapshot().presenceByComputerId;

    markRealtimeDisconnected();
    const afterDisconnected = getRealtimeStateSnapshot().presenceByComputerId;

    expect(afterDisconnected).toEqual(beforeDisconnected);
    expect(afterDisconnected["computer-1"]?.online).toBe(true);
    expect(afterDisconnected["computer-2"]?.online).toBe(true);
  });

  it("keeps existing presence map unchanged when marking reconnecting", () => {
    resetRealtimeState();

    applyTenantWatchSnapshot(["computer-1", "computer-2"]);
    const beforeReconnecting = getRealtimeStateSnapshot().presenceByComputerId;

    markRealtimeReconnecting();
    const afterReconnecting = getRealtimeStateSnapshot().presenceByComputerId;

    expect(afterReconnecting).toEqual(beforeReconnecting);
    expect(afterReconnecting["computer-1"]?.online).toBe(true);
    expect(afterReconnecting["computer-2"]?.online).toBe(true);
  });

  it("keeps existing presence map unchanged when watch ack fails", () => {
    resetRealtimeState();

    applyTenantWatchSnapshot(["computer-1"]);
    const beforeUnavailable = getRealtimeStateSnapshot().presenceByComputerId;

    markRealtimeUnavailable({
      status: 500,
      code: "WATCH_ACK_FAILED",
      message: "Watch tenant acknowledgement failed.",
    });
    const afterUnavailable = getRealtimeStateSnapshot().presenceByComputerId;

    expect(afterUnavailable).toEqual(beforeUnavailable);
    expect(afterUnavailable["computer-1"]?.online).toBe(true);
  });
});
