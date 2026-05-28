import { beforeEach, describe, expect, it, vi } from "vitest";
import { triggerAuthClearCallback } from "@/lib/apiClient";
import type { CurrentUser, LoginResult } from "./auth.types";
import {
  clearSession,
  getAuthStateSnapshot,
  loginWithPassword,
  setSessionTokens,
} from "./auth.store";
import * as authApi from "./auth.api";

vi.mock("./auth.api", () => ({
  login: vi.fn(),
  getMe: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
}));

const mockLoginResult: LoginResult = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
};

const mockCurrentUser: CurrentUser = {
  id: "user-1",
  email: "admin@tenant.local",
  role: "ADMIN",
  tenantId: "tenant-1",
  fullName: "Admin User",
  tenant: {
    id: "tenant-1",
    code: "TENANT",
    name: "Tenant 1",
  },
};

describe("auth.store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    clearSession();
  });

  it("starts with unauthenticated initial state", () => {
    const state = getAuthStateSnapshot();

    expect(state.status).toBe("unauthenticated");
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.currentUser).toBeNull();
    expect(state.tenant).toBeNull();
  });

  it("sets authenticated state on successful login flow", async () => {
    vi.mocked(authApi.login).mockResolvedValue(mockLoginResult);
    vi.mocked(authApi.getMe).mockResolvedValue(mockCurrentUser);

    await loginWithPassword({
      email: "admin@tenant.local",
      password: "password",
    });

    const state = getAuthStateSnapshot();
    expect(state.status).toBe("authenticated");
    expect(state.accessToken).toBe("access-token");
    expect(state.refreshToken).toBe("refresh-token");
    expect(state.currentUser?.email).toBe("admin@tenant.local");
    expect(state.tenant?.id).toBe("tenant-1");
  });

  it("clears session state and stored tokens", () => {
    setSessionTokens({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    clearSession();

    const state = getAuthStateSnapshot();
    expect(state.status).toBe("unauthenticated");
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.currentUser).toBeNull();
    expect(state.tenant).toBeNull();
    expect(window.sessionStorage.getItem("auth.accessToken")).toBeNull();
    expect(window.sessionStorage.getItem("auth.refreshToken")).toBeNull();
  });

  it("clears auth state when 401 callback is triggered", () => {
    setSessionTokens({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    triggerAuthClearCallback();

    const state = getAuthStateSnapshot();
    expect(state.status).toBe("unauthenticated");
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });
});
