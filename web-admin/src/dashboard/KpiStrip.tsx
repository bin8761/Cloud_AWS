import {
  selectBlockedOrInactiveComputerCount,
  selectOfflineComputerCount,
  selectOnlineComputerCount,
  selectTotalComputerCount,
} from "./dashboardSelectors";
import type { ComputerRowViewModel } from "@/computers/computers.types";
import { Skeleton } from "@/ui/Skeleton";

type KpiStripProps = {
  rows: ComputerRowViewModel[];
  isLoading?: boolean;
};

type KpiCardProps = {
  label: string;
  value?: number;
  statusText?: string;
  accentClassName: string;
  isLoading?: boolean;
};

function KpiCard({
  label,
  value,
  statusText,
  accentClassName,
  isLoading = false,
}: KpiCardProps): JSX.Element {
  return (
    <article className="min-h-[148px] rounded-[var(--radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm transition-shadow duration-200 hover:shadow-md md:min-h-[170px] md:p-4 lg:min-h-[176px] lg:p-5 xl:min-h-[230px] xl:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-muted)] md:text-[0.78rem] lg:text-sm xl:text-base">
        {label}
      </p>
      {isLoading ? (
        <>
          <Skeleton className="mt-3 h-8 w-20 max-w-full rounded-[var(--radius-xs)] bg-slate-300 md:mt-4 md:h-10 md:w-24 xl:mt-6 xl:h-14 xl:w-36" />
          <Skeleton className="mt-3 h-4 w-44 max-w-full rounded-[var(--radius-xs)] bg-slate-200 md:mt-4 md:h-5 md:w-56 xl:mt-6 xl:h-6 xl:w-72" />
        </>
      ) : (
        <>
          <p className="mt-3 text-3xl font-semibold leading-none text-[var(--app-fg)] md:mt-3 md:text-[2rem] lg:mt-4 lg:text-4xl xl:mt-6 xl:text-6xl">
            {value}
          </p>
          <p className={`mt-3 text-sm font-medium ${accentClassName} md:mt-3 md:text-[0.9rem] lg:mt-4 lg:text-base xl:mt-6 xl:text-xl`}>
            {statusText}
          </p>
        </>
      )}
    </article>
  );
}

export function KpiStrip({ rows, isLoading = false }: KpiStripProps): JSX.Element {
  const total = selectTotalComputerCount(rows);
  const online = selectOnlineComputerCount(rows);
  const offline = selectOfflineComputerCount(rows);
  const blockedOrInactive = selectBlockedOrInactiveComputerCount(rows);

  return (
    <section
      className="grid gap-3 sm:grid-cols-2 md:grid-cols-2 md:gap-3.5 xl:grid-cols-4 xl:gap-5 2xl:gap-6"
      aria-label="Computer health KPI strip"
    >
      <KpiCard
        label="Total Computers"
        value={total}
        statusText="Status: Fleet size in scope"
        accentClassName="text-[var(--app-muted)]"
        isLoading={isLoading}
      />
      <KpiCard
        label="Online"
        value={online}
        statusText="Status: Realtime connected devices"
        accentClassName="text-[var(--status-online)]"
        isLoading={isLoading}
      />
      <KpiCard
        label="Offline"
        value={offline}
        statusText="Status: Realtime disconnected devices"
        accentClassName="text-[var(--status-offline)]"
        isLoading={isLoading}
      />
      <KpiCard
        label="Blocked/Inactive"
        value={blockedOrInactive}
        statusText="Status: Administrative action required"
        accentClassName="text-[var(--status-warning)]"
        isLoading={isLoading}
      />
    </section>
  );
}
