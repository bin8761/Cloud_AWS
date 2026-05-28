import type { CSSProperties, ReactNode } from "react";
import type { RealtimeConnectionStatus } from "@/realtime/realtime.types";
import type { FrontendApiError } from "@/lib/errors";
import type { RealtimeEventFeedItem } from "@/realtime/realtime.types";
import { formatAbsoluteTimestamp } from "@/lib/date";

type RealtimePanelProps = {
  connectionStatus: RealtimeConnectionStatus;
  error?: FrontendApiError | null;
  recentEventFeed?: RealtimeEventFeedItem[];
  children?: ReactNode;
};

type RealtimeStateView = {
  title: string;
  description: string;
  toneClassName: string;
};

function selectRealtimeStateView(
  connectionStatus: RealtimeConnectionStatus,
  error: FrontendApiError | null,
): RealtimeStateView {
  if (connectionStatus === "connected") {
    return {
      title: "Connected",
      description: "Realtime stream is active and receiving tenant presence updates.",
      toneClassName: "text-[var(--status-online)]",
    };
  }

  if (connectionStatus === "reconnecting") {
    return {
      title: "Reconnecting",
      description: "Connection is recovering. Existing REST data remains visible.",
      toneClassName: "text-[var(--status-reconnecting)]",
    };
  }

  if (connectionStatus === "disconnected") {
    return {
      title: "Disconnected",
      description: "Realtime feed is offline. Presence updates are temporarily paused.",
      toneClassName: "text-[var(--status-offline)]",
    };
  }

  if (connectionStatus === "unavailable" && error) {
    return {
      title: "Failed Watch Ack",
      description: `Realtime watch acknowledgement failed (${error.code ?? "UNKNOWN_ERROR"}).`,
      toneClassName: "text-[var(--status-warning)]",
    };
  }

  if (connectionStatus === "unavailable") {
    return {
      title: "Unavailable",
      description: "Realtime service is currently unavailable for this session.",
      toneClassName: "text-[var(--status-unavailable)]",
    };
  }

  return {
    title: "Connecting",
    description: "Initializing realtime connection for tenant presence monitoring.",
    toneClassName: "text-[var(--realtime-muted)]",
  };
}

export function RealtimePanel({
  connectionStatus,
  error = null,
  recentEventFeed = [],
  children,
}: RealtimePanelProps): JSX.Element {
  const stateView = selectRealtimeStateView(connectionStatus, error);

  return (
    <section
      className="max-w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--realtime-border)] bg-[var(--realtime-bg)] p-3 text-[var(--realtime-fg)] sm:p-4 lg:min-h-[280px]"
      style={{ "--focus-ring-offset-surface": "var(--realtime-bg)" } as CSSProperties}
      aria-label="Realtime panel"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between lg:items-center">
        <h2 className="text-sm font-semibold tracking-[0.02em]">Realtime Panel</h2>
        <p className={`text-xs font-semibold uppercase tracking-[0.08em] sm:text-right ${stateView.toneClassName}`}>
          State: {stateView.title}
        </p>
      </header>
      <p className="mt-2 text-sm text-[var(--realtime-muted)]">{stateView.description}</p>
      {connectionStatus === "unavailable" && error?.message ? (
        <p className="mt-2 text-xs text-[var(--realtime-muted)]">Reason: {error.message}</p>
      ) : null}

      {children}

      <div className="mt-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--realtime-muted)]">
          Recent Events
        </h3>
        {recentEventFeed.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--realtime-muted)]">
            No recent realtime events yet.
          </p>
        ) : (
          <ul className="mt-2 max-h-44 space-y-2 overflow-y-auto overflow-x-hidden pr-1 sm:max-h-52 lg:max-h-56">
            {recentEventFeed.map((item, index) => (
              <li
                key={`${item.event}-${item.payload.computerId}-${item.receivedAt}-${index}`}
                className="rounded-[var(--radius-sm)] border border-[var(--realtime-border)] bg-slate-900/40 p-2"
              >
                <p className="text-xs font-semibold text-[var(--realtime-fg)]">
                  {item.event === "computer:online" ? "Computer Online" : "Computer Offline"}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-[var(--realtime-muted)]">
                  ID: {item.payload.computerId}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-[var(--realtime-muted)]">
                  Last Seen: {formatAbsoluteTimestamp(item.payload.lastSeenAt)}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-[var(--realtime-muted)]">
                  Received: {formatAbsoluteTimestamp(item.receivedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
