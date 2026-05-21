# CloudCMS Tenants Module Design

Date: 2026-05-20

## 1. Overview

The `tenants` module manages tenant records after the Auth module has created the initial tenant through public registration.

This design is based on:

- Backend-wide design: `docs/backend/2026-05-17-cloudcms-backend-design.md`
- Auth module behavior currently implemented under `backend/src/modules/auth/`
- Approved Tenants brainstorming decisions from the current design session

Tenants owns:

- Tenant self-management for the current tenant.
- Basic super-admin tenant administration.
- Tenant status updates.
- Tenant list filtering and pagination.

Tenants does not own:

- Public tenant registration.
- User/staff management.
- Computer registration.
- Sessions, usage, URL rules, assets, subscriptions, audit persistence, or archival workflows.
- Soft delete or restore in the MVP.

## 2. Scope

The MVP uses the existing `Tenant` Prisma model:

```text
Tenant
- id
- code
- name
- status
- deletedAt
- createdAt
- updatedAt
```

Rules:

- `Tenant.code` is immutable after registration.
- `Tenant.name` can be updated.
- `Tenant.status` can be `ACTIVE` or `SUSPENDED`.
- Only `super_admin` can update `Tenant.status`.
- `shop_admin` can update only the name of their own tenant.
- `deletedAt` is reserved for a later lifecycle/archive policy.
- The MVP has no `DELETE /api/tenants/:id` endpoint.

## 3. API Contract

All routes live under:

```text
/api/tenants
```

All routes require a valid access token.

### Current Tenant

```text
GET /api/tenants/me
PATCH /api/tenants/me
```

`GET /api/tenants/me` returns the tenant from `req.authContext.tenantId`.

Example response:

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

`PATCH /api/tenants/me` accepts only:

```json
{
  "name": "Cyber Game 24H"
}
```

### Super Admin

```text
GET /api/tenants?page=1&pageSize=20&status=ACTIVE&q=cyber
GET /api/tenants/:id
PATCH /api/tenants/:id
```

`GET /api/tenants` supports:

- `page`: default `1`
- `pageSize`: default `20`, max `100`
- `status`: optional, `ACTIVE` or `SUSPENDED`
- `q`: optional search string for `name` or `code`, max `100`

Example list response:

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 0
  }
}
```

`PATCH /api/tenants/:id` accepts:

```json
{
  "name": "Cyber Game 24H",
  "status": "SUSPENDED"
}
```

Both fields are optional, but the request must contain at least one valid field.

## 4. Validation

Body rules:

- `name`: string, trimmed, min `1`, max `120`
- `status`: `ACTIVE` or `SUSPENDED`
- Unknown fields are rejected with `VALIDATION_ERROR`

Query rules:

- `page`: positive integer, default `1`
- `pageSize`: positive integer, default `20`, max `100`
- `status`: optional enum
- `q`: optional trimmed string, max `100`

Request bodies must not accept:

```text
id
code
deletedAt
createdAt
updatedAt
```

## 5. Authorization And Tenant Isolation

### Self-Management Routes

`GET /api/tenants/me`:

- Allowed for `shop_admin` and `staff`.
- Requires a non-empty `tenantId` in `req.authContext`.
- Uses the tenant id from the token, never from the client.

`PATCH /api/tenants/me`:

- Allowed only for `shop_admin`.
- Updates only the current tenant name.
- Does not accept `status` or `code`.

### Super Admin Routes

`GET /api/tenants`, `GET /api/tenants/:id`, and `PATCH /api/tenants/:id`:

- Allowed only for `super_admin`.
- May read or update any non-deleted tenant.
- May update `name` and `status`.

### Isolation Rules

- Tenant users cannot list tenants.
- Tenant users cannot read or update tenants by arbitrary `:id`.
- `/me` always resolves tenant from `req.authContext.tenantId`.
- Future business modules must scope all tenant-owned data by `tenantId`.

## 6. Data And Query Behavior

MVP queries should treat `deletedAt` as reserved but still exclude deleted records defensively:

```text
where: { deletedAt: null }
```

Super-admin list query:

- Must use pagination.
- Sorts by `createdAt desc` by default.
- Supports optional `status` filter.
- Supports optional lightweight `q` search over `name` and `code`.
- Never returns the entire tenant table in one response.

The response should not expose `deletedAt` in MVP.

## 7. Error Behavior

Use the existing Foundation error response shape.

```text
401 UNAUTHORIZED
```

Missing, invalid, or expired access token.

```text
403 FORBIDDEN
```

Authenticated user has the wrong role, or `/me` is called without a tenant id.

```text
404 NOT_FOUND
```

Tenant does not exist or is excluded because `deletedAt` is not null.

```text
400 VALIDATION_ERROR
```

Body, query, or params fail validation.

## 8. Observability, Health And Operations

Tenants uses the existing request logger and `requestId` middleware.

Recommended module events:

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
```

Health:

- No Tenants-specific health endpoint in MVP.
- Use existing `/health` and `/api/health/db`.
- If DB health fails, Tenants read/write operations are not expected to work.

Operations:

- Super admin manages suspended tenants with `GET /api/tenants?status=SUSPENDED`.
- No background archive/delete job in MVP.
- No new migration is needed if the current Prisma schema remains sufficient.
- If tenant status changes to `SUSPENDED`, Auth already blocks future login for tenant users.
- Future operational modules must also check that tenant status is `ACTIVE` before running tenant business flows.

## 9. Testing And Acceptance

API and security tests should follow the existing Auth test style with Vitest and Supertest.

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

Acceptance criteria:

- Tenants router is mounted at `/api/tenants`.
- No Prisma migration is required unless implementation discovers schema drift.
- There is no soft-delete endpoint.
- Tenant code is immutable.
- Tenant status can be changed only by `super_admin`.
- Tenant self-management never accepts tenant id from the client.
- Pagination and status filtering are implemented for super-admin list.
- Tenant isolation is covered by tests.
- DB, migration, server, and test commands remain user/team-run actions.
