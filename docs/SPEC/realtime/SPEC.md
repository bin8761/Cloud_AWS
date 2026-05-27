# CloudCMS Realtime Module SPEC

Date: 2026-05-25

Source design: `docs/module/realtime/2026-05-25-realtime-module-design.md`

## Overview

The Realtime module provides Socket.IO-based presence for CloudCMS. It lets Web Admin clients observe tenant-scoped computer online/offline state while Client PC apps maintain presence through authenticated socket connections and heartbeat events.

Realtime owns:

- Socket.IO server initialization and lifecycle.
- Admin socket authentication with JWT access tokens.
- Client PC socket authentication with `computerId + deviceToken`.
- Room membership for `tenant:<tenantId>` and `computer:<computerId>`.
- Client heartbeat handling.
- In-memory online/offline presence for a single backend instance.
- Throttled `Computer.lastSeenAt` updates.
- Presence events emitted to Web Admin sockets.
- A minimal gateway for presence events and health counters.

Realtime does not own:

- Computer registration or device token issuance.
- Session start/end business rules.
- Usage sync persistence or dashboard summaries.
- URL policy business rules.
- Asset, subscription, or audit business events.
- Web Admin UI or Client PC UI.
- Persistent connection history.

Target users:

- Web Admin: watches online/offline state for computers in the authenticated tenant.
- Client PC app: connects with its computer identity and sends heartbeat events.
- Backend developers: integrate future modules through the realtime gateway instead of Socket.IO internals.
- Operations: inspect sanitized runtime counters and logs for socket health.

Success criteria:

- Socket.IO is attached to the backend HTTP server at `/socket.io`.
- Admin sockets authenticate with JWT access tokens and join only their own tenant room.
- Client sockets authenticate with `computerId + deviceToken` and join only their own computer room.
- `admin:watch-tenant` returns a tenant-scoped online snapshot.
- `client:heartbeat` updates in-memory presence and throttled `Computer.lastSeenAt`.
- `computer:online` and `computer:offline` are emitted only to the matching tenant room.
- Cross-tenant event leakage is prevented by room helpers, gateway methods, and tests.
- No realtime-specific Prisma table, `Computer.onlineStatus`, or REST presence endpoint is added in MVP.
- Logs and errors never expose tokens, token hashes, JWTs, or raw socket auth payloads.

## Product Requirements

### MVP Features

1. Socket.IO server lifecycle
   - Create and configure the Socket.IO server.
   - Attach it to the existing HTTP server created from the Express app.
   - Reuse backend CORS origin configuration.
   - Close Socket.IO and clear realtime timers during shutdown.

2. Admin socket authentication
   - Accept admin sockets through `socket.handshake.auth`.
   - Verify JWT access tokens with the existing auth token service.
   - Require valid tenant context.
   - Allow tenant users to watch only their own tenant room.
   - Reject invalid, expired, malformed, refresh-token-type, or tenantless tokens.

3. Client PC socket authentication
   - Accept Client PC sockets through `socket.handshake.auth`.
   - Validate `computerId + deviceToken` against the Computers module data.
   - Require `Computer.status = ACTIVE`.
   - Hash the submitted device token with the Computers device-token hashing helper.
   - Reject invalid credentials without revealing whether the computer id or token was wrong.

4. Trusted rooms
   - Admin sockets can join `tenant:<tenantId>` from verified JWT context.
   - Client PC sockets can join `computer:<computerId>` from verified computer context.
   - Room helpers must derive room names from trusted context, not event payloads.

5. Presence state
   - Track connected sockets in memory.
   - Allow multiple sockets for one computer.
   - Mark a computer online only when the first active socket appears.
   - Mark a computer offline only when the last active socket disconnects or times out.
   - Rebuild presence through reconnects after server restart.

6. Heartbeat handling
   - Handle `client:heartbeat` from authenticated computer sockets.
   - Validate payload shape.
   - Rate-limit by `computerId`.
   - Update in-memory `lastHeartbeatAt`.
   - Update `Computer.lastSeenAt` with throttling.
   - Return ack payloads with success/error shape aligned with Foundation.

7. Admin presence watch
   - Handle `admin:watch-tenant`.
   - Derive tenant scope from the verified socket context.
   - Join the tenant room.
   - Return the current online computer id snapshot in the ack payload.
   - Emit future `computer:online` and `computer:offline` events to that tenant room.

8. Gateway boundary
   - Expose presence-only gateway methods for MVP.
   - Keep Socket.IO internals private to the realtime module.
   - Require future modules to emit through `realtime.gateway.ts`.
   - Do not create no-op stubs for sessions, usage, policy, assets, or subscriptions before those modules exist.

9. Observability
   - Emit sanitized structured log events for connection, disconnection, heartbeat, auth failures, online, and offline transitions.
   - Expose runtime counters through the realtime service for health integration.
   - Do not add a separate realtime health endpoint unless Foundation health cannot be extended.

### Out Of Scope

- REST heartbeat endpoint.
- `GET /api/realtime/presence` or other realtime REST presence endpoints.
- Prisma table for realtime presence or connection history.
- `Computer.onlineStatus`.
- Redis Socket.IO adapter.
- Redis-backed presence store.
- Session command handlers such as `admin:command:start-session`.
- Usage, URL policy, asset, and subscription event implementations.
- Persistent audit records for socket connect/disconnect history.
- Web Admin UI changes.
- Client PC UI changes.

### Business Rules

- The realtime API is the Socket.IO event contract under `/socket.io`; there is no REST API in MVP.
- All tenant and computer room membership must be derived from verified auth context.
- Admin sockets must not join arbitrary tenant rooms.
- Client sockets must not join arbitrary computer rooms.
- Client PC auth uses device token, not MAC address.
- `INACTIVE` and `BLOCKED` computers cannot connect.
- Online/offline state is volatile runtime state and remains in memory for MVP.
- `Computer.lastSeenAt` is durable and updated from accepted connect/heartbeat activity.
- If the backend restarts, clients reconnect and rebuild presence.
- Multiple sockets for the same computer are allowed.
- `computer:online` is emitted once when the first socket for a computer appears.
- `computer:offline` is emitted once when the final socket disappears or times out.
- Event ack errors must not expose stack traces, token material, Prisma internals, or socket internals.

### User Flows

Client PC connect:

```text
Client PC connects to /socket.io with computerId + deviceToken
-> realtime.auth verifies the computer and token
-> reject if token is invalid or Computer.status is not ACTIVE
-> join computer:<computerId>
-> realtime.presence records the socket
-> if this is the first socket for the computer, mark online
-> update Computer.lastSeenAt
-> realtime.gateway emits computer:online to tenant:<tenantId>
```

Client PC heartbeat:

```text
Client PC emits client:heartbeat with sentAt
-> handler validates payload
-> rate limiter checks bucket by computerId
-> update in-memory lastHeartbeatAt
-> throttle database update for Computer.lastSeenAt
-> return success ack with serverTime
```

Client PC disconnect or heartbeat timeout:

```text
socket disconnects or heartbeat timeout fires
-> remove socket from the computer presence set
-> if no active socket remains, mark offline
-> realtime.gateway emits computer:offline to tenant:<tenantId>
```

Admin watch tenant:

```text
Web Admin connects to /socket.io with JWT access token
-> realtime.auth verifies the access token and tenant context
-> admin emits admin:watch-tenant
-> handler joins tenant:<tenantId>
-> handler returns onlineComputers snapshot
-> admin receives future computer:online and computer:offline events for that tenant
```

## Technical Architecture

### System Type

Realtime is a backend Socket.IO module inside the existing Node.js/Express API. Express route registration remains in `backend/src/app.ts`; Socket.IO is attached to the HTTP server in `backend/src/server.ts`.

Chosen architecture:

- Socket.IO Presence MVP.
- Dedicated `backend/src/modules/realtime` module.
- In-memory presence store for a single backend instance.
- Gateway boundary for event emission and health snapshots.
- One handler file for MVP, with a clear path to split admin/client handlers later.
- Socket event-level validation and rate limiting instead of Express middleware reuse directly.

Alternatives considered:

- REST heartbeat first.
  - Simpler HTTP implementation.
  - Rejected because the backend design requires Socket.IO auth, rooms, heartbeat, online/offline state, and event emission.
- Full socket contract skeleton.
  - Would reserve future event names for sessions, usage, policy, assets, and subscriptions.
  - Rejected because it creates API surface before business modules exist.
- Persistent `onlineStatus`.
  - Easier to query from SQL.
  - Rejected because online/offline is volatile socket state and can become stale after crashes.
- Realtime connection table.
  - Useful for audit/reporting.
  - Deferred until explicit retention and audit requirements exist.

### Existing Stack

- Runtime: Node.js backend.
- HTTP framework: Express.
- Realtime transport: Socket.IO.
- Language: TypeScript.
- Validation: Zod-style validation consistent with the existing backend.
- Database access: Prisma.
- Database: MySQL.
- Auth/RBAC: existing Auth token service and tenant-aware auth context.
- Rate limiting: existing token bucket/store pattern adapted for socket events.
- Error shape: Foundation success/error response model adapted to Socket.IO ack payloads.
- Logging: existing structured logger patterns.
- Tests: Vitest, Supertest for REST regressions, and Socket.IO client integration tests when enabled.

### Request And Socket Pipeline

```text
Web Admin / Client PC
  |
  v
HTTP server created from Express app
  |
  +-- Express app handles REST routes
  |
  +-- Socket.IO server handles /socket.io
        |
        +-- realtime.auth middleware
        |     +-- admin JWT access token verification
        |     +-- computer device-token verification
        |
        +-- realtime.handlers
              +-- admin:watch-tenant
              +-- client:heartbeat
              +-- disconnect
              +-- heartbeat timeout handling
```

### Module Structure

Expected source files:

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

- `realtime.server.ts`: create/configure Socket.IO, attach middleware and handlers, expose close behavior.
- `realtime.auth.ts`: verify admin JWT access tokens and client device tokens.
- `realtime.rooms.ts`: define room names and trusted join helpers.
- `realtime.presence.ts`: track connected sockets, online computers, heartbeat timestamps, timers, and counters.
- `realtime.handlers.ts`: register MVP event handlers and socket lifecycle handling.
- `realtime.gateway.ts`: public emit API and presence/health snapshot access.
- `realtime.events.ts`: event constants, payload types, ack contracts, and error codes.
- `realtime.types.ts`: socket context and shared realtime types.

Future handler split:

```text
backend/src/modules/realtime/handlers/
  admin.handlers.ts
  client.handlers.ts
```

The MVP keeps `realtime.handlers.ts` as a single file until handler growth justifies the split.

## Data Models

Realtime MVP does not add a Prisma table and does not require a migration.

Do not add:

- `Computer.onlineStatus`
- `RealtimePresence`
- `RealtimeConnection`
- `RealtimeConnectionLog`

Reuse existing data:

- `Computer.id`: socket identity for Client PC connections.
- `Computer.tenantId`: trusted tenant context for the computer.
- `Computer.deviceTokenHash`: verifies client socket device tokens.
- `Computer.status`: blocks `INACTIVE` and `BLOCKED` computers from connecting.
- `Computer.lastSeenAt`: stores the latest accepted connect/heartbeat timestamp.

Runtime presence shape:

```typescript
interface RealtimeComputerPresence {
  computerId: string;
  tenantId: string;
  socketIds: Set<string>;
  lastHeartbeatAt: Date;
  lastSeenPersistedAt?: Date;
}
```

Socket auth context:

```typescript
type RealtimeSocketContext =
  | {
      clientType: "admin";
      userId: string;
      tenantId: string;
      role: "shop_admin" | "staff" | string;
    }
  | {
      clientType: "computer";
      computerId: string;
      tenantId: string;
    };
```

### Data Relations

```text
Tenant
  |
  | 1-to-many
  v
Computer

Computer.deviceTokenHash -> verifies submitted deviceToken
Computer.status -> controls whether socket auth is allowed
Computer.lastSeenAt -> durable latest accepted connect/heartbeat timestamp

In-memory presence:
computerId -> tenantId, socketIds, lastHeartbeatAt
```

### Future Data Paths

Scale path:

- Add Redis Socket.IO adapter for multi-instance broadcast.
- Move presence state from process memory to Redis.
- Keep the Socket.IO event contract stable.

Audit path:

- Persist connect/disconnect history through the audit module or a dedicated connection log table only when audit requirements become explicit.

## Socket API Contract

Transport:

```text
Socket.IO endpoint: /socket.io
Namespace: /
Auth location: socket.handshake.auth
```

No REST realtime API is added in MVP.

### Socket Auth: Admin

Handshake auth:

```json
{
  "clientType": "admin",
  "accessToken": "jwt-access-token"
}
```

Rules:

- Verify with `authTokenService.verifyAccessToken`.
- Reject missing, malformed, expired, refresh-token-type, or invalid access tokens.
- Require valid `tenantId` in the token.
- Recommended MVP roles: `shop_admin` and `staff`.
- Derive tenant scope from the verified token only.

Successful socket context:

```json
{
  "clientType": "admin",
  "userId": "user-id",
  "tenantId": "tenant-id",
  "role": "shop_admin"
}
```

Allowed room:

```text
tenant:<tenantId>
```

### Socket Auth: Client PC

Handshake auth:

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
- Hash the submitted `deviceToken` with the Computers helper.
- Compare the submitted hash to `Computer.deviceTokenHash`.
- Reject invalid auth without revealing whether the id or token was wrong.
- Do not authenticate with MAC address.

Successful socket context:

```json
{
  "clientType": "computer",
  "computerId": "computer-id",
  "tenantId": "tenant-id"
}
```

Allowed room:

```text
computer:<computerId>
```

### Event: `admin:watch-tenant`

Direction:

```text
Admin socket -> Backend
```

Payload:

```json
{}
```

Rules:

- Only authenticated admin sockets may emit this event.
- Tenant id is derived from socket context.
- The socket joins `tenant:<tenantId>`.
- The ack returns the current online computer id snapshot for that tenant.

Success ack:

```json
{
  "success": true,
  "data": {
    "onlineComputers": ["computer-id-1", "computer-id-2"]
  }
}
```

Error ack:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Tenant context is required."
  }
}
```

### Event: `client:heartbeat`

Direction:

```text
Client PC socket -> Backend
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
- Accepted heartbeat updates in-memory `lastHeartbeatAt`.
- Accepted heartbeat updates `Computer.lastSeenAt` with throttling.

Success ack:

```json
{
  "success": true,
  "data": {
    "serverTime": "2026-05-25T10:00:00.000Z"
  }
}
```

Rate-limit error ack:

```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many heartbeat events. Please try again later."
  }
}
```

### Event: `computer:online`

Direction:

```text
Backend -> Admin sockets in tenant:<tenantId>
```

Payload:

```json
{
  "computerId": "computer-id",
  "tenantId": "tenant-id",
  "lastSeenAt": "2026-05-25T10:00:00.000Z"
}
```

Emit only when the first active socket for a computer appears.

### Event: `computer:offline`

Direction:

```text
Backend -> Admin sockets in tenant:<tenantId>
```

Payload:

```json
{
  "computerId": "computer-id",
  "tenantId": "tenant-id",
  "lastSeenAt": "2026-05-25T10:00:00.000Z"
}
```

Emit only when the final active socket for a computer disconnects or times out.

## Validation Specification

Handshake auth discriminant:

- `clientType`: required string enum, either `admin` or `computer`.

Admin handshake:

- `accessToken`: required string, non-empty.
- Unknown fields should be ignored for auth decisions and must not be logged raw.

Client PC handshake:

- `computerId`: required UUID/string id compatible with the existing Computer model.
- `deviceToken`: required string, non-empty.
- Unknown fields should be ignored for auth decisions and must not be logged raw.

`admin:watch-tenant` payload:

- Empty object.
- Tenant id from payload is ignored if supplied.
- Unknown fields do not affect tenant scope.

`client:heartbeat` payload:

- `sentAt`: required ISO datetime string.
- Unknown fields are rejected or ignored consistently with existing validation style.

Ack error shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid realtime event payload."
  }
}
```

Allowed error codes:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `TOO_MANY_REQUESTS`
- `INTERNAL_ERROR`

## Authorization And Security

### Role Matrix

| Socket behavior | Unauthenticated | staff | shop_admin | super_admin | Client PC device token |
| --- | --- | --- | --- | --- | --- |
| Connect as admin | Deny | Allow own tenant | Allow own tenant | Deny in MVP unless tenant context exists | Deny |
| `admin:watch-tenant` | Deny | Allow own tenant | Allow own tenant | Deny in MVP unless tenant context exists | Deny |
| Connect as computer | Deny | Deny | Deny | Deny | Allow own computer if ACTIVE |
| `client:heartbeat` | Deny | Deny | Deny | Deny | Allow own computer if authenticated |
| Join arbitrary tenant room | Deny | Deny | Deny | Deny | Deny |
| Join arbitrary computer room | Deny | Deny | Deny | Deny | Deny |

### Required Guards

Socket connection:

- Validate `socket.handshake.auth.clientType`.
- Route auth to admin or computer verifier.
- Attach sanitized socket context after successful verification.
- Reject failed auth with `connect_error`.

Admin events:

- Require admin socket context.
- Require tenant context.
- Join only `tenantRoom(context.tenantId)`.

Client events:

- Require computer socket context.
- Rate-limit heartbeat by `computerId`.
- Update only the authenticated computer's presence.

### Sensitive Data Rules

Never log:

- `deviceToken`
- `deviceTokenHash`
- JWT/access token
- raw `socket.handshake.auth`
- authorization headers
- raw payloads that may contain secrets

Never return:

- `deviceToken`
- `deviceTokenHash`
- JWT/access token
- stack traces
- Prisma internals
- socket internals

Security invariants:

- Cross-tenant event delivery must be impossible through gateway methods and room helpers.
- Event payloads cannot override verified tenant or computer context.
- Invalid client token errors must not disclose whether the computer id exists.
- MAC address is not accepted as socket authentication.

## Rate Limiting And Configuration

Heartbeat rate limit:

```text
key: computerId
capacity: 3
refill: 1 token / 10 seconds
```

Implementation rules:

- Use the existing token bucket/store pattern through a socket event-level adapter.
- Do not use Express request middleware directly for socket events.
- Return `TOO_MANY_REQUESTS` ack when the heartbeat bucket is exhausted.
- Log a sanitized `realtime.client.heartbeat.rate_limited` event.

Recommended constants:

```text
REALTIME_HEARTBEAT_RATE_LIMIT_CAPACITY = 3
REALTIME_HEARTBEAT_RATE_LIMIT_REFILL_TOKENS = 1
REALTIME_HEARTBEAT_RATE_LIMIT_REFILL_WINDOW_SECONDS = 10
REALTIME_HEARTBEAT_TIMEOUT_SECONDS = 90
REALTIME_LAST_SEEN_UPDATE_THROTTLE_SECONDS = 30
```

MVP recommendation:

- Keep these as module constants unless operations needs runtime configurability.
- If env-backed configuration is chosen, add validation through `backend/src/config/env.ts`.

## Gateway Boundary

The MVP gateway exposes presence-only methods:

```typescript
interface RealtimeGateway {
  emitComputerOnline(input: {
    tenantId: string;
    computerId: string;
    lastSeenAt: Date;
  }): void;

  emitComputerOffline(input: {
    tenantId: string;
    computerId: string;
    lastSeenAt: Date;
  }): void;

  getPresenceSnapshotForTenant(tenantId: string): string[];

  getRealtimeHealthSnapshot(): {
    activeSockets: number;
    onlineComputers: number;
    adminSockets: number;
    heartbeatTimeouts: number;
  };
}
```

Future module integrations should add gateway methods only when those business services exist:

```text
sessions.service -> realtimeGateway.sendSessionStartCommand(...)
sessions.service -> realtimeGateway.emitSessionStarted(...)
usage.service -> realtimeGateway.emitUsageUpdated(...)
urlRules.service -> realtimeGateway.sendPolicyUpdate(...)
assets.service -> realtimeGateway.emitAssetUpdated(...)
subscriptions.service -> realtimeGateway.emitSubscriptionUpdated(...)
```

Do not import Socket.IO internals from future business modules.

## Error Behavior

Connection auth failures:

- Reject socket with `connect_error`.
- Log only sanitized context.
- Do not include token material or raw auth payload in logs or error payloads.

Event failures:

- Return ack payloads with Foundation-aligned shape.
- Use stable error codes.
- Log unexpected errors with sanitized identifiers only.

Generic event error:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Realtime event failed."
  }
}
```

Expected errors:

- `UNAUTHORIZED`
  - Missing, malformed, expired, refresh-token-type, or invalid admin token.
  - Invalid client `computerId + deviceToken`.
- `FORBIDDEN`
  - Missing tenant context.
  - Wrong socket client type for the event.
  - Attempted room join outside verified context.
- `VALIDATION_ERROR`
  - Invalid handshake discriminant.
  - Invalid event payload.
- `NOT_FOUND`
  - Computer cannot be authenticated. Response must not reveal whether id or token was wrong.
- `TOO_MANY_REQUESTS`
  - Heartbeat rate limit exceeded.
- `INTERNAL_ERROR`
  - Unexpected runtime error.

## Observability, Health, And Operations

Structured log events:

- `realtime.admin.connected`
- `realtime.admin.disconnected`
- `realtime.client.connected`
- `realtime.client.disconnected`
- `realtime.client.heartbeat`
- `realtime.client.heartbeat.rate_limited`
- `realtime.client.auth.failed`
- `realtime.computer.online`
- `realtime.computer.offline`

Safe log fields:

- `socketId`
- `tenantId`
- `computerId`
- `actorUserId`
- `actorRole`
- `event`
- `reason`
- `connectedSocketCount`
- `lastHeartbeatAt`
- `ip`
- `userAgent`

Useful counters/gauges:

- active socket count
- online computer count
- admin socket count
- heartbeat accepted count
- heartbeat rate-limited count
- auth failure count
- offline timeout count

Suggested health snapshot:

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

Health integration:

- Prefer extending runtime health if available or planned.
- Do not add a separate realtime health endpoint in MVP unless Foundation health cannot be extended.

Operations:

- Single-instance deployment can use in-memory presence.
- Multi-instance deployment requires Redis Socket.IO adapter and Redis-backed presence.
- Shutdown must clear heartbeat timers and close Socket.IO.
- Reconnect behavior is client-driven; the server rebuilds presence after reconnect.
- Prisma CLI, migrations, database setup, server commands, and DB commands are user/team-run actions.

## System Maps

### Architecture Diagram

```text
Web Admin / Client PC
  |
  v
HTTP server
  |
  +-- Express app
  |     +-- REST modules
  |
  +-- Socket.IO /socket.io
        |
        +-- realtime.auth
        |     +-- admin JWT verification
        |     +-- computer device-token verification
        |
        +-- realtime.handlers
        |     +-- admin:watch-tenant
        |     +-- client:heartbeat
        |     +-- disconnect / timeout
        |
        +-- realtime.presence
        |
        +-- realtime.gateway
              +-- emit computer:online/offline to tenant rooms
              +-- expose presence and health snapshots
```

### Room And Event Map

```text
Admin socket
  -> verified tenantId
  -> tenant:<tenantId>
  <- computer:online
  <- computer:offline

Client PC socket
  -> verified computerId + tenantId
  -> computer:<computerId>
  -> client:heartbeat
```

### Presence State Map

```text
computerId
  |
  +-- tenantId
  +-- socketIds[]
  +-- lastHeartbeatAt
  +-- lastSeenPersistedAt

online transition:
socketIds count 0 -> 1

offline transition:
socketIds count 1 -> 0
```

### Startup And Shutdown Flow

```text
Startup:
create HTTP server from Express app
-> initialize realtime server with HTTP server
-> register Socket.IO auth middleware
-> register realtime handlers
-> HTTP server listen

Shutdown:
receive SIGINT/SIGTERM
-> stop accepting HTTP connections
-> close Socket.IO server
-> clear heartbeat/offline timers
-> disconnect Prisma
-> flush logger
-> exit
```

## File Structure

Expected source files:

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

Expected tests:

```text
backend/tests/realtime/
  realtime.rooms.test.ts
  realtime.auth.test.ts
  realtime.presence.test.ts
  realtime.gateway.test.ts
  realtime.socket.test.ts
```

Expected app/server wiring:

```text
backend/src/server.ts
  create HTTP server from app
  attach realtime server
  listen on HTTP server
  close realtime server during shutdown

backend/src/app.ts
  keep Express REST route registration here
```

Expected docs:

```text
docs/module/realtime/2026-05-25-realtime-module-design.md
docs/SPEC/realtime/SPEC.md
docs/SPEC/realtime/CLAUDE.md
docs/plans/2026-05-25-realtime-module-implementation-plan.md
```

## Dependencies

### Production Dependencies

Add:

```json
{
  "dependencies": {
    "socket.io": "^4"
  }
}
```

Existing dependencies to reuse:

- `express`: existing HTTP app.
- `cors`: CORS origin source should remain aligned with existing app config.
- `jose`: existing JWT/token verification stack if used by Auth services.
- `@prisma/client`: read/update Computer data.
- `pino`: structured logging.
- `zod`: event payload validation.

### Development Dependencies

Conditional for socket integration tests:

```json
{
  "devDependencies": {
    "socket.io-client": "^4"
  }
}
```

Existing dev dependencies to reuse:

- `vitest`
- `typescript`
- `tsx`

## Environment Variables

MVP may use module constants for realtime tuning. If runtime configurability is required, add these env variables through `backend/src/config/env.ts`.

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `REALTIME_HEARTBEAT_RATE_LIMIT_CAPACITY` | Heartbeat token bucket capacity | No | `3` |
| `REALTIME_HEARTBEAT_RATE_LIMIT_REFILL_TOKENS` | Refill token count | No | `1` |
| `REALTIME_HEARTBEAT_RATE_LIMIT_REFILL_WINDOW_SECONDS` | Refill window in seconds | No | `10` |
| `REALTIME_HEARTBEAT_TIMEOUT_SECONDS` | Offline timeout threshold | No | `90` |
| `REALTIME_LAST_SEEN_UPDATE_THROTTLE_SECONDS` | Minimum interval between `lastSeenAt` writes per computer | No | `30` |

Socket.IO CORS should reuse the existing app CORS origin configuration, not introduce a separate CORS source unless operations explicitly requires it.

## Development Phases

- [ ] Phase 1: Dependency and server lifecycle
  - Add `socket.io` runtime dependency.
  - Update `backend/src/server.ts` to create an HTTP server from the Express app.
  - Attach Socket.IO through `realtime.server.ts`.
  - Add graceful shutdown behavior for Socket.IO and realtime timers.

- [ ] Phase 2: Realtime module scaffold
  - Create `backend/src/modules/realtime` files.
  - Define event constants, ack types, socket context types, and room helpers.
  - Add baseline unit tests for room helpers and event constants.

- [ ] Phase 3: Socket authentication
  - Implement admin JWT socket auth.
  - Implement Client PC `computerId + deviceToken` socket auth.
  - Reject inactive/blocked computers.
  - Add unit tests for valid and invalid auth cases.

- [ ] Phase 4: Presence service and gateway
  - Implement in-memory presence tracking.
  - Implement first-socket online and last-socket offline transitions.
  - Implement `emitComputerOnline`, `emitComputerOffline`, `getPresenceSnapshotForTenant`, and `getRealtimeHealthSnapshot`.
  - Add unit tests for multi-socket behavior and health snapshots.

- [ ] Phase 5: Event handlers
  - Implement `admin:watch-tenant`.
  - Implement `client:heartbeat`.
  - Add heartbeat validation, event-level rate limiting, and throttled `Computer.lastSeenAt` updates.
  - Add ack/error mapping tests.

- [ ] Phase 6: Logging, security, and operations
  - Add structured sanitized log events.
  - Ensure no raw auth payloads, tokens, token hashes, or JWTs are logged.
  - Expose health counters for runtime health integration.
  - Document single-instance and future multi-instance behavior.

- [ ] Phase 7: Socket integration and regression tests
  - Add Socket.IO integration tests if `socket.io-client` is included.
  - Verify admin watch, client connect, heartbeat, disconnect/offline, invalid auth, rate limiting, and tenant isolation.
  - Run relevant typecheck and test commands manually according to project rules.

## Testing Requirements

Unit tests:

- Room helper returns `tenant:<tenantId>` and `computer:<computerId>`.
- Admin auth accepts a valid access token.
- Admin auth rejects invalid, expired, malformed, and wrong-token-type tokens.
- Admin auth rejects missing tenant context.
- Client auth accepts valid `computerId + deviceToken`.
- Client auth rejects invalid tokens without leaking whether id or token was wrong.
- Client auth rejects `INACTIVE` and `BLOCKED` computers.
- Presence service marks a computer online on first socket.
- Presence service does not duplicate online events for multiple sockets.
- Presence service emits offline only after the last socket disappears.
- Heartbeat rate limiter keys by `computerId`.
- Ack/error mapper never exposes token material.
- Realtime health snapshot returns sanitized counts.

Socket integration tests:

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

Manual verification:

- User/team runs install, server, DB, Prisma, test, and typecheck commands manually according to project rules.
- Verify a test admin socket receives `computer:online` after a test client connects.
- Verify the same admin socket receives `computer:offline` after the client disconnects or times out.
- Verify `GET /api/computers` still provides `lastSeenAt` for initial admin list views.

## Acceptance Checklist

- [ ] Socket.IO is attached to the backend HTTP server.
- [ ] Socket.IO CORS reuses existing app CORS origin configuration.
- [ ] Admin sockets authenticate with JWT access tokens.
- [ ] Admin sockets join only `tenant:<tenantId>` from verified context.
- [ ] Client sockets authenticate with `computerId + deviceToken`.
- [ ] Client sockets join only `computer:<computerId>` from verified context.
- [ ] `INACTIVE` and `BLOCKED` computers cannot connect.
- [ ] `admin:watch-tenant` returns tenant-scoped `onlineComputers`.
- [ ] `client:heartbeat` validates payload and returns `serverTime`.
- [ ] Heartbeat is rate-limited by `computerId`.
- [ ] Accepted heartbeat updates in-memory presence.
- [ ] Accepted heartbeat updates `Computer.lastSeenAt` with throttling.
- [ ] `computer:online` emits only on first socket for a computer.
- [ ] `computer:offline` emits only after the last socket disappears or times out.
- [ ] Presence snapshot and emitted events are tenant-scoped.
- [ ] Cross-tenant event leakage is prevented by design and tests.
- [ ] No realtime-specific Prisma table is added in MVP.
- [ ] No `Computer.onlineStatus` field is added in MVP.
- [ ] No REST realtime presence endpoint is added in MVP.
- [ ] Logs and errors never expose tokens, token hashes, JWTs, or raw auth payloads.
- [ ] Realtime gateway exposes only presence and health methods in MVP.

## Open Questions

- Should `socket.io-client` be added as a required dev dependency immediately, or only when socket integration tests are implemented?
- Should realtime tuning values remain module constants for MVP, or become env-backed configuration in `backend/src/config/env.ts`?
- Should `super_admin` be explicitly denied for admin sockets in MVP, or allowed only when a valid tenant context exists?
- Which existing health endpoint or health service should receive `getRealtimeHealthSnapshot()` if Foundation health is available?
- Should raw unknown fields in socket event payloads be rejected strictly or ignored after validated fields are extracted?

## References

- Source design: `docs/module/realtime/2026-05-25-realtime-module-design.md`
- Backend-wide design: `docs/backend/2026-05-17-cloudcms-backend-design.md`
- Computers SPEC: `docs/SPEC/computers/SPEC.md`
- Realtime implementation plan: `docs/plans/2026-05-25-realtime-module-implementation-plan.md`
