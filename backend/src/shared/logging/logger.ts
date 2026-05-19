import pino from "pino";

import { env } from "../../config/env";

const redactedPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "headers.authorization",
  "headers.cookie",
  "req.body.password",
  "req.body.pass",
  "req.body.pwd",
  "req.body.token",
  "req.body.accessToken",
  "req.body.refreshToken",
  "req.body.access_token",
  "req.body.refresh_token",
  "req.body.tokens.*",
  "req.body.credentials.*",
  "req.query.token",
  "req.query.accessToken",
  "req.query.refreshToken",
  "req.query.password",
  "req.params.token",
  "req.body.databaseUrl",
  "req.body.database_url",
  "req.body.dbUrl",
  "req.body.db_url",
  "databaseUrl",
  "database_url",
  "dbUrl",
  "db_url",
  "config.database.url",
  "config.database.password",
];

export const logger = pino({
  level: env.logging.level,
  redact: {
    paths: redactedPaths,
    censor: "[REDACTED]",
  },
});
