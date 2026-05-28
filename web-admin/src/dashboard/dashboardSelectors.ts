import type { ComputerRowViewModel } from "../computers/computers.types";

export function selectTotalComputerCount(rows: ComputerRowViewModel[]): number {
  return rows.length;
}

export function selectOnlineComputerCount(rows: ComputerRowViewModel[]): number {
  return rows.filter((row) => row.realtimeLabel === "Online").length;
}

export function selectOfflineComputerCount(rows: ComputerRowViewModel[]): number {
  return rows.filter((row) => row.realtimeLabel === "Offline").length;
}

export function selectBlockedOrInactiveComputerCount(
  rows: ComputerRowViewModel[],
): number {
  return rows.filter(
    (row) =>
      row.adminStatusLabel === "Blocked" || row.adminStatusLabel === "Inactive",
  ).length;
}
