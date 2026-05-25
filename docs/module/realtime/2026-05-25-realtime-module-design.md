# CloudCMS Realtime Module Design

Date: 2026-05-25
Status: Approved

## 1. Overview

The `realtime` module provides Socket.IO-based presence for CloudCMS. It follows the module boundary defined in `docs/backend/2026-05-17-cloudcms-backend-design.md`: Socket.IO authentication, tenant/computer rooms, heartbeat, online/offline state, and event emission.

This MVP is Socket.IO-first. It does not implement a REST heartbeat endpoint. The realtime API is the Socket.IO event contract under `/socket.io`.

Realtime owns:

- Socket.IO server initialization and lifecycle.
- Admin socket authentication with JWT access tokens.
- Client PC socket authentication with `computerId` and device token.
- Room membership for `tenant:<tenantId>` and `computer:<computerId>`.
- Client heartbeat handling.
- In-memory online/offline presence.
- `Computer.lastSeenAt` updates.
- Presence events emitted to web admin sockets.
- A minimal gateway for presence events.

Realtime does not own:

- Computer registration or device token issuance.
- Session start/end business rules.
- Usage sync persistence or dashboard summaries.
- URL policy business rules.
- Asset/subscription business events.
- Web Admin UI or Client PC UI.
- Persistent audit history for socket connections.

## 2. MVP Scope

The selected MVP approach is Socket.IO Presence MVP.

Included:

- Add `socket.io` to the backend runtime.
- Create a realtime module under `backend/src/modules/realtime`.
- Attach Socket.IO to the existing HTTP server lifecycle.
- Authenticate admin sockets using access tokens.
- Authenticate client PC sockets using `computerId + deviceToken`.
- Join trusted rooms derived from verified auth context.
- Handle `admin:watch-tenant`.
- Handle `client:heartbeat`.
- Emit `computer:online` and `computer:offline`.
- Update `Computer.lastSeenAt` with throttling.
- Track presence in memory for a single backend instance.
- Expose runtime counters through the realtime service for health/observability integration.

Deferred:

- REST endpoint such as `GET /api/realtime/presence`.
- Prisma table for realtime connections or presence.
- `Computer.onlineStatus`.
- Redis Socket.IO adapter and Redis-backed presence store.
- Session command handlers such as `admin:command:start-session`.
- Usage, policy, asset, and subscription event implementations.
- Persistent audit records for connect/disconnect history.

## 3. Architecture

Module structure:

```text
backend/src/modules/realtime/
  realtime.server.ts
  realtime.auth.ts
  realtime.rooms.ts
  realtime.presence.ts
  realtime.handlers.ts
  realtime.gateway.ts
  realtime.events.ts
  realtime.types.ts
```

Responsibilities:

- `realtime.server.ts`: creates and configures the Socket.IO server, attaches middleware and handlers, and exposes lifecycle close behavior.
- `realtime.auth.ts`: verifies admin JWT access tokens and client device tokens.
- `realtime.rooms.ts`: defines room names and room join helpers.
- `realtime.presence.ts`: tracks connected sockets, online computers, heartbeat timestamps, counters, and timeout handling.
- `realtime.handlers.ts`: registers MVP event handlers for `admin:watch-tenant`, `client:heartbeat`, disconnect, and connection lifecycle.
- `realtime.gateway.ts`: public emit API used by this module and future business modules; MVP exposes presence emits only.
- `realtime.events.ts`: event constants, payload types, and ack contracts.
- `realtime.types.ts`: socket context and shared realtime types.

The gateway is the integration boundary. Future modules such as `sessions`, `usage`, `url-rules`, `assets`, and `subscriptions` must emit through `realtime.gateway.ts` instead of importing Socket.IO internals.

Future handler growth can split `realtime.handlers.ts` into:

```text
backend/src/modules/realtime/handlers/
  admin.handlers.ts
  client.handlers.ts
```

The MVP keeps one handler file to avoid premature structure.

## 4. Dependencies And Server Lifecycle

Runtime dependency:

```text
socket.io
```

Test dependency if socket integration tests are added:

```text
socket.io-client
```

`backend/src/server.ts` should create an HTTP server from the existing Express `app`, attach Socket.IO through `realtime.server.ts`, and then call `listen` on the HTTP server. Express route registration remains in `backend/src/app.ts`.

Startup flow:

```text
create HTTP server from Express app
-> initialize realtime server with HTTP server
-> register Socket.IO auth middleware
-> register realtime handlers
-> HTTP server listen
```

Shutdown flow:

```text
receive SIGINT/SIGTERM
-> stop accepting HTTP connections
-> close Socket.IO server
-> clear heartbeat/offline timers
-> disconnect Prisma
-> flush logger
-> exit
```

Socket.IO CORS should reuse `env.app.corsOrigin`.

## 5. Authentication And Rooms

### Admin Socket Authentication

Admin sockets authenticate through `socket.handshake.auth`:

```json
{
  "clientType": "admin",
  "accessToken": "jwt-access-token"
}
```

Rules:

- Verify the token with `authTokenService.verifyAccessToken`.
- Reject missing, malformed, expired, refresh-token-type, or invalid access tokens.
- Require a valid `tenantId` in the access token.
- Allow tenant users to watch their own tenant presence.
- Recommended MVP roles: `shop_admin` and `staff`.
- Do not trust tenant id from event payloads.

After successful authentication, the socket context contains:

```text
clientType = admin
userId
tenantId
role
```

The admin socket can join:

```text
tenant:<tenantId>
```

### Client PC Socket Authentication

Client PC sockets authenticate through `socket.handshake.auth`:

```json
{
  "clientType": "computer",
  "computerId": "computer-id",
  "deviceToken": "plain-device-token"
}
```

Rules:

- Find `Computer` by `computerId`.
- Require `Computer.status = ACTIVE`.
- Hash the submitted `deviceToken` with the Computers device-token hashing helper.
- Compare the hash to `Computer.deviceTokenHash`.
- Reject invalid tokens without revealing whether the computer id or token was wrong.
- Do not authenticate with MAC address.
- Do not let the client choose arbitrary rooms.

After successful authentication, the socket context contains:

```text
clientType = computer
computerId
tenantId
```

The client socket can join:

```text
computer:<computerId>
```

### Room Names

Room helpers:

```text
tenantRoom(tenantId)   -> tenant:<tenantId>
computerRoom(id)       -> computer:<computerId>
```

All joins use verified context, never payload-provided tenancy.

## 6. Socket API Contract

Realtime does not add a REST API in MVP. The API contract is the Socket.IO contract.

Transport:

```text
Socket.IO endpoint: /socket.io
Namespace: /
Auth location: socket.handshake.auth
```

### Admin Event: `admin:watch-tenant`

Admin emits:

```text
admin:watch-tenant
```

Payload:

```json
{}
```

The tenant is derived from the verified JWT context.

Ack success:

```json
{
  "success": true,
  "data": {
    "onlineComputers": ["computer-id-1", "computer-id-2"]
  }
}
```

Ack error:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Tenant context is required."
  }
}
```

### Client Event: `client:heartbeat`

Client emits:

```text
client:heartbeat
```

Payload:

```json
{
  "sentAt": "2026-05-25T10:00:00.000Z"
}
```

Rules:

- Only authenticated computer sockets may emit this event.
- Payload must be validated.
- Heartbeat is rate-limited by `computerId`.
- The handler updates in-memory `lastHeartbeatAt`.
- The handler updates `Computer.lastSeenAt` with throttling.

Ack success:

```json
{
  "success": true,
  "data": {
    "serverTime": "2026-05-25T10:00:00.000Z"
  }
}
```

Ack rate-limit error:

```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many heartbeat events. Please try again later."
  }
}
```

### Backend Events To Admin Room

Backend emits to:

```text
tenant:<tenantId>
```

Events:

```text
computer:online
computer:offline
```

Payload:

```json
{
  "computerId": "computer-id",
  "tenantId": "tenant-id",
  "lastSeenAt": "2026-05-25T10:00:00.000Z"
}
```

## 7. Data Model

Realtime MVP does not add a Prisma table and does not require a migration.

Do not add:

- `Computer.onlineStatus`
- `RealtimePresence`
- `RealtimeConnection`
- `RealtimeConnectionLog`

Reuse existing data:

- `Computer.deviceTokenHash`: authenticates client socket.
- `Computer.status`: blocks `INACTIVE` and `BLOCKED` computers.
- `Computer.lastSeenAt`: stores the latest accepted heartbeat timestamp.

Online/offline is volatile runtime state and should remain in memory for MVP. If the server restarts, connected clients reconnect and rebuild presence. This behavior is acceptable and avoids storing transient socket state as durable business data.

Future scale path:

- Use Redis Socket.IO adapter for multi-instance broadcast.
- Move presence state from memory to Redis.
- Keep the same Socket.IO event contract.

Future audit path:

- Persist connect/disconnect history through the `audit` module or a dedicated connection log table only when audit requirements are explicit.

## 8. Presence And Data Flow

### Client Connect

```text
Client PC connects
-> realtime.auth verifies computerId + deviceToken
-> join computer:<computerId>
-> realtime.presence records socket for computerId
-> if first active socket for computerId, mark online
-> update Computer.lastSeenAt
-> realtime.gateway emits computer:online to tenant:<tenantId>
```

### Client Heartbeat

```text
client:heartbeat
-> validate payload
-> rate-limit by computerId
-> update in-memory lastHeartbeatAt
-> throttle DB update for Computer.lastSeenAt
-> ack success with serverTime
```

### Client Disconnect Or Heartbeat Timeout

```text
socket disconnects or heartbeat timeout fires
-> remove socket from computer presence set
-> if no active socket remains for computerId, mark offline
-> realtime.gateway emits computer:offline to tenant:<tenantId>
```

### Admin Watch Tenant

```text
Admin connects
-> realtime.auth verifies access token and tenant context
-> admin:watch-tenant
-> join tenant:<tenantId>
-> return onlineComputers snapshot in ack
-> receive future computer:online/offline events
```

Multi-socket rule:

- Multiple sockets for the same computer are allowed.
- Emit `computer:online` only when the first socket for a computer appears.
- Emit `computer:offline` only when the last socket for a computer disappears or times out.

## 9. Rate Limiting And Configuration

Heartbeat rate limit follows the backend design:

```text
key: computerId
capacity: 3
refill: 1 token / 10 seconds
```

The Socket.IO heartbeat handler should use the existing token bucket/store pattern through an event-level adapter. Do not use Express request middleware directly for socket events.

Recommended constants or env-backed configuration:

```text
REALTIME_HEARTBEAT_RATE_LIMIT_CAPACITY = 3
REALTIME_HEARTBEAT_RATE_LIMIT_REFILL_TOKENS = 1
REALTIME_HEARTBEAT_RATE_LIMIT_REFILL_WINDOW_SECONDS = 10
REALTIME_HEARTBEAT_TIMEOUT_SECONDS = 90
REALTIME_LAST_SEEN_UPDATE_THROTTLE_SECONDS = 30
```

MVP can keep these as module constants if the project prefers fewer env variables. If operations need runtime configurability, add env validation through `backend/src/config/env.ts`.

## 10. Error Handling

Connection auth failures reject the socket with `connect_error`.

Event failures return ack payloads:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid realtime event payload."
  }
}
```

Use error codes aligned with the Foundation response model:

```text
UNAUTHORIZED
FORBIDDEN
VALIDATION_ERROR
NOT_FOUND
TOO_MANY_REQUESTS
INTERNAL_ERROR
```

Unexpected errors:

- Log sanitized context.
- Return `INTERNAL_ERROR` ack for event failures.
- Do not expose stack traces, token material, Prisma internals, or socket internals to clients.

## 11. Security Considerations

Never log:

- `deviceToken`
- `deviceTokenHash`
- JWT/access token
- raw `socket.handshake.auth`
- authorization headers
- raw payloads that can contain secrets

Rules:

- Client PC auth uses device token, not MAC address.
- `INACTIVE` and `BLOCKED` computers cannot connect.
- Admin sockets cannot join arbitrary tenant rooms.
- Client sockets cannot join arbitrary computer rooms.
- Tenant isolation is derived from verified auth context.
- Cross-tenant event delivery must be impossible through room helpers and gateway methods.
- Event ack errors should not reveal whether a computer id exists when token auth fails.

## 12. Logging, Observability, Health And Operations

Structured log events:

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

Safe log fields:

```text
socketId
tenantId
computerId
actorUserId
actorRole
event
reason
connectedSocketCount
lastHeartbeatAt
ip
userAgent
```

Useful counters/gauges:

- active socket count
- online computer count
- admin socket count
- heartbeat accepted count
- heartbeat rate-limited count
- auth failure count
- offline timeout count

Health integration:

- Prefer extending runtime health if available or planned.
- Do not add a separate realtime health endpoint in MVP unless Foundation health cannot be extended.

Suggested runtime health fields:

```json
{
  "realtime": {
    "activeSockets": 12,
    "onlineComputers": 8,
    "adminSockets": 2,
    "heartbeatTimeouts": 1
  }
}
```

Operations:

- Single instance can use in-memory presence.
- Multi-instance requires Redis Socket.IO adapter and Redis-backed presence.
- Shutdown must clear heartbeat timers and close Socket.IO.
- Reconnect behavior should be client-driven; server rebuilds presence on reconnect.

## 13. Gateway Boundary

The MVP gateway exposes presence-only methods:

```text
emitComputerOnline(input)
emitComputerOffline(input)
getPresenceSnapshotForTenant(tenantId)
getRealtimeHealthSnapshot()
```

Future modules should add gateway methods only when their business services exist:

```text
sessions.service -> realtimeGateway.sendSessionStartCommand(...)
sessions.service -> realtimeGateway.emitSessionStarted(...)
usage.service -> realtimeGateway.emitUsageUpdated(...)
urlRules.service -> realtimeGateway.sendPolicyUpdate(...)
assets.service -> realtimeGateway.emitAssetUpdated(...)
subscriptions.service -> realtimeGateway.emitSubscriptionUpdated(...)
```

Do not create broad no-op stubs for future events in the MVP.

## 14. Testing Plan

### Unit Tests

- Room helper returns `tenant:<tenantId>` and `computer:<computerId>`.
- Admin auth accepts a valid access token.
- Admin auth rejects invalid, expired, malformed, and wrong-token-type tokens.
- Admin auth rejects missing tenant context.
- Client auth accepts valid `computerId + deviceToken`.
- Client auth rejects invalid tokens.
- Client auth rejects `INACTIVE` and `BLOCKED` computers.
- Presence service marks a computer online on first socket.
- Presence service does not duplicate online events for multiple sockets.
- Presence service emits offline only after the last socket disappears.
- Heartbeat rate limiter keys by `computerId`.
- Ack/error mapper never exposes token material.
- Realtime health snapshot returns sanitized counts.

### Socket Integration Tests

- Admin connects and `admin:watch-tenant` returns online snapshot.
- Client connects and emits `computer:online` to matching tenant room.
- Client connect updates `Computer.lastSeenAt`.
- Invalid client token receives `connect_error`.
- Blocked computer receives `connect_error`.
- `client:heartbeat` returns success ack with `serverTime`.
- Heartbeat spam returns `TOO_MANY_REQUESTS`.
- Disconnecting the final socket emits `computer:offline`.
- Admin from another tenant does not receive cross-tenant computer events.
- Socket handlers do not log raw handshake auth or tokens.

### Manual Verification

- User/team runs install, server, DB, Prisma, test, and typecheck commands manually according to project rules.
- Verify a test admin socket receives `computer:online` after a test client connects.
- Verify the same admin socket receives `computer:offline` after the client disconnects or times out.
- Verify `GET /api/computers` still provides `lastSeenAt` for initial admin list views.

## 15. Acceptance Criteria

- Socket.IO is attached to the backend HTTP server.
- Admin sockets authenticate with JWT access tokens and join only their tenant room.
- Client sockets authenticate with `computerId + deviceToken` and join only their own computer room.
- Client heartbeat updates in-memory presence and throttled `Computer.lastSeenAt`.
- Admin `admin:watch-tenant` returns a tenant-scoped online snapshot.
- Backend emits `computer:online` and `computer:offline` to the correct tenant room.
- Cross-tenant event leakage is prevented by design and tests.
- No realtime-specific Prisma table is added in MVP.
- No `Computer.onlineStatus` field is added in MVP.
- No REST realtime presence endpoint is added in MVP.
- Logs and errors never expose tokens, token hashes, JWTs, or raw auth payloads.

## 16. Alternatives Considered

### REST Heartbeat First

Rejected. It does not fully match the realtime module boundary, which explicitly includes Socket.IO auth, rooms, heartbeat, online/offline, and emit events.

### Full Socket Contract Skeleton

Rejected for MVP. Adding handlers or stubs for sessions, usage, policy, asset, and subscription events before those modules exist would create API surface without business implementation.

### Persistent `onlineStatus`

Rejected for MVP. Online/offline is volatile socket state. Persisting it in MySQL risks stale state after crashes and does not add enough value while running a single backend instance.

### Realtime Connection Table

Deferred. Connection history belongs in audit/operations once explicit retention and reporting requirements exist.

### REST Presence Endpoint

Deferred. Web admin can fetch initial computer data from `GET /api/computers` and use `admin:watch-tenant` for online snapshots and events.
