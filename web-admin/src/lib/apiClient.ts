import type { FrontendApiError } from "./errors";

const DEFAULT_API_BASE_URL = "http://localhost:3000";
const CONTENT_TYPE_JSON = "application/json";
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;
const STATUS_CONFLICT = 409;
const STATUS_RATE_LIMITED = 429;
const STATUS_SERVER_ERROR = 500;
const UNKNOWN_ERROR_CODE = "UNKNOWN_ERROR";
const UNKNOWN_ERROR_MESSAGE = "An unexpected error occurred.";
const SAFE_ERROR_CODE_PATTERN = /^[A-Z0-9_:-]{2,64}$/;

export type AccessTokenGetter = () => string | null | undefined;
export type ApiClientCallback = () => void;

let registeredAccessTokenGetter: AccessTokenGetter | null = null;
let registeredAuthClearCallback: ApiClientCallback | null = null;
let registeredRealtimeDisconnectCallback: ApiClientCallback | null = null;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function trimLeadingSlash(value: string): string {
  return value.replace(/^\/+/, "");
}

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
);

export function registerAccessTokenGetter(
  getter: AccessTokenGetter | null,
): void {
  registeredAccessTokenGetter = getter;
}

export function getAccessTokenFromMemory(): string | null {
  const token = registeredAccessTokenGetter?.();
  if (typeof token !== "string") {
    return null;
  }

  const normalizedToken = token.trim();
  return normalizedToken ? normalizedToken : null;
}

export function registerAuthClearCallback(
  callback: ApiClientCallback | null,
): void {
  registeredAuthClearCallback = callback;
}

export function registerRealtimeDisconnectCallback(
  callback: ApiClientCallback | null,
): void {
  registeredRealtimeDisconnectCallback = callback;
}

export function triggerAuthClearCallback(): void {
  registeredAuthClearCallback?.();
}

export function triggerRealtimeDisconnectCallback(): void {
  registeredRealtimeDisconnectCallback?.();
}

export function handleUnauthorizedStatus(status: number): void {
  if (status !== STATUS_UNAUTHORIZED) {
    return;
  }

  triggerAuthClearCallback();
  triggerRealtimeDisconnectCallback();
}

export function isUiSpecificErrorStatus(status: number): boolean {
  return (
    status === STATUS_FORBIDDEN ||
    status === STATUS_NOT_FOUND ||
    status === STATUS_CONFLICT ||
    status === STATUS_RATE_LIMITED ||
    status === STATUS_SERVER_ERROR
  );
}

function toHeaders(headers: HeadersInit = {}): Headers {
  return new Headers(headers);
}

export function withAuthorizationHeader(headers: HeadersInit = {}): Headers {
  const mergedHeaders = toHeaders(headers);
  const accessToken = getAccessTokenFromMemory();

  if (!accessToken) {
    return mergedHeaders;
  }

  mergedHeaders.set("Authorization", `Bearer ${accessToken}`);
  return mergedHeaders;
}

export function normalizeRequestPath(path: string): string {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return "";
  }

  return trimLeadingSlash(trimmedPath);
}

export function buildApiUrl(path: string): string {
  const normalizedPath = normalizeRequestPath(path);
  if (!normalizedPath) {
    return API_BASE_URL;
  }

  return `${API_BASE_URL}/${normalizedPath}`;
}

export type SerializableQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>;

export type QueryParams = Record<string, SerializableQueryValue>;

export function serializeJsonBody<TBody>(
  body: TBody,
  headers: HeadersInit = {},
): { body: string; headers: HeadersInit } {
  return {
    body: JSON.stringify(body),
    headers: {
      ...headers,
      "Content-Type": CONTENT_TYPE_JSON,
    },
  };
}

export function serializeQueryParams(params: QueryParams = {}): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        searchParams.append(key, String(item));
      });
      return;
    }

    searchParams.set(key, String(value));
  });

  return searchParams.toString();
}

export async function parseResponseJson<TData = unknown>(
  response: Response,
): Promise<TData | null> {
  const rawBody = await response.text();
  if (!rawBody.trim()) {
    return null;
  }

  return JSON.parse(rawBody) as TData;
}

export async function parseResponseJsonSafe<TData = unknown>(
  response: Response,
): Promise<TData | null> {
  const rawBody = await response.text();
  if (!rawBody.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as TData;
  } catch {
    return null;
  }
}

type FoundationSuccessEnvelope<TData> = {
  success: true;
  data: TData;
};

type FoundationErrorEnvelope = {
  success: false;
  error?: {
    code?: string;
    message?: string;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeErrorStatus(status: number): number {
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : 500;
}

function isSafeBackendErrorCode(value: unknown): value is string {
  return typeof value === "string" && SAFE_ERROR_CODE_PATTERN.test(value);
}

function pickSafeBackendErrorCode(payload: unknown): string | null {
  const envelope = asRecord(payload);
  const nestedError = asRecord(envelope?.error);

  const codeCandidates = [nestedError?.code, envelope?.code];
  for (const candidate of codeCandidates) {
    if (isSafeBackendErrorCode(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function parseFoundationSuccessEnvelope<TData>(
  payload: unknown,
): TData | null {
  const envelope = asRecord(payload);
  if (!envelope || envelope.success !== true) {
    return null;
  }

  return (envelope as FoundationSuccessEnvelope<TData>).data;
}

export function normalizeFoundationErrorEnvelope(
  payload: unknown,
  status: number,
): FrontendApiError {
  const envelope = asRecord(payload) as FoundationErrorEnvelope | null;
  const errorNode = envelope?.error;
  const normalizedStatus = normalizeErrorStatus(status);
  const isFoundationErrorEnvelope = envelope?.success === false;

  const code = pickSafeBackendErrorCode(payload) ?? UNKNOWN_ERROR_CODE;

  const message =
    isFoundationErrorEnvelope &&
    typeof errorNode?.message === "string" &&
    errorNode.message.trim()
      ? errorNode.message
      : UNKNOWN_ERROR_MESSAGE;

  return {
    status: normalizedStatus,
    code,
    message,
  };
}
