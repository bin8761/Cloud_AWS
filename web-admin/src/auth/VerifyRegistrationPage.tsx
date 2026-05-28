import { useEffect, useState, type ReactNode } from "react";
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
const MISSING_REGISTRATION_ID_MESSAGE =
  "Registration link is incomplete. Please restart from Register Tenant.";

type VerifyCodeFormValues = {
  verificationCode: string;
};

export function VerifyRegistrationPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
  const registrationIdParam = searchParams.get("registrationId")?.trim() ?? "";

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
      authStoreActions.setSessionTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? null,
      });
      await authStoreActions.bootstrapSession();
      navigate("/dashboard", { replace: true });
    } catch (error: unknown) {
      const maybeApiError = error as Partial<FrontendApiError> | null;
      if (maybeApiError?.message) {
        setSubmitErrorMessage(maybeApiError.message);
        return;
      }

      setSubmitErrorMessage(SAFE_VERIFY_GENERIC_MESSAGE);
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
              disabled={isSubmitting || !registrationIdParam}
            />
          </Field>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !registrationIdParam}
          >
            {isSubmitting ? "Verifying..." : "Verify and sign in"}
          </Button>

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
