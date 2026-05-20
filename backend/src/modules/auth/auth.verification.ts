import { createHmac, randomInt } from "node:crypto";
import { env } from "../../config/env";

const VERIFICATION_CODE_MIN = 0;
const VERIFICATION_CODE_MAX_EXCLUSIVE = 1_000_000;
const VERIFICATION_CODE_LENGTH = 6;
const VERIFICATION_CODE_MAX_FAILED_ATTEMPTS = 5;

export type VerificationCodeStateInput = {
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
};

export type VerificationCodeState = {
  isExpired: boolean;
  isConsumed: boolean;
  isOverAttempted: boolean;
  isInvalid: boolean;
};

export class AuthVerificationService {
  public getVerificationCodeTtlSeconds(): number {
    return env.auth.verificationCodeTtlSeconds;
  }

  public getPendingRegistrationTtlSeconds(): number {
    return env.auth.pendingRegistrationTtlSeconds;
  }

  public getVerificationCodeMaxFailedAttempts(): number {
    return VERIFICATION_CODE_MAX_FAILED_ATTEMPTS;
  }

  public generateVerificationCode(): string {
    return randomInt(VERIFICATION_CODE_MIN, VERIFICATION_CODE_MAX_EXCLUSIVE)
      .toString()
      .padStart(VERIFICATION_CODE_LENGTH, "0");
  }

  public hashVerificationCode(verificationCode: string): string {
    return createHmac("sha256", env.auth.jwtRefreshSecret)
      .update(verificationCode)
      .digest("hex");
  }

  public compareVerificationCode(
    verificationCode: string,
    verificationCodeHash: string,
  ): boolean {
    return this.hashVerificationCode(verificationCode) === verificationCodeHash;
  }

  public getVerificationCodeState(
    verificationCode: VerificationCodeStateInput,
    now: Date = new Date(),
  ): VerificationCodeState {
    const isExpired = verificationCode.expiresAt.getTime() <= now.getTime();
    const isConsumed = verificationCode.consumedAt !== null;
    const isOverAttempted =
      verificationCode.attemptCount >= this.getVerificationCodeMaxFailedAttempts();

    return {
      isExpired,
      isConsumed,
      isOverAttempted,
      isInvalid: isExpired || isConsumed || isOverAttempted,
    };
  }
}

export const authVerificationService = new AuthVerificationService();
