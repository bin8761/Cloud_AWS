import { AppError } from "../../shared/errors/app-error";
import { prisma } from "../../shared/prisma/prisma.client";
import { mapSubscriptionDto, type SubscriptionDto, type SubscriptionEntity } from "./subscriptions.types";

export class SubscriptionsService {
  private readonly prismaClient: typeof prisma;

  constructor(dependencies: { prismaClient?: typeof prisma } = {}) {
    this.prismaClient = dependencies.prismaClient ?? prisma;
  }

  public async getSubscriptionByTenant(
    tenantId: string | null | undefined,
  ): Promise<SubscriptionDto> {
    if (!tenantId) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to access this tenant.");
    }

    const sub = await this.prismaClient.subscription.findUnique({
      where: {
        tenantId,
      },
    });

    if (!sub) {
      throw new AppError(404, "NOT_FOUND", "Subscription not found for this tenant.");
    }

    return mapSubscriptionDto(sub as SubscriptionEntity);
  }

  public async createSubscription(input: {
    tenantId: string;
    status: "ACTIVE" | "EXPIRED" | "PENDING";
    maxComputers: number;
    expiresAt: Date;
  }): Promise<SubscriptionDto> {
    // Check if tenant exists
    const tenant = await this.prismaClient.tenant.findUnique({
      where: {
        id: input.tenantId,
      },
    });
    if (!tenant) {
      throw new AppError(404, "NOT_FOUND", "Tenant not found.");
    }

    // Check if subscription already exists for this tenant
    const existing = await this.prismaClient.subscription.findUnique({
      where: {
        tenantId: input.tenantId,
      },
    });

    if (existing) {
      throw new AppError(409, "CONFLICT", "Subscription already exists for this tenant.");
    }

    const sub = await this.prismaClient.subscription.create({
      data: {
        tenantId: input.tenantId,
        status: input.status,
        maxComputers: input.maxComputers,
        expiresAt: input.expiresAt,
      },
    });

    return mapSubscriptionDto(sub as SubscriptionEntity);
  }

  public async updateSubscription(
    id: string,
    input: {
      status?: "ACTIVE" | "EXPIRED" | "PENDING";
      maxComputers?: number;
      expiresAt?: Date;
    },
  ): Promise<SubscriptionDto> {
    const existing = await this.prismaClient.subscription.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Subscription not found.");
    }

    const updated = await this.prismaClient.subscription.update({
      where: {
        id,
      },
      data: {
        status: input.status,
        maxComputers: input.maxComputers,
        expiresAt: input.expiresAt,
      },
    });

    return mapSubscriptionDto(updated as SubscriptionEntity);
  }
}

export const subscriptionsService = new SubscriptionsService();
