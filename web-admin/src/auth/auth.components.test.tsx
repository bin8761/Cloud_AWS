import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "@/auth/LoginPage";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { AppRoutes } from "@/app/routes";

type MockAuthState = {
  status: "unauthenticated" | "authenticated" | "bootstrapping" | "forbidden" | "error";
  currentUser: { email: string } | null;
  tenant: { name: string } | null;
};

const mockAuthState: MockAuthState = {
  status: "unauthenticated",
  currentUser: null,
  tenant: null,
};

const {
  loginWithPasswordMock,
  bootstrapSessionMock,
  logoutUserMock,
} = vi.hoisted(() => ({
  loginWithPasswordMock: vi.fn(),
  bootstrapSessionMock: vi.fn(),
  logoutUserMock: vi.fn(),
}));

vi.mock("@/auth/auth.store", () => ({
  authStoreActions: {
    loginWithPassword: loginWithPasswordMock,
    bootstrapSession: bootstrapSessionMock,
    logoutUser: logoutUserMock,
  },
  useAuthStore: (selector: (state: MockAuthState) => unknown) => selector(mockAuthState),
}));

vi.mock("@/dashboard/DashboardPage", () => ({ DashboardPage: () => <div>Mock Dashboard</div> }));
vi.mock("@/computers/ComputersPage", () => ({ ComputersPage: () => <div>Mock Computers</div> }));

describe("Auth + route + shell component tests", () => {
  beforeEach(() => {
    mockAuthState.status = "unauthenticated";
    mockAuthState.currentUser = null;
    mockAuthState.tenant = null;
    loginWithPasswordMock.mockReset();
    bootstrapSessionMock.mockReset();
    bootstrapSessionMock.mockResolvedValue(undefined);
    logoutUserMock.mockReset();
  });

  it("validates required email", async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in to web admin" }));

    expect(await screen.findByText("Email is required.")).toBeTruthy();
  });

  it("validates email format", async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bad-email" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to web admin" }));

    expect(await screen.findByText("Please enter a valid email address.")).toBeTruthy();
  });

  it("validates required password", async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to web admin" }));

    expect(await screen.findByText("Password is required.")).toBeTruthy();
  });

  it("disables submit while login is pending", async () => {
    loginWithPasswordMock.mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to web admin" }));

    const submitButton = screen.getByRole("button", { name: "Sign in to web admin" });
    expect(submitButton.getAttribute("disabled")).not.toBeNull();
    expect(submitButton.textContent).toContain("Signing In...");
  });

  it("navigates to dashboard on login success", async () => {
    loginWithPasswordMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard Route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to web admin" }));

    expect(await screen.findByText("Dashboard Route")).toBeTruthy();
  });

  it("renders safe error on login failure", async () => {
    loginWithPasswordMock.mockRejectedValue({ status: 401, code: "UNAUTHORIZED", message: "bad" });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to web admin" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Unable to sign in. Please check your credentials and try again.");
  });

  it("redirects unauthenticated users in ProtectedRoute", () => {
    render(
      <MemoryRouter initialEntries={["/private"]}>
        <Routes>
          <Route path="/login" element={<div>Login Route</div>} />
          <Route path="/private" element={<ProtectedRoute authState={{ isBootstrapping: false, isAuthenticated: false, isForbidden: false }}><div>Private</div></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login Route")).toBeTruthy();
  });

  it("renders protected content when authenticated", () => {
    render(
      <MemoryRouter>
        <ProtectedRoute authState={{ isBootstrapping: false, isAuthenticated: true, isForbidden: false }}>
          <div>Private Content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByText("Private Content")).toBeTruthy();
  });

  it("renders shell sidebar and tenant context in protected app routes", async () => {
    mockAuthState.status = "authenticated";
    mockAuthState.currentUser = { email: "owner@example.com" };
    mockAuthState.tenant = { name: "Tenant One" };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("navigation", { name: "Operations dashboard navigation" })).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Computers")).toBeTruthy();
    expect(screen.getByLabelText("Tenant name: Tenant One")).toBeTruthy();
    expect(screen.getByLabelText("Current user: owner@example.com")).toBeTruthy();
  });

  it("calls logout from shell topbar", async () => {
    mockAuthState.status = "authenticated";
    mockAuthState.currentUser = { email: "owner@example.com" };
    mockAuthState.tenant = { name: "Tenant One" };
    logoutUserMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Log out from web admin" }));

    await waitFor(() => {
      expect(logoutUserMock).toHaveBeenCalledTimes(1);
    });
  });

  it("redirects to login after list 401 clears auth session", async () => {
    mockAuthState.status = "authenticated";
    mockAuthState.currentUser = { email: "owner@example.com" };
    mockAuthState.tenant = { name: "Tenant One" };

    const view = render(
      <MemoryRouter initialEntries={["/computers"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Mock Computers")).toBeTruthy();

    mockAuthState.status = "unauthenticated";
    mockAuthState.currentUser = null;
    mockAuthState.tenant = null;
    view.rerender(
      <MemoryRouter initialEntries={["/computers"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Web Admin Login")).toBeTruthy();
  });
});
