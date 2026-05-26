# Computer Registration Secret Provisioning Design

Date: 2026-05-26

Status: Approved in chat on 2026-05-26 after section-by-section review.

## Goal

Make computer registration understandable and testable by provisioning a tenant-level `computerRegistrationSecret` during tenant onboarding and allowing the shop admin to reissue it if lost or compromised.

## Background

The Computers module already requires `tenantCode + registrationSecret + macAddress` for `POST /api/computers/register`. The backend verifies the submitted secret against `Tenant.computerRegistrationSecretHash` and returns a one-time `deviceToken` for the computer.

The missing product flow is how a tenant obtains the plain registration secret. Without that, manual Postman testing and real PC onboarding both require out-of-band DB setup.

## Decision

Use a long-lived tenant registration secret for MVP.

- Generate a random `computerRegistrationSecret` when `POST /api/auth/register-tenant/verify` completes successfully.
- Return the plain secret exactly once in the verify response.
- Store only a hash in `Tenant.computerRegistrationSecretHash`.
- Add a shop-admin-only reissue endpoint that generates a new secret, stores its hash, and returns the new plain secret exactly once.
- Reissue invalidates the previous registration secret immediately.

## Recommended API Contract

### Tenant verification response

`POST /api/auth/register-tenant/verify`

Add `computerRegistrationSecret` to `data`:

```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant-id",
      "code": "DEMO_CAFE",
      "name": "Demo Cafe",
      "status": "ACTIVE"
    },
    "user": {
      "id": "user-id",
      "email": "admin@example.com",
      "fullName": "Demo Admin",
      "role": "shop_admin",
      "tenantId": "tenant-id"
    },
    "accessToken": "access-token",
    "refreshToken": "refresh-token",
    "computerRegistrationSecret": "crs_live_generated_secret"
  }
}
```

### Reissue endpoint

`POST /api/tenants/me/computer-registration-secret/reissue`

Authorization:

- Requires valid access token.
- Requires `shop_admin` role.
- Requires tenant-bound user.

Request body:

```json
{
  "reason": "lost secret"
}
```

`reason` is optional, trimmed, max 200 characters, and only used for safe audit metadata.

Response:

```json
{
  "success": true,
  "data": {
    "computerRegistrationSecret": "crs_live_new_generated_secret"
  }
}
```

## Secret Format

Use a generated opaque value with a clear prefix:

```text
crs_live_<random-url-safe-token>
```

Requirements:

- High entropy.
- URL-safe/string-safe for copy-paste.
- Never derived from tenant code, email, tenant id, or user id.
- Never logged in plain text.

## Data Storage

Use the existing Prisma field:

```text
Tenant.computerRegistrationSecretHash
```

Only the hash is stored. The plain secret cannot be recovered after the response is sent.

No new table or Prisma field is required for the MVP. The existing nullable field remains valid:

```prisma
model Tenant {
  id                             String
  code                           String
  name                           String
  computerRegistrationSecretHash String?
  status                         TenantStatus
}
```

Approved storage rules:

- During `POST /api/auth/register-tenant/verify`, generate a plain secret, hash it, and store the hash in `Tenant.computerRegistrationSecretHash`.
- During reissue, generate a new plain secret, hash it, and overwrite `Tenant.computerRegistrationSecretHash`.
- Overwriting the hash invalidates the previous plain secret immediately.
- Do not persist the plain secret in any database table.
- Do not add `computerRegistrationSecretCreatedAt`, `computerRegistrationSecretRotatedAt`, or a registration-secret audit table in this MVP.

## Error Handling

- If auth is missing or invalid: `401 UNAUTHORIZED`.
- If role is not `shop_admin`: `403 FORBIDDEN`.
- If user has no tenant context: existing tenant-user authorization behavior applies.
- If tenant is missing/deleted: `404 NOT_FOUND` or existing current-tenant behavior.
- Unexpected failures return existing generic internal error shape without exposing secret material.

## Logging And Security

Logs may include:

- request id
- tenant id
- actor user id
- actor role
- event name
- reason length or sanitized reason if already allowed by existing log policy

Logs must not include:

- `computerRegistrationSecret`
- `computerRegistrationSecretHash`
- request body containing the secret
- authorization header
- access token
- refresh token
- device token

## Postman Testing Impact

The manual flow becomes straightforward:

1. Register tenant.
2. Verify email code.
3. Copy `data.computerRegistrationSecret` into Postman environment variable `registrationSecret`.
4. Register computer with `tenantCode + registrationSecret + macAddress`.
5. Copy returned `deviceToken` for realtime computer socket testing.

If the secret is lost, call the reissue endpoint and update the Postman `registrationSecret` variable.

## Alternatives Considered

### Out-of-band DB setup

Rejected for normal testing because it is confusing and blocks Postman-only verification.

### Short-lived invite key for every computer

Deferred. It is more secure but requires more concepts: invite creation, expiry, used state, extra DB table or fields, UI timing, and client handling. This is not needed for the MVP computer registration flow.

### Static human-chosen tenant password

Rejected. Human-chosen secrets are weaker and require a secure setup screen before the current MVP needs one.

## Success Criteria

- A new tenant receives a one-time `computerRegistrationSecret` during verification.
- `POST /api/computers/register` works without manual DB secret setup after tenant verification.
- Shop admin can reissue a lost secret.
- Old secret stops working after reissue.
- No API response except verify/reissue exposes the plain secret.
- No logs expose secret or hash material.
