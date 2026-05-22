import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/errors/app-error";
import type { AuthContext } from "../../shared/middleware/auth-context";
import { usersService } from "./users.service";

type StaffUserIdParams = {
  id: string;
};

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

export class UsersController {
  public async createStaffUser(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const data = await usersService.createStaffUser(
        {
          ...authContext,
          requestId: request.requestId,
        },
        request.body,
      );

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async listStaffUsers(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const data = await usersService.listStaffUsers(
        {
          ...authContext,
          requestId: request.requestId,
        },
        request.query,
      );

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getStaffUserById(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedParams = request.params as StaffUserIdParams;
      const data = await usersService.getStaffUserById(
        {
          ...authContext,
          requestId: request.requestId,
        },
        validatedParams.id,
      );

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async updateStaffUserById(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedParams = request.params as StaffUserIdParams;
      const data = await usersService.updateStaffUserById(
        {
          ...authContext,
          requestId: request.requestId,
        },
        validatedParams.id,
        request.body,
      );

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const usersController = new UsersController();
