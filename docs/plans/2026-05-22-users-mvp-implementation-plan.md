# Users MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Users MVP so an authenticated `shop_admin` can create, list, view, update, disable/enable, and reset passwords for `staff` users in the same tenant.

**Architecture:** Add a dedicated `backend/src/modules/users` module following the existing route-controller-service-schema-types-logging shape used by Auth and Tenants. Reuse Auth password hashing, Auth RBAC middleware, shared validation, shared Prisma, Foundation errors, and request logging. Keep `/api/users` shop-admin-only and scope all queries by `authContext.tenantId`, `role = STAFF`, and `deletedAt = null`.

**Tech Stack:** Node.js 22, TypeScript, Express, Prisma, MySQL, Zod, Vitest, Supertest, Pino.

---

## Constraints

- Do not run DB commands, migration commands, server commands, typecheck, or tests autonomously. Ask the user/team to run them.
- Do not create a Prisma migration unless schema drift is discovered. Current Prisma `User` model already supports the MVP.
- Do not implement `DELETE /api/users/:id` in MVP.
- Do not add staff self-profile endpoints under `/api/users`; use `GET /api/auth/me`.
- Do not expose `passwordHash`, `deletedAt`, refresh tokens, or raw request data.

## Task 1: Users Documentation Skeleton

**Files:**
- Create: `docs/SPEC/users/SPEC.md`
- Create: `docs/tdd/users/2026-05-22-users-tdd.md`
- Create: `docs/task/users/task-breakdown.md`
- Read: `docs/plans/2026-05-22-users-mvp-design.md`

**Step 1: Write the module SPEC**

Create `docs/SPEC/users/SPEC.md` from the approved design. Include:

```markdown
# CloudCMS Users Module SPEC

## Overview

The Users module lets a tenant `shop_admin` manage `staff` accounts in their own tenant.

## MVP Features

- Create staff with direct temporary password.
- List staff in current tenant.
- Get staff detail in current tenant.
- Update staff `fullName`, `status`, or temporary password.

## Out Of Scope

- `shop_admin` account management.
- `super_admin` user administration.
- Staff self-profile endpoints under `/api/users`.
- Invite email onboarding.
- `DELETE /api/users/:id`.
```

**Step 2: Write the technical design document**

Create `docs/tdd/users/2026-05-22-users-tdd.md`. Include route pipeline, data flow, Prisma query shape, DTO shape, error behavior, observability, and test matrix.

**Step 3: Write the task breakdown**

Create `docs/task/users/task-breakdown.md` with small unchecked tasks grouped by docs, scaffold, schema, types, logging, service, controller, routes, app wiring, unit tests, service tests, API tests, and final review.

**Step 4: Commit**

```bash
git add docs/SPEC/users/SPEC.md docs/tdd/users/2026-05-22-users-tdd.md docs/task/users/task-breakdown.md
git commit -m "docs: add users module planning artifacts"
```

## Task 2: Users Types And DTO Mappers

**Files:**
- Create: `backend/src/modules/users/users.types.ts`
- Test: `backend/tests/users/users.unit.test.ts`

**Step 1: Write failing mapper tests**

Create `backend/tests/users/users.unit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapUserDto } from "../../src/modules/users/users.types";

describe("Users DTO mapping", () => {
  it("maps safe staff DTO fields and excludes sensitive fields", () => {
    const dto = mapUserDto({
      id: "user_1",
      tenantId: "tenant_1",
      email: "staff@example.com",
      fullName: "Staff One",
      role: "STAFF",
      status: "ACTIVE",
      passwordHash: "secret",
      deletedAt: null,
      lastLoginAt: null,
      createdAt: new Date("2026-05-22T00:00:00.000Z"),
      updatedAt: new Date("2026-05-22T01:00:00.000Z"),
    });

    expect(dto).toEqual({
      id: "user_1",
      tenantId: "tenant_1",
      email: "staff@example.com",
      fullName: "Staff One",
      role: "STAFF",
      status: "ACTIVE",
      lastLoginAt: null,
      createdAt: "2026-05-22T00:00:00.000Z",
      updatedAt: "2026-05-22T01:00:00.000Z",
    });
    expect(dto).not.toHaveProperty("passwordHash");
    expect(dto).not.toHaveProperty("deletedAt");
  });
});
```

**Step 2: Ask user/team to run the failing test**

```bash
cd backend
npm test -- tests/users/users.unit.test.ts
```

Expected: FAIL because `users.types.ts` does not exist.

**Step 3: Implement minimal types**

Create `backend/src/modules/users/users.types.ts`:

```ts
export type UserRoleDto = "STAFF";
export type UserStatusDto = "ACTIVE" | "DISABLED";

export type UserDto = Readonly<{
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: UserRoleDto;
  status: UserStatusDto;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type ListUsersInput = {
  page: number;
  pageSize: number;
  status?: UserStatusDto;
  q?: string;
};

export type CreateStaffInput = {
  email: string;
  fullName: string;
  password: string;
};

export type UpdateStaffInput = {
  fullName?: string;
  status?: UserStatusDto;
  password?: string;
};

export type ListUsersOutput = {
  items: ReadonlyArray<UserDto>;
  page: number;
  pageSize: number;
  total: number;
};

export type UserEnvelopeOutput = {
  user: UserDto;
};

type UserMapperSource = {
  id: string;
  tenantId: string | null;
  email: string;
  fullName: string;
  role: "STAFF" | UserRoleDto;
  status: UserStatusDto;
  passwordHash?: string;
  deletedAt?: Date | string | null;
  lastLoginAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const toJsonSafeDate = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

export const mapUserDto = ({
  passwordHash: _passwordHash,
  deletedAt: _deletedAt,
  ...user
}: UserMapperSource): UserDto => ({
  id: user.id,
  tenantId: user.tenantId ?? "",
  email: user.email,
  fullName: user.fullName,
  role: "STAFF",
  status: user.status,
  lastLoginAt:
    user.lastLoginAt === null ? null : toJsonSafeDate(user.lastLoginAt),
  createdAt: toJsonSafeDate(user.createdAt),
  updatedAt: toJsonSafeDate(user.updatedAt),
});
```

**Step 4: Ask user/team to rerun test**

```bash
cd backend
npm test -- tests/users/users.unit.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/src/modules/users/users.types.ts backend/tests/users/users.unit.test.ts
git commit -m "feat(users): add staff dto types"
```

## Task 3: Users Validation Schemas

**Files:**
- Create: `backend/src/modules/users/users.schema.ts`
- Modify: `backend/tests/users/users.unit.test.ts`
- Read: `backend/src/modules/auth/auth.schema.ts`
- Read: `backend/src/modules/tenants/tenants.schema.ts`

**Step 1: Add failing schema tests**

Append tests that assert:

- create schema lowercases email.
- create schema rejects `tenantId`, `role`, `status`, and `passwordHash`.
- update schema requires at least one of `fullName`, `status`, `password`.
- list query parses default `page` and `pageSize`.
- q trims whitespace and normalizes empty string to `undefined`.

**Step 2: Ask user/team to run unit tests**

```bash
cd backend
npm test -- tests/users/users.unit.test.ts
```

Expected: FAIL because schemas do not exist.

**Step 3: Implement schemas**

Create `backend/src/modules/users/users.schema.ts`:

```ts
import { z } from "zod";
import {
  adminPasswordSchema,
  normalizedEmailSchema,
} from "../auth/auth.schema";
import {
  parseExpressQueryInteger,
} from "../tenants/tenants.schema";

export const normalizeOptionalUserSearchQuery = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const normalizedValue = value.trim();
  return normalizedValue.length === 0 ? undefined : normalizedValue;
};

export const userIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const userFullNameSchema = z.string().trim().min(1).max(120);
export const userStatusSchema = z.enum(["ACTIVE", "DISABLED"]);

export const createStaffSchema = z
  .object({
    email: normalizedEmailSchema,
    fullName: userFullNameSchema,
    password: adminPasswordSchema,
  })
  .strict();

export const updateStaffSchema = z
  .object({
    fullName: userFullNameSchema.optional(),
    status: userStatusSchema.optional(),
    password: adminPasswordSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.fullName !== undefined ||
      value.status !== undefined ||
      value.password !== undefined,
    { message: "At least one of `fullName`, `status`, or `password` is required." },
  );

export const listUsersQuerySchema = z.object({
  page: z.preprocess(parseExpressQueryInteger, z.number().int().min(1).default(1)),
  pageSize: z.preprocess(parseExpressQueryInteger, z.number().int().min(1).max(100).default(20)),
  status: userStatusSchema.optional(),
  q: z.preprocess(normalizeOptionalUserSearchQuery, z.string().max(100).optional()),
});
```

**Step 4: Ask user/team to rerun unit tests**

```bash
cd backend
npm test -- tests/users/users.unit.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/src/modules/users/users.schema.ts backend/tests/users/users.unit.test.ts
git commit -m "feat(users): add request validation schemas"
```

## Task 4: Users Logging Guardrails

**Files:**
- Create: `backend/src/modules/users/users.logging.ts`
- Modify: `backend/tests/users/users.unit.test.ts`
- Read: `backend/src/modules/tenants/tenants.logging.ts`

**Step 1: Add failing logging tests**

Test that `usersLoggingService.logUsersEvent` drops or flags raw body, headers, tokens, password, and passwordHash fields.

**Step 2: Ask user/team to run tests**

```bash
cd backend
npm test -- tests/users/users.unit.test.ts
```

Expected: FAIL because logging service does not exist.

**Step 3: Implement logging**

Create `users.logging.ts` mirroring Tenants logging with events:

```ts
export const USERS_LOG_EVENTS = {
  STAFF_CREATED: "user.staff.created",
  STAFF_UPDATED: "user.staff.updated",
  STAFF_STATUS_UPDATED: "user.staff.status.updated",
  STAFF_PASSWORD_RESET: "user.staff.password.reset",
} as const;
```

Log only safe fields:

```text
requestId, actorUserId, actorRole, actorTenantId, targetUserId, targetTenantId,
changedFields, oldStatus, newStatus
```

**Step 4: Ask user/team to rerun tests**

```bash
cd backend
npm test -- tests/users/users.unit.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/src/modules/users/users.logging.ts backend/tests/users/users.unit.test.ts
git commit -m "feat(users): add safe staff logging"
```

## Task 5: Users Service Create/List/Detail

**Files:**
- Create: `backend/src/modules/users/users.service.ts`
- Create: `backend/tests/users/users.service.test.ts`
- Read: `backend/src/modules/tenants/tenants.service.ts`
- Read: `backend/src/modules/auth/auth.password.ts`

**Step 1: Write failing service tests**

Cover:

- createStaff hashes password and creates `role: STAFF`, `status: ACTIVE`, `tenantId` from auth context.
- createStaff throws `FORBIDDEN` if auth context has no tenant id.
- createStaff throws `CONFLICT` if email exists.
- listStaff scopes by `tenantId`, `role: STAFF`, `deletedAt: null`, pagination, status, q.
- getStaffById scopes by `tenantId`, `role: STAFF`, `deletedAt: null`.

**Step 2: Ask user/team to run service tests**

```bash
cd backend
npm test -- tests/users/users.service.test.ts
```

Expected: FAIL because service does not exist.

**Step 3: Implement service dependencies and helpers**

Create `UsersService` with injectable dependencies:

```ts
type UsersServiceDependencies = {
  prismaClient?: typeof prisma;
  passwordService?: AuthPasswordService;
  loggingService?: UsersLoggingService;
};
```

Implement helpers:

```ts
const createBaseStaffWhere = (tenantId: string) => ({
  tenantId,
  role: UserRole.STAFF,
  deletedAt: null,
});
```

**Step 4: Implement createStaff**

Use:

```ts
const passwordHash = await this.passwordService.hashPassword(input.password);
await this.prismaClient.user.create({
  data: {
    tenantId,
    email: input.email,
    fullName: input.fullName,
    passwordHash,
    role: UserRole.STAFF,
    status: UserStatus.ACTIVE,
  },
  select: userDtoSelect,
});
```

Check duplicate email before create and map Prisma unique conflict to `409 CONFLICT`.

**Step 5: Implement listStaff and getStaffById**

Use `count` + `findMany` with:

```ts
where: {
  ...createBaseStaffWhere(tenantId),
  ...(input.status ? { status: input.status } : {}),
  ...(q ? { OR: [{ email: { contains: q } }, { fullName: { contains: q } }] } : {}),
}
```

**Step 6: Ask user/team to rerun service tests**

```bash
cd backend
npm test -- tests/users/users.service.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add backend/src/modules/users/users.service.ts backend/tests/users/users.service.test.ts
git commit -m "feat(users): add staff create list detail service"
```

## Task 6: Users Service Update/Status/Password Reset

**Files:**
- Modify: `backend/src/modules/users/users.service.ts`
- Modify: `backend/tests/users/users.service.test.ts`

**Step 1: Add failing update tests**

Cover:

- update fullName only.
- update status to `DISABLED`.
- update status to `ACTIVE`.
- reset password hashes new password.
- reject cross-tenant staff as `NOT_FOUND`.
- reject non-staff target as `NOT_FOUND`.
- log status update with old/new status.
- log password reset without password or hash.

**Step 2: Ask user/team to run service tests**

```bash
cd backend
npm test -- tests/users/users.service.test.ts
```

Expected: FAIL because update method does not exist.

**Step 3: Implement updateStaffById**

Load target first with safe scope:

```ts
const targetUser = await this.prismaClient.user.findFirst({
  where: { ...createBaseStaffWhere(tenantId), id },
  select: userDtoWithPasswordSafeSelect,
});
```

Build allowlisted `data` only:

```ts
const updateData: {
  fullName?: string;
  status?: UserStatus;
  passwordHash?: string;
} = {};
```

Hash `input.password` only if provided. Use `updateMany` with scoped where, then reload DTO.

**Step 4: Ask user/team to rerun service tests**

```bash
cd backend
npm test -- tests/users/users.service.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/src/modules/users/users.service.ts backend/tests/users/users.service.test.ts
git commit -m "feat(users): add staff update and password reset"
```

## Task 7: Controller, Routes, And App Wiring

**Files:**
- Create: `backend/src/modules/users/users.controller.ts`
- Create: `backend/src/modules/users/users.routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/users/users.api.test.ts`
- Read: `backend/src/modules/tenants/tenants.controller.ts`
- Read: `backend/src/modules/tenants/tenants.routes.ts`

**Step 1: Write failing API auth smoke tests**

Create `users.api.test.ts` with tests for:

- missing token returns `401`.
- staff token returns `403`.
- super_admin token returns `403`.
- shop_admin token reaches route behavior.

**Step 2: Ask user/team to run API tests**

```bash
cd backend
npm test -- tests/users/users.api.test.ts
```

Expected: FAIL because routes are not mounted.

**Step 3: Implement controller**

Methods:

```ts
createStaff(request, response, next)
listStaff(request, response, next)
getStaffById(request, response, next)
updateStaffById(request, response, next)
```

Each method reads validated `body`, `query`, `params`, reads auth context after `authRequired`, passes `requestId`, and responds:

```ts
response.status(200).json({ success: true, data });
```

**Step 4: Implement routes**

Create `users.routes.ts`:

```ts
usersRouter.post("/", authRequired, validateRequest({ body: createStaffSchema }), requireRole("shop_admin"), requireTenantUser, handler);
usersRouter.get("/", authRequired, validateRequest({ query: listUsersQuerySchema }), requireRole("shop_admin"), requireTenantUser, handler);
usersRouter.get("/:id", authRequired, requireRole("shop_admin"), requireTenantUser, validateRequest({ params: userIdParamsSchema }), handler);
usersRouter.patch("/:id", authRequired, requireRole("shop_admin"), requireTenantUser, validateRequest({ params: userIdParamsSchema, body: updateStaffSchema }), handler);
```

**Step 5: Wire app**

Modify `backend/src/app.ts`:

```ts
import { usersRouter } from "./modules/users/users.routes";
app.use("/api/users", usersRouter);
```

Mount after Auth and before notFound.

**Step 6: Ask user/team to rerun API tests**

```bash
cd backend
npm test -- tests/users/users.api.test.ts
```

Expected: auth smoke tests PASS.

**Step 7: Commit**

```bash
git add backend/src/modules/users/users.controller.ts backend/src/modules/users/users.routes.ts backend/src/app.ts backend/tests/users/users.api.test.ts
git commit -m "feat(users): wire staff management routes"
```

## Task 8: Full Users API Test Coverage

**Files:**
- Modify: `backend/tests/users/users.api.test.ts`
- Read: `backend/tests/tenants/tenants.api.test.ts`

**Step 1: Add create tests**

Cover:

- shop_admin creates staff.
- body rejects unknown `tenantId`, `role`, `status`, `passwordHash`.
- duplicate email returns `409`.
- response excludes sensitive fields.

**Step 2: Add list tests**

Cover:

- pagination defaults.
- `page`, `pageSize`, `status`, `q` validation.
- status filtering.
- q search over email/fullName.
- excludes cross-tenant users, shop_admin users, deleted users.

**Step 3: Add detail tests**

Cover:

- success.
- invalid id validation.
- unknown user not found.
- cross-tenant user not found.
- shop_admin target not found.
- deleted user not found.

**Step 4: Add patch tests**

Cover:

- update fullName.
- update status ACTIVE/DISABLED.
- reset password.
- reject email/tenantId/role/passwordHash/id/timestamps.
- cross-tenant not found.
- response excludes sensitive fields.

**Step 5: Add logging/security tests**

Cover:

- create/update/status/password reset logs have requestId and actor/target ids.
- logs do not include password, passwordHash, raw body, headers, or tokens.
- SQL-like search payload is treated as literal string.

**Step 6: Ask user/team to run API tests**

```bash
cd backend
npm test -- tests/users/users.api.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add backend/tests/users/users.api.test.ts
git commit -m "test(users): cover staff management api"
```

## Task 9: Final Review And Documentation Sync

**Files:**
- Modify: `docs/task/users/task-breakdown.md`
- Modify: `docs/SPEC/users/SPEC.md`
- Modify: `docs/tdd/users/2026-05-22-users-tdd.md`
- Read: `backend/src/modules/users/*`
- Read: `backend/tests/users/*`

**Step 1: Mark completed task breakdown items**

Update `docs/task/users/task-breakdown.md` from unchecked to checked for implemented tasks.

**Step 2: Verify design-doc drift**

Ensure docs match final behavior:

- No `DELETE`.
- No invite.
- No staff self-profile endpoint.
- `shop_admin` only.
- `STAFF` only.
- `ACTIVE`/`DISABLED` only.

**Step 3: Ask user/team to run focused tests**

```bash
cd backend
npm test -- tests/users/users.unit.test.ts tests/users/users.service.test.ts tests/users/users.api.test.ts
```

Expected: PASS.

**Step 4: Ask user/team to optionally run broader regression**

```bash
cd backend
npm test -- tests/auth/auth.api.test.ts tests/tenants/tenants.api.test.ts tests/users/users.api.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add docs/task/users/task-breakdown.md docs/SPEC/users/SPEC.md docs/tdd/users/2026-05-22-users-tdd.md
git commit -m "docs(users): sync implementation checklist"
```

## Execution Handoff

Plan complete and saved to `docs/plans/2026-05-22-users-mvp-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration.

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints.

Which approach?
