import type { FrontendApiError } from "../lib/errors";
import {
  buildApiUrl,
  handleUnauthorizedStatus,
  normalizeFoundationErrorEnvelope,
  parseFoundationSuccessEnvelope,
  parseResponseJsonSafe,
  serializeJsonBody,
  serializeQueryParams,
  withAuthorizationHeader,
} from "../lib/apiClient";
import type {
  Computer,
  ComputersListQuery,
  ComputersListResponse,
  ReissueTokenInput,
  ReissueTokenResult,
  UpdateComputerInput,
} from "./computers.types";

const COMPUTERS_API_PATHS = {
  list: "/api/computers",
} as const;

function buildComputerDetailPath(id: string): string {
  return `/api/computers/${encodeURIComponent(id)}`;
}

function buildReissueComputerTokenPath(id: string): string {
  return `/api/computers/${encodeURIComponent(id)}/reissue-token`;
}

function throwNormalizedApiError(payload: unknown, status: number): never {
  handleUnauthorizedStatus(status);
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

export async function listComputers(
  query: ComputersListQuery = {},
): Promise<ComputersListResponse> {
  const queryString = serializeQueryParams({
    page: query.page,
    pageSize: query.pageSize,
    status: query.status,
    q: query.q,
    sort: query.sort,
  });

  const baseUrl = buildApiUrl(COMPUTERS_API_PATHS.list);
  const requestUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;

  const response = await fetch(requestUrl, {
    method: "GET",
    headers: withAuthorizationHeader(),
  });

  const payload = await parseResponseJsonSafe(response);
  if (!response.ok) {
    throwNormalizedApiError(payload, response.status);
  }

  const data = parseFoundationSuccessEnvelope<ComputersListResponse>(payload);
  if (!data) {
    throwInvalidSuccessEnvelope(response.status);
  }

  return data;
}

export async function getComputer(id: string): Promise<Computer> {
  const response = await fetch(buildApiUrl(buildComputerDetailPath(id)), {
    method: "GET",
    headers: withAuthorizationHeader(),
  });

  const payload = await parseResponseJsonSafe(response);
  if (!response.ok) {
    throwNormalizedApiError(payload, response.status);
  }

  const data = parseFoundationSuccessEnvelope<Computer>(payload);
  if (!data) {
    throwInvalidSuccessEnvelope(response.status);
  }

  return data;
}

export async function updateComputer(
  id: string,
  input: UpdateComputerInput,
): Promise<Computer> {
  const request = serializeJsonBody(input);
  const response = await fetch(buildApiUrl(buildComputerDetailPath(id)), {
    method: "PATCH",
    headers: withAuthorizationHeader(request.headers),
    body: request.body,
  });

  const payload = await parseResponseJsonSafe(response);
  if (!response.ok) {
    throwNormalizedApiError(payload, response.status);
  }

  const data = parseFoundationSuccessEnvelope<Computer>(payload);
  if (!data) {
    throwInvalidSuccessEnvelope(response.status);
  }

  return data;
}

export async function reissueComputerToken(
  id: string,
  input: ReissueTokenInput,
): Promise<ReissueTokenResult> {
  const request = serializeJsonBody(input);
  const response = await fetch(buildApiUrl(buildReissueComputerTokenPath(id)), {
    method: "POST",
    headers: withAuthorizationHeader(request.headers),
    body: request.body,
  });

  const payload = await parseResponseJsonSafe(response);
  if (!response.ok) {
    throwNormalizedApiError(payload, response.status);
  }

  const data = parseFoundationSuccessEnvelope<ReissueTokenResult>(payload);
  if (!data) {
    throwInvalidSuccessEnvelope(response.status);
  }

  return data;
}
