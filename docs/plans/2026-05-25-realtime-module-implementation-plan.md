# Realtime Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Socket.IO Presence MVP for CloudCMS realtime: authenticated admin/client sockets, tenant/computer rooms, heartbeat, online/offline presence, and safe observability.

**Architecture:** Attach Socket.IO to the existing Express HTTP server and keep realtime under `backend/src/modules/realtime`. Realtime owns transport, socket auth, rooms, presence, heartbeat, and gateway emits; business modules integrate later only through `realtime.gateway.ts`.

**Tech Stack:** Node.js, TypeScript, Express, Socket.IO, Prisma, Vitest, Supertest/socket.io-client, existing shared logging/error/rate-limit patterns.

---

## Preconditions

- Design source: `docs/module/realtime/2026-05-25-realtime-module-design.md`
- Backend source root: `backend/`
- Do not run DB, migration, Prisma CLI, server, typecheck, or test commands autonomously in this workspace. The user/team runs commands when ready.
- No Prisma schema migration is expected for this MVP.

## Task 1: Add Socket.IO Dependencies

**Files:**
- Modify: `backend/package.json`
- Modify after user/team install: `backend/package-lock.json`

**Step 1: Update package manifest**

Add runtime dependency:

```json
"socket.io": "*"
```

Add dev dependency:

```json
"socket.io-client": "*"
```

**Step 2: Ask user/team to install**

Run manually:

```bash
cd backend
npm install socket.io
npm install -D socket.io-client
```

Expected: `package.json` and `package-lock.json` include both packages.

**Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(backend): add realtime socket dependencies"
```

## Task 2: Create Realtime Module Scaffold

**Files:**
- Create: `backend/src/modules/realtime/realtime.server.ts`
- Create: `backend/src/modules/realtime/realtime.auth.ts`
- Create: `backend/src/modules/realtime/realtime.rooms.ts`
- Create: `backend/src/modules/realtime/realtime.presence.ts`
- Create: `backend/src/modules/realtime/realtime.handlers.ts`
- Create: `backend/src/modules/realtime/realtime.gateway.ts`
- Create: `backend/src/modules/realtime/realtime.events.ts`
- Create: `backend/src/modules/realtime/realtime.types.ts`

**Step 1: Create type contracts**

In `realtime.types.ts`, define:

```ts
export type RealtimeClientType = "admin" | "computer";

export type RealtimeAdminContext = {
  clientType: "admin";
  socketId: string;
  userId: string;
  tenantId: string;
  role: "shop_admin" | "staff" | "super_admin";
};

export type RealtimeComputerContext = {
  clientType: "computer";
  socketId: string;
  computerId: string;
  tenantId: string;
};

export type RealtimeSocketContext =
  | RealtimeAdminContext
  | RealtimeComputerContext;
```

**Step 2: Create event constants**

In `realtime.events.ts`, define:

```ts
export const REALTIME_EVENTS = {
  ADMIN_WATCH_TENANT: "admin:watch-tenant",
  CLIENT_HEARTBEAT: "client:heartbeat",
  COMPUTER_ONLINE: "computer:online",
  COMPUTER_OFFLINE: "computer:offline",
} as const;
```

**Step 3: Commit**

```bash
git add backend/src/modules/realtime
git commit -m "feat(realtime): scaffold realtime module contracts"
```

## Task 3: Implement Room Helpers With Tests

**Files:**
- Modify: `backend/src/modules/realtime/realtime.rooms.ts`
- Create: `backend/tests/realtime/realtime.unit.test.ts`

**Step 1: Write failing room tests**

```ts
import { describe, expect, it } from "vitest";
import { buildComputerRoom, buildTenantRoom } from "../../src/modules/realtime/realtime.rooms";

describe("realtime room helpers", () => {
  it("builds tenant room names", () => {
    expect(buildTenantRoom("tenant-1")).toBe("tenant:tenant-1");
  });

  it("builds computer room names", () => {
    expect(buildComputerRoom("computer-1")).toBe("computer:computer-1");
  });
});
```

**Step 2: Implement helpers**

```ts
export const buildTenantRoom = (tenantId: string): string => `tenant:${tenantId}`;
export const buildComputerRoom = (computerId: string): string => `computer:${computerId}`;
```

**Step 3: Ask user/team to run tests**

```bash
cd backend
npm test -- tests/realtime/realtime.unit.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add backend/src/modules/realtime/realtime.rooms.ts backend/tests/realtime/realtime.unit.test.ts
git commit -m "test(realtime): cover socket room helpers"
```

## Task 4: Implement Realtime Ack And Error Contracts

**Files:**
- Modify: `backend/src/modules/realtime/realtime.events.ts`
- Modify: `backend/tests/realtime/realtime.unit.test.ts`

**Step 1: Add tests for ack shape**

Test success and error ack builders:

```ts
expect(createRealtimeSuccessAck({ serverTime: "2026-05-25T10:00:00.000Z" })).toEqual({
  success: true,
  data: { serverTime: "2026-05-25T10:00:00.000Z" },
});

expect(createRealtimeErrorAck("UNAUTHORIZED", "Authentication is required.")).toEqual({
  success: false,
  error: { code: "UNAUTHORIZED", message: "Authentication is required." },
});
```

**Step 2: Implement ack helpers**

Add generic success/error ack types and builders.

**Step 3: Ask user/team to run tests**

```bash
cd backend
npm test -- tests/realtime/realtime.unit.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add backend/src/modules/realtime/realtime.events.ts backend/tests/realtime/realtime.unit.test.ts
git commit -m "feat(realtime): add socket ack contracts"
```

## Task 5: Implement Admin Socket Auth

**Files:**
- Modify: `backend/src/modules/realtime/realtime.auth.ts`
- Modify: `backend/tests/realtime/realtime.unit.test.ts`

**Step 1: Write failing admin auth tests**

Cover:

- valid access token with tenant context succeeds
- missing token fails
- invalid token fails
- refresh-token-type token fails
- missing tenant context fails

**Step 2: Implement admin auth**

Reuse:

```ts
import { authTokenService } from "../auth/auth.tokens";
```

Build a helper like:

```ts
export const authenticateAdminSocket = async (accessToken: unknown) => {
  // verify JWT, validate sub/tenantId/role/tokenType, return admin context input
};
```

**Step 3: Ask user/team to run tests**

```bash
cd backend
npm test -- tests/realtime/realtime.unit.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add backend/src/modules/realtime/realtime.auth.ts backend/tests/realtime/realtime.unit.test.ts
git commit -m "feat(realtime): authenticate admin sockets"
```

## Task 6: Implement Client Device Token Socket Auth

**Files:**
- Modify: `backend/src/modules/realtime/realtime.auth.ts`
- Modify: `backend/tests/realtime/realtime.unit.test.ts`

**Step 1: Write failing client auth tests**

Cover:

- valid `computerId + deviceToken` succeeds
- invalid device token fails
- unknown computer fails
- `INACTIVE` computer fails
- `BLOCKED` computer fails

**Step 2: Implement client auth**

Reuse Computers token hashing:

```ts
import { hashDeviceToken } from "../computers/computers.service";
```

Query Prisma for:

```ts
computer.findUnique({
  where: { id: computerId },
  select: {
    id: true,
    tenantId: true,
    status: true,
    deviceTokenHash: true,
  },
});
```

**Step 3: Ask user/team to run tests**

```bash
cd backend
npm test -- tests/realtime/realtime.unit.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add backend/src/modules/realtime/realtime.auth.ts backend/tests/realtime/realtime.unit.test.ts
git commit -m "feat(realtime): authenticate computer sockets"
```

## Task 7: Implement Presence Service

**Files:**
- Modify: `backend/src/modules/realtime/realtime.presence.ts`
- Modify: `backend/tests/realtime/realtime.unit.test.ts`

**Step 1: Write failing presence tests**

Cover:

- first socket marks computer online
- second socket for same computer does not duplicate online
- removing one of two sockets keeps computer online
- removing final socket marks computer offline
- tenant snapshot returns only computers in that tenant
- health snapshot returns counts

**Step 2: Implement presence store**

Use in-memory maps:

```ts
type ComputerPresence = {
  tenantId: string;
  socketIds: Set<string>;
  lastHeartbeatAt: Date;
  lastSeenPersistedAt?: Date;
};
```

Expose methods:

```ts
markComputerSocketConnected(input)
markComputerSocketDisconnected(input)
recordHeartbeat(input)
getOnlineComputersForTenant(tenantId)
getHealthSnapshot()
clear()
```

**Step 3: Ask user/team to run tests**

```bash
cd backend
npm test -- tests/realtime/realtime.unit.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add backend/src/modules/realtime/realtime.presence.ts backend/tests/realtime/realtime.unit.test.ts
git commit -m "feat(realtime): track computer presence in memory"
```

## Task 8: Implement Heartbeat Rate Limiter

**Files:**
- Modify: `backend/src/modules/realtime/realtime.presence.ts` or create `backend/src/modules/realtime/realtime.rate-limit.ts`
- Modify: `backend/tests/realtime/realtime.unit.test.ts`

**Step 1: Write failing rate-limit test**

Test capacity `3`, refill `1 token / 10 seconds`, keyed by `computerId`.

**Step 2: Implement event-level token bucket adapter**

Reuse existing token bucket/store concepts from:

```text
backend/src/shared/rate-limit/token-bucket.ts
backend/src/shared/rate-limit/in-memory-rate-limit.store.ts
```

Do not use Express middleware directly.

**Step 3: Ask user/team to run tests**

```bash
cd backend
npm test -- tests/realtime/realtime.unit.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add backend/src/modules/realtime backend/tests/realtime/realtime.unit.test.ts
git commit -m "feat(realtime): rate limit client heartbeats"
```

## Task 9: Implement Realtime Gateway

**Files:**
- Modify: `backend/src/modules/realtime/realtime.gateway.ts`
- Modify: `backend/tests/realtime/realtime.unit.test.ts`

**Step 1: Write failing gateway tests**

Mock a minimal emitter and verify:

- `emitComputerOnline` emits to `tenant:<tenantId>`
- `emitComputerOffline` emits to `tenant:<tenantId>`
- payload contains `computerId`, `tenantId`, `lastSeenAt`

**Step 2: Implement gateway**

Expose:

```ts
emitComputerOnline(input)
emitComputerOffline(input)
getPresenceSnapshotForTenant(tenantId)
getRealtimeHealthSnapshot()
```

Keep Socket.IO server reference private to realtime.

**Step 3: Ask user/team to run tests**

```bash
cd backend
npm test -- tests/realtime/realtime.unit.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add backend/src/modules/realtime/realtime.gateway.ts backend/tests/realtime/realtime.unit.test.ts
git commit -m "feat(realtime): add presence gateway emits"
```

## Task 10: Implement Socket Handlers

**Files:**
- Modify: `backend/src/modules/realtime/realtime.handlers.ts`
- Modify: `backend/src/modules/realtime/realtime.events.ts`
- Create: `backend/tests/realtime/realtime.socket.test.ts`

**Step 1: Write failing socket integration tests**

Cover:

- admin `admin:watch-tenant` returns snapshot
- client `client:heartbeat` returns success ack
- heartbeat spam returns `TOO_MANY_REQUESTS`
- final disconnect emits `computer:offline`

**Step 2: Implement handlers**

Register:

```ts
socket.on(REALTIME_EVENTS.ADMIN_WATCH_TENANT, handler)
socket.on(REALTIME_EVENTS.CLIENT_HEARTBEAT, handler)
socket.on("disconnect", handler)
```

Use socket context to prevent wrong client type from emitting wrong events.

**Step 3: Ask user/team to run tests**

```bash
cd backend
npm test -- tests/realtime/realtime.socket.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add backend/src/modules/realtime/realtime.handlers.ts backend/src/modules/realtime/realtime.events.ts backend/tests/realtime/realtime.socket.test.ts
git commit -m "feat(realtime): handle watch tenant and heartbeat events"
```

## Task 11: Initialize Socket.IO Server

**Files:**
- Modify: `backend/src/modules/realtime/realtime.server.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/tests/realtime/realtime.socket.test.ts`

**Step 1: Write failing server lifecycle test**

Test that Socket.IO can attach to an HTTP server and close without leaving open handles.

**Step 2: Implement realtime server init**

Create:

```ts
export const initializeRealtimeServer = (httpServer: HttpServer) => {
  // create Server from socket.io, set cors, register auth middleware and handlers
};
```

**Step 3: Modify `server.ts`**

Replace direct `app.listen` with HTTP server creation and realtime initialization.

**Step 4: Ask user/team to run tests**

```bash
cd backend
npm test -- tests/realtime/realtime.socket.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/src/modules/realtime/realtime.server.ts backend/src/server.ts backend/tests/realtime/realtime.socket.test.ts
git commit -m "feat(realtime): attach socket server to backend lifecycle"
```

## Task 12: Add Logging And Sanitization

**Files:**
- Create: `backend/src/modules/realtime/realtime.logging.ts`
- Modify: realtime auth/handlers/presence files
- Modify: `backend/tests/realtime/realtime.unit.test.ts`

**Step 1: Write failing sensitive logging tests**

Verify logs never contain:

- `deviceToken`
- `deviceTokenHash`
- access token/JWT
- raw handshake auth

**Step 2: Implement safe logging helpers**

Events:

```text
realtime.admin.connected
realtime.admin.disconnected
realtime.client.connected
realtime.client.disconnected
realtime.client.heartbeat
realtime.client.heartbeat.rate_limited
realtime.client.auth.failed
realtime.computer.online
realtime.computer.offline
```

**Step 3: Ask user/team to run tests**

```bash
cd backend
npm test -- tests/realtime/realtime.unit.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add backend/src/modules/realtime backend/tests/realtime/realtime.unit.test.ts
git commit -m "feat(realtime): add safe realtime logging"
```

## Task 13: Add Health Snapshot Integration

**Files:**
- Modify: `backend/src/modules/realtime/realtime.gateway.ts`
- Modify: `backend/src/modules/health/*` if runtime health endpoint exists or is added
- Modify/Create: `backend/tests/foundation/health.test.ts` or `backend/tests/realtime/realtime.unit.test.ts`

**Step 1: Verify existing health surface**

Inspect health routes/controllers/services and decide whether runtime health exists. If runtime health is not implemented yet, keep the realtime snapshot available through gateway/service and document the future integration.

**Step 2: Add tests**

If runtime health exists, test response contains:

```json
{
  "realtime": {
    "activeSockets": 0,
    "onlineComputers": 0,
    "adminSockets": 0,
    "heartbeatTimeouts": 0
  }
}
```

**Step 3: Implement integration**

Call `realtimeGateway.getRealtimeHealthSnapshot()` from health service only if that does not introduce circular dependencies.

**Step 4: Commit**

```bash
git add backend/src/modules/health backend/src/modules/realtime backend/tests
git commit -m "feat(realtime): expose realtime health snapshot"
```

## Task 14: Add OpenAPI/Documentation Notes

**Files:**
- Create: `docs/API/realtime-socket-api.md`
- Modify: `docs/API/README.md`
- Optional Modify: `docs/API/openapi.yaml` only to note Socket.IO is outside REST OpenAPI

**Step 1: Document socket contract**

Include:

- `/socket.io` transport
- admin handshake auth
- computer handshake auth
- `admin:watch-tenant`
- `client:heartbeat`
- `computer:online`
- `computer:offline`
- ack success/error shape
- no REST presence endpoint in MVP

**Step 2: Commit**

```bash
git add docs/API/realtime-socket-api.md docs/API/README.md docs/API/openapi.yaml
git commit -m "docs(realtime): document socket event contract"
```

## Task 15: Final Verification Checklist

**Files:**
- Modify if needed: `docs/module/realtime/2026-05-25-realtime-module-design.md`
- Modify if needed: `docs/plans/2026-05-25-realtime-module-implementation-plan.md`

**Step 1: Ask user/team to run verification**

```bash
cd backend
npm test -- tests/realtime
npm run typecheck
```

Expected:

- Realtime unit tests pass.
- Realtime socket integration tests pass.
- TypeScript typecheck passes.

**Step 2: Manual smoke test**

User/team starts backend manually, then verifies:

- Admin socket connects.
- Client socket connects with valid `computerId + deviceToken`.
- Admin receives `computer:online`.
- Client heartbeat returns success ack.
- Admin receives `computer:offline` on disconnect/timeout.
- `GET /api/computers` shows updated `lastSeenAt`.

**Step 3: Final commit**

```bash
git add backend/src/modules/realtime backend/src/server.ts backend/tests/realtime docs/API docs/module/realtime docs/plans
git commit -m "feat(backend): add realtime presence module"
```

## Execution Handoff

Plan complete and saved to `docs/plans/2026-05-25-realtime-module-implementation-plan.md`.

Two execution options:

1. Subagent-Driven (this session) - dispatch fresh subagent per task, review between tasks, fast iteration.

2. Parallel Session (separate) - open a new session with executing-plans, batch execution with checkpoints.

Which approach?
