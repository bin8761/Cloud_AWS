import type {
  ComputerListResponse,
  ComputerResponse,
  ComputerStatusValue,
} from "./computers.types";

type ComputerMapperSource = {
  id: string;
  tenantId: string;
  name: string | null;
  macAddress: string;
  status: ComputerStatusValue;
  lastSeenAt: Date | string | null;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const toJsonSafeDate = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

export const mapComputerToResponse = (
  computer: ComputerMapperSource,
): ComputerResponse => ({
  id: computer.id,
  tenantId: computer.tenantId,
  name: computer.name,
  macAddress: computer.macAddress,
  status: computer.status,
  lastSeenAt: computer.lastSeenAt ? toJsonSafeDate(computer.lastSeenAt) : null,
  notes: computer.notes,
  createdAt: toJsonSafeDate(computer.createdAt),
  updatedAt: toJsonSafeDate(computer.updatedAt),
});

type ComputerListResponseInput = {
  items: ReadonlyArray<ComputerMapperSource>;
  page: number;
  pageSize: number;
  total: number;
};

export const mapComputerListResponse = (
  input: ComputerListResponseInput,
): ComputerListResponse => {
  const totalPages = input.pageSize > 0 ? Math.ceil(input.total / input.pageSize) : 0;

  return {
    items: input.items.map((computer) => mapComputerToResponse(computer)),
    page: input.page,
    pageSize: input.pageSize,
    total: input.total,
    totalPages,
  };
};
