# Auth Implementation Notes

## Manual Commands Ownership

The user/team must run these actions manually when ready:

- Install dependencies (`npm install`) after package changes.
- Run Prisma generate (`npx prisma generate`) after schema/migration updates.
- Run Prisma migrations (`npx prisma migrate ...`) and DB setup/seed commands.
- Run backend server commands (`npm run dev`, `npm run start`, or equivalent).

The implementation must not auto-run dependency install, Prisma CLI, migrations, DB setup, or server startup.

## Rate-Limit Decision (Task 167)

- Decision: use token-bucket approximation for `POST /api/auth/register-tenant/verify` in MVP.
- Current verify limiter config:
  - key: `registrationId + IP`
  - capacity: `5`
  - refill: `1 token / 300 seconds`
- Rationale: reuses existing shared rate-limit middleware without introducing a new auth-specific limiter helper at this stage.
- Revisit trigger: if false-positive lockouts become frequent in production, add a small auth-specific helper that can block exactly until verification-code expiry.

## Rate-Limit Hit Logging (Task 168)

- Added a shared `onRateLimitExceeded` hook in `createRateLimitMiddleware`.
- Auth limiters now log `rate_limit_hit` through `authLoggingService` when a bucket is exhausted.
- Safe log fields:
  - `requestId`, `event`, `status`, `reason`, `ip`, `userAgent`
  - `emailHash` only for routes that include email (`register-tenant`, `login`)
- No raw request body fields are logged.
