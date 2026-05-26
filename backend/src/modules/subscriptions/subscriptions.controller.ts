import type { NextFunction, Request, Response } from "express";

import { subscriptionsService } from "./subscriptions.service";

export class SubscriptionsController {
  public async me(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const data = await subscriptionsService.getSubscriptionByTenant(
        request.authContext?.tenantId,
      );
      response.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async create(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const { tenantId, status, maxComputers, expiresAt } = request.body as {
        tenantId: string;
        status: "ACTIVE" | "EXPIRED" | "PENDING";
        maxComputers: number;
        expiresAt: string;
      };

      const data = await subscriptionsService.createSubscription({
        tenantId,
        status,
        maxComputers,
        expiresAt: new Date(expiresAt),
      });

      response.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async update(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = request.params;
      const { status, maxComputers, expiresAt } = request.body as {
        status?: "ACTIVE" | "EXPIRED" | "PENDING";
        maxComputers?: number;
        expiresAt?: string;
      };

      const data = await subscriptionsService.updateSubscription(id, {
        status,
        maxComputers,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      response.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const subscriptionsController = new SubscriptionsController();
