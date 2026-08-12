# 06 — Frontend (Web)

Read docs `00`–`05` first. This document defines how the web app (`apps/web`
in the monorepo, `01-ARCHITECTURE.md` §4) is structured, routed, and styled.

---

## 1. Stack recap **[Fixed, per `01-ARCHITECTURE.md` §2.5]**

- **Build tool:** Vite
- **Language:** TypeScript
- **Framework:** React (no SSR — internal tool, no SEO need)
- **Routing:** React Router
- **Server state:** TanStack Query
- **Local/UI state:** React state + Zustand where state needs to be shared
  across distant components without prop drilling (e.g. active filters,
  sidebar/theme state)
- **Styling:** Tailwind CSS + Radix UI primitives (headless, unstyled —
  styling is fully DIY, no pre-baked design system fighting your visual
  direction)
- **Forms:** React Hook Form + Zod for schema validation (shared validation
  schemas live in `packages/shared-types` so the same Zod schema can validate
  on the client and be reused for API DTO validation, avoiding drift)
- **Charts (v1.2):** Recharts

## 2. Folder structure **[Default]**

```
apps/web/src/
├── app/                    # App shell: root layout, providers, router setup
├── pages/                  # Route-level components (one per route)
│   ├── auth/
│   ├── tasks/
│   ├── dashboard/
│   ├── reports/            # v1.2
│   └── admin/               # departments, roles, custom fields, workflows, users
├── features/                # Feature-sliced modules (not just pages)
│   ├── tasks/               # task list, task detail, task form, kanban (v1.1)
│   ├── auth/                 # login flow, session handling
│   ├── notifications/
│   ├── admin/
│   │   ├── roles/
│   │   ├── custom-fields/
│   │   ├── workflows/
│   │   └── departments/
│   └── reports/              # v1.2 report builder
├── components/               # Shared, generic UI components (Button, Modal, Table, etc.)
├── lib/
│   ├── api-client/           # thin wrapper around packages/api-client for web-specific concerns (auth header injection, error toast handling)
│   ├── auth/                 # token storage, refresh logic
│   └── permissions/           # client-side permission-check helpers (UI gating only — never the source of truth, see §5)
├── hooks/                     # shared custom hooks
├── styles/                     # Tailwind config, global styles, design tokens
└── main.tsx
```

Each `features/*` module owns its own components, hooks, and TanStack Query
hooks (e.g. `useTasks()`, `useTaskDetail(id)`) — colocating data-fetching logic
with the feature that uses it rather than a separate global "services" layer,
which keeps the codebase navigable for a build agent working feature-by-feature.

## 3. Routing map **[Default — matches feature scope from `05-FEATURES.md`]**

| Route | Page | Notes |
|---|---|---|
| `/login` | Auth | Google sign-in (SSO added later at same route) |
| `/` | Personal dashboard | "My Tasks" default landing (§1.6, `05-FEATURES.md`) |
| `/tasks` | Task list | Filterable/sortable, department-scoped by RBAC |
| `/tasks/:id` | Task detail | Comments, attachments, activity, custom fields |
| `/tasks/board` | Kanban | v1.1 |
| `/tasks/timeline` | Gantt | v1.1 |
| `/team` | Team/department dashboard | Manager-facing |
| `/reports` | Report list | v1.2 |
| `/reports/:id` | Report viewer | v1.2 |
| `/reports/builder` | Report builder | v1.2 |
| `/notifications` | Notification center | |
| `/settings` | Own profile + notification preferences | |
| `/admin` | Admin home | Only rendered if user has any `*.manage` permission |
| `/admin/departments` | Department management | |
| `/admin/roles` | Role & permission management | |
| `/admin/users` | User management | |
| `/admin/custom-fields` | Custom field management | |
| `/admin/workflows` | Workflow builder (statuses + transitions) | |
| `/admin/priorities` | Priority level management | |
| `/admin/integrations` | Integration settings (SMTP, future webhooks) | |
| `/admin/settings` | Org settings | |

Route-level code splitting (`React.lazy`) per top-level route to keep initial
bundle size reasonable — low effort with Vite, worth doing from the start.

## 4. State management pattern **[Fixed]**

- **All server data flows through TanStack Query.** No manual `useEffect` +
  `fetch` + local state duplication of server data — this keeps caching,
  refetch-on-focus, and optimistic updates consistent app-wide.
- **Mutations use TanStack Query's `useMutation`** with optimistic updates for
  fast-feeling interactions (e.g. drag-and-drop status change on Kanban
  updates the UI immediately, rolls back on API error).
- **Global UI state (Zustand)** limited to genuinely cross-cutting concerns:
  current user/session, active theme, sidebar collapsed state, global toast
  queue. Not used for server data.
- **Form state** stays local to the form component via React Hook Form — never
  lifted into global state.

## 5. Permissions in the UI **[Fixed — authorization is a backend-only concern; the UI has none]**

- **Authorization happens exclusively on the backend, via Guards
  (`03-RBAC-AUTH.md` §2.3), on every request, with no exceptions.** The
  frontend performs zero authorization decisions of its own. This is not a
  convention to lean on loosely — it's an architectural rule: no endpoint,
  mutation, or data access is ever considered "protected" because a button
  was hidden or a route was blocked client-side. If a Guard doesn't enforce
  it server-side, it isn't enforced, regardless of what the UI shows.
- `GET /api/v1/me` returns the current user's effective permission set. The
  **only** legitimate use of that data on the frontend is cosmetic/UX: hiding
  a button the user can't use so they aren't met with a 403 after clicking,
  or hiding a nav item they have no access behind. This is presentation
  logic, not access control, and must never be described, coded, or tested as
  if it were a security boundary.
- Concretely, for the build agent: never write a code comment like "gate this
  route so unauthorized users can't get in" on a frontend route guard — the
  correct framing is "hide this route so unauthorized users aren't shown
  something that will 403." The backend Guard is what actually prevents
  access; the frontend behavior is only ever about not showing a
  confusing/broken experience to someone who was never going to be allowed
  through in the first place.
- This matters more than usual here given how configurable roles are: the UI
  can't hardcode assumptions about what a given role can/can't do, since
  Admins can change that at any time — it must always check the live
  permission set from `/me`, never a role name or a cached assumption.

## 6. Admin configuration UI **[Fixed — this is the most novel part of the frontend]**

Because so much of the system (roles, custom fields, workflows) is
Admin-configurable data rather than fixed code, these screens are effectively
**mini form-builders / rule-builders**, not simple CRUD tables:

- **Role editor:** name, scope (org-wide vs. department), and a permission
  matrix (checkbox grid: permission key × granted/not granted) grouped by
  resource (Tasks, Reports, Users, etc.) for readability.
- **Custom field editor:** field key, label, type selector (drives a
  conditional sub-form — e.g. `select` type reveals an options list editor),
  department assignment, required toggle.
- **Workflow builder:** visual list/board of statuses (add/reorder/edit
  label/category/color) plus a transition matrix or graph editor (from-status
  → to-status, with a permission picker and an approval-required toggle per
  transition). This is the most complex UI in the app — worth allowing extra
  build time relative to other screens.

Because these forms directly shape what every other user sees, they should
include a **live preview** where practical (e.g. previewing the Kanban column
layout while editing a workflow's statuses) to reduce admin configuration
mistakes.

## 7. Accessibility & responsiveness **[Default]**

- Built on Radix primitives specifically because they handle keyboard
  navigation, focus management, and ARIA attributes correctly by default —
  don't bypass them with fully custom unstyled `<div>` interactions.
- Responsive down to tablet width at minimum (many managers may check task
  status from a tablet); full mobile web support is not required since the
  React Native app (`07-FRONTEND-MOBILE.md`) covers the phone use case.

## 8. Error & loading states **[Default]**

- Consistent loading skeleton components per content type (table rows, cards,
  detail panels) rather than a single generic spinner everywhere.
- API errors surface via the shared error envelope (`04-API-SPEC.md` §1) —
  a global error boundary + toast system translates `error.code` values into
  user-facing messages, with a fallback generic message for unmapped codes.
- Network/auth errors (401) trigger an automatic token refresh attempt
  (`03-RBAC-AUTH.md` §1.3) before falling back to redirecting to `/login`.

## 9. Open items from this document

Tracked in `10-OPEN-DECISIONS.md`:
- None new — this document operationalizes decisions already made in prior
  docs rather than introducing new open questions.

## 10. Next document

Proceed to `07-FRONTEND-MOBILE.md` for the React Native app structure and its
shared-code strategy with the web app.
