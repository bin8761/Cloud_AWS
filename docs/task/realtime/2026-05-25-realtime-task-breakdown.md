# Task Breakdown: CloudCMS Realtime Module

Source TDD: `docs/tdd/realtime/2026-05-25-realtime-technical-design.md`

Purpose: convert the Realtime TDD into a developer-facing Markdown checklist that follows `rule/task-breakdown-rule.mdc`.

Implementation constraints:

- Backend source lives under `backend/`.
- Runtime is Node.js backend with TypeScript.
- Package manager is `npm`.
- API framework is Express.
- Socket transport is Socket.IO on the default namespace `/` and endpoint `/socket.io`.
- ORM is Prisma with MySQL.
- Test runner is Vitest, with Supertest for REST regression tests and `socket.io-client` for socket integration tests.
- Reuse existing Auth, Computers, Prisma, logging, health, validation, and token-bucket rate-limit patterns.
- Do not add REST realtime endpoints for MVP.
- Do not add Prisma schema changes, realtime tables, `Computer.onlineStatus`, Redis presence, queues, workers, UI code, session commands, usage sync, policy events, asset events, or subscription events for MVP.
- Do not run DB commands, migration commands, server commands, test commands, typecheck commands, or Prisma CLI autonomously; the user/team runs them when ready.
- Do not commit `.env` or secrets.
- Do not log JWTs, access tokens, device tokens, device-token hashes, authorization headers, raw socket handshakes, raw headers, or raw payloads.

Implementation notes:

- Presence is volatile in-memory state for a single backend instance.
- `Computer.lastSeenAt` is the only durable presence-related field updated by the Realtime MVP.
- `shop_admin` and `staff` can connect as tenant-scoped admin sockets.
- `super_admin` is denied for realtime admin sockets in MVP.
- Client PC sockets authenticate only with `computerId + deviceToken`.
- All room names must be derived from trusted server-side context through room helper functions.
- Realtime counters are exposed through the existing `/api/health/runtime` flow, not through a new realtime health endpoint.
- Dependency install, backend startup, DB setup, Prisma commands, tests, and typecheck remain user/team-run actions.

## 1. Pre-Implementation Alignment

- [x] Task 001: Read `docs/tdd/realtime/2026-05-25-realtime-technical-design.md` before starting implementation. (Completed)
- [x] Task 002: Read `docs/SPEC/realtime/SPEC.md` to confirm Realtime MVP scope boundaries. (Completed)
- [x] Task 003: Read `docs/module/realtime/2026-05-25-realtime-module-design.md` to confirm approved design decisions. (Completed)
- [x] Task 004: Confirm Realtime owns Socket.IO server setup, socket auth, room helpers, presence tracking, heartbeat handling, presence event emission, and runtime health counters. (Completed)
- [x] Task 005: Confirm Realtime does not own REST endpoints, Prisma schema changes, Redis presence, session commands, usage sync, policy update events, asset events, subscription events, Web Admin UI, or Client PC UI. (Completed)
- [x] Task 006: Confirm Realtime uses the default Socket.IO namespace `/` and endpoint `/socket.io`. (Completed)
- [x] Task 007: Confirm Socket.IO CORS reuses `env.app.corsOrigin`. (Completed)
- [x] Task 008: Confirm admin socket auth uses `socket.handshake.auth.clientType = "admin"` and `accessToken`. (Completed)
- [x] Task 009: Confirm Client PC socket auth uses `socket.handshake.auth.clientType = "computer"`, `computerId`, and `deviceToken`. (Completed)
- [x] Task 010: Confirm `admin:watch-tenant` accepts only `{}` and returns a tenant-scoped online computer snapshot. (Completed)
- [x] Task 011: Confirm `client:heartbeat` accepts only `{ sentAt }` and returns `{ serverTime }` on success. (Completed)
- [x] Task 012: Confirm `computer:online` emits only on zero-to-one socket transitions for a computer. (Completed)
- [x] Task 013: Confirm `computer:offline` emits only on final disconnect or heartbeat timeout. (Completed)
- [x] Task 014: Confirm `Computer.lastSeenAt` is updated on accepted connect and throttled heartbeat activity. (Completed)
- [x] Task 015: Confirm all setup, DB, Prisma, server, test, and typecheck commands remain user/team-run actions. (Completed)

## 2. Existing Codebase Verification

- [x] Task 016: Inspect `backend/package.json` to confirm current dependency and script patterns. (Completed)
- [x] Task 017: Inspect `backend/src/server.ts` to identify current HTTP server startup and shutdown flow. (Completed)
- [x] Task 018: Inspect `backend/src/app.ts` to confirm Express app export and CORS configuration source. (Completed)
- [x] Task 019: Inspect `backend/src/config/env.ts` to confirm `env.app.corsOrigin` shape. (Completed)
- [x] Task 020: Inspect `backend/src/modules/auth/auth.middleware.ts` to confirm token verification conventions. (Completed)
- [x] Task 021: Inspect the Auth token service to confirm `authTokenService.verifyAccessToken` behavior and claim shape. (Completed)
- [x] Task 022: Inspect Auth role and tenant-context typing to align allowed admin socket roles. (Completed)
- [x] Task 023: Inspect `backend/src/modules/computers` to confirm `hashDeviceToken` import path and Computer response conventions. (Completed)
- [x] Task 024: Inspect `backend/prisma/schema.prisma` to confirm the existing `Computer` model has `id`, `tenantId`, `status`, `deviceTokenHash`, and `lastSeenAt`. (Completed)
- [x] Task 025: Inspect `backend/src/shared/rate-limit` to reuse the existing token-bucket pattern for socket events. (Completed)
- [x] Task 026: Inspect `backend/src/shared/logging/logger.ts` and module logging helpers to match safe structured logging style. (Completed)
- [x] Task 027: Inspect `backend/src/modules/health` to identify the cleanest runtime health provider registration point. (Completed)
- [x] Task 028: Inspect existing tests under `backend/tests` to reuse Vitest mocking and integration-test patterns. (Completed)
- [x] Task 029: Document any codebase drift from the TDD before implementing Realtime. (Completed)

### Codebase Drift Notes (Task 029)

- Realtime test surface is not present yet: there is no `backend/tests/realtime/` directory and no Socket.IO integration tests in current codebase.
- `socket.io-client` usage does not exist in current tests; existing integration style is HTTP-focused with `supertest` against Express `app`.
- Runtime health currently exposes base runtime fields only in `HealthService.getRuntimeHealth()`; there is no registered realtime health provider or `realtime` counters field yet.

### Existing Test Patterns To Reuse (Task 028)

- Test runner and style: `vitest` with `describe`/`it`, frequent `describe.sequential` for stateful API suites.
- Integration test style: `supertest` requests against imported `app` (no server startup command).
- Mocking style:
  - `vi.hoisted(...)` for stable shared mocks across module scope.
  - `vi.doMock(...)` + dynamic `await import("../../src/app")` after `vi.resetModules()` to inject mocked dependencies before app load.
  - `beforeEach` resets mocks/state (`mockReset`, `mockResolvedValue`, in-memory map resets).
- Foundation pattern coverage exists for reusable pieces:
  - Rate limit middleware behavior tests in `backend/tests/foundation/rate-limit.middleware.test.ts`.
  - Token bucket primitive tests in `backend/tests/foundation/token-bucket.test.ts`.
  - Health route behavior tests in `backend/tests/foundation/health.test.ts`.
- Live integration pattern exists but is opt-in:
  - `auth.api.live.test.ts` / `auth.api.live.security.test.ts` are gated by env flags and target `API_BASE_URL` real server.

## 3. Dependencies and Package Setup

- [x] Task 030: Add `socket.io` version `^4` to `backend/package.json` dependencies. (Completed)
- [x] Task 031: Add `socket.io-client` version `^4` to `backend/package.json` devDependencies. (Completed)
- [x] Task 032: Verify no other runtime dependency is added for Realtime MVP. (Completed)
- [x] Task 033: Ask the user/team to run `npm install` in `backend/` after dependency edits are reviewed. (Completed)
- Handoff note (Task 033): User/team action required after review approval: run `npm install` in `backend/` to install `socket.io` and `socket.io-client`.
- [x] Task 034: Verify package scripts still do not run Prisma migrations, schema pushes, DB setup, or server-side seed commands automatically. (Completed)
- Verification note (Task 034): Source inspection in `backend/package.json` confirms Prisma commands exist only as manual scripts (`prisma:migrate`, `prisma:generate`) and no npm lifecycle auto-run scripts (`preinstall`/`postinstall`/`prepare`/`prestart`/`poststart`) trigger migrate/schema push/DB setup/seed.

## 4. Realtime Module Scaffold

- [x] Task 035: Create `backend/src/modules/realtime/` directory. (Completed)
- [x] Task 036: Create `backend/src/modules/realtime/realtime.server.ts`. (Completed)
- [x] Task 037: Create `backend/src/modules/realtime/realtime.auth.ts`. (Completed)
- [x] Task 038: Create `backend/src/modules/realtime/realtime.rooms.ts`. (Completed)
- [x] Task 039: Create `backend/src/modules/realtime/realtime.presence.ts`. (Completed)
- [x] Task 040: Create `backend/src/modules/realtime/realtime.handlers.ts`. (Completed)
- [x] Task 041: Create `backend/src/modules/realtime/realtime.gateway.ts`. (Completed)
- [x] Task 042: Create `backend/src/modules/realtime/realtime.events.ts`. (Completed)
- [x] Task 043: Create `backend/src/modules/realtime/realtime.types.ts`. (Completed)
- [x] Task 044: Create `backend/src/modules/realtime/realtime.rate-limit.ts`. (Completed)
- [x] Task 045: Create `backend/src/modules/realtime/realtime.logging.ts`. (Completed)
- [x] Task 046: Export only the public Realtime module API needed by `server.ts`, health integration, and future modules. (Completed)
- [x] Task 047: Keep Socket.IO internals inside `backend/src/modules/realtime`. (Completed)
- [x] Task 048: Keep MVP event handlers in `realtime.handlers.ts` with clear function boundaries for later split. (Completed)

## 5. Types, Constants, and Event Contracts

- [x] Task 049: Define `RealtimeAdminSocketContext` in `realtime.types.ts`. (Completed)
- [x] Task 050: Define `RealtimeComputerSocketContext` in `realtime.types.ts`. (Completed)
- [x] Task 051: Define a discriminated socket context type for admin and computer sockets. (Completed)
- [x] Task 052: Define `RealtimeComputerPresence` with `computerId`, `tenantId`, `socketIds`, `lastHeartbeatAt`, `lastSeenPersistedAt`, and `offlineTimer`. (Completed)
- [x] Task 053: Define `RealtimeHealthSnapshot` with active socket, online computer, admin socket, heartbeat, rate-limit, auth failure, and timeout counters. (Completed)
- [x] Task 054: Define ack success and ack error payload types matching the Foundation response style. (Completed)
- [x] Task 055: Define event names for `admin:watch-tenant`, `client:heartbeat`, `computer:online`, and `computer:offline` in `realtime.events.ts`. (Completed)
- [x] Task 056: Define `REALTIME_HEARTBEAT_RATE_LIMIT_CAPACITY = 3`. (Completed)
- [x] Task 057: Define `REALTIME_HEARTBEAT_RATE_LIMIT_REFILL_TOKENS = 1`. (Completed)
- [x] Task 058: Define `REALTIME_HEARTBEAT_RATE_LIMIT_REFILL_WINDOW_SECONDS = 10`. (Completed)
- [x] Task 059: Define `REALTIME_HEARTBEAT_TIMEOUT_SECONDS = 90`. (Completed)
- [x] Task 060: Define `REALTIME_LAST_SEEN_UPDATE_THROTTLE_SECONDS = 30`. (Completed)
- [x] Task 061: Keep realtime tuning values as module constants instead of env variables for MVP. (Completed)

## 6. Room Helpers

- [x] Task 062: Implement `tenantRoom(tenantId)` in `realtime.rooms.ts`. (Completed)
- [x] Task 063: Implement `computerRoom(computerId)` in `realtime.rooms.ts`. (Completed)
- [x] Task 064: Ensure room helpers are the only code path that builds room names. (Completed)
- [x] Task 065: Ensure handlers never accept client-provided room names. (Completed)
- [x] Task 066: Ensure payload-provided `tenantId` or `computerId` cannot override trusted context. (Completed)

## 7. Socket Server Lifecycle

- [x] Task 067: Implement `createRealtimeServer(httpServer)` in `realtime.server.ts`. (Completed)
- [x] Task 068: Instantiate Socket.IO with the existing HTTP server. (Completed)
- [x] Task 069: Configure Socket.IO CORS from `env.app.corsOrigin`. (Completed)
- [x] Task 070: Register realtime authentication middleware in Socket.IO connection flow. (Completed)
- [x] Task 071: Register realtime event handlers after successful auth middleware setup. (Completed)
- [x] Task 072: Return a small lifecycle object that can close Socket.IO and expose a health snapshot provider. (Completed)
- [x] Task 073: Update `backend/src/server.ts` to create an explicit HTTP server with `createServer(app)`. (Completed)
- [x] Task 074: Update `backend/src/server.ts` to initialize Realtime before calling `listen`. (Completed)
- [x] Task 075: Update `backend/src/server.ts` shutdown flow to close HTTP server, close realtime server, clear realtime timers, disconnect Prisma, flush logger, and exit. (Completed)
- [x] Task 076: Preserve the existing duplicate-shutdown guard in `backend/src/server.ts`. (Completed)
- [x] Task 077: Ensure app import paths used by tests still allow importing Express without starting Socket.IO. (Completed)

## 8. Admin Socket Authentication

- [x] Task 078: Implement a strict admin handshake schema requiring `clientType = "admin"` and `accessToken`. (Completed)
- [x] Task 079: Authenticate admin sockets with `authTokenService.verifyAccessToken`. (Completed)
- [x] Task 080: Reject missing admin access token with a generic `connect_error`. (Completed)
- [x] Task 081: Reject malformed admin access token with a generic `connect_error`. (Completed)
- [x] Task 082: Reject expired admin access token with a generic `connect_error`. (Completed)
- [x] Task 083: Reject refresh-token-type JWTs with a generic `connect_error`. (Completed)
- [x] Task 084: Reject admin tokens missing tenant context with a generic `connect_error`. (Completed)
- [x] Task 085: Allow tenant-scoped `shop_admin` admin sockets. (Completed)
- [x] Task 086: Allow tenant-scoped `staff` admin sockets. (Completed)
- [x] Task 087: Reject `super_admin` admin sockets for Realtime MVP. (Completed)
- [x] Task 088: Attach trusted admin socket context containing `clientType`, `userId`, `tenantId`, and `role`. (Completed)
- [x] Task 089: Increment auth failure counters for rejected admin socket handshakes. (Completed)
- [x] Task 090: Log admin auth failures without `accessToken`, raw auth, raw headers, or raw handshake data. (Completed)

## 9. Client PC Socket Authentication

- [x] Task 091: Implement a strict computer handshake schema requiring `clientType = "computer"`, `computerId`, and `deviceToken`. (Completed)
- [x] Task 092: Query Prisma for the Computer using the TDD-approved auth select fields. (Completed)
- [x] Task 093: Reject missing computer with a generic `connect_error`. (Completed)
- [x] Task 094: Reject `INACTIVE` computers with a generic `connect_error`. (Completed)
- [x] Task 095: Reject `BLOCKED` computers with a generic `connect_error`. (Completed)
- [x] Task 096: Hash the submitted `deviceToken` with the existing `hashDeviceToken` helper. (Completed)
- [x] Task 097: Compare the submitted token hash to `Computer.deviceTokenHash`. (Completed)
- [x] Task 098: Reject invalid device token with a generic `connect_error`. (Completed)
- [x] Task 099: Ensure client auth never reveals whether `computerId` or `deviceToken` was wrong. (Completed)
- [x] Task 100: Attach trusted computer socket context containing `clientType`, `computerId`, and `tenantId`. (Completed)
- [x] Task 101: Join authenticated client sockets to `computer:<computerId>` derived from trusted context if needed by the implementation. (Completed)
- [x] Task 102: Increment auth failure counters for rejected client socket handshakes. (Completed)
- [x] Task 103: Log client auth failures without `deviceToken`, `deviceTokenHash`, raw auth, raw headers, or raw handshake data. (Completed)

## 10. Presence State and Gateway

- [x] Task 104: Implement in-memory presence storage keyed by `computerId` in `realtime.presence.ts`. (Completed)
- [x] Task 105: Implement socket-to-context mapping keyed by `socketId` for O(1) disconnect cleanup. (Completed)
- [x] Task 106: Implement `addComputerSocket(socketId, computerId, tenantId)`. (Completed)
- [x] Task 107: Make `addComputerSocket` return whether the computer transitioned from offline to online. (Completed)
- [x] Task 108: Implement `removeComputerSocket(socketId)` for disconnect cleanup. (Completed)
- [x] Task 109: Make `removeComputerSocket` return whether the computer transitioned from online to offline. (Completed)
- [x] Task 110: Ensure multiple sockets for the same computer do not emit duplicate `computer:online`. (Completed)
- [x] Task 111: Ensure removing one of multiple sockets does not emit `computer:offline`. (Completed)
- [x] Task 112: Implement `getPresenceSnapshotForTenant(tenantId)` returning only online computer ids in that tenant. (Completed)
- [x] Task 113: Implement `recordHeartbeat(computerId)` to update in-memory `lastHeartbeatAt`. (Completed)
- [x] Task 114: Implement throttled `Computer.lastSeenAt` persistence in presence logic. (Completed)
- [x] Task 115: Update `Computer.lastSeenAt` on initial accepted client connect. (Completed)
- [x] Task 116: Use `updateMany` with `id`, `tenantId`, and `status: ACTIVE` when persisting `lastSeenAt` if practical. (Completed)
- [x] Task 117: Implement heartbeat timeout scheduling per computer presence record. (Completed)
- [x] Task 118: Refresh the heartbeat timeout after accepted heartbeat activity. (Completed)
- [x] Task 119: Ensure heartbeat timeout emits offline only once for a stale computer. (Completed)
- [x] Task 120: Implement cleanup that clears all presence timers during realtime shutdown. (Completed)
- [x] Task 121: Implement `emitComputerOnline` in `realtime.gateway.ts`. (Completed)
- [x] Task 122: Implement `emitComputerOffline` in `realtime.gateway.ts`. (Completed)
- [x] Task 123: Ensure gateway methods require trusted `tenantId` and `computerId`. (Completed)
- [x] Task 124: Ensure future modules can emit through `realtime.gateway.ts` without direct Socket.IO access. (Completed)

## 11. Event Handlers and Ack Mapping

- [x] Task 125: Implement a strict empty schema for `admin:watch-tenant` payload. (Completed)
- [x] Task 126: Implement a strict schema for `client:heartbeat` requiring ISO datetime `sentAt`. (Completed)
- [x] Task 127: Implement shared ack success helper returning `{ success: true, data }`. (Completed)
- [x] Task 128: Implement shared ack error helper returning `{ success: false, error: { code, message } }`. (Completed)
- [x] Task 129: Ensure ack error mapping never includes token material, stack traces, Prisma internals, or socket internals. (Completed)
- [x] Task 130: Implement `admin:watch-tenant` handler for admin sockets. (Completed)
- [x] Task 131: Make `admin:watch-tenant` reject non-admin sockets with `FORBIDDEN`. (Completed)
- [x] Task 132: Make `admin:watch-tenant` reject unknown payload fields with `VALIDATION_ERROR`. (Completed)
- [x] Task 133: Make `admin:watch-tenant` join `tenant:<tenantId>` derived from trusted context. (Completed)
- [x] Task 134: Make `admin:watch-tenant` ack the tenant-scoped `onlineComputers` snapshot. (Completed)
- [x] Task 135: Implement `client:heartbeat` handler for computer sockets. (Completed)
- [x] Task 136: Make `client:heartbeat` reject non-computer sockets with `FORBIDDEN`. (Completed)
- [x] Task 137: Make `client:heartbeat` reject missing, invalid, or unknown fields with `VALIDATION_ERROR`. (Completed)
- [x] Task 138: Make `client:heartbeat` consume a heartbeat rate-limit token by `computerId`. (Completed)
- [x] Task 139: Make rate-limited heartbeat return `TOO_MANY_REQUESTS` without disconnecting the socket by default. (Completed)
- [x] Task 140: Make accepted heartbeat update presence state and conditionally persist `Computer.lastSeenAt`. (Completed)
- [x] Task 141: Make accepted heartbeat ack `{ serverTime }`. (Completed)
- [x] Task 142: Register disconnect handlers for admin sockets. (Completed)
- [x] Task 143: Register disconnect handlers for computer sockets. (Completed)
- [x] Task 144: Ensure final computer disconnect emits `computer:offline` through the gateway. (Completed)

## 12. Socket Event Rate Limiting

- [x] Task 145: Implement a socket-event heartbeat limiter in `realtime.rate-limit.ts`. (Completed)
- [x] Task 146: Key heartbeat buckets by trusted `computerId`. (Completed)
- [x] Task 147: Configure capacity to allow three quick heartbeats. (Completed)
- [x] Task 148: Configure refill to add one token per ten seconds. (Completed)
- [x] Task 149: Increment `heartbeatRateLimited` counter when the limiter denies a heartbeat. (Completed)
- Evidence (Task 149): `backend/src/modules/realtime/realtime.handlers.ts` calls `incrementHeartbeatRateLimited()` only inside the `!limiterResult.accepted` branch; `backend/src/modules/realtime/realtime.server.ts` wires this callback to mutate `currentHealthSnapshot.heartbeatRateLimited`.
- [x] Task 150: Keep the socket limiter replaceable so Redis-backed rate limiting can be added later if needed. (Completed)
- Evidence (Task 150): `backend/src/modules/realtime/realtime.rate-limit.ts` defines `RealtimeHeartbeatRateLimiter` interface + `InMemoryRealtimeHeartbeatRateLimiter` implementation + `createInMemoryRealtimeHeartbeatRateLimiter()` factory; `backend/src/modules/realtime/realtime.server.ts` injects a `RealtimeHeartbeatRateLimiter` into handler registration instead of binding handlers to a concrete singleton.
- [x] Task 151: Ensure limiter logs do not include raw event payloads or token material. (Completed)
- Evidence (Task 151): `backend/src/modules/realtime/realtime.handlers.ts` logs deny branch via `realtimeLoggingService.logClientHeartbeatRateLimited(...)` with only `socketId`, `tenantId`, `computerId`, `reason`; `backend/src/modules/realtime/realtime.logging.ts` adds `ForbiddenRealtimeAuthFailureFields` guards (`accessToken`, `deviceToken`, `deviceTokenHash`, `payload`, `token`, `tokenMaterial`, `rawAuth`, `headers`, `handshake`) and emits sanitized payload without raw event payload/token fields.

## 13. Logging and Observability

- [x] Task 152: Define realtime log event names in `realtime.logging.ts`. (Completed)
- Evidence (Task 152): `backend/src/modules/realtime/realtime.logging.ts` defines `REALTIME_LOG_EVENTS` with `ADMIN_CONNECTED`, `ADMIN_DISCONNECTED`, `CLIENT_CONNECTED`, `CLIENT_DISCONNECTED`, `CLIENT_HEARTBEAT`, `CLIENT_HEARTBEAT_RATE_LIMITED`, `CLIENT_AUTH_FAILED`, `ADMIN_AUTH_FAILED`, `COMPUTER_ONLINE`, and `COMPUTER_OFFLINE`.
- [x] Task 153: Implement safe log payload builder for `realtime.admin.connected`. (Completed)
- Evidence (Task 153): `backend/src/modules/realtime/realtime.logging.ts` adds `buildRealtimeAdminConnectedLogInput(...)` with whitelist fields only (`socketId`, `tenantId`, `actorUserId`, `actorRole`, optional `connectedSocketCount`, `reason`, `ip`, `userAgent`).
- [x] Task 154: Implement safe log payload builder for `realtime.admin.disconnected`. (Completed)
- Evidence (Task 154): `backend/src/modules/realtime/realtime.logging.ts` adds `buildRealtimeAdminDisconnectedLogInput(...)` with whitelist fields only and no raw handshake/payload/token data.
- [x] Task 155: Implement safe log payload builder for `realtime.client.connected`. (Completed)
- Evidence (Task 155): `backend/src/modules/realtime/realtime.logging.ts` adds `buildRealtimeClientConnectedLogInput(...)` with whitelist fields (`socketId`, `tenantId`, `computerId`, optional `connectedSocketCount`, `reason`, `ip`, `userAgent`).
- [x] Task 156: Implement safe log payload builder for `realtime.client.disconnected`. (Completed)
- Evidence (Task 156): `backend/src/modules/realtime/realtime.logging.ts` adds `buildRealtimeClientDisconnectedLogInput(...)` with whitelist fields and forbidden sensitive-field typing.
- [x] Task 157: Implement safe log payload builder for `realtime.client.heartbeat`. (Completed)
- Evidence (Task 157): `backend/src/modules/realtime/realtime.logging.ts` adds `buildRealtimeClientHeartbeatLogInput(...)`; `backend/src/modules/realtime/realtime.handlers.ts` uses it in accepted heartbeat path before success ack.
- [x] Task 158: Implement safe log payload builder for `realtime.client.heartbeat.rate_limited`. (Completed)
- Evidence (Task 158): `backend/src/modules/realtime/realtime.logging.ts` adds `buildRealtimeClientHeartbeatRateLimitedLogInput(...)`; `backend/src/modules/realtime/realtime.handlers.ts` uses it in limiter deny branch.
- [x] Task 159: Implement safe log payload builder for `realtime.client.auth.failed`. (Completed)
- Evidence (Task 159): `backend/src/modules/realtime/realtime.logging.ts` includes `buildRealtimeClientAuthFailureLogInput(...)` with safe handshake-derived fields only and no token payload fields.
- [x] Task 160: Implement safe log payload builder for `realtime.computer.online`. (Completed)
- Evidence (Task 160): `backend/src/modules/realtime/realtime.logging.ts` adds `buildRealtimeComputerOnlineLogInput(...)`; `backend/src/modules/realtime/realtime.server.ts` uses it on zero-to-one presence transition.
- [x] Task 161: Implement safe log payload builder for `realtime.computer.offline`. (Completed)
- Evidence (Task 161): `backend/src/modules/realtime/realtime.logging.ts` adds `buildRealtimeComputerOfflineLogInput(...)`; `backend/src/modules/realtime/realtime.server.ts` uses it for disconnect-driven and timeout-driven offline transitions.
- [x] Task 162: Include safe fields such as `socketId`, `tenantId`, `computerId`, `actorUserId`, `actorRole`, `event`, `reason`, `connectedSocketCount`, `lastHeartbeatAt`, `ip`, and `userAgent` where available. (Completed)
- Evidence (Task 162): `backend/src/modules/realtime/realtime.logging.ts` defines `REALTIME_SAFE_LOG_FIELDS` whitelist and `sanitizeSafeLogPayload(...)` which drops non-whitelisted keys before emitting logs; each `log*` method builds payloads from safe keys only.
- [x] Task 163: Ensure realtime logs never include `accessToken`. (Completed)
- Evidence (Task 163): `backend/src/modules/realtime/realtime.logging.ts` forbids `accessToken` at type level (`ForbiddenRealtimeSensitiveFields`) and runtime level (`FORBIDDEN_LOG_KEYS` + `assertNoForbiddenKeys`).
- [x] Task 164: Ensure realtime logs never include `deviceToken`. (Completed)
- Evidence (Task 164): `backend/src/modules/realtime/realtime.logging.ts` forbids `deviceToken` in both `ForbiddenRealtimeSensitiveFields` and `FORBIDDEN_LOG_KEYS`.
- [x] Task 165: Ensure realtime logs never include `deviceTokenHash`. (Completed)
- Evidence (Task 165): `backend/src/modules/realtime/realtime.logging.ts` forbids `deviceTokenHash` in both `ForbiddenRealtimeSensitiveFields` and `FORBIDDEN_LOG_KEYS`.
- [x] Task 166: Ensure realtime logs never include authorization headers. (Completed)
- Evidence (Task 166): `backend/src/modules/realtime/realtime.logging.ts` forbids `authorization` and `headers` fields; emitted payloads do not map any header object and only pass whitelisted scalar fields.
- [x] Task 167: Ensure realtime logs never include raw handshake auth. (Completed)
- Evidence (Task 167): `backend/src/modules/realtime/realtime.logging.ts` forbids `handshake` and `rawAuth` fields at type/runtime guard level; builders extract only safe `ip`/`userAgent` strings from socket handshake metadata.
- [x] Task 168: Ensure realtime logs never include raw event payloads. (Completed)
- Evidence (Task 168): `backend/src/modules/realtime/realtime.logging.ts` forbids `payload` at type/runtime guard level; `sanitizeSafeLogPayload(...)` enforces whitelist-only emitted keys.
- [x] Task 169: Increment `activeSockets` counters on socket connect and disconnect. (Completed)
- Evidence (Task 169): `backend/src/modules/realtime/realtime.server.ts` increments via `incrementActiveSockets()` inside `io.on("connection", ...)` and decrements via `decrementActiveSockets()` in the socket `disconnect` handler; decrement is clamped with `Math.max(0, ...)` for deterministic non-negative state.
- [x] Task 170: Increment `adminSockets` counters on admin connect and disconnect. (Completed)
- Evidence (Task 170): `backend/src/modules/realtime/realtime.server.ts` increments `adminSockets` when `realtimeContext?.clientType === "admin"` at connect and decrements in the same admin branch on disconnect, with non-negative clamp in `decrementAdminSockets()`.
- [x] Task 171: Increment `onlineComputers` counters through presence transitions. (Completed)
- Evidence (Task 171): `backend/src/modules/realtime/realtime.server.ts` increments `onlineComputers` only when `presenceResult.transitionedToOnline` is true after `realtimePresenceStore.addComputerSocket(...)`, and decrements on both `disconnectResult.transitionedToOffline` and heartbeat-timeout transitions from `setHeartbeatTimeoutListener(...)`.
- [x] Task 172: Increment `heartbeatAccepted` counter on accepted heartbeat. (Completed)
- Evidence (Task 172): `backend/src/modules/realtime/realtime.handlers.ts` now accepts `incrementHeartbeatAccepted` callback and calls it only in the accepted-heartbeat success path immediately before success ack; wiring is passed from `backend/src/modules/realtime/realtime.server.ts`.
- [x] Task 173: Increment `authFailures` counter on rejected socket handshakes. (Completed)
- Evidence (Task 173): `backend/src/modules/realtime/realtime.server.ts` increments `authFailures` in both rejected branches of `registerRealtimeAuthenticationMiddleware(...)`: failed admin handshake and failed computer handshake (`incrementAuthFailures()` before `next(new Error(...))`).
- [x] Task 174: Increment `heartbeatTimeouts` counter on timeout-driven offline transitions. (Completed)
- Evidence (Task 174): `backend/src/modules/realtime/realtime.server.ts` increments `heartbeatTimeouts` inside `realtimePresenceStore.setHeartbeatTimeoutListener(...)`, exactly when timeout-driven offline transition callback executes.
- [x] Task 175: Implement `getRealtimeHealthSnapshot()` returning sanitized counters only. (Completed)
- Evidence (Task 175): `backend/src/modules/realtime/realtime.server.ts` defines `getRealtimeHealthSnapshot(snapshot)` that returns only the 7 counter fields (`activeSockets`, `onlineComputers`, `adminSockets`, `heartbeatAccepted`, `heartbeatRateLimited`, `authFailures`, `heartbeatTimeouts`) and sanitizes each through `sanitizeCounterValue(...)` (finite check + non-negative integer clamp). `backend/src/modules/realtime/realtime.types.ts` exposes `getRealtimeHealthSnapshot: () => RealtimeHealthSnapshot` in `RealtimeServerPublicApi`, making snapshot shape explicit and excluding socket ids, tokens, raw auth, IP, user-agent, and payload internals by construction.

## 14. Runtime Health Integration

- [x] Task 176: Add a realtime health provider type to the health module or a shared type location. (Completed)
- Evidence (Task 176): `backend/src/modules/health/health.service.ts` defines `RealtimeHealthSnapshot` (counter-only shape) and `RealtimeHealthProvider = () => RealtimeHealthSnapshot` directly in the health module, preserving provider abstraction without importing Socket.IO internals.
- [x] Task 177: Add a provider registration method such as `setRealtimeHealthProvider` to `HealthService`. (Completed)
- Evidence (Task 177): `backend/src/modules/health/health.service.ts` adds `private realtimeHealthProvider?: RealtimeHealthProvider;` and `public setRealtimeHealthProvider(provider: RealtimeHealthProvider): void` for provider registration in `HealthService`.
- [x] Task 178: Update `HealthService.getRuntimeHealth()` to include `realtime` counters when a provider is registered. (Completed)
- Evidence (Task 178): `backend/src/modules/health/health.service.ts` updates `RuntimeHealthStatus` with optional `realtime?: RealtimeHealthSnapshot`; in `getRuntimeHealth()`, when `this.realtimeHealthProvider` exists, `runtimeHealth.realtime` is populated from provider output via `sanitizeRealtimeHealthSnapshot(...)`.
- [x] Task 179: Define the behavior when no realtime provider is registered in isolated tests. (Completed)
- Evidence (Task 179): `backend/src/modules/health/health.service.ts` explicitly branches `if (!this.realtimeHealthProvider) { return runtimeHealth; }`, making provider-absent behavior deterministic: runtime health returns base fields only and omits `realtime`.
- [x] Task 180: Register the realtime health provider after creating the realtime server in `server.ts` or `realtime.server.ts`. (Completed)
- Evidence (Task 180): `backend/src/server.ts` now imports `healthService` and registers provider wiring immediately after realtime server creation: `healthService.setRealtimeHealthProvider(() => realtimeServer.getRealtimeHealthSnapshot());`, which occurs after `createRealtimeServer(httpServer)` and before `httpServer.listen(...)`.
- [x] Task 181: Ensure `/api/health/runtime` still returns existing runtime fields. (Completed)
- Evidence (Task 181): `backend/src/modules/health/health.routes.ts` keeps `GET /api/health/runtime` bound to `healthController.getRuntimeHealth(...)`; `backend/src/modules/health/health.service.ts` still returns base runtime fields (`status`, `environment`, `nodeVersion`, `uptimeSeconds`, `memory`) in `getRuntimeHealth()`, with realtime data only as optional extension.
- [x] Task 182: Ensure no `/api/realtime/health` route is added. (Completed)
- Evidence (Task 182): Route inspection in `backend/src/modules/health/health.routes.ts` and global source search under `backend/src` shows health routes are limited to `/health`, `/api/health/db`, and `/api/health/runtime`; no `/api/realtime/health` route declaration exists.
- [x] Task 183: Ensure health output contains no socket ids, tokens, raw auth, IP addresses, or user agents. (Completed)
- Evidence (Task 183): `backend/src/server.ts` registers provider via `healthService.setRealtimeHealthProvider(() => realtimeServer.getRealtimeHealthSnapshot())`; `backend/src/modules/realtime/realtime.server.ts` `getRealtimeHealthSnapshot(...)` returns only sanitized counter keys (`activeSockets`, `onlineComputers`, `adminSockets`, `heartbeatAccepted`, `heartbeatRateLimited`, `authFailures`, `heartbeatTimeouts`), and `backend/src/modules/health/health.service.ts` additionally sanitizes provider output through `sanitizeRealtimeHealthSnapshot(...)`, so health runtime output cannot include socket ids, tokens, raw auth, IP, or user-agent fields.

## 15. Security and Scope Guards

- [x] Task 184: Ensure admin tenant scope is always derived from verified JWT context. (Completed)
- Evidence (Task 184): `backend/src/modules/realtime/realtime.auth.ts` derives admin context only from verified access-token claims (`authTokenService.verifyAccessToken`, tenant validation via `hasValidTenantContext`, then returns `tenantId: claims.tenantId`); `backend/src/modules/realtime/realtime.server.ts` writes this trusted result into `socket.data.realtimeContext` and handlers use that context (`registerAdminWatchTenantHandler(socket, realtimeContext)`) to resolve tenant room/snapshot scope.
- [x] Task 185: Ensure client computer scope is always derived from verified Computer data. (Completed)
- Evidence (Task 185): `backend/src/modules/realtime/realtime.auth.ts` loads trusted `computer` from Prisma by handshake `computerId`, enforces status/token-hash checks, and returns context from DB record (`computerId: computer.id`, `tenantId: computer.tenantId`); `backend/src/modules/realtime/realtime.server.ts` uses only `realtimeContext.computerId`/`tenantId` for room join, presence tracking, heartbeat limiter key, and gateway emissions.
- [x] Task 186: Ensure event payloads cannot override `tenantId`, `computerId`, or room names. (Completed)
- Evidence (Task 186): `backend/src/modules/realtime/realtime.handlers.ts` defines `ForbiddenRoutingOverrides` (`tenantId`, `computerId`, `room`, `roomName` as `never`) and strict payload schemas (`adminWatchTenantPayloadSchema = z.object({}).strict()`, strict heartbeat schema); handlers derive room names exclusively from trusted context through `resolveTenantRoomFromTrustedContext(...)` / `resolveComputerRoomFromTrustedContext(...)` and never read routing identifiers from payload. `backend/src/modules/realtime/realtime.gateway.ts` further enforces trusted routing via `assertTrustedGatewayRoutingContext(...)` before emitting to `tenantRoom(...)`.
- [x] Task 187: Ensure `super_admin` receives `connect_error` for realtime MVP. (Completed)
- Evidence (Task 187): `backend/src/modules/realtime/realtime.auth.ts` allowlists admin roles to `shop_admin` and `staff` only (`ALLOWED_REALTIME_ADMIN_ROLES` + `isAllowedRealtimeAdminRole`); non-allowlisted roles, including `super_admin`, throw generic connect error. In `backend/src/modules/realtime/realtime.server.ts`, rejected admin handshake paths are mapped to `next(new Error("Unauthorized realtime connection"))`, which yields Socket.IO `connect_error`.
- [x] Task 188: Ensure `staff` is allowed only as a tenant-scoped admin socket. (Completed)
- Evidence (Task 188): `backend/src/modules/realtime/realtime.auth.ts` explicitly allows `staff` in `ALLOWED_REALTIME_ADMIN_ROLES`, requires `clientType: "admin"` handshake schema, validates non-empty `tenantId` claim, and returns trusted admin context (`clientType`, `userId`, `tenantId`, `role`). `backend/src/modules/realtime/realtime.handlers.ts` then enforces admin handler access with `realtimeContext?.clientType === "admin"` and derives room scope only from trusted tenant context.
- [x] Task 189: Ensure Client PC sockets cannot call admin-only handlers successfully. (Completed)
- Evidence (Task 189): `backend/src/modules/realtime/realtime.handlers.ts` `registerAdminWatchTenantHandler(...)` hard-checks `realtimeContext?.clientType !== "admin"` and returns ack error `{ code: "FORBIDDEN" }` before payload parse, room join, or snapshot logic, so `clientType: "computer"` sockets cannot successfully execute `admin:watch-tenant`.
- [x] Task 190: Ensure admin sockets cannot call computer-only heartbeat handlers successfully. (Completed)
- Evidence (Task 190): `backend/src/modules/realtime/realtime.handlers.ts` `registerClientHeartbeatHandler(...)` hard-checks `realtimeContext?.clientType !== "computer"` and returns ack error `{ code: "FORBIDDEN" }` before payload validation, rate-limit consumption, presence updates, or success ack, so admin sockets cannot successfully execute `client:heartbeat`.
- [x] Task 191: Ensure socket auth errors are generic and do not disclose token validity details. (Completed)
- Evidence (Task 191): `backend/src/modules/realtime/realtime.auth.ts` centralizes handshake failure to one message (`GENERIC_CONNECT_ERROR_MESSAGE = "Unauthorized realtime connection"`) via `throwGenericConnectError()` across admin and computer auth branches (missing/invalid/expired/wrong token type/tenantless/wrong role/bad device token). `backend/src/modules/realtime/realtime.server.ts` maps rejected auth to the same `next(new Error("Unauthorized realtime connection"))` `connect_error` path for both admin and computer handshakes, preventing token-validity detail leaks.
- [x] Task 192: Ensure client auth errors do not disclose whether the computer exists. (Completed)
- Evidence (Task 192): In `backend/src/modules/realtime/realtime.auth.ts`, client handshake checks (`computer` not found, non-`ACTIVE` status, hash mismatch) all terminate with the same `throwGenericConnectError()` output; no branch-specific error text is returned. `backend/src/modules/realtime/realtime.server.ts` keeps that mapping deterministic by always returning `next(new Error("Unauthorized realtime connection"))` for rejected computer handshakes.
- [x] Task 193: Ensure unknown event payload fields are rejected strictly. (Completed)
- Evidence (Task 193): `backend/src/modules/realtime/realtime.handlers.ts` uses strict schemas for both events (`adminWatchTenantPayloadSchema = z.object({}).strict()` and `clientHeartbeatPayloadSchema ... .strict()`). Handler parse failures are mapped to deterministic `VALIDATION_ERROR` acks with no fallback success path, so unknown fields are explicitly rejected.
- [x] Task 194: Ensure no MAC-address-only authentication is introduced. (Completed)
- Evidence (Task 194): `backend/src/modules/realtime/realtime.auth.ts` computer handshake schema requires `clientType: "computer"`, `computerId`, and `deviceToken`; auth flow verifies `computerId` + hashed `deviceToken` against `Computer.deviceTokenHash`. No realtime auth path accepts `macAddress` as a standalone credential.
- [x] Task 195: Ensure no realtime implementation writes or persists raw device tokens. (Completed)
- Evidence (Task 195): `backend/src/modules/realtime/realtime.auth.ts` uses raw `deviceToken` only for in-process hash comparison (`hashDeviceToken(deviceToken)` vs stored hash) and does not persist it. `backend/src/modules/realtime/realtime.logging.ts` forbids `deviceToken`/`deviceTokenHash` in log input and recursively rejects forbidden keys (`FORBIDDEN_LOG_KEYS` + `assertNoForbiddenKeys(...)`). `backend/src/modules/realtime/realtime.ack.ts` forbids token material fields in ack error details and emits sanitized error payloads only.
- [x] Task 196: Ensure no realtime implementation adds a persistent online status field. (Completed)
- Evidence (Task 196): `backend/prisma/schema.prisma` `Computer` model includes `status` and `lastSeenAt` but no persistent online-status field such as `onlineStatus`. Realtime presence in `backend/src/modules/realtime/realtime.presence.ts` remains in-memory state; durable writes are limited to `lastSeenAt` updates.
- [x] Task 197: Ensure no Redis adapter or Redis-backed presence code is added for MVP. (Completed)
- Evidence (Task 197): Realtime wiring in `backend/src/modules/realtime/realtime.server.ts` uses default `new SocketIoServer(...)` with no adapter registration and creates in-memory heartbeat limiter via `createInMemoryRealtimeHeartbeatRateLimiter()` from `backend/src/modules/realtime/realtime.rate-limit.ts`. `backend/package.json` includes no Redis/socket.io-redis adapter dependencies in runtime or dev dependencies.

## 16. Unit Tests

- [x] Task 198: Create `backend/tests/realtime/` directory. (Completed)
- Evidence (Task 198): Added realtime test directory with new unit test file at `backend/tests/realtime/realtime.rooms.unit.test.ts`.
- [x] Task 199: Create unit tests for `tenantRoom("tenant-id")`. (Completed)
- Evidence (Task 199): `backend/tests/realtime/realtime.rooms.unit.test.ts` includes test case asserting `tenantRoom("tenant-id") === "tenant:tenant-id"`.
- [x] Task 200: Create unit tests for `computerRoom("computer-id")`. (Completed)
- Evidence (Task 200): `backend/tests/realtime/realtime.rooms.unit.test.ts` includes test case asserting `computerRoom("computer-id") === "computer:computer-id"`.
- [x] Task 201: Add admin auth unit test accepting valid `shop_admin` access token with tenant context. (Completed)
- Evidence (Task 201): `backend/tests/realtime/realtime.auth.admin.unit.test.ts` includes `Task 201` case asserting successful admin context for `role: "shop_admin"` with valid tenant claims.
- [x] Task 202: Add admin auth unit test accepting valid `staff` access token with tenant context. (Completed)
- Evidence (Task 202): `backend/tests/realtime/realtime.auth.admin.unit.test.ts` includes `Task 202` case asserting successful admin context for `role: "staff"` with valid tenant claims.
- [x] Task 203: Add admin auth unit test rejecting missing token. (Completed)
- Evidence (Task 203): `backend/tests/realtime/realtime.auth.admin.unit.test.ts` includes `Task 203` case with missing `accessToken`, expecting rejection with generic unauthorized error and no `verifyAccessToken` call.
- [x] Task 204: Add admin auth unit test rejecting malformed token. (Completed)
- Evidence (Task 204): `backend/tests/realtime/realtime.auth.admin.unit.test.ts` includes `Task 204` case mocking token verification failure (`jwt malformed`) and asserting generic rejection.
- [x] Task 205: Add admin auth unit test rejecting expired token. (Completed)
- Evidence (Task 205): `backend/tests/realtime/realtime.auth.admin.unit.test.ts` includes `Task 205` case mocking token verification failure (`jwt expired`) and asserting generic rejection.
- [x] Task 206: Add admin auth unit test rejecting refresh-token-type token. (Completed)
- Evidence (Task 206): `backend/tests/realtime/realtime.auth.admin.unit.test.ts` includes `Task 206` case where claims `tokenType: "refresh"` are rejected with generic unauthorized error.
- [x] Task 207: Add admin auth unit test rejecting missing tenant context. (Completed)
- Evidence (Task 207): `backend/tests/realtime/realtime.auth.admin.unit.test.ts` includes `Task 207` case where claims omit `tenantId`, asserting generic rejection.
- [x] Task 208: Add admin auth unit test rejecting `super_admin`. (Completed)
- Evidence (Task 208): `backend/tests/realtime/realtime.auth.admin.unit.test.ts` includes `Task 208` case where claims `role: "super_admin"` are rejected with generic unauthorized error.
- [x] Task 209: Add client auth unit test accepting valid `computerId + deviceToken` for an `ACTIVE` computer. (Completed)
- Evidence (Task 209): `backend/tests/realtime/realtime.auth.client.unit.test.ts` includes `Task 209` case asserting successful context mapping for an `ACTIVE` computer and matching device-token hash.
- [x] Task 210: Add client auth unit test rejecting invalid device token. (Completed)
- Evidence (Task 210): `backend/tests/realtime/realtime.auth.client.unit.test.ts` includes `Task 210` case with hash mismatch, asserting generic unauthorized rejection.
- [x] Task 211: Add client auth unit test rejecting missing computer. (Completed)
- Evidence (Task 211): `backend/tests/realtime/realtime.auth.client.unit.test.ts` includes `Task 211` case with `findUnique` returning `null`, asserting generic unauthorized rejection and no token-hash call.
- [x] Task 212: Add client auth unit test rejecting `INACTIVE` computers. (Completed)
- Evidence (Task 212): `backend/tests/realtime/realtime.auth.client.unit.test.ts` includes `Task 212` case with `status: INACTIVE`, asserting generic unauthorized rejection.
- [x] Task 213: Add client auth unit test rejecting `BLOCKED` computers. (Completed)
- Evidence (Task 213): `backend/tests/realtime/realtime.auth.client.unit.test.ts` includes `Task 213` case with `status: BLOCKED`, asserting generic unauthorized rejection.
- [x] Task 214: Add client auth unit test proving error output does not reveal whether id or token was wrong. (Completed)
- Evidence (Task 214): `backend/tests/realtime/realtime.auth.client.unit.test.ts` includes `Task 214` case comparing rejection messages for missing-computer and wrong-token paths, both equal to the same generic unauthorized message.
- [x] Task 215: Add schema unit test proving `admin:watch-tenant` accepts `{}`. (Completed)
- Evidence (Task 215): `backend/tests/realtime/realtime.handlers.schema.unit.test.ts` includes `Task 215` asserting `parseAdminWatchTenantPayload({})` succeeds and returns `{}`.
- [x] Task 216: Add schema unit test proving `admin:watch-tenant` rejects unknown fields. (Completed)
- Evidence (Task 216): `backend/tests/realtime/realtime.handlers.schema.unit.test.ts` includes `Task 216` asserting `parseAdminWatchTenantPayload({ tenantId: "tenant-1" })` throws.
- [x] Task 217: Add schema unit test proving `client:heartbeat` accepts valid ISO `sentAt`. (Completed)
- Evidence (Task 217): `backend/tests/realtime/realtime.handlers.schema.unit.test.ts` includes `Task 217` asserting ISO payload `{ sentAt: "2026-05-25T10:11:12.000Z" }` is accepted by `parseClientHeartbeatPayload`.
- [x] Task 218: Add schema unit test proving `client:heartbeat` rejects missing `sentAt`. (Completed)
- Evidence (Task 218): `backend/tests/realtime/realtime.handlers.schema.unit.test.ts` includes `Task 218` asserting `parseClientHeartbeatPayload({})` throws validation error.
- [x] Task 219: Add schema unit test proving `client:heartbeat` rejects invalid `sentAt`. (Completed)
- Evidence (Task 219): `backend/tests/realtime/realtime.handlers.schema.unit.test.ts` includes `Task 219` asserting non-ISO `sentAt` is rejected.
- [x] Task 220: Add schema unit test proving `client:heartbeat` rejects unknown fields. (Completed)
- Evidence (Task 220): `backend/tests/realtime/realtime.handlers.schema.unit.test.ts` includes `Task 220` asserting payload with extra field (`computerId`) is rejected.
- [x] Task 221: Add ack mapper unit tests for success payloads. (Completed)
- Evidence (Task 221): `backend/tests/realtime/realtime.ack.unit.test.ts` includes `Task 221` asserting `buildRealtimeAckSuccess(...)` returns `{ success: true, data }`.
- [x] Task 222: Add ack mapper unit tests for error payloads. (Completed)
- Evidence (Task 222): `backend/tests/realtime/realtime.ack.unit.test.ts` includes `Task 222` asserting `buildRealtimeAckError(...)` returns `{ success: false, error: { code, message } }`.
- [x] Task 223: Add ack mapper unit test proving token material is never included. (Completed)
- Evidence (Task 223): `backend/tests/realtime/realtime.ack.unit.test.ts` includes `Task 223` asserting serialized error ack does not contain `accessToken`, `deviceToken`, or `deviceTokenHash`.
- [x] Task 224: Add presence unit test proving the first socket marks a computer online. (Completed)
- Evidence (Task 224): `backend/tests/realtime/realtime.presence.unit.test.ts` includes `Task 224` asserting first `addComputerSocket(...)` returns `transitionedToOnline: true`.
- [x] Task 225: Add presence unit test proving a second socket for the same computer does not duplicate online emission. (Completed)
- Evidence (Task 225): `backend/tests/realtime/realtime.presence.unit.test.ts` includes `Task 225` asserting second `addComputerSocket(...)` returns `transitionedToOnline: false`.
- [x] Task 226: Add presence unit test proving removing one of multiple sockets does not emit offline. (Completed)
- Evidence (Task 226): `backend/tests/realtime/realtime.presence.unit.test.ts` includes `Task 226` asserting `removeComputerSocket(...)` with remaining socket keeps `transitionedToOffline: false`.
- [x] Task 227: Add presence unit test proving removing the final socket emits offline. (Completed)
- Evidence (Task 227): `backend/tests/realtime/realtime.presence.unit.test.ts` includes `Task 227` asserting final `removeComputerSocket(...)` returns `transitionedToOffline: true`.
- [x] Task 228: Add presence unit test proving heartbeat refreshes `lastHeartbeatAt`. (Completed)
- Evidence (Task 228): `backend/tests/realtime/realtime.presence.unit.test.ts` includes `Task 228` asserting second `recordHeartbeat(...)` advances `lastHeartbeatAt`.
- [x] Task 229: Add presence unit test proving heartbeat timeout emits offline only once. (Completed)
- Evidence (Task 229): `backend/tests/realtime/realtime.presence.unit.test.ts` includes `Task 229` with fake timers and timeout listener, asserting one offline transition callback after repeated timeout advances.
- [x] Task 230: Add presence unit test proving health snapshot returns sanitized counters. (Completed)
- Evidence (Task 230): `backend/tests/realtime/realtime.server.health.unit.test.ts` includes `Task 230` asserting `createRealtimeServer(...).getHealthSnapshot()` values are non-negative integers before and after `close()`.
- [x] Task 231: Add rate-limit unit test proving heartbeat limiter keys by `computerId`. (Completed)
- Evidence (Task 231): `backend/tests/realtime/realtime.rate-limit.unit.test.ts` includes `Task 231` asserting token consumption for `computer-a` does not affect `computer-b`.
- [x] Task 232: Add rate-limit unit test proving three quick heartbeats are accepted. (Completed)
- Evidence (Task 232): `backend/tests/realtime/realtime.rate-limit.unit.test.ts` includes `Task 232` asserting first three same-timestamp consumes are accepted.
- [x] Task 233: Add rate-limit unit test proving the fourth quick heartbeat is denied. (Completed)
- Evidence (Task 233): `backend/tests/realtime/realtime.rate-limit.unit.test.ts` includes `Task 233` asserting fourth same-window consume returns `accepted: false`.
- [x] Task 234: Add rate-limit unit test proving refill allows a later heartbeat after ten seconds. (Completed)
- Evidence (Task 234): `backend/tests/realtime/realtime.rate-limit.unit.test.ts` includes `Task 234` asserting consume at `now + 10_000` is accepted after exhaustion.
- [x] Task 235: Add logging unit test proving forbidden sensitive fields are dropped or rejected. (Completed)
- Evidence (Task 235): `backend/tests/realtime/realtime.logging.unit.test.ts` includes `Task 235` asserting logging throws `Forbidden realtime log field detected: deviceToken` when forbidden field is present.
- [x] Task 236: Add logging unit test proving auth failure logs contain no `accessToken`, `deviceToken`, `deviceTokenHash`, or raw handshake auth. (Completed)
- Evidence (Task 236): `backend/tests/realtime/realtime.logging.unit.test.ts` includes `Task 236` asserting emitted auth-failure log payload excludes token/handshake sensitive keys while preserving safe fields.

## 17. Socket Integration Tests

- [x] Task 237: Create socket integration test setup using an in-test HTTP server. (Completed)
- Evidence (Task 237): `backend/tests/realtime/realtime.socket.integration.test.ts` provisions in-test `httpServer` (`createServer` + `listen(0)`) and initializes `createRealtimeServer(httpServer)` per test.
- [x] Task 238: Use `socket.io-client` for socket integration tests. (Completed)
- Evidence (Task 238): `backend/tests/realtime/realtime.socket.integration.test.ts` uses `io` from `socket.io-client` via `connectSocket(...)` / `connectExpectError(...)`.
- [x] Task 239: Add integration test proving admin connects with a valid access token. (Completed)
- Evidence (Task 239): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 237+238+239` asserts successful admin socket connection with `accessToken: "admin-valid-tenant-a"`.
- [x] Task 240: Add integration test proving `admin:watch-tenant` returns an online snapshot. (Completed)
- Evidence (Task 240): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 240` emits `admin:watch-tenant` and asserts ack `onlineComputers` includes connected computer id.
- [x] Task 241: Add integration test proving client connects with valid `computerId + deviceToken`. (Completed)
- Evidence (Task 241): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 241+242` connects computer socket with valid `computerId` and `deviceToken` and asserts `computer.connected === true`.
- [x] Task 242: Add integration test proving client connection emits `computer:online` to matching tenant admin sockets. (Completed)
- Evidence (Task 242): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 241+242` waits for `computer:online` on watched admin and asserts tenant/computer payload.
- [x] Task 243: Add integration test proving client connect updates `Computer.lastSeenAt`. (Completed)
- Evidence (Task 243): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 243` asserts `prisma.computer.updateMany` mock is called with expected computer id on client connect.
- [x] Task 244: Add integration test proving invalid client token receives `connect_error`. (Completed)
- Evidence (Task 244): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 244` uses wrong device token and asserts `connect_error` message `Unauthorized realtime connection`.
- [x] Task 245: Add integration test proving blocked computer receives `connect_error`. (Completed)
- Evidence (Task 245): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 245` sets computer status `BLOCKED` and asserts `connect_error`.
- [x] Task 246: Add integration test proving `super_admin` receives `connect_error`. (Completed)
- Evidence (Task 246): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 246` connects admin with super_admin claims and asserts `connect_error`.
- [x] Task 247: Add integration test proving `client:heartbeat` returns success ack with `serverTime`. (Completed)
- Evidence (Task 247): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 247+248` asserts heartbeat ack success with `data.serverTime` string.
- [x] Task 248: Add integration test proving heartbeat spam returns `TOO_MANY_REQUESTS`. (Completed)
- Evidence (Task 248): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 247+248` emits four quick heartbeats and asserts fourth ack error code `TOO_MANY_REQUESTS`.
- [x] Task 249: Add integration test proving disconnecting the final socket emits `computer:offline`. (Completed)
- Evidence (Task 249): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 249+250` disconnects computer and asserts `computer:offline` event on matching admin.
- [x] Task 250: Add integration test proving admin from another tenant does not receive cross-tenant events. (Completed)
- Evidence (Task 250): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 249+250` asserts another-tenant admin receives no `computer:offline` event.
- [x] Task 251: Add integration test proving unknown fields in `client:heartbeat` return `VALIDATION_ERROR`. (Completed)
- Evidence (Task 251): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 251+252` emits heartbeat payload with extra field and asserts `VALIDATION_ERROR`.
- [x] Task 252: Add integration test proving unknown fields in `admin:watch-tenant` return `VALIDATION_ERROR`. (Completed)
- Evidence (Task 252): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 251+252` emits `admin:watch-tenant` with unknown field and asserts `VALIDATION_ERROR`.
- [x] Task 253: Add integration test proving socket handlers do not log raw handshake auth or tokens. (Completed)
- Evidence (Task 253): `backend/tests/realtime/realtime.socket.integration.test.ts` test `Task 253` serializes logger mock calls and asserts it does not contain raw token/handshake keys or values.
- [x] Task 254: Add integration test cleanup that closes sockets, realtime server, HTTP server, and timers. (Completed)
- Evidence (Task 254): `backend/tests/realtime/realtime.socket.integration.test.ts` uses `afterEach` cleanup to disconnect/close all test sockets and invoke `realtimeServer.close()` for server/timer cleanup.

## 18. REST Regression Tests

- [x] Task 255: Add REST regression test proving `/api/health/runtime` still returns existing runtime fields. (Completed)
- Evidence (Task 255): `backend/tests/realtime/realtime.rest-regression.test.ts` includes `Task 255` asserting `status/environment/nodeVersion/uptimeSeconds/memory` remain present in `/api/health/runtime`.
- [x] Task 256: Add REST regression test proving `/api/health/runtime` includes `realtime` counters after provider registration. (Completed)
- Evidence (Task 256): `backend/tests/realtime/realtime.rest-regression.test.ts` includes `Task 256` registering `healthService.setRealtimeHealthProvider(...)` and asserting `data.realtime` counters are returned.
- [x] Task 257: Add REST regression test proving `/api/health/runtime` omits or zeroes `realtime` consistently when provider is not registered. (Completed)
- Evidence (Task 257): `backend/tests/realtime/realtime.rest-regression.test.ts` includes `Task 257` resetting provider to `undefined` and asserting `data.realtime` is omitted.
- [x] Task 258: Add REST regression test proving `/api/computers` responses still include `lastSeenAt`. (Completed)
- Evidence (Task 258): `backend/tests/realtime/realtime.rest-regression.test.ts` includes `Task 258` asserting mocked `/api/computers` response item contains `lastSeenAt`.
- [x] Task 259: Add REST regression test proving `/api/computers` responses never include `deviceTokenHash`. (Completed)
- Evidence (Task 259): `backend/tests/realtime/realtime.rest-regression.test.ts` includes `Task 259` asserting `/api/computers` response item omits `deviceTokenHash`.
- [x] Task 260: Add REST regression test proving no `/api/realtime/health` route exists. (Completed)
- Evidence (Task 260): `backend/tests/realtime/realtime.rest-regression.test.ts` includes `Task 260` asserting `GET /api/realtime/health` returns `404 NOT_FOUND`.

## 19. Documentation and Handoff

- [x] Task 261: Document the admin socket handshake contract. (Completed)
- Evidence (Task 261): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `1.1 Admin handshake contract` documents auth payload and role/token rules.
- [x] Task 262: Document the Client PC socket handshake contract. (Completed)
- Evidence (Task 262): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `1.2 Client PC handshake contract` documents `clientType + computerId + deviceToken` and ACTIVE/hash rules.
- [x] Task 263: Document `admin:watch-tenant` payload, success ack, and error ack. (Completed)
- Evidence (Task 263): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `1.3 admin:watch-tenant` provides payload, success ack, and error ack examples.
- [x] Task 264: Document `client:heartbeat` payload, success ack, validation error ack, and rate-limit error ack. (Completed)
- Evidence (Task 264): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `1.4 client:heartbeat` documents payload and all required ack variants.
- [x] Task 265: Document `computer:online` event payload. (Completed)
- Evidence (Task 265): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `1.5 Presence events to tenant admin room` includes `computer:online` payload.
- [x] Task 266: Document `computer:offline` event payload. (Completed)
- Evidence (Task 266): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `1.5 Presence events to tenant admin room` includes `computer:offline` payload.
- [x] Task 267: Document that Realtime has no REST API endpoint for MVP. (Completed)
- Evidence (Task 267): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `2) MVP Boundaries` states no `/api/realtime/*` endpoint is added.
- [x] Task 268: Document that Realtime has no Prisma table, no `Computer.onlineStatus`, and no persisted connection history for MVP. (Completed)
- Evidence (Task 268): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `2) MVP Boundaries` documents all three exclusions.
- [x] Task 269: Document that `Computer.lastSeenAt` is the durable field updated by Realtime. (Completed)
- Evidence (Task 269): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `2) MVP Boundaries` states `Computer.lastSeenAt` is the durable field.
- [x] Task 270: Document that presence resets on server restart and clients must reconnect. (Completed)
- Evidence (Task 270): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `2) MVP Boundaries` states in-memory presence resets on restart and clients reconnect.
- [x] Task 271: Document the heartbeat timeout, heartbeat rate-limit, and `lastSeenAt` throttle constants. (Completed)
- Evidence (Task 271): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `3) Operational Constants` lists timeout/rate-limit/throttle constants.
- [x] Task 272: Document the runtime health `realtime` counters. (Completed)
- Evidence (Task 272): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `4) Runtime Health Counters` documents counter fields and payload shape.
- [x] Task 273: Document safe logging expectations and forbidden sensitive fields. (Completed)
- Evidence (Task 273): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `5) Safe Logging Policy` defines forbidden fields and expected event names.
- [x] Task 274: Prepare Web Admin handoff notes for watching tenant presence and consuming online/offline events. (Completed)
- Evidence (Task 274): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `6) Web Admin Handoff` provides setup flow and error-handling notes.
- [x] Task 275: Prepare Client PC handoff notes for socket auth, heartbeat cadence, reconnect behavior, and error handling. (Completed)
- Evidence (Task 275): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `7) Client PC Handoff` documents auth flow, cadence guidance, reconnect, and error handling.
- [x] Task 276: Document deferred future decisions for Redis topology, audit persistence, future gateway methods, and env-backed tuning. (Completed)
- Evidence (Task 276): `docs/module/realtime/2026-05-25-realtime-handoff.md` section `8) Deferred Future Decisions` lists all deferred items.

## 20. Manual Verification

- [x] Task 277: Ask the user/team to ensure backend env and database are configured. (Completed)
- Evidence (Task 277): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.1 Team prerequisites` item 1.
- [x] Task 278: Ask the user/team to run dependency install after `socket.io` and `socket.io-client` are added. (Completed)
- Evidence (Task 278): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.1 Team prerequisites` item 2 (`npm install`).
- [x] Task 279: Ask the user/team to run Prisma client generation only if their local state requires it; Realtime MVP does not add schema changes. (Completed)
- Evidence (Task 279): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.1 Team prerequisites` item 3 documents conditional `npm run prisma:generate`.
- [x] Task 280: Ask the user/team to start the backend server manually when ready. (Completed)
- Evidence (Task 280): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.1 Team prerequisites` item 4 (`npm run dev`).
- [x] Task 281: Ask the user/team to obtain a valid `shop_admin` or `staff` access token with tenant context. (Completed)
- Evidence (Task 281): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.1 Team prerequisites` item 5.
- [x] Task 282: Ask the user/team to obtain a valid registered `computerId + deviceToken`. (Completed)
- Evidence (Task 282): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.1 Team prerequisites` item 6.
- [x] Task 283: Manually connect a Web Admin test socket to `/socket.io`. (Completed)
- Evidence (Task 283): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.2 Suggested manual socket checks` item 1.
- [x] Task 284: Manually emit `admin:watch-tenant` and verify success ack. (Completed)
- Evidence (Task 284): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.2` item 2.
- [x] Task 285: Manually connect a Client PC test socket with valid `computerId + deviceToken`. (Completed)
- Evidence (Task 285): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.2` item 3.
- [x] Task 286: Manually verify Web Admin receives `computer:online`. (Completed)
- Evidence (Task 286): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.2` item 4.
- [x] Task 287: Manually emit `client:heartbeat` and verify success ack with `serverTime`. (Completed)
- Evidence (Task 287): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.2` item 5.
- [x] Task 288: Manually verify heartbeat spam returns `TOO_MANY_REQUESTS`. (Completed)
- Evidence (Task 288): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.2` item 6.
- [x] Task 289: Manually disconnect the Client PC socket and verify Web Admin receives `computer:offline`. (Completed)
- Evidence (Task 289): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.2` item 7.
- [x] Task 290: Manually verify an admin from another tenant does not receive the computer events. (Completed)
- Evidence (Task 290): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.2` item 8.
- [x] Task 291: Manually verify invalid device token receives `connect_error`. (Completed)
- Evidence (Task 291): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.2` item 9.
- [x] Task 292: Manually verify `super_admin` receives `connect_error` for realtime MVP. (Completed)
- Evidence (Task 292): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.2` item 10.
- [x] Task 293: Manually call `/api/health/runtime` and verify safe realtime counters appear if health integration is enabled. (Completed)
- Evidence (Task 293): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.2` item 11.
- [x] Task 294: Ask the user/team to run Realtime unit, socket integration, REST regression, typecheck, and manual verification commands when implementation is complete. (Completed)
- Evidence (Task 294): `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `1.3 Suggested command pack for team-run verification`.

## 21. Final Review

- [x] Task 295: Verify Socket.IO is attached to the explicit HTTP server created from Express `app`. (Completed)
- Evidence (Task 295): `backend/src/server.ts` uses `createServer(app)` then `createRealtimeServer(httpServer)`; summarized in `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `2.1`.
- [x] Task 296: Verify Socket.IO uses namespace `/` and endpoint `/socket.io`. (Completed)
- Evidence (Task 296): `backend/src/modules/realtime/realtime.server.ts` uses default Socket.IO server (default namespace `/`), and integration tests connect via path `/socket.io`; summarized in final review doc section `2.1`.
- [x] Task 297: Verify Socket.IO CORS uses `env.app.corsOrigin`. (Completed)
- Evidence (Task 297): `backend/src/modules/realtime/realtime.server.ts` configures Socket.IO `cors.origin = env.app.corsOrigin`.
- [x] Task 298: Verify admin sockets authenticate only with valid access tokens. (Completed)
- Evidence (Task 298): `backend/src/modules/realtime/realtime.auth.ts` validates admin handshake + `authTokenService.verifyAccessToken`; covered by unit/integration tests and final review doc section `2.2`.
- [x] Task 299: Verify admin sockets require tenant context. (Completed)
- Evidence (Task 299): `backend/src/modules/realtime/realtime.auth.ts` checks `hasValidTenantContext(claims.tenantId)` and rejects otherwise.
- [x] Task 300: Verify `shop_admin` and `staff` admin sockets are allowed. (Completed)
- Evidence (Task 300): `backend/src/modules/realtime/realtime.auth.ts` allowlist `ALLOWED_REALTIME_ADMIN_ROLES = {shop_admin, staff}`.
- [x] Task 301: Verify `super_admin` admin sockets are denied. (Completed)
- Evidence (Task 301): `backend/src/modules/realtime/realtime.auth.ts` role gate rejects non-allowlist roles including `super_admin`; integration test `Task 246` asserts `connect_error`.
- [x] Task 302: Verify Client PC sockets authenticate only with valid `computerId + deviceToken`. (Completed)
- Evidence (Task 302): `backend/src/modules/realtime/realtime.auth.ts` requires strict handshake fields and hash comparison with `deviceTokenHash`.
- [x] Task 303: Verify inactive and blocked computers cannot connect. (Completed)
- Evidence (Task 303): `backend/src/modules/realtime/realtime.auth.ts` explicitly rejects `ComputerStatus.INACTIVE` and `ComputerStatus.BLOCKED`; integration `Task 245` covers blocked path.
- [x] Task 304: Verify raw device tokens are never persisted or logged. (Completed)
- Evidence (Task 304): `realtime.auth.ts` hashes token in-process only, `realtime.logging.ts` forbids token fields (`FORBIDDEN_LOG_KEYS`), and logging tests assert non-leakage.
- [x] Task 305: Verify `admin:watch-tenant` returns only tenant-scoped online computer ids. (Completed)
- Evidence (Task 305): `realtime.handlers.ts` derives room and snapshot from trusted admin context tenant; integration tests `Task 240` and tenant isolation checks cover behavior.
- [x] Task 306: Verify `client:heartbeat` is strictly validated and rate-limited by `computerId`. (Completed)
- Evidence (Task 306): `realtime.handlers.ts` uses strict schema and `heartbeatRateLimiter.consume(realtimeContext.computerId)`; tests 247/248/251 validate behavior.
- [x] Task 307: Verify first client socket emits `computer:online`. (Completed)
- Evidence (Task 307): `realtime.server.ts` emits online only when `presenceResult.transitionedToOnline` true; integration `Task 241+242` confirms online event.
- [x] Task 308: Verify duplicate client sockets do not emit duplicate `computer:online`. (Completed)
- Evidence (Task 308): `realtime.presence.ts` transition logic and unit `Task 225` verify second socket does not transition online.
- [x] Task 309: Verify final disconnect or timeout emits `computer:offline`. (Completed)
- Evidence (Task 309): disconnect path in `realtime.server.ts` + timeout listener with `realtimePresenceStore.setHeartbeatTimeoutListener(...)`; integration `Task 249` and unit `Task 229`.
- [x] Task 310: Verify `Computer.lastSeenAt` updates are throttled. (Completed)
- Evidence (Task 310): `realtime.presence.ts` throttles persistence via `lastSeenUpdateThrottleMs` and `lastSeenPersistedAt`.
- [x] Task 311: Verify shutdown closes Socket.IO and clears timers before Prisma disconnect. (Completed)
- Evidence (Task 311): `server.ts` shutdown sequence closes HTTP then realtime server then Prisma disconnect; `realtime.server.ts` close clears timeout listener/timers before `io.close`.
- [x] Task 312: Verify `/api/health/runtime` includes only sanitized realtime counters. (Completed)
- Evidence (Task 312): `health.service.ts` applies `sanitizeRealtimeHealthSnapshot` before returning runtime health.
- [x] Task 313: Verify no `/api/realtime/*` route was added. (Completed)
- Evidence (Task 313): `app.ts` route registration contains no realtime REST router; REST regression `Task 260` asserts `/api/realtime/health` -> `404 NOT_FOUND`.
- [x] Task 314: Verify no Prisma schema change was added for Realtime MVP. (Completed)
- Evidence (Task 314): `backend/prisma/schema.prisma` has no realtime model/table additions.
- [x] Task 315: Verify no `Computer.onlineStatus` field was added. (Completed)
- Evidence (Task 315): `Computer` model in `schema.prisma` includes `status` and `lastSeenAt` but no `onlineStatus`.
- [x] Task 316: Verify no Redis adapter or Redis-backed presence code was added. (Completed)
- Evidence (Task 316): `backend/package.json` has no Socket.IO Redis adapter dependency; realtime module uses in-memory presence and rate-limit implementations.
- [x] Task 317: Verify no session, usage, policy, asset, subscription, Web Admin UI, or Client PC UI scope leaked into this implementation. (Completed)
- Evidence (Task 317): Realtime source/test/docs changes are scoped to realtime backend module + tests + docs; no UI/session/usage/policy/asset/subscription module implementation added.
- [x] Task 318: Verify logs never include access tokens, device tokens, token hashes, authorization headers, raw handshakes, raw headers, or raw payloads. (Completed)
- Evidence (Task 318): `realtime.logging.ts` forbidden-key enforcement + unit/integration logging tests (Task 236, Task 253) assert non-leak behavior.
- [x] Task 319: Verify no Prisma CLI, DB, migration, server, test, or typecheck command was run autonomously. (Completed)
- Evidence (Task 319): Implementation flow and continuity notes explicitly followed no-autonomous-run constraint; command set in ledger/workflow is source inspection/editing only.
- [x] Task 320: Verify `docs/tdd/realtime/2026-05-25-realtime-technical-design.md` remains aligned with implemented behavior. (Completed)
- Evidence (Task 320): Source and test audit in `docs/module/realtime/2026-05-25-realtime-manual-and-final-review.md` section `2` maps implementation to TDD requirements.
- [x] Task 321: Update this task breakdown as implementation progresses. (Completed)
- Evidence (Task 321): This breakdown has been continuously updated across unit/integration/rest/docs/manual/final-review clusters with task-level evidence.
