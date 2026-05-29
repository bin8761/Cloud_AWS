import type { Server as HttpServer } from "node:http";
import { Server as SocketIoServer, type Socket } from "socket.io";
import { env } from "../../config/env";
import {
    authenticateRealtimeAdminHandshake,
    authenticateRealtimeComputerHandshake,
} from "./realtime.auth";
import {
    buildRealtimeAdminConnectedLogInput,
    buildRealtimeAdminDisconnectedLogInput,
    buildRealtimeAdminAuthFailureLogInput,
    buildRealtimeClientConnectedLogInput,
    buildRealtimeClientDisconnectedLogInput,
    buildRealtimeClientAuthFailureLogInput,
    buildRealtimeComputerOfflineLogInput,
    buildRealtimeComputerOnlineLogInput,
    realtimeLoggingService,
} from "./realtime.logging";
import {
    registerAdminWatchTenantHandler,
    registerClientHeartbeatHandler,
} from "./realtime.handlers";
import { createRealtimeGateway } from "./realtime.gateway";
import {
    createInMemoryRealtimeHeartbeatRateLimiter,
    type RealtimeHeartbeatRateLimiter,
} from "./realtime.rate-limit";
import { computerRoom } from "./realtime.rooms";
import { realtimePresenceStore } from "./realtime.presence";
import type {
    RealtimeAdminSocketContext,
    RealtimeComputerSocketContext,
    RealtimeSocketContext,
    RealtimeGatewayPublicApi,
    RealtimeHealthSnapshot,
    RealtimeServerPublicApi,
} from "./realtime.types";

const EMPTY_REALTIME_HEALTH_SNAPSHOT: RealtimeHealthSnapshot = {
    activeSockets: 0,
    onlineComputers: 0,
    adminSockets: 0,
    heartbeatAccepted: 0,
    heartbeatRateLimited: 0,
    authFailures: 0,
    heartbeatTimeouts: 0,
};

const sanitizeCounterValue = (value: number): number => {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(0, Math.trunc(value));
};

const getRealtimeHealthSnapshot = (
    snapshot: RealtimeHealthSnapshot
): RealtimeHealthSnapshot => ({
    activeSockets: sanitizeCounterValue(snapshot.activeSockets),
    onlineComputers: sanitizeCounterValue(snapshot.onlineComputers),
    adminSockets: sanitizeCounterValue(snapshot.adminSockets),
    heartbeatAccepted: sanitizeCounterValue(snapshot.heartbeatAccepted),
    heartbeatRateLimited: sanitizeCounterValue(snapshot.heartbeatRateLimited),
    authFailures: sanitizeCounterValue(snapshot.authFailures),
    heartbeatTimeouts: sanitizeCounterValue(snapshot.heartbeatTimeouts),
});

const registerRealtimeAuthenticationMiddleware = (
    io: SocketIoServer,
    incrementAuthFailures: () => void
): void => {
    io.use((socket, next) => {
        const clientType = socket.handshake.auth?.clientType;

        if (clientType === "admin") {
            void authenticateRealtimeAdminHandshake(socket)
                .then((adminContext: RealtimeAdminSocketContext) => {
                    socket.data.realtimeContext = adminContext;
                    next();
                })
                .catch(() => {
                    incrementAuthFailures();
                    realtimeLoggingService.logAdminAuthFailure(
                        buildRealtimeAdminAuthFailureLogInput(
                            socket,
                            "admin_auth_rejected"
                        )
                    );
                    next(new Error("Unauthorized realtime connection"));
                });

            return;
        }

        if (clientType === "computer") {
            void authenticateRealtimeComputerHandshake(socket)
                .then(
                    ({
                        context,
                    }: {
                        context: RealtimeComputerSocketContext;
                    }) => {
                        socket.data.realtimeContext = context;
                        next();
                    }
                )
                .catch(() => {
                    incrementAuthFailures();
                    realtimeLoggingService.logClientAuthFailure(
                        buildRealtimeClientAuthFailureLogInput(
                            socket,
                            "client_auth_rejected"
                        )
                    );
                    next(new Error("Unauthorized realtime connection"));
                });

            return;
        }

        next();
    });
};

const registerRealtimeHandlers = (
    io: SocketIoServer,
    realtimeGateway: RealtimeGatewayPublicApi,
    heartbeatRateLimiter: RealtimeHeartbeatRateLimiter,
    incrementHeartbeatRateLimited: () => void,
    incrementHeartbeatAccepted: () => void,
    incrementActiveSockets: () => void,
    decrementActiveSockets: () => void,
    incrementAdminSockets: () => void,
    decrementAdminSockets: () => void,
    incrementOnlineComputers: () => void,
    decrementOnlineComputers: () => void
): void => {
    io.on("connection", (socket: Socket) => {
        incrementActiveSockets();
        const realtimeContext = socket.data
            .realtimeContext as RealtimeSocketContext | undefined;

        if (realtimeContext?.clientType === "admin") {
            incrementAdminSockets();
            realtimeLoggingService.logAdminConnected(
                buildRealtimeAdminConnectedLogInput(socket, {
                    tenantId: realtimeContext.tenantId,
                    actorUserId: realtimeContext.userId,
                    actorRole: realtimeContext.role,
                    reason: "admin_connected",
                })
            );
        }

        if (realtimeContext?.clientType === "computer") {
            socket.join(computerRoom(realtimeContext.computerId));

            void realtimePresenceStore
                .addComputerSocket(
                    socket.id,
                    realtimeContext.computerId,
                    realtimeContext.tenantId
                )
                .then((presenceResult) => {
                    realtimeLoggingService.logClientConnected(
                        buildRealtimeClientConnectedLogInput(socket, {
                            tenantId: presenceResult.tenantId,
                            computerId: presenceResult.computerId,
                            connectedSocketCount:
                                presenceResult.connectedSocketCount,
                            reason: "client_connected",
                        })
                    );

                    if (!presenceResult.transitionedToOnline) {
                        return;
                    }

                    incrementOnlineComputers();
                    realtimeLoggingService.logComputerOnline(
                        buildRealtimeComputerOnlineLogInput({
                            tenantId: presenceResult.tenantId,
                            computerId: presenceResult.computerId,
                            connectedSocketCount:
                                presenceResult.connectedSocketCount,
                            reason: "presence_transition_online",
                        })
                    );
                    realtimeGateway.emitComputerOnline(
                        presenceResult.tenantId,
                        presenceResult.computerId
                    );
                })
                .catch(() => {
                    // Presence registration failure must not break accepted socket lifecycle.
                });
        }

        socket.on("disconnect", () => {
            decrementActiveSockets();
            if (realtimeContext?.clientType === "admin") {
                decrementAdminSockets();
                realtimeLoggingService.logAdminDisconnected(
                    buildRealtimeAdminDisconnectedLogInput(socket, {
                        tenantId: realtimeContext.tenantId,
                        actorUserId: realtimeContext.userId,
                        actorRole: realtimeContext.role,
                        reason: "admin_disconnected",
                    })
                );
                return;
            }

            if (realtimeContext?.clientType !== "computer") {
                return;
            }

            const disconnectResult = realtimePresenceStore.removeComputerSocket(
                socket.id
            );
            realtimeLoggingService.logClientDisconnected(
                buildRealtimeClientDisconnectedLogInput(socket, {
                    tenantId: realtimeContext.tenantId,
                    computerId: realtimeContext.computerId,
                    connectedSocketCount: disconnectResult.connectedSocketCount,
                    reason: "client_disconnected",
                })
            );
            if (!disconnectResult.transitionedToOffline) {
                return;
            }

            if (!disconnectResult.computerId || !disconnectResult.tenantId) {
                return;
            }

            decrementOnlineComputers();
            realtimeLoggingService.logComputerOffline(
                buildRealtimeComputerOfflineLogInput({
                    tenantId: disconnectResult.tenantId,
                    computerId: disconnectResult.computerId,
                    connectedSocketCount: disconnectResult.connectedSocketCount,
                    reason: "presence_transition_offline_disconnect",
                })
            );
            realtimeGateway.emitComputerOffline(
                disconnectResult.tenantId,
                disconnectResult.computerId
            );
        });

        registerAdminWatchTenantHandler(socket, realtimeContext);
        registerClientHeartbeatHandler(
            socket,
            realtimeContext,
            heartbeatRateLimiter,
            incrementHeartbeatRateLimited,
            incrementHeartbeatAccepted
        );
    });
};

/**
 * Public factory boundary consumed by server bootstrap.
 */
export const createRealtimeServer = (
    httpServer: HttpServer
): RealtimeServerPublicApi => {
    const io = new SocketIoServer(httpServer, {
        cors: {
            origin: env.app.corsOrigin,
            credentials: true,
        },
    });

    let currentHealthSnapshot: RealtimeHealthSnapshot = {
        ...EMPTY_REALTIME_HEALTH_SNAPSHOT,
    };
    const incrementAuthFailures = (): void => {
        currentHealthSnapshot = {
            ...currentHealthSnapshot,
            authFailures: currentHealthSnapshot.authFailures + 1,
        };
    };
    const incrementHeartbeatRateLimited = (): void => {
        currentHealthSnapshot = {
            ...currentHealthSnapshot,
            heartbeatRateLimited:
                currentHealthSnapshot.heartbeatRateLimited + 1,
        };
    };
    const incrementHeartbeatAccepted = (): void => {
        currentHealthSnapshot = {
            ...currentHealthSnapshot,
            heartbeatAccepted: currentHealthSnapshot.heartbeatAccepted + 1,
        };
    };
    const incrementActiveSockets = (): void => {
        currentHealthSnapshot = {
            ...currentHealthSnapshot,
            activeSockets: currentHealthSnapshot.activeSockets + 1,
        };
    };
    const decrementActiveSockets = (): void => {
        currentHealthSnapshot = {
            ...currentHealthSnapshot,
            activeSockets: Math.max(0, currentHealthSnapshot.activeSockets - 1),
        };
    };
    const incrementAdminSockets = (): void => {
        currentHealthSnapshot = {
            ...currentHealthSnapshot,
            adminSockets: currentHealthSnapshot.adminSockets + 1,
        };
    };
    const decrementAdminSockets = (): void => {
        currentHealthSnapshot = {
            ...currentHealthSnapshot,
            adminSockets: Math.max(0, currentHealthSnapshot.adminSockets - 1),
        };
    };
    const incrementOnlineComputers = (): void => {
        currentHealthSnapshot = {
            ...currentHealthSnapshot,
            onlineComputers: currentHealthSnapshot.onlineComputers + 1,
        };
    };
    const decrementOnlineComputers = (): void => {
        currentHealthSnapshot = {
            ...currentHealthSnapshot,
            onlineComputers: Math.max(0, currentHealthSnapshot.onlineComputers - 1),
        };
    };
    const incrementHeartbeatTimeouts = (): void => {
        currentHealthSnapshot = {
            ...currentHealthSnapshot,
            heartbeatTimeouts: currentHealthSnapshot.heartbeatTimeouts + 1,
        };
    };

    const realtimeGateway = createRealtimeGateway(io);
    const heartbeatRateLimiter = createInMemoryRealtimeHeartbeatRateLimiter();
    registerRealtimeAuthenticationMiddleware(io, incrementAuthFailures);
    registerRealtimeHandlers(
        io,
        realtimeGateway,
        heartbeatRateLimiter,
        incrementHeartbeatRateLimited,
        incrementHeartbeatAccepted,
        incrementActiveSockets,
        decrementActiveSockets,
        incrementAdminSockets,
        decrementAdminSockets,
        incrementOnlineComputers,
        decrementOnlineComputers
    );
    realtimePresenceStore.setHeartbeatTimeoutListener((transition) => {
        decrementOnlineComputers();
        incrementHeartbeatTimeouts();
        realtimeLoggingService.logComputerOffline(
            buildRealtimeComputerOfflineLogInput({
                tenantId: transition.tenantId,
                computerId: transition.computerId,
                connectedSocketCount: transition.connectedSocketCount,
                reason: "presence_transition_offline_timeout",
            })
        );
        realtimeGateway.emitComputerOffline(
            transition.tenantId,
            transition.computerId
        );
    });

    let isClosed = false;

    return {
        getGateway: (): RealtimeGatewayPublicApi => realtimeGateway,
        close: async (): Promise<void> => {
            if (isClosed) {
                return;
            }

            realtimePresenceStore.setHeartbeatTimeoutListener(undefined);
            realtimePresenceStore.clearAllOfflineTimers();

            await new Promise<void>((resolve, reject) => {
                io.close((error?: Error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });

            isClosed = true;
            currentHealthSnapshot = { ...EMPTY_REALTIME_HEALTH_SNAPSHOT };
        },
        getRealtimeHealthSnapshot: (): RealtimeHealthSnapshot =>
            getRealtimeHealthSnapshot(currentHealthSnapshot),
        getHealthSnapshot: (): RealtimeHealthSnapshot =>
            getRealtimeHealthSnapshot(currentHealthSnapshot),
    };
};

