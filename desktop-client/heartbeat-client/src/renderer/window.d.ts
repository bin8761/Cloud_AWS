import type { HeartbeatClientConfig } from "../shared/types";

type HeartbeatConfigBridge = {
  loadConfig: () => Promise<HeartbeatClientConfig>;
  saveConfig: (config: HeartbeatClientConfig) => Promise<HeartbeatClientConfig>;
};

declare global {
  interface Window {
    heartbeatConfig: HeartbeatConfigBridge;
  }
}

export {};

