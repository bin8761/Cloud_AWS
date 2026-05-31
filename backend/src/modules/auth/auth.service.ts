import {
  TenantStatus,
  UserRole,
  UserStatus,
  VerificationPurpose,
  VerificationTargetType,
} from "@prisma/client";

import { AppError } from "../../shared/errors/app-error";
import { env } from "../../config/env";
import { type EmailSender } from "../../shared/email/email-sender";
import { createEmailSender } from "../../shared/email/email-sender.factory";
import { prisma } from "../../shared/prisma/prisma.client";
import {
  generateComputerRegistrationSecret,
  hashRegistrationSecret,
} from "../computers/computers.service";
import {
  AUTH_LOG_EVENTS,
  authLoggingService,
  type AuthLoggingService,
} from "./auth.logging";
import {
  authPasswordService,
  type AuthPasswordService,
} from "./auth.password";
import {
  authTokenService,
  type AuthTokenService,
} from "./auth.tokens";
import { normalizeEmail, normalizeTenantCode } from "./auth.schema";
import {
  authVerificationService,
  type AuthVerificationService,
} from "./auth.verification";
import {
  type AuthRole,
  type ResendRegisterTenantVerificationInput,
  type ResendRegisterTenantVerificationOutput,
  mapUserRoleToAuthRole,
  type GetCurrentUserOutput,
  type LoginInput,
  type LoginOutput,
  type LogoutInput,
  type LogoutOutput,
  type RefreshInput,
  type RefreshOutput,
  type RegisterTenantInput,
  type RegisterTenantOutput,
  type VerifyRegisterTenantInput,
  type VerifyRegisterTenantOutput,
} from "./auth.types";

const CONFLICT_STATUS_CODE = 409;
const FORBIDDEN_STATUS_CODE = 403;
const INTERNAL_ERROR_STATUS_CODE = 500;
const NOT_FOUND_STATUS_CODE = 404;
const UNAUTHORIZED_STATUS_CODE = 401;
const UNKNOWN_REQUEST_ID = "unknown-request-id";
const LOGIN_FAILED_MESSAGE = "Failed to process login request.";
const LOGIN_INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";
const LOGIN_USER_DISABLED_MESSAGE = "Your account is disabled.";
const LOGIN_TENANT_SUSPENDED_MESSAGE = "Your tenant is suspended.";
const ME_REQUEST_FAILED_MESSAGE = "Failed to process current user request.";
const ME_USER_NOT_FOUND_MESSAGE = "The current user no longer exists.";
const ME_USER_DISABLED_MESSAGE = "Your account is disabled.";
const REFRESH_REQUEST_FAILED_MESSAGE = "Failed to process refresh request.";
const REFRESH_TOKEN_INVALID_OR_EXPIRED_MESSAGE =
  "The refresh token is invalid or expired.";
const REGISTER_TENANT_RESEND_AFTER_SECONDS = 60;
const REGISTER_TENANT_REQUEST_FAILED_MESSAGE =
  "Failed to process tenant registration.";
const REGISTER_TENANT_VERIFY_FAILED_MESSAGE =
  "Failed to verify tenant registration.";
const REGISTER_TENANT_VERIFY_INVALID_OR_EXPIRED_MESSAGE =
  "The verification code is invalid or expired.";
const TENANT_CODE_CONFLICT_MESSAGE = "Tenant code is already in use.";
const ADMIN_EMAIL_CONFLICT_MESSAGE = "Admin email is already in use.";

type RegisterTenantRequestContext = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

type VerifyTenantRegistrationRequestContext = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

type ResendTenantRegistrationRequestContext = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

type LoginRequestContext = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

type RefreshRequestContext = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

type LogoutRequestContext = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

type GetCurrentUserRequestContext = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
  authContext?: {
    userId?: string;
    tenantId?: string | null;
    role?: AuthRole;
  };
};

type AuthServiceDependencies = {
  prismaClient?: typeof prisma;
  emailSender?: EmailSender;
  passwordService?: AuthPasswordService;
  tokenService?: AuthTokenService;
  verificationService?: AuthVerificationService;
  loggingService?: AuthLoggingService;
  nowProvider?: () => Date;
};

export class AuthService {
  private readonly prismaClient: typeof prisma;

  private readonly emailSender: EmailSender;

  private readonly passwordService: AuthPasswordService;

  private readonly tokenService: AuthTokenService;

  private readonly verificationService: AuthVerificationService;

  private readonly loggingService: AuthLoggingService;

  private readonly nowProvider: () => Date;

  constructor(dependencies: AuthServiceDependencies = {}) {
    this.prismaClient = dependencies.prismaClient ?? prisma;
    this.emailSender = dependencies.emailSender ?? createEmailSender();
    this.passwordService = dependencies.passwordService ?? authPasswordService;
    this.tokenService = dependencies.tokenService ?? authTokenService;
    this.verificationService =
      dependencies.verificationService ?? authVerificationService;
    this.loggingService = dependencies.loggingService ?? authLoggingService;
    this.nowProvider = dependencies.nowProvider ?? (() => new Date());
  }

  public async registerTenant(
    input: RegisterTenantInput,
    context: RegisterTenantRequestContext = {},
  ): Promise<RegisterTenantOutput> {
    const requestId = context.requestId ?? UNKNOWN_REQUEST_ID;
    const normalizedAdminEmail = normalizeEmail(input.adminEmail);
    const normalizedTenantCode = normalizeTenantCode(input.tenantCode);
    const normalizedTenantName = input.tenantName.trim();
    const normalizedAdminFullName = input.adminFullName.trim();

    this.logRegisterTenantRequested({
      requestId,
      normalizedAdminEmail,
      tenantCode: normalizedTenantCode,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    try {
      await this.assertTenantCodeAvailable(normalizedTenantCode);
      await this.assertAdminEmailAvailable(normalizedAdminEmail);

      const adminPasswordHash = await this.passwordService.hashPassword(
        input.adminPassword,
      );

      const rawVerificationCode =
        this.verificationService.generateVerificationCode();
      const verificationCodeHash = this.verificationService.hashVerificationCode(
        rawVerificationCode,
      );
      const verificationCodeTtlSeconds =
        this.verificationService.getVerificationCodeTtlSeconds();
      const pendingRegistrationTtlSeconds =
        this.verificationService.getPendingRegistrationTtlSeconds();
      const now = this.nowProvider();
      const verificationCodeExpiresAt = new Date(
        now.getTime() + verificationCodeTtlSeconds * 1000,
      );
      const pendingRegistrationExpiresAt = new Date(
        now.getTime() + pendingRegistrationTtlSeconds * 1000,
      );

      const registrationId = await this.createPendingTenantRegistration({
        normalizedTenantName,
        normalizedTenantCode,
        normalizedAdminFullName,
        normalizedAdminEmail,
        adminPasswordHash,
        verificationCodeHash,
        verificationCodeExpiresAt,
        pendingRegistrationExpiresAt,
        now,
      });

      await this.emailSender.sendVerificationCode(
        normalizedAdminEmail,
        rawVerificationCode,
        VerificationPurpose.REGISTER_TENANT,
      );

      this.logRegisterTenantVerificationSent({
        requestId,
        normalizedAdminEmail,
        tenantCode: normalizedTenantCode,
        ip: context.ip,
        userAgent: context.userAgent,
      });

      return {
        registrationId,
        email: normalizedAdminEmail,
        expiresInSeconds: verificationCodeTtlSeconds,
        resendAfterSeconds: REGISTER_TENANT_RESEND_AFTER_SECONDS,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        INTERNAL_ERROR_STATUS_CODE,
        "INTERNAL_ERROR",
        REGISTER_TENANT_REQUEST_FAILED_MESSAGE,
      );
    }
  }

  public async verifyTenantRegistration(
    input: VerifyRegisterTenantInput,
    context: VerifyTenantRegistrationRequestContext = {},
  ): Promise<VerifyRegisterTenantOutput> {
    const requestId = context.requestId ?? UNKNOWN_REQUEST_ID;
    let normalizedAdminEmailForLog: string | undefined;

    try {
      const pendingRegistration =
        await this.prismaClient.pendingTenantRegistration.findUnique({
          where: {
            id: input.registrationId,
          },
          include: {
            verificationCode: true,
          },
        });

      if (!pendingRegistration) {
        throw new AppError(
          UNAUTHORIZED_STATUS_CODE,
          "UNAUTHORIZED",
          REGISTER_TENANT_VERIFY_INVALID_OR_EXPIRED_MESSAGE,
        );
      }

      normalizedAdminEmailForLog = pendingRegistration.adminEmail;

      const now = this.nowProvider();
      const isPendingRegistrationExpired =
        pendingRegistration.expiresAt.getTime() <= now.getTime();
      const isPendingRegistrationConsumed = pendingRegistration.consumedAt
        ? true
        : false;
      if (isPendingRegistrationExpired || isPendingRegistrationConsumed) {
        throw new AppError(
          UNAUTHORIZED_STATUS_CODE,
          "UNAUTHORIZED",
          REGISTER_TENANT_VERIFY_INVALID_OR_EXPIRED_MESSAGE,
        );
      }

      const linkedVerificationCode = pendingRegistration.verificationCode;
      if (!linkedVerificationCode) {
        throw new AppError(
          UNAUTHORIZED_STATUS_CODE,
          "UNAUTHORIZED",
          REGISTER_TENANT_VERIFY_INVALID_OR_EXPIRED_MESSAGE,
        );
      }

      const verificationCodeState =
        this.verificationService.getVerificationCodeState(
          {
            expiresAt: linkedVerificationCode.expiresAt,
            consumedAt: linkedVerificationCode.consumedAt,
            attemptCount: linkedVerificationCode.attemptCount,
          },
          now,
        );
      if (verificationCodeState.isInvalid) {
        throw new AppError(
          UNAUTHORIZED_STATUS_CODE,
          "UNAUTHORIZED",
          REGISTER_TENANT_VERIFY_INVALID_OR_EXPIRED_MESSAGE,
        );
      }

      const isVerificationCodeMatched =
        this.verificationService.compareVerificationCode(
          input.verificationCode,
          linkedVerificationCode.codeHash,
        );
      if (!isVerificationCodeMatched) {
        await this.prismaClient.verificationCode.updateMany({
          where: {
            id: linkedVerificationCode.id,
            consumedAt: null,
          },
          data: {
            attemptCount: {
              increment: 1,
            },
          },
        });

        throw new AppError(
          UNAUTHORIZED_STATUS_CODE,
          "UNAUTHORIZED",
          REGISTER_TENANT_VERIFY_INVALID_OR_EXPIRED_MESSAGE,
        );
      }

      await this.assertTenantCodeAvailable(pendingRegistration.tenantCode);
      await this.assertAdminEmailAvailable(pendingRegistration.adminEmail);
      const computerRegistrationSecret = generateComputerRegistrationSecret();
      const computerRegistrationSecretHash = await hashRegistrationSecret(
        computerRegistrationSecret,
      );

      const createdTenant =
        await this.createActiveTenantInVerificationTransaction({
          tenantCode: pendingRegistration.tenantCode,
          tenantName: pendingRegistration.tenantName,
          computerRegistrationSecretHash,
        });
      const createdUser =
        await this.createActiveShopAdminInVerificationTransaction({
          tenantId: createdTenant.id,
          adminEmail: pendingRegistration.adminEmail,
          adminFullName: pendingRegistration.adminFullName,
          adminPasswordHash: pendingRegistration.adminPasswordHash,
        });
      const consumedAt = this.nowProvider();
      await this.markVerificationCodeConsumedInVerificationTransaction({
        verificationCodeId: linkedVerificationCode.id,
        consumedAt,
      });
      await this.markPendingRegistrationConsumedInVerificationTransaction({
        registrationId: pendingRegistration.id,
        consumedAt,
      });

      const rawRefreshToken = this.tokenService.generateRefreshToken();
      const refreshTokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
      const refreshTokenFamilyId =
        this.tokenService.generateRefreshTokenFamilyId();
      const refreshTokenExpiresAt = new Date(
        consumedAt.getTime() +
          env.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
      );
      await this.createInitialRefreshTokenInVerificationTransaction({
        userId: createdUser.id,
        tokenHash: refreshTokenHash,
        familyId: refreshTokenFamilyId,
        expiresAt: refreshTokenExpiresAt,
      });

      const accessToken =
        await this.signAccessTokenAfterVerificationTransaction({
          userId: createdUser.id,
          tenantId: createdUser.tenantId,
          role: createdUser.role,
        });

      this.logRegisterTenantCompleted({
        requestId,
        userId: createdUser.id,
        tenantId: createdTenant.id,
        role: createdUser.role,
        normalizedAdminEmail: createdUser.email,
        tenantCode: createdTenant.code,
        status: createdTenant.status,
        ip: context.ip,
        userAgent: context.userAgent,
      });

      return {
        tenant: {
          id: createdTenant.id,
          code: createdTenant.code,
          name: createdTenant.name,
          status: createdTenant.status,
        },
        user: {
          id: createdUser.id,
          email: createdUser.email,
          fullName: createdUser.fullName,
          role: mapUserRoleToAuthRole(createdUser.role),
          tenantId: createdUser.tenantId,
        },
        accessToken,
        refreshToken: rawRefreshToken,
        computerRegistrationSecret,
      };
    } catch (error) {
      if (error instanceof AppError) {
        this.logRegisterTenantVerificationFailed({
          requestId,
          normalizedAdminEmail: normalizedAdminEmailForLog,
          reason: error.code,
          status: String(error.statusCode),
          ip: context.ip,
          userAgent: context.userAgent,
        });

        throw error;
      }

      this.logRegisterTenantVerificationFailed({
        requestId,
        normalizedAdminEmail: normalizedAdminEmailForLog,
        reason: "INTERNAL_ERROR",
        status: String(INTERNAL_ERROR_STATUS_CODE),
        ip: context.ip,
        userAgent: context.userAgent,
      });

      throw new AppError(
        INTERNAL_ERROR_STATUS_CODE,
        "INTERNAL_ERROR",
        REGISTER_TENANT_VERIFY_FAILED_MESSAGE,
      );
    }
  }

  public async resendTenantRegistrationVerificationCode(
    input: ResendRegisterTenantVerificationInput,
    context: ResendTenantRegistrationRequestContext = {},
  ): Promise<ResendRegisterTenantVerificationOutput> {
    const requestId = context.requestId ?? UNKNOWN_REQUEST_ID;
    let normalizedAdminEmailForLog: string | undefined;

    try {
      const pendingRegistration =
        await this.prismaClient.pendingTenantRegistration.findUnique({
          where: {
            id: input.registrationId,
          },
          include: {
            verificationCode: true,
          },
        });

      if (!pendingRegistration || !pendingRegistration.verificationCode) {
        throw new AppError(
          UNAUTHORIZED_STATUS_CODE,
          "UNAUTHORIZED",
          REGISTER_TENANT_VERIFY_INVALID_OR_EXPIRED_MESSAGE,
        );
      }

      normalizedAdminEmailForLog = pendingRegistration.adminEmail;
      const now = this.nowProvider();
      const isPendingRegistrationExpired =
        pendingRegistration.expiresAt.getTime() <= now.getTime();
      const isPendingRegistrationConsumed = pendingRegistration.consumedAt
        ? true
        : false;
      if (isPendingRegistrationExpired || isPendingRegistrationConsumed) {
        throw new AppError(
          UNAUTHORIZED_STATUS_CODE,
          "UNAUTHORIZED",
          REGISTER_TENANT_VERIFY_INVALID_OR_EXPIRED_MESSAGE,
        );
      }

      const rawVerificationCode =
        this.verificationService.generateVerificationCode();
      const verificationCodeHash = this.verificationService.hashVerificationCode(
        rawVerificationCode,
      );
      const verificationCodeTtlSeconds =
        this.verificationService.getVerificationCodeTtlSeconds();
      const verificationCodeExpiresAt = new Date(
        now.getTime() + verificationCodeTtlSeconds * 1000,
      );

      await this.prismaClient.verificationCode.update({
        where: {
          id: pendingRegistration.verificationCode.id,
        },
        data: {
          codeHash: verificationCodeHash,
          expiresAt: verificationCodeExpiresAt,
          consumedAt: null,
          attemptCount: 0,
          lastSentAt: now,
        },
      });

      await this.emailSender.sendVerificationCode(
        pendingRegistration.adminEmail,
        rawVerificationCode,
        VerificationPurpose.REGISTER_TENANT,
      );

      this.logRegisterTenantVerificationSent({
        requestId,
        normalizedAdminEmail: pendingRegistration.adminEmail,
        tenantCode: pendingRegistration.tenantCode,
        ip: context.ip,
        userAgent: context.userAgent,
      });

      return {
        registrationId: pendingRegistration.id,
        email: pendingRegistration.adminEmail,
        expiresInSeconds: verificationCodeTtlSeconds,
        resendAfterSeconds: REGISTER_TENANT_RESEND_AFTER_SECONDS,
      };
    } catch (error) {
      if (error instanceof AppError) {
        this.logRegisterTenantVerificationFailed({
          requestId,
          normalizedAdminEmail: normalizedAdminEmailForLog,
          reason: error.code,
          status: String(error.statusCode),
          ip: context.ip,
          userAgent: context.userAgent,
        });

        throw error;
      }

      this.logRegisterTenantVerificationFailed({
        requestId,
        normalizedAdminEmail: normalizedAdminEmailForLog,
        reason: "INTERNAL_ERROR",
        status: String(INTERNAL_ERROR_STATUS_CODE),
        ip: context.ip,
        userAgent: context.userAgent,
      });

      throw new AppError(
        INTERNAL_ERROR_STATUS_CODE,
        "INTERNAL_ERROR",
        REGISTER_TENANT_REQUEST_FAILED_MESSAGE,
      );
    }
  }

  public async login(
    input: LoginInput,
    context: LoginRequestContext = {},
  ): Promise<LoginOutput> {
    const requestId = context.requestId ?? UNKNOWN_REQUEST_ID;
    const normalizedEmail = normalizeEmail(input.email);
    let userIdForLog: string | undefined;
    let tenantIdForLog: string | null | undefined;
    let roleForLog: UserRole | undefined;

    try {
      const userWithTenant = await this.prismaClient.user.findUnique({
        where: {
          email: normalizedEmail,
        },
        select: {
          id: true,
          tenantId: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          passwordHash: true,
          tenant: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (!userWithTenant) {
        throw new AppError(
          UNAUTHORIZED_STATUS_CODE,
          "UNAUTHORIZED",
          LOGIN_INVALID_CREDENTIALS_MESSAGE,
        );
      }

      userIdForLog = userWithTenant.id;
      tenantIdForLog = userWithTenant.tenantId;
      roleForLog = userWithTenant.role;

      const isPasswordMatched = await this.passwordService.comparePassword(
        input.password,
        userWithTenant.passwordHash,
      );
      if (!isPasswordMatched) {
        throw new AppError(
          UNAUTHORIZED_STATUS_CODE,
          "UNAUTHORIZED",
          LOGIN_INVALID_CREDENTIALS_MESSAGE,
        );
      }

      if (userWithTenant.status === UserStatus.DISABLED) {
        throw new AppError(
          FORBIDDEN_STATUS_CODE,
          "FORBIDDEN",
          LOGIN_USER_DISABLED_MESSAGE,
        );
      }

      const isTenantUserRole =
        userWithTenant.role === UserRole.SHOP_ADMIN ||
        userWithTenant.role === UserRole.STAFF;
      const isSuspendedTenant =
        userWithTenant.tenant?.status === TenantStatus.SUSPENDED;
      if (isTenantUserRole && (!userWithTenant.tenant || isSuspendedTenant)) {
        throw new AppError(
          FORBIDDEN_STATUS_CODE,
          "FORBIDDEN",
          LOGIN_TENANT_SUSPENDED_MESSAGE,
        );
      }

      const now = this.nowProvider();
      await this.prismaClient.user.update({
        where: {
          id: userWithTenant.id,
        },
        data: {
          lastLoginAt: now,
        },
        select: {
          id: true,
        },
      });

      const rawRefreshToken = this.tokenService.generateRefreshToken();
      const refreshTokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
      const refreshTokenFamilyId =
        this.tokenService.generateRefreshTokenFamilyId();
      const refreshTokenExpiresAt = new Date(
        now.getTime() +
          env.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
      );
      await this.prismaClient.refreshToken.create({
        data: {
          userId: userWithTenant.id,
          tokenHash: refreshTokenHash,
          familyId: refreshTokenFamilyId,
          expiresAt: refreshTokenExpiresAt,
        },
        select: {
          id: true,
        },
      });

      const accessToken = await this.tokenService.signAccessToken({
        sub: userWithTenant.id,
        tenantId: userWithTenant.tenantId,
        role: mapUserRoleToAuthRole(userWithTenant.role),
      });

      this.logLoginSucceeded({
        requestId,
        userId: userWithTenant.id,
        tenantId: userWithTenant.tenantId,
        role: userWithTenant.role,
        normalizedEmail,
        ip: context.ip,
        userAgent: context.userAgent,
      });

      return {
        user: {
          id: userWithTenant.id,
          email: userWithTenant.email,
          fullName: userWithTenant.fullName,
          role: mapUserRoleToAuthRole(userWithTenant.role),
          tenantId: userWithTenant.tenantId,
        },
        accessToken,
        refreshToken: rawRefreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) {
        this.logLoginFailed({
          requestId,
          normalizedEmail,
          userId: userIdForLog,
          tenantId: tenantIdForLog,
          role: roleForLog,
          reason: error.code,
          status: String(error.statusCode),
          ip: context.ip,
          userAgent: context.userAgent,
        });

        throw error;
      }

      this.logLoginFailed({
        requestId,
        normalizedEmail,
        userId: userIdForLog,
        tenantId: tenantIdForLog,
        role: roleForLog,
        reason: "INTERNAL_ERROR",
        status: String(INTERNAL_ERROR_STATUS_CODE),
        ip: context.ip,
        userAgent: context.userAgent,
      });

      throw new AppError(
        INTERNAL_ERROR_STATUS_CODE,
        "INTERNAL_ERROR",
        LOGIN_FAILED_MESSAGE,
      );
    }
  }

  public async refresh(
    input: RefreshInput,
    context: RefreshRequestContext = {},
  ): Promise<RefreshOutput> {
    const requestId = context.requestId ?? UNKNOWN_REQUEST_ID;
    const submittedRefreshToken = input.refreshToken;
    let userIdForLog: string | undefined;
    let tenantIdForLog: string | null | undefined;
    let roleForLog: UserRole | undefined;
    let normalizedEmailForLog: string | undefined;

    try {
      const submittedRefreshTokenHash =
        this.tokenService.hashRefreshToken(submittedRefreshToken);
      const matchingRefreshToken = await this.prismaClient.refreshToken.findUnique(
        {
          where: {
            tokenHash: submittedRefreshTokenHash,
          },
          select: {
            id: true,
            userId: true,
            familyId: true,
            expiresAt: true,
            revokedAt: true,
            replacedByTokenId: true,
            user: {
              select: {
                id: true,
                tenantId: true,
                email: true,
                fullName: true,
                role: true,
                status: true,
                tenant: {
                  select: {
                    id: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      );

      if (!matchingRefreshToken) {
        throw new AppError(
          UNAUTHORIZED_STATUS_CODE,
          "UNAUTHORIZED",
          REFRESH_TOKEN_INVALID_OR_EXPIRED_MESSAGE,
        );
      }

      userIdForLog = matchingRefreshToken.user.id;
      tenantIdForLog = matchingRefreshToken.user.tenantId;
      roleForLog = matchingRefreshToken.user.role;
      normalizedEmailForLog = matchingRefreshToken.user.email;

      const now = this.nowProvider();
      const isRefreshTokenExpired =
        matchingRefreshToken.expiresAt.getTime() <= now.getTime();
      if (isRefreshTokenExpired) {
        throw new AppError(
          UNAUTHORIZED_STATUS_CODE,
          "UNAUTHORIZED",
          REFRESH_TOKEN_INVALID_OR_EXPIRED_MESSAGE,
        );
      }

      const isRefreshTokenRevoked = matchingRefreshToken.revokedAt !== null;
      if (isRefreshTokenRevoked) {
        throw new AppError(
          UNAUTHORIZED_STATUS_CODE,
          "UNAUTHORIZED",
          REFRESH_TOKEN_INVALID_OR_EXPIRED_MESSAGE,
        );
      }

      if (matchingRefreshToken.user.status === UserStatus.DISABLED) {
        throw new AppError(
          FORBIDDEN_STATUS_CODE,
          "FORBIDDEN",
          LOGIN_USER_DISABLED_MESSAGE,
        );
      }

      const isTenantUserRole =
        matchingRefreshToken.user.role === UserRole.SHOP_ADMIN ||
        matchingRefreshToken.user.role === UserRole.STAFF;
      const isSuspendedTenant =
        matchingRefreshToken.user.tenant?.status === TenantStatus.SUSPENDED;
      if (
        isTenantUserRole &&
        (!matchingRefreshToken.user.tenant || isSuspendedTenant)
      ) {
        throw new AppError(
          FORBIDDEN_STATUS_CODE,
          "FORBIDDEN",
          LOGIN_TENANT_SUSPENDED_MESSAGE,
        );
      }

      const rawReplacementRefreshToken = this.tokenService.generateRefreshToken();
      const replacementRefreshTokenHash = this.tokenService.hashRefreshToken(
        rawReplacementRefreshToken,
      );
      const replacementRefreshTokenFamilyId = matchingRefreshToken.familyId;
      const replacementRefreshTokenExpiresAt = new Date(
        now.getTime() +
          env.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
      );

      const refreshTokenRotationResult = await this.prismaClient.$transaction(
        async (transaction) => {
          const replacementToken = await transaction.refreshToken.create({
            data: {
              userId: matchingRefreshToken.userId,
              tokenHash: replacementRefreshTokenHash,
              familyId: replacementRefreshTokenFamilyId,
              expiresAt: replacementRefreshTokenExpiresAt,
            },
            select: {
              id: true,
              userId: true,
              familyId: true,
              expiresAt: true,
              revokedAt: true,
              replacedByTokenId: true,
            },
          });

          const revokedToken = await transaction.refreshToken.update({
            where: {
              id: matchingRefreshToken.id,
            },
            data: {
              revokedAt: now,
              replacedByTokenId: replacementToken.id,
            },
            select: {
              id: true,
              userId: true,
              familyId: true,
              expiresAt: true,
              revokedAt: true,
              replacedByTokenId: true,
            },
          });

          return {
            revokedToken,
            replacementToken,
          };
        },
      );

      const newAccessToken = await this.tokenService.signAccessToken({
        sub: matchingRefreshToken.user.id,
        tenantId: matchingRefreshToken.user.tenantId,
        role: mapUserRoleToAuthRole(matchingRefreshToken.user.role),
      });

      this.logRefreshSucceeded({
        requestId,
        userId: matchingRefreshToken.user.id,
        tenantId: matchingRefreshToken.user.tenantId,
        role: matchingRefreshToken.user.role,
        normalizedEmail: matchingRefreshToken.user.email,
        ip: context.ip,
        userAgent: context.userAgent,
      });

      void requestId;
      void matchingRefreshToken;
      void refreshTokenRotationResult;

      return {
        accessToken: newAccessToken,
        refreshToken: rawReplacementRefreshToken,
      };
    } catch (error) {
      if (error instanceof AppError) {
        this.logRefreshFailed({
          requestId,
          normalizedEmail: normalizedEmailForLog,
          reason: error.code,
          status: String(error.statusCode),
          userId: userIdForLog,
          tenantId: tenantIdForLog,
          role: roleForLog,
          ip: context.ip,
          userAgent: context.userAgent,
        });

        throw error;
      }

      this.logRefreshFailed({
        requestId,
        normalizedEmail: normalizedEmailForLog,
        reason: "INTERNAL_ERROR",
        status: String(INTERNAL_ERROR_STATUS_CODE),
        userId: userIdForLog,
        tenantId: tenantIdForLog,
        role: roleForLog,
        ip: context.ip,
        userAgent: context.userAgent,
      });

      throw new AppError(
        INTERNAL_ERROR_STATUS_CODE,
        "INTERNAL_ERROR",
        REFRESH_REQUEST_FAILED_MESSAGE,
      );
    }
  }

  public async logout(
    input: LogoutInput,
    context: LogoutRequestContext = {},
  ): Promise<LogoutOutput> {
    const requestId = context.requestId ?? UNKNOWN_REQUEST_ID;
    const submittedRefreshToken = input.refreshToken;
    const submittedRefreshTokenHash =
      this.tokenService.hashRefreshToken(submittedRefreshToken);
    const now = this.nowProvider();
    let userIdForLog: string | undefined;
    const matchingRefreshToken = await this.prismaClient.refreshToken.findUnique({
      where: {
        tokenHash: submittedRefreshTokenHash,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    if (!matchingRefreshToken) {
      this.logLogoutCompleted({
        requestId,
        reason: "TOKEN_NOT_FOUND",
        status: "SUCCESS",
        ip: context.ip,
        userAgent: context.userAgent,
      });

      return {
        loggedOut: true,
      };
    }

    userIdForLog = matchingRefreshToken.userId;

    const isRefreshTokenExpired =
      matchingRefreshToken.expiresAt.getTime() <= now.getTime();
    if (isRefreshTokenExpired) {
      this.logLogoutCompleted({
        requestId,
        userId: userIdForLog,
        reason: "TOKEN_EXPIRED",
        status: "SUCCESS",
        ip: context.ip,
        userAgent: context.userAgent,
      });

      return {
        loggedOut: true,
      };
    }

    const isRefreshTokenAlreadyRevoked = matchingRefreshToken.revokedAt !== null;
    if (isRefreshTokenAlreadyRevoked) {
      this.logLogoutCompleted({
        requestId,
        userId: userIdForLog,
        reason: "TOKEN_ALREADY_REVOKED",
        status: "SUCCESS",
        ip: context.ip,
        userAgent: context.userAgent,
      });

      return {
        loggedOut: true,
      };
    }

    const revokeResult = await this.prismaClient.refreshToken.updateMany({
      where: {
        id: matchingRefreshToken.id,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    const logoutReason =
      revokeResult.count > 0 ? "TOKEN_REVOKED" : "TOKEN_ALREADY_REVOKED";
    this.logLogoutCompleted({
      requestId,
      userId: userIdForLog,
      reason: logoutReason,
      status: "SUCCESS",
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return {
      loggedOut: true,
    };
  }

  public async getCurrentUser(
    context: GetCurrentUserRequestContext = {},
  ): Promise<GetCurrentUserOutput> {
    const requestId = context.requestId ?? UNKNOWN_REQUEST_ID;
    const currentUserId = context.authContext?.userId;
    const currentTenantId = context.authContext?.tenantId;
    const currentRole = context.authContext?.role;
    const currentUser = currentUserId
      ? await this.prismaClient.user.findUnique({
          where: {
            id: currentUserId,
          },
          select: {
            id: true,
            tenantId: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
          },
        })
      : null;

    if (!currentUser) {
      throw new AppError(
        NOT_FOUND_STATUS_CODE,
        "NOT_FOUND",
        ME_USER_NOT_FOUND_MESSAGE,
      );
    }

    if (currentUser.status === UserStatus.DISABLED) {
      throw new AppError(
        FORBIDDEN_STATUS_CODE,
        "FORBIDDEN",
        ME_USER_DISABLED_MESSAGE,
      );
    }

    const isTenantUserRole =
      currentUser.role === UserRole.SHOP_ADMIN ||
      currentUser.role === UserRole.STAFF;
    const isSuperAdminRole = currentUser.role === UserRole.SUPER_ADMIN;
    const currentTenant =
      isTenantUserRole && currentUser.tenantId
        ? await this.prismaClient.tenant.findUnique({
            where: {
              id: currentUser.tenantId,
            },
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
            },
          })
        : null;

    const isSuspendedTenant = currentTenant?.status === TenantStatus.SUSPENDED;
    if (isTenantUserRole && isSuspendedTenant) {
      throw new AppError(
        FORBIDDEN_STATUS_CODE,
        "FORBIDDEN",
        LOGIN_TENANT_SUSPENDED_MESSAGE,
      );
    }
    const tenantForCurrentUser = isSuperAdminRole ? null : currentTenant;
    const authRole = mapUserRoleToAuthRole(currentUser.role);
    const currentUserOutput: GetCurrentUserOutput = {
      user: {
        id: currentUser.id,
        email: currentUser.email,
        fullName: currentUser.fullName,
        role: authRole,
        tenantId: currentUser.tenantId,
      },
      tenant: tenantForCurrentUser
        ? {
            id: tenantForCurrentUser.id,
            code: tenantForCurrentUser.code,
            name: tenantForCurrentUser.name,
            status: tenantForCurrentUser.status,
          }
        : null,
    };

    this.logMeLoaded({
      requestId,
      userId: currentUser.id,
      tenantId: currentUser.tenantId,
      role: authRole,
      normalizedEmail: currentUser.email,
      ip: context.ip,
      userAgent: context.userAgent,
    });

    void currentTenantId;
    void currentRole;

    return currentUserOutput;
  }

  private async assertTenantCodeAvailable(tenantCode: string): Promise<void> {
    const existingTenant = await this.prismaClient.tenant.findUnique({
      where: {
        code: tenantCode,
      },
      select: {
        id: true,
      },
    });

    if (existingTenant) {
      throw new AppError(
        CONFLICT_STATUS_CODE,
        "CONFLICT",
        TENANT_CODE_CONFLICT_MESSAGE,
        {
          field: "tenantCode",
        },
      );
    }
  }

  private async assertAdminEmailAvailable(email: string): Promise<void> {
    const existingUser = await this.prismaClient.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new AppError(
        CONFLICT_STATUS_CODE,
        "CONFLICT",
        ADMIN_EMAIL_CONFLICT_MESSAGE,
        {
          field: "adminEmail",
        },
      );
    }
  }

  private async createPendingTenantRegistration(input: {
    normalizedTenantName: string;
    normalizedTenantCode: string;
    normalizedAdminFullName: string;
    normalizedAdminEmail: string;
    adminPasswordHash: string;
    verificationCodeHash: string;
    verificationCodeExpiresAt: Date;
    pendingRegistrationExpiresAt: Date;
    now: Date;
  }): Promise<string> {
    return this.prismaClient.$transaction(async (transaction) => {
      const verificationCode = await transaction.verificationCode.create({
        data: {
          targetType: VerificationTargetType.EMAIL,
          target: input.normalizedAdminEmail,
          purpose: VerificationPurpose.REGISTER_TENANT,
          codeHash: input.verificationCodeHash,
          expiresAt: input.verificationCodeExpiresAt,
          lastSentAt: input.now,
        },
        select: {
          id: true,
        },
      });

      const pendingRegistration =
        await transaction.pendingTenantRegistration.create({
          data: {
            verificationCodeId: verificationCode.id,
            tenantName: input.normalizedTenantName,
            tenantCode: input.normalizedTenantCode,
            adminFullName: input.normalizedAdminFullName,
            adminEmail: input.normalizedAdminEmail,
            adminPasswordHash: input.adminPasswordHash,
            expiresAt: input.pendingRegistrationExpiresAt,
          },
          select: {
            id: true,
          },
        });

      return pendingRegistration.id;
    });
  }

  private async createActiveTenantInVerificationTransaction(input: {
    tenantCode: string;
    tenantName: string;
    computerRegistrationSecretHash: string;
  }): Promise<{
    id: string;
    code: string;
    name: string;
    status: TenantStatus;
  }> {
    return this.prismaClient.$transaction(async (transaction) => {
      const tenant = await transaction.tenant.create({
        data: {
          code: input.tenantCode,
          name: input.tenantName,
          status: TenantStatus.ACTIVE,
          computerRegistrationSecretHash: input.computerRegistrationSecretHash,
        },
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
        },
      });

      return tenant;
    });
  }


  private async createActiveShopAdminInVerificationTransaction(input: {
    tenantId: string;
    adminEmail: string;
    adminFullName: string;
    adminPasswordHash: string;
  }): Promise<{
    id: string;
    tenantId: string | null;
    email: string;
    fullName: string;
    role: UserRole;
    status: UserStatus;
  }> {
    return this.prismaClient.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          tenantId: input.tenantId,
          email: input.adminEmail,
          passwordHash: input.adminPasswordHash,
          fullName: input.adminFullName,
          role: UserRole.SHOP_ADMIN,
          status: UserStatus.ACTIVE,
        },
        select: {
          id: true,
          tenantId: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
        },
      });

      return user;
    });
  }

  private async markVerificationCodeConsumedInVerificationTransaction(input: {
    verificationCodeId: string;
    consumedAt: Date;
  }): Promise<{
    id: string;
    consumedAt: Date | null;
  }> {
    return this.prismaClient.$transaction(async (transaction) => {
      const verificationCode = await transaction.verificationCode.update({
        where: {
          id: input.verificationCodeId,
        },
        data: {
          consumedAt: input.consumedAt,
        },
        select: {
          id: true,
          consumedAt: true,
        },
      });

      return verificationCode;
    });
  }

  private async markPendingRegistrationConsumedInVerificationTransaction(input: {
    registrationId: string;
    consumedAt: Date;
  }): Promise<{
    id: string;
    consumedAt: Date | null;
  }> {
    return this.prismaClient.$transaction(async (transaction) => {
      const pendingRegistration =
        await transaction.pendingTenantRegistration.update({
          where: {
            id: input.registrationId,
          },
          data: {
            consumedAt: input.consumedAt,
          },
          select: {
            id: true,
            consumedAt: true,
          },
        });

      return pendingRegistration;
    });
  }

  private async createInitialRefreshTokenInVerificationTransaction(input: {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<{
    id: string;
    userId: string;
    familyId: string;
    expiresAt: Date;
    revokedAt: Date | null;
    replacedByTokenId: string | null;
  }> {
    return this.prismaClient.$transaction(async (transaction) => {
      const refreshToken = await transaction.refreshToken.create({
        data: {
          userId: input.userId,
          tokenHash: input.tokenHash,
          familyId: input.familyId,
          expiresAt: input.expiresAt,
        },
        select: {
          id: true,
          userId: true,
          familyId: true,
          expiresAt: true,
          revokedAt: true,
          replacedByTokenId: true,
        },
      });

      return refreshToken;
    });
  }

  private async signAccessTokenAfterVerificationTransaction(input: {
    userId: string;
    tenantId: string | null;
    role: UserRole;
  }): Promise<string> {
    return this.tokenService.signAccessToken({
      sub: input.userId,
      tenantId: input.tenantId,
      role: mapUserRoleToAuthRole(input.role),
    });
  }

  private logRegisterTenantRequested(input: {
    requestId: string;
    normalizedAdminEmail: string;
    tenantCode: string;
    ip?: string;
    userAgent?: string;
  }): void {
    this.loggingService.logAuthEvent({
      requestId: input.requestId,
      event: AUTH_LOG_EVENTS.REGISTER_TENANT_REQUESTED,
      maskedEmail: this.loggingService.maskEmail(input.normalizedAdminEmail),
      emailHash: this.loggingService.hashEmail(input.normalizedAdminEmail),
      reason: input.tenantCode,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  private logRegisterTenantVerificationSent(input: {
    requestId: string;
    normalizedAdminEmail: string;
    tenantCode: string;
    ip?: string;
    userAgent?: string;
  }): void {
    this.loggingService.logAuthEvent({
      requestId: input.requestId,
      event: AUTH_LOG_EVENTS.REGISTER_TENANT_VERIFICATION_SENT,
      maskedEmail: this.loggingService.maskEmail(input.normalizedAdminEmail),
      emailHash: this.loggingService.hashEmail(input.normalizedAdminEmail),
      reason: input.tenantCode,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  private logRegisterTenantVerificationFailed(input: {
    requestId: string;
    normalizedAdminEmail?: string;
    reason: string;
    status: string;
    ip?: string;
    userAgent?: string;
  }): void {
    this.loggingService.logAuthEvent({
      requestId: input.requestId,
      event: AUTH_LOG_EVENTS.REGISTER_TENANT_VERIFICATION_FAILED,
      maskedEmail: input.normalizedAdminEmail
        ? this.loggingService.maskEmail(input.normalizedAdminEmail)
        : undefined,
      emailHash: input.normalizedAdminEmail
        ? this.loggingService.hashEmail(input.normalizedAdminEmail)
        : undefined,
      reason: input.reason,
      status: input.status,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  private logRegisterTenantCompleted(input: {
    requestId: string;
    userId: string;
    tenantId: string;
    role: UserRole;
    normalizedAdminEmail: string;
    tenantCode: string;
    status: string;
    ip?: string;
    userAgent?: string;
  }): void {
    this.loggingService.logAuthEvent({
      requestId: input.requestId,
      event: AUTH_LOG_EVENTS.REGISTER_TENANT_COMPLETED,
      userId: input.userId,
      tenantId: input.tenantId,
      role: mapUserRoleToAuthRole(input.role),
      maskedEmail: this.loggingService.maskEmail(input.normalizedAdminEmail),
      emailHash: this.loggingService.hashEmail(input.normalizedAdminEmail),
      reason: input.tenantCode,
      status: input.status,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  private logLoginSucceeded(input: {
    requestId: string;
    userId: string;
    tenantId: string | null;
    role: UserRole;
    normalizedEmail: string;
    ip?: string;
    userAgent?: string;
  }): void {
    this.loggingService.logAuthEvent({
      requestId: input.requestId,
      event: AUTH_LOG_EVENTS.LOGIN_SUCCEEDED,
      userId: input.userId,
      tenantId: input.tenantId,
      role: mapUserRoleToAuthRole(input.role),
      maskedEmail: this.loggingService.maskEmail(input.normalizedEmail),
      emailHash: this.loggingService.hashEmail(input.normalizedEmail),
      status: "SUCCESS",
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  private logLoginFailed(input: {
    requestId: string;
    normalizedEmail: string;
    reason: string;
    status: string;
    userId?: string;
    tenantId?: string | null;
    role?: UserRole;
    ip?: string;
    userAgent?: string;
  }): void {
    this.loggingService.logAuthEvent({
      requestId: input.requestId,
      event: AUTH_LOG_EVENTS.LOGIN_FAILED,
      userId: input.userId,
      tenantId: input.tenantId,
      role: input.role ? mapUserRoleToAuthRole(input.role) : undefined,
      maskedEmail: this.loggingService.maskEmail(input.normalizedEmail),
      emailHash: this.loggingService.hashEmail(input.normalizedEmail),
      reason: input.reason,
      status: input.status,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  private logRefreshSucceeded(input: {
    requestId: string;
    userId: string;
    tenantId: string | null;
    role: UserRole;
    normalizedEmail: string;
    ip?: string;
    userAgent?: string;
  }): void {
    this.loggingService.logAuthEvent({
      requestId: input.requestId,
      event: AUTH_LOG_EVENTS.REFRESH_SUCCEEDED,
      userId: input.userId,
      tenantId: input.tenantId,
      role: mapUserRoleToAuthRole(input.role),
      maskedEmail: this.loggingService.maskEmail(input.normalizedEmail),
      emailHash: this.loggingService.hashEmail(input.normalizedEmail),
      status: "SUCCESS",
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  private logRefreshFailed(input: {
    requestId: string;
    normalizedEmail?: string;
    reason: string;
    status: string;
    userId?: string;
    tenantId?: string | null;
    role?: UserRole;
    ip?: string;
    userAgent?: string;
  }): void {
    this.loggingService.logAuthEvent({
      requestId: input.requestId,
      event: AUTH_LOG_EVENTS.REFRESH_FAILED,
      userId: input.userId,
      tenantId: input.tenantId,
      role: input.role ? mapUserRoleToAuthRole(input.role) : undefined,
      maskedEmail: input.normalizedEmail
        ? this.loggingService.maskEmail(input.normalizedEmail)
        : undefined,
      emailHash: input.normalizedEmail
        ? this.loggingService.hashEmail(input.normalizedEmail)
        : undefined,
      reason: input.reason,
      status: input.status,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  private logLogoutCompleted(input: {
    requestId: string;
    reason: string;
    status: string;
    userId?: string;
    ip?: string;
    userAgent?: string;
  }): void {
    this.loggingService.logAuthEvent({
      requestId: input.requestId,
      event: AUTH_LOG_EVENTS.LOGOUT_COMPLETED,
      userId: input.userId,
      reason: input.reason,
      status: input.status,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  private logMeLoaded(input: {
    requestId: string;
    userId: string;
    tenantId: string | null;
    role: AuthRole;
    normalizedEmail: string;
    ip?: string;
    userAgent?: string;
  }): void {
    this.loggingService.logAuthEvent({
      requestId: input.requestId,
      event: AUTH_LOG_EVENTS.ME_LOADED,
      userId: input.userId,
      tenantId: input.tenantId,
      role: input.role,
      maskedEmail: this.loggingService.maskEmail(input.normalizedEmail),
      emailHash: this.loggingService.hashEmail(input.normalizedEmail),
      status: "SUCCESS",
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }
}

export const authService = new AuthService();
