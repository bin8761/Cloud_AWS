import { describe, expect, it } from "vitest";
import {
  buildRealtimeAckError,
  buildRealtimeAckSuccess,
} from "../../src/modules/realtime/realtime.ack";

describe("Realtime ack mapper unit tests (Task 221-223)", () => {
  it("Task 221: maps success payloads", () => {
    const result = buildRealtimeAckSuccess({
      serverTime: "2026-05-25T10:11:12.000Z",
    });

    expect(result).toEqual({
      success: true,
      data: {
        serverTime: "2026-05-25T10:11:12.000Z",
      },
    });
  });

  it("Task 222: maps error payloads", () => {
    const result = buildRealtimeAckError({
      code: "VALIDATION_ERROR",
      message: "Invalid payload.",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid payload.",
      },
    });
  });

  it("Task 223: never includes token material in error payload", () => {
    const result = buildRealtimeAckError({
      code: "FORBIDDEN",
      message: "Unauthorized realtime connection",
    });

    expect(JSON.stringify(result)).not.toContain("accessToken");
    expect(JSON.stringify(result)).not.toContain("deviceToken");
    expect(JSON.stringify(result)).not.toContain("deviceTokenHash");
    expect(JSON.stringify(result)).toBe(
      JSON.stringify({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Unauthorized realtime connection",
        },
      }),
    );
  });
});

