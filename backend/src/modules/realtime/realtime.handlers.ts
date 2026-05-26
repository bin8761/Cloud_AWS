/**
 * Realtime handler boundaries.
 * - Room names must be derived via room helpers only.
 * - Handler payloads must not carry room / tenantId / computerId overrides.
 */
import type { Socket } from "socket.io";
import { z } from "zod";
import { buildRealtimeAckError, buildRealtimeAckInternalError, buildRealtimeAckSuccess } from "./realtime.ack";
import {
    REALTIME_ADMIN_WATCH_TENANT_EVENT,
    REALTIME_CLIENT_HEARTBEAT_EVENT,
} from "./realtime.events";
import {
    buildRealtimeClientHeartbeatLogInput,
    buildRealtimeClientHeartbeatRateLimitedLogInput,
    realtimeLoggingService,
} from "./realtime.logging";
import { realtimePresenceStore } from "./realtime.presence";
import type { RealtimeHeartbeatRateLimiter } from "./realtime.rate-limit";
import { computerRoom, tenantRoom } from "./realtime.rooms";
import type {
    RealtimeAckResponse,
    RealtimeAdminSocketContext,
    RealtimeComputerSocketContext,
    RealtimeSocketContext,
} from "./realtime.types";

type ForbiddenRoutingOverrides = {
    room?: never;
    roomName?: never;
    tenantId?: never;
    computerId?: never;
};

export type AdminWatchTenantPayload = ForbiddenRoutingOverrides &
    Record<string, never>;

export type ClientHeartbeatPayload = ForbiddenRoutingOverrides & {
    sentAt: string;
};

export const adminWatchTenantPayloadSchema = z.object({}).strict();

export const clientHeartbeatPayloadSchema = z
    .object({
        sentAt: z.string().datetime(),
    })
    .strict();

export const parseAdminWatchTenantPayload = (
    payload: unknown
): AdminWatchTenantPayload =>
    adminWatchTenantPayloadSchema.parse(payload) as AdminWatchTenantPayload;

export const parseClientHeartbeatPayload = (
    payload: unknown
): ClientHeartbeatPayload =>
    clientHeartbeatPayloadSchema.parse(payload) as ClientHeartbeatPayload;

type TrustedAdminRoomContext = Pick<RealtimeAdminSocketContext, "tenantId">;
type TrustedComputerRoomContext = Pick<
    RealtimeComputerSocketContext,
    "computerId"
>;

/**
 * Trusted-context-only room resolution for admin handlers.
 */
export const resolveTenantRoomFromTrustedContext = (
    context: TrustedAdminRoomContext
): string => tenantRoom(context.tenantId);

/**
 * Trusted-context-only room resolution for computer handlers.
 */
export const resolveComputerRoomFromTrustedContext = (
    context: TrustedComputerRoomContext
): string => computerRoom(context.computerId);

type AdminWatchTenantAckData = {
    onlineComputers: string[];
};

type AdminWatchTenantAck = (
    response: RealtimeAckResponse<AdminWatchTenantAckData>
) => void;

const respondAdminWatchTenant = (
    ack: AdminWatchTenantAck | undefined,
    response: RealtimeAckResponse<AdminWatchTenantAckData>
): void => {
    if (!ack) {
        return;
    }

    ack(response);
};

type ClientHeartbeatAckData = {
    serverTime: string;
};

type ClientHeartbeatAck = (
    response: RealtimeAckResponse<ClientHeartbeatAckData>
) => void;

const respondClientHeartbeat = (
    ack: ClientHeartbeatAck | undefined,
    response: RealtimeAckResponse<ClientHeartbeatAckData>
): void => {
    if (!ack) {
        return;
    }

    ack(response);
};

export const registerAdminWatchTenantHandler = (
    socket: Socket,
    realtimeContext: RealtimeSocketContext | undefined
): void => {
    socket.on(
        REALTIME_ADMIN_WATCH_TENANT_EVENT,
        (payload: unknown, ack?: AdminWatchTenantAck) => {
            if (realtimeContext?.clientType !== "admin") {
                respondAdminWatchTenant(
                    ack,
                    buildRealtimeAckError({
                        code: "FORBIDDEN",
                        message: "Only admin realtime sockets can watch tenant presence.",
                    })
                );
                return;
            }

            try {
                parseAdminWatchTenantPayload(payload);
            } catch (error) {
                if (error instanceof z.ZodError) {
                    respondAdminWatchTenant(
                        ack,
                        buildRealtimeAckError({
                            code: "VALIDATION_ERROR",
                            message:
                                "Invalid admin:watch-tenant payload. Expected empty object.",
                        })
                    );
                    return;
                }

                respondAdminWatchTenant(ack, buildRealtimeAckInternalError(error));
                return;
            }

            try {
                const trustedTenantRoom =
                    resolveTenantRoomFromTrustedContext(realtimeContext);
                socket.join(trustedTenantRoom);

                const snapshot = realtimePresenceStore.getPresenceSnapshotForTenant(
                    realtimeContext.tenantId
                );

                respondAdminWatchTenant(
                    ack,
                    buildRealtimeAckSuccess({
                        onlineComputers: snapshot.onlineComputerIds,
                    })
                );
            } catch (error) {
                respondAdminWatchTenant(ack, buildRealtimeAckInternalError(error));
            }
        }
    );
};

export const registerClientHeartbeatHandler = (
    socket: Socket,
    realtimeContext: RealtimeSocketContext | undefined,
    heartbeatRateLimiter: RealtimeHeartbeatRateLimiter,
    incrementHeartbeatRateLimited: () => void,
    incrementHeartbeatAccepted: () => void
): void => {
    socket.on(
        REALTIME_CLIENT_HEARTBEAT_EVENT,
        async (payload: unknown, ack?: ClientHeartbeatAck) => {
            if (realtimeContext?.clientType !== "computer") {
                respondClientHeartbeat(
                    ack,
                    buildRealtimeAckError({
                        code: "FORBIDDEN",
                        message: "Only computer realtime sockets can send heartbeats.",
                    })
                );
                return;
            }

            try {
                parseClientHeartbeatPayload(payload);
            } catch (error) {
                if (error instanceof z.ZodError) {
                    respondClientHeartbeat(
                        ack,
                        buildRealtimeAckError({
                            code: "VALIDATION_ERROR",
                            message:
                                "Invalid client:heartbeat payload. Expected { sentAt: ISO datetime }.",
                        })
                    );
                    return;
                }

                respondClientHeartbeat(ack, buildRealtimeAckInternalError(error));
                return;
            }

            const limiterResult = heartbeatRateLimiter.consume(
                realtimeContext.computerId
            );
            if (!limiterResult.accepted) {
                incrementHeartbeatRateLimited();
                realtimeLoggingService.logClientHeartbeatRateLimited(
                    buildRealtimeClientHeartbeatRateLimitedLogInput({
                        socketId: socket.id,
                        tenantId: realtimeContext.tenantId,
                        computerId: realtimeContext.computerId,
                        reason: "heartbeat_rate_limited",
                    })
                );
                respondClientHeartbeat(
                    ack,
                    buildRealtimeAckError({
                        code: "TOO_MANY_REQUESTS",
                        message:
                            "Too many heartbeat events. Please try again later.",
                    })
                );
                return;
            }

            try {
                const heartbeatResult = await realtimePresenceStore.recordHeartbeat(
                    realtimeContext.computerId
                );
                realtimeLoggingService.logClientHeartbeat(
                    buildRealtimeClientHeartbeatLogInput({
                        socketId: socket.id,
                        tenantId: realtimeContext.tenantId,
                        computerId: realtimeContext.computerId,
                        lastHeartbeatAt:
                            heartbeatResult.lastHeartbeatAt?.toISOString(),
                        reason: "heartbeat_accepted",
                    })
                );
                const serverTime = new Date().toISOString();
                incrementHeartbeatAccepted();
                respondClientHeartbeat(
                    ack,
                    buildRealtimeAckSuccess({
                        serverTime,
                    })
                );
            } catch (error) {
                respondClientHeartbeat(ack, buildRealtimeAckInternalError(error));
            }
        }
    );
};

/**
 * Internal-only handler registration boundary for MVP.
 * Event handlers stay centered in this file until explicit split tasks.
 */
export type RegisterRealtimeHandlers = () => void;

