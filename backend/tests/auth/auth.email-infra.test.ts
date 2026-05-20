import { VerificationPurpose } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setBaseEnv = (): void => {
  process.env.PORT = "3001";
  process.env.DATABASE_URL = "mysql://root:password@localhost:3306/cloudcms_test";
  process.env.CORS_ORIGIN = "http://localhost:5173";
  process.env.LOG_LEVEL = "silent";
  process.env.JSON_BODY_LIMIT = "1mb";
  process.env.URLENCODED_BODY_LIMIT = "1mb";
  process.env.RATE_LIMIT_DEFAULT_CAPACITY = "100";
  process.env.RATE_LIMIT_DEFAULT_REFILL_TOKENS = "10";
  process.env.RATE_LIMIT_DEFAULT_REFILL_WINDOW_SECONDS = "60";
  process.env.RATE_LIMIT_STORE = "memory";
  process.env.JWT_ACCESS_SECRET = "test-jwt-access-secret";
  process.env.JWT_ACCESS_TOKEN_TTL_SECONDS = "3600";
  process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret";
  process.env.REFRESH_TOKEN_TTL_DAYS = "14";
  process.env.VERIFICATION_CODE_TTL_SECONDS = "600";
  process.env.PENDING_REGISTRATION_TTL_SECONDS = "1200";
  process.env.AUTH_BCRYPT_COST = "4";
  process.env.AWS_REGION = "ap-southeast-1";
  process.env.S3_BUCKET_NAME = "cloudcms-test-bucket";
};

const setTestEnv = (): void => {
  setBaseEnv();
  process.env.NODE_ENV = "test";
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_SECURE;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  delete process.env.SMTP_FROM_EMAIL;
  delete process.env.SMTP_FROM_NAME;
};

describe.sequential("Auth email infra tests (Task 342, 345, 346)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock("../../src/config/env.js");
    vi.doUnmock("nodemailer");
  });

  it("Task 342: test environment uses MockEmailSender", async () => {
    setTestEnv();

    const { createEmailSender } = await import("../../src/shared/email/email-sender.factory");
    const { MockEmailSender } = await import("../../src/shared/email/mock-email-sender");

    const sender = createEmailSender();
    expect(sender).toBeInstanceOf(MockEmailSender);
  });

  it("Task 345: SMTP sender validates required SMTP env when selected", async () => {
    vi.doMock("../../src/config/env.js", () => ({
      env: {
        smtp: {
          useMockSender: false,
          host: "",
          port: 0,
          secure: false,
          user: "",
          password: "",
          fromEmail: "",
          fromName: "",
        },
      },
    }));

    const { createEmailSender } = await import("../../src/shared/email/email-sender.factory");

    expect(() => createEmailSender()).toThrowError(
      "SMTP_CONFIG_MISSING: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_FROM_NAME. Provide required SMTP env values.",
    );
  });

  it("Task 346: mock sender never performs network calls", async () => {
    vi.doMock("../../src/config/env.js", () => ({
      env: {
        smtp: {
          useMockSender: true,
          host: "",
          port: 0,
          secure: false,
          user: "",
          password: "",
          fromEmail: "",
          fromName: "",
        },
      },
    }));

    const createTransportSpy = vi.fn(() => ({
      sendMail: vi.fn(async () => undefined),
    }));

    vi.doMock("nodemailer", () => ({
      default: {
        createTransport: createTransportSpy,
      },
      createTransport: createTransportSpy,
    }));

    const { createEmailSender } = await import("../../src/shared/email/email-sender.factory");

    const sender = createEmailSender();
    await sender.sendVerificationCode(
      "mock-user@example.com",
      "123456",
      VerificationPurpose.REGISTER_TENANT,
    );

    expect(createTransportSpy).not.toHaveBeenCalled();
  });
});
