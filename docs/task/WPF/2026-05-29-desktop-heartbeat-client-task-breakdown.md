# CloudCMS Desktop Heartbeat Client Task Breakdown

Source TDD: `docs/tdd/WPF/2026-05-29-desktop-heartbeat-client-technical-design.md`

Source SPEC: `docs/SPEC/WPF/SPEC.md`

Scope: Build a new Electron + TypeScript desktop app in `desktop-client/heartbeat-client` that connects to the existing backend Socket.IO realtime module and emits `client:heartbeat` every 10 seconds. The documentation path keeps `WPF` per request, but the implementation is not WPF/.NET.

Confirmed choices:

- Desktop framework: Electron.
- Language: TypeScript.
- Renderer: React + Vite.
- Package manager: npm.
- Realtime library: `socket.io-client`.
- Test stack: Vitest for config/service logic and React component tests where practical.
- Config storage: plain JSON at `%AppData%/CloudCMS/heartbeat-client.json` for MVP.
- Backend/API changes: none.

UI guidance from `ui-ux-pro-max`:

- Treat this as a compact desktop utility, not a landing page.
- Keep the form short: Server URL, Computer ID, Device Token.
- Use a clear status panel with text labels for connection state, heartbeat time, ack time, and errors.
- Use high-contrast text, visible focus states, and keyboard-reachable controls.
- Do not use emoji icons; use text labels or SVG/Lucide icons if icons are introduced.
- Use stable hover/focus states without layout-shifting scale effects.
- Avoid decorative hero sections, marketing copy, and oversized typography.

## 1. Scaffold And Base Configuration

- [x] Task 1: Create the `desktop-client/` directory. (Completed)
- [x] Task 2: Create the `desktop-client/heartbeat-client/` project directory. (Completed)
- [x] Task 3: Create `desktop-client/heartbeat-client/package.json`. (Completed)
- [x] Task 4: Add `dev`, `build`, `typecheck`, and `test` npm scripts. (Completed)
- [x] Task 5: Add Electron runtime dependency. (Completed)
- [x] Task 6: Add `socket.io-client` runtime dependency. (Completed)
- [x] Task 7: Create `desktop-client/heartbeat-client/tsconfig.json` with strict TypeScript settings. (Completed)
- [x] Task 8: Create Electron build/dev configuration for main, preload, and renderer entry points. (Completed)
- [x] Task 9: Create `desktop-client/heartbeat-client/src/` directory structure. (Completed)
- [x] Task 10: Create `src/main/`, `src/preload/`, `src/renderer/`, and `src/shared/` directories. (Completed)

## 2. Shared Types And Protocol Constants

- [x] Task 11: Create `src/shared/types.ts` for `HeartbeatClientConfig`, `HeartbeatStatus`, and `HeartbeatConnectionState`. (Completed)
- [x] Task 12: Create `src/shared/realtimeProtocol.ts` for `clientType: "computer"` and `client:heartbeat` constants. (Completed)
- [x] Task 13: Add the default server URL constant `http://localhost:3000`. (Completed)
- [x] Task 14: Add status-state helpers for `Disconnected`, `Connecting`, `Connected`, `Reconnecting`, and `Error`. (Completed)
- [x] Task 15: Add unit tests for protocol constants and default config values. (Completed)

## 3. Electron Main Process

- [x] Task 16: Create `src/main/main.ts` to bootstrap the Electron app. (Completed)
- [x] Task 17: Disable direct Node integration in the renderer. (Completed)
- [x] Task 18: Enable renderer context isolation. (Completed)
- [x] Task 19: Handle `window-all-closed` and app shutdown lifecycle. (Completed)
- [x] Task 20: Add Electron app shutdown handling that calls the heartbeat cleanup path before process exit. (Completed)

## 4. Config Store And IPC

- [x] Task 21: Create `src/main/configStore.ts`. (Completed)
- [x] Task 22: Implement AppData path resolution for `%AppData%/CloudCMS/heartbeat-client.json`. (Completed)
- [x] Task 23: Implement config directory creation when missing. (Completed)
- [x] Task 24: Implement config load with default fallback when file is missing. (Completed)
- [x] Task 25: Implement config save using UTF-8 JSON. (Completed)
- [x] Task 26: Implement config save without console logging, debug logging, or error messages that include `deviceToken`. (Completed)
- [x] Task 27: Register IPC handler `config:load` in the main process. (Completed)
- [x] Task 28: Register IPC handler `config:save` in the main process. (Completed)
- [x] Task 29: Create `src/preload/preload.ts`. (Completed)
- [x] Task 30: Expose typed `loadConfig` and `saveConfig` preload APIs. (Completed)
- [x] Task 31: Restrict preload exports to `loadConfig` and `saveConfig` only. (Completed)
- [x] Task 32: Add unit tests for config default loading. (Completed)
- [x] Task 33: Add unit tests for config save/load round trip. (Completed)
- [x] Task 34: Add unit tests that config helpers preserve `deviceToken` without logging it. (Completed)

## 5. UI Workstream

Required skill: `C:\Users\yasuo\.agents\skills\ui-ux-pro-max\SKILL.md`

UI scope: Build and validate the Electron renderer, main window shell, config form, action buttons, status panel, validation messages, keyboard behavior, and UI smoke tests.

- [x] Task 35: Add React and React DOM runtime dependencies. (Completed)
- [x] Task 36: Add TypeScript, Vite, React Vite plugin, Vitest, and renderer test dependencies. (Completed)
- [x] Task 37: Create `desktop-client/heartbeat-client/vite.config.ts` for the React renderer. (Completed)
- [x] Task 38: Configure `BrowserWindow` with preload script path. (Completed)
- [x] Task 39: Load the renderer URL in development mode. (Completed)
- [x] Task 40: Load the packaged renderer file in production build mode. (Completed)
- [x] Task 41: Create `src/renderer/index.html`. (Completed)
- [x] Task 42: Create `src/renderer/main.tsx`. (Completed)
- [x] Task 43: Create `src/renderer/App.tsx`. (Completed)
- [x] Task 44: Create `src/renderer/styles.css`. (Completed)
- [x] Task 45: Implement a compact single-window layout in `App.tsx`. (Completed)
- [x] Task 46: Add visible label and input for `Server URL`. (Completed)
- [x] Task 47: Add visible label and input for `Computer ID`. (Completed)
- [x] Task 48: Add visible label and password input for `Device Token`. (Completed)
- [x] Task 49: Add `Save` button. (Completed)
- [x] Task 50: Add `Connect` button. (Completed)
- [x] Task 51: Add `Disconnect` button. (Completed)
- [x] Task 52: Add status display for connection state. (Completed)
- [x] Task 53: Add status display for last heartbeat sent timestamp. (Completed)
- [x] Task 54: Add status display for last acknowledgement timestamp. (Completed)
- [x] Task 55: Add status display for safe error messages. (Completed)
- [x] Task 56: Load saved config into the form when the renderer starts. (Completed)
- [x] Task 57: Save form config through preload API when `Save` is clicked. (Completed)
- [x] Task 58: Validate `Server URL` is non-empty before connect. (Completed)
- [x] Task 59: Validate `Computer ID` is non-empty before connect. (Completed)
- [x] Task 60: Validate `Device Token` is non-empty before connect. (Completed)
- [x] Task 61: Render validation errors as text, not color alone. (Completed)
- [x] Task 62: Disable `Connect` while connecting. (Completed)
- [x] Task 63: Disable `Disconnect` when already disconnected. (Completed)
- [x] Task 64: Add keyboard-reachable tab order for Server URL, Computer ID, Device Token, Save, Connect, and Disconnect controls. (Completed)
- [x] Task 65: Implement compact utility styling with a single-column form, grouped action row, and status panel. (Completed)
- [x] Task 66: Add visible focus states for all inputs and buttons. (Completed)
- [x] Task 67: Add stable hover states for clickable controls without scale-based layout shifts. (Completed)
- [x] Task 68: Ensure UI text remains readable at typical desktop window widths. (Completed)
- [x] Task 69: Use text labels or SVG/Lucide icons only; do not use emoji icons. (Completed)
- [x] Task 70: Implement status subscription or callback mechanism for UI updates. (Completed)
- [x] Task 71: Wire renderer Connect button to the heartbeat service. (Completed)
- [x] Task 72: Wire renderer Disconnect button to the heartbeat service. (Completed)
- [x] Task 73: Update the status panel from heartbeat service snapshots. (Completed)
- [x] Task 74: Update reconnect status asynchronously without blocking input controls or window rendering. (Completed)
- [x] Task 75: Load saved config on app startup and populate Server URL, Computer ID, and Device Token fields. (Completed)
- [x] Task 76: Add renderer tests for required fields and labels. (Completed)
- [x] Task 77: Add renderer tests for validation error rendering. (Completed)
- [x] Task 78: Add renderer tests for save action calling the preload API. (Completed)
- [x] Task 79: Add renderer tests for Connect and Disconnect button state changes. (Completed)
- [x] Task 80: Add a local dev smoke check step that launches Electron and confirms the main window renders `CloudCMS Heartbeat Client`.
- [x] Task 81: Run the production build output and record that the main window launches successfully.

## 6. Heartbeat Service

Execution mini-batches for implementation workflow:

- Batch 6.1 (Foundation): Tasks 82-85
- Batch 6.2 (Connect/Disconnect + Status): Tasks 86-92
- Batch 6.3 (Error Mapping): Tasks 93-94
- Batch 6.4 (Heartbeat Loop): Tasks 95-100
- Batch 6.5 (Idempotency + Cleanup): Tasks 101-103
- Batch 6.6 (Unit Tests): Tasks 104-108

### 6.1 Foundation (Tasks 82-85)

- [x] Task 82: Create `src/renderer/heartbeatService.ts`. (Completed)
- [x] Task 83: Implement Socket.IO client creation using the configured server URL. (Completed)
- [x] Task 84: Attach auth payload with `clientType: "computer"`, `computerId`, and `deviceToken`. (Completed)
- [x] Task 85: Configure Socket.IO auto-reconnect. (Completed)

Verification gate:
- Service module compiles and exports a constructible heartbeat service API without runtime throw.

### 6.2 Connect/Disconnect + Status (Tasks 86-92)

- [x] Task 86: Implement `connect(config)` method. (Completed)
- [x] Task 87: Implement `disconnect()` method. (Completed)
- [x] Task 88: Set status to `Connecting` before opening the socket. (Completed)
- [x] Task 89: Set status to `Connected` on successful socket connection. (Completed)
- [x] Task 90: Set status to `Reconnecting` during reconnect attempts. (Completed)
- [x] Task 91: Set status to `Disconnected` after manual disconnect. (Completed)
- [x] Task 92: Set status to `Error` for connect errors. (Completed)

Verification gate:
- Local run confirms deterministic state transitions for connect, reconnect, disconnect, and connect-error paths.

### 6.3 Error Mapping (Tasks 93-94)

- [x] Task 93: Normalize unauthorized failures into a safe UI error message. (Completed)
- [x] Task 94: Normalize unreachable backend failures into a safe UI error message. (Completed)

Verification gate:
- Renderer displays sanitized error text and does not expose raw auth payload or token-related values.

### 6.4 Heartbeat Loop (Tasks 95-100)

- [x] Task 95: Start a 10-second heartbeat timer only after connection succeeds. (Completed)
- [x] Task 96: Emit `client:heartbeat` with `{ sentAt: new Date().toISOString() }`. (Completed)
- [x] Task 97: Update `lastHeartbeatSentAt` immediately after heartbeat emit attempt. (Completed)
- [x] Task 98: Update `lastAckAt` when heartbeat ack succeeds. (Completed)
- [x] Task 99: Surface heartbeat ack failure without crashing the renderer. (Completed)
- [x] Task 100: Stop the heartbeat timer on disconnect. (Completed)

Verification gate:
- Runtime evidence shows heartbeat emits at 10-second cadence after connect and stops immediately after disconnect.

### 6.5 Idempotency + Cleanup (Tasks 101-103)

- [x] Task 101: Prevent duplicate sockets when `connect` is called repeatedly. (Completed)
- [x] Task 102: Prevent duplicate heartbeat timers after reconnect. (Completed)
- [x] Task 103: Dispose socket listeners on disconnect. (Completed)

Verification gate:
- Repeated connect/disconnect cycles do not increase active socket count, listeners, or timer count.

### 6.6 Unit Tests (Tasks 104-108)

- [x] Task 104: Add unit tests verifying Socket.IO auth payload shape. (Completed)
- [x] Task 105: Add unit tests verifying heartbeat event name and payload shape. (Completed)
- [x] Task 106: Add unit tests verifying duplicate connect calls do not create duplicate timers. (Completed)
- [x] Task 107: Add unit tests verifying disconnect stops the heartbeat timer. (Completed)
- [x] Task 108: Add unit tests verifying reconnect events update status state. (Completed)

Verification gate:
- `npm run test` passes with explicit coverage for all behaviors in tasks 104-108.

## 7. App Lifecycle And Shutdown

Execution mini-batches for implementation workflow:

- Batch 7.1 (Shutdown Hooks): Tasks 109-110
- Batch 7.2 (Restart Reload): Task 111

### 7.1 Shutdown Hooks (Tasks 109-110)

- [x] Task 109: Stop heartbeat when the renderer window closes. (Completed)
- [x] Task 110: Stop heartbeat when Electron app is quitting. (Completed)

Verification gate:
- Renderer lifecycle hooks stop heartbeat on `beforeunload`/`unload`, and component unmount cleanup remains idempotent.

### 7.2 Restart Reload (Task 111)

- [x] Task 111: Ensure app restart reloads saved config through the config store and renderer form. (Completed)

Verification gate:
- Renderer test proves config is reloaded on remount/restart path and form reflects stored values.

## 8. Security And Reliability Hardening

Execution mini-batches for implementation workflow:

- Batch 8.1 (Log-Surface Audit): Tasks 112-113
- Batch 8.2 (Transport + Boundary Assertions): Tasks 114-115
- Batch 8.3 (Safe Error + Interval Reliability): Tasks 116, 118-119
- Batch 8.4 (MVP Security Documentation + QA Evidence): Tasks 117, 120

### 8.1 Log-Surface Audit (Tasks 112-113)

- [x] Task 112: Run a source search for `console`, `logger`, and `deviceToken` in renderer files and remove any raw token logging paths. (Completed)
- [x] Task 113: Run a source search for `console`, `logger`, and `deviceToken` in main/preload files and remove any raw token logging paths. (Completed)

Verification gate:
- `rg --line-number --hidden -g '!dist/**' "console|logger|deviceToken" src/renderer` and `src/main src/preload` show no raw token logging in app runtime code paths.

### 8.2 Transport + Boundary Assertions (Tasks 114-115)

- [x] Task 114: Add a test or source assertion that Socket.IO uses auth payload for `deviceToken` and does not place it in URL query parameters. (Completed)
- [x] Task 115: Verify preload exposes only typed config APIs and renderer code has no direct `fs`, `path`, or Electron main-process imports. (Completed)

Verification gate:
- Test coverage confirms Socket.IO options use `auth.deviceToken` and `query` is undefined.
- Source-assertion tests confirm preload/renderer boundary constraints.

### 8.3 Safe Error + Interval Reliability (Tasks 116, 118-119)

- [x] Task 116: Implement safe error mapping so displayed errors never include `computerId`, `deviceToken`, or raw Socket.IO auth payloads. (Completed)
- [x] Task 118: Add a unit test or constant assertion that heartbeat interval is `10_000` milliseconds. (Completed)
- [x] Task 119: Document in code or README that the 10-second heartbeat interval is below the backend 90-second timeout. (Completed)

Verification gate:
- Tests assert secret-bearing error text is never surfaced directly.
- Constant/test plus inline code/README notes document interval-vs-timeout rationale.

### 8.4 MVP Security Documentation + QA Evidence (Tasks 117, 120)

- [x] Task 117: Add README note that plain JSON token storage is MVP-only and should be replaced with DPAPI/keychain before production. (Completed)
- [x] Task 120: Add manual QA evidence step for manual disconnect leading to offline state after backend timeout. (Completed)

Verification gate:
- `desktop-client/heartbeat-client/README.md` includes MVP token-storage limitation and explicit disconnect->offline evidence steps.

## 9. Build, Typecheck, And Unit Testing

- [x] Task 121: Run `npm install` in `desktop-client/heartbeat-client`. (Completed)
- [x] Task 122: Run `npm run typecheck` and fix TypeScript errors. (Completed)
- [x] Task 123: Run `npm run test` and fix unit/component test failures. (Completed)
- [x] Task 124: Run `npm run build` and fix Electron/Vite build failures. (Completed)
- [x] Task 125: Add README prerequisites for Node.js, npm, backend URL, and registered computer credentials. (Completed)

## 10. Manual End-To-End QA

- [x] Task 126: Start the backend on `http://localhost:3000`. (Completed 2026-05-30)
- [x] Task 127: Start Web Admin and open the computers page. (Completed 2026-05-30)
- [x] Task 128: Register or reissue a computer token for a test computer. (Completed 2026-05-30)
- [x] Task 129: Launch the desktop heartbeat client. (Completed 2026-05-30)
- [x] Task 130: Enter `serverUrl`, `computerId`, and `deviceToken`. (Completed 2026-05-30)
- [ ] Task 131: Save the config and confirm it reloads after app restart.
- [x] Task 132: Connect with valid credentials. (Completed 2026-05-30)
- [x] Task 133: Record manual QA evidence that Web Admin shows the test computer online after connect. (Completed 2026-05-30)
- [x] Task 134: Wait through multiple heartbeat intervals and confirm timestamps update. (Completed 2026-05-30)
- [x] Task 135: Disconnect or close the app. (Completed 2026-05-30)
- [x] Task 136: Record manual QA evidence that Web Admin shows the test computer offline after backend timeout. (Completed 2026-05-30)
- [x] Task 137: Enter an invalid token and confirm a safe unauthorized error. (Completed 2026-05-30 via old-token-after-reissue rejection path)
- [ ] Task 138: Restart backend while the app is connected and confirm reconnect recovery.
- [ ] Task 139: Record manual QA evidence that visible UI errors and console logs do not include raw `deviceToken`.

Manual evidence note (2026-05-30):
- Desktop client reached `Connected` state with valid `computerId` + `deviceToken`.
- Web Admin reflected realtime presence `Online` and heartbeat timestamps updated.
- Manual disconnect path moved presence to `Offline`.
- Reissue flow validated: old token rejected, new token connected successfully.

## 11. Documentation

- [ ] Task 140: Create `desktop-client/heartbeat-client/README.md`.
- [ ] Task 141: Document setup commands for the Electron app.
- [ ] Task 142: Document how to obtain `computerId` and `deviceToken`.
- [ ] Task 143: Document local config path and MVP token-storage limitation.
- [ ] Task 144: Document manual QA steps for backend + Web Admin + desktop client.
- [ ] Task 145: Update `docs/tdd/WPF/2026-05-29-desktop-heartbeat-client-technical-design.md` if implementation decisions diverge.
- [ ] Task 146: Update `docs/SPEC/WPF/SPEC.md` if folder naming or framework choices change.

## 12. Open Questions And Post-MVP Follow-Up

- [ ] Task 147: Decide whether to rename `docs/SPEC/WPF`, `docs/tdd/WPF`, and `docs/task/WPF` to `DesktopHeartbeat`.
- [ ] Task 148: Decide whether DPAPI or OS keychain token encryption is required before final delivery.
- [ ] Task 149: Decide whether installer packaging is required before submission.
- [ ] Task 150: Decide whether Windows auto-start is required after MVP.
- [ ] Task 151: Decide whether tray mode is required after MVP.
- [ ] Task 152: Decide whether the Web Admin room-map UI should be planned as a separate feature after heartbeat client completion.
