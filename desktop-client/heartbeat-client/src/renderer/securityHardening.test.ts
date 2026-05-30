import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "..", "..");
const preloadPath = path.resolve(repoRoot, "src", "preload", "preload.ts");
const rendererFiles = [
  path.resolve(repoRoot, "src", "renderer", "App.tsx"),
  path.resolve(repoRoot, "src", "renderer", "main.tsx"),
  path.resolve(repoRoot, "src", "renderer", "heartbeatService.ts"),
  path.resolve(repoRoot, "src", "renderer", "window.d.ts")
];

describe("security hardening source assertions", () => {
  it("preload only exposes typed config APIs", () => {
    const preloadSource = fs.readFileSync(preloadPath, "utf8");
    expect(preloadSource).toContain("loadConfig");
    expect(preloadSource).toContain("saveConfig");
    expect(preloadSource).not.toContain("contextBridge.exposeInMainWorld(\"heartbeatConfig\", {");
    expect(preloadSource).not.toContain("ipcRenderer.invoke(\"config:delete\")");
  });

  it("renderer has no direct fs/path/electron main-process imports", () => {
    for (const filePath of rendererFiles) {
      const source = fs.readFileSync(filePath, "utf8");
      expect(source).not.toMatch(/from\s+["']node:fs["']/);
      expect(source).not.toMatch(/from\s+["']fs["']/);
      expect(source).not.toMatch(/from\s+["']node:path["']/);
      expect(source).not.toMatch(/from\s+["']path["']/);
      expect(source).not.toMatch(/from\s+["']electron["']/);
      expect(source).not.toMatch(/from\s+["']electron\/main["']/);
    }
  });
});
