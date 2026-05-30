import { describe, expect, it } from "vitest";

import {
  DEFAULT_HEARTBEAT_CLIENT_CONFIG,
  DEFAULT_SERVER_URL,
  REALTIME_CLIENT_TYPE_COMPUTER,
  REALTIME_HEARTBEAT_EVENT
} from "./realtimeProtocol";
import { HEARTBEAT_STATES, createHeartbeatStatus } from "./types";

describe("realtimeProtocol constants", () => {
  it("defines computer client type and heartbeat event", () => {
    expect(REALTIME_CLIENT_TYPE_COMPUTER).toBe("computer");
    expect(REALTIME_HEARTBEAT_EVENT).toBe("client:heartbeat");
  });

  it("defines default config values", () => {
    expect(DEFAULT_SERVER_URL).toBe("http://localhost:3000");
    expect(DEFAULT_HEARTBEAT_CLIENT_CONFIG).toEqual({
      serverUrl: "http://localhost:3000",
      computerId: "",
      deviceToken: ""
    });
  });
});

describe("heartbeat status helpers", () => {
  it("exposes all required status states", () => {
    expect(HEARTBEAT_STATES).toEqual({
      disconnected: "Disconnected",
      connecting: "Connecting",
      connected: "Connected",
      reconnecting: "Reconnecting",
      error: "Error"
    });
  });

  it("creates status snapshot with null defaults", () => {
    expect(createHeartbeatStatus("Connected")).toEqual({
      state: "Connected",
      lastHeartbeatSentAt: null,
      lastAckAt: null,
      lastError: null
    });
  });

  it("creates status snapshot with override values", () => {
    expect(
      createHeartbeatStatus("Error", {
        lastHeartbeatSentAt: "2026-05-29T10:00:00.000Z",
        lastAckAt: "2026-05-29T10:00:01.000Z",
        lastError: "Cannot connect to server"
      })
    ).toEqual({
      state: "Error",
      lastHeartbeatSentAt: "2026-05-29T10:00:00.000Z",
      lastAckAt: "2026-05-29T10:00:01.000Z",
      lastError: "Cannot connect to server"
    });
  });
});
