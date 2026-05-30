export type ComputerStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

export type Computer = {
  id: string;
  tenantId: string;
  name: string | null;
  macAddress: string;
  status: ComputerStatus;
  lastSeenAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ComputersListQuery = {
  page?: number;
  pageSize?: number;
  status?: ComputerStatus;
  q?: string;
  sort?: string;
};

export type ComputersListResponse = {
  items: Computer[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type UpdateComputerInput = {
  name?: string | null;
  status?: ComputerStatus;
  notes?: string | null;
};

export type ReissueTokenInput = {
  reason: string;
};

export type ReissueTokenResult = {
  computer: Computer;
  deviceToken: string;
};

export type RegisterComputerInput = {
  tenantCode: string;
  registrationSecret: string;
  macAddress: string;
  name?: string;
};

export type RegisterComputerResult = {
  computer: Computer;
  deviceToken: string;
};

export type ReissueRegistrationSecretInput = {
  reason: string;
};

export type ReissueRegistrationSecretResult = {
  computerRegistrationSecret: string;
};

export type ComputerRowViewModel = {
  computer: Computer;
  presence: {
    online: boolean;
    lastSeenAt: string | null;
    source: "snapshot" | "socket-event" | "rest";
    receivedAt: string;
  };
  displayName: string;
  adminStatusLabel: "Active" | "Inactive" | "Blocked";
  realtimeLabel: "Online" | "Offline" | "Unavailable" | "Reconnecting";
};
