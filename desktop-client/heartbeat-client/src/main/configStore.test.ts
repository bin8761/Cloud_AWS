import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadHeartbeatClientConfig,
  resolveHeartbeatConfigPath,
  saveHeartbeatClientConfig
} from "./configStore";

const createTempConfigPath = async (): Promise<string> => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "heartbeat-client-config-"));
  return path.join(tempDir, "heartbeat-client.json");
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("configStore", () => {
  it("resolves config path under AppData CloudCMS folder", () => {
    const originalAppData = process.env.APPDATA;
    process.env.APPDATA = "C:\\Users\\tester\\AppData\\Roaming";

    expect(resolveHeartbeatConfigPath()).toBe(
      "C:\\Users\\tester\\AppData\\Roaming\\CloudCMS\\heartbeat-client.json"
    );

    process.env.APPDATA = originalAppData;
  });

  it("returns default config when file is missing", async () => {
    const configPath = await createTempConfigPath();
    const loaded = await loadHeartbeatClientConfig(configPath);

    expect(loaded).toEqual({
      serverUrl: "http://localhost:3000",
      computerId: "",
      deviceToken: ""
    });
  });

  it("saves and loads config round trip as UTF-8 JSON", async () => {
    const configPath = await createTempConfigPath();

    const expected = {
      serverUrl: "http://localhost:3000",
      computerId: "pc-101",
      deviceToken: "secret-token-value"
    };

    await saveHeartbeatClientConfig(expected, configPath);
    const reloaded = await loadHeartbeatClientConfig(configPath);

    expect(reloaded).toEqual(expected);

    const raw = await fs.readFile(configPath, "utf8");
    expect(raw).toContain("secret-token-value");
  });

  it("does not use console logging paths while saving and loading token", async () => {
    const configPath = await createTempConfigPath();
    const consoleLogSpy = vi.spyOn(console, "log");
    const consoleErrorSpy = vi.spyOn(console, "error");
    const consoleWarnSpy = vi.spyOn(console, "warn");
    const consoleDebugSpy = vi.spyOn(console, "debug");

    await saveHeartbeatClientConfig(
      {
        serverUrl: "http://localhost:3000",
        computerId: "pc-102",
        deviceToken: "token-without-log-leak"
      },
      configPath
    );

    const loaded = await loadHeartbeatClientConfig(configPath);
    expect(loaded.deviceToken).toBe("token-without-log-leak");

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleDebugSpy).not.toHaveBeenCalled();
  });
});
