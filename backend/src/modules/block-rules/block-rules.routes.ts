import type { RequestHandler } from "express";
import { Router } from "express";

import { AppError } from "../../shared/errors/app-error";
import { validateRequest } from "../../shared/validation/validate-request";
import { authRequired } from "../auth/auth.middleware";
import { requireRole, requireTenantUser } from "../auth/auth.rbac";
import { blockRulesController } from "./block-rules.controller";
import {
  blockRulesActiveFetchRateLimitMiddleware,
  blockRulesBatchCreateRateLimitMiddleware,
} from "./block-rules.rate-limit";
import {
  batchCreateBlockRulesSchema,
  blockRuleIdParamsSchema,
  createBlockRuleSchema,
  listBlockRulesQuerySchema,
  updateBlockRuleSchema,
} from "./block-rules.schema";
import { blockRulesService } from "./block-rules.service";

export const blockRulesRouter = Router();

const parseBearerDeviceToken = (
  authorizationHeader: string | undefined,
): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token, ...extraParts] = authorizationHeader.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || extraParts.length > 0) {
    return null;
  }

  return token;
};

export const deviceTokenAuth: RequestHandler = (request, _response, next) => {
  const computerIdHeader = request.get("x-computer-id");
  const computerId = computerIdHeader?.trim();
  const deviceToken = parseBearerDeviceToken(request.get("authorization"));

  if (!computerId || !deviceToken) {
    next(new AppError(401, "UNAUTHORIZED", "Device authentication is required."));
    return;
  }

  void blockRulesService
    .authenticateComputerByDeviceToken({
      computerId,
      deviceToken,
    })
    .then((authContext) => {
      request.authContext = authContext;
      next();
    })
    .catch((error: unknown) => {
      next(error);
    });
};

blockRulesRouter.post(
  "/",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    body: createBlockRuleSchema,
  }),
  (request, response, next) =>
    void blockRulesController.createBlockRule(request, response, next),
);

blockRulesRouter.post(
  "/batch",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  blockRulesBatchCreateRateLimitMiddleware,
  validateRequest({
    body: batchCreateBlockRulesSchema,
  }),
  (request, response, next) =>
    void blockRulesController.batchCreateBlockRules(request, response, next),
);

blockRulesRouter.get(
  "/active",
  deviceTokenAuth,
  blockRulesActiveFetchRateLimitMiddleware,
  (request, response, next) =>
    void blockRulesController.getActiveRulesForClient(request, response, next),
);

blockRulesRouter.get(
  "/",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    query: listBlockRulesQuerySchema,
  }),
  (request, response, next) =>
    void blockRulesController.listBlockRules(request, response, next),
);

blockRulesRouter.get(
  "/:id",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    params: blockRuleIdParamsSchema,
  }),
  (request, response, next) =>
    void blockRulesController.getBlockRuleById(request, response, next),
);

blockRulesRouter.patch(
  "/:id",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    params: blockRuleIdParamsSchema,
    body: updateBlockRuleSchema,
  }),
  (request, response, next) =>
    void blockRulesController.updateBlockRuleById(request, response, next),
);

blockRulesRouter.delete(
  "/:id",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    params: blockRuleIdParamsSchema,
  }),
  (request, response, next) =>
    void blockRulesController.deleteBlockRuleById(request, response, next),
);
