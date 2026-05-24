import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../../src/shared/errors/error-handler";
import { createInMemoryRateLimitStore } from "../../src/shared/rate-limit/in-memory-rate-limit.store";
import { createRateLimitMiddleware } from "../../src/shared/rate-limit/rate-limit.middleware";

describe("Foundation rate-limit middleware", () => {
  it("returns standard error response when rate limit is exceeded", async () => {
    const app = express();
    const store = createInMemoryRateLimitStore({
      staleAfterMs: 60_000,
      cleanupEveryOperations: 1,
    });

    app.get(
      "/limited",
      createRateLimitMiddleware({
        store,
        capacity: 1,
        refillTokens: 1,
        refillWindowSeconds: 3_600,
      }),
      (_req, res) => {
        res.status(200).json({ success: true, data: { ok: true } });
      },
    );
    app.use(errorHandler);

    const first = await request(app).get("/limited");
    const second = await request(app).get("/limited");

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.body.success).toBe(false);
    expect(second.body.error.code).toBe("TOO_MANY_REQUESTS");
  });
});

