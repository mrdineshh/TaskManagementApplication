# Pulse (TaskApp) — Beta → Production Upgrade Plan
### Agent execution spec for Antigravity

> Version 1.0 · 24 Sep 2026
> Executor: Antigravity agent · Owner / approver: the human project owner
> Scope: backend (NestJS + Prisma + PostgreSQL), web (React + Vite), mobile (Expo), infrastructure (GCP + Terraform), security, testing, release.

---

## 0. READ THIS FIRST

### 0.1 Purpose
Take Pulse from a working beta to a production-ready system: correct, secure, observable, tested, deployable, and supportable. The work is organised into phases (Section 4 onward). Each phase has tasks with IDs, acceptance criteria and human gates.

### 0.2 Source-of-truth rule
**The repository is the source of truth, not this document.**
This plan was written by an external reviewer who had:
1. the project's own `PROJECT_MASTER_REVIEW.md`,
2. five UI screenshots (login, My Tasks x2, Admin overview, Employee Timesheet),
3. a written description of the Cloud Run settings and background jobs.

The reviewer did **not** have the source code. Wherever this plan says something the code contradicts, **the code wins**. Record every contradiction in `docs/upgrade/DISCREPANCIES.md` (claim, evidence, impact) and adapt the plan.

### 0.3 Markers used in this document

| Marker | Meaning | What you must do |
|---|---|---|
| **[FROM CODE]** | A detail I could not see (file name, function, table, config). | Read the repo, fill in the exact detail, write it in `PROGRESS.md`. Do not guess. |
| **[VERIFY]** | A claim believed true but unconfirmed. | Confirm or refute with evidence (file:line, query output, log line) *before* building on it. |
| **[DECISION]** | A choice with trade-offs. A recommended default is given. | Implement the default, record an ADR in `docs/decisions/NNN-title.md`, continue unless the human overrides. |
| **[HUMAN GATE]** | Action with production, cost, data or security impact. | STOP. Prepare the artifact (plan, diff, script, `terraform plan`) and wait for explicit human approval. |
| **[SEV-1]** | Security or data-integrity problem. | Handle first, before other work. |

### 0.4 Working agreement (applies to every task)
1. **One phase at a time, in order.** Do not start a phase until the previous phase's exit criteria are met (or the human waives them).
2. **Branch per task**: `upgrade/<task-id>-<slug>`. Small commits. Each task ends with a short summary (files changed, tests added, risks).
3. **Tests first for bugs.** Every bug fix starts with a failing automated test that reproduces it.
4. **Never touch production directly.** All infrastructure changes go through Terraform; attach the `terraform plan` output and stop at a **[HUMAN GATE]**. All data changes go through reviewed scripts, run on staging first.
5. **Migrations are additive and reversible-in-practice** (expand → migrate → contract). Never edit an already-applied migration. Never use `prisma migrate dev` or `db push` against staging/prod.
6. **Secrets never appear in code, logs, docs or PRs.** Environment variable *names* only.
7. **Keep the public API backward compatible** (`/api/v1`) until the mobile app is upgraded (Phase 8). Add fields; don't remove or rename.
8. **Don't remove a feature** described in the master review without a **[DECISION]** entry.
9. **Keep docs in sync.** Update the existing `docs/00–10` specs when behaviour changes; put upgrade artefacts in `docs/upgrade/`.
10. **When blocked or uncertain, write the question in `docs/upgrade/QUESTIONS.md` and continue with the safest default** — do not stall silently, do not invent facts.

### 0.5 Progress tracking
Maintain `docs/upgrade/PROGRESS.md` with one row per task:

| Task | Status (todo / in-progress / blocked / done) | Branch | Evidence (tests, logs, screenshots) | Notes / follow-ups |
|---|---|---|---|---|

### 0.6 Global Definition of Done (every task)
- [ ] Behaviour implemented and matches the acceptance criteria.
- [ ] Automated tests added (unit and/or integration; E2E for user journeys).
- [ ] Lint, typecheck, tests all green in CI.
- [ ] No new secrets, no new `any`-typed shortcuts on security paths, no TODOs without a linked task.
- [ ] Migrations (if any) reviewed and tested on an empty DB **and** on a copy of realistic data.
- [ ] Logging / error handling added for new failure modes.
- [ ] Docs updated; `PROGRESS.md` updated.
- [ ] Backward compatibility considered (mobile app, existing data).

---

## 1. PROJECT SNAPSHOT (facts known today)

### 1.1 Product
- **Name:** Pulse (repo / internal codename: TaskApp). Production URL: `https://pulse.econz.cloud`.
- **What it is:** multi-department task management with time tracking (clock in / clock out per task), reviews, SLAs, scorecards, reports.
- **Current scale (from Admin screen):** ~6 active users, 10 departments, 5 roles, 33 permissions. Expect growth — design for hundreds of users.
- **Auth:** Firebase Google Sign-In, restricted to the `@econz.net` domain, invite-only (Admin pre-creates users). App issues its own JWT access/refresh tokens. **[FROM CODE]** token lifetimes, storage location (memory / localStorage / cookie).
- **Roles (5):** Admin (org-wide), Management (org-wide, read/oversight), Head (department), Manager (direct reports), Employee (self). Users can hold multiple roles and switch "active role" in the UI.

### 1.2 Stack
| Layer | Technology |
|---|---|
| Monorepo | Turborepo + npm workspaces (`apps/api`, `apps/web`, `apps/mobile`, `packages/api-client`, `packages/shared-types`, `packages/config`, `infra/`, `docs/`) |
| API | NestJS 10, Prisma 5, PostgreSQL 15, class-validator, zod, `@nestjs/throttler` (in-memory), nodemailer (Google Workspace SMTP), pdfkit, exceljs, rrule, firebase-admin |
| Web | React 18, Vite, Tailwind, TanStack Query 5, Zustand, react-router 6, dnd-kit, Tiptap, Recharts, Firebase Auth |
| Mobile | React Native 0.74 + Expo SDK 51 (released May 2024 — outdated), expo-notifications, expo-secure-store |
| Infra | GCP: Cloud Run (`taskapp-api`, `taskapp-web`), Cloud SQL Postgres 15, Artifact Registry, Cloud Build, Secret Manager, KMS; Terraform in `infra/` with `environments/{dev,staging,prod}` |

### 1.3 Infrastructure as described by the owner
| Env | Service | Min | Max | Notes |
|---|---|---|---|---|
| dev | api / web | 0 | 3 | scale-to-zero; Cloud SQL `db-f1-micro` |
| staging | api / web | 0 | 5 | scale-to-zero; Cloud SQL with automated backups |
| prod | api | **1** | **10** | "warm instance"; Cloud SQL `db-custom-2-7680` |
| prod | web | 0 | 10 | static SPA (or Cloud Storage + CDN) |

- API ingress is public (`INGRESS_TRAFFIC_ALL`). Cloud SQL is reached through the Cloud Run Cloud SQL volume mount (`/cloudsql/<connection>`).
- Secrets from Secret Manager: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_OAUTH_CLIENT_SECRET`.
- Infra module `infra/modules/scheduler-job/` exists (Cloud Scheduler) but is **not used yet**.
- **[VERIFY]** In `infra/modules/cloud-run-service/`: is CPU *always allocated* (`cpu_idle = false` / annotation `run.googleapis.com/cpu-throttling: "false"`) or *throttled outside requests* (default)? `min_instances = 1` keeps an instance alive; it does **not** by itself give timers CPU between requests. Record the answer.
- **[VERIFY]** Whether staging and dev are actually *deployed* and reachable, or only defined in Terraform.
- **[VERIFY]** Which Firebase project production uses. The architecture doc names a project called `testing-sujeeth` — a test-named project must not back production.

### 1.4 Background jobs today (in-process `setInterval`, started in `OnModuleInit`)
| Service | File (per owner) | Cadence | Purpose |
|---|---|---|---|
| OverdueEscalationService | `apps/api/src/sla/overdue-escalation.service.ts` | 60 s | scans open tasks, business-day overdue, notifies manager, writes `overdue_escalated` activity entry as dedupe marker |
| SLAEscalationService | `apps/api/src/sla/sla-escalation.service.ts` | 60 s | % of SLA resolution time elapsed; notifies at thresholds |
| ReportAggregationService | `apps/api/src/reports/report-aggregation.service.ts` | startup + 15 min | fills `report_aggregate_cache` |
| ReportScheduleDeliveryService | `apps/api/src/reports/report-schedule-delivery.service.ts` | startup + 5 min | renders and emails scheduled reports |

**Structural problem:** with prod `max_instances = 10`, **every instance runs all four timers**. That risks duplicate notifications, duplicate scheduled-report emails, redundant DB scans, and lost work when instances scale down. See B4 and Phase 5.

### 1.5 Key business rules (from the master review — **[VERIFY]** each against code)
- **Estimate gate:** a status with `requiresEstimateBeforeEntry` blocks entry if the task has no estimate. Assignee may edit the estimate within 30 minutes of submission; afterwards only holders of `task.override_locked_edits` (Admin), audited.
- **Timer:** entering In Progress sets `timerStartedAt`. Entering a status with `isReviewStatus` stops the timer, appends minutes to `totalLoggedMinutes`, creates a `TimeLog`, notifies the manager. UI exposes "Clock In / Clock Out" buttons. **[FROM CODE]** exactly what Clock In / Clock Out call on the API and whether they change task status.
- **Subtasks:** parent cannot move to a `done`-category status while any subtask is open (hard block). Open `blocks` dependencies produce a soft warning.
- **Overdue:** business days only, excluding weekends and regional holidays from the assignee's `workCountry`/`workState` calendar; overdue only after ≥ 1 full business day.
- **Over-budget:** `totalLoggedMinutes > estimate`. Tracked independently from overdue.
- **Scorecard:** six weighted sub-scores (on-time 0.25, estimate accuracy 0.20, volume 0.15, overdue penalty 0.15, over-budget penalty 0.15, rework 0.10).
- **Reports:** dashboards and reports read from `report_aggregate_cache` (refreshed every 15 min). **[VERIFY]** which screens read the cache versus live queries — especially `GET /dashboards/personal` and the My Tasks metric cards.

---

## 2. KNOWN ISSUES AND EVIDENCE

### B1 — Assigned task not visible (so cannot Clock In) until several refreshes · **HIGH**
**Reported:** after a task is assigned, the assignee sometimes cannot see it; after multiple refreshes it appears.
**Evidence:** screenshot of My Tasks showing all counters at 0 and "Nothing open — nice work!" with a green "Live" badge and **2 unread notifications** on the bell (consistent with "notification arrived, list did not"). **[VERIFY]** this screenshot was taken during the bug.

Hypotheses (investigate in this order; write findings in `docs/upgrade/B1-investigation.md`):
1. **Cache-backed reads.** My Tasks counters and/or list served from `report_aggregate_cache` (15-min stale) or another in-memory cache. Grep for `Map`, LRU, `cache-manager`, `memoize`, module-level variables holding query results, and for `report_aggregate_cache` usage in `dashboards`.
2. **Multi-instance in-memory state.** Prod scales 1 → 10. Any per-instance state (cache, event bus behind the "Live" badge, throttler counters) differs between instances; consecutive refreshes may hit different instances.
3. **"Live" is not really live.** **[FROM CODE]** what the Live badge is bound to (SSE? WebSocket? polling? static). If it is an in-memory event emitter, events emitted on instance A never reach clients connected to instance B.
4. **Stale client cache.** TanStack Query `staleTime`, missing `refetchOnWindowFocus`, query keys that omit user/role, no invalidation on the assignee's client after the manager assigns.
5. **Read scoping.** My Tasks filters by primary department, active role, or a status *category* list that excludes the task's status (e.g. a custom status, "on hold", or a status whose category isn't `todo`/`in_progress`). Also pagination/sort hiding the task.
6. **Write/notify race.** Assignment sends notification/push *before* the DB transaction commits, so the client refetches too early. **[FROM CODE]** order of operations in `POST /tasks/:id/assign` and `NotificationsService.notify()`.
7. **Visible but not startable.** Task is listed but Clock In is hidden/disabled (no estimate, missing transition permission, workflow has no legal transition to an active status from the initial status). Users describe this as "can't see it to clock in".

### B2 — Runaway timers · **HIGH (data integrity)**
**Evidence:** My Tasks shows task "RAG" *In Progress* with total 56h 12m and "current session +48h 29m" still ticking; Employee Timesheet shows 97h 21m on one task for one person and 194.3h total for 4 people this month.
**Cause (likely):** timer is wall-clock from clock-in with no auto-stop (only review status stops it), no single-timer rule, no idle detection, no max duration, no end-of-day rule.
**Impact:** inflated timesheets, wrong over-budget/estimate-accuracy scores and reports.

### B3 — Email-only sign-in on production login page · **SEV-1**
**Evidence:** `pulse.econz.cloud/login` shows "or sign in with email" with a single `name@econz.net` field and a **Sign In** button — no password, no code.
**Risk:** if this calls `POST /auth/dev-login` (documented as "mock authentication for local development and role testing"), anyone who knows a colleague's email — including an Admin's — can sign in as them.
**Action:** see P1-01. Treat as an incident until proven harmless.

### B4 — Background jobs are per-instance timers · **HIGH**
See 1.4. Also **[VERIFY]** CPU allocation (timers freeze between requests when CPU is throttled) and graceful shutdown (scale-down kills jobs mid-run).

### B5 — Misleading status UI · **MEDIUM**
- "Live" badge (see B1).
- Admin console banner "Organization Ready for Production / System Ready" — **[VERIFY]** whether it computes anything or is static.

### B6 — UX defects seen in screenshots · **LOW–MEDIUM**
- Active Work Session card: large empty area; "Work Timer" label and the `56h 12m 18s` hero value wrap awkwardly; total logged time is shown where *session* time should be primary.
- Timesheet breadcrumb shows raw route names (`Home / Tasks / timesheet / employees`).
- Dates render as `9/14/2026` (US format) although the organisation is in India. **[DECISION]** use org locale/timezone settings.
- Timesheet "avg 97h 21m/task" is meaningless when sessions are runaway; needs data-quality flags.

---

## 3. GLOBAL ENGINEERING RULES

### 3.1 Security baseline (applies to all phases)
- Every endpoint has an explicit auth decision (guard or explicitly `@Public()` with justification listed in the RBAC inventory).
- Authorisation is enforced **at the object level in the service/query layer**, not only by a permission guard on the route (OWASP API1 BOLA / API5 BFLA / API3 property-level).
- Request bodies pass through DTOs with `whitelist: true` and `forbidNonWhitelisted: true`; separate DTOs for create vs update; no client-controlled `assigneeId`, `statusId`, `estimate*`, `timerStartedAt`, `totalLoggedMinutes` outside their dedicated endpoints.
- No stack traces or internal IDs in production error responses.

### 3.2 Data rules
- Timestamps in UTC (`timestamptz`); display in org/user timezone. **[FROM CODE]** current column types.
- Soft-delete / archive rather than hard delete for tasks, users, time logs (with retention policy).
- Denormalised counters (e.g. `totalLoggedMinutes`) are updated **in the same transaction** as their source rows and covered by a reconciliation test/job.

### 3.3 Observability rules
- Every request has `x-request-id`; every response carries `x-request-id` and `x-instance-id` (Cloud Run revision + instance/hostname).
- Structured JSON logs (level, requestId, userId, route, latency, instanceId). No PII beyond user ID.

### 3.4 Config rules
- All behaviour toggles via environment variables with safe production defaults (list in Appendix D).
- Admin-configurable business settings stay in the DB (existing principle: "no hard-coded workflows").

---

## 4. PHASE 0 — DISCOVERY AND GUARDRAILS (read-mostly, ~3–5 days)

**Goal:** understand the real code and environments, get a safety net in place, and make problems observable before changing behaviour.

### P0-01 Repository audit and discrepancy report
- Produce `docs/upgrade/AUDIT.md`: folder structure, package versions, npm scripts, build/test/lint commands, Node version, how the API/web/mobile start.
- Compare the master review to reality; write `docs/upgrade/DISCREPANCIES.md`. Check at minimum: number of Prisma models (doc says "28+", lists 35), endpoint list vs actual controllers, permission keys (Admin screen shows **33**), role definitions, background-job files and intervals.
- List `TODO|FIXME|HACK` comments, dead code, unused dependencies, unusually large files.
- **[FROM CODE]** record: test framework(s) present (if any), current coverage, CI configuration file (Cloud Build YAML? GitHub Actions?).
- **Accept:** AUDIT.md and DISCREPANCIES.md committed; every claim in Section 1 marked confirmed / refuted.

### P0-02 Quality gates in CI
- Ensure a CI pipeline runs on every PR: install → lint → typecheck → unit tests → build. Add missing scripts.
- Add API test runner (Jest) and web test runner (Vitest + Testing Library) if absent. **[FROM CODE]** what exists.
- Add `npm audit --omit=dev` (report only at first), secret scanning (gitleaks), Dependabot/Renovate config.
- **Accept:** a deliberately failing test blocks merge; main is green.

### P0-03 Environment map (no secrets)
- Write `docs/upgrade/ENVIRONMENTS.md`: for dev/staging/prod → URLs, Cloud Run service + current revision, Cloud SQL instance, Firebase project ID, OAuth client ID (not secret), secret names, Terraform workspace/state location, who can deploy.
- **[VERIFY]** prod Firebase project is not the `testing-sujeeth` test project; if it is, log as a risk and handle it under P5-08.
- **[VERIFY]** staging is deployed and has its own DB and Firebase project; if not, add "stand up staging" to Phase 5 as blocking for Phase 7.
- **Accept:** document reviewed by human.

### P0-04 Minimum observability
- Middleware: generate/propagate `x-request-id`; add `x-instance-id` (use `K_REVISION` + hostname).
- Structured logger (pino or Nest logger with JSON output).
- Endpoints: `GET /healthz` (process up), `GET /readyz` (DB reachable, migrations applied).
- Error tracking (Sentry or Google Error Reporting) for API and web; source maps for web.
- **Accept:** in Cloud Logging, one request can be traced end-to-end by request ID and shows which instance served it.

### P0-05 Reproduction harness for B1
- Script `scripts/repro/assign-visibility.ts` (API-level; add a Playwright variant later): as a Manager create + assign a task to Employee E; then as E (fresh session each loop) call `GET /tasks?assignee=me` and the personal dashboard endpoint 50 times over 60 s; log `x-instance-id`, whether the task appeared, and latency.
- **Accept:** script runs against staging, outputs a table; failing runs reproduce or rule out multi-instance/caching hypotheses.

### P0-06 Safety net for data work **[HUMAN GATE]**
- Ask the human to take an on-demand Cloud SQL backup of prod and confirm the restore procedure exists before any data script is run.
- Create a staging dataset (anonymised copy or synthetic seed with realistic volumes: 200 users, 20k tasks, 100k time logs) for performance tests later.

### Phase 0 exit criteria
AUDIT, DISCREPANCIES, ENVIRONMENTS committed · CI gates active · request tracing works · B1 harness exists · backup confirmed.

---

## 5. PHASE 1 — CRITICAL FIXES (~1 week)

**Goal:** remove the security hole, fix the visibility bug, stop bad time data from accumulating, stop duplicate job execution. Ship each fix independently.

### P1-01 Close the email-only sign-in **[SEV-1] [HUMAN GATE for prod deploy]**
1. **[FROM CODE]** find the UI element (`LoginPage.tsx`) and the endpoint it calls. Determine whether it calls `POST /auth/dev-login` or a real email flow.
2. If it is dev-login: 
   - API: register the route only when `ENABLE_DEV_LOGIN === 'true'` **and** `NODE_ENV !== 'production'`; otherwise return 404. Fail app startup if `ENABLE_DEV_LOGIN=true` while `NODE_ENV=production`.
   - Web: render the email box only when `import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true'`; the production build must not contain the dev-login code path (tree-shaken or excluded).
3. If it is intended to be a real email sign-in: it must prove mailbox ownership (magic link or one-time code with expiry ≤ 10 min, single use, rate-limited, hashed at rest). **[DECISION]** default: remove it and keep Google-only (simplest, matches invite-only domain policy).
4. Server-side Google/Firebase verification in `POST /auth/firebase` must check: token signature/audience/issuer, `email_verified === true`, email domain (and `hd` claim if present) — **not** only on the client. **[VERIFY]**
5. Incident hygiene: search Cloud Logging for past calls to the dev-login route in prod and list any usage; **[HUMAN GATE]** rotate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` after the fix deploys (this signs everyone out — announce it).
- **Tests:** (a) production-mode app returns 404 for dev-login; (b) startup fails with dev-login enabled in production; (c) `/auth/firebase` rejects unverified email and wrong domain; (d) web production bundle contains no dev-login UI (grep test in CI).
- **Accept:** on staging (production mode) the email box is gone and dev-login route is unreachable.

### P1-02 Fix B1 (visibility) — driven by evidence
- Complete `docs/upgrade/B1-investigation.md` using P0-05 results and the hypotheses in Section 2 / B1.
- Regardless of root cause, implement these safeguards:
  1. **Read-your-writes guarantee:** after `POST /tasks/:id/assign` returns 2xx, `GET /tasks?assignee=me` and the personal dashboard for the assignee include the task. Integration test asserts this immediately after assignment.
  2. **No stale cache on personal views:** My Tasks list and counters use live queries (indexed) — never `report_aggregate_cache`. The cache stays for reports/rollups and shows an "as of <time>" label.
  3. **Notify after commit:** move notification/push/email dispatch to after the DB transaction commits (Nest event emitter after `$transaction` resolves, or a small outbox table). Notifications must never precede data visibility.
  4. **Client freshness (interim, until Phase 4 realtime):** TanStack Query for My Tasks / All Tasks / dashboard: `refetchOnWindowFocus: true`, `refetchOnReconnect: true`, `staleTime` ≤ 15 s, `refetchInterval` 30 s while the tab is visible; on receiving a notification that references a task, invalidate task queries.
  5. **Remove scoping bugs found** (department/role/status-category filters) and add a test with a task in each status category and a secondary-department assignee.
- **Accept:** repro harness shows the task visible on the first request in 50/50 trials across at least two instances (force scale with concurrent load or set min instances=2 in staging for the test).

### P1-03 Stop runaway timers (interim guardrails)
Full timer redesign is Phase 3; ship safe guardrails now:
- **Max session length** (org setting `maxTimerSessionMinutes`, default **600** = 10 h **[DECISION]**). A job (see P1-04 lock) auto-stops sessions older than the cap: writes a `TimeLog` for the capped duration (not the full wall-clock), flags it `auto_closed = true` **[FROM CODE]** add column or use `note` prefix if schema change is too big for this phase, logs `timer_auto_stopped` activity, notifies user + manager.
- **One active timer per user:** starting a timer on task B while A is running stops A first (`stopReason = switched`). **[DECISION]** default: auto-switch with a toast; alternative is block-with-prompt.
- **Stop on state changes:** timer stops when the task moves to any non-active status (hold, review, done, cancelled), is reassigned, archived/deleted, or the user is deactivated.
- **UI warning:** any page shows a banner if a timer has run > 4 h ("Still working on <task>? Stop or keep going").
- **Accept:** unit tests for each stop rule; integration test starts two timers and only one remains open.

### P1-04 Make background jobs safe under multiple instances (interim)
Before the Phase 5 migration to Cloud Scheduler:
- Add env flag `RUN_INLINE_JOBS` (default `true` locally, `false` in prod once P5-01 lands; for now keep `true` but guarded).
- Wrap each job run in a **Postgres advisory lock** (`pg_try_advisory_lock(hashtext('<job-name>'))`); if not acquired, skip. Release in `finally`.
- Make outputs idempotent:
  - Overdue/SLA: dedupe key (task, threshold, period) enforced by a **unique constraint** rather than only an `ActivityLogEntry` lookup.
  - Scheduled reports: record each send in `report_schedule_runs (schedule_id, period_key)` with a unique constraint; skip if present.
- Add `enableShutdownHooks()` and stop timers on `SIGTERM`.
- **Tests:** run the job function concurrently from two Nest app instances against one DB → exactly one notification and one email.
- **Accept:** concurrent-run test passes.

### P1-05 CPU allocation decision **[HUMAN GATE for prod apply]**
- **[VERIFY]** current Cloud Run CPU setting (see 1.3).
- Until P5-01 moves jobs out of the API container, prod API should use **CPU always allocated** (with min instances ≥ 1) so timers and post-response work run reliably. After jobs move to Cloud Scheduler, revert to request-based CPU to save cost **[DECISION]**.
- Produce the Terraform change + `terraform plan`; stop for approval.

### P1-06 Quarantine existing bad time data **[HUMAN GATE for any data change]**
- Read-only SQL report `scripts/reports/suspect-time.sql`: open sessions older than 12 h; time logs > 12 h; tasks whose `totalLoggedMinutes` ≠ sum of `TimeLog.minutes`; tasks logged > 5× estimate.
- Deliver as CSV to the human. **Do not modify data.** Correction (if any) is a separate reviewed script that records an audit entry per change and preserves the original values.

### Phase 1 exit criteria
Email-only sign-in gone in prod build · B1 repro passes 50/50 · timer guardrails live · concurrent job test passes · CPU decision recorded.

---

## 6. PHASE 2 — RBAC AND AUTHORISATION HARDENING (~1.5 weeks)

**Goal:** a single, testable authorisation model where a user can only see/do what their role, scope and relationship to the object allow — on every endpoint, for every object.

### P2-01 RBAC inventory (evidence first)
Generate `docs/upgrade/RBAC_INVENTORY.md` from the code:
- Table of **every route**: method, path, guard(s), required permission key(s), `@Public()` flag, and — critically — **where object/scope filtering happens** (service function) **[FROM CODE]**. Mark routes with no scope filtering as **GAP**.
- Table of all 33 permission keys **[FROM CODE]**: which roles hold each by default (from seed).
- Trace how the JWT carries permissions/roles and how `active_role_id`, `UserRole.department_override` and `Department.headUserId` are used in authorisation.
- **Accept:** every route classified; GAP list reviewed by human.

### P2-02 One policy layer
- Introduce `PolicyService` (or CASL) with `can(user, action, resource?)` and `scopeQuery(user, resourceType)` returning a Prisma `where` fragment. All services call it; controllers stop containing scope logic.
- Scope definitions (**[DECISION]** proposed defaults — see Appendix A for the full matrix):
  - **Admin / Management:** organisation-wide (Management is read-only unless a permission says otherwise).
  - **Head:** every department they head or belong to via `UserDepartment` **[FROM CODE]** multi-department semantics.
  - **Manager:** self + direct reports (`User.managerId = me`); transitive reports = **[DECISION]** default *no*.
  - **Employee:** tasks assigned to or created by them, their subtasks, tasks they are mentioned/watching on.
- Permissions answer "may this *kind* of action happen"; scope answers "on *which* objects". Both must pass.
- **Accept:** no controller reads role names directly; a lint rule or test prevents `user.role ===` string checks in controllers.

### P2-03 Token and session model
- Access token ≤ 15 min; refresh token rotation with reuse detection; refresh tokens stored hashed server-side with device metadata. **[FROM CODE]** what exists (a refresh secret is configured, so some refresh flow likely does).
- **Do not trust permissions inside the JWT for authorisation.** Put only `userId`, `sessionId`, `permissionsVersion` in the token; resolve roles/permissions from DB/cache (TTL ≤ 60 s) keyed by `permissionsVersion`. Bump the version when a user's roles or a role's permissions change → changes take effect within one minute, without re-login.
- Check `user.is_active` on every request (deactivation takes effect immediately).
- Add `POST /auth/logout` (revoke session) and "sign out everywhere".
- Token storage in web: prefer in-memory access token + httpOnly, `Secure`, `SameSite` refresh cookie. **[DECISION]** if currently in `localStorage`, migrate.

### P2-04 Active-role semantics
- Define precisely and document: the active role is a **UI lens** (navigation, default dashboard scope). It must **never widen** data access. Server authorises from the union of the user's actual roles/permissions and scope.
- **[FROM CODE]** how `RbacService.resolveActiveRoleName` is used in queries; remove any place where active role changes which rows are returned *and grants more*.
- **Tests:** a user who is Employee + Manager sees the same authorised set regardless of active role; switching to Employee lens narrows the *view* only.

### P2-05 Object-level authorisation test suite (BOLA)
Create `apps/api/test/authz/` with a matrix test: for each role × endpoint × object relationship (own, direct report, same department, other department, org-wide) assert allow/deny. Minimum coverage:
- `tasks` (GET/PATCH/DELETE/status/assign/estimate/time-logs), subtasks, comments, attachments, dependencies, reviews, activity, action-requests, approval-steps.
- `users` list/detail (an Employee must not enumerate all users' emails beyond what mention/assignee pickers require — **[DECISION]** scoped picker endpoint).
- `dashboards/team`, `scorecards/users/:id`, `scorecards/leaderboard`, employee timesheet endpoints, report drill-down and **exports** (exports must apply the same scope as the on-screen report).
- Admin endpoints: all 15 modules denied to non-Admin (and to Management unless **[DECISION]** grants read-only).
- **Accept:** suite in CI; any failing cell is a release blocker.

### P2-06 Property-level protection (mass assignment)
- Replace generic `PATCH /tasks/:id` body handling with an explicit allow-list DTO. Fields with dedicated workflows (`statusId`, `assigneeId`, `estimate*`, `timerStartedAt`, `totalLoggedMinutes`, `completedAt`, `parentTaskId`, `departmentId`) must be rejected on the generic endpoint.
- Server-side enforcement of the 30-minute estimate lock and `task.override_locked_edits` (do not rely on the UI).
- **Tests:** attempts to smuggle protected fields return 400/403.

### P2-07 Admin safety rails
- Prevent removing the last active Admin (role removal, deactivation, deletion).
- System roles immutable (name/permissions) except by explicit super-admin action **[FROM CODE]** how `is_system_role` is enforced.
- Users cannot grant themselves roles/permissions above what they hold; role assignment requires `user.manage_roles` (or equivalent) and is audited.
- Permission dependency validation in the Roles matrix UI and API (e.g. `task.assign` implies `task.view`; warn on contradictory sets).
- Every admin/config change writes an immutable **config audit log** (who, what, before/after JSON): roles, permissions, workflows, priorities, SLAs, custom fields, holiday calendars, scorecard weights, integrations, org settings.

### P2-08 Deactivation and offboarding
- Deactivating a user: revoke sessions, stop their timer, block login, keep history. UI prompts to reassign their open tasks and direct reports (choose new manager) — **[DECISION]** block deactivation until reassignments are chosen, or auto-unassign.

### P2-09 Security event logging
- Log (and count as metrics) authorisation denials (403), failed logins, role changes, admin actions, token-reuse detections. Alert on spikes (Phase 5 alerting).

### P2-10 Application security hardening
- `helmet` headers; strict CORS allow-list from env (`CORS_ALLOWED_ORIGINS`), no wildcard.
- Rate limiting that works across instances: `@nestjs/throttler` with a shared store (Redis/Memorystore) **or** Cloud Armor rate rules **[DECISION]**; the current in-memory store is per-instance and therefore weak with up to 10 instances. Stricter limits on `/auth/*`, exports, bug-report submit, file upload.
- Body size limits; pagination caps (`limit ≤ 100`) on every list endpoint.
- Swagger UI disabled or protected (Admin-only) in production.
- Web: Content-Security-Policy, `X-Frame-Options`/`frame-ancestors`, no inline scripts; sanitise rich-text (Tiptap HTML) on the server before storing/serving and on render (XSS).
- Email: CSV export formula-injection protection (prefix `=+-@` cells).
- Dependency audit clean of high/critical; lockfile committed.
- **[HUMAN GATE]** Firebase console: authorised domains limited to `pulse.econz.cloud` (+ staging), API key restrictions, OAuth redirect URIs reviewed.

### Phase 2 exit criteria
RBAC inventory has zero unreviewed GAPs · authz matrix suite green in CI · permission changes propagate ≤ 60 s · security headers/CORS/rate limits verified in staging.

---

## 7. PHASE 3 — TASK LIFECYCLE AND TIME-TRACKING CORRECTNESS (~1.5 weeks)

**Goal:** time data you can trust, and task/workflow behaviour that is deterministic, concurrent-safe and audited.

### P3-01 Timer/session model (full design in Appendix B)
- **[FROM CODE]** decide between extending `TimeLog` (add `started_at`, `ended_at`, `source`, `stop_reason`, `is_auto_closed`, `reviewed_by_id`, `reviewed_at`) or adding a `time_sessions` table. **[DECISION]** default: extend `TimeLog` if it can represent open sessions cleanly; otherwise new table plus a compatibility view.
- Invariants (enforced in DB where possible):
  - at most **one open session per user** — partial unique index `ON time_logs (user_id) WHERE ended_at IS NULL` (Prisma needs a raw SQL migration);
  - `task.total_logged_minutes = SUM(closed sessions + manual logs)`, updated in the same transaction; nightly reconciliation job reports drift.
- New endpoints (keep the old ones working for mobile): `POST /timer/start {taskId}`, `POST /timer/stop {reason?, note?}`, `GET /timer/active`, `POST /timer/heartbeat`.
- Rules: start requires status in an active category (or transitions to it if the workflow allows — **[DECISION]** default: Clock In on a `todo` task performs the legal transition to the first active status, applying the estimate gate); stop reasons enumerated (`user`, `switched`, `status_change`, `reassigned`, `max_duration`, `end_of_day`, `idle`, `deactivated`, `task_closed`).
- **Clock Out ≠ change status** **[DECISION]** default: Clock Out only closes the session; status changes are separate explicit actions (with a shortcut menu: *Pause*, *Send to review*, *Mark done*).
- Heartbeat: web sends every 5 min while a timer runs and the tab is visible/active; if none for `idleThresholdMinutes` (default 30) the server marks the session `idle`; on next visit the user is asked *keep / discard idle time / stop at last activity*.
- End-of-day auto-stop at org working-hours end (Org Settings has official working days **[FROM CODE]**; add `workdayEnd` and timezone) — `stop_reason=end_of_day`, flagged for review.
- User can edit **their last session** within a policy window; edits beyond the window or above a threshold need Manager approval; all edits audited (original values preserved).
- **Tests:** state-machine unit tests for every transition in Appendix B; integration tests for the invariants; concurrency test (two simultaneous `start` calls → one open session).

### P3-02 Canonical estimate unit
- Store `estimate_minutes` (integer) alongside the existing value/unit; org setting `hoursPerWorkday` (default 8) drives day→minutes. Backfill via reviewed migration; all over-budget/accuracy calculations use minutes.
- **Tests:** conversions, over-budget boundary (equal is not over), null estimates excluded from accuracy.

### P3-03 Optimistic concurrency
- Add `version` (int) to `tasks` (increment on every write). PATCH/status/assign accept `expectedVersion` (or `If-Match`); mismatch → `409 Conflict` with the current task. UI shows "This task changed — review and retry".
- **Tests:** two parallel updates → second gets 409.

### P3-04 Transactional integrity
- Status transition, timer stop, `TimeLog` insert, counters, `ActivityLogEntry`, approval-step creation all happen in **one `$transaction`**; side effects (notifications, emails, push) go through an **outbox** (`outbox_events` table processed by the job runner) so a failed email never rolls back or duplicates business state, and nothing is sent for rolled-back work.
- **Tests:** failure injected mid-transition leaves no partial state; outbox retry is idempotent.

### P3-05 Workflow configuration safety (Jira-style admin governance)
Jira separates "who can *use* a workflow" from "who can *edit* it", and lets transitions carry conditions (who/when), validators (input correct) and post-functions (automation). Pulse already has `required_permission`, gates and approval steps; add governance:
- **Validation on save** (reject invalid workflows): exactly one initial (default) status; at least one `done`-category status; no unreachable statuses; every non-terminal status has an outgoing transition; no duplicate keys; hold-reason and estimate flags only on sensible categories.
- **Draft → publish** with versioning: edits create a draft; publishing validates and applies; tasks keep valid statuses. Block deleting/renaming a status that has tasks unless a mapping is supplied (bulk remap tool).
- **Dry-run simulator** in the admin UI: pick a role + task → shows which transitions are available and which gates would block.
- **Only Admin** (or `workflow.manage`) edits workflows; all changes appear in the config audit log.
- **Tests:** invalid workflows rejected; publish with tasks in removed status requires mapping.

### P3-06 Timesheet submit / approve / lock
Time tools such as Harvest let managers review and lock timesheets and keep audit trails; Pulse has timesheet *views* but no approval cycle.
- Model `timesheets (id, user_id, period_start, period_end, status[open|submitted|approved|rejected|locked], submitted_at, approver_id, decided_at, comment)`.
- Weekly period by default **[DECISION]** (org setting: weekly / bi-weekly / monthly). Employee submits; Manager (fallback Head → Admin) approves/rejects with comment; approved periods **lock** `TimeLog` edits (Admin override, audited).
- Reminders through notifications (day before period end; on missing submission; on pending approval).
- Reports/scorecards can filter to *approved* time.
- Employee Timesheet page (UI in P6-04) shows status per person/period, data-quality flags (sessions > 12 h, auto-closed, idle, overlapping).

### P3-07 Overdue calculation: correctness and performance
- **[FROM CODE]** timezone used for `dueDate` comparison and "today". **[DECISION]** compare in the assignee's regional timezone, falling back to org timezone.
- Replace "load all open tasks and evaluate in JS every 60 s" with a query that pre-filters in SQL (`due_date < now()` and status category open and not yet escalated) using an index; consider persisting `overdue_since` (set by the job) so dashboards can filter in SQL.
- Cadence: business-day overdue changes at most daily per region → **every 15 minutes is sufficient** **[DECISION]**; SLA percentage thresholds keep a 5-minute cadence.
- **Tests:** holidays, weekends, boundary exactly one business day, different `workState` calendars, tasks due before/after a holiday, missing calendar (falls back to weekends only).

### P3-08 Scorecard integrity
- Unit tests for all six sub-scores incl. zero-denominator cases, bounds (0–100), weights sum = 1.0 validation.
- Exclude sessions flagged `is_auto_closed` and unapproved manual edits from estimate-accuracy until reviewed **[DECISION]**.
- Re-compute affected scores after the data quarantine (P1-06) is resolved.

### P3-09 Deletion, archive, retention
- **[FROM CODE]** how `DELETE /tasks/:id` and `TaskActionRequest` work today. Default: archive = soft-delete with `archived_at`; hard delete only by Admin after retention period; time logs and activity entries are never deleted with the task.
- **[DECISION]** retention: activity log & time logs ≥ 24 months. Document in `docs/upgrade/DATA_POLICY.md`; **[HUMAN GATE]** confirm with legal/HR requirements for employee data (e.g. India's DPDP Act if personal data of employees is processed).

### Phase 3 exit criteria
Invariants enforced in DB · reconciliation job reports zero drift on staging data · concurrency and transaction tests green · workflow validation live · timesheet cycle usable end-to-end.

---

## 8. PHASE 4 — REAL-TIME AND DATA FRESHNESS (~1 week)

**Goal:** what users see is current, and the "Live" indicator is truthful.

### P4-01 Server-sent events (SSE) with cross-instance fan-out
- Endpoint `GET /api/v1/events/stream` (authenticated; scoped per user). Events: `task.assigned`, `task.updated`, `task.status_changed`, `timer.started`, `timer.stopped`, `notification.created`, `approval.requested`, `timesheet.status_changed`.
- Only send events the user is authorised to see (reuse `PolicyService`). Payload = event type + entity ID + version (client refetches; do not stream sensitive bodies).
- **Cross-instance delivery** (with 1–10 instances an in-memory event bus is not enough): **[DECISION]** default **Postgres `LISTEN/NOTIFY`** through a dedicated `pg` connection (not the Prisma pool) so no new infrastructure is needed; alternative Redis/Memorystore pub/sub if throughput grows.
- Cloud Run: request timeout up to 60 min; server sends a heartbeat comment every 25 s; client auto-reconnects with `Last-Event-ID`; on reconnect the client refetches critical queries.
- **Tests:** two API instances + one client on instance B receives an event produced on instance A; reconnect replays or refetches correctly.

### P4-02 Client cache policy
- Central query defaults in the web app: sensible `staleTime` per query type; query keys always include `userId` and relevant filters (no cross-user/role cache reuse); on logout clear cache.
- SSE handler maps events → `invalidateQueries` for affected keys; fallback polling (30 s) when SSE is disconnected.
- Mutations: optimistic update for status/assign with rollback on 409/403.

### P4-03 `allowedActions` on every task response
- Add to task DTOs: `version`, `estimateMinutes`, and
  ```json
  "allowedActions": {
    "canStartTimer": { "allowed": false, "reason": "ESTIMATE_REQUIRED" },
    "canStopTimer":  { "allowed": true },
    "transitions": [ { "toStatusId": "…", "allowed": true }, { "toStatusId": "…", "allowed": false, "reason": "OPEN_SUBTASKS" } ],
    "canEditEstimate": { "allowed": true, "reason": null },
    "canAssign": { "allowed": true }, "canComment": true, "canLogTime": true, "canReview": false
  }
  ```
- Computed by the same policy + workflow engine that enforces the rules. The UI renders buttons from this object only (disabled with a tooltip explaining `reason`), so UI and API can never disagree — this also eliminates the "task is there but I can't clock in" class of bug.
- Reason codes documented in `packages/shared-types`.

### P4-04 Live vs cached data map
- Produce a table (in `docs/upgrade/DATA_FRESHNESS.md`) of every dashboard/report widget → source (live query / aggregate cache) → freshness target. Personal and "my team right now" widgets must be **live**; org-level rollups and reports may use the cache and must display "as of hh:mm" plus a *Refresh now* action (rate-limited).
- **[FROM CODE]** whether `report_aggregate_cache` rows are per-department per-day only or include per-assignee counts (they must not be used for per-user live counters).

### P4-05 Notification reliability
- Dispatch via the outbox (P3-04); per-user dedupe; respect `NotificationPreference`; record delivery status per channel (in-app / push / email) with retry and dead-letter; bell unread count derived from DB and pushed via SSE.
- Deep links go to the task; assignment notification includes "Start" shortcut.
- Push: remove invalid Expo tokens on `DeviceNotRegistered` receipts.

### P4-06 Truthful "Live" indicator
- Bind the badge to actual SSE connection state: green = connected, amber = reconnecting (polling fallback active), grey = offline. Tooltip shows last event time.

### Phase 4 exit criteria
Assignment appears on the assignee's screen within ≈ 2 s without refresh on a multi-instance staging run · buttons driven by `allowedActions` · Live badge reflects reality · freshness map reviewed.

---

## 9. PHASE 5 — BACKGROUND JOBS, DATABASE AND INFRASTRUCTURE (~1.5 weeks)

**Goal:** jobs run exactly once on schedule regardless of instance count; the platform is deployable, recoverable and monitored.

### P5-01 Move jobs to Cloud Scheduler (uses the existing `infra/modules/scheduler-job/`)
- Internal endpoints `POST /internal/jobs/<overdue|sla|report-aggregate|report-delivery|timer-sweeper|reconcile|outbox>`. Authentication: **OIDC token from a dedicated Cloud Scheduler service account** with audience = API URL, verified in a guard; reject everything else (including user JWTs). Endpoints excluded from Swagger and rate limits but logged.
- Handlers call the existing `runCheck()`, `refresh()`, `checkAndDeliver()` **[FROM CODE]** exact method names, unchanged business logic.
- Each handler: advisory lock → run → write a row to `job_runs (job_name, started_at, finished_at, status, items, error)` → return 200 quickly (heavy work — report rendering — may move to a Cloud Run Job **[DECISION]**, later).
- Schedules **[DECISION]**: overdue every 15 min; SLA every 5 min; timer sweeper every 5 min; report aggregate every 15 min; report delivery every 5 min; reconcile nightly; outbox every minute (or triggered).
- Set `RUN_INLINE_JOBS=false` in staging then prod; keep inline mode only for local dev.
- Retry policy on scheduler (max attempts, backoff); alert on consecutive failures.
- **[HUMAN GATE]** Terraform apply for scheduler jobs in staging, then prod.
- **Accept:** on staging with 5 instances forced up, each job runs once per tick (verified from `job_runs`).

### P5-02 Migrations pipeline
- Pipeline step **before** deploying a new API revision: `prisma migrate deploy` (Cloud Run Job or Cloud Build step using the Cloud SQL connector). Never on app startup.
- Expand → migrate → contract discipline; migration lint (no destructive ops without an ADR); automatic pre-migration backup/snapshot for prod **[HUMAN GATE]**.
- Runbook for failed migration (rollback = restore or forward-fix).

### P5-03 Database performance and connections
- **Pool sizing:** each Cloud Run instance has its own Prisma pool. Set `connection_limit` (and `pool_timeout`) in `DATABASE_URL` so that `connection_limit × max_instances` stays well under Cloud SQL `max_connections` (leave headroom for migrations, admin, jobs). **[VERIFY]** `SHOW max_connections;` on each environment — dev's `db-f1-micro` is very small and `max 3` instances can exhaust it.
- If limits are tight: enable Cloud SQL managed connection pooling or PgBouncer (transaction mode; note migrations must bypass it).
- **Indexes [FROM CODE → verify with `EXPLAIN ANALYZE`]** — likely needed:
  - `tasks (assignee_id, status_id)`, `tasks (department_id, status_id, due_date)`, `tasks (parent_task_id)`, `tasks (due_date) WHERE archived_at IS NULL`
  - `time_logs (user_id, started_at)`, `time_logs (task_id)`
  - `activity_log_entries (task_id, created_at)`
  - `notifications (user_id, is_read, created_at)`
  - `report_aggregate_cache (department_id, date, metric)`
  - `holidays (calendar_id, date)`
- Enable Cloud SQL Query Insights; fix N+1 patterns (check `include` chains on task list/detail); enforce pagination everywhere.
- Set statement timeout and idle-in-transaction timeout.

### P5-04 File storage
- Attachments and bug-report screenshots move to a **private GCS bucket** using signed URLs: `POST /tasks/:id/attachments/init` (returns signed upload URL after checking permission, size ≤ limit, MIME allow-list) → client uploads → `POST …/complete` (server verifies object exists, size, type, records metadata). Download via short-lived signed URL after an authorisation check.
- Migrate `bug_reports.screenshot_base64` to GCS (script, staging first); keep a URL column, then drop the base64 column in the contract step.
- **[DECISION]** malware scanning (default: not in v1; document risk; enforce type/size limits and `Content-Disposition: attachment`).

### P5-05 Backups and disaster recovery **[HUMAN GATE]**
- Prod Cloud SQL: automated daily backups + **point-in-time recovery**, retention ≥ 14 days, **deletion protection** on, Terraform `prevent_destroy` on DB and buckets.
- **Restore drill:** restore a backup to a scratch instance, run smoke checks, record time taken. Targets **[DECISION]**: RPO ≤ 15 min (PITR), RTO ≤ 4 h.
- Store Terraform state in a versioned remote bucket with locking.

### P5-06 CI/CD with safe rollout
Pipeline (Cloud Build or GitHub Actions **[FROM CODE]**): PR → lint/type/unit/integration (Postgres service container) → build images → push to Artifact Registry → **deploy to staging** → migrate → E2E smoke → **manual approval** → migrate prod → deploy prod revision with `--no-traffic` and a tag → smoke test the tagged URL → shift 10% → 50% → 100% → keep previous revision for instant rollback (`gcloud run services update-traffic`).
- Image scanning (Artifact Registry / Trivy); pin base images; non-root container user.

### P5-07 Monitoring, alerting, SLOs
- Cloud Monitoring dashboard: request rate, 4xx/5xx, p50/p95/p99 latency, instance count, CPU/memory, Cloud SQL CPU/connections/storage, job success/latency (`job_runs`), outbox backlog, email failures, SSE connections.
- Alerts (notify owner by email/chat): 5xx > 2% for 5 min; p95 > 1.5 s for 10 min; Cloud SQL connections > 80%; job missed/failed twice; outbox backlog > N; auth-failure spike; uptime check on `/readyz` failing.
- **[DECISION]** SLO defaults: availability 99.5% monthly, p95 API latency < 500 ms for task list/detail.

### P5-08 Environment parity and secrets **[HUMAN GATE]**
- Separate Firebase project + OAuth client + JWT secrets + Cloud SQL per environment; prod must not use a test-named Firebase project (migrate if needed: update authorised domains, OAuth client, re-verify sign-in).
- Secret rotation runbook (JWT secrets, SMTP credentials, integration tokens); KMS-encrypted integration settings verified (**[VERIFY]** `IntegrationSetting.encrypted_config` is actually encrypted with KMS, not plaintext).
- Terraform parity: dev/staging/prod use the same module with only sizing differences; `terraform validate`, `tflint`, `checkov` in CI.

### P5-09 Runtime configuration
- Graceful shutdown (`app.enableShutdownHooks()`), startup/liveness probes on `/healthz` and `/readyz`, `cpu-boost` for cold starts, sensible `concurrency` (start at 40–80 and load-test), request timeout aligned with SSE.
- **[DECISION]** web service: keep Cloud Run static container (min 0 → cold start on first visit) or move to Cloud Storage + CDN/load balancer; default: set web min instances = 1 in prod until CDN migration.
- API ingress: keep public but front with Cloud Armor (basic WAF + rate rules) **[DECISION]**; enforce HTTPS + HSTS.

### P5-10 Email deliverability
- Google Workspace SMTP relay has sending limits and requires SPF/DKIM/DMARC alignment: verify the sender domain records; template review; bounce/complaint handling (mark address invalid); per-user daily email cap. **[DECISION]** move to a transactional provider only if volume grows.
- Integration test for `POST /integration-settings/smtp/test`; failure surfaces in Admin UI with the actual SMTP error (sanitised).

### Phase 5 exit criteria
Jobs run once per tick on multi-instance staging · migrations run in pipeline · restore drill done · alerts firing on a synthetic failure · staged prod rollout + rollback rehearsed.

---

## 10. PHASE 6 — UI / UX (~1.5 weeks, can overlap Phases 4–5)

**Goal:** every role completes its main journeys quickly, with no dead ends, and the UI never lies.

### P6-01 UX audit per role (evidence)
- Using Playwright, capture screenshots of every screen for each role (Admin, Management, Head, Manager, Employee) at 1440 px and 390 px; write `docs/upgrade/UX_AUDIT.md`: navigation visibility per role (**[VERIFY]** Employee has no Admin/Team-management items; Admin sees all), empty/loading/error states, dead ends, inconsistent labels, contrast issues.
- Define the **top journeys** and measure clicks: (1) Employee: see assigned task → start timer → stop → send to review; (2) Manager: assign task → track → approve review; (3) Manager/Head: approve timesheets; (4) Admin: invite user → assign role/department/manager; (5) Management: view org health → drill into a department.

### P6-02 Timer UX (highest value)
- **Persistent global timer chip** in the top bar on every page: task title, elapsed *session* time (primary) and total task time (secondary), Stop button, click → task. Warning colour after 4 h; banner prompt after 8 h.
- Active Work Session card (My Tasks): fix layout — one clear hero value (session time), total time as secondary line; no awkward wrapping; compact when idle.
- Clock In / Clock Out on **every task row** (My Tasks, All Tasks, Kanban card) using `allowedActions`; when disabled show why ("Add an estimate to start") with a one-click fix (open estimate popover).
- Switching timers: confirm toast "Stopped <A>, started <B>" with Undo.
- Idle prompt on return (keep / discard idle / stop at last activity) — see P3-01.

### P6-03 My Tasks and task lists
- Group by *Today / This week / Later / Overdue*; "New" badge for tasks assigned in the last 24 h; sticky primary action per row.
- Empty state distinguishes "no tasks assigned" from "still loading / failed to load" (show retry, never a false "nothing open — nice work!" on error).
- Filters persist in URL; saved filters (per user) **[DECISION]** backlog if time-boxed.
- Bulk actions with confirmation and result summary (X succeeded, Y failed and why).

### P6-04 Timesheet UX
- Employee view: weekly grid (days × tasks) with start/end times, totals vs working hours, flags (auto-closed, idle, > 12 h), *Submit week*.
- Manager view: pending approvals queue, approve/reject with comment, bulk approve, drill into a person's sessions.
- Aggregate view (current Employee Timesheet page): add date-range picker with custom range, timesheet status column, exclude/flag suspect sessions in averages, CSV export respecting scope; fix breadcrumbs to human labels.

### P6-05 Admin console
- Replace the static "Organization Ready for Production" banner with a **computed readiness checklist** (`GET /admin/readiness`): at least 2 active Admins; SMTP configured and last test passed; org timezone and working days set; each department has a head and a workflow; each work-location in use has a holiday calendar; scorecard weights sum to 1.0; no workflow validation errors; backups/health from the last `job_runs`; no failing scheduled jobs. Each failed item links to the fix.
- Roles & Permissions matrix: search, group by resource, dependency warnings, "compare roles", preview *"what can this user do?"* (uses the policy engine).
- Users: bulk invite (CSV), last-login, status, filter by department/role; safe deactivation flow (P2-08).
- Change history view fed by the config audit log.

### P6-06 Login and session
- Google button only (unless P1-01 decides otherwise). Clear errors: "This Google account isn't invited — contact <admin email>", "Wrong domain", "Session expired — sign in again" (preserve the intended URL).
- Loading and offline states; no flash of protected content.

### P6-07 Design system and accessibility
- Document tokens (colour, spacing, radius, type) for dark and light themes in `docs/upgrade/DESIGN_SYSTEM.md`; verify **WCAG AA contrast** in dark mode (several greys on the dark surfaces appear low-contrast in screenshots) **[VERIFY with tooling]**.
- Keyboard navigation, focus rings, ARIA labels, dialog focus trapping (Radix helps), reduced-motion support; run axe in CI on key pages.
- Consistent components for empty/loading/error, confirmation dialogs, toasts.

### P6-08 Responsive and performance
- Usable at 390 px (tables become cards; timer chip collapses); touch targets ≥ 44 px.
- Route-level code splitting; lazy-load charts/Tiptap/timeline; list virtualisation for > 200 rows; bundle-size budget in CI; Lighthouse ≥ 85 on My Tasks.

### P6-09 Locale, dates and copy
- Use org locale/timezone for all dates (India: `dd/mm/yyyy` or `14 Sep 2026`) and relative times; consistent duration format (`56h 12m`); consistent terminology (Clock In/Out vs Start/Stop; Done vs Completed) — **[DECISION]** default "Clock In / Clock Out" for timer, "Done" for status.

### P6-10 Notifications and onboarding
- Notification centre page (filter unread/type, mark all read); per-channel preferences with sensible defaults.
- First-run tour per role (Employee: "start your first timer"; Manager: "assign and review"; Admin: readiness checklist); contextual help links to a short user guide (`docs/user-guide/`).

### Phase 6 exit criteria
Top journeys measured and within agreed click budgets · no false empty states · axe clean on key pages · timer chip and `allowedActions` UI shipped · UX_AUDIT issues triaged (fixed or ticketed).

---

## 11. PHASE 7 — TEST STRATEGY AND RELEASE READINESS (~1.5 weeks)

### P7-01 Unit tests (Jest / Vitest)
`business-days.util` (weekends, holidays, regional calendars, boundaries) · workflow gates (estimate, hold reason, review gate, subtask hard block, dependency soft warning) · estimate lock and admin override · timer state machine (Appendix B) · scorecard math and bounds · SLA thresholds · RRULE recurrence · CSV/XLSX/PDF export snapshots · `PolicyService` scope fragments.

### P7-02 Integration tests (Nest + real Postgres via Testcontainers/docker-compose)
Authz matrix (P2-05) · assignment read-your-writes (B1) · optimistic concurrency 409 · transaction atomicity + outbox idempotency · job idempotency under concurrency · migrations from empty DB and from a staging snapshot · reconciliation (`total_logged_minutes` = sum of logs) · signed-URL upload flow.

### P7-03 End-to-end (Playwright, against staging)
One spec per top journey per role (P6-01) plus: assign → assignee sees within 2 s without refresh; timer start/stop/switch/auto-stop; estimate gate; review request → approve; timesheet submit → approve → lock; role switch narrows view; deactivation logs the user out; export respects scope.

### P7-04 Load and resilience (k6)
- Scenario: 200 concurrent users, realistic mix (list tasks, open detail, start/stop timers, comments, dashboards, SSE connections). Thresholds: p95 < 500 ms, error rate < 1%. Watch Cloud SQL connections and instance count.
- Scale test at `max_instances`: prove jobs run once (from `job_runs`) and no duplicate notifications.
- Resilience: kill an instance mid-transition; restart during a running timer; DB failover; SMTP down (outbox retries, no user-facing failure).

### P7-05 Security testing
OWASP API Top 10 (2023) checklist with a result per item (BOLA, broken authentication, property-level authorisation, resource consumption, function-level authorisation, sensitive business flows, SSRF, misconfiguration, inventory, unsafe consumption) · OWASP ZAP baseline scan on staging · `npm audit` clean of high/critical · gitleaks clean · verify no dev-login, Swagger protected, CORS allow-list, headers, cookie flags.

### P7-06 Data migration and cutover plan **[HUMAN GATE]**
- Dry-run every migration and data script on a fresh copy of prod; record durations and row counts; define a maintenance window if needed; rollback plan for each step.

### P7-07 UAT / pilot
- Pilot with one department (≈ 2 weeks) behind a flag; use the in-app Bug Reports; daily triage; exit when no Sev-1/Sev-2 open for 5 working days and the timesheet approval cycle completed once.

### P7-08 Documentation and operations
- `docs/runbook/`: deploy, rollback, migration failure, restore from backup, rotate secrets, job failure, email failure, "user cannot see task" triage (with request-ID lookup), on-call contacts.
- `docs/user-guide/` per role; admin guide (workflows, roles, holidays, SLAs, scorecards).
- Release checklist (Appendix F) signed off by the owner.

### Phase 7 exit criteria (= production-ready gate)
All Appendix F items ticked · zero open Sev-1/Sev-2 · load test thresholds met · restore drill done · owner sign-off **[HUMAN GATE]**.

---

## 12. PHASE 8 — MOBILE (~2 weeks; after backend API is stable)

- **P8-01 Upgrade Expo/React Native.** Expo SDK 51 (RN 0.74, May 2024) is far behind current SDKs. Upgrade stepwise to the latest stable SDK using `npx expo install --fix` and the SDK upgrade guides; enable the New Architecture if all dependencies support it; update `patch-package` patches or remove them. **[FROM CODE]** current native modules and patches.
- **P8-02 Timer parity:** Clock In/Out on task rows, active timer banner, idle handling, uses the new `/timer/*` endpoints; local notification when a timer has run > 4 h.
- **P8-03 Offline tolerance:** queue Clock In/Out and comments when offline with timestamps, sync on reconnect, conflict handling by server timestamps and `expectedVersion`.
- **P8-04 Auth and security:** secure token storage (SecureStore), refresh rotation, biometric unlock (optional), certificate/host pinning **[DECISION]** default off.
- **P8-05 Push notifications:** token lifecycle (register on login, remove on logout/`DeviceNotRegistered`), deep links, preference sync.
- **P8-06 Release engineering:** EAS build profiles (dev/staging/prod), OTA update policy, crash reporting, store listings (privacy labels, data-safety form), staged rollout, minimum-supported-version gate from the API.
- **Accept:** Employee journey 1 works on iOS and Android including offline start/stop.

---

## 13. POST-LAUNCH BACKLOG (Jira-inspired, prioritise with the owner)

- Human-readable task keys per department (e.g. `DEV-123`) and links.
- Watchers/followers, labels, saved filters and shareable views.
- Task templates and checklists; CSV/Excel bulk import; duplicate task.
- Automation rules ("when moved to Review → assign to reviewer", "when overdue → escalate") — a light version of Jira's post-functions.
- Slack/Teams integration (the `IntegrationSetting` already anticipates Slack); outbound webhooks; public API tokens.
- Capacity planning: per-user working hours, leave/holidays per person, workload heat-map, over-allocation warnings.
- Calendar sync (Google Calendar) for due dates; time-off requests.
- SSO alternatives (Microsoft), SCIM provisioning, audit-log export.
- Billing/cost dimension on time (if the org needs client/project costing).

---

# APPENDICES

## Appendix A — Target authorisation matrix (proposed defaults; **[FROM CODE]** compare with the actual seed, list differences, do not silently change behaviour)

Legend: ● full · ◐ scoped (see note) · ○ none · R read-only

| Capability | Admin | Management | Head | Manager | Employee |
|---|---|---|---|---|---|
| View tasks | ● all | R all | ◐ their department(s) | ◐ self + direct reports | ◐ assigned to / created by self, their subtasks |
| Create task | ● | ○ **[DECISION]** | ◐ dept | ◐ dept | ◐ dept (self-assigned or unassigned) |
| Assign / reassign | ● | ○ | ◐ dept | ◐ direct reports | ◐ self only **[DECISION]** |
| Transition status | per workflow `required_permission` and gates | ○ | ◐ | ◐ | ◐ own tasks |
| Edit estimate | ● override (audited) | ○ | ○ | ○ | ◐ own task, within 30 min |
| Start/stop timer | ◐ stop others' (audited) | ○ | ○ | ◐ own tasks | ◐ own tasks |
| Manual time log / edit | ● (audited) | ○ | ◐ dept (audited) | ◐ reports (audited) | ◐ own, until timesheet locked |
| Review / approve work | ● | ○ | ◐ dept | ◐ direct reports | ○ |
| Timesheet submit | — | — | ◐ own | ◐ own | ◐ own |
| Timesheet approve | ● | R | ◐ managers' teams (fallback) | ◐ direct reports | ○ |
| Team dashboard | ● org | R org | ◐ dept | ◐ reports | redirect to personal |
| Scorecards | ● all | R all | ◐ dept | ◐ reports | ◐ self |
| Reports view / export | ● | R (export **[DECISION]**) | ◐ dept | ◐ reports | ◐ personal only |
| Comment / attach | ● | ◐ visible tasks | ◐ | ◐ | ◐ visible tasks |
| Archive / delete task | ● | ○ | ◐ via action-request | ◐ via action-request | ○ |
| Admin modules (15) | ● | ○ or R **[DECISION]** | ○ | ○ | ○ |
| Bug report submit / triage | ● triage | submit | submit | submit | submit |

Rules: (1) permissions decide the *action type*, scope decides the *objects*; (2) active role never widens access; (3) every "●/◐" cell has at least one allow and one deny automated test.

## Appendix B — Timer state machine

**States:** `IDLE` (no open session) · `RUNNING(task, startedAt, lastHeartbeatAt)` · `IDLE_FLAGGED(task, lastActivityAt)` (server-detected idle awaiting user decision).

| Event | From | To | Effects |
|---|---|---|---|
| START(task) | IDLE | RUNNING | validate policy + estimate gate; transition task if needed; create open session |
| START(task B) | RUNNING(A) | RUNNING(B) | stop A with `switched`; open B — one transaction |
| HEARTBEAT | RUNNING | RUNNING | update `lastHeartbeatAt` |
| STOP(user) | RUNNING | IDLE | close session, write minutes, update task total, activity entry |
| STATUS_CHANGE(non-active) / REASSIGN / ARCHIVE / DEACTIVATE | RUNNING | IDLE | close with matching `stop_reason` |
| SWEEP: no heartbeat > idle threshold | RUNNING | IDLE_FLAGGED | mark idle; notify on next visit |
| SWEEP: duration > max | RUNNING | IDLE | close at `startedAt + max`, `is_auto_closed = true`, notify user + manager |
| SWEEP: end of workday | RUNNING | IDLE | close at workday end, `end_of_day`, flag |
| RESOLVE_IDLE(keep) | IDLE_FLAGGED | RUNNING | keep time |
| RESOLVE_IDLE(discard / stop-at-last-activity) | IDLE_FLAGGED | IDLE | close at `lastActivityAt` |

Invariants: one open session per user (DB partial unique index); a session never spans more than `maxTimerSessionMinutes`; `closed.minutes = ended_at − started_at` (never client-supplied); every mutation is audited with actor and reason.

## Appendix C — API additions / changes (all additive; keep old endpoints for mobile until Phase 8)

| Endpoint | Purpose |
|---|---|
| `GET /healthz`, `GET /readyz` | liveness / readiness (DB + migrations) |
| `GET /events/stream` (SSE) | real-time events |
| `POST /timer/start`, `POST /timer/stop`, `GET /timer/active`, `POST /timer/heartbeat`, `POST /timer/resolve-idle` | timer API |
| Task responses: `version`, `estimateMinutes`, `allowedActions` | UI-safe capability data |
| `PATCH/POST` task mutations accept `expectedVersion` | optimistic concurrency, 409 |
| `GET/POST /timesheets`, `POST /timesheets/:id/submit`, `/approve`, `/reject` | timesheet cycle |
| `GET /admin/readiness` | computed readiness checklist |
| `GET /admin/audit-log` | config change history |
| `POST /internal/jobs/:name` | Cloud Scheduler (OIDC only) |
| `POST /tasks/:id/attachments/init`, `/complete` | signed-URL uploads |

## Appendix D — Environment variables (names only; **[FROM CODE]** add any missing)

Existing: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_OAUTH_CLIENT_SECRET`, `PORT`, `NODE_ENV`.
Proposed: `ENABLE_DEV_LOGIN` (default false), `VITE_ENABLE_DEV_LOGIN`, `RUN_INLINE_JOBS`, `INTERNAL_JOBS_AUDIENCE`, `SCHEDULER_SERVICE_ACCOUNT`, `CORS_ALLOWED_ORIGINS`, `DB_CONNECTION_LIMIT`, `DB_POOL_TIMEOUT`, `SENTRY_DSN`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `MAX_TIMER_SESSION_MINUTES` (org setting overrides), `GCS_ATTACHMENTS_BUCKET`, `THROTTLE_REDIS_URL` (if used), `FIREBASE_PROJECT_ID`, `ALLOWED_EMAIL_DOMAINS`.
Rule: startup validation (zod) fails fast in production if required variables are missing or unsafe combinations are set.

## Appendix E — Test matrix summary
Unit · Integration (authz, concurrency, transactions, jobs, migrations) · E2E per role · Load (k6) · Resilience · Security (OWASP API Top 10, ZAP) · Accessibility (axe) · Visual (Playwright screenshots on key screens). Coverage targets **[DECISION]**: ≥ 80% on `business-days`, workflow engine, timer, scorecard, policy; no minimum elsewhere but no untested endpoint in the authz matrix.

## Appendix F — Production release checklist
- [ ] Email-only/dev sign-in absent from prod; secrets rotated; Firebase project is production-named and restricted
- [ ] RBAC inventory has no open GAPs; authz matrix green
- [ ] B1 harness passes on multi-instance staging; assignment appears live
- [ ] Timer invariants enforced; suspect data reviewed by owner; reconciliation clean
- [ ] Jobs run through Cloud Scheduler; inline jobs off in prod; `job_runs` healthy
- [ ] Migrations via pipeline; backups + PITR on; restore drill done; deletion protection on
- [ ] Monitoring dashboard + alerts live; on-call contact set
- [ ] Load test thresholds met at expected 2× peak
- [ ] Security checklist complete; no high/critical dependency issues
- [ ] UX audit items closed or ticketed; axe clean on key pages
- [ ] Runbooks and user/admin guides published
- [ ] Pilot exit criteria met; rollback rehearsed; owner sign-off

## Appendix G — ADR template (`docs/decisions/NNN-title.md`)
`Title · Date · Status (proposed/accepted/superseded) · Context · Options considered · Decision (and why) · Consequences · How to revisit`

## Appendix H — Open items for the human owner (agent: copy answers into ADRs)
1. Should Employees see other people's tasks in their department, or only their own? (Appendix A assumes "own only".)
2. Are Managers responsible for direct reports only, or their reports' reports too?
3. Should Management be strictly read-only, and may they export reports?
4. Is "email sign-in" on the login page intended? (Default: remove.)
5. Working hours/end-of-day per organisation or per user? Max timer session (default 10 h) and idle threshold (default 30 min) acceptable?
6. Timesheet cadence (weekly default) and who approves when a user has no manager?
7. Retention requirements for time/activity data; any legal review needed for employee data?
8. Expected user count and growth in the next 12 months (drives pool sizes, Redis need, load-test targets).
9. Do you need attendance-style daily clock-in (shift start/end) in addition to task timers?
10. Which Firebase project does production use today, and is there a separate one for staging?

## Appendix I — Reference reading
- Jira workflow conditions/validators/post-functions: https://confluence.atlassian.com/spaces/JIRA060/pages/370705899/Advanced+Workflow+Configuration
- Cloud Run CPU allocation (always-on CPU for background work): https://cloud.google.com/blog/products/serverless/cloud-run-gets-always-on-cpu-allocation
- Prisma connection management with multiple instances: https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections
- OWASP API Security Top 10 (2023): https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- Timesheet approval practices (Harvest): https://www.getharvest.com/time-tracking/approve-timesheets

---

## KICKOFF PROMPT (paste into Antigravity)

> Read `PULSE_PRODUCTION_UPGRADE_PLAN.md` completely. Treat the repository as the source of truth and record every mismatch in `docs/upgrade/DISCREPANCIES.md`. Start with **Phase 0 only**: complete P0-01 to P0-05, write the outputs into `docs/upgrade/`, and create `docs/upgrade/PROGRESS.md`. Do not change application behaviour in Phase 0 except the observability additions in P0-04. Stop at the Phase 0 exit criteria and post a summary with: confirmed vs refuted assumptions, the RBAC/route GAP preview, the B1 investigation status, and any blockers. Do not start Phase 1 until I approve.
