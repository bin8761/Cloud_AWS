import type { ComputerRowViewModel } from "@/computers/computers.types";
import type { FrontendApiError } from "@/lib/errors";
import type { RealtimeConnectionStatus, RealtimeEventFeedItem } from "@/realtime/realtime.types";
import { KpiStrip } from "./KpiStrip";
import { RealtimePanel } from "./RealtimePanel";

type DashboardPopulatedContentProps = {
  rows: ComputerRowViewModel[];
  isLoading: boolean;
  connectionStatus: RealtimeConnectionStatus;
  realtimeError: FrontendApiError | null;
  recentEventFeed: RealtimeEventFeedItem[];
};

function countAttentionRows(rows: ComputerRowViewModel[]): number {
  return rows.filter(
    (row) =>
      row.adminStatusLabel === "Blocked" ||
      row.adminStatusLabel === "Inactive" ||
      row.realtimeLabel === "Offline",
  ).length;
}

export function DashboardPopulatedContent({
  rows,
  isLoading,
  connectionStatus,
  realtimeError,
  recentEventFeed,
}: DashboardPopulatedContentProps): JSX.Element {
  const attentionCount = countAttentionRows(rows);

  return (
    <div className="space-y-4 lg:space-y-5 xl:space-y-6">
      <KpiStrip rows={rows} isLoading={isLoading} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.95fr)] xl:gap-6">
        <section
          className="rounded-[var(--radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 lg:min-h-[180px] xl:p-5"
          aria-label="Operational snapshot"
        >
          <h2 className="text-sm font-semibold text-[var(--app-fg)] xl:text-base">Operational Snapshot</h2>
          <p className="mt-2 text-sm text-[var(--app-muted)] xl:text-[0.95rem]">
            {attentionCount > 0
              ? `${attentionCount} computers need operational attention (offline, blocked, or inactive).`
              : "All listed computers are currently in a healthy operational state."}
          </p>
        </section>

        <RealtimePanel
          connectionStatus={connectionStatus}
          error={realtimeError}
          recentEventFeed={recentEventFeed}
        >
          <p className="mt-3 text-xs text-[var(--realtime-muted)]">
            Realtime stream events are listed below in descending received order.
          </p>
          <p className="mt-2 text-xs text-[var(--realtime-muted)]">
            Presence subscription status: {connectionStatus}.
          </p>
        </RealtimePanel>
      </div>
    </div>
  );
}
