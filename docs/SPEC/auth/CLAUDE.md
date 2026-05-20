# CloudCMS Auth Module

Spec for the CloudCMS backend Auth module: tenant registration with email verification, login, refresh-token rotation, logout, current-user lookup, JWT auth context, and RBAC helpers.

## Spec Reference

Primary spec: `SPEC.md`

No supplement files are used for this spec. API contracts, data models, security rules, logging, testing, and implementation phases are inline in `SPEC.md`.

## Key Constraints

- Public tenant registration creates only `shop_admin`; it must not create `staff` or `super_admin`.
- Every email is globally unique and normalized before storage and lookup.
- Raw passwords, refresh tokens, verification codes, token hashes, code hashes, JWT secrets, SMTP passwords, and authorization headers must never be logged.
- Refresh tokens and verification codes are stored only as hashes.
- Tests must use a mock email sender and must not send real SMTP email.
- Prisma CLI, migrations, database setup, and server commands are user/team-run actions.

## Commands

- `npm run dev` - Start development server from the backend package if available.
- `npm test` - Run tests from the backend package if available.
- `npm run build` - Build from the backend package if available.

## Current Status

Check `SPEC.md` -> `Development Phases` for implementation status.
