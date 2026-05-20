# CloudCMS Auth Module Specification

## Overview

The Auth module is the first business module after the CloudCMS backend Foundation. It replaces the Foundation placeholder authentication context with real authentication for CloudCMS admin APIs.

Auth solves these problems:

- New shop tenants need a public registration flow that verifies the admin email before creating real tenant/user records.
- Admin users need secure login, refresh-token rotation, logout, and current-user lookup.
- Later modules need a consistent `req.authContext` containing user, tenant, role, and token information.

Target users:

- `shop_admin`: the first tenant admin created by public tenant registration.
- `staff`: tenant users created later by the users module.
- `super_admin`: a system-level account that is not created by public tenant registration.
- Backend developers implementing later tenant-scoped modules.

Success criteria:

- Tenant registration stores submitted data as pending until email verification succeeds.
- Verification creates exactly one active tenant and one active `shop_admin`, then auto-logins.
- Login, refresh, logout, and `me` follow Foundation response shapes.
- Refresh tokens and verification codes are stored only as hashes.
- Auth logs include useful security metadata without leaking secrets.
- Automated tests do not send real emails; local development uses configured SMTP.

Source design:

- `docs/module/auth/2026-05-19-cloudcms-auth-design.md`
- `docs/backend/foundation/2026-05-17-cloudcms-backend-design.md`
- `docs/tdd/foundation/technical-design.md`

## Product Requirements

### MVP Features

- Public tenant registration request: `POST /api/auth/register-tenant`.
- Tenant registration verification: `POST /api/auth/register-tenant/verify`.
- Email/password login: `POST /api/auth/login`.
- Refresh-token rotation: `POST /api/auth/refresh`.
- Idempotent logout: `POST /api/auth/logout`.
- Current user lookup: `GET /api/auth/me`.
- JWT access-token authentication middleware.
- Role helpers for route-level authorization.
- SMTP-backed verification email delivery for local/prod environments.
- Mock email sender for automated tests.

### Out Of Scope

- Tenant CRUD after initial registration.
- User/staff CRUD.
- Detailed permission management beyond role helpers.
- Creating `super_admin` through public registration.
- Client PC registration, device tokens, and Socket.IO authentication.
- Sessions, usage, URL rules, assets, subscriptions, and full audit storage.
- Running Prisma migrations or database setup automatically at application startup.

### Business Rules

- Every email belongs to one user account globally.
- Email is normalized with `trim().toLowerCase()` before storage and lookup.
- Public tenant registration creates only `shop_admin`.
- `staff` users are created later by the users module.
- `super_admin` is system-level and may have `tenantId = null`.
- `shop_admin` and `staff` must have `tenantId`.
- Suspended tenants block login, refresh, and `me` for tenant users.
- Disabled users cannot login or refresh tokens.

### User Flows

Tenant registration:

```text
User submits tenantName, tenantCode, adminFullName, adminEmail, adminPassword
-> Backend validates input
-> Backend checks tenantCode is unused
-> Backend checks adminEmail is unused
-> Backend hashes adminPassword
-> Backend creates VerificationCode with purpose REGISTER_TENANT
-> Backend creates PendingTenantRegistration linked to VerificationCode
-> Backend sends verification code to adminEmail
-> Backend returns registrationId
-> User submits registrationId + verificationCode
-> Backend verifies pending registration and code
-> Backend checks tenantCode and adminEmail again to avoid races
-> Backend creates Tenant, shop_admin User, consumed markers, and RefreshToken in one transaction
-> Backend signs access token
-> Backend returns tenant, user, accessToken, refreshToken
```

Login:

```text
User submits email + password
-> Backend normalizes email
-> Backend verifies password against passwordHash
-> Backend rejects disabled user or suspended tenant
-> Backend updates lastLoginAt
-> Backend creates RefreshToken
-> Backend returns user, accessToken, refreshToken
```

Refresh:

```text
Client submits refreshToken
-> Backend hashes refreshToken
-> Backend finds non-expired, non-revoked token
-> Backend rejects disabled user or suspended tenant
-> Backend revokes old refresh token
-> Backend creates a new refresh token with same familyId
-> Backend returns new accessToken and refreshToken
```

Logout:

```text
Client submits refreshToken
-> Backend hashes refreshToken
-> Backend revokes matching token if found
-> Backend returns success even when token is missing, expired, or already revoked
```

Current user:

```text
Client sends Authorization: Bearer <accessToken>
-> authRequired verifies JWT access token
-> Middleware attaches req.authContext
-> Backend loads current User and Tenant
-> Backend returns user and tenant
```

## Technical Architecture

### Stack

- Runtime: Node.js 22.
- Package manager: npm.
- Language: TypeScript.
- HTTP framework: Express.
- Database: MySQL through Prisma v6.
- Tests: Vitest.
- Logging: Pino through Foundation logger.
- Access tokens: JWT.
- Refresh tokens: random opaque secrets stored as DB hashes.
- Password hashing: bcrypt or argon2.
- Email: nodemailer-compatible SMTP adapter.

### Architecture Pattern

Use the existing Foundation route-controller-service style.

```text
HTTP request
-> auth.routes.ts
-> auth.controller.ts
-> auth.schema.ts validation
-> auth.service.ts
-> Prisma models
-> response helpers / error middleware
```

Shared helpers:

```text
auth.tokens.ts        JWT, refresh token generation, token hashing
auth.password.ts      password hashing and verification
auth.verification.ts  verification code generation and hashing
auth.middleware.ts    authRequired
auth.rbac.ts          requireRole and requireTenantUser
auth.logging.ts       masked/hash identifiers and event helpers
shared/email/*        SMTP and mock email sender adapters
```

### Runtime Boundaries

Auth owns:

- Initial tenant onboarding.
- Email verification for tenant registration.
- Login, refresh, logout, and current-user lookup.
- JWT access-token context for later modules.

Auth does not own:

- Long-term tenant administration.
- Staff/user management after registration.
- Full audit persistence.
- Device or socket authentication.

### Response Shapes

Success:

```json
{ "success": true, "data": {} }
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

## Data Models

Auth adds five Prisma models:

```text
Tenant
User
RefreshToken
VerificationCode
PendingTenantRegistration
```

### Tenant

Fields:

```text
id
code
name
status
deletedAt
createdAt
updatedAt
```

Rules:

- `code` is globally unique.
- `status` is `ACTIVE` or `SUSPENDED`.
- `deletedAt` supports later soft delete.
- Registration verification creates tenants with `status = ACTIVE`.

### User

Fields:

```text
id
tenantId nullable
email
passwordHash
fullName
role
status
lastLoginAt
deletedAt
createdAt
updatedAt
```

Rules:

- `email` is globally unique and normalized.
- `role` is `super_admin`, `shop_admin`, or `staff`.
- `status` is `ACTIVE` or `DISABLED`.
- `tenantId` is nullable only for `super_admin`.
- Tenant users must have `tenantId`.

### RefreshToken

Fields:

```text
id
userId
tokenHash
familyId
expiresAt
revokedAt
replacedByTokenId
createdAt
updatedAt
```

Rules:

- Raw refresh tokens are returned once and never stored.
- `tokenHash` is unique.
- Refresh rotates on every successful refresh.
- Logout sets `revokedAt`.
- `familyId` supports later reuse detection and family-wide revocation.

### VerificationCode

Fields:

```text
id
targetType
target
purpose
codeHash
expiresAt
consumedAt
attemptCount
lastSentAt
createdAt
updatedAt
```

Rules:

- `targetType` starts with `EMAIL`.
- `target` is the normalized email.
- `purpose` starts with `REGISTER_TENANT`.
- Future purposes may include `RESET_PASSWORD`, `CHANGE_EMAIL`, and `INVITE_STAFF`.
- Raw codes are never stored.
- Codes expire after about 10 minutes.
- Codes are single-use.
- Failed attempts increment `attemptCount`.
- After about 5 failed attempts, the code is treated as unusable.
- `lastSentAt` supports resend cooldown if resend is added later.

### PendingTenantRegistration

Fields:

```text
id
verificationCodeId
tenantName
tenantCode
adminFullName
adminEmail
adminPasswordHash
expiresAt
consumedAt
createdAt
updatedAt
```

Rules:

- Created when the user submits the full registration form.
- `Tenant` and `User` are not created until verification succeeds.
- `adminPasswordHash` is stored; raw password is never stored.
- `expiresAt` is normally the same as, or slightly longer than, the linked code expiration.
- `consumedAt` is set after successful tenant/user creation.

### Indexes And Constraints

```text
Tenant.code unique
User.email unique
RefreshToken.tokenHash unique
RefreshToken(userId, revokedAt)
RefreshToken(expiresAt)
VerificationCode(target, purpose, consumedAt)
VerificationCode(expiresAt)
PendingTenantRegistration.verificationCodeId unique
PendingTenantRegistration(adminEmail, consumedAt)
PendingTenantRegistration(tenantCode, consumedAt)
PendingTenantRegistration(expiresAt)
```

## API Endpoints

### POST /api/auth/register-tenant

Purpose: accept the full registration form, create pending registration data, and send an email verification code.

Request:

```json
{
  "tenantName": "Cyber Game Q1",
  "tenantCode": "CYBER_Q1",
  "adminFullName": "Nguyen Van A",
  "adminEmail": "admin@cyberq1.vn",
  "adminPassword": "StrongPassword123!"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "registrationId": "pending-registration-id",
    "email": "admin@cyberq1.vn",
    "expiresInSeconds": 600,
    "resendAfterSeconds": 60
  }
}
```

Implementation rules:

- Normalize `adminEmail`.
- Validate `tenantCode` is unused by real tenants.
- Validate `adminEmail` is unused by real users.
- Hash `adminPassword` before storing pending registration.
- Create `VerificationCode` with purpose `REGISTER_TENANT`.
- Create `PendingTenantRegistration`.
- Send the code through configured SMTP email sender.
- Never return the verification code.

### POST /api/auth/register-tenant/verify

Purpose: verify the email code and complete tenant registration.

Request:

```json
{
  "registrationId": "pending-registration-id",
  "verificationCode": "483920"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant-id",
      "code": "CYBER_Q1",
      "name": "Cyber Game Q1",
      "status": "ACTIVE"
    },
    "user": {
      "id": "user-id",
      "email": "admin@cyberq1.vn",
      "fullName": "Nguyen Van A",
      "role": "shop_admin",
      "tenantId": "tenant-id"
    },
    "accessToken": "jwt-access-token",
    "refreshToken": "refresh-token"
  }
}
```

Implementation rules:

- Load pending registration by `registrationId`.
- Reject expired or consumed pending registrations.
- Verify the linked `VerificationCode`.
- Increment `attemptCount` on wrong code.
- Check `tenantCode` and `adminEmail` again before creating real records.
- In one DB transaction:
  - Create `Tenant` with `status = ACTIVE`.
  - Create `User` with `role = shop_admin` and `status = ACTIVE`.
  - Mark `VerificationCode` as consumed.
  - Mark `PendingTenantRegistration` as consumed.
  - Create `RefreshToken`.
- Sign an access token.
- Return tenant, user, access token, and refresh token.

### POST /api/auth/login

Request:

```json
{
  "email": "admin@cyberq1.vn",
  "password": "StrongPassword123!"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "admin@cyberq1.vn",
      "fullName": "Nguyen Van A",
      "role": "shop_admin",
      "tenantId": "tenant-id"
    },
    "accessToken": "jwt-access-token",
    "refreshToken": "refresh-token"
  }
}
```

Implementation rules:

- Normalize email.
- Return a generic error for wrong email or password.
- Reject `DISABLED` users.
- Reject `SUSPENDED` tenants for `shop_admin` and `staff`.
- Update `lastLoginAt`.
- Create a refresh token and return both tokens.

### POST /api/auth/refresh

Request:

```json
{
  "refreshToken": "refresh-token"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-access-token",
    "refreshToken": "new-refresh-token"
  }
}
```

Implementation rules:

- Hash the incoming refresh token.
- Find a matching token that is not expired and not revoked.
- Reject disabled users and suspended tenants.
- Revoke the old refresh token.
- Create a new refresh token with the same `familyId`.
- Return a new access token and refresh token.

### POST /api/auth/logout

Request:

```json
{
  "refreshToken": "refresh-token"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "loggedOut": true
  }
}
```

Implementation rules:

- Hash the incoming refresh token.
- If a matching token exists, set `revokedAt`.
- Return success even if the token does not exist or is already invalid.

### GET /api/auth/me

Request:

```text
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "admin@cyberq1.vn",
      "fullName": "Nguyen Van A",
      "role": "shop_admin",
      "tenantId": "tenant-id"
    },
    "tenant": {
      "id": "tenant-id",
      "code": "CYBER_Q1",
      "name": "Cyber Game Q1",
      "status": "ACTIVE"
    }
  }
}
```

Implementation rules:

- Requires a valid JWT access token.
- `super_admin` can have `tenant = null`.
- `shop_admin` and `staff` must have an active tenant.
- Never return `passwordHash`, `tokenHash`, `codeHash`, secrets, or raw JWT payloads.

## Middleware And RBAC

Auth replaces the Foundation placeholder with real authentication context.

```text
req.authContext
- userId
- tenantId
- role
- tokenType
```

For `super_admin`:

```text
tenantId = null
role = super_admin
```

For tenant users:

```text
tenantId = current tenant id
role = shop_admin or staff
```

### authRequired

Responsibilities:

- Read `Authorization: Bearer <accessToken>`.
- Verify JWT using `JWT_ACCESS_SECRET`.
- Require `tokenType = access`.
- Read `userId`, `tenantId`, and `role` from payload.
- Attach auth context to `req.authContext`.
- Return `UNAUTHORIZED` for missing, invalid, or expired tokens.

JWT payload:

```text
sub = userId
tenantId
role
tokenType = access
iat
exp
```

### requireRole

Responsibilities:

- Require `req.authContext.userId`.
- Return `FORBIDDEN` if role is not allowed.

Examples:

```text
requireRole("super_admin")
requireRole("shop_admin", "super_admin")
requireRole("shop_admin", "staff")
```

### requireTenantUser

Responsibilities:

- Require authenticated user with `tenantId`.
- Use for tenant-scoped APIs.

Middleware authenticates the token and attaches context. Services still check current user and tenant status for important operations.

## Security

### Passwords

- Never store raw passwords.
- Hash `adminPassword` before saving pending registration or user records.
- Prefer bcrypt or argon2.
- Enforce a minimum password policy.
- Never log passwords or password hashes.

### Tokens

- Access token is a short-lived JWT.
- Refresh token is a random opaque secret.
- Store only refresh token hashes in the database.
- Rotate refresh token on every successful refresh.
- Revoke refresh tokens on logout with `revokedAt`.
- Never log access tokens, refresh tokens, token hashes, or `Authorization` headers.

Suggested lifetimes:

```text
accessToken: 15 minutes
refreshToken: 30 days
verificationCode: 10 minutes
pending registration: 10-15 minutes
```

### Verification Codes

- Store only `codeHash`.
- Treat codes as single-use.
- Reject expired or consumed codes.
- Increment attempts on wrong code.
- Treat a code as unusable after about 5 failed attempts.

### Error Security

- Login failure returns a generic message.
- Verification failure returns a generic invalid-or-expired message.
- Duplicate email and tenant code may return clear form errors during registration.
- Production responses must not expose stack traces.

## Email Delivery

Use an email adapter:

```text
EmailSender
- sendVerificationCode(email, code, purpose)
```

Environment behavior:

- Local development and production use configured SMTP.
- Automated tests use a mock email sender.
- `.env.example` contains placeholders only.
- Missing SMTP env should fail startup or email sender configuration clearly when SMTP sender is selected.

Environment variables:

```text
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
SMTP_FROM_EMAIL
SMTP_FROM_NAME
```

## Rate Limits

Sensitive auth routes need endpoint-specific rate limits.

```text
POST /api/auth/register-tenant
key: IP + adminEmail
capacity: 3
refill: 1 token / 20 minutes

POST /api/auth/register-tenant/verify
key: registrationId + IP
capacity: 5
refill: blocked until code expires or a new code is issued

POST /api/auth/login
key: IP + email
capacity: 5
refill: 1 token / 3 minutes

POST /api/auth/refresh
key: token family or userId if known
capacity: 30
refill: 1 token / 2 seconds

POST /api/auth/logout
key: IP
capacity: 30
refill: 1 token / 2 seconds
```

## Logging And Observability

Auth uses the Foundation logger and request ID middleware.

Important events:

```text
register_tenant_requested
register_tenant_verification_sent
register_tenant_verification_failed
register_tenant_completed
login_succeeded
login_failed
refresh_succeeded
refresh_failed
logout_completed
me_loaded
auth_token_invalid
auth_token_expired
rate_limit_hit
```

Recommended fields:

```text
requestId
event
userId if known
tenantId if known
role if known
emailHash or maskedEmail
tenantCode if not sensitive
ip
userAgent
status
reason
durationMs
```

Never log:

```text
password
passwordHash
accessToken
refreshToken
tokenHash
verificationCode
codeHash
Authorization header
SMTP_PASSWORD
JWT secret
raw auth request body
```

Logging is not audit persistence. Auth MVP should expose service-level hook points for a later audit module, but it does not create an `AuditLog` table.

Future audit events:

```text
register tenant success/failure
login success/failure
logout
refresh rejected
auth/tenant violation
```

## System Maps

### Architecture

```text
Client
  |
  v
Express app
  |
  v
auth.routes.ts
  |
  v
auth.controller.ts
  |
  v
auth.schema.ts
  |
  v
auth.service.ts
  |--------------------|
  v                    v
Prisma/MySQL       EmailSender
  |                    |
  v                    v
Tenant/User/...    SMTP or Mock
```

### Data Relations

```text
Tenant 1 ---- many User
User 1 ---- many RefreshToken
VerificationCode 1 ---- 1 PendingTenantRegistration
```

### Registration Race Protection

```text
register-tenant checks tenantCode/adminEmail
-> pending registration waits for code
-> verify checks tenantCode/adminEmail again
-> transaction creates Tenant/User and consumes pending/code
```

## File Structure

Recommended source layout:

```text
backend/src/modules/auth/
  auth.routes.ts
  auth.controller.ts
  auth.service.ts
  auth.schema.ts
  auth.types.ts
  auth.tokens.ts
  auth.password.ts
  auth.verification.ts
  auth.middleware.ts
  auth.rbac.ts
  auth.logging.ts
```

Recommended shared email layout:

```text
backend/src/shared/email/
  email-sender.ts
  smtp-email-sender.ts
  mock-email-sender.ts
```

Implementation should update:

```text
backend/prisma/schema.prisma
backend/src/config/env.ts
backend/.env.example
backend/src/shared/middleware/auth-context.ts
backend/src/shared/middleware/auth-context.types.d.ts
backend/src/app.ts
backend/package.json
```

Likely dependencies:

```text
jsonwebtoken or jose
bcrypt or argon2
nodemailer
```

## Development Phases

- [ ] Phase 1: Add Prisma models, enums, indexes, and constraints.
- [ ] Phase 2: Add Auth utility modules for passwords, tokens, verification codes, and safe logging.
- [ ] Phase 3: Add email sender interface, SMTP implementation, mock implementation, and env configuration.
- [ ] Phase 4: Implement registration request and verification service flow.
- [ ] Phase 5: Implement login, refresh rotation, logout, and current-user service flows.
- [ ] Phase 6: Implement auth middleware, RBAC helpers, and auth-context typing.
- [ ] Phase 7: Add auth routes, controllers, schemas, and app mounting.
- [ ] Phase 8: Add unit, service, API, security/logging, and email tests.
- [ ] Phase 9: Add `.env.example` placeholders and local setup notes for SMTP.
- [ ] Phase 10: Run manual verification with real local SMTP values after the team provides env values.

## Testing Plan

### Unit Tests

- Normalize email with trim and lowercase.
- Hash and verify password.
- Generate random refresh token.
- Hash refresh token.
- Generate verification code.
- Hash and compare verification code.
- Sign and verify JWT access token.
- Reject expired JWT, wrong secret, and wrong `tokenType`.
- Mask or hash email for logs.

### Service Tests

- `register-tenant` creates `PendingTenantRegistration` and `VerificationCode`.
- `register-tenant` does not create `Tenant` or `User` before verification.
- `register-tenant` rejects duplicate tenant code.
- `register-tenant` rejects duplicate admin email.
- Verification with correct code creates `Tenant` and `shop_admin`.
- Verification marks pending registration and verification code as consumed.
- Verification creates refresh token and returns tokens.
- Verification rejects wrong code, expired code, and too many attempts.
- Login returns access and refresh tokens.
- Login failure returns a generic error.
- Login rejects disabled user.
- Login rejects suspended tenant.
- Refresh rotates old token to new token.
- Logout revokes refresh token.
- `me` returns the correct user and tenant.

### API Tests

- `POST /api/auth/register-tenant` returns `registrationId`.
- `POST /api/auth/register-tenant/verify` returns tenant, user, and tokens.
- Login works after register verification.
- `GET /api/auth/me` works with a valid access token.
- `GET /api/auth/me` without token returns `UNAUTHORIZED`.
- Refresh with a valid token returns new tokens.
- Logout is idempotent.
- Responses never include `passwordHash`, `tokenHash`, or `codeHash`.

### Security And Logging Tests

- Login failure does not reveal whether email exists.
- Expired access token is rejected.
- Revoked refresh token cannot be reused.
- Consumed verification code cannot be reused.
- Tenant code and email are checked again during verification.
- Tenant registration cannot create `super_admin` or `staff`.
- Auth failure logs include `requestId`.
- Auth logs use `maskedEmail` or `emailHash`.
- Logs never include raw password, access token, refresh token, verification code, or code hash.

### Email Tests

- Test environment uses mock `EmailSender`.
- Tenant registration calls `sendVerificationCode` with correct email and purpose.
- Local and production use SMTP configuration through env.
- Missing SMTP env fails startup or email sender configuration clearly.

### Manual Verification

- Run local backend with real SMTP env values.
- Submit tenant registration form.
- Receive email verification code.
- Verify the code.
- Confirm registration succeeds and returns tokens.
- Call `GET /api/auth/me` with access token.
- Logout and confirm old refresh token cannot be used.

## Open Questions

- None for MVP scope.
- Implementation-time choice remains between JWT library options (`jsonwebtoken` or `jose`) and password hashing options (`bcrypt` or `argon2`).

## References

- Primary design doc: `docs/module/auth/2026-05-19-cloudcms-auth-design.md`
- Backend design: `docs/backend/foundation/2026-05-17-cloudcms-backend-design.md`
- Foundation technical design: `docs/tdd/foundation/technical-design.md`
