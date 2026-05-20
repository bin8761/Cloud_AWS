import { type VerificationPurpose } from "@prisma/client";

import { type EmailSender } from "./email-sender.js";

export interface MockSentEmail {
  email: string;
  code: string;
  purpose: VerificationPurpose;
}

export class MockEmailSender implements EmailSender {
  private readonly sentEmails: MockSentEmail[] = [];

  async sendVerificationCode(
    email: string,
    code: string,
    purpose: VerificationPurpose,
  ): Promise<void> {
    this.sentEmails.push({
      email,
      code,
      purpose,
    });
  }

  getSentEmails(): readonly MockSentEmail[] {
    return this.sentEmails;
  }

  clear(): void {
    this.sentEmails.length = 0;
  }
}
