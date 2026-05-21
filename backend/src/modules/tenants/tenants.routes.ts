import { Router } from "express";
import { validateRequest } from "../../shared/validation/validate-request";
import { authRequired } from "../auth/auth.middleware";
import { requireRole, requireTenantUser } from "../auth/auth.rbac";
import { tenantsController } from "./tenants.controller";
import {
  listTenantsQuerySchema,
  tenantIdParamsSchema,
  updateCurrentTenantSchema,
  updateTenantByIdSchema,
} from "./tenants.schema";

export const tenantsRouter = Router();

tenantsRouter.get(
  "/me",
  authRequired,
  requireRole("shop_admin", "staff"),
  requireTenantUser,
  (request, response, next) =>
    void tenantsController.getCurrentTenant(request, response, next),
);

tenantsRouter.patch(
  "/me",
  authRequired,
  validateRequest({
    body: updateCurrentTenantSchema,
  }),
  requireRole("shop_admin"),
  requireTenantUser,
  (request, response, next) =>
    void tenantsController.updateCurrentTenant(request, response, next),
);

tenantsRouter.get(
  "/",
  authRequired,
  validateRequest({
    query: listTenantsQuerySchema,
  }),
  requireRole("super_admin"),
  (request, response, next) =>
    void tenantsController.listTenants(request, response, next),
);

tenantsRouter.get(
  "/:id",
  authRequired,
  requireRole("super_admin"),
  validateRequest({
    params: tenantIdParamsSchema,
  }),
  (request, response, next) =>
    void tenantsController.getTenantById(request, response, next),
);

tenantsRouter.patch(
  "/:id",
  authRequired,
  requireRole("super_admin"),
  validateRequest({
    params: tenantIdParamsSchema,
    body: updateTenantByIdSchema,
  }),
  (request, response, next) =>
    void tenantsController.updateTenantById(request, response, next),
);
