# CloudCMS Web Admin MVP Design

Date: 2026-05-26
Status: Approved

## 1. Overview

This design defines the first CloudCMS web admin MVP for tenant admins managing client PCs. The UI is an operations dashboard focused on computer presence, computer management, status updates, and one-time device token reissue.

The design combines:

- `brainstorming`: section-by-section product design and user approval before implementation.
- `ui-ux-pro-max`: Data-Dense Dashboard pattern, accessibility rules, responsive rules, loading/error feedback, and table/detail UX.

The selected direction is **Hybrid Light App + Dark Realtime Panel**.

## 2. Scope

Included:

- Login with email/password.
- Authenticated app shell.
- Computer operations dashboard.
- Computer list with search, status filter, sort, and pagination.
- Computer detail drawer.
- Computer status and notes update.
- Device token reissue flow with one-time token reveal.
- Socket.IO admin presence watch.
- Realtime online/offline row updates.
- Responsive desktop, tablet, and mobile behavior.

Deferred:

- Staff/user management.
- Tenant settings beyond tenant display context.
- Super-admin multi-tenant views.
- Sessions, usage, URL rules, lock-screen assets, subscriptions, and reporting.
- Persistent realtime event history.

## 3. Product Structure And Layout

The MVP is an admin operations app, not a marketing page. The first authenticated screen is the Computer Operations Dashboard.

Layout:

- Sidebar: CloudCMS identity, `Dashboard`, `Computers`, and tenant name/code near the bottom.
- Topbar: page title, realtime connection state, refresh action, and user menu.
- KPI strip: total computers, online, offline, and blocked/inactive.
- Dark realtime panel: socket state, recent online/offline events, and last sync time.
- Computer table: name, MAC address, admin status, realtime presence, last seen, notes preview, and actions.
- Computer detail drawer: metadata, realtime state, notes, status update, and token reissue.

Responsive layout:

- Desktop: sidebar fixed, dashboard uses a wide grid, and the table shows full columns.
- Tablet: sidebar becomes a drawer, KPI cards use a 2x2 grid, and the realtime panel becomes a full-width band.
- Mobile: table becomes compact computer cards, and the detail drawer becomes a full-screen sheet.

## 4. Visual System

The main app uses a light operations interface for long-running admin work.

Light app tokens:

- Background: `#F8FAFC`
- Surface: `#FFFFFF`
- Text: `#0F172A`
- Muted text: `#475569`
- Border: `#E2E8F0`
- Primary: `#1E40AF`
- Primary hover: `#1D4ED8`
- Accent/warning: `#F59E0B`
- Danger: `#DC2626`
- Success/online: `#16A34A`

Realtime panel tokens:

- Background: `#0F172A`
- Surface: `#1E293B`
- Text: `#F8FAFC`
- Muted text: `#CBD5E1`
- Online pulse: `#22C55E`
- Reconnecting/warning: `#F59E0B`
- Offline/error: `#EF4444`

Typography:

- Use Fira Sans for app text.
- Use Fira Code only for technical values such as MAC addresses, token preview, IDs, and timestamps.
- Avoid Fira Code for large headings so the app does not feel like a developer-only tool.

Interaction tone:

- Buttons use 6-8px radius.
- Cards and panels use 8px radius.
- Table row hover is subtle and does not shift layout.
- Transitions use 150-200ms.
- Focus rings must be visible.
- Status always includes both visual marker and text label.
- Avoid decorative gradients, orbs, and non-functional visual effects.

## 5. Screens And Data Flow

Routes:

- `/login`: email/password login using `POST /api/auth/login`, then `GET /api/auth/me`.
- `/dashboard`: primary operations view using `GET /api/computers` and Socket.IO admin presence.
- `/computers`: management-focused computer list with filtering, search, sort, and pagination.
- `/computers/:id` or detail drawer: computer detail using `GET /api/computers/:id`.

REST flow:

- Login stores access and refresh tokens.
- Current user and tenant context come from `/api/auth/me`.
- Computer list comes from `GET /api/computers`.
- Computer detail comes from `GET /api/computers/:id`.
- Updates use `PATCH /api/computers/:id`.
- Token reissue uses `POST /api/computers/:id/reissue-token`.

Realtime flow:

- Admin socket connects with `handshake.auth = { clientType: "admin", accessToken }`.
- Dashboard emits `admin:watch-tenant`.
- `computer:online` and `computer:offline` update local presence by `computerId`.
- Realtime events update visible rows without refetching the full table.
- On reconnect, the UI calls `admin:watch-tenant` again and refreshes the computer list once to resync.

Frontend view model:

- REST `Computer`: `id`, `name`, `macAddress`, `status`, `lastSeenAt`, `notes`, `createdAt`, `updatedAt`.
- Runtime `Presence`: `online`, `lastSeenAt`, `source`, `receivedAt`.
- Merged row model separates admin status from realtime presence.

## 6. Component Design

Core components:

- `AppShell`: sidebar, topbar, responsive navigation.
- `LoginForm`: email/password fields, loading submit, field-level errors.
- `KpiStrip`: compact status metrics.
- `RealtimePanel`: socket status, event feed, reconnect state, last sync.
- `ComputerTable`: search, filter, sort, pagination, row states, and actions.
- `StatusBadge`: admin status and realtime presence labels.
- `ComputerDetailDrawer`: detail, notes, status update, and reissue entry point.
- `ReissueTokenModal`: confirmation, loading, one-time token reveal, copy action.

State:

- Auth state stores tokens and current user.
- REST data is scoped by route/query.
- Realtime state stores socket connection and `presenceByComputerId`.
- UI state stores filters, selected computer, drawer state, and modal state.

## 7. Error Handling And Feedback

REST errors:

- `401`: clear auth and return to login.
- `403`: show a forbidden state; do not retry automatically.
- `429`: show rate-limit feedback and temporarily disable the action.
- Update failure: rollback optimistic UI and show a clear toast.

Realtime errors:

- Connecting: show neutral pending state.
- Reconnecting: show warning state, not destructive error.
- Disconnected after retry: keep REST data visible and mark realtime as unavailable.

Required UI states:

- Loading skeleton for dashboard and table.
- Empty state when no computers exist.
- Error state with retry action.
- Disabled/loading buttons for async actions.
- Confirmation before reissuing token.
- Token reveal only once after successful reissue.

## 8. Responsive Requirements

Breakpoints:

- Desktop `>= 1280px`: fixed 240px sidebar, 12-column dashboard grid, 4 KPI columns, full table columns.
- Laptop `1024-1279px`: compact sidebar option, realtime panel as a full-width band, action buttons can become icon buttons with tooltips.
- Tablet `768-1023px`: sidebar drawer, KPI 2x2, filters split across rows, hide non-critical table columns.
- Mobile `375-767px`: replace table with compact computer cards; detail drawer becomes a full-screen sheet.

Mobile requirements:

- No horizontal page scroll.
- Interactive targets are at least 44px high.
- Text wraps or truncates with an expansion path for technical values.
- Realtime event feed has a bounded height and expand action.
- Reissue token sheet wraps long tokens and keeps copy action visible.

Verification viewports:

- 1440px desktop.
- 1024px laptop.
- 768px tablet.
- 375px mobile.

## 9. Testing Plan

Unit/component tests:

- Merge REST computer data with realtime presence.
- Auth redirect and `401` handling.
- Table search, filter, sort, empty, loading, and error states.
- Reissue token modal confirm, loading, one-time reveal, and copy action.
- Status update optimistic rollback on failure.

Realtime tests:

- Mock `computer:online` updates the matching row.
- Mock `computer:offline` updates the matching row.
- Reconnect calls `admin:watch-tenant` again.
- Realtime row updates do not trigger full-table refetch.

Browser QA:

- Verify desktop, laptop, tablet, and mobile layouts.
- Verify no horizontal overflow.
- Verify keyboard focus order.
- Verify focus rings on buttons, filters, rows, menus, drawer, and modal.
- Verify contrast on light app surfaces and dark realtime panel.
- Verify loading, empty, error, reconnecting, and rate-limited states.

## 10. Open Questions

- Confirm frontend stack before implementation. Recommended default: React + Vite + TypeScript.
- Confirm whether the first implementation should create a new `web-admin/` directory.
- Confirm whether the MVP needs refresh-token persistence across reloads or memory-only auth during early development.

