import type { Socket } from "socket.io";
import { ComputerStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../shared/prisma/prisma.client";
import { authTokenService } from "../auth/auth.tokens";
import type { AuthRole } from "../auth/auth.types";
import { hashDeviceToken } from "../computers/computers.service";
import type { RealtimeAdminSocketContext } from "./realtime.types";
import type { RealtimeComputerSocketContext } from "./realtime.types";

const GENERIC_CONNECT_ERROR_MESSAGE = "Unauthorized realtime connection";

const realtimeAdminHandshakeSchema = z
    .object({
        clientType: z.literal("admin"),
        accessToken: z.string().trim().min(1),
    })
    .strict();

const realtimeComputerHandshakeSchema = z
    .object({
        clientType: z.literal("computer"),
        computerId: z.string().trim().min(1),
        deviceToken: z.string().trim().min(1),
    })
    .strict();

export const REALTIME_COMPUTER_AUTH_SELECT = {
    id: true,
    tenantId: true,
    status: true,
    deviceTokenHash: true,
    lastSeenAt: true,
} satisfies Prisma.ComputerSelect;

type RealtimeComputerAuthRecord = Prisma.ComputerGetPayload<{
    select: typeof REALTIME_COMPUTER_AUTH_SELECT;
}>;

const throwGenericConnectError = (): never => {
    throw new Error(GENERIC_CONNECT_ERROR_MESSAGE);
};

const hasValidTenantContext = (tenantId: unknown): tenantId is string =>
    typeof tenantId === "string" && tenantId.trim().length > 0;

const ALLOWED_REALTIME_ADMIN_ROLES = new Set<AuthRole>([
    "shop_admin",
    "staff",
]);

const hasValidUserId = (userId: unknown): userId is string =>
    typeof userId === "string" && userId.trim().length > 0;

const isAllowedRealtimeAdminRole = (role: unknown): role is "shop_admin" | "staff" =>
    typeof role === "string" && ALLOWED_REALTIME_ADMIN_ROLES.has(role as AuthRole);

/**
 * Validates and verifies admin realtime handshake credentials.
 * This function only handles the admin path in current task scope.
 */
export const authenticateRealtimeAdminHandshake = async (
    socket: Socket
): Promise<RealtimeAdminSocketContext> => {
    const parsedHandshake = realtimeAdminHandshakeSchema.safeParse(
        socket.handshake.auth
    );

    if (!parsedHandshake.success) {
        return throwGenericConnectError();
    }

    const { accessToken } = parsedHandshake.data;

    if (accessToken.length === 0) {
        return throwGenericConnectError();
    }

    const claims = await authTokenService
        .verifyAccessToken(accessToken)
        .catch(() => {
            // Includes malformed, expired, invalid, and refresh-token-type JWT.
            return throwGenericConnectError();
        });

    if (claims.tokenType !== "access") {
        return throwGenericConnectError();
    }

    if (!hasValidTenantContext(claims.tenantId)) {
        return throwGenericConnectError();
    }

    if (!hasValidUserId(claims.sub)) {
        return throwGenericConnectError();
    }

    if (!isAllowedRealtimeAdminRole(claims.role)) {
        // Includes explicit `super_admin` denial for Realtime MVP.
        return throwGenericConnectError();
    }

    return {
        clientType: "admin",
        userId: claims.sub,
        tenantId: claims.tenantId,
        role: claims.role,
    };
};

/**
 * Validates computer realtime handshake and loads trusted computer context.
 */
export const authenticateRealtimeComputerHandshake = async (
    socket: Socket
): Promise<{
    context: RealtimeComputerSocketContext;
    computer: RealtimeComputerAuthRecord;
    submittedDeviceTokenHash: string;
}> => {
    const parsedHandshake = realtimeComputerHandshakeSchema.safeParse(
        socket.handshake.auth
    );

    if (!parsedHandshake.success) {
        return throwGenericConnectError();
    }

    const { computerId, deviceToken } = parsedHandshake.data;

    const computer = await prisma.computer.findUnique({
        where: {
            id: computerId,
        },
        select: REALTIME_COMPUTER_AUTH_SELECT,
    });

    if (!computer) {
        return throwGenericConnectError();
    }

    if (computer.status !== ComputerStatus.ACTIVE) {
        return throwGenericConnectError();
    }

    const submittedDeviceTokenHash = hashDeviceToken(deviceToken);
    if (submittedDeviceTokenHash !== computer.deviceTokenHash) {
        throwGenericConnectError();
    }

    return {
        context: {
            clientType: "computer",
            computerId: computer.id,
            tenantId: computer.tenantId,
        },
        computer,
        submittedDeviceTokenHash,
    };
};

