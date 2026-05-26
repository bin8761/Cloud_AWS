# Continuity Ledger

## Goal (incl. success criteria)

- Implement Person 5 requirements: Local Assets upload (multer) & Subscriptions.
- Success: Prisma schemas added, routes mounted, controllers/services written, integration tests added, typecheck passes and all tests are green once database client is generated.

## Constraints/Assumptions

- Update the ledger every turn; replies begin with Ledger Snapshot (Goal + Now/Next + Open Questions).
- Replies are in Vietnamese.
- Do not run DB or migration or server commands autonomously; ask the user to run.
- Do not run Prisma CLI; the user will run all Prisma CLI commands.
- All written content must follow UTF-8 standard: file content, UI text labels/buttons, and assistant replies.

## Key decisions

- Use this file (`CONTINUITY.md`) as canonical continuity source for this workspace.
- Start each reply with a brief Ledger Snapshot (Goal + Now/Next + Open Questions).
- Direct inline subscription checking during computer registration to keep dependency graph clean.
- Auto-create upload folders programmatically during multer configuration to avoid committing empty folders to Git.

## State

### Done

- Users module and Computers module are completed.
- Added Prisma Schema definitions for `Subscription` and `LockScreenAsset` (linked to `Tenant`).
- Installed and configured `multer` for local file upload under `backend/public/uploads/lockscreen/`.
- Implemented the `assets` module (service, controller, routes, schemas, types).
- Implemented the `subscriptions` module (service, controller, routes, schemas, types, guard).
- Mounted routers under `/api/assets` and `/api/subscriptions`, served statically `/uploads/lockscreen`.
- Integrated subscription active check and computer limits checking during computer registration in `computers.service.ts`.
- Added mock subscription to existing computer test file (`computers.api.test.ts`) to prevent test break.
- Created integration tests in `backend/tests/assets/assets.api.test.ts` and `backend/tests/subscriptions/subscriptions.api.test.ts`.
- Khắc phục các lỗi linter/typecheck của TypeScript trong hai file test mới: cấu hình import đường dẫn tương đối có đuôi mở rộng `.js` (ESM moduleResolution rules) và ép kiểu các prisma mock functions.
- Chạy `npm test` thành công và toàn bộ 403 test cases (bao gồm các test case cho Assets và Subscriptions) đều chuyển sang màu xanh (Green).

### Now

- Hoàn thiện toàn bộ yêu cầu của Người số 5 thành công và sửa toàn bộ lỗi TypeScript linter trong các file chỉnh sửa/tạo mới.

### Next

- Bàn giao công việc và kế hoạch tiếp theo cho người dùng.

## Open questions

- Không có.

## Working set (files/ids/commands)

- `backend/prisma/schema.prisma`
- `backend/src/app.ts`
- `backend/src/shared/middleware/upload.middleware.ts`
- `backend/src/modules/assets/*`
- `backend/src/modules/subscriptions/*`
- `backend/tests/assets/*`
- `backend/tests/subscriptions/*`
