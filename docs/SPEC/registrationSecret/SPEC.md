# CloudCMS Computer Registration Secret SPEC

Date: 2026-05-26

Status: Spec generated from approved design.

Source design: `docs/plans/2026-05-26-computer-registration-secret-design.md`

Source implementation plan: `docs/plans/2026-05-26-computer-registration-secret-implementation-plan.md`

## Overview

Computer registration currently requires `tenantCode + registrationSecret + macAddress` through `POST /api/computers/register`, but the approved product flow needs a clear way for a newly onboarded tenant to obtain the plain registration secret without manual database setup.

This spec adds tenant-level computer registration secret provisioning:

- Generate a high-entropy `computerRegistrationSecret` when tenant email verification succeeds.
- Return the plain secret exactly once in the tenant verification response.
- Store only `Tenant.computerRegistrationSecretHash`.
- Add a shop-admin-only reissue endpoint for lost or compromised secrets.
- Make Postman and real Client PC onboarding work without out-of-band DB writes.

Target users:

- New `shop_admin`: receives the first registration secret during tenant onboarding.
- Existing `shop_admin`: reissues the registration secret if it is lost or compromised.
- Client PC app: registers a computer using `tenantCode`, `registrationSecret`, and `macAddress`.
- Backend developers and QA: verify the registration flow without manual DB mutation.

Success criteria:

- A new tenant receives `data.computerRegistrationSecret` once from `POST /api/auth/register-tenant/verify`.
- `POST /api/computers/register` works after tenant verification without manual DB secret setup.
- `POST /api/tenants/me/computer-registration-secret/reissue` lets a tenant-bound `shop_admin` rotate the secret.
- Reissue invalidates the previous plain secret immediately.
- No API response except tenant verification and reissue exposes the plain registration secret.
- No logs expose plain registration secret, registration secret hash, authorization header, access token, refresh token, or device token.

## Product Requirements

### MVP Features

1. Initial secret provisioning
   - Triggered by successful `POST /api/auth/register-tenant/verify`.
   - Generate an opaque secret with format `crs_live_<random-url-safe-token>`.
   - Hash the secret and store it in `Tenant.computerRegistrationSecretHash`.
   - Return the plain secret once as `data.computerRegistrationSecret`.

2. Registration secret reissue
   - Endpoint: `POST /api/tenants/me/computer-registration-secret/reissue`.
   - Requires valid access token.
   - Requires `shop_admin` role.
   - Requires tenant-bound user context.
   - Accepts optional `reason`.
   - Generates a new secret, stores only its hash, and returns the new plain secret once.
   - Old secret must stop working immediately because the tenant hash is overwritten.

3. Computer registration compatibility
   - Existing `POST /api/computers/register` remains the consumer of the tenant registration secret.
   - No request contract change is required for computer registration.
   - Registration succeeds with the latest secret and fails with any replaced secret.

4. Safe observability
   - Log only safe metadata: request id, tenant id, actor user id, actor role, event name, and safe reason metadata.
   - Do not log raw request bodies for secret-bearing requests.
   - Do not log secret, hash, auth header, access token, refresh token, or device token.

### Out Of Scope

- New Prisma table for registration secret audit.
- New `Tenant` fields such as `computerRegistrationSecretCreatedAt` or `computerRegistrationSecretRotatedAt`.
- Recovering or displaying the current plain secret after the original response.
- Short-lived per-computer invite keys.
- Human-chosen tenant registration passwords.
- UI implementation for showing/copying the secret.
- Running Prisma CLI, migrations, DB setup, or server commands automatically in this workspace.

### Business Rules

- `computerRegistrationSecret` is tenant-level and long-lived for MVP.
- Plain secret must be generated randomly and must not be derived from tenant code, email, tenant id, or user id.
- Plain secret is unrecoverable after the response is sent.
- Only `Tenant.computerRegistrationSecretHash` is persisted.
- Reissue overwrites the tenant hash and therefore invalidates the old plain secret.
- `reason` is optional audit metadata only; it must not affect authorization or generation.
- `reason` must be trimmed and at most 200 characters.
- Reissue route must be declared before parameterized tenant routes such as `/:id`.
- Existing current-tenant authorization behavior applies when the tenant context is missing or stale.

### User Flows

New tenant onboarding:

```text
Shop admin submits tenant registration
-> Shop admin verifies email code through POST /api/auth/register-tenant/verify
-> Backend creates ACTIVE tenant and first shop_admin
-> Backend generates computerRegistrationSecret
-> Backend stores hash in Tenant.computerRegistrationSecretHash
-> Backend returns tenant, user, tokens, and plain computerRegistrationSecret once
-> Shop admin copies the secret into Postman or Client PC setup
-> Client PC registers through POST /api/computers/register
```

Lost or compromised registration secret:

```text
shop_admin calls POST /api/tenants/me/computer-registration-secret/reissue
-> Backend validates auth, role, tenant context, and body
-> Backend generates new computerRegistrationSecret
-> Backend hashes it and overwrites Tenant.computerRegistrationSecretHash
-> Backend returns the new plain secret once
-> Previous registration secret fails on future computer registration attempts
```

Manual Postman verification:

```text
POST /api/auth/register-tenant
-> POST /api/auth/register-tenant/verify
-> Save data.computerRegistrationSecret as registrationSecret
-> POST /api/computers/register with tenantCode + registrationSecret + macAddress
-> Save returned deviceToken
-> POST /api/tenants/me/computer-registration-secret/reissue
-> Confirm old registrationSecret fails and new registrationSecret succeeds
```

## Technical Architecture

### Recommended Approach

Use the existing backend architecture and existing tenant hash field.

- Backend: Node.js, Express, TypeScript.
- Validation: Zod through existing `validateRequest`.
- Persistence: Prisma with existing `Tenant.computerRegistrationSecretHash`.
- Hashing: reuse the Computers registration secret hashing helper.
- Authorization: existing `authRequired`, `requireRole("shop_admin")`, and `requireTenantUser`.
- Tests: Vitest and Supertest in the nearest auth, tenants, and computers test suites.

This approach keeps the MVP small and avoids schema churn while making onboarding testable.

### System Diagram

```text
Tenant Verify API
  POST /api/auth/register-tenant/verify
    -> generate crs_live_<token>
    -> hash secret
    -> create Tenant(computerRegistrationSecretHash)
    -> return plain secret once

Tenants API
  POST /api/tenants/me/computer-registration-secret/reissue
    -> authRequired
    -> validate body
    -> requireRole(shop_admin)
    -> requireTenantUser
    -> generate crs_live_<token>
    -> hash secret
    -> update current Tenant hash
    -> return plain secret once

Computers API
  POST /api/computers/register
    -> receive tenantCode + registrationSecret + macAddress
    -> compare registrationSecret with Tenant.computerRegistrationSecretHash
    -> issue one-time deviceToken
```

### Data Model

No new table or field is required.

```prisma
model Tenant {
  id                             String
  code                           String
  name                           String
  computerRegistrationSecretHash String?
  status                         TenantStatus
}
```

Storage rules:

- Verification create path sets `computerRegistrationSecretHash`.
- Reissue update path overwrites `computerRegistrationSecretHash`.
- Plain `computerRegistrationSecret` is never persisted.
- Existing nullable field remains valid for legacy or manually seeded tenants.

### API Contracts

#### `POST /api/auth/register-tenant/verify`

Existing request contract remains unchanged.

Successful response adds `computerRegistrationSecret` inside `data`:

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

Response rules:

- The plain secret appears only on successful verification.
- The response must not include `computerRegistrationSecretHash`.
- Existing error behavior for invalid or expired verification code remains unchanged.

#### `POST /api/tenants/me/computer-registration-secret/reissue`

Authorization:

- Missing or invalid access token returns `401 UNAUTHORIZED`.
- Valid user without `shop_admin` role returns `403 FORBIDDEN`.
- Missing tenant context uses existing tenant-user authorization behavior.
- Missing/deleted tenant returns `404 NOT_FOUND` or the existing current-tenant behavior.

Request body:

```json
{
  "reason": "lost secret"
}
```

Validation:

- `{}` is valid.
- `reason` is optional.
- `reason` is trimmed.
- `reason` max length is 200 characters.
- Unknown fields are rejected.

Successful response:

```json
{
  "success": true,
  "data": {
    "computerRegistrationSecret": "crs_live_new_generated_secret"
  }
}
```

### Secret Format

```text
crs_live_<random-url-safe-token>
```

Generation requirements:

- Use high-entropy cryptographic randomness.
- URL-safe and copy-paste safe.
- Non-deterministic.
- Not derived from tenant code, email, tenant id, user id, MAC address, or time alone.

Recommended implementation:

```ts
export const generateComputerRegistrationSecret = (): string =>
  `crs_live_${randomBytes(32).toString("base64url")}`;
```

## System Maps

### Data Relationship

```text
Tenant
  id
  code
  status
  computerRegistrationSecretHash
  |
  | used by
  v
Computer registration
  tenantCode + registrationSecret + macAddress
  -> verify secret hash
  -> create Computer
  -> issue deviceToken once
```

### Reissue Sequence

```text
shop_admin
  -> POST /api/tenants/me/computer-registration-secret/reissue
  -> authRequired
  -> validateRequest({ body: reissueComputerRegistrationSecretSchema })
  -> requireRole("shop_admin")
  -> requireTenantUser
  -> tenantsController.reissueComputerRegistrationSecret
  -> tenantsService.reissueComputerRegistrationSecret
  -> generate secret
  -> hash secret
  -> update Tenant.computerRegistrationSecretHash by authContext.tenantId
  -> return { computerRegistrationSecret }
```

### Security Boundary

```text
Plain secret may exist in memory during:
  - tenant verification request handling
  - reissue request handling
  - response serialization for those two endpoints only

Plain secret must not exist in:
  - database rows
  - logs
  - generic tenant DTOs
  - computer DTOs
  - auth failure responses
  - request logging payloads
```

## Design System

No frontend UI is in MVP scope.

If a future Web Admin screen is added, it should:

- Show the secret only immediately after verify or reissue.
- Warn the admin that the secret cannot be recovered later.
- Provide a copy action.
- Avoid storing the plain secret in browser persistence unless a later security review approves it.
- Require explicit confirmation before reissue because old setup material stops working immediately.

## File Structure

Expected implementation touchpoints:

```text
backend/src/modules/computers/computers.service.ts
  - generateComputerRegistrationSecret()
  - existing hashRegistrationSecret()

backend/src/modules/auth/auth.types.ts
  - VerifyRegisterTenantOutput includes computerRegistrationSecret

backend/src/modules/auth/auth.service.ts
  - generate/hash secret during tenant verification
  - persist computerRegistrationSecretHash during tenant create
  - return computerRegistrationSecret once

backend/src/modules/tenants/tenants.schema.ts
  - reissueComputerRegistrationSecretSchema

backend/src/modules/tenants/tenants.routes.ts
  - POST /me/computer-registration-secret/reissue before /:id routes

backend/src/modules/tenants/tenants.controller.ts
  - reissueComputerRegistrationSecret()

backend/src/modules/tenants/tenants.service.ts
  - reissueComputerRegistrationSecret()

backend/tests/computers/*
backend/tests/auth/*
backend/tests/tenants/*
  - focused unit, service, and Supertest coverage

docs/module/auth/*
docs/module/computers/*
docs/postman/*
  - contract and manual verification updates as needed
```

Spec artifacts:

```text
docs/SPEC/registrationSecret/SPEC.md
docs/SPEC/registrationSecret/CLAUDE.md
```

## Development Phases

- [ ] Phase 1: Add shared secret generator
  - Export `generateComputerRegistrationSecret()`.
  - Verify prefix, URL-safe body, and non-determinism.
  - Keep hashing helper behavior unchanged.

- [ ] Phase 2: Return initial secret from tenant verification
  - Add `computerRegistrationSecret` to verification output type.
  - Generate and hash secret before tenant creation.
  - Store only `computerRegistrationSecretHash`.
  - Return plain secret once in verify response.
  - Test stored hash does not contain the plain secret.

- [ ] Phase 3: Add reissue endpoint
  - Add strict Zod schema with optional trimmed `reason` max 200.
  - Add route before tenant `/:id` routes.
  - Enforce `authRequired`, `shop_admin`, and tenant-bound user.
  - Generate new secret, hash it, overwrite tenant hash, return plain secret once.
  - Test missing token, forbidden role, valid admin, body validation, and unknown field rejection.

- [ ] Phase 4: Verify rotation behavior
  - Test old secret fails after reissue.
  - Test new secret succeeds with fresh MAC.
  - Confirm no response exposes `computerRegistrationSecretHash`.

- [ ] Phase 5: Update docs and Postman guidance
  - Document verify response secret.
  - Document tenant-level secret and reissue path.
  - Update manual verification steps or Postman collection after implementation.

## Test Requirements

Minimum automated coverage:

- Generator unit test:
  - matches `^crs_live_[A-Za-z0-9_-]+$`
  - returns different values across calls

- Auth verification test:
  - success response includes `computerRegistrationSecret`
  - tenant create data includes `computerRegistrationSecretHash`
  - hash does not contain the plain secret
  - stored hash verifies against the returned plain secret

- Tenants reissue tests:
  - missing token returns `401`
  - staff token returns `403`
  - shop admin returns `200` and plain `computerRegistrationSecret`
  - `{}` is accepted
  - `{ "reason": "lost secret" }` is accepted and trimmed
  - unknown fields are rejected
  - reason longer than 200 chars is rejected

- Rotation test:
  - old secret fails `POST /api/computers/register`
  - new secret succeeds
  - no returned tenant or computer DTO includes old plain secret or hash

- Logging/security tests:
  - verify and reissue logs do not contain `computerRegistrationSecret`
  - logs do not contain `computerRegistrationSecretHash`
  - logs do not contain authorization header, access token, refresh token, or device token

## Security Requirements

Allowed log fields:

- request id
- tenant id
- actor user id
- actor role
- event name
- safe reason metadata, such as reason length or sanitized reason if allowed by existing log policy

Forbidden in logs and generic responses:

- `computerRegistrationSecret`
- `computerRegistrationSecretHash`
- raw request body containing any secret
- authorization header
- access token
- refresh token
- device token

Failure responses:

- Do not reveal whether a tenant code, old secret, or new secret exists.
- Use existing generic internal error shape for unexpected failures.
- Preserve existing auth and validation error conventions.

## Open Questions

- None for MVP implementation. The approved design chooses long-lived tenant registration secret provisioning and shop-admin reissue.

Deferred questions:

- Should a future version use short-lived per-computer invite keys?
- Should future Web Admin persist audit records for secret reissue?
- Should future UI require stronger confirmation or step-up auth before reissue?

---

## References

No supplement files are used for this spec. API contracts, data model, validation rules, security constraints, logging rules, testing requirements, and development phases are inline in this `SPEC.md`.
