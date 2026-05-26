# CloudCMS Realtime Manual Verification And Final Review

Date: 2026-05-25
Scope: Task 277-321 in `docs/task/realtime/2026-05-25-realtime-task-breakdown.md`

## 1) Manual Verification Handoff (Task 277-294)

### 1.1 Team prerequisites

1. Ensure backend env and database are configured for your environment.
2. Install dependencies in `backend/`:

```powershell
npm install
```

3. Run Prisma client generation only if local state requires it (Realtime MVP does not add schema changes):

```powershell
npm run prisma:generate
```

4. Start backend server manually:

```powershell
npm run dev
```

5. Obtain valid admin access token with tenant context (`shop_admin` or `staff`).
6. Obtain valid registered `computerId + deviceToken`.

### 1.2 Suggested manual socket checks

1. Connect Web Admin test socket to `/socket.io` with:

```json
{
  "clientType": "admin",
  "accessToken": "<admin-access-token>"
}
```

2. Emit `admin:watch-tenant` with `{}` and verify success ack contains `onlineComputers`.
3. Connect Client PC test socket with:

```json
{
  "clientType": "computer",
  "computerId": "<computer-id>",
  "deviceToken": "<device-token>"
}
```

4. Verify Web Admin receives `computer:online`.
5. Emit `client:heartbeat` with valid `sentAt` and verify success ack includes `serverTime`.
6. Spam heartbeat quickly and verify `TOO_MANY_REQUESTS` ack.
7. Disconnect client socket and verify Web Admin receives `computer:offline`.
8. Verify admin socket from another tenant does not receive those events.
9. Verify invalid device token receives `connect_error`.
10. Verify `super_admin` token receives `connect_error` in realtime MVP.
11. Call `/api/health/runtime` and verify safe realtime counters appear when provider is active.

### 1.3 Suggested command pack for team-run verification

Run from `backend/`:

```powershell
npx vitest run tests/realtime
npx vitest run tests/realtime/realtime.socket.integration.test.ts
npx vitest run tests/realtime/realtime.rest-regression.test.ts
npm run typecheck
```

## 2) Final Review Audit (Task 295-321)

### 2.1 Server and transport wiring

- Socket.IO attached to explicit HTTP server (`createServer(app)` + `createRealtimeServer(httpServer)`) in `backend/src/server.ts`.
- Default namespace `/` and endpoint `/socket.io` are used by Socket.IO default server behavior; tests connect using path `/socket.io`.
- Socket.IO CORS uses `env.app.corsOrigin` in `backend/src/modules/realtime/realtime.server.ts`.

### 2.2 Auth and authorization

- Admin auth uses access-token verification and tenant-context checks in `backend/src/modules/realtime/realtime.auth.ts`.
- Allowed realtime admin roles: `shop_admin`, `staff`; `super_admin` denied.
- Client auth requires valid `computerId + deviceToken`, and rejects inactive/blocked computers.
- `admin:watch-tenant` returns tenant-scoped snapshot from trusted context.
- `client:heartbeat` uses strict validation and rate-limits by `computerId`.

### 2.3 Presence behavior

- First socket transition emits `computer:online`; duplicate sockets do not duplicate online transition.
- Final disconnect/timeout emits `computer:offline`.
- `Computer.lastSeenAt` updates are throttled in `realtime.presence.ts`.
- Realtime shutdown clears timers and closes Socket.IO before process teardown path finishes.

### 2.4 Health and API boundaries

- `/api/health/runtime` can include sanitized `realtime` counters via `HealthService.setRealtimeHealthProvider(...)`.
- No `/api/realtime/*` route is added (unknown realtime route returns `NOT_FOUND` in REST regression tests).

### 2.5 Data/storage/scope boundaries

- No Prisma schema additions for realtime tables.
- No `Computer.onlineStatus` field in schema.
- No Redis adapter or Redis-backed presence code added in realtime module/package dependencies.
- No session/usage/policy/asset/subscription/UI scope is implemented in realtime module.

### 2.6 Logging and sensitive-data handling

- Realtime logging forbids sensitive keys including `accessToken`, `deviceToken`, `deviceTokenHash`, `authorization`, `rawAuth`, `headers`, `handshake`, `payload`.
- Ack/error and logging tests assert sensitive material is not leaked.

### 2.7 Process constraints verification

- Implementation actions in this thread used source-inspection/editing commands and did not autonomously run DB/migration/server/test/typecheck/Prisma runtime commands.
- Breakdown/TDD alignment is maintained and checklist has been updated incrementally with evidence links.

