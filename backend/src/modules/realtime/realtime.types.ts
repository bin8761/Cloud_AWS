/**
 * Realtime shared types.
 */
export type RealtimeAdminSocketContext = {
    clientType: "admin";
    userId: string;
    tenantId: string;
    role: "shop_admin" | "staff";
};

export type RealtimeComputerSocketContext = {
    clientType: "computer";
    computerId: string;
    tenantId: string;
};

export type RealtimeSocketContext =
    | RealtimeAdminSocketContext
    | RealtimeComputerSocketContext;

export type RealtimeComputerPresence = {
    computerId: string;
    tenantId: string;
    socketIds: Set<string>;
    lastHeartbeatAt: Date;
    lastSeenPersistedAt?: Date;
    offlineTimer?: NodeJS.Timeout;
};

export type RealtimeHealthSnapshot = {
    activeSockets: number;
    onlineComputers: number;
    adminSockets: number;
    heartbeatAccepted: number;
    heartbeatRateLimited: number;
    authFailures: number;
    heartbeatTimeouts: number;
};

export type RealtimeServerPublicApi = {
    getGateway: () => RealtimeGatewayPublicApi;
    close: () => Promise<void>;
    getRealtimeHealthSnapshot: () => RealtimeHealthSnapshot;
    getHealthSnapshot: () => RealtimeHealthSnapshot;
};

export type RealtimeGatewayPublicApi = {
    emitComputerOnline: (tenantId: string, computerId: string) => void;
    emitComputerOffline: (tenantId: string, computerId: string) => void;
    emitComputerControl: (input: {
        tenantId: string;
        computerId: string;
        action: "unlock" | "lock";
        mode?: "timed" | "free";
        durationMinutes?: number;
    }) => void;
};

export type RealtimeAckSuccess<TData> = {
    success: true;
    data: TData;
};

export type RealtimeAckErrorCode =
    | "FORBIDDEN"
    | "VALIDATION_ERROR"
    | "TOO_MANY_REQUESTS"
    | "INTERNAL_ERROR";

export type RealtimeAckError = {
    success: false;
    error: {
        code: RealtimeAckErrorCode;
        message: string;
    };
};

export type RealtimeAckResponse<TData> =
    | RealtimeAckSuccess<TData>
    | RealtimeAckError;

