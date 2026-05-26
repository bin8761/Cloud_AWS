import { z } from "zod";

export const subscriptionIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createSubscriptionSchema = z
  .object({
    tenantId: z.string().uuid(),
    status: z.enum(["ACTIVE", "EXPIRED", "PENDING"]),
    maxComputers: z.number().int().positive().default(20),
    expiresAt: z.string().datetime(), // ISO string date-time
  })
  .strict();

export const updateSubscriptionSchema = z
  .object({
    status: z.enum(["ACTIVE", "EXPIRED", "PENDING"]).optional(),
    maxComputers: z.number().int().positive().optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.status !== undefined ||
      value.maxComputers !== undefined ||
      value.expiresAt !== undefined,
    {
      message: "At least one field must be provided for update.",
    },
  );
