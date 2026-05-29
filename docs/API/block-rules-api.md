# Block Rules API Documentation

## Response Contract by Endpoint

### `POST /api/block-rules`

- Admin route (`shop_admin` trong tenant context).
- Input: `type`, `value`, optional `label`, `reason`, `priority`.
- Success `201`: tra ve block rule DTO vua tao.
- Error thuong gap:
  - `VALIDATION_ERROR`: payload sai schema.
  - `UNAUTHORIZED`: thieu/sai admin JWT.
  - `FORBIDDEN`: role khong phai `shop_admin` hoac thieu tenant context.
  - `CONFLICT`: duplicate `(tenantId, type, value)` hoac vuot 500 rules/tenant.

### `POST /api/block-rules/batch`

- Admin route (`shop_admin` trong tenant context).
- Input: `rules` tu 1 den 50 item, moi item dung schema create.
- Success `201`: tra ve danh sach rules da tao.
- Transaction: tao tat ca hoac fail toan bo.
- Rate-limit: endpoint batch co rate-limit rieng.

### `GET /api/block-rules`

- Admin route (`shop_admin` trong tenant context).
- Ho tro `page`, `pageSize`, `type`, `status`, `q`, `sort`.
- Sort allowlist: `createdAt:desc`, `createdAt:asc`, `priority:desc`, `priority:asc`.
- Success `200`: danh sach paginated da scope theo tenant caller.

### `GET /api/block-rules/:id`

- Admin route (`shop_admin`).
- Success: chi tiet rule trong tenant cua caller.
- `NOT_FOUND`: id khong ton tai hoac cross-tenant.

### `PATCH /api/block-rules/:id`

- Admin route (`shop_admin`).
- Allowlist update: `value`, `label`, `reason`, `status`, `priority`.
- Success: rule sau khi update.
- `CONFLICT`: update tao duplicate `(tenantId, type, value)`.

### `DELETE /api/block-rules/:id`

- Admin route (`shop_admin`).
- Hard delete rule trong tenant caller.
- Success: rule vua bi xoa.

### `GET /api/block-rules/active`

- Computer client route.
- Auth: `Authorization: Bearer <deviceToken>` + header `x-computer-id`.
- Success `200`: array active rules cua tenant may tram, sort theo `priority desc`, `createdAt desc`.
- Dung cho WPF Client fetch lan dau va re-fetch sau event Socket.IO `block-rules:updated`.

## DTO

`BlockRule` fields:

- `id`, `tenantId`
- `type`: `URL`, `PROCESS`, `KEYWORD`
- `value`: pattern URL/process/keyword
- `label`, `reason`: nullable
- `status`: `ACTIVE`, `DISABLED`
- `priority`: `0..9999`
- `createdBy`: nullable user id
- `createdAt`, `updatedAt`

## Realtime Contract

Khi admin create/update/delete/batch-create rule, backend emit event:

```json
{
  "action": "created",
  "tenantId": "tenant_1",
  "timestamp": "2026-05-28T00:00:00.000Z"
}
```

Event name: `block-rules:updated`.

Client nen xu ly event bang cach goi lai `GET /api/block-rules/active`, thay vi patch cache cuc bo theo payload.

## Operational Notes

- Gioi han MVP: 500 rules/tenant.
- Batch create toi da 50 rules/request.
- API khong tra ve secret hay device token hash.
- Browser/process enforcement nam o WPF Client, khong nam trong backend.
