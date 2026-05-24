# CloudCMS Computers Module

Spec for the CloudCMS backend Computers module: client PC registration, device token issuance/reissue, and tenant-scoped computer management under `/api/computers`.

## Spec Reference

Primary spec: `SPEC.md`

No supplement files are used for this spec. API contracts, data model, validation rules, security constraints, logging rules, testing requirements, and development phases are inline in `SPEC.md`.

## Key Constraints

- `POST /api/computers/register` is public only through `tenantCode + registrationSecret + macAddress`; MAC address is not a secret.
- Duplicate `(tenantId, macAddress)` registration must return `409 CONFLICT`; register must not silently update an existing computer.
- Admin endpoints are MVP `shop_admin` only and must derive tenant scope from `req.authContext.tenantId`.
- Device tokens are returned in plain text only after register/reissue; store only `deviceTokenHash`.
- API responses and logs must never expose `registrationSecret`, plain `deviceToken`, `deviceTokenHash`, authorization headers, or raw register/reissue bodies.
- Prisma CLI, migrations, database setup, server commands, and DB commands are user/team-run actions in this workspace.

## Commands

- `npm run dev` - Start backend development server if available.
- `npm test` - Run backend tests if available.
- `npm run build` - Build backend package if available.

## Current Status

Check `SPEC.md` -> `Development Phases` for implementation status.
