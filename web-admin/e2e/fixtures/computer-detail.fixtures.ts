import type { E2EComputer } from "./computer-list.fixtures";

export function buildComputerDetailFixture(computer: E2EComputer): E2EComputer {
  return {
    ...computer,
    notes: `${computer.notes ?? ""} (detail fixture)`.trim(),
  };
}
