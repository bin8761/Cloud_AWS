import type { RequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "../errors/app-error";

type ValidateRequestSchema = {
  parse: (input: unknown) => unknown;
};

type ValidateRequestSchemas = {
  body?: ValidateRequestSchema;
  query?: ValidateRequestSchema;
  params?: ValidateRequestSchema;
};

type RequestSegmentKey = "body" | "query" | "params";

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const replaceObjectRecordContents = (
  target: Record<string, unknown>,
  nextValue: Record<string, unknown>,
): void => {
  for (const key of Object.keys(target)) {
    delete target[key];
  }

  Object.assign(target, nextValue);
};

const assignValidatedSegment = (
  req: {
    body: unknown;
    query: unknown;
    params: unknown;
  },
  key: RequestSegmentKey,
  parsedValue: unknown,
): void => {
  try {
    req[key] = parsedValue;
    return;
  } catch (error: unknown) {
    if (!(error instanceof TypeError)) {
      throw error;
    }
  }

  try {
    Object.defineProperty(req, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: parsedValue,
    });
    return;
  } catch (error: unknown) {
    if (!(error instanceof TypeError)) {
      throw error;
    }
  }

  const currentValue = req[key];
  if (!isObjectRecord(currentValue) || !isObjectRecord(parsedValue)) {
    throw new TypeError(`Cannot assign validated request ${key}.`);
  }

  replaceObjectRecordContents(currentValue, parsedValue);
};

const buildSafeValidationDetails = (error: ZodError) => {
  return {
    issues: error.issues.map((issue) => ({
      code: issue.code,
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
};

export const validateRequest = (schemas: ValidateRequestSchemas): RequestHandler => {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        assignValidatedSegment(req, "body", schemas.body.parse(req.body));
      }

      if (schemas.query) {
        assignValidatedSegment(
          req,
          "query",
          schemas.query.parse(req.query) as typeof req.query,
        );
      }

      if (schemas.params) {
        assignValidatedSegment(
          req,
          "params",
          schemas.params.parse(req.params) as typeof req.params,
        );
      }

      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        next(
          new AppError(400, "VALIDATION_ERROR", "Invalid request data", {
            validation: buildSafeValidationDetails(error),
          }),
        );
        return;
      }

      next(error);
    }
  };
};
