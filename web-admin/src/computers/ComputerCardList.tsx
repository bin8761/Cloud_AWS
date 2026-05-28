import type { ComputerRowViewModel } from "@/computers/computers.types";
import { formatNullableTimestamp, formatRelativeLastSeenAt } from "@/lib/date";
import { Button } from "@/ui/Button";
import { StatusBadge } from "@/ui/StatusBadge";

type ComputerCardListProps = {
  rows: ComputerRowViewModel[];
  onOpenDetail: (computerId: string) => void;
};

function getAdminStatusTone(label: ComputerRowViewModel["adminStatusLabel"]): "active" | "inactive" | "blocked" {
  switch (label) {
    case "Active":
      return "active";
    case "Inactive":
      return "inactive";
    case "Blocked":
      return "blocked";
  }
}

function getRealtimeStatusTone(
  label: ComputerRowViewModel["realtimeLabel"],
): "online" | "offline" | "reconnecting" | "unavailable" {
  switch (label) {
    case "Online":
      return "online";
    case "Offline":
      return "offline";
    case "Reconnecting":
      return "reconnecting";
    case "Unavailable":
      return "unavailable";
  }
}

export function ComputerCardList({ rows, onOpenDetail }: ComputerCardListProps): JSX.Element {
  return (
    <div className="space-y-2.5 overflow-x-hidden md:hidden" aria-label="Computers mobile card list">
      {rows.map((row) => (
        <article
          key={row.computer.id}
          className="min-w-0 space-y-2.5 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 sm:p-4"
        >
          <header className="space-y-1">
            <h3 className="text-sm font-semibold text-[var(--app-fg)]">{row.displayName}</h3>
            <p className="break-all font-technical text-xs text-[var(--app-muted)]">{row.computer.macAddress}</p>
          </header>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <StatusBadge label={row.adminStatusLabel} tone={getAdminStatusTone(row.adminStatusLabel)} compact />
            <StatusBadge label={row.realtimeLabel} tone={getRealtimeStatusTone(row.realtimeLabel)} compact />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Last seen</p>
            <p className="mt-1 text-sm font-medium text-[var(--app-fg)]">
              {formatRelativeLastSeenAt(row.presence.lastSeenAt ?? row.computer.lastSeenAt)}
            </p>
            <p className="break-all font-technical text-xs text-[var(--app-muted)]">
              {formatNullableTimestamp(row.presence.lastSeenAt ?? row.computer.lastSeenAt, "No timestamp")}
            </p>
          </div>
          <Button
            type="button"
            variant="neutral"
            size="default"
            onClick={() => onOpenDetail(row.computer.id)}
            aria-label={`Open details for ${row.displayName}`}
            className="w-full justify-center text-sm"
          >
            Open details
          </Button>
        </article>
      ))}
    </div>
  );
}
