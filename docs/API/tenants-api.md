# Tenants API Documentation

## Final Endpoint List

- `GET /api/tenants/me`
- `PATCH /api/tenants/me`
- `GET /api/tenants` (super admin)
- `GET /api/tenants/:id` (super admin)
- `PATCH /api/tenants/:id` (super admin)

## Core Notes

- Khong co Tenants-specific env var.
- Khong can Prisma migration rieng cho Tenants tru khi phat hien schema drift.
- `Tenant.code` immutable trong MVP.
- Soft delete, archive jobs, audit persistence: future work.

## Role/Access Manual Verification

1. Chuan bi token:
   - `shop_admin`
   - `staff`
   - `super_admin`
2. `shop_admin`:
   - Goi `GET /api/tenants/me`.
   - Goi `PATCH /api/tenants/me` cap nhat `name`.
3. `staff`:
   - Goi `GET /api/tenants/me` (duoc phep doc theo contract hien hanh neu applicable).
   - Thu `PATCH /api/tenants/me` va xac nhan bi chan theo role policy.
4. `super_admin`:
   - Goi `GET /api/tenants` (pagination/filter/status/q).
   - Goi `GET /api/tenants/:id`.
   - Goi `PATCH /api/tenants/:id` cap nhat `name`.
   - Goi `PATCH /api/tenants/:id` cap nhat `status`.
5. Xac nhan tenant users (`shop_admin`, `staff`) khong truy cap duoc super-admin routes.

## Web Admin Handoff

- Current tenant profile screen:
  - Doc thong tin tenant qua `/api/tenants/me`.
- Current tenant name update screen:
  - Mutate qua `PATCH /api/tenants/me`.
- Super-admin tenant management:
  - List/filter/detail/update qua `/api/tenants`, `/api/tenants/:id`.
  - Bao ve hanh vi role guard theo MVP.
