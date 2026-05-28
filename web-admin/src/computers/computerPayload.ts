import type { UpdateComputerInput } from "./computers.types";

type UpdateComputerSource = {
  name?: string | null;
  status?: UpdateComputerInput["status"];
  notes?: string | null;
} & Record<string, unknown>;

export function buildUpdateComputerPayload(
  source: UpdateComputerSource,
): UpdateComputerInput {
  const payload: UpdateComputerInput = {};

  if (source.name !== undefined) {
    payload.name = source.name;
  }

  if (source.status !== undefined) {
    payload.status = source.status;
  }

  if (source.notes !== undefined) {
    payload.notes = source.notes;
  }

  return payload;
}
