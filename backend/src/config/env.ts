import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export type NodeEnv = "development" | "test" | "production";

export type RateLimitStore = "memory";

const nodeEnvSchema = z.enum(["development", "test", "production"]);
const booleanLikeSchema = z.enum(["true", "false", "1", "0"]);
const logLevelSchema = z.enum([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);

export const envSchema = z
  .object({
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
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive(),
  JWT_REFRESH_SECRET: z.string(),
  DEVICE_TOKEN_HASH_SECRET: z.string().trim().min(1),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive(),
  VERIFICATION_CODE_TTL_SECONDS: z.coerce.number().int().positive(),
  PENDING_REGISTRATION_TTL_SECONDS: z.coerce.number().int().positive(),
  AUTH_BCRYPT_COST: z.coerce.number().int().positive(),
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().positive().max(65535).optional(),
  SMTP_SECURE: booleanLikeSchema.optional(),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASSWORD: z.string().trim().optional(),
  SMTP_FROM_EMAIL: z.string().trim().email().optional(),
  SMTP_FROM_NAME: z.string().trim().optional(),
  AWS_REGION: z.string(),
  S3_BUCKET_NAME: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "test") {
      return;
    }

    const requiredSmtpKeys: Array<keyof typeof data> = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_SECURE",
      "SMTP_USER",
      "SMTP_PASSWORD",
      "SMTP_FROM_EMAIL",
      "SMTP_FROM_NAME",
    ];

    for (const key of requiredSmtpKeys) {
      const value = data[key];
      if (value === undefined || value === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "missing or invalid value",
        });
      }
    }
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
    jwtAccessTokenTtlSeconds: number;
    jwtRefreshSecret: string;
    refreshTokenTtlDays: number;
    verificationCodeTtlSeconds: number;
    pendingRegistrationTtlSeconds: number;
    bcryptCost: number;
  };
  computers: {
    deviceTokenHashSecret: string;
  };
  smtp: {
    useMockSender: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromEmail: string;
    fromName: string;
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
    jwtAccessTokenTtlSeconds: parsedEnv.JWT_ACCESS_TOKEN_TTL_SECONDS,
    jwtRefreshSecret: parsedEnv.JWT_REFRESH_SECRET,
    refreshTokenTtlDays: parsedEnv.REFRESH_TOKEN_TTL_DAYS,
    verificationCodeTtlSeconds: parsedEnv.VERIFICATION_CODE_TTL_SECONDS,
    pendingRegistrationTtlSeconds: parsedEnv.PENDING_REGISTRATION_TTL_SECONDS,
    bcryptCost: parsedEnv.AUTH_BCRYPT_COST,
  },
  computers: {
    deviceTokenHashSecret: parsedEnv.DEVICE_TOKEN_HASH_SECRET,
  },
  smtp: {
    useMockSender: parsedEnv.NODE_ENV === "test",
    host: parsedEnv.SMTP_HOST ?? "",
    port: parsedEnv.SMTP_PORT ?? 0,
    secure:
      parsedEnv.SMTP_SECURE === undefined
        ? false
        : parsedEnv.SMTP_SECURE === "true" || parsedEnv.SMTP_SECURE === "1",
    user: parsedEnv.SMTP_USER ?? "",
    password: parsedEnv.SMTP_PASSWORD ?? "",
    fromEmail: parsedEnv.SMTP_FROM_EMAIL ?? "",
    fromName: parsedEnv.SMTP_FROM_NAME ?? "",
  },
  aws: {
    region: parsedEnv.AWS_REGION,
    s3BucketName: parsedEnv.S3_BUCKET_NAME,
  },
};
