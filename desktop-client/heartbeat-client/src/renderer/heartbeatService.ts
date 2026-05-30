import { io, type ManagerOptions, type Socket, type SocketOptions } from "socket.io-client";

import {
  DEFAULT_HEARTBEAT_CLIENT_CONFIG,
  REALTIME_CLIENT_TYPE_COMPUTER,
  REALTIME_HEARTBEAT_EVENT
} from "../shared/realtimeProtocol";
import {
  createHeartbeatStatus,
  HEARTBEAT_STATES,
  type HeartbeatClientConfig,
  type HeartbeatStatus
} from "../shared/types";

// 10s heartbeat is intentionally below backend's 90s offline timeout window.
export const HEARTBEAT_INTERVAL_MS = 10_000;

type HeartbeatStatusListener = (snapshot: HeartbeatStatus) => void;

type SocketFactory = (
  url: string,
  options: Partial<ManagerOptions & SocketOptions>
) => Socket;

const toSafeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("unauthorized") || message.includes("invalid token")) {
      return "Authorization failed. Please verify computer credentials.";
    }
    if (message.includes("xhr poll error") || message.includes("timeout") || message.includes("network")) {
      return "Cannot reach realtime server. Check server URL and backend status.";
    }
  }

  return "Connection failed. Please try again.";
};

const HEARTBEAT_ACK_FAILURE_MESSAGE = "Heartbeat acknowledgement failed. Retrying.";

class HeartbeatService {
  private readonly listeners = new Set<HeartbeatStatusListener>();

  private readonly createSocket: SocketFactory;

  private status = createHeartbeatStatus(HEARTBEAT_STATES.disconnected);

  private socket: Socket | null = null;

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private activeConfig: HeartbeatClientConfig = DEFAULT_HEARTBEAT_CLIENT_CONFIG;

  public constructor(createSocket: SocketFactory = io) {
    this.createSocket = createSocket;
  }

  public getSnapshot(): HeartbeatStatus {
    return this.status;
  }

  public subscribe(listener: HeartbeatStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public connect(config: HeartbeatClientConfig): void {
    this.activeConfig = config;

    if (this.socket) {
      this.cleanupSocket();
    }

    this.updateStatus(
      createHeartbeatStatus(HEARTBEAT_STATES.connecting, {
        lastHeartbeatSentAt: this.status.lastHeartbeatSentAt,
        lastAckAt: this.status.lastAckAt,
        lastError: null
      })
    );

    const socket = this.createSocket(config.serverUrl, {
      autoConnect: true,
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      auth: {
        clientType: REALTIME_CLIENT_TYPE_COMPUTER,
        computerId: config.computerId,
        deviceToken: config.deviceToken
      }
    });

    this.socket = socket;

    socket.on("connect", () => {
      this.updateStatus(
        createHeartbeatStatus(HEARTBEAT_STATES.connected, {
          lastHeartbeatSentAt: this.status.lastHeartbeatSentAt,
          lastAckAt: this.status.lastAckAt,
          lastError: null
        })
      );
      this.startHeartbeat();
    });

    socket.io.on("reconnect_attempt", () => {
      this.updateStatus(
        createHeartbeatStatus(HEARTBEAT_STATES.reconnecting, {
          lastHeartbeatSentAt: this.status.lastHeartbeatSentAt,
          lastAckAt: this.status.lastAckAt,
          lastError: this.status.lastError
        })
      );
    });

    socket.on("connect_error", (error: Error) => {
      this.updateStatus(
        createHeartbeatStatus(HEARTBEAT_STATES.error, {
          lastHeartbeatSentAt: this.status.lastHeartbeatSentAt,
          lastAckAt: this.status.lastAckAt,
          lastError: toSafeErrorMessage(error)
        })
      );
    });

    socket.on("disconnect", () => {
      this.stopHeartbeat();
      this.updateStatus(
        createHeartbeatStatus(HEARTBEAT_STATES.disconnected, {
          lastHeartbeatSentAt: this.status.lastHeartbeatSentAt,
          lastAckAt: this.status.lastAckAt,
          lastError: null
        })
      );
    });
  }

  public disconnect(): void {
    this.cleanupSocket();
    this.updateStatus(
      createHeartbeatStatus(HEARTBEAT_STATES.disconnected, {
        lastHeartbeatSentAt: this.status.lastHeartbeatSentAt,
        lastAckAt: this.status.lastAckAt,
        lastError: null
      })
    );
  }

  private emitHeartbeat(): void {
    if (!this.socket || !this.socket.connected) {
      return;
    }

    const sentAt = new Date().toISOString();

    this.updateStatus(
      createHeartbeatStatus(this.status.state, {
        lastHeartbeatSentAt: sentAt,
        lastAckAt: this.status.lastAckAt,
        lastError: this.status.lastError
      })
    );

    this.socket.emit(REALTIME_HEARTBEAT_EVENT, { sentAt }, (ackResponse?: unknown) => {
      const hasAckFailure =
        typeof ackResponse === "object" &&
        ackResponse !== null &&
        ("error" in ackResponse ||
          ("ok" in ackResponse && (ackResponse as { ok?: unknown }).ok === false));

      if (hasAckFailure) {
        this.updateStatus(
          createHeartbeatStatus(this.status.state, {
            lastHeartbeatSentAt: sentAt,
            lastAckAt: this.status.lastAckAt,
            lastError: HEARTBEAT_ACK_FAILURE_MESSAGE
          })
        );
        return;
      }

      this.updateStatus(
        createHeartbeatStatus(this.status.state, {
          lastHeartbeatSentAt: sentAt,
          lastAckAt: new Date().toISOString(),
          lastError: null
        })
      );
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.emitHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.emitHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) {
      return;
    }

    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private cleanupSocket(): void {
    this.stopHeartbeat();
    if (!this.socket) {
      return;
    }

    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }

  private updateStatus(next: HeartbeatStatus): void {
    this.status = next;
    for (const listener of this.listeners) {
      listener(this.status);
    }
  }
}

export const heartbeatService = new HeartbeatService();

export const createHeartbeatService = (socketFactory?: SocketFactory): HeartbeatService =>
  new HeartbeatService(socketFactory);

