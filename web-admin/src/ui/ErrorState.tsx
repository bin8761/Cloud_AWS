import { Button } from "./Button";

type ErrorStateProps = {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title = "Unable to load data",
  description = "Something went wrong. Please try again.",
  retryLabel = "Try again",
  onRetry,
  className = "",
}: ErrorStateProps): JSX.Element {
  return (
    <section
      role="status"
      aria-live="polite"
      className={[
        "rounded-[var(--radius-card)] border border-[var(--action-danger)]/30 bg-[var(--action-danger)]/5 p-6",
        className,
      ].join(" ")}
    >
      <p className="text-base font-semibold text-[var(--app-fg)]">{title}</p>
      <p className="mt-2 text-sm text-[var(--app-muted)]">{description}</p>
      {onRetry ? (
        <div className="mt-4">
          <Button variant="neutral" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

