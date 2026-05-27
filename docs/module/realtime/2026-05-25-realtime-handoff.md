# CloudCMS Realtime Handoff Notes (MVP)

Date: 2026-05-25
Source: `docs/module/realtime/2026-05-25-realtime-module-design.md`, `docs/SPEC/realtime/SPEC.md`

## 1) Socket Contracts

### 1.1 Admin handshake contract

Admin socket connects to `/socket.io` with:

```json
{
  "clientType": "admin",
  "accessToken": "jwt-access-token"
}
```

Rules:
- Token must be a valid access token.
- Tenant context is required in claims.
- Allowed roles for realtime MVP: `shop_admin`, `staff`.
- `super_admin` is denied for realtime MVP.

### 1.2 Client PC handshake contract

Client PC socket connects to `/socket.io` with:

```json
{
  "clientType": "computer",
  "computerId": "computer-id",
  "deviceToken": "plain-device-token"
}
```

Rules:
- Computer must exist and be `ACTIVE`.
- Submitted `deviceToken` is hashed and compared to `Computer.deviceTokenHash`.
- Auth errors are generic and do not reveal whether id or token was wrong.

### 1.3 `admin:watch-tenant`

Payload:

```json
{}
```

Success ack:

```json
{
  "success": true,
  "data": {
    "onlineComputers": ["computer-id-1", "computer-id-2"]
  }
}
```

Error ack example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid admin:watch-tenant payload. Expected empty object."
  }
}
```

### 1.4 `client:heartbeat`

Payload:

```json
{
  "sentAt": "2026-05-25T10:00:00.000Z"
}
```

Success ack:

```json
{
  "success": true,
  "data": {
    "serverTime": "2026-05-25T10:00:00.000Z"
  }
}
```

Validation error ack example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid client:heartbeat payload. Expected { sentAt: ISO datetime }."
  }
}
```

Rate-limit ack example:

```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many heartbeat events. Please try again later."
  }
}
```

### 1.5 Presence events to tenant admin room

`computer:online` payload:

```json
{
  "computerId": "computer-id",
  "tenantId": "tenant-id",
  "lastSeenAt": "2026-05-25T10:00:00.000Z"
}
```

`computer:offline` payload:

```json
{
  "computerId": "computer-id",
  "tenantId": "tenant-id",
  "lastSeenAt": "2026-05-25T10:00:00.000Z"
}
```

## 2) MVP Boundaries

- Realtime MVP has no REST realtime endpoint (`/api/realtime/*` is not added).
- Realtime MVP has no Prisma realtime table.
- Realtime MVP does not add `Computer.onlineStatus`.
- Realtime MVP does not persist connection history/audit logs for socket presence.
- Durable field updated by realtime is `Computer.lastSeenAt`.
- Online/offline presence is volatile in-memory state and resets on backend restart; clients must reconnect.

## 3) Operational Constants

- `REALTIME_HEARTBEAT_TIMEOUT_SECONDS = 90`
- `REALTIME_HEARTBEAT_RATE_LIMIT_CAPACITY = 3`
- `REALTIME_HEARTBEAT_RATE_LIMIT_REFILL_TOKENS = 1`
- `REALTIME_HEARTBEAT_RATE_LIMIT_REFILL_WINDOW_SECONDS = 10`
- `REALTIME_LAST_SEEN_UPDATE_THROTTLE_SECONDS = 30`

## 4) Runtime Health Counters

`/api/health/runtime` may include:

```json
{
  "realtime": {
    "activeSockets": 0,
    "onlineComputers": 0,
    "adminSockets": 0,
    "heartbeatAccepted": 0,
    "heartbeatRateLimited": 0,
    "authFailures": 0,
    "heartbeatTimeouts": 0
  }
}
```

All counters are sanitized non-negative integers.

## 5) Safe Logging Policy

Do not log:
- `accessToken`
- `deviceToken`
- `deviceTokenHash`
- authorization headers
- raw handshake auth
- raw headers
- raw payloads

Expected realtime log events:
- `realtime.admin.connected`
- `realtime.admin.disconnected`
- `realtime.client.connected`
- `realtime.client.disconnected`
- `realtime.client.heartbeat`
- `realtime.client.heartbeat.rate_limited`
- `realtime.admin.auth.failed`
- `realtime.client.auth.failed`
- `realtime.computer.online`
- `realtime.computer.offline`

## 6) Web Admin Handoff

Web Admin flow:
1. Connect to `/socket.io` with `clientType: "admin"` + access token.
2. Emit `admin:watch-tenant` with `{}` once connected.
3. Render returned `onlineComputers` snapshot as initial state.
4. Subscribe to `computer:online` and `computer:offline` to apply incremental updates.

Web Admin error handling:
- On `connect_error`, treat as auth/connect failure and prompt re-auth/retry.
- On ack `VALIDATION_ERROR` or `FORBIDDEN`, do not retry blindly; treat as client contract issue.

## 7) Client PC Handoff

Client PC flow:
1. Connect to `/socket.io` with `clientType: "computer"`, `computerId`, `deviceToken`.
2. Send `client:heartbeat` at regular cadence (recommended interval < 90 seconds).
3. Handle heartbeat ack success and maintain connection.
4. On `TOO_MANY_REQUESTS`, back off and reduce heartbeat frequency.
5. On disconnect or `connect_error`, retry with reconnect policy and same credentials.

Client PC error handling:
- `connect_error`: treat as auth/config issue (wrong token, inactive/blocked computer, bad payload).
- Validation ack error: payload is invalid and must be fixed by client implementation.

## 8) Deferred Future Decisions

- Redis topology for multi-instance Socket.IO and shared presence.
- Audit persistence policy for connection history (if/when required).
- Future realtime gateway methods for sessions/usage/policy/assets/subscriptions.
- Env-backed tuning for realtime constants if operations needs runtime configurability.

