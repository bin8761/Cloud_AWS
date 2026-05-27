import { Router } from "express";
import { authRequired } from "../auth/auth.middleware";
import { requireRole, requireTenantUser } from "../auth/auth.rbac";
import { validateRequest } from "../../shared/validation/validate-request";
import { sessionsController } from "./sessions.controller";
import { startSessionSchema, endSessionSchema } from "./sessions.schema";

export const sessionsRouter = Router();

// Bắt đầu phiên chơi
sessionsRouter.post(
  "/start",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({ body: startSessionSchema }),
  (request, response, next) =>
    void sessionsController.startSession(request, response, next),
);

// Kết thúc phiên chơi
sessionsRouter.post(
  "/end",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({ body: endSessionSchema }),
  (request, response, next) =>
    void sessionsController.endSession(request, response, next),
);

// Lấy danh sách phiên đang active
sessionsRouter.get(
  "/active",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  (request, response, next) =>
    void sessionsController.getActiveSessions(request, response, next),
);