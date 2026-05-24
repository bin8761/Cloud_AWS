# CloudCMS Computers Module SPEC

Date: 2026-05-23

Source design: `docs/module/computers/2026-05-23-computers-module-design.md`

## Overview

The Computers module manages client PC identity after Auth and Tenants have established tenant ownership. It lets a client PC register itself with a tenant code, a tenant registration secret, and a MAC address. After registration, the backend issues a device token that later modules can use for realtime heartbeat, socket authentication, sessions, and usage sync.

Computers owns:

- Client PC registration under a tenant.
- Device token issuance and admin-triggered reissue.
- Tenant-scoped computer list, detail, and profile update.
- Computer status management for MVP operations.

Computers does not own:

- Public tenant registration.
- Staff/admin user management.
- Socket.IO connection handling or heartbeat processing.
- Session start/end behavior.
- Usage log ingestion or summary reporting.
- URL rules, assets, subscriptions, or full audit persistence.

Target users:

- Client PC app: registers the computer and receives a device token once.
- `shop_admin`: lists, views, updates, and reissues tokens for computers in their own tenant.
- Backend developers: implement device identity consistently with Auth, Tenants, Users, and Foundation.
- Future realtime/session/usage modules: consume device identity and device token behavior.

Success criteria:

- Computers router is mounted at `/api/computers`.
- `POST /api/computers/register` accepts valid `tenantCode`, `registrationSecret`, and `macAddress`, creates a tenant-scoped computer, and returns a plain device token once.
- Duplicate `(tenantId, macAddress)` registration returns `409 CONFLICT`.
- Admin endpoints require valid JWT auth, `shop_admin` role, and tenant context.
- Admin endpoints derive tenant scope from `req.authContext.tenantId` only.
- Responses never expose `deviceTokenHash`, registration secret, authorization headers, or internal token metadata.
- Security tests cover invalid token, forbidden roles, tenant isolation, crafted payloads, duplicate registration, and sensitive logging.

## Product Requirements

### MVP Features

1. Register computer
   - `POST /api/computers/register`
   - Public client endpoint protected by tenant code, tenant registration secret, active tenant check, and rate limiting.
   - Creates a computer in the resolved tenant.
   - Generates a device token, stores only its hash, and returns the plain token once.

2. List computers
   - `GET /api/computers`
   - Allowed only for `shop_admin`.
   - Supports pagination, status filter, text search, and allowlisted sorting.
   - Returns computers only from the caller tenant.

3. Computer detail
   - `GET /api/computers/:id`
   - Allowed only for `shop_admin`.
   - Returns one computer scoped by `id + tenantId`.

4. Update computer
   - `PATCH /api/computers/:id`
   - Allowed only for `shop_admin`.
   - Updates only allowlisted fields: `name`, `status`, `notes`.
   - Rejects sensitive and unknown fields.

5. Reissue device token
   - `POST /api/computers/:id/reissue-token`
   - Allowed only for `shop_admin`.
   - Generates a new device token, replaces the stored hash, logs the action, and returns the new plain token once.

6. Observability
   - Reuse shared request id and request logging middleware.
   - Emit safe computer events without leaking token, secret, hash, or authorization data.

### Out Of Scope

- One-time invite code registration.
- Admin pre-created claim tokens.
- Computer groups.
- Realtime heartbeat endpoint/socket behavior.
- Client device-token refresh endpoint.
- Device-token-authenticated REST APIs.
- Full audit persistence table.
- Computers-specific health endpoint.
- Automatic Prisma migration execution at app startup.

### Business Rules

- `tenantCode` resolves the tenant during register; client input must not provide `tenantId`.
- `registrationSecret` is required for register and must be verified against a stored hash.
- Tenant must be active before registration succeeds.
- `(tenantId, macAddress)` is unique.
- Register does not silently update an existing computer.
- MAC address is an identifier, not proof of ownership and not a secret.
- Device tokens are random secrets; only token hashes are stored.
- The plain device token is returned only after successful register or reissue.
- Admin APIs must scope every query and mutation by `req.authContext.tenantId`.
- `staff`, `super_admin`, unauthenticated users, and device-token-only clients are denied on admin endpoints in MVP.
- `lastSeenAt` is reserved for later realtime/heartbeat work and is not admin-updatable in this MVP.

### User Flows

Register computer:

```text
Client PC sends POST /api/computers/register with tenantCode, registrationSecret, macAddress, optional name
-> Backend validates body
-> Backend normalizes tenantCode and macAddress
-> Backend resolves active tenant by tenantCode
-> Backend verifies registrationSecret
-> Backend checks duplicate by tenantId + macAddress
-> If duplicate: return 409 CONFLICT
-> Backend generates device token and stores hash
-> Backend creates Computer with status ACTIVE
-> Backend logs safe computer.registered event
-> Backend returns safe computer DTO + plain deviceToken once
```

List computers:

```text
shop_admin sends GET /api/computers?page=1&pageSize=20&status=ACTIVE&q=pc
-> Backend validates admin token and shop_admin role
-> Backend requires tenant context
-> Backend validates query
-> Backend queries computers by tenantId from auth context
-> Backend applies filters, search, sort, and pagination
-> Backend returns sanitized DTOs and pagination metadata
```

Detail/update/reissue:

```text
shop_admin sends GET/PATCH/POST reissue for /api/computers/:id
-> Backend validates token, role, tenant context, params, and body
-> Backend scopes target by id + caller tenant
-> If missing: return NOT_FOUND
-> PATCH updates allowlisted fields only
-> Reissue rotates device token hash and returns new plain deviceToken once
-> Backend logs safe event
-> Backend returns sanitized computer DTO
```

## Technical Architecture

### System Type

Computers is a backend REST module inside the existing Express API.

Chosen architecture:

- Dedicated `backend/src/modules/computers` module.
- Service-first implementation.
- Controller stays thin and handles HTTP IO only.
- Service owns business rules, tenant scoping, token generation, and conflict handling.
- Schema owns request/query/params validation.
- Mapper owns safe DTO creation.
- `RegistrationAuthStrategy` isolates registration-secret verification so future invite-code or claim-token strategies can be added without rewriting routes/controllers.

Alternatives considered:

- Thin MVP module without strategy abstraction.
  - Less code initially.
  - Rejected because registration auth is likely to evolve, and a small strategy seam reduces future churn.
- Repository split from day one.
  - Stronger query isolation.
  - Deferred because the existing module style uses services directly and a repository layer would be extra structure for this MVP.
- One-time invite code first.
  - Stronger per-device onboarding.
  - Deferred because tenant secret is enough for MVP when combined with rate limiting and token reissue.

### Existing Stack

- Runtime: Node.js backend.
- HTTP framework: Express.
- Language: TypeScript.
- Validation: Zod through shared validation helper.
- Database access: Prisma.
- Database: MySQL.
- Auth/RBAC: existing Auth middleware, role guards, and `authContext`.
- Error shape: Foundation `AppError` and global error handler.
- Logging: request id middleware, request logger, and structured logs.
- Tests: Vitest and Supertest.

### Request Pipeline

```text
Client / Web Admin
  |
  v
Express app
  |
  +-- requestIdMiddleware
  +-- requestLogger
  +-- helmet / cors / body parsers
  +-- authContextMiddleware
  |
  v
/api/computers router
  |
  +-- register route: register rate limit + validateRequest
  |
  +-- admin routes: authRequired + requireRole(shop_admin) + requireTenantUser + validateRequest
  |
  v
computers.controller
  |
  v
computers.service
  |
  +-- RegistrationAuthStrategy
  +-- token generation/hash helpers
  |
  v
Prisma Computer / Tenant models
```

## Data Models

The module introduces a `Computer` Prisma model.

```prisma
model Computer {
  id              String         @id @default(uuid())
  tenantId        String
  tenant          Tenant         @relation(fields: [tenantId], references: [id])
  name            String?
  macAddress      String
  deviceTokenHash String
  status          ComputerStatus @default(ACTIVE)
  lastSeenAt      DateTime?
  notes           String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@unique([tenantId, macAddress])
  @@index([tenantId, createdAt])
  @@index([tenantId, status])
}

enum ComputerStatus {
  ACTIVE
  INACTIVE
  BLOCKED
}
```

Tenant model requirement:

```text
Tenant
- id
- code
- status
- registrationSecretHash (new or equivalent storage required)
```

If the current `Tenant` model does not have registration-secret storage, implementation must add a field such as `computerRegistrationSecretHash` through Prisma schema changes. Prisma CLI and migrations are user/team-run actions.

Optional future model:

```prisma
model ComputerTokenRotation {
  id         String   @id @default(uuid())
  computerId String
  rotatedBy String?
  reason     String?
  rotatedAt  DateTime @default(now())
}
```

The MVP may log token reissue events without persisting this optional table.

### Data Relations

```text
Tenant 1 ---- many Computer

Computer.tenantId -> Tenant.id
Computer identity uniqueness -> tenantId + macAddress
Device token lookup -> hash comparison against Computer.deviceTokenHash
```

## API Contract

All routes live under:

```text
/api/computers
```

### POST /api/computers/register

Public endpoint. It does not require admin JWT.

Request:

```json
{
  "tenantCode": "CYBER01",
  "registrationSecret": "tenant-registration-secret",
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "name": "PC-01"
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
    "deviceToken": "plain-device-token-returned-once"
  }
}
```

Failure responses:

- `400 VALIDATION_ERROR`: invalid payload.
- `401 UNAUTHORIZED`: invalid tenant registration secret.
- `404 NOT_FOUND`: tenant code does not exist or tenant is not active.
- `409 CONFLICT`: duplicate MAC address in the tenant.
- `429 TOO_MANY_REQUESTS`: register rate limit exceeded.

### GET /api/computers

Requires `shop_admin`.

Query:

```text
?page=1&pageSize=20&status=ACTIVE&q=pc&sort=createdAt:desc
```

Query parameters:

- `page`: default `1`, minimum `1`.
- `pageSize`: default `20`, minimum `1`, maximum `100`.
- `status`: optional `ACTIVE`, `INACTIVE`, or `BLOCKED`.
- `q`: optional search over `name` and `macAddress`, trimmed, maximum `100`.
- `sort`: optional allowlist: `createdAt:desc`, `createdAt:asc`, `name:asc`, `name:desc`.

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

### GET /api/computers/:id

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

### PATCH /api/computers/:id

Requires `shop_admin`.

Request accepts only:

```json
{
  "name": "PC-01 Front Desk",
  "status": "ACTIVE",
  "notes": "Near cashier"
}
```

At least one allowed field is required.

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

### POST /api/computers/:id/reissue-token

Requires `shop_admin`.

Request:

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

## Validation Specification

Register body:

- `tenantCode`: required string, trim, uppercase-normalize, max `50`.
- `registrationSecret`: required string, min `8`, max `200`.
- `macAddress`: required string, normalize to uppercase canonical MAC format.
- `name`: optional string, trim, max `100`.
- Unknown fields are rejected.

List query:

- `page`: default `1`, integer, min `1`.
- `pageSize`: default `20`, integer, min `1`, max `100`.
- `status`: optional enum `ACTIVE`, `INACTIVE`, `BLOCKED`.
- `q`: optional string, trim, max `100`.
- `sort`: optional allowlist only.
- Unknown query keys are rejected.

Params:

- `id`: required UUID.

Patch body:

- At least one allowed field is required.
- Allowed fields: `name`, `status`, `notes`.
- `name`: optional string or null, trim, max `100`.
- `status`: optional enum `ACTIVE`, `INACTIVE`, `BLOCKED`.
- `notes`: optional string or null, trim, max `500`.
- Unknown or sensitive fields are rejected.

Reissue body:

- `reason`: optional string, trim, max `200`.
- Unknown fields are rejected.

Rejected fields:

- `tenantId`
- `macAddress` in patch
- `deviceToken`
- `deviceTokenHash`
- `lastSeenAt`
- `createdAt`
- `updatedAt`
- any unknown property

## Authorization And Security

### Role Matrix

| Endpoint | Unauthenticated | staff | shop_admin | super_admin | Device token only |
| --- | --- | --- | --- | --- | --- |
| `POST /api/computers/register` | Conditional public via tenant secret | Conditional public via tenant secret | Conditional public via tenant secret | Conditional public via tenant secret | Conditional public via tenant secret |
| `GET /api/computers` | Deny | Deny | Allow own tenant | Deny in MVP | Deny |
| `GET /api/computers/:id` | Deny | Deny | Allow own tenant | Deny in MVP | Deny |
| `PATCH /api/computers/:id` | Deny | Deny | Allow own tenant | Deny in MVP | Deny |
| `POST /api/computers/:id/reissue-token` | Deny | Deny | Allow own tenant | Deny in MVP | Deny |

### Required Guards

Register route:

- Register-specific rate limit.
- Request validation.
- Tenant code lookup.
- Active tenant requirement.
- Tenant registration secret verification.
- Duplicate `(tenantId, macAddress)` check.

Admin routes:

- `authRequired`.
- `requireRole(SHOP_ADMIN)`.
- `requireTenantUser` or equivalent tenant-context guard.
- Request validation.
- Service-level tenant scoping by `authContext.tenantId`.

Security rules:

- Never trust client-provided `tenantId`.
- Never store plain device tokens.
- Never return `deviceTokenHash`.
- Never log registration secret, plain device token, token hash, authorization header, or raw register/reissue body.
- Use constant-time or hash-library comparison semantics for registration secret verification where practical.
- Treat MAC address as metadata, not authentication.

## Data And Query Behavior

Register creates:

```text
tenantId = resolved tenant id
macAddress = normalized MAC
name = optional normalized name
status = ACTIVE
deviceTokenHash = hash(generated token)
```

Duplicate rule:

```text
where tenantId = resolved tenant id
and macAddress = normalized MAC
```

If found, return `409 CONFLICT`. Do not update the record and do not issue a new token.

List query:

```text
where tenantId = authContext.tenantId
and optional status filter
and optional q over name/macAddress
order by allowlisted sort
skip/take from page/pageSize
```

Detail/update/reissue query:

```text
where id = params.id
and tenantId = authContext.tenantId
```

No endpoint returns `deviceTokenHash`.

## Error Behavior

Shared error shape:

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

Expected errors:

- `400 VALIDATION_ERROR`
  - Invalid body/query/params.
  - Unknown field.
  - Empty patch.
  - Invalid enum.
  - Invalid MAC format.
- `401 UNAUTHORIZED`
  - Missing/invalid/expired admin token for admin endpoints.
  - Invalid registration secret for register.
- `403 FORBIDDEN`
  - Caller is not `shop_admin`.
  - Tenant context is missing.
  - Tenant is inactive for admin operations.
- `404 NOT_FOUND`
  - Tenant code does not resolve to an active tenant during register.
  - Computer does not exist inside caller tenant scope.
- `409 CONFLICT`
  - Duplicate `(tenantId, macAddress)` register attempt.
- `429 TOO_MANY_REQUESTS`
  - Register rate limit exceeded.
- `500 INTERNAL_ERROR`
  - Unexpected runtime error; response must not expose token, secret, hash, stack, or Prisma internals.

## Observability, Health, And Operations

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
- No Computers-specific health endpoint is required in MVP.
- Device heartbeat health belongs to the later realtime module.

Operations:

- Apply a stricter rate limit to `POST /api/computers/register` than normal admin reads.
- Monitor repeated register failures by IP and tenant code.
- Lost token/reinstalled client runbook: admin uses reissue token, client stores new token, old token hash is replaced.
- Support staff must not treat MAC address as proof of ownership.
- Prisma CLI, migrations, database setup, server commands, and DB commands are user/team-run actions.

## System Maps

### Architecture Diagram

```text
Client PC / Web Admin
  |
  v
Express app
  |
  +-- Foundation middleware
  |   +-- requestId
  |   +-- requestLogger
  |   +-- authContext
  |
  v
/api/computers router
  |
  +-- register: rateLimit + validateRequest
  +-- admin: authRequired + requireRole(shop_admin) + requireTenantUser + validateRequest
  |
  v
computers.controller
  |
  v
computers.service
  |
  +-- TenantSecretStrategy
  +-- token generation/hash helpers
  +-- computers.mapper
  |
  v
Prisma Tenant / Computer
```

### Data Relations

```text
Tenant
  |
  | 1-to-many
  v
Computer

Computer uniqueness:
tenantId + macAddress

Computer secret storage:
plain device token -> hash -> Computer.deviceTokenHash
```

### User Flow Map

```text
Register:
Client PC -> /api/computers/register -> Computer + deviceToken

Admin management:
shop_admin -> list/detail/update computers in own tenant

Recovery:
shop_admin -> reissue token -> Client PC stores new deviceToken
```

## File Structure

Expected source files:

```text
backend/src/modules/computers/
  computers.routes.ts
  computers.controller.ts
  computers.service.ts
  computers.schema.ts
  computers.mapper.ts
  computers.logging.ts
  computers.types.ts
  registration-auth.strategy.ts
```

Expected tests:

```text
backend/tests/computers/
  computers.api.test.ts
  computers.service.test.ts
  computers.unit.test.ts
```

Expected app wiring:

```text
backend/src/app.ts
  app.use("/api/computers", computersRouter)
```

Expected docs:

```text
docs/module/computers/2026-05-23-computers-module-design.md
docs/SPEC/computers/SPEC.md
docs/SPEC/computers/CLAUDE.md
docs/task/computers/task-breakdown.md
docs/tdd/computers/technical-design.md
```

## Development Phases

- [ ] Phase 1: Data model and schema decisions
  - Add `Computer` model and `ComputerStatus` enum to Prisma schema.
  - Add tenant registration secret storage if not already available.
  - User runs Prisma CLI/migration commands.

- [ ] Phase 2: Module scaffold and app wiring
  - Create module files.
  - Mount `/api/computers` router.
  - Add initial API smoke test.

- [ ] Phase 3: Register flow
  - Add register schema.
  - Implement `TenantSecretStrategy`.
  - Implement token generation/hash storage.
  - Implement duplicate MAC conflict.
  - Add unit, service, and API tests.

- [ ] Phase 4: Admin list/detail/update
  - Add admin guards.
  - Implement tenant-scoped queries.
  - Implement pagination/filter/search/sort.
  - Implement patch allowlist.
  - Add API and service tests.

- [ ] Phase 5: Reissue token flow
  - Add admin reissue endpoint.
  - Rotate token hash.
  - Return new plain token once.
  - Add logging and tests.

- [ ] Phase 6: Security, logging, and regression
  - Add crafted payload/query tests.
  - Add tenant isolation tests.
  - Add sensitive-log safety tests.
  - Run Computers test suite and relevant Users/Auth regression.

## Testing Requirements

Unit tests:

- Register schema accepts valid payload and rejects missing required fields.
- List query schema normalizes defaults and rejects crafted query keys.
- Patch schema rejects unknown and sensitive fields.
- Mapper never returns `deviceTokenHash`.
- `TenantSecretStrategy` accepts a correct secret and rejects an incorrect secret.

Service tests:

- Register success creates a computer and returns a plain device token once.
- Register duplicate `(tenantId, macAddress)` returns `409 CONFLICT`.
- Register rejects inactive or missing tenant.
- List/detail/update are scoped by `tenantId`.
- Update rejects sensitive fields.
- Reissue token replaces the stored hash and returns a new plain token once.

API tests:

- Missing admin token is rejected on admin endpoints.
- `shop_admin` can list/detail/update/reissue only inside their tenant.
- `staff` and `super_admin` are forbidden in MVP.
- Register validates payload and rate limit behavior.
- Tenant isolation prevents cross-tenant detail, patch, and reissue.
- Error responses use the shared Foundation error shape.

Manual verification:

- Register one computer with valid tenant credentials.
- Confirm duplicate register returns `409`.
- Confirm admin can list and view the computer.
- Confirm admin reissue returns a new token and old hash is replaced.
- Confirm no response exposes `deviceTokenHash`.

## Acceptance Checklist

- [ ] `/api/computers` router is mounted.
- [ ] `POST /api/computers/register` creates a tenant-scoped computer.
- [ ] Register stores only `deviceTokenHash`.
- [ ] Register returns plain `deviceToken` only once.
- [ ] Duplicate `(tenantId, macAddress)` returns `409 CONFLICT`.
- [ ] Admin endpoints require `shop_admin`.
- [ ] `staff`, `super_admin`, unauthenticated users, and device-token-only clients are denied on admin endpoints.
- [ ] All admin queries/mutations use tenant scope from auth context.
- [ ] `PATCH` rejects unknown and sensitive fields.
- [ ] Reissue token replaces the stored hash and logs a safe event.
- [ ] API responses never expose secrets or hashes.
- [ ] Tests cover validation, authorization, tenant isolation, conflict, token handling, and logging safety.

## Open Questions

- Exact tenant field name for registration secret storage is not confirmed. Recommended: `computerRegistrationSecretHash` on `Tenant`.
- Exact device token generation helper should follow existing Auth token helper patterns if reusable.
- Exact register rate-limit bucket settings should align with current shared rate-limit helper defaults.
- Whether `ComputerTokenRotation` is required in MVP remains deferred unless audit persistence is needed before realtime/session work.

## References

- Source design: `docs/module/computers/2026-05-23-computers-module-design.md`
- Backend-wide design: `docs/backend/2026-05-17-cloudcms-backend-design.md`
- Tenants SPEC: `docs/SPEC/tenants/SPEC.md`
- Users SPEC: `docs/SPEC/users/SPEC.md`
