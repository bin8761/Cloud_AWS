import { Select } from "@/ui/Select";
import { TextInput } from "@/ui/TextInput";
import { Button } from "@/ui/Button";

type ComputerListToolbarProps = {
  searchValue: string;
  statusValue: string;
  sortValue: string;
  pageSizeValue: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onPageSizeChange: (value: number) => void;
  currentPage: number;
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  isPreviousDisabled: boolean;
  isNextDisabled: boolean;
};

export function ComputerListToolbar({
  searchValue,
  statusValue,
  sortValue,
  pageSizeValue,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onPageSizeChange,
  currentPage,
  totalPages,
  onPreviousPage,
  onNextPage,
  isPreviousDisabled,
  isNextDisabled,
}: ComputerListToolbarProps): JSX.Element {
  return (
    <section
      className="rounded-[var(--radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 md:p-5"
      aria-label="Computer list toolbar"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
        <div className="space-y-1 lg:max-w-[280px] xl:max-w-none">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--app-muted)]">Inventory controls</h2>
          <p className="text-sm text-[var(--app-fg)]">Search, filter, sorting, and paging controls appear in this toolbar.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex-1 lg:gap-2 xl:grid-cols-4 xl:gap-3">
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-muted)]">
            Search
            <TextInput
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by name or MAC"
              aria-label="Search computers"
            />
          </label>

          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-muted)]">
            Status
            <Select
              value={statusValue}
              onChange={(event) => onStatusChange(event.target.value)}
              aria-label="Filter computers by status"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLOCKED">Blocked</option>
            </Select>
          </label>

          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-muted)]">
            Sort
            <Select
              value={sortValue}
              onChange={(event) => onSortChange(event.target.value)}
              aria-label="Sort computers"
            >
              <option value="createdAt:desc">Newest first</option>
              <option value="createdAt:asc">Oldest first</option>
              <option value="updatedAt:desc">Recently updated</option>
              <option value="updatedAt:asc">Least recently updated</option>
            </Select>
          </label>

          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-muted)]">
            Page size
            <Select
              value={String(pageSizeValue)}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              aria-label="Select page size"
            >
              <option value="10">10 rows</option>
              <option value="20">20 rows</option>
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
            </Select>
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] pt-4 lg:flex-nowrap lg:gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-muted)]" aria-live="polite">
          Page {currentPage} of {totalPages}
        </p>

        <div className="flex items-center gap-2 lg:gap-1.5">
          <Button
            type="button"
            variant="neutral"
            size="compact"
            onClick={onPreviousPage}
            disabled={isPreviousDisabled}
            aria-label="Go to previous page"
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="neutral"
            size="compact"
            onClick={onNextPage}
            disabled={isNextDisabled}
            aria-label="Go to next page"
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
