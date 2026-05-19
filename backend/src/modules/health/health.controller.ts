import type { NextFunction, Request, Response } from "express";
import { healthService } from "./health.service";

export class HealthController {
  public getAppHealth(_request: Request, response: Response): void {
    const data = healthService.getAppHealth();

    response.status(200).json({
      success: true,
      data,
    });
  }

  public async getDatabaseHealth(
    _request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const data = await healthService.getDatabaseHealth();

      response.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  public getRuntimeHealth(_request: Request, response: Response): void {
    const data = healthService.getRuntimeHealth();

    response.status(200).json({
      success: true,
      data,
    });
  }
}

export const healthController = new HealthController();
