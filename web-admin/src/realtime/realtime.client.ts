import { io, type Socket } from "socket.io-client";

type AdminSocketAuth = {
  clientType: "admin";
  accessToken: string | null;
};

export const SOCKET_IO_PATH = "/socket.io";

export type AdminSocket = Socket;
let adminSocket: AdminSocket | null = null;

export function buildAdminSocketAuth(accessToken: string | null): AdminSocketAuth {
  return {
    clientType: "admin",
    accessToken,
  };
}

export function createAdminSocket(accessToken: string | null): AdminSocket {
  return io(import.meta.env.VITE_SOCKET_URL, {
    path: SOCKET_IO_PATH,
    auth: buildAdminSocketAuth(accessToken),
    autoConnect: false,
  });
}

export function connectAdminSocket(accessToken: string | null): AdminSocket {
  if (!adminSocket) {
    adminSocket = createAdminSocket(accessToken);
  }

  if (!adminSocket.connected) {
    adminSocket.connect();
  }

  return adminSocket;
}

export function disconnectAdminSocket(): void {
  if (!adminSocket) {
    return;
  }

  try {
    adminSocket.disconnect();
  } finally {
    adminSocket = null;
  }
}
