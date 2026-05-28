import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { ForbiddenState } from "@/ui/ForbiddenState";
import { authStoreActions, useAuthStore } from "./auth.store";

export type AuthGateState = {
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  isForbidden: boolean;
};

type ProtectedRouteProps = {
  authState?: AuthGateState;
  redirectTo?: string;
  loadingFallback?: ReactNode;
  children?: ReactNode;
};

function useAuthGateState(): AuthGateState {
  const hasBootstrappedRef = useRef(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const authStatus = useAuthStore((state) => state.status);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      setIsCheckingSession(false);
      return;
    }

    hasBootstrappedRef.current = true;
    void authStoreActions
      .bootstrapSession()
      .finally(() => setIsCheckingSession(false));
  }, []);

  return {
    isBootstrapping:
      isCheckingSession || isBootstrapping || authStatus === "bootstrapping",
    isAuthenticated: authStatus === "authenticated",
    isForbidden: authStatus === "forbidden",
  };
}

export function ProtectedRoute({
  authState,
  redirectTo = "/login",
  loadingFallback,
  children,
}: ProtectedRouteProps): JSX.Element {
  const resolvedAuthState = authState ?? useAuthGateState();

  if (resolvedAuthState.isBootstrapping) {
    return (
      <div className="p-6 text-sm text-[var(--app-muted)]">
        {loadingFallback ?? "Checking session..."}
      </div>
    );
  }

  if (resolvedAuthState.isForbidden) {
    return (
      <div className="p-6">
        <ForbiddenState
          title="Access to this area is forbidden"
          description="Your session is still active, but your current account cannot access protected operations pages."
        />
      </div>
    );
  }

  if (!resolvedAuthState.isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (children) {
    return <>{children}</>;
  }

  return <Outlet />;
}
