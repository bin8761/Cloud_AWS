import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  className = "",
}: EmptyStateProps): JSX.Element {
  return (
    <section
      className={[
        "rounded-[var(--radius-card)] border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-center",
        className,
      ].join(" ")}
      aria-live="polite"
    >
      {icon ? <div className="mx-auto mb-3 flex w-fit items-center justify-center text-[var(--app-muted)]">{icon}</div> : null}
      <h2 className="text-base font-semibold text-[var(--app-fg)]">{title}</h2>
      {description ? <p className="mt-2 text-sm text-[var(--app-muted)]">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </section>
  );
}

