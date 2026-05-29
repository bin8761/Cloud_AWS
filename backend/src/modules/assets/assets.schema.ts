import { z } from "zod";

export const assetIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const updateAssetActiveSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();
