"use strict";const e=require("electron/renderer"),n={loadConfig:()=>e.ipcRenderer.invoke("config:load"),saveConfig:i=>e.ipcRenderer.invoke("config:save",i)};e.contextBridge.exposeInMainWorld("heartbeatConfig",n);
//# sourceMappingURL=preload.js.map
