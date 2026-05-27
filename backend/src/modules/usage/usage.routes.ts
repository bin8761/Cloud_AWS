import { Router } from "express";
import { authRequired } from "../auth/auth.middleware";
import { requireRole, requireTenantUser } from "../auth/auth.rbac";
import { usageController } from "./usage.controller";

export const usageRouter = Router();

// Dashboard doanh thu (7/14/30 ngày)
usageRouter.get(
  "/dashboard",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  (request, response, next) =>
    void usageController.getDashboard(request, response, next),
);

// Lịch sử phiên chơi có pagination
usageRouter.get(
  "/sessions",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  (request, response, next) =>
    void usageController.getRecentSessions(request, response, next),
);