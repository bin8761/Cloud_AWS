import type { AuthContext } from "../../shared/middleware/auth-context";

export type ComputerStatusValue = "ACTIVE" | "INACTIVE" | "BLOCKED";

export type ComputerResponse = {
  id: string;
  tenantId: string;
  name: string | null;
  macAddress: string;
  status: ComputerStatusValue;
  lastSeenAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ComputerListResponse = {
  items: ComputerResponse[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ComputerTokenResponse = {
  computer: ComputerResponse;
  deviceToken: string;
};

export type RegisterComputerInput = {
  tenantCode: string;
  registrationSecret: string;
  macAddress: string;
  name?: string;
};

export type RegisterComputerRequestContext = {
  requestId?: string;
  ip?: string;
  userAgent?: string;
};

export type ListComputersInput = {
  page: number;
  pageSize: number;
  status?: ComputerStatusValue;
  q?: string;
  sort?: "createdAt:desc" | "createdAt:asc" | "name:asc" | "name:desc";
};

export type UpdateComputerInput = {
  name?: string;
  status?: ComputerStatusValue;
  notes?: string;
};

export type ReissueDeviceTokenInput = {
  reason?: string;
};

export type ComputersAuthContext = AuthContext;

export type ComputersTypesScaffold = Record<string, never>;
