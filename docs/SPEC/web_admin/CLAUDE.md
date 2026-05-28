# CloudCMS Web Admin MVP

Tenant-admin React/Vite frontend for computer operations, realtime presence, status/notes updates, and one-time device token reissue.

## Spec Reference

Primary spec: `SPEC.md`

When implementing REST or Socket.IO contracts: `api-reference.md`

Source design: `../../web_admin/2026-05-26-web-admin-mvp-design.md`

## Key Constraints

- Create the frontend in `web-admin/`.
- Use React + Vite + TypeScript unless the user explicitly changes the stack.
- Do not run DB, Prisma, migration, or backend server commands autonomously.
- Access token is memory-first; refresh token persistence depends on confirmed backend policy.
- Socket.IO admin auth must use `handshake.auth = { clientType: "admin", accessToken }`.
- Reissue token UI may reveal the returned plain `deviceToken` once, but must not persist it after modal/sheet close.
- Realtime online/offline events update local presence by `computerId`; they must not trigger full-table refetch per event.
- On reconnect, emit `admin:watch-tenant` again and refresh the computers list once.
- Preserve admin status and realtime presence as separate concepts.

## Suggested Commands

Commands depend on the final `web-admin/` package setup.

- `npm run dev` - Start frontend dev server.
- `npm run test` - Run frontend tests.
- `npm run build` - Build frontend.

User/team runs backend, DB, Prisma, migration, and server commands manually.

## Current Status

Check `SPEC.md` -> Development Phases and Acceptance Checklist.
