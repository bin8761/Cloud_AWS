# Task Breakdown: CloudCMS Users Module

Source TDD: `docs/tdd/users/2026-05-22-users-technical-design.md`

Purpose: convert the Users TDD into a developer-facing Markdown checklist that follows `rule/task-breakdown-rule.mdc`.

Implementation constraints:

- Backend source lives under `backend/`.
- Runtime is Node.js backend with TypeScript.
- API framework is Express.
- ORM is Prisma with MySQL.
- Test runner is Vitest with Supertest.
- Reuse existing Auth, validation, error, Prisma, request id, and logging infrastructure.
- Do not add new runtime dependencies for Users MVP.
- Do not create a Prisma migration unless schema drift is discovered.
- Do not implement `DELETE /api/users/:id`, staff invite email, staff self-profile endpoints, `shop_admin` management, `super_admin` user administration, audit persistence, Web Admin UI, or Users-specific health endpoints.
- Do not run DB commands, migration commands, server commands, test commands, typecheck commands, or Prisma CLI autonomously; the user/team runs them when ready.
- Do not commit `.env` or secrets.

Implementation notes:

- DB, migration, server startup, test, typecheck, and Prisma CLI commands remain user/team-run actions for Users MVP implementation.
- Implementation work may inspect source files and update code/docs, but must not autonomously execute commands that change or depend on the runtime database, migrations, backend server lifecycle, test runner, typechecker, or Prisma CLI.

**Pre-Implementation Alignment**

- [x] Task 1: Read `docs/tdd/users/2026-05-22-users-technical-design.md` before starting implementation.
- [x] Task 2: Read `docs/SPEC/users/SPEC.md` to confirm Users MVP scope boundaries.
- [x] Task 3: Confirm Users owns staff create, staff list, staff detail, staff update, and safe staff lifecycle logging.
- [x] Task 4: Confirm Users does not own public tenant registration, login, refresh, logout, or current-user lookup.
- [x] Task 5: Confirm Users does not own staff self-profile endpoints and staff continues to use `GET /api/auth/me`.
- [x] Task 6: Confirm Users does not manage `shop_admin` or `super_admin` accounts in MVP.
- [x] Task 7: Confirm Users does not implement staff invite-email onboarding in MVP.
- [x] Task 8: Confirm Users does not implement physical deletion or `DELETE /api/users/:id` in MVP.
- [x] Task 9: Confirm staff lock and unlock use `User.status` with `ACTIVE` and `DISABLED`.
- [x] Task 10: Confirm every Users read and write must scope by `tenantId`, `role = STAFF`, and `deletedAt = null`.
- [x] Task 11: Confirm no Prisma migration is expected unless implementation discovers schema drift.
- [x] Task 12: Record in implementation notes that DB, migration, server, test, typecheck, and Prisma CLI commands remain user/team-run actions.

**Existing Codebase Verification**

- [x] Task 13: Inspect `backend/src/app.ts` to identify the current middleware and router mount order.
- [x] Task 14: Inspect `backend/src/modules/auth/auth.middleware.ts` to confirm `authRequired` behavior for missing, malformed, expired, invalid, and wrong-token-type access tokens.
- [x] Task 15: Inspect `backend/src/modules/auth/auth.rbac.ts` to confirm `requireRole` and `requireTenantUser` behavior.
- [x] Task 16: Inspect `backend/src/modules/auth/auth.password.ts` to confirm the existing password hashing and password strength APIs.
- [x] Task 17: Inspect `backend/src/shared/validation/validate-request.ts` to confirm validated body, query, and params assignment behavior.
- [x] Task 18: Inspect `backend/src/shared/errors/app-error.ts` and the centralized error handler to confirm error code and response shape conventions.
- [x] Task 19: Inspect `backend/src/shared/prisma/prisma.client.ts` to confirm the Prisma client singleton import path.
- [x] Task 20: Inspect `backend/src/shared/logging/logger.ts` and request id middleware to confirm safe structured logging patterns.
- [x] Task 21: Inspect `backend/prisma/schema.prisma` to confirm `User`, `Tenant`, `RefreshToken`, `UserRole`, and `UserStatus` match the TDD.
- [x] Task 22: Inspect existing Auth tests to reuse token, password, and status test patterns.
- [x] Task 23: Inspect existing Tenants tests to reuse Vitest/Supertest app-import and Prisma mock style.
- [x] Task 24: Document any discovered schema drift in `User`, `UserRole`, or `UserStatus` and stop before adding migrations.
  - Result: No schema drift discovered in `User`, `UserRole`, or `UserStatus` after TDD vs `backend/prisma/schema.prisma` verification (Task 21); no Prisma migration added.

**Users Module Scaffold**

- [x] Task 25: Create `backend/src/modules/users/` directory.
- [x] Task 26: Create `backend/src/modules/users/users.routes.ts`.
- [x] Task 27: Create `backend/src/modules/users/users.controller.ts`.
- [x] Task 28: Create `backend/src/modules/users/users.service.ts`.
- [x] Task 29: Create `backend/src/modules/users/users.schema.ts`.
- [x] Task 30: Create `backend/src/modules/users/users.types.ts`.
- [x] Task 31: Create `backend/src/modules/users/users.logging.ts`.
- [x] Task 32: Export `usersRouter` from `users.routes.ts`.
- [x] Task 33: Keep route handlers free of business logic by delegating to `users.controller.ts`.
- [x] Task 34: Keep controller methods thin and delegate persistence and domain decisions to `users.service.ts`.
- [x] Task 35: Keep Users-specific DTO and mapper logic out of route handlers.
- [x] Task 36: Keep Users logging helpers free of raw request headers, raw request bodies, tokens, raw passwords, and password hashes.

**App Wiring**

- [x] Task 37: Import `usersRouter` in `backend/src/app.ts`.
- [x] Task 38: Mount `usersRouter` at `/api/users` in `backend/src/app.ts`.
- [x] Task 39: Place `usersRouter` after `authContextMiddleware` and after `/api/auth`.
- [x] Task 40: Place `usersRouter` near `/api/tenants` and before `notFoundHandler`.
- [x] Task 41: Verify the final app order keeps `errorHandler` after `usersRouter`.

**Types and DTO Mapping**

- [x] Task 42: Define `StaffUserDto` in `users.types.ts` with `id`, `tenantId`, `email`, `fullName`, `role`, `status`, `lastLoginAt`, `createdAt`, and `updatedAt`.
- [x] Task 43: Define `CreateStaffUserInput` in `users.types.ts` with `email`, `fullName`, and `password`.
- [x] Task 44: Define `ListStaffUsersInput` in `users.types.ts` with `page`, `pageSize`, optional `status`, and optional `q`.
- [x] Task 45: Define `ListStaffUsersOutput` in `users.types.ts` with `items`, `page`, `pageSize`, and `total`.
- [x] Task 46: Define `UpdateStaffUserInput` in `users.types.ts` with optional `fullName`, optional `status`, and optional `password`.
- [x] Task 47: Implement `mapStaffUserDto` in `users.types.ts`.
- [x] Task 48: Ensure `mapStaffUserDto` includes only safe staff DTO fields.
- [x] Task 49: Ensure `mapStaffUserDto` excludes `passwordHash`, `deletedAt`, `refreshTokens`, and token material.
- [x] Task 50: Ensure `mapStaffUserDto` preserves `role` as `STAFF` and `status` as `ACTIVE` or `DISABLED`.
- [x] Task 51: Ensure date fields serialize consistently with existing module patterns.

**Validation Schemas**

- [x] Task 52: Define `staffEmailSchema` in `users.schema.ts`.
- [x] Task 53: Normalize staff email by trimming and lowercasing it.
- [x] Task 54: Validate staff email format and reject invalid email input.
- [x] Task 55: Define `staffFullNameSchema` in `users.schema.ts`.
- [x] Task 56: Trim `fullName` and constrain it to 1 through 120 characters.
- [x] Task 57: Define `staffStatusSchema` with only `ACTIVE` and `DISABLED`.
- [x] Task 58: Reuse the existing Auth password strength rule for staff create and password reset inputs.
- [x] Task 59: Define `staffUserIdParamsSchema` with a required non-empty `id`.
- [x] Task 60: Define strict `createStaffUserSchema` with only `email`, `fullName`, and `password`.
- [x] Task 61: Configure `createStaffUserSchema` to reject protected fields including `id`, `tenantId`, `role`, `status`, `passwordHash`, `deletedAt`, `createdAt`, `updatedAt`, and `lastLoginAt`.
- [x] Task 62: Define strict `updateStaffUserSchema` with optional `fullName`, optional `status`, and optional `password`.
- [x] Task 63: Configure `updateStaffUserSchema` to require at least one valid update field.
- [x] Task 64: Configure `updateStaffUserSchema` to reject `email`, `tenantId`, `role`, `passwordHash`, `id`, `deletedAt`, `createdAt`, `updatedAt`, and `lastLoginAt`.
- [x] Task 65: Define `listStaffUsersQuerySchema` with `page`, `pageSize`, `status`, and `q`.
- [x] Task 66: Parse `page` as an integer and default it to `1`.
- [x] Task 67: Parse `pageSize` as an integer and default it to `20`.
- [x] Task 68: Reject `pageSize > 100` with `VALIDATION_ERROR`.
- [x] Task 69: Trim `q` and normalize empty or whitespace-only `q` to omitted.
- [x] Task 70: Reject overlong `q` input according to the local validation convention.
- [x] Task 71: Export all Users schemas needed by routes and unit tests.

**Routes**

- [x] Task 72: Register `POST /` in `users.routes.ts` for `POST /api/users`.
- [x] Task 73: Register `GET /` in `users.routes.ts` for `GET /api/users`.
- [x] Task 74: Register `GET /:id` in `users.routes.ts` for `GET /api/users/:id`.
- [x] Task 75: Register `PATCH /:id` in `users.routes.ts` for `PATCH /api/users/:id`.
- [x] Task 76: Apply `authRequired` to every Users route.
- [x] Task 77: Apply `requireRole("shop_admin")` to every Users route.
- [x] Task 78: Apply `requireTenantUser` to every Users route.
- [x] Task 79: Apply `validateRequest({ body: createStaffUserSchema })` to `POST /`.
- [x] Task 80: Apply `validateRequest({ query: listStaffUsersQuerySchema })` to `GET /`.
- [x] Task 81: Apply `validateRequest({ params: staffUserIdParamsSchema })` to `GET /:id`.
- [x] Task 82: Apply `validateRequest({ params: staffUserIdParamsSchema, body: updateStaffUserSchema })` to `PATCH /:id`.
- [x] Task 83: Wire `POST /` to `usersController.createStaffUser`.
- [x] Task 84: Wire `GET /` to `usersController.listStaffUsers`.
- [x] Task 85: Wire `GET /:id` to `usersController.getStaffUserById`.
- [x] Task 86: Wire `PATCH /:id` to `usersController.updateStaffUserById`.

**Controllers**

- [x] Task 87: Implement `usersController.createStaffUser` in `users.controller.ts`.
- [x] Task 88: Read validated body and auth context in `createStaffUser`.
- [x] Task 89: Call `usersService.createStaffUser(authContext, body)` from `createStaffUser`.
- [x] Task 90: Return Foundation success response shape from `createStaffUser`.
- [x] Task 91: Implement `usersController.listStaffUsers` in `users.controller.ts`.
- [x] Task 92: Read validated query and auth context in `listStaffUsers`.
- [x] Task 93: Call `usersService.listStaffUsers(authContext, query)` from `listStaffUsers`.
- [x] Task 94: Return Foundation success response shape from `listStaffUsers`.
- [x] Task 95: Implement `usersController.getStaffUserById` in `users.controller.ts`.
- [x] Task 96: Read validated params and auth context in `getStaffUserById`.
- [x] Task 97: Call `usersService.getStaffUserById(authContext, id)` from `getStaffUserById`.
- [x] Task 98: Return Foundation success response shape from `getStaffUserById`.
- [x] Task 99: Implement `usersController.updateStaffUserById` in `users.controller.ts`.
- [x] Task 100: Read validated params, validated body, and auth context in `updateStaffUserById`.
- [x] Task 101: Call `usersService.updateStaffUserById(authContext, id, body)` from `updateStaffUserById`.
- [x] Task 102: Return Foundation success response shape from `updateStaffUserById`.
- [x] Task 103: Forward controller errors to `next(error)` in every Users controller method.

**Service Shared Helpers**

- [x] Task 104: Import the Prisma client singleton in `users.service.ts`.
- [x] Task 105: Import `AppError` or existing shared error helpers in `users.service.ts`.
- [x] Task 106: Import `authPasswordService` in `users.service.ts`.
- [x] Task 107: Create a shared helper that asserts `authContext.tenantId` exists or throws `FORBIDDEN`.
- [x] Task 108: Create a shared staff target filter helper with `tenantId`, `role: STAFF`, and `deletedAt: null`.
- [x] Task 109: Create a shared `NOT_FOUND` error helper for missing, deleted, cross-tenant, and non-STAFF targets.
- [x] Task 110: Create a shared `CONFLICT` error helper for duplicate email.
- [x] Task 111: Create a shared Prisma select object for safe staff DTO fields.
- [x] Task 112: Ensure service methods never trust client-supplied `tenantId`, `role`, `status` on create, `passwordHash`, ids, or timestamps.

**Create Staff Service**

- [x] Task 113: Implement `createStaffUser(authContext, input)` in `users.service.ts`.
- [x] Task 114: Derive the target `tenantId` only from `authContext.tenantId` in `createStaffUser`.
- [x] Task 115: Check for duplicate normalized email before creating staff.
- [x] Task 116: Throw `CONFLICT` when a user with the normalized email already exists.
- [x] Task 117: Hash `input.password` with `authPasswordService.hashPassword` before persistence.
- [x] Task 118: Create a `User` record with server-controlled `tenantId`, `role: STAFF`, `status: ACTIVE`, normalized `email`, `fullName`, and `passwordHash`.
- [x] Task 119: Avoid persisting raw passwords in `createStaffUser`.
- [x] Task 120: Return the created staff as `StaffUserDto`.
- [x] Task 121: Emit a safe `user.staff.created` event after successful staff creation.

**List Staff Service**

- [x] Task 122: Implement `listStaffUsers(authContext, input)` in `users.service.ts`.
- [x] Task 123: Derive the list `tenantId` only from `authContext.tenantId`.
- [x] Task 124: Build the base list filter with `tenantId`, `role: STAFF`, and `deletedAt: null`.
- [x] Task 125: Apply optional `status` filter when `input.status` is present.
- [x] Task 126: Apply optional `q` search over `User.email` when `input.q` is present.
- [x] Task 127: Apply optional `q` search over `User.fullName` when `input.q` is present.
- [x] Task 128: Sort list results by `createdAt desc`.
- [x] Task 129: Calculate `skip = (page - 1) * pageSize`.
- [x] Task 130: Use `take = pageSize` for list pagination.
- [x] Task 131: Query total matching staff count with the same list filter.
- [x] Task 132: Query paginated staff items using the safe staff DTO select.
- [x] Task 133: Avoid relation loading and token loading in staff list queries.
- [x] Task 134: Return `items`, `page`, `pageSize`, and `total` from `listStaffUsers`.

**Detail Staff Service**

- [x] Task 135: Implement `getStaffUserById(authContext, id)` in `users.service.ts`.
- [x] Task 136: Derive the detail `tenantId` only from `authContext.tenantId`.
- [x] Task 137: Query staff detail by `id`, `tenantId`, `role: STAFF`, and `deletedAt: null`.
- [x] Task 138: Throw `NOT_FOUND` for unknown staff ids.
- [x] Task 139: Throw `NOT_FOUND` for deleted staff records.
- [x] Task 140: Throw `NOT_FOUND` for staff from another tenant.
- [x] Task 141: Throw `NOT_FOUND` for `SHOP_ADMIN` and `SUPER_ADMIN` targets.
- [x] Task 142: Return the target staff as `StaffUserDto`.
- [x] Task 143: Avoid relation loading and token loading in staff detail queries.

**Update Staff Service**

- [x] Task 144: Implement `updateStaffUserById(authContext, id, input)` in `users.service.ts`.
- [x] Task 145: Derive the update `tenantId` only from `authContext.tenantId`.
- [x] Task 146: Load the target staff by `id`, `tenantId`, `role: STAFF`, and `deletedAt: null` before update.
- [x] Task 147: Throw `NOT_FOUND` when the update target is unknown, deleted, cross-tenant, or non-STAFF.
- [x] Task 148: Build update data from allowlisted fields only.
- [x] Task 149: Update `fullName` only when `input.fullName` is present.
- [x] Task 150: Update `status` only when `input.status` is present.
- [x] Task 151: Hash `input.password` before assigning a new `passwordHash`.
- [x] Task 152: Avoid persisting raw passwords during password reset.
- [x] Task 153: Ensure update logic never changes `email`, `tenantId`, `role`, `id`, `deletedAt`, `createdAt`, `updatedAt`, or `lastLoginAt`.
- [x] Task 154: Persist only the allowlisted update data through Prisma.
- [x] Task 155: Re-read or return the updated staff using the safe staff DTO select.
- [x] Task 156: Return the updated staff as `StaffUserDto`.
- [x] Task 157: Emit a safe `user.staff.updated` event when profile fields change.
- [x] Task 158: Emit a safe `user.staff.status.updated` event when status changes.
- [x] Task 159: Include `oldStatus` and `newStatus` in status update logs.
- [x] Task 160: Emit a safe `user.staff.password.reset` event when password reset occurs.

**Logging and Observability**

- [x] Task 161: Implement `logStaffCreated` in `users.logging.ts`.
- [x] Task 162: Implement `logStaffUpdated` in `users.logging.ts`.
- [x] Task 163: Implement `logStaffStatusUpdated` in `users.logging.ts`.
- [x] Task 164: Implement `logStaffPasswordReset` in `users.logging.ts`.
- [x] Task 165: Include `requestId` in Users lifecycle logs when available.
- [x] Task 166: Include safe actor metadata in Users lifecycle logs.
- [x] Task 167: Include safe target user metadata in Users lifecycle logs.
- [x] Task 168: Include changed field names in update logs without logging field values that may contain secrets.
- [x] Task 169: Ensure Users logs never include raw passwords or password hashes.
- [x] Task 170: Ensure Users logs never include authorization headers, access tokens, refresh tokens, raw request headers, or raw request bodies.
- [x] Task 171: Confirm no Users-specific health endpoint is added.
- [x] Task 172: Confirm existing `/health` and `/api/health/db` remain the health checks for Users operational dependencies.

**Security Hardening**

- [x] Task 173: Ensure every Users endpoint requires `authRequired`.
- [x] Task 174: Ensure every Users endpoint allows only `shop_admin` in MVP.
- [x] Task 175: Ensure `staff` callers are denied on every Users endpoint.
- [x] Task 176: Ensure `super_admin` callers are denied on every Users endpoint in MVP.
- [x] Task 177: Ensure missing tenant context returns `FORBIDDEN`.
- [x] Task 178: Ensure client-supplied `tenantId` cannot affect create scope.
- [x] Task 179: Ensure client-supplied `tenantId` cannot affect list scope.
- [x] Task 180: Ensure client-supplied `tenantId` cannot affect detail scope.
- [x] Task 181: Ensure client-supplied `tenantId` cannot affect update scope.
- [x] Task 182: Ensure client-supplied role-like fields cannot create non-STAFF users.
- [x] Task 183: Ensure client-supplied role-like fields cannot mutate STAFF into another role.
- [x] Task 184: Ensure Users responses never expose `passwordHash`, `deletedAt`, refresh tokens, or token material.
- [x] Task 185: Ensure Users services do not load `RefreshToken` relations.
- [x] Task 186: Ensure disabled staff login and current-user restrictions remain delegated to the existing Auth behavior.

**Performance and Reliability**

- [x] Task 187: Ensure staff list always uses bounded pagination.
- [x] Task 188: Ensure staff list never returns an unbounded tenant staff table.
- [x] Task 189: Ensure `pageSize` defaults to `20`.
- [x] Task 190: Ensure `pageSize` cannot exceed `100`.
- [x] Task 191: Ensure list results use stable `createdAt desc` ordering.
- [x] Task 192: Ensure list and count queries use the same `where` filter.
- [x] Task 193: Ensure Users DTO queries avoid N+1 relation loading.
- [x] Task 194: Ensure Users implementation does not add cache, queues, workers, retries, or external network calls.
- [x] Task 195: Ensure the app does not run Prisma migrations or schema pushes during startup.

**API Authentication Tests**

- [x] Task 196: Create `backend/tests/users/users.api.test.ts`.
- [x] Task 197: Add Supertest coverage for missing token on `GET /api/users` returning `401 UNAUTHORIZED`.
- [x] Task 198: Add Supertest coverage for missing token on `POST /api/users` returning `401 UNAUTHORIZED`.
- [x] Task 199: Add Supertest coverage for malformed bearer token on Users API returning `401 UNAUTHORIZED`.
- [x] Task 200: Add Supertest coverage for invalid access token on Users API returning `401 UNAUTHORIZED`.
- [x] Task 201: Add Supertest coverage for expired access token on Users API returning `401 UNAUTHORIZED`.

**API Authorization Tests**

- [x] Task 202: Add Supertest coverage proving `shop_admin` can access `POST /api/users`.
- [x] Task 203: Add Supertest coverage proving `shop_admin` can access `GET /api/users`.
- [x] Task 204: Add Supertest coverage proving `shop_admin` can access `GET /api/users/:id`.
- [x] Task 205: Add Supertest coverage proving `shop_admin` can access `PATCH /api/users/:id`.
- [x] Task 206: Add Supertest coverage proving `staff` cannot access any `/api/users` endpoint.
- [x] Task 207: Add Supertest coverage proving `super_admin` cannot access any `/api/users` endpoint in MVP.
- [x] Task 208: Add Supertest coverage proving `shop_admin` without tenant context receives `403 FORBIDDEN`.

**Create Staff API Tests**

- [x] Task 209: Add Supertest coverage proving `shop_admin` can create staff with `email`, `fullName`, and `password`.
- [x] Task 210: Add Supertest coverage proving created staff uses caller `tenantId`.
- [x] Task 211: Add Supertest coverage proving created staff has `role = STAFF`.
- [x] Task 212: Add Supertest coverage proving created staff has `status = ACTIVE`.
- [x] Task 213: Add Supertest coverage proving staff email is trimmed and lowercased.
- [x] Task 214: Add Supertest coverage proving password is stored as a hash.
- [x] Task 215: Add Supertest coverage proving raw password is not persisted.
- [x] Task 216: Add Supertest coverage proving duplicate email returns `409 CONFLICT`.
- [x] Task 217: Add Supertest coverage proving invalid email returns `400 VALIDATION_ERROR`.
- [x] Task 218: Add Supertest coverage proving empty or overlong `fullName` returns `400 VALIDATION_ERROR`.
- [x] Task 219: Add Supertest coverage proving weak or missing password returns `400 VALIDATION_ERROR`.
- [x] Task 220: Add Supertest coverage proving create rejects `tenantId`, `role`, `status`, `passwordHash`, `id`, `deletedAt`, `createdAt`, `updatedAt`, and `lastLoginAt`.
- [x] Task 221: Add Supertest coverage proving create response does not expose `passwordHash`, `deletedAt`, refresh tokens, or token material.

**Staff List API Tests**

- [x] Task 222: Add Supertest coverage proving `shop_admin` can list staff in own tenant.
- [x] Task 223: Add Supertest coverage proving list defaults to `page = 1` and `pageSize = 20`.
- [x] Task 224: Add Supertest coverage proving `pageSize > 100` returns `400 VALIDATION_ERROR`.
- [x] Task 225: Add Supertest coverage proving list supports `status=ACTIVE`.
- [x] Task 226: Add Supertest coverage proving list supports `status=DISABLED`.
- [x] Task 227: Add Supertest coverage proving invalid `status` returns `400 VALIDATION_ERROR`.
- [x] Task 228: Add Supertest coverage proving `q` searches over `email`.
- [x] Task 229: Add Supertest coverage proving `q` searches over `fullName`.
- [x] Task 230: Add Supertest coverage proving `q` is trimmed and empty search is omitted.
- [x] Task 231: Add Supertest coverage proving overlong `q` returns `400 VALIDATION_ERROR`.
- [x] Task 232: Add Supertest coverage proving invalid `page` returns `400 VALIDATION_ERROR`.
- [x] Task 233: Add Supertest coverage proving invalid `pageSize` returns `400 VALIDATION_ERROR`.
- [x] Task 234: Add Supertest coverage proving list sorts by `createdAt desc`.
- [x] Task 235: Add Supertest coverage proving list returns `items`, `page`, `pageSize`, and `total`.
- [x] Task 236: Add Supertest coverage proving list excludes users where `deletedAt` is not null.
- [x] Task 237: Add Supertest coverage proving list excludes `SHOP_ADMIN` and `SUPER_ADMIN` users.
- [x] Task 238: Add Supertest coverage proving list excludes staff from other tenants.
- [x] Task 239: Add Supertest coverage proving list response does not expose `passwordHash`, `deletedAt`, or token material.

**Staff Detail API Tests**

- [x] Task 240: Add Supertest coverage proving `shop_admin` can get staff detail in own tenant.
- [x] Task 241: Add Supertest coverage proving unknown staff id returns `404 NOT_FOUND`.
- [x] Task 242: Add Supertest coverage proving deleted staff returns `404 NOT_FOUND`.
- [x] Task 243: Add Supertest coverage proving staff from another tenant returns `404 NOT_FOUND`.
- [x] Task 244: Add Supertest coverage proving `SHOP_ADMIN` target returns `404 NOT_FOUND`.
- [x] Task 245: Add Supertest coverage proving `SUPER_ADMIN` target returns `404 NOT_FOUND`.
- [x] Task 246: Add Supertest coverage proving invalid `id` returns `400 VALIDATION_ERROR`.
- [x] Task 247: Add Supertest coverage proving detail response does not expose `passwordHash`, `deletedAt`, or token material.

**Staff Update API Tests**

- [x] Task 248: Add Supertest coverage proving `shop_admin` can update staff `fullName`.
- [x] Task 249: Add Supertest coverage proving `shop_admin` can update staff `status` to `ACTIVE`.
- [x] Task 250: Add Supertest coverage proving `shop_admin` can update staff `status` to `DISABLED`.
- [x] Task 251: Add Supertest coverage proving `shop_admin` can reset staff password.
- [x] Task 252: Add Supertest coverage proving password reset stores a hash.
- [x] Task 253: Add Supertest coverage proving password reset does not persist raw password.
- [x] Task 254: Add Supertest coverage proving `PATCH /api/users/:id` can update multiple allowed fields in one request.
- [x] Task 255: Add Supertest coverage proving empty patch body returns `400 VALIDATION_ERROR`.
- [x] Task 256: Add Supertest coverage proving unknown patch fields return `400 VALIDATION_ERROR`.
- [x] Task 257: Add Supertest coverage proving invalid `status` returns `400 VALIDATION_ERROR`.
- [x] Task 258: Add Supertest coverage proving empty or overlong `fullName` returns `400 VALIDATION_ERROR`.
- [x] Task 259: Add Supertest coverage proving weak password returns `400 VALIDATION_ERROR`.
- [x] Task 260: Add Supertest coverage proving patch rejects `email`, `tenantId`, `role`, `passwordHash`, `id`, `deletedAt`, `createdAt`, `updatedAt`, and `lastLoginAt`.
- [x] Task 261: Add Supertest coverage proving unknown staff id returns `404 NOT_FOUND`.
- [x] Task 262: Add Supertest coverage proving deleted staff returns `404 NOT_FOUND`.
- [x] Task 263: Add Supertest coverage proving staff from another tenant returns `404 NOT_FOUND`.
- [x] Task 264: Add Supertest coverage proving `SHOP_ADMIN` target returns `404 NOT_FOUND`.
- [x] Task 265: Add Supertest coverage proving `SUPER_ADMIN` target returns `404 NOT_FOUND`.
- [x] Task 266: Add Supertest coverage proving update response does not expose `passwordHash`, `deletedAt`, or token material.

**Security and Logging Tests**

- [x] Task 267: Add API test coverage proving staff create logs include `requestId` when available.
- [x] Task 268: Add API test coverage proving staff update logs include actor role and target user id.
- [x] Task 269: Add API test coverage proving staff status update logs include `oldStatus` and `newStatus`.
- [x] Task 270: Add API test coverage proving password reset logs do not include raw password or password hash.
- [x] Task 271: Add API test coverage proving logs do not include authorization headers.
- [x] Task 272: Add API test coverage proving logs do not include access tokens or refresh tokens.
- [x] Task 273: Add API test coverage proving logs do not include raw request headers.
- [x] Task 274: Add API test coverage proving logs do not include raw request body.
- [x] Task 275: Add API test coverage proving client-supplied `tenantId` cannot affect create, list, detail, or update target scope.
- [x] Task 276: Add API test coverage proving client-supplied role-like data cannot create or mutate non-STAFF users.

**Service and Unit Tests**

- [x] Task 277: Create `backend/tests/users/users.unit.test.ts`.
- [x] Task 278: Add unit tests proving `mapStaffUserDto` omits `passwordHash`, `deletedAt`, and relations.
- [x] Task 279: Add unit tests for `staffEmailSchema` normalization and validation.
- [x] Task 280: Add unit tests for `staffFullNameSchema` trimming and length validation.
- [x] Task 281: Add unit tests for `staffStatusSchema` accepted and rejected values.
- [x] Task 282: Add unit tests for `createStaffUserSchema` strict object behavior and protected field rejection.
- [x] Task 283: Add unit tests for `updateStaffUserSchema` at-least-one-field behavior and protected field rejection.
- [x] Task 284: Add unit tests for `listStaffUsersQuerySchema` defaults, integer parsing, `pageSize` cap, and `q` normalization.
- [x] Task 285: Create `backend/tests/users/users.service.test.ts`.
- [x] Task 286: Add service tests proving `createStaffUser` hashes password before persistence.
- [x] Task 287: Add service tests proving `createStaffUser` creates only `STAFF` users.
- [x] Task 288: Add service tests proving `createStaffUser` returns `CONFLICT` for duplicate email.
- [x] Task 289: Add service tests proving `listStaffUsers` builds pagination correctly.
- [x] Task 290: Add service tests proving `listStaffUsers` filters by tenant id, `role = STAFF`, and `deletedAt = null`.
- [x] Task 291: Add service tests proving `getStaffUserById` returns `NOT_FOUND` for cross-tenant and non-STAFF users.
- [x] Task 292: Add service tests proving `updateStaffUserById` only applies allowlisted fields.
- [x] Task 293: Add service tests proving `updateStaffUserById` hashes password when password reset is requested.
- [x] Task 294: Add service tests proving `updateStaffUserById` returns `NOT_FOUND` for missing, deleted, cross-tenant, and non-STAFF users.

**Contract, Documentation, and Manual Verification**

- [ ] Task 295: Document the Users response contract for `POST /api/users`.
- [ ] Task 296: Document the Users response contract for `GET /api/users`.
- [ ] Task 297: Document the Users response contract for `GET /api/users/:id`.
- [ ] Task 298: Document the Users response contract for `PATCH /api/users/:id`.
- [ ] Task 299: Document that Web Admin UI work is outside this TDD.
- [ ] Task 300: Document that staff self-profile remains handled by `GET /api/auth/me`.
- [ ] Task 301: Document that no Users-specific environment variables are required.
- [ ] Task 302: Document that no Users-specific health endpoint is added.
- [ ] Task 303: Document that staff invite email, formal audit persistence, forced password change, and future rate limiting remain future decisions.
- [ ] Task 304: Prepare manual verification steps for user/team-run backend startup and token acquisition.
- [ ] Task 305: Prepare manual verification steps for `POST /api/users` as `shop_admin`.
- [ ] Task 306: Prepare manual verification steps for `GET /api/users` pagination and filters.
- [ ] Task 307: Prepare manual verification steps for `GET /api/users/:id` staff detail.
- [ ] Task 308: Prepare manual verification steps for `PATCH /api/users/:id` `fullName`, `status`, and password reset.
- [ ] Task 309: Prepare manual verification steps confirming `staff` cannot access `/api/users`.
- [ ] Task 310: Prepare manual verification steps confirming `super_admin` cannot access `/api/users` in MVP.
- [ ] Task 311: Prepare manual verification steps confirming disabled staff cannot login, refresh, or use `GET /api/auth/me`.
- [ ] Task 312: Ask the user/team to run the Users unit, service, API, typecheck, and manual verification commands when implementation is complete.
 