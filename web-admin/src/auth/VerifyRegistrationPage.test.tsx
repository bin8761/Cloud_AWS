import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VerifyRegistrationPage } from "@/auth/VerifyRegistrationPage";

const {
  verifyTenantRegistrationMock,
  resendTenantRegistrationMock,
  setSessionTokensMock,
  bootstrapSessionMock,
} = vi.hoisted(() => ({
  verifyTenantRegistrationMock: vi.fn(),
  resendTenantRegistrationMock: vi.fn(),
  setSessionTokensMock: vi.fn(),
  bootstrapSessionMock: vi.fn(),
}));

vi.mock("@/auth/auth.api", () => ({
  verifyTenantRegistration: (...args: unknown[]) =>
    verifyTenantRegistrationMock(...args),
  resendTenantRegistration: (...args: unknown[]) =>
    resendTenantRegistrationMock(...args),
}));

vi.mock("@/auth/auth.store", () => ({
  authStoreActions: {
    setSessionTokens: (...args: unknown[]) => setSessionTokensMock(...args),
    bootstrapSession: (...args: unknown[]) => bootstrapSessionMock(...args),
  },
}));

describe("VerifyRegistrationPage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    verifyTenantRegistrationMock.mockReset();
    resendTenantRegistrationMock.mockReset();
    setSessionTokensMock.mockReset();
    bootstrapSessionMock.mockReset();
    bootstrapSessionMock.mockResolvedValue(undefined);
    resendTenantRegistrationMock.mockResolvedValue({
      registrationId: "reg-1",
      email: "admin@example.com",
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    });
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("shows resend button next to otp and calls resend api", async () => {
    render(
      <MemoryRouter initialEntries={["/register/verify?registrationId=reg-1"]}>
        <Routes>
          <Route path="/register/verify" element={<VerifyRegistrationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const resendButton = screen.getByRole("button", { name: "Resend code" });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(resendTenantRegistrationMock).toHaveBeenCalledWith({
        registrationId: "reg-1",
      });
    });

    expect(screen.getByText("A new verification code has been sent.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resend (60s)" }).getAttribute("disabled")).not.toBeNull();
  });

  it("shows one-time secret popup after verify and continues to dashboard", async () => {
    verifyTenantRegistrationMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      computerRegistrationSecret: "reg-secret-123",
    });

    render(
      <MemoryRouter initialEntries={["/register/verify?registrationId=reg-1"]}>
        <Routes>
          <Route path="/register/verify" element={<VerifyRegistrationPage />} />
          <Route path="/dashboard" element={<div>Dashboard Route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("OTP code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify registration" }));

    expect(await screen.findByText("Computer registration secret")).toBeTruthy();
    expect(
      screen.getByText(
        "This secret is shown only once. If lost, desktop registration will fail until a new secret is issued.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("reg-secret-123")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    await waitFor(() => {
      expect(setSessionTokensMock).toHaveBeenCalledWith({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
      expect(bootstrapSessionMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Dashboard Route")).toBeTruthy();
  });

  it("copies secret from popup", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
    verifyTenantRegistrationMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      computerRegistrationSecret: "reg-secret-456",
    });

    render(
      <MemoryRouter initialEntries={["/register/verify?registrationId=reg-2"]}>
        <Routes>
          <Route path="/register/verify" element={<VerifyRegistrationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("OTP code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify registration" }));

    await screen.findByText("reg-secret-456");
    fireEvent.click(screen.getByRole("button", { name: "Copy secret" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("reg-secret-456");
    });
    expect(screen.getByText("Secret copied. Store it securely.")).toBeTruthy();
  });

  it("shows safe error when verify payload misses registration secret", async () => {
    verifyTenantRegistrationMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      computerRegistrationSecret: "   ",
    });

    render(
      <MemoryRouter initialEntries={["/register/verify?registrationId=reg-3"]}>
        <Routes>
          <Route path="/register/verify" element={<VerifyRegistrationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("OTP code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify registration" }));

    expect(
      await screen.findByText(
        "Registration succeeded, but no computer registration secret was returned.",
      ),
    ).toBeTruthy();
  });

  it("shows safe error and unlocks continue when continue fails", async () => {
    bootstrapSessionMock.mockRejectedValueOnce(new Error("bootstrap failed"));
    verifyTenantRegistrationMock.mockResolvedValue({
      accessToken: "access-token-continue-error",
      refreshToken: "refresh-token-continue-error",
      computerRegistrationSecret: "reg-secret-continue-error",
    });

    render(
      <MemoryRouter initialEntries={["/register/verify?registrationId=reg-continue-error"]}>
        <Routes>
          <Route path="/register/verify" element={<VerifyRegistrationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("OTP code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify registration" }));

    await screen.findByText("reg-secret-continue-error");
    fireEvent.click(screen.getByRole("button", { name: "Continue to dashboard" }));

    expect(
      await screen.findByText(
        "Unable to continue to dashboard right now. Please try again.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue to dashboard" }).getAttribute("disabled")).toBeNull();
  });
});
