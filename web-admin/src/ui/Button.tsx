import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "danger" | "neutral";
type ButtonSize = "default" | "compact";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--action-primary)] text-white hover:brightness-110 disabled:hover:brightness-100",
  danger:
    "bg-[var(--action-danger)] text-white hover:brightness-110 disabled:hover:brightness-100",
  neutral:
    "bg-[var(--app-surface)] text-[var(--app-fg)] border border-[var(--app-border)] hover:bg-slate-50 disabled:hover:bg-[var(--app-surface)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "px-4 py-2.5 text-sm",
  compact: "px-3 py-2 text-sm",
};

export function Button({
  type = "button",
  variant = "primary",
  size = "default",
  className = "",
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={[
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium",
        "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset-surface)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(" ")}
      {...props}
    />
  );
}
