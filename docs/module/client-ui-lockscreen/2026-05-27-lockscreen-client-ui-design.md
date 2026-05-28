# Lockscreen & Client UI Design

Date: 2026-05-27
Status: Draft
Scope: Local desktop client (WPF) + Web Admin popup (React)

## 1. Goal

Implement secure open/lock computer flow:

1. WPF client shows fullscreen lockscreen and listens realtime command from backend.
2. React admin popup sends instant open/lock command.
3. Flow enforces tenant isolation and role restrictions.

This design uses existing backend realtime contract:

- Admin emit: `admin:computer-control`
- Computer receive: `computer:control`

## 2. Realtime Contract (Authoritative)

Admin -> Server event payload:

```json
{
  "computerId": "string",
  "action": "unlock" | "lock",
  "mode": "timed" | "free",
  "durationMinutes": 1..1440
}
```

Validation rules:

1. `lock` must not include `mode` and `durationMinutes`.
2. `unlock + timed` requires `durationMinutes`.
3. `unlock + free` must not include `durationMinutes`.

Server -> Computer event payload:

```json
{
  "tenantId": "string",
  "computerId": "string",
  "action": "unlock" | "lock",
  "mode": "timed" | "free",
  "durationMinutes": 1..1440,
  "sentAt": "ISO datetime"
}
```

Security rules already enforced on backend:

1. Only `shop_admin` can send control command.
2. Target computer must belong to same tenant.
3. Target computer must be ACTIVE.
4. Command is emitted only to room `computer:<computerId>`.

## 3. WPF Client Design

## 3.1 Runtime Components

1. `SocketGateway`: connect/reconnect to Socket.IO using `computerId + deviceToken`.
2. `LockStateMachine`: source of truth for `Locked`, `UnlockedTimed`, `UnlockedFree`.
3. `LockscreenWindow`: topmost fullscreen UI.
4. `FloatingBarWindow`: always-on-top timer/status bar.
5. `SessionClock`: computes remaining time from local monotonic clock.

## 3.2 Lock/Unlock State Machine

States:

1. `Locked`
2. `UnlockedTimed(endAt)`
3. `UnlockedFree`

Transitions:

1. Startup -> `Locked`
2. Receive `unlock/timed` -> `UnlockedTimed`
3. Receive `unlock/free` -> `UnlockedFree`
4. Receive `lock` -> `Locked`
5. Timed session expiry -> `Locked`
6. Critical socket/auth failure policy (optional strict mode) -> `Locked`

## 3.3 UI Behavior

`Locked`:

1. Show `LockscreenWindow` fullscreen on active monitor.
2. Set `Topmost = true`, remove standard chrome, disable close controls.
3. Hide `FloatingBarWindow`.

`UnlockedTimed`:

1. Hide lockscreen.
2. Show floating bar with countdown.
3. When countdown reaches 0, auto-lock.

`UnlockedFree`:

1. Hide lockscreen.
2. Show floating bar with label `Free session`.

## 3.4 Windows Security Reality Check

Requested: block Windows key, Task Manager, Alt+Tab.

Practical constraints:

1. Pure user-mode WPF cannot guarantee absolute blocking of all secure key combos.
2. For stronger lock behavior, use kiosk policies on Windows:
   - Assigned Access / Shell Launcher
   - GPO to disable Task Manager, Win+X shortcuts, lock screen escape paths
   - Run client with hardened local account profile

Implementation baseline for this phase:

1. Global low-level keyboard hook to suppress common combos where possible.
2. Fullscreen topmost + focus steal loop.
3. Disable app exit shortcuts in normal flow.
4. Document remaining bypass vectors and require kiosk policy for production.

## 3.5 WPF Security Checklist

1. Never persist plain `deviceToken` in source code or logs.
2. Redact all command payloads in logs; only keep action/mode/duration.
3. Validate `computerId` in received event equals local configured computer id.
4. Ignore command if payload invalid or target mismatch.
5. Reconnect with jittered backoff; cap retry burst.
6. Lock on local app startup before realtime handshake completes.

## 4. React Web Admin Design

## 4.1 Quick Open Popup

Fields:

1. Computer selector (or open from row context with fixed computerId).
2. Mode toggle:
   - `Timed`
   - `Free`
3. Timed input: hours (decimal or integer) and optional minutes.
4. Secondary action: `Lock now`.

UX rules:

1. Disable submit while request pending.
2. Show explicit ack result: success/forbidden/validation/internal.
3. Convert hours -> `durationMinutes` on client.
4. Hard clamp duration to 1..1440 before emit.

## 4.2 Emit Examples

Unlock timed 2h:

```json
{
  "computerId": "c-001",
  "action": "unlock",
  "mode": "timed",
  "durationMinutes": 120
}
```

Unlock free:

```json
{
  "computerId": "c-001",
  "action": "unlock",
  "mode": "free"
}
```

Lock:

```json
{
  "computerId": "c-001",
  "action": "lock"
}
```

## 4.3 React Security Checklist

1. Show control actions only for `shop_admin` UI role.
2. Do not trust UI-only role checks; always handle forbidden ack.
3. Prevent duplicate rapid emits (debounce + pending lock).
4. Log audit trail client-side without sensitive token material.

## 5. End-to-End Test Matrix

1. shop_admin unlock timed same tenant -> computer receives command, unlocks, countdown starts.
2. shop_admin unlock free same tenant -> computer receives command, enters free mode.
3. shop_admin lock same tenant -> computer locks immediately.
4. staff attempts control -> forbidden ack.
5. shop_admin cross-tenant target -> forbidden ack.
6. invalid payload -> validation error ack.
7. command replay burst -> UI de-dup and stable state.

## 6. Delivery Order

1. WPF skeleton: state machine + lockscreen/floating bar.
2. WPF socket integration with `computer:control`.
3. React popup + emit contract.
4. Joint QA using local tenant with 2 computers.
5. Harden Windows kiosk policy profile and document ops steps.

## 7. Non-Goals For This Task

1. Billing settlement logic.
2. Persistent session accounting in database.
3. Multi-machine orchestration dashboard.
4. Cross-tenant or super-admin override flows.
