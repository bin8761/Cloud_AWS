import type { ButtonHTMLAttributes } from "react";

type IconButtonVariant = "primary" | "danger" | "neutral";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: IconButtonVariant;
  label: string;
};

const variantClasses: Record<IconButtonVariant, string> = {
  primary:
    "bg-[var(--action-primary)] text-white hover:brightness-110 disabled:hover:brightness-100",
  danger:
    "bg-[var(--action-danger)] text-white hover:brightness-110 disabled:hover:brightness-100",
  neutral:
    "bg-[var(--app-surface)] text-[var(--app-fg)] border border-[var(--app-border)] hover:bg-slate-50 disabled:hover:bg-[var(--app-surface)]",
};

export function IconButton({
  type = "button",
  variant = "neutral",
  label,
  className = "",
  children,
  ...props
}: IconButtonProps): JSX.Element {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={[
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-sm)] p-2",
        "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset-surface)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
