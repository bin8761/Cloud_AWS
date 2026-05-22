import { z } from "zod";
import { adminPasswordSchema } from "../auth/auth.schema";

export const staffEmailSchema = z.string().trim().toLowerCase().email();
export const staffFullNameSchema = z.string().trim().min(1).max(120);
export const staffStatusSchema = z.enum(["ACTIVE", "DISABLED"]);
export const staffPasswordSchema = adminPasswordSchema;
export const createStaffUserProtectedFields = [
  "id",
  "tenantId",
  "role",
  "status",
  "passwordHash",
  "deletedAt",
  "createdAt",
  "updatedAt",
  "lastLoginAt",
] as const;
export const updateStaffUserProtectedFields = [
  "email",
  "tenantId",
  "role",
  "passwordHash",
  "id",
  "deletedAt",
  "createdAt",
  "updatedAt",
  "lastLoginAt",
] as const;
export const staffUserIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});
export const createStaffUserSchema = z
  .object({
    email: staffEmailSchema,
    fullName: staffFullNameSchema,
    password: staffPasswordSchema,
  })
  .strict();
export const updateStaffUserSchema = z
  .object({
    fullName: staffFullNameSchema.optional(),
    status: staffStatusSchema.optional(),
    password: staffPasswordSchema.optional(),
  })
  .refine(
    (value) =>
      value.fullName !== undefined ||
      value.status !== undefined ||
      value.password !== undefined,
    {
      message: "At least one update field is required.",
    },
  )
  .strict();
export const listStaffUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: staffStatusSchema.optional(),
    q: z.preprocess((value) => {
      if (typeof value !== "string") {
        return value;
      }
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    }, z.string().max(100).optional()),
  })
  .strict();

export const usersRouteSchemas = {
  staffEmailSchema,
  staffFullNameSchema,
  staffStatusSchema,
  staffPasswordSchema,
  staffUserIdParamsSchema,
  createStaffUserSchema,
  updateStaffUserSchema,
  listStaffUsersQuerySchema,
} as const;
