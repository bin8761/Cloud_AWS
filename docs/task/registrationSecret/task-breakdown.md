# Task Breakdown: Computer Registration Secret Provisioning

Source TDD: `docs/tdd/registrationSecret/2026-05-26-registration-secret-technical-design.md`

Purpose: convert the registration secret TDD into a developer-facing Markdown checklist that follows `rule/task-breakdown-rule.mdc`.

Implementation constraints:

- Backend source lives under `backend/`.
- Runtime is Node.js backend with TypeScript.
- Package manager is `npm`.
- API framework is Express.
- ORM is Prisma with MySQL.
- Test runner is Vitest with Supertest.
- Reuse existing Auth, Tenants, Computers, Prisma, validation, error, request id, RBAC, and logging infrastructure.
- Do not add new runtime dependencies for this MVP.
- Do not add new Prisma tables or new `Tenant` fields for this MVP.
- Do not add Web Admin UI, Client PC UI, per-computer invite keys, human-chosen registration passwords, audit persistence tables, or registration-secret health endpoints for this MVP.
- Do not run DB commands, migration commands, server commands, test commands, typecheck commands, or Prisma CLI autonomously; the user/team runs them when ready.
- Do not commit `.env` or secrets.
- Do not log `computerRegistrationSecret`, `computerRegistrationSecretHash`, authorization headers, access tokens, refresh tokens, device tokens, or raw secret-bearing request bodies.

Implementation notes:

- The current Prisma schema already contains nullable `Tenant.computerRegistrationSecretHash`; no schema change is planned unless source inspection proves drift.
- Plain `computerRegistrationSecret` may appear only in successful `POST /api/auth/register-tenant/verify` and `POST /api/tenants/me/computer-registration-secret/reissue` responses.
- Plain `computerRegistrationSecret` is returned once and must never be persisted.
- Reissue overwrites `Tenant.computerRegistrationSecretHash` and invalidates the previous plain secret immediately.
- `POST /api/computers/register` keeps its current contract and consumes the latest tenant registration secret.

## 1. Pre-Implementation Alignment

- [x] Task 001: Read `docs/tdd/registrationSecret/2026-05-26-registration-secret-technical-design.md` before starting implementation. (Confirmed 2026-05-26: TDD defines Auth initial provisioning, Tenants reissue endpoint, Computers compatibility, security/logging constraints, and test plan.)
- [x] Task 002: Read `docs/SPEC/registrationSecret/SPEC.md` to confirm feature scope and success criteria. (Confirmed 2026-05-26: scope is tenant-level secret provisioning during verify, shop-admin reissue, existing computer registration compatibility, and no secret/hash leakage.)
- [x] Task 003: Read `docs/plans/2026-05-26-computer-registration-secret-design.md` to confirm approved product decisions. (Confirmed 2026-05-26: approved MVP uses long-lived tenant registration secret, returns plain secret once, stores only hash, and reissue invalidates the previous secret.)
- [x] Task 004: Read `docs/plans/2026-05-26-computer-registration-secret-implementation-plan.md` to align implementation sequencing. (Confirmed 2026-05-26: sequence is generator, Auth verify secret return, Tenants reissue, rotation compatibility, docs/Postman, then manual verification; test/commit steps are not run in this read-only turn.)
- [x] Task 005: Confirm Auth owns initial secret provisioning during tenant verification. (Confirmed 2026-05-26: TDD affected modules assign Auth to generate/return the initial secret in `POST /api/auth/register-tenant/verify`; source currently routes `/register-tenant/verify` through `authController.verifyTenantRegistration()` to `authService.verifyTenantRegistration()`.)
- [x] Task 006: Confirm Tenants owns shop-admin reissue of the tenant registration secret. (Confirmed 2026-05-26: TDD and SPEC assign `POST /api/tenants/me/computer-registration-secret/reissue` to Tenants with `authRequired`, `requireRole("shop_admin")`, and `requireTenantUser`; existing Tenants routes already own `/me` current-tenant operations.)
- [x] Task 007: Confirm Computers owns secret generation/hash helper reuse and existing register verification behavior. (Confirmed 2026-05-26: TDD assigns reusable generation/hashing primitives to Computers; source already exposes `hashRegistrationSecret()`, `compareRegistrationSecret()`, `TenantSecretStrategy`, and `registerComputer()` verification against `Tenant.computerRegistrationSecretHash`.)
- [x] Task 008: Confirm `POST /api/auth/register-tenant/verify` response adds `data.computerRegistrationSecret`. (Confirmed 2026-05-26: TDD, SPEC, approved design, and implementation plan all require adding `data.computerRegistrationSecret` to the successful verify response; current source has not implemented the field yet, which is the expected implementation gap for later tasks.)
- [x] Task 009: Confirm `POST /api/tenants/me/computer-registration-secret/reissue` is the only new endpoint. (Confirmed 2026-05-26: TDD/SPEC/design/plan identify only this new endpoint for MVP; current Tenants routes do not yet include it and show no conflicting registration-secret endpoint.)
- [x] Task 010: Confirm `POST /api/computers/register` request contract remains unchanged. (Confirmed 2026-05-26: TDD/SPEC/design require no Computers register request contract change; current source still validates only `tenantCode`, `registrationSecret`, `macAddress`, and optional `name` via `registerComputerSchema`.)
- [x] Task 011: Confirm no Web Admin UI or Client PC UI is implemented in this MVP. (Confirmed 2026-05-26: TDD/SPEC mark UI out of MVP scope; workspace currently contains backend/docs/rule only and no frontend/mobile UI file types were found.)
- [x] Task 012: Confirm no new Prisma table or Tenant field is added in this MVP. (Confirmed 2026-05-26: TDD/SPEC/design/plan require reusing existing nullable `Tenant.computerRegistrationSecretHash`; current schema shows that field on `Tenant` and no registration-secret table/extra Tenant rotation fields.)
- [x] Task 013: Confirm no new runtime dependency is required. (Confirmed 2026-05-26: TDD states no new package dependency is required; planned implementation uses existing stack plus Node `crypto` and existing hashing/validation helpers.)
- [x] Task 014: Confirm all DB, Prisma, migration, server, test, and typecheck commands remain user/team-run actions. (Confirmed 2026-05-26: TDD/SPEC/task constraints prohibit autonomous DB/Prisma/migration/server/test/typecheck execution; backend package scripts for those actions remain manual user/team-run commands.)

## 2. Existing Codebase Verification

- [x] Task 015: Inspect `backend/prisma/schema.prisma` to confirm `Tenant.computerRegistrationSecretHash` exists and is nullable. (Confirmed 2026-05-26: `model Tenant` contains `computerRegistrationSecretHash String?` in `backend/prisma/schema.prisma`, so field exists and is nullable.)
- [x] Task 016: Inspect `backend/src/modules/auth/auth.routes.ts` to confirm `POST /api/auth/register-tenant/verify` routing and validation stack. (Confirmed 2026-05-26: `authRouter.post("/register-tenant/verify", registerTenantVerifyRateLimitMiddleware, validateRequest({ body: verifyTenantRegistrationSchema }), ...)` is present, matching expected verify route stack under Auth router.)
- [x] Task 017: Inspect `backend/src/modules/auth/auth.controller.ts` to confirm verify controller response pattern. (Confirmed 2026-05-26: `verifyTenantRegistration()` reads `VerifyRegisterTenantInput`, calls `authService.verifyTenantRegistration(...)`, and returns `response.status(200).json({ success: true, data })` with shared success envelope.)
- [x] Task 018: Inspect `backend/src/modules/auth/auth.service.ts` to identify `verifyTenantRegistration` and tenant creation helper boundaries. (Confirmed 2026-05-26: `verifyTenantRegistration()` is implemented and orchestrates pending-registration validation, tenant/user creation, verification consumption, refresh-token creation, access-token signing, and completion logging; tenant creation currently flows through `createActiveTenantInVerificationTransaction({ tenantCode, tenantName })` with safe select only (`id`, `code`, `name`, `status`). Boundary mismatch noted vs TDD future contract: current tenant-create helper input/data does not yet carry `computerRegistrationSecretHash`, which aligns with pending implementation tasks 052-055.)
- [x] Task 019: Inspect `backend/src/modules/auth/auth.types.ts` to identify `VerifyRegisterTenantOutput`. (Confirmed 2026-05-26: `VerifyRegisterTenantOutput` currently equals `{ tenant, user } & AuthTokenPairDto` and does not yet include `computerRegistrationSecret: string`; this is a type contract mismatch with TDD and is already planned for Task 049.)
- [x] Task 020: Inspect `backend/src/modules/auth/auth.logging.ts` to confirm safe logging allowlist behavior. (Confirmed 2026-05-26: Auth logging uses explicit allowlisted payload assembly in `logAuthEvent()` and forbids raw body keys via `ForbiddenAuthLogBodyFields` (`body`, `req`, `requestBody`, `rawBody`); no spread of caller input is used. Current verify success/failure logging through Auth service passes safe metadata (`requestId`, ids, role, maskedEmail/emailHash, reason/status, ip, userAgent) and does not pass secret/hash/token/header fields.)
- [x] Task 021: Inspect `backend/src/modules/computers/computers.service.ts` to confirm `hashRegistrationSecret` and registration verification behavior. (Confirmed 2026-05-26: service exports `hashRegistrationSecret()` and `compareRegistrationSecret()` using `authPasswordService`; `registerComputer()` validates tenant, verifies submitted secret via `verifyRegistrationSecretOrThrowUnauthorized()` -> `registrationSecretStrategy.verify(submittedSecret, tenant.computerRegistrationSecretHash)`, then persists only `deviceTokenHash` while returning plain `deviceToken` once in response.)
- [x] Task 022: Inspect `backend/src/modules/computers/registration-auth.strategy.ts` to confirm secret comparison behavior. (Confirmed 2026-05-26: `TenantSecretStrategy.verify()` rejects missing stored hash (`null` => `false`) and otherwise delegates to `passwordComparator.comparePassword(submittedSecret, storedSecretHash)`.)
- [x] Task 023: Inspect `backend/src/modules/computers/computers.schema.ts` to confirm `POST /api/computers/register` payload remains unchanged. (Confirmed 2026-05-26: `registerComputerSchema` remains strict with only `tenantCode`, `registrationSecret`, `macAddress`, and optional `name`; no new register payload fields were introduced.)
- [x] Task 024: Inspect `backend/src/modules/computers/computers.mapper.ts` to confirm computer DTOs do not expose secret/hash fields. (Confirmed 2026-05-26: `mapComputerToResponse()`/`mapComputerListResponse()` expose only safe computer fields (`id`, `tenantId`, `name`, `macAddress`, `status`, `lastSeenAt`, `notes`, `createdAt`, `updatedAt`) and do not include `registrationSecret`, `computerRegistrationSecretHash`, or `deviceTokenHash`.)
- [x] Task 025: Inspect `backend/src/modules/tenants/tenants.routes.ts` to identify route ordering and `/:id` collision risks. (Confirmed 2026-05-26: current route order is `/me` GET/PATCH, `/` GET, then `/:id` GET/PATCH; no current reissue route exists, so planned `POST /me/computer-registration-secret/reissue` must be declared before `/:id` routes to prevent parameterized capture risk.)
- [x] Task 026: Inspect `backend/src/modules/tenants/tenants.schema.ts` to align new strict reissue schema style. (Confirmed 2026-05-26: current body schemas (`updateCurrentTenantSchema`, `updateTenantByIdSchema`) use `z.object(...).strict()` and trimmed string style via `tenantNameSchema`; reissue schema should follow this strict object + optional trimmed `reason` pattern and remain exported via `tenantsRouteSchemas`.)
- [x] Task 027: Inspect `backend/src/modules/tenants/tenants.controller.ts` to reuse authenticated controller context pattern. (Confirmed 2026-05-26: controller centralizes auth retrieval with `readAuthContextAfterAuthRequired(request)` and throws `401 UNAUTHORIZED` if missing; authenticated write handlers pass `{ ...authContext, requestId: request.requestId }` into service and return `{ success: true, data }`.)
- [x] Task 028: Inspect `backend/src/modules/tenants/tenants.service.ts` to reuse current tenant lookup/update patterns. (Confirmed 2026-05-26: service already enforces tenant scope via `assertTenantIdFromAuthContext` (`403 FORBIDDEN` on missing/blank tenant id), applies active-tenant filter through `createBaseTenantWhere()` (`deletedAt: null`), and uses `updateMany` + `count===0` -> existing not-found behavior. Reissue should follow this same tenant-scoped update pattern and not trust client-provided tenant id.)
- [x] Task 029: Inspect `backend/src/modules/tenants/tenants.types.ts` to add reissue input/output types. (Confirmed 2026-05-26: current type module defines tenant read/update inputs/outputs and DTO mapping conventions but does not yet define reissue-specific types; planned additions should follow existing explicit exported aliases, e.g. `ReissueComputerRegistrationSecretInput` and output envelope payload containing `computerRegistrationSecret`.)
- [x] Task 030: Inspect `backend/src/modules/tenants/tenants.logging.ts` to reuse safe structured logging patterns. (Confirmed 2026-05-26: logging service uses explicit allowlisted payload assembly, forbids raw body/header/token fields at type level, and flags dropped sensitive inputs without spreading caller objects. Pattern is safe to reuse for reissue event; alignment note vs TDD: current generic payload supports raw `reason`, so reissue implementation should apply approved sanitization strategy (or `reasonLength`) before logging.)
- [x] Task 031: Inspect `backend/src/modules/auth/auth.rbac.ts` to confirm `requireRole("shop_admin")` and `requireTenantUser` behavior. (Confirmed 2026-05-26: `requireRole(...roles)` reads `req.authContext?.role` and returns `403 FORBIDDEN` when missing/not allowed; `requireTenantUser` enforces non-empty trimmed string `tenantId` and returns `403 FORBIDDEN` otherwise. This matches shop-admin-only route gating when combined as `authRequired` + `requireRole("shop_admin")` + `requireTenantUser`.)
- [x] Task 032: Inspect `backend/src/shared/validation/validate-request.ts` to confirm strict schema output behavior. (Confirmed 2026-05-26: middleware parses each configured segment (`body/query/params`) via schema `.parse(...)` and writes parsed output back to `req` using `assignValidatedSegment`; thus strict zod schemas (e.g., `.strict()`) propagate sanitized/validated output and reject unknown fields with `400 VALIDATION_ERROR`.)
- [x] Task 033: Inspect existing Auth tests under `backend/tests/auth` to reuse tenant verification test setup. (Confirmed 2026-05-26: `backend/tests/auth/auth.api.test.ts` provides reusable tenant-verification setup with `setTestEnv()`, in-memory `createPrismaMock()`, `vi.doMock(...)` for Prisma/email/logger, helper flow `registerTenantAndReadCode()` + `verifyTenantRegistration()`, and assertion style around `UNAUTHORIZED` generic message, consumed/expired verification behavior, and secret-safe logging checks. Live auth tests exist (`auth.api.live*.test.ts`) but are env-gated via `RUN_AUTH_LIVE_TESTS === "true"`.)
- [x] Task 034: Inspect existing Tenants tests under `backend/tests/tenants` to reuse route/service/mock style. (Confirmed 2026-05-26: Tenants test stack is split into API/service/unit files; API tests use in-memory Prisma state + JWT helper token builder + reusable status assertion helpers and verify tenant-scoped access (`authContext.tenantId`) and soft-delete filtering. Service tests use `vi.hoisted` mocks for Prisma/logging and assert `updateMany` scoping (`deletedAt: null`) plus allowlisted update data/log calls. Unit tests validate schema/DTO behavior and naming convention follows `describe.sequential(...)` with task-labeled `it(...)` names.)
- [x] Task 035: Inspect existing Computers tests under `backend/tests/computers` to reuse registration and secret hash verification style. (Confirmed 2026-05-26: Computers API tests mock `auth.password.comparePassword` and Prisma models, then assert register behavior against `tenant.computerRegistrationSecretHash`, response safety (no hash leakage), and logging redaction. Service tests inject a custom registration-secret strategy (`verify` true/false) and assert register success/failure mappings, stored hash vs plain token separation, and tenant scoping. Unit tests cover strict request schemas and `TenantSecretStrategy.verify(...)` cases including missing stored hash.)
- [x] Task 036: Document any codebase drift from the TDD before implementation. (Confirmed 2026-05-26 from Existing Codebase Verification evidence: drift items identified are (1) `VerifyRegisterTenantOutput` in `auth.types.ts` does not yet include `computerRegistrationSecret` (Task 019) and (2) Auth tenant-create flow in `auth.service.ts` does not yet carry/persist `computerRegistrationSecretHash` during verification tenant creation (Task 018). Additional alignment notes (not blocking drift): reissue route is not yet present and must be ordered before `/:id` when added (Task 025), reissue types are not yet defined (Task 029), and reissue log reason handling decision (`reason` sanitize vs `reasonLength`) remains open by design (Task 030/Task 037). No contradictory drift was found for RBAC + strict validation behavior, tenant scoping/update pattern, or current test infrastructure patterns.)

## 3. Open Decisions

- [x] Task 037: Decide whether reissue logging stores sanitized `reason` or only `reasonLength`. (Decision 2026-05-26: store only `reasonLength`. Rationale: TDD/SPEC/plan require safe reason metadata and explicitly allow `reasonLength` or sanitized reason, but do not require storing reason text. Choosing `reasonLength` is the safer option (lower leakage risk, stronger alignment with Ă„â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€Ă‚ÂÄ‚â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¢Ă„â€Ă‚Â¢Ä‚Â¢Ă¢â€Â¬Ă‚ÂÄ‚â€Ă‚Â¬Ă„â€Ă¢â‚¬ÂÄ‚â€Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€Ă‚ÂÄ‚â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¢Ä‚â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€Ă‚ÂÄ‚â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¢Ă„â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¢Ä‚â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¢Ă„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¬Ä‚â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€Ă‚ÂÄ‚â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¬Ä‚â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€Ă‚ÂÄ‚â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¢Ă„â€Ă‚Â¢Ä‚Â¢Ă¢â€Â¬Ă‚ÂÄ‚â€Ă‚Â¬Ă„â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¦Ă„â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¢Ä‚â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¢Ă„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¬Ä‚â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚Â¦Ă„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€¦Ă¢â‚¬Å“no secret-bearing/raw body data in logsĂ„â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€Ă‚ÂÄ‚â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¢Ă„â€Ă‚Â¢Ä‚Â¢Ă¢â€Â¬Ă‚ÂÄ‚â€Ă‚Â¬Ă„â€Ă¢â‚¬ÂÄ‚â€Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€Ă‚ÂÄ‚â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¢Ä‚â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€Ă‚ÂÄ‚â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¢Ă„â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¢Ä‚â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¢Ă„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¬Ä‚â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€Ă‚ÂÄ‚â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¬Ä‚â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€Ă‚ÂÄ‚â€Ă¢â‚¬ÂÄ‚â€Ă‚Â¢Ă„â€Ă‚Â¢Ä‚Â¢Ă¢â€Â¬Ă‚ÂÄ‚â€Ă‚Â¬Ă„â€Ă¢â‚¬ÂÄ‚â€Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă‚Â¢Ä‚Â¢Ă¢â‚¬ÂĂ‚Â¬Ä‚â€Ă‚ÂÄ‚â€Ă¢â‚¬ÂÄ‚Â¢Ă¢â€Â¬Ă‚ÂĂ„â€Ă¢â‚¬ÂÄ‚â€Ă‚Â) while still satisfying observability intent for reissue context.)
- [x] Task 038: Decide whether route-specific reissue rate limiting is deferred for MVP as recommended by the TDD. (Decision 2026-05-26: deferred for MVP. Rationale: TDD section 3.7 states existing `POST /api/computers/register` rate limiting is the current protection and a dedicated reissue rate limit is a future production-hardening pass, not an MVP requirement unless abuse appears in testing.)
- [x] Task 039: Decide exact docs/Postman file targets for follow-up documentation updates. (Decision 2026-05-26: target files are `docs/module/auth/2026-05-19-cloudcms-auth-design.md`, `docs/module/computers/2026-05-23-computers-module-design.md`, `docs/module/tenants/2026-05-20-tenants-design.md`, `docs/API/auth-api.md`, `docs/API/computers-api.md`, and `docs/API/tenants-api.md`; Postman target is `docs/postman/registration-secret-manual-flow.md` to be created because no `docs/postman/*` path currently exists in the workspace. Missing expected Postman docs are therefore the entire `docs/postman` directory and any registration-secret-specific Postman guidance file.)
- [x] Task 040: Record final decisions from Tasks 037-039 in this task breakdown before implementation proceeds. (Final decision record 2026-05-26: Task 037 -> reissue logging stores only `reasonLength`; Task 038 -> route-specific reissue rate limiting is deferred for MVP; Task 039 -> docs targets are `docs/module/auth/2026-05-19-cloudcms-auth-design.md`, `docs/module/computers/2026-05-23-computers-module-design.md`, `docs/module/tenants/2026-05-20-tenants-design.md`, `docs/API/auth-api.md`, `docs/API/computers-api.md`, `docs/API/tenants-api.md`, and Postman target is new `docs/postman/registration-secret-manual-flow.md` because `docs/postman` does not yet exist.)

## 4. Computers Secret Helper

- [x] Task 041: Add a failing unit test proving `generateComputerRegistrationSecret()` is exported from `backend/src/modules/computers/computers.service.ts`. (Completed 2026-05-26: added unit test in `backend/tests/computers/computers.unit.test.ts` that dynamically imports Computers service module and asserts `generateComputerRegistrationSecret` export exists and is a function; expected to fail until implementation is added.)
- [x] Task 042: Add a failing unit test proving generated secrets match `^crs_live_[A-Za-z0-9_-]+$`. (Completed 2026-05-26: added unit test in `backend/tests/computers/computers.unit.test.ts` that calls `generateComputerRegistrationSecret()` and asserts regex match; expected to fail until implementation is added.)
- [x] Task 043: Add a failing unit test proving two consecutive generated registration secrets are different. (Completed 2026-05-26: added unit test in `backend/tests/computers/computers.unit.test.ts` that calls `generateComputerRegistrationSecret()` twice, asserts the two generated values are different, and keeps minimal safe-structure regex checks; expected to fail until implementation is added.)
- [x] Task 044: Add a failing unit test proving generated registration secrets contain no whitespace. (Completed 2026-05-26: added unit test in `backend/tests/computers/computers.unit.test.ts` asserting generated secret contains no whitespace via `\\s` check; expected to fail until implementation is added.)
- [x] Task 045: Implement `generateComputerRegistrationSecret()` using high-entropy `randomBytes(32).toString("base64url")`. (Completed 2026-05-26: implemented in `backend/src/modules/computers/computers.service.ts` as `crs_live_` prefix + `randomBytes(32).toString("base64url")` via `generateComputerRegistrationSecret()` export.)
- [x] Task 046: Ensure `generateComputerRegistrationSecret()` never derives values from tenant code, tenant id, user id, email, MAC address, timestamp, or request id. (Completed 2026-05-26: helper takes no input and uses only `randomBytes(32)` + constant prefix, with no tenant/user/request/mac/time coupling.)
- [x] Task 047: Ensure existing `hashRegistrationSecret()` remains unchanged and reusable by Auth and Tenants. (Completed 2026-05-26: source inspection confirms helper remains unchanged as a thin wrapper over `authPasswordService.hashPassword(...)` in `backend/src/modules/computers/computers.service.ts`, preserving existing reusable export contract for Auth/Tenants consumers.)
- [x] Task 048: Add or update a unit test proving `hashRegistrationSecret()` output verifies through the existing compare behavior. (Completed 2026-05-26: added unit test in `backend/tests/computers/computers.unit.test.ts` that mocks existing auth password service behavior, asserts hash exists, hash differs from plain input, and verifies original input through `compareRegistrationSecret(...)`.)

## 5. Auth Verification Types and Service

- [x] Task 049: Add `computerRegistrationSecret: string` to `VerifyRegisterTenantOutput` in `backend/src/modules/auth/auth.types.ts`. (Completed 2026-05-26: updated `VerifyRegisterTenantOutput` type in `backend/src/modules/auth/auth.types.ts` to include `computerRegistrationSecret: string` while preserving existing Auth output type composition style.)
- [x] Task 050: Import `generateComputerRegistrationSecret` into `backend/src/modules/auth/auth.service.ts`. (Completed 2026-05-26: added `generateComputerRegistrationSecret` import from `../computers/computers.service` in `backend/src/modules/auth/auth.service.ts` with existing import style/order.)
- [x] Task 051: Import `hashRegistrationSecret` into `backend/src/modules/auth/auth.service.ts`. (Completed 2026-05-26: added `hashRegistrationSecret` import from `../computers/computers.service` in `backend/src/modules/auth/auth.service.ts` without changing Auth service behavior.)
- [x] Task 052: Generate `computerRegistrationSecret` in `verifyTenantRegistration` after verification checks pass and before tenant creation. (Completed 2026-05-26: added `generateComputerRegistrationSecret()` call in `backend/src/modules/auth/auth.service.ts` immediately after verification/availability checks and before tenant creation flow.)
- [x] Task 053: Hash `computerRegistrationSecret` before tenant creation. (Completed 2026-05-26: added `await hashRegistrationSecret(computerRegistrationSecret)` in `backend/src/modules/auth/auth.service.ts` before `createActiveTenantInVerificationTransaction(...)`.)
- [x] Task 054: Extend `createActiveTenantInVerificationTransaction` input with `computerRegistrationSecretHash`. (Completed 2026-05-26: updated helper input contract in `backend/src/modules/auth/auth.service.ts` to include `computerRegistrationSecretHash: string` and wired caller in `verifyTenantRegistration` to pass the computed hash.)
- [x] Task 055: Persist `computerRegistrationSecretHash` in the tenant create data. (Completed 2026-05-26: tenant create payload in `createActiveTenantInVerificationTransaction(...)` now sets `computerRegistrationSecretHash` from helper input; plain `computerRegistrationSecret` is not persisted.)
- [x] Task 056: Keep tenant create select limited to safe tenant fields. (Completed 2026-05-26: tenant create `select` remains limited to `id`, `code`, `name`, and `status`; `computerRegistrationSecretHash` is not selected or returned.)
- [x] Task 057: Return `computerRegistrationSecret` in the successful verify service output. (Completed 2026-05-26: added `computerRegistrationSecret` to the successful return payload of `verifyTenantRegistration` in `backend/src/modules/auth/auth.service.ts`.)
- [x] Task 058: Ensure invalid or expired verification paths do not generate or return `computerRegistrationSecret`. (Completed 2026-05-26: source inspection confirms all invalid/expired exits in `verifyTenantRegistration` throw before the `generateComputerRegistrationSecret()` line, so those paths do not generate, persist, or return registration secret material.)
- [x] Task 059: Ensure verify failure logs do not include `computerRegistrationSecret` or `computerRegistrationSecretHash`. (Completed 2026-05-26: source inspection confirms `verifyTenantRegistration` failure path logs via `logRegisterTenantVerificationFailed(...)` only include allowlisted metadata (`requestId`, event, maskedEmail/emailHash, reason, status, ip, userAgent) and never pass `computerRegistrationSecret`/`computerRegistrationSecretHash`.)
- [x] Task 060: Ensure verify success logs do not include `computerRegistrationSecret` or `computerRegistrationSecretHash`. (Completed 2026-05-26: source inspection confirms verify success logs via `logRegisterTenantCompleted(...)` only include allowlisted metadata and `AuthLoggingService.logAuthEvent(...)` builds explicit payload without spreading caller input, so secret/hash fields are not logged.)

## 6. Auth Verification API Contract

- [x] Task 061: Update the verify controller response path only if needed to pass through the new service output. (Completed 2026-05-26: Source inspection confirms backend/src/modules/auth/auth.controller.ts verifyTenantRegistration() already returns esponse.status(200).json({ success: true, data }) with direct service pass-through; no controller code change required, and no computerRegistrationSecretHash exposure introduced.)
- [x] Task 062: Confirm POST /api/auth/register-tenant/verify request schema remains unchanged. (Completed 2026-05-26: Source inspection confirms ackend/src/modules/auth/auth.routes.ts still validates /register-tenant/verify with erifyTenantRegistrationSchema; schema in ackend/src/modules/auth/auth.schema.ts remains egistrationId (trimmed non-empty string) and erificationCode (trimmed 6-digit string), matching TDD unchanged request contract.)
- [x] Task 063: Confirm successful verify API response includes data.computerRegistrationSecret. (Completed 2026-05-26: Source inspection confirms uthService.verifyTenantRegistration() success return includes computerRegistrationSecret, and controller erifyTenantRegistration() pass-through returns it under data.)
- [x] Task 064: Confirm successful verify API response does not include computerRegistrationSecretHash. (Completed 2026-05-26: Source inspection confirms VerifyRegisterTenantOutput and verify success return shape do not include computerRegistrationSecretHash; controller pass-through therefore does not expose hash.)
- [x] Task 065: Confirm existing tenant, user, access token, and refresh token response fields remain compatible. (Completed 2026-05-26: Source inspection confirms `authService.verifyTenantRegistration()` success return still includes `tenant`, `user`, `accessToken`, and `refreshToken`; existing test Task 315 in `backend/tests/auth/auth.api.test.ts` asserts these fields remain present and compatible.)
- [x] Task 066: Confirm existing invalid/expired verification error behavior remains unchanged. (Completed 2026-05-26: Source and test inspection confirm verify invalid/expired paths still return `401` with `error.code = "UNAUTHORIZED"` and generic message `"The verification code is invalid or expired."` across wrong code, expired code, missing registration, and consumed code scenarios.)

## 7. Tenants Reissue Schema and Types

- [x] Task 067: Add `reissueComputerRegistrationSecretSchema` to `backend/src/modules/tenants/tenants.schema.ts`. (Completed 2026-05-26: Added `reissueComputerRegistrationSecretSchema` in Tenants schema module using existing Zod style.)
- [x] Task 068: Configure `reissueComputerRegistrationSecretSchema` to accept `{}`. (Completed 2026-05-26: Schema is `z.object({}).strict()`, which accepts an empty JSON object and rejects unknown fields including `tenantId`, `computerRegistrationSecret`, `computerRegistrationSecretHash`, `token`, and `authorization`.)
- [x] Task 069: Configure `reissueComputerRegistrationSecretSchema` with optional trimmed `reason`. (Completed 2026-05-26: Updated Tenants reissue schema to define `reason` as optional string with `.trim()`.)
- [x] Task 070: Configure `reissueComputerRegistrationSecretSchema` to enforce `reason` max length 200. (Completed 2026-05-26: Updated `reason` validation to `.max(200)` in `backend/src/modules/tenants/tenants.schema.ts`.)
- [x] Task 071: Configure `reissueComputerRegistrationSecretSchema` with `.strict()` to reject unknown fields. (Completed 2026-05-26: Source inspection confirms schema uses `.strict()`, so unknown keys including secret-like fields are rejected.)
- [x] Task 072: Export `reissueComputerRegistrationSecretSchema` through `tenantsRouteSchemas`. (Completed 2026-05-26: Added `reissueComputerRegistrationSecretSchema` to exported `tenantsRouteSchemas` object in `backend/src/modules/tenants/tenants.schema.ts`.)
- [x] Task 073: Add `ReissueComputerRegistrationSecretInput` type in `backend/src/modules/tenants/tenants.types.ts`. (Completed 2026-05-26: Added `ReissueComputerRegistrationSecretInput` using `z.infer<typeof reissueComputerRegistrationSecretSchema>`.)
- [x] Task 074: Add `ReissueComputerRegistrationSecretOutput` type with `computerRegistrationSecret: string`. (Completed 2026-05-26: Added output type containing only `computerRegistrationSecret: string`; no hash field included.)

## 8. Tenants Reissue Logging

- [x] Task 075: Add `COMPUTER_REGISTRATION_SECRET_REISSUED` to `TENANTS_LOG_EVENTS`. (Completed 2026-05-26: Added `COMPUTER_REGISTRATION_SECRET_REISSUED: "tenant.computer_registration_secret.reissued"` to `TENANTS_LOG_EVENTS` in `backend/src/modules/tenants/tenants.logging.ts`.)
- [x] Task 076: Decide and implement the safe payload field for reissue reason metadata based on Task 037. (Completed 2026-05-26: Applied Task 037 decision to store only `reasonLength`; updated `TenantsEventLogInput` and `logTenantsEvent` payload in `backend/src/modules/tenants/tenants.logging.ts` to use `reasonLength` and stop logging raw `reason` text.)
- [x] Task 077: Add a typed log input for computer registration secret reissue. (Completed 2026-05-26: Added `ComputerRegistrationSecretReissuedLogInput` in `backend/src/modules/tenants/tenants.logging.ts` with safe fields `requestId`, `actorUserId`, `actorRole`, `actorTenantId`, `targetTenantId`, optional `status`, and optional `reasonLength`, plus `ForbiddenTenantsLogBodyFields` constraints.)
- [x] Task 078: Implement `logComputerRegistrationSecretReissued()` in `TenantsLoggingService`. (Completed 2026-05-26: Added `logComputerRegistrationSecretReissued(input: ComputerRegistrationSecretReissuedLogInput)` in `backend/src/modules/tenants/tenants.logging.ts`, routing through `logTenantsEvent` with event `TENANTS_LOG_EVENTS.COMPUTER_REGISTRATION_SECRET_REISSUED` and safe fields only.)
- [x] Task 079: Ensure reissue logging never spreads caller input into the payload. (Completed 2026-05-26: Source inspection confirms `logComputerRegistrationSecretReissued()` constructs explicit field mapping and delegates to `logTenantsEvent()`, where payload is built from an allowlist and never uses spread from caller input.)
- [x] Task 080: Ensure reissue logging omits `computerRegistrationSecret` and `computerRegistrationSecretHash`. (Completed 2026-05-26: Source inspection confirms reissue logging input/method/payload include no `computerRegistrationSecret` or `computerRegistrationSecretHash` fields in `backend/src/modules/tenants/tenants.logging.ts`.)
- [x] Task 081: Ensure reissue logging omits authorization headers, access tokens, refresh tokens, device tokens, and raw request bodies. (Completed 2026-05-26: Source inspection confirms `ForbiddenTenantsLogBodyFields` and sensitive-key detectors block/flag `authorization`, `accessToken`, `refreshToken`, `deviceToken`, `deviceTokenHash`, and raw-body/header fields (`body`, `req`, `requestBody`, `rawBody`, `headers`, `rawHeaders`, `requestHeaders`) while payload remains allowlisted.)
- [x] Task 082: Ensure reissue logging includes safe request id, actor user id, actor role, actor tenant id, target tenant id, and status. (Completed 2026-05-26: Source inspection confirms `logComputerRegistrationSecretReissued()` maps `requestId`, `actorUserId`, `actorRole`, `actorTenantId`, `targetTenantId`, and `status` into allowlisted `logTenantsEvent()` payload using existing field conventions.)

## 9. Tenants Reissue Service

- [x] Task 083: Import `generateComputerRegistrationSecret` into `backend/src/modules/tenants/tenants.service.ts`. (Completed 2026-05-26: Added import from `../computers/computers.service` in `backend/src/modules/tenants/tenants.service.ts`.)
- [x] Task 084: Import `hashRegistrationSecret` into `backend/src/modules/tenants/tenants.service.ts`. (Completed 2026-05-26: Added import from `../computers/computers.service` in `backend/src/modules/tenants/tenants.service.ts`.)
- [x] Task 085: Add `reissueComputerRegistrationSecret(authContext, input)` to `TenantsService`. (Completed 2026-05-26: Added method boundary `reissueComputerRegistrationSecret(authContext, input)` to `backend/src/modules/tenants/tenants.service.ts` with typed input/output.)
- [x] Task 086: Derive the tenant id only from `authContext.tenantId`. (Completed 2026-05-26: Method derives tenant id exclusively via `assertTenantIdFromAuthContext(authContext)`.)
- [x] Task 087: Reject missing or blank tenant id with existing forbidden behavior. (Completed 2026-05-26: `reissueComputerRegistrationSecret()` derives tenant id via `assertTenantIdFromAuthContext(authContext)`, which throws `createForbiddenError()` for missing/non-string/blank tenant id.)
- [x] Task 088: Normalize optional `reason` before using it for safe log metadata. (Completed 2026-05-26: Added `normalizeOptionalReasonForLogMetadata()` and applied it in `reissueComputerRegistrationSecret()` to derive safe metadata `reasonLength` without logging raw reason text.)
- [x] Task 089: Generate a new plain `computerRegistrationSecret`. (Completed 2026-05-26: `reissueComputerRegistrationSecret()` now calls `generateComputerRegistrationSecret()` to create a plain one-time secret.)
- [x] Task 090: Hash the new `computerRegistrationSecret`. (Completed 2026-05-26: `reissueComputerRegistrationSecret()` now calls `await hashRegistrationSecret(computerRegistrationSecret)` and keeps `computerRegistrationSecretHash` internal only.)
- [x] Task 091: Update `Tenant.computerRegistrationSecretHash` for the authenticated tenant only. (Completed 2026-05-26: `TenantsService.reissueComputerRegistrationSecret()` now performs `prisma.tenant.updateMany` with `where.id = tenantId` where `tenantId` is derived only from `assertTenantIdFromAuthContext(authContext)`.)
- [x] Task 092: Scope tenant update by `deletedAt: null` or equivalent existing active tenant filter. (Completed 2026-05-26: Reissue update reuses `createBaseTenantWhere()` in the `updateMany` `where` clause, enforcing `deletedAt: null` active-tenant filtering.)
- [x] Task 093: Return existing not-found behavior if the tenant update count is zero. (Completed 2026-05-26: Reissue checks `updateResult.count === 0` and throws `createNotFoundTenantError()`, matching existing Tenants current-tenant not-found behavior.)
- [x] Task 094: Avoid persisting the plain `computerRegistrationSecret`. (Completed 2026-05-26: Source inspection of `TenantsService.reissueComputerRegistrationSecret()` confirms database update writes only `computerRegistrationSecretHash`; plain `computerRegistrationSecret` is generated for response and is not persisted.)
- [x] Task 095: Return only `{ computerRegistrationSecret }` from the reissue service. (Completed 2026-05-26: Source inspection confirms successful reissue path returns exactly `{ computerRegistrationSecret }` and does not include hash or tenant update internals.)
- [x] Task 096: Emit the safe reissue log event after a successful hash update. (Completed 2026-05-26: Source inspection confirms `TenantsService.reissueComputerRegistrationSecret()` now calls `tenantsLoggingService.logComputerRegistrationSecretReissued(...)` only after `updateMany` succeeds (`count > 0`) with explicit safe fields `{ requestId?, actorUserId, actorRole, actorTenantId, targetTenantId, status: \"success\", reasonLength }` and without passing plain/hash secret, tokens, headers, or raw request body.)
- [x] Task 097: Ensure service does not accept or trust client-provided tenant id. (Completed 2026-05-26: `reissueComputerRegistrationSecret(authContext, input)` does not read any tenant id from `input`; target tenant id is sourced only from authenticated context.)

## 10. Tenants Reissue Controller and Route

- [x] Task 098: Add `reissueComputerRegistrationSecret()` to `TenantsController`. (Completed 2026-05-26: Added `reissueComputerRegistrationSecret(request, response, next)` method to `backend/src/modules/tenants/tenants.controller.ts` using existing controller try/catch pattern.)
- [x] Task 099: Read auth context with the existing authenticated controller helper. (Completed 2026-05-26: Method uses `readAuthContextAfterAuthRequired(request)` before invoking service.)
- [x] Task 100: Read validated body as `ReissueComputerRegistrationSecretInput`. (Completed 2026-05-26: Method reads `const validatedBody = request.body as ReissueComputerRegistrationSecretInput;`.)
- [x] Task 101: Call `tenantsService.reissueComputerRegistrationSecret()` with auth context and validated body. (Completed 2026-05-26: Method calls service with `{ ...authContext, requestId: request.requestId }` and `validatedBody`.)
- [x] Task 102: Return shared success response shape `{ success: true, data }`. (Completed 2026-05-26: Method returns `response.status(200).json({ success: true, data });` consistent with existing Tenants controller success envelope.)
- [x] Task 103: Import `reissueComputerRegistrationSecretSchema` into `backend/src/modules/tenants/tenants.routes.ts`. (Completed 2026-05-26: Added `reissueComputerRegistrationSecretSchema` to the existing grouped schema import from `./tenants.schema` in `tenants.routes.ts`, following current local import style.)
- [x] Task 104: Add `POST /me/computer-registration-secret/reissue` to `tenantsRouter`. (Completed 2026-05-26: Added `tenantsRouter.post("/me/computer-registration-secret/reissue", ...)` in `backend/src/modules/tenants/tenants.routes.ts` following existing route declaration style.)
- [x] Task 105: Place the reissue route before `/:id` routes. (Completed 2026-05-26: Reissue route is declared before both dynamic routes `tenantsRouter.get("/:id", ...)` and `tenantsRouter.patch("/:id", ...)`, preventing `/:id` capture.)
- [x] Task 106: Apply `authRequired` to the reissue route. (Completed 2026-05-26: Source inspection confirms `tenantsRouter.post("/me/computer-registration-secret/reissue", ...)` includes `authRequired` as the first middleware in `backend/src/modules/tenants/tenants.routes.ts`.)
- [x] Task 107: Apply `validateRequest({ body: reissueComputerRegistrationSecretSchema })` to the reissue route. (Completed 2026-05-26: Source inspection confirms reissue route includes `validateRequest({ body: reissueComputerRegistrationSecretSchema })` immediately after `authRequired`.)
- [x] Task 108: Apply `requireRole("shop_admin")` to the reissue route. (Completed 2026-05-26: Source inspection confirms reissue route includes `requireRole("shop_admin")`; this excludes `staff` and `super_admin` for MVP.)
- [x] Task 109: Apply `requireTenantUser` to the reissue route. (Completed 2026-05-26: Source inspection confirms reissue route includes `requireTenantUser` after role check.)
- [x] Task 110: Wire the route to `tenantsController.reissueComputerRegistrationSecret`. (Completed 2026-05-26: Source inspection confirms `POST /me/computer-registration-secret/reissue` handler delegates via `(request, response, next) => void tenantsController.reissueComputerRegistrationSecret(request, response, next)` in `backend/src/modules/tenants/tenants.routes.ts`, matching existing controller binding style.)

## 11. Computers Registration Compatibility

- [x] Task 111: Confirm `POST /api/computers/register` still accepts `tenantCode`, `registrationSecret`, `macAddress`, and optional `name`. (Completed 2026-05-26: Source inspection confirms `registerComputerSchema` remains strict with exactly `{ tenantCode, registrationSecret, macAddress, name? }` in `backend/src/modules/computers/computers.schema.ts`; `computers.routes.ts` still validates `POST /register` with `validateRequest({ body: registerComputerSchema })`, controller reads validated body as `RegisterComputerInput`, and existing computers tests continue using the same request fields.)
- [x] Task 112: Confirm Computers registration still verifies submitted secret against `Tenant.computerRegistrationSecretHash`. (Completed 2026-05-26: Source inspection confirms `ComputersService.registerComputer()` calls `verifyRegistrationSecretOrThrowUnauthorized()` and delegates to `registrationSecretStrategy.verify(submittedSecret, tenant.computerRegistrationSecretHash)` after tenant lookup selects `computerRegistrationSecretHash`; `TenantSecretStrategy.verify()` compares submitted secret against stored hash and returns false when hash is missing.)
- [x] Task 113: Confirm Computers registration succeeds with the latest generated registration secret. (Completed 2026-05-26: Source inspection confirms `TenantsService.reissueComputerRegistrationSecret()` generates a new plain secret, hashes the same value via `hashRegistrationSecret()`, overwrites `Tenant.computerRegistrationSecretHash`, and returns the plain secret once; `ComputersService.registerComputer()` verifies submitted `registrationSecret` against the current stored hash, so the latest reissued secret remains the valid input for successful registration when other inputs are valid.)
- [x] Task 114: Confirm Computers registration fails with a replaced old registration secret. (Completed 2026-05-26: Source inspection confirms reissue overwrites `Tenant.computerRegistrationSecretHash` (not append/version), and registration validates only against that current hash; therefore any pre-reissue plain secret no longer matches and follows `UNAUTHORIZED` path (`Invalid registration secret.`).)
- [x] Task 115: Confirm Computers registration response still returns a plain `deviceToken` once. (Completed 2026-05-26: Source inspection confirms `ComputersService.registerComputer()` generates one plain `deviceToken`, returns it in `ComputerTokenResponse`, and controller returns `{ success: true, data }` without additional token copies; existing tests also assert plain token presence and one-time response semantics for register/service paths.)
- [x] Task 116: Confirm Computers registration response does not expose `computerRegistrationSecretHash`. (Completed 2026-05-26: Source inspection confirms register flow reads `tenant.computerRegistrationSecretHash` only for verification and never maps tenant record into response; response DTO is `ComputerTokenResponse` (`computer` + `deviceToken`) and `mapComputerToResponse()` allowlists computer fields without tenant secret hash. Existing register API/service tests assert safe response mapping and no hash leakage fields.)
- [x] Task 117: Confirm Computers registration response does not expose tenant registration secret material. (Completed 2026-05-26: Source inspection confirms register response contains only `computer` safe DTO + plain `deviceToken`; no `registrationSecret`, `computerRegistrationSecretHash`, or tenant registration-secret material is included by controller/types/mapper. Existing tests cover absence of leaked hash-bearing fields in register response and safe DTO mapping.)

## 12. Unit Tests

- [ ] Task 118: Add unit tests for `generateComputerRegistrationSecret()` prefix, URL-safe content, no whitespace, and non-determinism.
- [ ] Task 119: Add unit test proving `hashRegistrationSecret()` output verifies with existing compare behavior.
- [ ] Task 120: Add unit tests for `reissueComputerRegistrationSecretSchema` accepting `{}`.
- [ ] Task 121: Add unit tests for `reissueComputerRegistrationSecretSchema` trimming `reason`.
- [ ] Task 122: Add unit tests for `reissueComputerRegistrationSecretSchema` accepting `reason` length 200.
- [ ] Task 123: Add unit tests for `reissueComputerRegistrationSecretSchema` rejecting `reason` length 201.
- [ ] Task 124: Add unit tests for `reissueComputerRegistrationSecretSchema` rejecting unknown fields.
- [ ] Task 125: Add unit tests for `reissueComputerRegistrationSecretSchema` rejecting secret-like unknown fields.
- [ ] Task 126: Add unit tests for Tenants reissue logging omitting raw input and sensitive fields.

## 13. Auth Service and API Tests

- [ ] Task 127: Add Auth service test proving successful verification returns `computerRegistrationSecret`.
- [ ] Task 128: Add Auth service test proving returned `computerRegistrationSecret` matches `^crs_live_[A-Za-z0-9_-]+$`.
- [ ] Task 129: Add Auth service test proving tenant create data includes `computerRegistrationSecretHash`.
- [ ] Task 130: Add Auth service test proving stored hash does not contain the plain secret.
- [ ] Task 131: Add Auth service test proving stored hash verifies against the returned secret.
- [ ] Task 132: Add Auth service test proving invalid verification does not generate or return a registration secret.
- [ ] Task 133: Add Auth logging test proving verify success logs do not include registration secret material.
- [ ] Task 134: Add Auth logging test proving verify failure logs do not include registration secret material.
- [ ] Task 135: Add Supertest coverage proving `POST /api/auth/register-tenant/verify` success includes `data.computerRegistrationSecret`.
- [ ] Task 136: Add Supertest coverage proving verify response does not include `computerRegistrationSecretHash`.
- [ ] Task 137: Add Supertest regression coverage proving existing verify success fields remain present.
- [ ] Task 138: Add Supertest regression coverage proving invalid/expired verification behavior remains unchanged.

## 14. Tenants Service and API Tests

- [ ] Task 139: Add Tenants service test proving missing `tenantId` returns `403 FORBIDDEN`.
- [ ] Task 140: Add Tenants service test proving missing or deleted tenant returns `404 NOT_FOUND`.
- [ ] Task 141: Add Tenants service test proving valid tenant context updates `Tenant.computerRegistrationSecretHash`.
- [ ] Task 142: Add Tenants service test proving reissue response returns the new plain `computerRegistrationSecret`.
- [ ] Task 143: Add Tenants service test proving previous hash is replaced.
- [ ] Task 144: Add Tenants service test proving plain secret is not passed to logging.
- [ ] Task 145: Add Tenants service test proving optional reason is normalized before safe log metadata.
- [ ] Task 146: Add Supertest coverage proving missing bearer token on reissue returns `401`.
- [ ] Task 147: Add Supertest coverage proving `staff` bearer token on reissue returns `403`.
- [ ] Task 148: Add Supertest coverage proving `super_admin` bearer token on reissue returns `403` in MVP.
- [ ] Task 149: Add Supertest coverage proving `shop_admin` bearer token on reissue returns `200`.
- [ ] Task 150: Add Supertest coverage proving reissue response includes `data.computerRegistrationSecret`.
- [ ] Task 151: Add Supertest coverage proving `{}` request body is accepted.
- [ ] Task 152: Add Supertest coverage proving `{ "reason": "lost secret" }` request body is accepted.
- [ ] Task 153: Add Supertest coverage proving unknown fields return validation error.
- [ ] Task 154: Add Supertest coverage proving `reason` longer than 200 returns validation error.
- [ ] Task 155: Add Supertest coverage proving route ordering prevents `/me/computer-registration-secret/reissue` from being captured by `/:id`.
- [ ] Task 156: Add Supertest coverage proving reissue response does not include `computerRegistrationSecretHash`.

## 15. Rotation and Compatibility Tests

- [ ] Task 157: Add integration or service test that creates a tenant with an old registration secret hash.
- [ ] Task 158: Add integration or service test that reissues a new registration secret as `shop_admin`.
- [ ] Task 159: Add integration or service test proving old registration secret fails `POST /api/computers/register` after reissue.
- [ ] Task 160: Add integration or service test proving new registration secret succeeds `POST /api/computers/register` with a fresh MAC.
- [ ] Task 161: Add compatibility test proving registration response still includes `deviceToken`.
- [ ] Task 162: Add compatibility test proving returned tenant/computer DTOs do not expose old plain secret.
- [ ] Task 163: Add compatibility test proving returned tenant/computer DTOs do not expose registration secret hash.

## 16. Security Regression Tests

- [ ] Task 164: Add test proving no Auth verify log includes `computerRegistrationSecret`.
- [ ] Task 165: Add test proving no Auth verify log includes `computerRegistrationSecretHash`.
- [ ] Task 166: Add test proving no Tenants reissue log includes `computerRegistrationSecret`.
- [ ] Task 167: Add test proving no Tenants reissue log includes `computerRegistrationSecretHash`.
- [ ] Task 168: Add test proving no reissue log includes authorization header.
- [ ] Task 169: Add test proving no reissue log includes access token.
- [ ] Task 170: Add test proving no reissue log includes refresh token.
- [ ] Task 171: Add test proving no reissue log includes device token.
- [ ] Task 172: Add test proving no reissue log includes raw request body.
- [ ] Task 173: Add test proving failure responses do not reveal whether an old or new secret exists.

## 17. Documentation and Postman Guidance

- [ ] Task 174: Update Auth module docs to document `data.computerRegistrationSecret` in tenant verification success response.
- [ ] Task 175: Update Computers module docs to document tenant-level registration secret provisioning and reissue ownership.
- [ ] Task 176: Update Tenants module docs or API docs to document `POST /api/tenants/me/computer-registration-secret/reissue`.
- [ ] Task 177: Document that plain registration secret is returned only once after verify or reissue.
- [ ] Task 178: Document that `Tenant.computerRegistrationSecretHash` is the only persisted secret material.
- [ ] Task 179: Document that old registration secret stops working immediately after reissue.
- [ ] Task 180: Update Postman guidance to save `data.computerRegistrationSecret` as `registrationSecret` after tenant verification.
- [ ] Task 181: Update Postman guidance to call reissue if the secret is lost or compromised.
- [ ] Task 182: Update Postman guidance to verify old secret failure and new secret success after reissue.

## 18. Manual Verification

- [ ] Task 183: Ask the user/team to run backend setup/server commands when ready; do not run them autonomously.
- [ ] Task 184: Manually call `POST /api/auth/register-tenant`.
- [ ] Task 185: Manually call `POST /api/auth/register-tenant/verify`.
- [ ] Task 186: Confirm verify response includes `data.computerRegistrationSecret`.
- [ ] Task 187: Save `data.computerRegistrationSecret` as Postman `registrationSecret`.
- [ ] Task 188: Manually call `POST /api/computers/register` with `tenantCode`, `registrationSecret`, `macAddress`, and optional `name`.
- [ ] Task 189: Confirm computer register response returns `200`.
- [ ] Task 190: Confirm computer register response includes `deviceToken`.
- [ ] Task 191: Manually call `POST /api/tenants/me/computer-registration-secret/reissue` with a `shop_admin` bearer token.
- [ ] Task 192: Confirm reissue response returns `200`.
- [ ] Task 193: Confirm reissue response includes a new `data.computerRegistrationSecret`.
- [ ] Task 194: Manually retry `POST /api/computers/register` with the old registration secret and a fresh MAC.
- [ ] Task 195: Confirm old registration secret fails after reissue.
- [ ] Task 196: Manually retry `POST /api/computers/register` with the new registration secret and a fresh MAC.
- [ ] Task 197: Confirm new registration secret succeeds after reissue.
- [ ] Task 198: Confirm no manual verification response exposes `computerRegistrationSecretHash`.

## 19. Final Review and Handoff

- [ ] Task 199: Review implementation diff to confirm no new Prisma table or Tenant field was added.
- [ ] Task 200: Review implementation diff to confirm no new runtime dependency was added.
- [ ] Task 201: Review implementation diff to confirm no UI code was added for this MVP.
- [ ] Task 202: Review implementation diff to confirm no registration-secret health endpoint was added.
- [ ] Task 203: Review implementation diff to confirm plain registration secret only appears in verify and reissue success responses.
- [ ] Task 204: Review implementation diff to confirm plain registration secret is never persisted.
- [ ] Task 205: Review implementation diff to confirm secret/hash/token/header logging constraints are enforced.
- [ ] Task 206: Ask the user/team to run focused tests for Auth, Tenants, and Computers.
- [ ] Task 207: Ask the user/team to run the broader backend test suite if appropriate.
- [ ] Task 208: Ask the user/team to run typecheck/build if appropriate.
- [ ] Task 209: Record user/team-provided test and verification results in this task breakdown.
- [ ] Task 210: Record any accepted residual risk or deferred follow-up from route-specific reissue rate limiting.
- [ ] Task 211: Record any accepted residual risk or deferred follow-up from persistent audit table deferral.
- [ ] Task 212: Confirm implementation is ready for handoff after docs, tests, and manual verification evidence are recorded.
