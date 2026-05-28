import { forwardRef, type InputHTMLAttributes } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className = "", type = "text", ...props }, ref): JSX.Element => {
    return (
      <input
        ref={ref}
        type={type}
        className={[
          "w-full min-h-11 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-fg)]",
          "placeholder:text-[var(--app-muted)]",
          "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset-surface)]",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        ].join(" ")}
        {...props}
      />
    );
  },
);

TextInput.displayName = "TextInput";
