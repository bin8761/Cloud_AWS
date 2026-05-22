# CloudCMS Users Module SPEC

Date: 2026-05-22

Source design: `docs/module/users/2026-05-22-users-mvp-design.md`

## Overview

The Users module manages tenant staff accounts after Auth has created the initial `shop_admin` during tenant registration. The module keeps staff lifecycle operations explicit and tenant-scoped under `/api/users`.

Users owns:

- Staff account creation by authenticated `shop_admin`.
- Staff list, detail, and update (`fullName`, `status`, temporary password reset).
- Tenant-isolated staff management using `authContext.tenantId`.

Users does not own:

- Public tenant registration.
- Login, refresh, logout, and `GET /api/auth/me`.
- Staff self-profile endpoints.
- `shop_admin` account management.
- `super_admin` user administration.
- Invite-email onboarding.
- Physical user deletion.

Target users:

- `shop_admin`: create and manage staff in their own tenant.
- Backend developers: implement staff APIs consistently with existing Auth/Tenants/Foundation patterns.
- Future Web Admin screens: consume Users API contract safely.

Success criteria:

- Users router is mounted at `/api/users`.
- All Users endpoints require valid access tokens.
- Only `shop_admin` can access Users endpoints in MVP.
- Every Users query/mutation is scoped to the caller tenant and `STAFF` role only.
- Users responses never expose `passwordHash`, `deletedAt`, refresh tokens, or authorization secrets.
- No `DELETE /api/users/:id` is implemented in MVP.
- Disabled staff cannot authenticate because Auth already blocks `UserStatus.DISABLED`.

## Product Requirements

### MVP Features

1. Create staff
   - `POST /api/users`
   - Creates a `STAFF` user in caller tenant with `ACTIVE` status.
   - Hashes incoming password before persistence.

2. List staff
   - `GET /api/users`
   - Pagination + optional `status` and `q` filters.
   - Search over `email` and `fullName`.

3. Staff detail
   - `GET /api/users/:id`
   - Returns one staff user from caller tenant.

4. Update staff
   - `PATCH /api/users/:id`
   - Optional updates: `fullName`, `status`, `password`.
   - Requires at least one valid field.

5. Observability
   - Reuse shared request/logging middleware.
   - Emit safe Users events without leaking secrets.

### Out Of Scope

- Staff self-service profile endpoints in Users (`/api/auth/me` remains source of truth).
- Any endpoint for managing `shop_admin` or `super_admin` users.
- Invite-email flow for staff onboarding.
- Physical delete endpoint (`DELETE /api/users/:id`).
- New Users-specific health endpoint.
- Automatic migration execution at app startup.

### Business Rules

- Staff onboarding is admin-created: `shop_admin` submits email/fullName/password.
- Created staff defaults to `status = ACTIVE` and `role = STAFF`.
- Users module must derive tenant scope from `request.authContext.tenantId` only.
- Client-provided `tenantId`, `role`, `status` (on create), `passwordHash`, ids, and timestamps are rejected.
- Unknown, deleted, cross-tenant, or non-STAFF targets resolve to `NOT_FOUND` for detail/update.
- Email uniqueness is global because Prisma `User.email` is unique.

### User Flows

Create staff:

```text
shop_admin sends POST /api/users with email/fullName/password
-> Backend validates body
-> Backend normalizes email (trim + lowercase)
-> Backend checks uniqueness by User.email
-> Backend hashes password
-> Backend creates User with tenantId from authContext, role STAFF, status ACTIVE
-> Backend logs safe user.staff.created event
-> Backend returns safe user DTO
```

List staff:

```text
shop_admin sends GET /api/users?page=1&pageSize=20&status=ACTIVE&q=nguyen
-> Backend validates query
-> Backend builds where: tenantId + role STAFF + deletedAt null (+ optional filters)
-> Backend queries total and paginated items ordered by createdAt desc
-> Backend returns { items, page, pageSize, total }
```

Detail/update staff:

```text
shop_admin sends GET/PATCH /api/users/:id
-> Backend validates params/body
-> Backend scopes target by id + caller tenant + role STAFF + deletedAt null
-> If missing: return NOT_FOUND
-> If PATCH: update allowlisted fields only
-> If password provided: hash password before update
-> Backend logs safe update/status/password-reset events
-> Backend returns safe user DTO
```

## Technical Architecture

### System Type

Users is a backend REST module inside the existing Express API.

Chosen architecture:

- Dedicated `backend/src/modules/users` module.
- Route/controller/service/schema/types/logging split, matching Auth and Tenants style.
- Reuse shared middleware, validation, errors, logging, and Prisma client.

Alternatives considered:

- Add staff CRUD into Auth.
  - Fewer files initially.
  - Rejected because Auth should remain focused on authentication/session lifecycle.
- Build a general Admin module first.
  - Could group future admin features.
  - Rejected for MVP to keep staff behavior explicit and low-risk.

### Existing Stack

- Runtime: Node.js.
- HTTP framework: Express.
- Language: TypeScript.
- Validation: Zod via `shared/validation/validate-request`.
- Database access: Prisma.
- Database: MySQL.
- Auth/RBAC: existing `authRequired`, role guards, and `authContext`.
- Error shape: Foundation `AppError` + global error handler.
- Logging: requestId middleware + requestLogger + pino.
- Tests: Vitest + Supertest.

### Request Pipeline

```text
Client
  |
  v
Express app
  |
  +-- requestIdMiddleware
  +-- requestLogger
  +-- authContextMiddleware
  |
  v
/api/users router
  |
  +-- authRequired
  +-- requireRole(shop_admin)
  +-- requireTenantUser
  +-- validateRequest
  |
  v
users.controller
  |
  v
users.service
  |
  v
Prisma User model
```

## Data Models

The module uses existing Prisma `User` model and enums.

Relevant model fields:

```prisma
model User {
  id           String     @id @default(uuid())
  tenantId     String?
  email        String     @unique
  passwordHash String
  fullName     String
  role         UserRole
  status       UserStatus @default(ACTIVE)
  lastLoginAt  DateTime?
  deletedAt    DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}
```

Relevant enums:

```prisma
enum UserRole {
  SHOP_ADMIN
  STAFF
  SUPER_ADMIN
}

enum UserStatus {
  ACTIVE
  DISABLED
}
```

Users DTO:

```ts
type UserStaffDto = {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: "STAFF";
  status: "ACTIVE" | "DISABLED";
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};
```

Never expose:

```text
passwordHash
deletedAt
refreshTokens
authorization headers
token material
```

## API Contract

Base path:

```text
/api/users
```

All endpoints require:

```text
Authorization: Bearer <accessToken>
```

Allowed role in MVP:

```text
shop_admin
```

### POST /api/users

Purpose:

- Create a staff account in current tenant.

Request body:

```json
{
  "email": "staff@example.com",
  "fullName": "Nguyen Van A",
  "password": "Temp@123456"
}
```

Server-controlled fields:

```text
tenantId = authContext.tenantId
role = STAFF
status = ACTIVE
passwordHash = hash(password)
```

Success response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "tenantId": "tenant-id",
      "email": "staff@example.com",
      "fullName": "Nguyen Van A",
      "role": "STAFF",
      "status": "ACTIVE",
      "lastLoginAt": null,
      "createdAt": "2026-05-22T00:00:00.000Z",
      "updatedAt": "2026-05-22T00:00:00.000Z"
    }
  }
}
```

### GET /api/users

Purpose:

- Return paginated staff list in current tenant.

Query params:

```text
page=1
pageSize=20
status=ACTIVE
q=nguyen
```

Query rules:

- `page`: default `1`, min `1`.
- `pageSize`: default `20`, min `1`, max `100`.
- `status`: optional `ACTIVE` or `DISABLED`.
- `q`: optional trimmed string, max `100`, search on `email` and `fullName`.
- Sort: `createdAt desc`.

Success response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "user-id",
        "tenantId": "tenant-id",
        "email": "staff@example.com",
        "fullName": "Nguyen Van A",
        "role": "STAFF",
        "status": "ACTIVE",
        "lastLoginAt": null,
        "createdAt": "2026-05-22T00:00:00.000Z",
        "updatedAt": "2026-05-22T00:00:00.000Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

### GET /api/users/:id

Purpose:

- Return one staff account in current tenant.

Params:

- `id`: non-empty trimmed string.

Query behavior:

- Scope by `id + tenantId + role=STAFF + deletedAt=null`.
- Unknown/deleted/cross-tenant/non-staff resolves to `404 NOT_FOUND`.

### PATCH /api/users/:id

Purpose:

- Update one staff account in current tenant.

Request body:

```json
{
  "fullName": "Nguyen Van B",
  "status": "DISABLED",
  "password": "NewTemp@123456"
}
```

Rules:

- Allowed optional fields: `fullName`, `status`, `password`.
- At least one valid field is required.
- Password updates are temporary-reset style and must be hashed.
- Rejected fields: `id`, `email`, `tenantId`, `role`, `passwordHash`, `deletedAt`, `createdAt`, `updatedAt`, `lastLoginAt`.
- Unknown/deleted/cross-tenant/non-staff resolves to `404 NOT_FOUND`.

## Validation Specification

Recommended schema file:

```text
backend/src/modules/users/users.schema.ts
```

Rules:

- `email`: string, `trim().toLowerCase()`, valid email.
- `fullName`: string, `trim()`, min `1`, max `120`.
- `password`: reuse Auth password-strength rule.
- `status`: enum `ACTIVE` | `DISABLED`.
- `id` params: non-empty trimmed string.
- Create and patch bodies use `.strict()`.
- Patch body requires at least one valid field.
- List query parses numeric pagination and normalizes optional `q`.

Implementation notes:

- Use existing `validateRequest` middleware.
- Keep validated/normalized values on request object for controllers.
- Do not run DB/migration/server/test/typecheck commands autonomously in this workspace.

## Authorization And Security

### Role Matrix

```text
Endpoint              super_admin   shop_admin   staff
POST /api/users       no            yes          no
GET /api/users        no            yes          no
GET /api/users/:id    no            yes          no
PATCH /api/users/:id  no            yes          no
```

Required guards:

- `authRequired` on all routes.
- `requireRole("shop_admin")` on all routes.
- `requireTenantUser` to enforce tenant-bound context.

Security rules:

- Never trust client `tenantId` values.
- Never manage `SHOP_ADMIN`/`SUPER_ADMIN` through `/api/users` in MVP.
- Never return secrets (`passwordHash`, tokens, raw auth data).
- Always filter by `deletedAt: null`.
- Global email uniqueness conflicts return `409 CONFLICT`.

## Data And Query Behavior

Base where clause for all staff targets:

```ts
{
  tenantId: authContext.tenantId,
  role: "STAFF",
  deletedAt: null,
}
```

List behavior:

- Optional `status` filter.
- Optional case-insensitive contains search over `email` and `fullName`.
- `skip = (page - 1) * pageSize`, `take = pageSize`.
- `orderBy: { createdAt: "desc" }`.
- Return `{ items, page, pageSize, total }`.

Update behavior:

- Load target by scoped where clause.
- Build update payload from allowlist only.
- Hash password only when password field is present.
- Emit status-change event only when status actually changes.

## Error Behavior

Use Foundation error response shape.

```text
401 UNAUTHORIZED
```

- Missing, malformed, invalid, or expired access token.

```text
403 FORBIDDEN
```

- Authenticated caller is not `shop_admin`.
- Tenant context is missing.

```text
400 VALIDATION_ERROR
```

- Invalid body/query/params.
- Unknown fields in strict schemas.
- Patch request with no valid update fields.

```text
404 NOT_FOUND
```

- Staff target does not exist.
- Target is soft-deleted.
- Target belongs to another tenant.
- Target exists but role is not `STAFF`.

```text
409 CONFLICT
```

- Email already exists.

## Observability, Health, And Operations

Reuse shared middleware/services:

```text
requestIdMiddleware
requestLogger
authContextMiddleware
pino logger
```

Recommended events:

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
raw request body
raw request headers
```

Health and operations:

- No Users-specific health endpoint in MVP.
- Existing app-level health endpoints remain source of health status.
- Do not run migrations automatically at startup.
- Do not physically delete users in MVP.
- Auth already blocks `DISABLED` users from login/refresh/me.

## System Maps

### Architecture Diagram

```text
Client
  |
  v
/api/users routes
  |
  +-- authRequired
  +-- requireRole(shop_admin)
  +-- requireTenantUser
  +-- validateRequest
  |
  v
users.controller
  |
  v
users.service
  |
  v
Prisma User
```

### Data Relations

```text
Tenant 1 ---- many User

Users module only mutates users where:
- user.tenantId == authContext.tenantId
- user.role == STAFF
- user.deletedAt == null
```

### User Flow Map

```text
shop_admin -> create/list/detail/update staff -> Users module -> Prisma User
staff -> denied on /api/users -> FORBIDDEN
super_admin -> denied on /api/users in MVP -> FORBIDDEN
```

## File Structure

Expected module files:

```text
backend/src/modules/users/
  users.routes.ts
  users.controller.ts
  users.service.ts
  users.schema.ts
  users.types.ts
  users.logging.ts
```

Expected app integration:

```text
backend/src/app.ts
```

Mount requirement:

```ts
app.use("/api/users", usersRouter);
```

Expected tests:

```text
backend/tests/users/users.api.test.ts
backend/tests/users/users.service.test.ts
backend/tests/users/users.unit.test.ts
```

## Development Phases

- [ ] Phase 1: Module skeleton
  - Create users routes/controller/service/schema/types/logging files.
  - Mount router at `/api/users`.

- [ ] Phase 2: DTOs and validation
  - Add safe staff DTO mapping.
  - Add strict create/list/detail/patch schemas.
  - Reuse Auth password rule in Users schema.

- [ ] Phase 3: Create and list endpoints
  - Implement `POST /api/users` with hashed password.
  - Implement `GET /api/users` with pagination and filters.

- [ ] Phase 4: Detail and update endpoints
  - Implement `GET /api/users/:id` with scoped lookup.
  - Implement `PATCH /api/users/:id` with allowlisted updates.

- [ ] Phase 5: Security and observability hardening
  - Enforce tenant/role isolation everywhere.
  - Add safe Users logs and verify no secret leakage.

- [ ] Phase 6: Tests and acceptance
  - Add API/service/unit coverage for auth, RBAC, validation, isolation, conflicts, and DTO safety.
  - Ask user/team to run test/typecheck commands per workspace constraints.

## Testing Requirements

Required API/security cases:

- Missing/malformed/invalid/expired access token returns `401`.
- `staff` and `super_admin` cannot access `/api/users` endpoints.
- `shop_admin` can create staff successfully.
- Duplicate email returns `409`.
- Create rejects client-provided protected fields.
- List supports pagination defaults and bounds.
- List supports `status` filter and `q` search (`email`, `fullName`).
- Detail returns `404` for unknown/deleted/cross-tenant/non-staff target.
- Patch updates `fullName`.
- Patch updates `status`.
- Patch updates password and stores hash (not raw value).
- Patch rejects empty/no-op payload.
- Responses never expose `passwordHash`, `deletedAt`, or token material.
- Logs never contain password/token/raw header/raw body values.

Manual verification remains user/team-run work in this workspace.

## Acceptance Checklist

- [ ] `/api/users` router is mounted.
- [ ] All Users endpoints require valid access tokens.
- [ ] Only `shop_admin` can access Users endpoints in MVP.
- [ ] Users module scopes all operations by `authContext.tenantId`.
- [ ] Users module scopes all operations to `role=STAFF` and `deletedAt=null`.
- [ ] No endpoint allows managing `shop_admin`/`super_admin` users.
- [ ] `POST /api/users` hashes password and returns safe DTO.
- [ ] `GET /api/users` returns paginated/filterable staff list.
- [ ] `GET /api/users/:id` returns scoped staff detail or `NOT_FOUND`.
- [ ] `PATCH /api/users/:id` updates only allowlisted fields.
- [ ] `DELETE /api/users/:id` is not implemented in MVP.
- [ ] No response/log exposes secrets (`passwordHash`, tokens, raw auth data).

## Open Questions

None for Users MVP based on approved design scope.

Future decisions beyond MVP:

- Invite-email onboarding flow for staff.
- Self-service staff profile endpoints in Users.
- Fine-grained permissions beyond current role model.
- Administrative user management for `shop_admin` and cross-tenant operations.

## References

- Users design source: `docs/module/users/2026-05-22-users-mvp-design.md`
- Users implementation plan: `docs/plans/2026-05-22-users-mvp-implementation-plan.md`
- Backend design: `docs/backend/2026-05-17-cloudcms-backend-design.md`
- Existing Prisma schema: `backend/prisma/schema.prisma`
- Existing Auth module: `backend/src/modules/auth/`
- Existing Tenants module: `backend/src/modules/tenants/`
