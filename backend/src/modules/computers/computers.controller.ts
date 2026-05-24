import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../shared/errors/app-error";
import type { AuthContext } from "../../shared/middleware/auth-context";
import { computersService } from "./computers.service";
import type {
  ListComputersInput,
  ReissueDeviceTokenInput,
  RegisterComputerInput,
  UpdateComputerInput,
} from "./computers.types";

type ComputerIdParams = {
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

export class ComputersController {
  public async registerComputer(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validatedBody = request.body as RegisterComputerInput;
      const data = await computersService.registerComputer(validatedBody, {
        requestId: request.requestId,
        ip: request.ip,
        userAgent:
          typeof request.headers["user-agent"] === "string"
            ? request.headers["user-agent"]
            : undefined,
      });

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async listComputers(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedQuery = request.query as unknown as ListComputersInput;
      const data = await computersService.listComputers(authContext, validatedQuery);

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getComputerById(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedParams = request.params as ComputerIdParams;
      const data = await computersService.getComputerById(
        authContext,
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

  public async updateComputerById(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedParams = request.params as ComputerIdParams;
      const validatedBody = request.body as UpdateComputerInput;
      const data = await computersService.updateComputerById(
        authContext,
        validatedParams.id,
        validatedBody,
      );

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async reissueDeviceToken(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedParams = request.params as ComputerIdParams;
      const validatedBody = request.body as ReissueDeviceTokenInput;
      const data = await computersService.reissueDeviceToken(
        authContext,
        validatedParams.id,
        validatedBody,
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

export const computersController = new ComputersController();
