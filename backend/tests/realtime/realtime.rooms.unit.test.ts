import { describe, expect, it } from "vitest";
import {
  computerRoom,
  tenantRoom,
} from "../../src/modules/realtime/realtime.rooms";

describe("Realtime room helpers", () => {
  it("returns tenant room name with tenant: prefix", () => {
    expect(tenantRoom("tenant-id")).toBe("tenant:tenant-id");
  });

  it("returns computer room name with computer: prefix", () => {
    expect(computerRoom("computer-id")).toBe("computer:computer-id");
  });
});
