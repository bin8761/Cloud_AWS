import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/errors/app-error";
import type { AuthContext } from "../../shared/middleware/auth-context";
import { tenantsService } from "./tenants.service";
import type {
  ListTenantsInput,
  UpdateCurrentTenantInput,
  UpdateTenantByIdInput,
} from "./tenants.types";

type TenantIdParams = {
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

export class TenantsController {
  public async getCurrentTenant(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const data = await tenantsService.getCurrentTenant(authContext.tenantId);

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async updateCurrentTenant(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedBody = request.body as UpdateCurrentTenantInput;
      const data = await tenantsService.updateCurrentTenantName(
        {
          ...authContext,
          requestId: request.requestId,
        },
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

  public async listTenants(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validatedQuery = request.query as unknown as ListTenantsInput;
      const data = await tenantsService.listTenants(validatedQuery);

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getTenantById(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const validatedParams = request.params as TenantIdParams;
      const tenantId = validatedParams.id;
      const data = await tenantsService.getTenantById(tenantId);

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async updateTenantById(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedParams = request.params as TenantIdParams;
      const validatedBody = request.body as UpdateTenantByIdInput;
      const tenantId = validatedParams.id;
      const data = await tenantsService.updateTenantById(
        {
          ...authContext,
          requestId: request.requestId,
        },
        tenantId,
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

export const tenantsController = new TenantsController();
