import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export type NodeEnv = "development" | "test" | "production";

export type RateLimitStore = "memory";

const nodeEnvSchema = z.enum(["development", "test", "production"]);
const logLevelSchema = z.enum([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);

export const envSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().positive().max(65535),
  DATABASE_URL: z.string().trim().min(1).startsWith("mysql://"),
  CORS_ORIGIN: z.string().trim().regex(/^https?:\/\/[^/]+$/),
  LOG_LEVEL: logLevelSchema,
  JSON_BODY_LIMIT: z.string().trim().min(1),
  URLENCODED_BODY_LIMIT: z.string().trim().min(1),
  RATE_LIMIT_DEFAULT_CAPACITY: z.coerce.number().positive(),
  RATE_LIMIT_DEFAULT_REFILL_TOKENS: z.coerce.number().positive(),
  RATE_LIMIT_DEFAULT_REFILL_WINDOW_SECONDS: z.coerce.number().positive(),
  RATE_LIMIT_STORE: z.literal("memory"),
  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  AWS_REGION: z.string(),
  S3_BUCKET_NAME: z.string(),
});

export interface Env {
  app: {
    nodeEnv: NodeEnv;
    corsOrigin: string;
    jsonBodyLimit: string;
    urlEncodedBodyLimit: string;
  };
  server: {
    port: number;
  };
  logging: {
    level: z.infer<typeof logLevelSchema>;
  };
  prisma: {
    databaseUrl: string;
  };
  rateLimit: {
    store: RateLimitStore;
    defaultCapacity: number;
    defaultRefillTokens: number;
    defaultRefillWindowSeconds: number;
  };
  auth: {
    jwtAccessSecret: string;
    jwtRefreshSecret: string;
  };
  aws: {
    region: string;
    s3BucketName: string;
  };
}

const parsedEnvResult = envSchema.safeParse(process.env);

if (!parsedEnvResult.success) {
  const issues = parsedEnvResult.error.issues.map((issue) => {
    const key = issue.path.join(".") || "UNKNOWN_KEY";
    return `${key}: missing or invalid value`;
  });

  throw new Error(
    `Environment validation failed at startup. Fix invalid or missing variables in .env. ${issues.join("; ")}`,
  );
}

const parsedEnv = parsedEnvResult.data;

export const env: Env = {
  app: {
    nodeEnv: parsedEnv.NODE_ENV,
    corsOrigin: parsedEnv.CORS_ORIGIN,
    jsonBodyLimit: parsedEnv.JSON_BODY_LIMIT,
    urlEncodedBodyLimit: parsedEnv.URLENCODED_BODY_LIMIT,
  },
  server: {
    port: parsedEnv.PORT,
  },
  logging: {
    level: parsedEnv.LOG_LEVEL,
  },
  prisma: {
    databaseUrl: parsedEnv.DATABASE_URL,
  },
  rateLimit: {
    store: parsedEnv.RATE_LIMIT_STORE,
    defaultCapacity: parsedEnv.RATE_LIMIT_DEFAULT_CAPACITY,
    defaultRefillTokens: parsedEnv.RATE_LIMIT_DEFAULT_REFILL_TOKENS,
    defaultRefillWindowSeconds: parsedEnv.RATE_LIMIT_DEFAULT_REFILL_WINDOW_SECONDS,
  },
  auth: {
    jwtAccessSecret: parsedEnv.JWT_ACCESS_SECRET,
    jwtRefreshSecret: parsedEnv.JWT_REFRESH_SECRET,
  },
  aws: {
    region: parsedEnv.AWS_REGION,
    s3BucketName: parsedEnv.S3_BUCKET_NAME,
  },
};
