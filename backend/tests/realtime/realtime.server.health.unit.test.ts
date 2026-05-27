import { createServer } from "node:http";
import { describe, expect, it } from "vitest";

import { createRealtimeServer } from "../../src/modules/realtime/realtime.server";

describe("Realtime server health snapshot unit tests", () => {
  it("Task 230: returns sanitized non-negative integer counters", async () => {
    const httpServer = createServer();
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
    const realtimeServer = createRealtimeServer(httpServer);

    const beforeClose = realtimeServer.getHealthSnapshot();
    await realtimeServer.close();
    const afterClose = realtimeServer.getHealthSnapshot();

    for (const snapshot of [beforeClose, afterClose]) {
      for (const value of Object.values(snapshot)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
