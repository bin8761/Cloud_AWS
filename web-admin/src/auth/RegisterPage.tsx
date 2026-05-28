import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { registerTenant } from "@/auth/auth.api";
import {
  registerTenantFormSchema,
  type RegisterTenantFormValues,
} from "@/auth/register.schema";
import { Button } from "@/ui/Button";
import { TextInput } from "@/ui/TextInput";
import type { FrontendApiError } from "@/lib/errors";

const SAFE_REGISTER_GENERIC_MESSAGE =
  "Unable to submit registration right now. Please try again in a moment.";

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterTenantFormValues>({
    defaultValues: {
      tenantName: "",
      tenantCode: "",
      adminFullName: "",
      adminEmail: "",
      adminPassword: "",
    },
    mode: "onSubmit",
  });

  const onValidSubmit = async (
    values: RegisterTenantFormValues,
  ): Promise<void> => {
    setSubmitErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        ...values,
        tenantCode: values.tenantCode.trim().toUpperCase(),
      };
      const result = await registerTenant(payload);

      setSuccessMessage(
        `Verification code sent to ${result.email}. Expires in ${result.expiresInSeconds} seconds.`,
      );
      navigate(
        `/register/verify?registrationId=${encodeURIComponent(result.registrationId)}`,
        { replace: true },
      );
    } catch (error: unknown) {
      const maybeApiError = error as Partial<FrontendApiError> | null;
      if (maybeApiError?.message) {
        setSubmitErrorMessage(maybeApiError.message);
        return;
      }

      setSubmitErrorMessage(SAFE_REGISTER_GENERIC_MESSAGE);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full max-w-md rounded-[var(--radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm sm:max-w-lg sm:p-7 lg:max-w-xl lg:p-8">
        <header className="space-y-1.5">
          <h1 className="text-xl font-semibold text-[var(--app-fg)] sm:text-2xl">
            Register Tenant
          </h1>
          <p className="text-sm text-[var(--app-muted)] sm:text-base">
            Create a tenant and primary admin account.
          </p>
        </header>

        <form
          className="mt-6 space-y-4 sm:mt-7 sm:space-y-5"
          onSubmit={handleSubmit(onValidSubmit)}
          noValidate
        >
          <Field
            id="register-tenant-name"
            label="Tenant name"
            error={errors.tenantName?.message}
          >
            <TextInput
              id="register-tenant-name"
              {...register("tenantName", {
                validate: (value: string) => {
                  const parsed =
                    registerTenantFormSchema.shape.tenantName.safeParse(value);
                  return (
                    parsed.success ||
                    parsed.error.issues[0]?.message ||
                    "Tenant name is invalid."
                  );
                },
              })}
              placeholder="My Store"
              disabled={isSubmitting}
            />
          </Field>

          <Field
            id="register-tenant-code"
            label="Tenant code"
            error={errors.tenantCode?.message}
          >
            <TextInput
              id="register-tenant-code"
              {...register("tenantCode", {
                validate: (value: string) => {
                  const parsed =
                    registerTenantFormSchema.shape.tenantCode.safeParse(value);
                  return (
                    parsed.success ||
                    parsed.error.issues[0]?.message ||
                    "Tenant code is invalid."
                  );
                },
              })}
              placeholder="MYSTORE"
              disabled={isSubmitting}
            />
          </Field>

          <Field
            id="register-admin-full-name"
            label="Admin full name"
            error={errors.adminFullName?.message}
          >
            <TextInput
              id="register-admin-full-name"
              {...register("adminFullName", {
                validate: (value: string) => {
                  const parsed =
                    registerTenantFormSchema.shape.adminFullName.safeParse(value);
                  return (
                    parsed.success ||
                    parsed.error.issues[0]?.message ||
                    "Full name is invalid."
                  );
                },
              })}
              placeholder="Jane Doe"
              disabled={isSubmitting}
            />
          </Field>

          <Field
            id="register-admin-email"
            label="Admin email"
            error={errors.adminEmail?.message}
          >
            <TextInput
              id="register-admin-email"
              type="email"
              autoComplete="email"
              {...register("adminEmail", {
                validate: (value: string) => {
                  const parsed =
                    registerTenantFormSchema.shape.adminEmail.safeParse(value);
                  return (
                    parsed.success ||
                    parsed.error.issues[0]?.message ||
                    "Email is invalid."
                  );
                },
              })}
              placeholder="admin@example.com"
              disabled={isSubmitting}
            />
          </Field>

          <Field
            id="register-admin-password"
            label="Admin password"
            error={errors.adminPassword?.message}
          >
            <TextInput
              id="register-admin-password"
              type="password"
              autoComplete="new-password"
              {...register("adminPassword", {
                validate: (value: string) => {
                  const parsed =
                    registerTenantFormSchema.shape.adminPassword.safeParse(value);
                  return (
                    parsed.success ||
                    parsed.error.issues[0]?.message ||
                    "Password is invalid."
                  );
                },
              })}
              placeholder="Create a strong password"
              disabled={isSubmitting}
            />
          </Field>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Register tenant"}
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

          {successMessage ? (
            <p
              className="rounded-[var(--radius-sm)] border border-[var(--action-success)]/30 bg-[var(--action-success)]/10 px-3 py-2 text-sm text-[var(--action-success)]"
              role="status"
              aria-live="polite"
            >
              {successMessage}
            </p>
          ) : null}
        </form>

        <p className="mt-6 text-sm text-[var(--app-muted)]">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-[var(--app-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface)]"
          >
            Sign in
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
