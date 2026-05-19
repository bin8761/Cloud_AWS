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
}

export class HealthService {
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

    return {
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
  }
}

export const healthService = new HealthService();
