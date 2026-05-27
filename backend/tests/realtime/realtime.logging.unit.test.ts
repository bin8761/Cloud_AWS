import { describe, expect, it, vi } from "vitest";

const { loggerWarnMock, loggerInfoMock, loggerErrorMock } = vi.hoisted(() => ({
  loggerWarnMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("../../src/shared/logging/logger", () => ({
  logger: {
    warn: loggerWarnMock,
    info: loggerInfoMock,
    error: loggerErrorMock,
  },
}));

import {
  buildRealtimeAdminAuthFailureLogInput,
  realtimeLoggingService,
} from "../../src/modules/realtime/realtime.logging";

describe("Realtime logging unit tests (Task 235-236)", () => {
  it("Task 235: forbidden sensitive fields are dropped or rejected", () => {
    realtimeLoggingService.logClientHeartbeat({
      socketId: "socket-1",
      tenantId: "tenant-1",
      computerId: "computer-1",
      reason: "heartbeat_accepted",
      level: "info",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deviceToken: "secret-token" as any,
    });

    expect(loggerInfoMock).toHaveBeenCalledTimes(1);
    const [payload] = loggerInfoMock.mock.calls[0] as [Record<string, unknown>, string];
    expect(payload.deviceToken).toBeUndefined();
  });

  it("Task 236: auth failure logs contain no token or raw handshake fields", () => {
    const socket = {
      id: "socket-1",
      handshake: {
        address: "127.0.0.1",
        headers: {
          "user-agent": "vitest-agent",
        },
        auth: {
          accessToken: "secret-access-token",
        },
      },
    };

    const input = buildRealtimeAdminAuthFailureLogInput(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket as any,
      "admin_handshake_rejected",
    );
    realtimeLoggingService.logAdminAuthFailure(input);

    expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    const [payload] = loggerWarnMock.mock.calls[0] as [Record<string, unknown>, string];
    expect(payload.accessToken).toBeUndefined();
    expect(payload.deviceToken).toBeUndefined();
    expect(payload.deviceTokenHash).toBeUndefined();
    expect(payload.handshake).toBeUndefined();
    expect(payload.headers).toBeUndefined();
    expect(payload.rawAuth).toBeUndefined();
    expect(payload.event).toBe("realtime.admin.auth.failed");
    expect(payload.socketId).toBe("socket-1");
  });
});
