# Computers API Documentation

## Response Contract by Endpoint

### `POST /api/computers/register`

- Public route (khong yeu cau admin JWT).
- Input: `tenantCode`, `registrationSecret`, `macAddress`, optional `name`.
- Success: tra ve computer DTO + `deviceToken` plaintext.
- Error thuong gap:
  - `NOT_FOUND`: tenant khong ton tai/khong active theo mapping da chon.
  - `UNAUTHORIZED`: registration secret sai.
  - `CONFLICT`: duplicate `(tenantId, macAddress)`.
  - `VALIDATION_ERROR`: payload sai schema.
  - `TOO_MANY_REQUESTS`: vuot register rate-limit.

### `GET /api/computers`

- Admin route (`shop_admin` trong tenant context).
- Ho tro `page`, `pageSize`, `status`, `q`, `sort` theo allowlist.
- Success: danh sach computers da scope theo `tenantId` caller.

### `GET /api/computers/:id`

- Admin route (`shop_admin`).
- Success: chi tiet computer trong tenant cua caller.
- `NOT_FOUND`: id khong ton tai hoac cross-tenant.

### `PATCH /api/computers/:id`

- Admin route (`shop_admin`).
- Allowlist update: `name`, `status`, `notes` (theo schema hien hanh).
- `NOT_FOUND` neu target khong thuoc tenant caller.

### `POST /api/computers/:id/reissue-token`

- Admin route (`shop_admin`).
- Success: tra ve `deviceToken` plaintext moi + computer DTO.
- Dung cho lost-token/reinstall client.

## Security Contract

- Plain `deviceToken` chi tra ve 1 lan sau:
  - Register thanh cong.
  - Reissue token thanh cong.
- `deviceTokenHash` khong bao gio duoc tra ve API response.

## MVP Operational Notes

- Tenant registration secret:
  - Phai duoc setup/hash truoc cho tenant.
  - Rotation policy chi o muc co ban trong MVP, runbook thu cong.
- `DEVICE_TOKEN_HASH_SECRET`:
  - Bat buoc cau hinh trong env.
  - Dung de tao hash an toan cho device token.
- Register rate-limit duoc chon:
  - Capacity: `5`
  - Refill tokens: `1`
  - Refill window: `600` giay (10 phut)
- Suspended/inactive tenant register mapping:
  - Mapping hien hanh theo implementation da test trong suite module (khong expose detail noi bo ra client).

## Out of Scope (Future Modules)

- Realtime heartbeat.
- Socket.IO authentication.
- Sessions.
- Usage sync.
- URL policy behavior.
- Web Admin UI.
- Client PC UI.

## Lost Token / Reinstalled Client Runbook

1. Shop admin dang nhap va lay access token hop le.
2. Goi `POST /api/computers/:id/reissue-token`.
3. Nhan `deviceToken` plaintext moi (chi xuat hien 1 lan).
4. Cap nhat token vao client app ngay lap tuc.
5. Xac nhan token cu khong con hop le sau khi hash moi da thay the.

## Mobile/Client Handoff Notes

- Registration request fields:
  - `tenantCode`
  - `registrationSecret`
  - `macAddress`
  - `name` (optional)
- Token handling:
  - Luu `deviceToken` plaintext ngay sau register/reissue.
  - Khong ky vong API co endpoint doc lai plain token cu.
  - Bao mat local storage theo chinh sach ung dung client.
