import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/ui/Button";
import { TextInput } from "@/ui/TextInput";
import { authStoreActions } from "@/auth/auth.store";
import type { FrontendApiError } from "@/lib/errors";
import { loginFormSchema, type LoginFormValues } from "@/auth/login.schema";

const SAFE_LOGIN_FAILURE_MESSAGE = "Unable to sign in. Please check your credentials and try again.";
const SAFE_LOGIN_GENERIC_MESSAGE = "Unable to sign in right now. Please try again in a moment.";

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [loginFailureMessage, setLoginFailureMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onSubmit",
  });

  const emailRegistration = register("email", {
    validate: (value: string) => {
      const parsed = loginFormSchema.shape.email.safeParse(value);
      return parsed.success || parsed.error.issues[0]?.message || "Email is invalid.";
    },
  });

  const passwordRegistration = register("password", {
    validate: (value: string) => {
      const parsed = loginFormSchema.shape.password.safeParse(value);
      return parsed.success || parsed.error.issues[0]?.message || "Password is invalid.";
    },
  });

  const onValidSubmit = async (values: LoginFormValues): Promise<void> => {
    setLoginFailureMessage(null);

    try {
      await authStoreActions.loginWithPassword(values);
      navigate("/dashboard", { replace: true });
    } catch (error: unknown) {
      setValue("password", "");

      const maybeApiError = error as Partial<FrontendApiError> | null;
      if (maybeApiError && (maybeApiError.status === 401 || maybeApiError.status === 403)) {
        setLoginFailureMessage(SAFE_LOGIN_FAILURE_MESSAGE);
        return;
      }

      setLoginFailureMessage(SAFE_LOGIN_GENERIC_MESSAGE);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full max-w-md rounded-[var(--radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm sm:max-w-lg sm:p-7 lg:max-w-xl lg:p-8 2xl:max-w-2xl 2xl:p-10">
        <header className="space-y-1.5 lg:space-y-2">
          <h1 className="text-xl font-semibold text-[var(--app-fg)] sm:text-2xl lg:text-[1.75rem] 2xl:text-[2rem]">Web Admin Login</h1>
          <p className="text-sm text-[var(--app-muted)] sm:text-base lg:text-[1.05rem]">Sign in with your tenant admin account.</p>
        </header>

        <form className="mt-6 space-y-4 sm:mt-7 sm:space-y-5 lg:mt-8 lg:space-y-6" onSubmit={handleSubmit(onValidSubmit)} noValidate>
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-sm font-medium text-[var(--app-fg)]">
              Email
            </label>
            <TextInput
              id="login-email"
              type="email"
              autoComplete="email"
              {...emailRegistration}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              placeholder="admin@example.com"
              disabled={isSubmitting}
            />
            {errors.email ? (
              <p id="login-email-error" className="text-sm text-[var(--action-danger)]">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-sm font-medium text-[var(--app-fg)]">
              Password
            </label>
            <TextInput
              id="login-password"
              type="password"
              autoComplete="current-password"
              {...passwordRegistration}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              placeholder="Enter your password"
              disabled={isSubmitting}
            />
            {errors.password ? (
              <p id="login-password-error" className="text-sm text-[var(--action-danger)]">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting} aria-label="Sign in to web admin">
            {isSubmitting ? "Signing In..." : "Sign In"}
          </Button>

          {loginFailureMessage ? (
            <p
              className="rounded-[var(--radius-sm)] border border-[var(--action-danger)]/30 bg-[var(--action-danger)]/10 px-3 py-2 text-sm text-[var(--action-danger)]"
              role="alert"
              aria-live="polite"
            >
              {loginFailureMessage}
            </p>
          ) : null}
        </form>

        <p className="mt-6 text-sm text-[var(--app-muted)]">
          New tenant?{" "}
          <Link
            to="/register"
            className="font-medium text-[var(--app-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface)]"
          >
            Register here
          </Link>
        </p>
      </section>
    </main>
  );
}
