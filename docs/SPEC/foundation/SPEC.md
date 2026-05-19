# CloudCMS Foundation Module

## Overview

`foundation` là module nền kỹ thuật đầu tiên của backend CloudCMS. Module này tạo khung chạy chung cho toàn bộ backend: Express app, HTTP server, cấu hình môi trường, Prisma/MySQL, format lỗi, request ID, logging, validation, rate limiting, health checks, graceful shutdown và test setup.

Mục tiêu chính là giúp các module còn lại như `auth`, `tenant`, `computer`, `realtime`, `session`, `usage`, `url-rule`, `asset` và `license` dùng chung một chuẩn request lifecycle, logging, error handling, validation và database access.

Target users:

- Backend developers cần scaffold ổn định để triển khai các module nghiệp vụ.
- DevOps/deployment owner cần app có health checks, structured logs và shutdown an toàn trên EC2/PM2/Nginx.
- QA cần test setup thống nhất cho API và shared utilities.

Success criteria:

- Backend TypeScript/Express khởi động được bằng npm script sau khi scaffold.
- `GET /health` hoạt động mà không cần DB.
- `GET /api/health/db` kiểm tra MySQL bằng query nhẹ.
- `GET /api/health/runtime` trả thông tin runtime cơ bản.
- Prisma dùng provider `mysql` và `DATABASE_URL` trỏ được tới XAMPP MySQL local.
- App không tự chạy migration hoặc Prisma CLI khi start.
- Mọi lỗi trả về cùng một response schema.
- Mọi request có `requestId`.
- Logger là structured JSON log và có hook cho context `tenantId`, `userId`, `computerId`.
- Validation helper và Token Bucket helper sẵn sàng để module sau tái sử dụng.
- Test setup chạy được với API tests và utility tests.

## Product Requirements

### Core Features

- Khởi tạo Express app và HTTP server tách riêng để dễ test.
- Chuẩn hóa cấu trúc route, middleware, controller và service.
- Load `.env`, validate biến bắt buộc khi app start và fail sớm nếu thiếu cấu hình quan trọng.
- Cung cấp Prisma client singleton cho MySQL.
- Cung cấp centralized error handler và `AppError`.
- Gắn `requestId` cho mỗi request.
- Cấu hình security middleware nền: `helmet`, `cors`, JSON body size limit.
- Cấu hình structured request logging.
- Cung cấp validation middleware dựa trên `zod` cho `body`, `query`, `params`.
- Chuẩn bị `auth-context` placeholder để module `auth` bổ sung user/device context sau.
- Cung cấp Token Bucket helper có thể dùng cho login, tenant registration, computer registration, upload và heartbeat.
- Cung cấp health endpoints tối thiểu.
- Cung cấp graceful shutdown cho HTTP server, Prisma disconnect và logger flush nếu cần.
- Cung cấp test app helper để module sau viết Supertest theo cùng pattern.

### Future Scope

- Audit log nghiệp vụ.
- Socket.IO connection metrics.
- Usage/session business metrics.
- CloudWatch dashboard và alarm chi tiết.
- PM2/Nginx runbook chi tiết.
- Redis-backed rate limit store nếu backend scale nhiều EC2 instance.

### Out of Scope

- JWT login, refresh, logout thật.
- RBAC thật.
- Tenant onboarding.
- Client computer registration.
- Socket.IO realtime transport.
- Session/usage business flow.
- S3 upload.
- License enforcement.
- Database migration execution during app startup.

### Key User Flows

Foundation request flow:

```text
HTTP request
-> requestId middleware
-> helmet/cors/json size limit
-> request logger
-> route-level middleware
-> controller
-> service
-> Prisma or adapter
-> response
-> request logger completion
-> error handler if needed
```

Startup flow:

```text
Load env
-> validate env
-> create Express app
-> create HTTP server
-> listen on PORT
-> log startup metadata
```

Shutdown flow:

```text
SIGINT/SIGTERM
-> stop accepting new requests
-> close HTTP server
-> disconnect Prisma
-> flush logger if needed
-> exit
```

## Technical Architecture

### Recommended Stack

- Runtime: Node.js.
- Language: TypeScript.
- API framework: Express.
- ORM: Prisma.
- Database: MySQL.
- Local DB: XAMPP MySQL.
- AWS DB: Amazon RDS MySQL.
- Deployment target: EC2 + PM2 + Nginx.
- Logging: `pino` structured JSON logs.
- Validation: `zod`.
- Testing: `vitest` + `supertest`.
- Package manager: `npm`.

### Architecture Pattern

Recommended option: modular layered Express backend.

```text
route -> middleware -> controller -> service -> Prisma/external adapter
```

Rationale:

- Fits the approved backend design.
- Easy for a 5-person student team to split by module.
- Keeps business modules independent while sharing infrastructure through `shared/`.
- Avoids the learning overhead of a heavier framework during a sub-10-week project.

Alternatives considered:

- NestJS: stronger module structure and decorators, but higher learning overhead and larger setup cost.
- Minimal Express route handlers only: faster initially, but weak separation and harder to maintain across 10+ backend modules.

### API Endpoints

Health endpoints:

```text
GET /health
GET /api/health/db
GET /api/health/runtime
```

Success response schema:

```json
{
  "success": true,
  "data": {}
}
```

Error response schema:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu gửi lên không hợp lệ",
    "details": {}
  }
}
```

Foundation error codes:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
RATE_LIMITED
INTERNAL_ERROR
DATABASE_ERROR
```

### Data Model

Foundation does not introduce business tables. It configures Prisma for MySQL and prepares database access for later modules.

Prisma datasource:

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

Local MySQL assumptions:

```text
host: localhost
port: 3306
database: cloudcms
charset: utf8mb4
engine: InnoDB
```

Database rules:

- App must not run migration automatically on startup.
- Prisma CLI commands are run manually by the user/team when needed.
- Prisma client must be a singleton.
- DB health uses a lightweight query such as `SELECT 1`.

### Configuration

Required foundation env:

```text
NODE_ENV=development
PORT=3000
DATABASE_URL=mysql://root:@localhost:3306/cloudcms
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug
```

Prepared env for later modules:

```text
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
AWS_REGION
S3_BUCKET_NAME
```

Rules:

- Commit `.env.example`, never commit `.env`.
- Validate env at startup with a typed schema.
- Fail startup when required foundation config is missing or malformed.

### Security

Foundation must provide infrastructure-level security defaults:

- `helmet` enabled.
- CORS restricted by `CORS_ORIGIN`.
- JSON payload size limit configured.
- All route inputs validated with `zod` through a shared middleware.
- Token Bucket helper available for module-specific rate limiting.
- Error handler must avoid leaking stack traces in production.
- Logs must not include secrets or raw sensitive tokens.

Module-specific security remains out of scope for foundation:

- JWT issuance and refresh rotation belong to `auth`.
- RBAC belongs to `auth` and authorization middleware.
- Client device token verification belongs to `auth` plus `computer`.
- Audit logs belong to the later audit/security flow.

### Observability

Foundation observability requirements:

- Every request receives a `requestId`.
- Request logs include method, path, status code and latency.
- Error logs include error code, message and stack trace in development.
- Context logs support optional `tenantId`, `userId`, `computerId` once auth context exists.
- Runtime health includes uptime, memory usage, Node version and environment.
- Log format must be stable so CloudWatch can ingest JSON logs later.

## System Maps

### Architecture Diagram

```text
Client / Admin / Health Probe
          |
          v
   Express HTTP App
          |
          v
 Shared Middleware Layer
 requestId | security | logger | auth-context | validation | rate-limit
          |
          v
 Route + Controller Layer
          |
          v
 Service Layer
          |
          v
 Prisma Singleton -> MySQL
```

### Module Boundary Map

```text
foundation
  owns:
    app/server bootstrap
    env config
    error contract
    logging foundation
    validation helper
    rate-limit helper
    Prisma singleton
    health module
    test app helper

auth and later modules
  use:
    auth-context extension point
    AppError
    validateRequest
    tokenBucket middleware
    logger
    prisma client
```

### Health Flow

```text
GET /health
-> controller
-> return app alive without DB access

GET /api/health/db
-> controller
-> health service
-> Prisma executes SELECT 1
-> return DB status or DATABASE_ERROR

GET /api/health/runtime
-> controller
-> runtime service
-> return uptime, memory, node version, environment
```

## File Structure

Target structure:

```text
backend/
  src/
    app.ts
    server.ts
    config/
      env.ts
    shared/
      prisma/
        prisma.client.ts
      errors/
        app-error.ts
        error-handler.ts
      logging/
        logger.ts
        request-logger.ts
      middleware/
        request-id.ts
        not-found.ts
        auth-context.ts
      validation/
        validate-request.ts
      rate-limit/
        token-bucket.ts
      testing/
        test-app.ts
    modules/
      health/
        health.routes.ts
        health.controller.ts
        health.service.ts
  prisma/
    schema.prisma
  tests/
    foundation/
      health.test.ts
      error-handler.test.ts
      validate-request.test.ts
      token-bucket.test.ts
  .env.example
  package.json
  tsconfig.json
  vitest.config.ts
```

File responsibilities:

- `src/app.ts`: create Express app, mount middleware, routes, not-found handler and error handler.
- `src/server.ts`: start HTTP server and handle graceful shutdown.
- `src/config/env.ts`: load and validate env, expose typed config.
- `src/shared/prisma/prisma.client.ts`: create Prisma client singleton.
- `src/shared/errors/*`: define `AppError` and centralized error handling.
- `src/shared/logging/*`: create logger and request logger middleware.
- `src/shared/middleware/*`: request ID, auth context placeholder and not-found handler.
- `src/shared/validation/validate-request.ts`: validate `body`, `query`, `params` with `zod`.
- `src/shared/rate-limit/token-bucket.ts`: reusable Token Bucket implementation.
- `src/shared/testing/test-app.ts`: create app instance for API tests.
- `src/modules/health/*`: health routes, controller and service.

## Development Phases

- [ ] Phase 1: Scaffold backend TypeScript project with Express, TypeScript config, npm scripts and `.env.example`.
- [ ] Phase 2: Add `app.ts` and `server.ts` split with graceful shutdown hooks.
- [ ] Phase 3: Add env loading and validation in `config/env.ts`.
- [ ] Phase 4: Add Prisma MySQL datasource and singleton Prisma client without running migrations automatically.
- [ ] Phase 5: Add `AppError`, centralized error handler and not-found handler.
- [ ] Phase 6: Add request ID middleware and structured `pino` logger.
- [ ] Phase 7: Add health module with `/health`, `/api/health/db` and `/api/health/runtime`.
- [ ] Phase 8: Add `zod` validation helper for route `body`, `query` and `params`.
- [ ] Phase 9: Add Token Bucket helper and middleware wrapper.
- [ ] Phase 10: Add test app helper and foundation tests with `vitest` + `supertest`.
- [ ] Phase 11: Update README/setup notes if needed for XAMPP MySQL, env config and test usage.

## Testing Plan

Health API tests:

- `GET /health` returns 200 when app is alive and does not require DB.
- `GET /api/health/runtime` returns uptime, memory, Node version and environment.
- `GET /api/health/db` returns 200 when MySQL connection is available.
- DB health returns a standard error response when the DB check fails.

Error handling tests:

- Unknown route returns `NOT_FOUND`.
- `AppError` returns correct status code, code, message and details.
- Unhandled errors return `INTERNAL_ERROR`.
- Production mode does not expose stack traces.

Validation tests:

- Invalid request schema returns `VALIDATION_ERROR`.
- Valid request schema reaches the handler.

Logging/request tests:

- Every request has a `requestId`.
- Response or logs include enough information to trace the request.

Rate-limit tests:

- Token Bucket consumes tokens correctly.
- Token Bucket refills tokens correctly.
- Exhausted bucket returns `RATE_LIMITED` through middleware.

## Acceptance Criteria

- Backend start script exists after scaffold.
- Express app has the approved foundation middleware.
- Env validation runs at startup.
- Prisma datasource uses `provider = "mysql"`.
- `DATABASE_URL` supports XAMPP MySQL local.
- Server startup does not run DB migration or Prisma CLI.
- `/health` works without DB access.
- `/api/health/db` checks MySQL using a lightweight query.
- `/api/health/runtime` returns basic runtime information.
- Error responses follow the shared schema.
- Requests have `requestId`.
- Logger outputs structured logs.
- Validation helper can be reused by later routes.
- Token Bucket helper is ready for auth, computer registration, upload and heartbeat use cases.
- Foundation tests can be run through the selected test runner.

## Open Questions

- None for source location and foundation stack at this time.
- Confirmed decisions:
  - Backend source will be implemented in this workspace.
  - Package manager is `npm`.
  - Test runner is `vitest`.
  - Logger is `pino`.

---

## References

- Source design doc: `docs/module/2026-05-17-cloudcms-foundation-design.md`.
- Backend-wide design: `docs/plans/2026-05-17-cloudcms-backend-design.md`.
- No supplemental `SPEC/*.md` lookup files are required for this foundation SPEC because endpoint and schema references are small enough to keep inline.
