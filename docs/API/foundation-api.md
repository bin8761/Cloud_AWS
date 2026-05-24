# Foundation API Documentation

## Scope

Tai lieu nay bao phu cac noi dung Foundation lien quan den API platform:
- Cau truc source backend va vai tro file/chuc nang chinh.
- Scripts va quy trinh van hanh local.
- Contract response chung, logging, va health endpoints.
- Cau hinh `.env` bat buoc va rate-limit mac dinh.

## Backend Structure (high level)

- `src/app.ts`: Khoi tao Express app, middlewares, routes, error handler.
- `src/config/env.ts`: Validate va expose bien moi truong.
- `src/shared/*`: Error model, response helpers, logging, request-id, validation, rate-limit primitives.
- `src/modules/health/*`: Health endpoints (`/health`, `/api/health/runtime`, `/api/health/db`).
- `src/modules/auth|users|tenants|computers/*`: API modules theo route-controller-service-schema.
- `src/shared/prisma/prisma.client.ts`: Prisma client wiring (khong tu dong migration/generate).

## NPM Scripts

- `npm run dev`: Chay backend local dev.
- `npm run build`: Build TypeScript ra output runtime.
- `npm run start`: Chay app tu build output.
- `npm run test`: Chay test suite (Vitest).

Luu y: Team/user tu chu dong chay scripts; agent khong tu y chay lenh DB/migration/server neu chua duoc phe duyet.

## Manual Responsibilities

- Team/user phai tu chay `npm install`.
- Team/user phai tu chay Prisma CLI (`prisma migrate ...`, `prisma generate`) khi can.
- App khong chay migration o startup.

## Local MySQL Expectation (XAMPP)

- Host: `localhost`
- Port: `3306`
- Database: `cloudcms`
- Charset: `utf8mb4`
- Engine: `InnoDB`

## Required `.env` Values (Foundation level)

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `CORS_ORIGIN`
- `LOG_LEVEL`
- `JSON_BODY_LIMIT` (khuyen nghi `1mb`)
- `URLENCODED_BODY_LIMIT`
- `RATE_LIMIT_STORE`
- `RATE_LIMIT_DEFAULT_CAPACITY`
- `RATE_LIMIT_DEFAULT_REFILL_TOKENS`
- `RATE_LIMIT_DEFAULT_REFILL_WINDOW_SECONDS`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TOKEN_TTL_SECONDS`
- `REFRESH_TOKEN_TTL_DAYS`
- `VERIFICATION_CODE_TTL_SECONDS`
- `PENDING_REGISTRATION_TTL_SECONDS`
- `AUTH_BCRYPT_COST`

## Body Size Guidance

- `JSON_BODY_LIMIT=1mb` de bao ve tai nguyen API.
- File upload lon khong nen di qua JSON body endpoint thong thuong; nen dung upload flow/chunk/phuong an toi uu khac.

## Token Bucket Defaults

- Default bucket duoc cau hinh boi:
  - `RATE_LIMIT_DEFAULT_CAPACITY`
  - `RATE_LIMIT_DEFAULT_REFILL_TOKENS`
  - `RATE_LIMIT_DEFAULT_REFILL_WINDOW_SECONDS`
- Y nghia:
  - `capacity`: so request toi da trong bucket.
  - `refillTokens`: so token duoc nap them sau moi cua so refill.
  - `refillWindowSeconds`: do dai cua cua so refill.

## Recommended Module Overrides

Khuyen nghi override theo route nhay cam:
- Auth login
- Auth register tenant
- Computers register
- Heartbeat routes (tuong lai)
- Asset upload routes (tuong lai)

## Health Endpoints

### `GET /health`
- Muc dich: health check nhanh, khong phu thuoc DB.
- Response:
```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

### `GET /api/health/runtime`
- Muc dich: metadata runtime an toan.
- Co the gom: environment, Node version, uptime, memory stats.

### `GET /api/health/db`
- Muc dich: DB connectivity check nhe (`SELECT 1` style).
- Loi DB tra ve theo contract loi chung (`DATABASE_ERROR`), khong lo credentials.

## Standard Success Response Contract

```json
{
  "success": true,
  "data": {}
}
```

## Standard Error Response Contract

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

## Error Safety

- Production response khong duoc expose stack trace.
- Logging phai redact secret/token va khong log raw auth data.
