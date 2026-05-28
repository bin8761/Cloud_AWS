export type BlockRuleType = "URL" | "PROCESS" | "KEYWORD";
export type BlockRuleStatus = "ACTIVE" | "DISABLED";
export type BlockRuleSort =
  | "createdAt:desc"
  | "createdAt:asc"
  | "priority:desc"
  | "priority:asc";

export type BlockRule = {
  id: string;
  tenantId: string;
  type: BlockRuleType;
  value: string;
  label: string | null;
  reason: string | null;
  status: BlockRuleStatus;
  priority: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateBlockRuleInput = {
  type: BlockRuleType;
  value: string;
  label?: string;
  reason?: string;
  priority?: number;
};

export type UpdateBlockRuleInput = Partial<CreateBlockRuleInput> & {
  status?: BlockRuleStatus;
};

export type ListBlockRulesInput = {
  page: number;
  pageSize: number;
  type?: BlockRuleType;
  status?: BlockRuleStatus;
  q?: string;
  sort?: BlockRuleSort;
};

export type BlockRulesListResponse = {
  items: BlockRule[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AuthRole = "super_admin" | "shop_admin" | "staff";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
  tenantId: string | null;
};

export type AuthTenant = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
};

export type LoginResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export type CurrentUserResponse = {
  user: AuthUser;
  tenant: AuthTenant | null;
};
