import { afterEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io-client";

import { DEFAULT_HEARTBEAT_CLIENT_CONFIG, REALTIME_HEARTBEAT_EVENT } from "../shared/realtimeProtocol";
import { HEARTBEAT_STATES } from "../shared/types";
import { createHeartbeatService, HEARTBEAT_INTERVAL_MS } from "./heartbeatService";

type SocketEventHandler = (...args: unknown[]) => void;

class FakeSocket {
  public readonly handlers = new Map<string, SocketEventHandler[]>();

  public readonly managerHandlers = new Map<string, SocketEventHandler[]>();

  public connected = false;
  public disconnectCallCount = 0;

  public readonly emitted: Array<{ event: string; payload: unknown }> = [];

  private readonly ackResponses: unknown[] = [];

  public readonly io = {
    on: (event: string, handler: SocketEventHandler): void => {
      const next = this.managerHandlers.get(event) ?? [];
      next.push(handler);
      this.managerHandlers.set(event, next);
    }
  };

  public on(event: string, handler: SocketEventHandler): this {
    const next = this.handlers.get(event) ?? [];
    next.push(handler);
    this.handlers.set(event, next);
    return this;
  }

  public emit(event: string, payload?: unknown, ack?: (response?: unknown) => void): boolean {
    this.emitted.push({ event, payload });
    if (ack) {
      ack(this.ackResponses.shift());
    }
    return true;
  }

  public disconnect(): this {
    this.connected = false;
    this.disconnectCallCount += 1;
    return this;
  }

  public removeAllListeners(): this {
    this.handlers.clear();
    this.managerHandlers.clear();
    return this;
  }

  public trigger(event: string, ...args: unknown[]): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(...args);
    }
  }

  public triggerManager(event: string, ...args: unknown[]): void {
    for (const handler of this.managerHandlers.get(event) ?? []) {
      handler(...args);
    }
  }

  public enqueueAckResponse(response: unknown): void {
    this.ackResponses.push(response);
  }
}

const getRequiredSocket = (sockets: FakeSocket[]): FakeSocket => {
  const socket = sockets[0];
  if (!socket) {
    throw new Error("Expected a created socket instance.");
  }
  return socket;
};

describe("heartbeatService connect/disconnect state transitions", () => {
  it("sets state to Connecting immediately when connect is called", () => {
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);

    expect(service.getSnapshot().state).toBe(HEARTBEAT_STATES.connecting);
    expect(createdSockets).toHaveLength(1);

    service.disconnect();
  });

  it("sets state to Connected after socket connect event", () => {
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const socket = getRequiredSocket(createdSockets);
    socket.connected = true;
    socket.trigger("connect");

    expect(service.getSnapshot().state).toBe(HEARTBEAT_STATES.connected);

    service.disconnect();
  });

  it("sets state to Reconnecting on reconnect attempts", () => {
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const socket = getRequiredSocket(createdSockets);
    socket.triggerManager("reconnect_attempt");

    expect(service.getSnapshot().state).toBe(HEARTBEAT_STATES.reconnecting);

    service.disconnect();
  });

  it("sets state to Error on connect_error and Disconnected on manual disconnect", () => {
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const socket = getRequiredSocket(createdSockets);
    socket.trigger("connect_error", new Error("Unauthorized"));

    expect(service.getSnapshot().state).toBe(HEARTBEAT_STATES.error);

    service.disconnect();

    expect(service.getSnapshot().state).toBe(HEARTBEAT_STATES.disconnected);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("heartbeatService safe error mapping", () => {
  it("normalizes unauthorized errors to a safe message", () => {
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect({
      ...DEFAULT_HEARTBEAT_CLIENT_CONFIG,
      computerId: "computer-01",
      deviceToken: "secret-token-value"
    });
    const socket = getRequiredSocket(createdSockets);
    socket.trigger("connect_error", new Error("Unauthorized: invalid token"));

    const snapshot = service.getSnapshot();
    expect(snapshot.state).toBe(HEARTBEAT_STATES.error);
    expect(snapshot.lastError).toBe("Authorization failed. Please verify computer credentials.");
    expect(snapshot.lastError).not.toContain("secret-token-value");

    service.disconnect();
  });

  it("normalizes unreachable backend errors to a safe message", () => {
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const socket = getRequiredSocket(createdSockets);
    socket.trigger("connect_error", new Error("xhr poll error"));

    const snapshot = service.getSnapshot();
    expect(snapshot.state).toBe(HEARTBEAT_STATES.error);
    expect(snapshot.lastError).toBe("Cannot reach realtime server. Check server URL and backend status.");

    service.disconnect();
  });

  it("never exposes raw computerId, deviceToken, or auth payload in displayed errors", () => {
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    const config = {
      ...DEFAULT_HEARTBEAT_CLIENT_CONFIG,
      computerId: "computer-sensitive",
      deviceToken: "token-sensitive"
    };
    service.connect(config);
    const socket = getRequiredSocket(createdSockets);
    socket.trigger(
      "connect_error",
      new Error("Auth failed for computer-sensitive with token-sensitive and payload {\"deviceToken\":\"token-sensitive\"}")
    );

    const snapshot = service.getSnapshot();
    expect(snapshot.lastError).not.toContain("computer-sensitive");
    expect(snapshot.lastError).not.toContain("token-sensitive");
    expect(snapshot.lastError).not.toContain("deviceToken");

    service.disconnect();
  });
});

describe("heartbeatService heartbeat loop", () => {
  it("starts heartbeat only after successful connection and emits on 10-second cadence", () => {
    vi.useFakeTimers();
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const socket = getRequiredSocket(createdSockets);

    expect(socket.emitted).toHaveLength(0);

    socket.connected = true;
    socket.trigger("connect");
    expect(socket.emitted).toHaveLength(1);
    expect(socket.emitted[0]?.event).toBe(REALTIME_HEARTBEAT_EVENT);

    vi.advanceTimersByTime(10_000);
    expect(socket.emitted).toHaveLength(2);
    expect(socket.emitted[1]?.event).toBe(REALTIME_HEARTBEAT_EVENT);

    service.disconnect();
  });

  it("updates lastHeartbeatSentAt on emit and lastAckAt on successful ack", () => {
    vi.useFakeTimers();
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const socket = getRequiredSocket(createdSockets);
    socket.connected = true;
    socket.trigger("connect");

    const snapshot = service.getSnapshot();
    expect(snapshot.lastHeartbeatSentAt).not.toBeNull();
    expect(snapshot.lastAckAt).not.toBeNull();

    service.disconnect();
  });

  it("surfaces heartbeat ack failure without crashing", () => {
    vi.useFakeTimers();
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const socket = getRequiredSocket(createdSockets);
    socket.enqueueAckResponse({ ok: false, error: "ack failed" });
    socket.connected = true;

    expect(() => {
      socket.trigger("connect");
    }).not.toThrow();

    const snapshot = service.getSnapshot();
    expect(snapshot.lastError).toBe("Heartbeat acknowledgement failed. Retrying.");

    service.disconnect();
  });

  it("stops heartbeat timer when disconnected", () => {
    vi.useFakeTimers();
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const socket = getRequiredSocket(createdSockets);
    socket.connected = true;
    socket.trigger("connect");
    expect(socket.emitted).toHaveLength(1);

    service.disconnect();
    vi.advanceTimersByTime(20_000);

    expect(socket.emitted).toHaveLength(1);
  });
});

describe("heartbeatService idempotency and cleanup", () => {
  it("repeated connect creates a new socket and cleans up the previous socket", () => {
    vi.useFakeTimers();
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const firstSocket = getRequiredSocket(createdSockets);
    firstSocket.connected = true;
    firstSocket.trigger("connect");
    expect(firstSocket.emitted).toHaveLength(1);

    service.connect({
      ...DEFAULT_HEARTBEAT_CLIENT_CONFIG,
      computerId: "computer-second"
    });

    expect(createdSockets).toHaveLength(2);
    expect(firstSocket.disconnectCallCount).toBe(1);
    expect(firstSocket.handlers.size).toBe(0);
    expect(firstSocket.managerHandlers.size).toBe(0);

    const secondSocket = createdSockets[1];
    if (!secondSocket) {
      throw new Error("Expected second socket instance.");
    }
    secondSocket.connected = true;
    secondSocket.trigger("connect");
    expect(secondSocket.emitted).toHaveLength(1);

    vi.advanceTimersByTime(10_000);
    expect(firstSocket.emitted).toHaveLength(1);
    expect(secondSocket.emitted).toHaveLength(2);

    service.disconnect();
  });

  it("does not create duplicate heartbeat timers across reconnect cycles", () => {
    vi.useFakeTimers();
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const socket = getRequiredSocket(createdSockets);
    socket.connected = true;
    socket.trigger("connect");
    expect(socket.emitted).toHaveLength(1);

    vi.advanceTimersByTime(10_000);
    expect(socket.emitted).toHaveLength(2);

    socket.trigger("connect");
    expect(socket.emitted).toHaveLength(3);

    vi.advanceTimersByTime(10_000);
    expect(socket.emitted).toHaveLength(4);

    service.disconnect();
  });

  it("disconnect disposes listeners and stops further socket-triggered state changes", () => {
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const socket = getRequiredSocket(createdSockets);

    expect(socket.handlers.size).toBeGreaterThan(0);
    expect(socket.managerHandlers.size).toBeGreaterThan(0);

    service.disconnect();

    expect(socket.disconnectCallCount).toBe(1);
    expect(socket.handlers.size).toBe(0);
    expect(socket.managerHandlers.size).toBe(0);

    socket.trigger("connect_error", new Error("Unauthorized"));
    expect(service.getSnapshot().state).toBe(HEARTBEAT_STATES.disconnected);
  });
});

describe("heartbeatService batch 6.6 required unit coverage", () => {
  it("verifies Socket.IO auth payload shape", () => {
    const createdSockets: FakeSocket[] = [];
    const createdOptions: Array<Record<string, unknown>> = [];
    const service = createHeartbeatService((_, options) => {
      createdOptions.push(options as Record<string, unknown>);
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    const config = {
      serverUrl: "http://localhost:3000",
      computerId: "computer-104",
      deviceToken: "token-104"
    };
    service.connect(config);

    expect(createdOptions).toHaveLength(1);
    expect(createdOptions[0]?.auth).toEqual({
      clientType: "computer",
      computerId: "computer-104",
      deviceToken: "token-104"
    });
    expect(createdOptions[0]?.query).toBeUndefined();

    service.disconnect();
  });

  it("verifies heartbeat event name and payload shape", () => {
    vi.useFakeTimers();
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const socket = getRequiredSocket(createdSockets);
    socket.connected = true;
    socket.trigger("connect");

    const firstEmit = socket.emitted[0];
    expect(firstEmit?.event).toBe(REALTIME_HEARTBEAT_EVENT);
    expect(firstEmit?.payload).toEqual({
      sentAt: expect.any(String)
    });

    service.disconnect();
  });

  it("verifies duplicate connect calls do not create duplicate timers", () => {
    vi.useFakeTimers();
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const socket = getRequiredSocket(createdSockets);
    socket.connected = true;
    socket.trigger("connect");
    vi.advanceTimersByTime(10_000);
    expect(socket.emitted).toHaveLength(2);

    service.connect({
      ...DEFAULT_HEARTBEAT_CLIENT_CONFIG,
      computerId: "computer-duplicate"
    });
    const secondSocket = createdSockets[1];
    if (!secondSocket) {
      throw new Error("Expected second socket for duplicate connect test.");
    }
    secondSocket.connected = true;
    secondSocket.trigger("connect");
    vi.advanceTimersByTime(10_000);

    expect(socket.emitted).toHaveLength(2);
    expect(secondSocket.emitted).toHaveLength(2);

    service.disconnect();
  });

  it("verifies disconnect stops heartbeat timer", () => {
    vi.useFakeTimers();
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const socket = getRequiredSocket(createdSockets);
    socket.connected = true;
    socket.trigger("connect");
    expect(socket.emitted).toHaveLength(1);

    service.disconnect();
    vi.advanceTimersByTime(30_000);
    expect(socket.emitted).toHaveLength(1);
  });

  it("verifies reconnect events update status state", () => {
    const createdSockets: FakeSocket[] = [];
    const service = createHeartbeatService(() => {
      const socket = new FakeSocket();
      createdSockets.push(socket);
      return socket as unknown as Socket;
    });

    service.connect(DEFAULT_HEARTBEAT_CLIENT_CONFIG);
    const socket = getRequiredSocket(createdSockets);
    socket.triggerManager("reconnect_attempt");

    expect(service.getSnapshot().state).toBe(HEARTBEAT_STATES.reconnecting);

    service.disconnect();
  });
});

describe("heartbeatService security and reliability assertions", () => {
  it("keeps heartbeat interval constant at 10_000ms", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(10_000);
  });
});
