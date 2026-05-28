import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../shared/errors/app-error";
import type { AuthContext } from "../../shared/middleware/auth-context";
import { blockRulesService } from "./block-rules.service";
import type {
  BatchCreateBlockRulesInput,
  CreateBlockRuleInput,
  ListBlockRulesInput,
  UpdateBlockRuleInput,
} from "./block-rules.types";

type BlockRuleIdParams = {
  id: string;
};

const readAuthContextAfterAuthRequired = (request: Request): AuthContext => {
  const authContext = request.authContext;
  if (!authContext) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required.");
  }

  return authContext;
};

export class BlockRulesController {
  public async createBlockRule(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedBody = request.body as CreateBlockRuleInput;
      const data = await blockRulesService.createBlockRule(
        authContext,
        validatedBody,
      );

      response.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async batchCreateBlockRules(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedBody = request.body as BatchCreateBlockRulesInput;
      const data = await blockRulesService.batchCreateBlockRules(
        authContext,
        validatedBody,
      );

      response.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async listBlockRules(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedQuery = request.query as unknown as ListBlockRulesInput;
      const data = await blockRulesService.listBlockRules(
        authContext,
        validatedQuery,
      );

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getBlockRuleById(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedParams = request.params as BlockRuleIdParams;
      const data = await blockRulesService.getBlockRuleById(
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

  public async updateBlockRuleById(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedParams = request.params as BlockRuleIdParams;
      const validatedBody = request.body as UpdateBlockRuleInput;
      const data = await blockRulesService.updateBlockRuleById(
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

  public async deleteBlockRuleById(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const validatedParams = request.params as BlockRuleIdParams;
      const data = await blockRulesService.deleteBlockRuleById(
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

  public async getActiveRulesForClient(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authContext = readAuthContextAfterAuthRequired(request);
      const data = await blockRulesService.getActiveRulesForClient(authContext);

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const blockRulesController = new BlockRulesController();
