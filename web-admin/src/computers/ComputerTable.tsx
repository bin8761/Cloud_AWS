import type { ComputerRowViewModel } from "@/computers/computers.types";
import { formatAbsoluteTimestamp, formatRelativeLastSeenAt, formatNullableTimestamp } from "@/lib/date";
import { IconButton } from "@/ui/IconButton";
import { Skeleton } from "@/ui/Skeleton";
import { StatusBadge } from "@/ui/StatusBadge";

type ComputerTableProps = {
  rows: ComputerRowViewModel[];
  onOpenDetail: (computerId: string) => void;
  isLoading?: boolean;
  loadingRowCount?: number;
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

export function ComputerTable({
  rows,
  onOpenDetail,
  isLoading = false,
  loadingRowCount = 6,
}: ComputerTableProps): JSX.Element {
  const loadingRows = Array.from({ length: loadingRowCount }, (_, index) => `loading-row-${index}`);

  return (
    <div className="hidden md:block">
      <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--app-border)]">
        <table className="min-w-full table-fixed border-collapse bg-[var(--app-surface)] text-left text-sm xl:min-w-[1180px]" aria-busy={isLoading}>
          <caption className="sr-only">Computers operational table</caption>
          <thead className="bg-[var(--app-bg)] text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">
            <tr>
              <th scope="col" className="w-[28%] px-4 py-3 font-semibold lg:w-[24%] xl:w-[22%]">
                Display Name
              </th>
              <th scope="col" className="hidden w-[18%] px-4 py-3 font-semibold lg:table-cell xl:w-[20%]">
                MAC Address
              </th>
              <th scope="col" className="w-[22%] px-4 py-3 font-semibold md:w-[18%] lg:w-[14%] xl:w-[12%]">
                Admin Status
              </th>
              <th scope="col" className="w-[22%] px-4 py-3 font-semibold md:w-[18%] lg:w-[14%] xl:w-[12%]">
                Realtime
              </th>
              <th scope="col" className="hidden w-[24%] px-4 py-3 font-semibold lg:w-[14%] xl:w-[16%] lg:table-cell">
                Last Seen
              </th>
              <th scope="col" className="hidden w-[16%] px-4 py-3 font-semibold xl:table-cell xl:w-[12%]">
                Updated At
              </th>
              <th scope="col" className="w-[14%] px-4 py-3 font-semibold lg:w-[8%] xl:w-[6%]">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? loadingRows.map((loadingRowId) => (
                  <tr key={loadingRowId} className="border-t border-[var(--app-border)]">
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-4/5" />
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <Skeleton className="h-5 w-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="mt-1 h-4 w-28" />
                    </td>
                    <td className="hidden px-4 py-3 xl:table-cell">
                      <Skeleton className="h-5 w-36" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-8 w-8 rounded-[var(--radius-sm)] lg:h-9 lg:w-9 xl:h-11 xl:w-11" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => (
              <tr
                key={row.computer.id}
                className="border-t border-[var(--app-border)] transition-colors duration-200 hover:bg-[var(--app-bg)]/70"
              >
                <td className="px-4 py-3 font-medium text-[var(--app-fg)] xl:text-[0.95rem]">{row.displayName}</td>
                <td className="hidden px-4 py-3 font-technical text-xs text-[var(--app-fg)] lg:table-cell">{row.computer.macAddress}</td>
                <td className="px-4 py-3 text-[var(--app-fg)]">
                  <StatusBadge label={row.adminStatusLabel} tone={getAdminStatusTone(row.adminStatusLabel)} compact />
                </td>
                <td className="px-4 py-3 text-[var(--app-fg)]">
                  <StatusBadge label={row.realtimeLabel} tone={getRealtimeStatusTone(row.realtimeLabel)} compact />
                </td>
                <td className="hidden px-4 py-3 text-[var(--app-fg)] lg:table-cell">
                  <p className="font-medium">{formatRelativeLastSeenAt(row.presence.lastSeenAt ?? row.computer.lastSeenAt)}</p>
                  <p className="font-technical text-xs text-[var(--app-muted)]">
                    {formatNullableTimestamp(row.presence.lastSeenAt ?? row.computer.lastSeenAt, "No timestamp")}
                  </p>
                </td>
                <td className="hidden px-4 py-3 font-technical text-xs text-[var(--app-fg)] xl:table-cell">
                  {formatAbsoluteTimestamp(row.computer.updatedAt)}
                </td>
                <td className="px-4 py-3 text-[var(--app-fg)]">
                  <IconButton
                    label={`Open details for ${row.displayName}`}
                    onClick={() => onOpenDetail(row.computer.id)}
                    className="!min-h-8 !min-w-8 border-[var(--app-border)] p-1 lg:!min-h-9 lg:!min-w-9 lg:p-1.5 focus-visible:ring-[var(--focus-ring)] xl:!min-h-11 xl:!min-w-11 xl:p-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </IconButton>
                </td>
              </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
