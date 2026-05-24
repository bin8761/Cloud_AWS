# Task Breakdown: CloudCMS Computers Module

Source TDD: `docs/tdd/computers/2026-05-23-computers-technical-design.md`

Purpose: convert the Computers TDD into a developer-facing Markdown checklist that follows `rule/task-breakdown-rule.mdc`.

Implementation constraints:

- Backend source lives under `backend/`.
- Runtime is Node.js backend with TypeScript.
- Package manager is `npm`.
- API framework is Express.
- ORM is Prisma with MySQL.
- Test runner is Vitest with Supertest.
- Reuse existing Auth, validation, error, Prisma, request id, rate-limit, and logging infrastructure.
- Do not add new runtime dependencies for Computers MVP.
- Do not implement realtime heartbeat, Socket.IO authentication, sessions, usage sync, URL policy behavior, Web Admin UI, client PC UI, invite-code registration, claim-token registration, audit persistence, or Computers-specific health endpoints.
- Do not run DB commands, migration commands, server commands, test commands, typecheck commands, or Prisma CLI autonomously; the user/team runs them when ready.
- Do not commit `.env` or secrets.

Implementation notes:

- DB, migration, server startup, test, typecheck, and Prisma CLI commands remain user/team-run actions for Computers MVP implementation.
- Implementation work may inspect source files and update code/docs, but must not autonomously execute commands that change or depend on the runtime database, migrations, backend server lifecycle, test runner, typechecker, or Prisma CLI.
- Plain registration secrets and plain device tokens must never be logged or persisted.
- Plain device tokens are returned only once after registration or token reissue.
- Tenant registration secret configuration/rotation is outside MVP API scope: ops/team sets `Tenant.computerRegistrationSecretHash` through approved out-of-band admin procedure (for example Prisma Studio/manual SQL/internal admin script), using `authPasswordService.hashPassword`-compatible bcrypt hash format; no public or admin HTTP endpoint is added in this phase.

## 1. Pre-Implementation Alignment

- [x] Task 001: Read `docs/tdd/computers/2026-05-23-computers-technical-design.md` before starting implementation.
- [x] Task 002: Read `docs/SPEC/computers/SPEC.md` to confirm Computers MVP scope boundaries.
- [x] Task 003: Read `docs/module/computers/2026-05-23-computers-module-design.md` to confirm approved design decisions.
- [x] Task 004: Confirm Computers owns client PC registration, computer list, computer detail, computer update, and device-token reissue.
- [x] Task 005: Confirm Computers does not own realtime heartbeat, Socket.IO authentication, sessions, usage sync, URL policy behavior, Web Admin UI, or client PC UI.
- [x] Task 006: Confirm `POST /api/computers/register` remains public and does not require admin JWT.
- [x] Task 007: Confirm register requires `tenantCode`, `registrationSecret`, and `macAddress`.
- [x] Task 008: Confirm duplicate `(tenantId, macAddress)` registration returns `409 CONFLICT`.
- [x] Task 009: Confirm duplicate registration must not silently update existing computers.
- [x] Task 010: Confirm admin endpoints require `shop_admin`, a valid access token, and tenant context.
- [x] Task 011: Confirm all admin service methods scope by `req.authContext.tenantId`.
- [x] Task 012: Confirm `staff` is forbidden on all admin endpoints.
- [x] Task 013: Confirm `super_admin` is forbidden on all Computers admin endpoints in MVP.
- [x] Task 014: Confirm device-token-only clients are not accepted on Computers admin endpoints.
- [x] Task 015: Confirm API responses never expose `deviceTokenHash`.
- [x] Task 016: Confirm no Computers-specific health endpoint is added for MVP.
- [x] Task 017: Confirm no new runtime dependency is required for Computers MVP.
- [x] Task 018: Record in implementation notes that DB, migration, server, test, typecheck, and Prisma CLI commands remain user/team-run actions.

## 2. Existing Codebase Verification

- [x] Task 019: Inspect `backend/src/app.ts` to identify current middleware and router mount order.
- [x] Task 020: Inspect `backend/src/modules/auth/auth.middleware.ts` to confirm `authRequired` behavior.
- [x] Task 021: Inspect `backend/src/modules/auth/auth.rbac.ts` to confirm `requireRole` and `requireTenantUser` behavior.
- [x] Task 022: Inspect `backend/src/modules/auth/auth.tokens.ts` to identify existing token hashing or signing helpers.
- [x] Task 023: Inspect `backend/src/modules/auth/auth.password.ts` to identify reusable secret hashing patterns.
- [x] Task 024: Inspect `backend/src/modules/auth/auth.rate-limit.ts` to identify local rate-limit configuration patterns.
- [x] Task 025: Inspect `backend/src/shared/rate-limit/rate-limit.middleware.ts` to confirm custom key and bucket options.
- [x] Task 026: Inspect `backend/src/shared/validation/validate-request.ts` to confirm validated body, query, and params assignment behavior.
- [x] Task 027: Inspect `backend/src/shared/errors/app-error.ts` and `backend/src/shared/errors/error-code.ts` to confirm available error codes.
- [x] Task 028: Inspect `backend/src/shared/errors/error-handler.ts` to confirm shared error response shape.
- [x] Task 029: Inspect `backend/src/shared/prisma/prisma.client.ts` to confirm Prisma client singleton import path.
- [x] Task 030: Inspect `backend/src/shared/logging/logger.ts` to confirm structured logger usage.
- [x] Task 031: Inspect `backend/src/shared/middleware/request-id.ts` to confirm request id propagation.
- [x] Task 032: Inspect `backend/src/shared/middleware/auth-context.ts` to confirm auth context shape.
- [x] Task 033: Inspect `backend/prisma/schema.prisma` to confirm current `Tenant`, `User`, `RefreshToken`, `VerificationCode`, and `PendingTenantRegistration` models.
- [x] Task 034: Inspect `backend/src/modules/tenants/*` to reuse service, schema, route, controller, and logging patterns.
- [x] Task 035: Inspect `backend/src/modules/users/*` to reuse tenant-scoped admin endpoint patterns.
- [x] Task 036: Inspect `backend/tests/tenants/*` to reuse Vitest and Prisma mock style.
- [x] Task 037: Inspect `backend/tests/users/*` to reuse tenant isolation, role, and validation test patterns.
- [x] Task 038: Inspect `backend/tests/auth/*` to reuse auth token and rate-limit test patterns.
- [x] Task 039: Document any discovered schema or infrastructure drift before implementing Computers.
  - Result: Drift documented from TDD target vs current baseline before implementation.
  - Schema drift:
    - `backend/prisma/schema.prisma` does not yet include `Computer` model and related enums/indexes required by Computers TDD.
    - `Tenant.computerRegistrationSecretHash` is specified in TDD but not present in current schema.
  - Infrastructure drift:
    - `backend/src/app.ts` does not yet mount `/api/computers` router.
    - `backend/src/modules/computers/*` module files (service/controller/routes/schema/types/logging) are not present yet.
    - Dedicated Computers tests (`backend/tests/computers/*`) are not present yet.
  - Decision/config drift still open before implementation:
    - Final device-token hash secret source is not finalized (recommended: `DEVICE_TOKEN_HASH_SECRET`).
    - Final register error mapping for suspended/inactive tenant is not finalized (`404` vs `403` for register flow).

## 3. Open Decisions

- [x] Task 040: Decide final tenant registration secret field name; use `computerRegistrationSecretHash` unless the team chooses another name.
  - Decision: Final field name is `computerRegistrationSecretHash`.
- [x] Task 041: Decide final device-token hash secret env var; use `DEVICE_TOKEN_HASH_SECRET` unless an existing secret is intentionally reused.
  - Decision: Final env var is `DEVICE_TOKEN_HASH_SECRET` (dedicated secret, not reused from refresh-token hashing).
- [x] Task 042: Decide final registration-secret hashing helper or create a local Computers helper.
  - Decision: Reuse `authPasswordService` (`hashPassword` + `comparePassword`) for tenant `registrationSecret`; do not create a local Computers hashing helper.
- [x] Task 043: Decide final device-token hashing helper or create a local Computers helper.
  - Decision: Create a local Computers helper (`hashDeviceToken`) using HMAC-SHA256 with `DEVICE_TOKEN_HASH_SECRET`; do not reuse Auth refresh-token hashing helper.
- [x] Task 044: Decide exact register rate-limit capacity and refill window.
  - Decision: Register limiter uses token bucket `capacity = 5`, `refillTokens = 1`, `refillWindowSeconds = 600` (1 token / 10 minutes).
- [x] Task 045: Decide whether register rate-limit keys by IP, tenant code, or IP plus tenant code.
  - Decision: Register limiter key strategy is normalized `IP + tenantCode`; fallback key part `missing-tenant-code` when tenantCode is absent/invalid.
- [x] Task 046: Decide whether inactive or suspended tenant registration returns `404 NOT_FOUND` or `403 FORBIDDEN`.
  - Decision: Register returns `404 NOT_FOUND` for inactive or suspended tenant (same mapping as unknown tenant code in public flow).
- [x] Task 047: Decide whether `ComputerTokenRotation` is deferred for MVP; do not add it unless audit persistence is required now.
  - Decision: `ComputerTokenRotation` stays deferred for MVP; do not add rotation audit persistence model/table in this phase.

## 4. Prisma Schema and Data Model

- [x] Task 048: Add `ComputerStatus` enum to `backend/prisma/schema.prisma` with `ACTIVE`, `INACTIVE`, and `BLOCKED`.
- [x] Task 049: Add nullable `computerRegistrationSecretHash` field to `Tenant` in `backend/prisma/schema.prisma`.
- [x] Task 050: Add `computers Computer[]` relation to `Tenant` in `backend/prisma/schema.prisma`.
- [x] Task 051: Add `Computer` model to `backend/prisma/schema.prisma`.
- [x] Task 052: Add required `Computer.id` string UUID primary key.
- [x] Task 053: Add required `Computer.tenantId` field and `Tenant` relation.
- [x] Task 054: Add nullable `Computer.name` field.
- [x] Task 055: Add required `Computer.macAddress` field.
- [x] Task 056: Add required `Computer.deviceTokenHash` field.
- [x] Task 057: Add `Computer.status` field defaulting to `ACTIVE`.
- [x] Task 058: Add nullable `Computer.lastSeenAt` field reserved for future heartbeat work.
- [x] Task 059: Add nullable `Computer.notes` field.
- [x] Task 060: Add `Computer.createdAt` and `Computer.updatedAt` timestamp fields.
- [x] Task 061: Add unique constraint on `[tenantId, macAddress]`.
- [x] Task 062: Add index on `[tenantId, createdAt]`.
- [x] Task 063: Add index on `[tenantId, status]`.
- [x] Task 064: Ask the user/team to run Prisma migration and client generation after schema edits are ready.
  - Action requested: user/team runs Prisma migration + Prisma client generation after reviewing schema updates.

## 5. Computers Module Scaffold

- [x] Task 065: Create `backend/src/modules/computers/` directory.
- [x] Task 066: Create `backend/src/modules/computers/computers.routes.ts`.
- [x] Task 067: Create `backend/src/modules/computers/computers.controller.ts`.
- [x] Task 068: Create `backend/src/modules/computers/computers.service.ts`.
- [x] Task 069: Create `backend/src/modules/computers/computers.schema.ts`.
- [x] Task 070: Create `backend/src/modules/computers/computers.types.ts`.
- [x] Task 071: Create `backend/src/modules/computers/computers.mapper.ts`.
- [x] Task 072: Create `backend/src/modules/computers/computers.logging.ts`.
- [x] Task 073: Create `backend/src/modules/computers/registration-auth.strategy.ts`.
- [x] Task 074: Export `computersRouter` from `computers.routes.ts`.
- [x] Task 075: Keep route handlers free of business logic by delegating to `computers.controller.ts`.
- [x] Task 076: Keep controller methods thin and delegate persistence and domain decisions to `computers.service.ts`.
- [x] Task 077: Keep Computers-specific DTO and mapper logic out of route handlers.
- [x] Task 078: Keep Computers logging helpers free of raw request headers, raw request bodies, authorization headers, registration secrets, device tokens, and token hashes.

## 6. Configuration and Secret Helpers

- [x] Task 079: Update `backend/src/config/env.ts` if a dedicated `DEVICE_TOKEN_HASH_SECRET` is selected.
- [x] Task 080: Ensure missing required token-hash secret fails fast through existing config validation conventions.
- [x] Task 081: Implement or reuse a helper that generates high-entropy plain device tokens with `node:crypto`.
- [x] Task 082: Implement or reuse a helper that hashes device tokens before persistence.
- [x] Task 083: Implement or reuse a helper that hashes tenant registration secrets before storage or comparison.
- [x] Task 084: Implement constant-time comparison for registration secret verification when comparing hashes.
- [x] Task 085: Ensure helper names do not imply MAC address is authentication proof.
- [x] Task 086: Add implementation notes describing how tenant registration secrets are configured outside this MVP if no admin endpoint is added.
- [x] Task 087: Confirm `.env` examples or docs mention the selected device-token hash secret without committing real secrets.

## 7. Types and DTO Mapping

- [x] Task 088: Define `ComputerStatusValue` in `computers.types.ts`.
- [x] Task 089: Define `ComputerResponse` with `id`, `tenantId`, `name`, `macAddress`, `status`, `lastSeenAt`, `notes`, `createdAt`, and `updatedAt`.
- [x] Task 090: Define `ComputerListResponse` with `items` and pagination metadata.
- [x] Task 091: Define `ComputerTokenResponse` with safe computer DTO and plain `deviceToken`.
- [x] Task 092: Define `RegisterComputerInput` with `tenantCode`, `registrationSecret`, `macAddress`, and optional `name`.
- [x] Task 093: Define `ListComputersInput` with `page`, `pageSize`, optional `status`, optional `q`, and optional `sort`.
- [x] Task 094: Define `UpdateComputerInput` with optional `name`, optional `status`, and optional `notes`.
- [x] Task 095: Define `ReissueDeviceTokenInput` with optional `reason`.
- [x] Task 096: Define `ComputersAuthContext` based on existing auth context shape.
- [x] Task 097: Implement `mapComputerToResponse` in `computers.mapper.ts`.
- [x] Task 098: Ensure `mapComputerToResponse` never includes `deviceTokenHash`.
- [x] Task 099: Ensure `mapComputerToResponse` never includes Prisma relation objects.
- [x] Task 100: Ensure date fields serialize consistently with existing module patterns.
- [x] Task 101: Implement list pagination response mapper if it improves consistency with Users and Tenants.
- [x] Task 102: Ensure list response pagination includes `page`, `pageSize`, `total`, and `totalPages`.

## 8. Validation Schemas

- [x] Task 103: Implement `tenantCodeSchema` in `computers.schema.ts`.
- [x] Task 104: Normalize `tenantCode` by trimming and applying the final case convention.
- [x] Task 105: Implement `registrationSecretSchema` with non-empty string validation.
- [x] Task 106: Implement `macAddressSchema` with accepted MAC formats from the TDD.
- [x] Task 107: Normalize `macAddress` into uppercase canonical format before service use.
- [x] Task 108: Implement optional `computerNameSchema` with trimming and max length.
- [x] Task 109: Implement optional `computerNotesSchema` with trimming and max length.
- [x] Task 110: Implement `computerStatusSchema` with `ACTIVE`, `INACTIVE`, and `BLOCKED`.
- [x] Task 111: Implement `computerIdParamsSchema` with required non-empty `id`.
- [ ] Task 112: Implement strict `registerComputerSchema` with only `tenantCode`, `registrationSecret`, `macAddress`, and optional `name`.
- [x] Task 113: Ensure `registerComputerSchema` rejects client-supplied `tenantId`.
- [x] Task 114: Ensure `registerComputerSchema` rejects client-supplied `deviceToken`.
- [x] Task 115: Ensure `registerComputerSchema` rejects client-supplied `deviceTokenHash`.
- [x] Task 116: Ensure `registerComputerSchema` rejects unknown fields.
- [x] Task 117: Implement strict `listComputersQuerySchema` with `page`, `pageSize`, `status`, `q`, and `sort`.
- [x] Task 118: Default list `page` to `1`.
- [x] Task 119: Default list `pageSize` to `20`.
- [x] Task 120: Reject list `page < 1`.
- [x] Task 121: Reject list `pageSize < 1`.
- [x] Task 122: Reject list `pageSize > 100`.
- [x] Task 123: Trim list `q` and normalize empty or whitespace-only `q` to omitted.
- [x] Task 124: Reject list `q` longer than `100`.
- [x] Task 125: Allow only `createdAt:desc`, `createdAt:asc`, `name:asc`, and `name:desc` for `sort`.
- [x] Task 126: Reject unknown list query fields.
- [x] Task 127: Implement strict `updateComputerSchema` with optional `name`, optional `status`, and optional `notes`.
- [x] Task 128: Ensure `updateComputerSchema` requires at least one valid update field.
- [x] Task 129: Ensure `updateComputerSchema` rejects unknown fields.
- [x] Task 130: Ensure `updateComputerSchema` rejects `tenantId`, `macAddress`, `deviceToken`, `deviceTokenHash`, `lastSeenAt`, `createdAt`, and `updatedAt`.
- [x] Task 131: Implement strict `reissueDeviceTokenSchema` with optional `reason`.
- [x] Task 132: Trim `reason` and enforce the final max length.
- [x] Task 133: Ensure `reissueDeviceTokenSchema` rejects unknown fields and token material.
- [x] Task 134: Export all Computers schemas needed by routes and unit tests.

## 9. Registration Authentication Strategy

- [x] Task 135: Define `RegistrationAuthStrategy` interface in `registration-auth.strategy.ts`.
- [x] Task 136: Implement `TenantSecretStrategy` in `registration-auth.strategy.ts`.
- [x] Task 137: Ensure `TenantSecretStrategy` receives plain submitted secret and stored tenant secret hash.
- [x] Task 138: Ensure `TenantSecretStrategy` returns invalid when the tenant has no configured registration secret hash.
- [x] Task 139: Ensure `TenantSecretStrategy` never logs the submitted registration secret.
- [x] Task 140: Ensure `TenantSecretStrategy` is injectable or replaceable in service tests.
- [x] Task 141: Add a factory or default exported instance only if it matches local module style.

## 10. Rate Limiting

- [x] Task 142: Define Computers register rate-limit configuration using existing shared rate-limit middleware.
- [x] Task 143: Configure register rate-limit keying according to the final IP and tenant-code decision.
- [x] Task 144: Apply register rate-limit only to `POST /api/computers/register`.
- [x] Task 145: Ensure admin list/detail/update/reissue endpoints do not accidentally use the public register limiter.
- [x] Task 146: Ensure register rate-limit returns shared `429 TOO_MANY_REQUESTS` response shape.
- [x] Task 147: Ensure register rate-limit logs do not include registration secrets or raw request bodies.

## 11. Logging and Observability

- [x] Task 148: Define Computers log event constants in `computers.logging.ts`.
- [x] Task 149: Implement safe log helper for `computer.registered`.
- [x] Task 150: Implement safe log helper for `computer.register.failed`.
- [x] Task 151: Implement safe log helper for `computer.register.conflict`.
- [x] Task 152: Implement safe log helper for `computer.listed`.
- [x] Task 153: Implement safe log helper for `computer.viewed`.
- [x] Task 154: Implement safe log helper for `computer.updated`.
- [x] Task 155: Implement safe log helper for `computer.token.reissued`.
- [x] Task 156: Include `requestId` in Computers logs when available.
- [x] Task 157: Include safe `tenantId` and `computerId` in Computers logs when available.
- [x] Task 158: Include safe actor fields `actorUserId` and `actorRole` for admin operations.
- [x] Task 159: Include safe request metadata such as `ip` and `userAgent` when local logging patterns allow it.
- [x] Task 160: Ensure Computers logs never include `registrationSecret`.
- [x] Task 161: Ensure Computers logs never include plain `deviceToken`.
- [x] Task 162: Ensure Computers logs never include `deviceTokenHash`.
- [x] Task 163: Ensure Computers logs never include authorization headers.
- [x] Task 164: Ensure Computers logs never include raw register or reissue bodies.
- [x] Task 165: Document recommended metrics as future work if no metrics infrastructure exists.
  - Result: Future metrics recommendation documented from TDD observability section: `computer_register_success_total`, `computer_register_failed_total`, `computer_register_conflict_total`, `computer_token_reissued_total`, and endpoint latency histogram for register/list/detail/update/reissue.

## 12. Service Shared Helpers

- [x] Task 166: Import Prisma client singleton in `computers.service.ts`.
- [x] Task 167: Import shared `AppError` and error codes in `computers.service.ts`.
- [x] Task 168: Import Computers mapper functions in `computers.service.ts`.
- [x] Task 169: Import Computers logging helpers in `computers.service.ts`.
- [x] Task 170: Import `TenantSecretStrategy` or selected registration strategy in `computers.service.ts`.
- [x] Task 171: Create helper that asserts admin auth context has a tenant id or throws `FORBIDDEN`.
- [x] Task 172: Create helper that builds tenant-scoped computer lookup filters.
- [x] Task 173: Create helper that maps missing, cross-tenant, and inaccessible computers to `404 NOT_FOUND`.
- [x] Task 174: Create helper that maps duplicate computer registration to `409 CONFLICT`.
- [x] Task 175: Create helper that maps Prisma unique constraint errors on `(tenantId, macAddress)` to `409 CONFLICT`.
- [x] Task 176: Create helper that builds list sorting from the allowlisted `sort` input.
- [x] Task 177: Create helper that builds list search filters for `name` and `macAddress`.
- [x] Task 178: Ensure service methods never trust client-supplied tenant scope.
- [x] Task 179: Ensure service methods never return raw Prisma models containing `deviceTokenHash`.

## 13. Register Computer Service

- [x] Task 180: Implement `registerComputer(input, requestContext)` in `computers.service.ts`.
- [x] Task 181: Look up tenant by normalized `tenantCode`.
- [x] Task 182: Require tenant to be active according to the final tenant status rule.
- [x] Task 183: Return `404 NOT_FOUND` or `403 FORBIDDEN` for inactive tenant according to the final decision.
- [x] Task 184: Verify submitted `registrationSecret` with `TenantSecretStrategy`.
- [x] Task 185: Return `401 UNAUTHORIZED` for invalid registration secret.
- [x] Task 186: Check for existing computer by `tenantId` and normalized `macAddress`.
- [x] Task 187: Return `409 CONFLICT` when an existing computer has the same `tenantId` and `macAddress`.
- [x] Task 188: Generate a new high-entropy plain device token.
- [x] Task 189: Hash the generated device token before persistence.
- [x] Task 190: Create the `Computer` record with server-controlled `tenantId`, normalized `macAddress`, optional `name`, token hash, and default `ACTIVE` status.
- [x] Task 191: Ensure register does not persist plain device token.
- [x] Task 192: Ensure register does not persist plain registration secret.
- [x] Task 193: Return safe computer DTO plus plain device token once.
- [x] Task 194: Emit `computer.registered` after successful registration.
- [x] Task 195: Emit `computer.register.conflict` for duplicate registration without logging secrets.
- [x] Task 196: Emit safe `computer.register.failed` for invalid tenant or secret when appropriate.

## 14. List Computers Service

- [x] Task 197: Implement `listComputers(authContext, input)` in `computers.service.ts`.
- [x] Task 198: Derive list `tenantId` only from `authContext.tenantId`.
- [x] Task 199: Build base list filter with caller tenant id.
- [x] Task 200: Apply optional `status` filter. (Completed)
- [x] Task 201: Apply optional `q` search over `Computer.name`. (Completed)
- [x] Task 202: Apply optional `q` search over `Computer.macAddress`. (Completed)
- [x] Task 203: Apply allowlisted sort from `input.sort`. (Completed)
- [x] Task 204: Default sort to `createdAt:desc`. (Completed)
- [x] Task 205: Calculate `skip = (page - 1) * pageSize`. (Completed)
- [x] Task 206: Use `take = pageSize`. (Completed)
- [x] Task 207: Query total matching computer count with the same filter. (Completed)
- [x] Task 208: Query paginated computer items using a safe select. (Completed)
- [x] Task 209: Avoid loading unnecessary tenant relations for list responses. (Completed)
- [x] Task 210: Return `items` and pagination metadata. (Completed)
- [x] Task 211: Emit safe `computer.listed` log event when appropriate. (Completed)

## 15. Detail Computer Service

- [x] Task 212: Implement `getComputerById(authContext, id)` in `computers.service.ts`. (Completed)
- [x] Task 213: Derive detail `tenantId` only from `authContext.tenantId`. (Completed)
- [x] Task 214: Query computer by `id` and caller `tenantId`. (Completed)
- [x] Task 215: Return `404 NOT_FOUND` for unknown computer id. (Completed)
- [x] Task 216: Return `404 NOT_FOUND` for cross-tenant computer id. (Completed)
- [x] Task 217: Return safe computer DTO for accessible computer. (Completed)
- [x] Task 218: Ensure detail response never includes `deviceTokenHash`. (Completed)
- [x] Task 219: Emit safe `computer.viewed` log event when appropriate. (Completed)

## 16. Update Computer Service

- [x] Task 220: Implement `updateComputerById(authContext, id, input)` in `computers.service.ts`. (Completed)
- [x] Task 221: Derive update `tenantId` only from `authContext.tenantId`. (Completed)
- [x] Task 222: Load target computer by `id` and caller `tenantId` before update. (Completed)
- [x] Task 223: Return `404 NOT_FOUND` for unknown computer id. (Completed)
- [x] Task 224: Return `404 NOT_FOUND` for cross-tenant computer id. (Completed)
- [x] Task 225: Build update data from allowlisted `name`, `status`, and `notes` fields only. (Completed)
- [x] Task 226: Update `name` only when `input.name` is present. (Completed)
- [x] Task 227: Update `status` only when `input.status` is present. (Completed)
- [x] Task 228: Update `notes` only when `input.notes` is present. (Completed)
- [x] Task 229: Ensure update logic never changes `tenantId`, `macAddress`, `deviceTokenHash`, `lastSeenAt`, `createdAt`, or `updatedAt` directly. (Completed)
- [x] Task 230: Persist only allowlisted update data through Prisma. (Completed)
- [x] Task 231: Return updated safe computer DTO. (Completed)
- [x] Task 232: Emit safe `computer.updated` log event. (Completed)
- [x] Task 233: Include changed field names in update logs without logging sensitive values. (Completed)

## 17. Reissue Device Token Service

- [x] Task 234: Implement `reissueDeviceToken(authContext, id, input)` in `computers.service.ts`. (Completed)
- [x] Task 235: Derive reissue `tenantId` only from `authContext.tenantId`. (Completed)
- [x] Task 236: Load target computer by `id` and caller `tenantId`. (Completed)
- [x] Task 237: Return `404 NOT_FOUND` for unknown computer id. (Completed)
- [x] Task 238: Return `404 NOT_FOUND` for cross-tenant computer id. (Completed)
- [x] Task 239: Generate a new high-entropy plain device token. (Completed)
- [x] Task 240: Hash the new device token before persistence. (Completed)
- [x] Task 241: Replace the old `deviceTokenHash` with the new hash atomically where practical. (Completed)
- [x] Task 242: Ensure reissue does not persist the plain device token. (Completed)
- [x] Task 243: Ensure reissue response returns the new plain token only once. (Completed)
- [x] Task 244: Return safe computer DTO plus plain device token. (Completed)
- [x] Task 245: Emit safe `computer.token.reissued` log event with actor and tenant context. (Completed)
- [x] Task 246: Log reissue `reason` only if it is non-sensitive and follows local logging policy. (Completed)

## 18. Controllers

- [x] Task 247: Implement `computersController.registerComputer` in `computers.controller.ts`. (Completed)
- [x] Task 248: Read validated body in `registerComputer`. (Completed)
- [x] Task 249: Pass safe request context to `computersService.registerComputer`. (Completed)
- [x] Task 250: Return shared success response shape from `registerComputer`. (Completed)
- [x] Task 251: Implement `computersController.listComputers` in `computers.controller.ts`. (Completed)
- [x] Task 252: Read validated query and auth context in `listComputers`. (Completed)
- [x] Task 253: Call `computersService.listComputers(authContext, query)` from `listComputers`. (Completed)
- [x] Task 254: Return shared success response shape from `listComputers`. (Completed)
- [x] Task 255: Implement `computersController.getComputerById` in `computers.controller.ts`. (Completed)
- [x] Task 256: Read validated params and auth context in `getComputerById`. (Completed)
- [x] Task 257: Call `computersService.getComputerById(authContext, id)` from `getComputerById`. (Completed)
- [x] Task 258: Return shared success response shape from `getComputerById`. (Completed)
- [x] Task 259: Implement `computersController.updateComputerById` in `computers.controller.ts`. (Completed)
- [x] Task 260: Read validated params, validated body, and auth context in `updateComputerById`. (Completed)
- [x] Task 261: Call `computersService.updateComputerById(authContext, id, body)` from `updateComputerById`. (Completed)
- [x] Task 262: Return shared success response shape from `updateComputerById`. (Completed)
- [x] Task 263: Implement `computersController.reissueDeviceToken` in `computers.controller.ts`. (Completed)
- [x] Task 264: Read validated params, validated body, and auth context in `reissueDeviceToken`. (Completed)
- [x] Task 265: Call `computersService.reissueDeviceToken(authContext, id, body)` from `reissueDeviceToken`. (Completed)
- [x] Task 266: Return shared success response shape from `reissueDeviceToken`. (Completed)
- [x] Task 267: Forward controller errors to `next(error)` in every Computers controller method. (Completed)

## 19. Routes and App Wiring

- [x] Task 268: Add `POST /register` route in `computers.routes.ts`. (Completed)
- [x] Task 269: Apply register-specific rate-limit middleware to `POST /register`. (Completed)
- [x] Task 270: Apply `validateRequest({ body: registerComputerSchema })` to `POST /register`. (Completed)
- [x] Task 271: Wire `POST /register` to `computersController.registerComputer`. (Completed)
- [x] Task 272: Add `GET /` route in `computers.routes.ts`. (Completed)
- [x] Task 273: Apply `authRequired` to `GET /`. (Completed)
- [x] Task 274: Apply `requireRole("shop_admin")` to `GET /`. (Completed)
- [x] Task 275: Apply `requireTenantUser` to `GET /`. (Completed)
- [x] Task 276: Apply `validateRequest({ query: listComputersQuerySchema })` to `GET /`. (Completed)
- [x] Task 277: Wire `GET /` to `computersController.listComputers`. (Completed)
- [x] Task 278: Add `GET /:id` route in `computers.routes.ts`. (Completed)
- [x] Task 279: Apply `authRequired`, `requireRole("shop_admin")`, and `requireTenantUser` to `GET /:id`. (Completed)
- [x] Task 280: Apply `validateRequest({ params: computerIdParamsSchema })` to `GET /:id`. (Completed)
- [x] Task 281: Wire `GET /:id` to `computersController.getComputerById`. (Completed)
- [x] Task 282: Add `PATCH /:id` route in `computers.routes.ts`. (Completed)
- [x] Task 283: Apply `authRequired`, `requireRole("shop_admin")`, and `requireTenantUser` to `PATCH /:id`. (Completed)
- [x] Task 284: Apply `validateRequest({ params: computerIdParamsSchema, body: updateComputerSchema })` to `PATCH /:id`. (Completed)
- [x] Task 285: Wire `PATCH /:id` to `computersController.updateComputerById`. (Completed)
- [x] Task 286: Add `POST /:id/reissue-token` route in `computers.routes.ts`. (Completed)
- [x] Task 287: Apply `authRequired`, `requireRole("shop_admin")`, and `requireTenantUser` to `POST /:id/reissue-token`. (Completed)
- [x] Task 288: Apply `validateRequest({ params: computerIdParamsSchema, body: reissueDeviceTokenSchema })` to `POST /:id/reissue-token`. (Completed)
- [x] Task 289: Wire `POST /:id/reissue-token` to `computersController.reissueDeviceToken`. (Completed)
- [x] Task 290: Import `computersRouter` in `backend/src/app.ts`. (Completed)
- [x] Task 291: Mount `computersRouter` at `/api/computers` in `backend/src/app.ts`. (Completed)
- [x] Task 292: Place `computersRouter` after shared auth context middleware and near existing business module routers. (Completed)
- [x] Task 293: Verify `computersRouter` is mounted before `notFoundHandler`. (Completed)
- [x] Task 294: Verify `errorHandler` remains after `computersRouter`. (Completed)

## 20. Error Handling and Security Hardening

- [x] Task 295: Reuse shared `VALIDATION_ERROR` for invalid body, query, or params. (Completed)
- [x] Task 296: Reuse shared `UNAUTHORIZED` for invalid registration secret. (Completed)
- [x] Task 297: Reuse shared `UNAUTHORIZED` for missing, malformed, invalid, expired, or wrong-token-type access tokens on admin endpoints. (Completed)
- [x] Task 298: Reuse shared `FORBIDDEN` for wrong roles on admin endpoints. (Completed)
- [x] Task 299: Reuse shared `FORBIDDEN` for missing tenant context on admin endpoints. (Completed)
- [x] Task 300: Reuse shared `NOT_FOUND` for unknown tenant code on register. (Completed)
- [x] Task 301: Reuse shared `NOT_FOUND` for unknown or cross-tenant computer ids. (Completed)
- [x] Task 302: Reuse shared `CONFLICT` for duplicate `(tenantId, macAddress)`. (Completed)
- [x] Task 303: Reuse shared `TOO_MANY_REQUESTS` for register rate-limit failures. (Completed)
- [x] Task 304: Ensure public register route never reads admin auth context as authorization proof. (Completed)
- [x] Task 305: Ensure admin endpoints never read tenant id from request body, query, or params. (Completed)
- [x] Task 306: Ensure MAC address is treated as metadata and not proof of ownership. (Completed)
- [x] Task 307: Ensure all request schemas reject unknown fields. (Completed)
- [x] Task 308: Ensure all response DTOs omit `deviceTokenHash`. (Completed)
- [x] Task 309: Ensure no Computers code logs raw request bodies. (Completed)
- [x] Task 310: Ensure no Computers code logs secrets, tokens, token hashes, or authorization headers. (Completed)
- [x] Task 311: Ensure no Computers implementation adds cache, queues, workers, retries, or external network calls for MVP. (Completed)
- [x] Task 312: Ensure app startup does not run Prisma migrations or schema pushes. (Completed)

## 21. Performance and Reliability

- [x] Task 313: Ensure register relies on the database unique constraint for concurrent duplicate protection. (Completed)
- [x] Task 314: Ensure register maps Prisma unique race failures to `409 CONFLICT`. (Completed)
- [x] Task 315: Ensure list endpoint always uses bounded pagination. (Completed)
- [x] Task 316: Ensure list endpoint never returns all computers at once. (Completed)
- [x] Task 317: Ensure default list `pageSize` is `20`. (Completed)
- [x] Task 318: Ensure list `pageSize` cannot exceed `100`. (Completed)
- [x] Task 319: Ensure list and count queries use the same tenant-scoped filter. (Completed)
- [x] Task 320: Ensure default list sorting uses indexed `createdAt`. (Completed)
- [x] Task 321: Ensure status filter can use the `[tenantId, status]` index. (Completed)
- [x] Task 322: Ensure reissue token hash replacement is atomic where practical. (Completed)

## 22. Unit and Service Tests

- [x] Task 323: Create `backend/tests/computers/` directory. (Completed)
- [x] Task 324: Create `backend/tests/computers/computers.unit.test.ts`. (Completed)
- [x] Task 325: Add unit tests for `tenantCodeSchema` trimming and normalization. (Completed)
- [x] Task 326: Add unit tests for `macAddressSchema` valid formats. (Completed)
- [x] Task 327: Add unit tests for `macAddressSchema` invalid formats. (Completed)
- [x] Task 328: Add unit tests proving MAC address normalization stores uppercase canonical format. (Completed)
- [x] Task 329: Add unit tests for `registerComputerSchema` strict object behavior. (Completed)
- [x] Task 330: Add unit tests proving register schema rejects `tenantId`, `deviceToken`, and `deviceTokenHash`. (Completed)
- [x] Task 331: Add unit tests for list query defaults. (Completed)
- [x] Task 332: Add unit tests for list query `pageSize` cap. (Completed)
- [x] Task 333: Add unit tests for list query status validation. (Completed)
- [x] Task 334: Add unit tests for list query `q` trimming and max length. (Completed)
- [x] Task 335: Add unit tests for sort allowlist behavior. (Completed)
- [x] Task 336: Add unit tests for update schema requiring at least one field. (Completed)
- [x] Task 337: Add unit tests proving update schema rejects sensitive fields. (Completed)
- [x] Task 338: Add unit tests for reissue schema `reason` validation. (Completed)
- [x] Task 339: Add unit tests proving `mapComputerToResponse` omits `deviceTokenHash`. (Completed)
- [x] Task 340: Add unit tests proving `mapComputerToResponse` includes approved DTO fields. (Completed)
- [x] Task 341: Add unit tests for `TenantSecretStrategy` with a correct secret. (Completed)
- [x] Task 342: Add unit tests for `TenantSecretStrategy` with an incorrect secret. (Completed)
- [x] Task 343: Add unit tests for `TenantSecretStrategy` when stored secret hash is missing. (Completed)
- [x] Task 344: Add unit tests for token generation and hashing helper if local to Computers. (Completed)
- [x] Task 345: Create `backend/tests/computers/computers.service.test.ts`. (Completed)
- [x] Task 346: Add service test proving register looks up tenant by normalized code. (Completed)
- [x] Task 347: Add service test proving register rejects unknown tenant code. (Completed)
- [x] Task 348: Add service test proving register rejects inactive tenant according to final error mapping. (Completed)
- [x] Task 349: Add service test proving register rejects invalid registration secret. (Completed)
- [x] Task 350: Add service test proving register detects duplicate `(tenantId, macAddress)`. (Completed)
- [x] Task 351: Add service test proving register stores token hash and not plain token. (Completed)
- [x] Task 352: Add service test proving register returns safe DTO and one-time plain token. (Completed)
- [x] Task 353: Add service test proving Prisma unique conflict maps to `409 CONFLICT`. (Completed)
- [x] Task 354: Add service test proving list builds tenant-scoped filters. (Completed)
- [x] Task 355: Add service test proving list applies pagination. (Completed)
- [x] Task 356: Add service test proving list applies status filter. (Completed)
- [x] Task 357: Add service test proving list applies `q` search over name and MAC address. (Completed)
- [x] Task 358: Add service test proving list applies allowed sort values. (Completed)
- [x] Task 359: Add service test proving detail scopes by `id + tenantId`. (Completed)
- [x] Task 360: Add service test proving detail returns `NOT_FOUND` for cross-tenant computer. (Completed)
- [x] Task 361: Add service test proving update applies only allowlisted fields. (Completed)
- [x] Task 362: Add service test proving update scopes by `id + tenantId`. (Completed)
- [x] Task 363: Add service test proving update returns `NOT_FOUND` for cross-tenant computer. (Completed)
- [x] Task 364: Add service test proving reissue replaces stored token hash. (Completed)
- [x] Task 365: Add service test proving reissue returns a new plain token once. (Completed)
- [x] Task 366: Add service test proving reissue scopes by `id + tenantId`. (Completed)
- [x] Task 367: Add service tests proving service outputs never include `deviceTokenHash`. (Completed)

## 23. API Authentication and Authorization Tests

- [x] Task 368: Create `backend/tests/computers/computers.api.test.ts`. (Completed)
- [x] Task 369: Add Supertest coverage proving `POST /api/computers/register` does not require admin JWT. (Completed)
- [x] Task 370: Add Supertest coverage proving missing token on `GET /api/computers` returns `401 UNAUTHORIZED`. (Completed)
- [x] Task 371: Add Supertest coverage proving missing token on `GET /api/computers/:id` returns `401 UNAUTHORIZED`. (Completed)
- [x] Task 372: Add Supertest coverage proving missing token on `PATCH /api/computers/:id` returns `401 UNAUTHORIZED`. (Completed)
- [x] Task 373: Add Supertest coverage proving missing token on `POST /api/computers/:id/reissue-token` returns `401 UNAUTHORIZED`. (Completed)
- [x] Task 374: Add Supertest coverage proving malformed bearer token on admin endpoints returns `401 UNAUTHORIZED`. (Completed)
- [x] Task 375: Add Supertest coverage proving invalid access token on admin endpoints returns `401 UNAUTHORIZED`. (Completed)
- [x] Task 376: Add Supertest coverage proving expired access token on admin endpoints returns `401 UNAUTHORIZED`. (Completed)
- [x] Task 377: Add Supertest coverage proving refresh-token-type JWT cannot access admin endpoints. (Completed)
- [x] Task 378: Add Supertest coverage proving `shop_admin` can access list/detail/update/reissue inside own tenant. (Completed)
- [x] Task 379: Add Supertest coverage proving `staff` cannot access any Computers admin endpoint. (Completed)
- [x] Task 380: Add Supertest coverage proving `super_admin` cannot access any Computers admin endpoint in MVP. (Completed)
- [x] Task 381: Add Supertest coverage proving authenticated `shop_admin` without tenant context receives `403 FORBIDDEN`. (Completed)
- [x] Task 382: Add Supertest coverage proving device-token-only clients cannot access admin endpoints. (Completed)

## 24. Register API Tests

- [x] Task 383: Add Supertest coverage proving valid register creates a computer. (Completed)
- [x] Task 384: Add Supertest coverage proving valid register returns plain device token. (Completed)
- [x] Task 385: Add Supertest coverage proving register response does not include `deviceTokenHash`. (Completed)
- [x] Task 386: Add Supertest coverage proving plain device token is not persisted. (Completed)
- [x] Task 387: Add Supertest coverage proving device token hash is persisted. (Completed)
- [x] Task 388: Add Supertest coverage proving register normalizes tenant code. (Completed)
- [x] Task 389: Add Supertest coverage proving register normalizes MAC address. (Completed)
- [x] Task 390: Add Supertest coverage proving invalid tenant code returns `404 NOT_FOUND`. (Completed)
- [x] Task 391: Add Supertest coverage proving inactive tenant returns the final selected error mapping. (Completed)
- [x] Task 392: Add Supertest coverage proving invalid registration secret returns `401 UNAUTHORIZED`. (Completed)
- [x] Task 393: Add Supertest coverage proving duplicate `(tenantId, macAddress)` returns `409 CONFLICT`. (Completed)
- [x] Task 394: Add Supertest coverage proving register rejects crafted `tenantId`. (Completed)
- [x] Task 395: Add Supertest coverage proving register rejects crafted `deviceTokenHash`. (Completed)
- [x] Task 396: Add Supertest coverage proving register rejects unknown fields. (Completed)
- [x] Task 397: Add Supertest coverage proving register rate-limit returns `429 TOO_MANY_REQUESTS` when exceeded. (Completed)

## 25. List, Detail, Update, and Reissue API Tests

- [x] Task 398: Add Supertest coverage proving list returns only computers from caller tenant. (Completed)
- [x] Task 399: Add Supertest coverage proving list defaults to `page = 1` and `pageSize = 20`. (Completed)
- [x] Task 400: Add Supertest coverage proving `pageSize > 100` returns `400 VALIDATION_ERROR`. (Completed)
- [x] Task 401: Add Supertest coverage proving status filter works for `ACTIVE`. (Completed)
- [x] Task 402: Add Supertest coverage proving status filter works for `INACTIVE`. (Completed)
- [x] Task 403: Add Supertest coverage proving status filter works for `BLOCKED`. (Completed)
- [x] Task 404: Add Supertest coverage proving invalid status returns `400 VALIDATION_ERROR`. (Completed)
- [x] Task 405: Add Supertest coverage proving `q` searches over computer name. (Completed)
- [x] Task 406: Add Supertest coverage proving `q` searches over MAC address. (Completed)
- [x] Task 407: Add Supertest coverage proving sort allowlist works. (Completed)
- [x] Task 408: Add Supertest coverage proving unknown query fields are rejected. (Completed)
- [x] Task 409: Add Supertest coverage proving list response does not expose `deviceTokenHash`. (Completed)
- [x] Task 410: Add Supertest coverage proving detail returns one computer in caller tenant. (Completed)
- [x] Task 411: Add Supertest coverage proving unknown computer id returns `404 NOT_FOUND`. (Completed)
- [x] Task 412: Add Supertest coverage proving cross-tenant computer id returns `404 NOT_FOUND`. (Completed)
- [x] Task 413: Add Supertest coverage proving detail response does not expose `deviceTokenHash`. (Completed)
- [x] Task 414: Add Supertest coverage proving update accepts `name`. (Completed)
- [x] Task 415: Add Supertest coverage proving update accepts `status`. (Completed)
- [x] Task 416: Add Supertest coverage proving update accepts `notes`. (Completed)
- [x] Task 417: Add Supertest coverage proving update accepts multiple allowed fields in one request. (Completed)
- [x] Task 418: Add Supertest coverage proving empty patch body returns `400 VALIDATION_ERROR`. (Completed)
- [x] Task 419: Add Supertest coverage proving unknown patch fields return `400 VALIDATION_ERROR`. (Completed)
- [x] Task 420: Add Supertest coverage proving patch rejects `tenantId`. (Completed)
- [x] Task 421: Add Supertest coverage proving patch rejects `macAddress`. (Completed)
- [x] Task 422: Add Supertest coverage proving patch rejects `deviceTokenHash`. (Completed)
- [x] Task 423: Add Supertest coverage proving patch rejects timestamps and `lastSeenAt`. (Completed)
- [x] Task 424: Add Supertest coverage proving cross-tenant update returns `404 NOT_FOUND`. (Completed)
- [x] Task 425: Add Supertest coverage proving update response does not expose `deviceTokenHash`. (Completed)
- [x] Task 426: Add Supertest coverage proving reissue returns a new plain token once. (Completed)
- [x] Task 427: Add Supertest coverage proving reissue replaces stored token hash. (Completed)
- [x] Task 428: Add Supertest coverage proving cross-tenant reissue returns `404 NOT_FOUND`. (Completed)
- [x] Task 429: Add Supertest coverage proving reissue response does not expose `deviceTokenHash`. (Completed)
- [x] Task 430: Add Supertest coverage proving reissue logs `computer.token.reissued`. (Completed)

## 26. Security and Logging Tests

- [x] Task 431: Add test proving register logs never include registration secret. (Completed)
- [x] Task 432: Add test proving register logs never include plain device token. (Completed)
- [x] Task 433: Add test proving register logs never include token hash. (Completed)
- [x] Task 434: Add test proving reissue logs never include plain device token. (Completed)
- [x] Task 435: Add test proving reissue logs never include token hash. (Completed)
- [x] Task 436: Add test proving Computers logs never include authorization headers. (Completed)
- [x] Task 437: Add test proving Computers logs never include raw request bodies. (Completed)
- [x] Task 438: Add test proving tenant isolation remains enforced with crafted params. (Completed)
- [x] Task 439: Add test proving tenant isolation remains enforced with crafted body fields. (Completed)
- [x] Task 440: Add test proving SQL-like `q` payload is treated as literal search input. (Completed)
- [x] Task 441: Add test proving SQL-like `id` does not resolve an existing computer. (Completed)
- [x] Task 442: Add test proving duplicated query parameters are rejected if local validation convention rejects them. (Completed)
- [x] Task 443: Add test proving lowercase status cannot bypass enum validation. (Completed)
- [x] Task 444: Add test proving MAC address alone cannot authenticate admin endpoints. (Completed)

## 27. Contract, Documentation, and Handoff

- [x] Task 445: Document the Computers response contract for `POST /api/computers/register`.
- [x] Task 446: Document the Computers response contract for `GET /api/computers`.
- [x] Task 447: Document the Computers response contract for `GET /api/computers/:id`.
- [x] Task 448: Document the Computers response contract for `PATCH /api/computers/:id`.
- [x] Task 449: Document the Computers response contract for `POST /api/computers/:id/reissue-token`.
- [x] Task 450: Document that plain device token is returned only once after register or reissue.
- [x] Task 451: Document that `deviceTokenHash` is never returned by API responses.
- [x] Task 452: Document tenant registration secret setup or rotation limitations for MVP.
- [x] Task 453: Document selected `DEVICE_TOKEN_HASH_SECRET` or equivalent env var.
- [x] Task 454: Document selected register rate-limit values.
- [x] Task 455: Document selected suspended-tenant register error mapping.
- [x] Task 456: Document that realtime heartbeat, Socket.IO auth, sessions, usage sync, URL policy behavior, Web Admin UI, and client PC UI remain future modules.
- [x] Task 457: Document lost-token or reinstalled-client runbook using admin token reissue.
- [x] Task 458: Prepare mobile/client handoff notes for registration request fields and one-time token storage.
- [x] Task 459: Update this task breakdown as implementation progresses.

## 28. Manual Verification

- [ ] Task 460: Ask the user/team to ensure backend env and database are configured.
- [ ] Task 461: Ask the user/team to run Prisma migration and client generation when schema changes are ready.
- [ ] Task 462: Ask the user/team to configure a tenant registration secret hash for a test tenant.
- [ ] Task 463: Ask the user/team to start the backend server manually when ready.
- [ ] Task 464: Ask the user/team to obtain a valid `shop_admin` access token.
- [ ] Task 465: Manually call `POST /api/computers/register` with valid tenant credentials.
- [ ] Task 466: Confirm register response returns a plain device token and no token hash.
- [ ] Task 467: Manually call duplicate `POST /api/computers/register` with the same tenant and MAC.
- [ ] Task 468: Confirm duplicate register returns `409 CONFLICT`.
- [ ] Task 469: Manually call `GET /api/computers` as `shop_admin`.
- [ ] Task 470: Manually call `GET /api/computers?status=ACTIVE&q=<value>&sort=createdAt:desc` as `shop_admin`.
- [ ] Task 471: Manually call `GET /api/computers/:id` as `shop_admin`.
- [ ] Task 472: Manually call `PATCH /api/computers/:id` to update `name`, `status`, and `notes`.
- [ ] Task 473: Manually call `POST /api/computers/:id/reissue-token`.
- [ ] Task 474: Confirm reissue returns a new plain device token and no token hash.
- [ ] Task 475: Confirm old token hash is replaced after reissue.
- [ ] Task 476: Confirm `staff` cannot access any Computers admin endpoint.
- [ ] Task 477: Confirm `super_admin` cannot access any Computers admin endpoint in MVP.
- [ ] Task 478: Ask the user/team to run Computers unit, service, API, typecheck, and manual verification commands when implementation is complete.

## 29. Final Review

- [ ] Task 479: Verify every Computers endpoint follows the Foundation success/error response shape.
- [ ] Task 480: Verify `POST /api/computers/register` is the only public Computers route.
- [ ] Task 481: Verify every admin route has `authRequired`.
- [ ] Task 482: Verify every admin route has `requireRole("shop_admin")`.
- [ ] Task 483: Verify every admin route has `requireTenantUser`.
- [ ] Task 484: Verify every mutating route has strict validation.
- [ ] Task 485: Verify every admin service method scopes by `tenantId`.
- [ ] Task 486: Verify register requires active tenant, valid registration secret, and normalized MAC address.
- [ ] Task 487: Verify duplicate register returns `409 CONFLICT`.
- [ ] Task 488: Verify register does not silently update existing computers.
- [ ] Task 489: Verify device token plaintext is returned only after register or reissue.
- [ ] Task 490: Verify no response includes `deviceTokenHash`.
- [ ] Task 491: Verify no logs include registration secrets, plain device tokens, token hashes, authorization headers, or raw request bodies.
- [ ] Task 492: Verify no new runtime dependency was added.
- [ ] Task 493: Verify no Computers-specific health endpoint was added.
- [ ] Task 494: Verify no realtime, sessions, usage sync, URL policy, Web Admin UI, or client PC UI code was added.
- [ ] Task 495: Verify no Prisma CLI, DB, migration, server, test, or typecheck command was run autonomously.
- [ ] Task 496: Verify `docs/tdd/computers/2026-05-23-computers-technical-design.md` remains aligned with implemented behavior.

