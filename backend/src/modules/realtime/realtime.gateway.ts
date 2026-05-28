/**
 * Realtime gateway internals.
 * Room routing must use room helpers, never ad-hoc string construction.
 */
import type { Server as SocketIoServer } from "socket.io";
import {
    REALTIME_COMPUTER_CONTROL_EVENT,
    REALTIME_COMPUTER_OFFLINE_EVENT,
    REALTIME_COMPUTER_ONLINE_EVENT,
} from "./realtime.events";
import { computerRoom, tenantRoom } from "./realtime.rooms";
import type { RealtimeGatewayPublicApi } from "./realtime.types";

type TrustedGatewayRoutingContext = {
    tenantId: string;
    computerId: string;
};

/**
 * Derives tenant room from trusted gateway context only.
 */
export const resolveGatewayTenantRoom = (
    context: Pick<TrustedGatewayRoutingContext, "tenantId">
): string => tenantRoom(context.tenantId);

/**
 * Derives computer room from trusted gateway context only.
 */
export const resolveGatewayComputerRoom = (
    context: Pick<TrustedGatewayRoutingContext, "computerId">
): string => computerRoom(context.computerId);

const assertTrustedRealtimeIdentifier = (
    value: string,
    fieldName: "tenantId" | "computerId"
): void => {
    if (!value || value.trim().length === 0) {
        throw new Error(
            `Realtime gateway requires trusted non-empty ${fieldName}.`
        );
    }
};

const assertTrustedGatewayRoutingContext = (
    context: TrustedGatewayRoutingContext
): void => {
    assertTrustedRealtimeIdentifier(context.tenantId, "tenantId");
    assertTrustedRealtimeIdentifier(context.computerId, "computerId");
};

type ComputerPresenceEventPayload = {
    tenantId: string;
    computerId: string;
    lastSeenAt: string;
};

type ComputerControlEventPayload = {
    tenantId: string;
    computerId: string;
    action: "unlock" | "lock";
    mode?: "timed" | "free";
    durationMinutes?: number;
    sentAt: string;
};

const buildComputerPresenceEventPayload = (
    context: TrustedGatewayRoutingContext
): ComputerPresenceEventPayload => ({
    tenantId: context.tenantId,
    computerId: context.computerId,
    lastSeenAt: new Date().toISOString(),
});

const buildComputerControlEventPayload = (input: {
    tenantId: string;
    computerId: string;
    action: "unlock" | "lock";
    mode?: "timed" | "free";
    durationMinutes?: number;
}): ComputerControlEventPayload => ({
    tenantId: input.tenantId,
    computerId: input.computerId,
    action: input.action,
    ...(input.mode === undefined ? {} : { mode: input.mode }),
    ...(input.durationMinutes === undefined
        ? {}
        : { durationMinutes: input.durationMinutes }),
    sentAt: new Date().toISOString(),
});

/**
 * Internal creator boundary for gateway wiring.
 * Keep Socket.IO emission internals private to this module.
 */
export const createRealtimeGateway = (
    io: SocketIoServer
): RealtimeGatewayPublicApi => ({
    emitComputerOnline: (tenantId: string, computerId: string): void => {
        const trustedContext = { tenantId, computerId };
        assertTrustedGatewayRoutingContext(trustedContext);

        io.to(resolveGatewayTenantRoom(trustedContext)).emit(
            REALTIME_COMPUTER_ONLINE_EVENT,
            buildComputerPresenceEventPayload(trustedContext)
        );
    },
    emitComputerOffline: (tenantId: string, computerId: string): void => {
        const trustedContext = { tenantId, computerId };
        assertTrustedGatewayRoutingContext(trustedContext);

        io.to(resolveGatewayTenantRoom(trustedContext)).emit(
            REALTIME_COMPUTER_OFFLINE_EVENT,
            buildComputerPresenceEventPayload(trustedContext)
        );
    },
    emitComputerControl: (input): void => {
        const trustedContext = {
            tenantId: input.tenantId,
            computerId: input.computerId,
        };
        assertTrustedGatewayRoutingContext(trustedContext);

        io.to(resolveGatewayComputerRoom(trustedContext)).emit(
            REALTIME_COMPUTER_CONTROL_EVENT,
            buildComputerControlEventPayload(input)
        );
    },
});

