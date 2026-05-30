# WPF Heartbeat Client Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real WPF desktop client that authenticates as `clientType: "computer"` and sends periodic `client:heartbeat` events to local Socket.IO backend so realtime online/offline visibility works end-to-end.

**Architecture:** Create a dedicated `desktop-client/HeartbeatClient` WPF app with three layers: UI window (input + status), realtime service (socket lifecycle + heartbeat loop), and local config store (AppData JSON). Keep socket protocol details isolated in service classes and surface only UI-safe state/events.

**Tech Stack:** .NET 8 WPF, C#, `socket.io-client-csharp`, `System.Text.Json`, xUnit/NUnit (optional for non-UI service tests).

---

### Task 1: Scaffold WPF project structure

**Files:**
- Create: `desktop-client/HeartbeatClient/HeartbeatClient.sln`
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/HeartbeatClient.csproj`
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/App.xaml`
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/App.xaml.cs`
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/MainWindow.xaml`
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/MainWindow.xaml.cs`

**Step 1: Create solution and WPF app**

Run:
```powershell
cd C:\Users\yasuo\Desktop\thuctap
mkdir desktop-client
cd desktop-client
mkdir HeartbeatClient
cd HeartbeatClient
dotnet new sln -n HeartbeatClient
dotnet new wpf -n HeartbeatClient -o src/HeartbeatClient
dotnet sln HeartbeatClient.sln add src/HeartbeatClient/HeartbeatClient.csproj
```
Expected: solution and WPF project are created successfully.

**Step 2: Verify project compiles**

Run:
```powershell
dotnet build HeartbeatClient.sln
```
Expected: BUILD SUCCEEDED.

**Step 3: Commit**

```bash
git add desktop-client/HeartbeatClient
git commit -m "chore(wpf): scaffold heartbeat client solution"
```

### Task 2: Add Socket.IO dependency and app folders

**Files:**
- Modify: `desktop-client/HeartbeatClient/src/HeartbeatClient/HeartbeatClient.csproj`
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/Models/`
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/Services/`
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/Infrastructure/`

**Step 1: Add package reference**

Add NuGet package:
```xml
<ItemGroup>
  <PackageReference Include="SocketIOClient" Version="3.*" />
</ItemGroup>
```

**Step 2: Restore and build**

Run:
```powershell
cd C:\Users\yasuo\Desktop\thuctap\desktop-client\HeartbeatClient
dotnet restore
dotnet build HeartbeatClient.sln
```
Expected: restore/build success.

**Step 3: Commit**

```bash
git add desktop-client/HeartbeatClient/src/HeartbeatClient/HeartbeatClient.csproj
git commit -m "chore(wpf): add socket io client dependency"
```

### Task 3: Implement config model and local AppData store

**Files:**
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/Models/HeartbeatClientConfig.cs`
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/Services/IConfigStore.cs`
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/Services/AppDataConfigStore.cs`

**Step 1: Write failing unit test for config persistence (optional but recommended)**

Create test project if enabled and add a test asserting save then load returns same `ServerUrl`, `ComputerId`, `DeviceToken`.

**Step 2: Implement config classes**

Implement:
- `HeartbeatClientConfig` with fields `ServerUrl`, `ComputerId`, `DeviceToken`.
- `AppDataConfigStore` path: `%AppData%/CloudCMS/heartbeat-client.json`.
- `LoadAsync()` returns defaults when missing file.
- `SaveAsync()` writes UTF-8 JSON.

**Step 3: Verify manually in app startup logs/debug output**

Expected: config file created and reloaded across app restart.

**Step 4: Commit**

```bash
git add desktop-client/HeartbeatClient/src/HeartbeatClient/Models/HeartbeatClientConfig.cs desktop-client/HeartbeatClient/src/HeartbeatClient/Services/IConfigStore.cs desktop-client/HeartbeatClient/src/HeartbeatClient/Services/AppDataConfigStore.cs
git commit -m "feat(wpf): add local config persistence store"
```

### Task 4: Implement heartbeat service contract and connection states

**Files:**
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/Models/ConnectionState.cs`
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/Models/HeartbeatStatusSnapshot.cs`
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/Services/IRealtimeHeartbeatService.cs`
- Create: `desktop-client/HeartbeatClient/src/HeartbeatClient/Services/RealtimeHeartbeatService.cs`

**Step 1: Define service API**

Service contract should include:
- `Task ConnectAsync(HeartbeatClientConfig config, CancellationToken ct)`
- `Task DisconnectAsync()`
- `event EventHandler<HeartbeatStatusSnapshot> StatusChanged`
- Status fields: state, lastHeartbeatSentAt, lastAckAt, lastError.

**Step 2: Implement Socket.IO handshake and lifecycle**

Handshake auth payload:
- `clientType = "computer"`
- `computerId = config.ComputerId`
- `deviceToken = config.DeviceToken`

Wire events:
- `OnConnected` => `Connected`
- `OnDisconnected` => `Disconnected`/`Reconnecting`
- `OnReconnectAttempt` => `Reconnecting`
- `OnError` => `Error`

**Step 3: Implement heartbeat loop (10s)**

Use periodic timer to emit `client:heartbeat` with payload:
```json
{ "sentAt": "2026-05-29T10:00:00.000Z" }
```
Record `lastHeartbeatSentAt`; if ack success, update `lastAckAt`.

**Step 4: Commit**

```bash
git add desktop-client/HeartbeatClient/src/HeartbeatClient/Models/ConnectionState.cs desktop-client/HeartbeatClient/src/HeartbeatClient/Models/HeartbeatStatusSnapshot.cs desktop-client/HeartbeatClient/src/HeartbeatClient/Services/IRealtimeHeartbeatService.cs desktop-client/HeartbeatClient/src/HeartbeatClient/Services/RealtimeHeartbeatService.cs
git commit -m "feat(wpf): implement socket heartbeat service"
```

### Task 5: Build MainWindow UI and bind actions

**Files:**
- Modify: `desktop-client/HeartbeatClient/src/HeartbeatClient/MainWindow.xaml`
- Modify: `desktop-client/HeartbeatClient/src/HeartbeatClient/MainWindow.xaml.cs`

**Step 1: Create config form controls**

Add inputs:
- Server URL
- Computer ID
- Device Token (PasswordBox)

Buttons:
- Save
- Connect
- Disconnect

**Step 2: Add status panel**

Display:
- Connection state
- Last heartbeat sent at
- Last ack at
- Last error message

**Step 3: Wire button handlers**

- Save => persist config via `IConfigStore`.
- Connect => validate required fields then call `ConnectAsync`.
- Disconnect => call `DisconnectAsync`.
- Subscribe to `StatusChanged` and marshal updates on UI dispatcher.

**Step 4: Commit**

```bash
git add desktop-client/HeartbeatClient/src/HeartbeatClient/MainWindow.xaml desktop-client/HeartbeatClient/src/HeartbeatClient/MainWindow.xaml.cs
git commit -m "feat(wpf): add heartbeat client ui and controls"
```

### Task 6: Add startup load + safe shutdown behavior

**Files:**
- Modify: `desktop-client/HeartbeatClient/src/HeartbeatClient/App.xaml.cs`
- Modify: `desktop-client/HeartbeatClient/src/HeartbeatClient/MainWindow.xaml.cs`

**Step 1: Load saved config on app launch**

- On startup, load config and populate form fields.

**Step 2: Graceful disconnect on exit**

- Ensure heartbeat timer stops and socket disconnects on app close.

**Step 3: Commit**

```bash
git add desktop-client/HeartbeatClient/src/HeartbeatClient/App.xaml.cs desktop-client/HeartbeatClient/src/HeartbeatClient/MainWindow.xaml.cs
git commit -m "feat(wpf): add startup config load and graceful shutdown"
```

### Task 7: Validate end-to-end with backend + web-admin

**Files:**
- Modify: `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md`
- Create: `docs/module/realtime/2026-05-29-wpf-heartbeat-manual-qa.md`

**Step 1: Manual QA runbook**

Document exact local steps:
- Start backend (`PORT=3000`).
- Ensure registered computer credentials exist.
- Launch WPF app and connect.
- Confirm web-admin shows online state.
- Stop app and confirm offline after timeout.

**Step 2: Record evidence**

Capture observed timestamps/outcomes for:
- connect success
- heartbeat progression
- reconnect recovery
- unauthorized token rejection

**Step 3: Commit**

```bash
git add docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md docs/module/realtime/2026-05-29-wpf-heartbeat-manual-qa.md
git commit -m "docs(wpf): add heartbeat client manual qa runbook"
```

### Task 8: Optional hardening pass (post-MVP)

**Files:**
- Modify: `desktop-client/HeartbeatClient/src/HeartbeatClient/Services/AppDataConfigStore.cs`
- Modify: `desktop-client/HeartbeatClient/src/HeartbeatClient/MainWindow.xaml.cs`

**Step 1: Add token masking in UI after save**

Display masked token while preserving actual value in memory.

**Step 2: Optional local encryption note**

Add TODO/documentation hook for DPAPI protection in future iteration.

**Step 3: Commit**

```bash
git add desktop-client/HeartbeatClient/src/HeartbeatClient/Services/AppDataConfigStore.cs desktop-client/HeartbeatClient/src/HeartbeatClient/MainWindow.xaml.cs
git commit -m "chore(wpf): add token masking and hardening notes"
```

## Notes for execution
- Do not print or log plain `deviceToken`.
- Keep heartbeat interval at 10 seconds to match approved design.
- Keep protocol aligned with backend realtime auth/event names.
- Ask user to run build/tests/runtime checks in their environment if required by workspace rules.
