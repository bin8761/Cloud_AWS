# CloudCMS Backend Design Doc

Ngày: 2026-05-17

## 1. Scope & Architecture

Backend CloudCMS là trung tâm nghiệp vụ của hệ thống. Backend nhận request từ web admin, nhận đăng ký và heartbeat từ client PC, phát realtime command qua Socket.IO, lưu dữ liệu vào MySQL qua Prisma, và tích hợp S3/CloudWatch khi deploy AWS.

Tài liệu này đi sâu vào backend dựa trên `docs/plans/2026-05-17-cloudcms-design.md`. Sau tài liệu backend-wide này, từng module quan trọng có thể có module-level TDD riêng trước khi triển khai.

Stack backend:

- Runtime: Node.js.
- Language: TypeScript.
- API framework: Express.
- Realtime: Socket.IO.
- ORM: Prisma.
- Database: MySQL.
- Prisma datasource provider: `mysql`.
- Local database: XAMPP MySQL, ví dụ `mysql://root:@localhost:3306/cloudcms`.
- AWS database: Amazon RDS MySQL.
- Auth: JWT access token + refresh token.
- Upload/assets: S3 ở production, local adapter ở dev nếu cần.
- Deploy: EC2 + PM2 + Nginx.
- Observability: structured logs, health checks, CloudWatch.

Kiến trúc thư mục đề xuất:

```text
backend/
  src/
    app/
    config/
    modules/
      auth/
      tenants/
      users/
      computers/
      realtime/
      sessions/
      usage/
      url-rules/
      assets/
      subscriptions/
      audit/
      health/
    shared/
      middleware/
      errors/
      validation/
      logging/
      rate-limit/
      prisma/
```

Luồng xử lý REST:

```text
Route -> Middleware -> Controller -> Service -> Prisma/External Adapter
```

Luồng xử lý Socket.IO:

```text
Socket Auth -> Room Join -> Event Handler -> Service -> DB/Emit Event
```

Nguyên tắc thiết kế:

- Mọi dữ liệu nghiệp vụ phải scope bằng `tenantId`.
- Controller mỏng, logic chính nằm trong service.
- Prisma access đi qua service/repository rõ ràng, không query tùy tiện trong route.
- REST API và Socket.IO dùng chung business service để tránh lệch logic.
- Core flow chạy trước: auth/tenant -> computer register -> heartbeat/socket -> session -> usage.
- URL rules, assets, license được thiết kế trong tài liệu này nhưng triển khai sau core flow.

## 2. Module Boundaries

Backend gồm một nền kỹ thuật chung và mười hai module nghiệp vụ/vận hành.

| Phần | Loại | Trách nhiệm chính |
| --- | --- | --- |
| `foundation` | Shared technical foundation | Khởi tạo project, Express app, config/env, Prisma singleton, error handling, request ID, logging, validation helper, rate-limit helper, test setup, health tối thiểu. |
| `auth` | Business module | Register tenant ban đầu, login, refresh token, logout, lấy current user. |
| `tenants` | Business module | Quản lý tenant/quán, tenant code, trạng thái hoạt động, soft delete nếu cần. |
| `users` | Business module | Quản lý shop admin/staff, role, khóa/mở user, danh sách user trong tenant. |
| `computers` | Business module | Client đăng ký máy bằng tenant code + MAC, cấp device token, quản lý thông tin máy. |
| `realtime` | Realtime module | Socket.IO auth, rooms theo tenant/computer, heartbeat, online/offline, emit events. |
| `sessions` | Business module | Mở/đóng phiên sử dụng, chống double active session, gửi lệnh lock/unlock cho client. |
| `usage` | Business module | Ghi usage, tổng hợp thống kê, dashboard query 7/30 ngày, `DailyUsageSummary`. |
| `url-rules` | Business module | Luật chặn/cho phép URL theo tenant hoặc nhóm máy, publish policy update. |
| `assets` | Integration module | Metadata lock-screen/slideshow, upload adapter local/S3, signed URL nếu cần. |
| `subscriptions` | Business module | License/gói dịch vụ, hạn dùng, giới hạn số máy, cảnh báo hết hạn. |
| `audit` | Cross-cutting module | Ghi log thao tác quan trọng: login, tạo user, start/stop session, đổi license, upload asset. |
| `health` | Operations module | Liveness, DB health, runtime metrics như memory, uptime, active socket count. |

`foundation` có cấu trúc riêng:

```text
src/
  app.ts
  server.ts
  config/
    env.ts
  shared/
    prisma/
    errors/
    validation/
    logging/
    middleware/
    rate-limit/
    testing/
```

Các module nghiệp vụ theo mẫu:

```text
src/modules/<module-name>/
  <module-name>.routes.ts
  <module-name>.controller.ts
  <module-name>.service.ts
  <module-name>.schema.ts
  <module-name>.types.ts
  <module-name>.test.ts
```

Thứ tự ưu tiên triển khai:

```text
foundation
-> auth/tenants/users
-> computers
-> realtime
-> sessions
-> usage
-> url-rules/assets/subscriptions
-> audit/health/security hardening
```

Lưu ý: `audit`, `health`, `logging`, `rate-limit` không nên đợi cuối mới làm hoàn toàn. `foundation` phải chuẩn bị hook sẵn, sau đó từng module gắn vào dần.

## 3. Database Model & Query Design

Backend dùng MySQL + Prisma. Local development dùng XAMPP MySQL; AWS staging/production dùng Amazon RDS MySQL. Thiết kế DB ưu tiên tenant isolation, core flow chạy ổn, và query dashboard không chậm khi dữ liệu tăng.

Entity chính:

| Entity | Vai trò |
| --- | --- |
| `Tenant` | Quán/net shop, có `code`, `name`, `status`, `deletedAt`. |
| `User` | Tài khoản admin/staff, thuộc tenant hoặc super admin toàn hệ thống. |
| `RefreshToken` | Lưu refresh token đã hash, hỗ trợ logout/revoke. |
| `Computer` | Máy trạm, `tenantId`, `macAddress`, `name`, `status`, `lastSeenAt`. |
| `ComputerCredential` | Device token đã hash cho client PC sau khi đăng ký. |
| `Session` | Phiên sử dụng máy, start/end time, trạng thái active/ended. |
| `UsageLog` | Log usage chi tiết phục vụ thống kê/lịch sử. |
| `DailyUsageSummary` | Bảng tổng hợp theo ngày để dashboard query nhanh. |
| `UrlRule` | Luật chặn/cho phép URL theo tenant. |
| `LockScreenAsset` | Metadata ảnh/slideshow, file thật nằm local/S3. |
| `Subscription` | License/gói dịch vụ, hạn dùng, giới hạn số máy. |
| `AuditLog` | Log thao tác quan trọng của admin/system. |

Nguyên tắc bắt buộc:

- Mọi bảng nghiệp vụ thuộc quán phải có `tenantId`.
- Mọi query admin phải scope theo `tenantId`, trừ `super_admin`.
- Dùng UTC trong DB.
- Dùng `utf8mb4` để lưu tiếng Việt đầy đủ.
- Dùng InnoDB để có transaction và foreign key.
- Không trả toàn bộ bảng lớn như `Session`, `UsageLog`, `AuditLog`; luôn có pagination.
- Prisma query dùng `select/include` có kiểm soát để tránh N+1.
- Dùng soft delete cho `Tenant`, `User`, `Computer`, `UrlRule` nếu cần giữ lịch sử.

Index/constraint chính:

```text
Tenant.code unique
User(tenantId, email) unique
Computer(tenantId, macAddress) unique
Computer(tenantId, status)
Computer(tenantId, lastSeenAt)
Session(tenantId, computerId, startedAt)
Session(tenantId, status)
UsageLog(tenantId, createdAt)
UsageLog(tenantId, computerId, createdAt)
DailyUsageSummary(tenantId, date)
DailyUsageSummary(tenantId, computerId, date) unique
UrlRule(tenantId, enabled)
Subscription(tenantId, status, expiresAt)
AuditLog(tenantId, createdAt)
```

Transaction bắt buộc cho các flow:

- Register tenant: tạo `Tenant` + shop admin đầu tiên + subscription mặc định nếu cần.
- Register computer: kiểm tra tenant/license + tạo/update `Computer` + cấp credential.
- Start session: kiểm tra máy thuộc tenant + không có active session + tạo `Session` + emit realtime.
- End session: đóng `Session` + ghi `UsageLog` + cập nhật `DailyUsageSummary`.
- Upload asset: upload file thành công trước, rồi mới ghi metadata DB.

Active session cần chống race condition. Thiết kế nên có logic transaction và constraint/guard để một `computerId` không có hai session `ACTIVE` cùng lúc.

Dashboard mặc định query trong 7 hoặc 30 ngày. Với dữ liệu nhỏ có thể đọc từ `Session/UsageLog`, nhưng vẫn nên có `DailyUsageSummary` để tránh dashboard chậm về sau.

## 4. API & Realtime Contracts

Backend expose REST API dưới prefix `/api`. Socket.IO nằm trong module `realtime`, dùng cho kết nối realtime, room, heartbeat và command. Business logic vẫn nằm trong service của từng module nghiệp vụ.

### REST API Groups

| Group | Endpoint chính | Ghi chú |
| --- | --- | --- |
| `auth` | `POST /api/auth/register-tenant`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` | Auth/onboarding admin. |
| `tenants` | `GET /api/tenants`, `GET /api/tenants/:id`, `PATCH /api/tenants/:id` | Super admin hoặc tenant admin tùy quyền. |
| `users` | `POST /api/users`, `GET /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id` | Quản lý staff trong tenant. |
| `computers` | `POST /api/computers/register`, `GET /api/computers`, `GET /api/computers/:id`, `PATCH /api/computers/:id` | Register client và quản lý máy. |
| `sessions` | `POST /api/sessions/start`, `POST /api/sessions/:id/end`, `GET /api/sessions` | Start/stop/lịch sử phiên. |
| `usage` | `POST /api/usage/sync`, `GET /api/usage/summary`, `GET /api/usage/logs` | Client sync usage, admin xem stats. |
| `url-rules` | `POST /api/url-rules`, `GET /api/url-rules`, `PATCH /api/url-rules/:id`, `DELETE /api/url-rules/:id` | Quản lý policy URL. |
| `assets` | `POST /api/assets`, `GET /api/assets`, `DELETE /api/assets/:id` | Upload/list/delete lock-screen/slideshow. |
| `subscriptions` | `GET /api/subscriptions/current`, `PATCH /api/subscriptions/:id` | License/gói dịch vụ. |
| `health` | `GET /health`, `GET /api/health/db`, `GET /api/health/runtime` | Liveness, DB, runtime. |

API list phải có pagination:

```text
?page=1&pageSize=20&sort=createdAt:desc
```

Response lỗi thống nhất:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Realtime Placement

```text
src/modules/realtime/
  realtime.server.ts
  realtime.auth.ts
  realtime.rooms.ts
  realtime.handlers.ts
  realtime.gateway.ts
  realtime.types.ts
```

- `realtime.server.ts`: khởi tạo Socket.IO.
- `realtime.auth.ts`: xác thực admin JWT hoặc client device token.
- `realtime.rooms.ts`: quản lý `tenant:<tenantId>` và `computer:<computerId>`.
- `realtime.handlers.ts`: nhận event từ web admin/client PC.
- `realtime.gateway.ts`: hàm emit dùng chung cho module khác.

### Socket.IO Contracts

Socket auth tách hai loại:

- Web admin socket: JWT admin access token.
- Client PC socket: device token.

Rooms:

```text
tenant:<tenantId>
computer:<computerId>
```

Events client PC emit:

```text
client:heartbeat
client:session-ended
client:usage-sync
```

Events web admin emit:

```text
admin:watch-tenant
admin:command:start-session
admin:command:end-session
admin:command:refresh-policy
```

Backend emit tới web admin:

```text
computer:online
computer:offline
session:started
session:ended
usage:updated
policy:updated
asset:updated
subscription:updated
```

Backend emit tới client PC:

```text
session:start
session:stop
policy:update
lockscreen:update
client:restart
```

Nguyên tắc:

- Socket.IO là transport layer, không chứa business rules chính.
- Business logic nằm trong `sessions.service`, `computers.service`, `usage.service`, v.v.
- REST controller và Socket handler có thể gọi cùng service.
- Web admin chỉ nhận event trong tenant của mình.
- Client PC chỉ join được `computer:<computerId>` của chính nó.
- Command start/stop session phải kiểm tra quyền, tenant, trạng thái máy và active session trước khi emit.

## 5. Security, Authentication, Rate Limiting & Audit

Security của backend tập trung vào bốn điểm: biết ai đang gọi hệ thống, biết máy trạm nào đang kết nối, không để tenant này đọc dữ liệu tenant khác, và ghi lại thao tác quan trọng.

### Authentication

CloudCMS có hai kiểu xác thực.

Admin/staff đăng nhập bằng email và password:

```text
Web admin gửi email/password
-> Backend kiểm tra User
-> Backend so sánh password với password hash trong DB
-> Nếu đúng, backend trả access token + refresh token
-> Web admin dùng access token để gọi API
```

Access token là vé ngắn hạn, dùng trong request:

```text
Authorization: Bearer <accessToken>
```

Refresh token dùng để xin access token mới khi access token hết hạn. Refresh token phải lưu DB ở dạng hash để backend có thể revoke khi logout.

Client PC không dùng email/password. Máy trạm đăng ký bằng:

```text
tenantCode + macAddress
```

Sau khi backend xác nhận tenant hợp lệ và license còn cho phép thêm máy, backend tạo/cập nhật `Computer` và cấp `deviceToken`.

Từ lần sau, client PC dùng `deviceToken` để:

```text
gửi heartbeat
sync usage
kết nối Socket.IO
nhận lệnh session:start/session:stop
```

Backend không chỉ tin MAC address vì MAC có thể bị giả. `deviceToken` là bằng chứng chính để xác minh máy trạm đã đăng ký.

### Authorization & Tenant Isolation

Role:

```text
super_admin
shop_admin
staff
```

Quy tắc:

- `super_admin` quản lý toàn hệ thống.
- `shop_admin` quản lý tenant của mình.
- `staff` chỉ dùng chức năng được cấp quyền.
- Mọi query nghiệp vụ phải scope theo `tenantId`, trừ case `super_admin`.
- Middleware auth gắn `userId`, `role`, `tenantId` vào request context.
- Service layer vẫn phải kiểm tra tenant ownership, không chỉ tin controller.

### Rate Limiting

Dùng Token Bucket.

| Nhóm | Bucket key | Capacity | Refill |
| --- | --- | ---: | ---: |
| Login | IP + email | 5 | 1 token / 3 phút |
| Register tenant | IP | 3 | 1 token / 20 phút |
| Refresh token | userId/sessionId | 30 | 1 token / 2 giây |
| Register computer | IP + tenantCode | 20 | 1 token / 30 giây |
| Upload asset | userId + tenantId | 10 | 1 token / 6 giây |
| Admin API thường | userId + tenantId | 120 | 2 token / giây |
| Health/public API | IP | 60 | 1 token / giây |
| Socket heartbeat | computerId | 3 | 1 token / 10 giây |
| Socket admin command | userId + tenantId | 60 | 1 token / giây |

Single EC2 dùng in-memory store được cho đồ án. Nếu scale nhiều instance thì chuyển sang Redis.

### Input, Secret & File Security

- Validate body/query/params bằng schema.
- Giới hạn JSON body size.
- Upload asset phải giới hạn MIME, extension, file size.
- S3 bucket không public toàn bộ.
- Production dùng HTTPS/WSS.
- Không commit `.env`.
- `JWT_SECRET`, `DATABASE_URL`, AWS keys nằm trong environment.

### Audit Log

Ghi audit cho:

```text
login success/failure
register tenant
create/update/delete user
register/update computer
start/end session
update URL rules
upload/delete asset
change subscription/license
serious rate limit hit
auth/tenant violation
```

Audit log nên chứa:

```text
tenantId
actorUserId hoặc computerId
action
targetType
targetId
ipAddress
userAgent
metadata JSON
createdAt
```

## 6. Observability, Health & Operations

Backend cần trả lời nhanh ba câu hỏi khi xảy ra lỗi: server còn sống không, DB/socket có ổn không, và lỗi nằm ở request/module nào.

### Structured Logging

Backend ghi log dạng có cấu trúc. Mỗi request nên có:

```text
requestId
tenantId
userId hoặc computerId
method
path
statusCode
latencyMs
errorCode nếu có
```

Các event quan trọng cần log:

```text
auth failure
rate limit hit
tenant violation
Socket.IO connect/disconnect
heartbeat timeout
session start/end
Prisma/DB error
S3 upload failure
JWT/validation error
```

### Health Checks

Backend có ba endpoint health:

```text
GET /health
GET /api/health/db
GET /api/health/runtime
```

Ý nghĩa:

- `/health`: app còn sống, không cần query DB.
- `/api/health/db`: kiểm tra DB bằng query nhẹ.
- `/api/health/runtime`: trả uptime, memory usage, active socket count.

### Runtime Monitoring

Cần theo dõi:

```text
Node.js memory: rss, heapUsed, heapTotal
process uptime
active socket count
online computer count
heartbeat timeout count
API latency
4xx/5xx count
DB connection/query error
PM2 restart count
```

Mục tiêu là phát hiện sớm memory leak, DB lỗi hoặc socket bị treo.

### CloudWatch & EC2 Operations

Khi deploy AWS:

- PM2 logs, backend logs và Nginx logs nên đẩy lên CloudWatch Logs.
- CloudWatch dashboard tối thiểu theo dõi EC2 CPU/RAM/disk, backend error rate, restart count.
- Alarm nên có cho memory cao, disk gần đầy, backend health fail, 5xx tăng bất thường.

### Operations Runbook

Backend doc yêu cầu có runbook cho:

```text
deploy backend lên EC2
restart PM2
xem log CloudWatch
kiểm tra /health và /api/health/db
rollback backend
chạy migration deploy
backup/restore DB
xử lý client không kết nối Socket.IO
xử lý upload S3 lỗi
```

### AWS Smoke Test

Sau mỗi lần deploy staging/production, cần kiểm tra:

```text
EC2 health OK
backend /health OK
RDS query OK
Socket.IO connect OK
S3 upload/list asset OK
CloudWatch có log mới
```

## 7. Testing, Acceptance Criteria & Delivery Phases

Backend không nên đợi xong hết mới test. Mỗi module phải có test cơ bản ngay khi triển khai để tránh lỗi tenant isolation, auth và session flow.

### Testing Strategy

| Nhóm test | Mục tiêu |
| --- | --- |
| Unit tests | Test service/helper riêng lẻ: token, password hash, rate limit, session rules. |
| API tests | Dùng Supertest kiểm tra endpoint: auth, users, computers, sessions, usage. |
| Integration tests | Kiểm tra flow nhiều bước: register tenant -> login -> register computer -> start session. |
| Realtime tests | Kiểm tra socket auth, heartbeat, online/offline, session event. |
| Security tests | Kiểm tra tenant isolation, RBAC, invalid token, rate limit, device token. |

Các test bắt buộc cho backend core:

```text
register tenant creates Tenant + shop admin
login returns access token + refresh token
refresh token can issue new access token
logout revokes refresh token
shop admin cannot access another tenant's data
client PC can register with tenantCode + macAddress
client PC receives device token
heartbeat updates lastSeenAt and online status
admin can start session for available computer
cannot start two active sessions for same computer
end session writes UsageLog and updates DailyUsageSummary
web admin receives online/offline/session events
```

### Backend Acceptance Criteria

Backend được xem là đạt khi:

```text
Auth + tenant onboarding chạy được
Admin/staff RBAC hoạt động đúng
Tenant isolation được test
Client PC register và nhận device token
Heartbeat cập nhật online/offline
Socket.IO rooms/events hoạt động theo tenant/computer
Start/end session chạy đúng và chống double active session
UsageLog và DailyUsageSummary được ghi đúng
URL rules/assets/subscription có API và data model rõ
Health checks hoạt động
Structured logs có requestId/tenantId/userId/computerId
Rate limit hoạt động ở endpoint nhạy cảm
AWS staging có thể chạy backend với RDS
```

### Delivery Phases

Backend triển khai theo thứ tự:

```text
Phase 1: foundation + Prisma schema + health
Phase 2: auth + tenants + users + RBAC
Phase 3: computers + device token + heartbeat
Phase 4: realtime Socket.IO + online/offline rooms/events
Phase 5: sessions + usage + DailyUsageSummary
Phase 6: url-rules + assets + subscriptions
Phase 7: security hardening + observability + AWS staging
Phase 8: integration QA + runbook + demo hardening
```

### Module Deep-Dive Plan

Sau khi Backend Design Doc tổng quan được viết xong, ta sẽ đi sâu từng module theo thứ tự ưu tiên:

```text
1. foundation
2. auth + tenants + users
3. computers + device identity
4. realtime heartbeat/socket
5. sessions
6. usage/dashboard
7. url-rules
8. assets/S3
9. subscriptions/license
10. audit/security hardening
11. health/operations
```

Mỗi module deep-dive sẽ có:

```text
scope
data model cụ thể
API/event cụ thể
service flow
error cases
security checks
test cases
task breakdown
```

## 8. Open Questions

- Backend hiện được thiết kế theo hướng greenfield trong `backend/`. Nếu có source backend hiện hữu ở vị trí khác, cần map lại cấu trúc file trước khi viết implementation plan.
- Cần quyết định bước tiếp theo là viết implementation plan tổng thể cho backend hay viết module-level TDD trước cho `foundation`.
