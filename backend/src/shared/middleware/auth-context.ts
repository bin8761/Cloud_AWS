import type { RequestHandler } from "express";

export type AuthRole = "super_admin" | "shop_admin" | "staff";
export type AuthTokenType = "access";

export type AuthContext = {
  userId?: string;
  tenantId?: string | null;
  role?: AuthRole;
  tokenType?: AuthTokenType;
  computerId?: string;
  requestId?: string;
};

export const authContextMiddleware: RequestHandler = (req, _res, next) => {
  // Placeholder phase for public routes:
  // keep requests unauthenticated by default and never infer auth context
  // from headers/body until authRequired JWT validation is implemented.
  req.authContext = undefined;
  next();
};
