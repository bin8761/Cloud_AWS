import type { HTMLAttributes } from "react";

type StatusTone =
  | "active"
  | "inactive"
  | "blocked"
  | "online"
  | "offline"
  | "reconnecting"
  | "unavailable"
  | "neutral";

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  label: string;
  tone?: StatusTone;
  compact?: boolean;
};

const toneClasses: Record<StatusTone, string> = {
  active: "border-[var(--status-active)]/30 bg-[var(--status-active)]/10 text-[var(--status-active)]",
  inactive:
    "border-[var(--status-inactive)]/30 bg-[var(--status-inactive)]/10 text-[var(--status-inactive)]",
  blocked: "border-[var(--status-blocked)]/30 bg-[var(--status-blocked)]/10 text-[var(--status-blocked)]",
  online: "border-[var(--status-online)]/30 bg-[var(--status-online)]/10 text-[var(--status-online)]",
  offline: "border-[var(--status-offline)]/30 bg-[var(--status-offline)]/10 text-[var(--status-offline)]",
  reconnecting:
    "border-[var(--status-reconnecting)]/30 bg-[var(--status-reconnecting)]/10 text-[var(--status-reconnecting)]",
  unavailable:
    "border-[var(--status-unavailable)]/30 bg-[var(--status-unavailable)]/10 text-[var(--status-unavailable)]",
  neutral: "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]",
};

export function StatusBadge({
  label,
  tone = "neutral",
  compact = false,
  className = "",
  ...props
}: StatusBadgeProps): JSX.Element {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        compact ? "min-h-7 px-2 py-0.5 text-xs" : "min-h-8 px-2.5 py-1 text-sm",
        toneClasses[tone],
        className,
      ].join(" ")}
      {...props}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
      <span>{label}</span>
    </span>
  );
}

