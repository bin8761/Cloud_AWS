import type {
  BlockRuleListResponse,
  BlockRuleResponse,
  BlockRuleStatusValue,
  BlockRuleTypeValue,
} from "./block-rules.types";

type BlockRuleMapperSource = {
  id: string;
  tenantId: string;
  type: BlockRuleTypeValue;
  value: string;
  label: string | null;
  reason: string | null;
  status: BlockRuleStatusValue;
  priority: number;
  createdBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const toJsonSafeDate = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

export const mapBlockRuleToResponse = (
  rule: BlockRuleMapperSource,
): BlockRuleResponse => ({
  id: rule.id,
  tenantId: rule.tenantId,
  type: rule.type,
  value: rule.value,
  label: rule.label,
  reason: rule.reason,
  status: rule.status,
  priority: rule.priority,
  createdBy: rule.createdBy,
  createdAt: toJsonSafeDate(rule.createdAt),
  updatedAt: toJsonSafeDate(rule.updatedAt),
});

export const mapBlockRuleListResponse = (input: {
  items: ReadonlyArray<BlockRuleMapperSource>;
  page: number;
  pageSize: number;
  total: number;
}): BlockRuleListResponse => ({
  items: input.items.map((rule) => mapBlockRuleToResponse(rule)),
  page: input.page,
  pageSize: input.pageSize,
  total: input.total,
  totalPages: input.pageSize > 0 ? Math.ceil(input.total / input.pageSize) : 0,
});
