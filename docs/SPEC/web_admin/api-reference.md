# CloudCMS Web Admin API Reference

Date: 2026-05-27

Primary spec: `SPEC.md`

This file is a lookup supplement for REST endpoints, Socket.IO events, and frontend data models used by the Web Admin MVP.

## Response Shape

Backend REST endpoints use the Foundation response contract.

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {}
  }
}
```

Frontend handling rules:

- Branch on HTTP status first for auth/session behavior.
- Use `error.code` for user-facing state and retry decisions.
- Do not display backend stack traces or raw internal details.

## Auth REST Endpoints

### `POST /api/auth/login`

Purpose:

- Authenticate admin user with email/password.
- Return access token and refresh token according to backend auth contract.

Request:

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

Expected frontend behavior:

- Show field-level validation before submit where possible.
- Disable submit while loading.
- On success, store access token in memory.
- Persist refresh token only if the environment's auth policy confirms it.
- Call `GET /api/auth/me` after login if current user/tenant context is not fully available from login response.

Common errors:

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `429 TOO_MANY_REQUESTS`

### `GET /api/auth/me`

Purpose:

- Bootstrap current user and tenant context.

Headers:

```text
Authorization: Bearer <accessToken>
```

Frontend uses:

- User menu display.
- Tenant name/code in sidebar.
- Authenticated app readiness.
- Permission checks for MVP route access.

Common errors:

- `401 UNAUTHORIZED`: clear session and redirect to `/login`.
- `403 FORBIDDEN`: show forbidden state.

### `POST /api/auth/refresh`

Purpose:

- Refresh access token if refresh-token persistence is enabled.

Frontend behavior:

- Use only if backend refresh flow is available in the local/prod environment.
- On refresh failure, clear session and redirect to `/login`.

### `POST /api/auth/logout`

Purpose:

- Revoke/clear refresh token server-side where supported.

Frontend behavior:

- Attempt logout request when possible.
- Always clear local auth state and disconnect socket after logout action.

## Computers REST Endpoints

### `GET /api/computers`

Purpose:

- Fetch tenant-scoped computers for dashboard and computers list.

Headers:

```text
Authorization: Bearer <accessToken>
```

Query:

```text
?page=1&pageSize=20&status=ACTIVE&q=pc&sort=createdAt:desc
```

Supported query fields:

- `page`: integer, default `1`.
- `pageSize`: integer, default `20`, max `100`.
- `status`: `ACTIVE`, `INACTIVE`, or `BLOCKED`.
- `q`: search text for name/MAC address.
- `sort`: backend allowlist such as `createdAt:desc`, `createdAt:asc`, `name:asc`, `name:desc`.

Response data:

```json
{
  "items": [
    {
      "id": "computer-id",
      "tenantId": "tenant-id",
      "name": "PC-01",
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "status": "ACTIVE",
      "lastSeenAt": "2026-05-25T10:00:00.000Z",
      "notes": "Near cashier",
      "createdAt": "2026-05-23T00:00:00.000Z",
      "updatedAt": "2026-05-23T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

Frontend behavior:

- Use for initial dashboard/list load.
- Use for manual refresh.
- Use once after realtime reconnect to resync.
- Do not refetch this endpoint for every `computer:online` or `computer:offline` event.

### `GET /api/computers/:id`

Purpose:

- Fetch one tenant-scoped computer for detail view.

Response data:

```json
{
  "computer": {
    "id": "computer-id",
    "tenantId": "tenant-id",
    "name": "PC-01",
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "status": "ACTIVE",
    "lastSeenAt": "2026-05-25T10:00:00.000Z",
    "notes": "Near cashier",
    "createdAt": "2026-05-23T00:00:00.000Z",
    "updatedAt": "2026-05-23T00:00:00.000Z"
  }
}
```

Frontend behavior:

- Use when opening detail if the list row is stale or incomplete.
- On `404`, show missing/not-found state inside the detail surface.

### `PATCH /api/computers/:id`

Purpose:

- Update admin-editable computer fields.

Request accepts only:

```json
{
  "name": "PC-01 Front Desk",
  "status": "ACTIVE",
  "notes": "Near cashier"
}
```

Allowed statuses:

- `ACTIVE`
- `INACTIVE`
- `BLOCKED`

Frontend behavior:

- Do not send `tenantId`, `macAddress`, `deviceToken`, `deviceTokenHash`, `lastSeenAt`, `createdAt`, or `updatedAt`.
- Disable submit while loading.
- If optimistic update is used, snapshot previous state and rollback on error.
- Replace cached computer on success.

Common errors:

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `404 NOT_FOUND`
- `429 TOO_MANY_REQUESTS`

### `POST /api/computers/:id/reissue-token`

Purpose:

- Rotate the stored device token hash and return a new plain device token once.

Request:

```json
{
  "reason": "Client PC was reinstalled"
}
```

Response data:

```json
{
  "computer": {
    "id": "computer-id",
    "tenantId": "tenant-id",
    "name": "PC-01",
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "status": "ACTIVE",
    "lastSeenAt": "2026-05-25T10:00:00.000Z",
    "notes": null,
    "createdAt": "2026-05-23T00:00:00.000Z",
    "updatedAt": "2026-05-23T00:00:00.000Z"
  },
  "deviceToken": "new-plain-device-token-returned-once"
}
```

Frontend behavior:

- Require explicit confirmation before request.
- Display returned `deviceToken` once.
- Provide copy action.
- Clear `deviceToken` from component state when modal/sheet closes.
- Do not put the plain token in query cache, localStorage, sessionStorage, logs, telemetry, URL params, or persistent app state.

## Socket.IO Contract

Transport:

```text
Endpoint: /socket.io
Namespace: /
Auth location: socket.handshake.auth
```

### Admin Socket Handshake

Auth payload:

```json
{
  "clientType": "admin",
  "accessToken": "jwt-access-token"
}
```

Frontend behavior:

- Connect only after access token exists.
- Disconnect on logout or `401`.
- Recreate/reconnect socket when access token changes.
- Do not log the auth payload.

### `admin:watch-tenant`

Direction:

```text
Frontend -> Backend
```

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

Frontend behavior:

- Emit after socket `connect`.
- Emit again after reconnect.
- Convert `onlineComputers` to `presenceByComputerId`.
- Treat this snapshot as volatile runtime presence.

### `computer:online`

Direction:

```text
Backend -> Frontend
```

Payload:

```json
{
  "computerId": "computer-id",
  "tenantId": "tenant-id",
  "lastSeenAt": "2026-05-25T10:00:00.000Z"
}
```

Frontend behavior:

- Update `presenceByComputerId[computerId]` to online.
- Add a bounded event-feed item.
- Update visible last-seen display if payload timestamp is newer.
- Do not refetch the full list solely because of this event.

### `computer:offline`

Direction:

```text
Backend -> Frontend
```

Payload:

```json
{
  "computerId": "computer-id",
  "tenantId": "tenant-id",
  "lastSeenAt": "2026-05-25T10:00:00.000Z"
}
```

Frontend behavior:

- Update `presenceByComputerId[computerId]` to offline.
- Add a bounded event-feed item.
- Preserve REST computer data.
- Do not mark unrelated computers offline.

## Frontend Types

```typescript
export type ComputerStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

export interface Computer {
  id: string;
  tenantId: string;
  name: string | null;
  macAddress: string;
  status: ComputerStatus;
  lastSeenAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComputersListResponse {
  items: Computer[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface Presence {
  online: boolean;
  lastSeenAt: string | null;
  source: "snapshot" | "socket-event" | "rest";
  receivedAt: string;
}

export interface RealtimeEventFeedItem {
  id: string;
  type: "online" | "offline";
  computerId: string;
  occurredAt: string;
}
```

## Security Notes

- Do not store plain device tokens after reissue modal closes.
- Do not log access tokens, refresh tokens, device tokens, Socket.IO auth payloads, or authorization headers.
- Do not allow UI inputs to send backend-forbidden fields.
- Treat MAC address as an identifier, not a secret.
- Keep tenant scope from backend auth; never accept user-entered tenant IDs for API calls.
