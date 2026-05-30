import { contextBridge, ipcRenderer } from "electron/renderer";

import type { HeartbeatClientConfig } from "../shared/types";

type ConfigBridgeApi = {
  loadConfig: () => Promise<HeartbeatClientConfig>;
  saveConfig: (config: HeartbeatClientConfig) => Promise<HeartbeatClientConfig>;
};

const configBridgeApi: ConfigBridgeApi = {
  loadConfig: () => ipcRenderer.invoke("config:load"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config)
};

contextBridge.exposeInMainWorld("heartbeatConfig", configBridgeApi);



