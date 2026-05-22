import { UserRole, UserStatus } from "@prisma/client";
import type { AuthContext } from "../../shared/middleware/auth-context";
import { AppError } from "../../shared/errors/app-error";
import { prisma } from "../../shared/prisma/prisma.client";
import { authPasswordService } from "../auth/auth.password";
import { normalizeEmail } from "../auth/auth.schema";
import { USERS_LOG_EVENTS, usersLoggingService } from "./users.logging";
import type {
  CreateStaffUserInput,
  ListStaffUsersInput,
  ListStaffUsersOutput,
  StaffUserDto,
  UpdateStaffUserInput,
} from "./users.types";
import { mapStaffUserDto } from "./users.types";

const FORBIDDEN_STATUS_CODE = 403;
const CONFLICT_STATUS_CODE = 409;
const NOT_FOUND_STATUS_CODE = 404;
const FORBIDDEN_MESSAGE = "You do not have permission to access this resource.";
const STAFF_EMAIL_CONFLICT_MESSAGE = "Staff email is already in use.";
const STAFF_USER_NOT_FOUND_MESSAGE =
  "The staff user does not exist or has been deleted.";

const createForbiddenError = () =>
  new AppError(FORBIDDEN_STATUS_CODE, "FORBIDDEN", FORBIDDEN_MESSAGE);

export const createDuplicateStaffEmailConflictError = () =>
  new AppError(CONFLICT_STATUS_CODE, "CONFLICT", STAFF_EMAIL_CONFLICT_MESSAGE, {
    field: "email",
  });

export const createNotFoundStaffUserError = () =>
  new AppError(
    NOT_FOUND_STATUS_CODE,
    "NOT_FOUND",
    STAFF_USER_NOT_FOUND_MESSAGE,
  );

export const assertTenantIdFromAuthContext = (
  authContext: AuthContext | undefined,
): string => {
  const tenantId = authContext?.tenantId;
  if (typeof tenantId !== "string") {
    throw createForbiddenError();
  }

  const normalizedTenantId = tenantId.trim();
  if (!normalizedTenantId) {
    throw createForbiddenError();
  }

  return normalizedTenantId;
};

export const createStaffTargetWhere = (tenantId: string) => ({
  tenantId,
  role: UserRole.STAFF,
  deletedAt: null,
});

export const staffUserDtoSelect = {
  id: true,
  tenantId: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const createCreateStaffUserData = (input: {
  tenantId: string;
  email: CreateStaffUserInput["email"];
  fullName: CreateStaffUserInput["fullName"];
  passwordHash: string;
}) => ({
  tenantId: input.tenantId,
  email: input.email,
  fullName: input.fullName,
  passwordHash: input.passwordHash,
  role: UserRole.STAFF,
  status: UserStatus.ACTIVE,
});

export const createUpdateStaffUserData = (input: {
  patch: UpdateStaffUserInput;
  passwordHash?: string;
}) => {
  const updateData: {
    fullName?: string;
    status?: UserStatus;
    passwordHash?: string;
  } = {};

  if (input.patch.fullName !== undefined) {
    updateData.fullName = input.patch.fullName;
  }
  if (input.patch.status !== undefined) {
    updateData.status = input.patch.status;
  }
  if (input.passwordHash !== undefined) {
    updateData.passwordHash = input.passwordHash;
  }

  return updateData;
};

export class UsersService {
  public async createStaffUser(
    authContext: AuthContext,
    input: CreateStaffUserInput,
  ): Promise<{ user: StaffUserDto }> {
    const tenantId = assertTenantIdFromAuthContext(authContext);
    const normalizedEmail = normalizeEmail(input.email);

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
      },
    });
    if (existingUser) {
      throw createDuplicateStaffEmailConflictError();
    }

    const passwordHash = await authPasswordService.hashPassword(input.password);
    const createdUser = await prisma.user.create({
      data: createCreateStaffUserData({
        tenantId,
        email: normalizedEmail,
        fullName: input.fullName,
        passwordHash,
      }),
      select: staffUserDtoSelect,
    });
    usersLoggingService.logStaffCreated({
      requestId: authContext.requestId,
      actorUserId: authContext.userId,
      actorRole: authContext.role,
      actorTenantId: authContext.tenantId ?? null,
      targetUserId: createdUser.id,
      targetTenantId: createdUser.tenantId,
    });

    return {
      user: mapStaffUserDto(createdUser),
    };
  }

  public async listStaffUsers(
    authContext: AuthContext,
    input: ListStaffUsersInput,
  ): Promise<ListStaffUsersOutput> {
    const tenantId = assertTenantIdFromAuthContext(authContext);
    const skip = (input.page - 1) * input.pageSize;
    const normalizedQuery = input.q?.trim();
    const where = {
      ...createStaffTargetWhere(tenantId),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(normalizedQuery
        ? {
            OR: [
              {
                email: {
                  contains: normalizedQuery,
                },
              },
              {
                fullName: {
                  contains: normalizedQuery,
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.user.count({
        where,
      }),
      prisma.user.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: input.pageSize,
        select: staffUserDtoSelect,
      }),
    ]);

    return {
      items: items.map((item) => mapStaffUserDto(item)),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  public async getStaffUserById(
    authContext: AuthContext,
    id: string,
  ): Promise<{ user: StaffUserDto }> {
    const tenantId = assertTenantIdFromAuthContext(authContext);
    const user = await prisma.user.findFirst({
      where: {
        id,
        ...createStaffTargetWhere(tenantId),
      },
      select: staffUserDtoSelect,
    });

    if (!user) {
      throw createNotFoundStaffUserError();
    }

    return {
      user: mapStaffUserDto(user),
    };
  }

  public async updateStaffUserById(
    authContext: AuthContext,
    id: string,
    input: UpdateStaffUserInput,
  ): Promise<{ user: StaffUserDto }> {
    const tenantId = assertTenantIdFromAuthContext(authContext);
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        ...createStaffTargetWhere(tenantId),
      },
      select: {
        id: true,
        fullName: true,
        status: true,
      },
    });

    if (!existingUser) {
      throw createNotFoundStaffUserError();
    }

    const passwordHash =
      input.password === undefined
        ? undefined
        : await authPasswordService.hashPassword(input.password);
    const updateData = createUpdateStaffUserData({
      patch: input,
      passwordHash,
    });

    await prisma.user.update({
      where: {
        id: existingUser.id,
      },
      data: updateData,
    });

    const updatedUser = await prisma.user.findFirst({
      where: {
        id: existingUser.id,
        ...createStaffTargetWhere(tenantId),
      },
      select: staffUserDtoSelect,
    });

    if (!updatedUser) {
      throw createNotFoundStaffUserError();
    }

    const changedProfileFields: string[] = [];
    if (
      input.fullName !== undefined &&
      input.fullName !== existingUser.fullName
    ) {
      changedProfileFields.push("fullName");
    }

    if (changedProfileFields.length > 0) {
      usersLoggingService.logStaffUpdated({
        requestId: authContext.requestId,
        actorUserId: authContext.userId,
        actorRole: authContext.role,
        actorTenantId: authContext.tenantId ?? null,
        targetUserId: updatedUser.id,
        targetTenantId: updatedUser.tenantId,
        changedFields: changedProfileFields,
      });
    }

    const hasStatusChanged =
      input.status !== undefined && input.status !== existingUser.status;
    if (hasStatusChanged) {
      usersLoggingService.logStaffStatusUpdated({
        requestId: authContext.requestId,
        actorUserId: authContext.userId,
        actorRole: authContext.role,
        actorTenantId: authContext.tenantId ?? null,
        targetUserId: updatedUser.id,
        targetTenantId: updatedUser.tenantId,
        oldStatus: existingUser.status,
        newStatus: updatedUser.status,
        changedFields: ["status"],
      });
    }

    if (input.password !== undefined) {
      usersLoggingService.logStaffPasswordReset({
        requestId: authContext.requestId,
        actorUserId: authContext.userId,
        actorRole: authContext.role,
        actorTenantId: authContext.tenantId ?? null,
        targetUserId: updatedUser.id,
        targetTenantId: updatedUser.tenantId,
        changedFields: ["password"],
      });
    }

    return {
      user: mapStaffUserDto(updatedUser),
    };
  }
}

export const usersService = new UsersService();
