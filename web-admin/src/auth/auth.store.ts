import { useSyncExternalStore } from "react";
import type { FrontendApiError } from "@/lib/errors";
import {
  registerAccessTokenGetter,
  registerAuthClearCallback,
  triggerRealtimeDisconnectCallback,
} from "@/lib/apiClient";
import { getMe, login, logout, refreshToken } from "./auth.api";
import type { AuthStatus, CurrentUser, LoginInput, TenantContext } from "./auth.types";

export type AuthState = {
  status: AuthStatus;
  accessToken: string | null;
  refreshToken: string | null;
  currentUser: CurrentUser | null;
  tenant: TenantContext | null;
  isBootstrapping: boolean;
  error: FrontendApiError | null;
};

export type AuthStoreActions = {
  setAccessToken: (accessToken: string | null) => void;
  setSessionTokens: (tokens: {
    accessToken: string | null;
    refreshToken: string | null;
  }) => void;
  clearSession: () => void;
  bootstrapSession: () => Promise<void>;
  loginWithPassword: (input: LoginInput) => Promise<void>;
  logoutUser: () => Promise<void>;
};

const ACCESS_TOKEN_STORAGE_KEY = "auth.accessToken";
const REFRESH_TOKEN_STORAGE_KEY = "auth.refreshToken";

const initialAuthState: AuthState = {
  status: "unauthenticated",
  accessToken: null,
  refreshToken: null,
  currentUser: null,
  tenant: null,
  isBootstrapping: false,
  error: null,
};

const UNKNOWN_AUTH_ERROR: FrontendApiError = {
  status: 500,
  code: "UNKNOWN_ERROR",
  message: "An unexpected error occurred.",
};

let authState: AuthState = initialAuthState;
const listeners = new Set<() => void>();

function emitAuthStateChange(): void {
  listeners.forEach((listener) => listener());
}

function setAuthState(nextState: AuthState): void {
  authState = nextState;
  emitAuthStateChange();
}

function isFrontendApiError(value: unknown): value is FrontendApiError {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeError = value as Partial<FrontendApiError>;
  return (
    typeof maybeError.status === "number" &&
    typeof maybeError.code === "string" &&
    typeof maybeError.message === "string"
  );
}

function normalizeFrontendApiError(error: unknown): FrontendApiError {
  if (isFrontendApiError(error)) {
    return error;
  }

  return UNKNOWN_AUTH_ERROR;
}

function writeTokensToSessionStorage(
  accessToken: string | null,
  refreshTokenValue: string | null,
): void {
  if (accessToken) {
    window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  } else {
    window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }

  if (refreshTokenValue) {
    window.sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshTokenValue);
  } else {
    window.sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
}

function hydrateTokensFromSessionStorage(): void {
  const storedAccessToken = window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  const storedRefreshToken = window.sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);

  authState = {
    ...authState,
    accessToken: authState.accessToken ?? storedAccessToken,
    refreshToken: authState.refreshToken ?? storedRefreshToken,
  };
}

export function getAuthStateSnapshot(): AuthState {
  return authState;
}

export function subscribeAuthStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuthStore<TSelected>(
  selector: (state: AuthState) => TSelected,
): TSelected {
  return useSyncExternalStore(
    subscribeAuthStore,
    () => selector(getAuthStateSnapshot()),
    () => selector(getAuthStateSnapshot()),
  );
}

export function setAuthStatus(status: AuthStatus): void {
  setAuthState({
    ...authState,
    status,
  });
}

export function setAccessToken(accessToken: string | null): void {
  writeTokensToSessionStorage(accessToken, authState.refreshToken);
  setAuthState({
    ...authState,
    accessToken,
  });
}

export function setSessionTokens(tokens: {
  accessToken: string | null;
  refreshToken: string | null;
}): void {
  writeTokensToSessionStorage(tokens.accessToken, tokens.refreshToken);
  setAuthState({
    ...authState,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
}

export function setCurrentUser(currentUser: CurrentUser | null): void {
  setAuthState({
    ...authState,
    currentUser,
  });
}

export function setTenantContext(tenant: TenantContext | null): void {
  setAuthState({
    ...authState,
    tenant,
  });
}

export function setAuthBootstrapLoading(isBootstrapping: boolean): void {
  setAuthState({
    ...authState,
    isBootstrapping,
    status: isBootstrapping ? "bootstrapping" : authState.status,
  });
}

export function setAuthError(error: FrontendApiError | null): void {
  setAuthState({
    ...authState,
    error,
    status: error ? "error" : authState.status,
  });
}

export function clearSession(): void {
  writeTokensToSessionStorage(null, null);
  setAuthState({
    ...authState,
    status: "unauthenticated",
    accessToken: null,
    refreshToken: null,
    currentUser: null,
    tenant: null,
    isBootstrapping: false,
    error: null,
  });
}

export async function bootstrapSession(): Promise<void> {
  hydrateTokensFromSessionStorage();

  if (!authState.accessToken && authState.refreshToken) {
    try {
      const refreshedSession = await refreshToken({
        refreshToken: authState.refreshToken,
      });
      const nextRefreshToken =
        refreshedSession.refreshToken ?? authState.refreshToken;
      writeTokensToSessionStorage(refreshedSession.accessToken, nextRefreshToken);
      authState = {
        ...authState,
        accessToken: refreshedSession.accessToken,
        refreshToken: nextRefreshToken,
      };
    } catch (error: unknown) {
      const normalizedError = normalizeFrontendApiError(error);
      if (normalizedError.status === 401 || normalizedError.status === 403) {
        clearSession();
        return;
      }
    }
  }

  if (!authState.accessToken) {
    clearSession();
    return;
  }

  setAuthState({
    ...authState,
    isBootstrapping: true,
    status: "bootstrapping",
    error: null,
  });

  try {
    const currentUser = await getMe();
    setAuthState({
      ...authState,
      isBootstrapping: false,
      status: "authenticated",
      currentUser,
      tenant: currentUser.tenant,
      error: null,
    });
  } catch (error: unknown) {
    const normalizedError = normalizeFrontendApiError(error);

    if (normalizedError.status === 401) {
      if (authState.refreshToken) {
        try {
          const refreshedSession = await refreshToken({
            refreshToken: authState.refreshToken,
          });
          const nextRefreshToken =
            refreshedSession.refreshToken ?? authState.refreshToken;
          writeTokensToSessionStorage(
            refreshedSession.accessToken,
            nextRefreshToken,
          );
          authState = {
            ...authState,
            accessToken: refreshedSession.accessToken,
            refreshToken: nextRefreshToken,
          };

          const currentUserAfterRefresh = await getMe();
          setAuthState({
            ...authState,
            isBootstrapping: false,
            status: "authenticated",
            currentUser: currentUserAfterRefresh,
            tenant: currentUserAfterRefresh.tenant,
            error: null,
          });
          return;
        } catch {
          clearSession();
          return;
        }
      }

      clearSession();
      return;
    }

    if (normalizedError.status === 403) {
      setAuthState({
        ...authState,
        isBootstrapping: false,
        status: "forbidden",
        error: normalizedError,
      });
      return;
    }

    setAuthState({
      ...authState,
      isBootstrapping: false,
      status: "error",
      error: normalizedError,
    });
  }
}

export async function loginWithPassword(input: LoginInput): Promise<void> {
  setAuthState({
    ...authState,
    isBootstrapping: true,
    status: "bootstrapping",
    error: null,
  });

  try {
    const loginResult = await login(input);
    const nextRefreshToken = loginResult.refreshToken ?? null;
    writeTokensToSessionStorage(loginResult.accessToken, nextRefreshToken);
    setAuthState({
      ...authState,
      accessToken: loginResult.accessToken,
      refreshToken: nextRefreshToken,
    });

    const currentUser = await getMe();
    setAuthState({
      ...authState,
      isBootstrapping: false,
      status: "authenticated",
      accessToken: loginResult.accessToken,
      refreshToken: nextRefreshToken,
      currentUser,
      tenant: currentUser.tenant,
      error: null,
    });
  } catch (error: unknown) {
    const normalizedError = normalizeFrontendApiError(error);
    clearSession();
    setAuthState({
      ...authState,
      status: normalizedError.status === 403 ? "forbidden" : "error",
      error: normalizedError,
    });
    throw normalizedError;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await logout();
  } finally {
    clearSession();
    triggerRealtimeDisconnectCallback();
  }
}

export const authStoreActions: AuthStoreActions = {
  setAccessToken,
  setSessionTokens,
  clearSession,
  bootstrapSession,
  loginWithPassword,
  logoutUser,
};

registerAccessTokenGetter(() => getAuthStateSnapshot().accessToken);
registerAuthClearCallback(clearSession);
