import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  closeLabel?: string;
  className?: string;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  closeLabel = "Close modal",
  className = "",
}: ModalProps): JSX.Element | null {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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
    const focusableElements = dialogElement?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      dialogElement?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const currentDialog = dialogRef.current;
      if (!currentDialog) {
        return;
      }

      const tabbableElements = currentDialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (tabbableElements.length === 0) {
        event.preventDefault();
        currentDialog.focus();
        return;
      }

      const firstElement = tabbableElements[0];
      const lastElement = tabbableElements[tabbableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeElement === firstElement || activeElement === currentDialog) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      if (lastActiveElementRef.current && lastActiveElementRef.current.isConnected) {
        lastActiveElementRef.current.focus();
      }
    };
  }, [closeOnEscape, isOpen]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px]"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={[
          "relative z-10 w-full max-w-xl rounded-[var(--radius-card)] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-xl",
          className,
        ].join(" ")}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--app-border)] px-5 py-4">
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
        <div className="px-5 py-4">{children}</div>
        {footer ? <footer className="border-t border-[var(--app-border)] px-5 py-4">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
