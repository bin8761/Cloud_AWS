import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

type SheetProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeOnBackdropClick?: boolean;
  closeLabel?: string;
  className?: string;
};

export function Sheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  closeOnBackdropClick = true,
  closeLabel = "Close sheet",
  className = "",
}: SheetProps): JSX.Element | null {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    lastActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialogElement = dialogRef.current;
    const closeButton = dialogElement?.querySelector<HTMLElement>('button[aria-label]');
    closeButton?.focus();

    return () => {
      if (lastActiveElementRef.current && lastActiveElementRef.current.isConnected) {
        lastActiveElementRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden md:hidden">
      <div
        className="absolute inset-0 bg-slate-900/60"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={[
          "absolute inset-0 flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--app-surface)]",
          className,
        ].join(" ")}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--app-border)] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-[var(--app-fg)]">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-[var(--app-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-fg)] transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset-surface)]"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              x
            </span>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">{children}</div>
        {footer ? <footer className="border-t border-[var(--app-border)] px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
