import bcrypt from "bcrypt";
import { env } from "../../config/env";

export class AuthPasswordService {
  // Security contract: never return raw passwords from helper methods.
  public async hashPassword(rawPassword: string): Promise<string> {
    try {
      return await bcrypt.hash(rawPassword, env.auth.bcryptCost);
    } catch {
      throw new Error("Password hashing failed");
    }
  }

  public async comparePassword(
    rawPassword: string,
    passwordHash: string,
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(rawPassword, passwordHash);
    } catch {
      throw new Error("Password comparison failed");
    }
  }
}

export const authPasswordService = new AuthPasswordService();
