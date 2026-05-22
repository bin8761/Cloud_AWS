export type StaffUserDto = {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: "STAFF";
  status: "ACTIVE" | "DISABLED";
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateStaffUserInput = {
  email: string;
  fullName: string;
  password: string;
};

export type ListStaffUsersInput = {
  page: number;
  pageSize: number;
  status?: "ACTIVE" | "DISABLED";
  q?: string;
};

export type ListStaffUsersOutput = {
  items: StaffUserDto[];
  page: number;
  pageSize: number;
  total: number;
};

export type UpdateStaffUserInput = {
  fullName?: string;
  status?: "ACTIVE" | "DISABLED";
  password?: string;
};

type StaffUserRecord = {
  id: string;
  tenantId: string | null;
  email: string;
  fullName: string;
  role: "STAFF";
  status: "ACTIVE" | "DISABLED";
  lastLoginAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const toJsonSafeDate = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

export const mapStaffUserDto = (user: StaffUserRecord): StaffUserDto => {
  if (!user.tenantId) {
    throw new Error("Staff user tenantId is required");
  }

  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt ? toJsonSafeDate(user.lastLoginAt) : null,
    createdAt: toJsonSafeDate(user.createdAt),
    updatedAt: toJsonSafeDate(user.updatedAt),
  };
};
