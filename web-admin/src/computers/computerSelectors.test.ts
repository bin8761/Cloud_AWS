import { describe, expect, it } from "vitest";
import {
  selectAdminStatusLabel,
  selectComputerDisplayName,
  selectComputerRowViewModels,
  selectRealtimeLabel,
} from "./computerSelectors";
import type { Computer } from "./computers.types";
import type { PresenceByComputerId } from "../realtime/realtime.store";

function createComputer(overrides: Partial<Computer> = {}): Computer {
  return {
    id: "computer-1",
    tenantId: "tenant-1",
    name: "Front Desk PC",
    macAddress: "AA:BB:CC:DD:EE:FF",
    status: "ACTIVE",
    lastSeenAt: null,
    notes: null,
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("selectComputerDisplayName", () => {
  it("uses computer.name when present", () => {
    const displayName = selectComputerDisplayName(createComputer());
    expect(displayName).toBe("Front Desk PC");
  });

  it("falls back to macAddress when name is missing", () => {
    const displayName = selectComputerDisplayName(
      createComputer({ name: "   ", macAddress: "11:22:33:44:55:66" }),
    );
    expect(displayName).toBe("11:22:33:44:55:66");
  });

  it("falls back to id when name and macAddress are empty", () => {
    const displayName = selectComputerDisplayName(
      createComputer({ name: null, macAddress: "   ", id: "computer-99" }),
    );
    expect(displayName).toBe("computer-99");
  });
});

describe("selectAdminStatusLabel", () => {
  it("maps ACTIVE to Active", () => {
    expect(selectAdminStatusLabel("ACTIVE")).toBe("Active");
  });

  it("maps INACTIVE to Inactive", () => {
    expect(selectAdminStatusLabel("INACTIVE")).toBe("Inactive");
  });

  it("maps BLOCKED to Blocked", () => {
    expect(selectAdminStatusLabel("BLOCKED")).toBe("Blocked");
  });
});

describe("selectRealtimeLabel", () => {
  it("maps online presence to Online", () => {
    expect(
      selectRealtimeLabel(
        {
          online: true,
          lastSeenAt: "2026-05-27T00:00:00.000Z",
          source: "socket-event",
          receivedAt: "2026-05-27T00:00:00.000Z",
        },
        "connected",
      ),
    ).toBe("Online");
  });

  it("maps offline presence to Offline", () => {
    expect(
      selectRealtimeLabel(
        {
          online: false,
          lastSeenAt: "2026-05-27T00:00:00.000Z",
          source: "snapshot",
          receivedAt: "2026-05-27T00:00:00.000Z",
        },
        "connected",
      ),
    ).toBe("Offline");
  });

  it("maps missing presence to Unavailable", () => {
    expect(selectRealtimeLabel(undefined, "connected")).toBe("Unavailable");
  });

  it("maps reconnecting socket state to Reconnecting", () => {
    expect(
      selectRealtimeLabel(
        {
          online: true,
          lastSeenAt: "2026-05-27T00:00:00.000Z",
          source: "rest",
          receivedAt: "2026-05-27T00:00:00.000Z",
        },
        "reconnecting",
      ),
    ).toBe("Reconnecting");
  });
});

describe("selectComputerRowViewModels", () => {
  it("returns empty rows for empty computer list", () => {
    const rows = selectComputerRowViewModels([], {}, "connected");
    expect(rows).toEqual([]);
  });

  it("merges rows with presence by computer.id", () => {
    const computers: Computer[] = [
      createComputer({ id: "computer-a", name: "A" }),
      createComputer({ id: "computer-b", name: "B" }),
    ];
    const presenceByComputerId: PresenceByComputerId = {
      "computer-b": {
        online: true,
        lastSeenAt: "2026-05-27T00:00:00.000Z",
        source: "socket-event",
        receivedAt: "2026-05-27T00:00:01.000Z",
      },
    };

    const rows = selectComputerRowViewModels(
      computers,
      presenceByComputerId,
      "connected",
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].realtimeLabel).toBe("Unavailable");
    expect(rows[1].realtimeLabel).toBe("Online");
  });

  it("keeps adminStatusLabel independent from realtimeLabel", () => {
    const computers: Computer[] = [
      createComputer({ id: "computer-x", status: "BLOCKED" }),
    ];
    const presenceByComputerId: PresenceByComputerId = {
      "computer-x": {
        online: true,
        lastSeenAt: "2026-05-27T00:00:00.000Z",
        source: "snapshot",
        receivedAt: "2026-05-27T00:00:02.000Z",
      },
    };

    const rows = selectComputerRowViewModels(
      computers,
      presenceByComputerId,
      "reconnecting",
    );

    expect(rows[0].adminStatusLabel).toBe("Blocked");
    expect(rows[0].realtimeLabel).toBe("Reconnecting");
  });

  it("does not mutate input arrays or presence maps", () => {
    const computers: Computer[] = [createComputer({ id: "computer-immut" })];
    const presenceByComputerId: PresenceByComputerId = {
      "computer-immut": {
        online: false,
        lastSeenAt: "2026-05-27T00:00:00.000Z",
        source: "rest",
        receivedAt: "2026-05-27T00:00:03.000Z",
      },
    };
    const computersBefore = JSON.parse(JSON.stringify(computers));
    const presenceBefore = JSON.parse(JSON.stringify(presenceByComputerId));

    const rows = selectComputerRowViewModels(
      computers,
      presenceByComputerId,
      "connected",
    );

    expect(rows).toHaveLength(1);
    expect(computers).toEqual(computersBefore);
    expect(presenceByComputerId).toEqual(presenceBefore);
  });

  it("does not mutate source computer objects", () => {
    const computer = createComputer({ id: "computer-source", name: "Original" });
    const computers: Computer[] = [computer];
    const before = JSON.parse(JSON.stringify(computer));

    const rows = selectComputerRowViewModels(computers, {}, "connected");

    expect(rows[0].displayName).toBe("Original");
    expect(computer).toEqual(before);
  });

  it("tolerates missing presence data", () => {
    const computers: Computer[] = [createComputer({ id: "computer-missing" })];

    const rows = selectComputerRowViewModels(computers, {}, "connected");

    expect(rows).toHaveLength(1);
    expect(rows[0].realtimeLabel).toBe("Unavailable");
    expect(rows[0].presence.online).toBe(false);
    expect(rows[0].presence.source).toBe("rest");
  });
});
