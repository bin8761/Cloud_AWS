# CloudCMS Desktop Heartbeat Client

## Overview
CloudCMS needs a desktop client installed on each shop computer so the local backend can know whether that computer is online or offline. The client connects to the existing Socket.IO backend and sends periodic heartbeat events. Web Admin consumes the realtime presence state and displays each computer's current availability.

This SPEC replaces the earlier WPF-only implementation direction with a JavaScript desktop app. The folder name remains `docs/SPEC/WPF` because that was the requested output path, but the implementation target is Electron + TypeScript.

Target users:
- Shop owner or staff who configures a registered computer once.
- Developer/operator who tests local realtime behavior.

Success criteria:
- The desktop app connects to `http://localhost:3000` using a registered `computerId` and `deviceToken`.
- The app sends `client:heartbeat` every 10 seconds while connected.
- Web Admin observes online/offline transitions driven by this app.
- The app can recover from backend restart or temporary network disruption.

## Product Requirements
MVP features:
- Desktop app with one main window.
- Config fields:
  - Server URL, default `http://localhost:3000`
  - Computer ID
  - Device Token
- Actions:
  - Save
  - Connect
  - Disconnect
- Status panel:
  - Connection state: `Disconnected`, `Connecting`, `Connected`, `Reconnecting`, `Error`
  - Last heartbeat sent time
  - Last acknowledgement time
  - Last safe error message
- Local config persistence in `%AppData%/CloudCMS/heartbeat-client.json`.
- Socket.IO auto-reconnect behavior.
- No raw `deviceToken` in logs.

Out of scope for MVP:
- WPF/.NET implementation.
- Full lockscreen behavior.
- Windows service wrapper.
- Auto-start with Windows.
- DPAPI or OS keychain encryption for stored token.
- Managing multiple computers from one app instance.
- Room-map UI in Web Admin.

Primary user flow:
```text
User opens desktop app
  -> enters Server URL, Computer ID, Device Token
  -> clicks Save
  -> clicks Connect
  -> app authenticates with Socket.IO backend
  -> app sends heartbeat every 10 seconds
  -> Web Admin marks the computer online
```

Failure flow:
```text
Invalid credential or unavailable backend
  -> app shows a safe error state
  -> no token is logged
  -> user can edit config and retry
```

## Technical Architecture
Recommended stack:
- Electron for the desktop shell.
- TypeScript for app code.
- Vite for renderer development/build tooling.
- `socket.io-client` for Socket.IO compatibility with the backend.
- Node `fs/promises` and `path` through the Electron main/preload boundary for local config.

Architecture pattern:
```text
Electron Main Process
  - creates BrowserWindow
  - owns app lifecycle
  - exposes config read/write through IPC

Preload Script
  - exposes a small typed API to renderer
  - blocks direct Node access in renderer

Renderer UI
  - config form
  - connection controls
  - status display

Heartbeat Service
  - owns Socket.IO connection
  - sends periodic client:heartbeat
  - reports connection state to UI

Config Store
  - reads/writes %AppData%/CloudCMS/heartbeat-client.json
```

Why Electron:
- It is a real desktop app and satisfies the user's clarified requirement.
- It can use the same JavaScript Socket.IO client ecosystem as the existing web-admin/backend stack.
- It is faster to implement for this project than WPF when the team prefers JavaScript.

## Realtime Protocol
The backend already expects a Socket.IO auth handshake for computer clients:

```ts
{
  clientType: "computer",
  computerId: string,
  deviceToken: string
}
```

Heartbeat event:

```ts
socket.emit("client:heartbeat", {
  sentAt: new Date().toISOString()
});
```

Heartbeat interval:
- 10 seconds.

Expected backend behavior:
- Valid `computerId` + `deviceToken` allows connection.
- Invalid token rejects connection.
- Heartbeat updates server-side presence and `lastSeenAt`.
- Missing heartbeat eventually transitions the machine offline.

## System Maps
Architecture:
```text
+-----------------------------+
| Desktop Heartbeat Client    |
| Electron + TypeScript       |
|                             |
|  Renderer UI                |
|    |                        |
|  Preload API                |
|    |                        |
|  Main Process / ConfigStore |
+-------------|---------------+
              |
              | Socket.IO auth + client:heartbeat
              v
+-----------------------------+
| Backend localhost:3000      |
| Socket.IO Realtime Module   |
+-------------|---------------+
              |
              | computer:online / computer:offline
              v
+-----------------------------+
| React Web Admin             |
| Realtime presence display   |
+-----------------------------+
```

Main screen wireframe:
```text
+--------------------------------------------------+
| CloudCMS Heartbeat Client                         |
+--------------------------------------------------+
| Server URL       [ http://localhost:3000        ] |
| Computer ID      [                              ] |
| Device Token     [ ***************              ] |
|                                                  |
| [Save] [Connect] [Disconnect]                    |
|                                                  |
| State: Connected                                  |
| Last heartbeat: 2026-05-29 10:00:00              |
| Last ack:       2026-05-29 10:00:00              |
| Error:          -                                |
+--------------------------------------------------+
```

## Design System
The UI is operational and compact. It should look like a local utility, not a marketing screen.

Visual direction:
- Neutral light surface.
- Clear labels and dense spacing.
- Strong state indicators for connected/error states.
- No decorative hero content.

Accessibility:
- Every input has a visible label.
- Buttons remain keyboard reachable.
- Error state is shown as text, not color alone.
- Token input uses password masking.

## File Structure
Proposed project layout:

```text
desktop-client/
  heartbeat-client/
    package.json
    tsconfig.json
    vite.config.ts
    electron.vite.config.ts
    src/
      main/
        main.ts
        configStore.ts
      preload/
        preload.ts
      renderer/
        index.html
        main.tsx
        App.tsx
        heartbeatService.ts
        styles.css
        types.ts
```

Config file:
```text
%AppData%/CloudCMS/heartbeat-client.json
```

Config shape:
```ts
type HeartbeatClientConfig = {
  serverUrl: string;
  computerId: string;
  deviceToken: string;
};
```

Status shape:
```ts
type HeartbeatStatus = {
  state: "Disconnected" | "Connecting" | "Connected" | "Reconnecting" | "Error";
  lastHeartbeatSentAt: string | null;
  lastAckAt: string | null;
  lastError: string | null;
};
```

## Security
Constraints:
- Do not log raw `deviceToken`.
- Do not show raw `deviceToken` after save except inside the masked password input.
- Do not pass `deviceToken` in query string.
- Send `deviceToken` only in Socket.IO auth payload.
- Store token in plain JSON only for MVP/local development speed.

Future hardening:
- Encrypt local token with Windows DPAPI or OS keychain.
- Add startup permission and tray mode.
- Add signed installer.

## Development Phases
- [ ] Phase 1: Scaffold Electron + TypeScript app.
- [ ] Phase 2: Add config store through Electron main/preload IPC.
- [ ] Phase 3: Build single-window renderer UI.
- [ ] Phase 4: Implement Socket.IO heartbeat service.
- [ ] Phase 5: Wire connect/disconnect/status updates.
- [ ] Phase 6: Manual end-to-end test with backend and Web Admin.
- [ ] Phase 7: Document QA evidence and remaining limitations.

## Manual QA
Required checks:
- Correct `computerId/deviceToken` connects successfully.
- Web Admin shows the computer online after connect.
- Heartbeat timestamp updates every 10 seconds.
- Closing or disconnecting the app causes backend/Web Admin to mark offline after timeout.
- Wrong token fails without leaking token in UI/logs.
- Backend restart moves app to reconnecting and then connected after backend returns.
- Saved config reloads after app restart.

## Open Questions
- Should the output folder be renamed from `docs/SPEC/WPF` to `docs/SPEC/DesktopHeartbeat` now that the app is no longer WPF?
- Should the first implementation use React in the Electron renderer, or plain TypeScript DOM for the smallest dependency surface?
- Should token storage remain plain JSON through submission, or should DPAPI be added before final delivery?

---

## References
- Design source: `docs/plans/2026-05-29-wpf-heartbeat-client-design.md`
- Backend realtime event names: `backend/src/modules/realtime/realtime.events.ts`
- Backend computer realtime auth: `backend/src/modules/realtime/realtime.auth.ts`
