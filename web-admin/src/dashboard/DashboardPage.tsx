import { useMemo } from "react";
import { useComputersListQuery } from "@/computers/computers.queries";
import { selectComputerRowViewModels } from "@/computers/computerSelectors";
import { useAdminPresence } from "@/realtime/useAdminPresence";
import { useRealtimeStore } from "@/realtime/realtime.store";
import { isForbiddenError } from "@/lib/errors";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { ForbiddenState } from "@/ui/ForbiddenState";
import { DashboardPopulatedContent } from "./DashboardPopulatedContent";

export function DashboardPage(): JSX.Element {
  const computersQuery = useComputersListQuery();
  useAdminPresence();

  const presenceByComputerId = useRealtimeStore((state) => state.presenceByComputerId);
  const connectionStatus = useRealtimeStore((state) => state.connectionStatus);
  const realtimeError = useRealtimeStore((state) => state.error);
  const recentEventFeed = useRealtimeStore((state) => state.recentEventFeed);
  const computers = computersQuery.data?.items ?? [];

  const rows = useMemo(
    () =>
      selectComputerRowViewModels(computers, presenceByComputerId, connectionStatus),
    [computers, presenceByComputerId, connectionStatus],
  );
  const hasRestError = computersQuery.isError;
  const isForbiddenRestError = hasRestError && isForbiddenError(computersQuery.error);
  const isEmptyDashboard = !computersQuery.isLoading && !hasRestError && rows.length === 0;
  const hasBlockingRestState =
    isForbiddenRestError || (hasRestError && !isForbiddenRestError) || isEmptyDashboard;

  return (
    <section className="space-y-6" aria-label="Operations dashboard">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">
          Operations Center
        </p>
        <h1 className="text-2xl font-semibold leading-tight text-[var(--app-fg)] md:text-3xl">
          Dashboard
        </h1>
        <p className="max-w-3xl text-sm text-[var(--app-muted)]">
          Monitor tenant computer health and realtime connectivity from one place.
        </p>
      </header>

      {isForbiddenRestError ? (
        <ForbiddenState
          title="Dashboard access is forbidden"
          description="Your current account cannot view tenant computer data for this dashboard."
        />
      ) : null}

      {hasRestError && !isForbiddenRestError ? (
        <ErrorState
          title="Unable to load dashboard computers"
          description="The dashboard could not fetch computer data. Retry to refresh the operational view."
          retryLabel="Retry load"
          onRetry={() => {
            void computersQuery.refetch();
          }}
        />
      ) : null}

      {isEmptyDashboard ? (
        <EmptyState
          title="No computers available yet"
          description="No tenant computers were returned by the current dashboard data source."
        />
      ) : null}

      {!hasBlockingRestState ? (
        <DashboardPopulatedContent
          rows={rows}
          isLoading={computersQuery.isLoading}
          connectionStatus={connectionStatus}
          realtimeError={realtimeError}
          recentEventFeed={recentEventFeed}
        />
      ) : null}
    </section>
  );
}
