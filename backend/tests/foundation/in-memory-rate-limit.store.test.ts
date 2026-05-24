import { describe, expect, it } from "vitest";
import { createInMemoryRateLimitStore } from "../../src/shared/rate-limit/in-memory-rate-limit.store";

describe("Foundation in-memory rate-limit store", () => {
  it("cleans up stale buckets when accessed", async () => {
    const store = createInMemoryRateLimitStore({
      staleAfterMs: 5,
      cleanupEveryOperations: 1,
    });

    const key = `stale-${Date.now()}`;
    store.set(key, {
      tokens: 1,
      lastRefillAtMs: Date.now() - 10,
    });

    // Trigger periodic cleanup and stale check.
    const state = store.get(key);
    expect(state).toBeUndefined();
  });
});

