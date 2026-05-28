import { describe, expect, it, vi } from "vitest";
import {
  handleUnauthorizedStatus,
  normalizeFoundationErrorEnvelope,
  parseFoundationSuccessEnvelope,
  registerAccessTokenGetter,
  registerAuthClearCallback,
  registerRealtimeDisconnectCallback,
  withAuthorizationHeader,
} from "./apiClient";

describe("apiClient authorization header", () => {
  it("omits Authorization when token does not exist", () => {
    registerAccessTokenGetter(() => null);
    const headers = withAuthorizationHeader();

    expect(headers.has("Authorization")).toBe(false);
  });

  it("attaches Authorization when token exists", () => {
    registerAccessTokenGetter(() => "access-token-123");
    const headers = withAuthorizationHeader();

    expect(headers.get("Authorization")).toBe("Bearer access-token-123");
  });
});

describe("foundation envelope parsing", () => {
  it("parses success envelope data", () => {
    const parsed = parseFoundationSuccessEnvelope<{ id: string }>({
      success: true,
      data: { id: "computer-1" },
    });

    expect(parsed).toEqual({ id: "computer-1" });
  });

  it("normalizes 401 error envelope and triggers callbacks", () => {
    const clearCallback = vi.fn();
    const disconnectCallback = vi.fn();
    registerAuthClearCallback(clearCallback);
    registerRealtimeDisconnectCallback(disconnectCallback);
    handleUnauthorizedStatus(401);

    const normalized = normalizeFoundationErrorEnvelope(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication is required.",
        },
      },
      401,
    );

    expect(normalized).toEqual({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Authentication is required.",
    });
    expect(clearCallback).toHaveBeenCalledTimes(1);
    expect(disconnectCallback).toHaveBeenCalledTimes(1);
  });

  it("normalizes 403 error envelope", () => {
    const normalized = normalizeFoundationErrorEnvelope(
      {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Forbidden.",
        },
      },
      403,
    );

    expect(normalized).toEqual({
      status: 403,
      code: "FORBIDDEN",
      message: "Forbidden.",
    });
  });

  it("normalizes 404 error envelope", () => {
    const normalized = normalizeFoundationErrorEnvelope(
      {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Not found.",
        },
      },
      404,
    );

    expect(normalized).toEqual({
      status: 404,
      code: "NOT_FOUND",
      message: "Not found.",
    });
  });

  it("normalizes 409 error envelope", () => {
    const normalized = normalizeFoundationErrorEnvelope(
      {
        success: false,
        error: {
          code: "CONFLICT",
          message: "Conflict.",
        },
      },
      409,
    );

    expect(normalized).toEqual({
      status: 409,
      code: "CONFLICT",
      message: "Conflict.",
    });
  });

  it("normalizes 429 error envelope", () => {
    const normalized = normalizeFoundationErrorEnvelope(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests.",
        },
      },
      429,
    );

    expect(normalized).toEqual({
      status: 429,
      code: "RATE_LIMITED",
      message: "Too many requests.",
    });
  });

  it("normalizes 500 error envelope", () => {
    const normalized = normalizeFoundationErrorEnvelope(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error.",
        },
      },
      500,
    );

    expect(normalized).toEqual({
      status: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error.",
    });
  });
});
