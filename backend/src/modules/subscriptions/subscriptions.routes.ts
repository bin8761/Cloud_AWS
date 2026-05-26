import { Router } from "express";

import { authRequired } from "../auth/auth.middleware";
import { requireRole, requireTenantUser } from "../auth/auth.rbac";
import { validateRequest } from "../../shared/validation/validate-request";
import { subscriptionsController } from "./subscriptions.controller";
import {
  createSubscriptionSchema,
  subscriptionIdParamsSchema,
  updateSubscriptionSchema,
} from "./subscriptions.schema";

export const subscriptionsRouter = Router();

subscriptionsRouter.get(
  "/me",
  authRequired,
  requireRole("shop_admin", "staff"),
  requireTenantUser,
  (request, response, next) => void subscriptionsController.me(request, response, next),
);

subscriptionsRouter.post(
  "/",
  authRequired,
  requireRole("super_admin"),
  validateRequest({
    body: createSubscriptionSchema,
  }),
  (request, response, next) => void subscriptionsController.create(request, response, next),
);

subscriptionsRouter.patch(
  "/:id",
  authRequired,
  requireRole("super_admin"),
  validateRequest({
    params: subscriptionIdParamsSchema,
    body: updateSubscriptionSchema,
  }),
  (request, response, next) => void subscriptionsController.update(request, response, next),
);
