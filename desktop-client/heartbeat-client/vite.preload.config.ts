import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/preload",
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, "src/preload/preload.ts"),
      formats: ["cjs"],
      fileName: () => "preload.js"
    },
    rollupOptions: {
      external: ["electron", "electron/renderer", "node:fs", "node:path", "node:os"]
    }
  }
});
