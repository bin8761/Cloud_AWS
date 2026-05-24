# Task Breakdown: CloudCMS Auth Module

Source TDD: `docs/tdd/auth/technical-design.md`

Purpose: turn the Auth TDD into small implementation-sized checklist items. Each item should be small enough for one focused development step, usually a few hours or less.

Implementation constraints:

- Backend source lives under `backend/`.
- Runtime is Node.js 22.
- Package manager is `npm`.
- TypeScript uses `module = NodeNext`.
- Test runner is `vitest` with `supertest`.
- Logger is `pino`.
- Database is MySQL through Prisma v6.
- Auth uses `jose` for JWT access tokens.
- Auth uses `bcrypt` for password hashing.
- Auth uses `nodemailer` as the SMTP client library.
- Reuse existing shared rate-limit infrastructure under `backend/src/shared/rate-limit/`.
- Do not run DB commands, migration commands, server commands, or Prisma CLI autonomously; the user/team runs them when ready.
- Do not commit `.env` or secrets.

## 1. Pre-Implementation Alignment

- [x] Task 001: Read `docs/tdd/auth/technical-design.md` before starting implementation.
- [x] Task 002: Read `docs/SPEC/auth/SPEC.md` to confirm Auth module scope boundaries.
- [x] Task 003: Confirm Auth owns tenant registration, email verification, login, refresh, logout, current-user lookup, JWT middleware, and RBAC helpers.
- [x] Task 004: Confirm Auth does not own tenant CRUD, user/staff CRUD, detailed permissions, device tokens, Socket.IO auth, sessions, URL rules, assets, subscriptions, or full audit persistence.
- [x] Task 005: Confirm public tenant registration creates only one `shop_admin`.
- [x] Task 006: Confirm public tenant registration must not create `staff` or `super_admin`.
- [x] Task 007: Confirm all new Auth source files will live under `backend/src/modules/auth/` and shared email files under `backend/src/shared/email/`.
- [x] Task 008: Record in implementation notes that the user/team must run dependency install, Prisma generate, migrations, DB setup, and server commands manually.

## 2. Dependencies and Package Metadata

- [x] Task 009: Update `backend/package.json` runtime dependencies to include `jose`.
- [x] Task 010: Update `backend/package.json` runtime dependencies to include `bcrypt`.
- [x] Task 011: Update `backend/package.json` runtime dependencies to include `nodemailer`.
- [x] Task 012: Update `backend/package.json` dev dependencies to include `@types/bcrypt`.
- [x] Task 013: Update `backend/package.json` dev dependencies to include `@types/nodemailer`.
- [x] Task 014: Verify new dependency names do not duplicate or conflict with existing dependencies.
- [x] Task 015: Do not update `package-lock.json` manually unless dependencies are installed by the user/team.

## 3. Environment and Configuration

- [x] Task 016: Add `JWT_ACCESS_TOKEN_TTL_SECONDS` placeholder to `backend/.env.example`.
- [x] Task 017: Add `REFRESH_TOKEN_TTL_DAYS` placeholder to `backend/.env.example`.
- [x] Task 018: Add `VERIFICATION_CODE_TTL_SECONDS` placeholder to `backend/.env.example`.
- [x] Task 019: Add `PENDING_REGISTRATION_TTL_SECONDS` placeholder to `backend/.env.example`.
- [x] Task 020: Add `AUTH_BCRYPT_COST` placeholder to `backend/.env.example`.
- [x] Task 021: Add `SMTP_HOST` placeholder to `backend/.env.example`.
- [x] Task 022: Add `SMTP_PORT` placeholder to `backend/.env.example`.
- [x] Task 023: Add `SMTP_SECURE` placeholder to `backend/.env.example`.
- [x] Task 024: Add `SMTP_USER` placeholder to `backend/.env.example`.
- [x] Task 025: Add `SMTP_PASSWORD` placeholder to `backend/.env.example`.
- [x] Task 026: Add `SMTP_FROM_EMAIL` placeholder to `backend/.env.example`.
- [x] Task 027: Add `SMTP_FROM_NAME` placeholder to `backend/.env.example`.
- [x] Task 028: Extend `backend/src/config/env.ts` schema with Auth token TTL variables.
- [x] Task 029: Extend `backend/src/config/env.ts` schema with verification and pending-registration TTL variables.
- [x] Task 030: Extend `backend/src/config/env.ts` schema with `AUTH_BCRYPT_COST`.
- [x] Task 031: Extend `backend/src/config/env.ts` schema with SMTP variables.
- [x] Task 032: Coerce numeric env values for token TTLs, verification TTLs, SMTP port, and bcrypt cost.
- [x] Task 033: Validate `SMTP_SECURE` as a boolean-like value.
- [x] Task 034: Export typed Auth config from the `env` object.
- [x] Task 035: Export typed SMTP config from the `env` object.
- [x] Task 036: Ensure env validation error messages do not print secret values.
- [x] Task 037: Decide test-mode mock email selection in config without requiring real SMTP credentials.

## 4. Prisma Data Model

- [x] Task 038: Add `TenantStatus` enum to `backend/prisma/schema.prisma`.
- [x] Task 039: Add `UserRole` enum to `backend/prisma/schema.prisma`.
- [x] Task 040: Add `UserStatus` enum to `backend/prisma/schema.prisma`.
- [x] Task 041: Add `VerificationTargetType` enum to `backend/prisma/schema.prisma`.
- [x] Task 042: Add `VerificationPurpose` enum to `backend/prisma/schema.prisma`.
- [x] Task 043: Add `Tenant` model to `backend/prisma/schema.prisma`.
- [x] Task 044: Add unique constraint for `Tenant.code`.
- [x] Task 045: Add `User` model to `backend/prisma/schema.prisma`.
- [x] Task 046: Add unique constraint for `User.email`.
- [x] Task 047: Add indexes for `User.tenantId`, `User.role`, and `User.status`.
- [x] Task 048: Add `Tenant` to `User` relation.
- [x] Task 049: Add `RefreshToken` model to `backend/prisma/schema.prisma`.
- [x] Task 050: Add unique constraint for `RefreshToken.tokenHash`.
- [x] Task 051: Add indexes for `RefreshToken(userId, revokedAt)`, `RefreshToken.expiresAt`, and `RefreshToken.familyId`.
- [x] Task 052: Add `User` to `RefreshToken` relation.
- [x] Task 053: Add `VerificationCode` model to `backend/prisma/schema.prisma`.
- [x] Task 054: Add indexes for `VerificationCode(target, purpose, consumedAt)` and `VerificationCode.expiresAt`.
- [x] Task 055: Add `PendingTenantRegistration` model to `backend/prisma/schema.prisma`.
- [x] Task 056: Add unique constraint for `PendingTenantRegistration.verificationCodeId`.
- [x] Task 057: Add indexes for `PendingTenantRegistration(adminEmail, consumedAt)`, `PendingTenantRegistration(tenantCode, consumedAt)`, and `PendingTenantRegistration.expiresAt`.
- [x] Task 058: Add `VerificationCode` to `PendingTenantRegistration` relation.
- [x] Task 059: Review schema for MySQL-compatible field types and relation definitions.
- [x] Task 060: Do not run Prisma migration commands; leave migration execution to the user/team.

## 5. Auth Module Scaffold

- [x] Task 061: Create `backend/src/modules/auth/` directory.
- [x] Task 062: Create `backend/src/modules/auth/auth.routes.ts`.
- [x] Task 063: Create `backend/src/modules/auth/auth.controller.ts`.
- [x] Task 064: Create `backend/src/modules/auth/auth.service.ts`.
- [x] Task 065: Create `backend/src/modules/auth/auth.schema.ts`.
- [x] Task 066: Create `backend/src/modules/auth/auth.types.ts`.
- [x] Task 067: Create `backend/src/modules/auth/auth.tokens.ts`.
- [x] Task 068: Create `backend/src/modules/auth/auth.password.ts`.
- [x] Task 069: Create `backend/src/modules/auth/auth.verification.ts`.
- [x] Task 070: Create `backend/src/modules/auth/auth.middleware.ts`.
- [x] Task 071: Create `backend/src/modules/auth/auth.rbac.ts`.
- [x] Task 072: Create `backend/src/modules/auth/auth.logging.ts`.
- [x] Task 073: Export an `authRouter` from `auth.routes.ts`.
- [x] Task 074: Keep controller logic thin and delegate business rules to `auth.service.ts`.
- [x] Task 075: Keep reusable secret-handling logic out of controllers.

## 6. Shared Email Infrastructure

- [x] Task 076: Create `backend/src/shared/email/` directory.
- [x] Task 077: Create `backend/src/shared/email/email-sender.ts`.
- [x] Task 078: Define `EmailSender` interface with `sendVerificationCode(email, code, purpose)`.
- [x] Task 079: Create `backend/src/shared/email/smtp-email-sender.ts`.
- [x] Task 080: Implement SMTP sender using `nodemailer`.
- [x] Task 081: Configure SMTP sender from typed `env` values.
- [x] Task 082: Ensure SMTP sender never logs `SMTP_PASSWORD` or raw verification codes.
- [x] Task 083: Create `backend/src/shared/email/mock-email-sender.ts`.
- [x] Task 084: Implement mock email sender for tests without network calls.
- [x] Task 085: Add a small factory/helper to choose mock sender in test environment and SMTP sender otherwise.
- [x] Task 086: Ensure missing SMTP config fails clearly when SMTP sender is selected.

## 7. Auth Types and Response Mapping

- [x] Task 087: Define `AuthRole` union in `auth.types.ts`.
- [x] Task 088: Define user DTO shape for Auth responses in `auth.types.ts`.
- [x] Task 089: Define tenant DTO shape for Auth responses in `auth.types.ts`.
- [x] Task 090: Define token pair DTO shape in `auth.types.ts`.
- [x] Task 091: Define register-tenant service input and output types.
- [x] Task 092: Define verify-register-tenant service input and output types.
- [x] Task 093: Define login service input and output types.
- [x] Task 094: Define refresh service input and output types.
- [x] Task 095: Define logout service input and output types.
- [x] Task 096: Define current-user service output type.
- [x] Task 097: Add mapper helpers that exclude `passwordHash`, `tokenHash`, and `codeHash` from API responses.

## 8. Validation Schemas

- [x] Task 098: Implement email normalization helper or zod transform.
- [x] Task 099: Implement `registerTenantSchema` in `auth.schema.ts`.
- [x] Task 100: Validate `tenantName` as a non-empty string with sensible max length.
- [x] Task 101: Validate `tenantCode` as a non-empty normalized code with sensible allowed characters.
- [x] Task 102: Validate `adminFullName` as a non-empty string with sensible max length.
- [x] Task 103: Validate `adminEmail` as a normalized email.
- [x] Task 104: Validate `adminPassword` with minimum password policy.
- [x] Task 105: Implement `verifyTenantRegistrationSchema`.
- [x] Task 106: Validate `registrationId` as a non-empty id string.
- [x] Task 107: Validate `verificationCode` as the expected code format.
- [x] Task 108: Implement `loginSchema`.
- [x] Task 109: Validate login email and password fields.
- [x] Task 110: Implement `refreshSchema`.
- [x] Task 111: Validate refresh token as a non-empty string.
- [x] Task 112: Implement `logoutSchema`.
- [x] Task 113: Validate logout refresh token as a non-empty string.
- [x] Task 114: Export all schemas for route-level `validateRequest` usage.

## 9. Password Utilities

- [x] Task 115: Implement password hashing in `auth.password.ts` using `bcrypt`.
- [x] Task 116: Read bcrypt cost from typed Auth env config.
- [x] Task 117: Implement password comparison in `auth.password.ts`.
- [x] Task 118: Ensure raw passwords are never returned from helper functions.
- [x] Task 119: Ensure password helper errors do not include raw password values.

## 10. Token Utilities

- [x] Task 120: Implement refresh token generation in `auth.tokens.ts` using `node:crypto`.
- [x] Task 121: Implement refresh token hashing in `auth.tokens.ts`.
- [x] Task 122: Use SHA-256 or HMAC-SHA-256 with a server secret for refresh-token hashing.
- [x] Task 123: Implement refresh token family id generation.
- [x] Task 124: Implement JWT access-token signing with `jose`.
- [x] Task 125: Include `sub`, `tenantId`, `role`, `tokenType = access`, `iat`, and `exp` in access token payload.
- [x] Task 126: Read access-token TTL from typed Auth env config.
- [x] Task 127: Implement JWT access-token verification with `jose`.
- [x] Task 128: Reject verified JWTs where `tokenType` is not `access`.
- [x] Task 129: Normalize token utility errors so callers can return `UNAUTHORIZED` without leaking details.

## 11. Verification Code Utilities

- [x] Task 130: Implement verification code generation in `auth.verification.ts`.
- [x] Task 131: Implement verification code hashing in `auth.verification.ts`.
- [x] Task 132: Implement verification code comparison in `auth.verification.ts`.
- [x] Task 133: Read verification-code TTL from typed Auth env config.
- [x] Task 134: Read pending-registration TTL from typed Auth env config.
- [x] Task 135: Centralize max failed attempts for verification codes.
- [x] Task 136: Implement helper to determine whether a verification code is expired, consumed, or over-attempted.

## 12. Safe Auth Logging

- [x] Task 137: Implement `maskEmail` or equivalent safe email display helper in `auth.logging.ts`.
- [x] Task 138: Implement `hashEmail` or equivalent stable email hash helper in `auth.logging.ts`.
- [x] Task 139: Implement helper for auth event logging with `requestId`.
- [x] Task 140: Support auth events listed in the TDD, including registration, login, refresh, logout, token errors, and rate-limit hits.
- [x] Task 141: Update `backend/src/shared/logging/logger.ts` redaction paths for `adminPassword`.
- [x] Task 142: Update logger redaction paths for `verificationCode`.
- [x] Task 143: Update logger redaction paths for `refreshToken`.
- [x] Task 144: Update logger redaction paths for SMTP secrets.
- [x] Task 145: Update logger redaction paths for JWT secrets.
- [x] Task 146: Ensure auth logs never include raw request bodies.

## 13. Auth Middleware and RBAC

- [x] Task 147: Update `backend/src/shared/middleware/auth-context.ts` AuthContext type to include `userId`, `tenantId`, `role`, and `tokenType`.
- [x] Task 148: Update `backend/src/shared/middleware/auth-context.types.d.ts` to expose the updated request auth context.
- [x] Task 149: Keep placeholder `authContextMiddleware` behavior safe for public routes.
- [x] Task 150: Implement `authRequired` in `auth.middleware.ts`.
- [x] Task 151: Parse `Authorization: Bearer <accessToken>` in `authRequired`.
- [x] Task 152: Verify JWT access token in `authRequired`.
- [x] Task 153: Attach verified token context to `req.authContext`.
- [x] Task 154: Return `UNAUTHORIZED` for missing, malformed, invalid, expired, or wrong-token-type access tokens.
- [x] Task 155: Implement `requireRole(...roles)` in `auth.rbac.ts`.
- [x] Task 156: Return `FORBIDDEN` when authenticated role is not allowed.
- [x] Task 157: Implement `requireTenantUser` in `auth.rbac.ts`.
- [x] Task 158: Return `FORBIDDEN` when a tenant-scoped route lacks `tenantId`.

## 14. Rate Limit Wiring

- [x] Task 159: Create auth-specific rate-limit key helpers for IP + normalized email.
- [x] Task 160: Create auth-specific rate-limit key helper for registrationId + IP.
- [x] Task 161: Create auth-specific rate-limit key helper for token family or IP fallback.
- [x] Task 162: Configure rate limit for `POST /api/auth/register-tenant`.
- [x] Task 163: Configure rate limit for `POST /api/auth/register-tenant/verify`.
- [x] Task 164: Configure rate limit for `POST /api/auth/login`.
- [x] Task 165: Configure rate limit for `POST /api/auth/refresh`.
- [x] Task 166: Configure rate limit for `POST /api/auth/logout`.
- [x] Task 167: Decide whether verify-code blocking until expiry needs a small auth-specific limiter helper or token-bucket approximation.
- [x] Task 168: Log `rate_limit_hit` safely when auth route limits are exceeded.

## 15. Registration Service Flow

- [x] Task 169: Implement `authService.registerTenant`.
- [x] Task 170: Normalize `adminEmail` before DB lookup.
- [x] Task 171: Normalize or validate `tenantCode` before DB lookup.
- [x] Task 172: Check `Tenant.code` for conflicts.
- [x] Task 173: Check `User.email` for conflicts.
- [x] Task 174: Hash `adminPassword` before storing pending registration.
- [x] Task 175: Generate raw verification code.
- [x] Task 176: Hash verification code before persistence.
- [x] Task 177: Create `VerificationCode` with `targetType = EMAIL` and `purpose = REGISTER_TENANT`.
- [x] Task 178: Create `PendingTenantRegistration` linked to the verification code.
- [x] Task 179: Send verification code through configured `EmailSender`.
- [x] Task 180: Return `registrationId`, normalized email, `expiresInSeconds`, and `resendAfterSeconds`.
- [x] Task 181: Log `register_tenant_requested` and `register_tenant_verification_sent` with safe identifiers.
- [x] Task 182: Ensure registration response never includes raw verification code or password hash.

## 16. Registration Verification Service Flow

- [x] Task 183: Implement `authService.verifyTenantRegistration`.
- [x] Task 184: Load `PendingTenantRegistration` by `registrationId`.
- [x] Task 185: Load linked `VerificationCode`.
- [x] Task 186: Reject missing pending registration with generic invalid-or-expired error.
- [x] Task 187: Reject expired or consumed pending registration.
- [x] Task 188: Reject expired, consumed, or over-attempted verification code.
- [x] Task 189: Compare submitted verification code with stored code hash.
- [x] Task 190: Increment `attemptCount` when verification code is wrong.
- [x] Task 191: Re-check `Tenant.code` conflict before creating real records.
- [x] Task 192: Re-check `User.email` conflict before creating real records.
- [x] Task 193: Implement transaction to create `Tenant` with `status = ACTIVE`.
- [x] Task 194: Implement transaction to create `User` with `role = shop_admin` and `status = ACTIVE`.
- [x] Task 195: Implement transaction to mark `VerificationCode.consumedAt`.
- [x] Task 196: Implement transaction to mark `PendingTenantRegistration.consumedAt`.
- [x] Task 197: Implement transaction to create initial `RefreshToken`.
- [x] Task 198: Sign access token after successful transaction.
- [x] Task 199: Return tenant, user, access token, and raw refresh token.
- [x] Task 200: Log `register_tenant_verification_failed` for failed verification without logging code.
- [x] Task 201: Log `register_tenant_completed` after successful registration.

## 17. Login Service Flow

- [x] Task 202: Implement `authService.login`.
- [x] Task 203: Normalize login email before DB lookup.
- [x] Task 204: Load user by email with tenant relation.
- [x] Task 205: Compare password with stored password hash.
- [x] Task 206: Return generic `UNAUTHORIZED` error for wrong email or password.
- [x] Task 207: Reject `DISABLED` users.
- [x] Task 208: Reject `SUSPENDED` tenants for `shop_admin` and `staff`.
- [x] Task 209: Update `lastLoginAt` after successful authentication.
- [x] Task 210: Create refresh token record with token hash and family id.
- [x] Task 211: Sign access token.
- [x] Task 212: Return user, access token, and raw refresh token.
- [x] Task 213: Log `login_succeeded` and `login_failed` with safe identifiers.

## 18. Refresh Service Flow

- [x] Task 214: Implement `authService.refresh`.
- [x] Task 215: Hash incoming refresh token.
- [x] Task 216: Load matching refresh token with user and tenant relation.
- [x] Task 217: Reject missing refresh token.
- [x] Task 218: Reject expired refresh token.
- [x] Task 219: Reject revoked refresh token.
- [x] Task 220: Reject disabled user.
- [x] Task 221: Reject suspended tenant for tenant users.
- [x] Task 222: Revoke old refresh token in a transaction.
- [x] Task 223: Create replacement refresh token in the same transaction.
- [x] Task 224: Preserve `familyId` on replacement refresh token.
- [x] Task 225: Set `replacedByTokenId` for the old refresh token when possible.
- [x] Task 226: Sign a new access token.
- [x] Task 227: Return new access token and raw replacement refresh token.
- [x] Task 228: Log `refresh_succeeded` and `refresh_failed` safely.

## 19. Logout Service Flow

- [x] Task 229: Implement `authService.logout`.
- [x] Task 230: Hash incoming refresh token.
- [x] Task 231: Revoke matching refresh token if it exists.
- [x] Task 232: Return success when refresh token is missing.
- [x] Task 233: Return success when refresh token is expired.
- [x] Task 234: Return success when refresh token is already revoked.
- [x] Task 235: Log `logout_completed` without logging the raw token or token hash.

## 20. Current User Service Flow

- [x] Task 236: Implement `authService.getCurrentUser`.
- [x] Task 237: Read `userId`, `tenantId`, and `role` from `req.authContext`.
- [x] Task 238: Load current user by `userId`.
- [x] Task 239: Return `NOT_FOUND` if the JWT subject no longer maps to an existing user.
- [x] Task 240: Reject disabled users.
- [x] Task 241: Load tenant for `shop_admin` and `staff`.
- [x] Task 242: Reject suspended tenant for tenant users.
- [x] Task 243: Support `super_admin` with `tenant = null`.
- [x] Task 244: Return user and tenant DTOs without secret fields.
- [x] Task 245: Log `me_loaded` safely.

## 21. Controllers and Routes

- [x] Task 246: Implement `authController.registerTenant`.
- [x] Task 247: Implement `authController.verifyTenantRegistration`.
- [x] Task 248: Implement `authController.login`.
- [x] Task 249: Implement `authController.refresh`.
- [x] Task 250: Implement `authController.logout`.
- [x] Task 251: Implement `authController.me`.
- [x] Task 252: Ensure each async controller catches errors and calls `next(error)`.
- [x] Task 253: Ensure each controller returns Foundation success response shape.
- [x] Task 254: Add `POST /api/auth/register-tenant` route with rate limit and validation.
- [x] Task 255: Add `POST /api/auth/register-tenant/verify` route with rate limit and validation.
- [x] Task 256: Add `POST /api/auth/login` route with rate limit and validation.
- [x] Task 257: Add `POST /api/auth/refresh` route with rate limit and validation.
- [x] Task 258: Add `POST /api/auth/logout` route with rate limit and validation.
- [x] Task 259: Add `GET /api/auth/me` route with `authRequired`.
- [x] Task 260: Mount `authRouter` in `backend/src/app.ts` before `notFoundHandler`.

## 22. Error Handling and Error Codes

- [x] Task 261: Review existing `ErrorCode` union for Auth needs.
- [x] Task 262: Reuse `VALIDATION_ERROR` for zod validation failures.
- [x] Task 263: Reuse `UNAUTHORIZED` for invalid credentials and invalid tokens.
- [x] Task 264: Reuse `FORBIDDEN` for disabled users, suspended tenants, and RBAC denials.
- [x] Task 265: Reuse `CONFLICT` for duplicate tenant code and duplicate email.
- [x] Task 266: Reuse `RATE_LIMITED` for auth rate-limit violations.
- [x] Task 267: Ensure login failure does not reveal whether email exists.
- [x] Task 268: Ensure verification failure uses generic invalid-or-expired wording.
- [x] Task 269: Ensure production error responses do not include stack traces.

## 23. Unit Tests

- [ ] Task 270: Add unit tests for email normalization.
- [ ] Task 271: Add unit tests for register-tenant zod schema validation.
- [ ] Task 272: Add unit tests for verify-registration zod schema validation.
- [ ] Task 273: Add unit tests for login zod schema validation.
- [ ] Task 274: Add unit tests for refresh and logout zod schema validation.
- [ ] Task 275: Add unit tests for bcrypt password hashing and verification.
- [ ] Task 276: Add unit tests for failed password comparison.
- [ ] Task 277: Add unit tests for refresh token generation.
- [ ] Task 278: Add unit tests for refresh token hashing.
- [ ] Task 279: Add unit tests for verification code generation.
- [ ] Task 280: Add unit tests for verification code hashing and comparison.
- [ ] Task 281: Add unit tests for JWT access-token signing with `jose`.
- [ ] Task 282: Add unit tests for JWT access-token verification.
- [ ] Task 283: Add unit tests for expired JWT rejection.
- [ ] Task 284: Add unit tests for wrong `tokenType` rejection.
- [ ] Task 285: Add unit tests for missing bearer token rejection.
- [ ] Task 286: Add unit tests for email masking or hashing.
- [ ] Task 287: Add unit tests for `requireRole`.
- [ ] Task 288: Add unit tests for `requireTenantUser`.

## 24. Service Tests

- [ ] Task 289: Add service test that `registerTenant` creates `PendingTenantRegistration` and `VerificationCode`.
- [ ] Task 290: Add service test that `registerTenant` does not create `Tenant` or `User` before verification.
- [ ] Task 291: Add service test that `registerTenant` rejects duplicate tenant code.
- [ ] Task 292: Add service test that `registerTenant` rejects duplicate admin email.
- [ ] Task 293: Add service test that successful verification creates `Tenant` and `shop_admin`.
- [ ] Task 294: Add service test that successful verification consumes pending registration and verification code.
- [ ] Task 295: Add service test that successful verification creates refresh token and returns tokens.
- [ ] Task 296: Add service test that verification rejects wrong code.
- [ ] Task 297: Add service test that verification rejects expired code.
- [ ] Task 298: Add service test that verification rejects too many attempts.
- [ ] Task 299: Add service test that verification re-checks tenant code and email before creation.
- [ ] Task 300: Add service test that login returns access and refresh tokens.
- [ ] Task 301: Add service test that login failure returns a generic error.
- [ ] Task 302: Add service test that login rejects disabled user.
- [ ] Task 303: Add service test that login rejects suspended tenant.
- [ ] Task 304: Add service test that refresh rotates old token to new token.
- [ ] Task 305: Add service test that refresh rejects revoked token.
- [ ] Task 306: Add service test that refresh rejects expired token.
- [ ] Task 307: Add service test that logout revokes refresh token.
- [ ] Task 308: Add service test that logout succeeds for unknown or already invalid token.
- [ ] Task 309: Add service test that `getCurrentUser` returns current user and tenant.

## 25. API Tests

- [x] Task 310: Add Supertest case for `POST /api/auth/register-tenant` success.
- [x] Task 311: Add Supertest case verifying register-tenant calls mock `EmailSender`.
- [x] Task 312: Add Supertest case for invalid register-tenant payload.
- [x] Task 313: Add Supertest case for duplicate tenant code.
- [x] Task 314: Add Supertest case for duplicate admin email.
- [x] Task 315: Add Supertest case for `POST /api/auth/register-tenant/verify` success.
- [x] Task 316: Add Supertest case for wrong verification code.
- [x] Task 317: Add Supertest case for expired verification code.
- [x] Task 318: Add Supertest case for login after registration verification.
- [x] Task 319: Add Supertest case for invalid login credentials.
- [x] Task 320: Add Supertest case for `GET /api/auth/me` with valid access token.
- [x] Task 321: Add Supertest case for `GET /api/auth/me` without token.
- [x] Task 322: Add Supertest case for `GET /api/auth/me` with malformed token.
- [x] Task 323: Add Supertest case for `POST /api/auth/refresh` with valid refresh token.
- [x] Task 324: Add Supertest case for refresh with revoked refresh token.
- [x] Task 325: Add Supertest case for `POST /api/auth/logout` idempotency.
- [x] Task 326: Add Supertest case proving Auth responses exclude `passwordHash`, `tokenHash`, and `codeHash`.
- [x] Task 327: Add Supertest case proving auth route rate limits return `RATE_LIMITED`.

## 26. Security and Logging Tests

- [x] Task 328: Add test that login failure does not reveal whether email exists.
- [x] Task 329: Add test that verification failure uses generic invalid-or-expired message.
- [x] Task 330: Add test that expired access token is rejected.
- [x] Task 331: Add test that revoked refresh token cannot be reused.
- [x] Task 332: Add test that consumed verification code cannot be reused.
- [x] Task 333: Add test that tenant registration cannot create `super_admin`.
- [x] Task 334: Add test that tenant registration cannot create `staff`.
- [x] Task 335: Add test that auth failure logs include `requestId`.
- [x] Task 336: Add test that auth logs use `maskedEmail` or `emailHash`.
- [x] Task 337: Add test that logs do not include raw password.
- [x] Task 338: Add test that logs do not include access token.
- [x] Task 339: Add test that logs do not include refresh token.
- [x] Task 340: Add test that logs do not include verification code.
- [x] Task 341: Add test that logs do not include token hash or code hash.

## 27. Email Tests

- [x] Task 342: Add test that test environment uses `MockEmailSender`.
- [x] Task 343: Add test that tenant registration calls `sendVerificationCode` with correct email.
- [x] Task 344: Add test that tenant registration calls `sendVerificationCode` with `REGISTER_TENANT` purpose.
- [x] Task 345: Add test that SMTP sender validates required SMTP env when selected.
- [x] Task 346: Add test that mock sender never performs network calls.

## 28. Documentation and Operations

- [x] Task 347: Update local setup documentation with required Auth env variables.
- [x] Task 348: Document that real SMTP values must be placed in local `.env` and not committed.
- [x] Task 349: Document manual Prisma migration and generate steps for the user/team.
- [x] Task 350: Document manual verification steps from the Auth TDD.
- [x] Task 351: Document that Redis rate-limit store is out of scope for Auth MVP.
- [x] Task 352: Document frontend handoff notes for registration, verification, login, token refresh, logout, and `me`.

## 29. Manual Verification

- [ ] Task 353: Ask the user/team to run dependency install after package changes.
- [ ] Task 354: Ask the user/team to run Prisma migration after schema changes.
- [ ] Task 355: Ask the user/team to run Prisma generate after migration.
- [ ] Task 356: Ask the user/team to provide real local SMTP env values.
- [ ] Task 357: Start backend only after the user/team approves running server commands.
- [ ] Task 358: Manually call `POST /api/auth/register-tenant` with valid data.
- [ ] Task 359: Confirm verification email is received.
- [ ] Task 360: Manually call `POST /api/auth/register-tenant/verify` with the received code.
- [ ] Task 361: Confirm verification returns tenant, user, access token, and refresh token.
- [ ] Task 362: Manually call `POST /api/auth/login`.
- [ ] Task 363: Manually call `GET /api/auth/me` with access token.
- [ ] Task 364: Manually call `POST /api/auth/refresh` and confirm old refresh token is revoked.
- [ ] Task 365: Manually call `POST /api/auth/logout` and confirm the refresh token can no longer be used.
- [ ] Task 366: Run the test suite after the user/team approves test commands.
- [ ] Task 367: Run TypeScript typecheck after the user/team approves build/typecheck commands.

## 30. Final Review

- [ ] Task 368: Verify every Auth endpoint follows the Foundation success/error response shape.
- [ ] Task 369: Verify every Auth route has validation and the required rate limit.
- [ ] Task 370: Verify no Auth response includes secret fields.
- [ ] Task 371: Verify no logs include raw secrets or auth request bodies.
- [ ] Task 372: Verify Auth middleware attaches `req.authContext` correctly.
- [ ] Task 373: Verify route-controller-service structure matches the existing Health module pattern.
- [ ] Task 374: Verify implementation does not run migrations or Prisma CLI during app startup.
- [ ] Task 375: Verify `docs/tdd/auth/technical-design.md` remains aligned with implemented behavior.

