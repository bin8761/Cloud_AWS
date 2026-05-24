import { Router } from "express";

import { authRequired } from "../auth/auth.middleware";
import { requireRole, requireTenantUser } from "../auth/auth.rbac";
import { validateRequest } from "../../shared/validation/validate-request";
import { computersController } from "./computers.controller";
import { registerComputerRateLimitMiddleware } from "./computers.rate-limit";
import {
  computerIdParamsSchema,
  listComputersQuerySchema,
  reissueDeviceTokenSchema,
  registerComputerSchema,
  updateComputerSchema,
} from "./computers.schema";

export const computersRouter = Router();

computersRouter.post(
  "/register",
  registerComputerRateLimitMiddleware,
  validateRequest({
    body: registerComputerSchema,
  }),
  (request, response, next) =>
    void computersController.registerComputer(request, response, next),
);

computersRouter.get(
  "/",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    query: listComputersQuerySchema,
  }),
  (request, response, next) =>
    void computersController.listComputers(request, response, next),
);

computersRouter.get(
  "/:id",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    params: computerIdParamsSchema,
  }),
  (request, response, next) =>
    void computersController.getComputerById(request, response, next),
);

computersRouter.patch(
  "/:id",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    params: computerIdParamsSchema,
    body: updateComputerSchema,
  }),
  (request, response, next) =>
    void computersController.updateComputerById(request, response, next),
);

computersRouter.post(
  "/:id/reissue-token",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    params: computerIdParamsSchema,
    body: reissueDeviceTokenSchema,
  }),
  (request, response, next) =>
    void computersController.reissueDeviceToken(request, response, next),
);
