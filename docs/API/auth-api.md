# Auth API Documentation

## Endpoints (MVP)

- `POST /api/auth/register-tenant`
- `POST /api/auth/register-tenant/verify`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

Tat ca endpoint tuan thu Foundation response contract.

## Required Auth Environment Variables

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TOKEN_TTL_SECONDS`
- `REFRESH_TOKEN_TTL_DAYS`
- `VERIFICATION_CODE_TTL_SECONDS`
- `PENDING_REGISTRATION_TTL_SECONDS`
- `AUTH_BCRYPT_COST`
- `AWS_REGION`
- `S3_BUCKET_NAME`
- SMTP-related vars khi su dung SMTP sender thuc

## SMTP Notes

- Gia tri SMTP that phai dat trong local `.env`.
- Khong commit secret SMTP vao repository.

## Prisma Operations Note

Migration/generate duoc chay thu cong boi user/team:
- `prisma migrate ...`
- `prisma generate`

App khong tu dong chay Prisma CLI trong startup.

## Manual Verification Steps (Auth TDD)

1. Dam bao env local va DB da san sang.
2. Cau hinh SMTP local that (neu verify qua email that).
3. Goi `POST /api/auth/register-tenant` voi payload hop le.
4. Xac nhan nhan duoc verification code/email.
5. Goi `POST /api/auth/register-tenant/verify` voi code vua nhan.
6. Xac nhan response co tenant, user, access token, refresh token.
7. Goi `POST /api/auth/login`.
8. Goi `GET /api/auth/me` voi access token.
9. Goi `POST /api/auth/refresh` va xac nhan refresh cu bi revoke.
10. Goi `POST /api/auth/logout` va xac nhan refresh token khong con dung duoc.

## Operational Scope (MVP)

- Redis rate-limit store cho Auth: ngoai pham vi MVP.

## Frontend Handoff Notes

- Registration flow:
  - UI thu thap thong tin tenant + owner.
  - Xu ly trang thai cho buoc gui verification.
- Verification flow:
  - Input verification code.
  - Xu ly timeout/retry theo TTL.
- Login flow:
  - Nhan va luu access + refresh token dung policy bao mat.
- Refresh flow:
  - Tu dong refresh khi access token het han.
  - Neu refresh fail thi logout va yeu cau dang nhap lai.
- Logout flow:
  - Goi API logout de revoke refresh token phia server.
- `GET /api/auth/me`:
  - Dung de dong bo profile/session state sau login/refresh.
