import type { z } from "zod";
import { reissueComputerRegistrationSecretSchema } from "./tenants.schema";

export type TenantStatusDto = "ACTIVE" | "SUSPENDED";

export type TenantDto = Readonly<{
  id: string;
  code: string;
  name: string;
  status: TenantStatusDto;
  createdAt: string;
  updatedAt: string;
}>;

export type ListTenantsInput = {
  page: number;
  pageSize: number;
  status?: TenantStatusDto;
  q?: string;
};

export type ListTenantsOutput = {
  items: ReadonlyArray<TenantDto>;
  page: number;
  pageSize: number;
  total: number;
};

type TenantOutputEnvelope = {
  tenant: TenantDto;
};

export type GetCurrentTenantOutput = TenantOutputEnvelope;

export type UpdateCurrentTenantOutput = TenantOutputEnvelope;

export type GetTenantByIdOutput = TenantOutputEnvelope;

export type UpdateTenantByIdOutput = TenantOutputEnvelope;

export type UpdateCurrentTenantInput = {
  name: string;
};

export type UpdateTenantByIdInput = {
  name?: string;
  status?: TenantStatusDto;
};

export type ReissueComputerRegistrationSecretInput = z.infer<
  typeof reissueComputerRegistrationSecretSchema
>;

export type ReissueComputerRegistrationSecretOutput = {
  computerRegistrationSecret: string;
};

type TenantMapperSource = {
  id: string;
  code: string;
  name: string;
  status: TenantStatusDto;
  deletedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const toJsonSafeDate = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

export const mapTenantDto = ({
  deletedAt: _deletedAt,
  ...tenant
}: TenantMapperSource): TenantDto => ({
  id: tenant.id,
  code: tenant.code,
  name: tenant.name,
  status: tenant.status,
  createdAt: toJsonSafeDate(tenant.createdAt),
  updatedAt: toJsonSafeDate(tenant.updatedAt),
});
