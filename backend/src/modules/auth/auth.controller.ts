import type { NextFunction, Request, Response } from "express";
import { authService } from "./auth.service";
import type {
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterTenantInput,
  VerifyRegisterTenantInput,
} from "./auth.types";

export class AuthController {
  public async registerTenant(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const input = request.body as RegisterTenantInput;
      const data = await authService.registerTenant(input, {
        requestId: request.requestId,
        ip: request.ip,
        userAgent: request.get("user-agent"),
      });

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async verifyTenantRegistration(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const input = request.body as VerifyRegisterTenantInput;
      const data = await authService.verifyTenantRegistration(input, {
        requestId: request.requestId,
        ip: request.ip,
        userAgent: request.get("user-agent"),
      });

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async login(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const input = request.body as LoginInput;
      const data = await authService.login(input, {
        requestId: request.requestId,
        ip: request.ip,
        userAgent: request.get("user-agent"),
      });

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async refresh(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const input = request.body as RefreshInput;
      const data = await authService.refresh(input, {
        requestId: request.requestId,
        ip: request.ip,
        userAgent: request.get("user-agent"),
      });

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async logout(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const input = request.body as LogoutInput;
      const data = await authService.logout(input, {
        requestId: request.requestId,
        ip: request.ip,
        userAgent: request.get("user-agent"),
      });

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async me(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const data = await authService.getCurrentUser({
        requestId: request.requestId,
        ip: request.ip,
        userAgent: request.get("user-agent"),
        authContext: request.authContext,
      });

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
