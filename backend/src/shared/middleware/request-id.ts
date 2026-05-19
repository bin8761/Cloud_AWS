import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const REQUEST_ID_HEADER = "x-request-id";
const MAX_REQUEST_ID_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

const extractIncomingRequestId = (value: string | string[] | undefined): string | undefined => {
  const requestId = typeof value === "string" ? value : value?.[0];
  if (!requestId) {
    return undefined;
  }

  const normalizedRequestId = requestId.trim();
  if (
    normalizedRequestId.length === 0 ||
    normalizedRequestId.length > MAX_REQUEST_ID_LENGTH ||
    !REQUEST_ID_PATTERN.test(normalizedRequestId)
  ) {
    return undefined;
  }

  return normalizedRequestId;
};

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incomingRequestId = extractIncomingRequestId(req.headers[REQUEST_ID_HEADER]);
  const requestId = incomingRequestId ?? randomUUID();

  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
};
