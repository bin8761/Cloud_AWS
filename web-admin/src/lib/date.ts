const DEFAULT_NULL_TIMESTAMP_LABEL = "—";
const NEVER_SEEN_LABEL = "Never";
const INVALID_TIMESTAMP_LABEL = "Invalid timestamp";

const ABSOLUTE_UTC_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function parseTimestamp(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function formatAbsoluteTimestamp(timestamp: string): string {
  const parsed = parseTimestamp(timestamp);
  if (!parsed) {
    return INVALID_TIMESTAMP_LABEL;
  }

  return `${ABSOLUTE_UTC_FORMATTER.format(parsed)} UTC`;
}

export function formatNullableTimestamp(
  timestamp: string | null | undefined,
  fallback: string = DEFAULT_NULL_TIMESTAMP_LABEL,
): string {
  if (!timestamp) {
    return fallback;
  }

  return formatAbsoluteTimestamp(timestamp);
}

export function formatRelativeLastSeenAt(
  lastSeenAt: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!lastSeenAt) {
    return NEVER_SEEN_LABEL;
  }

  const parsed = parseTimestamp(lastSeenAt);
  if (!parsed) {
    return INVALID_TIMESTAMP_LABEL;
  }

  const diffInMs = now.getTime() - parsed.getTime();
  if (diffInMs <= 0) {
    return "just now";
  }

  const diffInSeconds = Math.floor(diffInMs / 1000);
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return formatAbsoluteTimestamp(lastSeenAt);
}
