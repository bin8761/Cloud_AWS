import { z } from "zod";

export const blockRuleTypeSchema = z.enum(["URL", "PROCESS", "KEYWORD"]);
export const blockRuleStatusSchema = z.enum(["ACTIVE", "DISABLED"]);

export const blockRuleValueSchema = z.string().trim().min(1).max(500);
export const blockRuleLabelSchema = z.string().trim().max(200).optional();
export const blockRuleReasonSchema = z.string().trim().max(500).optional();
export const blockRulePrioritySchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(9999)
  .optional();

export const blockRuleIdParamsSchema = z
  .object({
    id: z.string().trim().min(1),
  })
  .strict();

export const createBlockRuleSchema = z
  .object({
    type: blockRuleTypeSchema,
    value: blockRuleValueSchema,
    label: blockRuleLabelSchema,
    reason: blockRuleReasonSchema,
    priority: blockRulePrioritySchema,
  })
  .strict();

export const updateBlockRuleSchema = z
  .object({
    value: blockRuleValueSchema.optional(),
    label: blockRuleLabelSchema,
    reason: blockRuleReasonSchema,
    status: blockRuleStatusSchema.optional(),
    priority: blockRulePrioritySchema,
  })
  .strict()
  .refine(
    (payload) =>
      payload.value !== undefined ||
      payload.label !== undefined ||
      payload.reason !== undefined ||
      payload.status !== undefined ||
      payload.priority !== undefined,
    {
      message: "At least one update field is required",
    },
  );

export const listBlockRulesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    type: blockRuleTypeSchema.optional(),
    status: blockRuleStatusSchema.optional(),
    q: z.preprocess((value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    }, z.string().max(100).optional()),
    sort: z
      .enum(["createdAt:desc", "createdAt:asc", "priority:desc", "priority:asc"])
      .optional(),
  })
  .strict();

export const batchCreateBlockRulesSchema = z
  .object({
    rules: z.array(createBlockRuleSchema).min(1).max(50),
  })
  .strict();
