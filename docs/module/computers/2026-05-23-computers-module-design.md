# CloudCMS Computers Module Design

Date: 2026-05-23
Status: Approved

## 1. Overview

The `computers` module manages client PC identity after Auth and Tenants have established tenant ownership. It lets a client PC register itself with a tenant code, a tenant registration secret, and a MAC address. After successful registration, the backend issues a device token that later modules can use for realtime heartbeat, socket authentication, sessions, and usage sync.

This design is based on:

- Backend-wide design: `docs/backend/2026-05-17-cloudcms-backend-design.md`
- Existing module design style: `docs/module/tenants/2026-05-20-tenants-design.md`
- Existing module design style: `docs/module/users/2026-05-22-users-mvp-design.md`
- Approved Computers brainstorming decisions from the current design session

Computers owns:

- Client PC registration under a tenant.
- Device token issuance and reissue.
- Tenant-scoped computer list, detail, and profile update.
- Computer status management for MVP operations.

Computers does not own:

- Public tenant registration.
- Staff/admin user management.
- Socket.IO connection handling or heartbeat processing.
- Session start/end behavior.
- Usage log ingestion or summary reporting.
- URL rules, assets, subscriptions, or full audit persistence.

## 2. MVP Scope

All MVP endpoints are mounted under:

```text
/api/computers
```

Endpoints:

```text
POST  /api/computers/register
GET   /api/computers
GET   /api/computers/:id
PATCH /api/computers/:id
POST  /api/computers/:id/reissue-token
```

`POST /api/computers/register` is a public client endpoint protected by tenant registration secret and rate limiting.

Admin endpoints require a valid access token, `shop_admin` role, and tenant context.

Deferred:

- One-time invite codes.
- Admin pre-created claim tokens.
- Computer grouping.
- Realtime heartbeat endpoint/socket behavior.
- Device token refresh endpoint for clients.
- Dedicated audit table for all computer events.

## 3. Data Model

The MVP introduces a `Computer` Prisma model.

```text
Computer
- id
- tenantId
- name
- macAddress
- deviceTokenHash
- status
- lastSeenAt
- notes
- createdAt
- updatedAt
```

Rules:

- `Computer.tenantId` is required and references `Tenant.id`.
- `(tenantId, macAddress)` is unique.
- `macAddress` is treated as device metadata, not a secret.
- `deviceTokenHash` stores only a hash of the device token.
- The plain device token is returned only once after registration or reissue.
- `status` supports `ACTIVE`, `INACTIVE`, and `BLOCKED`.
- `lastSeenAt` is updated by later realtime/heartbeat work, not by admin update in this MVP.

Recommended indexes:

```text
unique (tenantId, macAddress)
index  (tenantId, createdAt)
index  (tenantId, status)
```

Optional future table:

```text
ComputerTokenRotation
- id
- computerId
- rotatedBy
- reason
- rotatedAt
```

The MVP can log token reissue events without adding this table if audit persistence is not yet implemented.

## 4. API Contract

### Register Computer

```text
POST /api/computers/register
```

Public endpoint. Does not require admin JWT.

Request body:

```json
{
  "tenantCode": "CYBER01",
  "registrationSecret": "tenant-registration-secret",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "name": "PC-01"
}
```

Backend-controlled fields:

```text
tenantId = resolved from tenantCode
deviceTokenHash = hash(generatedDeviceToken)
status = ACTIVE
```

Success response:

```json
{
  "success": true,
  "data": {
    "computer": {
      "id": "computer-id",
      "tenantId": "tenant-id",
      "name": "PC-01",
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "status": "ACTIVE",
      "lastSeenAt": null,
      "notes": null,
      "createdAt": "2026-05-23T00:00:00.000Z",
      "updatedAt": "2026-05-23T00:00:00.000Z"
    },
    "deviceToken": "plain-device-token-returned-once"
  }
}
```

Failure responses:

- `400 VALIDATION_ERROR`: invalid payload.
- `401 UNAUTHORIZED`: invalid tenant registration secret.
- `404 NOT_FOUND`: tenant code does not exist or tenant is not active.
- `409 CONFLICT`: a computer with the same MAC address already exists in the tenant.
- `429 TOO_MANY_REQUESTS`: register rate limit exceeded.

### List Computers

```text
GET /api/computers?page=1&pageSize=20&status=ACTIVE&q=pc
```

Requires `shop_admin`.

Query parameters:

- `page`: default `1`, minimum `1`.
- `pageSize`: default `20`, minimum `1`, maximum `100`.
- `status`: optional `ACTIVE`, `INACTIVE`, or `BLOCKED`.
- `q`: optional search over `name` and `macAddress`, trimmed, maximum `100`.
- `sort`: optional, allowlisted values such as `createdAt:desc`, `createdAt:asc`, `name:asc`, `name:desc`.

Success response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "computer-id",
        "tenantId": "tenant-id",
        "name": "PC-01",
        "macAddress": "AA:BB:CC:DD:EE:FF",
        "status": "ACTIVE",
        "lastSeenAt": null,
        "notes": null,
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
}
```

### Computer Detail

```text
GET /api/computers/:id
```

Requires `shop_admin`.

Success response:

```json
{
  "success": true,
  "data": {
    "computer": {
      "id": "computer-id",
      "tenantId": "tenant-id",
      "name": "PC-01",
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "status": "ACTIVE",
      "lastSeenAt": null,
      "notes": null,
      "createdAt": "2026-05-23T00:00:00.000Z",
      "updatedAt": "2026-05-23T00:00:00.000Z"
    }
  }
}
```

### Update Computer

```text
PATCH /api/computers/:id
```

Requires `shop_admin`.

Request body accepts only:

```json
{
  "name": "PC-01 Front Desk",
  "status": "ACTIVE",
  "notes": "Near cashier"
}
```

Success response:

```json
{
  "success": true,
  "data": {
    "computer": {
      "id": "computer-id",
      "tenantId": "tenant-id",
      "name": "PC-01 Front Desk",
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "status": "ACTIVE",
      "lastSeenAt": null,
      "notes": "Near cashier",
      "createdAt": "2026-05-23T00:00:00.000Z",
      "updatedAt": "2026-05-23T00:00:00.000Z"
    }
  }
}
```

### Reissue Device Token

```text
POST /api/computers/:id/reissue-token
```

Requires `shop_admin`.

Request body:

```json
{
  "reason": "Client PC was reinstalled"
}
```

Success response:

```json
{
  "success": true,
  "data": {
    "computer": {
      "id": "computer-id",
      "tenantId": "tenant-id",
      "name": "PC-01",
      "macAddress": "AA:BB:CC:DD:EE:FF",
      "status": "ACTIVE",
      "lastSeenAt": null,
      "notes": null,
      "createdAt": "2026-05-23T00:00:00.000Z",
      "updatedAt": "2026-05-23T00:00:00.000Z"
    },
    "deviceToken": "new-plain-device-token-returned-once"
  }
}
```

## 5. Validation

Register body:

- `tenantCode`: required string, trimmed, uppercase-normalized, maximum `50`.
- `registrationSecret`: required string, minimum `8`, maximum `200`.
- `macAddress`: required string, normalized to uppercase canonical MAC format.
- `name`: optional string, trimmed, maximum `100`.

List query:

- `page`: default `1`, integer, minimum `1`.
- `pageSize`: default `20`, integer, minimum `1`, maximum `100`.
- `status`: optional enum `ACTIVE`, `INACTIVE`, `BLOCKED`.
- `q`: optional string, trimmed, maximum `100`.
- `sort`: optional allowlist only.

Params:

- `id`: required UUID.

Patch body:

- At least one allowed field is required.
- Allowed fields: `name`, `status`, `notes`.
- `name`: optional string or null, trimmed, maximum `100`.
- `status`: optional enum `ACTIVE`, `INACTIVE`, `BLOCKED`.
- `notes`: optional string or null, trimmed, maximum `500`.

Reissue body:

- `reason`: optional string, trimmed, maximum `200`.

Rejected fields:

- `tenantId`
- `macAddress` in patch
- `deviceToken`
- `deviceTokenHash`
- `lastSeenAt`
- `createdAt`
- `updatedAt`
- any unknown property

## 6. DTOs

Computer response:

```text
ComputerResponse
- id
- tenantId
- name
- macAddress
- status
- lastSeenAt
- notes
- createdAt
- updatedAt
```

List response:

```text
ComputerListResponse
- items: ComputerResponse[]
- pagination
```

Register and reissue response:

```text
ComputerTokenResponse
- computer: ComputerResponse
- deviceToken
```

Never return:

- `deviceTokenHash`
- internal token rotation metadata
- tenant registration secret or secret hash
- raw authorization headers

## 7. Authorization And Tenant Isolation

`POST /api/computers/register` is public but protected by:

- tenant code lookup
- tenant registration secret verification
- active tenant requirement
- rate limiting

Admin endpoints require:

```text
shop_admin
```

Denied in MVP:

```text
staff
super_admin
unauthenticated users
clients authenticated only by device token
```

The backend must derive tenant ownership from:

```text
request.authContext.tenantId
```

The client must not be allowed to provide or override `tenantId`.

All admin queries and mutations must scope by:

```text
tenantId = authContext.tenantId
```

This prevents a `shop_admin` from reading, updating, or reissuing tokens for computers from another tenant.

## 8. Business Rules And Logic Flow

### Register

1. Validate body.
2. Normalize `tenantCode` and `macAddress`.
3. Resolve active tenant by `tenantCode`.
4. Verify `registrationSecret` against the tenant registration secret hash.
5. Check for existing computer by `(tenantId, macAddress)`.
6. If it exists, return `409 CONFLICT`.
7. Generate a new device token.
8. Hash the device token.
9. Create the computer with `status = ACTIVE`.
10. Return the sanitized computer DTO and plain device token once.

### List

1. Require admin JWT and `shop_admin`.
2. Require tenant context.
3. Validate query.
4. Apply tenant scope, filters, search, sort, and pagination.
5. Return sanitized DTOs and pagination metadata.

### Detail

1. Require admin JWT and `shop_admin`.
2. Validate `id`.
3. Query by `id` and `tenantId`.
4. Return `404 NOT_FOUND` if no scoped record exists.
5. Return sanitized DTO.

### Update

1. Require admin JWT and `shop_admin`.
2. Validate `id` and patch body.
3. Reject unknown or sensitive fields.
4. Update by `id` and `tenantId`.
5. Return `404 NOT_FOUND` if no scoped record exists.
6. Return sanitized DTO.

### Reissue Token

1. Require admin JWT and `shop_admin`.
2. Validate `id` and optional `reason`.
3. Query by `id` and `tenantId`.
4. Generate a new device token.
5. Replace `deviceTokenHash`.
6. Log `computer.token.reissued`.
7. Return the sanitized computer DTO and plain device token once.

## 9. Error Handling

- `400 VALIDATION_ERROR`: invalid body/query/params, unknown field, empty patch, or invalid enum.
- `401 UNAUTHORIZED`: missing/invalid/expired admin token for admin endpoints, or invalid registration secret for register.
- `403 FORBIDDEN`: caller is not `shop_admin`, tenant context is missing, or tenant is inactive for admin operations.
- `404 NOT_FOUND`: tenant code does not resolve to an active tenant during register, or computer does not exist inside caller tenant scope.
- `409 CONFLICT`: duplicate `(tenantId, macAddress)` register attempt.
- `429 TOO_MANY_REQUESTS`: register rate limit exceeded.
- `500 INTERNAL_ERROR`: unexpected runtime error; response must not expose token, secret, hash, stack, or Prisma internals.

The error response must follow the shared Foundation shape:

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

## 10. Observability, Health And Operations

Structured log events:

- `computer.registered`
- `computer.register.failed`
- `computer.register.conflict`
- `computer.listed`
- `computer.viewed`
- `computer.updated`
- `computer.token.reissued`

Useful log fields:

- `requestId`
- `tenantId`
- `computerId`
- `actorId`
- `role`
- `ip`
- `userAgent`
- `event`

Never log:

- `registrationSecret`
- plain `deviceToken`
- `deviceTokenHash`
- `Authorization` header
- raw request body for register/reissue

Health:

- Existing health endpoints remain responsible for app and DB health.
- No computers-specific health endpoint is required in MVP.
- Device heartbeat health belongs to the later realtime module.

Operations:

- Apply a stricter rate limit to `POST /api/computers/register` than normal admin reads.
- Monitor repeated register failures by IP and tenant code.
- Runbook for lost token or reinstalled client: admin uses reissue token, client stores new token, old token hash is replaced.
- Admin support must treat MAC address as an identifier, not proof of device ownership.

## 11. Testing And Acceptance

Unit tests:

- Register schema accepts valid payload and rejects missing required fields.
- List query schema normalizes defaults and rejects crafted query keys.
- Patch schema rejects unknown and sensitive fields.
- Mapper never returns `deviceTokenHash`.
- `TenantSecretStrategy` accepts a correct secret and rejects an incorrect secret.

Service tests:

- Register success creates a computer and returns a plain device token once.
- Register with duplicate `(tenantId, macAddress)` returns `409 CONFLICT`.
- Register rejects inactive or missing tenant.
- List/detail/update are always scoped by `tenantId`.
- Update rejects sensitive fields.
- Reissue token replaces the stored hash and returns a new plain token once.

API tests:

- Missing admin token is rejected on admin endpoints.
- `shop_admin` can list/detail/update/reissue only inside their tenant.
- `staff` and `super_admin` are forbidden in MVP.
- Register validates payload and rate limit behavior.
- Tenant isolation prevents cross-tenant detail, patch, and reissue.
- Error responses use the shared Foundation error shape.

Acceptance criteria:

- `POST /api/computers/register` creates a tenant-scoped computer and returns a device token once.
- Duplicate MAC registration in the same tenant returns `409 CONFLICT`.
- Admin APIs never expose token hashes or secrets.
- All admin APIs derive tenant scope from auth context.
- Security and logging tests cover invalid token, forbidden roles, tenant isolation, crafted payloads, and sensitive-log safety.

## 12. Deferred Work

- Invite code registration: deferred until onboarding needs stronger per-device provisioning.
- Claim token pre-provisioning: deferred because it adds admin setup complexity before MVP needs it.
- Device-token-authenticated REST endpoints: deferred to realtime/session/usage module decisions.
- Computer groups: deferred until URL rules or dashboard segmentation require them.
- Full audit persistence table: deferred until audit module is implemented.
- Dedicated computers health endpoint: deferred because Foundation health covers runtime and DB health for MVP.
