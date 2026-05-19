# CloudCMS Foundation Module

Shared backend foundation for the CloudCMS Node.js/Express API.

## Spec Reference

Primary spec: `SPEC.md`

Source design doc: `../../module/2026-05-17-cloudcms-foundation-design.md`

## Key Constraints

- Implement the backend source in this workspace.
- Use `npm` as the package manager.
- Use `vitest` as the test runner.
- Use `pino` as the logger.
- Use Node.js, TypeScript, Express, Prisma and MySQL.
- Local DB is XAMPP MySQL; AWS DB is Amazon RDS MySQL.
- Do not run DB commands, migrations, server commands or Prisma CLI autonomously.
- Prisma must use provider `mysql`.
- App startup must not run migrations.
- Keep all foundation APIs reusable by later modules.
- Preserve the shared response/error format from `SPEC.md`.
- Keep `.env` out of git; only `.env.example` should be committed.

## Commands

These commands are expected after backend scaffolding exists:

- `npm run dev` - Start the backend in development.
- `npm run test` - Run tests.
- `npm run build` - Build TypeScript output.

## Current Status

Check `SPEC.md` -> Development Phases for implementation progress.
