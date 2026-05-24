import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorHandler } from "../../src/shared/errors/error-handler";
import { validateRequest } from "../../src/shared/validation/validate-request";

describe("Foundation validateRequest middleware", () => {
  it("accepts valid body and rejects invalid body with VALIDATION_ERROR", async () => {
    const app = express();
    app.use(express.json());
    app.post(
      "/body",
      validateRequest({
        body: z.object({
          email: z.string().email(),
        }),
      }),
      (req, res) => {
        res.status(200).json({ success: true, data: req.body });
      },
    );
    app.use(errorHandler);

    const ok = await request(app).post("/body").send({ email: "ok@example.com" });
    const bad = await request(app).post("/body").send({ email: "bad" });

    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts valid query/params and rejects invalid query/params", async () => {
    const app = express();
    app.get(
      "/users/:id",
      validateRequest({
        params: z.object({ id: z.string().uuid() }),
        query: z.object({
          page: z.coerce.number().int().min(1),
        }),
      }),
      (req, res) => {
        res.status(200).json({ success: true, data: { params: req.params, query: req.query } });
      },
    );
    app.use(errorHandler);

    const ok = await request(app).get("/users/550e8400-e29b-41d4-a716-446655440000?page=1");
    const badQuery = await request(app).get(
      "/users/550e8400-e29b-41d4-a716-446655440000?page=0",
    );
    const badParams = await request(app).get("/users/not-a-uuid?page=1");

    expect(ok.status).toBe(200);
    expect(badQuery.status).toBe(400);
    expect(badQuery.body.error.code).toBe("VALIDATION_ERROR");
    expect(badParams.status).toBe(400);
    expect(badParams.body.error.code).toBe("VALIDATION_ERROR");
  });
});

