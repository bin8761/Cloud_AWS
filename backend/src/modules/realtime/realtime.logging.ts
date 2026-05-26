import type { Socket } from "socket.io";
import { logger } from "../../shared/logging/logger";

export const REALTIME_LOG_EVENTS = {
    ADMIN_CONNECTED: "realtime.admin.connected",
    ADMIN_DISCONNECTED: "realtime.admin.disconnected",
    CLIENT_CONNECTED: "realtime.client.connected",
    CLIENT_DISCONNECTED: "realtime.client.disconnected",
    CLIENT_HEARTBEAT: "realtime.client.heartbeat",
    CLIENT_HEARTBEAT_RATE_LIMITED: "realtime.client.heartbeat.rate_limited",
    CLIENT_AUTH_FAILED: "realtime.client.auth.failed",
    ADMIN_AUTH_FAILED: "realtime.admin.auth.failed",
    COMPUTER_ONLINE: "realtime.computer.online",
    COMPUTER_OFFLINE: "realtime.computer.offline",
} as const;

type RealtimeLogLevel = "warn" | "error" | "info";

type ForbiddenRealtimeSensitiveFields = {
    accessToken?: never;
    deviceToken?: never;
    deviceTokenHash?: never;
    payload?: never;
    sentAt?: never;
    token?: never;
    tokenMaterial?: never;
    rawAuth?: never;
    headers?: never;
    handshake?: never;
    authorization?: never;
};

const REALTIME_SAFE_LOG_FIELDS: ReadonlySet<string> = new Set([
    "socketId",
    "tenantId",
    "computerId",
    "actorUserId",
    "actorRole",
    "event",
    "reason",
    "connectedSocketCount",
    "lastHeartbeatAt",
    "ip",
    "userAgent",
] as const);

const FORBIDDEN_LOG_KEYS: ReadonlySet<string> = new Set([
    "accessToken",
    "deviceToken",
    "deviceTokenHash",
    "authorization",
    "headers",
    "handshake",
    "rawAuth",
    "payload",
    "token",
    "tokenMaterial",
    "sentAt",
] as const);

type RealtimeSafeSocketMetadata = {
    socketId: string;
    ip?: string;
    userAgent?: string;
};

type RealtimeAdminConnectionLogInput = RealtimeSafeSocketMetadata & {
    tenantId: string;
    actorUserId: string;
    actorRole: "shop_admin" | "staff";
    connectedSocketCount?: number;
    reason?: string;
    level?: RealtimeLogLevel;
} & ForbiddenRealtimeSensitiveFields;

type RealtimeClientConnectionLogInput = RealtimeSafeSocketMetadata & {
    tenantId: string;
    computerId: string;
    connectedSocketCount?: number;
    reason?: string;
    level?: RealtimeLogLevel;
} & ForbiddenRealtimeSensitiveFields;

export type RealtimeAdminAuthFailureLogInput = RealtimeSafeSocketMetadata & {
    reason: string;
    level?: RealtimeLogLevel;
} & ForbiddenRealtimeSensitiveFields;

export type RealtimeClientAuthFailureLogInput = RealtimeSafeSocketMetadata & {
    reason: string;
    level?: RealtimeLogLevel;
} & ForbiddenRealtimeSensitiveFields;

export type RealtimeClientHeartbeatLogInput = {
    socketId: string;
    tenantId: string;
    computerId: string;
    lastHeartbeatAt?: string;
    reason?: string;
    level?: RealtimeLogLevel;
} & ForbiddenRealtimeSensitiveFields;

export type RealtimeClientHeartbeatRateLimitedLogInput = {
    socketId: string;
    tenantId: string;
    computerId: string;
    reason: string;
    level?: RealtimeLogLevel;
} & ForbiddenRealtimeSensitiveFields;

type RealtimeComputerPresenceEventLogInput = {
    tenantId: string;
    computerId: string;
    connectedSocketCount?: number;
    lastHeartbeatAt?: string;
    reason?: string;
    level?: RealtimeLogLevel;
} & ForbiddenRealtimeSensitiveFields;

const getSafeSocketIp = (socket: Socket): string | undefined =>
    typeof socket.handshake.address === "string"
        ? socket.handshake.address
        : undefined;

const getSafeSocketUserAgent = (socket: Socket): string | undefined => {
    const userAgent = socket.handshake.headers["user-agent"];
    return typeof userAgent === "string" ? userAgent : undefined;
};

const emitByLevel = (
    level: RealtimeLogLevel | undefined,
    payload: Record<string, unknown>,
    message: string
): void => {
    const safePayload = sanitizeSafeLogPayload(payload);
    const resolvedLevel = level ?? "warn";
    if (resolvedLevel === "error") {
        logger.error(safePayload, message);
        return;
    }
    if (resolvedLevel === "info") {
        logger.info(safePayload, message);
        return;
    }
    logger.warn(safePayload, message);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const assertNoForbiddenKeys = (value: unknown): void => {
    if (!isPlainObject(value)) {
        return;
    }

    for (const [key, nestedValue] of Object.entries(value)) {
        if (FORBIDDEN_LOG_KEYS.has(key)) {
            throw new Error(`Forbidden realtime log field detected: ${key}`);
        }

        assertNoForbiddenKeys(nestedValue);
    }
};

const sanitizeSafeLogPayload = (
    payload: Record<string, unknown>
): Record<string, unknown> => {
    assertNoForbiddenKeys(payload);

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
        if (!REALTIME_SAFE_LOG_FIELDS.has(key)) {
            continue;
        }

        if (typeof value === "undefined") {
            continue;
        }

        sanitized[key] = value;
    }

    return sanitized;
};

export const buildRealtimeAdminConnectedLogInput = (
    socket: Socket,
    input: {
        tenantId: string;
        actorUserId: string;
        actorRole: "shop_admin" | "staff";
        connectedSocketCount?: number;
        reason?: string;
    }
): RealtimeAdminConnectionLogInput => ({
    socketId: socket.id,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    connectedSocketCount: input.connectedSocketCount,
    reason: input.reason,
    ip: getSafeSocketIp(socket),
    userAgent: getSafeSocketUserAgent(socket),
    level: "info",
});

export const buildRealtimeAdminDisconnectedLogInput = (
    socket: Socket,
    input: {
        tenantId: string;
        actorUserId: string;
        actorRole: "shop_admin" | "staff";
        connectedSocketCount?: number;
        reason?: string;
    }
): RealtimeAdminConnectionLogInput => ({
    socketId: socket.id,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    connectedSocketCount: input.connectedSocketCount,
    reason: input.reason,
    ip: getSafeSocketIp(socket),
    userAgent: getSafeSocketUserAgent(socket),
    level: "info",
});

export const buildRealtimeClientConnectedLogInput = (
    socket: Socket,
    input: {
        tenantId: string;
        computerId: string;
        connectedSocketCount?: number;
        reason?: string;
    }
): RealtimeClientConnectionLogInput => ({
    socketId: socket.id,
    tenantId: input.tenantId,
    computerId: input.computerId,
    connectedSocketCount: input.connectedSocketCount,
    reason: input.reason,
    ip: getSafeSocketIp(socket),
    userAgent: getSafeSocketUserAgent(socket),
    level: "info",
});

export const buildRealtimeClientDisconnectedLogInput = (
    socket: Socket,
    input: {
        tenantId: string;
        computerId: string;
        connectedSocketCount?: number;
        reason?: string;
    }
): RealtimeClientConnectionLogInput => ({
    socketId: socket.id,
    tenantId: input.tenantId,
    computerId: input.computerId,
    connectedSocketCount: input.connectedSocketCount,
    reason: input.reason,
    ip: getSafeSocketIp(socket),
    userAgent: getSafeSocketUserAgent(socket),
    level: "info",
});

export const buildRealtimeClientHeartbeatLogInput = (
    input: {
        socketId: string;
        tenantId: string;
        computerId: string;
        lastHeartbeatAt?: string;
        reason?: string;
    }
): RealtimeClientHeartbeatLogInput => ({
    socketId: input.socketId,
    tenantId: input.tenantId,
    computerId: input.computerId,
    lastHeartbeatAt: input.lastHeartbeatAt,
    reason: input.reason,
    level: "info",
});

export const buildRealtimeClientHeartbeatRateLimitedLogInput = (
    input: {
        socketId: string;
        tenantId: string;
        computerId: string;
        reason: string;
    }
): RealtimeClientHeartbeatRateLimitedLogInput => ({
    socketId: input.socketId,
    tenantId: input.tenantId,
    computerId: input.computerId,
    reason: input.reason,
    level: "warn",
});

export const buildRealtimeAdminAuthFailureLogInput = (
    socket: Socket,
    reason: string
): RealtimeAdminAuthFailureLogInput => ({
    socketId: socket.id,
    ip: getSafeSocketIp(socket),
    userAgent: getSafeSocketUserAgent(socket),
    reason,
});

export const buildRealtimeClientAuthFailureLogInput = (
    socket: Socket,
    reason: string
): RealtimeClientAuthFailureLogInput => ({
    socketId: socket.id,
    ip: getSafeSocketIp(socket),
    userAgent: getSafeSocketUserAgent(socket),
    reason,
});

export const buildRealtimeComputerOnlineLogInput = (
    input: {
        tenantId: string;
        computerId: string;
        connectedSocketCount?: number;
        lastHeartbeatAt?: string;
        reason?: string;
    }
): RealtimeComputerPresenceEventLogInput => ({
    tenantId: input.tenantId,
    computerId: input.computerId,
    connectedSocketCount: input.connectedSocketCount,
    lastHeartbeatAt: input.lastHeartbeatAt,
    reason: input.reason,
    level: "info",
});

export const buildRealtimeComputerOfflineLogInput = (
    input: {
        tenantId: string;
        computerId: string;
        connectedSocketCount?: number;
        lastHeartbeatAt?: string;
        reason?: string;
    }
): RealtimeComputerPresenceEventLogInput => ({
    tenantId: input.tenantId,
    computerId: input.computerId,
    connectedSocketCount: input.connectedSocketCount,
    lastHeartbeatAt: input.lastHeartbeatAt,
    reason: input.reason,
    level: "info",
});

export class RealtimeLoggingService {
    public logAdminConnected(input: RealtimeAdminConnectionLogInput): void {
        emitByLevel(
            input.level,
            {
                event: REALTIME_LOG_EVENTS.ADMIN_CONNECTED,
                socketId: input.socketId,
                tenantId: input.tenantId,
                actorUserId: input.actorUserId,
                actorRole: input.actorRole,
                connectedSocketCount: input.connectedSocketCount,
                reason: input.reason,
                ip: input.ip,
                userAgent: input.userAgent,
            },
            "realtime admin connected"
        );
    }

    public logAdminDisconnected(input: RealtimeAdminConnectionLogInput): void {
        emitByLevel(
            input.level,
            {
                event: REALTIME_LOG_EVENTS.ADMIN_DISCONNECTED,
                socketId: input.socketId,
                tenantId: input.tenantId,
                actorUserId: input.actorUserId,
                actorRole: input.actorRole,
                connectedSocketCount: input.connectedSocketCount,
                reason: input.reason,
                ip: input.ip,
                userAgent: input.userAgent,
            },
            "realtime admin disconnected"
        );
    }

    public logClientConnected(input: RealtimeClientConnectionLogInput): void {
        emitByLevel(
            input.level,
            {
                event: REALTIME_LOG_EVENTS.CLIENT_CONNECTED,
                socketId: input.socketId,
                tenantId: input.tenantId,
                computerId: input.computerId,
                connectedSocketCount: input.connectedSocketCount,
                reason: input.reason,
                ip: input.ip,
                userAgent: input.userAgent,
            },
            "realtime client connected"
        );
    }

    public logClientDisconnected(input: RealtimeClientConnectionLogInput): void {
        emitByLevel(
            input.level,
            {
                event: REALTIME_LOG_EVENTS.CLIENT_DISCONNECTED,
                socketId: input.socketId,
                tenantId: input.tenantId,
                computerId: input.computerId,
                connectedSocketCount: input.connectedSocketCount,
                reason: input.reason,
                ip: input.ip,
                userAgent: input.userAgent,
            },
            "realtime client disconnected"
        );
    }

    public logClientHeartbeat(input: RealtimeClientHeartbeatLogInput): void {
        emitByLevel(
            input.level,
            {
                event: REALTIME_LOG_EVENTS.CLIENT_HEARTBEAT,
                socketId: input.socketId,
                tenantId: input.tenantId,
                computerId: input.computerId,
                lastHeartbeatAt: input.lastHeartbeatAt,
                reason: input.reason,
            },
            "realtime client heartbeat"
        );
    }

    public logClientHeartbeatRateLimited(
        input: RealtimeClientHeartbeatRateLimitedLogInput
    ): void {
        emitByLevel(
            input.level,
            {
                event: REALTIME_LOG_EVENTS.CLIENT_HEARTBEAT_RATE_LIMITED,
                socketId: input.socketId,
                tenantId: input.tenantId,
                computerId: input.computerId,
                reason: input.reason,
            },
            "realtime client heartbeat rate limited"
        );
    }

    public logAdminAuthFailure(input: RealtimeAdminAuthFailureLogInput): void {
        emitByLevel(
            input.level,
            {
                event: REALTIME_LOG_EVENTS.ADMIN_AUTH_FAILED,
                socketId: input.socketId,
                ip: input.ip,
                userAgent: input.userAgent,
                reason: input.reason,
            },
            "realtime admin auth failed"
        );
    }

    public logClientAuthFailure(input: RealtimeClientAuthFailureLogInput): void {
        emitByLevel(
            input.level,
            {
                event: REALTIME_LOG_EVENTS.CLIENT_AUTH_FAILED,
                socketId: input.socketId,
                ip: input.ip,
                userAgent: input.userAgent,
                reason: input.reason,
            },
            "realtime client auth failed"
        );
    }

    public logComputerOnline(input: RealtimeComputerPresenceEventLogInput): void {
        emitByLevel(
            input.level,
            {
                event: REALTIME_LOG_EVENTS.COMPUTER_ONLINE,
                tenantId: input.tenantId,
                computerId: input.computerId,
                connectedSocketCount: input.connectedSocketCount,
                lastHeartbeatAt: input.lastHeartbeatAt,
                reason: input.reason,
            },
            "realtime computer online"
        );
    }

    public logComputerOffline(input: RealtimeComputerPresenceEventLogInput): void {
        emitByLevel(
            input.level,
            {
                event: REALTIME_LOG_EVENTS.COMPUTER_OFFLINE,
                tenantId: input.tenantId,
                computerId: input.computerId,
                connectedSocketCount: input.connectedSocketCount,
                lastHeartbeatAt: input.lastHeartbeatAt,
                reason: input.reason,
            },
            "realtime computer offline"
        );
    }
}

export const realtimeLoggingService = new RealtimeLoggingService();
