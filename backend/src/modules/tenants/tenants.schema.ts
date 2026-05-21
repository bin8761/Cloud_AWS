import { z } from "zod";

const QUERY_INTEGER_PATTERN = /^-?\d+$/;

export const parseExpressQueryInteger = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  const normalizedValue = value.trim();
  if (!QUERY_INTEGER_PATTERN.test(normalizedValue)) {
    return value;
  }

  const parsedValue = Number(normalizedValue);
  if (!Number.isSafeInteger(parsedValue)) {
    return value;
  }

  return parsedValue;
};

export const normalizeOptionalTenantSearchQuery = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    return undefined;
  }

  return normalizedValue;
};

export const tenantNameSchema = z.string().trim().min(1).max(120);
export const tenantStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);
export const tenantIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});
export const updateCurrentTenantSchema = z
  .object({
    name: tenantNameSchema,
  })
  .strict();

export const updateTenantByIdSchema = z
  .object({
    name: tenantNameSchema.optional(),
    status: tenantStatusSchema.optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.status !== undefined, {
    message: "At least one of `name` or `status` is required.",
  });

export const listTenantsQuerySchema = z.object({
  page: z.preprocess(parseExpressQueryInteger, z.number().int().min(1).default(1)),
  pageSize: z.preprocess(parseExpressQueryInteger, z.number().int().min(1).max(100).default(20)),
  status: tenantStatusSchema.optional(),
  q: z.preprocess(normalizeOptionalTenantSearchQuery, z.string().max(100).optional()),
});

export const tenantsRouteSchemas = {
  tenantNameSchema,
  tenantStatusSchema,
  tenantIdParamsSchema,
  updateCurrentTenantSchema,
  updateTenantByIdSchema,
  listTenantsQuerySchema,
} as const;

