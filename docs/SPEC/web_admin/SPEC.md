# CloudCMS Web Admin MVP SPEC

Date: 2026-05-27

Source design: `docs/web_admin/2026-05-26-web-admin-mvp-design.md`

## Overview

CloudCMS Web Admin MVP is a tenant-admin operations interface for managing client PCs. The first usable screen after login is the Computer Operations Dashboard, focused on authenticated access, tenant-scoped computer management, realtime presence, status updates, notes, and one-time device token reissue.

The app is an operations tool, not a marketing site. It should be dense enough for repeated admin work while remaining readable on desktop, tablet, and mobile.

Target users:

- `shop_admin`: logs in, monitors computer presence, updates computer status/notes, and reissues device tokens when a client PC is reinstalled or loses its token.
- Future staff roles: may observe tenant operations later, but MVP write permissions are scoped to `shop_admin`.
- Backend developers: use this spec to implement the frontend against existing Auth, Computers, and Realtime contracts.

Success criteria:

- A new `web-admin/` frontend app exists in the workspace.
- The frontend uses React, Vite, and TypeScript.
- Login works through `POST /api/auth/login` and session bootstrap through `GET /api/auth/me`.
- Authenticated routes are protected and return to `/login` on `401`.
- Dashboard and Computers views read tenant-scoped computer data from `GET /api/computers`.
- Detail view reads `GET /api/computers/:id`.
- Status and notes updates use `PATCH /api/computers/:id`.
- Token reissue uses `POST /api/computers/:id/reissue-token` and reveals the plain token once.
- Admin Socket.IO connection authenticates with `handshake.auth = { clientType: "admin", accessToken }`.
- Dashboard emits `admin:watch-tenant` and applies `computer:online` / `computer:offline` row updates without full-table refetch for each event.
- On socket reconnect, the app emits `admin:watch-tenant` again and refreshes the computer list once.
- Desktop, laptop, tablet, and mobile layouts meet the responsive requirements from the approved design.
- UI states cover loading, empty, error, forbidden, reconnecting, rate-limited, optimistic rollback, and one-time token reveal behavior.

## Product Requirements

### MVP Features

1. Login
   - Route: `/login`.
   - Email/password form.
   - Submit to `POST /api/auth/login`.
   - After login, call `GET /api/auth/me` or hydrate current user from a verified auth state.
   - Redirect authenticated users to `/dashboard`.

2. Authenticated app shell
   - Sidebar with CloudCMS identity, `Dashboard`, `Computers`, and tenant context.
   - Topbar with page title, realtime connection state, refresh action, and user menu.
   - Sidebar is fixed on desktop, drawer-based on tablet/mobile.

3. Computer Operations Dashboard
   - Route: `/dashboard`.
   - KPI strip: total computers, online, offline, blocked/inactive.
   - Dark realtime panel: socket state, recent online/offline events, reconnecting state, last sync time.
   - Computer table or compact cards depending on viewport.
   - Refresh action reloads REST computer data.

4. Computers management list
   - Route: `/computers`.
   - Search by name or MAC address.
   - Filter by admin status.
   - Sort by allowlisted fields supported by the API.
   - Pagination using backend pagination metadata.
   - Row/card actions open the detail drawer or full-screen sheet.

5. Computer detail
   - Route behavior: `/computers/:id` may be implemented as a route-backed detail page or as a drawer state linked from list/dashboard.
   - Shows metadata, admin status, realtime presence, notes, timestamps, and MAC address.
   - Distinguish admin status from realtime presence.

6. Status and notes update
   - Update only allowlisted fields: `name`, `status`, `notes`.
   - Use optimistic UI only when rollback is implemented.
   - On failure, restore previous visible state and show clear feedback.

7. Device token reissue
   - Confirmation modal/sheet before calling reissue endpoint.
   - Submit to `POST /api/computers/:id/reissue-token`.
   - Reveal the returned plain device token exactly once in UI state.
   - Provide copy action.
   - Do not persist plain tokens in long-lived app state, logs, or storage.

8. Realtime admin presence
   - Connect to Socket.IO after a valid access token exists.
   - Authenticate with `handshake.auth = { clientType: "admin", accessToken }`.
   - Emit `admin:watch-tenant` after connect and reconnect.
   - Apply `computer:online` and `computer:offline` to local presence by `computerId`.
   - Maintain bounded recent event feed.

### Out Of Scope

- Tenant registration UI.
- Staff/user management.
- Tenant settings beyond tenant display context.
- Super-admin multi-tenant views.
- Sessions, usage, URL rules, lock-screen assets, subscriptions, and reporting.
- Persistent realtime event history.
- Client PC registration UI.
- Offline-first web admin behavior.
- Backend schema, Prisma, migration, or Socket.IO server changes.

### User Flows

Login:

```text
Admin opens /login
-> enters email/password
-> frontend calls POST /api/auth/login
-> stores access token in memory and refresh token according to auth policy
-> calls GET /api/auth/me
-> renders authenticated app shell
-> redirects to /dashboard
```

Dashboard realtime watch:

```text
Admin opens /dashboard
-> frontend calls GET /api/computers
-> frontend connects Socket.IO with admin accessToken
-> socket connect succeeds
-> frontend emits admin:watch-tenant
-> ack returns onlineComputers snapshot
-> frontend merges REST rows with presenceByComputerId
-> computer:online/offline events update visible rows and event feed
```

Computer update:

```text
Admin opens computer detail
-> edits status or notes
-> frontend validates local form
-> frontend calls PATCH /api/computers/:id
-> success replaces REST computer model in cache
-> failure rolls back optimistic state and shows toast/inline error
```

Token reissue:

```text
Admin opens detail
-> clicks reissue token
-> confirms destructive/security-sensitive action
-> frontend calls POST /api/computers/:id/reissue-token
-> frontend shows returned deviceToken once
-> admin copies token and closes modal
-> frontend clears plain token from modal state
```

## Technical Architecture

### System Type

Web Admin is a single-page frontend app in a new `web-admin/` workspace directory. It consumes the existing backend REST API and Socket.IO realtime contract.

Chosen architecture:

- React + Vite + TypeScript.
- Route-based app shell with protected routes.
- API client layer for REST contracts.
- Socket service/hook for realtime presence.
- Query/cache layer for REST data and mutation invalidation.
- Local UI state for filters, drawer/sheet state, modal state, and one-time token reveal.

Recommended package choices:

- Package manager: use the repository's existing package manager if one is already standardized; otherwise use `npm` for minimal setup friction.
- Routing: React Router.
- REST/query state: TanStack Query.
- Forms: React Hook Form with Zod validation.
- Socket client: `socket.io-client`.
- Tests: Vitest, React Testing Library, and Playwright for browser/responsive QA when added.
- Styling: project-local CSS modules or Tailwind CSS are both acceptable; choose one implementation path and keep design tokens centralized. If no repo standard exists, Tailwind CSS is recommended for fast responsive implementation with a small token layer.

Alternatives considered:

- Next.js.
  - Useful for server rendering and full-stack routes.
  - Rejected for MVP because this is an authenticated operations app with no SEO requirement.
- Plain React without query/cache layer.
  - Less dependency surface.
  - Rejected because auth, pagination, update rollback, and realtime merge behavior benefit from explicit data state handling.
- Backend-rendered admin pages.
  - Fewer frontend moving parts.
  - Rejected because realtime interactions, responsive app shell, and future admin growth fit a SPA better.

### Auth Model

Default MVP auth policy:

- Keep access token in memory for API and Socket.IO use.
- Persist refresh token only if the backend refresh contract and security policy are already enabled for this environment.
- If refresh support is incomplete during early implementation, keep token storage temporary and document hardening before production.
- On `401`, clear auth state, disconnect socket, and return to `/login`.
- On `403`, keep the session but show a forbidden state.

No plain device token returned by reissue may be stored in auth state, persisted storage, query cache, browser logs, or telemetry.

### Data Model

REST `Computer`:

```typescript
type ComputerStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

interface Computer {
  id: string;
  tenantId: string;
  name: string | null;
  macAddress: string;
  status: ComputerStatus;
  lastSeenAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Runtime `Presence`:

```typescript
interface Presence {
  online: boolean;
  lastSeenAt: string | null;
  source: "snapshot" | "socket-event" | "rest";
  receivedAt: string;
}
```

Merged row model:

```typescript
interface ComputerRowViewModel {
  computer: Computer;
  presence: Presence;
  displayName: string;
  adminStatusLabel: "Active" | "Inactive" | "Blocked";
  realtimeLabel: "Online" | "Offline" | "Unavailable" | "Reconnecting";
}
```

State separation rules:

- `computer.status` is an admin-controlled lifecycle status.
- `presence.online` is volatile realtime state.
- `computer.lastSeenAt` is durable backend data and can be refreshed from REST.
- Socket events update presence state, not the persisted computer object except for visible `lastSeenAt` display hints.

### API Design

Primary REST endpoints:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/computers`
- `GET /api/computers/:id`
- `PATCH /api/computers/:id`
- `POST /api/computers/:id/reissue-token`

Primary Socket.IO contract:

- Handshake auth: `{ clientType: "admin", accessToken }`
- Emit: `admin:watch-tenant`
- Receive: `computer:online`
- Receive: `computer:offline`

When implementing endpoint schemas and event payloads, reference `api-reference.md`.

### Error Handling

REST handling:

- `401`: clear auth, disconnect socket, redirect to `/login`.
- `403`: show forbidden state; do not auto-retry.
- `404`: show missing computer state for detail, or remove stale selected item after confirmation.
- `409`: show conflict feedback when backend returns it.
- `429`: show rate-limit feedback and temporarily disable the triggering action.
- `500`: show error state with retry where safe.

Realtime handling:

- `connecting`: show neutral pending status.
- `connected`: show online socket state and last sync.
- `reconnecting`: show warning state, keep REST data visible.
- `disconnected`: mark realtime as unavailable; do not mark all computers offline destructively.
- `connect_error`: if auth-related, trigger auth recovery or login; otherwise show realtime unavailable.

Mutation behavior:

- Async buttons must show loading and disable duplicate submit.
- Optimistic updates require rollback.
- Reissue token modal must not close automatically before the token is visible.

## System Maps

### Architecture Diagram

```text
Browser
  |
  v
web-admin React SPA
  |
  +-- Router
  |     +-- /login
  |     +-- /dashboard
  |     +-- /computers
  |
  +-- Auth Store
  |     +-- access token in memory
  |     +-- optional refresh token persistence
  |
  +-- REST API Client
  |     +-- /api/auth/*
  |     +-- /api/computers/*
  |
  +-- Query Cache
  |     +-- computers list/detail
  |     +-- mutation rollback/invalidation
  |
  +-- Realtime Client
        +-- Socket.IO /socket.io
        +-- admin:watch-tenant
        +-- presenceByComputerId
```

### Data Merge Map

```text
GET /api/computers items
  |
  v
Computer[]
  |
  +-- merge by id with presenceByComputerId
  |
  v
ComputerRowViewModel[]

Socket events:
computer:online/offline
  |
  v
presenceByComputerId[computerId]
  |
  v
visible rows update without full-table refetch
```

### Route Map

```text
/login
  -> public auth route

/dashboard
  -> protected
  -> KPI strip
  -> realtime panel
  -> computer operations table/cards

/computers
  -> protected
  -> search/filter/sort/pagination
  -> detail drawer/sheet

/computers/:id
  -> protected optional route-backed detail
```

### Responsive Wireframes

Desktop `>= 1280px`:

```text
+-----------+------------------------------------------------+
| Sidebar   | Topbar                                         |
|           +------------------------------------------------+
|           | KPI | KPI | KPI | KPI                          |
|           +----------------------+-------------------------+
|           | Computer table       | Dark realtime panel     |
|           | full columns         | event feed + socket     |
+-----------+----------------------+-------------------------+
```

Tablet `768-1023px`:

```text
+------------------------------------------------------------+
| Topbar with menu button                                    |
+------------------------------------------------------------+
| KPI 2x2 grid                                               |
+------------------------------------------------------------+
| Dark realtime full-width band                              |
+------------------------------------------------------------+
| Computer table with non-critical columns hidden            |
+------------------------------------------------------------+
```

Mobile `375-767px`:

```text
+------------------------------------------------------------+
| Topbar                                                     |
+------------------------------------------------------------+
| KPI horizontal/2-column compact area                       |
+------------------------------------------------------------+
| Realtime compact panel with bounded feed                   |
+------------------------------------------------------------+
| Computer cards                                             |
| - name, MAC, admin status, presence, last seen, action      |
+------------------------------------------------------------+
| Detail opens as full-screen sheet                          |
+------------------------------------------------------------+
```

## Design System

### Visual Direction

Use the approved Hybrid Light App + Dark Realtime Panel direction.

The main UI should be light, restrained, and optimized for long admin sessions. The realtime panel should be dark to create a clear operational signal zone without making the whole app feel heavy.

### Tokens

Light app:

| Token | Value |
| --- | --- |
| Background | `#F8FAFC` |
| Surface | `#FFFFFF` |
| Text | `#0F172A` |
| Muted text | `#475569` |
| Border | `#E2E8F0` |
| Primary | `#1E40AF` |
| Primary hover | `#1D4ED8` |
| Accent/warning | `#F59E0B` |
| Danger | `#DC2626` |
| Success/online | `#16A34A` |

Realtime panel:

| Token | Value |
| --- | --- |
| Background | `#0F172A` |
| Surface | `#1E293B` |
| Text | `#F8FAFC` |
| Muted text | `#CBD5E1` |
| Online pulse | `#22C55E` |
| Reconnecting/warning | `#F59E0B` |
| Offline/error | `#EF4444` |

Typography:

- Use Fira Sans for app text.
- Use Fira Code only for MAC addresses, token preview, IDs, and timestamps.
- Avoid Fira Code for page titles and large headings.

Interaction:

- Buttons: 6-8px radius.
- Cards/panels: 8px radius maximum.
- Transitions: 150-200ms.
- Table row hover must not shift layout.
- Focus rings must be visible.
- Every status indicator must include text, not color alone.
- Avoid decorative gradients, orbs, and non-functional effects.

### Core Components

- `AppShell`: sidebar, topbar, responsive navigation, tenant context.
- `LoginForm`: email/password, loading submit, field errors.
- `KpiStrip`: total, online, offline, blocked/inactive.
- `RealtimePanel`: socket status, event feed, reconnect state, last sync.
- `ComputerTable`: desktop/tablet table with search, filter, sort, pagination.
- `ComputerCardList`: mobile replacement for table.
- `StatusBadge`: admin status and realtime presence labels.
- `ComputerDetailDrawer`: desktop/tablet detail surface.
- `ComputerDetailSheet`: mobile full-screen detail surface.
- `ReissueTokenModal`: confirmation, loading, one-time token reveal, copy action.
- `ForbiddenState`, `ErrorState`, `EmptyState`, `SkeletonTable`.

### Accessibility

- All controls are keyboard reachable.
- Focus order follows visual order.
- Reissue confirmation and detail drawer/sheet trap focus while open.
- Escape closes modal/drawer when no destructive operation is in progress.
- Icon-only buttons require accessible names and tooltips where helpful.
- Color contrast must pass for light surfaces and dark realtime panel.
- Interactive targets are at least 44px high on mobile.

## File Structure

Expected frontend structure:

```text
web-admin/
  package.json
  index.html
  vite.config.ts
  tsconfig.json
  src/
    main.tsx
    app/
      App.tsx
      routes.tsx
      providers.tsx
    auth/
      auth.api.ts
      auth.store.ts
      LoginPage.tsx
      ProtectedRoute.tsx
    computers/
      computers.api.ts
      computers.types.ts
      ComputersPage.tsx
      ComputerTable.tsx
      ComputerCardList.tsx
      ComputerDetailDrawer.tsx
      ReissueTokenModal.tsx
    dashboard/
      DashboardPage.tsx
      KpiStrip.tsx
      RealtimePanel.tsx
    realtime/
      realtime.client.ts
      realtime.store.ts
      realtime.types.ts
      useAdminPresence.ts
    ui/
      AppShell.tsx
      StatusBadge.tsx
      EmptyState.tsx
      ErrorState.tsx
      Skeleton.tsx
      tokens.css
    lib/
      apiClient.ts
      date.ts
      errors.ts
```

Expected tests:

```text
web-admin/src/
  auth/*.test.tsx
  computers/*.test.tsx
  dashboard/*.test.tsx
  realtime/*.test.ts
```

Expected docs:

```text
docs/web_admin/2026-05-26-web-admin-mvp-design.md
docs/SPEC/web_admin/SPEC.md
docs/SPEC/web_admin/api-reference.md
docs/SPEC/web_admin/CLAUDE.md
```

## Development Phases

- [ ] Phase 1: Frontend scaffold
  - Create `web-admin/` with React, Vite, and TypeScript.
  - Add routing, app providers, baseline styling, and design tokens.
  - Add lint/test/build scripts according to the chosen frontend package setup.

- [ ] Phase 2: Auth foundation
  - Implement REST API client.
  - Implement login page and auth state.
  - Implement protected routes and `401` handling.
  - Implement `GET /api/auth/me` bootstrap.

- [ ] Phase 3: App shell and dashboard layout
  - Implement responsive `AppShell`.
  - Implement KPI strip.
  - Implement dashboard page layout for desktop, laptop, tablet, and mobile.
  - Implement loading, empty, error, and forbidden shell states.

- [ ] Phase 4: Computers REST views
  - Implement computers API client.
  - Implement table/card list with search, status filter, sort, and pagination.
  - Implement detail drawer/sheet.
  - Implement status/notes update with rollback.

- [ ] Phase 5: Token reissue flow
  - Implement confirmation modal/sheet.
  - Call reissue endpoint.
  - Reveal returned token once with copy action.
  - Clear token from modal state when closed.

- [ ] Phase 6: Realtime presence
  - Add `socket.io-client`.
  - Implement admin socket connection with access token.
  - Emit `admin:watch-tenant` on connect and reconnect.
  - Merge snapshot/events into `presenceByComputerId`.
  - Implement realtime panel and bounded event feed.

- [ ] Phase 7: Verification and hardening
  - Add unit/component tests for auth, table filters, row merge, update rollback, and token modal.
  - Add mocked realtime tests for online/offline/reconnect behavior.
  - Add browser QA for 1440px, 1024px, 768px, and 375px.
  - Verify no horizontal overflow and visible focus rings.

## Testing Plan

Unit/component tests:

- Login form validates required email/password fields.
- Auth `401` clears session and redirects to `/login`.
- Protected route blocks unauthenticated access.
- Computer REST rows merge correctly with realtime presence.
- KPI counts derive correctly from REST computers and presence map.
- Search/filter/sort/pagination controls produce expected query state.
- Empty, loading, error, forbidden, and rate-limited states render.
- Status update success replaces cached computer data.
- Status update failure rolls back optimistic UI.
- Reissue modal requires confirmation, shows loading, reveals token once, and clears token on close.
- Token text wraps without breaking modal layout.

Realtime tests:

- Socket auth uses `handshake.auth.clientType = "admin"` and the current access token.
- `admin:watch-tenant` is emitted after connect.
- Reconnect emits `admin:watch-tenant` again.
- `computer:online` marks the matching row online.
- `computer:offline` marks the matching row offline.
- Realtime row updates do not trigger full-table refetch per event.
- Disconnected/reconnecting state does not destructively mark all computers offline.

Browser QA:

- Verify 1440px desktop layout: fixed sidebar, full table columns, dark realtime panel visible.
- Verify 1024px laptop layout: compact actions, realtime panel full-width if needed.
- Verify 768px tablet layout: sidebar drawer, KPI 2x2, table hides non-critical columns.
- Verify 375px mobile layout: no horizontal scroll, computer cards, full-screen detail sheet.
- Verify keyboard focus order across login, sidebar, filters, table/cards, drawer, modal, and copy action.
- Verify contrast on light app and dark realtime panel.

Manual verification:

- User/team starts backend and frontend locally.
- User/team runs any DB, Prisma, migration, and server commands manually.
- Login as a tenant `shop_admin`.
- Confirm dashboard loads computers.
- Confirm realtime admin socket connects and watches tenant.
- Confirm a test Client PC socket causes online/offline UI changes.
- Confirm status/notes update persists after refresh.
- Confirm reissue token reveals the new token once and does not show it after modal close.

## Acceptance Checklist

- [ ] `web-admin/` exists with React + Vite + TypeScript.
- [ ] `/login`, `/dashboard`, and `/computers` routes exist.
- [ ] Authenticated routes redirect unauthenticated users to `/login`.
- [ ] `POST /api/auth/login` and `GET /api/auth/me` are integrated.
- [ ] `401` clears auth state and disconnects realtime.
- [ ] `403` shows forbidden state without logging out.
- [ ] Dashboard displays KPI totals, realtime panel, and computer list/table/cards.
- [ ] Computers list supports search, status filter, sort, and pagination.
- [ ] Desktop table and mobile cards are both implemented.
- [ ] Computer detail drawer/sheet shows metadata, status, notes, presence, and timestamps.
- [ ] `PATCH /api/computers/:id` updates only allowed fields.
- [ ] Update failure rolls back optimistic UI.
- [ ] Reissue token flow requires confirmation.
- [ ] Reissue token response reveals plain token once.
- [ ] Plain reissued token is not persisted after modal close.
- [ ] Socket.IO admin connection uses `handshake.auth = { clientType: "admin", accessToken }`.
- [ ] `admin:watch-tenant` emits on connect and reconnect.
- [ ] `computer:online` and `computer:offline` update local presence by `computerId`.
- [ ] Realtime event updates do not refetch the full table per event.
- [ ] Reconnect performs one REST refresh to resync.
- [ ] Loading, empty, error, reconnecting, disconnected, forbidden, and rate-limited UI states exist.
- [ ] Layout passes 1440px, 1024px, 768px, and 375px checks.
- [ ] Focus rings and keyboard navigation are visible and usable.
- [ ] No page has horizontal overflow on mobile.

## Open Questions

- Confirm whether refresh token persistence is enabled for production Web Admin, or whether early development should stay memory-only.
- Confirm final styling implementation path: Tailwind CSS or CSS modules with token CSS.
- Confirm whether `/computers/:id` must be a real deep-link route in MVP or whether a drawer-only detail state is acceptable.
- Confirm whether `staff` should have read-only Web Admin access later; MVP can ignore this.

## References

When implementing API endpoints and Socket.IO payloads, reference `api-reference.md`.

Source and related documents:

- `docs/web_admin/2026-05-26-web-admin-mvp-design.md`
- `docs/SPEC/auth/SPEC.md`
- `docs/SPEC/computers/SPEC.md`
- `docs/SPEC/realtime/SPEC.md`
- `docs/API/auth-api.md`
- `docs/API/computers-api.md`
