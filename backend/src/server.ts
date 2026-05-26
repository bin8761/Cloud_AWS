import { createServer } from "node:http";
import { app } from "./app";
import { env } from "./config/env";
import { healthService } from "./modules/health/health.service";
import { createRealtimeServer } from "./modules/realtime";
import { logger } from "./shared/logging/logger";
import { disconnectPrisma } from "./shared/prisma/prisma.client";

const LOGGER_FLUSH_TIMEOUT_MS = 2000;
let shutdownInProgress = false;

export const httpServer = createServer(app);
export const realtimeServer = createRealtimeServer(httpServer);
healthService.setRealtimeHealthProvider(() => realtimeServer.getRealtimeHealthSnapshot());

export const server = httpServer.listen(env.server.port, () => {
  logger.info(
    {
      environment: env.app.nodeEnv,
      port: env.server.port,
      nodeVersion: process.version,
    },
    "HTTP server started",
  );
});

const closeHttpServer = (): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const closeRealtimeServer = async (): Promise<void> => {
  await realtimeServer.close();
};

const flushLogger = async (): Promise<void> => {
  const flush = (logger as { flush?: (() => void) | undefined }).flush;

  if (typeof flush !== "function") {
    return;
  }

  await Promise.race([
    new Promise<void>((resolve) => {
      flush.call(logger);
      setImmediate(resolve);
    }),
    new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Logger flush timed out"));
      }, LOGGER_FLUSH_TIMEOUT_MS);
    }),
  ]);
};

const handleShutdownSignal = (signal: NodeJS.Signals): void => {
  if (shutdownInProgress) {
    logger.warn({ signal }, "Shutdown already in progress; duplicate signal ignored");
    return;
  }

  shutdownInProgress = true;
  logger.info({ signal }, "Shutdown signal received");

  void closeHttpServer()
    .then(async () => {
      logger.info({ signal }, "HTTP server closed");
      await closeRealtimeServer();
      logger.info({ signal }, "Realtime server closed");
      await disconnectPrisma();
      logger.info({ signal }, "Prisma disconnected");
      await flushLogger();
      process.exit(0);
    })
    .catch((error: unknown) => {
      logger.error({ signal, error }, "Shutdown sequence failed");
      process.exit(1);
    });
};

process.on("SIGINT", () => {
  handleShutdownSignal("SIGINT");
});

process.on("SIGTERM", () => {
  handleShutdownSignal("SIGTERM");
});
