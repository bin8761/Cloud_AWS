import type { AuthContext } from "../../shared/middleware/auth-context";

export type BlockRuleTypeValue = "URL" | "PROCESS" | "KEYWORD";
export type BlockRuleStatusValue = "ACTIVE" | "DISABLED";

export type BlockRuleResponse = {
  id: string;
  tenantId: string;
  type: BlockRuleTypeValue;
  value: string;
  label: string | null;
  reason: string | null;
  status: BlockRuleStatusValue;
  priority: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BlockRuleListResponse = {
  items: BlockRuleResponse[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CreateBlockRuleInput = {
  type: BlockRuleTypeValue;
  value: string;
  label?: string;
  reason?: string;
  priority?: number;
};

export type UpdateBlockRuleInput = {
  value?: string;
  label?: string;
  reason?: string;
  status?: BlockRuleStatusValue;
  priority?: number;
};

export type ListBlockRulesInput = {
  page: number;
  pageSize: number;
  type?: BlockRuleTypeValue;
  status?: BlockRuleStatusValue;
  q?: string;
  sort?: "createdAt:desc" | "createdAt:asc" | "priority:desc" | "priority:asc";
};

export type BatchCreateBlockRulesInput = {
  rules: CreateBlockRuleInput[];
};

export type BlockRulesAuthContext = AuthContext;

export type BlockRulesUpdatedAction =
  | "created"
  | "updated"
  | "deleted"
  | "batch-created";

export type BlockRulesUpdatedPayload = {
  action: BlockRulesUpdatedAction;
  tenantId: string;
  timestamp: string;
};
