import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "@/dashboard/DashboardPage";
import type { Computer } from "@/computers/computers.types";

const listQueryState = {
  data: undefined as { items: Computer[] } | undefined,
  isLoading: false,
  isError: false,
  error: null as unknown,
  refetch: vi.fn().mockResolvedValue(undefined),
};

const realtimeState = {
  connectionStatus: "connected",
  presenceByComputerId: {},
  error: null as unknown,
  recentEventFeed: [],
};

vi.mock("@/computers/computers.queries", () => ({
  useComputersListQuery: () => listQueryState,
}));

vi.mock("@/realtime/useAdminPresence", () => ({
  useAdminPresence: vi.fn(),
}));

vi.mock("@/realtime/realtime.store", () => ({
  useRealtimeStore: (selector: (state: typeof realtimeState) => unknown) => selector(realtimeState),
}));

vi.mock("@/computers/computerSelectors", () => ({
  selectComputerRowViewModels: (computers: Computer[]) =>
    computers.map((computer) => ({
      computer,
      presence: { online: true, lastSeenAt: computer.lastSeenAt, source: "rest", receivedAt: computer.updatedAt },
      displayName: computer.name ?? computer.macAddress,
      adminStatusLabel: computer.status === "ACTIVE" ? "Active" : computer.status === "BLOCKED" ? "Blocked" : "Inactive",
      realtimeLabel: "Online",
    })),
}));

describe("Dashboard component states", () => {
  beforeEach(() => {
    listQueryState.data = undefined;
    listQueryState.isLoading = false;
    listQueryState.isError = false;
    listQueryState.error = null;
    listQueryState.refetch.mockClear();
    realtimeState.connectionStatus = "connected";
    realtimeState.error = null;
    realtimeState.recentEventFeed = [];
    realtimeState.presenceByComputerId = {};
  });

  it("renders loading state", () => {
    listQueryState.isLoading = true;
    render(<DashboardPage />);
    expect(screen.getByText("Realtime Panel")).toBeTruthy();
  });

  it("renders empty state", () => {
    listQueryState.data = { items: [] };
    render(<DashboardPage />);
    expect(screen.getByText("No computers available yet")).toBeTruthy();
  });

  it("renders rest error and retries", () => {
    listQueryState.isError = true;
    listQueryState.error = { status: 500, code: "INTERNAL", message: "fail" };
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole("button", { name: "Retry load" }));
    expect(listQueryState.refetch).toHaveBeenCalledTimes(1);
  });

  it("renders forbidden state", () => {
    listQueryState.isError = true;
    listQueryState.error = { status: 403, code: "FORBIDDEN", message: "forbidden" };
    render(<DashboardPage />);
    expect(screen.getByText("Dashboard access is forbidden")).toBeTruthy();
  });

  it("renders reconnecting state", () => {
    listQueryState.data = { items: [baseComputer()] };
    realtimeState.connectionStatus = "reconnecting";
    render(<DashboardPage />);
    expect(screen.getByText("State: Reconnecting")).toBeTruthy();
  });

  it("renders disconnected state", () => {
    listQueryState.data = { items: [baseComputer()] };
    realtimeState.connectionStatus = "disconnected";
    render(<DashboardPage />);
    expect(screen.getByText("State: Disconnected")).toBeTruthy();
  });

  it("renders populated state", () => {
    listQueryState.data = { items: [baseComputer()] };
    render(<DashboardPage />);
    expect(screen.getByText("Operational Snapshot")).toBeTruthy();
    expect(screen.getByText("Realtime Panel")).toBeTruthy();
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
    notes: "ok",
    createdAt: "2026-05-27T10:00:00.000Z",
    updatedAt: "2026-05-28T10:00:00.000Z",
  };
}
