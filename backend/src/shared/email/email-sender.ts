import { VerificationPurpose } from "@prisma/client";

export interface EmailSender {
  sendVerificationCode(
    email: string,
    code: string,
    purpose: VerificationPurpose,
  ): Promise<void>;
}
