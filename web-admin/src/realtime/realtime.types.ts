export type PresenceSource = "snapshot" | "socket-event" | "rest";

export type Presence = {
  online: boolean;
  lastSeenAt: string | null;
  source: PresenceSource;
  receivedAt: string;
};

export type WatchTenantAckSuccess = {
  success: true;
  data: {
    onlineComputers: string[];
  };
};

export type WatchTenantAckFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type WatchTenantAck = WatchTenantAckSuccess | WatchTenantAckFailure;

export type ComputerPresenceEvent = {
  computerId: string;
  tenantId: string;
  lastSeenAt: string;
};

export type RealtimeConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "unavailable";

export type RealtimeEventFeedItem = {
  event: "computer:online" | "computer:offline";
  payload: ComputerPresenceEvent;
  receivedAt: string;
};
