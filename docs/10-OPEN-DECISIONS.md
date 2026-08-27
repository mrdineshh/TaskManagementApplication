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

### F4. "dev" mock auth provider on the deployed dev API — proven closeable (§M4), deliberately still open for role-based testing
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

**Status: proven, not yet enforced.** Real Google Sign-In confirmed working end-to-end in the
deployed dev environment (user tested it directly) — `AUTH_PROVIDERS` was briefly reverted to
`"google"` alone, then deliberately put back to `"google,dev"` at the user's request: testing
multiple roles (Admin/Manager/Head/Employee) against the seeded dev accounts needs dev sign-in,
since that isn't achievable through one person's real Google account. See §M4 for the full
story. **The exposure is real and known-accepted for now**, not forgotten — re-close it (see
git history around this line for the exact prior `"google"`-only state, applied the same way:
edit `infra/environments/dev/main.tf` *and* the live Cloud Run env var, since this deployment
doesn't run `terraform apply`) once role-based testing is done.

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

## I. Phase 3 — overdue vs. over-budget tracking, business-day math, Manager escalation

### I1. Business-day overdue: `countBusinessDaysBetween`, not a raw calendar-date comparison
Confirmed directly with the user: due dates/overdue status skip weekends
and the assignee's regional holidays entirely — a task isn't "later" for a
weekend or holiday sitting between its due date and today, since no work
was expected then. Implemented as `isOverdueOnBusinessDay()`
(`apps/api/src/common/business-days.util.ts`): a task is overdue once at
least one full business day has elapsed *after* its due date, computed
against the **assignee's** region (`HolidayCalendarsService`, Phase 1's
`workCountry`/`workState`) — not the viewer's, since lateness is about
where the work happens. Verified live: a task due 5 days ago correctly
shows as overdue (multiple business days elapsed); the department-level
aggregate cache and the personal dashboard both agree.

Overdue and over-budget (logged hours > estimate, from Phase 2) are
computed together in the aggregation job since they need the same
open-task fetch, but stay two fully independent counts/rates
(`overdue_count`/`overdue_rate` vs. `over_budget_count`/`over_budget_rate`)
— confirmed with the user these should never merge into one "at risk"
flag. Both are now registered in the report metrics catalog, so Head and
Management (who hold `report.view`/`report.create`) can build reports
against them without any further backend work — satisfies "should be in
the report for all the other stakeholders" from the original ask.

### I2. New `OverdueEscalationService`, separate from the pre-existing SLA escalation job
`SLAEscalationService` only fires for tasks with an `SLAPolicy` attached,
based on percent-of-resolution-time elapsed — a different, narrower
mechanism than "this task has a due date and it's passed." Added a
sibling service, same `OnModuleInit`/`setInterval` pattern, that checks
every open task with a due date (SLA policy or not), and notifies the
assignee's Manager (`User.managerId`) the first time it goes business-day
overdue — deduped via an `overdue_escalated` activity log entry so it
fires once, not every check cycle. Verified live including the dedup: a
second escalation cycle produced no additional notification.

### I3. Fixed a pre-existing workaround now that Phase 1 built the field it was waiting on
`SLAEscalationService`'s `"assignee_manager"` notify target had no real
reports-to field to resolve against when it was built, and fell back to
"anyone holding `task.assign` in the department" with a comment flagging
it as an approximation. Phase 1 added `User.managerId` — the actual field
that comment was waiting on — so this now resolves to the assignee's real
Manager directly. Found while building §I2's escalation job right next to
it; fixed rather than leaving two different "who's the manager"
approximations side by side in the same module.

---

## J. Phase 4 — employee scorecard + department leaderboard

### J1. Six sub-scores normalized to 0-100, blended into one overall score via admin-tunable weights
Each of the six confirmed parameters (on-time completion rate, estimate
accuracy, volume, overdue count, over-budget count, rework/reopened count)
is computed as its own 0-100 sub-score so they stay individually meaningful
("having separate metrics is good to understand the bifurcation") while
also combining into one `overall_score` for the leaderboard. Weights live
in a new singleton `ScorecardConfig` model (JSON, same pattern as
`OrganizationSettings`) rather than hardcoded — defaults chosen by us per
the user's explicit instruction ("lets configure what we think... is best
and let the admin change and reconfigure it later"):

| Sub-metric | Weight | Rationale |
|---|---|---|
| on_time_rate | 0.25 | Primary reliability signal |
| estimate_accuracy | 0.20 | Directly enables appraisal use — mandatory estimates only pay off if scored |
| volume | 0.15 | Throughput matters but shouldn't dominate quality |
| overdue | 0.15 | Overlaps in spirit with on-time but catches currently-open liabilities too |
| over_budget | 0.15 | Independent failure mode — a task can be on-time yet over-budget |
| rework | 0.10 | Smallest weight: no dedicated "reopened" state exists yet, so this is the least precise signal (see J3) |

Gated by a new `scorecard.manage` permission (Admin-only); every role that
holds `task.view` can read `/scorecards/*` — no `scorecard.view` key exists
because the user was explicit that scorecards are visible to everyone
("anyone can see... transparent system... healthy competition").

### J2. Computed live per [department, start, end] — not built on ReportAggregateCache
`ReportAggregateCache` is a fixed-daily-snapshot system; the user
confirmed scorecards need an arbitrary custom date range ("just a date
range on the overall report would make sense"), which that cache can't
serve. `ScorecardsService.computeDepartmentScorecards()` queries
`Task`/`TimeLog`/`ActivityLogEntry` directly for the requested range,
computing every department member's six sub-scores in one pass — this
also keeps `volume` (scored relative to the department's own top
performer in the same range) consistent between the single-user endpoint
and the leaderboard, since both read from the same computation. Leaderboard
is department-scoped only, never company-wide, per the user's explicit
confirmation ("department based... compete against their department
users").

### J3. Rework/reopened has no dedicated workflow state — detected via ActivityLogEntry
The seeded workflow has no transition path out of a `done`-category status
by default (nothing to "reopen" into), so there's no first-class "this task
was reopened" event to count directly. Detected instead as any
`status_changed` activity entry whose `from` status was done-category and
whose `to` status isn't, attributed to the task's **current** assignee —
not the assignee at the time of the reopen, since historical
assignee-per-status-change isn't tracked. This is a known simplification:
if a task is reassigned after being reopened, the rework charge follows
the new assignee, not whoever actually caused the rework. Verified live end
-to-end: created a task, estimated 4h, logged 3h, drove it through
`in_progress → in_review → done` (`completed_count` went to 1,
`over_budget` stayed clean since 3h < 4h), then reopened it via an
admin-added `done → todo` transition — `reworked_count` correctly went to
1 and the rework sub-score dropped from 100 to 0 (denominator was
`completed_count(0) + reworked_count(1)` once the reopen zeroed out
`completedAt`).

### J4. ~~Known gap: Zod validation errors surface as 500, not 400~~ — fixed, see §M1

---

## K. Phase 5 — role-adaptive navigation + dashboards

### K1. Active-role resolution lives in one place, mirrored (not shared) between API and web
`RbacService.resolveActiveRoleName(userId)` (new) is the single source of truth: the user's
explicitly toggled `User.activeRoleId` if it's still a role they hold, else the
highest-priority role among everything they hold (`Admin > Management > Head > Manager >
Employee`), else `null`. It is deliberately NOT put in the JWT — the user confirmed the
toggle is presentation-only and must never require a token reissue, so every role-aware
endpoint re-resolves it fresh per request from the DB. The web app carries a small mirror,
`resolveActiveRoleName()` in `apps/web/src/lib/auth/roles.ts`, used only to decide nav
visibility — it can never grant access the backend wouldn't also grant, since both read the
same `User.activeRoleId` + `UserRole` rows and apply the same priority order.

### K2. One `GET /dashboards/team` endpoint, four different response shapes by active role
Rather than building four separate pages/endpoints, a single endpoint switches on
`resolveActiveRoleName()`:
- **Manager** → `scope: 'manager'`, `members` = explicit direct reports only
  (`User.managerId = caller`), never the whole department — confirmed directly: "the manager
  is restricted to view only his team members details."
- **Head** → `scope: 'department'`, whole department (`Department.headUserId = caller`, with
  a `departmentIds[0]` fallback if headUserId was never set) plus a `by_manager` breakdown —
  "the head should see the entire managers and the whole team's view filtered by managers."
- **Management/Admin** → `scope: 'org'` (every department's summary, clickable) when no
  `department_id` is passed, or the same `scope: 'department'` shape as Head's for any single
  department when one is — "across departments... down to the individual user level."
- **Employee** (or unresolved) → `scope: 'none'` — no team to show; the nav hides this page
  for them rather than rendering an empty state.

All four share one `computeTaskStats(assigneeIds)` helper (status breakdown, business-day
overdue, over-budget) so the same math (§I1) backs every scope instead of four parallel
reimplementations. Verified live against all four roles with real seeded users (Manager saw
only their 1 direct report's 5 open tasks; Head saw the whole department broken down by both
Managers in it, including one with zero reports' worth of tasks; Management saw every
department's summary and could drill into "Development" for the same department-shape
response; the Employee call correctly returned `scope: 'none'`).

### K3. Toggling role hides nav items but never blocks a direct URL — matches the "presentation only" decision from §G3
The `Team` nav item is shown only when the active role is Manager/Head/Management/Admin; the
`Admin` nav item is shown only when the active role is specifically `Admin` (tightened from
the previous "show if the user holds any `.manage` permission" — toggling to Employee now
visibly hides Admin's own admin-area link, so an Admin previewing another role's experience
sees what that role actually sees). Neither is a real access boundary: typing `/admin/...`
directly still works precisely as far as the permissions the user's *other* held roles grant
(e.g. a Manager+Employee dual-role user can still view — not edit — `/admin/departments`,
since `department.view` is Manager's, not Employee's) — this is the existing, pre-Phase-5
pattern (`AdminLayout` has no route guard; per-action permission checks are the only real
enforcement), left as-is rather than introducing a new, inconsistent guarding mechanism just
for this phase.

### K4. Breadcrumbs are derived from the route tree, not hand-authored per page
`Breadcrumbs.tsx` splits the URL path and maps each static segment through one label table
(kept in sync with `App.tsx`'s routes and `AdminLayout.tsx`'s section list) rather than each
page declaring its own crumb — so a route rename can't silently leave a stale breadcrumb
behind. The one dynamic case, a task's title on `/tasks/:id`, reuses the same cached
`useTask()` query the task detail page itself already fires, so the breadcrumb never causes
an extra request. `/reports/:id` deliberately does NOT resolve a report's name the same way
(logged as a known, minor gap) — scoped out to keep this phase's surface area contained;
it shows the raw path segment (the report's UUID) instead of its title.

### K5. Home ("/") stays `MyTasksPage` for every role; only the `Team` page is role-adaptive
Rather than building distinct landing dashboards for all five roles, personal task ownership
("my own open tasks, overdue, over budget") is treated as universally relevant regardless of
which role is active — everyone including Heads/Management/Admin can be a task assignee too.
The role-differentiated experience lives entirely in `/team` (§K2) and the nav/sidebar itself.
This is a scope call, not something explicitly confirmed with the user; flagged here in case
five fully distinct landing dashboards turn out to matter more than assumed once this is in
front of real users.

---

## L. Phase 6 — full visual redesign (dark mode, design system)

### L1. Richer indigo/teal palette replacing the flat 5-shade blue
The original `brand` color was five hand-picked shades of a single blue with big gaps
between them (50/100/500/600/700, nothing else) — functional but exactly the "soulless and
monotonous" the user called out. Replaced with a full 50-950 indigo scale plus a secondary
`accent` (teal) scale reserved for sparing highlight use (leaderboard emphasis, positive
deltas) rather than a second primary color competing with the brand indigo.

### L2. Dark mode via Tailwind's `dark:` class strategy, not a runtime CSS-variable token system
Considered a CSS-custom-property token layer (`bg-surface`, `text-ink`, etc.) but chose
plain Tailwind `dark:` variants directly on existing utility classes instead — it required no
renaming of any existing class across ~40 files (lower regression risk) and is the more
common, more debuggable approach for an app this size. `<html class="dark">` is toggled by
`useTheme()` (`apps/web/src/lib/theme/useTheme.ts`); an inline script in `index.html` applies
the same resolution *before* React mounts, to avoid a flash of the wrong theme. Preference
(`light`/`dark`/`system`) persists to `localStorage`; `system` is only the pre-first-toggle
default, matching `prefers-color-scheme` live until the user picks explicitly.

### L3. The dark-mode sweep was scripted, not hand-edited file by file
With ~40 page/component files each carrying many repeated Tailwind color utilities
(`border-slate-200`, `text-slate-500`, `bg-white`, …), hand-editing every occurrence
consistently would have been both slow and error-prone (easy to pick a slightly different
dark shade for the "same" light color in two different files). Instead, a one-off script
(not committed — scratch tooling) walked every `.tsx` file and, for a fixed light→dark shade
mapping, appended the `dark:` companion class immediately after each matching utility,
correctly preserving any variant prefix chain (`hover:`, `focus:`, etc.) so
`hover:bg-slate-100` became `hover:bg-slate-100 dark:hover:bg-slate-800` rather than an
always-on dark background. This guarantees the same light-to-dark shade mapping was applied
identically everywhere, which hand-editing could not.

### L4. Global base-layer fix for native form controls, found via live dark-mode screenshots
The scripted sweep only touches classes that literally appear in a file's `className`
strings — it can't fix an element that has NO explicit background class at all and is
instead relying on the browser's native white `<input>`/`<select>`/`<textarea>` background.
Caught this live: a department-filter `<select>` on the Kanban board rendered as a glaring
white box on an otherwise dark page. Rather than auditing all ~32 `<select>`s and every
`<input>`/`<textarea>` in the app individually for a missing `bg-white`, added one
`@layer base` rule in `index.css` (`input, select, textarea { @apply bg-white ... dark:bg-slate-900 ... }`)
that covers every current and future form control at once; any element with its own explicit
`bg-*` utility still wins per Tailwind's layer ordering. Also set `color-scheme: dark` on
`.dark` so native browser chrome (date-picker icon/popup, scrollbars) matches the theme
instead of always rendering light-mode-native widgets — verified live on the Scorecard page's
date-range inputs.

### L5. Subtle motion, deliberately minimal — no new dependency added
"Polished/premium with subtle motion" was interpreted narrowly rather than reaching for an
animation library: a short `fade-in` keyframe (`Shell.tsx` keys the route-content wrapper by
`location.pathname` so it replays on navigation), a `pop-in` on the login card, `transition-colors`
on nav items and the sidebar's `transition-[width]` on collapse/expand, and
`prefers-reduced-motion` respected globally via a `@media` rule that collapses all
animation/transition durations to near-zero. No `framer-motion` or similar was added — plain
CSS covers everything asked for here without a new dependency.

### L6. `Badge` gained a same-color border, for contrast safety across both themes
`Badge` renders arbitrary Admin-chosen hex colors (per-status, per-priority) at a fixed low
opacity — a color picked to read well against a white surface has no guarantee of reading
well against `slate-900`, and vice versa, since Admins never see a dark-mode preview when
picking it. Added a thin `border` in the same color at higher opacity so every badge has a
visible edge on both themes even in the rare case the low-opacity fill alone is too faint —
a robustness fix rather than something tied to one specific page.

### L7. Scope: systematic sweep + representative spot-checks, not a pixel review of every page
Every `.tsx` file under `apps/web/src` went through the same scripted, consistent
light→dark mapping (§L3) and the same global form-control fix (§L4), so coverage is
complete in that sense. What did NOT happen: a manual pixel-level review of all ~30 pages
individually. Verified live instead — via Playwright screenshots in both themes — on a
representative spread covering every UI pattern in the app (dense data tables, kanban
drag-cards, forms with every input type, badges/pills, the leaderboard, breadcrumbs, the
collapsed sidebar, the role switcher, and the login page): My Tasks, All Tasks, Kanban,
Timeline, Scorecard, Team (all scopes), Reports, Notifications, Settings, Admin overview,
Admin Scorecard Weights, and a full Task Detail page. No visual defects found beyond the one
form-control bug already fixed in §L4. Flagging this as the honest scope boundary rather than
claiming exhaustive per-page verification.

### L8. ~~Mobile app intentionally untouched in this phase~~ — closed, see §M2
The user's "soulless and monotonous" complaint was about the web app specifically (they were
using it live in a browser); the Expo mobile app already went through its own design-system
redesign earlier in this project (tasks #42-50: theme + UI primitives, navigation, and a
per-screen redesign of Login/MyTasks/TaskList/TaskDetail/TeamDashboard/Notifications). Phase 6
did not touch mobile — no new mobile screens were added since that redesign (Scorecard/Team
role-adaptive views from Phases 4-5 are web-only so far), so mobile parity with those two new
web pages is a real, currently-unaddressed gap if mobile parity turns out to matter.

---

## M. Post-launch gap fixes

### M1. Fixed — Zod validation errors now return a clean 400, not a raw 500 (closes §J4)
Several controllers (`ScorecardsController.updateConfig()`, `OrganizationController.update()`)
validate their body with a shared-types zod schema's `.parse(body)` directly rather than
going through Nest's class-validator `ValidationPipe` — an uncaught `ZodError` previously fell
through to `AllExceptionsFilter`'s generic `Error` branch and came back as a
`500 INTERNAL_SERVER_ERROR` with the raw zod issue array dumped into the message.

Fixed at the source, not per-controller: added a `ZodError` branch to the existing global
`AllExceptionsFilter` (`apps/api/src/common/filters/all-exceptions.filter.ts`) that maps it to
`400 VALIDATION_ERROR` with a readable `"path: message"` summary plus the full issue array
under `details.validation` — matching the shape class-validator errors already return. This
fixes every current and future `.parse()` call site at once, not just the two that surfaced
it, without requiring each controller to wrap its own call in a try/catch.

Verified live: re-ran the exact two payloads that previously produced a 500 (scorecard
weights not summing to 1; `organization-settings` with `timezone` as a number) — both now
return a clean `400` with a readable message. Confirmed no regression on the pre-existing
class-validator DTO path (`POST /tasks` with a missing/invalid body) and on a valid
scorecard-weights payload (still `200`).

### M2. Fixed — mobile parity gap (closes §L8)
Closes the mobile-parity gap flagged when Phase 6 shipped: the Expo app had its own,
earlier, separate redesign (tasks #42-50) that predates web's Phase 6 palette/dark-mode work
and Phases 4-5's Scorecard/role-adaptive Team pages, so it had drifted behind on both looks
and features. Brought fully current in one pass:

- **Dark mode.** React Native has no CSS custom-property equivalent to the `dark:` class
  trick web's Phase 6 used, so every color has to be resolved per-render instead of baked
  into a module-level `StyleSheet.create()`. Added `src/theme/ThemeProvider.tsx` — a
  `useAppTheme()` hook exposing `{ colors, typography, shadow }` for the current scheme —
  and converted every component/screen's static `colors`/`typography` import to call the
  hook and build its `StyleSheet` inline. Preference (`light`/`dark`/`system`) persists via
  `expo-secure-store` (already a dependency, for the session refresh token) rather than
  adding `AsyncStorage` as a new one, mirroring web's `useTheme.ts` in spirit.
- **Palette.** Replaced the flat single-blue scale with the same indigo/teal system as web's
  `tailwind.config.js`, resolved into concrete light/dark hex pairs (RN can't consume
  Tailwind classes) instead of a token-name mapping.
- **Scorecard screen.** New tab (`ScorecardTab`, trophy icon) — own overall score + six
  sub-scores, department leaderboard with the own-row highlighted — hitting the same
  `/scorecards/me` and `/scorecards/leaderboard` endpoints web's Phase 4 page uses. Fixed to
  a 30-day range rather than reproducing web's free-form date pickers, keeping this one
  glanceable screen instead of a form.
- **Role-adaptive Team tab.** Rewrote `TeamDashboardScreen` to call `/dashboards/team` (the
  same Phase 5 endpoint web's Team page uses) and render per-scope — Manager sees direct
  reports only, Head/Management see a department or org-wide summary with drill-down —
  replacing the old fixed department-picker that showed identical content to every role.
- **My Tasks dashboard.** Added an "Over budget" stat card next to Overdue — the
  `personal` dashboard endpoint already returned `over_budget_count` since Phase 3, mobile
  just wasn't displaying it.

**Update — Expo now runs, and three real, pre-existing bugs got fixed along the way (§M3).**
The initial version of this fix shipped without live verification (the Expo dev bundler
wasn't reachable in the sandbox). Asked to actually run it before merging, three genuine,
previously-undiagnosed bugs were found and fixed — none introduced by this change, all three
would have blocked *anyone* from running `expo start` on this project, on any machine. See §M3.

### M3. Fixed — Expo genuinely would not start on this project at all, on any machine
Asked to actually run the mobile app before merging §M2. The very first `expo start` attempt
failed, and the failure had nothing to do with the mobile-parity change — it was three
separate, pre-existing structural bugs, apparently never caught because (per §M2's own
original disclosure, and #42-50's) nobody had run this Expo app end-to-end before. Each was
diagnosed from the actual Metro/Expo CLI source, not guessed at:

1. **`src/app` collides with Expo CLI's Router auto-detection.** Modern `@expo/cli`
   unconditionally treats a directory literally named `src/app` as an Expo Router root
   (`getRouterDirectory()` in `@expo/cli`'s own source — a bare filesystem check, no
   `expo-router` dependency required to trigger it). This project's `src/app/Navigation.tsx`
   predates Expo Router entirely and has nothing to do with it — the name collision alone
   was enough to break entry resolution. Fixed by renaming `src/app` → `src/navigation`
   (`git mv`, plus updating the 4 files that imported `TasksStackParamList` from it).
2. **`package.json`'s `main` field assumed a non-hoisted install.** `"main": "node_modules/expo/AppEntry.js"` is Expo's standard scaffold value, but it's a literal relative
   filesystem path — correct only when `expo` lives inside this package's *own*
   `node_modules`. In this npm workspace, `expo` is hoisted to the repo root, so that path
   pointed nowhere. Worse, Expo's shared `AppEntry.js` template itself does
   `import App from '../../App'`, a relative reach-up that only works when the file
   physically sits inside the consuming package's node_modules — hoisting breaks that
   assumption too, independent of the `main` field. Fixed the standard, Expo-documented way
   for monorepos: added a local `apps/mobile/index.js` (`registerRootComponent(App)` against
   a local `./App` import) and pointed `main` at it directly, sidestepping hoisting entirely.
3. **The committed lockfile pinned an incompatible nested `react-native`.** `package-lock.json`
   had `node_modules/expo/node_modules/react-native` pinned to `0.86.2` — despite `expo`'s own
   `package.json` declaring `"react-native": "0.74.5"` (identical to this project's top-level
   pin, which should have deduped to a single copy with zero nested duplicates). That stray
   0.86.2 copy's `index.js` uses syntax (`} as ReactNativePublicAPI;`, a type assertion in a
   plain `.js` file) this project's Metro/Babel config can't parse, hard-crashing every bundle
   attempt. Confirmed this wasn't sandbox-specific contamination by reproducing it from a full
   `rm -rf node_modules && npm install` — a genuinely fresh install, matching what the user's
   own machine would produce, hit the identical crash. Fixed durably with `npm dedupe`
   (removed 1300 lines of redundant nested-dependency lockfile entries), re-verified with
   another full clean reinstall from scratch.

Also fixed, surfaced only after the above three: a TypeScript error in the three mobile files
using `<>...</>` fragment shorthand (`App.tsx`, `TeamDashboardScreen.tsx`,
`ScorecardScreen.tsx`) — the classic RN JSX transform needs `React` in scope for fragment
shorthand, and none of the three had an explicit `import React from 'react'` (relying on
named imports only). Added it to all three.

**Verified, for real this time:** with every fix above applied and node_modules rebuilt from
scratch, `expo start` serves a working Metro dev server; requested a full bundle for both
`platform=ios` and `platform=android` directly against the running server (the same request
Expo Go itself makes) — both compiled with **zero errors and zero warnings**, 1122 and 1127
modules respectively. Grepped the compiled output to confirm the new Scorecard screen, the
`ThemeProvider`/`useAppTheme` code, and the role-adaptive Team dashboard are actually present
in the shipped bundle (163+ matches), not stale cache. Re-ran the entire sequence after a full
`rm -rf node_modules && npm install` to confirm every fix is durable and not an artifact of
this session's own node_modules history. `tsc --noEmit` passes clean across every package in
the monorepo (api, api-client, shared-types, web, mobile) after all fixes.

**What's still not verified:** actual on-screen rendering. A successful, error-free,
zero-warning Metro bundle compile is strong evidence the code is structurally correct (every
import resolves, no syntax errors, no React version conflicts, all new screens are reachable
from the navigator) — but it is not the same as seeing the app render in Expo Go or a
simulator/emulator, neither of which exists in this sandbox. Genuinely worth a quick real
device/Expo-Go check before this reaches real users, though the risk profile is now much
lower than an untested change: the JS bundle Expo Go would load is now proven to build clean.

### M4. Google Sign-In wired end-to-end on web — WORKING IN THE DEPLOYED DEV ENVIRONMENT (proves §F4 closeable; kept open for role testing)
`GoogleAuthProvider` (backend) has existed since #4 but nothing ever called it — both frontends
had a permanently-disabled "Sign in with Google" placeholder, and `FIREBASE_PROJECT_ID` was
missing from all three Terraform environments' `env_vars` entirely (not even an empty
placeholder — the "google" provider would have thrown `UnauthorizedException` at runtime in
every deployed environment even with a correct real value elsewhere). Fixed all of it:

- **Terraform**: added a `firebase_project_id` variable (default `""`) and
  `FIREBASE_PROJECT_ID = var.firebase_project_id` to `env_vars` in `infra/environments/{dev,staging,prod}/main.tf`.
  Not secret — `verifyIdToken()` only uses it to check the token's `aud` claim against Google's
  *public* JWKS endpoint, no IAM/ADC project match required — so a plain variable is correct,
  no Secret Manager entry needed. (`GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`, by
  contrast, turned out to be dead: grepped the entire backend and nothing reads either — left
  as-is rather than touching already-applied Secret Manager resources out of scope.)
- **Web** (`apps/web/src/lib/firebase/client.ts`, `LoginPage.tsx`): added the `firebase` dep,
  `signInWithGoogle()` via `signInWithPopup` + `GoogleAuthProvider`, wired to the previously-dead
  button. Reads `VITE_FIREBASE_{API_KEY,AUTH_DOMAIN,PROJECT_ID,APP_ID}` — a public, embeddable
  config, not a secret — with an `firebaseEnabled` guard that keeps the button honestly disabled
  ("pending GCP setup") until all four are set. Threaded through as new Docker build args
  (`apps/web/Dockerfile`, `cloudbuild.yaml`) alongside the existing `VITE_API_BASE_URL` pattern,
  since Vite bakes these in at build time, not runtime.
- **Mobile** (`apps/mobile/src/screens/auth/LoginScreen.tsx`): added `expo-auth-session` +
  `expo-web-browser` + `expo-crypto` (SDK-51-pinned versions read from `expo`'s own
  `bundledNativeModules.json`, since the registry-version-check `expo install` step fails in
  this sandbox the same way §M3 already worked around). Uses
  `Google.useIdTokenAuthRequest({ webClientId })` — the chosen approach from the earlier
  discussion, reusing the single Web OAuth Client ID rather than a native client (no EAS custom
  dev client / SHA-1 fingerprint needed, still works inside plain Expo Go via Expo's auth
  proxy). Client ID read from `app.json`'s `extra.googleOAuthClientId`, mirroring the existing
  `extra.apiBaseUrl` convention.
- **Verified the same way as §M3**: both apps typecheck clean; re-ran the iOS/Android Metro
  bundle-compile check after adding the new deps (both still 200 OK, zero errors) and grepped
  the compiled output to confirm the new Google sign-in code is actually present in both
  platform bundles, not stale cache.

**Why this landed as code-complete but not flag-flipped**: the Firebase project created so far
(`task-management-e12d2`) was created under a personal Google account, not the official one the
real GCP infra (`econz-task-management-app` et al.) lives under — caught before any secrets were
committed. Decision: keep building the integration against env vars (which don't care which
Firebase project supplies the values) rather than block on resolving ownership first, since
none of the code above hardcodes project-specific values.

**Web: proven working, `dev` kept enabled alongside it by choice.** All of the following done
and confirmed working — the user signed in through the real "Sign in with Google" button on the
deployed dev web app:
1. ~~Provision a Firebase project~~ Done: `task-management-applicat-5e5d6` (backing GCP project
   `883580624459`).
2. ~~Get the Web OAuth Client ID.~~ Done: `883580624459-ta8jj9sfs9it1dl02pncv7a84bgud5th.apps.googleusercontent.com`.
3. ~~Confirm authorized domains.~~ Done — plus one caught live: the deployed web app's real URL
   is Cloud Run's auto-generated `taskapp-web-717975906785.us-central1.run.app`, not `econz.net`
   (no custom domain mapping exists yet), which the original authorized-domains list didn't
   cover — hit `auth/unauthorized-domain` on the first real attempt, fixed by adding that exact
   `*.run.app` host to Firebase Authentication → Settings → Authorized domains. Worth remembering
   for staging/prod later: each Cloud Run environment's own `*.run.app` host needs adding too,
   independent of any custom domain.
4. ~~Set the real values in the deployed environment~~ Done, via the manual Cloud Run
   Console + Cloud Build trigger path this project's actual deploys use (not `terraform apply`):
   `FIREBASE_PROJECT_ID` added to `taskapp-api`'s env vars, `VITE_FIREBASE_*` added to the
   `deploy-web-manual` trigger's substitutions and rebuilt.
5. Flip `AUTH_PROVIDERS` back to `"google"` alone — done *and reverted*. Briefly set to
   `"google"` only in `infra/environments/dev/main.tf` once (5) was proven working, then the
   user asked to keep `"dev"` enabled a while longer: testing multiple roles
   (Admin/Manager/Head/Employee) against the seeded dev accounts isn't achievable through one
   person's real Google account. Back to `"google,dev"` — see §F4 for current status and how to
   re-close it later. `firebase_project_id`'s default is still updated to the real value
   regardless, so a future `terraform apply` doesn't revert that part.

**Mobile: still open — the auth-proxy plan above was wrong, corrected once discovered.** The
original plan (add `https://auth.expo.io/@<owner>/<slug>` as an Authorized redirect URI) doesn't
work: read `expo-auth-session@5.5.2`'s own source (the version SDK 51 pins) and confirmed
`makeRedirectUri()` no longer calls into `SessionUrlProvider` at all — the proxy code is present
but dead, disconnected from the public API. In Expo Go, `makeRedirectUri()` instead falls back to
a per-session `exp://<lan-ip>:8081/...` address that changes every dev-server start, which Google
can't accept as a static Authorized redirect URI either way. Real fix needs a development build
(`eas build --profile development`, not Expo Go) plus a native Android OAuth client (package name
+ signing certificate, no redirect-URI list — Android/iOS client types work differently from Web
ones). User chose to do this rather than defer it.

Also found and fixed a second, independent bug while wiring this up: `LoginScreen.tsx` only ever
passed `webClientId` to `Google.useIdTokenAuthRequest()`. On a real device, `Platform.OS` is never
`'web'`, so the hook looks for `androidClientId`/`iosClientId` instead — undefined, and
`invariantClientId()` throws synchronously inside a `useMemo`, i.e. the whole screen would have
crashed on mount the moment `googleOAuthClientId` went non-empty, before anyone even tapped the
button. Fixed: `app.json` gained `extra.googleAndroidClientId` (empty placeholder, mirroring the
existing web one); `LoginScreen.tsx` now reads it, uses it as the platform id on Android, falls
back to the (harmless, non-functional-for-sign-in) web id only to keep the hook from throwing pre-
configuration, and derives the native redirect scheme Google's Android client type actually
expects — `com.googleusercontent.apps.<client-id-prefix>:/oauthredirect`, not the app's own
package id — from the Android client ID itself, per Expo's current Google-auth guide. Added
`expo-dev-client` (required for `eas build --profile development`) to `package.json` and a new
`eas.json` with `development`/`preview`/`production` profiles (development: internal APK, so it
installs directly on a phone with no Play Store/Apple Developer account needed for this step).

Remaining, blocked on the user: create an Android OAuth client in Google Cloud Console (package
`net.econz.taskapp` + the SHA-1 fingerprint of the EAS-managed development keystore, obtained via
`eas credentials`), then paste the resulting Android Client ID back so it can be set as
`extra.googleAndroidClientId`. No rebuild needed for that last step — development builds load JS
from the Metro dev server at runtime, same as Expo Go, so only genuinely native changes (like
adding `expo-dev-client` itself) require a fresh `eas build`.

**Third bug found and fixed while getting the actual dev build to compile: a monorepo/hoisting
gap in Expo's own Android Gradle scripts, real root cause of the `eas build` failures.** The
first `eas build --profile development --platform android` attempt failed on
`:expo-dev-launcher` with `Process 'command 'node'' finished with non-zero exit value 1`, and on
`:expo` with `Could not get unknown property 'release' for SoftwareComponent container`. Two
plausible-but-wrong fixes tried first and ruled out by identical re-failures: regenerating
`package-lock.json` (it was genuinely stale — `expo-dev-client` had been hand-added to
`package.json` without a matching install — but wasn't the actual cause), and pinning
`eas.json`'s Android build image to `"sdk-51"` (harmless, kept, but Gradle still downloaded the
same `gradle-8.8-all.zip` either way — the image tag doesn't control that).

Root cause, found by reading `node_modules/expo-dev-launcher/android/build.gradle`,
`node_modules/expo/android/build.gradle`, and `node_modules/expo-modules-core/android/
ExpoModulesCorePlugin.gradle` directly and reproducing locally: three of Expo's own native
modules (`expo`, `expo-dev-launcher`, `expo-dev-menu`) each run
`node -e "require('react-native/package.json')"` with `workingDir(projectDir)` — their *own*
Android folder inside `node_modules/<package>/android`. That only resolves `react-native` if
it's hoisted to the same `node_modules` these packages live in. In this repo it isn't:
`react-native@0.74.5`'s exact peer requirement on `react@18.2.0` conflicts with a newer
`react@18.3.1` some other workspace package pulls in, so npm — correctly — nests
`react-native` under `apps/mobile/node_modules/react-native` instead of hoisting it to the
workspace root, while `expo`/`expo-dev-launcher`/`expo-dev-menu` (no such conflict) do get
hoisted to root. Confirmed by literally running the exact failing command from each location:
fails from `node_modules/expo-dev-launcher/android` (`MODULE_NOT_FOUND`), succeeds from
`apps/mobile` (prints `0.74.5`). The `:expo` project's `android {}` block configures both this
same lookup *and* the `publishing { singleVariant("release") }` AGP component the second error
complains about — one exception aborting that block's evaluation mid-way explains both crashes
as the same root cause, not two unrelated bugs.

Confirmed *not* fixable by forcing the hoist: temporarily adding `react-native` as a root
`devDependency` to test this reproduced npm's real `ERESOLVE` peer conflict outright (`peer
react@"18.2.0" from react-native@0.74.5` vs. whatever pulls `18.3.1`) — reverted immediately, npm
was right to nest it.

**Confirmed working against a real `eas build` run** (not just locally) once the user actually
built against the right commit — earlier attempts silently used a stale local checkout (`git
pull` kept failing on the local, uncommitted `package-lock.json` change from running `npm
install` in `apps/mobile` directly; `git checkout -- package-lock.json` before each pull fixed
it, twice). The `:expo-dev-launcher`/`:expo`/`release`-property failures are gone — the build
now runs all the way through native compilation (281 Gradle tasks) to a completely different,
much more mundane failure: `AAPT: error: resource color/splashscreen_background not found`,
because `app.json` had no `splash` config at all (no icon/splash assets exist in this project
yet either — never mattered before since nothing had done a real native build). A known SDK 51
regression when splash config is incomplete; fixed with a minimal color-only splash block:
`"splash": { "backgroundColor": "#235247" }` (the Studio Desk forest-green brand primary, same
value as `theme/index.ts`'s `brand[600]`), no image needed.

**Confirmed: `eas build --profile development --platform android` now succeeds end to end.**
One more local-only snag on the way there, worth recording since it'll recur: `eas build` itself
writes `extra.eas.projectId` into `app.json` on first run, so a later `git pull` conflicted with
that local edit — `git stash` (not `git checkout --`, which would have discarded the real
`projectId`) surfaced the conflict correctly, but `git stash pop` left literal `<<<<<<<`
conflict markers in `app.json`, breaking its JSON syntax and failing the *local*
`expo config --json` step `eas build` runs before it even talks to EAS's servers. Fixed by hand
(merging the kept `eas.projectId` block with the pushed `splash` block), verified via
`npx expo config --json` printing valid JSON before retrying. `app.json`'s `eas.projectId` is
now committed so this shouldn't resurface.

**Fix: `patch-package`.** Can't edit `node_modules` durably (not committed, and EAS reinstalls
fresh from the lockfile every build) or touch upstream Expo packages, so added `patch-package` as
a root devDependency + `"postinstall": "patch-package"` in the root `package.json`, and patched
all three files' `workingDir(projectDir)` → `workingDir(rootProject.projectDir.parentFile)` —
`rootProject` for every subproject in the generated Android build is `apps/mobile/android`
(confirmed from the build logs' own `Running 'gradlew :app:assembleDebug' in
.../apps/mobile/android`), so `.parentFile` is `apps/mobile` — exactly where `react-native` is
actually reachable from, regardless of hoisting. Three `.patch` files committed under
`patches/`; verified by deleting and reinstalling all three packages locally and confirming
`postinstall` reapplies the patches automatically (`patch-package` printed `✔` for all three) —
same install path EAS's remote build will take. Not yet confirmed against a real `eas build`
run (waiting on the user's next attempt) since this sandbox has no Android/Gradle toolchain to
run the actual native build itself, only Node, which is what let this be reproduced and fixed
without one.

### M5. "Studio Desk" visual redesign + Power BI-style drill-down, web and mobile

User picked "Studio Desk" (one of three original mockups — warm putty neutral, forest-green
primary, serif headings) and separately asked for "every click gives nested, more granular
detail," citing Power BI. Two independent pieces of work, both shipped app-wide:

**Palette + typography — mechanical sweep, same trick as §L3's dark-mode rollout.** Rather than
touching every component file, redefined the *scales themselves*:
- Web (`apps/web/tailwind.config.js`): `brand` (was indigo) → forest green 50-950, `accent`
  (was teal) → ochre, and — the new part — overrode Tailwind's built-in `slate` scale itself
  with a warm putty/greige ramp, so every existing `slate-*`/`dark:slate-*` utility across the
  whole app (body bg, borders, muted text) picked up the new neutral with zero per-file edits.
  Bumped `borderRadius.{md,lg,xl,2xl}` up one notch for the softer "unhurried" feel. Added
  Fraunces (headings) + Karla (body) via Google Fonts `<link>` in `index.html`, with a single
  `@layer base { h1,h2,h3,h4 { font-family: ... } }` rule in `index.css` picking up every
  semantic heading tag app-wide — confirmed via `grep` that all 22 heading usages in the
  codebase are real `<h1>`-`<h3>` tags, not styled `<div>`s, before relying on this.
- Mobile (`apps/mobile/src/theme/index.ts`): same forest-green/ochre/putty values ported to the
  `buildColors()` scheme resolver (light *and* dark — dark stayed warm/brownish, not the old
  cool navy, so dark mode carries the same character). Added `expo-font` +
  `@expo-google-fonts/{fraunces,karla}` (SDK-51-pinned versions read from `expo`'s own
  `bundledNativeModules.json`, same registry-network workaround as §M3) and gated `App.tsx`'s
  first render on `useFonts()` resolving, since `makeTypography()` now references exact
  per-weight family names.
- **Verified for real**: typechecked clean across all 7 packages; screenshotted the actual
  running web app (Playwright, both themes, logged in via dev auth against a freshly
  migrated+reseeded local Postgres) — fonts and colors render correctly, not just "compiles."
  Mobile verified the same way as §M2/§M3: zero-error Metro bundle compile for both platforms,
  grepped for the new font family strings in the compiled output.

**Drill-down.** Design: Team Dashboard's Org → Department → Manager → Member hierarchy and
Scorecard's leaderboard both terminate in filtered detail, using data that mostly already
existed:
- `/dashboards/team`'s department-scope response already returned every member with their
  `managerId` — the department→manager→member drill needed zero backend changes, just UI to
  expose it (web: click-to-expand rows; mobile: same, `Ionicons` chevron).
- Added `overdue`/`over_budget` boolean filters to `GET /tasks` (`TaskListQueryDto`,
  `TasksService.list()`), reusing the *exact* business-day/logged-vs-estimate definitions
  `dashboards.controller.ts`'s `computeTaskStats()` already computes the dashboard counts
  from (per-assignee holiday-calendar-cached, same as that method) — so a dashboard's
  "Overdue: 3" number and the task list you land on after clicking it agree, not two subtly
  different definitions. Computed in-memory (holiday calendars aren't a DB predicate), so this
  path skips cursor pagination in favor of one bounded 500-row fetch — fine at
  department/team scale, not fine as a general-purpose filter, which is why it's gated behind
  the boolean flags rather than always active.
- `assignee_id` extended from a single UUID to an optional comma-separated list (`@Transform` +
  `@IsUUID('all', {each:true})`, normalized to `string[]` in the DTO) so a manager's *whole
  team's* aggregate Overdue/Over budget count can link to one task-list view, not just a single
  person's.
- Scorecard leaderboard rows drill into `GET /scorecards/users/:userId` — already implemented,
  never called by any page until now. Sub-score tiles expand in place to show the raw counters
  (`completed_count`, `on_time_count`, etc.) already returned alongside `sub_scores`, rather
  than linking to a task list: the scorecard's overdue/over_budget are a **date-range-scoped
  historical** count, a genuinely different definition from the live one the tasks endpoint's
  new filters use — linking them would show a list whose row count doesn't match the number
  just clicked, which is worse than not linking at all.
- **Verified for real, not just typechecked**: logged into the actual running app (Playwright,
  dev auth) and clicked through every hop — Organization → Development → expand a manager →
  click "Overdue: 0" → landed on `/tasks?department_id=...&overdue=true` showing "No tasks
  found" (0 overdue, 0 rows: the numbers agree); Scorecard leaderboard row → "Mike Management's
  scorecard" with a working back link → clicked "On-time completion" → tile expanded showing
  "Completed on time: 0 / Completed (with a due date): 0". Mobile side verified the same way as
  every other mobile change this session: zero-error bundle compiles for both platforms with
  the new navigation/query code confirmed present in the compiled output (on-device rendering
  still isn't checkable in this sandbox, same standing gap as §M3).

### M6. Reports chart drill-down (web only) — closes the deferred item from §M5

§M5 explicitly scoped Power BI-style drill-down to Team Dashboard + Scorecard and deferred
Reports/Timeline to "next round." Picked that back up: Timeline turned out to already drill to
the most granular level (task bars already link to `/tasks/:id`), so no changes there. Reports
was the real gap — every chart showed only an aggregate number per dimension, with no way to
see which tasks it counted.

**What `dimension_value` actually is, discovered by reading `reports.service.ts`'s
`labelFor()`**: it's not a generic "dimension," it's whatever real id that particular metric's
aggregate cache row is keyed by — `status_id` for `task_counts_by_status`, `department_id` for
`task_counts_by_department`, `user_id` for the three assignee-keyed metrics, `priority_id` for
`task_counts_by_priority`. For the remaining six metrics (`overdue_count`, `overdue_rate`,
`over_budget_count`, `over_budget_rate`, `avg_time_to_completion_hours`,
`sla_compliance_rate`, `completion_throughput`) it's literally the string `"all"` — these are
single-number-per-department aggregates, not a breakdown of individual tasks, so there's no
per-row entity to link to at all. `apps/web/src/features/reports/drill.ts`'s `reportDrillHref()`
encodes exactly this: real-id metrics map straight to a `/tasks?status_id=...` /
`department_id=...` / `priority_id=...` / `assignee_id=...` link (`"unassigned"` stays
non-clickable — not a real user id); `overdue_count`/`over_budget_count` only become clickable
when the *report itself* is department-filtered (`report.config.filters.department_id`), since
that's the only case where "all" resolves to something real; everything else stays
non-interactive. Wired into `ReportChart.tsx` (bar `onClick`, pie `<Cell onClick>`, table row
`onClick` + `cursor-pointer` + a "→" affordance column only shown when at least one row in that
chart is drillable) and `ReportViewerPage.tsx`.

**Verified for real, and caught a real bug doing it**: first pass, clicking a "Task Counts by
Status" bar navigated to `/tasks?status_id=...` correctly, but the task list page ignored the
param entirely — `TaskListPage.tsx` had only ever read `department_id`/`assignee_id`/
`overdue`/`over_budget` from the URL (added in §M5), never `status_id`/`priority_id`, so the
"filtered" list silently showed everything. Playwright caught this immediately (screenshot
showed all four statuses mixed together, no filter banner) — fixed by adding both params to
`TaskListPage`'s URL reading, `useTasks()` call, and the filter banner (labels derived from the
already-loaded rows' own `status.label`/`priority.label`, same zero-extra-request trick as the
existing assignee label). Re-verified: clicking "Todo" (bar height 4) landed on exactly 4 Todo
tasks with a "Filtered: Status: Todo" banner. Separately verified the honesty path: the
"Overdue Tasks" starter template (no department filter) renders its `overdue_count`/
`overdue_rate` rows as plain, non-clickable table rows — no arrow, no broken link — exactly as
designed, since dimension_value is "all" with nothing real to filter to.

### M7. Web: task assignment UI — real gap found while user was testing the deployed app, not just an oversight in the ask

User asked, while clicking around the freshly-deployed dev environment: after creating a task
and mapping it to a department, how does it actually get assigned to a specific person? Checked
both places you'd expect this and found neither had it: `NewTaskForm.tsx` only ever collected
department + priority, and `TaskDetailPage.tsx` didn't display or let you change the assignee at
all — not a partial gap, a complete one. The backend (`POST /tasks/:id/assign`,
`assignee_id` already accepted on `POST /tasks`) and even a `useAssignTask()` client hook were
already fully built and wired since #4/#8 — nothing in the UI ever called any of it. Web only;
mobile has the same gap (`apps/mobile` `NewTaskForm`/`TaskDetailScreen` equivalents also never
surfaced assignment) and hasn't been addressed here.

Fixed on web, confirmed via the user's own explicit choices (both at creation and after, scoped
to the task's own department — matches how every other assignment surface in this app already
treats department as the boundary):
- New Task form: added an assignee `<select>`, populated from the selected department's active
  members (new `useUsers(departmentId)` hook, `GET /users?department_id=...&is_active=true`,
  already existed server-side, just never called from a task-creation context), defaulting to
  "Unassigned." Resets when the department changes, since the previous department's member
  likely isn't in the new one.
- Task Detail page: added an "Assigned to" `<select>` (same department-scoped member list,
  `useAssignTask()`) directly under the status/priority badges — always editable, not gated
  behind a separate edit button, matching this page's existing direct-manipulation pattern
  (department filter dropdowns elsewhere behave the same way).

**Verified against the running app** (same Playwright-against-`localhost` method as every other
verification this session — the user's own deployed Cloud Run instance isn't reachable from
here, so this sandbox's own dev server stood in, same code): created a task in the Development
department, picked "Hana Head" from the new assignee dropdown
→ task detail page loads showing "ASSIGNED TO: Hana Head". Confirmed server-side persistence (not
just optimistic UI) two ways: reassigning to "Ravi Employee" via the detail-page dropdown and
re-fetching, and — better evidence — the API's own mock-email notification log firing for real:
`"Task assigned to you: Verify assignee picker"` to Hana Head on the initial assign, then
`"Task reassigned"` + `"Task assigned to you"` to Ravi Employee on the change. That notification
pipeline (assign → notify) was already built and wired (Notifications module, #10) and had
simply never fired in practice because nothing ever called assign — the fix exercises code that
was correct but dead until now.

**Known gap, called out rather than silently left**: mobile has the identical hole (no assignee
picker on creation or detail) and wasn't touched by this fix — scoped to web only since that's
where the question came from. Worth the same fix on `apps/mobile` for parity, same as §M5/§M6's
mobile follow-ups, if wanted.

### M8. Real push + email delivery — the trigger side (§M7) was already fully wired; only the last-mile send was mocked

Follow-up to §M7: user asked for tasks to default to "Todo" and for assignment to trigger an
email + a mobile push. Checked each claim against the actual code rather than assuming a gap:

- **Default "Todo" status**: already correct, no change needed. `TasksService.create()` always
  picks the workflow status with the lowest `displayOrder`, and `SEED_WORKFLOW_STATUSES` (
  `packages/shared-types/src/workflow.ts`) seeds "Todo" at `display_order: 0` — the lowest by
  construction. A custom admin-authored workflow could reorder this, which is intentional
  ("admin-configurable everything"), not a gap.
- **Assignment → notification trigger**: already fully wired for both channels, confirmed
  working in §M7's own testing (the mock-email log entries). `NotificationsService.notify()`
  auto-adds the `push` channel to every notification the instant a user has *any* registered
  device (`user.pushToken` set) — callers never opt in per-event. Nothing needed building here.

**What was genuinely missing**: `MailService.send()` and `PushService.send()` both just logged
a line and returned — the trigger fired, but delivery was 100% mocked, not partially.

- **Push (`push.service.ts`), rebuilt to actually send**: realized while checking the mobile
  registration code (`usePushNotifications.ts`) that it calls `getExpoPushTokenAsync()` — a
  real **Expo** push token, not a raw FCM/APNs token — meaning real delivery is a plain HTTPS
  POST to Expo's own push relay (`exp.host/--/api/v2/push/send`), which fans out to FCM/APNs on
  our behalf. **No Firebase project or GCP credentials needed** — genuinely unblocked, unlike
  Google Sign-In (§M4). Implemented with a plain `fetch()` (no new dependency), format-validates
  the token first, and treats a delivery failure (stale token, etc.) as a warning, not a thrown
  error, so one bad token never breaks the notification for anyone else.
- **Email (`mail.service.ts`), rebuilt to actually send**: added `nodemailer` and replaced the
  mock log with a real `createTransport()` + `sendMail()` call against the config an Admin
  already saves via the existing Integration Settings page (`host`/`port`/`from_address`/
  `username`/KMS-encrypted password) — confirmed the web form's field names match the
  `SmtpConfig` shape exactly, so no UI changes were needed either. A fresh transporter per send,
  not pooled — SMTP creds are editable at runtime with no redeploy, and this app's volume is low
  enough that connection reuse isn't worth an Admin's credential change lingering in a stale
  pool. The existing `POST /integration-settings/smtp/test` button now genuinely tests SMTP
  connectivity as a side effect, with zero changes to that endpoint.

**Verified for real, working around this sandbox's network policy**: attempting the actual Expo
API call from here hit a hard proxy denial — `curl -sS "$HTTPS_PROXY/__agentproxy/status"`
showed `"connect_rejected"`/`"gateway answered 403 to CONNECT"` specifically for `exp.host:443`,
confirming it's this sandbox's own egress allowlist, not a code problem (Cloud Run has ordinary
outbound internet access). Verified the request/response handling instead against a local mock
server reproducing Expo's exact documented response shape — success, a rejected/stale token, and
a malformed-token pre-check all handled correctly. For email, went one step further: ran a real
local SMTP server (`smtp-server` + `mailparser`, scratch-only, not a repo dependency) and pointed
the *exact* `createTransport`/`sendMail` call `MailService` makes at it — confirmed a full real
SMTP handshake including AUTH, and the received message's from/to/subject/body/attachment all
matched exactly. This is as close to "delivered for real" as this sandbox allows; the genuine
end-to-end check (a real inbox, a real phone buzzing) needs the user's own deployed environment
with real SMTP credentials entered via Admin → Integrations.

---

## How to keep this log current

As the build proceeds and these items get resolved, update this document (or
have the build agent flag it for update) rather than letting answers live
only in chat history or scattered commit messages — this file is meant to
stay the single source of truth for "what's still undecided" for the life of
the project, not just through initial launch.
