import type { HeartbeatClientConfig } from "./types";

export const REALTIME_CLIENT_TYPE_COMPUTER = "computer" as const;
export const REALTIME_HEARTBEAT_EVENT = "client:heartbeat" as const;
export const DEFAULT_SERVER_URL = "http://localhost:3000";

export const DEFAULT_HEARTBEAT_CLIENT_CONFIG: HeartbeatClientConfig = {
  serverUrl: DEFAULT_SERVER_URL,
  computerId: "",
  deviceToken: ""
};
