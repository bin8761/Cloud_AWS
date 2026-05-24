import { describe, expect, it } from "vitest";
import {
  consumeToken,
  getBucketState,
  refillBucketTokens,
  setBucketState,
} from "../../src/shared/rate-limit/token-bucket";

describe("Foundation token bucket primitives", () => {
  it("consumes tokens when available and rejects when empty", () => {
    const key = `bucket-${Date.now()}-consume`;
    setBucketState(key, {
      tokens: 2,
      lastRefillAtMs: Date.now(),
    });

    expect(consumeToken(key)).toBe(true);
    expect(consumeToken(key)).toBe(true);
    expect(consumeToken(key)).toBe(false);
  });

  it("refills by elapsed windows but does not exceed capacity", () => {
    const key = `bucket-${Date.now()}-refill`;
    const now = Date.now();
    setBucketState(key, {
      tokens: 1,
      lastRefillAtMs: now - 61_000,
    });

    const state = refillBucketTokens(
      key,
      {
        capacity: 3,
        refillTokens: 2,
        refillWindowSeconds: 30,
      },
      now,
    );

    expect(state?.tokens).toBe(3);
    expect(getBucketState(key)?.tokens).toBe(3);
  });

  it("keeps separate keys isolated", () => {
    const keyA = `bucket-${Date.now()}-a`;
    const keyB = `bucket-${Date.now()}-b`;
    const now = Date.now();

    setBucketState(keyA, { tokens: 1, lastRefillAtMs: now });
    setBucketState(keyB, { tokens: 2, lastRefillAtMs: now });

    expect(consumeToken(keyA)).toBe(true);
    expect(consumeToken(keyA)).toBe(false);
    expect(consumeToken(keyB)).toBe(true);
    expect(consumeToken(keyB)).toBe(true);
    expect(consumeToken(keyB)).toBe(false);
  });
});
