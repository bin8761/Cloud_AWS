import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComputersPage } from "@/computers/ComputersPage";
import type { Computer, ComputersListQuery } from "@/computers/computers.types";

const useAdminPresenceMock = vi.fn();
const listQueryMock = {
  data: undefined as { items: Computer[]; totalPages: number } | undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null as unknown,
  refetch: vi.fn().mockResolvedValue(undefined),
};
const detailQueryMock = { data: null as Computer | null, isFetching: false };
const updateMutationMock = { isPending: false, isSuccess: false, isError: false, error: null as unknown, mutate: vi.fn() };
const reissueMutationMock = { mutateAsync: vi.fn() };
const reissueRegistrationSecretMutationMock = { mutateAsync: vi.fn() };
const registerComputerMutationMock = { mutateAsync: vi.fn() };
const realtimeState = { connectionStatus: "connected", presenceByComputerId: {} };
const listQueryCalls: Array<ComputersListQuery> = [];

vi.mock("@/realtime/useAdminPresence", () => ({ useAdminPresence: () => useAdminPresenceMock() }));
vi.mock("@/realtime/realtime.store", () => ({ useRealtimeStore: (selector: (state: typeof realtimeState) => unknown) => selector(realtimeState) }));
vi.mock("@/auth/auth.store", () => ({
  useAuthStore: (selector: (state: { tenant: { code: string } | null }) => unknown) =>
    selector({ tenant: { code: "HELLO" } }),
}));
vi.mock("@/computers/computers.queries", () => ({
  useComputersListQuery: (query: ComputersListQuery) => {
    listQueryCalls.push(query);
    return listQueryMock;
  },
  useComputerDetailQuery: () => detailQueryMock,
  useUpdateComputerMutation: () => updateMutationMock,
  useReissueComputerTokenMutation: () => reissueMutationMock,
  useReissueComputerRegistrationSecretMutation: () => reissueRegistrationSecretMutationMock,
  useRegisterComputerMutation: () => registerComputerMutationMock,
}));

describe("Computers page component flows", () => {
  beforeEach(() => {
    listQueryCalls.length = 0;
    listQueryMock.data = { items: [baseComputer()], totalPages: 3 };
    listQueryMock.isLoading = false;
    listQueryMock.isFetching = false;
    listQueryMock.isError = false;
    listQueryMock.error = null;
    detailQueryMock.data = null;
    updateMutationMock.isPending = false;
    updateMutationMock.isSuccess = false;
    updateMutationMock.isError = false;
    updateMutationMock.error = null;
    reissueMutationMock.mutateAsync.mockReset();
    reissueMutationMock.mutateAsync.mockResolvedValue({ computer: baseComputer(), deviceToken: "new-device-token-123" });
    reissueRegistrationSecretMutationMock.mutateAsync.mockReset();
    reissueRegistrationSecretMutationMock.mutateAsync.mockResolvedValue({
      computerRegistrationSecret: "tenant-secret-123",
    });
    registerComputerMutationMock.mutateAsync.mockReset();
    registerComputerMutationMock.mutateAsync.mockResolvedValue({
      computer: baseComputer(),
      deviceToken: "created-device-token-999",
    });
  });

  it("handles list controls", async () => {
    render(<ComputersPage />);

    fireEvent.change(screen.getByLabelText("Search computers"), { target: { value: "alpha" } });
    fireEvent.change(screen.getByLabelText("Filter computers by status"), { target: { value: "BLOCKED" } });
    fireEvent.change(screen.getByLabelText("Sort computers"), { target: { value: "updatedAt:asc" } });
    fireEvent.change(screen.getByLabelText("Select page size"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Go to previous page" }));

    await waitFor(() => {
      const latest = listQueryCalls[listQueryCalls.length - 1];
      expect(latest.status).toBe("BLOCKED");
      expect(latest.sort).toBe("updatedAt:asc");
      expect(latest.pageSize).toBe(50);
    });

    await waitFor(() => {
      const hasSearch = listQueryCalls.some((entry) => entry.q === "alpha");
      expect(hasSearch).toBe(true);
    }, { timeout: 1000 });
  });

  it("opens detail from row action", async () => {
    render(<ComputersPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "Open details for Alpha" })[0]);
    expect((await screen.findAllByLabelText("Computer detail panel")).length).toBeGreaterThan(0);
  });

  it("opens detail from mobile card action", async () => {
    render(<ComputersPage />);
    fireEvent.click(screen.getAllByText("Open details")[0]);
    expect((await screen.findAllByLabelText("Computer detail panel")).length).toBeGreaterThan(0);
  });

  it("renders detail metadata and editable allowed fields", async () => {
    render(<ComputersPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "Open details for Alpha" })[0]);

    expect((await screen.findAllByText("Computer ID")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("MAC address").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tenant ID (read-only)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Notes (editable)").length).toBeGreaterThan(0);
    expect(screen.queryByDisplayValue("tenant-1")).toBeNull();
  });

  it("renders update rollback feedback", async () => {
    updateMutationMock.isError = true;
    updateMutationMock.error = { status: 500, code: "INTERNAL", message: "fail" };
    render(<ComputersPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "Open details for Alpha" })[0]);
    expect((await screen.findAllByText("Update failed and optimistic changes were rolled back. Please retry.")).length).toBeGreaterThan(0);
  });

  it("renders update success feedback", async () => {
    updateMutationMock.isSuccess = true;
    render(<ComputersPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "Open details for Alpha" })[0]);
    expect((await screen.findAllByText("Update completed successfully.")).length).toBeGreaterThan(0);
  });

  it("validates reissue reason, reveals token, copies, and clears on close", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: writeTextMock }, configurable: true });

    render(<ComputersPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "Open details for Alpha" })[0]);
    fireEvent.click((await screen.findAllByRole("button", { name: "Reissue token" }))[0]);

    fireEvent.click(screen.getByRole("button", { name: "Confirm reissue" }));
    expect(await screen.findByText("Reason is required before reissuing a token.")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Example: Client PC was reinstalled"), { target: { value: "Reinstall" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm reissue" }));

    expect(await screen.findByText("New one-time token")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy one-time device token" }));
    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith("new-device-token-123"));

    fireEvent.click(screen.getByRole("button", { name: "Close token reissue modal" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Reissue token" })[0]);
    expect(screen.queryByText("New one-time token")).toBeNull();
  });

  it("disables confirm while token reissue is pending", async () => {
    let resolvePending!: (value: { computer: Computer; deviceToken: string }) => void;
    reissueMutationMock.mutateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePending = resolve;
        }),
    );

    render(<ComputersPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "Open details for Alpha" })[0]);
    fireEvent.click((await screen.findAllByRole("button", { name: "Reissue token" }))[0]);
    fireEvent.change(screen.getByPlaceholderText("Example: Client PC was reinstalled"), { target: { value: "Reinstall" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm reissue" }));

    const confirmButton = screen.getByRole("button", { name: "Reissuing..." });
    expect(confirmButton.getAttribute("disabled")).not.toBeNull();
    resolvePending({ computer: baseComputer(), deviceToken: "pending-token" });
    await waitFor(() => {
      expect(screen.getByText("New one-time token")).toBeTruthy();
    });
  });

  it("reissues registration secret from computers header", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: writeTextMock }, configurable: true });

    render(<ComputersPage />);
    fireEvent.click(screen.getByRole("button", { name: "Reissue registration secret" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm reissue" }));
    expect(await screen.findByText("Reason is required before reissuing registration secret.")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Example: Previous secret was lost"), { target: { value: "Lost old secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm reissue" }));
    expect(await screen.findByText("New one-time registration secret")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy registration secret" }));
    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith("tenant-secret-123"));
  });

  it("creates computer from header modal", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: writeTextMock }, configurable: true });

    render(<ComputersPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create computer" }));
    fireEvent.change(screen.getByPlaceholderText("Enter tenant registration secret"), { target: { value: "secret-1" } });
    fireEvent.change(screen.getByPlaceholderText("AA:BB:CC:DD:EE:FF"), { target: { value: "AA:BB:CC:DD:EE:11" } });
    fireEvent.change(screen.getByPlaceholderText("Front desk POS"), { target: { value: "Desk 01" } });
    const createButtons = screen.getAllByRole("button", { name: "Create computer" });
    fireEvent.click(createButtons[createButtons.length - 1] as HTMLElement);

    await waitFor(() =>
      expect(registerComputerMutationMock.mutateAsync).toHaveBeenCalledWith({
        tenantCode: "HELLO",
        registrationSecret: "secret-1",
        macAddress: "AA:BB:CC:DD:EE:11",
        name: "Desk 01",
      }),
    );
    expect(
      await screen.findByText("Computer created successfully. Copy the one-time device token before closing."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Created" }).getAttribute("disabled")).not.toBeNull();
    expect(await screen.findByText("One-time device token")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy device token" }));
    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith("created-device-token-999"));
  });

  it("renders forbidden list UI for 403", () => {
    listQueryMock.isError = true;
    listQueryMock.error = { status: 403, code: "FORBIDDEN", message: "forbidden" };
    render(<ComputersPage />);
    expect(screen.getByText("Access to computer list is restricted")).toBeTruthy();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

function baseComputer(): Computer {
  return {
    id: "computer-1",
    tenantId: "tenant-1",
    name: "Alpha",
    macAddress: "AA:BB:CC:DD:EE:FF",
    status: "ACTIVE",
    lastSeenAt: "2026-05-28T10:00:00.000Z",
    notes: "Initial note",
    createdAt: "2026-05-27T10:00:00.000Z",
    updatedAt: "2026-05-28T10:00:00.000Z",
  };
}
