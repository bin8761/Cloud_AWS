# CloudCMS Auth Module Design

## 1. Overview

The `auth` module is the first business module after Foundation. It turns the Foundation auth-context placeholder into real authentication for CloudCMS admin APIs.

This design is based on:

- Backend-wide design: `docs/backend/foundation/2026-05-17-cloudcms-backend-design.md`
- Foundation technical design: `docs/tdd/foundation/technical-design.md`
- Approved Auth brainstorming decisions from the current design session

Auth owns:

- Initial tenant registration.
- Email verification for tenant registration.
- Login.
- Refresh token rotation.
- Logout.
- Current user lookup.
- JWT access-token authentication context for later modules.

Auth does not own:

- Tenant CRUD after initial registration.
- User/staff CRUD.
- Detailed permission management.
- Client PC registration or device tokens.
- Socket.IO authentication.
- Sessions, usage, URL rules, assets, subscriptions, or full audit storage.

## 2. Requirements

### Functional Requirements

- `POST /api/auth/register-tenant` accepts the full tenant registration form, stores a pending registration, and sends a verification code by email.
- `POST /api/auth/register-tenant/verify` verifies the email code, creates the tenant and first `shop_admin`, auto-logins, and returns tokens.
- `POST /api/auth/login` authenticates a user with email and password.
- `POST /api/auth/refresh` rotates a valid refresh token and issues a new access token.
- `POST /api/auth/logout` revokes a refresh token.
- `GET /api/auth/me` returns the current user and tenant from a valid access token.
- Every email belongs to only one user account in the system.
- Public tenant registration creates only a `shop_admin`.
- `staff` users are created later by the users module.
- `super_admin` is a system-level account and is not created by public tenant registration.

### Non-Functional Requirements

- Access tokens are JWTs.
- Refresh tokens are random secrets stored only as DB hashes.
- Verification codes are stored only as DB hashes.
- Local development uses configured SMTP to send real verification emails.
- Automated tests use a mock email sender and must not send real emails.
- Auth logs must include `requestId` and useful event metadata, but never passwords, tokens, verification codes, or secrets.
- Auth endpoints use the Foundation response shapes:

```json
{ "success": true, "data": {} }
```

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

## 3. Data Model

Auth adds five Prisma models:

```text
Tenant
User
RefreshToken
VerificationCode
PendingTenantRegistration
```

### Tenant

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

- `Tenant.code` is globally unique.
- `status` is `ACTIVE` or `SUSPENDED`.
- `deletedAt` supports soft delete later.
- `register-tenant/verify` creates tenants with `status = ACTIVE`.

### User

```text
User
- id
- tenantId nullable
- email
- passwordHash
- fullName
- role
- status
- lastLoginAt
- deletedAt
- createdAt
- updatedAt
```

Rules:

- `User.email` is globally unique.
- Email is normalized with `trim().toLowerCase()` before storage and lookup.
- `role` is `super_admin`, `shop_admin`, or `staff`.
- `status` is `ACTIVE` or `DISABLED`.
- `tenantId` is nullable only to support `super_admin`.
- `shop_admin` and `staff` must have `tenantId`.
- Public tenant registration creates only one `shop_admin`.

### RefreshToken

```text
RefreshToken
- id
- userId
- tokenHash
- familyId
- expiresAt
- revokedAt
- replacedByTokenId
- createdAt
- updatedAt
```

Rules:

- The raw refresh token is returned to the client once and is never stored.
- `tokenHash` is unique.
- Refresh rotates on every successful refresh.
- Logout sets `revokedAt`.
- `familyId` supports later reuse detection and family-wide revocation.

### VerificationCode

`VerificationCode` is reusable for flows that need a one-time code, such as tenant registration, password reset, email change, or staff invite.

```text
VerificationCode
- id
- targetType
- target
- purpose
- codeHash
- expiresAt
- consumedAt
- attemptCount
- lastSentAt
- createdAt
- updatedAt
```

Rules:

- `targetType` starts with `EMAIL`.
- `target` is the normalized email.
- `purpose` starts with `REGISTER_TENANT`.
- Future purposes may include `RESET_PASSWORD`, `CHANGE_EMAIL`, and `INVITE_STAFF`.
- The raw code is never stored.
- Codes expire after about 10 minutes.
- Codes are single-use.
- Failed attempts increment `attemptCount`.
- After about 5 failed attempts, the code is treated as unusable.
- `lastSentAt` supports resend cooldown if resend is added later.

### PendingTenantRegistration

`PendingTenantRegistration` stores the submitted tenant registration form while waiting for email verification.

```text
PendingTenantRegistration
- id
- verificationCodeId
- tenantName
- tenantCode
- adminFullName
- adminEmail
- adminPasswordHash
- expiresAt
- consumedAt
- createdAt
- updatedAt
```

Rules:

- Created when the user submits the full registration form.
- `Tenant` and `User` are not created until code verification succeeds.
- `adminPasswordHash` is stored, never the raw password.
- `expiresAt` is normally the same as, or slightly longer than, the linked verification code expiration.
- `consumedAt` is set after successful tenant/user creation.

### Indexes and Constraints

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

## 4. API Contracts

Auth exposes six endpoints:

```text
POST /api/auth/register-tenant
POST /api/auth/register-tenant/verify
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

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

Rules:

- Normalize `adminEmail`.
- Validate that `tenantCode` is not already used by a real tenant.
- Validate that `adminEmail` is not already used by a real user.
- Hash `adminPassword` before storing pending registration.
- Create `VerificationCode` with purpose `REGISTER_TENANT`.
- Create `PendingTenantRegistration`.
- Send the code through the configured SMTP email sender.
- Never return the verification code in the response.

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

Rules:

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

Rules:

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

Rules:

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

Rules:

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

Rules:

- Requires a valid JWT access token.
- `super_admin` can have `tenant = null`.
- `shop_admin` and `staff` must have an active tenant.
- Never return `passwordHash`, `tokenHash`, `codeHash`, secrets, or raw internal JWT payloads.

## 5. Auth Flows

### Tenant Registration

```text
Người dùng nhập đầy đủ form đăng ký
-> Frontend gửi tenantName, tenantCode, adminFullName, adminEmail, adminPassword
-> Backend kiểm tra dữ liệu đầu vào
-> Backend kiểm tra tenantCode chưa tồn tại
-> Backend kiểm tra adminEmail chưa thuộc user nào
-> Backend hash adminPassword
-> Backend tạo VerificationCode với purpose REGISTER_TENANT
-> Backend tạo PendingTenantRegistration liên kết với VerificationCode
-> Backend gửi mã xác nhận đến adminEmail
-> Backend trả registrationId cho frontend
-> Frontend chuyển sang màn hình nhập mã xác nhận
```

```text
Người dùng nhập mã xác nhận
-> Frontend gửi registrationId + verificationCode
-> Backend tìm PendingTenantRegistration theo registrationId
-> Backend kiểm tra bản ghi pending chưa hết hạn và chưa dùng
-> Backend kiểm tra VerificationCode chưa hết hạn và chưa dùng
-> Backend so sánh mã người dùng nhập với codeHash
-> Nếu mã sai: tăng attemptCount và trả lỗi
-> Nếu mã đúng: kiểm tra lại tenantCode và adminEmail chưa bị dùng
-> Backend mở transaction DB
-> Tạo Tenant với status ACTIVE
-> Tạo User role shop_admin với status ACTIVE
-> Đánh dấu VerificationCode đã dùng
-> Đánh dấu PendingTenantRegistration đã dùng
-> Tạo RefreshToken
-> Ký access token
-> Trả tenant, user, accessToken, refreshToken
```

Duplicate `tenantCode` and `adminEmail` are checked twice: once when pending registration is created, and once when verification completes. The second check prevents race conditions while the user is waiting for or entering the email code.

### Login

```text
Người dùng nhập email và password
-> Frontend gửi email + password
-> Backend normalize email
-> Backend tìm User theo email
-> Backend so sánh password với passwordHash
-> Backend kiểm tra User đang ACTIVE
-> Nếu User là shop_admin/staff, Backend kiểm tra Tenant đang ACTIVE
-> Backend cập nhật lastLoginAt
-> Backend tạo RefreshToken
-> Backend ký access token
-> Backend trả user, accessToken, refreshToken
```

Login failure uses a generic message:

```text
Email hoặc mật khẩu không đúng
```

### Refresh

```text
Frontend gửi refreshToken
-> Backend hash refreshToken
-> Backend tìm RefreshToken theo tokenHash
-> Backend kiểm tra token chưa hết hạn và chưa bị revoke
-> Backend load User và Tenant liên quan
-> Backend kiểm tra User chưa bị DISABLED
-> Nếu User là shop_admin/staff, Backend kiểm tra Tenant chưa bị SUSPENDED
-> Backend revoke refresh token cũ
-> Backend tạo refresh token mới cùng familyId
-> Backend ký access token mới
-> Backend trả accessToken mới và refreshToken mới
```

### Logout

```text
Frontend gửi refreshToken
-> Backend hash refreshToken
-> Backend tìm RefreshToken theo tokenHash
-> Nếu tìm thấy, Backend đánh dấu revokedAt
-> Backend trả success
-> Frontend xóa token ở local state
```

Logout is idempotent. Missing, expired, or already revoked tokens still return success.

### Current User

```text
Frontend gửi GET /api/auth/me kèm Authorization: Bearer <accessToken>
-> Auth middleware kiểm tra access token
-> Middleware gắn userId, tenantId, role vào req.authContext
-> Backend load User hiện tại
-> Nếu User là shop_admin/staff, Backend load Tenant
-> Backend trả user và tenant
```

## 6. Middleware and RBAC

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

For `shop_admin` and `staff`:

```text
tenantId = tenant hiện tại
role = shop_admin hoặc staff
```

### authRequired

```text
authRequired
-> đọc Authorization: Bearer <accessToken>
-> verify JWT bằng JWT_ACCESS_SECRET
-> kiểm tra tokenType là access
-> lấy userId, tenantId, role từ payload
-> gắn vào req.authContext
-> nếu thiếu/sai/hết hạn thì trả UNAUTHORIZED
```

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

```text
requireRole(...roles)
-> yêu cầu req.authContext có userId
-> nếu role không thuộc danh sách cho phép thì trả FORBIDDEN
```

Examples:

```text
requireRole("super_admin")
requireRole("shop_admin", "super_admin")
requireRole("shop_admin", "staff")
```

### requireTenantUser

```text
requireTenantUser
-> yêu cầu user có tenantId
-> dùng cho API tenant-scoped
```

Middleware authenticates the token and attaches context. Service layer still checks real user and tenant status for important operations.

## 7. Security, Email, and Rate Limit

### Password Security

- Never store raw passwords.
- Hash `adminPassword` before saving pending registration or user records.
- Prefer bcrypt or argon2.
- Enforce a minimum password policy.
- Never log passwords or password hashes.

### Token Security

- Access token is a short-lived JWT.
- Refresh token is a random secret and is stored only as a DB hash.
- Refresh token rotates on every successful refresh.
- Logout revokes refresh tokens with `revokedAt`.
- Never log access tokens, refresh tokens, token hashes, or `Authorization` headers.

Suggested lifetimes:

```text
accessToken: 15 minutes
refreshToken: 30 days
verificationCode: 10 minutes
pending registration: 10-15 minutes
```

### Email Delivery

Email delivery uses an adapter:

```text
EmailSender
- sendVerificationCode(email, code, purpose)
```

Local development and production use configured SMTP. Automated tests use a mock email sender.

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

Real values are provided in local `.env` during implementation and local setup. `.env.example` should contain placeholders only.

### Rate Limit

Sensitive auth routes need endpoint-specific rate-limit configuration:

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

### Error Security

- Login failure returns a generic message.
- Verification failure returns a generic invalid-or-expired message.
- Register duplicate email or tenant code may return a clear form error.
- Production responses must not expose stack traces.

## 8. Logging and Observability

Auth uses the Foundation logger and request ID middleware.

Important auth events:

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

Recommended log fields:

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

Logging is not the same as audit. Auth MVP should expose clear service-level hook points for a later audit module, but it does not need to create an `AuditLog` table now.

Future audit events:

```text
register tenant success/failure
login success/failure
logout
refresh rejected
auth/tenant violation
```

## 9. Testing Plan

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

### Security and Logging Tests

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

## 10. Implementation Notes

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

Prisma CLI, migrations, database setup, and server commands remain user/team-run actions. The application must not run migrations during startup.
