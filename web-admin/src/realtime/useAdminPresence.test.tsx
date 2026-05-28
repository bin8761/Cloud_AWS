import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAuthStatus, setSessionTokens } from "@/auth/auth.store";
import { computersQueryKeys } from "@/computers/computers.queries";
import { getRealtimeStateSnapshot, resetRealtimeState } from "./realtime.store";
import { useAdminPresence } from "./useAdminPresence";

type Listener = (...args: unknown[]) => void;
type WatchTenantAck =
  | { success: true; data: { onlineComputers: string[] } }
  | { success: false; error: { code: string; message: string } };

class FakeSocket {
  connected = false;
  emitCalls: Array<{ event: string; payload: unknown }> = [];
  private listeners = new Map<string, Set<Listener>>();
  private managerListeners = new Map<string, Set<Listener>>();
  io = {
    on: (event: string, listener: Listener) => {
      const existing = this.managerListeners.get(event) ?? new Set<Listener>();
      existing.add(listener);
      this.managerListeners.set(event, existing);
    },
    off: (event: string, listener: Listener) => {
      this.managerListeners.get(event)?.delete(listener);
    },
  };
  watchAck: WatchTenantAck = { success: true, data: { onlineComputers: [] } };

  on(event: string, listener: Listener): void {
    const existing = this.listeners.get(event) ?? new Set<Listener>();
    existing.add(listener);
    this.listeners.set(event, existing);
  }

  off(event: string, listener: Listener): void {
    this.listeners.get(event)?.delete(listener);
  }

  connect(): void {
    this.connected = true;
  }

  emit(event: string, payload: unknown, ack?: (result: WatchTenantAck) => void): void {
    this.emitCalls.push({ event, payload });
    if (event === "admin:watch-tenant" && typeof ack === "function") {
      ack(this.watchAck);
    }
  }

  trigger(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((listener) => listener(...args));
  }

  triggerManager(event: string): void {
    this.managerListeners.get(event)?.forEach((listener) => listener());
  }
}

const socketRef = {
  current: new FakeSocket(),
};
const connectAdminSocketMock = vi.fn(() => socketRef.current);

vi.mock("./realtime.client", () => ({
  connectAdminSocket: (..._args: unknown[]) => connectAdminSocketMock(),
  disconnectAdminSocket: vi.fn(),
}));

describe("useAdminPresence realtime behavior", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    resetRealtimeState();
    clearSession();
    socketRef.current = new FakeSocket();
    connectAdminSocketMock.mockClear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.spyOn(queryClient, "invalidateQueries");
  });

  it("emits watch tenant after connect and applies snapshot success", async () => {
    socketRef.current.watchAck = {
      success: true,
      data: { onlineComputers: ["computer-1"] },
    };
    setSessionTokens({ accessToken: "token-1", refreshToken: null });
    setAuthStatus("authenticated");

    renderHook(() => useAdminPresence(), { wrapper: wrap(queryClient) });

    act(() => {
      socketRef.current.trigger("connect");
    });

    await waitFor(() => {
      const state = getRealtimeStateSnapshot();
      expect(state.connectionStatus).toBe("connected");
      expect(state.presenceByComputerId["computer-1"]?.online).toBe(true);
      expect(
        socketRef.current.emitCalls.filter((call) => call.event === "admin:watch-tenant"),
      ).toHaveLength(1);
    });
  });

  it("marks unavailable when watch tenant ack fails", async () => {
    socketRef.current.watchAck = {
      success: false,
      error: { code: "WATCH_FAILED", message: "Watch failed" },
    };
    setSessionTokens({ accessToken: "token-2", refreshToken: null });
    setAuthStatus("authenticated");

    renderHook(() => useAdminPresence(), { wrapper: wrap(queryClient) });

    act(() => {
      socketRef.current.trigger("connect");
    });

    await waitFor(() => {
      const state = getRealtimeStateSnapshot();
      expect(state.connectionStatus).toBe("unavailable");
      expect(state.error?.code).toBe("WATCH_FAILED");
    });
  });

  it("updates only matching computer for online and offline events", async () => {
    socketRef.current.watchAck = {
      success: true,
      data: { onlineComputers: ["computer-1", "computer-2"] },
    };
    setSessionTokens({ accessToken: "token-3", refreshToken: null });
    setAuthStatus("authenticated");

    renderHook(() => useAdminPresence(), { wrapper: wrap(queryClient) });

    act(() => {
      socketRef.current.trigger("connect");
      socketRef.current.trigger("computer:online", {
        tenantId: "tenant-1",
        computerId: "computer-3",
        lastSeenAt: "2026-05-28T12:00:00.000Z",
      });
      socketRef.current.trigger("computer:offline", {
        tenantId: "tenant-1",
        computerId: "computer-2",
        lastSeenAt: "2026-05-28T12:05:00.000Z",
      });
    });

    await waitFor(() => {
      const state = getRealtimeStateSnapshot();
      expect(state.presenceByComputerId["computer-1"]?.online).toBe(true);
      expect(state.presenceByComputerId["computer-2"]?.online).toBe(false);
      expect(state.presenceByComputerId["computer-3"]?.online).toBe(true);
    });
  });

  it("keeps event feed bounded", async () => {
    setSessionTokens({ accessToken: "token-4", refreshToken: null });
    setAuthStatus("authenticated");
    renderHook(() => useAdminPresence(), { wrapper: wrap(queryClient) });

    act(() => {
      socketRef.current.trigger("connect");
      for (let index = 0; index < 60; index += 1) {
        socketRef.current.trigger("computer:online", {
          tenantId: "tenant-1",
          computerId: `computer-${index}`,
          lastSeenAt: "2026-05-28T12:00:00.000Z",
        });
      }
    });

    await waitFor(() => {
      expect(getRealtimeStateSnapshot().recentEventFeed).toHaveLength(50);
    });
  });

  it("does not refetch list for online or offline events", async () => {
    setSessionTokens({ accessToken: "token-5", refreshToken: null });
    setAuthStatus("authenticated");
    renderHook(() => useAdminPresence(), { wrapper: wrap(queryClient) });

    act(() => {
      socketRef.current.trigger("connect");
      socketRef.current.trigger("computer:online", {
        tenantId: "tenant-1",
        computerId: "computer-9",
        lastSeenAt: "2026-05-28T12:10:00.000Z",
      });
      socketRef.current.trigger("computer:offline", {
        tenantId: "tenant-1",
        computerId: "computer-9",
        lastSeenAt: "2026-05-28T12:11:00.000Z",
      });
    });

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(0);
  });

  it("triggers exactly one list refresh on reconnect", async () => {
    setSessionTokens({ accessToken: "token-6", refreshToken: null });
    setAuthStatus("authenticated");
    renderHook(() => useAdminPresence(), { wrapper: wrap(queryClient) });

    act(() => {
      socketRef.current.trigger("connect");
      socketRef.current.trigger("disconnect");
      socketRef.current.triggerManager("reconnect_attempt");
      socketRef.current.trigger("connect");
    });

    await waitFor(() => {
      expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: [...computersQueryKeys.all, "list"],
      });
      expect(
        socketRef.current.emitCalls.filter((call) => call.event === "admin:watch-tenant"),
      ).toHaveLength(2);
    });
  });

  it("disconnect state does not force all presences offline", async () => {
    setSessionTokens({ accessToken: "token-7", refreshToken: null });
    setAuthStatus("authenticated");
    socketRef.current.watchAck = {
      success: true,
      data: { onlineComputers: ["computer-1"] },
    };
    renderHook(() => useAdminPresence(), { wrapper: wrap(queryClient) });

    act(() => {
      socketRef.current.trigger("connect");
      socketRef.current.trigger("disconnect");
    });

    await waitFor(() => {
      const state = getRealtimeStateSnapshot();
      expect(state.connectionStatus).toBe("disconnected");
      expect(state.presenceByComputerId["computer-1"]?.online).toBe(true);
    });
  });
});

function wrap(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
