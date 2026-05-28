const { io } = require("socket.io-client");

const BASE_URL = process.env.baseUrl || process.env.BASE_URL || "http://localhost:3000";
const ACCESS_TOKEN = process.env.accessToken || process.env.ACCESS_TOKEN;
const COMPUTER_ID = process.env.computerId || process.env.COMPUTER_ID;
const DEVICE_TOKEN = process.env.deviceToken || process.env.DEVICE_TOKEN;

const missing = [];
if (!ACCESS_TOKEN) missing.push("accessToken");
if (!COMPUTER_ID) missing.push("computerId");
if (!DEVICE_TOKEN) missing.push("deviceToken");

if (missing.length > 0) {
  console.error("Missing env vars:", missing.join(", "));
  process.exit(1);
}

const admin = io(BASE_URL, {
  path: "/socket.io",
  transports: ["websocket"],
  auth: { clientType: "admin", accessToken: ACCESS_TOKEN },
});

admin.on("connect", () => {
  console.log("[admin] connected", admin.id);
  admin.emit("admin:watch-tenant", {}, (ack) => {
    console.log("[admin] watch ack:", ack);
  });
});

admin.on("computer:online", (data) => console.log("[admin] computer:online", data));
admin.on("computer:offline", (data) => console.log("[admin] computer:offline", data));
admin.on("connect_error", (e) => console.log("[admin] connect_error:", e.message));

setTimeout(() => {
  const computer = io(BASE_URL, {
    path: "/socket.io",
    transports: ["websocket"],
    auth: { clientType: "computer", computerId: COMPUTER_ID, deviceToken: DEVICE_TOKEN },
  });

  computer.on("connect", () => {
    console.log("[computer] connected", computer.id);

    const sendHeartbeat = () =>
      new Promise((resolve) => {
        computer.emit("client:heartbeat", { sentAt: new Date().toISOString() }, resolve);
      });

    (async () => {
      console.log("[computer] hb1", await sendHeartbeat());
      console.log("[computer] hb2", await sendHeartbeat());
      console.log("[computer] hb3", await sendHeartbeat());
      console.log("[computer] hb4", await sendHeartbeat());

      setTimeout(() => {
        console.log("[computer] disconnecting...");
        computer.disconnect();
        setTimeout(() => {
          admin.disconnect();
          process.exit(0);
        }, 1000);
      }, 1000);
    })();
  });

  computer.on("connect_error", (e) => console.log("[computer] connect_error:", e.message));
}, 1200);
