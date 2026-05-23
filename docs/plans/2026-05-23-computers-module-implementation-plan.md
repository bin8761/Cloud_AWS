# Computers Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Xây dựng module `computers` an toàn theo thiết kế đã duyệt, gồm register/list/detail/update và token reissue flow.

**Architecture:** Áp dụng service-first. Controller mỏng, business logic ở service, validation bằng schema, tenant isolation cứng bằng auth context. Register auth dùng `RegistrationAuthStrategy` với V1 `TenantSecretStrategy`.

**Tech Stack:** Express, TypeScript, Prisma, Zod, Vitest, Supertest.

---

### Task 1: Scaffold module files and route wiring

**Files:**
- Create: `backend/src/modules/computers/computers.routes.ts`
- Create: `backend/src/modules/computers/computers.controller.ts`
- Create: `backend/src/modules/computers/computers.service.ts`
- Create: `backend/src/modules/computers/computers.schema.ts`
- Create: `backend/src/modules/computers/computers.mapper.ts`
- Create: `backend/src/modules/computers/computers.logging.ts`
- Create: `backend/src/modules/computers/registration-auth.strategy.ts`
- Modify: `backend/src/app.ts`

**Step 1: Write the failing test**

```ts
// backend/tests/computers/computers.api.test.ts
it("mounts /api/computers routes", async () => {
  const res = await request(app).get("/api/computers");
  expect([401, 403]).toContain(res.status);
});
```

**Step 2: Run test to verify it fails**
- Run: `npx vitest run tests/computers/computers.api.test.ts -t "mounts /api/computers routes"`
- Expected: FAIL (route not found / module missing)

**Step 3: Write minimal implementation**
- Tạo khung files + export router.
- Mount router trong `app.ts` dưới `/api/computers`.

**Step 4: Run test to verify it passes**
- Run: `npx vitest run tests/computers/computers.api.test.ts -t "mounts /api/computers routes"`
- Expected: PASS

**Step 5: Commit**
```bash
git add backend/src/modules/computers backend/src/app.ts backend/tests/computers/computers.api.test.ts
git commit -m "feat(computers): scaffold module and route wiring"
```

### Task 2: Implement register schema + service happy path

**Files:**
- Modify: `backend/src/modules/computers/computers.schema.ts`
- Modify: `backend/src/modules/computers/computers.service.ts`
- Modify: `backend/src/modules/computers/registration-auth.strategy.ts`
- Test: `backend/tests/computers/computers.unit.test.ts`
- Test: `backend/tests/computers/computers.service.test.ts`

**Step 1: Write the failing test**
- Schema test: yêu cầu `tenantCode`, `registrationSecret`, `macAddress`.
- Service test: register success trả device token và persist hash.

**Step 2: Run test to verify it fails**
- Run: `npx vitest run tests/computers/computers.unit.test.ts tests/computers/computers.service.test.ts`
- Expected: FAIL

**Step 3: Write minimal implementation**
- Zod schema cho register payload.
- `TenantSecretStrategy.verify(...)`.
- `registerComputer` flow success.

**Step 4: Run test to verify it passes**
- Run command ở Step 2.
- Expected: PASS

**Step 5: Commit**
```bash
git add backend/src/modules/computers backend/tests/computers/computers.unit.test.ts backend/tests/computers/computers.service.test.ts
git commit -m "feat(computers): add register validation and happy-path service"
```

### Task 3: Enforce duplicate MAC conflict and tenant isolation

**Files:**
- Modify: `backend/src/modules/computers/computers.service.ts`
- Modify: `backend/src/modules/computers/computers.controller.ts`
- Test: `backend/tests/computers/computers.service.test.ts`
- Test: `backend/tests/computers/computers.api.test.ts`

**Step 1: Write the failing test**
- Duplicate `(tenantId, macAddress)` -> `409 CONFLICT`.
- Tenant A không đọc được computer của tenant B.

**Step 2: Run test to verify it fails**
- Run: `npx vitest run tests/computers/computers.service.test.ts tests/computers/computers.api.test.ts`
- Expected: FAIL

**Step 3: Write minimal implementation**
- Check duplicate trước create.
- Query/update luôn theo `tenantId` từ context.

**Step 4: Run test to verify it passes**
- Run command ở Step 2.
- Expected: PASS

**Step 5: Commit**
```bash
git add backend/src/modules/computers backend/tests/computers/computers.service.test.ts backend/tests/computers/computers.api.test.ts
git commit -m "feat(computers): enforce duplicate conflict and tenant isolation"
```

### Task 4: Implement list/detail/update endpoints with allowlist patch

**Files:**
- Modify: `backend/src/modules/computers/computers.routes.ts`
- Modify: `backend/src/modules/computers/computers.controller.ts`
- Modify: `backend/src/modules/computers/computers.schema.ts`
- Modify: `backend/src/modules/computers/computers.service.ts`
- Test: `backend/tests/computers/computers.api.test.ts`

**Step 1: Write the failing test**
- `GET /api/computers` pagination.
- `GET /api/computers/:id` detail.
- `PATCH /api/computers/:id` allowlist ok, field nhạy cảm bị reject.

**Step 2: Run test to verify it fails**
- Run: `npx vitest run tests/computers/computers.api.test.ts`
- Expected: FAIL

**Step 3: Write minimal implementation**
- Implement endpoints và validation.
- Role guard `shop_admin` + tenant context guard.

**Step 4: Run test to verify it passes**
- Run command ở Step 2.
- Expected: PASS

**Step 5: Commit**
```bash
git add backend/src/modules/computers backend/tests/computers/computers.api.test.ts
git commit -m "feat(computers): add list detail update endpoints"
```

### Task 5: Add reissue device token admin flow

**Files:**
- Modify: `backend/src/modules/computers/computers.routes.ts`
- Modify: `backend/src/modules/computers/computers.controller.ts`
- Modify: `backend/src/modules/computers/computers.service.ts`
- Modify: `backend/src/modules/computers/computers.logging.ts`
- Test: `backend/tests/computers/computers.service.test.ts`
- Test: `backend/tests/computers/computers.api.test.ts`

**Step 1: Write the failing test**
- Reissue token rotate hash và invalidates token cũ.
- Chỉ admin đúng tenant được reissue.

**Step 2: Run test to verify it fails**
- Run: `npx vitest run tests/computers/computers.service.test.ts tests/computers/computers.api.test.ts -t "reissue"`
- Expected: FAIL

**Step 3: Write minimal implementation**
- Thêm endpoint admin reissue.
- Log event `computer.token.reissued`.

**Step 4: Run test to verify it passes**
- Run command ở Step 2.
- Expected: PASS

**Step 5: Commit**
```bash
git add backend/src/modules/computers backend/tests/computers/computers.service.test.ts backend/tests/computers/computers.api.test.ts
git commit -m "feat(computers): add admin token reissue flow"
```

### Task 6: Security hardening and observability checks

**Files:**
- Modify: `backend/src/modules/computers/computers.routes.ts`
- Modify: `backend/src/modules/computers/computers.controller.ts`
- Modify: `backend/src/modules/computers/computers.logging.ts`
- Test: `backend/tests/computers/computers.api.test.ts`

**Step 1: Write the failing test**
- Rate-limit register.
- Reject crafted query/patch injection payloads.
- Verify logging event emitted với tenant scope.

**Step 2: Run test to verify it fails**
- Run: `npx vitest run tests/computers/computers.api.test.ts -t "security|rate|logging"`
- Expected: FAIL

**Step 3: Write minimal implementation**
- Bật rate-limit register.
- Hardening validation + structured logs.

**Step 4: Run test to verify it passes**
- Run command ở Step 2.
- Expected: PASS

**Step 5: Commit**
```bash
git add backend/src/modules/computers backend/tests/computers/computers.api.test.ts
git commit -m "feat(computers): harden security and observability"
```

### Task 7: Full regression and docs sync

**Files:**
- Modify: `docs/task/users/task-breakdown.md`
- Modify: `docs/tdd/users/2026-05-22-users-technical-design.md`
- Test: `backend/tests/computers/*.test.ts`

**Step 1: Write the failing test**
- N/A (regression/documentation task)

**Step 2: Run test suite**
- Run: `npx vitest run tests/computers --reporter=verbose`
- Expected: PASS

**Step 3: Run related regression**
- Run: `npx vitest run tests/users --reporter=verbose`
- Expected: PASS

**Step 4: Update docs/checklists**
- Đồng bộ task breakdown và TDD notes cho module `computers`.

**Step 5: Commit**
```bash
git add docs backend/tests/computers
git commit -m "chore(computers): finalize tests and sync docs"
```
