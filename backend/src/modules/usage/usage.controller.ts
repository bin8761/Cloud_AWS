import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/errors/app-error";
import type { AuthContext } from "../../shared/middleware/auth-context";
import { usageService } from "./usage.service";

const UNAUTHORIZED_STATUS_CODE = 401;
const UNAUTHORIZED_MESSAGE = "Authentication is required.";

const readAuthContextAfterAuthRequired = (request: Request): AuthContext => {
  const authContext = request.authContext;
  if (!authContext) {
    throw new AppError(
      UNAUTHORIZED_STATUS_CODE,
      "UNAUTHORIZED",
      UNAUTHORIZED_MESSAGE,
    );
  }
  return authContext;
};

export class UsageController {
  public async getDashboard(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const days = request.query.days
        ? parseInt(String(request.query.days), 10)
        : 7;

      const data = await usageService.getDashboard(authContext, { days });
      response.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async getRecentSessions(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const page = request.query.page
        ? parseInt(String(request.query.page), 10)
        : 1;
      const pageSize = request.query.pageSize
        ? parseInt(String(request.query.pageSize), 10)
        : 20;

      const data = await usageService.getRecentSessions(authContext, {
        page,
        pageSize,
      });
      response.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const usageController = new UsageController();