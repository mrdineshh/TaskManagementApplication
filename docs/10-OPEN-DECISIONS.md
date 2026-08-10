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

---

## How to keep this log current

As the build proceeds and these items get resolved, update this document (or
have the build agent flag it for update) rather than letting answers live
only in chat history or scattered commit messages — this file is meant to
stay the single source of truth for "what's still undecided" for the life of
the project, not just through initial launch.
