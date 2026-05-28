import path from "path";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { blockRulesRouter } from "./modules/block-rules/block-rules.routes";
import { computersRouter } from "./modules/computers/computers.routes";
import { healthRouter } from "./modules/health/health.routes";
import { tenantsRouter } from "./modules/tenants/tenants.routes";
import { usersRouter } from "./modules/users/users.routes";
import { assetsRouter } from "./modules/assets/assets.routes";
import { subscriptionsRouter } from "./modules/subscriptions/subscriptions.routes";
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
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/tenants", tenantsRouter);
app.use("/api/computers", computersRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/uploads/lockscreen", express.static(path.join(process.cwd(), "public/uploads/lockscreen")));
app.use("/api/block-rules", blockRulesRouter);
app.use(notFoundHandler);
app.use(errorHandler);
