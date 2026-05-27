/**
 * Realtime rate-limit internals.
 * Not exported through `realtime/index.ts`.
 */
import {
    REALTIME_HEARTBEAT_RATE_LIMIT_CAPACITY,
    REALTIME_HEARTBEAT_RATE_LIMIT_REFILL_TOKENS,
    REALTIME_HEARTBEAT_RATE_LIMIT_REFILL_WINDOW_SECONDS,
} from "./realtime.events";

type TokenBucketState = {
    tokens: number;
    lastRefillAtMs: number;
};

export type HeartbeatRateLimitConsumeResult = {
    accepted: boolean;
    tokensRemaining: number;
};

export type RealtimeHeartbeatRateLimiter = {
    consume: (
        computerId: string,
        nowMs?: number
    ) => HeartbeatRateLimitConsumeResult;
};

export class InMemoryRealtimeHeartbeatRateLimiter
    implements RealtimeHeartbeatRateLimiter
{
    private readonly bucketByComputerId = new Map<string, TokenBucketState>();
    private readonly capacity = REALTIME_HEARTBEAT_RATE_LIMIT_CAPACITY;
    private readonly refillTokens = REALTIME_HEARTBEAT_RATE_LIMIT_REFILL_TOKENS;
    private readonly refillWindowMs =
        REALTIME_HEARTBEAT_RATE_LIMIT_REFILL_WINDOW_SECONDS * 1000;

    public consume(computerId: string, nowMs: number = Date.now()): HeartbeatRateLimitConsumeResult {
        const currentBucket = this.resolveBucketState(computerId, nowMs);
        if (currentBucket.tokens <= 0) {
            this.bucketByComputerId.set(computerId, currentBucket);
            return {
                accepted: false,
                tokensRemaining: 0,
            };
        }

        const nextBucket: TokenBucketState = {
            tokens: currentBucket.tokens - 1,
            lastRefillAtMs: currentBucket.lastRefillAtMs,
        };
        this.bucketByComputerId.set(computerId, nextBucket);

        return {
            accepted: true,
            tokensRemaining: nextBucket.tokens,
        };
    }

    private resolveBucketState(computerId: string, nowMs: number): TokenBucketState {
        const existingBucket = this.bucketByComputerId.get(computerId);
        if (!existingBucket) {
            return {
                tokens: this.capacity,
                lastRefillAtMs: nowMs,
            };
        }

        const elapsedMs = nowMs - existingBucket.lastRefillAtMs;
        const elapsedWindows = Math.floor(elapsedMs / this.refillWindowMs);
        if (elapsedWindows <= 0) {
            return existingBucket;
        }

        return {
            tokens: Math.min(
                existingBucket.tokens + elapsedWindows * this.refillTokens,
                this.capacity
            ),
            lastRefillAtMs:
                existingBucket.lastRefillAtMs + elapsedWindows * this.refillWindowMs,
        };
    }
}

export const createInMemoryRealtimeHeartbeatRateLimiter =
    (): RealtimeHeartbeatRateLimiter =>
        new InMemoryRealtimeHeartbeatRateLimiter();

