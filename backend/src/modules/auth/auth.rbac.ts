import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error";
import type { AuthRole } from "../../shared/middleware/auth-context";

const FORBIDDEN_MESSAGE = "You do not have permission to access this resource.";
const createForbiddenError = () => new AppError(403, "FORBIDDEN", FORBIDDEN_MESSAGE);
const hasTenantId = (tenantId: unknown): tenantId is string =>
  typeof tenantId === "string" && tenantId.trim().length > 0;

export const hasAnyRole = (
  userRoles: readonly AuthRole[],
  allowedRoles: readonly AuthRole[],
): boolean => {
  return userRoles.some((role) => allowedRoles.includes(role));
};

export const requireRole = (...roles: AuthRole[]): RequestHandler => {
  const allowedRoles = [...roles];

  return (req, _res, next) => {
    const currentRole = req.authContext?.role;

    if (!currentRole) {
      next(createForbiddenError());
      return;
    }

    const isRoleAllowed = hasAnyRole([currentRole], allowedRoles);
    if (!isRoleAllowed) {
      next(createForbiddenError());
      return;
    }

    next();
  };
};

export const requireTenantUser: RequestHandler = (req, _res, next) => {
  const tenantId = req.authContext?.tenantId;

  if (!hasTenantId(tenantId)) {
    next(createForbiddenError());
    return;
  }

  next();
};
