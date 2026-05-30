export type HeartbeatConnectionState =
  | "Disconnected"
  | "Connecting"
  | "Connected"
  | "Reconnecting"
  | "Error";

export type HeartbeatClientConfig = {
  serverUrl: string;
  computerId: string;
  deviceToken: string;
};

export type HeartbeatStatus = {
  state: HeartbeatConnectionState;
  lastHeartbeatSentAt: string | null;
  lastAckAt: string | null;
  lastError: string | null;
};

export const createHeartbeatStatus = (
  state: HeartbeatConnectionState,
  overrides: Partial<Omit<HeartbeatStatus, "state">> = {}
): HeartbeatStatus => ({
  state,
  lastHeartbeatSentAt: overrides.lastHeartbeatSentAt ?? null,
  lastAckAt: overrides.lastAckAt ?? null,
  lastError: overrides.lastError ?? null
});

export const HEARTBEAT_STATES = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  connected: "Connected",
  reconnecting: "Reconnecting",
  error: "Error"
} as const satisfies Record<string, HeartbeatConnectionState>;
