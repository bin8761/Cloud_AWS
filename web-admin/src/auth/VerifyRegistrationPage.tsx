import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authStoreActions } from "@/auth/auth.store";
import { verifyTenantRegistration } from "@/auth/auth.api";
import {
  verifyTenantRegistrationFormSchema,
} from "@/auth/register.schema";
import { Button } from "@/ui/Button";
import { TextInput } from "@/ui/TextInput";
import type { FrontendApiError } from "@/lib/errors";

const SAFE_VERIFY_GENERIC_MESSAGE =
  "Unable to verify registration right now. Please try again.";
const SAFE_CONTINUE_GENERIC_MESSAGE =
  "Unable to continue to dashboard right now. Please try again.";
const MISSING_REGISTRATION_ID_MESSAGE =
  "Registration link is incomplete. Please restart from Register Tenant.";
const MISSING_REGISTRATION_SECRET_MESSAGE =
  "Registration succeeded, but no computer registration secret was returned.";
const COPY_SECRET_SUCCESS_MESSAGE = "Secret copied. Store it securely.";
const COPY_SECRET_FAILURE_MESSAGE = "Unable to copy. Please copy manually.";
const SELECT_SECRET_HINT_MESSAGE = "Secret text selected. Press Ctrl+C (Windows/Linux) or Cmd+C (macOS).";
const SECRET_AUTO_HIDE_MS = 15000;
const SECRET_AUTO_HIDE_SECONDS = SECRET_AUTO_HIDE_MS / 1000;
const SELECT_HINT_AUTO_DISMISS_MS = 8000;
const MASKED_SECRET_TEXT = "********************";

type VerifyCodeFormValues = {
  verificationCode: string;
};

export function VerifyRegistrationPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
  const [continueErrorMessage, setContinueErrorMessage] = useState<string | null>(null);
  const [continueReadyAnnouncement, setContinueReadyAnnouncement] = useState<string | null>(null);
  const [copyFeedbackMessage, setCopyFeedbackMessage] = useState<string | null>(null);
  const [selectFeedbackMessage, setSelectFeedbackMessage] = useState<string | null>(null);
  const [revealedRegistrationSecret, setRevealedRegistrationSecret] =
    useState<string | null>(null);
  const [isSecretVisible, setIsSecretVisible] = useState<boolean>(true);
  const [autoHideSecondsRemaining, setAutoHideSecondsRemaining] =
    useState<number>(SECRET_AUTO_HIDE_SECONDS);
  const [lastCopiedAtLabel, setLastCopiedAtLabel] = useState<string | null>(null);
  const [hasCopiedSecret, setHasCopiedSecret] = useState<boolean>(false);
  const [hasManuallyConfirmedCopy, setHasManuallyConfirmedCopy] = useState<boolean>(false);
  const [hasAcknowledgedSecretSaved, setHasAcknowledgedSecretSaved] =
    useState<boolean>(false);
  const [pendingSessionTokens, setPendingSessionTokens] = useState<{
    accessToken: string;
    refreshToken: string | null;
  } | null>(null);
  const [isContinuing, setIsContinuing] = useState<boolean>(false);
  const secretRevealSectionRef = useRef<HTMLElement | null>(null);
  const secretValueRef = useRef<HTMLParagraphElement | null>(null);
  const continueErrorRef = useRef<HTMLParagraphElement | null>(null);
  const continueBlockedReasonRef = useRef<HTMLParagraphElement | null>(null);
  const registrationIdParam = searchParams.get("registrationId")?.trim() ?? "";
  const isVerificationLocked = Boolean(revealedRegistrationSecret);
  const isSecretCaptureConfirmed = hasCopiedSecret || hasManuallyConfirmedCopy;
  const isReadyToContinue = hasAcknowledgedSecretSaved && isSecretCaptureConfirmed;
  const shouldAutoHideSecret = hasCopiedSecret && isSecretVisible;
  const secretVisibilityLabel = isSecretVisible ? "Visible" : "Hidden";
  const continueChecklistCompletedCount = [
    isSecretCaptureConfirmed,
    hasAcknowledgedSecretSaved,
    isReadyToContinue,
  ].filter(Boolean).length;
  const continueChecklistProgressPercent = Math.round((continueChecklistCompletedCount / 3) * 100);
  const continueBlockedReason = !isSecretCaptureConfirmed
    ? "Continue blocked: confirm secret capture first (copy action or manual-copy fallback)."
    : !hasAcknowledgedSecretSaved
      ? "Continue blocked: acknowledgment checkbox is required."
      : null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyCodeFormValues>({
    defaultValues: {
      verificationCode: "",
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    if (registrationIdParam) {
      setSubmitErrorMessage(null);
      return;
    }

    setSubmitErrorMessage(MISSING_REGISTRATION_ID_MESSAGE);
  }, [registrationIdParam]);

  useEffect(() => {
    if (!revealedRegistrationSecret) {
      return;
    }

    secretRevealSectionRef.current?.focus();
  }, [revealedRegistrationSecret]);

  useEffect(() => {
    if (!shouldAutoHideSecret) {
      return;
    }

    setAutoHideSecondsRemaining(SECRET_AUTO_HIDE_SECONDS);
    const intervalId = window.setInterval(() => {
      setAutoHideSecondsRemaining((current) => {
        if (current <= 1) {
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    const timerId = window.setTimeout(() => {
      setIsSecretVisible(false);
    }, SECRET_AUTO_HIDE_MS);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timerId);
    };
  }, [shouldAutoHideSecret]);

  useEffect(() => {
    if (!selectFeedbackMessage) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setSelectFeedbackMessage(null);
    }, SELECT_HINT_AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [selectFeedbackMessage]);

  useEffect(() => {
    if (!continueErrorMessage) {
      return;
    }

    continueErrorRef.current?.focus();
  }, [continueErrorMessage]);

  useEffect(() => {
    if (!continueBlockedReason) {
      return;
    }

    continueBlockedReasonRef.current?.focus();
  }, [continueBlockedReason]);

  useEffect(() => {
    if (isReadyToContinue) {
      setContinueReadyAnnouncement("Continue is now ready.");
      return;
    }
    setContinueReadyAnnouncement(null);
  }, [isReadyToContinue]);

  useEffect(() => {
    if (!revealedRegistrationSecret) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isReadyToContinue || isContinuing) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void handleContinueToDashboard();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isContinuing, isReadyToContinue, revealedRegistrationSecret]);

  const onValidSubmit = async (values: VerifyCodeFormValues): Promise<void> => {
    if (!registrationIdParam) {
      setSubmitErrorMessage(MISSING_REGISTRATION_ID_MESSAGE);
      return;
    }

    setSubmitErrorMessage(null);

    try {
      const result = await verifyTenantRegistration({
        registrationId: registrationIdParam,
        verificationCode: values.verificationCode,
      });
      if (!result.computerRegistrationSecret?.trim()) {
        setSubmitErrorMessage(MISSING_REGISTRATION_SECRET_MESSAGE);
        return;
      }

      setPendingSessionTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? null,
      });
      setRevealedRegistrationSecret(result.computerRegistrationSecret);
      setIsSecretVisible(true);
      setAutoHideSecondsRemaining(SECRET_AUTO_HIDE_SECONDS);
      setCopyFeedbackMessage(null);
      setSelectFeedbackMessage(null);
      setContinueErrorMessage(null);
      setContinueReadyAnnouncement(null);
      setHasCopiedSecret(false);
      setHasManuallyConfirmedCopy(false);
      setHasAcknowledgedSecretSaved(false);
      setLastCopiedAtLabel(null);
    } catch (error: unknown) {
      const maybeApiError = error as Partial<FrontendApiError> | null;
      if (maybeApiError?.message) {
        setSubmitErrorMessage(maybeApiError.message);
        return;
      }

      setSubmitErrorMessage(SAFE_VERIFY_GENERIC_MESSAGE);
    }
  };

  const handleCopySecret = async (): Promise<void> => {
    if (!revealedRegistrationSecret) {
      return;
    }

    try {
      await navigator.clipboard.writeText(revealedRegistrationSecret);
      setHasCopiedSecret(true);
      setCopyFeedbackMessage(COPY_SECRET_SUCCESS_MESSAGE);
      setSelectFeedbackMessage(null);
      setIsSecretVisible(false);
      setAutoHideSecondsRemaining(SECRET_AUTO_HIDE_SECONDS);
      setLastCopiedAtLabel(new Date().toLocaleTimeString());
    } catch {
      setCopyFeedbackMessage(COPY_SECRET_FAILURE_MESSAGE);
    }
  };

  const handleContinueToDashboard = async (): Promise<void> => {
    if (!pendingSessionTokens || isContinuing) {
      return;
    }

    try {
      setIsContinuing(true);
      setContinueErrorMessage(null);
      authStoreActions.setSessionTokens(pendingSessionTokens);
      await authStoreActions.bootstrapSession();
      navigate("/dashboard", { replace: true });
    } catch {
      setContinueErrorMessage(SAFE_CONTINUE_GENERIC_MESSAGE);
    } finally {
      setIsContinuing(false);
    }
  };

  const handleSelectSecretText = (): void => {
    if (!isSecretVisible) {
      setIsSecretVisible(true);
      setAutoHideSecondsRemaining(SECRET_AUTO_HIDE_SECONDS);
    }

    window.setTimeout(() => {
      const secretNode = secretValueRef.current;
      if (!secretNode) {
        return;
      }

      const selection = window.getSelection();
      if (!selection) {
        return;
      }

      const range = document.createRange();
      range.selectNodeContents(secretNode);
      selection.removeAllRanges();
      selection.addRange(range);
      setSelectFeedbackMessage(SELECT_SECRET_HINT_MESSAGE);
    }, 0);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full max-w-md rounded-[var(--radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm sm:max-w-lg sm:p-7 lg:max-w-xl lg:p-8">
        <header className="space-y-1.5">
          <h1 className="text-xl font-semibold text-[var(--app-fg)] sm:text-2xl">
            Verify Registration
          </h1>
          <p className="text-sm text-[var(--app-muted)] sm:text-base">
            Enter the 6-digit code sent to your admin email.
          </p>
        </header>

        <form
          className="mt-6 space-y-4 sm:mt-7 sm:space-y-5"
          onSubmit={handleSubmit(onValidSubmit)}
          noValidate
        >
          <Field
            id="verify-code"
            label="OTP code"
            error={errors.verificationCode?.message}
          >
            <TextInput
              id="verify-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              {...register("verificationCode", {
                validate: (value: string) => {
                  const parsed =
                    verifyTenantRegistrationFormSchema.shape.verificationCode.safeParse(
                      value,
                    );
                  return (
                    parsed.success ||
                    parsed.error.issues[0]?.message ||
                    "Verification code is invalid."
                  );
                },
              })}
              placeholder="123456"
              disabled={isSubmitting || !registrationIdParam || isVerificationLocked}
            />
          </Field>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !registrationIdParam || isVerificationLocked}
          >
            {isSubmitting ? "Verifying..." : "Verify registration"}
          </Button>

          {isVerificationLocked ? (
            <p className="text-sm text-[var(--app-muted)]" role="status" aria-live="polite">
              Verification complete. Save your registration secret before continuing.
            </p>
          ) : null}

          {submitErrorMessage ? (
            <p
              className="rounded-[var(--radius-sm)] border border-[var(--action-danger)]/30 bg-[var(--action-danger)]/10 px-3 py-2 text-sm text-[var(--action-danger)]"
              role="alert"
              aria-live="polite"
            >
              {submitErrorMessage}
            </p>
          ) : null}
        </form>

        {revealedRegistrationSecret ? (
          <section
            ref={secretRevealSectionRef}
            tabIndex={-1}
            className="mt-6 space-y-3 rounded-[var(--radius-sm)] border border-[var(--app-primary)]/30 bg-[var(--app-primary)]/5 p-4"
            aria-label="Registration secret reveal"
          >
            <h2 className="text-sm font-semibold text-[var(--app-fg)]">
              Computer registration secret (showing once)
            </h2>
            <p className="rounded-[var(--radius-sm)] border border-[var(--action-danger)]/30 bg-[var(--action-danger)]/10 px-3 py-2 text-sm font-medium text-[var(--action-danger)]">
              This secret is shown only once. If lost, desktop registration will fail until a new secret is issued.
            </p>
            <p className="text-sm text-[var(--app-muted)]">
              Save this secret now. It is required when registering desktop clients.
            </p>
            <p className="text-xs text-[var(--app-muted)]" role="status" aria-live="polite">
              Secret visibility: {secretVisibilityLabel}
            </p>
            <p
              ref={secretValueRef}
              className="rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 font-technical text-sm text-[var(--app-fg)] break-all"
            >
              {isSecretVisible ? revealedRegistrationSecret : MASKED_SECRET_TEXT}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="neutral" onClick={() => void handleCopySecret()} disabled={isContinuing}>
                Copy secret
              </Button>
              <Button
                type="button"
                variant="neutral"
                onClick={() =>
                  setIsSecretVisible((value) => {
                    const nextValue = !value;
                    if (nextValue) {
                      setAutoHideSecondsRemaining(SECRET_AUTO_HIDE_SECONDS);
                    }
                    return nextValue;
                  })
                }
                disabled={isContinuing}
              >
                {isSecretVisible ? "Hide now" : "Reveal for 15s"}
              </Button>
              <Button type="button" variant="neutral" onClick={handleSelectSecretText} disabled={isContinuing}>
                Select secret text
              </Button>
              <Button
                type="button"
                onClick={() => void handleContinueToDashboard()}
                disabled={!isReadyToContinue || isContinuing}
                aria-describedby={continueBlockedReason ? "continue-blocked-reason" : undefined}
                title={continueBlockedReason ?? undefined}
              >
                {isContinuing ? "Continuing..." : "I saved it, continue to dashboard"}
              </Button>
            </div>
            {shouldAutoHideSecret ? (
              <p className="text-sm text-[var(--app-muted)]" role="status" aria-live="polite">
                Secret will auto-hide in {autoHideSecondsRemaining}s.
              </p>
            ) : null}
            {!isSecretCaptureConfirmed ? (
              <p className="text-sm text-[var(--app-muted)]" role="status" aria-live="polite">
                Copy secret is required before continuing. If auto copy fails, confirm manual copy below.
              </p>
            ) : null}
            {continueBlockedReason ? (
              <p
                id="continue-blocked-reason"
                ref={continueBlockedReasonRef}
                tabIndex={-1}
                className="text-sm text-[var(--app-muted)]"
                role="status"
                aria-live="polite"
              >
                {continueBlockedReason}
              </p>
            ) : null}
            <label className="flex items-start gap-2 text-sm text-[var(--app-fg)]">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border border-[var(--app-border)]"
                checked={hasManuallyConfirmedCopy}
                disabled={isContinuing}
                onChange={(event) => setHasManuallyConfirmedCopy(event.target.checked)}
              />
              <span>I copied the secret manually (fallback when clipboard is unavailable).</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-[var(--app-fg)]">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border border-[var(--app-border)]"
                checked={hasAcknowledgedSecretSaved}
                disabled={isContinuing}
                onChange={(event) => setHasAcknowledgedSecretSaved(event.target.checked)}
              />
              <span>I have stored this secret securely and understand it may not be shown again.</span>
            </label>
            <div
              className="rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
              aria-live="polite"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-muted)]">
                Continue readiness
              </p>
              <p className="mt-1 text-xs text-[var(--app-muted)]">
                {`Continue readiness: ${continueChecklistCompletedCount}/3 completed`}
              </p>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--app-border)]"
                role="progressbar"
                aria-label="Continue readiness progress"
                aria-valuemin={0}
                aria-valuemax={3}
                aria-valuenow={continueChecklistCompletedCount}
                aria-valuetext={`${continueChecklistCompletedCount} of 3 completed`}
              >
                <div
                  className="h-full bg-[var(--action-primary)] transition-[width] duration-200 ease-out"
                  style={{ width: `${continueChecklistProgressPercent}%` }}
                />
              </div>
              <ul className="mt-2 space-y-1 text-sm text-[var(--app-fg)]">
                <li>{isSecretCaptureConfirmed ? "Done:" : "Pending:"} Secret capture confirmed</li>
                <li>{hasAcknowledgedSecretSaved ? "Done:" : "Pending:"} Saved-secret acknowledgment checked</li>
                <li>{isReadyToContinue ? "Done:" : "Pending:"} Ready to continue to dashboard</li>
              </ul>
            </div>
            {copyFeedbackMessage ? (
              <p className="text-sm text-[var(--app-muted)]" role="status" aria-live="polite">
                {copyFeedbackMessage}
              </p>
            ) : null}
            {selectFeedbackMessage ? (
              <p className="text-sm text-[var(--app-muted)]" role="status" aria-live="polite">
                {selectFeedbackMessage}
              </p>
            ) : null}
            {lastCopiedAtLabel ? (
              <p className="text-xs text-[var(--app-muted)]" role="status" aria-live="polite">
                Last copied at {lastCopiedAtLabel}
              </p>
            ) : null}
            {continueErrorMessage ? (
              <p
                ref={continueErrorRef}
                tabIndex={-1}
                className="rounded-[var(--radius-sm)] border border-[var(--action-danger)]/30 bg-[var(--action-danger)]/10 px-3 py-2 text-sm text-[var(--action-danger)]"
                role="alert"
                aria-live="polite"
              >
                {continueErrorMessage}
              </p>
            ) : null}
            {continueReadyAnnouncement ? (
              <p className="text-sm text-[var(--app-muted)]" role="status" aria-live="polite">
                {continueReadyAnnouncement}
              </p>
            ) : null}
            {isReadyToContinue && !isContinuing ? (
              <p className="text-xs text-[var(--app-muted)]" role="status" aria-live="polite">
                Shortcut: press Ctrl+Enter (or Cmd+Enter on macOS) to continue.
              </p>
            ) : null}
          </section>
        ) : null}

        <p className="mt-6 text-sm text-[var(--app-muted)]">
          Need to restart registration?{" "}
          <Link
            to="/register"
            className="font-medium text-[var(--app-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface)]"
          >
            Back to register
          </Link>
        </p>
      </section>
    </main>
  );
}

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
};

function Field({ id, label, error, children }: FieldProps): JSX.Element {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--app-fg)]">
        {label}
      </label>
      {children}
      {error ? <p className="text-sm text-[var(--action-danger)]">{error}</p> : null}
    </div>
  );
}

