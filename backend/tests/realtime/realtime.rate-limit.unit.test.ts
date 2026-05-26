import { describe, expect, it } from "vitest";
import { createInMemoryRealtimeHeartbeatRateLimiter } from "../../src/modules/realtime/realtime.rate-limit";

describe("Realtime heartbeat rate-limit unit tests (Task 231-234)", () => {
  it("Task 231: limiter keys by computerId", () => {
    const limiter = createInMemoryRealtimeHeartbeatRateLimiter();
    const now = Date.now();

    limiter.consume("computer-a", now);
    limiter.consume("computer-a", now);
    const computerAThird = limiter.consume("computer-a", now);
    const computerBFirst = limiter.consume("computer-b", now);

    expect(computerAThird.accepted).toBe(true);
    expect(computerAThird.tokensRemaining).toBe(0);
    expect(computerBFirst.accepted).toBe(true);
    expect(computerBFirst.tokensRemaining).toBe(2);
  });

  it("Task 232: accepts three quick heartbeats", () => {
    const limiter = createInMemoryRealtimeHeartbeatRateLimiter();
    const now = Date.now();

    expect(limiter.consume("computer-1", now).accepted).toBe(true);
    expect(limiter.consume("computer-1", now).accepted).toBe(true);
    expect(limiter.consume("computer-1", now).accepted).toBe(true);
  });

  it("Task 233: denies fourth quick heartbeat", () => {
    const limiter = createInMemoryRealtimeHeartbeatRateLimiter();
    const now = Date.now();

    limiter.consume("computer-1", now);
    limiter.consume("computer-1", now);
    limiter.consume("computer-1", now);
    const fourth = limiter.consume("computer-1", now);

    expect(fourth.accepted).toBe(false);
    expect(fourth.tokensRemaining).toBe(0);
  });

  it("Task 234: refill allows later heartbeat after ten seconds", () => {
    const limiter = createInMemoryRealtimeHeartbeatRateLimiter();
    const now = Date.now();

    limiter.consume("computer-1", now);
    limiter.consume("computer-1", now);
    limiter.consume("computer-1", now);
    const denied = limiter.consume("computer-1", now);
    const afterRefill = limiter.consume("computer-1", now + 10_000);

    expect(denied.accepted).toBe(false);
    expect(afterRefill.accepted).toBe(true);
  });
});

