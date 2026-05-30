import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/main",
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, "src/main/main.ts"),
      formats: ["cjs"],
      fileName: () => "main.js"
    },
    rollupOptions: {
      external: ["electron", "node:fs", "node:fs/promises", "node:path", "node:os"]
    }
  }
});
