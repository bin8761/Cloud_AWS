export type AuthRole = "super_admin" | "shop_admin" | "staff";

export type AuthUserDto = {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
  tenantId: string | null;
};

export type AuthTenantDto = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
};

export type AuthTokenPairDto = {
  accessToken: string;
  refreshToken: string;
};

export type RegisterTenantInput = {
  tenantName: string;
  tenantCode: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
};

export type RegisterTenantOutput = {
  registrationId: string;
  email: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
};

export type VerifyRegisterTenantInput = {
  registrationId: string;
  verificationCode: string;
};

export type VerifyRegisterTenantOutput = {
  tenant: AuthTenantDto;
  user: AuthUserDto;
} & AuthTokenPairDto;

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginOutput = {
  user: AuthUserDto;
} & AuthTokenPairDto;

export type RefreshInput = {
  refreshToken: string;
};

export type RefreshOutput = AuthTokenPairDto;

export type LogoutInput = {
  refreshToken: string;
};

export type LogoutOutput = {
  loggedOut: true;
};

export type GetCurrentUserOutput = {
  user: AuthUserDto;
  tenant: AuthTenantDto | null;
};

type UserRoleValue = "SHOP_ADMIN" | "STAFF" | "SUPER_ADMIN" | AuthRole;
type TenantStatusValue = "ACTIVE" | "SUSPENDED";

export type AuthUserEntity = {
  id: string;
  email: string;
  fullName: string;
  role: UserRoleValue;
  tenantId: string | null;
  passwordHash: string;
};

export type AuthTenantEntity = {
  id: string;
  code: string;
  name: string;
  status: TenantStatusValue;
};

export const mapUserRoleToAuthRole = (role: UserRoleValue): AuthRole => {
  if (role === "SUPER_ADMIN" || role === "super_admin") return "super_admin";
  if (role === "SHOP_ADMIN" || role === "shop_admin") return "shop_admin";
  return "staff";
};

export const mapAuthUserDto = (user: AuthUserEntity): AuthUserDto => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: mapUserRoleToAuthRole(user.role),
  tenantId: user.tenantId,
});

export const mapAuthTenantDto = (tenant: AuthTenantEntity): AuthTenantDto => ({
  id: tenant.id,
  code: tenant.code,
  name: tenant.name,
  status: tenant.status,
});

export const mapAuthTokenPairDto = (
  accessToken: string,
  refreshToken: string,
): AuthTokenPairDto => ({
  accessToken,
  refreshToken,
});
