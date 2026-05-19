# Task Breakdown: CloudCMS Foundation Module

Source TDD: `docs/tdd/foundation/technical-design.md`

Purpose: turn the Foundation TDD into small implementation-sized checklist items. Each item should be small enough for one focused development step, usually a few hours or less.

Implementation constraints:

- Backend source lives under `backend/`.
- Runtime is Node.js 22.
- Package manager is `npm`.
- Test runner is `vitest`.
- Logger is `pino`.
- Database is MySQL through Prisma.
- Local DB is XAMPP MySQL.
- Do not run DB commands, migration commands, server commands, or Prisma CLI autonomously; the user/team runs them when ready.
- Do not commit `.env` or secrets.

## 1. Pre-Implementation Alignment

- [x] Task 001: Read `docs/tdd/foundation/technical-design.md` before starting implementation.
- [x] Task 002: Read `docs/SPEC/foundation/SPEC.md` to confirm scope boundaries before implementation.
- [x] Task 003: Confirm that Foundation excludes auth business logic, RBAC, tenant onboarding, computer registration, realtime, session/usage, asset upload, and license enforcement.
- [x] Task 004: Confirm that all source code for this module will be created under `backend/`.
- [x] Task 005: Confirm that `npm`, Node.js 22, `vitest`, `supertest`, `pino`, Express, Prisma, and MySQL are the approved stack.
- [x] Task 006: Record in implementation notes that the user/team must run install, DB, Prisma CLI, migration, and server commands manually.
- [x] Task 007: Check whether a root `.gitignore` already excludes `.env`, `node_modules/`, `dist/`, and coverage output.
- [x] Task 008: Add or update ignore entries for backend `.env`, `node_modules/`, `dist/`, and coverage output if missing.

## 2. Backend Directory Scaffold

- [x] Task 009: Create the `backend/` directory.
- [x] Task 010: Create `backend/src/`.
- [x] Task 011: Create `backend/src/config/`.
- [x] Task 012: Create `backend/src/shared/`.
- [x] Task 013: Create `backend/src/shared/prisma/`.
- [x] Task 014: Create `backend/src/shared/errors/`.
- [x] Task 015: Create `backend/src/shared/logging/`.
- [x] Task 016: Create `backend/src/shared/middleware/`.
- [x] Task 017: Create `backend/src/shared/validation/`.
- [x] Task 018: Create `backend/src/shared/rate-limit/`.
- [x] Task 019: Create `backend/src/shared/testing/`.
- [x] Task 020: Create `backend/src/modules/`.
- [x] Task 021: Create `backend/src/modules/health/`.
- [x] Task 022: Create `backend/prisma/`.
- [x] Task 023: Create `backend/tests/`.
- [x] Task 024: Create `backend/tests/foundation/`.
- [x] Task 025: Verify the created folder tree matches the TDD target structure.

## 3. NPM and TypeScript Setup

- [x] Task 026: Create `backend/package.json` with the package name, version, and private flag.
- [x] Task 027: Add `dev` script for local TypeScript development with `tsx`.
- [x] Task 028: Add `build` script for TypeScript compilation.
- [x] Task 029: Add `test` script for Vitest.
- [x] Task 030: Add `test:watch` script for Vitest watch mode.
- [x] Task 031: Add `typecheck` script for TypeScript type checking without emitting files.
- [x] Task 032: Add `start` script that runs the compiled server from `dist/`.
- [x] Task 033: Add runtime dependencies in `package.json`: `express`, `cors`, `helmet`, `dotenv`, `zod`, `pino`, and `@prisma/client`.
- [x] Task 034: Add dev dependencies in `package.json`: `typescript`, `tsx`, `prisma`, `vitest`, `supertest`, `@types/node`, `@types/express`, `@types/cors`, and `@types/supertest`.
- [x] Task 035: Create `backend/tsconfig.json`.
- [x] Task 036: Configure `tsconfig.json` with `rootDir` as `src` and `outDir` as `dist`.
- [x] Task 037: Configure `tsconfig.json` for Node.js 22-compatible output.
- [x] Task 038: Enable strict TypeScript checking in `tsconfig.json`.
- [x] Task 039: Configure TypeScript to include app source and test type support as needed.
- [x] Task 040: Create `backend/vitest.config.ts`.
- [x] Task 041: Configure Vitest to run tests under `backend/tests/`.
- [x] Task 042: Configure Vitest to support TypeScript test files.
- [x] Task 043: Verify npm scripts reference local project paths and do not run DB or Prisma commands.

## 4. Environment Files and Config Loader

- [x] Task 044: Create `backend/.env.example`.
- [x] Task 045: Add `NODE_ENV=development` to `.env.example`.
- [x] Task 046: Add `PORT=3000` to `.env.example`.
- [x] Task 047: Add `DATABASE_URL=mysql://root:@localhost:3306/cloudcms` to `.env.example`.
- [x] Task 048: Add `CORS_ORIGIN=http://localhost:5173` to `.env.example`.
- [x] Task 049: Add `LOG_LEVEL=debug` to `.env.example`.
- [x] Task 050: Add `JSON_BODY_LIMIT=1mb` to `.env.example`.
- [x] Task 051: Add `URLENCODED_BODY_LIMIT=1mb` to `.env.example`.
- [x] Task 052: Add `RATE_LIMIT_DEFAULT_CAPACITY=60` to `.env.example`.
- [x] Task 053: Add `RATE_LIMIT_DEFAULT_REFILL_TOKENS=60` to `.env.example`.
- [x] Task 054: Add `RATE_LIMIT_DEFAULT_REFILL_WINDOW_SECONDS=60` to `.env.example`.
- [x] Task 055: Add `RATE_LIMIT_STORE=memory` to `.env.example`.
- [x] Task 056: Add placeholder values for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `AWS_REGION`, and `S3_BUCKET_NAME` to `.env.example` for later modules.
- [x] Task 057: Implement `backend/src/config/env.ts`.
- [x] Task 058: Load `.env` with `dotenv` in `env.ts`.
- [x] Task 059: Define a `zod` schema for all required Foundation environment variables.
- [x] Task 060: Validate `NODE_ENV` as an allowed environment value.
- [x] Task 061: Coerce and validate `PORT` as a valid positive port number.
- [x] Task 062: Validate `DATABASE_URL` as a non-empty MySQL connection string.
- [x] Task 063: Validate `CORS_ORIGIN` as a non-empty origin string.
- [x] Task 064: Validate `LOG_LEVEL` as an allowed `pino` log level.
- [x] Task 065: Validate `JSON_BODY_LIMIT` as a non-empty body-size string.
- [x] Task 066: Validate `URLENCODED_BODY_LIMIT` as a non-empty body-size string.
- [x] Task 067: Coerce and validate `RATE_LIMIT_DEFAULT_CAPACITY` as a positive number.
- [x] Task 068: Coerce and validate `RATE_LIMIT_DEFAULT_REFILL_TOKENS` as a positive number.
- [x] Task 069: Coerce and validate `RATE_LIMIT_DEFAULT_REFILL_WINDOW_SECONDS` as a positive number.
- [x] Task 070: Validate `RATE_LIMIT_STORE` as `memory` for the Foundation phase.
- [x] Task 071: Export a typed `env` object for app, server, logging, Prisma, and rate-limit code.
- [x] Task 072: Make env validation fail fast with a clear startup error when required values are missing or invalid.
- [x] Task 073: Ensure `env.ts` does not print secret values when validation fails.

## 5. Prisma and MySQL Foundation

- [x] Task 074: Create `backend/prisma/schema.prisma`.
- [x] Task 075: Add a Prisma generator block for `prisma-client-js`.
- [x] Task 076: Add a Prisma datasource block with `provider = "mysql"`.
- [x] Task 077: Configure the Prisma datasource URL to read `env("DATABASE_URL")`.
- [x] Task 078: Add a short schema comment noting that migrations are not run by app startup.
- [x] Task 079: Implement `backend/src/shared/prisma/prisma.client.ts`.
- [x] Task 080: Create a singleton Prisma client export.
- [x] Task 081: Guard against accidental multiple Prisma client instances during development if the chosen module setup requires it.
- [x] Task 082: Add a `disconnectPrisma` helper for graceful shutdown.
- [x] Task 083: Ensure Prisma client initialization does not execute migrations or schema pushes.
- [x] Task 084: Add a helper or service-level pattern for lightweight DB health checks using `SELECT 1`.
- [x] Task 085: Ensure DB health logic never reads business tables.

## 6. Shared Error Model and Response Contract

- [x] Task 086: Implement `backend/src/shared/errors/app-error.ts`.
- [x] Task 087: Add `statusCode` to `AppError`.
- [x] Task 088: Add `code` to `AppError`.
- [x] Task 089: Add `message` to `AppError`.
- [x] Task 090: Add optional `details` to `AppError`.
- [x] Task 091: Define a reusable `ErrorCode` union or enum for Foundation error codes.
- [x] Task 092: Include `VALIDATION_ERROR` in the Foundation error codes.
- [x] Task 093: Include `UNAUTHORIZED` in the Foundation error codes for later auth reuse.
- [x] Task 094: Include `FORBIDDEN` in the Foundation error codes for later authorization reuse.
- [x] Task 095: Include `NOT_FOUND` in the Foundation error codes.
- [x] Task 096: Include `CONFLICT` in the Foundation error codes.
- [x] Task 097: Include `RATE_LIMITED` in the Foundation error codes.
- [x] Task 098: Include `INTERNAL_ERROR` in the Foundation error codes.
- [x] Task 099: Include `DATABASE_ERROR` in the Foundation error codes.
- [x] Task 100: Implement `backend/src/shared/errors/error-handler.ts`.
- [x] Task 101: Map `AppError` instances to `{ success: false, error: { code, message, details } }`.
- [x] Task 102: Preserve the `AppError.statusCode` in HTTP responses.
- [x] Task 103: Map unknown errors to HTTP 500 and `INTERNAL_ERROR`.
- [x] Task 104: Hide stack traces from production HTTP responses.
- [x] Task 105: Log unexpected errors with request context when available.
- [x] Task 106: Implement `backend/src/shared/middleware/not-found.ts`.
- [x] Task 107: Make unknown routes return `NOT_FOUND` through the shared error flow.
- [x] Task 108: Ensure all error responses include the standard `success: false` shape.

## 7. Request ID, Logging, and Auth Context

- [x] Task 109: Implement `backend/src/shared/middleware/request-id.ts`.
- [x] Task 110: Generate a request ID when an incoming request has no request ID.
- [x] Task 111: Reuse an incoming request ID header if present and acceptable.
- [x] Task 112: Attach `requestId` to the request object for downstream handlers.
- [x] Task 113: Set the request ID on the response header for traceability.
- [x] Task 114: Add TypeScript request typing for `requestId`.
- [x] Task 115: Implement `backend/src/shared/logging/logger.ts`.
- [x] Task 116: Configure `pino` with `env.LOG_LEVEL`.
- [x] Task 117: Configure logger output as structured JSON.
- [x] Task 118: Add logger redaction for authorization headers, cookies, passwords, tokens, and database credentials.
- [x] Task 119: Implement `backend/src/shared/logging/request-logger.ts`.
- [x] Task 120: Log request method and path on completion.
- [x] Task 121: Log HTTP status code on completion.
- [x] Task 122: Log request latency on completion.
- [x] Task 123: Include `requestId` in request logs.
- [x] Task 124: Avoid logging full request bodies by default.
- [x] Task 125: Support optional log context fields: `tenantId`, `userId`, and `computerId`.
- [x] Task 126: Implement `backend/src/shared/middleware/auth-context.ts`.
- [x] Task 127: Add an empty auth context object for unauthenticated Foundation requests.
- [x] Task 128: Ensure auth context does not perform real JWT, RBAC, or device-token validation in Foundation.
- [x] Task 129: Add TypeScript request typing for optional auth context fields.

## 8. Express App Bootstrap and Security Middleware

- [x] Task 130: Implement `backend/src/app.ts`.
- [x] Task 131: Export a function or app instance that tests can import without starting a server.
- [x] Task 132: Mount request ID middleware before logging and routes.
- [x] Task 133: Mount request logging middleware after request ID middleware.
- [x] Task 134: Configure `helmet` globally.
- [x] Task 135: Configure CORS using `env.CORS_ORIGIN`.
- [x] Task 136: Configure JSON body parsing with `env.JSON_BODY_LIMIT`.
- [x] Task 137: Configure URL-encoded body parsing with `env.URLENCODED_BODY_LIMIT`.
- [x] Task 138: Mount the auth context placeholder before route handlers.
- [x] Task 139: Mount health routes before not-found handling.
- [x] Task 140: Mount not-found middleware after all routes.
- [x] Task 141: Mount centralized error handling after not-found middleware.
- [x] Task 142: Ensure `app.ts` does not call `listen`.
- [x] Task 143: Ensure `app.ts` does not open DB connections directly except through route/service use.

## 9. HTTP Server and Graceful Shutdown

- [x] Task 144: Implement `backend/src/server.ts`.
- [x] Task 145: Import the Express app from `app.ts`.
- [x] Task 146: Start the HTTP server on `env.PORT`.
- [x] Task 147: Log startup metadata including environment, port, and Node.js version.
- [x] Task 148: Add `SIGINT` handling.
- [x] Task 149: Add `SIGTERM` handling.
- [x] Task 150: Stop accepting new requests during shutdown.
- [x] Task 151: Close the HTTP server during shutdown.
- [x] Task 152: Disconnect Prisma during shutdown.
- [x] Task 153: Flush logger output during shutdown if the selected `pino` transport requires it.
- [x] Task 154: Exit cleanly after successful shutdown.
- [x] Task 155: Exit with failure status if shutdown throws an unrecoverable error.
- [x] Task 156: Prevent duplicate shutdown work when multiple signals arrive.
- [x] Task 157: Ensure server startup does not run Prisma CLI, migrations, seed scripts, or DB creation commands.

## 10. Validation Helper

- [x] Task 158: Implement `backend/src/shared/validation/validate-request.ts`.
- [x] Task 159: Accept an optional `body` schema.
- [x] Task 160: Accept an optional `query` schema.
- [x] Task 161: Accept an optional `params` schema.
- [x] Task 162: Parse request body with the provided body schema when present.
- [x] Task 163: Parse request query with the provided query schema when present.
- [x] Task 164: Parse request params with the provided params schema when present.
- [x] Task 165: Forward valid parsed values in a predictable request location or replace request fields consistently.
- [x] Task 166: Convert `zod` validation failures into `AppError` with code `VALIDATION_ERROR`.
- [x] Task 167: Include safe validation details without leaking sensitive payloads.
- [x] Task 168: Ensure controllers do not need to perform duplicate schema validation.

## 11. Token Bucket Rate Limiting

- [x] Task 169: Implement `backend/src/shared/rate-limit/token-bucket.ts`.
- [x] Task 170: Define a Token Bucket config type with `capacity`, `refillTokens`, and `refillWindowSeconds`.
- [x] Task 171: Track current token count per bucket.
- [x] Task 172: Track last refill timestamp per bucket.
- [x] Task 173: Refill tokens based on elapsed time.
- [x] Task 174: Cap refilled tokens at bucket capacity.
- [x] Task 175: Consume one token when a request is allowed.
- [x] Task 176: Reject consumption when no token remains.
- [x] Task 177: Define a rate-limit store interface.
- [x] Task 178: Implement an in-memory rate-limit store.
- [x] Task 179: Add stale bucket cleanup or a cleanup strategy to reduce memory growth.
- [x] Task 180: Keep the store API replaceable so Redis can be added later without rewriting route middleware.
- [x] Task 181: Implement a rate-limit middleware wrapper.
- [x] Task 182: Allow middleware callers to provide a custom key strategy.
- [x] Task 183: Allow middleware callers to override capacity and refill settings.
- [x] Task 184: Use env defaults when middleware callers do not override rate-limit settings.
- [x] Task 185: Return `RATE_LIMITED` through the standard error response when a bucket is exhausted.
- [x] Task 186: Avoid using rate limiting globally on health endpoints unless explicitly configured.
- [x] Task 187: Document recommended override strategies for auth login, tenant registration, computer registration, heartbeat, and asset upload.

## 12. Health Module

- [x] Task 188: Implement `backend/src/modules/health/health.service.ts`.
- [x] Task 189: Add an app-alive method that returns status without touching the DB.
- [x] Task 190: Add a DB health method that uses Prisma.
- [x] Task 191: Make DB health execute a lightweight query such as `SELECT 1`.
- [x] Task 192: Convert DB health failures into `DATABASE_ERROR`.
- [x] Task 193: Ensure DB health error details do not expose credentials or full connection URLs.
- [x] Task 194: Add a runtime health method.
- [x] Task 195: Include environment in runtime health.
- [x] Task 196: Include Node.js version in runtime health.
- [x] Task 197: Include uptime in runtime health.
- [x] Task 198: Include memory usage in runtime health.
- [x] Task 199: Implement `backend/src/modules/health/health.controller.ts`.
- [x] Task 200: Map app-alive service output to `{ success: true, data: ... }`.
- [x] Task 201: Map DB health service output to `{ success: true, data: ... }` on success.
- [x] Task 202: Forward DB health failures to the central error handler.
- [x] Task 203: Map runtime health service output to `{ success: true, data: ... }`.
- [x] Task 204: Implement `backend/src/modules/health/health.routes.ts`.
- [x] Task 205: Add `GET /health` route.
- [x] Task 206: Add `GET /api/health/db` route.
- [x] Task 207: Add `GET /api/health/runtime` route.
- [x] Task 208: Mount health routes in `app.ts`.
- [x] Task 209: Verify health routes are mounted before not-found middleware.

## 13. Testing Infrastructure

- [ ] Task 210: Implement `backend/src/shared/testing/test-app.ts`.
- [ ] Task 211: Ensure `test-app.ts` creates/imports the Express app without calling `listen`.
- [ ] Task 212: Add a test helper for setting required env values when needed.
- [ ] Task 213: Add a test helper or mock pattern for Prisma health checks.
- [ ] Task 214: Configure Vitest globals or imports consistently.
- [ ] Task 215: Configure test file naming conventions under `backend/tests/foundation/`.
- [ ] Task 216: Ensure test setup does not require running real migrations.

## 14. Unit Tests

- [ ] Task 217: Create `backend/tests/foundation/app-error.test.ts`.
- [ ] Task 218: Test that `AppError` stores `statusCode`.
- [ ] Task 219: Test that `AppError` stores `code`.
- [ ] Task 220: Test that `AppError` stores `message`.
- [ ] Task 221: Test that `AppError` stores optional `details`.
- [ ] Task 222: Create `backend/tests/foundation/error-handler.test.ts`.
- [ ] Task 223: Test that the error handler maps `AppError` to the standard error response.
- [ ] Task 224: Test that the error handler uses the `AppError.statusCode`.
- [ ] Task 225: Test that unknown errors become `INTERNAL_ERROR`.
- [ ] Task 226: Test that production responses do not expose stack traces.
- [ ] Task 227: Test that development logging can retain useful error context.
- [ ] Task 228: Create `backend/tests/foundation/env.test.ts`.
- [ ] Task 229: Test missing required env values fail validation.
- [ ] Task 230: Test invalid `PORT` fails validation.
- [ ] Task 231: Test invalid body limit values fail validation if the env schema enforces a pattern.
- [ ] Task 232: Test rate-limit env values are parsed into positive numbers.
- [ ] Task 233: Create `backend/tests/foundation/validate-request.test.ts`.
- [ ] Task 234: Test valid body input reaches the handler.
- [ ] Task 235: Test invalid body input returns `VALIDATION_ERROR`.
- [ ] Task 236: Test valid query input reaches the handler.
- [ ] Task 237: Test invalid query input returns `VALIDATION_ERROR`.
- [ ] Task 238: Test valid params input reaches the handler.
- [ ] Task 239: Test invalid params input returns `VALIDATION_ERROR`.
- [ ] Task 240: Create `backend/tests/foundation/token-bucket.test.ts`.
- [ ] Task 241: Test token consumption when tokens are available.
- [ ] Task 242: Test rejection when the bucket is empty.
- [ ] Task 243: Test token refill after elapsed time.
- [ ] Task 244: Test token count never exceeds capacity.
- [ ] Task 245: Test separate keys use separate buckets.
- [ ] Task 246: Test middleware returns `RATE_LIMITED` through the standard error response.
- [ ] Task 247: Test stale bucket cleanup or cleanup strategy if implemented.

## 15. API Tests

- [ ] Task 248: Create `backend/tests/foundation/health.test.ts`.
- [ ] Task 249: Test `GET /health` returns HTTP 200.
- [ ] Task 250: Test `GET /health` returns `{ success: true }`.
- [ ] Task 251: Test `GET /health` does not require a DB mock or DB connection.
- [ ] Task 252: Test `GET /api/health/runtime` returns HTTP 200.
- [ ] Task 253: Test `GET /api/health/runtime` includes environment.
- [ ] Task 254: Test `GET /api/health/runtime` includes Node.js version.
- [ ] Task 255: Test `GET /api/health/runtime` includes uptime.
- [ ] Task 256: Test `GET /api/health/runtime` includes memory data.
- [ ] Task 257: Test `GET /api/health/db` returns HTTP 200 when Prisma health succeeds.
- [ ] Task 258: Test `GET /api/health/db` returns `database: "mysql"` or equivalent MySQL status.
- [ ] Task 259: Test `GET /api/health/db` returns `DATABASE_ERROR` when Prisma health fails.
- [ ] Task 260: Test DB health error response does not expose credentials.
- [ ] Task 261: Test an unknown route returns `NOT_FOUND`.
- [ ] Task 262: Test unknown route response follows `{ success: false, error: ... }`.
- [ ] Task 263: Test each API response has a request ID header or traceable request ID context.
- [ ] Task 264: Test request logging can include method, path, status code, latency, and request ID.
- [ ] Task 265: Test JSON body limit behavior if practical in the test runtime.

## 16. Documentation and Handoff

- [ ] Task 266: Create or update `backend/README.md` with Foundation setup notes.
- [ ] Task 267: Document the backend folder structure and key file responsibilities.
- [ ] Task 268: Document npm scripts and what each script is for.
- [ ] Task 269: Document that the user/team must run `npm install` manually.
- [ ] Task 270: Document that the user/team must run Prisma CLI commands manually.
- [ ] Task 271: Document that the app does not run migrations on startup.
- [ ] Task 272: Document local XAMPP MySQL expectations: host `localhost`, port `3306`, database `cloudcms`, charset `utf8mb4`, and engine `InnoDB`.
- [ ] Task 273: Document the required `.env` values.
- [ ] Task 274: Document `JSON_BODY_LIMIT=1mb` and why file uploads should not use normal JSON body endpoints.
- [ ] Task 275: Document the default Token Bucket values and meaning.
- [ ] Task 276: Document the recommended rate-limit overrides for auth login, tenant registration, computer registration, heartbeat, and asset upload.
- [ ] Task 277: Document the health endpoints and expected response shapes.
- [ ] Task 278: Document the standard success response shape.
- [ ] Task 279: Document the standard error response shape.
- [ ] Task 280: Document that production error responses must not expose stack traces.
- [ ] Task 281: Document that logs must not include secrets or raw tokens.

## 17. Final Review and Verification

- [ ] Task 282: Verify the final `backend/` source tree matches the TDD target structure.
- [ ] Task 283: Verify `backend/package.json` uses npm scripts and contains the approved dependencies.
- [ ] Task 284: Verify `backend/tsconfig.json` targets Node.js 22-compatible output.
- [ ] Task 285: Verify `backend/vitest.config.ts` is present.
- [ ] Task 286: Verify `backend/.env.example` contains all approved Foundation env variables.
- [ ] Task 287: Verify no real `.env` file is committed.
- [ ] Task 288: Verify no secret value appears in docs, config examples, tests, or logs.
- [ ] Task 289: Verify Prisma datasource provider is `mysql`.
- [ ] Task 290: Verify app startup does not run Prisma CLI, migrations, seed scripts, DB creation, or server-side DB setup.
- [ ] Task 291: Verify `/health` does not access MySQL.
- [ ] Task 292: Verify `/api/health/db` uses a lightweight `SELECT 1`-style query.
- [ ] Task 293: Verify `/api/health/runtime` returns only safe runtime metadata.
- [ ] Task 294: Verify all success responses follow `{ success: true, data: ... }`.
- [ ] Task 295: Verify all error responses follow `{ success: false, error: { code, message, details } }`.
- [ ] Task 296: Verify every request has a request ID.
- [ ] Task 297: Verify request logs include request ID, method, path, status code, and latency.
- [ ] Task 298: Verify log redaction prevents secrets and raw tokens from being logged.
- [ ] Task 299: Verify validation failures return `VALIDATION_ERROR`.
- [ ] Task 300: Verify rate-limit failures return `RATE_LIMITED`.
- [ ] Task 301: Verify DB health failures return `DATABASE_ERROR`.
- [ ] Task 302: Verify unknown routes return `NOT_FOUND`.
- [ ] Task 303: Verify production-mode errors do not expose stack traces.
- [ ] Task 304: Verify test coverage includes env config, errors, validation, Token Bucket, health routes, and request ID behavior.
- [ ] Task 305: Ask the user/team to run dependency install and tests when they are ready.
- [ ] Task 306: Record any test failures or environment blockers in the task file before marking Foundation complete.