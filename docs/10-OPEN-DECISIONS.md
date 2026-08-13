# 10 — Open Decisions

Read docs `00`–`09` first. This is the consolidated log of every decision
flagged as **[Open]** across the documentation set, in one place, so nothing
gets lost across ten separate files. Each item links back to where it was
raised for full context.

**How the build agent should handle these:** none of these should block
starting the build. Where an item affects something that must be built before
an answer is likely available, make the most reasonable assumption (the
"Default" noted, where one exists), clearly log the assumption made in code
comments / a build log, and continue. Revisit once the product owner weighs
in. Items are grouped by how urgently they need an answer.

---

## Resolved (kept here briefly for traceability, no action needed)

- **Backend framework** — still technically a Default (NestJS/TypeScript),
  not yet explicitly confirmed; low urgency, listed in "Needs an answer
  early" below.
- **Firebase Auth** — confirmed as the v1 Google Sign-In implementation.
- **Google Sign-In domain restriction** — confirmed: restricted to
  `@econz.net`.
- **Source control provider** — confirmed: GitHub.
- **Task assignment model** — confirmed: single assignee per task; multiple
  people on one piece of work is handled via subtasks.
- **Task priority configurability** — confirmed: admin-configurable, same
  pattern as workflow statuses (`02-DATA-MODEL.md` §2.5b).
- **Transactional email provider** — confirmed: Google SMTP (Google
  Workspace SMTP relay), configured by Admins at runtime, not a deployment
  secret (`01-ARCHITECTURE.md` §2.9a).
- **Admin-configurability of operational settings** — confirmed and
  formalized as an architectural rule: SMTP and future integration
  credentials are DB-stored (encrypted via Cloud KMS) and Admin-UI-editable
  at runtime, not baked into deployment secrets. Only a small bootstrap set
  (DB credentials, JWT signing key, OAuth client secret) remains in Secret
  Manager, since the app needs those before it can even read its own
  DB-stored config. See `01-ARCHITECTURE.md` §2.9a for the full boundary.
- **Domain/DNS** — confirmed: launch on GCP default URLs, custom domain
  added later.
- **Terraform documentation** — confirmed: documented separately in
  `09-TERRAFORM-IAC.md`.
- **Mobile admin scope, authorization model, offline support, app
  distribution** — all confirmed in `07-FRONTEND-MOBILE.md`.
- **Manual account provisioning (GCP billing, OAuth client, Apple/Google
  developer accounts, etc.)** — you have these ready; Claude Code should ask
  for them directly when it reaches the step that needs them, rather than
  this being a pre-build blocker.
- **Dependency blocking (B2 below)** — confirmed: soft warning, not a hard
  block. Moving a task into a 'done'-category status succeeds even with open
  'blocks' dependencies; the API response includes `warnings.open_blockers`
  for the UI to surface (see `apps/api/src/tasks/tasks.service.ts`
  `getOpenBlockers()`). Moved out of the "Needed before" section below.

## A. Needs an answer early (low urgency, safe defaults exist)

### A1. Backend framework: NestJS vs. FastAPI
- **Where raised:** `01-ARCHITECTURE.md` §2.1
- **Default if unanswered:** NestJS (TypeScript) — enables type-sharing with
  web/mobile across the monorepo.
- **Why it matters:** switching after significant backend code exists is a
  costly rewrite, not a config change. Worth a quick explicit confirmation,
  otherwise the build agent proceeds with NestJS.

## B. Needed before the relevant (later-phase) feature is built

### B1. Whether time tracking is mandatory for any department
- **Where raised:** `05-FEATURES.md` §2.1 (v1.1 scope)
- **Plain language:** should logging hours be required for some departments
  (e.g. Development, Support) or always optional for everyone?
- **Default if unanswered:** optional everywhere.
- **Why it matters:** only relevant when v1.1 is being built; no impact on
  v1.

### B3. Additional roles pre-seeded at launch
- **Where raised:** `03-RBAC-AUTH.md` §2.2
- **Default if unanswered:** ship with just Admin/Manager/Employee seeded;
  Admins create department-specific roles (FSR, ISR, Finance Approver, etc.)
  post-launch via the Admin UI.
- **Why it matters:** low-stakes — purely a launch-day convenience, not an
  architectural decision, since all roles are fully editable regardless.

## C. Deferred by design (not urgent, no action needed now)

### C1. API keys / service accounts for third-party integrations
- **Where raised:** `04-API-SPEC.md` §12
- **Plain language:** if an outside system (not your employees) needs to
  connect to the task app's API in the future, it'll likely need its own
  authentication method (separate from a person's login). No such
  integration has been named yet, so nothing is built for this now — it'll
  be scoped when a real integration comes up.

### C2. Internal SSO integration timeline & requirements
- **Where raised:** `03-RBAC-AUTH.md` §5
- **Plain language:** no action needed now. The app is already built so your
  internal SSO can be plugged in whenever it's ready (`03-RBAC-AUTH.md` §1.2)
  — this item just means "we'll scope the actual integration once your SSO
  system has a spec."

### C3. `Organization` singleton table — confirm it's wanted
- **Where raised:** `02-DATA-MODEL.md` §10
- **Default if unanswered:** keep it — negligible cost, keeps a future
  multi-tenant path open without a migration. No response needed unless you
  want it removed.

## D. Assumptions logged during the v1.1 build (not previously flagged as Open)

These weren't called out as `[Open]` in the doc set, but the build hit real
gaps that needed a decision to keep moving. Flagging per the "log the
assumption and continue" guidance at the top of this file.

### D1. `sla.view` / `sla.manage` permission keys
`03-RBAC-AUTH.md` §2.1's permission list doesn't include an `sla.*` key even
though `05-FEATURES.md` §2.2 has Admins defining SLA policies. Added
`sla.view`/`sla.manage` following the same pattern as every other admin
resource. Only Admin holds them by default.

### D2. "Notify assignee's manager" escalation target has no reports-to field
`SLAPolicy.escalation_rules` supports a `notify: "assignee_manager"` target,
but the data model has no manager/reports-to relationship on `User`. Resolved
as "anyone holding `task.assign` within the task's department" — a
reasonable stand-in given the schema, not a literal org-chart manager. A real
reports-to field would be a cleaner fix if this matters in practice.

### D3. Approval chains are single-step in this build
`05-FEATURES.md` §2.5 mentions multi-step approval chains (`step_order`) but
doesn't specify how approvers are assigned per step. Built as single-step
(`step_order = 1`, decidable by anyone holding `approval.approve` in the
task's department) — the schema keeps `step_order` for a future multi-step
extension, but the assignment-per-step logic isn't built.

### D4. Kanban board columns use the org-wide default workflow only
A department running its own `WorkflowDefinition` would need its Kanban
columns resolved from that department's workflow instead of the org-wide
default. Not built since the seeded data only has one org-wide workflow —
flagged as a follow-up once a department-specific workflow actually exists.

## E. Assumptions logged during the v1.2 build

### E1. Materialized aggregates are an app-level cache table, not a Postgres `MATERIALIZED VIEW`
`05-FEATURES.md` §3.6 says "refreshes materialized aggregate tables/views."
Built as `ReportAggregateCache`, a normal table upserted by
`ReportAggregationService` on an interval, rather than a real Postgres
`MATERIALIZED VIEW` + `REFRESH MATERIALIZED VIEW`. Reasons: the metrics need
per-department, per-dimension, per-day rows with independent refresh/retention
semantics (see E2), which is straightforward with an app-level upsert loop
and awkward to express as a single SQL view definition; and it keeps the
refresh job swappable for a real Cloud Scheduler-triggered endpoint at deploy
time without touching the schema. Functionally equivalent for the stated
goal (reads hit a cheap precomputed table, not live `Task`/`TimeLog`
queries).

### E2. Report date-range semantics: snapshot vs. flow metrics
`ReportAggregateCache` keeps one row per metric/department/dimension/day
rather than overwriting a single "current" row, which incidentally gives
every metric a daily history for free. The report run engine
(`reports.service.ts`) splits metrics into two kinds when resolving a
`date_range`: **flow** metrics (`completion_throughput`,
`time_tracked_minutes`) are summed across the range; everything else is
treated as a **snapshot** and reads the latest day's value on or before the
range end. Not spelled out in the doc set — this is the most reasonable
reading of "periodic aggregation" applied to a date-range picker in the
report builder.

### E3. `report.export` isn't granted to the seeded Manager role by default
The seeded Manager role gets `report.view` + `report.create` (§3.1's
"Managers... see reports scoped to their department(s)") but not
`report.export`, which only Admin holds via the full permission set. Not
specified in the doc; since permissions are Admin-configurable at runtime,
this is a starting default, not a hard limitation — an Admin can grant
`report.export` to any role via the existing Roles admin UI.

### E4. Department dashboard's `recently_created` list stays live
Migrating the v1 department dashboard (§1.6) to the aggregate cache per
§3.6's suggestion only applies to the count/aggregate fields
(`counts_by_status`, `overdue_count`, `workload_by_assignee`) — the
`recently_created` task list is real row data, not a metric, and has no
cached equivalent to reconstruct it from, so it still queries `Task` live.
The personal dashboard (§1.6) wasn't migrated at all: it's inherently a
per-user list view (open tasks, due this week, recently completed), not
aggregate counts, so there's nothing in it that the aggregate cache could
serve — migrating it would just add a cache-staleness window to an
already-cheap, single-user query with no benefit.

## F. Decisions made while applying dev infrastructure

### F1. Web app hosts on Cloud Run, not Cloud Storage + CDN
`08-INFRA-DEPLOYMENT.md` §5 names Cloud Storage + Cloud CDN as the Default
and Cloud Run as an equally valid alternative for hosting the static SPA.
The real dev project (`econz-task-management-app`) enforces Public Access
Prevention (an org policy), which rejects any public bucket IAM binding
outright — best practice here is to respect that policy rather than ask an
org admin to relax it just for this bucket, and an HTTPS Load Balancer
workaround would preserve the policy but pulls in real infra (backend
bucket, URL map, a managed SSL cert wanting a real domain) that contradicts
§7's "no custom domain at launch." Switched to Cloud Run: same deploy
pattern as the API, automatic HTTPS on its own URL, no org policy touched.
See `infra/README.md` §3.

### F2. Cloud SQL public IP enabled for dev, with no authorized networks yet
Requested directly, overriding §3's "no public IP" default for this one
environment. Implemented as an `enable_public_ip` module variable (default
false, so staging/prod keep the documented no-public-IP posture) plus an
`authorized_networks` variable, left empty for now — a public IP with zero
authorized networks exists but is not reachable from anywhere until
specific CIDRs are added once it's known what needs to connect directly
(Cloud Run itself always uses the Auth Proxy/connector regardless of this
setting).

### F3. JWT signing secrets are Terraform-generated, not human-supplied
`01-ARCHITECTURE.md` §2.9a's "bootstrap secrets" framing implies a human
populates these, matching the OAuth client secret's real credential. But a
JWT signing secret is just an arbitrary random string with no external
source of truth — generating it via `random_password` (same as the DB
password already was) removes a manual step with no downside, and avoids a
real chicken-and-egg problem: Cloud Run's deploy validates that every
referenced secret has at least one version at deploy time, so leaving these
null (as originally written) made the very first deploy fail outright.

### F4. "dev" mock auth provider temporarily enabled on the deployed dev API — SECURITY EXPOSURE, revert once Firebase is set up
`AUTH_PROVIDERS` on the deployed `taskapp-api` Cloud Run service is
currently `"google,dev"`, not `"google"` alone as originally deployed. Real
Google Sign-In (`GoogleAuthProvider`, `docs/03-RBAC-AUTH.md` §1.1) is Firebase
Auth-backed and needs a Firebase project added to `econz-task-management-app`
plus a Google sign-in provider enabled in it — the account applying this infra
does not have permission to create that Firebase project. Explicitly chosen
(over the alternative of locking down Cloud Run ingress) as the fastest way to
get the freshly-deployed app reachable at all.

**This is a real, live security exposure, not just a dev-convenience trade-off**:
`DevAuthProvider` (`apps/api/src/auth/providers/dev-auth.provider.ts`) accepts
*any* string containing "@" as a fully-trusted identity token — no password, no
verification, nothing. Since `taskapp-api` is `allow_unauthenticated = true`
(network-level; the app's own JWT auth is what's supposed to gate access) and
is reachable at a public `*.run.app` URL, anyone who has that URL can sign in
as *any* `@econz.net` user, including admins, just by typing their email into
the web login form's "dev sign-in" field.

**Revert as soon as a Firebase project is available**: create/link a Firebase
project (someone with the right GCP org permission), enable Google as a
sign-in provider, add the deployed web URL to Firebase Auth's authorized
domains, wire the frontend's disabled "Sign in with Google" button up to the
Firebase JS SDK, set `FIREBASE_PROJECT_ID` on the API service, then change
`AUTH_PROVIDERS` back to `"google"` only in
`infra/environments/dev/main.tf` and redeploy.

---

## G. Post-launch feature expansion (subtasks, effort/time tracking, org hierarchy, redesign)

Scoped through direct discussion with the user, section by section, before any
of it was built. Building in six dependency-ordered phases; this section
covers decisions made in **Phase 1 (foundations)** so far. Later phases will
add their own subsections here as they land.

### G1. Department hierarchy: Head (1, via `Department.headUserId`) + Manager "reports to" chain (`User.managerId`)
Exactly one Head per department, enforced by `headUserId` being a unique
scalar FK rather than a join table. Every employee explicitly reports to one
Manager via `User.managerId` (self-relation) — a Manager's "team" is this
explicit set, not inferred from task assignment. `Head` and `Management` were
added to `SYSTEM_ROLE_NAMES` alongside the existing `Admin`/`Manager`/`Employee`.
`Head`'s permission bundle equals `Manager`'s — what differs between them is
query *scope* (whole department vs. only direct reports), which is application
logic for a later phase, not a distinct permission key. `Management` is a
genuinely org-wide role (no `departmentOverride`), which — deliberately — needs
zero new code in `rbac.service.ts`: it reuses the existing `hasOrgWideRole`
mechanism that `Admin` already relies on. Its permission bundle is every
viewing (`*.view`) key and no `*.manage` key, matching "sees everything, but
not admin setup/configuration."

### G2. Region + holiday calendars: `User.workCountry`/`workState`, `HolidayCalendar`/`Holiday` keyed by Country+State
Added as **required** fields on `User` — business-day/overdue math has no sane
fallback without a region. Existing seeded users were backfilled to the
literal placeholder value `"Unknown"` in the migration (deliberately obvious,
not a real region, so affected accounts are easy to find). The Admin "invite
user" endpoint (`POST /api/v1/users`) requires `work_country`/`work_state` as
real input. (The gap this originally left — a self-service first SSO login
having nowhere to ask for region — no longer applies: see §G4, self-service
account creation was removed entirely.)

### G3. Role-toggle is a presentation lens, not a second authorization layer
`User.activeRoleId` records which held role the UI is currently framed around.
Deliberately **not** wired into the JWT's permission computation — a Head who
toggles to "Employee" view still holds every Head permission underneath;
switching only changes what nav/dashboard renders, not what the API will
authorize. Reasoned as the safer default (a real role a person holds doesn't
functionally disappear because of a UI preference) and flagged here since the
user didn't explicitly weigh in on this specific subtlety — worth confirming
this reading is correct before Phase 5 builds the switcher UI and per-role
dashboards on top of it. The endpoint to actually set `activeRoleId` and the
frontend toggle itself are not built yet — only the schema column exists so
far.

### G4. Invite-only: self-service account auto-provisioning removed entirely
The app was auto-creating a `User` row on anyone's first successful sign-in
(any provider, including "dev"). Confirmed with the user this is wrong for
this app — it's invite-only, meaning an Admin must create the account (full
name, department, region, roles, manager) via `POST /api/v1/users` *before*
that person can sign in at all, SSO included. `AuthService.exchange()`
(`apps/api/src/auth/auth.service.ts`) now throws `UnauthorizedException` when
no existing `User` row matches the identity token's email, instead of
creating one. A real Google/Firebase identity token is proof of *who someone
is*, not by itself authorization to *have an account* — those are different
questions, and this app answers the second one only through the Admin invite
flow. This also fully resolves §G2's region gap: since there's no more
self-service path, `workCountry`/`workState` are always supplied by the
Admin who creates the account, never defaulted.

## H. Phase 2 — task mechanics (subtasks, on-hold reasons, effort estimates, time-log rules)

### H1. On-Hold reasons via a per-status admin flag, not a hardcoded status key
Subtasks were already fully supported at the schema level from the original
v1 build (`Task.parentTaskId` self-relation, creation already accepted
`parent_task_id`) — the only genuinely new piece was the **hard rule**: a
parent cannot transition into a `done`-category status while any subtask is
still open (`tasks.service.ts`'s `transition()`), verified live end-to-end
(create parent+subtask → blocked at Done → close subtask → parent Done
succeeds). This is a hard block, distinct from the existing task-dependency
soft warning.

Added a new `WorkflowStatus.requiresHoldReason` boolean (admin-configurable
per status, not tied to any specific status key, since workflows themselves
are admin-configurable per department) plus a new admin-configurable
`OnHoldReason` list (org-wide, seeded with Waiting for Customer/Waiting for
Third-Party/Other). A new "On Hold" status was seeded distinct from the
pre-existing "Blocked" — Blocked has no reason-tracking and its meaning is
unchanged; On Hold specifically means waiting on something external, with a
mandatory reason. Resuming from On Hold requires no reason (transition-free,
confirmed with the user).

### H2. Effort estimate gate: a dedicated `requiresEstimateBeforeEntry` flag, not `category === 'in_progress'`
**Caught and fixed live before shipping**: the first implementation gated
the "estimate mandatory before starting work" rule on
`WorkflowStatusCategory.in_progress`, which also covers On Hold, Blocked,
and In Review — so pausing a task via On Hold, or blocking it, incorrectly
also demanded an estimate. Fixed by adding a second admin-configurable
`WorkflowStatus` boolean, `requiresEstimateBeforeEntry`, seeded `true` only
on the literal "In Progress" status. Same reasoning as `requiresHoldReason`
in §H1 — one category covers several distinct semantic states, so gates
need their own explicit flag rather than reusing the category.

Estimate mechanics per direct discussion: set by the assignee (not the
creator), value + unit (hours or days, 1 day = 8 hours for reporting),
self-service editable for 30 minutes after `estimateSubmittedAt`, Admin can
override anytime via the new `task.override_locked_edits` permission
(deliberately not granted to Manager/Head despite them holding
`task.moderate` — the user was explicit this is Admin-only). Every change
is logged to the activity log, including Admin overrides, with an
`is_override` flag — verified live.

### H3. Time-log rules: hours + date only, same 30-minute window, fires-once crossing notification
`TimeLog` gained `createdAt`/`updatedAt` (distinct from the pre-existing
`loggedAt`, which is the date work happened on and can be backdated) to
drive the same 30-minute self-edit window as estimates. The web form takes
hours + a date picker, converting to `minutes` internally — no raw
timestamps, per the user's explicit "time stamp will be very granular and
it will be tough for them."

Crossing the estimate notifies the assignee once — compares total logged
minutes before/after each add or edit against the estimate (converted to
minutes), only firing when the total crosses from at-or-under to over, so
continuing to log time after the estimate is already blown doesn't
re-notify on every entry.

### H4. Seed-script upgrade safety: new WorkflowStatus flags backfill on re-seed, unlike everything else in seed.ts
Every other `upsert` in `prisma/seed.ts` uses `update: {}` deliberately —
existing labels/colors/display-orders are Admin-owned and re-running the
script must never clobber real customization. `requiresHoldReason` and
`requiresEstimateBeforeEntry` are the one exception: they're new Phase 2
system behavior with no Admin UI ever exposing them for editing, so
`update: {}` would have silently left every already-seeded status (e.g. the
live dev environment's pre-existing "In Progress" row) at `false` forever —
the mandatory-estimate/on-hold-reason gates would never actually activate
there without this. Caught before push by re-running seed against a local
DB that already had Phase-1-era rows and checking the actual column values,
not just a fresh install.

---

## How to keep this log current

As the build proceeds and these items get resolved, update this document (or
have the build agent flag it for update) rather than letting answers live
only in chat history or scattered commit messages — this file is meant to
stay the single source of truth for "what's still undecided" for the life of
the project, not just through initial launch.
