import { Router } from "express";
import { healthController } from "./health.controller";

export const healthRouter = Router();

healthRouter.get("/health", (request, response) =>
  healthController.getAppHealth(request, response),
);

healthRouter.get("/api/health/db", (request, response, next) =>
  healthController.getDatabaseHealth(request, response, next),
);

healthRouter.get("/api/health/runtime", (request, response) =>
  healthController.getRuntimeHealth(request, response),
);
