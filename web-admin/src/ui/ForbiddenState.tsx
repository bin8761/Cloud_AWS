import type { ReactNode } from "react";

type ForbiddenStateProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function ForbiddenState({
  title = "Access denied",
  description = "You do not have permission to view this content.",
  action,
  className = "",
}: ForbiddenStateProps): JSX.Element {
  return (
    <section
      role="status"
      aria-live="polite"
      className={[
        "rounded-[var(--radius-card)] border border-[var(--state-warning)]/30 bg-[var(--state-warning)]/10 p-6",
        className,
      ].join(" ")}
    >
      <p className="text-base font-semibold text-[var(--app-fg)]">{title}</p>
      <p className="mt-2 text-sm text-[var(--app-muted)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

