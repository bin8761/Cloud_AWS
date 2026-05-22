# CloudCMS Users Module

Spec for the CloudCMS backend Users module: tenant-scoped staff creation, staff listing/detail, and staff updates (`fullName`, `status`, temporary password reset) under `/api/users`.

## Spec Reference

Primary spec: `SPEC.md`

No supplement files are used for this spec. API contracts, validation rules, security constraints, logging rules, testing requirements, and development phases are inline in `SPEC.md`.

## Key Constraints

- `/api/users` is MVP staff-management only; it must not manage `shop_admin` or `super_admin` accounts.
- All Users operations must derive tenant scope from `req.authContext.tenantId`; client `tenantId` input must never be trusted.
- Every Users query/mutation must include `role = STAFF` and `deletedAt = null` safeguards.
- `DELETE /api/users/:id` is out of MVP; lock/unlock uses `User.status` (`ACTIVE`/`DISABLED`).
- `passwordHash`, tokens, authorization headers, raw request headers, and raw request bodies must never be exposed in API responses or logs.
- Prisma CLI/migrations/server/test/typecheck commands are user/team-run actions in this workspace.

## Commands

- `npm run dev` - Start backend development server if available.
- `npm test` - Run backend tests if available.
- `npm run build` - Build backend package if available.

## Current Status

Check `SPEC.md` -> `Development Phases` for implementation status.
