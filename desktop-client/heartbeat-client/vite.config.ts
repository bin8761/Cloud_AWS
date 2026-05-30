import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "src/renderer"),
  server: {
    port: 5174,
    strictPort: true
  },
  build: {
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: false
  }
});
