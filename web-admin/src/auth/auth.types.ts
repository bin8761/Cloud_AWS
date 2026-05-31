export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterTenantInput = {
  tenantName: string;
  tenantCode: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
};

export type RegisterTenantResult = {
  registrationId: string;
  email: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
};

export type VerifyTenantRegistrationInput = {
  registrationId: string;
  verificationCode: string;
};

export type ResendTenantRegistrationInput = {
  registrationId: string;
};

export type ResendTenantRegistrationResult = {
  registrationId: string;
  email: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
};

export type VerifyTenantRegistrationResult = {
  accessToken: string;
  refreshToken?: string | null;
  computerRegistrationSecret: string;
};

export type LoginResult = {
  accessToken: string;
  refreshToken?: string | null;
};

export type TenantContext = {
  id: string;
  name: string;
  code: string;
  status?: string;
};

export type CurrentUser = {
  id: string;
  email: string;
  fullName?: string;
  role: "shop_admin" | "staff" | string;
  tenantId?: string | null;
  tenant: TenantContext | null;
};

export type MeResponse = {
  user: {
    id: string;
    email: string;
    fullName?: string;
    role: "shop_admin" | "staff" | string;
    tenantId?: string | null;
  };
  tenant: TenantContext | null;
};

export type AuthStatus = "bootstrapping" | "authenticated" | "unauthenticated" | "forbidden" | "error";
