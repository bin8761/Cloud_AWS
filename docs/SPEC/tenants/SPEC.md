# CloudCMS Tenants Module SPEC

Date: 2026-05-20

Source design: `docs/module/tenants/2026-05-20-tenants-design.md`

## Overview

The Tenants module manages tenant records after the Auth module has created the initial tenant through public registration. It provides safe tenant self-management for shop admins and staff, plus basic tenant administration for super admins.

The module exists to keep tenant lifecycle behavior explicit and isolated from Auth. Auth remains responsible for registration, login, tokens, and current-user identity. Tenants owns tenant profile reads, tenant name updates, super-admin tenant listing, super-admin tenant detail, and super-admin status changes.

Target users:

- `shop_admin`: reads and updates the current tenant profile name.
- `staff`: reads the current tenant profile.
- `super_admin`: lists tenants, views tenant detail, and updates tenant name/status.
- Backend developers: implement the Tenants module consistently with existing Auth/Foundation patterns.
- Future Web Admin screens: consume the API contract defined here.

Success criteria:

- Tenants router is mounted at `/api/tenants`.
- All Tenants endpoints require a valid access token.
- Tenant users can only access the tenant resolved from `req.authContext.tenantId`.
- `Tenant.code` remains immutable after registration.
- Only `super_admin` can update `Tenant.status`.
- `shop_admin` can update only their own tenant name.
- Super-admin list uses pagination and optional filters.
- Responses do not expose `deletedAt` in the MVP.
- No soft-delete endpoint exists in the MVP.
- Tests cover authentication, authorization, tenant isolation, validation, and safe logging.

## Product Requirements

### MVP Features

1. Current tenant read
   - `GET /api/tenants/me`
   - Allowed for `shop_admin` and `staff`.
   - Resolves tenant from the access token auth context.
   - Never accepts tenant id from the client.

2. Current tenant self-update
   - `PATCH /api/tenants/me`
   - Allowed only for `shop_admin`.
   - Accepts only `name`.
   - Rejects `status`, `code`, ids, timestamps, and unknown fields.

3. Super-admin tenant list
   - `GET /api/tenants`
   - Allowed only for `super_admin`.
   - Supports `page`, `pageSize`, `status`, and `q`.
   - Sorts by `createdAt desc`.
   - Never returns the full tenant table in one response.

4. Super-admin tenant detail
   - `GET /api/tenants/:id`
   - Allowed only for `super_admin`.
   - Returns one non-deleted tenant.

5. Super-admin tenant update
   - `PATCH /api/tenants/:id`
   - Allowed only for `super_admin`.
   - Accepts `name` and/or `status`.
   - Requires at least one valid field.

6. Observability
   - Use existing request id and request logger middleware.
   - Emit safe tenant update events.
   - Never log tokens, authorization headers, refresh tokens, or raw headers.

### Out Of Scope

- Public tenant registration. This remains in Auth.
- User/staff management.
- Computer registration and device identity.
- Sessions, usage tracking, URL rules, assets, subscriptions, and audit persistence.
- Soft delete, restore, archive jobs, or lifecycle policy enforcement.
- New Tenants-specific health endpoints.
- Prisma migration unless implementation discovers schema drift.

### User Flows

Shop admin views current tenant:

1. Web Admin calls `GET /api/tenants/me` with an access token.
2. Backend validates the token through `authRequired`.
3. Backend requires a tenant-bound user.
4. Backend loads the tenant by `req.authContext.tenantId` with `deletedAt: null`.
5. Backend returns tenant profile fields without `deletedAt`.

Shop admin updates tenant name:

1. Web Admin calls `PATCH /api/tenants/me` with `{ "name": "..." }`.
2. Backend validates token, role, tenant id, and body.
3. Backend updates only the current tenant name.
4. Backend logs `tenant.name.updated` with safe fields.
5. Backend returns the updated tenant.

Staff views current tenant:

1. Staff calls `GET /api/tenants/me`.
2. Backend validates token and tenant id.
3. Backend returns current tenant profile.
4. Staff calls to `PATCH /api/tenants/me` return `403 FORBIDDEN`.

Super admin lists and manages tenants:

1. Super admin calls `GET /api/tenants?page=1&pageSize=20&status=SUSPENDED&q=cyber`.
2. Backend validates token, role, and query.
3. Backend returns a paginated list.
4. Super admin calls `PATCH /api/tenants/:id` with `{ "status": "ACTIVE" }` or `{ "name": "..." }`.
5. Backend logs status/name update events with safe fields.

## Technical Architecture

### System Type

Tenants is a backend REST module inside the existing Express API.

Chosen architecture:

- Create a dedicated `backend/src/modules/tenants` module.
- Follow the current Auth module shape: routes, controller, service, schema, types, and logging helpers.
- Reuse shared middleware, validation, errors, logging, and Prisma client.

Alternatives considered:

- Extend Auth with tenant endpoints.
  - Simpler file count.
  - Rejected because Auth should not own post-registration tenant administration.
- Create a broad Admin module.
  - Could group future admin features.
  - Rejected for MVP because tenant-specific authorization and data rules should remain explicit.

### Existing Stack

- Runtime: Node.js backend.
- HTTP framework: Express.
- Language: TypeScript.
- Validation: Zod through `shared/validation/validate-request`.
- Database access: Prisma.
- Database: MySQL.
- Auth: existing `authRequired` middleware and `req.authContext`.
- RBAC: existing role helpers from Auth can be reused or mirrored.
- Error shape: existing Foundation `AppError` and error handler.
- Logging: existing request logger and request id middleware.
- Tests: Vitest and Supertest, following the Auth test style.

### Request Pipeline

```text
Client
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
/api/tenants router
  |
  +-- authRequired
  +-- validateRequest
  +-- role / tenant guards
  |
  v
tenants.controller
  |
  v
tenants.service
  |
  v
Prisma Tenant model
```

### Data Model

The MVP uses the existing Prisma `Tenant` model:

```prisma
model Tenant {
  id        String       @id @default(uuid())
  code      String       @unique
  name      String
  status    TenantStatus @default(ACTIVE)
  deletedAt DateTime?
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  users User[]
}
```

Tenant status enum:

```prisma
enum TenantStatus {
  ACTIVE
  SUSPENDED
}
```

DTO returned by Tenants:

```ts
type TenantDto = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  updatedAt: string;
};
```

The DTO must not include `deletedAt`.

### Data Relations

```text
Tenant 1 -- * User

Tenant
  id
  code
  name
  status
  deletedAt
  createdAt
  updatedAt
```

Future tenant-owned modules must add their own `tenantId` and scope queries by that value.

## API Contract

All endpoints live under:

```text
/api/tenants
```

All endpoints require:

```text
Authorization: Bearer <accessToken>
```

### GET /api/tenants/me

Purpose:

- Return the tenant associated with the current authenticated tenant user.

Allowed roles:

- `shop_admin`
- `staff`

Auth and isolation rules:

- Requires a non-empty `req.authContext.tenantId`.
- Uses tenant id from auth context only.
- Does not accept tenant id in body, params, or query.
- Returns `403 FORBIDDEN` if the authenticated user has no tenant id.

Success response:

```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant-id",
      "code": "CYBER01",
      "name": "Cyber Game 24H",
      "status": "ACTIVE",
      "createdAt": "2026-05-20T00:00:00.000Z",
      "updatedAt": "2026-05-20T00:00:00.000Z"
    }
  }
}
```

### PATCH /api/tenants/me

Purpose:

- Update the current tenant name.

Allowed roles:

- `shop_admin`

Request body:

```json
{
  "name": "Cyber Game 24H"
}
```

Validation:

- `name`: string, trimmed, min length `1`, max length `120`.
- Unknown fields rejected.
- `status`, `code`, `id`, `deletedAt`, `createdAt`, and `updatedAt` rejected.

Success response:

```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant-id",
      "code": "CYBER01",
      "name": "Cyber Game 24H",
      "status": "ACTIVE",
      "createdAt": "2026-05-20T00:00:00.000Z",
      "updatedAt": "2026-05-20T00:00:00.000Z"
    }
  }
}
```

### GET /api/tenants

Purpose:

- Return a paginated tenant list for super-admin operations.

Allowed roles:

- `super_admin`

Query params:

```text
page=1
pageSize=20
status=ACTIVE
q=cyber
```

Validation:

- `page`: positive integer, default `1`.
- `pageSize`: positive integer, default `20`, max `100`.
- `status`: optional enum, `ACTIVE` or `SUSPENDED`.
- `q`: optional trimmed string, max length `100`.

Query behavior:

- Always includes `deletedAt: null`.
- Applies optional `status` filter.
- Applies optional lightweight search over `name` and `code`.
- Sorts by `createdAt desc`.
- Uses pagination in every response.

Success response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "tenant-id",
        "code": "CYBER01",
        "name": "Cyber Game 24H",
        "status": "ACTIVE",
        "createdAt": "2026-05-20T00:00:00.000Z",
        "updatedAt": "2026-05-20T00:00:00.000Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

### GET /api/tenants/:id

Purpose:

- Return tenant detail for super-admin operations.

Allowed roles:

- `super_admin`

Params:

- `id`: non-empty string.

Query behavior:

- Loads one tenant by `id` with `deletedAt: null`.
- Returns `404 NOT_FOUND` if missing or deleted.

Success response:

```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant-id",
      "code": "CYBER01",
      "name": "Cyber Game 24H",
      "status": "ACTIVE",
      "createdAt": "2026-05-20T00:00:00.000Z",
      "updatedAt": "2026-05-20T00:00:00.000Z"
    }
  }
}
```

### PATCH /api/tenants/:id

Purpose:

- Update tenant name and/or tenant status as a super admin.

Allowed roles:

- `super_admin`

Params:

- `id`: non-empty string.

Request body:

```json
{
  "name": "Cyber Game 24H",
  "status": "SUSPENDED"
}
```

Validation:

- `name`: optional string, trimmed, min length `1`, max length `120`.
- `status`: optional enum, `ACTIVE` or `SUSPENDED`.
- Body must include at least one valid field.
- Unknown fields rejected.
- `code`, `id`, `deletedAt`, `createdAt`, and `updatedAt` rejected.

Query behavior:

- Loads and updates a tenant by `id` with `deletedAt: null`.
- Returns `404 NOT_FOUND` if missing or deleted.

Success response:

```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant-id",
      "code": "CYBER01",
      "name": "Cyber Game 24H",
      "status": "SUSPENDED",
      "createdAt": "2026-05-20T00:00:00.000Z",
      "updatedAt": "2026-05-20T00:00:00.000Z"
    }
  }
}
```

## Validation Specification

Recommended schema file:

```text
backend/src/modules/tenants/tenants.schema.ts
```

Zod schema behavior:

```ts
const tenantNameSchema = z.string().trim().min(1).max(120);
const tenantStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);

const paginationQuerySchema = z.object({
  page: positiveIntegerFromQuery.default(1),
  pageSize: positiveIntegerFromQuery.max(100).default(20),
  status: tenantStatusSchema.optional(),
  q: z.string().trim().max(100).optional(),
});
```

Implementation notes:

- Reuse the existing `validateRequest` helper.
- Reject unknown body and query fields where the endpoint contract requires strict input.
- Query params arrive as strings from Express and must be parsed into numbers where needed.
- Keep normalized values on `req.body`, `req.query`, and `req.params` after validation.
- DB, migration, server, test, typecheck, and Prisma CLI commands remain user/team-run actions in this workspace.

## Authorization And Security

### Role Matrix

```text
Endpoint                 super_admin   shop_admin   staff
GET /api/tenants/me      no*           yes          yes
PATCH /api/tenants/me    no*           yes          no
GET /api/tenants         yes           no           no
GET /api/tenants/:id     yes           no           no
PATCH /api/tenants/:id   yes           no           no
```

`no*`: super admin is not tenant-bound in the MVP and should use super-admin routes.

### Required Guards

All routes:

- `authRequired`

Self-management routes:

- Require role `shop_admin` or `staff` for `GET /me`.
- Require role `shop_admin` for `PATCH /me`.
- Require tenant id with the existing tenant-user guard pattern.

Super-admin routes:

- Require role `super_admin`.

Security rules:

- Never trust tenant id from client input on `/me`.
- Never allow tenant users to pass arbitrary tenant ids.
- Never allow `shop_admin` or `staff` to call super-admin routes.
- Never allow `staff` to mutate tenant profile.
- Never allow status changes outside `PATCH /api/tenants/:id` by `super_admin`.
- Never expose or mutate `deletedAt` in MVP endpoints.

## Data And Query Behavior

All tenant reads and writes should defensively exclude deleted tenants:

```ts
where: {
  deletedAt: null,
}
```

Self-management:

- Uses `req.authContext.tenantId`.
- Reads exactly one tenant.
- Updates only `name`.
- Does not accept or process tenant id from the request.

Super-admin list:

- Uses `skip` and `take` based on `page` and `pageSize`.
- Counts total matching records.
- Returns `items`, `page`, `pageSize`, and `total`.
- Default sort: `createdAt desc`.

Super-admin update:

- Loads target by `id` and `deletedAt: null`.
- Updates only fields present in the validated payload.
- Logs name/status changes.

## Error Behavior

Use the existing Foundation error response shape and `AppError`.

Expected cases:

```text
401 UNAUTHORIZED
```

- Missing access token.
- Invalid access token.
- Expired access token.
- Wrong token type.

```text
403 FORBIDDEN
```

- Authenticated user has the wrong role.
- `/me` endpoint is called without a tenant id.
- Tenant user attempts arbitrary tenant access.

```text
404 NOT_FOUND
```

- Tenant does not exist.
- Tenant is excluded because `deletedAt` is not null.

```text
400 VALIDATION_ERROR
```

- Body fails validation.
- Query fails validation.
- Params fail validation.
- Unknown fields are provided where strict schemas apply.

## Observability, Health, And Operations

Use existing app-wide request logging and request id behavior.

Recommended events:

- `tenant.name.updated`
- `tenant.status.updated`

Optional debug-only events:

- `tenant.profile.viewed`
- `tenant.list.viewed`

Safe log fields:

```text
requestId
actorUserId
actorRole
actorTenantId
targetTenantId
action
oldStatus
newStatus
statusCode
latencyMs
```

Never log:

```text
Authorization header
access token
refresh token
raw request headers
raw secrets
```

Health:

- No Tenants-specific health endpoint in MVP.
- Use existing `/health` and `/api/health/db`.
- If DB health fails, Tenants read/write operations are not expected to work.

Operations:

- Super admins manage suspended tenants through `GET /api/tenants?status=SUSPENDED`.
- No background archive/delete job in MVP.
- If tenant status changes to `SUSPENDED`, Auth already blocks future tenant-user login.
- Future operational modules must also verify tenant status is `ACTIVE` before tenant business flows.

## File Structure

Expected module files:

```text
backend/src/modules/tenants/
  tenants.controller.ts
  tenants.logging.ts
  tenants.routes.ts
  tenants.schema.ts
  tenants.service.ts
  tenants.types.ts
```

Expected app integration:

```text
backend/src/app.ts
```

Mounting requirement:

```ts
app.use("/api/tenants", tenantsRouter);
```

Expected tests:

```text
backend/tests/tenants/tenants.api.test.ts
```

Optional future tests:

```text
backend/tests/tenants/tenants.api.live.test.ts
backend/tests/tenants/tenants.api.live.security.test.ts
```

## Development Phases

- [ ] Phase 1: Module skeleton
  - Create Tenants routes, controller, service, schema, types, and logging helper.
  - Mount router at `/api/tenants`.
  - Reuse shared validation, errors, Prisma, and auth middleware.

- [ ] Phase 2: Self-management endpoints
  - Implement `GET /api/tenants/me`.
  - Implement `PATCH /api/tenants/me`.
  - Enforce tenant-id-from-token isolation.
  - Enforce `shop_admin` mutation rule.

- [ ] Phase 3: Super-admin endpoints
  - Implement `GET /api/tenants`.
  - Implement `GET /api/tenants/:id`.
  - Implement `PATCH /api/tenants/:id`.
  - Enforce pagination, filtering, search, detail lookup, and status update rules.

- [ ] Phase 4: Validation and error hardening
  - Add strict schemas for bodies, params, and query.
  - Reject immutable/protected fields.
  - Confirm expected `400`, `401`, `403`, and `404` behavior.

- [ ] Phase 5: Observability
  - Add safe tenant update logs.
  - Confirm logs do not include tokens, authorization headers, or raw headers.
  - Keep health behavior app-wide only.

- [ ] Phase 6: Tests and acceptance
  - Add API/security tests following Auth test style.
  - Ask user/team to run test/typecheck commands according to workspace constraint.
  - Update task tracking docs if a Tenants task breakdown exists.

## Testing Requirements

Required API/security cases:

- Missing token on Tenants API returns `401`.
- `shop_admin` can call `GET /api/tenants/me`.
- `shop_admin` can update own tenant name through `PATCH /api/tenants/me`.
- `shop_admin` cannot update `status` or `code` through `/me`.
- `staff` can call `GET /api/tenants/me`.
- `staff` cannot call `PATCH /api/tenants/me`.
- `shop_admin` and `staff` cannot call `GET /api/tenants`.
- `shop_admin` and `staff` cannot call `GET /api/tenants/:id`.
- `shop_admin` and `staff` cannot call `PATCH /api/tenants/:id`.
- `super_admin` can list tenants with pagination.
- `super_admin` can filter tenants by status.
- `super_admin` can search tenants by name or code.
- `super_admin` can get tenant detail.
- `super_admin` can update tenant name.
- `super_admin` can update tenant status.
- Invalid `status`, `page`, `pageSize`, `q`, or `id` returns `400`.
- Unknown tenant returns `404`.
- Responses do not expose `deletedAt` in MVP.
- Tenant update logs do not contain tokens or secrets.

Manual verification commands are user/team-run actions in this workspace. Do not run DB, migration, server, test, or typecheck commands autonomously.

## Acceptance Checklist

- [ ] Tenants router is mounted at `/api/tenants`.
- [ ] All Tenants endpoints require access-token authentication.
- [ ] `GET /api/tenants/me` works for `shop_admin` and `staff`.
- [ ] `PATCH /api/tenants/me` works only for `shop_admin`.
- [ ] `/me` routes resolve tenant only from `req.authContext.tenantId`.
- [ ] Tenant users cannot list, read, or update arbitrary tenant ids.
- [ ] Super admin can list tenants with pagination.
- [ ] Super admin can filter tenants by status.
- [ ] Super admin can search tenants by name or code.
- [ ] Super admin can get tenant detail.
- [ ] Super admin can update tenant name.
- [ ] Super admin can update tenant status.
- [ ] `Tenant.code` is immutable.
- [ ] No soft-delete endpoint exists.
- [ ] `deletedAt` is not exposed in responses.
- [ ] Queries defensively exclude `deletedAt != null`.
- [ ] No Prisma migration is required unless schema drift is discovered.
- [ ] Tenant isolation is covered by tests.
- [ ] Safe logging is covered by tests.

## Open Questions

None for the MVP based on the approved design.

Potential future decisions:

- When to introduce tenant archive/delete lifecycle policy.
- Whether to add audit persistence for tenant changes.
- Whether live Tenants API tests should be added immediately or after Web Admin consumes the endpoints.

## References

- Design source: `docs/module/tenants/2026-05-20-tenants-design.md`
- Backend-wide design: `docs/backend/2026-05-17-cloudcms-backend-design.md`
- Existing app mount point: `backend/src/app.ts`
- Existing Auth module pattern: `backend/src/modules/auth/`
- Existing Prisma schema: `backend/prisma/schema.prisma`
