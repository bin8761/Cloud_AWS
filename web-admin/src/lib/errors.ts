export type FrontendApiError = {
  status: number;
  code: string;
  message: string;
};

const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_RATE_LIMITED = 429;

export const DEFAULT_API_ERROR: FrontendApiError = {
  status: 500,
  code: "UNKNOWN_ERROR",
  message: "An unexpected error occurred.",
};

export function isFrontendApiError(error: unknown): error is FrontendApiError {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Record<string, unknown>;

  return (
    typeof candidate.status === "number" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}

export function isAuthError(error: unknown): boolean {
  if (!isFrontendApiError(error)) {
    return false;
  }

  return (
    error.status === STATUS_UNAUTHORIZED ||
    error.code === "UNAUTHORIZED" ||
    error.code === "AUTH_REQUIRED"
  );
}

export function isForbiddenError(error: unknown): boolean {
  if (!isFrontendApiError(error)) {
    return false;
  }

  return error.status === STATUS_FORBIDDEN || error.code === "FORBIDDEN";
}

export function isRateLimitError(error: unknown): boolean {
  if (!isFrontendApiError(error)) {
    return false;
  }

  return (
    error.status === STATUS_RATE_LIMITED ||
    error.code === "RATE_LIMITED" ||
    error.code === "TOO_MANY_REQUESTS"
  );
}
