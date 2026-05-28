import { VerificationPurpose } from "@prisma/client";
import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import { env } from "../../config/env.js";

import { type EmailSender } from "./email-sender.js";

export interface SmtpEmailSenderOptions {
  transporter: Transporter;
  fromEmail: string;
  fromName: string;
}

export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(options: SmtpEmailSenderOptions) {
    this.transporter = options.transporter;
    this.from = `${options.fromName} <${options.fromEmail}>`;
  }

  async sendVerificationCode(
    email: string,
    code: string,
    purpose: VerificationPurpose,
  ): Promise<void> {
    const subject = this.buildSubject(purpose);
    const text = this.buildText(code, purpose);

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject,
        text,
      });
    } catch {
      throw new Error("SMTP_SEND_FAILED");
    }
  }

  private buildSubject(purpose: VerificationPurpose): string {
    switch (purpose) {
      case VerificationPurpose.REGISTER_TENANT:
        return "CloudCMS registration verification code";
      default:
        return "CloudCMS verification code";
    }
  }

  private buildText(code: string, purpose: VerificationPurpose): string {
    switch (purpose) {
      case VerificationPurpose.REGISTER_TENANT:
        return `Your CloudCMS registration verification code is: ${code}`;
      default:
        return `Your CloudCMS verification code is: ${code}`;
    }
  }
}

export const createSmtpTransporter = (
  options: SMTPTransport.Options,
): Transporter => {
  return nodemailer.createTransport(options);
};

const assertSmtpConfig = (): void => {
  const missingKeys: string[] = [];

  if (!env.smtp.host) {
    missingKeys.push("SMTP_HOST");
  }

  if (!env.smtp.port || env.smtp.port <= 0) {
    missingKeys.push("SMTP_PORT");
  }

  if (!env.smtp.user) {
    missingKeys.push("SMTP_USER");
  }

  if (!env.smtp.password) {
    missingKeys.push("SMTP_PASSWORD");
  }

  if (!env.smtp.fromEmail) {
    missingKeys.push("SMTP_FROM_EMAIL");
  }

  if (!env.smtp.fromName) {
    missingKeys.push("SMTP_FROM_NAME");
  }

  if (missingKeys.length > 0) {
    throw new Error(
      `SMTP_CONFIG_MISSING: ${missingKeys.join(", ")}. Provide required SMTP env values.`,
    );
  }
};

export const createSmtpEmailSenderFromEnv = (): EmailSender => {
  assertSmtpConfig();

  const transporter = createSmtpTransporter({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.password,
    },
  });

  return new SmtpEmailSender({
    transporter,
    fromEmail: env.smtp.fromEmail,
    fromName: env.smtp.fromName,
  });
};
