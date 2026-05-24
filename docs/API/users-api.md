# Users API Documentation

## Scope

Module Users MVP quan ly staff users trong cung tenant.

## Endpoints

- `POST /api/users` (`shop_admin` only)
- `GET /api/users` (`shop_admin` only)
- `GET /api/users/:id` (`shop_admin` only)
- `PATCH /api/users/:id` (`shop_admin` only)

## Response Contracts

### `POST /api/users`
- Success: tra ve staff user DTO da tao, khong bao gom `passwordHash`, `deletedAt`.
- Error thuong gap: `VALIDATION_ERROR`, `CONFLICT`, `UNAUTHORIZED`, `FORBIDDEN`.

### `GET /api/users`
- Success: danh sach staff users cua tenant hien tai, ho tro pagination/filter theo contract module.
- Error thuong gap: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`.

### `GET /api/users/:id`
- Success: chi tiet staff user thuoc tenant hien tai.
- `NOT_FOUND` cho id khong ton tai, cross-tenant, hoac khong phai staff target.

### `PATCH /api/users/:id`
- Success: staff user DTO sau cap nhat (`fullName`, `status`, reset password theo allowlist).
- `NOT_FOUND` cho cross-tenant/missing/deleted/non-staff target.
- `VALIDATION_ERROR` cho payload khong hop le.

## Explicit Non-Goals

- Web Admin UI implementation: ngoai pham vi TDD nay.
- Staff self-profile: tiep tuc su dung `GET /api/auth/me`.
- Khong co Users-specific env var.
- Khong them Users-specific health endpoint.
- Invite email, formal audit persistence, forced password change policy, va rate limiting chi tiet cho Users la future decisions.

## Manual Verification (team-run)

1. Khoi dong backend va lay access token `shop_admin`.
2. `POST /api/users`: tao staff moi.
3. `GET /api/users`: verify pagination/filter.
4. `GET /api/users/:id`: xem chi tiet staff.
5. `PATCH /api/users/:id`: test cap nhat `fullName`, `status`, password reset.
6. Verify role guard:
   - `staff` khong truy cap duoc `/api/users`.
   - `super_admin` khong truy cap duoc `/api/users` trong MVP.
7. Verify disabled staff khong login/refresh/`GET /api/auth/me`.
