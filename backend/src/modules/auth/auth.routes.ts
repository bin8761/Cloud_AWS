import { Router } from "express";
import { validateRequest } from "../../shared/validation/validate-request";
import { authController } from "./auth.controller";
import { authRequired } from "./auth.middleware";
import {
  loginRateLimitMiddleware,
  logoutRateLimitMiddleware,
  refreshRateLimitMiddleware,
  registerTenantRateLimitMiddleware,
  registerTenantVerifyRateLimitMiddleware,
} from "./auth.rate-limit";
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerTenantSchema,
  verifyTenantRegistrationSchema,
} from "./auth.schema";

export const authRouter = Router();

authRouter.post(
  "/register-tenant",
  registerTenantRateLimitMiddleware,
  validateRequest({
    body: registerTenantSchema,
  }),
  (request, response, next) =>
    void authController.registerTenant(request, response, next),
);

authRouter.post(
  "/register-tenant/verify",
  registerTenantVerifyRateLimitMiddleware,
  validateRequest({
    body: verifyTenantRegistrationSchema,
  }),
  (request, response, next) =>
    void authController.verifyTenantRegistration(request, response, next),
);

authRouter.post(
  "/login",
  loginRateLimitMiddleware,
  validateRequest({
    body: loginSchema,
  }),
  (request, response, next) => void authController.login(request, response, next),
);

authRouter.post(
  "/refresh",
  refreshRateLimitMiddleware,
  validateRequest({
    body: refreshSchema,
  }),
  (request, response, next) => void authController.refresh(request, response, next),
);

authRouter.post(
  "/logout",
  logoutRateLimitMiddleware,
  validateRequest({
    body: logoutSchema,
  }),
  (request, response, next) => void authController.logout(request, response, next),
);

authRouter.get("/me", authRequired, (request, response, next) =>
  void authController.me(request, response, next),
);
