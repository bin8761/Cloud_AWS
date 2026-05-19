# CloudCMS Design Doc

Ngày: 2026-05-17

## 1. Product Scope

CloudCMS là hệ thống quản lý máy trạm/quán net. Hệ thống gồm client PC chạy fullscreen, web admin, backend tập trung, database MySQL, realtime Socket.IO, license/subscription, URL rules, thống kê usage, lock-screen/slideshow và triển khai trên AWS.

Đồ án được thiết kế cho nhóm 5 người, thời gian dưới 10 tuần. Phạm vi là làm đầy đủ các chức năng chính trong `PROJECT_HANDOFF.md`, không rút gọn thành MVP nhỏ. Mobile app là phần tùy chọn/tối giản nếu còn thời gian.

Mục tiêu demo cuối:

- Admin tạo tenant/quán và đăng nhập web admin.
- Client PC đăng ký bằng tenant code + MAC.
- Web admin thấy trạng thái máy online/offline realtime.
- Admin mở/đóng phiên sử dụng và client phản hồi đúng.
- Usage được ghi nhận và hiển thị thống kê.
- URL rules, license/subscription, lock-screen/slideshow hoạt động ở mức demo được.
- Hệ thống chạy trên AWS với ít nhất 5 dịch vụ: EC2, RDS MySQL, S3, CloudFront, CloudWatch.

## 2. Architecture

CloudCMS gồm 4 khối chính:

### Backend API

- Node.js, Express, Socket.IO.
- Prisma ORM kết nối MySQL.
- Prisma datasource dùng `provider = "mysql"`.
- Local `DATABASE_URL` trỏ tới XAMPP MySQL, ví dụ `mysql://root:@localhost:3306/cloudcms`.
- AWS `DATABASE_URL` trỏ tới Amazon RDS MySQL.
- Phục vụ REST API, realtime events, auth, tenant, computer, session, usage, license, URL rules, assets và health checks.
- Chạy trên AWS EC2 bằng PM2, phía trước có Nginx reverse proxy.

### Web Admin

- React, Vite, TypeScript.
- Cho phép admin quản lý tenant, user, máy trạm, phiên sử dụng, thống kê, URL rules, license và lock-screen/slideshow.
- Build static và đưa lên S3, phân phối qua CloudFront.

### Client PC & Watchdog

- Client PC dùng WPF .NET, chạy fullscreen/màn hình khóa.
- Đăng ký máy bằng tenant code + MAC address.
- Gửi heartbeat và nhận lệnh realtime qua Socket.IO.
- Watchdog giữ client sống và tự mở lại nếu client bị tắt.

### AWS Infrastructure

- EC2: backend runtime, Nginx, PM2.
- RDS MySQL: database chính trên AWS.
- S3: web static, lock-screen/slideshow assets, installer/downloads.
- CloudFront: phân phối web admin, static assets và downloads.
- CloudWatch: logs, metrics, dashboard/alarm cơ bản.

Chiến lược môi trường:

- Dev hằng ngày chạy local: backend local, XAMPP MySQL, web admin Vite, client trỏ về local/LAN.
- AWS staging từ khoảng tuần 3-4 để test deploy sớm.
- Demo cuối ưu tiên chạy trên AWS, có local fallback nếu mạng hoặc cloud gặp sự cố.

## 3. Repository Structure

Cấu trúc repo bám theo `PROJECT_HANDOFF.md`:

| Đường dẫn | Vai trò |
| --- | --- |
| `backend/` | API Node.js, Express, Prisma, Socket.IO, upload lock-screen |
| `web-admin/` | React/Vite/TypeScript admin UI |
| `client-pc/` | WPF client, Watchdog, installer |
| `mobile-app/` | Flutter dashboard tối giản, tùy chọn |
| `deploy/` | Script deploy AWS, Nginx, PM2, S3/CloudFront nếu cần |
| `downloads/` | Installer client và file tải xuống |
| `docs/` | Runbook, checklist, báo cáo, design doc |

## 4. Modules & Team Ownership

Dự án làm theo hướng end-to-end theo phase, nhưng vẫn có người phụ trách rõ từng mảng.

| Vai trò | Trách nhiệm |
| --- | --- |
| Người 1: Backend Lead | API, Prisma schema, auth, tenant, computer, session, license, URL rules |
| Người 2: Web Admin Lead | React UI, dashboard, bảng máy trạm, form quản lý, upload nội dung |
| Người 3: Client PC Lead | WPF client, fullscreen lock screen, heartbeat, Socket.IO, Watchdog |
| Người 4: AWS/DevOps Lead | EC2, RDS, S3, CloudFront, CloudWatch, deploy script, env |
| Người 5: QA/Docs/Integration Lead | Test case, tài liệu, demo script, kiểm thử end-to-end, mobile optional |

Mỗi phase phải có kết quả tích hợp chạy được giữa backend, web/client và AWS staging khi phù hợp. Không để từng phần làm riêng quá lâu rồi cuối kỳ mới ghép.

## 5. Data Model & Business Flows

### Entity chính

- `Tenant`: thông tin quán, tenant code, trạng thái hoạt động.
- `User`: tài khoản super admin, shop admin, staff.
- `Computer`: máy trạm, MAC address, tên máy, trạng thái online/offline, tenant.
- `Session`: phiên sử dụng máy, thời gian bắt đầu/kết thúc, trạng thái.
- `UsageLog`: log sử dụng phục vụ thống kê.
- `UrlRule`: luật chặn/cho phép URL theo tenant hoặc nhóm máy.
- `Subscription`: gói dịch vụ/license, hạn dùng, giới hạn số máy.
- `LockScreenAsset`: metadata ảnh/slideshow; file thật lưu ở S3.
- `AuditLog`: log thao tác quan trọng của admin.

### Luồng nghiệp vụ chính

1. Super admin hoặc shop admin tạo tenant/quán.
2. Shop admin đăng nhập web admin.
3. Client PC nhập tenant code, gửi MAC address lên backend.
4. Backend tạo/xác nhận `Computer` và cấp device credential cho client.
5. Client gửi heartbeat định kỳ.
6. Web admin nhận trạng thái online/offline qua Socket.IO.
7. Admin mở/đóng session cho máy.
8. Client nhận lệnh realtime và đổi trạng thái lock/unlock.
9. Backend ghi `Session`, `UsageLog` và cập nhật dashboard.
10. Admin cấu hình URL rules, license và lock-screen/slideshow.

## 6. Database Design & Query Performance

Thiết kế DB phải ưu tiên tenant isolation, hiệu năng dashboard và an toàn migration.

### Nguyên tắc

- Mọi bảng nghiệp vụ phải có `tenantId` nếu dữ liệu thuộc về một quán.
- Mọi query nghiệp vụ phải scope theo `tenantId`.
- API danh sách phải có pagination, filter và sort.
- Không trả toàn bộ `UsageLog`, `Session`, `AuditLog` trong một response.
- Dashboard mặc định query 7 hoặc 30 ngày.
- Prisma query phải tránh N+1, chỉ `select/include` trường cần dùng.
- Dùng UTC trong DB; UI convert sang giờ Việt Nam.
- Dùng singleton PrismaClient, không tạo nhiều client trong runtime.

### Constraint và index đề xuất

- `Tenant.code`: unique.
- `User(tenantId, email)`: unique.
- `Computer(tenantId, macAddress)`: unique.
- `Computer(tenantId, status)`: index.
- `Session(tenantId, computerId, startedAt)`: index.
- `Session(tenantId, status)`: index.
- `UsageLog(tenantId, createdAt)`: index.
- `UsageLog(tenantId, computerId, createdAt)`: index.
- `UrlRule(tenantId, enabled)`: index.
- `Subscription(tenantId, status, expiresAt)`: index.
- `AuditLog(tenantId, createdAt)`: index.
- `LockScreenAsset(tenantId, type, isActive)`: index.

### Transaction và concurrency

Dùng transaction cho các thao tác nhiều bước:

- Tạo tenant + tạo shop admin đầu tiên.
- Start session + cập nhật trạng thái máy.
- End session + ghi usage log + cập nhật summary.
- Upload asset: chỉ ghi metadata DB khi upload S3 thành công.

Cần chống race condition khi hai admin cùng mở phiên cho một máy. Backend phải kiểm tra máy chưa có active session trong transaction, đồng thời nên có constraint hoặc logic bảo vệ để không có hai session active trên cùng một `computerId`.

### Bảng tổng hợp thống kê

Khi dữ liệu tăng, không nên tính dashboard trực tiếp trên toàn bộ `UsageLog`. Có thể thêm `DailyUsageSummary`:

- `tenantId`
- `date`
- `computerId`
- `totalMinutes`
- `sessionCount`

Bảng này được cập nhật khi session kết thúc hoặc bằng job định kỳ.

### Soft delete, retention và audit

- `User`, `Computer`, `Tenant`, `UrlRule` nên dùng `deletedAt` hoặc `isActive`.
- `Session`, `UsageLog`, `AuditLog` nên giữ lại để báo cáo.
- Audit/usage có thể đặt retention 6-12 tháng trong phạm vi đồ án.
- Ghi audit khi đổi license, tạo/xóa user, sửa URL rules, start/stop session thủ công, upload/delete asset.

### Migration và DB operations

- Production chỉ dùng `prisma migrate deploy`.
- Không dùng `db push` trên production.
- Seed phải idempotent, không reset mật khẩu/dữ liệu thật.
- RDS bật automated backup.
- `GET /api/health/db` chỉ chạy query nhẹ.
- Theo dõi connection count, CPU, storage và slow query nếu cấu hình được.

## 7. API & Realtime Contracts

### REST API route groups

- `/api/auth`: auth và onboarding.
- `/api/tenants`: quản lý tenant.
- `/api/users`: quản lý admin/staff.
- `/api/computers`: đăng ký và quản lý máy trạm.
- `/api/sessions`: mở/đóng/lịch sử phiên.
- `/api/usage`: thống kê usage.
- `/api/url-rules`: luật URL.
- `/api/assets`: upload/list/delete asset S3.
- `/api/subscriptions`: license/subscription.
- `/api/health`: health checks.

### Endpoint auth/onboarding cụ thể

- `POST /api/auth/register-tenant`: tạo tenant + shop admin đầu tiên.
- `POST /api/auth/login`: đăng nhập.
- `POST /api/auth/refresh`: refresh token.
- `POST /api/auth/logout`: đăng xuất.
- `GET /api/auth/me`: lấy user hiện tại.
- `POST /api/users`: shop admin tạo staff.
- `POST /api/computers/register`: client PC đăng ký máy bằng tenant code + MAC.

### Socket.IO events

Client PC emit:

- `client:register`
- `client:heartbeat`
- `client:session-ended`
- `client:usage-sync`

Backend emit tới web admin:

- `computer:online`
- `computer:offline`
- `session:started`
- `session:ended`
- `usage:updated`

Backend emit tới client PC:

- `session:start`
- `session:stop`
- `policy:update`
- `lockscreen:update`
- `client:restart`

Web admin emit:

- `admin:watch-tenant`: join room theo tenant để nhận đúng realtime events.

### Response lỗi thống nhất

API trả JSON dạng:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

HTTP status:

- `400`: dữ liệu sai.
- `401`: chưa đăng nhập/token sai.
- `403`: không có quyền.
- `404`: không tìm thấy.
- `409`: xung đột dữ liệu, ví dụ máy đã có active session.
- `429`: rate limited.
- `500`: lỗi server.

## 8. Security

### Authentication

- Admin/staff đăng nhập bằng email/password.
- Password hash bằng bcrypt hoặc argon2.
- Dùng JWT access token ngắn hạn và refresh token dài hạn hơn.
- Refresh token nên lưu/thu hồi được để hỗ trợ logout.

### Authorization

Role-based access control:

- `super_admin`: quản lý toàn hệ thống.
- `shop_admin`: quản lý tenant của mình.
- `staff`: dùng các chức năng được cấp quyền.

### Tenant isolation

Tenant isolation là yêu cầu bắt buộc. Mọi query nghiệp vụ như computer, session, usage, URL rules, asset, subscription, audit log đều phải lọc theo `tenantId`. Không được để admin quán A đọc hoặc sửa dữ liệu quán B.

### Client PC trust

Client PC đăng ký bằng `tenantCode + macAddress`. Sau khi đăng ký, server cấp `clientToken` hoặc device credential riêng. Heartbeat và socket events từ client phải xác thực bằng token này, không chỉ tin MAC address.

### Input validation

Validate body/query/params cho mọi API. Các endpoint nhạy cảm như register tenant, login, upload asset, start/stop session, register computer phải kiểm tra dữ liệu chặt.

### Rate limiting

Dùng Token Bucket cho REST API và Socket.IO events. Bucket key phụ thuộc endpoint.

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

Single EC2 có thể dùng in-memory store cho đồ án. Nếu scale nhiều instance, bucket store nên chuyển sang Redis.

### Transport, secrets và file security

- Production dùng HTTPS/WSS.
- Không commit `.env`.
- `DATABASE_URL`, `JWT_SECRET`, AWS config nằm trong environment hoặc secret mechanism phù hợp.
- S3 bucket không public toàn bộ.
- Asset dùng signed URL hoặc CloudFront policy nếu cần.
- Upload giới hạn loại file, dung lượng và kiểm tra MIME cơ bản.

### Audit log

Ghi log thao tác quan trọng:

- Đăng nhập.
- Tạo/sửa tenant.
- Tạo user.
- Đổi license.
- Start/stop session.
- Cập nhật URL rules.
- Upload/delete asset.

## 9. Logging, Observability & Operations

### Logging

Backend ghi structured log:

- `requestId`
- `tenantId`
- `userId`
- `computerId`
- method, path, status code, latency
- auth failure
- rate limit hit
- upload failure
- Socket.IO connect/disconnect
- heartbeat timeout
- Prisma/DB error
- S3 error
- JWT/validation error

PM2, Nginx và backend logs trên EC2 được đẩy lên CloudWatch Logs.

### Health checks

- `GET /health`: liveness.
- `GET /api/health/db`: DB reachable và query nhẹ.
- `GET /api/health/runtime`: uptime, memory usage, active socket count.

### Observability metrics

- EC2 CPU, RAM, disk.
- Node.js memory usage: RSS, heap used, heap total.
- PM2 restart count, process uptime.
- API latency, 4xx/5xx count.
- Socket connected clients, online/offline count, heartbeat timeout.
- RDS CPU, storage, connection count, query latency cơ bản.
- S3 upload success/failure.
- CloudFront request count/error rate nếu cấu hình dashboard.

### Memory leak monitoring

- Theo dõi EC2 memory và Node heap/RSS.
- CloudWatch alarm nếu memory vượt ngưỡng, ví dụ 80% trong 5 phút.
- PM2 auto restart nếu process vượt memory limit, ví dụ `max-memory-restart` ở mức phù hợp instance.
- Soak test 30-60 phút với heartbeat/socket giả lập.
- Khi nghi ngờ leak, kiểm tra socket listener, interval/timer không clear, cache không giới hạn, upload stream không đóng.

### Operations runbook

Runbook cần có:

- Deploy backend lên EC2.
- Build web admin và upload lên S3/CloudFront.
- Kiểm tra health sau deploy.
- Xem log backend trên CloudWatch.
- Restart PM2 service.
- Rollback backend.
- Backup/restore DB.
- Kiểm tra lỗi client không kết nối server.
- Kiểm tra lỗi upload S3/slideshow không hiển thị.

### AWS smoke test

Sau deploy phải kiểm tra:

- EC2 health OK.
- RDS query OK.
- S3 upload OK.
- CloudFront web OK.
- CloudWatch có log mới.

## 10. AWS Deployment

Hệ thống dùng 5 dịch vụ AWS:

| Dịch vụ | Vai trò |
| --- | --- |
| EC2 | Chạy backend Node.js + Socket.IO bằng PM2/Nginx |
| RDS MySQL | Database chính |
| S3 | Static web admin, lock-screen/slideshow assets, installer/downloads |
| CloudFront | CDN cho web admin/static/downloads |
| CloudWatch | Logs, metrics, dashboard/alarm cơ bản |

Backend deploy lên EC2. Web admin build static rồi upload lên S3 và phân phối qua CloudFront. Backend kết nối RDS MySQL. Asset upload qua backend lên S3. Logs và metrics quan trọng đưa lên CloudWatch.

## 11. Testing

### Backend tests

- Auth login/register tenant.
- Tenant isolation.
- Computer register.
- Session start/stop.
- License/subscription.
- Upload asset metadata.

### Integration tests

- Web admin gọi đúng API contract.
- Client PC register và heartbeat đúng.
- Start/stop session đi từ web admin tới backend tới client.

### Realtime tests

- Socket connect/reconnect.
- Heartbeat timeout.
- Online/offline events.
- Session start/stop events.
- Policy/lockscreen update events.

### DB performance checks

- API danh sách có pagination.
- Query dashboard giới hạn 7/30 ngày.
- Index dùng cho query chính.
- Không có N+1 query rõ ràng ở dashboard/danh sách.

### Client manual tests

- Mất mạng và reconnect.
- Lock/unlock screen.
- Watchdog restart client.
- Client sync usage khi online lại.

### AWS smoke tests

- EC2 health.
- RDS query.
- S3 upload.
- CloudFront web.
- CloudWatch logs.

### Security checks

- Token Bucket rate limit.
- RBAC.
- Tenant isolation.
- Client device token.
- Private S3/signed access.

## 12. Timeline

| Thời gian | Mục tiêu |
| --- | --- |
| Tuần 1 | Setup repo, XAMPP MySQL local, Prisma schema, API contract, khung backend/web/client |
| Tuần 2 | Auth, register tenant, login, role, dashboard web cơ bản |
| Tuần 3 | Computer register, heartbeat, online/offline realtime, AWS staging lần 1 |
| Tuần 4 | Session start/stop, usage log, web quản lý phiên, client nhận lệnh realtime |
| Tuần 5 | URL rules, lock-screen/slideshow, upload S3 |
| Tuần 6 | Subscription/license, giới hạn số máy, cảnh báo hết hạn |
| Tuần 7 | CloudFront, CloudWatch, backup, runbook, hardening deploy |
| Tuần 8 | QA end-to-end, fix lỗi tích hợp, chuẩn bị báo cáo/demo |
| Tuần 9-10 nếu có | Polish UI, mobile dashboard tối giản, installer client, video demo |

## 13. Acceptance Criteria

Thiết kế được xem là đạt khi hệ thống demo được các tiêu chí sau:

- Admin tạo tenant và đăng nhập được.
- Shop admin tạo staff và quản lý dữ liệu trong tenant của mình.
- Client PC đăng ký bằng tenant code + MAC và nhận device token.
- Web admin thấy máy online/offline realtime.
- Admin mở/đóng phiên, client phản hồi đúng.
- Usage được ghi và dashboard hiển thị thống kê.
- URL rules và lock-screen/slideshow hoạt động ở mức demo.
- License/subscription giới hạn số máy hoặc cảnh báo hết hạn.
- Hệ thống chạy trên AWS với EC2, RDS, S3, CloudFront, CloudWatch.
- Có health check, CloudWatch logs và runbook deploy/rollback.
- Có báo cáo phân công nhóm, tài liệu cài đặt và demo script.

## 14. Risks & Mitigations

| Rủi ro | Cách giảm rủi ro |
| --- | --- |
| Tích hợp backend/web/client muộn | Làm end-to-end theo phase, test socket từ tuần 3 |
| Deploy AWS lỗi cuối kỳ | Có AWS staging từ tuần 3-4 |
| Query dashboard chậm | Index theo tenant/time, pagination, `DailyUsageSummary` |
| Memory leak do Socket.IO/heartbeat | Runtime health, CloudWatch memory alarm, soak test |
| Tenant leak dữ liệu | RBAC + tenant isolation trong mọi query + test tenant isolation |
| Upload/file public sai | S3 private, signed URL/CloudFront policy, validate upload |
| Scope quá rộng dưới 10 tuần | Ưu tiên demo path ổn định trước, polish/mobile làm sau |
