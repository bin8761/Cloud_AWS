import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/shared/errors/app-error";
import { errorHandler } from "../../src/shared/errors/error-handler";

describe("Foundation errorHandler", () => {
  afterEach(() => {
    process.env.NODE_ENV = "test";
    vi.restoreAllMocks();
  });

  it("maps AppError to standard error response with statusCode", async () => {
    const app = express();
    app.get("/app-error", (_req, _res, next) => {
      next(new AppError(422, "VALIDATION_ERROR", "Invalid payload", { field: "name" }));
    });
    app.use(errorHandler);

    const response = await request(app).get("/app-error");
    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.message).toBe("Invalid payload");
    expect(response.body.error.details).toEqual({ field: "name" });
  });

  it("maps unknown errors to INTERNAL_ERROR and hides stack in production", async () => {
    process.env.NODE_ENV = "production";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = express();
    app.get("/unknown", () => {
      throw new Error("boom");
    });
    app.use(errorHandler);

    const response = await request(app).get("/unknown");
    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(response.body.error.details).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("keeps useful error details in non-production mode", async () => {
    process.env.NODE_ENV = "development";
    const app = express();
    app.get("/dev-error", () => {
      throw new Error("dev boom");
    });
    app.use(errorHandler);

    const response = await request(app).get("/dev-error");
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(response.body.error.details).toBeDefined();
  });
});
