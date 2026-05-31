import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authStoreActions } from "@/auth/auth.store";
import {
  resendTenantRegistration,
  verifyTenantRegistration,
} from "@/auth/auth.api";
import {
  verifyTenantRegistrationFormSchema,
} from "@/auth/register.schema";
import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";
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
const MODAL_DISMISS_HINT_MESSAGE =
  "Use Continue to dashboard after copying the secret.";
const RESEND_SUCCESS_MESSAGE = "A new verification code has been sent.";
const RESEND_FAILED_MESSAGE =
  "Unable to resend code right now. Please try again.";
const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;

type VerifyCodeFormValues = {
  verificationCode: string;
};

export function VerifyRegistrationPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
  const [resendFeedbackMessage, setResendFeedbackMessage] =
    useState<string | null>(null);
  const [continueErrorMessage, setContinueErrorMessage] = useState<string | null>(null);
  const [copyFeedbackMessage, setCopyFeedbackMessage] = useState<string | null>(null);
  const [revealedRegistrationSecret, setRevealedRegistrationSecret] =
    useState<string | null>(null);
  const [pendingSessionTokens, setPendingSessionTokens] = useState<{
    accessToken: string;
    refreshToken: string | null;
  } | null>(null);
  const [isContinuing, setIsContinuing] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState<number>(0);
  const registrationIdParam = searchParams.get("registrationId")?.trim() ?? "";
  const isVerificationLocked = Boolean(revealedRegistrationSecret);
  const canResendCode =
    Boolean(registrationIdParam) &&
    !isVerificationLocked &&
    !isResending &&
    resendCooldownSeconds <= 0;

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
    if (resendCooldownSeconds <= 0) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setResendCooldownSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [resendCooldownSeconds]);

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
      setCopyFeedbackMessage(null);
      setContinueErrorMessage(null);
      setResendFeedbackMessage(null);
    } catch (error: unknown) {
      const maybeApiError = error as Partial<FrontendApiError> | null;
      if (maybeApiError?.message) {
        setSubmitErrorMessage(maybeApiError.message);
        return;
      }

      setSubmitErrorMessage(SAFE_VERIFY_GENERIC_MESSAGE);
    }
  };

  const handleResendCode = async (): Promise<void> => {
    if (!canResendCode || !registrationIdParam) {
      return;
    }

    try {
      setIsResending(true);
      setSubmitErrorMessage(null);
      setResendFeedbackMessage(null);
      const result = await resendTenantRegistration({
        registrationId: registrationIdParam,
      });
      const cooldownSeconds =
        result.resendAfterSeconds > 0
          ? result.resendAfterSeconds
          : DEFAULT_RESEND_COOLDOWN_SECONDS;
      setResendCooldownSeconds(cooldownSeconds);
      setResendFeedbackMessage(RESEND_SUCCESS_MESSAGE);
    } catch (error: unknown) {
      const maybeApiError = error as Partial<FrontendApiError> | null;
      if (maybeApiError?.message) {
        setSubmitErrorMessage(maybeApiError.message);
        return;
      }

      setSubmitErrorMessage(RESEND_FAILED_MESSAGE);
    } finally {
      setIsResending(false);
    }
  };

  const handleCopySecret = async (): Promise<void> => {
    if (!revealedRegistrationSecret) {
      return;
    }

    try {
      await navigator.clipboard.writeText(revealedRegistrationSecret);
      setCopyFeedbackMessage(COPY_SECRET_SUCCESS_MESSAGE);
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
          <Field id="verify-code" label="OTP code" error={errors.verificationCode?.message}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
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
              </div>
              <Button
                type="button"
                variant="neutral"
                className="w-full cursor-pointer sm:w-auto sm:min-w-36"
                onClick={() => void handleResendCode()}
                disabled={!canResendCode}
              >
                {isResending
                  ? "Sending..."
                  : resendCooldownSeconds > 0
                    ? `Resend (${resendCooldownSeconds}s)`
                    : "Resend code"}
              </Button>
            </div>
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
              Verification complete. Review and copy your registration secret in the popup.
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

          {resendFeedbackMessage ? (
            <p className="text-sm text-[var(--app-muted)]" role="status" aria-live="polite">
              {resendFeedbackMessage}
            </p>
          ) : null}
        </form>

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

      <Modal
        isOpen={Boolean(revealedRegistrationSecret)}
        onClose={() => setCopyFeedbackMessage(MODAL_DISMISS_HINT_MESSAGE)}
        closeOnBackdropClick={false}
        closeOnEscape={false}
        title="Computer registration secret"
        description="Shown once after verification. Save it securely before continuing."
      >
        <div className="space-y-3">
          <p className="rounded-[var(--radius-sm)] border border-[var(--action-danger)]/30 bg-[var(--action-danger)]/10 px-3 py-2 text-sm font-medium text-[var(--action-danger)]">
            This secret is shown only once. If lost, desktop registration will fail until a new secret is issued.
          </p>
          <p className="rounded-[var(--radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 font-technical text-sm text-[var(--app-fg)] break-all">
            {revealedRegistrationSecret}
          </p>
          {copyFeedbackMessage ? (
            <p className="text-sm text-[var(--app-muted)]" role="status" aria-live="polite">
              {copyFeedbackMessage}
            </p>
          ) : null}
          {continueErrorMessage ? (
            <p
              className="rounded-[var(--radius-sm)] border border-[var(--action-danger)]/30 bg-[var(--action-danger)]/10 px-3 py-2 text-sm text-[var(--action-danger)]"
              role="alert"
              aria-live="polite"
            >
              {continueErrorMessage}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="neutral" onClick={() => void handleCopySecret()} disabled={isContinuing}>
              Copy secret
            </Button>
            <Button type="button" onClick={() => void handleContinueToDashboard()} disabled={isContinuing || !pendingSessionTokens}>
              {isContinuing ? "Continuing..." : "Continue to dashboard"}
            </Button>
          </div>
        </div>
      </Modal>
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
