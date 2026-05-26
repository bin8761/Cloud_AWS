# Computer Registration Secret Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate and return a one-time tenant computer registration secret during tenant verification, and add a shop-admin reissue endpoint for lost or compromised secrets.

**Architecture:** Reuse the existing `Tenant.computerRegistrationSecretHash` field and Computers secret hashing helper. Auth verification generates the initial secret and stores only its hash during tenant creation. Tenants adds a current-tenant scoped reissue endpoint that rotates the hash and returns the new plain secret exactly once.

**Tech Stack:** Node.js, Express, TypeScript, Prisma, Zod, Vitest/Supertest, existing auth RBAC middleware.

---

### Task 1: Add Shared Computer Registration Secret Generator

**Files:**
- Modify: `backend/src/modules/computers/computers.service.ts`
- Test: `backend/tests/computers` or existing nearest computers unit test file

**Step 1: Write the failing test**

Add or extend a Computers unit test to assert the generator returns a prefixed, non-empty, non-deterministic secret.

Expected behavior:

```ts
const first = generateComputerRegistrationSecret();
const second = generateComputerRegistrationSecret();

expect(first).toMatch(/^crs_live_[A-Za-z0-9_-]+$/);
expect(second).toMatch(/^crs_live_[A-Za-z0-9_-]+$/);
expect(first).not.toBe(second);
```

**Step 2: Run test to verify it fails**

Run only the relevant Computers unit test command used by this repo.

Expected: FAIL because `generateComputerRegistrationSecret` is not exported yet.

**Step 3: Write minimal implementation**

In `backend/src/modules/computers/computers.service.ts`, add:

```ts
export const generateComputerRegistrationSecret = (): string =>
  `crs_live_${randomBytes(32).toString("base64url")}`;
```

Use the existing `crypto` import if present, or add `randomBytes` from `node:crypto`.

**Step 4: Run test to verify it passes**

Run the same focused test.

Expected: PASS.

**Step 5: Commit**

```bash
git add backend/src/modules/computers/computers.service.ts backend/tests/computers
git commit -m "feat: add computer registration secret generator"
```

### Task 2: Return Initial Secret From Tenant Verification

**Files:**
- Modify: `backend/src/modules/auth/auth.types.ts`
- Modify: `backend/src/modules/auth/auth.service.ts`
- Test: existing auth service/controller test for `verifyTenantRegistration`

**Step 1: Write the failing test**

Extend the successful tenant verification test to assert:

```ts
expect(result.computerRegistrationSecret).toMatch(/^crs_live_[A-Za-z0-9_-]+$/);
expect(createdTenant.computerRegistrationSecretHash).toBeDefined();
expect(createdTenant.computerRegistrationSecretHash).not.toContain(result.computerRegistrationSecret);
```

Also verify the returned secret can be checked by `TenantSecretStrategy` or the password compare helper against the stored hash.

**Step 2: Run test to verify it fails**

Run the focused auth verification test.

Expected: FAIL because the response does not include `computerRegistrationSecret` and tenant creation does not set its hash.

**Step 3: Update types**

In `backend/src/modules/auth/auth.types.ts`, add to `VerifyRegisterTenantOutput`:

```ts
computerRegistrationSecret: string;
```

**Step 4: Generate and hash secret during verification**

In `backend/src/modules/auth/auth.service.ts`:

- Import `generateComputerRegistrationSecret` and `hashRegistrationSecret` from Computers service.
- Generate the plain secret before creating the tenant.
- Hash it.
- Pass the hash into tenant creation.
- Return the plain secret in the verify response.

Pseudo-implementation:

```ts
const computerRegistrationSecret = generateComputerRegistrationSecret();
const computerRegistrationSecretHash = await hashRegistrationSecret(
  computerRegistrationSecret,
);

const createdTenant = await this.createActiveTenantInVerificationTransaction({
  tenantCode: pendingRegistration.tenantCode,
  tenantName: pendingRegistration.tenantName,
  computerRegistrationSecretHash,
});
```

Response addition:

```ts
return {
  tenant: { ... },
  user: { ... },
  accessToken,
  refreshToken: rawRefreshToken,
  computerRegistrationSecret,
};
```

**Step 5: Update tenant creation helper**

Update `createActiveTenantInVerificationTransaction` input and Prisma create data:

```ts
computerRegistrationSecretHash: string;
```

```ts
data: {
  code: input.tenantCode,
  name: input.tenantName,
  computerRegistrationSecretHash: input.computerRegistrationSecretHash,
}
```

**Step 6: Run focused tests**

Expected: PASS.

**Step 7: Commit**

```bash
git add backend/src/modules/auth/auth.types.ts backend/src/modules/auth/auth.service.ts backend/tests
git commit -m "feat: return initial computer registration secret"
```

### Task 3: Add Reissue Schema And Route

**Files:**
- Modify: `backend/src/modules/tenants/tenants.schema.ts`
- Modify: `backend/src/modules/tenants/tenants.routes.ts`
- Modify: `backend/src/modules/tenants/tenants.controller.ts`
- Modify: `backend/src/modules/tenants/tenants.service.ts`
- Test: existing tenants route/controller/service tests

**Step 1: Write failing route tests**

Add tests for:

- Missing token returns `401`.
- Staff token returns `403`.
- Shop admin token returns `200` with `computerRegistrationSecret`.
- Request accepts `{}`.
- Request accepts `{ "reason": "lost secret" }`.
- Request rejects unknown fields.
- Request rejects reason longer than 200 chars.

**Step 2: Add schema**

In `tenants.schema.ts`:

```ts
export const reissueComputerRegistrationSecretSchema = z
  .object({
    reason: z.string().trim().max(200).optional(),
  })
  .strict();
```

Export it through `tenantsRouteSchemas`.

**Step 3: Add route**

In `tenants.routes.ts`, add before `/:id` routes:

```ts
tenantsRouter.post(
  "/me/computer-registration-secret/reissue",
  authRequired,
  validateRequest({ body: reissueComputerRegistrationSecretSchema }),
  requireRole("shop_admin"),
  requireTenantUser,
  (request, response, next) =>
    void tenantsController.reissueComputerRegistrationSecret(request, response, next),
);
```

Place it before `/:id` so Express does not treat `me` as an id route.

**Step 4: Add controller method**

In `tenants.controller.ts`:

```ts
public async reissueComputerRegistrationSecret(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authContext = readAuthContextAfterAuthRequired(request);
    const data = await tenantsService.reissueComputerRegistrationSecret(
      {
        ...authContext,
        requestId: request.requestId,
      },
      request.body,
    );

    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
```

**Step 5: Add service method**

In `tenants.service.ts`:

- Import `generateComputerRegistrationSecret` and `hashRegistrationSecret`.
- Resolve current tenant id from auth context.
- Generate new secret.
- Hash it.
- Update `Tenant.computerRegistrationSecretHash` for the current tenant.
- Return `{ computerRegistrationSecret }`.

**Step 6: Run focused tests**

Expected: PASS.

**Step 7: Commit**

```bash
git add backend/src/modules/tenants backend/tests
git commit -m "feat: add computer registration secret reissue endpoint"
```

### Task 4: Verify Old Secret Stops Working After Reissue

**Files:**
- Test: computers/tenants integration or service test covering both modules

**Step 1: Write failing integration test**

Test flow:

1. Create tenant with initial `computerRegistrationSecretHash` for `oldSecret`.
2. Reissue secret as shop admin and capture `newSecret`.
3. Call `POST /api/computers/register` with `oldSecret`.
4. Expect `401 UNAUTHORIZED`.
5. Call `POST /api/computers/register` with `newSecret` and fresh MAC.
6. Expect `200` with `deviceToken`.

**Step 2: Run test to verify it fails or passes**

Expected: PASS if Task 3 implementation overwrites the hash correctly. If it fails, fix the service update filter.

**Step 3: Commit**

```bash
git add backend/tests
git commit -m "test: cover registration secret rotation"
```

### Task 5: Update API Docs And Postman Plan

**Files:**
- Modify: `docs/module/auth/2026-05-19-cloudcms-auth-design.md`
- Modify: `docs/module/computers/2026-05-23-computers-module-design.md`
- Modify or create: `docs/postman/*` if the Postman collection task follows immediately

**Step 1: Update Auth docs**

Document that tenant verification returns `computerRegistrationSecret` once.

**Step 2: Update Computers docs**

Document that the secret is tenant-level, long-lived for MVP, and reissued through Tenants.

**Step 3: Update Tenants docs if present**

Document:

```http
POST /api/tenants/me/computer-registration-secret/reissue
```

**Step 4: Commit**

```bash
git add docs/module docs/postman
git commit -m "docs: document computer registration secret provisioning"
```

### Task 6: Manual Postman Verification

**Files:**
- No source changes unless creating collection files after implementation.

**Step 1: Verify onboarding**

Run manually in Postman:

1. `POST /api/auth/register-tenant`
2. `POST /api/auth/register-tenant/verify`
3. Confirm response includes `computerRegistrationSecret`.
4. Save it as `registrationSecret`.

**Step 2: Verify computer registration**

Call:

```http
POST /api/computers/register
```

With body:

```json
{
  "tenantCode": "{{tenantCode}}",
  "registrationSecret": "{{registrationSecret}}",
  "macAddress": "AA:BB:CC:DD:EE:01",
  "name": "PC-01"
}
```

Expected: `200` and response includes `deviceToken`.

**Step 3: Verify reissue**

Call:

```http
POST /api/tenants/me/computer-registration-secret/reissue
```

Expected: `200` and response includes a new `computerRegistrationSecret`.

**Step 4: Verify old secret fails**

Use old `registrationSecret` with a fresh MAC.

Expected: `401 UNAUTHORIZED`.

**Step 5: Verify new secret succeeds**

Use new `registrationSecret` with a fresh MAC.

Expected: `200`.

---

Plan complete and saved to `docs/plans/2026-05-26-computer-registration-secret-implementation-plan.md`.

Two execution options:

1. Subagent-Driven (this session) - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Parallel Session (separate) - Open a new session with executing-plans, batch execution with checkpoints.
