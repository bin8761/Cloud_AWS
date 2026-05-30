import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";

import {
  loadHeartbeatClientConfig,
  saveHeartbeatClientConfig
} from "./configStore";
import { runHeartbeatCleanup } from "./shutdown";

const DEV_RENDERER_URL = "http://localhost:5174";
const SMOKE_STDOUT_ENABLED = process.env.HEARTBEAT_SMOKE_STDOUT === "1";
const FORCE_DIST_RENDERER = process.env.HEARTBEAT_FORCE_DIST_RENDERER === "1";

let mainWindow: BrowserWindow | null = null;
let isShuttingDown = false;

const resolvePreloadPath = (): string =>
  path.resolve(__dirname, "../preload/preload.js");

const resolveRendererIndexPath = (): string =>
  path.resolve(__dirname, "../renderer/index.html");

const registerConfigIpcHandlers = (): void => {
  ipcMain.handle("config:load", async () => loadHeartbeatClientConfig());
  ipcMain.handle("config:save", async (_event, config) => {
    await saveHeartbeatClientConfig(config);
    return loadHeartbeatClientConfig();
  });
};

const createMainWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 640,
    minWidth: 760,
    minHeight: 520,
    title: "CloudCMS Heartbeat Client",
    webPreferences: {
      preload: resolvePreloadPath(),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (SMOKE_STDOUT_ENABLED) {
    mainWindow.webContents.on("did-finish-load", () => {
      const title = mainWindow?.getTitle() ?? "";
      console.log(`SMOKE_WINDOW_TITLE:${title}`);
    });
  }

  if (!app.isPackaged && !FORCE_DIST_RENDERER) {
    void mainWindow.loadURL(DEV_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void mainWindow.loadFile(resolveRendererIndexPath());
};

const cleanupAndQuit = async (): Promise<void> => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  await runHeartbeatCleanup();
  app.quit();
};

app.whenReady().then(() => {
  registerConfigIpcHandlers();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    void cleanupAndQuit();
  }
});

app.on("before-quit", (event) => {
  if (isShuttingDown) {
    return;
  }

  event.preventDefault();
  void cleanupAndQuit();
});


