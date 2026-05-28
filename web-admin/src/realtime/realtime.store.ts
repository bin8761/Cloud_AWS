import { useSyncExternalStore } from "react";
import type { FrontendApiError } from "@/lib/errors";
import type {
  ComputerPresenceEvent,
  Presence,
  RealtimeConnectionStatus,
  RealtimeEventFeedItem,
} from "./realtime.types";

export type PresenceByComputerId = Record<string, Presence>;

export type RealtimeState = {
  connectionStatus: RealtimeConnectionStatus;
  presenceByComputerId: PresenceByComputerId;
  error: FrontendApiError | null;
  recentEventFeed: RealtimeEventFeedItem[];
};

const MAX_RECENT_REALTIME_EVENTS = 50;

const initialRealtimeState: RealtimeState = {
  connectionStatus: "disconnected",
  presenceByComputerId: {},
  error: null,
  recentEventFeed: [],
};

let realtimeState: RealtimeState = initialRealtimeState;
const listeners = new Set<() => void>();

function emitRealtimeStateChange(): void {
  listeners.forEach((listener) => listener());
}

function setRealtimeState(nextState: RealtimeState): void {
  realtimeState = nextState;
  emitRealtimeStateChange();
}

function appendRecentRealtimeEvent(
  recentEventFeed: RealtimeEventFeedItem[],
  eventItem: RealtimeEventFeedItem,
): RealtimeEventFeedItem[] {
  const nextRecentEventFeed = [eventItem, ...recentEventFeed];
  return nextRecentEventFeed.slice(0, MAX_RECENT_REALTIME_EVENTS);
}

export function getRealtimeStateSnapshot(): RealtimeState {
  return realtimeState;
}

export function subscribeRealtimeStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRealtimeStore<TSelected>(
  selector: (state: RealtimeState) => TSelected,
): TSelected {
  return useSyncExternalStore(
    subscribeRealtimeStore,
    () => selector(getRealtimeStateSnapshot()),
    () => selector(getRealtimeStateSnapshot()),
  );
}

export function resetRealtimeState(): void {
  setRealtimeState(initialRealtimeState);
}

export function markRealtimeConnected(): void {
  setRealtimeState({
    ...realtimeState,
    connectionStatus: "connected",
    error: null,
  });
}

export function markRealtimeReconnecting(): void {
  setRealtimeState({
    ...realtimeState,
    connectionStatus: "reconnecting",
  });
}

export function markRealtimeDisconnected(): void {
  setRealtimeState({
    ...realtimeState,
    connectionStatus: "disconnected",
  });
}

export function markRealtimeUnavailable(error: FrontendApiError | null): void {
  setRealtimeState({
    ...realtimeState,
    connectionStatus: "unavailable",
    error,
  });
}

export function applyTenantWatchSnapshot(onlineComputerIds: string[]): void {
  const receivedAt = new Date().toISOString();
  const onlineComputerIdSet = new Set(onlineComputerIds);
  const nextPresenceByComputerId: PresenceByComputerId = {};

  for (const [computerId, existingPresence] of Object.entries(realtimeState.presenceByComputerId)) {
    nextPresenceByComputerId[computerId] = {
      ...existingPresence,
      online: onlineComputerIdSet.has(computerId),
      source: "snapshot",
      receivedAt,
    };
  }

  for (const computerId of onlineComputerIdSet) {
    if (nextPresenceByComputerId[computerId]) {
      continue;
    }

    nextPresenceByComputerId[computerId] = {
      online: true,
      lastSeenAt: null,
      source: "snapshot",
      receivedAt,
    };
  }

  setRealtimeState({
    ...realtimeState,
    presenceByComputerId: nextPresenceByComputerId,
    error: null,
  });
}

export function applyComputerOnlineEvent(event: ComputerPresenceEvent): void {
  const receivedAt = new Date().toISOString();
  const recentEventFeed = appendRecentRealtimeEvent(realtimeState.recentEventFeed, {
    event: "computer:online",
    payload: event,
    receivedAt,
  });

  setRealtimeState({
    ...realtimeState,
    presenceByComputerId: {
      ...realtimeState.presenceByComputerId,
      [event.computerId]: {
        online: true,
        lastSeenAt: event.lastSeenAt,
        source: "socket-event",
        receivedAt,
      },
    },
    recentEventFeed,
  });
}

export function applyComputerOfflineEvent(event: ComputerPresenceEvent): void {
  const receivedAt = new Date().toISOString();
  const recentEventFeed = appendRecentRealtimeEvent(realtimeState.recentEventFeed, {
    event: "computer:offline",
    payload: event,
    receivedAt,
  });

  setRealtimeState({
    ...realtimeState,
    presenceByComputerId: {
      ...realtimeState.presenceByComputerId,
      [event.computerId]: {
        online: false,
        lastSeenAt: event.lastSeenAt,
        source: "socket-event",
        receivedAt,
      },
    },
    recentEventFeed,
  });
}
