import { z } from "zod";

export const normalizeTenantCode = (value: string): string =>
  value.trim().toUpperCase();

export const tenantCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .transform(normalizeTenantCode);

export const registrationSecretSchema = z.string().trim().min(1);

const MAC_ADDRESS_REGEX =
  /^(?:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}|[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}|[0-9A-Fa-f]{12})$/;

export const normalizeMacAddress = (value: string): string => {
  const normalizedHex = value.replace(/[:-]/g, "").toUpperCase();
  return normalizedHex.match(/.{2}/g)?.join(":") ?? normalizedHex;
};

export const macAddressSchema = z
  .string()
  .trim()
  .regex(MAC_ADDRESS_REGEX, "Invalid MAC address format")
  .transform(normalizeMacAddress);

export const computerNameSchema = z.string().trim().max(100).optional();
export const computerNotesSchema = z.string().trim().max(500).optional();
export const computerStatusSchema = z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]);
export const computerIdParamsSchema = z
  .object({
    id: z.string().trim().min(1),
  })
  .strict();

export const registerComputerSchema = z
  .object({
    tenantCode: tenantCodeSchema,
    registrationSecret: registrationSecretSchema,
    macAddress: macAddressSchema,
    name: computerNameSchema,
  })
  .strict();

export const listComputersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: computerStatusSchema.optional(),
    q: z.preprocess((value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    }, z.string().max(100).optional()),
    sort: z
      .enum(["createdAt:desc", "createdAt:asc", "name:asc", "name:desc"])
      .optional(),
  })
  .strict();

export const updateComputerSchema = z
  .object({
    name: computerNameSchema,
    status: computerStatusSchema.optional(),
    notes: computerNotesSchema,
  })
  .strict()
  .refine(
    (payload) =>
      payload.name !== undefined ||
      payload.status !== undefined ||
      payload.notes !== undefined,
    {
      message: "At least one update field is required",
    },
  );

export const reissueDeviceTokenSchema = z
  .object({
    reason: z.string().trim().max(200).optional(),
  })
  .strict();

export const computersRouteSchemas = {
  tenantCodeSchema,
  registrationSecretSchema,
  macAddressSchema,
  computerNameSchema,
  computerNotesSchema,
  computerStatusSchema,
  computerIdParamsSchema,
  registerComputerSchema,
  listComputersQuerySchema,
  updateComputerSchema,
  reissueDeviceTokenSchema,
} as const;
