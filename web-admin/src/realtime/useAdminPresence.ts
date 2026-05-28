import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/auth/auth.store";
import { registerRealtimeDisconnectCallback } from "@/lib/apiClient";
import { computersQueryKeys } from "@/computers/computers.queries";
import type { FrontendApiError } from "@/lib/errors";
import {
  applyComputerOfflineEvent,
  applyComputerOnlineEvent,
  applyTenantWatchSnapshot,
  markRealtimeConnected,
  markRealtimeDisconnected,
  markRealtimeReconnecting,
  markRealtimeUnavailable,
} from "./realtime.store";
import type { WatchTenantAck } from "./realtime.types";
import { connectAdminSocket, disconnectAdminSocket } from "./realtime.client";
import type { ComputerPresenceEvent } from "./realtime.types";

export function useAdminPresence(): void {
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    registerRealtimeDisconnectCallback(disconnectAdminSocket);
    return () => {
      registerRealtimeDisconnectCallback(null);
    };
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }

    const socket = connectAdminSocket(accessToken);
    let hasConnectedOnce = false;

    const handleWatchTenantAck = (ack: WatchTenantAck): void => {
      if (ack.success) {
        markRealtimeConnected();
        applyTenantWatchSnapshot(ack.data.onlineComputers);
        return;
      }

      const error: FrontendApiError = {
        status: 500,
        code: ack.error.code,
        message: ack.error.message,
      };
      markRealtimeUnavailable(error);
    };

    const handleSocketConnect = (): void => {
      socket.emit("admin:watch-tenant", {}, handleWatchTenantAck);

      if (!hasConnectedOnce) {
        hasConnectedOnce = true;
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: [...computersQueryKeys.all, "list"],
      });
    };

    const handleSocketDisconnect = (): void => {
      markRealtimeDisconnected();
    };

    const handleComputerOnline = (event: ComputerPresenceEvent): void => {
      applyComputerOnlineEvent(event);
    };

    const handleComputerOffline = (event: ComputerPresenceEvent): void => {
      applyComputerOfflineEvent(event);
    };

    const handleSocketConnectError = (): void => {
      markRealtimeReconnecting();
    };

    const manager = socket.io;
    const handleReconnectAttempt = (): void => {
      markRealtimeReconnecting();
    };

    socket.on("connect", handleSocketConnect);
    socket.on("disconnect", handleSocketDisconnect);
    socket.on("computer:online", handleComputerOnline);
    socket.on("computer:offline", handleComputerOffline);
    socket.on("connect_error", handleSocketConnectError);
    manager.on("reconnect_attempt", handleReconnectAttempt);

    if (socket.connected) {
      handleSocketConnect();
    }

    return () => {
      socket.off("connect", handleSocketConnect);
      socket.off("disconnect", handleSocketDisconnect);
      socket.off("computer:online", handleComputerOnline);
      socket.off("computer:offline", handleComputerOffline);
      socket.off("connect_error", handleSocketConnectError);
      manager.off("reconnect_attempt", handleReconnectAttempt);
    };
  }, [accessToken, authStatus, queryClient]);
}
