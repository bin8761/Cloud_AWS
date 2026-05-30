const path = require("node:path");
const { spawn } = require("node:child_process");
const waitOn = require("wait-on");

const projectRoot = process.cwd();
const mainEntry = path.resolve(projectRoot, "dist/main/main.js");
const preloadEntry = path.resolve(projectRoot, "dist/preload/preload.js");

async function run() {
  await waitOn({
    resources: ["tcp:5174", `file:${mainEntry}`, `file:${preloadEntry}`]
  });

  const electronBinary = require("electron");
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;

  const child = spawn(electronBinary, [mainEntry], {
    stdio: "inherit",
    env
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

run().catch((error) => {
  console.error("Failed to start Electron in dev mode.");
  console.error(error);
  process.exit(1);
});
