import { z } from "zod";

export const normalizeEmail = (value: string): string => value.trim().toLowerCase();
export const normalizeTenantCode = (value: string): string => value.trim().toUpperCase();

export const normalizedEmailSchema = z
  .string()
  .trim()
  .email()
  .transform(normalizeEmail);

export const normalizedTenantCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .transform(normalizeTenantCode)
  .pipe(z.string().regex(/^[A-Z0-9_]+$/));

export const adminPasswordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

export const registerTenantSchema = z.object({
  tenantName: z.string().trim().min(1).max(120),
  tenantCode: normalizedTenantCodeSchema,
  adminFullName: z.string().trim().min(1).max(120),
  adminEmail: normalizedEmailSchema,
  adminPassword: adminPasswordSchema,
});

export const verifyTenantRegistrationSchema = z.object({
  registrationId: z.string().trim().min(1),
  verificationCode: z.string().trim().regex(/^\d{6}$/),
});

export const loginSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().trim().min(1),
});

export const authRequestSchemas = {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerTenantSchema,
  verifyTenantRegistrationSchema,
};

export const authSchema = {
  authRequestSchemas,
  adminPasswordSchema,
  loginSchema,
  logoutSchema,
  normalizedEmailSchema,
  normalizedTenantCodeSchema,
  refreshSchema,
  registerTenantSchema,
  verifyTenantRegistrationSchema,
};
