import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";
import { TextInput } from "@/ui/TextInput";

type ReissueRegistrationSecretModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReissue?: (input: { reason: string }) => Promise<{ registrationSecret: string }>;
};

export function ReissueRegistrationSecretModal({
  isOpen,
  onClose,
  onConfirmReissue,
}: ReissueRegistrationSecretModalProps): JSX.Element {
  const [reason, setReason] = useState<string>("");
  const [reasonError, setReasonError] = useState<string>("");
  const [registrationSecret, setRegistrationSecret] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      setReason("");
      setReasonError("");
      setRegistrationSecret(null);
      setIsSubmitting(false);
      setIsCopied(false);
      setCopyFeedback("");
    }
  }, [isOpen]);

  const canSubmit = useMemo(
    () => isOpen && !isSubmitting && Boolean(onConfirmReissue),
    [isOpen, isSubmitting, onConfirmReissue],
  );

  const canCloseWithSecret = registrationSecret === null || isCopied;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!onConfirmReissue || isSubmitting) {
      return;
    }

    const trimmedReason = reason.trim();
    if (trimmedReason.length === 0) {
      setReasonError("Reason is required before reissuing registration secret.");
      return;
    }

    setReasonError("");
    setIsSubmitting(true);

    try {
      const result = await onConfirmReissue({ reason: trimmedReason });
      setRegistrationSecret(result.registrationSecret);
      setIsCopied(false);
      setCopyFeedback("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopySecret = async (): Promise<void> => {
    if (!registrationSecret) {
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setCopyFeedback("Copy failed. Clipboard access is unavailable.");
      return;
    }

    try {
      await navigator.clipboard.writeText(registrationSecret);
      setIsCopied(true);
      setCopyFeedback("Registration secret copied.");
    } catch {
      setCopyFeedback("Copy failed. Please copy manually before closing.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (canCloseWithSecret) {
          onClose();
        }
      }}
      title="Reissue registration secret"
      description="Secret is shown one-time only. Copy and store it securely before closing."
      closeLabel="Close registration secret reissue modal"
      className="max-w-2xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="neutral" size="compact" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="reissue-registration-secret-form" variant="danger" size="compact" disabled={!canSubmit}>
            {isSubmitting ? "Reissuing..." : "Confirm reissue"}
          </Button>
        </div>
      }
    >
      <form id="reissue-registration-secret-form" className="space-y-4" onSubmit={handleSubmit}>
        <section className="space-y-2 rounded-[var(--radius-sm)] border border-[var(--status-blocked)]/40 bg-[var(--status-blocked)]/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--status-blocked)]">Sensitive action warning</p>
          <p className="text-sm text-[var(--app-fg)]">
            Reissuing will rotate the tenant registration secret. Use the new secret for upcoming computer registrations.
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
            placeholder="Example: Previous secret was lost"
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

        {registrationSecret ? (
          <section className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--status-active)]/30 bg-[var(--status-active)]/10 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--status-active)]">New one-time registration secret</p>
            <div className="max-w-full overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--status-active)]/30 bg-[var(--app-surface)]/70 px-2 py-2">
              <p className="break-all font-technical text-sm text-[var(--app-fg)]">{registrationSecret}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="neutral" size="compact" onClick={() => void handleCopySecret()}>
                Copy registration secret
              </Button>
              <p className="text-xs font-medium text-[var(--app-muted)]">
                {isCopied ? "Copied. You can now close this modal." : "Copy is required before closing this modal."}
              </p>
            </div>
            {copyFeedback ? <p className="text-xs font-medium text-[var(--app-fg)]">{copyFeedback}</p> : null}
          </section>
        ) : null}
      </form>
    </Modal>
  );
}
