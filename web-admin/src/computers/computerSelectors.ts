import type {
  Computer,
  ComputerRowViewModel,
  ComputerStatus,
} from "./computers.types";
import type { Presence, RealtimeConnectionStatus } from "../realtime/realtime.types";
import type { PresenceByComputerId } from "../realtime/realtime.store";

function normalizeDisplayValue(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function selectComputerDisplayName(computer: Computer): string {
  return (
    normalizeDisplayValue(computer.name) ??
    normalizeDisplayValue(computer.macAddress) ??
    computer.id
  );
}

export function selectAdminStatusLabel(
  status: ComputerStatus,
): "Active" | "Inactive" | "Blocked" {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "INACTIVE":
      return "Inactive";
    case "BLOCKED":
      return "Blocked";
  }
}

export function selectRealtimeLabel(
  presence: Presence | undefined,
  connectionStatus: RealtimeConnectionStatus,
): "Online" | "Offline" | "Unavailable" | "Reconnecting" {
  if (connectionStatus === "reconnecting") {
    return "Reconnecting";
  }

  if (presence == null) {
    return "Unavailable";
  }

  return presence.online ? "Online" : "Offline";
}

function createUnavailablePresence(): Presence {
  return {
    online: false,
    lastSeenAt: null,
    source: "rest",
    receivedAt: new Date(0).toISOString(),
  };
}

export function selectComputerRowViewModels(
  computers: Computer[],
  presenceByComputerId: PresenceByComputerId,
  connectionStatus: RealtimeConnectionStatus,
): ComputerRowViewModel[] {
  return computers.map((computer) => {
    const presence = presenceByComputerId[computer.id] ?? createUnavailablePresence();

    return {
      computer,
      presence,
      displayName: selectComputerDisplayName(computer),
      adminStatusLabel: selectAdminStatusLabel(computer.status),
      realtimeLabel: selectRealtimeLabel(presenceByComputerId[computer.id], connectionStatus),
    };
  });
}
