import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error";
import type { AuthContext, AuthRole } from "../../shared/middleware/auth-context";
import { authTokenService } from "./auth.tokens";

const UNAUTHORIZED_MESSAGE = "Authentication is required.";
const AUTH_ROLES: ReadonlySet<AuthRole> = new Set(["super_admin", "shop_admin", "staff"]);
const createUnauthorizedError = () =>
  new AppError(401, "UNAUTHORIZED", UNAUTHORIZED_MESSAGE);

const parseBearerAccessToken = (
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

const buildVerifiedAuthContext = (claims: Record<string, unknown>): AuthContext | null => {
  const userId = claims.sub;
  const tenantId = claims.tenantId;
  const role = claims.role;
  const tokenType = claims.tokenType;

  if (typeof userId !== "string" || userId.length === 0) {
    return null;
  }

  if (role === undefined || !AUTH_ROLES.has(role as AuthRole)) {
    return null;
  }

  if (tokenType !== "access") {
    return null;
  }

  if (tenantId !== null && (typeof tenantId !== "string" || tenantId.length === 0)) {
    return null;
  }

  return {
    userId,
    tenantId: tenantId ?? null,
    role: role as AuthRole,
    tokenType: "access",
  };
};

export const authRequired: RequestHandler = (req, _res, next) => {
  const accessToken = parseBearerAccessToken(req.get("authorization"));
  if (!accessToken) {
    next(createUnauthorizedError());
    return;
  }

  void authTokenService
    .verifyAccessToken(accessToken)
    .then((claims) => {
      const authContext = buildVerifiedAuthContext(claims);
      if (!authContext) {
        next(createUnauthorizedError());
        return;
      }

      req.authContext = authContext;
      next();
    })
    .catch(() => {
      // Includes invalid, expired, and wrong-token-type access tokens.
      next(createUnauthorizedError());
    });
};
