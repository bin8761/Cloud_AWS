# CloudCMS Heartbeat Client (MVP)

## Prerequisites

- Node.js 20+ (LTS recommended)
- npm 10+
- Backend service running at `http://localhost:3000` (or your configured backend URL)
- Registered computer credentials:
  - `computerId`
  - `deviceToken`

## Security Notes

- `deviceToken` is stored in plain JSON at `%AppData%/CloudCMS/heartbeat-client.json` for MVP only.
- Before production use, replace plain JSON token storage with OS-protected storage (DPAPI on Windows or system keychain).
- Realtime auth sends `deviceToken` via Socket.IO `auth` payload, not URL query parameters.

## Reliability Notes

- Heartbeat interval is `10_000` ms (10 seconds).
- Backend offline timeout is 90 seconds, so the 10-second heartbeat cadence stays safely below that timeout.

## Manual QA Evidence Step (Disconnect -> Offline)

1. Connect a valid client and confirm it appears online in Web Admin.
2. Click `Disconnect` in the desktop client (or close the app window).
3. Wait longer than backend offline timeout (90 seconds).
4. Record evidence (timestamp + screenshot/log) that the computer transitions to offline in Web Admin.
