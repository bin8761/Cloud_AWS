# Foundation Implementation Notes

## Manual Command Ownership

User/team must run the following manually (assistant must not run them autonomously):

- Dependency install commands (for example: `npm install`).
- Database provisioning/setup commands.
- Prisma CLI commands (for example: `prisma generate`, `prisma migrate`, `prisma db push`, `prisma studio`).
- Migration commands (create/apply/rollback workflows).
- Server start/restart commands (for example: `npm run dev`, `npm run start`).

## Reason

This follows Foundation TDD constraints to keep DB and runtime operations under explicit team control.


## Recommended Rate-Limit Overrides

Use `createRateLimitMiddleware` with endpoint-specific overrides instead of a single global policy.

- Auth login:
  - `capacity: 5`
  - `refillTokens: 5`
  - `refillWindowSeconds: 900` (15 minutes)
  - `keyStrategy`: combine IP and normalized email.
- Tenant registration:
  - `capacity: 3`
  - `refillTokens: 3`
  - `refillWindowSeconds: 3600` (1 hour)
  - `keyStrategy`: IP-based.
- Computer registration:
  - `capacity: 10`
  - `refillTokens: 10`
  - `refillWindowSeconds: 60` (1 minute)
  - `keyStrategy`: combine IP and tenant code.
- Heartbeat:
  - `capacity: 120`
  - `refillTokens: 120`
  - `refillWindowSeconds: 60` (1 minute)
  - `keyStrategy`: computer ID.
- Asset upload:
  - `capacity: 20`
  - `refillTokens: 20`
  - `refillWindowSeconds: 60` (1 minute)
  - `keyStrategy`: combine user ID and tenant ID.

Health endpoints should stay excluded from rate limiting by default. Enable `includeHealthEndpoints` only when explicitly required.
