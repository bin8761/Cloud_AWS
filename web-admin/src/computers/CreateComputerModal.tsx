import { useEffect, useMemo, useState, type FormEvent } from "react";
import { isFrontendApiError } from "@/lib/errors";
import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";
import { TextInput } from "@/ui/TextInput";

type CreateComputerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tenantCode: string;
  onCreate?: (input: {
    tenantCode: string;
    registrationSecret: string;
    macAddress: string;
    name?: string;
  }) => Promise<{ deviceToken: string }>;
};

export function CreateComputerModal({
  isOpen,
  onClose,
  tenantCode,
  onCreate,
}: CreateComputerModalProps): JSX.Element {
  const [registrationSecret, setRegistrationSecret] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setRegistrationSecret("");
      setMacAddress("");
      setName("");
      setErrorMessage("");
      setSuccessMessage("");
      setIsSubmitting(false);
      setDeviceToken(null);
      setCopyFeedback("");
    }
  }, [isOpen]);

  const isCreateCompleted = deviceToken !== null;
  const isFormLocked = isSubmitting || isCreateCompleted;
  const canSubmit = useMemo(
    () => isOpen && !isSubmitting && !isCreateCompleted && Boolean(onCreate),
    [isOpen, isSubmitting, isCreateCompleted, onCreate],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!onCreate || isSubmitting) {
      return;
    }

    const secret = registrationSecret.trim();
    const mac = macAddress.trim();
    const displayName = name.trim();
    if (!secret || !mac) {
      setErrorMessage("Registration secret and MAC address are required.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);
    try {
      const result = await onCreate({
        tenantCode,
        registrationSecret: secret,
        macAddress: mac,
        name: displayName || undefined,
      });
      setDeviceToken(result.deviceToken);
      setCopyFeedback("");
      setSuccessMessage("Computer created successfully. Copy the one-time device token before closing.");
    } catch (error) {
      if (isFrontendApiError(error)) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Create computer failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyToken = async (): Promise<void> => {
    if (!deviceToken) {
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setCopyFeedback("Copy failed. Clipboard access is unavailable.");
      return;
    }
    try {
      await navigator.clipboard.writeText(deviceToken);
      setCopyFeedback("Device token copied.");
    } catch {
      setCopyFeedback("Copy failed. Please copy manually.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create computer"
      description="Register a new computer with tenant code and registration secret."
      closeLabel="Close create computer modal"
      className="max-w-2xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="neutral" size="compact" onClick={onClose} disabled={isSubmitting}>
            {isCreateCompleted ? "Close" : "Cancel"}
          </Button>
          <Button type="submit" form="create-computer-form" size="compact" disabled={!canSubmit}>
            {isSubmitting ? "Creating..." : isCreateCompleted ? "Created" : "Create computer"}
          </Button>
        </div>
      }
    >
      <form id="create-computer-form" className="space-y-4" onSubmit={handleSubmit}>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Tenant code</span>
          <TextInput value={tenantCode} disabled readOnly />
        </label>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Registration secret</span>
          <TextInput
            value={registrationSecret}
            onChange={(event) => setRegistrationSecret(event.target.value)}
            autoComplete="off"
            placeholder="Enter tenant registration secret"
            disabled={isFormLocked}
          />
        </label>

        <label className="space-y-1">
          <span className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">
            <span>MAC address</span>
            <span className="normal-case tracking-normal text-[var(--app-muted)]/80">
              (mở cmd chạy <span className="font-technical">getmac</span>)
            </span>
          </span>
          <TextInput
            value={macAddress}
            onChange={(event) => setMacAddress(event.target.value)}
            autoComplete="off"
            placeholder="AA:BB:CC:DD:EE:FF"
            disabled={isFormLocked}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs uppercase tracking-[0.08em] text-[var(--app-muted)]">Display name (optional)</span>
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
            placeholder="Front desk POS"
            disabled={isFormLocked}
          />
        </label>

        {successMessage ? (
          <p className="rounded-[var(--radius-sm)] border border-[var(--status-active)]/30 bg-[var(--status-active)]/10 px-3 py-2 text-xs font-medium text-[var(--status-active)]">
            {successMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-[var(--radius-sm)] border border-[var(--status-blocked)]/30 bg-[var(--status-blocked)]/10 px-3 py-2 text-xs font-medium text-[var(--status-blocked)]">
            {errorMessage}
          </p>
        ) : null}

        {deviceToken ? (
          <section className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--status-active)]/30 bg-[var(--status-active)]/10 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--status-active)]">One-time device token</p>
            <div className="max-w-full overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--status-active)]/30 bg-[var(--app-surface)]/70 px-2 py-2">
              <p className="break-all font-technical text-sm text-[var(--app-fg)]">{deviceToken}</p>
            </div>
            <Button type="button" variant="neutral" size="compact" onClick={() => void handleCopyToken()}>
              Copy device token
            </Button>
            {copyFeedback ? <p className="text-xs font-medium text-[var(--app-fg)]">{copyFeedback}</p> : null}
          </section>
        ) : null}
      </form>
    </Modal>
  );
}
