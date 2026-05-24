import { describe, expect, it } from "vitest";
import { AppError } from "../../src/shared/errors/app-error";

describe("Foundation AppError", () => {
  it("stores statusCode, code, message, and details", () => {
    const error = new AppError(400, "VALIDATION_ERROR", "Invalid request data", {
      field: "email",
    });

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Invalid request data");
    expect(error.details).toEqual({ field: "email" });
  });
});

