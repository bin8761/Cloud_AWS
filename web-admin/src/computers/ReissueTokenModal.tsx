import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";
import { TextInput } from "@/ui/TextInput";

type ReissueTokenModalProps = {
  isOpen: boolean;
  onClose: () => void;
  computerId: string | null;
  computerDisplayName: string;
  onConfirmReissue?: (input: { computerId: string; reason: string }) => Promise<{ deviceToken: string }>;
};

/**
 * Reissue token confirmation modal.
 * Security rule: plain `deviceToken` is stored only in this modal's local state.
 */
export function ReissueTokenModal({
  isOpen,
  onClose,
  computerId,
  computerDisplayName,
  onConfirmReissue,
}: ReissueTokenModalProps): JSX.Element {
  const [reason, setReason] = useState<string>("");
  const [reasonError, setReasonError] = useState<string>("");
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setReason("");
      setReasonError("");
      setDeviceToken(null);
      setIsSubmitting(false);
      setCopyFeedback(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setReason("");
    setReasonError("");
    setDeviceToken(null);
    setIsSubmitting(false);
    setCopyFeedback(null);
  }, [computerId]);

  const canSubmit = useMemo(
    () => isOpen && !isSubmitting && Boolean(computerId) && Boolean(onConfirmReissue),
    [computerId, isOpen, isSubmitting, onConfirmReissue],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!computerId || isSubmitting || !onConfirmReissue) {
      return;
    }

    const trimmedReason = reason.trim();
    if (trimmedReason.length === 0) {
      setReasonError("Reason is required before reissuing a token.");
      return;
    }

    setReasonError("");
    setIsSubmitting(true);

    try {
      const result = await onConfirmReissue({
        computerId,
        reason: trimmedReason,
      });
      setDeviceToken(result.deviceToken);
      setCopyFeedback(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyToken = async (): Promise<void> => {
    if (!deviceToken) {
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setCopyFeedback({
        tone: "error",
        message: "Copy failed. Clipboard access is unavailable in this browser context.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(deviceToken);
      setCopyFeedback({
        tone: "success",
        message: "Token copied to clipboard.",
      });
    } catch {
      setCopyFeedback({
        tone: "error",
        message: "Copy failed. Please copy the token manually.",
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reissue device token"
      description="Reissue creates a new one-time token. The previous token will no longer work."
      closeLabel="Close token reissue modal"
      className="max-w-2xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="neutral" size="compact" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="reissue-token-form" variant="danger" size="compact" disabled={!canSubmit}>
            {isSubmitting ? "Reissuing..." : "Confirm reissue"}
          </Button>
        </div>
      }
    >
      <form id="reissue-token-form" className="space-y-4 overflow-x-hidden" onSubmit={handleSubmit}>
        <section className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-bg)]/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-muted)]">Selected computer identity</p>
          <div className="space-y-1 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Display name</p>
            <p className="text-sm font-semibold text-[var(--app-fg)]">{computerDisplayName}</p>
          </div>
          <div className="space-y-1 rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Computer ID</p>
            <p className="break-all font-technical text-xs text-[var(--app-fg)]">{computerId ?? "No computer selected"}</p>
          </div>
        </section>

        <section className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--status-blocked)]/40 bg-[var(--status-blocked)]/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--status-blocked)]">Sensitive action warning</p>
          <p className="text-sm font-medium text-[var(--app-fg)]">
            The new token is revealed once. After closing this modal, it cannot be viewed again here.
          </p>
          <p className="text-sm text-[var(--app-fg)]">
            Transfer the token securely to the client PC owner and never share it in logs, URLs, or chat channels.
          </p>
        </section>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Reason</span>
          <TextInput
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (reasonError) {
                setReasonError("");
              }
            }}
            placeholder="Example: Client PC was reinstalled"
            autoComplete="off"
            disabled={isSubmitting}
            aria-invalid={reasonError ? "true" : "false"}
          />
        </label>

        {reasonError ? (
          <p className="rounded-[var(--radius-sm)] border border-[var(--status-blocked)]/30 bg-[var(--status-blocked)]/10 px-3 py-2 text-xs font-medium text-[var(--status-blocked)]">
            {reasonError}
          </p>
        ) : null}

        {deviceToken ? (
          <section className="min-w-0 space-y-3 rounded-[var(--radius-sm)] border border-[var(--status-active)]/30 bg-[var(--status-active)]/10 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--status-active)]">New one-time token</p>
            <div className="max-w-full overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--status-active)]/30 bg-[var(--app-surface)]/70 px-2 py-2">
              <p className="min-w-0 break-all font-technical text-sm text-[var(--app-fg)]">{deviceToken}</p>
            </div>
            <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="neutral"
                size="compact"
                onClick={() => {
                  void handleCopyToken();
                }}
                aria-label="Copy one-time device token"
                className="w-full sm:w-auto"
              >
                Copy token
              </Button>
              {copyFeedback ? (
                <p
                  className={
                    copyFeedback.tone === "success"
                      ? "min-w-0 break-words text-xs font-medium text-[var(--status-active)]"
                      : "min-w-0 break-words text-xs font-medium text-[var(--status-blocked)]"
                  }
                >
                  {copyFeedback.message}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </form>
    </Modal>
  );
}
