import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env";
import { healthRouter } from "./modules/health/health.routes";
import { errorHandler } from "./shared/errors/error-handler";
import { requestLogger } from "./shared/logging/request-logger";
import { authContextMiddleware } from "./shared/middleware/auth-context";
import { notFoundHandler } from "./shared/middleware/not-found";
import { requestIdMiddleware } from "./shared/middleware/request-id";

export const app = express();

app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(helmet());
app.use(
  cors({
    origin: env.app.corsOrigin,
  }),
);
app.use(
  express.json({
    limit: env.app.jsonBodyLimit,
  }),
);
app.use(
  express.urlencoded({
    extended: true,
    limit: env.app.urlEncodedBodyLimit,
  }),
);
app.use(authContextMiddleware);
app.use(healthRouter);
app.use(notFoundHandler);
app.use(errorHandler);
