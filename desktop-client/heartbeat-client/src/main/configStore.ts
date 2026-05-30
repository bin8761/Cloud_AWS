import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_HEARTBEAT_CLIENT_CONFIG
} from "../shared/realtimeProtocol";
import type { HeartbeatClientConfig } from "../shared/types";

const CLOUDCMS_DIR_NAME = "CloudCMS";
const HEARTBEAT_CONFIG_FILE_NAME = "heartbeat-client.json";

export const resolveHeartbeatConfigPath = (): string => {
  const appDataPath = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
  return path.join(appDataPath, CLOUDCMS_DIR_NAME, HEARTBEAT_CONFIG_FILE_NAME);
};

const sanitizeConfig = (value: unknown): HeartbeatClientConfig => {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_HEARTBEAT_CLIENT_CONFIG };
  }

  const maybe = value as Partial<HeartbeatClientConfig>;

  return {
    serverUrl:
      typeof maybe.serverUrl === "string" && maybe.serverUrl.length > 0
        ? maybe.serverUrl
        : DEFAULT_HEARTBEAT_CLIENT_CONFIG.serverUrl,
    computerId: typeof maybe.computerId === "string" ? maybe.computerId : "",
    deviceToken: typeof maybe.deviceToken === "string" ? maybe.deviceToken : ""
  };
};

export const loadHeartbeatClientConfig = async (
  configPath = resolveHeartbeatConfigPath()
): Promise<HeartbeatClientConfig> => {
  try {
    const raw = await fs.readFile(configPath, "utf8");
    return sanitizeConfig(JSON.parse(raw));
  } catch (error) {
    const isFileMissing =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT";

    if (isFileMissing) {
      return { ...DEFAULT_HEARTBEAT_CLIENT_CONFIG };
    }

    throw error;
  }
};

export const saveHeartbeatClientConfig = async (
  config: HeartbeatClientConfig,
  configPath = resolveHeartbeatConfigPath()
): Promise<void> => {
  const targetDirectory = path.dirname(configPath);
  await fs.mkdir(targetDirectory, { recursive: true });

  const normalized = sanitizeConfig(config);
  const payload = `${JSON.stringify(normalized, null, 2)}\n`;
  await fs.writeFile(configPath, payload, "utf8");
};
