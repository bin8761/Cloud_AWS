import type {
  BlockRule,
  BlockRulesListResponse,
  CreateBlockRuleInput,
  CurrentUserResponse,
  ListBlockRulesInput,
  LoginResponse,
  UpdateBlockRuleInput,
} from "./types";

type ApiEnvelope<T> = {
  success: true;
  data: T;
};

type ApiErrorEnvelope = {
  success: false;
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const normalizeApiBase = (apiBase: string): string =>
  apiBase.trim().replace(/\/+$/, "");

const readErrorMessage = async (response: Response): Promise<ApiError> => {
  let body: ApiErrorEnvelope | undefined;
  try {
    body = (await response.json()) as ApiErrorEnvelope;
  } catch {
    body = undefined;
  }

  const code = body?.error?.code;
  const message = body?.error?.message ?? response.statusText;
  return new ApiError(message, response.status, code);
};

const requestJson = async <T>(
  apiBase: string,
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken.trim()) {
    headers.set("Authorization", `Bearer ${accessToken.trim()}`);
  }

  const response = await fetch(`${normalizeApiBase(apiBase)}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw await readErrorMessage(response);
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
};

export const login = (
  apiBase: string,
  input: { email: string; password: string },
): Promise<LoginResponse> =>
  requestJson<LoginResponse>(apiBase, "", "/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getCurrentUser = (
  apiBase: string,
  accessToken: string,
): Promise<CurrentUserResponse> =>
  requestJson<CurrentUserResponse>(apiBase, accessToken, "/api/auth/me");

export const logout = (
  apiBase: string,
  refreshToken: string,
): Promise<{ loggedOut: true }> =>
  requestJson<{ loggedOut: true }>(apiBase, "", "/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

export const listBlockRules = (
  apiBase: string,
  accessToken: string,
  input: ListBlockRulesInput,
): Promise<BlockRulesListResponse> => {
  const query = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  if (input.type) query.set("type", input.type);
  if (input.status) query.set("status", input.status);
  if (input.q?.trim()) query.set("q", input.q.trim());
  if (input.sort) query.set("sort", input.sort);

  return requestJson<BlockRulesListResponse>(
    apiBase,
    accessToken,
    `/api/block-rules?${query.toString()}`,
  );
};

export const createBlockRule = (
  apiBase: string,
  accessToken: string,
  input: CreateBlockRuleInput,
): Promise<BlockRule> =>
  requestJson<BlockRule>(apiBase, accessToken, "/api/block-rules", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const batchCreateBlockRules = (
  apiBase: string,
  accessToken: string,
  rules: CreateBlockRuleInput[],
): Promise<BlockRulesListResponse> =>
  requestJson<BlockRulesListResponse>(apiBase, accessToken, "/api/block-rules/batch", {
    method: "POST",
    body: JSON.stringify({ rules }),
  });

export const updateBlockRule = (
  apiBase: string,
  accessToken: string,
  id: string,
  input: UpdateBlockRuleInput,
): Promise<BlockRule> =>
  requestJson<BlockRule>(apiBase, accessToken, `/api/block-rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const deleteBlockRule = (
  apiBase: string,
  accessToken: string,
  id: string,
): Promise<BlockRule> =>
  requestJson<BlockRule>(apiBase, accessToken, `/api/block-rules/${id}`, {
    method: "DELETE",
  });
