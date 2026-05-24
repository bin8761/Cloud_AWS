import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../../src/shared/errors/error-handler";

describe("Foundation JSON body limit behavior", () => {
  it("rejects oversized JSON payload", async () => {
    const app = express();
    app.use(
      express.json({
        limit: "8b",
      }),
    );

    app.post("/limited", (_req, res) => {
      res.status(200).json({ success: true, data: { ok: true } });
    });
    app.use(errorHandler);

    const response = await request(app).post("/limited").send({
      message: "this payload is definitely larger than 8 bytes",
    });

    expect(response.status).toBe(413);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

