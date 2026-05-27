import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/errors/app-error";
import type { AuthContext } from "../../shared/middleware/auth-context";
import { sessionsService } from "./sessions.service";
import type { StartSessionInput, EndSessionInput } from "./sessions.types";

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

export class SessionsController {
  public async startSession(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedBody = request.body as StartSessionInput;
      const data = await sessionsService.startSession(authContext, validatedBody);

      response.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async endSession(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedBody = request.body as EndSessionInput;
      const data = await sessionsService.endSession(authContext, validatedBody);

      response.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async getActiveSessions(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const data = await sessionsService.getActiveSessions(authContext);

      response.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const sessionsController = new SessionsController();