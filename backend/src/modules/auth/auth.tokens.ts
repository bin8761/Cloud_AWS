import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { env } from "../../config/env";
import type { AuthRole } from "./auth.types";

export const AUTH_TOKEN_TYPES = {
  ACCESS: "access",
  REFRESH: "refresh",
} as const;

export type AuthTokenType =
  (typeof AUTH_TOKEN_TYPES)[keyof typeof AUTH_TOKEN_TYPES];

const REFRESH_TOKEN_BYTES = 48;
const JWT_ACCESS_ALG = "HS256";
const jwtAccessSecretKey = new TextEncoder().encode(env.auth.jwtAccessSecret);

export type AccessTokenClaimsInput = {
  sub: string;
  tenantId: string | null;
  role: AuthRole;
};

export const AUTH_TOKEN_ERROR_CODES = {
  INVALID_ACCESS_TOKEN: "INVALID_ACCESS_TOKEN",
  ACCESS_TOKEN_SIGN_FAILED: "ACCESS_TOKEN_SIGN_FAILED",
} as const;

export type AuthTokenErrorCode =
  (typeof AUTH_TOKEN_ERROR_CODES)[keyof typeof AUTH_TOKEN_ERROR_CODES];

export class AuthTokenError extends Error {
  public readonly code: AuthTokenErrorCode;

  public constructor(code: AuthTokenErrorCode, message: string) {
    super(message);
    this.name = "AuthTokenError";
    this.code = code;
  }
}

export class AuthTokenService {
  public generateRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
  }

  public generateRefreshTokenFamilyId(): string {
    return randomUUID();
  }

  public hashRefreshToken(refreshToken: string): string {
    return createHmac("sha256", env.auth.jwtRefreshSecret)
      .update(refreshToken)
      .digest("hex");
  }

  public async signAccessToken(payload: AccessTokenClaimsInput): Promise<string> {
    try {
      return await new SignJWT({
        sub: payload.sub,
        tenantId: payload.tenantId,
        role: payload.role,
        tokenType: AUTH_TOKEN_TYPES.ACCESS,
      })
        .setProtectedHeader({ alg: JWT_ACCESS_ALG, typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + env.auth.jwtAccessTokenTtlSeconds)
        .sign(jwtAccessSecretKey);
    } catch {
      throw new AuthTokenError(
        AUTH_TOKEN_ERROR_CODES.ACCESS_TOKEN_SIGN_FAILED,
        "Access token signing failed",
      );
    }
  }

  public async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const verified = await jwtVerify(token, jwtAccessSecretKey, {
        algorithms: [JWT_ACCESS_ALG],
      });

      if (verified.payload.tokenType !== AUTH_TOKEN_TYPES.ACCESS) {
        throw new AuthTokenError(
          AUTH_TOKEN_ERROR_CODES.INVALID_ACCESS_TOKEN,
          "Invalid access token",
        );
      }

      return verified.payload;
    } catch {
      throw new AuthTokenError(
        AUTH_TOKEN_ERROR_CODES.INVALID_ACCESS_TOKEN,
        "Invalid access token",
      );
    }
  }
}

export const authTokenService = new AuthTokenService();
