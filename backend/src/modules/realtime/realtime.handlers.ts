/**
 * Realtime handler boundaries.
 * - Room names must be derived via room helpers only.
 * - Handler payloads must not carry room / tenantId / computerId overrides.
 */
import type { Socket } from "socket.io";
import { z } from "zod";
import { buildRealtimeAckError, buildRealtimeAckInternalError, buildRealtimeAckSuccess } from "./realtime.ack";
import {
    REALTIME_ADMIN_COMPUTER_CONTROL_EVENT,
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
    RealtimeGatewayPublicApi,
    RealtimeSocketContext,
} from "./realtime.types";

type ForbiddenRoutingOverrides = {
    room?: never;
    roomName?: never;
    tenantId?: never;
};

export type AdminWatchTenantPayload = ForbiddenRoutingOverrides &
    Record<string, never>;

export type ClientHeartbeatPayload = ForbiddenRoutingOverrides & {
    sentAt: string;
};

export type AdminComputerControlPayload = Omit<
    ForbiddenRoutingOverrides,
    "computerId"
> & {
    computerId: string;
    action: "unlock" | "lock";
    mode?: "timed" | "free";
    durationMinutes?: number;
};

export const adminWatchTenantPayloadSchema = z.object({}).strict();

export const clientHeartbeatPayloadSchema = z
    .object({
        sentAt: z.string().datetime(),
    })
    .strict();

export const adminComputerControlPayloadSchema = z
    .object({
        computerId: z.string().trim().min(1),
        action: z.enum(["unlock", "lock"]),
        mode: z.enum(["timed", "free"]).optional(),
        durationMinutes: z.number().int().min(1).max(24 * 60).optional(),
    })
    .strict()
    .superRefine((payload, ctx) => {
        if (payload.action === "lock") {
            if (payload.mode !== undefined || payload.durationMinutes !== undefined) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Lock action must not include mode or durationMinutes.",
                });
            }
            return;
        }

        if (payload.action === "unlock" && payload.mode === "timed") {
            if (payload.durationMinutes === undefined) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message:
                        "Unlock timed action requires durationMinutes in range 1..1440.",
                });
            }
            return;
        }

        if (
            payload.action === "unlock" &&
            payload.mode === "free" &&
            payload.durationMinutes !== undefined
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Unlock free action must not include durationMinutes.",
            });
        }
    });

export const parseAdminWatchTenantPayload = (
    payload: unknown
): AdminWatchTenantPayload =>
    adminWatchTenantPayloadSchema.parse(payload) as AdminWatchTenantPayload;

export const parseClientHeartbeatPayload = (
    payload: unknown
): ClientHeartbeatPayload =>
    clientHeartbeatPayloadSchema.parse(payload) as ClientHeartbeatPayload;

export const parseAdminComputerControlPayload = (
    payload: unknown
): AdminComputerControlPayload =>
    adminComputerControlPayloadSchema.parse(payload) as AdminComputerControlPayload;

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

type AdminComputerControlAckData = {
    accepted: true;
};

type AdminComputerControlAck = (
    response: RealtimeAckResponse<AdminComputerControlAckData>
) => void;

const respondAdminComputerControl = (
    ack: AdminComputerControlAck | undefined,
    response: RealtimeAckResponse<AdminComputerControlAckData>
): void => {
    if (!ack) {
        return;
    }

    ack(response);
};

const isShopAdminContext = (
    realtimeContext: RealtimeSocketContext | undefined
): realtimeContext is RealtimeAdminSocketContext =>
    realtimeContext?.clientType === "admin" &&
    realtimeContext.role === "shop_admin";

export const registerAdminComputerControlHandler = (
    socket: Socket,
    realtimeContext: RealtimeSocketContext | undefined,
    realtimeGateway: RealtimeGatewayPublicApi,
    findTenantComputerById: (input: {
        tenantId: string;
        computerId: string;
    }) => Promise<{
        id: string;
        status: "ACTIVE" | "INACTIVE" | "BLOCKED";
    } | null>
): void => {
    socket.on(
        REALTIME_ADMIN_COMPUTER_CONTROL_EVENT,
        async (payload: unknown, ack?: AdminComputerControlAck) => {
            if (!isShopAdminContext(realtimeContext)) {
                respondAdminComputerControl(
                    ack,
                    buildRealtimeAckError({
                        code: "FORBIDDEN",
                        message:
                            "Only shop_admin realtime sockets can control computers.",
                    })
                );
                return;
            }

            let parsedPayload: AdminComputerControlPayload;

            try {
                parsedPayload = parseAdminComputerControlPayload(payload);
            } catch (error) {
                if (error instanceof z.ZodError) {
                    respondAdminComputerControl(
                        ack,
                        buildRealtimeAckError({
                            code: "VALIDATION_ERROR",
                            message: "Invalid admin:computer-control payload.",
                        })
                    );
                    return;
                }

                respondAdminComputerControl(ack, buildRealtimeAckInternalError(error));
                return;
            }

            try {
                const targetComputer = await findTenantComputerById({
                    tenantId: realtimeContext.tenantId,
                    computerId: parsedPayload.computerId,
                });

                if (!targetComputer || targetComputer.status !== "ACTIVE") {
                    respondAdminComputerControl(
                        ack,
                        buildRealtimeAckError({
                            code: "FORBIDDEN",
                            message:
                                "Target computer is unavailable for control in current tenant.",
                        })
                    );
                    return;
                }

                realtimeGateway.emitComputerControl({
                    tenantId: realtimeContext.tenantId,
                    computerId: targetComputer.id,
                    action: parsedPayload.action,
                    mode: parsedPayload.mode,
                    durationMinutes: parsedPayload.durationMinutes,
                });

                respondAdminComputerControl(
                    ack,
                    buildRealtimeAckSuccess({
                        accepted: true,
                    })
                );
            } catch (error) {
                respondAdminComputerControl(ack, buildRealtimeAckInternalError(error));
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

