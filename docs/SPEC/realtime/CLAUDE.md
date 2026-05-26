# CloudCMS Realtime Module

Spec for the CloudCMS backend Realtime module: Socket.IO presence, tenant/computer rooms, authenticated heartbeats, online/offline events, and realtime health counters under `/socket.io`.

## Spec Reference

Primary spec: `SPEC.md`

No supplement files are used for this spec. Socket.IO contracts, data model decisions, validation rules, security constraints, logging rules, testing requirements, and development phases are inline in `SPEC.md`.

## Key Constraints

- Realtime MVP is Socket.IO-first; do not add REST heartbeat or REST presence endpoints.
- Admin sockets authenticate with JWT access tokens and may join only `tenant:<tenantId>` from verified context.
- Client PC sockets authenticate with `computerId + deviceToken` and may join only `computer:<computerId>` from verified context.
- Online/offline state is volatile in-memory state for MVP; do not add `Computer.onlineStatus` or realtime-specific Prisma tables.
- `Computer.lastSeenAt` is the durable heartbeat timestamp and must be updated with throttling.
- Future modules must emit through `realtime.gateway.ts`; do not import Socket.IO internals outside the realtime module.
- API responses, logs, and ack errors must never expose device tokens, token hashes, JWTs, raw handshake auth, authorization headers, or stack traces.
- Prisma CLI, migrations, database setup, server commands, and DB commands are user/team-run actions in this workspace.

## Commands

- `npm run dev` - Start backend development server if available.
- `npm test` - Run backend tests if available.
- `npm run typecheck` - Run TypeScript typecheck if available.
- `npm run build` - Build backend package if available.

## Current Status

Check `SPEC.md` -> `Development Phases` for implementation status.
