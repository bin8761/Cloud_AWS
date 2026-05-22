# CloudCMS Users MVP Design

Date: 2026-05-22

## 1. Overview

The `users` module manages staff accounts inside a tenant after Auth has created the initial `shop_admin` through tenant registration.

Users owns:

- Staff account creation by an authenticated `shop_admin`.
- Staff list, detail, profile update, status lock/unlock, and temporary password reset.
- Tenant-scoped staff management under `/api/users`.

Users does not own:

- Public tenant registration.
- Login, refresh, logout, or current-user lookup.
- Staff self-profile endpoints.
- `shop_admin` account management.
- `super_admin` user administration.
- Email invite onboarding.
- Physical user deletion.

Staff should continue to use `GET /api/auth/me` for current-user profile data.

## 2. MVP Scope

All MVP endpoints are mounted under:

```text
/api/users
```

Endpoints:

```text
POST  /api/users
GET   /api/users
GET   /api/users/:id
PATCH /api/users/:id
```

No `DELETE /api/users/:id` endpoint is included in MVP. Staff account lock/unlock uses `User.status` with `ACTIVE` and `DISABLED`.

## 3. Authorization And Tenant Isolation

All `/api/users` endpoints require a valid access token.

Allowed role:

```text
shop_admin
```

Denied in MVP:

```text
staff
super_admin
unauthenticated users
```

The backend must derive tenant ownership from:

```text
request.authContext.tenantId
```

The client must not be allowed to provide or override `tenantId`.

All staff queries and mutations must scope by:

```text
tenantId = authContext.tenantId
role = STAFF
deletedAt = null
```

This prevents a `shop_admin` from reading or modifying users from another tenant and prevents the Users module from managing `shop_admin` or `super_admin` accounts in MVP.

## 4. API Contract

### Create Staff

```text
POST /api/users
```

Request body:

```json
{
  "email": "staff@example.com",
  "fullName": "Nguyen Van A",
  "password": "Temp@123456"
}
```

Backend-controlled fields:

```text
tenantId = authContext.tenantId
role = STAFF
status = ACTIVE
passwordHash = hash(password)
```

### List Staff

```text
GET /api/users?page=1&pageSize=20&status=ACTIVE&q=nguyen
```

Query parameters:

- `page`: default `1`, minimum `1`.
- `pageSize`: default `20`, minimum `1`, maximum `100`.
- `status`: optional `ACTIVE` or `DISABLED`.
- `q`: optional search over `email` and `fullName`, trimmed, maximum `100`.

List sorting:

```text
createdAt desc
```

### Staff Detail

```text
GET /api/users/:id
```

Returns one staff user in the current tenant.

Unknown, deleted, wrong-role, or cross-tenant users resolve as `NOT_FOUND`.

### Update Staff

```text
PATCH /api/users/:id
```

Allowed request body:

```json
{
  "fullName": "Nguyen Van B",
  "status": "DISABLED",
  "password": "NewTemp@123456"
}
```

All fields are optional, but the request must include at least one valid field.

Allowed updates:

- `fullName`
- `status`
- `password` as a temporary reset password

Rejected fields:

```text
id
email
tenantId
role
passwordHash
deletedAt
createdAt
updatedAt
lastLoginAt
```

## 5. Validation

Validation uses Zod through the existing `validateRequest` middleware.

Rules:

- `email`: trim, lowercase, valid email.
- `fullName`: trim, min `1`, max `120`.
- `password`: reuse the existing Auth password strength rules.
- `status`: `ACTIVE` or `DISABLED`.
- Unknown body fields are rejected with `.strict()`.
- Path `id` is a non-empty trimmed string.

## 6. DTOs

Staff responses return safe user data only:

```text
id
tenantId
email
fullName
role
status
lastLoginAt
createdAt
updatedAt
```

Never return:

```text
passwordHash
deletedAt
refreshTokens
authorization headers
tokens
```

## 7. Error Handling

Use the existing Foundation error response shape.

```text
401 UNAUTHORIZED
```

Missing, invalid, or expired access token.

```text
403 FORBIDDEN
```

Authenticated user is not `shop_admin` or has no tenant context.

```text
400 VALIDATION_ERROR
```

Invalid body, query, or params.

```text
404 NOT_FOUND
```

Target staff does not exist, is deleted, belongs to another tenant, or is not `STAFF`.

```text
409 CONFLICT
```

Email already exists. The current Prisma schema enforces global `User.email` uniqueness.

## 8. Observability

Users uses the shared request and logging middleware:

```text
requestIdMiddleware
requestLogger
authContextMiddleware
pino logger
```

Recommended safe events:

```text
user.staff.created
user.staff.updated
user.staff.status.updated
user.staff.password.reset
```

Safe log fields:

```text
requestId
actorUserId
actorRole
actorTenantId
targetUserId
targetTenantId
changedFields
oldStatus
newStatus
```

Never log:

```text
password
passwordHash
Authorization header
refresh token
raw body
raw headers
```

## 9. Health And Operations

No Users-specific health endpoint is added in MVP.

The existing health module remains responsible for app-level health. Users has no runtime dependency beyond Prisma, Auth middleware, and shared infrastructure.

Operational rules:

- Do not run migrations automatically at application startup.
- Do not create `super_admin` through `/api/users`.
- Do not create or manage `shop_admin` through `/api/users` in MVP.
- Do not send invite emails in MVP.
- Do not physically delete users in MVP.
- Do not expose `passwordHash`, `deletedAt`, or token material in API responses.

Disabled staff cannot login, refresh, or use `GET /api/auth/me` because Auth already rejects `UserStatus.DISABLED`.

## 10. Testing Strategy

Automated tests should cover:

- Authentication failures for missing, malformed, invalid, and expired access tokens.
- Authorization failures for `staff` and `super_admin`.
- Tenant isolation across create, list, detail, and patch.
- Staff creation success.
- Duplicate email conflict.
- Rejection of client-provided `tenantId`, `role`, `status`, `passwordHash`, ids, timestamps, and deleted fields.
- List pagination, status filter, and `q` search over `email` and `fullName`.
- Detail success, not found, deleted user exclusion, wrong role exclusion, and cross-tenant not found.
- Patch `fullName`, `status`, and temporary password reset.
- Response DTOs do not expose `passwordHash`, `deletedAt`, or tokens.
- Logs do not expose password, passwordHash, tokens, raw body, or raw headers.

## 11. Deferred Work

Deferred beyond MVP:

- Staff invite email flow.
- Staff self-service profile endpoints in Users.
- `shop_admin` account management.
- `super_admin` user administration across tenants.
- Physical delete or soft-delete API.
- Permission model finer than the current role enum.
