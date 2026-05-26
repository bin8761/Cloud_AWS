import { Router } from "express";

import { authRequired } from "../auth/auth.middleware";
import { requireRole, requireTenantUser } from "../auth/auth.rbac";
import { validateRequest } from "../../shared/validation/validate-request";
import { uploadLockscreenMiddleware } from "../../shared/middleware/upload.middleware";
import { assetsController } from "./assets.controller";
import { assetIdParamsSchema, updateAssetActiveSchema } from "./assets.schema";

export const assetsRouter = Router();

assetsRouter.post(
  "/upload",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  uploadLockscreenMiddleware.single("image"),
  (request, response, next) => void assetsController.upload(request, response, next),
);

assetsRouter.get(
  "/",
  authRequired,
  requireRole("shop_admin", "staff"),
  requireTenantUser,
  (request, response, next) => void assetsController.list(request, response, next),
);

assetsRouter.patch(
  "/:id/active",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    params: assetIdParamsSchema,
    body: updateAssetActiveSchema,
  }),
  (request, response, next) => void assetsController.updateActive(request, response, next),
);

assetsRouter.delete(
  "/:id",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    params: assetIdParamsSchema,
  }),
  (request, response, next) => void assetsController.delete(request, response, next),
);
