# Task Breakdown: CloudCMS Tenants Module

Source TDD: `docs/tdd/tenants/2026-05-20-tenants-tdd.md`

Purpose: turn the Tenants TDD into small implementation-sized checklist items. Each item should be small enough for one focused development step, usually a few hours or less.

Implementation constraints:

- Backend source lives under `backend/`.
- Runtime is Node.js backend with TypeScript.
- Package manager is `npm`.
- API framework is Express.
- ORM is Prisma with MySQL.
- Test runner is `vitest` with `supertest`.
- Reuse existing `authRequired` middleware from `backend/src/modules/auth/auth.middleware.ts`.
- Reuse existing role helpers from `backend/src/modules/auth/auth.rbac.ts` for the MVP.
- Reuse existing `validateRequest`, `AppError`, Prisma client singleton, request id, and logger infrastructure.
- Do not add new runtime dependencies for the Tenants MVP.
- Do not create a Prisma migration unless implementation discovers schema drift.
- Do not implement soft delete, restore, archive jobs, audit persistence, Web Admin UI, or Tenants-specific health endpoints.
- Do not run DB commands, migration commands, server commands, test commands, typecheck commands, or Prisma CLI autonomously; the user/team runs them when ready.
- Do not commit `.env` or secrets.

## 1. Pre-Implementation Alignment

- [x] Task 001: Read `docs/tdd/tenants/2026-05-20-tenants-tdd.md` before starting implementation.
- [x] Task 002: Read `docs/SPEC/tenants/SPEC.md` to confirm Tenants module scope boundaries.
- [x] Task 003: Confirm Tenants owns current-tenant profile read, current-tenant name update, super-admin tenant list/detail, and super-admin tenant name/status update.
- [x] Task 004: Confirm Tenants does not own public registration, user/staff management, computer registration, sessions, usage, URL rules, assets, subscriptions, audit persistence, or archival workflows.
- [x] Task 005: Confirm `Tenant.code` is immutable after Auth registration.
- [x] Task 006: Confirm only `super_admin` can update `Tenant.status`.
- [x] Task 007: Confirm `shop_admin` can update only their own tenant `name` through `/api/tenants/me`.
- [x] Task 008: Confirm `staff` can read `/api/tenants/me` but cannot update tenant data.
- [x] Task 009: Confirm all Tenants reads and writes defensively exclude `deletedAt != null` records.
- [x] Task 010: Confirm no Prisma migration is needed unless schema drift is discovered.
- [x] Task 011: Record in implementation notes that DB, migration, server, test, typecheck, and Prisma CLI commands remain user/team-run actions.

## 2. Existing Codebase Verification

- [x] Task 012: Inspect `backend/src/app.ts` to identify router mount order.
- [x] Task 013: Inspect `backend/src/modules/auth/auth.middleware.ts` to confirm `authRequired` behavior.
- [x] Task 014: Inspect `backend/src/modules/auth/auth.rbac.ts` to confirm `requireRole` and `requireTenantUser` behavior.
- [x] Task 015: Inspect `backend/src/shared/validation/validate-request.ts` to confirm validation middleware behavior.
- [x] Task 016: Inspect `backend/src/shared/errors/app-error.ts` and `backend/src/shared/errors/error-handler.ts` for expected error response shape.
- [x] Task 017: Inspect `backend/src/shared/prisma/prisma.client.ts` to confirm Prisma client import path.
- [x] Task 018: Inspect `backend/src/shared/logging/logger.ts` to confirm safe logger usage.
- [x] Task 019: Inspect `backend/prisma/schema.prisma` to confirm existing `Tenant` fields and `TenantStatus` enum.
- [x] Task 020: Inspect existing Auth API tests to follow the current Vitest/Supertest mocking style.

## 3. Tenants Module Scaffold

- [x] Task 021: Create `backend/src/modules/tenants/` directory.
- [x] Task 022: Create `backend/src/modules/tenants/tenants.routes.ts`.
- [x] Task 023: Create `backend/src/modules/tenants/tenants.controller.ts`.
- [x] Task 024: Create `backend/src/modules/tenants/tenants.service.ts`.
- [x] Task 025: Create `backend/src/modules/tenants/tenants.schema.ts`.
- [x] Task 026: Create `backend/src/modules/tenants/tenants.types.ts`.
- [x] Task 027: Create `backend/src/modules/tenants/tenants.logging.ts`.
- [x] Task 028: Export `tenantsRouter` from `tenants.routes.ts`.
- [x] Task 029: Keep controller logic thin and delegate business logic to `tenants.service.ts`.
- [x] Task 030: Keep Tenants-specific DTO and mapper logic out of route handlers.
- [x] Task 031: Keep Tenants logging helpers free of raw request headers, tokens, and request bodies.

## 4. App Wiring

- [x] Task 032: Import `tenantsRouter` in `backend/src/app.ts`.
- [x] Task 033: Mount `tenantsRouter` at `/api/tenants` in `backend/src/app.ts`.
- [x] Task 034: Place the Tenants router after `authContextMiddleware` and before `notFoundHandler`.
- [x] Task 035: Ensure the Tenants router is mounted after `healthRouter` and `authRouter` unless local app ordering requires otherwise.
- [x] Task 036: Verify `/api/tenants/me` routes are registered before `/:id` routes inside `tenants.routes.ts`.

## 5. Tenants Types and Response Mapping

- [x] Task 037: Define `TenantStatusDto` union as `"ACTIVE" | "SUSPENDED"` in `tenants.types.ts`.
- [x] Task 038: Define `TenantDto` with `id`, `code`, `name`, `status`, `createdAt`, and `updatedAt`.
- [x] Task 039: Define `ListTenantsInput` with `page`, `pageSize`, optional `status`, and optional `q`.
- [x] Task 040: Define `ListTenantsOutput` with `items`, `page`, `pageSize`, and `total`.
- [x] Task 041: Define `UpdateCurrentTenantInput` with `name`.
- [x] Task 042: Define `UpdateTenantByIdInput` with optional `name` and optional `status`.
- [x] Task 043: Implement `mapTenantDto` in `tenants.types.ts`.
- [x] Task 044: Ensure `mapTenantDto` includes `createdAt` and `updatedAt` as JSON-safe date values.
- [x] Task 045: Ensure `mapTenantDto` never includes `deletedAt`.
- [x] Task 046: Ensure Tenants response types never expose mutable protected fields beyond the approved DTO.

## 6. Validation Schemas

- [x] Task 047: Implement `tenantNameSchema` as trimmed string with min length `1` and max length `120`.
- [x] Task 048: Implement `tenantStatusSchema` as enum `ACTIVE` or `SUSPENDED`.
- [x] Task 049: Implement `tenantIdParamsSchema` with non-empty `id` string.
- [x] Task 050: Implement `updateCurrentTenantSchema` with strict body `{ name }`.
- [x] Task 051: Ensure `updateCurrentTenantSchema` rejects `status`.
- [x] Task 052: Ensure `updateCurrentTenantSchema` rejects `code`.
- [x] Task 053: Ensure `updateCurrentTenantSchema` rejects `id`, `deletedAt`, `createdAt`, and `updatedAt`.
- [x] Task 054: Ensure `updateCurrentTenantSchema` rejects unknown fields.
- [x] Task 055: Implement `updateTenantByIdSchema` with optional `name` and optional `status`.
- [x] Task 056: Ensure `updateTenantByIdSchema` requires at least one valid field.
- [x] Task 057: Ensure `updateTenantByIdSchema` rejects `code`.
- [x] Task 058: Ensure `updateTenantByIdSchema` rejects `id`, `deletedAt`, `createdAt`, and `updatedAt`.
- [x] Task 059: Ensure `updateTenantByIdSchema` rejects unknown fields.
- [x] Task 060: Implement query integer parsing helper for Express query strings.
- [x] Task 061: Implement `listTenantsQuerySchema` with default `page = 1`.
- [x] Task 062: Implement `listTenantsQuerySchema` with default `pageSize = 20`.
- [x] Task 063: Ensure `listTenantsQuerySchema` rejects `page < 1`.
- [x] Task 064: Ensure `listTenantsQuerySchema` rejects `pageSize < 1`.
- [x] Task 065: Ensure `listTenantsQuerySchema` rejects `pageSize > 100`.
- [x] Task 066: Ensure `listTenantsQuerySchema` accepts optional `status`.
- [x] Task 067: Ensure `listTenantsQuerySchema` rejects invalid `status`.
- [x] Task 068: Ensure `listTenantsQuerySchema` trims optional `q`.
- [x] Task 069: Ensure `listTenantsQuerySchema` rejects `q` longer than `100`.
- [x] Task 070: Decide whether empty `q` should be omitted or normalized to `undefined`, then implement consistently.
- [x] Task 071: Export all Tenants schemas for route-level `validateRequest` usage.

## 7. Tenants Logging

- [x] Task 072: Implement `logTenantNameUpdated` in `tenants.logging.ts`.
- [x] Task 073: Implement `logTenantStatusUpdated` in `tenants.logging.ts`.
- [x] Task 074: Include `requestId` in tenant update logs when available.
- [x] Task 075: Include `actorUserId`, `actorRole`, `actorTenantId`, and `targetTenantId` in safe update logs.
- [x] Task 076: Include `oldStatus` and `newStatus` for status update logs.
- [x] Task 077: Ensure tenant logging helpers do not accept raw request headers.
- [x] Task 078: Ensure tenant logging helpers do not accept access tokens or refresh tokens.
- [x] Task 079: Ensure tenant logging helpers do not log raw request bodies.

## 8. Tenants Service: Shared Helpers

- [x] Task 080: Import Prisma client singleton in `tenants.service.ts`.
- [x] Task 081: Import `AppError` in `tenants.service.ts`.
- [x] Task 082: Implement shared `createNotFoundTenantError` helper.
- [x] Task 083: Implement shared `createForbiddenError` helper for service-level guard fallbacks.
- [x] Task 084: Implement helper to assert a non-empty tenant id when service methods receive auth context.
- [x] Task 085: Implement helper to build base tenant where clause with `deletedAt: null`.
- [x] Task 086: Ensure all Tenants service methods return DTOs instead of raw Prisma models.

## 9. Tenants Service: Current Tenant Read

- [x] Task 087: Implement `getCurrentTenant(tenantId)` in `tenants.service.ts`.
- [x] Task 088: Query tenant by `id = tenantId` and `deletedAt = null`.
- [x] Task 089: Return `NOT_FOUND` when current tenant is missing.
- [x] Task 090: Return `NOT_FOUND` when current tenant has `deletedAt != null`.
- [x] Task 091: Return mapped `TenantDto` from `getCurrentTenant`.
- [x] Task 092: Ensure `getCurrentTenant` does not accept tenant id from request body, query, or params.

## 10. Tenants Service: Current Tenant Update

- [x] Task 093: Implement `updateCurrentTenantName(authContext, input)` in `tenants.service.ts`.
- [x] Task 094: Read target tenant id only from `authContext.tenantId`.
- [x] Task 095: Return `FORBIDDEN` if `authContext.tenantId` is missing.
- [x] Task 096: Load the current tenant by `authContext.tenantId` and `deletedAt = null`.
- [x] Task 097: Return `NOT_FOUND` if the current tenant is missing or deleted.
- [x] Task 098: Update only the current tenant `name`.
- [x] Task 099: Do not update tenant `status` in `updateCurrentTenantName`.
- [x] Task 100: Do not update tenant `code` in `updateCurrentTenantName`.
- [x] Task 101: Emit `tenant.name.updated` safe log after a successful name update.
- [x] Task 102: Return mapped `TenantDto` after update.

## 11. Tenants Service: Super-Admin List

- [x] Task 103: Implement `listTenants(input)` in `tenants.service.ts`.
- [x] Task 104: Build base list filter with `deletedAt = null`.
- [x] Task 105: Apply optional `status` filter.
- [x] Task 106: Apply optional `q` search over `Tenant.name`.
- [x] Task 107: Apply optional `q` search over `Tenant.code`.
- [x] Task 108: Sort list results by `createdAt desc`.
- [x] Task 109: Calculate `skip = (page - 1) * pageSize`.
- [x] Task 110: Use `take = pageSize`.
- [x] Task 111: Query total matching tenant count.
- [x] Task 112: Query paginated tenant items.
- [x] Task 113: Avoid loading user relations for tenant list.
- [x] Task 114: Return `items`, `page`, `pageSize`, and `total`.
- [x] Task 115: Ensure list response DTOs do not include `deletedAt`.

## 12. Tenants Service: Super-Admin Detail

- [x] Task 116: Implement `getTenantById(id)` in `tenants.service.ts`.
- [x] Task 117: Query tenant by `id` and `deletedAt = null`.
- [x] Task 118: Return `NOT_FOUND` for unknown tenant id.
- [x] Task 119: Return `NOT_FOUND` for deleted tenant.
- [x] Task 120: Return mapped `TenantDto`.
- [x] Task 121: Avoid loading unnecessary relations for tenant detail.

## 13. Tenants Service: Super-Admin Update

- [x] Task 122: Implement `updateTenantById(authContext, id, input)` in `tenants.service.ts`.
- [x] Task 123: Load target tenant by `id` and `deletedAt = null`.
- [x] Task 124: Return `NOT_FOUND` for unknown or deleted tenant.
- [x] Task 125: Build update data from allowlisted `name` and `status` fields only.
- [x] Task 126: Update tenant `name` when `name` is provided.
- [x] Task 127: Update tenant `status` when `status` is provided.
- [x] Task 128: Do not update tenant `code` in `updateTenantById`.
- [x] Task 129: Do not update `id`, `deletedAt`, `createdAt`, or `updatedAt` directly.
- [x] Task 130: Emit `tenant.name.updated` safe log when tenant name changes.
- [x] Task 131: Emit `tenant.status.updated` safe log when tenant status changes.
- [x] Task 132: Include old and new status values in status update logs.
- [x] Task 133: Return mapped `TenantDto` after update.

## 14. Tenants Controllers

- [x] Task 134: Implement `tenantsController.getCurrentTenant`.
- [x] Task 135: Implement `tenantsController.updateCurrentTenant`.
- [x] Task 136: Implement `tenantsController.listTenants`.
- [x] Task 137: Implement `tenantsController.getTenantById`.
- [x] Task 138: Implement `tenantsController.updateTenantById`.
- [x] Task 139: Ensure each controller reads validated `req.body`, `req.query`, and `req.params`.
- [x] Task 140: Ensure each controller reads `req.authContext` only after `authRequired`.
- [x] Task 141: Ensure each controller returns Foundation success response shape.
- [x] Task 142: Ensure each async controller passes errors to `next(error)`.
- [x] Task 143: Ensure controllers do not contain Prisma query logic.
- [x] Task 144: Ensure controllers do not log raw request bodies or headers.

## 15. Tenants Routes

- [x] Task 145: Add `GET /me` route in `tenants.routes.ts`.
- [x] Task 146: Add `authRequired` middleware to `GET /me`.
- [x] Task 147: Add `requireRole("shop_admin", "staff")` to `GET /me`.
- [x] Task 148: Add `requireTenantUser` to `GET /me`.
- [x] Task 149: Wire `GET /me` to `tenantsController.getCurrentTenant`.
- [x] Task 150: Add `PATCH /me` route in `tenants.routes.ts`.
- [x] Task 151: Add `authRequired` middleware to `PATCH /me`.
- [x] Task 152: Add `requireRole("shop_admin")` to `PATCH /me`.
- [x] Task 153: Add `requireTenantUser` to `PATCH /me`.
- [x] Task 154: Add `validateRequest({ body: updateCurrentTenantSchema })` to `PATCH /me`.
- [x] Task 155: Wire `PATCH /me` to `tenantsController.updateCurrentTenant`.
- [x] Task 156: Add `GET /` route in `tenants.routes.ts`.
- [x] Task 157: Add `authRequired` and `requireRole("super_admin")` to `GET /`.
- [x] Task 158: Add `validateRequest({ query: listTenantsQuerySchema })` to `GET /`.
- [x] Task 159: Wire `GET /` to `tenantsController.listTenants`.
- [x] Task 160: Add `GET /:id` route in `tenants.routes.ts`.
- [x] Task 161: Add `authRequired` and `requireRole("super_admin")` to `GET /:id`.
- [x] Task 162: Add `validateRequest({ params: tenantIdParamsSchema })` to `GET /:id`.
- [x] Task 163: Wire `GET /:id` to `tenantsController.getTenantById`.
- [x] Task 164: Add `PATCH /:id` route in `tenants.routes.ts`.
- [x] Task 165: Add `authRequired` and `requireRole("super_admin")` to `PATCH /:id`.
- [x] Task 166: Add `validateRequest({ params: tenantIdParamsSchema, body: updateTenantByIdSchema })` to `PATCH /:id`.
- [x] Task 167: Wire `PATCH /:id` to `tenantsController.updateTenantById`.
- [x] Task 168: Verify `/me` routes are declared before `/:id` routes.

## 16. Error Handling and Response Behavior

- [x] Task 169: Reuse `UNAUTHORIZED` for missing, malformed, invalid, expired, or wrong-token-type access tokens.
- [x] Task 170: Reuse `FORBIDDEN` for wrong roles.
- [x] Task 171: Reuse `FORBIDDEN` when `/me` is called without tenant context.
- [x] Task 172: Reuse `NOT_FOUND` for unknown tenants.
- [x] Task 173: Reuse `NOT_FOUND` for tenants excluded by `deletedAt != null`.
- [x] Task 174: Reuse `VALIDATION_ERROR` for invalid body, query, or params.
- [x] Task 175: Ensure Tenants error responses use the existing Foundation error response shape.
- [x] Task 176: Ensure Tenants success responses use the existing Foundation success response shape.

## 17. Security Hardening

- [x] Task 177: Verify every Tenants route uses `authRequired`.
- [x] Task 178: Verify tenant-bound users cannot call `GET /api/tenants`.
- [x] Task 179: Verify tenant-bound users cannot call `GET /api/tenants/:id`.
- [x] Task 180: Verify tenant-bound users cannot call `PATCH /api/tenants/:id`.
- [x] Task 181: Verify `staff` cannot call `PATCH /api/tenants/me`.
- [x] Task 182: Verify `shop_admin` cannot update `status` through `/me`.
- [x] Task 183: Verify `shop_admin` cannot update `code` through `/me`.
- [x] Task 184: Verify `super_admin` status update is allowed only through `PATCH /api/tenants/:id`.
- [x] Task 185: Verify all request body schemas reject unknown fields.
- [x] Task 186: Verify Tenants code never reads target tenant id from `/me` body, query, or params.
- [x] Task 187: Verify Tenants logs do not include authorization headers.
- [x] Task 188: Verify Tenants logs do not include access tokens or refresh tokens.
- [x] Task 189: Verify Tenants logs do not include raw request headers.
- [x] Task 190: Verify Tenants logs do not include raw request bodies.

## 18. Unit and Service Tests

- [x] Task 191: Create `backend/tests/tenants/` directory.
- [x] Task 192: Add unit test that `mapTenantDto` omits `deletedAt`.
- [x] Task 193: Add unit test that `mapTenantDto` includes `id`, `code`, `name`, `status`, `createdAt`, and `updatedAt`.
- [x] Task 194: Add unit test for `tenantNameSchema` valid input.
- [x] Task 195: Add unit test for `tenantNameSchema` empty string rejection.
- [x] Task 196: Add unit test for `tenantNameSchema` max length rejection.
- [x] Task 197: Add unit test for `tenantStatusSchema` valid statuses.
- [x] Task 198: Add unit test for `tenantStatusSchema` invalid status rejection.
- [x] Task 199: Add unit test for list query default `page` and `pageSize`.
- [x] Task 200: Add unit test for list query rejecting invalid `page`.
- [x] Task 201: Add unit test for list query rejecting invalid `pageSize`.
- [x] Task 202: Add unit test for list query rejecting `pageSize > 100`.
- [x] Task 203: Add unit test for list query trimming `q`.
- [x] Task 204: Add service test that `listTenants` builds pagination correctly.
- [x] Task 205: Add service test that `listTenants` always filters `deletedAt: null`.
- [x] Task 206: Add service test that `updateCurrentTenantName` uses auth context tenant id.
- [x] Task 207: Add service test that `updateTenantById` only applies allowlisted fields.
- [x] Task 208: Add service test that `updateTenantById` throws `NOT_FOUND` for missing tenants.
- [x] Task 209: Add service test that `updateTenantById` throws `NOT_FOUND` for deleted tenants.

## 19. API Authentication Tests

- [x] Task 210: Create `backend/tests/tenants/tenants.api.test.ts`.
- [x] Task 211: Add Supertest case that `GET /api/tenants/me` without token returns `401`.
- [x] Task 212: Add Supertest case that `GET /api/tenants` without token returns `401`.
- [x] Task 213: Add Supertest case that malformed bearer token on Tenants API returns `401`.
- [x] Task 214: Add Supertest case that invalid access token on Tenants API returns `401`.
- [x] Task 215: Add Supertest case that expired access token on Tenants API returns `401`.

## 20. Current Tenant API Tests

- [x] Task 216: Add Supertest case that `shop_admin` can call `GET /api/tenants/me`.
- [x] Task 217: Add Supertest case that `staff` can call `GET /api/tenants/me`.
- [x] Task 218: Add Supertest case proving `GET /api/tenants/me` uses `req.authContext.tenantId`.
- [x] Task 219: Add Supertest case that `GET /api/tenants/me` returns `403` when tenant id is missing.
- [x] Task 220: Add Supertest case that `GET /api/tenants/me` returns `404` when current tenant is missing.
- [x] Task 221: Add Supertest case that `GET /api/tenants/me` returns `404` for deleted tenant.
- [x] Task 222: Add Supertest case that `GET /api/tenants/me` response does not expose `deletedAt`.

## 21. Current Tenant Update API Tests

- [x] Task 223: Add Supertest case that `shop_admin` can update own tenant name through `PATCH /api/tenants/me`.
- [x] Task 224: Add Supertest case that `staff` cannot call `PATCH /api/tenants/me`.
- [x] Task 225: Add Supertest case that `super_admin` without tenant id cannot call `PATCH /api/tenants/me`.
- [x] Task 226: Add Supertest case that `PATCH /api/tenants/me` trims `name`.
- [x] Task 227: Add Supertest case that `PATCH /api/tenants/me` rejects empty `name`.
- [x] Task 228: Add Supertest case that `PATCH /api/tenants/me` rejects overlong `name`.
- [x] Task 229: Add Supertest case that `PATCH /api/tenants/me` rejects `status`.
- [x] Task 230: Add Supertest case that `PATCH /api/tenants/me` rejects `code`.
- [x] Task 231: Add Supertest case that `PATCH /api/tenants/me` rejects `id`, `deletedAt`, `createdAt`, and `updatedAt`.
- [x] Task 232: Add Supertest case proving `PATCH /api/tenants/me` does not accept target tenant id from the client.
- [x] Task 233: Add Supertest case that `PATCH /api/tenants/me` response does not expose `deletedAt`.

## 22. Super-Admin List API Tests

- [x] Task 234: Add Supertest case that `super_admin` can call `GET /api/tenants`.
- [x] Task 235: Add Supertest case that tenant list defaults to `page = 1`.
- [x] Task 236: Add Supertest case that tenant list defaults to `pageSize = 20`.
- [x] Task 237: Add Supertest case that tenant list rejects `pageSize > 100`.
- [x] Task 238: Add Supertest case that tenant list supports `status=ACTIVE`.
- [x] Task 239: Add Supertest case that tenant list supports `status=SUSPENDED`.
- [x] Task 240: Add Supertest case that tenant list rejects invalid `status`.
- [x] Task 241: Add Supertest case that tenant list supports `q` search over tenant name.
- [x] Task 242: Add Supertest case that tenant list supports `q` search over tenant code.
- [x] Task 243: Add Supertest case that tenant list rejects overlong `q`.
- [x] Task 244: Add Supertest case that tenant list rejects invalid `page`.
- [x] Task 245: Add Supertest case that tenant list rejects invalid `pageSize`.
- [x] Task 246: Add Supertest case that tenant list returns `items`, `page`, `pageSize`, and `total`.
- [x] Task 247: Add Supertest case that tenant list response does not expose `deletedAt`.
- [x] Task 248: Add Supertest case that tenant list excludes tenants where `deletedAt` is not null.
- [x] Task 249: Add Supertest case that `shop_admin` cannot call `GET /api/tenants`.
- [x] Task 250: Add Supertest case that `staff` cannot call `GET /api/tenants`.

## 23. Super-Admin Detail API Tests

- [x] Task 251: Add Supertest case that `super_admin` can call `GET /api/tenants/:id`.
- [x] Task 252: Add Supertest case that unknown tenant detail returns `404`.
- [x] Task 253: Add Supertest case that deleted tenant detail returns `404`.
- [x] Task 254: Add Supertest case that invalid `id` returns `400`.
- [x] Task 255: Add Supertest case that tenant detail response does not expose `deletedAt`.
- [x] Task 256: Add Supertest case that `shop_admin` cannot call `GET /api/tenants/:id`.
- [x] Task 257: Add Supertest case that `staff` cannot call `GET /api/tenants/:id`.

## 24. Super-Admin Update API Tests

- [x] Task 258: Add Supertest case that `super_admin` can update tenant name.
- [x] Task 259: Add Supertest case that `super_admin` can update tenant status to `ACTIVE`.
- [x] Task 260: Add Supertest case that `super_admin` can update tenant status to `SUSPENDED`.
- [x] Task 261: Add Supertest case that `super_admin` can update name and status in one request.
- [x] Task 262: Add Supertest case that empty update body returns `400`.
- [x] Task 263: Add Supertest case that invalid `status` returns `400`.
- [x] Task 264: Add Supertest case that empty `name` returns `400`.
- [x] Task 265: Add Supertest case that overlong `name` returns `400`.
- [x] Task 266: Add Supertest case that unknown fields return `400`.
- [x] Task 267: Add Supertest case that attempts to update `code` return `400`.
- [x] Task 268: Add Supertest case that attempts to update `id`, `deletedAt`, `createdAt`, or `updatedAt` return `400`.
- [x] Task 269: Add Supertest case that updating unknown tenant returns `404`.
- [x] Task 270: Add Supertest case that updating deleted tenant returns `404`.
- [x] Task 271: Add Supertest case that `shop_admin` cannot call `PATCH /api/tenants/:id`.
- [x] Task 272: Add Supertest case that `staff` cannot call `PATCH /api/tenants/:id`.
- [x] Task 273: Add Supertest case that super-admin update response does not expose `deletedAt`.

## 25. Security and Logging Tests

- [x] Task 274: Add test that tenant name update logs include `requestId`.
- [x] Task 275: Add test that tenant status update logs include `requestId`.
- [x] Task 276: Add test that tenant update logs include actor role and target tenant id.
- [x] Task 277: Add test that tenant status update logs include `oldStatus` and `newStatus`.
- [x] Task 278: Add test that Tenants logs do not include authorization headers.
- [x] Task 279: Add test that Tenants logs do not include access tokens.
- [x] Task 280: Add test that Tenants logs do not include refresh tokens.
- [x] Task 281: Add test that Tenants logs do not include raw request headers.
- [x] Task 282: Add test that Tenants logs do not include raw request bodies.
- [x] Task 283: Add test that Tenants responses never expose `deletedAt`.
- [x] Task 284: Add test that Tenants responses never expose protected mutable fields beyond the approved DTO.

### 25.1 Additional Security Bypass Hardening (User-requested)

- [x] Add API test that refresh-token-type JWT cannot access protected Tenants endpoints.
- [x] Add API test that JWT with invalid `role` claim is rejected as `UNAUTHORIZED`.
- [x] Add API test that `shop_admin` cannot escalate role via custom request headers.
- [x] Add API test that `/api/tenants/me` ignores forged tenant headers and only uses `authContext.tenantId`.
- [x] Add API test that duplicated pagination query parameters are rejected (`VALIDATION_ERROR`).
- [x] Add API test that type-confusion payload for `name` is rejected.
- [x] Add API test that lowercase `status` cannot bypass enum validation.
- [x] Add API test that SQL-like `q` payload does not break list endpoint handling.

### 25.2 Advanced SQL Injection Hardening (User-requested)

- [x] Add matrix API tests that common SQL injection payloads in list `q` are treated as literal search input.
- [x] Add API test that list `q` SQL payload is passed to Prisma as structured `where` data.
- [x] Add API test that SQL-like tenant detail `id` does not resolve an existing tenant.
- [x] Add API test that SQL-like tenant update `id` cannot update the target tenant.
- [x] Add API test that `/api/tenants/me` `name` SQL payload is stored as a literal value only.
- [x] Add API test that `PATCH /api/tenants/:id` `name` SQL payload is stored as a literal value only.
- [x] Add API test that SQL-like `status` enum injection is rejected.
- [x] Add API test that SQL-like `q` payload still excludes soft-deleted tenants.

## 26. Documentation and Handoff

- [x] Task 285: Update Tenants implementation notes with the final endpoint list.
- [x] Task 286: Document that no Tenants-specific environment variables are required.
- [x] Task 287: Document that no Prisma migration is required unless schema drift is discovered.
- [x] Task 288: Document that soft delete, archive jobs, and audit persistence remain future work.
- [x] Task 289: Document manual verification steps for `shop_admin`, `staff`, and `super_admin` tokens.
- [x] Task 290: Document Web Admin handoff notes for current tenant profile, current tenant name update, and super-admin tenant management screens.
- [x] Task 291: Update task completion statuses in this file as implementation progresses.

## 27. Manual Verification

- [ ] Task 292: Ask the user/team to ensure backend env and database are configured.
- [ ] Task 293: Ask the user/team to start the backend server manually when ready.
- [ ] Task 294: Ask the user/team to obtain valid `shop_admin`, `staff`, and `super_admin` access tokens.
- [ ] Task 295: Manually call `GET /api/tenants/me` as `shop_admin`.
- [ ] Task 296: Manually call `GET /api/tenants/me` as `staff`.
- [ ] Task 297: Manually call `PATCH /api/tenants/me` as `shop_admin`.
- [ ] Task 298: Confirm `staff` cannot call `PATCH /api/tenants/me`.
- [ ] Task 299: Manually call `GET /api/tenants` as `super_admin` with pagination.
- [ ] Task 300: Manually call `GET /api/tenants?status=SUSPENDED` as `super_admin`.
- [ ] Task 301: Manually call `GET /api/tenants?q=<value>` as `super_admin`.
- [ ] Task 302: Manually call `GET /api/tenants/:id` as `super_admin`.
- [ ] Task 303: Manually call `PATCH /api/tenants/:id` as `super_admin` to update `name`.
- [ ] Task 304: Manually call `PATCH /api/tenants/:id` as `super_admin` to update `status`.
- [ ] Task 305: Confirm tenant users cannot access super-admin routes.
- [ ] Task 306: Ask the user/team to run Tenants API tests when ready.
- [ ] Task 307: Ask the user/team to run TypeScript typecheck when ready.

## 28. Final Review

- [ ] Task 308: Verify every Tenants endpoint follows the Foundation success/error response shape.
- [ ] Task 309: Verify every Tenants route has `authRequired`.
- [ ] Task 310: Verify every Tenants route has the required role guard.
- [ ] Task 311: Verify every mutating Tenants route has strict validation.
- [ ] Task 312: Verify `/me` routes use only `req.authContext.tenantId`.
- [ ] Task 313: Verify super-admin routes are inaccessible to `shop_admin` and `staff`.
- [ ] Task 314: Verify `Tenant.code` remains immutable.
- [ ] Task 315: Verify `Tenant.status` can be changed only by `super_admin`.
- [ ] Task 316: Verify every Tenants read/write excludes `deletedAt != null`.
- [ ] Task 317: Verify no Tenants response includes `deletedAt`.
- [ ] Task 318: Verify no Tenants logs include tokens, raw headers, or raw bodies.
- [ ] Task 319: Verify no new dependency was added for the Tenants MVP.
- [ ] Task 320: Verify no Prisma migration was created unless schema drift was documented.
- [ ] Task 321: Verify `docs/tdd/tenants/2026-05-20-tenants-tdd.md` remains aligned with implemented behavior.
