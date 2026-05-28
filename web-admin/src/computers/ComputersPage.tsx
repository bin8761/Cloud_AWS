import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ComputerCardList } from "@/computers/ComputerCardList";
import { ComputerDetailDrawer } from "@/computers/ComputerDetailDrawer";
import { ComputerListToolbar } from "@/computers/ComputerListToolbar";
import { ReissueTokenModal } from "@/computers/ReissueTokenModal";
import { ComputerTable } from "@/computers/ComputerTable";
import { selectComputerRowViewModels } from "@/computers/computerSelectors";
import type { ComputerStatus } from "@/computers/computers.types";
import {
  useComputerDetailQuery,
  useComputersListQuery,
  useReissueComputerTokenMutation,
  useUpdateComputerMutation,
} from "@/computers/computers.queries";
import { debounce } from "@/lib/debounce";
import { formatAbsoluteTimestamp, formatNullableTimestamp, formatRelativeLastSeenAt } from "@/lib/date";
import { isForbiddenError, isRateLimitError } from "@/lib/errors";
import { useAdminPresence } from "@/realtime/useAdminPresence";
import { useRealtimeStore } from "@/realtime/realtime.store";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { ErrorState } from "@/ui/ErrorState";
import { ForbiddenState } from "@/ui/ForbiddenState";
import { Select } from "@/ui/Select";
import { StatusBadge } from "@/ui/StatusBadge";
import { TextInput } from "@/ui/TextInput";
import { Textarea } from "@/ui/Textarea";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SORT = "createdAt:desc";
const SEARCH_DEBOUNCE_MS = 300;

type ComputerStatusFilter = "ALL" | ComputerStatus;

function getAdminStatusTone(status: ComputerStatus): "active" | "inactive" | "blocked" {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "INACTIVE":
      return "inactive";
    case "BLOCKED":
      return "blocked";
  }
}

function getAdminStatusLabel(status: ComputerStatus): "Active" | "Inactive" | "Blocked" {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "INACTIVE":
      return "Inactive";
    case "BLOCKED":
      return "Blocked";
  }
}

function getRealtimeStatusTone(
  label: "Online" | "Offline" | "Unavailable" | "Reconnecting",
): "online" | "offline" | "unavailable" | "reconnecting" {
  switch (label) {
    case "Online":
      return "online";
    case "Offline":
      return "offline";
    case "Unavailable":
      return "unavailable";
    case "Reconnecting":
      return "reconnecting";
  }
}

export function ComputersPage(): JSX.Element {
  useAdminPresence();

  const [page, setPage] = useState<number>(DEFAULT_PAGE);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState<ComputerStatusFilter>("ALL");
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [sort, setSort] = useState<string>(DEFAULT_SORT);
  const [selectedComputerId, setSelectedComputerId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isReissueModalOpen, setIsReissueModalOpen] = useState<boolean>(false);
  const [editableName, setEditableName] = useState<string>("");
  const [editableStatus, setEditableStatus] = useState<ComputerStatus>("INACTIVE");
  const [editableNotes, setEditableNotes] = useState<string>("");

  const debouncedSearchUpdater = useMemo(
    () =>
      debounce((value: string) => {
        setDebouncedSearch(value.trim());
      }, SEARCH_DEBOUNCE_MS),
    [],
  );

  useEffect(() => {
    debouncedSearchUpdater(searchInput);

    return () => {
      debouncedSearchUpdater.cancel();
    };
  }, [searchInput, debouncedSearchUpdater]);

  useEffect(() => {
    setPage(DEFAULT_PAGE);
  }, [debouncedSearch]);

  useEffect(() => {
    setPage(DEFAULT_PAGE);
  }, [statusFilter]);

  useEffect(() => {
    setPage(DEFAULT_PAGE);
  }, [pageSize]);

  const listQueryParams = useMemo(
    () => ({
      page,
      pageSize,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      q: debouncedSearch.length > 0 ? debouncedSearch : undefined,
      sort,
    }),
    [debouncedSearch, page, pageSize, sort, statusFilter],
  );

  const computersListQuery = useComputersListQuery(listQueryParams);
  const connectionStatus = useRealtimeStore((state) => state.connectionStatus);
  const presenceByComputerId = useRealtimeStore((state) => state.presenceByComputerId);
  const totalPages = Math.max(computersListQuery.data?.totalPages ?? 1, 1);
  const isPreviousPageDisabled = page <= 1;
  const isNextPageDisabled = page >= totalPages;
  const isListLoading = computersListQuery.isLoading;
  const isListFetching = computersListQuery.isFetching;
  const listItems = computersListQuery.data?.items ?? [];
  const listRows = useMemo(
    () => selectComputerRowViewModels(listItems, presenceByComputerId, connectionStatus),
    [connectionStatus, listItems, presenceByComputerId],
  );
  const isListError = computersListQuery.isError;
  const isForbiddenListError = isListError && isForbiddenError(computersListQuery.error);
  const isGenericListError = isListError && !isForbiddenListError;
  const isEmptyList = !isListLoading && !isListFetching && listRows.length === 0;
  const selectedComputer = useMemo(
    () => listRows.find((row) => row.computer.id === selectedComputerId) ?? null,
    [listRows, selectedComputerId],
  );
  const shouldFetchDetailFromApi =
    isDetailOpen &&
    Boolean(selectedComputerId) &&
    (selectedComputer === null || isListFetching);
  const computerDetailQuery = useComputerDetailQuery(shouldFetchDetailFromApi ? selectedComputerId : null);
  const updateComputerMutation = useUpdateComputerMutation();
  const reissueComputerTokenMutation = useReissueComputerTokenMutation();
  const resolvedDetailComputer = computerDetailQuery.data ?? selectedComputer?.computer ?? null;
  const resolvedAdminStatus = selectedComputer?.adminStatusLabel ?? (resolvedDetailComputer ? getAdminStatusLabel(resolvedDetailComputer.status) : null);
  const resolvedRealtimeLabel = selectedComputer?.realtimeLabel ?? "Unavailable";
  const resolvedLastSeenTimestamp = selectedComputer?.presence.lastSeenAt ?? resolvedDetailComputer?.lastSeenAt ?? null;
  const resolvedCreatedAt = resolvedDetailComputer?.createdAt ?? null;
  const resolvedUpdatedAt = resolvedDetailComputer?.updatedAt ?? null;
  const resolvedNotes = resolvedDetailComputer?.notes ?? selectedComputer?.computer.notes ?? null;
  const isUpdateForbiddenError = isForbiddenError(updateComputerMutation.error);
  const isUpdateRateLimitError = isRateLimitError(updateComputerMutation.error);

  useEffect(() => {
    if (!isDetailOpen || !resolvedDetailComputer) {
      return;
    }

    setEditableName(resolvedDetailComputer.name ?? "");
    setEditableStatus(resolvedDetailComputer.status);
    setEditableNotes(resolvedDetailComputer.notes ?? "");
  }, [isDetailOpen, resolvedDetailComputer]);

  const handleOpenDetail = (computerId: string): void => {
    setSelectedComputerId(computerId);
    setIsDetailOpen(true);
  };
  const handleCloseDetail = (): void => {
    setIsDetailOpen(false);
    setIsReissueModalOpen(false);
  };
  const handleOpenReissueModal = (): void => {
    setIsReissueModalOpen(true);
  };
  const handleCloseReissueModal = (): void => {
    setIsReissueModalOpen(false);
  };
  const handleSaveComputer = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (!resolvedDetailComputer || updateComputerMutation.isPending) {
      return;
    }

    updateComputerMutation.mutate({
      id: resolvedDetailComputer.id,
      input: {
        name: editableName.trim().length > 0 ? editableName.trim() : null,
        status: editableStatus,
        notes: editableNotes.trim().length > 0 ? editableNotes.trim() : null,
      },
    });
  };
  const handleConfirmReissue = async (input: { computerId: string; reason: string }): Promise<{ deviceToken: string }> => {
    const result = await reissueComputerTokenMutation.mutateAsync({
      id: input.computerId,
      input: { reason: input.reason },
    });

    return { deviceToken: result.deviceToken };
  };

  void statusFilter;
  void debouncedSearch;
  void sort;
  return (
    <section className="space-y-6" aria-label="Computers operations page">
      <header className="rounded-[var(--radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-muted)]">
          Device Operations
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <h1 className="text-2xl font-semibold leading-tight text-[var(--app-fg)] md:text-3xl">
              Computers
            </h1>
            <p className="text-sm text-[var(--app-muted)] md:text-base">
              Manage tenant computers with searchable inventory, operational status, and realtime presence visibility.
            </p>
          </div>
          <Button type="button" variant="neutral" size="compact" disabled aria-disabled="true">
            Create computer (Post-MVP)
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <ComputerListToolbar
          searchValue={searchInput}
          statusValue={statusFilter}
          sortValue={sort}
          pageSizeValue={pageSize}
          onSearchChange={setSearchInput}
          onStatusChange={(value) => setStatusFilter(value as ComputerStatusFilter)}
          onSortChange={setSort}
          onPageSizeChange={setPageSize}
          currentPage={page}
          totalPages={totalPages}
          onPreviousPage={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
          onNextPage={() => setPage((currentPage) => Math.min(currentPage + 1, totalPages))}
          isPreviousDisabled={isPreviousPageDisabled}
          isNextDisabled={isNextPageDisabled}
        />
        <section
          className="min-h-[260px] rounded-[var(--radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 md:p-6"
          aria-label="Computers list content"
        >
          {isEmptyList ? (
            <EmptyState
              title="No computers found"
              description="No computers match the current filters. Try changing search, status, or page size."
              className="h-full min-h-[220px] flex flex-col justify-center"
            />
          ) : null}

          {isForbiddenListError ? (
            <ForbiddenState
              title="Access to computer list is restricted"
              description="Your session is still active, but your role cannot access this list."
              className="h-full min-h-[220px] flex flex-col justify-center"
            />
          ) : null}

          {isGenericListError ? (
            <ErrorState
              title="Unable to load computers"
              description="The computer list could not be loaded. Please retry."
              retryLabel="Retry loading list"
              onRetry={() => {
                void computersListQuery.refetch();
              }}
              className="h-full min-h-[220px] flex flex-col justify-center"
            />
          ) : null}

          {!isEmptyList && !isForbiddenListError && !isGenericListError ? (
            <>
              <ComputerCardList rows={listRows} onOpenDetail={handleOpenDetail} />
              <ComputerTable rows={listRows} onOpenDetail={handleOpenDetail} isLoading={isListLoading || isListFetching} />
            </>
          ) : null}
        </section>
        <aside className="rounded-[var(--radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 md:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)]">Realtime readiness</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--app-fg)]">
            Presence subscription and merged online/offline indicators will be attached as the computers list workflow is completed.
          </p>
        </aside>
      </div>
      <ComputerDetailDrawer
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        title={resolvedDetailComputer?.name?.trim() || selectedComputer?.displayName || "Computer detail"}
        description={
          (resolvedDetailComputer?.name?.trim() || selectedComputer?.displayName)
            ? `Review computer information for ${resolvedDetailComputer?.name?.trim() || selectedComputer?.displayName}.`
            : "Review computer information."
        }
        closeLabel="Close computer detail overlay"
      >
        <section className="space-y-4" aria-label="Computer detail panel">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Display name</p>
            <p className="text-base font-semibold text-[var(--app-fg)]">
              {resolvedDetailComputer?.name?.trim() || selectedComputer?.displayName || "Unknown computer"}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-bg)]/60 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Computer ID</p>
              <p className="break-all font-technical text-sm text-[var(--app-fg)]">
                {resolvedDetailComputer?.id ?? selectedComputerId ?? "No computer selected"}
              </p>
            </div>
            <div className="min-w-0 space-y-1 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-bg)]/60 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">MAC address</p>
              <p className="break-all font-technical text-sm text-[var(--app-fg)]">
                {resolvedDetailComputer?.macAddress ?? selectedComputer?.computer.macAddress ?? "No MAC address"}
              </p>
            </div>
          </div>
          <div className="min-w-0 space-y-1 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-bg)]/60 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Tenant ID (read-only)</p>
            <p className="break-all font-technical text-sm text-[var(--app-fg)]">
              {resolvedDetailComputer?.tenantId ?? selectedComputer?.computer.tenantId ?? "No tenant id"}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-bg)]/60 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Admin status</p>
              {resolvedAdminStatus ? (
                <StatusBadge label={resolvedAdminStatus} tone={getAdminStatusTone(resolvedDetailComputer?.status ?? selectedComputer?.computer.status ?? "INACTIVE")} />
              ) : (
                <p className="text-sm text-[var(--app-muted)]">Unavailable</p>
              )}
            </div>
            <div className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-bg)]/60 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Realtime presence</p>
              <StatusBadge label={resolvedRealtimeLabel} tone={getRealtimeStatusTone(resolvedRealtimeLabel)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-bg)]/60 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Last seen</p>
              <p className="text-sm font-medium text-[var(--app-fg)]">{formatRelativeLastSeenAt(resolvedLastSeenTimestamp)}</p>
              <p className="font-technical text-xs text-[var(--app-muted)]">
                {formatNullableTimestamp(resolvedLastSeenTimestamp, "No timestamp")}
              </p>
            </div>
            <div className="space-y-1 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-bg)]/60 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Created at</p>
              <p className="font-technical text-xs text-[var(--app-fg)]">
                {resolvedCreatedAt ? formatAbsoluteTimestamp(resolvedCreatedAt) : "No timestamp"}
              </p>
            </div>
            <div className="space-y-1 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-bg)]/60 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Updated at</p>
              <p className="font-technical text-xs text-[var(--app-fg)]">
                {resolvedUpdatedAt ? formatAbsoluteTimestamp(resolvedUpdatedAt) : "No timestamp"}
              </p>
            </div>
          </div>
          <div className="space-y-1 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-bg)]/60 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Notes</p>
            <p className="whitespace-pre-wrap break-words text-sm text-[var(--app-fg)]">
              {resolvedNotes && resolvedNotes.trim().length > 0 ? resolvedNotes : "No notes"}
            </p>
          </div>
          <form
            className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-bg)]/40 p-3 md:p-4"
            aria-label="Editable computer fields"
            onSubmit={handleSaveComputer}
          >
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Name</span>
                <TextInput
                  value={editableName}
                  onChange={(event) => setEditableName(event.target.value)}
                  placeholder="Computer display name"
                  autoComplete="off"
                  disabled={updateComputerMutation.isPending}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Status</span>
                <Select
                  value={editableStatus}
                  onChange={(event) => setEditableStatus(event.target.value as ComputerStatus)}
                  disabled={updateComputerMutation.isPending}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="BLOCKED">Blocked</option>
                </Select>
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Notes (editable)</span>
              <Textarea
                value={editableNotes}
                onChange={(event) => setEditableNotes(event.target.value)}
                rows={4}
                placeholder="Operational notes for this computer"
                disabled={updateComputerMutation.isPending}
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {updateComputerMutation.isPending ? (
                <p className="text-xs font-medium text-[var(--app-muted)]">Saving changes with optimistic update...</p>
              ) : (
                <p className="text-xs text-[var(--app-muted)]">Only name, status, and notes can be updated.</p>
              )}
              <Button type="submit" size="compact" disabled={updateComputerMutation.isPending || !resolvedDetailComputer}>
                {updateComputerMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
            {updateComputerMutation.isSuccess ? (
              <p className="rounded-[var(--radius-sm)] border border-[var(--status-active)]/30 bg-[var(--status-active)]/10 px-3 py-2 text-xs font-medium text-[var(--status-active)]">
                Update completed successfully.
              </p>
            ) : null}
            {updateComputerMutation.isError && isUpdateRateLimitError ? (
              <p className="rounded-[var(--radius-sm)] border border-[var(--status-reconnecting)]/30 bg-[var(--status-reconnecting)]/10 px-3 py-2 text-xs font-medium text-[var(--status-reconnecting)]">
                Too many update attempts. Please wait a moment and try again.
              </p>
            ) : null}
            {updateComputerMutation.isError && isUpdateForbiddenError ? (
              <p className="rounded-[var(--radius-sm)] border border-[var(--status-blocked)]/30 bg-[var(--status-blocked)]/10 px-3 py-2 text-xs font-medium text-[var(--status-blocked)]">
                You do not have permission to update this computer.
              </p>
            ) : null}
            {updateComputerMutation.isError && !isUpdateRateLimitError && !isUpdateForbiddenError ? (
              <p className="rounded-[var(--radius-sm)] border border-[var(--status-blocked)]/30 bg-[var(--status-blocked)]/10 px-3 py-2 text-xs font-medium text-[var(--status-blocked)]">
                Update failed and optimistic changes were rolled back. Please retry.
              </p>
            ) : null}
            <div className="border-t border-[var(--app-border)] pt-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Device token</p>
                  <p className="text-xs text-[var(--app-muted)]">Reissue a new one-time token for client reactivation.</p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="compact"
                  onClick={handleOpenReissueModal}
                  disabled={!resolvedDetailComputer}
                >
                  Reissue token
                </Button>
              </div>
            </div>
          </form>
          {computerDetailQuery.isFetching ? <p className="text-xs text-[var(--app-muted)]">Refreshing detail data...</p> : null}
        </section>
      </ComputerDetailDrawer>
      <ReissueTokenModal
        isOpen={isReissueModalOpen}
        onClose={handleCloseReissueModal}
        computerId={resolvedDetailComputer?.id ?? selectedComputerId}
        computerDisplayName={resolvedDetailComputer?.name?.trim() || selectedComputer?.displayName || "Unknown computer"}
        onConfirmReissue={handleConfirmReissue}
      />
    </section>
  );
}
