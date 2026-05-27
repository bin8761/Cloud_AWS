import type { Socket } from "socket.io";
import { ComputerStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, hashDeviceTokenMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  hashDeviceTokenMock: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  ComputerStatus: {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
    BLOCKED: "BLOCKED",
  },
}));

vi.mock("../../src/shared/prisma/prisma.client", () => ({
  prisma: {
    computer: {
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock("../../src/modules/computers/computers.service", () => ({
  hashDeviceToken: hashDeviceTokenMock,
}));

vi.mock("../../src/modules/auth/auth.tokens", () => ({
  authTokenService: {
    verifyAccessToken: vi.fn(),
  },
}));

import { authenticateRealtimeComputerHandshake } from "../../src/modules/realtime/realtime.auth";

const createSocketWithAuth = (auth: unknown): Socket =>
  ({
    handshake: {
      auth,
    },
  }) as Socket;

const createComputerRecord = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "computer-1",
  tenantId: "tenant-1",
  status: ComputerStatus.ACTIVE,
  deviceTokenHash: "hashed-device-token",
  lastSeenAt: null,
  ...overrides,
});

const getRejectedMessage = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
    return "__RESOLVED__";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

describe("Realtime client auth unit tests (Task 209-214)", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    hashDeviceTokenMock.mockReset();
  });

  it("Task 209: accepts valid computerId + deviceToken for ACTIVE computer", async () => {
    findUniqueMock.mockResolvedValue(createComputerRecord());
    hashDeviceTokenMock.mockReturnValue("hashed-device-token");

    const result = await authenticateRealtimeComputerHandshake(
      createSocketWithAuth({
        clientType: "computer",
        computerId: "computer-1",
        deviceToken: "device-token-plain",
      })
    );

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: {
        id: "computer-1",
      },
      select: {
        id: true,
        tenantId: true,
        status: true,
        deviceTokenHash: true,
        lastSeenAt: true,
      },
    });
    expect(hashDeviceTokenMock).toHaveBeenCalledWith("device-token-plain");
    expect(result.context).toEqual({
      clientType: "computer",
      computerId: "computer-1",
      tenantId: "tenant-1",
    });
  });

  it("Task 210: rejects invalid device token", async () => {
    findUniqueMock.mockResolvedValue(createComputerRecord());
    hashDeviceTokenMock.mockReturnValue("different-hash");

    await expect(
      authenticateRealtimeComputerHandshake(
        createSocketWithAuth({
          clientType: "computer",
          computerId: "computer-1",
          deviceToken: "wrong-device-token",
        })
      )
    ).rejects.toThrow("Unauthorized realtime connection");
  });

  it("Task 211: rejects missing computer", async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(
      authenticateRealtimeComputerHandshake(
        createSocketWithAuth({
          clientType: "computer",
          computerId: "missing-computer",
          deviceToken: "device-token-plain",
        })
      )
    ).rejects.toThrow("Unauthorized realtime connection");

    expect(hashDeviceTokenMock).not.toHaveBeenCalled();
  });

  it("Task 212: rejects INACTIVE computers", async () => {
    findUniqueMock.mockResolvedValue(
      createComputerRecord({
        status: ComputerStatus.INACTIVE,
      })
    );

    await expect(
      authenticateRealtimeComputerHandshake(
        createSocketWithAuth({
          clientType: "computer",
          computerId: "computer-inactive",
          deviceToken: "device-token-plain",
        })
      )
    ).rejects.toThrow("Unauthorized realtime connection");
  });

  it("Task 213: rejects BLOCKED computers", async () => {
    findUniqueMock.mockResolvedValue(
      createComputerRecord({
        status: ComputerStatus.BLOCKED,
      })
    );

    await expect(
      authenticateRealtimeComputerHandshake(
        createSocketWithAuth({
          clientType: "computer",
          computerId: "computer-blocked",
          deviceToken: "device-token-plain",
        })
      )
    ).rejects.toThrow("Unauthorized realtime connection");
  });

  it("Task 214: uses generic non-enumerating error for missing computer and wrong token", async () => {
    findUniqueMock.mockResolvedValue(null);
    const missingComputerMessage = await getRejectedMessage(
      authenticateRealtimeComputerHandshake(
        createSocketWithAuth({
          clientType: "computer",
          computerId: "missing-computer",
          deviceToken: "device-token-plain",
        })
      )
    );

    findUniqueMock.mockResolvedValue(createComputerRecord());
    hashDeviceTokenMock.mockReturnValue("wrong-hash");
    const wrongTokenMessage = await getRejectedMessage(
      authenticateRealtimeComputerHandshake(
        createSocketWithAuth({
          clientType: "computer",
          computerId: "computer-1",
          deviceToken: "wrong-device-token",
        })
      )
    );

    expect(missingComputerMessage).toBe("Unauthorized realtime connection");
    expect(wrongTokenMessage).toBe("Unauthorized realtime connection");
    expect(wrongTokenMessage).toBe(missingComputerMessage);
  });
});
