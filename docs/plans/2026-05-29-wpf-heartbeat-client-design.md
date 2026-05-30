# WPF Heartbeat Client Design

Date: 2026-05-29
Owner: Nguoi 1
Status: Approved for planning

## 1. Objective
Build a real WPF desktop client that connects to the local Socket.IO backend and sends periodic heartbeat events so Web Admin can reflect machine online/offline status in realtime.

## 2. Scope (MVP)
- WPF app with a single main window.
- Config form fields:
  - Server URL (default: `http://localhost:3000`)
  - Computer ID
  - Device Token
- Actions:
  - Save config
  - Connect
  - Disconnect
- Realtime status panel:
  - Connection state: Disconnected / Connecting / Connected / Reconnecting / Error
  - Last heartbeat sent time
  - Last ack time
- Local config persistence in `%AppData%/CloudCMS/heartbeat-client.json`.

## 3. Architecture
- UI layer:
  - `MainWindow` for config input and status display.
- Service layer:
  - `RealtimeHeartbeatService` manages Socket.IO connection lifecycle and heartbeat loop.
- Storage layer:
  - `ConfigStore` reads/writes local JSON config.
- Optional view-model abstraction can be added for cleaner state binding, but MVP may use direct code-behind with a clear service boundary.

## 4. Realtime Protocol Contract
Use Socket.IO auth handshake payload:
- `clientType: "computer"`
- `computerId: <string>`
- `deviceToken: <string>`

Heartbeat event:
- Event name: `client:heartbeat`
- Payload: `{ sentAt: ISO-8601 datetime string }`
- Interval: every 10 seconds.

## 5. Data Flow
### Connect flow
1. User clicks Connect.
2. Validate required fields are non-empty.
3. Build Socket.IO client with auth payload.
4. Connect socket and update UI state to `Connecting` then `Connected`.
5. Start heartbeat timer loop.

### Heartbeat flow
1. Every 10 seconds, emit `client:heartbeat` with `sentAt`.
2. On success ack, update `Last ack time`.
3. On heartbeat failure, keep app alive and surface warning state.

### Disconnect flow
1. User clicks Disconnect.
2. Stop heartbeat timer.
3. Disconnect socket.
4. Update UI state to `Disconnected`.

### Reconnect flow
1. On network/server disruption, state moves to `Reconnecting`.
2. Socket.IO client auto-reconnect is used.
3. After reconnect, heartbeat loop continues.

## 6. Error Handling
- Invalid `computerId/deviceToken`:
  - Connection rejected by server; show `Unauthorized` style message.
- Invalid `Server URL` or backend unavailable:
  - Show `Cannot connect` and allow retry.
- Temporary network interruption:
  - Keep process alive; auto-reconnect.
- Runtime exceptions:
  - Catch in service and bubble a safe message to UI.

## 7. Security Notes (MVP)
- Never log raw `deviceToken`.
- Do not pass token in query string; only in Socket.IO auth payload.
- Local config stores token in plain text for MVP speed in local environment only.
- UI may mask token after save for shoulder-surfing reduction.

## 8. Manual Test Checklist
1. Correct `computerId/deviceToken` connects successfully.
2. Web Admin shows computer online shortly after connect.
3. Closing WPF app transitions computer offline after backend heartbeat timeout.
4. Wrong token fails connect with clear error.
5. Backend restart or temporary network drop triggers reconnect and recovers.
6. App restart reloads saved config.

## 9. Out of Scope (This MVP)
- Full lockscreen behavior.
- Auto start with Windows service wrapper.
- Secure local secret vaulting/DPAPI encryption for token.
- Multi-machine management in one desktop app instance.

## 10. Acceptance Criteria
- WPF app can connect to local backend Socket.IO using computer credentials.
- Heartbeat is emitted every 10 seconds while connected.
- App recovers from transient disconnects without restart.
- Web Admin realtime presence can observe online/offline transitions driven by this client.
