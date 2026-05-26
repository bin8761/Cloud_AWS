import { AppError } from "../../shared/errors/app-error";
import { env } from "../../config/env";
import { checkDatabaseConnection } from "../../shared/prisma/prisma.client";

export interface AppHealthStatus {
  status: "ok";
}

export interface DatabaseHealthStatus {
  status: "ok";
  database: "mysql";
}

export interface RuntimeHealthStatus {
  status: "ok";
  environment: "development" | "test" | "production";
  nodeVersion: string;
  uptimeSeconds: number;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  realtime?: RealtimeHealthSnapshot;
}

export interface RealtimeHealthSnapshot {
  activeSockets: number;
  onlineComputers: number;
  adminSockets: number;
  heartbeatAccepted: number;
  heartbeatRateLimited: number;
  authFailures: number;
  heartbeatTimeouts: number;
}

export type RealtimeHealthProvider = () => RealtimeHealthSnapshot;

const sanitizeRealtimeCounterValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
};

const sanitizeRealtimeHealthSnapshot = (
  snapshot: RealtimeHealthSnapshot
): RealtimeHealthSnapshot => ({
  activeSockets: sanitizeRealtimeCounterValue(snapshot.activeSockets),
  onlineComputers: sanitizeRealtimeCounterValue(snapshot.onlineComputers),
  adminSockets: sanitizeRealtimeCounterValue(snapshot.adminSockets),
  heartbeatAccepted: sanitizeRealtimeCounterValue(snapshot.heartbeatAccepted),
  heartbeatRateLimited: sanitizeRealtimeCounterValue(snapshot.heartbeatRateLimited),
  authFailures: sanitizeRealtimeCounterValue(snapshot.authFailures),
  heartbeatTimeouts: sanitizeRealtimeCounterValue(snapshot.heartbeatTimeouts),
});

export class HealthService {
  private realtimeHealthProvider?: RealtimeHealthProvider;

  public setRealtimeHealthProvider(provider: RealtimeHealthProvider): void {
    this.realtimeHealthProvider = provider;
  }

  public getAppHealth(): AppHealthStatus {
    return {
      status: "ok",
    };
  }

  public async getDatabaseHealth(): Promise<DatabaseHealthStatus> {
    try {
      await checkDatabaseConnection();
    } catch {
      throw new AppError(503, "DATABASE_ERROR", "Database health check failed", {
        database: "mysql",
      });
    }

    return {
      status: "ok",
      database: "mysql",
    };
  }

  public getRuntimeHealth(): RuntimeHealthStatus {
    const memoryUsage = process.memoryUsage();
    const runtimeHealth: RuntimeHealthStatus = {
      status: "ok",
      environment: env.app.nodeEnv,
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
      },
    };

    if (!this.realtimeHealthProvider) {
      return runtimeHealth;
    }

    runtimeHealth.realtime = sanitizeRealtimeHealthSnapshot(
      this.realtimeHealthProvider()
    );

    return runtimeHealth;
  }
}

export const healthService = new HealthService();
