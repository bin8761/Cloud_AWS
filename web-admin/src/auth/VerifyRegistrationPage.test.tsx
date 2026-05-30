import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VerifyRegistrationPage } from "@/auth/VerifyRegistrationPage";
const MASKED_SECRET_TEXT = "********************";

const {
  verifyTenantRegistrationMock,
  setSessionTokensMock,
  bootstrapSessionMock,
} = vi.hoisted(() => ({
  verifyTenantRegistrationMock: vi.fn(),
  setSessionTokensMock: vi.fn(),
  bootstrapSessionMock: vi.fn(),
}));

vi.mock("@/auth/auth.api", () => ({
  verifyTenantRegistration: (...args: unknown[]) =>
    verifyTenantRegistrationMock(...args),
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
    setSessionTokensMock.mockReset();
    bootstrapSessionMock.mockReset();
    bootstrapSessionMock.mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("reveals one-time registration secret and continues to dashboard after confirmation", async () => {
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

    expect(
      await screen.findByText("Computer registration secret (showing once)"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "This secret is shown only once. If lost, desktop registration will fail until a new secret is issued.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Secret visibility: Visible")).toBeTruthy();
    expect(screen.getByText("reg-secret-123")).toBeTruthy();
    const revealSection = screen.getByLabelText("Registration secret reveal");
    expect(document.activeElement).toBe(revealSection);
    expect(setSessionTokensMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("OTP code").getAttribute("disabled")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Verify registration" }).getAttribute("disabled"),
    ).not.toBeNull();
    expect(
      screen.getByText(
        "Verification complete. Save your registration secret before continuing.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Pending: Secret capture confirmed")).toBeTruthy();
    expect(screen.getByText("Pending: Saved-secret acknowledgment checked")).toBeTruthy();
    expect(screen.getByText("Pending: Ready to continue to dashboard")).toBeTruthy();
    expect(screen.getByText("Continue readiness: 0/3 completed")).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: "Continue readiness progress" }).getAttribute("aria-valuenow"),
    ).toBe("0");
    expect(
      screen.getByRole("progressbar", { name: "Continue readiness progress" }).getAttribute("aria-valuetext"),
    ).toBe("0 of 3 completed");
    const blockedReason = screen.getByText(
      "Continue blocked: confirm secret capture first (copy action or manual-copy fallback).",
    );
    expect(blockedReason).toBeTruthy();
    expect(blockedReason.getAttribute("id")).toBe("continue-blocked-reason");

    const continueButton = screen.getByRole("button", {
      name: "I saved it, continue to dashboard",
    });
    expect(continueButton.getAttribute("disabled")).not.toBeNull();
    expect(continueButton.getAttribute("aria-describedby")).toBe("continue-blocked-reason");
    expect(continueButton.getAttribute("title")).toBe(
      "Continue blocked: confirm secret capture first (copy action or manual-copy fallback).",
    );
    fireEvent.click(continueButton);
    expect(setSessionTokensMock).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I have stored this secret securely and understand it may not be shown again.",
      }),
    );
    expect(screen.getByText("Pending: Secret capture confirmed")).toBeTruthy();
    expect(screen.getByText("Done: Saved-secret acknowledgment checked")).toBeTruthy();
    expect(screen.getByText("Continue readiness: 1/3 completed")).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: "Continue readiness progress" }).getAttribute("aria-valuenow"),
    ).toBe("1");
    expect(
      screen.getByRole("progressbar", { name: "Continue readiness progress" }).getAttribute("aria-valuetext"),
    ).toBe("1 of 3 completed");
    expect(
      screen.getByText("Continue blocked: confirm secret capture first (copy action or manual-copy fallback)."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "I saved it, continue to dashboard" }));
    expect(setSessionTokensMock).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Copy secret is required before continuing. If auto copy fails, confirm manual copy below.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Copy secret" }));
    await screen.findByText("Secret copied. Store it securely.");
    expect(screen.getByText("Secret visibility: Hidden")).toBeTruthy();
    expect(screen.getByText("Done: Secret capture confirmed")).toBeTruthy();
    expect(screen.getByText("Done: Saved-secret acknowledgment checked")).toBeTruthy();
    expect(screen.getByText("Done: Ready to continue to dashboard")).toBeTruthy();
    expect(screen.getByText("Continue readiness: 3/3 completed")).toBeTruthy();
    expect(screen.getByText("Continue is now ready.")).toBeTruthy();
    expect(
      screen.getByText("Shortcut: press Ctrl+Enter (or Cmd+Enter on macOS) to continue."),
    ).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: "Continue readiness progress" }).getAttribute("aria-valuenow"),
    ).toBe("3");
    expect(
      screen.getByRole("progressbar", { name: "Continue readiness progress" }).getAttribute("aria-valuetext"),
    ).toBe("3 of 3 completed");
    expect(
      screen.queryByText("Continue blocked: confirm secret capture first (copy action or manual-copy fallback)."),
    ).toBeNull();
    expect(continueButton.getAttribute("aria-describedby")).toBeNull();
    expect(continueButton.getAttribute("title")).toBeNull();
    expect(screen.queryByText("reg-secret-123")).toBeNull();
    expect(screen.getByText(MASKED_SECRET_TEXT)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reveal for 15s" }));
    expect(screen.getByText("Secret visibility: Visible")).toBeTruthy();
    expect(screen.getByText("reg-secret-123")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "I saved it, continue to dashboard" }));

    await waitFor(() => {
      expect(setSessionTokensMock).toHaveBeenCalledWith({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
      expect(bootstrapSessionMock).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Dashboard Route")).toBeTruthy();
  });

  it("copies registration secret to clipboard", async () => {
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
    expect(screen.getByText(/Last copied at /)).toBeTruthy();
  });

  it("selects secret text for manual copy fallback", async () => {
    verifyTenantRegistrationMock.mockResolvedValue({
      accessToken: "access-token-select",
      refreshToken: "refresh-token-select",
      computerRegistrationSecret: "reg-secret-select",
    });

    render(
      <MemoryRouter initialEntries={["/register/verify?registrationId=reg-select"]}>
        <Routes>
          <Route path="/register/verify" element={<VerifyRegistrationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("OTP code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify registration" }));

    await screen.findByText("reg-secret-select");
    fireEvent.click(screen.getByRole("button", { name: "Hide now" }));
    fireEvent.click(screen.getByRole("button", { name: "Select secret text" }));

    await waitFor(() => {
      const selectedText = window.getSelection()?.toString() ?? "";
      expect(selectedText).toBe("reg-secret-select");
    });
    expect(
      screen.getByText(
        "Secret text selected. Press Ctrl+C (Windows/Linux) or Cmd+C (macOS).",
      ),
    ).toBeTruthy();
  });

  it("auto-dismisses select-secret shortcut hint after timeout", async () => {
    verifyTenantRegistrationMock.mockResolvedValue({
      accessToken: "access-token-select-dismiss",
      refreshToken: "refresh-token-select-dismiss",
      computerRegistrationSecret: "reg-secret-select-dismiss",
    });

    render(
      <MemoryRouter initialEntries={["/register/verify?registrationId=reg-select-dismiss"]}>
        <Routes>
          <Route path="/register/verify" element={<VerifyRegistrationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("OTP code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify registration" }));

    await screen.findByText("reg-secret-select-dismiss");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Select secret text" }));
    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    expect(
      screen.getByText(
        "Secret text selected. Press Ctrl+C (Windows/Linux) or Cmd+C (macOS).",
      ),
    ).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(
      screen.queryByText(
        "Secret text selected. Press Ctrl+C (Windows/Linux) or Cmd+C (macOS).",
      ),
    ).toBeNull();
  });

  it("auto-hides secret after copy when secret is visible", async () => {
    verifyTenantRegistrationMock.mockResolvedValue({
      accessToken: "access-token-auto-hide",
      refreshToken: "refresh-token-auto-hide",
      computerRegistrationSecret: "reg-secret-auto-hide",
    });

    render(
      <MemoryRouter initialEntries={["/register/verify?registrationId=reg-auto-hide"]}>
        <Routes>
          <Route path="/register/verify" element={<VerifyRegistrationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("OTP code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify registration" }));

    await screen.findByText("reg-secret-auto-hide");
    fireEvent.click(screen.getByRole("button", { name: "Copy secret" }));
    await screen.findByText("Secret copied. Store it securely.");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Reveal for 15s" }));
    expect(screen.getByText("Secret will auto-hide in 15s.")).toBeTruthy();
    expect(screen.getByText("reg-secret-auto-hide")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.queryByText("reg-secret-auto-hide")).toBeNull();
    expect(screen.getByText(MASKED_SECRET_TEXT)).toBeTruthy();
  });

  it("allows continue when manual copy fallback is confirmed", async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error("clipboard denied"));
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
    verifyTenantRegistrationMock.mockResolvedValue({
      accessToken: "access-token-manual",
      refreshToken: "refresh-token-manual",
      computerRegistrationSecret: "reg-secret-manual",
    });

    render(
      <MemoryRouter initialEntries={["/register/verify?registrationId=reg-manual"]}>
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

    await screen.findByText("reg-secret-manual");
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I have stored this secret securely and understand it may not be shown again.",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy secret" }));
    await screen.findByText("Unable to copy. Please copy manually.");

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I copied the secret manually (fallback when clipboard is unavailable).",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "I saved it, continue to dashboard" }));

    await waitFor(() => {
      expect(setSessionTokensMock).toHaveBeenCalledWith({
        accessToken: "access-token-manual",
        refreshToken: "refresh-token-manual",
      });
    });
    expect(await screen.findByText("Dashboard Route")).toBeTruthy();
  });

  it("shows safe error when verify success payload misses registration secret", async () => {
    verifyTenantRegistrationMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      computerRegistrationSecret: "   ",
    });

    render(
      <MemoryRouter initialEntries={["/register/verify?registrationId=reg-3"]}>
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

    expect(
      await screen.findByText(
        "Registration succeeded, but no computer registration secret was returned.",
      ),
    ).toBeTruthy();
    expect(setSessionTokensMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Dashboard Route")).toBeNull();
  });

  it("resets last-copied marker on a new verify reveal session", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
    verifyTenantRegistrationMock.mockResolvedValue({
      accessToken: "access-token-reset",
      refreshToken: "refresh-token-reset",
      computerRegistrationSecret: "reg-secret-reset",
    });

    const view = render(
      <MemoryRouter initialEntries={["/register/verify?registrationId=reg-reset"]}>
        <Routes>
          <Route path="/register/verify" element={<VerifyRegistrationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("OTP code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify registration" }));
    await screen.findByText("reg-secret-reset");
    fireEvent.click(screen.getByRole("button", { name: "Copy secret" }));
    await screen.findByText(/Last copied at /);

    view.unmount();

    render(
      <MemoryRouter initialEntries={["/register/verify?registrationId=reg-reset-new"]}>
        <Routes>
          <Route path="/register/verify" element={<VerifyRegistrationPage />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("OTP code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify registration" }));
    await screen.findByText("reg-secret-reset");
    expect(screen.queryByText(/Last copied at /)).toBeNull();
    expect(screen.queryByText("Continue is now ready.")).toBeNull();
  });

  it("locks secret panel controls while continue is in progress", async () => {
    let resolveBootstrap!: () => void;
    bootstrapSessionMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveBootstrap = resolve;
        }),
    );
    verifyTenantRegistrationMock.mockResolvedValue({
      accessToken: "access-token-lock",
      refreshToken: "refresh-token-lock",
      computerRegistrationSecret: "reg-secret-lock",
    });

    render(
      <MemoryRouter initialEntries={["/register/verify?registrationId=reg-lock"]}>
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
    await screen.findByText("reg-secret-lock");

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I have stored this secret securely and understand it may not be shown again.",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy secret" }));
    await screen.findByText("Secret copied. Store it securely.");

    fireEvent.click(screen.getByRole("button", { name: "I saved it, continue to dashboard" }));

    const continuingButton = screen.getByRole("button", { name: "Continuing..." });
    expect(continuingButton.getAttribute("disabled")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Copy secret" }).getAttribute("disabled")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Reveal for 15s" }).getAttribute("disabled")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Select secret text" }).getAttribute("disabled")).not.toBeNull();
    expect(
      screen.getByRole("checkbox", {
        name: "I copied the secret manually (fallback when clipboard is unavailable).",
      }).getAttribute("disabled"),
    ).not.toBeNull();
    expect(
      screen.getByRole("checkbox", {
        name: "I have stored this secret securely and understand it may not be shown again.",
      }).getAttribute("disabled"),
    ).not.toBeNull();

    resolveBootstrap();
    await waitFor(() => {
      expect(screen.getByText("Dashboard Route")).toBeTruthy();
    });
  });

  it("shows safe error and unlocks controls when continue fails", async () => {
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
          <Route path="/dashboard" element={<div>Dashboard Route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("OTP code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify registration" }));
    await screen.findByText("reg-secret-continue-error");

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I have stored this secret securely and understand it may not be shown again.",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy secret" }));
    await screen.findByText("Secret copied. Store it securely.");
    fireEvent.click(screen.getByRole("button", { name: "I saved it, continue to dashboard" }));

    expect(
      await screen.findByText(
        "Unable to continue to dashboard right now. Please try again.",
      ),
    ).toBeTruthy();
    const continueErrorAlert = screen.getByText(
      "Unable to continue to dashboard right now. Please try again.",
    );
    expect(document.activeElement).toBe(continueErrorAlert);
    expect(screen.queryByText("Dashboard Route")).toBeNull();

    expect(
      screen.getByRole("button", { name: "I saved it, continue to dashboard" }).getAttribute("disabled"),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Copy secret" }).getAttribute("disabled")).toBeNull();
  });

  it("supports Ctrl+Enter shortcut when continue is ready", async () => {
    verifyTenantRegistrationMock.mockResolvedValue({
      accessToken: "access-token-shortcut",
      refreshToken: "refresh-token-shortcut",
      computerRegistrationSecret: "reg-secret-shortcut",
    });

    render(
      <MemoryRouter initialEntries={["/register/verify?registrationId=reg-shortcut"]}>
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
    await screen.findByText("reg-secret-shortcut");
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I have stored this secret securely and understand it may not be shown again.",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy secret" }));
    await screen.findByText("Continue is now ready.");

    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });

    await waitFor(() => {
      expect(setSessionTokensMock).toHaveBeenCalledWith({
        accessToken: "access-token-shortcut",
        refreshToken: "refresh-token-shortcut",
      });
    });
    expect(await screen.findByText("Dashboard Route")).toBeTruthy();
  });
});
