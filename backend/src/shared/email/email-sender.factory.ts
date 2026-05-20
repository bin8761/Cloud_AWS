import { env } from "../../config/env.js";

import { type EmailSender } from "./email-sender.js";
import { MockEmailSender } from "./mock-email-sender.js";
import { createSmtpEmailSenderFromEnv } from "./smtp-email-sender.js";

export const createEmailSender = (): EmailSender => {
  if (env.smtp.useMockSender) {
    return new MockEmailSender();
  }

  return createSmtpEmailSenderFromEnv();
};
