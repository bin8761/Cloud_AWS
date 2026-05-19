import type { ErrorRequestHandler } from "express";
import { AppError } from "./app-error";

const INTERNAL_ERROR_CODE = "INTERNAL_ERROR" as const;
const INTERNAL_ERROR_MESSAGE = "Internal server error";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  const isProduction = process.env.NODE_ENV === "production";
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
