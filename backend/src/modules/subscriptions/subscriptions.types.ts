export type SubscriptionStatusDto = "ACTIVE" | "EXPIRED" | "PENDING";

export type SubscriptionDto = {
  id: string;
  tenantId: string;
  status: SubscriptionStatusDto;
  maxComputers: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionEntity = {
  id: string;
  tenantId: string;
  status: SubscriptionStatusDto;
  maxComputers: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export const mapSubscriptionDto = (sub: SubscriptionEntity): SubscriptionDto => ({
  id: sub.id,
  tenantId: sub.tenantId,
  status: sub.status,
  maxComputers: sub.maxComputers,
  expiresAt: sub.expiresAt.toISOString(),
  createdAt: sub.createdAt.toISOString(),
  updatedAt: sub.updatedAt.toISOString(),
});
