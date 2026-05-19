import type { RequestHandler } from "express";

import { logger } from "./logger";

type OptionalLogContext = {
  tenantId?: string;
  userId?: string;
  computerId?: string;
};

type RequestWithLogContext = {
  authContext?: OptionalLogContext;
} & OptionalLogContext;

const getOptionalLogContext = (req: RequestWithLogContext): OptionalLogContext => ({
  tenantId: req.authContext?.tenantId ?? req.tenantId,
  userId: req.authContext?.userId ?? req.userId,
  computerId: req.authContext?.computerId ?? req.computerId,
});

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const optionalContext = getOptionalLogContext(req as RequestWithLogContext);

    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(3)),
        ...optionalContext,
      },
      "request completed",
    );
  });

  next();
};
