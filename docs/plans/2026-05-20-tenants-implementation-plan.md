# Tenants Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the CloudCMS Tenants MVP: tenant self-management for shop admins plus basic super-admin tenant list/detail/update.

**Architecture:** Add a `backend/src/modules/tenants/` module following the existing Express route -> controller -> service -> Prisma pattern. Reuse Auth middleware/RBAC helpers, Foundation validation/error handling, and the existing `Tenant` Prisma model.

**Tech Stack:** Node.js, TypeScript, Express, Prisma, Zod, Vitest, Supertest.

---

## Constraints

- Do not run DB, migration, server, test, or typecheck commands autonomously; the user/team runs them.
- Do not add a Prisma migration unless implementation discovers schema drift.
- Do not add soft delete endpoints.
- Keep `Tenant.code` immutable.
- Do not expose `deletedAt` in MVP responses.

## Relevant Existing Files

- `backend/src/app.ts`
- `backend/src/modules/auth/auth.middleware.ts`
- `backend/src/modules/auth/auth.rbac.ts`
- `backend/src/shared/validation/validate-request.ts`
- `backend/src/shared/errors/app-error.ts`
- `backend/src/shared/prisma/prisma.client.ts`
- `backend/prisma/schema.prisma`
- `backend/tests/auth/auth.api.test.ts`

## Task 1: Create Tenants Types And DTO Mapping

**Files:**

- Create: `backend/src/modules/tenants/tenants.types.ts`

**Step 1: Create DTO and input types**

Add:

```ts
export type TenantStatusDto = "ACTIVE" | "SUSPENDED";

export type TenantDto = {
  id: string;
  code: string;
  name: string;
  status: TenantStatusDto;
  createdAt: string;
  updatedAt: string;
};

export type TenantEntity = {
  id: string;
  code: string;
  name: string;
  status: TenantStatusDto;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantListOutput = {
  items: TenantDto[];
  page: number;
  pageSize: number;
  total: number;
};

export type GetCurrentTenantOutput = {
  tenant: TenantDto;
};

export type UpdateTenantNameInput = {
  name: string;
};

export type UpdateTenantByIdInput = {
  name?: string;
  status?: TenantStatusDto;
};

export const mapTenantDto = (tenant: TenantEntity): TenantDto => ({
  id: tenant.id,
  code: tenant.code,
  name: tenant.name,
  status: tenant.status,
  createdAt: tenant.createdAt.toISOString(),
  updatedAt: tenant.updatedAt.toISOString(),
});
```

**Step 2: Commit checkpoint**

```bash
git add backend/src/modules/tenants/tenants.types.ts
git commit -m "feat(tenants): add tenant DTO types"
```

## Task 2: Add Tenants Validation Schemas

**Files:**

- Create: `backend/src/modules/tenants/tenants.schema.ts`

**Step 1: Add schema code**

```ts
import { z } from "zod";

export const tenantIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const tenantStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);

export const updateCurrentTenantSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
  })
  .strict();

export const updateTenantByIdSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    status: tenantStatusSchema.optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.status !== undefined, {
    message: "At least one field is required.",
  });

const positiveIntWithDefault = (defaultValue: number) =>
  z.coerce.number().int().positive().default(defaultValue);

export const listTenantsQuerySchema = z.object({
  page: positiveIntWithDefault(1),
  pageSize: positiveIntWithDefault(20).max(100),
  status: tenantStatusSchema.optional(),
  q: z.string().trim().max(100).optional(),
});
```

**Step 2: Commit checkpoint**

```bash
git add backend/src/modules/tenants/tenants.schema.ts
git commit -m "feat(tenants): add request schemas"
```

## Task 3: Implement Tenants Service

**Files:**

- Create: `backend/src/modules/tenants/tenants.service.ts`

**Step 1: Write service implementation**

```ts
import { Prisma, TenantStatus } from "@prisma/client";

import { AppError } from "../../shared/errors/app-error";
import { prisma } from "../../shared/prisma/prisma.client";
import {
  mapTenantDto,
  type GetCurrentTenantOutput,
  type TenantListOutput,
  type UpdateTenantByIdInput,
  type UpdateTenantNameInput,
} from "./tenants.types";

type TenantsServiceDependencies = {
  prismaClient?: typeof prisma;
};

type ListTenantsInput = {
  page: number;
  pageSize: number;
  status?: "ACTIVE" | "SUSPENDED";
  q?: string;
};

const NOT_FOUND_MESSAGE = "Tenant not found.";
const FORBIDDEN_MESSAGE = "You do not have permission to access this tenant.";

export class TenantsService {
  private readonly prismaClient: typeof prisma;

  constructor(dependencies: TenantsServiceDependencies = {}) {
    this.prismaClient = dependencies.prismaClient ?? prisma;
  }

  public async getCurrentTenant(tenantId: string | null | undefined): Promise<GetCurrentTenantOutput> {
    if (!tenantId) {
      throw new AppError(403, "FORBIDDEN", FORBIDDEN_MESSAGE);
    }

    const tenant = await this.prismaClient.tenant.findFirst({
      where: {
        id: tenantId,
        deletedAt: null,
      },
      select: this.tenantSelect(),
    });

    if (!tenant) {
      throw new AppError(404, "NOT_FOUND", NOT_FOUND_MESSAGE);
    }

    return {
      tenant: mapTenantDto(tenant),
    };
  }

  public async updateCurrentTenant(
    tenantId: string | null | undefined,
    input: UpdateTenantNameInput,
  ): Promise<GetCurrentTenantOutput> {
    if (!tenantId) {
      throw new AppError(403, "FORBIDDEN", FORBIDDEN_MESSAGE);
    }

    const tenant = await this.prismaClient.tenant.update({
      where: {
        id: tenantId,
      },
      data: {
        name: input.name,
      },
      select: this.tenantSelect(),
    });

    return {
      tenant: mapTenantDto(tenant),
    };
  }

  public async listTenants(input: ListTenantsInput): Promise<TenantListOutput> {
    const where: Prisma.TenantWhereInput = {
      deletedAt: null,
      status: input.status ? TenantStatus[input.status] : undefined,
      OR: input.q
        ? [
            { name: { contains: input.q } },
            { code: { contains: input.q } },
          ]
        : undefined,
    };

    const skip = (input.page - 1) * input.pageSize;
    const [items, total] = await this.prismaClient.$transaction([
      this.prismaClient.tenant.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: input.pageSize,
        select: this.tenantSelect(),
      }),
      this.prismaClient.tenant.count({
        where,
      }),
    ]);

    return {
      items: items.map(mapTenantDto),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  public async getTenantById(id: string): Promise<GetCurrentTenantOutput> {
    const tenant = await this.prismaClient.tenant.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: this.tenantSelect(),
    });

    if (!tenant) {
      throw new AppError(404, "NOT_FOUND", NOT_FOUND_MESSAGE);
    }

    return {
      tenant: mapTenantDto(tenant),
    };
  }

  public async updateTenantById(
    id: string,
    input: UpdateTenantByIdInput,
  ): Promise<GetCurrentTenantOutput> {
    await this.assertTenantExists(id);

    const tenant = await this.prismaClient.tenant.update({
      where: {
        id,
      },
      data: {
        name: input.name,
        status: input.status ? TenantStatus[input.status] : undefined,
      },
      select: this.tenantSelect(),
    });

    return {
      tenant: mapTenantDto(tenant),
    };
  }

  private async assertTenantExists(id: string): Promise<void> {
    const tenant = await this.prismaClient.tenant.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!tenant) {
      throw new AppError(404, "NOT_FOUND", NOT_FOUND_MESSAGE);
    }
  }

  private tenantSelect() {
    return {
      id: true,
      code: true,
      name: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.TenantSelect;
  }
}

export const tenantsService = new TenantsService();
```

**Step 2: Implementation review note**

If TypeScript complains about `TenantStatus[input.status]`, replace it with `input.status` if Prisma enum values are typed as string literals in this project.

**Step 3: Commit checkpoint**

```bash
git add backend/src/modules/tenants/tenants.service.ts
git commit -m "feat(tenants): implement tenant service"
```

## Task 4: Add Tenants Controller

**Files:**

- Create: `backend/src/modules/tenants/tenants.controller.ts`

**Step 1: Add controller code**

```ts
import type { NextFunction, Request, Response } from "express";

import { tenantsService } from "./tenants.service";
import type {
  UpdateTenantByIdInput,
  UpdateTenantNameInput,
} from "./tenants.types";

export class TenantsController {
  public async me(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const data = await tenantsService.getCurrentTenant(request.authContext?.tenantId);
      response.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async updateMe(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const input = request.body as UpdateTenantNameInput;
      const data = await tenantsService.updateCurrentTenant(
        request.authContext?.tenantId,
        input,
      );
      response.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async list(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const data = await tenantsService.listTenants(request.query as never);
      response.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async detail(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const data = await tenantsService.getTenantById(request.params.id);
      response.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  public async update(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const input = request.body as UpdateTenantByIdInput;
      const data = await tenantsService.updateTenantById(request.params.id, input);
      response.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const tenantsController = new TenantsController();
```

**Step 2: Refine query typing if needed**

If `request.query as never` is too broad, add a `ListTenantsInput` export in `tenants.service.ts` or `tenants.types.ts` and cast to that type.

**Step 3: Commit checkpoint**

```bash
git add backend/src/modules/tenants/tenants.controller.ts
git commit -m "feat(tenants): add tenant controller"
```

## Task 5: Add Tenants Routes

**Files:**

- Create: `backend/src/modules/tenants/tenants.routes.ts`

**Step 1: Add route code**

```ts
import { Router } from "express";

import { authRequired } from "../auth/auth.middleware";
import { requireRole, requireTenantUser } from "../auth/auth.rbac";
import { validateRequest } from "../../shared/validation/validate-request";
import { tenantsController } from "./tenants.controller";
import {
  listTenantsQuerySchema,
  tenantIdParamsSchema,
  updateCurrentTenantSchema,
  updateTenantByIdSchema,
} from "./tenants.schema";

export const tenantsRouter = Router();

tenantsRouter.get(
  "/me",
  authRequired,
  requireTenantUser,
  requireRole("shop_admin", "staff"),
  (request, response, next) => void tenantsController.me(request, response, next),
);

tenantsRouter.patch(
  "/me",
  authRequired,
  requireTenantUser,
  requireRole("shop_admin"),
  validateRequest({ body: updateCurrentTenantSchema }),
  (request, response, next) => void tenantsController.updateMe(request, response, next),
);

tenantsRouter.get(
  "/",
  authRequired,
  requireRole("super_admin"),
  validateRequest({ query: listTenantsQuerySchema }),
  (request, response, next) => void tenantsController.list(request, response, next),
);

tenantsRouter.get(
  "/:id",
  authRequired,
  requireRole("super_admin"),
  validateRequest({ params: tenantIdParamsSchema }),
  (request, response, next) => void tenantsController.detail(request, response, next),
);

tenantsRouter.patch(
  "/:id",
  authRequired,
  requireRole("super_admin"),
  validateRequest({ params: tenantIdParamsSchema, body: updateTenantByIdSchema }),
  (request, response, next) => void tenantsController.update(request, response, next),
);
```

**Step 2: Commit checkpoint**

```bash
git add backend/src/modules/tenants/tenants.routes.ts
git commit -m "feat(tenants): add tenant routes"
```

## Task 6: Mount Tenants Router

**Files:**

- Modify: `backend/src/app.ts`

**Step 1: Add import**

```ts
import { tenantsRouter } from "./modules/tenants/tenants.routes";
```

**Step 2: Mount router after auth router**

```ts
app.use("/api/auth", authRouter);
app.use("/api/tenants", tenantsRouter);
```

**Step 3: Commit checkpoint**

```bash
git add backend/src/app.ts
git commit -m "feat(tenants): mount tenant routes"
```

## Task 7: Add Tenant Logging

**Files:**

- Create: `backend/src/modules/tenants/tenants.logging.ts`
- Modify: `backend/src/modules/tenants/tenants.service.ts`
- Modify: `backend/src/modules/tenants/tenants.controller.ts`

**Step 1: Create logging helper**

```ts
import { logger } from "../../shared/logging/logger";
import type { AuthRole } from "../../shared/middleware/auth-context";

type TenantLogInput = {
  requestId?: string;
  actorUserId?: string;
  actorRole?: AuthRole;
  actorTenantId?: string | null;
  targetTenantId?: string;
  action: "tenant.name.updated" | "tenant.status.updated";
  oldStatus?: string;
  newStatus?: string;
};

export class TenantsLoggingService {
  public logTenantEvent(input: TenantLogInput): void {
    logger.info({
      module: "tenants",
      event: input.action,
      requestId: input.requestId,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      actorTenantId: input.actorTenantId,
      targetTenantId: input.targetTenantId,
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
    });
  }
}

export const tenantsLoggingService = new TenantsLoggingService();
```

**Step 2: Pass request context through controller to service**

Add context types to service methods and call `tenantsLoggingService.logTenantEvent` after successful updates.

**Step 3: Commit checkpoint**

```bash
git add backend/src/modules/tenants/tenants.logging.ts backend/src/modules/tenants/tenants.service.ts backend/src/modules/tenants/tenants.controller.ts
git commit -m "feat(tenants): add tenant update logging"
```

## Task 8: Add API Tests

**Files:**

- Create: `backend/tests/tenants/tenants.api.test.ts`

**Step 1: Reuse Auth API test patterns**

Open `backend/tests/auth/auth.api.test.ts` and reuse the local patterns for:

- mocking `authTokenService.verifyAccessToken`
- mocking `prisma`
- using Supertest against `app`
- resetting test state between cases

**Step 2: Cover required test cases**

Add tests for:

```text
401 without token
shop_admin GET /api/tenants/me succeeds
shop_admin PATCH /api/tenants/me updates name
shop_admin cannot update status/code through /me
staff GET /api/tenants/me succeeds
staff PATCH /api/tenants/me returns 403
tenant users cannot list/detail/update by id
super_admin list supports pagination
super_admin list supports status filter
super_admin list supports q search
super_admin detail succeeds
super_admin update name/status succeeds
invalid query/body returns 400
unknown tenant returns 404
deletedAt is not exposed
```

**Step 3: User-run test command**

Run:

```bash
cd backend
npm test -- tests/tenants/tenants.api.test.ts
```

Expected:

```text
PASS tests/tenants/tenants.api.test.ts
```

**Step 4: Commit checkpoint**

```bash
git add backend/tests/tenants/tenants.api.test.ts
git commit -m "test(tenants): cover tenant API permissions"
```

## Task 9: Add Optional Live Test Script Later

**Files:**

- Modify later only if requested: `backend/package.json`
- Create later only if requested: `backend/tests/tenants/tenants.api.live.test.ts`

**Step 1: Defer live tests**

Do not add live Tenants tests in the first implementation unless the user asks for live server coverage.

**Reason:**

Auth live success flow already requires real credentials and email handling. Tenants MVP can be validated with app-level API tests first.

## Task 10: Final Verification

**Files:**

- Check: `backend/src/modules/tenants/*`
- Check: `backend/src/app.ts`
- Check: `backend/tests/tenants/tenants.api.test.ts`

**Step 1: User-run typecheck**

Run:

```bash
cd backend
npm run typecheck
```

Expected:

```text
No TypeScript errors
```

**Step 2: User-run targeted tests**

Run:

```bash
cd backend
npm test -- tests/tenants/tenants.api.test.ts
```

Expected:

```text
PASS tests/tenants/tenants.api.test.ts
```

**Step 3: User-run broader regression**

Run:

```bash
cd backend
npm test -- tests/auth/auth.api.test.ts tests/tenants/tenants.api.test.ts
```

Expected:

```text
Auth and Tenants API tests pass
```

**Step 4: Final commit**

```bash
git add backend/src/modules/tenants backend/src/app.ts backend/tests/tenants
git commit -m "feat(tenants): implement tenant management MVP"
```

## Execution Handoff

Plan complete and saved to `docs/plans/2026-05-20-tenants-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration.

**2. Parallel Session (separate)** - Open a new session with executing-plans, batch execution with checkpoints.

Which approach?
