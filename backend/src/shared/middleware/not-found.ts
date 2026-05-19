import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(
    new AppError(404, "NOT_FOUND", "Route not found", {
      method: req.method,
      path: req.originalUrl ?? req.url,
    }),
  );
};
