import { Router } from "express";
import { validateRequest } from "../../shared/validation/validate-request";
import { authRequired } from "../auth/auth.middleware";
import { requireRole, requireTenantUser } from "../auth/auth.rbac";
import { usersController } from "./users.controller";
import {
  createStaffUserSchema,
  listStaffUsersQuerySchema,
  staffUserIdParamsSchema,
  updateStaffUserSchema,
} from "./users.schema";

export const usersRouter = Router();

usersRouter.post(
  "/",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    body: createStaffUserSchema,
  }),
  usersController.createStaffUser.bind(usersController),
);
usersRouter.get(
  "/",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    query: listStaffUsersQuerySchema,
  }),
  usersController.listStaffUsers.bind(usersController),
);
usersRouter.get(
  "/:id",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    params: staffUserIdParamsSchema,
  }),
  usersController.getStaffUserById.bind(usersController),
);
usersRouter.patch(
  "/:id",
  authRequired,
  requireRole("shop_admin"),
  requireTenantUser,
  validateRequest({
    params: staffUserIdParamsSchema,
    body: updateStaffUserSchema,
  }),
  usersController.updateStaffUserById.bind(usersController),
);
