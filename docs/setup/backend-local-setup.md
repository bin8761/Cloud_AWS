# Backend Local Setup (Foundation)

## 1. Prerequisites

- Node.js 22
- XAMPP (MySQL)
- npm

## 2. Start MySQL (XAMPP)

- Open XAMPP Control Panel.
- Start `MySQL`.

## 3. Create database `cloudcms`

Using phpMyAdmin:

- Go to `http://localhost/phpmyadmin`.
- Create a new database named `cloudcms`.
- Collation: `utf8mb4_general_ci` (or `utf8mb4_unicode_ci`).

## 4. Prepare environment file

In `backend/`:

```powershell
copy .env.example .env
```

Important values in `.env`:

```env
DATABASE_URL=mysql://root:@localhost:3306/cloudcms
JWT_ACCESS_SECRET=local-dev-access-secret
JWT_REFRESH_SECRET=local-dev-refresh-secret
AWS_REGION=ap-southeast-1
S3_BUCKET_NAME=local-placeholder-bucket
```

Notes:
- If MySQL `root` has a password, update `DATABASE_URL` accordingly.
- Placeholder secrets are enough for Foundation local run.

## 5. Install dependencies

In `backend/`:

```powershell
npm install
```

## 6. Generate Prisma Client

In `backend/`:

```powershell
npm run prisma:generate
```

## 7. Run backend

In `backend/`:

```powershell
npm run dev
```

Successful startup example log:

```text
{"level":30,...,"environment":"development","port":3000,...,"msg":"HTTP server started"}
```

## 8. Manual API smoke test

```powershell
curl -UseBasicParsing http://localhost:3000/health
curl -UseBasicParsing http://localhost:3000/api/health/runtime
curl -UseBasicParsing http://localhost:3000/api/health/db
curl -UseBasicParsing http://localhost:3000/unknown-route
```

Expected:

- `GET /health` -> `200`, `success: true`
- `GET /api/health/runtime` -> `200`, runtime info (`environment`, `nodeVersion`, `uptimeSeconds`, `memory`)
- `GET /api/health/db` -> `200`, `database: "mysql"` (requires DB reachable)
- `GET /unknown-route` -> `404`, `error.code: "NOT_FOUND"`

## 9. Common issues

1. `Cannot find module '.prisma/client/default'`
- Cause: Prisma Client not generated.
- Fix: `npm run prisma:generate`.

2. Prisma schema error about datasource `url` unsupported
- Cause: Prisma v7.
- Fix: this project pins Prisma v6 in `package.json`.

3. `DATABASE_ERROR` on `/api/health/db`
- Cause: MySQL not running, wrong `DATABASE_URL`, or DB `cloudcms` not created.
- Fix: start MySQL, create DB, verify credentials/port.
