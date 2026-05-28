import { z } from "zod";

export const registerTenantFormSchema = z.object({
  tenantName: z.string().trim().min(1, "Please enter your tenant name."),
  tenantCode: z
    .string()
    .trim()
    .min(1, "Please enter your tenant code.")
    .max(50, "Tenant code must be 50 characters or fewer.")
    .regex(/^[A-Za-z0-9_]+$/, "Tenant code may only contain letters, numbers, and underscore."),
  adminFullName: z.string().trim().min(1, "Please enter admin full name."),
  adminEmail: z
    .string()
    .trim()
    .min(1, "Please enter admin email.")
    .email("Please enter a valid email address."),
  adminPassword: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
    .regex(/[a-z]/, "Password must include at least one lowercase letter.")
    .regex(/[0-9]/, "Password must include at least one number.")
    .regex(/[^A-Za-z0-9]/, "Password must include at least one special character."),
});

export const verifyTenantRegistrationFormSchema = z.object({
  registrationId: z.string().trim().min(1, "Please enter registration ID."),
  verificationCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Verification code must be 6 digits."),
});

export type RegisterTenantFormValues = z.infer<typeof registerTenantFormSchema>;
export type VerifyTenantRegistrationFormValues = z.infer<
  typeof verifyTenantRegistrationFormSchema
>;
