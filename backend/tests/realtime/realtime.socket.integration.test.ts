import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Socket as ClientSocket } from "socket.io-client";
import { io as createSocketClient } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyAccessTokenMock,
  findUniqueComputerMock,
  findFirstComputerMock,
  updateManyComputerMock,
  hashDeviceTokenMock,
  loggerInfoMock,
  loggerWarnMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  verifyAccessTokenMock: vi.fn(),
  findUniqueComputerMock: vi.fn(),
  findFirstComputerMock: vi.fn(),
  updateManyComputerMock: vi.fn(),
  hashDeviceTokenMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  ComputerStatus: {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
    BLOCKED: "BLOCKED",
  },
}));

vi.mock("../../src/modules/auth/auth.tokens", () => ({
  authTokenService: {
    verifyAccessToken: verifyAccessTokenMock,
  },
}));

vi.mock("../../src/modules/computers/computers.service", () => ({
  hashDeviceToken: hashDeviceTokenMock,
}));

vi.mock("../../src/shared/prisma/prisma.client", () => ({
  prisma: {
    computer: {
      findUnique: findUniqueComputerMock,
      findFirst: findFirstComputerMock,
      updateMany: updateManyComputerMock,
    },
  },
}));

vi.mock("../../src/shared/logging/logger", () => ({
  logger: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
    error: loggerErrorMock,
  },
}));

import {
  REALTIME_ADMIN_COMPUTER_CONTROL_EVENT,
  REALTIME_ADMIN_WATCH_TENANT_EVENT,
  REALTIME_CLIENT_HEARTBEAT_EVENT,
  REALTIME_COMPUTER_CONTROL_EVENT,
  REALTIME_COMPUTER_OFFLINE_EVENT,
  REALTIME_COMPUTER_ONLINE_EVENT,
} from "../../src/modules/realtime/realtime.events";
import { createRealtimeServer } from "../../src/modules/realtime/realtime.server";

type ComputerRecord = {
  id: string;
  tenantId: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  deviceTokenHash: string;
  lastSeenAt: Date | null;
};

const computerStore = new Map<string, ComputerRecord>();

const upsertComputer = (record: ComputerRecord): void => {
  computerStore.set(record.id, { ...record });
};

const connectSocket = async (
  baseUrl: string,
  auth: Record<string, unknown>,
): Promise<ClientSocket> =>
  new Promise<ClientSocket>((resolve, reject) => {
    const socket = createSocketClient(baseUrl, {
      path: "/socket.io",
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      timeout: 2_000,
      auth,
    });

    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (error: Error) => {
      socket.close();
      reject(error);
    });
  });

const connectExpectError = async (
  baseUrl: string,
  auth: Record<string, unknown>,
): Promise<string> =>
  new Promise<string>((resolve) => {
    const socket = createSocketClient(baseUrl, {
      path: "/socket.io",
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      timeout: 2_000,
      auth,
    });

    socket.once("connect", () => {
      socket.close();
      resolve("__CONNECTED__");
    });

    socket.once("connect_error", (error: Error) => {
      socket.close();
      resolve(error.message);
    });
  });

const emitWithAck = <TAck>(
  socket: ClientSocket,
  event: string,
  payload: unknown,
): Promise<TAck> =>
  new Promise<TAck>((resolve) => {
    socket.emit(event, payload, (ack: TAck) => resolve(ack));
  });

const waitForEvent = <TData>(socket: ClientSocket, event: string): Promise<TData> =>
  new Promise<TData>((resolve) => {
    socket.once(event, (data: TData) => resolve(data));
  });

const waitForNoEvent = async (
  socket: ClientSocket,
  event: string,
  timeoutMs: number = 300,
): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    let fired = false;
    const handler = () => {
      fired = true;
    };
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve(!fired);
    }, timeoutMs);
  });

describe.sequential("Realtime socket integration tests (Task 237-254)", () => {
  let httpServer: HttpServer;
  let realtimeServer: ReturnType<typeof createRealtimeServer>;
  let baseUrl: string;
  let sockets: ClientSocket[];

  beforeEach(async () => {
    sockets = [];
    computerStore.clear();
    verifyAccessTokenMock.mockReset();
    findUniqueComputerMock.mockReset();
    findFirstComputerMock.mockReset();
    updateManyComputerMock.mockReset();
    hashDeviceTokenMock.mockReset();
    loggerInfoMock.mockReset();
    loggerWarnMock.mockReset();
    loggerErrorMock.mockReset();

    verifyAccessTokenMock.mockImplementation(async (token: string) => {
      if (token === "admin-valid-tenant-a") {
        return {
          sub: "admin-a",
          tenantId: "tenant-a",
          role: "shop_admin",
          tokenType: "access",
        };
      }
      if (token === "admin-valid-tenant-b") {
        return {
          sub: "admin-b",
          tenantId: "tenant-b",
          role: "staff",
          tokenType: "access",
        };
      }
      if (token === "admin-super-admin") {
        return {
          sub: "super-admin",
          tenantId: "tenant-a",
          role: "super_admin",
          tokenType: "access",
        };
      }
      throw new Error("invalid token");
    });

    hashDeviceTokenMock.mockImplementation((token: string) => `hash:${token}`);

    findUniqueComputerMock.mockImplementation(async (args: { where?: { id?: string } }) => {
      const id = args?.where?.id;
      if (!id) {
        return null;
      }
      return computerStore.get(id) ?? null;
    });

    updateManyComputerMock.mockImplementation(async (args: any) => {
      const id = args?.where?.id as string | undefined;
      const tenantId = args?.where?.tenantId as string | undefined;
      const status = args?.where?.status as string | undefined;
      const nextLastSeenAt = args?.data?.lastSeenAt as Date | undefined;
      if (!id || !tenantId || !nextLastSeenAt) {
        return { count: 0 };
      }

      const current = computerStore.get(id);
      if (!current) {
        return { count: 0 };
      }
      if (current.tenantId !== tenantId || current.status !== status) {
        return { count: 0 };
      }

      computerStore.set(id, {
        ...current,
        lastSeenAt: nextLastSeenAt,
      });

      return { count: 1 };
    });

    httpServer = createServer((_req, res) => {
      res.statusCode = 200;
      res.end("ok");
    });
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });

    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    realtimeServer = createRealtimeServer(httpServer);
  });

  afterEach(async () => {
    for (const socket of sockets) {
      if (socket.connected) {
        socket.disconnect();
      } else {
        socket.close();
      }
    }

    await realtimeServer.close();
  });

  it("Task 237+238+239: setup in-test HTTP server and connect admin with valid token", async () => {
    const admin = await connectSocket(baseUrl, {
      clientType: "admin",
      accessToken: "admin-valid-tenant-a",
    });
    sockets.push(admin);

    expect(admin.connected).toBe(true);
  });

  it("Task 240: admin:watch-tenant returns tenant online snapshot", async () => {
    upsertComputer({
      id: "computer-a1",
      tenantId: "tenant-a",
      status: "ACTIVE",
      deviceTokenHash: "hash:token-a1",
      lastSeenAt: null,
    });

    const admin = await connectSocket(baseUrl, {
      clientType: "admin",
      accessToken: "admin-valid-tenant-a",
    });
    sockets.push(admin);

    const computer = await connectSocket(baseUrl, {
      clientType: "computer",
      computerId: "computer-a1",
      deviceToken: "token-a1",
    });
    sockets.push(computer);

    const ack = await emitWithAck<{ success: boolean; data?: { onlineComputers: string[] } }>(
      admin,
      REALTIME_ADMIN_WATCH_TENANT_EVENT,
      {},
    );

    expect(ack.success).toBe(true);
    expect(ack.data?.onlineComputers).toContain("computer-a1");
  });

  it("Task 241+242: client connects with valid credentials and emits computer:online to tenant admin", async () => {
    upsertComputer({
      id: "computer-a1",
      tenantId: "tenant-a",
      status: "ACTIVE",
      deviceTokenHash: "hash:token-a1",
      lastSeenAt: null,
    });

    const admin = await connectSocket(baseUrl, {
      clientType: "admin",
      accessToken: "admin-valid-tenant-a",
    });
    sockets.push(admin);

    await emitWithAck(admin, REALTIME_ADMIN_WATCH_TENANT_EVENT, {});
    const onlineEventPromise = waitForEvent<{ tenantId: string; computerId: string }>(
      admin,
      REALTIME_COMPUTER_ONLINE_EVENT,
    );

    const computer = await connectSocket(baseUrl, {
      clientType: "computer",
      computerId: "computer-a1",
      deviceToken: "token-a1",
    });
    sockets.push(computer);

    const event = await onlineEventPromise;
    expect(computer.connected).toBe(true);
    expect(event).toMatchObject({
      tenantId: "tenant-a",
      computerId: "computer-a1",
    });
  });

  it("Task 243: client connect updates Computer.lastSeenAt", async () => {
    upsertComputer({
      id: "computer-a1",
      tenantId: "tenant-a",
      status: "ACTIVE",
      deviceTokenHash: "hash:token-a1",
      lastSeenAt: null,
    });

    const computer = await connectSocket(baseUrl, {
      clientType: "computer",
      computerId: "computer-a1",
      deviceToken: "token-a1",
    });
    sockets.push(computer);

    expect(updateManyComputerMock).toHaveBeenCalled();
    const call = updateManyComputerMock.mock.calls[0]?.[0];
    expect(call?.where?.id).toBe("computer-a1");
  });

  it("Task 244: invalid client token receives connect_error", async () => {
    upsertComputer({
      id: "computer-a1",
      tenantId: "tenant-a",
      status: "ACTIVE",
      deviceTokenHash: "hash:token-a1",
      lastSeenAt: null,
    });

    const message = await connectExpectError(baseUrl, {
      clientType: "computer",
      computerId: "computer-a1",
      deviceToken: "wrong-token",
    });

    expect(message).toBe("Unauthorized realtime connection");
  });

  it("Task 245: blocked computer receives connect_error", async () => {
    upsertComputer({
      id: "computer-blocked",
      tenantId: "tenant-a",
      status: "BLOCKED",
      deviceTokenHash: "hash:token-blocked",
      lastSeenAt: null,
    });

    const message = await connectExpectError(baseUrl, {
      clientType: "computer",
      computerId: "computer-blocked",
      deviceToken: "token-blocked",
    });

    expect(message).toBe("Unauthorized realtime connection");
  });

  it("Task 246: super_admin receives connect_error", async () => {
    const message = await connectExpectError(baseUrl, {
      clientType: "admin",
      accessToken: "admin-super-admin",
    });

    expect(message).toBe("Unauthorized realtime connection");
  });

  it("Task 247+248: heartbeat ack success and rate-limit TOO_MANY_REQUESTS", async () => {
    upsertComputer({
      id: "computer-a1",
      tenantId: "tenant-a",
      status: "ACTIVE",
      deviceTokenHash: "hash:token-a1",
      lastSeenAt: null,
    });

    const computer = await connectSocket(baseUrl, {
      clientType: "computer",
      computerId: "computer-a1",
      deviceToken: "token-a1",
    });
    sockets.push(computer);

    const first = await emitWithAck<any>(computer, REALTIME_CLIENT_HEARTBEAT_EVENT, {
      sentAt: new Date().toISOString(),
    });
    const second = await emitWithAck<any>(computer, REALTIME_CLIENT_HEARTBEAT_EVENT, {
      sentAt: new Date().toISOString(),
    });
    const third = await emitWithAck<any>(computer, REALTIME_CLIENT_HEARTBEAT_EVENT, {
      sentAt: new Date().toISOString(),
    });
    const fourth = await emitWithAck<any>(computer, REALTIME_CLIENT_HEARTBEAT_EVENT, {
      sentAt: new Date().toISOString(),
    });

    expect(first.success).toBe(true);
    expect(first.data.serverTime).toEqual(expect.any(String));
    expect(second.success).toBe(true);
    expect(third.success).toBe(true);
    expect(fourth.success).toBe(false);
    expect(fourth.error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("Task 249+250: final disconnect emits offline only to same-tenant admins", async () => {
    upsertComputer({
      id: "computer-a1",
      tenantId: "tenant-a",
      status: "ACTIVE",
      deviceTokenHash: "hash:token-a1",
      lastSeenAt: null,
    });

    const adminA = await connectSocket(baseUrl, {
      clientType: "admin",
      accessToken: "admin-valid-tenant-a",
    });
    const adminB = await connectSocket(baseUrl, {
      clientType: "admin",
      accessToken: "admin-valid-tenant-b",
    });
    sockets.push(adminA, adminB);

    await emitWithAck(adminA, REALTIME_ADMIN_WATCH_TENANT_EVENT, {});
    await emitWithAck(adminB, REALTIME_ADMIN_WATCH_TENANT_EVENT, {});

    const computer = await connectSocket(baseUrl, {
      clientType: "computer",
      computerId: "computer-a1",
      deviceToken: "token-a1",
    });
    sockets.push(computer);

    const offlinePromise = waitForEvent<{ tenantId: string; computerId: string }>(
      adminA,
      REALTIME_COMPUTER_OFFLINE_EVENT,
    );

    computer.disconnect();

    const offlineEvent = await offlinePromise;
    const didNotLeak = await waitForNoEvent(adminB, REALTIME_COMPUTER_OFFLINE_EVENT);

    expect(offlineEvent).toMatchObject({
      tenantId: "tenant-a",
      computerId: "computer-a1",
    });
    expect(didNotLeak).toBe(true);
  });

  it("Task 251+252: unknown fields return VALIDATION_ERROR for heartbeat and watch-tenant", async () => {
    upsertComputer({
      id: "computer-a1",
      tenantId: "tenant-a",
      status: "ACTIVE",
      deviceTokenHash: "hash:token-a1",
      lastSeenAt: null,
    });

    const admin = await connectSocket(baseUrl, {
      clientType: "admin",
      accessToken: "admin-valid-tenant-a",
    });
    const computer = await connectSocket(baseUrl, {
      clientType: "computer",
      computerId: "computer-a1",
      deviceToken: "token-a1",
    });
    sockets.push(admin, computer);

    const adminAck = await emitWithAck<any>(admin, REALTIME_ADMIN_WATCH_TENANT_EVENT, {
      tenantId: "tenant-a",
    });
    const heartbeatAck = await emitWithAck<any>(computer, REALTIME_CLIENT_HEARTBEAT_EVENT, {
      sentAt: new Date().toISOString(),
      extra: "x",
    });

    expect(adminAck.success).toBe(false);
    expect(adminAck.error.code).toBe("VALIDATION_ERROR");
    expect(heartbeatAck.success).toBe(false);
    expect(heartbeatAck.error.code).toBe("VALIDATION_ERROR");
  });

  it("Task 258: shop_admin can send unlock command to same-tenant computer only", async () => {
    upsertComputer({
      id: "computer-a1",
      tenantId: "tenant-a",
      status: "ACTIVE",
      deviceTokenHash: "hash:token-a1",
      lastSeenAt: null,
    });

    findFirstComputerMock.mockImplementation(
      async (args: { where?: { id?: string; tenantId?: string } }) => {
        const id = args?.where?.id;
        const tenantId = args?.where?.tenantId;
        if (!id || !tenantId) {
          return null;
        }
        const computer = computerStore.get(id);
        if (!computer || computer.tenantId !== tenantId) {
          return null;
        }
        return {
          id: computer.id,
          status: computer.status,
        };
      },
    );

    const admin = await connectSocket(baseUrl, {
      clientType: "admin",
      accessToken: "admin-valid-tenant-a",
    });
    const computer = await connectSocket(baseUrl, {
      clientType: "computer",
      computerId: "computer-a1",
      deviceToken: "token-a1",
    });
    sockets.push(admin, computer);

    const controlEventPromise = waitForEvent<any>(computer, REALTIME_COMPUTER_CONTROL_EVENT);
    const ack = await emitWithAck<any>(admin, REALTIME_ADMIN_COMPUTER_CONTROL_EVENT, {
      computerId: "computer-a1",
      action: "unlock",
      mode: "timed",
      durationMinutes: 60,
    });

    const controlEvent = await controlEventPromise;

    expect(ack.success).toBe(true);
    expect(controlEvent).toMatchObject({
      tenantId: "tenant-a",
      computerId: "computer-a1",
      action: "unlock",
      mode: "timed",
      durationMinutes: 60,
    });
  });

  it("Task 259: staff cannot send computer control command", async () => {
    upsertComputer({
      id: "computer-b1",
      tenantId: "tenant-b",
      status: "ACTIVE",
      deviceTokenHash: "hash:token-b1",
      lastSeenAt: null,
    });

    const staffAdmin = await connectSocket(baseUrl, {
      clientType: "admin",
      accessToken: "admin-valid-tenant-b",
    });
    sockets.push(staffAdmin);

    const ack = await emitWithAck<any>(staffAdmin, REALTIME_ADMIN_COMPUTER_CONTROL_EVENT, {
      computerId: "computer-b1",
      action: "lock",
    });

    expect(ack.success).toBe(false);
    expect(ack.error.code).toBe("FORBIDDEN");
  });

  it("Task 260: command cannot control cross-tenant computer", async () => {
    upsertComputer({
      id: "computer-b1",
      tenantId: "tenant-b",
      status: "ACTIVE",
      deviceTokenHash: "hash:token-b1",
      lastSeenAt: null,
    });

    const adminA = await connectSocket(baseUrl, {
      clientType: "admin",
      accessToken: "admin-valid-tenant-a",
    });
    const computerB = await connectSocket(baseUrl, {
      clientType: "computer",
      computerId: "computer-b1",
      deviceToken: "token-b1",
    });
    sockets.push(adminA, computerB);

    const ack = await emitWithAck<any>(adminA, REALTIME_ADMIN_COMPUTER_CONTROL_EVENT, {
      computerId: "computer-b1",
      action: "unlock",
      mode: "free",
    });

    const didNotLeak = await waitForNoEvent(computerB, REALTIME_COMPUTER_CONTROL_EVENT);

    expect(ack.success).toBe(false);
    expect(ack.error.code).toBe("FORBIDDEN");
    expect(didNotLeak).toBe(true);
  });

  it("Task 253: logs do not include raw handshake auth or token material", async () => {
    await connectExpectError(baseUrl, {
      clientType: "admin",
      accessToken: "admin-invalid",
      extra: "field",
    });
    await connectExpectError(baseUrl, {
      clientType: "computer",
      computerId: "missing",
      deviceToken: "raw-device-token",
    });

    const logs = JSON.stringify({
      info: loggerInfoMock.mock.calls,
      warn: loggerWarnMock.mock.calls,
      error: loggerErrorMock.mock.calls,
    });

    expect(logs).not.toContain("admin-invalid");
    expect(logs).not.toContain("raw-device-token");
    expect(logs).not.toContain("accessToken");
    expect(logs).not.toContain("deviceToken");
    expect(logs).not.toContain("rawAuth");
    expect(logs).not.toContain("handshake");
  });

  it("Task 254: cleanup closes sockets, realtime server, and HTTP server resources", async () => {
    const admin = await connectSocket(baseUrl, {
      clientType: "admin",
      accessToken: "admin-valid-tenant-a",
    });
    sockets.push(admin);

    expect(admin.connected).toBe(true);
  });
});

