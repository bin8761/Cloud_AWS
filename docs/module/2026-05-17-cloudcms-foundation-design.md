# CloudCMS Foundation Module Design

Ngày: 2026-05-17

## 1. Overview

`foundation` là module nền kỹ thuật đầu tiên của backend CloudCMS. Module này không chứa nghiệp vụ như đăng nhập, quản lý tenant, máy trạm, session, usage, URL rules hay asset. Mục tiêu là tạo một khung backend ổn định để 11 module còn lại dùng chung cùng một cách tổ chức code, xử lý request, lỗi, logging, validation, rate limiting, database access, health check và test setup.

Backend được thiết kế theo hướng greenfield trong workspace hiện tại. Stack chính:

- Runtime: Node.js.
- Language: TypeScript.
- API framework: Express.
- ORM: Prisma.
- Database: MySQL.
- Local DB: XAMPP MySQL.
- AWS DB: Amazon RDS MySQL.
- Deploy target: EC2 + PM2 + Nginx.
- Observability target: structured logs, health checks, CloudWatch ở giai đoạn AWS.

## 2. Scope

`foundation` chịu trách nhiệm:

- Khởi tạo Express app và HTTP server.
- Chuẩn hóa cấu trúc route, middleware, controller, service.
- Load và validate environment variables.
- Tạo Prisma client singleton cho MySQL.
- Chuẩn hóa response lỗi.
- Gắn `requestId` cho mỗi request.
- Cấu hình structured logger.
- Cung cấp validation helper.
- Chuẩn bị auth context placeholder cho module `auth`.
- Cung cấp Token Bucket rate-limit helper.
- Tạo health endpoints tối thiểu.
- Tạo test setup để module sau viết test cùng pattern.

`foundation` không chịu trách nhiệm:

- JWT login/refresh/logout thật.
- RBAC thật.
- Tenant onboarding.
- Computer registration.
- Socket.IO realtime.
- Session/usage business flow.
- S3 upload.
- Audit log nghiệp vụ.
- CloudWatch dashboard/alarm chi tiết.

## 3. Proposed Structure

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
```

Vai trò chính:

- `app.ts`: tạo Express app, gắn middleware, route, not-found handler và error handler.
- `server.ts`: start HTTP server và xử lý graceful shutdown.
- `config/env.ts`: đọc `.env`, validate biến bắt buộc, expose config đã chuẩn hóa.
- `shared/prisma/prisma.client.ts`: tạo Prisma client singleton.
- `shared/errors/*`: định nghĩa `AppError` và error handler thống nhất.
- `shared/logging/*`: tạo logger và request logger.
- `shared/middleware/*`: request ID, auth context placeholder, not-found.
- `shared/validation/validate-request.ts`: wrapper validate body/query/params bằng schema.
- `shared/rate-limit/token-bucket.ts`: helper Token Bucket dùng lại cho auth, upload, heartbeat.
- `modules/health/*`: health endpoints tối thiểu.

## 4. Dependencies

Dependency nền:

```text
express
cors
helmet
dotenv
zod
pino
@prisma/client
prisma
typescript
tsx
vitest
supertest
```

Khuyến nghị:

- Dùng `pino` cho structured logging vì nhẹ và phù hợp log JSON.
- Dùng `vitest` + `supertest` cho test TypeScript và API test.
- Nếu team đã quen Jest hơn, có thể đổi `vitest` sang `jest` trước khi implementation plan.

## 5. Request Lifecycle

Luồng request chuẩn:

```text
HTTP request
-> requestId middleware
-> security middleware: helmet, cors, json size limit
-> request logger start
-> route-level middleware: auth placeholder, rate limit, validation
-> controller
-> service
-> Prisma / external adapter
-> response
-> request logger finish
-> error handler nếu có lỗi
```

Response thành công:

```json
{
  "success": true,
  "data": {}
}
```

Response lỗi:

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

`foundation` cần có `AppError`:

```text
AppError {
  statusCode
  code
  message
  details?
}
```

Mã lỗi nền:

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

## 6. Logging & Observability Foundation

`foundation` có logging và observability ở mức infrastructure dùng chung. Các module nghiệp vụ sẽ bổ sung log/metrics chi tiết sau.

Trong `foundation` cần có:

- `requestId` cho mỗi request.
- Structured log dạng JSON.
- Request log: method, path, status code, latency.
- Error log: error code, message, stack trace ở development.
- Context log: `tenantId`, `userId`, `computerId` nếu request đã có auth context.
- Runtime health tối thiểu: uptime, memory usage, environment.
- Hook để module sau ghi log cùng format.

Không đặt trong `foundation`:

- Audit log nghiệp vụ.
- Socket connection metrics chi tiết.
- Usage/session business metrics.
- CloudWatch dashboard/alarm chi tiết.
- PM2/Nginx runbook.

## 7. Validation

Validation dùng `zod`. Route khai báo schema cho:

- `body`
- `query`
- `params`

`validate-request.ts` parse dữ liệu trước khi vào controller. Nếu dữ liệu sai, middleware trả `VALIDATION_ERROR` theo response lỗi chung. Controller không tự validate thủ công trừ các kiểm tra nghiệp vụ thuộc service.

## 8. Rate Limiting

`foundation` cung cấp Token Bucket helper và middleware wrapper. Cấu hình cụ thể do từng module truyền vào.

Ví dụ module sau có thể dùng:

```text
auth login: IP + email
register tenant: IP
refresh token: userId/sessionId
register computer: IP + tenantCode
upload asset: userId + tenantId
heartbeat: computerId
```

Với single EC2 cho đồ án, in-memory bucket là đủ. Nếu sau này scale nhiều instance, store có thể đổi sang Redis mà không đổi API middleware.

## 9. Config & Environment

`config/env.ts` cần load và validate env khi app start. Nếu thiếu biến quan trọng, backend fail sớm.

Env nền:

```text
NODE_ENV=development
PORT=3000
DATABASE_URL=mysql://root:@localhost:3306/cloudcms
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug
```

Biến chuẩn bị cho module sau:

```text
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
AWS_REGION
S3_BUCKET_NAME
```

Không commit `.env`. Chỉ commit `.env.example`.

## 10. Prisma & MySQL

Prisma datasource:

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

Local MySQL:

```text
host: localhost
port: 3306
database: cloudcms
charset: utf8mb4
engine: InnoDB
```

Quy tắc:

- App không tự chạy migration khi start server.
- Migration/schema change do team chạy bằng Prisma CLI theo quy trình riêng.
- User sẽ chạy Prisma CLI khi cần.
- Prisma client dùng singleton, không tạo nhiều client trong runtime.
- DB health chỉ chạy query nhẹ như `SELECT 1`.

## 11. Health Checks

Health endpoints:

```text
GET /health
GET /api/health/db
GET /api/health/runtime
```

Ý nghĩa:

- `/health`: app còn sống, không query DB.
- `/api/health/db`: kiểm tra MySQL bằng query nhẹ.
- `/api/health/runtime`: trả uptime, memory usage, Node version, environment.

Sau này `realtime` có thể bổ sung active socket count và online computer count vào runtime health hoặc endpoint riêng.

## 12. Graceful Shutdown

Shutdown flow:

```text
SIGINT/SIGTERM
-> stop nhận request mới
-> close HTTP server
-> disconnect Prisma
-> flush logger nếu cần
-> exit
```

Việc này quan trọng cho EC2/PM2 vì restart app không nên để lại DB connection rác hoặc log mất dữ liệu.

## 13. Testing Strategy

Test foundation tập trung vào hành vi nền.

Health API tests:

- `GET /health` trả 200 khi app sống.
- `GET /api/health/runtime` trả uptime, memory, environment.
- `GET /api/health/db` trả 200 nếu MySQL kết nối được.
- DB health trả lỗi chuẩn nếu DB lỗi.

Error handling tests:

- Route không tồn tại trả `NOT_FOUND`.
- `AppError` trả đúng `statusCode`, `code`, `message`.
- Lỗi không kiểm soát trả `INTERNAL_ERROR`.
- Production không lộ stack trace.

Validation tests:

- Request sai schema trả `VALIDATION_ERROR`.
- Request đúng schema đi tiếp vào handler.

Request/logging tests:

- Mỗi request có `requestId`.
- Log hoặc response có đủ thông tin để trace request.

Rate limit helper tests:

- Token Bucket consume/refill đúng.
- Hết token thì trả `RATE_LIMITED`.

## 14. Acceptance Criteria

`foundation` được xem là đạt khi:

```text
Backend start được bằng npm script.
Express app có middleware nền.
Env được validate khi start.
Prisma dùng provider mysql.
DATABASE_URL trỏ được tới XAMPP MySQL local.
Không tự chạy migration khi app start.
GET /health hoạt động không cần DB.
GET /api/health/db kiểm tra MySQL bằng query nhẹ.
GET /api/health/runtime trả runtime info cơ bản.
Lỗi trả format thống nhất.
Request có requestId.
Logger có cấu trúc.
Validation helper dùng được cho route sau.
Token Bucket helper sẵn sàng cho auth/computer/upload/heartbeat.
Test setup chạy được.
```

## 15. Implementation Notes

Khi chuyển sang implementation, nên làm theo thứ tự:

```text
1. Scaffold backend TypeScript project.
2. Add Express app/server split.
3. Add env validation.
4. Add Prisma MySQL datasource and client singleton.
5. Add requestId, logger, error handler, not-found handler.
6. Add health routes.
7. Add validation helper.
8. Add Token Bucket helper.
9. Add test setup and foundation tests.
10. Update README/env example if needed.
```

Không chạy DB command, migration command hoặc Prisma CLI tự động trong quá trình implementation nếu chưa được user yêu cầu.

## 16. Open Questions

- Backend hiện được coi là greenfield trong workspace này. Nếu có source backend ở vị trí khác, cần map lại cấu trúc trước khi implement.
- Cần chốt package manager trước implementation: npm, pnpm hoặc yarn.
- Cần chốt test runner cuối cùng: khuyến nghị `vitest`, nhưng có thể đổi sang `jest` nếu team quen hơn.
- Cần chốt logger cuối cùng: khuyến nghị `pino`, nhưng có thể đổi sang `winston` nếu team đã quen.

