import type { RequestHandler } from "express";

export type AuthContext = {
  tenantId?: string;
  userId?: string;
  computerId?: string;
};

export const authContextMiddleware: RequestHandler = (req, _res, next) => {
  // Foundation phase intentionally provides placeholder context only.
  // Real JWT verification, RBAC checks, and device-token validation are
  // implemented by later modules.
  req.authContext = {};
  next();
};
