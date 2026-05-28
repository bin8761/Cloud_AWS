import { beforeEach, describe, expect, it, vi } from "vitest";

const ioMock = vi.fn();

vi.mock("socket.io-client", () => ({
  io: (...args: unknown[]) => ioMock(...args),
}));

import {
  SOCKET_IO_PATH,
  buildAdminSocketAuth,
  connectAdminSocket,
  createAdminSocket,
  disconnectAdminSocket,
} from "./realtime.client";

type SocketStub = {
  connected: boolean;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

function makeSocketStub(connected = false): SocketStub {
  return {
    connected,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

describe("realtime.client", () => {
  beforeEach(() => {
    ioMock.mockReset();
    disconnectAdminSocket();
  });

  it('builds auth payload with clientType "admin"', () => {
    expect(buildAdminSocketAuth("token-1")).toEqual({
      clientType: "admin",
      accessToken: "token-1",
    });
  });

  it("creates socket with current access token", () => {
    const socket = makeSocketStub();
    ioMock.mockReturnValue(socket);

    createAdminSocket("token-abc");

    expect(ioMock).toHaveBeenCalledWith(
      import.meta.env.VITE_SOCKET_URL,
      expect.objectContaining({
        path: SOCKET_IO_PATH,
        autoConnect: false,
        auth: {
          clientType: "admin",
          accessToken: "token-abc",
        },
      }),
    );
  });

  it("emits connect only when socket is disconnected", () => {
    const socket = makeSocketStub(false);
    ioMock.mockReturnValue(socket);

    connectAdminSocket("token-1");
    expect(socket.connect).toHaveBeenCalledTimes(1);

    socket.connected = true;
    connectAdminSocket("token-2");
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });
});
