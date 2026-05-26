/**
 * Realtime presence internals.
 * Not exported through `realtime/index.ts`.
 */
import type { RealtimeComputerPresence } from "./realtime.types";
import { ComputerStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma/prisma.client";
import {
    REALTIME_HEARTBEAT_TIMEOUT_SECONDS,
    REALTIME_LAST_SEEN_UPDATE_THROTTLE_SECONDS,
} from "./realtime.events";

type RealtimeSocketPresenceContext = {
    clientType: "computer";
    computerId: string;
    tenantId: string;
};

export type AddComputerSocketResult = {
    transitionedToOnline: boolean;
    computerId: string;
    tenantId: string;
    connectedSocketCount: number;
    lastSeenPersisted: boolean;
};

export type RemoveComputerSocketResult = {
    transitionedToOffline: boolean;
    computerId?: string;
    tenantId?: string;
    connectedSocketCount: number;
};

export type RealtimeTenantPresenceSnapshot = {
    tenantId: string;
    onlineComputerIds: string[];
};

export type RecordHeartbeatResult = {
    found: boolean;
    computerId: string;
    tenantId?: string;
    lastHeartbeatAt?: Date;
    lastSeenPersisted?: boolean;
};

export type HeartbeatTimeoutOfflineTransition = {
    computerId: string;
    tenantId: string;
    connectedSocketCount: 0;
};

export class RealtimePresenceStore {
    private readonly computerPresenceById = new Map<string, RealtimeComputerPresence>();
    private readonly socketContextById = new Map<string, RealtimeSocketPresenceContext>();
    private readonly heartbeatTimeoutMs = REALTIME_HEARTBEAT_TIMEOUT_SECONDS * 1000;
    private readonly lastSeenUpdateThrottleMs =
        REALTIME_LAST_SEEN_UPDATE_THROTTLE_SECONDS * 1000;
    private heartbeatTimeoutListener?: (
        transition: HeartbeatTimeoutOfflineTransition
    ) => void;

    public setHeartbeatTimeoutListener(
        listener:
            | ((transition: HeartbeatTimeoutOfflineTransition) => void)
            | undefined
    ): void {
        this.heartbeatTimeoutListener = listener;
    }

    public async addComputerSocket(
        socketId: string,
        computerId: string,
        tenantId: string
    ): Promise<AddComputerSocketResult> {
        const existingSocketContext = this.socketContextById.get(socketId);
        if (existingSocketContext) {
            this.removeComputerSocket(socketId);
        }

        const currentTime = new Date();
        const existingPresence = this.computerPresenceById.get(computerId);

        const presence =
            existingPresence ??
            ({
                computerId,
                tenantId,
                socketIds: new Set<string>(),
                lastHeartbeatAt: currentTime,
            } satisfies RealtimeComputerPresence);

        const connectedBeforeAdd = presence.socketIds.size;
        presence.socketIds.add(socketId);

        if (presence.lastHeartbeatAt.getTime() < currentTime.getTime()) {
            presence.lastHeartbeatAt = currentTime;
        }

        this.computerPresenceById.set(computerId, presence);
        this.socketContextById.set(socketId, {
            clientType: "computer",
            computerId,
            tenantId,
        });
        this.scheduleHeartbeatTimeout(presence);

        const transitionedToOnline = connectedBeforeAdd === 0;
        const lastSeenPersisted = await this.persistLastSeenAtIfNeeded({
            computerId,
            tenantId,
            now: currentTime,
            force: transitionedToOnline,
        });

        return {
            transitionedToOnline,
            computerId,
            tenantId,
            connectedSocketCount: presence.socketIds.size,
            lastSeenPersisted,
        };
    }

    public removeComputerSocket(socketId: string): RemoveComputerSocketResult {
        const socketContext = this.socketContextById.get(socketId);
        if (!socketContext) {
            return {
                transitionedToOffline: false,
                connectedSocketCount: 0,
            };
        }

        this.socketContextById.delete(socketId);

        const presence = this.computerPresenceById.get(socketContext.computerId);
        if (!presence) {
            return {
                transitionedToOffline: false,
                computerId: socketContext.computerId,
                tenantId: socketContext.tenantId,
                connectedSocketCount: 0,
            };
        }

        presence.socketIds.delete(socketId);

        const connectedSocketCount = presence.socketIds.size;
        const transitionedToOffline = connectedSocketCount === 0;
        if (transitionedToOffline) {
            this.clearPresenceOfflineTimer(presence);
            this.computerPresenceById.delete(socketContext.computerId);

            return {
                transitionedToOffline,
                computerId: socketContext.computerId,
                tenantId: socketContext.tenantId,
                connectedSocketCount: 0,
            };
        }

        return {
            transitionedToOffline: false,
            computerId: socketContext.computerId,
            tenantId: socketContext.tenantId,
            connectedSocketCount,
        };
    }

    public getPresenceSnapshotForTenant(
        tenantId: string
    ): RealtimeTenantPresenceSnapshot {
        const onlineComputerIds: string[] = [];

        for (const [computerId, presence] of this.computerPresenceById.entries()) {
            if (presence.tenantId !== tenantId) {
                continue;
            }

            if (presence.socketIds.size === 0) {
                continue;
            }

            onlineComputerIds.push(computerId);
        }

        return {
            tenantId,
            onlineComputerIds,
        };
    }

    public async recordHeartbeat(computerId: string): Promise<RecordHeartbeatResult> {
        const presence = this.computerPresenceById.get(computerId);
        if (!presence) {
            return {
                found: false,
                computerId,
            };
        }

        const lastHeartbeatAt = new Date();
        presence.lastHeartbeatAt = lastHeartbeatAt;
        this.scheduleHeartbeatTimeout(presence);
        const lastSeenPersisted = await this.persistLastSeenAtIfNeeded({
            computerId: presence.computerId,
            tenantId: presence.tenantId,
            now: lastHeartbeatAt,
            force: false,
        });

        return {
            found: true,
            computerId,
            tenantId: presence.tenantId,
            lastHeartbeatAt,
            lastSeenPersisted,
        };
    }

    public clearAllOfflineTimers(): number {
        let clearedCount = 0;
        for (const presence of this.computerPresenceById.values()) {
            if (!presence.offlineTimer) {
                continue;
            }

            clearTimeout(presence.offlineTimer);
            presence.offlineTimer = undefined;
            clearedCount += 1;
        }

        return clearedCount;
    }

    private async persistLastSeenAtIfNeeded(input: {
        computerId: string;
        tenantId: string;
        now: Date;
        force: boolean;
    }): Promise<boolean> {
        const presence = this.computerPresenceById.get(input.computerId);
        if (!presence) {
            return false;
        }

        const persistedAt = presence.lastSeenPersistedAt;
        if (!input.force && persistedAt) {
            const elapsedMs = input.now.getTime() - persistedAt.getTime();
            if (elapsedMs < this.lastSeenUpdateThrottleMs) {
                return false;
            }
        }

        const updateResult = await prisma.computer.updateMany({
            where: {
                id: input.computerId,
                tenantId: input.tenantId,
                status: ComputerStatus.ACTIVE,
            },
            data: {
                lastSeenAt: input.now,
            },
        });

        if (updateResult.count !== 1) {
            return false;
        }

        presence.lastSeenPersistedAt = input.now;
        return true;
    }

    private scheduleHeartbeatTimeout(presence: RealtimeComputerPresence): void {
        this.clearPresenceOfflineTimer(presence);

        presence.offlineTimer = setTimeout(() => {
            this.handleHeartbeatTimeout(presence.computerId);
        }, this.heartbeatTimeoutMs);
    }

    private clearPresenceOfflineTimer(presence: RealtimeComputerPresence): void {
        if (!presence.offlineTimer) {
            return;
        }

        clearTimeout(presence.offlineTimer);
        presence.offlineTimer = undefined;
    }

    private handleHeartbeatTimeout(computerId: string): void {
        const presence = this.computerPresenceById.get(computerId);
        if (!presence) {
            return;
        }

        const now = Date.now();
        const elapsedMs = now - presence.lastHeartbeatAt.getTime();
        if (elapsedMs < this.heartbeatTimeoutMs) {
            this.scheduleHeartbeatTimeout(presence);
            return;
        }

        this.clearPresenceOfflineTimer(presence);
        if (presence.socketIds.size === 0) {
            this.computerPresenceById.delete(computerId);
            return;
        }

        const staleSocketIds = Array.from(presence.socketIds);
        for (const socketId of staleSocketIds) {
            const socketContext = this.socketContextById.get(socketId);
            if (socketContext?.computerId !== computerId) {
                continue;
            }

            this.socketContextById.delete(socketId);
        }

        this.computerPresenceById.delete(computerId);
        this.heartbeatTimeoutListener?.({
            computerId: presence.computerId,
            tenantId: presence.tenantId,
            connectedSocketCount: 0,
        });
    }
}

export const realtimePresenceStore = new RealtimePresenceStore();

