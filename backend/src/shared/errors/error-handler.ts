import type { ErrorRequestHandler } from "express";
import { AppError } from "./app-error";

const INTERNAL_ERROR_CODE = "INTERNAL_ERROR" as const;
const INTERNAL_ERROR_MESSAGE = "Internal server error";
const STACK_DETAIL_KEYS = new Set(["stack", "stacktrace"]);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const stripStackTraceFields = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => stripStackTraceFields(entry));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.replace(/[_-]/g, "").toLowerCase();
    if (STACK_DETAIL_KEYS.has(normalizedKey)) {
      continue;
    }

    sanitized[key] = stripStackTraceFields(nestedValue);
  }

  return sanitized;
};

const sanitizeErrorDetailsForProduction = (
  details: Record<string, unknown> | undefined,
  isProduction: boolean,
): Record<string, unknown> | undefined => {
  if (!details) {
    return undefined;
  }

  if (!isProduction) {
    return details;
  }

  const sanitized = stripStackTraceFields(details);
  if (!isPlainObject(sanitized)) {
    return undefined;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const isProduction = process.env.NODE_ENV === "production";

  if (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    (err as { type?: unknown }).type === "entity.too.large"
  ) {
    return res.status(413).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request payload too large",
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: sanitizeErrorDetailsForProduction(err.details, isProduction),
      },
    });
  }

  const requestIdHeader = _req.headers["x-request-id"];
  const requestId =
    typeof requestIdHeader === "string"
      ? requestIdHeader
      : Array.isArray(requestIdHeader)
        ? requestIdHeader[0]
        : undefined;

  console.error("Unexpected error", {
    method: _req.method,
    path: _req.originalUrl ?? _req.url,
    requestId,
    errorName: err instanceof Error ? err.name : "UnknownError",
    errorMessage: err instanceof Error ? err.message : "Unknown error payload",
    stack: err instanceof Error ? err.stack : undefined,
  });

  const details = isProduction
    ? undefined
    : {
        stack: err instanceof Error ? err.stack : undefined,
      };

  return res.status(500).json({
    success: false,
    error: {
      code: INTERNAL_ERROR_CODE,
      message: INTERNAL_ERROR_MESSAGE,
      details,
    },
  });
};
