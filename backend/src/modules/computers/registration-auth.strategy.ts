import { authPasswordService } from "../auth/auth.password";

interface PasswordComparator {
  comparePassword(rawPassword: string, passwordHash: string): Promise<boolean>;
}

export interface RegistrationAuthStrategy {
  verify(submittedSecret: string, storedSecretHash: string | null): Promise<boolean>;
}

export class TenantSecretStrategy implements RegistrationAuthStrategy {
  constructor(private readonly passwordComparator: PasswordComparator = authPasswordService) {}

  async verify(
    submittedSecret: string,
    storedSecretHash: string | null,
  ): Promise<boolean> {
    if (!storedSecretHash) {
      return false;
    }

    return this.passwordComparator.comparePassword(submittedSecret, storedSecretHash);
  }
}

export const registrationAuthStrategy = new TenantSecretStrategy();
