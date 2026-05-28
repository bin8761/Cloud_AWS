# Task Breakdown - Lockscreen & Client UI

Date: 2026-05-27
Owner: dung
Status: In Progress

## Phase 1 - Backend Contract Alignment (Done)

1. Add realtime admin control event: `admin:computer-control`.
2. Add realtime computer receive event: `computer:control`.
3. Enforce security checks:
   - only `shop_admin`
   - same-tenant target
   - ACTIVE computer only
4. Add schema and integration tests for control flow.

## Phase 2 - WPF Client Foundation

1. Create lock state machine (`Locked`, `UnlockedTimed`, `UnlockedFree`).
2. Implement fullscreen lockscreen window and floating bar window.
3. Implement session timer service and auto-lock on expiry.
4. Define local config for `computerId`, `deviceToken`, backend realtime URL.

Done criteria:

1. App always starts in `Locked` state.
2. Manual local test can switch between all states.

## Phase 3 - WPF Socket.IO Integration

1. Implement Socket.IO client handshake with `clientType=computer`.
2. Subscribe `computer:control` event.
3. Validate payload target (`computerId`) before state transition.
4. Add reconnect policy and offline-safe behavior.

Done criteria:

1. Receive `unlock/timed` -> unlock + countdown.
2. Receive `unlock/free` -> unlock + free status.
3. Receive `lock` -> lock immediately.

## Phase 4 - React Admin Quick Open Popup

1. Add modal in computer list row action.
2. Inputs:
   - mode: timed/free
   - hours input (timed only)
3. Convert hours -> `durationMinutes` and validate range.
4. Emit `admin:computer-control` with ack handling.

Done criteria:

1. shop_admin can open/lock from popup.
2. Forbidden and validation ack shown clearly.

## Phase 5 - Security Hardening

1. WPF:
   - topmost fullscreen enforcement
   - keyboard interception for common escape combos
   - prevent casual app close
2. Windows local policy profile for production kiosk mode.
3. Ensure no secret/token in logs.

Done criteria:

1. Known bypass vectors are documented.
2. Kiosk policy checklist is attached to release notes.

## Phase 6 - QA / UAT

1. Run backend realtime tests.
2. End-to-end test with one admin and two computers across two tenants.
3. Regression check presence and heartbeat events remain healthy.

Done criteria:

1. No cross-tenant control leakage.
2. No unauthorized control by staff.
3. Timed unlock relocks exactly at expiry.

## Risks

1. User-mode key blocking is not absolute on Windows.
2. Reconnect race can desync UI if state machine is not single-source-of-truth.
3. Duration conversion bugs (hour/minute rounding).

## Mitigations

1. Add kiosk/GPO deployment profile.
2. Keep strict finite-state machine transitions.
3. Centralize duration conversion utility and unit test boundaries.
