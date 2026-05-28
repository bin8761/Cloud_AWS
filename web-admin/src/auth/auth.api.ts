import type {
  CurrentUser,
  LoginInput,
  LoginResult,
  MeResponse,
  RegisterTenantInput,
  RegisterTenantResult,
  VerifyTenantRegistrationInput,
  VerifyTenantRegistrationResult,
} from "./auth.types";
import type { FrontendApiError } from "../lib/errors";
import {
  buildApiUrl,
  handleUnauthorizedStatus,
  normalizeFoundationErrorEnvelope,
  parseFoundationSuccessEnvelope,
  parseResponseJsonSafe,
  serializeJsonBody,
  withAuthorizationHeader,
} from "../lib/apiClient";

export type RefreshInput = {
  refreshToken: string;
};

export type RefreshResult = {
  accessToken: string;
  refreshToken?: string | null;
};

const AUTH_API_PATHS = {
  login: "/api/auth/login",
  registerTenant: "/api/auth/register-tenant",
  verifyTenantRegistration: "/api/auth/register-tenant/verify",
  me: "/api/auth/me",
  logout: "/api/auth/logout",
  refresh: "/api/auth/refresh",
} as const;

function throwNormalizedApiError(
  payload: unknown,
  status: number,
  options: { triggerUnauthorizedCallback?: boolean } = {},
): never {
  if (options.triggerUnauthorizedCallback ?? true) {
    handleUnauthorizedStatus(status);
  }
  throw normalizeFoundationErrorEnvelope(payload, status);
}

function throwInvalidSuccessEnvelope(status: number): never {
  const fallbackError: FrontendApiError = {
    status,
    code: "INVALID_RESPONSE",
    message: "Invalid response payload.",
  };
  throw fallbackError;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const request = serializeJsonBody(input);
  const response = await fetch(buildApiUrl(AUTH_API_PATHS.login), {
    method: "POST",
    headers: request.headers,
    body: request.body,
  });

  const payload = await parseResponseJsonSafe(response);
  if (!response.ok) {
    throwNormalizedApiError(payload, response.status);
  }

  const data = parseFoundationSuccessEnvelope<LoginResult>(payload);
  if (!data) {
    throwInvalidSuccessEnvelope(response.status);
  }

  return data;
}

export async function registerTenant(
  input: RegisterTenantInput,
): Promise<RegisterTenantResult> {
  const request = serializeJsonBody(input);
  const response = await fetch(buildApiUrl(AUTH_API_PATHS.registerTenant), {
    method: "POST",
    headers: request.headers,
    body: request.body,
  });

  const payload = await parseResponseJsonSafe(response);
  if (!response.ok) {
    throwNormalizedApiError(payload, response.status);
  }

  const data = parseFoundationSuccessEnvelope<RegisterTenantResult>(payload);
  if (!data) {
    throwInvalidSuccessEnvelope(response.status);
  }

  return data;
}

export async function verifyTenantRegistration(
  input: VerifyTenantRegistrationInput,
): Promise<VerifyTenantRegistrationResult> {
  const request = serializeJsonBody(input);
  const response = await fetch(
    buildApiUrl(AUTH_API_PATHS.verifyTenantRegistration),
    {
      method: "POST",
      headers: request.headers,
      body: request.body,
    },
  );

  const payload = await parseResponseJsonSafe(response);
  if (!response.ok) {
    throwNormalizedApiError(payload, response.status);
  }

  const data =
    parseFoundationSuccessEnvelope<VerifyTenantRegistrationResult>(payload);
  if (!data) {
    throwInvalidSuccessEnvelope(response.status);
  }

  return data;
}

export async function getMe(): Promise<CurrentUser> {
  const response = await fetch(buildApiUrl(AUTH_API_PATHS.me), {
    method: "GET",
    headers: withAuthorizationHeader(),
  });

  const payload = await parseResponseJsonSafe(response);
  if (!response.ok) {
    throwNormalizedApiError(payload, response.status, {
      triggerUnauthorizedCallback: false,
    });
  }

  const data = parseFoundationSuccessEnvelope<MeResponse>(payload);
  if (!data) {
    throwInvalidSuccessEnvelope(response.status);
  }

  return {
    id: data.user.id,
    email: data.user.email,
    fullName: data.user.fullName,
    role: data.user.role,
    tenantId: data.user.tenantId ?? null,
    tenant: data.tenant,
  };
}

export async function logout(): Promise<void> {
  const refreshTokenValue = window.sessionStorage.getItem("auth.refreshToken");
  const request = serializeJsonBody({
    refreshToken: refreshTokenValue ?? "",
  });
  const response = await fetch(buildApiUrl(AUTH_API_PATHS.logout), {
    method: "POST",
    headers: withAuthorizationHeader(request.headers),
    body: request.body,
  });

  if (!response.ok) {
    const payload = await parseResponseJsonSafe(response);
    throwNormalizedApiError(payload, response.status);
  }
}

export async function refreshToken(input: RefreshInput): Promise<RefreshResult> {
  const request = serializeJsonBody(input);
  const response = await fetch(buildApiUrl(AUTH_API_PATHS.refresh), {
    method: "POST",
    headers: request.headers,
    body: request.body,
  });

  const payload = await parseResponseJsonSafe(response);
  if (!response.ok) {
    throwNormalizedApiError(payload, response.status);
  }

  const data = parseFoundationSuccessEnvelope<RefreshResult>(payload);
  if (!data) {
    throwInvalidSuccessEnvelope(response.status);
  }

  return data;
}
