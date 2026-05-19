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
        req.body = schemas.body.parse(req.body);
      }

      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }

      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
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
