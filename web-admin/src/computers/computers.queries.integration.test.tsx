import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Computer, ComputersListResponse } from "@/computers/computers.types";
import { computersQueryKeys, useReissueComputerTokenMutation, useUpdateComputerMutation } from "@/computers/computers.queries";

const updateComputerMock = vi.fn();
const reissueComputerTokenMock = vi.fn();

vi.mock("@/computers/computers.api", () => ({
  listComputers: vi.fn(),
  getComputer: vi.fn(),
  updateComputer: (...args: unknown[]) => updateComputerMock(...args),
  reissueComputerToken: (...args: unknown[]) => reissueComputerTokenMock(...args),
}));

describe("Computers queries integration behavior", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    updateComputerMock.mockReset();
    reissueComputerTokenMock.mockReset();
  });

  it("update success replaces query cache data", async () => {
    const initial = baseComputer();
    const updated = { ...initial, name: "Updated Name" };
    primeCache(queryClient, initial);
    updateComputerMock.mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateComputerMutation(), { wrapper: wrap(queryClient) });

    await result.current.mutateAsync({ id: initial.id, input: { name: "Updated Name" } });

    const list = queryClient.getQueryData<ComputersListResponse>(computersQueryKeys.list({ page: 1 }));
    const detail = queryClient.getQueryData<Computer>(computersQueryKeys.detail(initial.id));

    expect(list?.items[0]?.name).toBe("Updated Name");
    expect(detail?.name).toBe("Updated Name");
  });

  it("update failure rolls back query cache data", async () => {
    const initial = baseComputer();
    primeCache(queryClient, initial);
    updateComputerMock.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => useUpdateComputerMutation(), { wrapper: wrap(queryClient) });

    await expect(result.current.mutateAsync({ id: initial.id, input: { name: "Broken" } })).rejects.toThrow();

    const list = queryClient.getQueryData<ComputersListResponse>(computersQueryKeys.list({ page: 1 }));
    const detail = queryClient.getQueryData<Computer>(computersQueryKeys.detail(initial.id));

    expect(list?.items[0]?.name).toBe(initial.name);
    expect(detail?.name).toBe(initial.name);
  });

  it("reissue token never enters query cache data", async () => {
    const initial = baseComputer();
    primeCache(queryClient, initial);
    reissueComputerTokenMock.mockResolvedValue({
      computer: { ...initial, notes: "reissued" },
      deviceToken: "plain-secret-token",
    });

    const { result } = renderHook(() => useReissueComputerTokenMutation(), { wrapper: wrap(queryClient) });

    const response = await result.current.mutateAsync({ id: initial.id, input: { reason: "rotate" } });

    await waitFor(() => {
      const list = queryClient.getQueryData<ComputersListResponse>(computersQueryKeys.list({ page: 1 }));
      const detail = queryClient.getQueryData<Computer>(computersQueryKeys.detail(initial.id));
      const serialized = JSON.stringify({ list, detail });
      expect(response.deviceToken).toBe("plain-secret-token");
      expect(serialized.includes("plain-secret-token")).toBe(false);
    });
  });
});

function wrap(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function primeCache(queryClient: QueryClient, computer: Computer): void {
  queryClient.setQueryData(computersQueryKeys.list({ page: 1 }), {
    items: [computer],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  } satisfies ComputersListResponse);
  queryClient.setQueryData(computersQueryKeys.detail(computer.id), computer);
}

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
