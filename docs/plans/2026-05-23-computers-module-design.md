# Computers Module Design

**Date:** 2026-05-23  
**Status:** Approved in brainstorming

## 1. Goal
Thiết kế module `computers` theo module boundaries đã chốt, đảm bảo:
- Client đăng ký máy bằng `tenantCode + registrationSecret + macAddress`
- Cấp `device token` an toàn
- Quản lý danh sách/chi tiết/cập nhật máy theo tenant isolation
- Sẵn sàng mở rộng cơ chế register auth trong tương lai

## 2. Scope (MVP)
- `POST /api/computers/register`
- `GET /api/computers`
- `GET /api/computers/:id`
- `PATCH /api/computers/:id`
- Admin flow riêng: reissue device token

Ngoài phạm vi MVP hiện tại:
- Invite code one-time
- Claim token pre-provisioning
- Dashboard realtime nâng cao

## 3. Architecture
- Service-first architecture.
- `controller` mỏng, chỉ parse request và gọi service.
- `computers.service` chứa business rules.
- Tách `RegistrationAuthStrategy` để thay đổi auth mechanism về sau mà không phải đổi route/controller.
- V1 strategy: `TenantSecretStrategy`.

## 4. Components
- `computers.routes.ts`: route binding + middleware/guards
- `computers.controller.ts`: HTTP IO handling
- `computers.service.ts`: business logic chính
- `computers.schema.ts`: request/query/patch validation
- `computers.mapper.ts`: map model -> DTO (ẩn field nhạy cảm)
- `registration-auth.strategy.ts`: interface + tenant-secret implementation
- `computers.logging.ts`: event helpers cho structured logs

## 5. Authorization & Security Model
- `POST /api/computers/register`: public endpoint, bắt buộc `tenantCode + registrationSecret + macAddress`.
- `GET /api/computers`, `GET /api/computers/:id`, `PATCH /api/computers/:id`: chỉ `shop_admin` có tenant context hợp lệ.
- Tenant scoping luôn lấy từ auth context, không tin tenant từ client input.
- `PATCH` dùng allowlist field; chặn update các field nhạy cảm như `tenantId`, `deviceTokenHash`, timestamps, internal flags.

## 6. Duplicate Register Policy
- Unique theo `(tenantId, macAddress)`.
- Nếu register trùng MAC trong cùng tenant: trả `409 CONFLICT`.
- Không silent-update trong register endpoint.
- Mất token/cài lại máy xử lý bằng admin reissue token flow riêng.

## 7. Data Flow
### 7.1 Register
1. Validate body.
2. Resolve tenant theo `tenantCode`.
3. Verify `registrationSecret` (hash compare).
4. Check existing `(tenantId, macAddress)`.
5. Nếu đã tồn tại -> `409`.
6. Nếu chưa có -> tạo computer record.
7. Sinh device token, lưu hash, trả plain token 1 lần.

### 7.2 List/Detail
- Xác thực admin JWT.
- Query theo `tenantId` từ context.
- Detail truy vấn `id + tenantId`.
- Response luôn ẩn token hash/internal fields.

### 7.3 Update
- Xác thực admin JWT + role.
- Validate allowlist patch.
- Update theo `id + tenantId`.

### 7.4 Reissue Token (admin flow)
- Rotate token.
- Revoke token cũ.
- Ghi audit/log event.

## 8. DB Design
### 8.1 `computers`
- `id` uuid pk
- `tenant_id` uuid fk not null
- `name` varchar nullable
- `mac_address` varchar not null
- `device_token_hash` varchar not null
- `status` enum(`active`,`inactive`,`blocked`) default `active`
- `last_seen_at` timestamp nullable
- `notes` text nullable
- `created_at` timestamp
- `updated_at` timestamp

### 8.2 Constraints & Indexes
- Unique: `(tenant_id, mac_address)`
- Index: `(tenant_id, created_at desc)`
- Index: `(tenant_id, status)`

### 8.3 Optional audit table
`computer_token_rotations`:
- `id`, `computer_id`, `rotated_by`, `reason`, `rotated_at`

## 9. Error Handling
- `400 VALIDATION_ERROR`: payload/query invalid
- `401 UNAUTHORIZED`: token invalid/expired
- `403 FORBIDDEN`: role/tenant context không hợp lệ
- `404 NOT_FOUND`: không tìm thấy computer trong tenant scope
- `409 CONFLICT`: duplicate MAC register
- `429 TOO_MANY_REQUESTS`: vượt rate-limit register
- `500 INTERNAL_ERROR`: lỗi hệ thống, không lộ dữ liệu nhạy cảm

## 10. Observability, Health & Operations
- Structured logs:
  - `computer.registered`
  - `computer.register.conflict`
  - `computer.updated`
  - `computer.token.reissued`
- Log fields: `requestId`, `tenantId`, `computerId`, `actorId`, `ip`.
- Không log plaintext token/secret.
- Metrics:
  - register success/fail/conflict counters
  - reissue counter
  - endpoint latency histogram
- Health:
  - dùng health endpoints hiện có (`/health`, `/api/health/db`)
- Operations:
  - rate-limit riêng cho register endpoint
  - cảnh báo fail register bất thường theo IP/tenant
  - runbook reissue token + audit check

## 11. Testing Strategy
- Unit tests: schema, mapper, strategy
- Service tests: register success/conflict, tenant isolation, patch allowlist, token rotation
- API tests: RBAC matrix, tenant isolation, invalid input, invalid token, rate-limit, conflict path

## 12. Future Evolution
- Có thể thêm `InviteCodeStrategy` hoặc `ClaimTokenStrategy` nhờ abstraction `RegistrationAuthStrategy`.
- Có thể rollout song song nhiều strategy qua config/feature flag.
