import { RateLimitBucketState, RateLimitStore } from "./rate-limit.store";

type InMemoryRateLimitStoreOptions = {
  staleAfterMs?: number;
  cleanupEveryOperations?: number;
};

const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000;
const DEFAULT_CLEANUP_EVERY_OPERATIONS = 100;

const isBucketStale = (state: RateLimitBucketState, nowMs: number, staleAfterMs: number): boolean => {
  return nowMs - state.lastRefillAtMs > staleAfterMs;
};

export const createInMemoryRateLimitStore = (
  options?: InMemoryRateLimitStoreOptions,
): RateLimitStore => {
  const bucketStates = new Map<string, RateLimitBucketState>();
  const staleAfterMs = options?.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const cleanupEveryOperations =
    options?.cleanupEveryOperations ?? DEFAULT_CLEANUP_EVERY_OPERATIONS;

  let operationCount = 0;

  const cleanupStaleBuckets = (nowMs: number): void => {
    for (const [key, state] of bucketStates.entries()) {
      if (isBucketStale(state, nowMs, staleAfterMs)) {
        bucketStates.delete(key);
      }
    }
  };

  const runPeriodicCleanup = (): void => {
    operationCount += 1;

    if (operationCount % cleanupEveryOperations !== 0) {
      return;
    }

    cleanupStaleBuckets(Date.now());
  };

  return {
    get(key: string): RateLimitBucketState | undefined {
      runPeriodicCleanup();

      const state = bucketStates.get(key);
      if (!state) {
        return undefined;
      }

      if (isBucketStale(state, Date.now(), staleAfterMs)) {
        bucketStates.delete(key);
        return undefined;
      }

      return state;
    },
    set(key: string, state: RateLimitBucketState): void {
      runPeriodicCleanup();
      bucketStates.set(key, state);
    },
    delete(key: string): void {
      bucketStates.delete(key);
    },
  };
};
