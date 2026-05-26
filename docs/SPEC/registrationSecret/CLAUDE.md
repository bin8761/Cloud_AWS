# CloudCMS Computer Registration Secret

Spec for tenant-level computer registration secret provisioning: initial secret returned once during tenant verification and shop-admin reissue for lost or compromised secrets.

## Spec Reference

Primary spec: `SPEC.md`

No supplement files are used for this spec. API contracts, validation rules, security constraints, logging rules, test requirements, and development phases are inline in `SPEC.md`.

## Key Constraints

- Use existing `Tenant.computerRegistrationSecretHash`; do not add new Prisma fields or tables for MVP.
- Plain `computerRegistrationSecret` may appear only in successful tenant verification and reissue responses.
- Store only the hash; never persist or log the plain secret.
- Reissue must overwrite the tenant hash and immediately invalidate the previous plain secret.
- Reissue is `shop_admin` only and must derive tenant scope from authenticated tenant context.
- Do not run Prisma CLI, migrations, DB setup, server commands, or DB commands autonomously in this workspace.

## Commands

- `npm run dev` - Start backend development server if available.
- `npm test` - Run backend tests if available.
- `npm run build` - Build backend package if available.

## Current Status

Check `SPEC.md` -> `Development Phases` for implementation status.
