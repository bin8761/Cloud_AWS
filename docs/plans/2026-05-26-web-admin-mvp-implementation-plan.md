# CloudCMS Web Admin MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first CloudCMS web admin MVP for tenant admins to log in, monitor computer realtime presence, manage computer records, update status/notes, and reissue device tokens.

**Architecture:** Create a new `web-admin/` React + Vite + TypeScript app that talks to the existing Express backend through REST and Socket.IO. Keep the frontend modular: API clients, auth state, realtime state, layout components, computer feature components, and route pages. Use the approved Hybrid Light App + Dark Realtime Panel design from `docs/plans/2026-05-26-web-admin-mvp-design.md`.

**Tech Stack:** React, Vite, TypeScript, react-router, socket.io-client, Vitest, Testing Library, CSS modules or app-level CSS tokens, lucide-react icons.

---

## Prerequisites

- Read `docs/plans/2026-05-26-web-admin-mvp-design.md`.
- Read `docs/API/openapi.yaml` for REST contracts.
- Read `backend/src/modules/realtime/realtime.events.ts` for Socket.IO event names and payloads.
- Do not run database, migration, backend server, or Prisma commands autonomously.
- Ask the user to run backend/API commands when live verification needs a running server.

## Task 1: Scaffold `web-admin`

**Files:**
- Create: `web-admin/package.json`
- Create: `web-admin/tsconfig.json`
- Create: `web-admin/tsconfig.node.json`
- Create: `web-admin/vite.config.ts`
- Create: `web-admin/index.html`
- Create: `web-admin/src/main.tsx`
- Create: `web-admin/src/App.tsx`
- Create: `web-admin/src/styles.css`

**Step 1: Create the Vite React TypeScript project files**

Create a minimal app manually instead of using an interactive scaffold command.

**Step 2: Add scripts and dependencies**

`package.json` must include:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview": "vite preview"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest",
    "react-router-dom": "latest",
    "socket.io-client": "^4",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "jsdom": "latest",
    "vitest": "latest"
  }
}
```

**Step 3: Add initial CSS tokens**

Define CSS variables for the approved light app and dark realtime panel tokens.

**Step 4: Run install/build**

Ask the user before running install if dependencies are not present:

```powershell
cd web-admin
npm install
npm run build
```

Expected: build succeeds and creates `web-admin/dist`.

**Step 5: Commit**

```powershell
git add web-admin
git commit -m "feat(web-admin): scaffold react app"
```

## Task 2: Add App Routing And Shell

**Files:**
- Create: `web-admin/src/app/AppShell.tsx`
- Create: `web-admin/src/app/routes.tsx`
- Create: `web-admin/src/components/Sidebar.tsx`
- Create: `web-admin/src/components/Topbar.tsx`
- Modify: `web-admin/src/App.tsx`
- Modify: `web-admin/src/styles.css`
- Test: `web-admin/src/app/AppShell.test.tsx`

**Step 1: Write routing tests**

Test that unauthenticated users see login and authenticated shell renders dashboard navigation.

**Step 2: Implement app routes**

Use `react-router-dom` with routes:

- `/login`
- `/dashboard`
- `/computers`
- fallback redirect to `/dashboard`

**Step 3: Implement shell**

Desktop shell has fixed sidebar and topbar. Tablet/mobile use a drawer-style sidebar.

**Step 4: Run tests**

```powershell
cd web-admin
npm test -- AppShell
```

Expected: routing and shell tests pass.

**Step 5: Commit**

```powershell
git add web-admin/src
git commit -m "feat(web-admin): add app shell and routes"
```

## Task 3: Add API Client And Auth State

**Files:**
- Create: `web-admin/src/api/http.ts`
- Create: `web-admin/src/api/authApi.ts`
- Create: `web-admin/src/auth/authStore.tsx`
- Create: `web-admin/src/auth/LoginPage.tsx`
- Create: `web-admin/src/auth/ProtectedRoute.tsx`
- Test: `web-admin/src/auth/authStore.test.tsx`
- Test: `web-admin/src/auth/LoginPage.test.tsx`

**Step 1: Write auth tests**

Cover:

- login success stores tokens and user context.
- `401` clears auth.
- login shows field/API error feedback.
- submit button disables while loading.

**Step 2: Implement HTTP client**

Use `VITE_API_BASE_URL`, defaulting to same-origin if unset.

**Step 3: Implement auth APIs**

Support:

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

**Step 4: Implement login page**

Use visible labels, field errors, loading state, and no placeholder-only labels.

**Step 5: Run tests**

```powershell
cd web-admin
npm test -- auth
```

Expected: auth tests pass.

**Step 6: Commit**

```powershell
git add web-admin/src
git commit -m "feat(web-admin): add auth flow"
```

## Task 4: Add Computer API And View Models

**Files:**
- Create: `web-admin/src/api/computersApi.ts`
- Create: `web-admin/src/computers/computerTypes.ts`
- Create: `web-admin/src/computers/computerViewModel.ts`
- Test: `web-admin/src/computers/computerViewModel.test.ts`

**Step 1: Write view-model tests**

Cover merging REST computer status with runtime presence:

- REST `ACTIVE` + presence online.
- REST `BLOCKED` + presence online.
- REST computer without presence.
- offline event updates `lastSeenAt`.

**Step 2: Implement computer API functions**

Support:

- `GET /api/computers`
- `GET /api/computers/:id`
- `PATCH /api/computers/:id`
- `POST /api/computers/:id/reissue-token`

**Step 3: Implement view model**

Keep admin status and realtime presence separate in the row model.

**Step 4: Run tests**

```powershell
cd web-admin
npm test -- computerViewModel
```

Expected: view-model tests pass.

**Step 5: Commit**

```powershell
git add web-admin/src
git commit -m "feat(web-admin): add computer api models"
```

## Task 5: Build Computer Dashboard

**Files:**
- Create: `web-admin/src/dashboard/DashboardPage.tsx`
- Create: `web-admin/src/dashboard/KpiStrip.tsx`
- Create: `web-admin/src/computers/ComputerTable.tsx`
- Create: `web-admin/src/computers/StatusBadge.tsx`
- Test: `web-admin/src/computers/ComputerTable.test.tsx`
- Test: `web-admin/src/dashboard/KpiStrip.test.tsx`

**Step 1: Write UI tests**

Cover:

- loading skeleton.
- empty state.
- error state with retry.
- filter by status.
- search by name/MAC.
- KPI counts.

**Step 2: Implement dashboard data loading**

Load computers on page entry and expose retry.

**Step 3: Implement KPI strip**

Show total, online, offline, blocked/inactive.

**Step 4: Implement data-dense table**

Desktop table shows full columns. Tablet hides secondary columns. Mobile becomes compact cards.

**Step 5: Run tests**

```powershell
cd web-admin
npm test -- ComputerTable KpiStrip
```

Expected: dashboard/table tests pass.

**Step 6: Commit**

```powershell
git add web-admin/src
git commit -m "feat(web-admin): add computer dashboard"
```

## Task 6: Add Realtime Presence

**Files:**
- Create: `web-admin/src/realtime/realtimeClient.ts`
- Create: `web-admin/src/realtime/realtimeStore.tsx`
- Create: `web-admin/src/realtime/RealtimePanel.tsx`
- Test: `web-admin/src/realtime/realtimeStore.test.tsx`
- Test: `web-admin/src/realtime/RealtimePanel.test.tsx`
- Modify: `web-admin/src/dashboard/DashboardPage.tsx`
- Modify: `web-admin/src/computers/ComputerTable.tsx`

**Step 1: Write realtime tests**

Cover:

- socket connects with `handshake.auth.clientType = "admin"`.
- emits `admin:watch-tenant` after connection.
- `computer:online` updates matching row.
- `computer:offline` updates matching row.
- reconnect state renders warning, not destructive error.

**Step 2: Implement socket client**

Use `socket.io-client` and the current access token.

**Step 3: Implement realtime state**

Store connection status and `presenceByComputerId`.

**Step 4: Implement dark realtime panel**

Show connection state, event feed, last sync, and reconnect state.

**Step 5: Integrate with table**

Realtime events update row presence without full table refetch.

**Step 6: Run tests**

```powershell
cd web-admin
npm test -- realtime
```

Expected: realtime tests pass.

**Step 7: Commit**

```powershell
git add web-admin/src
git commit -m "feat(web-admin): add realtime presence"
```

## Task 7: Add Computer Detail Drawer And Token Reissue

**Files:**
- Create: `web-admin/src/computers/ComputerDetailDrawer.tsx`
- Create: `web-admin/src/computers/ReissueTokenModal.tsx`
- Test: `web-admin/src/computers/ComputerDetailDrawer.test.tsx`
- Test: `web-admin/src/computers/ReissueTokenModal.test.tsx`
- Modify: `web-admin/src/computers/ComputerTable.tsx`

**Step 1: Write drawer/modal tests**

Cover:

- open detail from row action.
- update notes/status loading state.
- failed update rollback and toast.
- reissue requires confirmation.
- reissue token displays one-time token after success.
- copy action is available.

**Step 2: Implement detail drawer**

Desktop uses right drawer. Mobile uses full-screen sheet.

**Step 3: Implement status/notes update**

Use optimistic UI with rollback on API failure.

**Step 4: Implement reissue modal**

Token is shown only after success and not persisted.

**Step 5: Run tests**

```powershell
cd web-admin
npm test -- ComputerDetailDrawer ReissueTokenModal
```

Expected: drawer/modal tests pass.

**Step 6: Commit**

```powershell
git add web-admin/src
git commit -m "feat(web-admin): add computer detail actions"
```

## Task 8: Responsive And Accessibility Pass

**Files:**
- Modify: `web-admin/src/styles.css`
- Modify: affected components under `web-admin/src`
- Test: existing component tests as needed

**Step 1: Verify responsive CSS rules**

Ensure:

- `>=1280px`: fixed sidebar and full table.
- `1024-1279px`: compact sidebar and full-width realtime band.
- `768-1023px`: sidebar drawer, 2x2 KPI, reduced table columns.
- `375-767px`: card list instead of table, full-screen detail sheet.

**Step 2: Verify accessibility rules**

Ensure:

- all icon buttons have accessible names.
- all inputs have visible labels.
- focus rings are visible.
- statuses include text labels.
- no interactive target is below 44px height on mobile.

**Step 3: Run tests and build**

```powershell
cd web-admin
npm test
npm run build
```

Expected: tests and build pass.

**Step 4: Browser QA**

Start the dev server only after implementation:

```powershell
cd web-admin
npm run dev
```

Verify:

- 1440px desktop.
- 1024px laptop.
- 768px tablet.
- 375px mobile.
- no horizontal overflow.
- login, dashboard, table, drawer, modal, realtime states.

**Step 5: Commit**

```powershell
git add web-admin
git commit -m "test(web-admin): verify responsive admin ui"
```

## Task 9: Documentation Handoff

**Files:**
- Create: `web-admin/README.md`
- Modify: `PROJECT_HANDOFF.md` if web-admin setup needs to be listed
- Modify: `.gitignore` only if build/cache artifacts need ignoring

**Step 1: Document frontend setup**

Include:

- install command.
- dev command.
- build command.
- test command.
- `VITE_API_BASE_URL` behavior.
- expected backend prerequisites.

**Step 2: Document realtime auth**

Mention admin socket uses access token in `handshake.auth`.

**Step 3: Run final verification**

```powershell
cd web-admin
npm test
npm run build
```

Expected: all tests and build pass.

**Step 4: Commit**

```powershell
git add web-admin/README.md PROJECT_HANDOFF.md .gitignore
git commit -m "docs(web-admin): add frontend handoff"
```

---

## Execution Notes

- Keep implementation commits small and task-scoped.
- Do not mix backend changes into frontend tasks unless an API contract gap is discovered.
- If an API gap appears, stop and update the design/plan before changing backend code.
- Prefer simple React state and hooks for this MVP; avoid adding a heavy state library unless repeated complexity appears.
- Use lucide-react icons for structural UI icons.
- Preserve the approved UI direction: light operations app with dark realtime panel.

