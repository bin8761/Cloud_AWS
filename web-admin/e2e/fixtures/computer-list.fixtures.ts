export type E2EComputer = {
  id: string;
  tenantId: string;
  name: string;
  macAddress: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  lastSeenAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export function buildComputerListFixtures(): E2EComputer[] {
  const statuses: Array<E2EComputer["status"]> = ["ACTIVE", "INACTIVE", "BLOCKED"];
  return Array.from({ length: 25 }, (_, index) => {
    const item = index + 1;
    const status = statuses[index % statuses.length];
    return {
      id: `computer-${item}`,
      tenantId: "tenant-1",
      name: `Workstation ${item.toString().padStart(2, "0")}`,
      macAddress: `AA:BB:CC:DD:EE:${item.toString(16).padStart(2, "0").toUpperCase()}`,
      status,
      lastSeenAt: item % 2 === 0 ? "2026-05-28T10:00:00.000Z" : null,
      notes: `Computer note ${item}`,
      createdAt: `2026-05-${(item % 27) + 1}T08:00:00.000Z`,
      updatedAt: `2026-05-${(item % 27) + 1}T09:00:00.000Z`,
    };
  });
}
