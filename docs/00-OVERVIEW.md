# 00 — Overview

## How to use this documentation

This is a self-contained specification for building, deploying, and operating a
company-wide task management platform. It is written so that an autonomous
development agent (Claude Code) can read it and build the application without
needing to ask clarifying questions for anything marked **Fixed** or **Default**.

Each document in this set uses three labels for every decision:

- **[Fixed]** — Not negotiable. Build exactly this.
- **[Default]** — A reasonable choice has been made and documented so the build
  isn't blocked. The build agent should follow it unless a `[Fixed]` instruction
  elsewhere overrides it. Defaults may be revisited later.
- **[Open]** — A business or logical decision that genuinely needs the product
  owner's input. All open items are also tracked centrally in
  `10-OPEN-DECISIONS.md`. Where an open decision blocks progress, the build agent
  should make the most reasonable assumption, clearly log it as an assumption,
  and continue — not stall.

Read the docs in order. Later docs assume the decisions made in earlier ones.

```
00-OVERVIEW.md          — this file
01-ARCHITECTURE.md      — system design, tech stack + reasoning, monorepo layout
02-DATA-MODEL.md        — entities, relationships, ERD, custom fields design
03-RBAC-AUTH.md         — roles/permissions model, auth flow, SSO abstraction
04-API-SPEC.md          — REST endpoints, conventions, versioning
05-FEATURES.md          — detailed feature specs per phase (v1, v1.1, v1.2)
06-FRONTEND-WEB.md      — web app structure, routing, state, UI conventions
07-FRONTEND-MOBILE.md   — React Native app structure, shared code strategy
08-INFRA-DEPLOYMENT.md  — GCP setup, CI/CD, environments, cost estimates
09-TERRAFORM-IAC.md     — Terraform module structure, state, how to apply changes
10-OPEN-DECISIONS.md    — central log of decisions awaiting product owner input
```

---

## 1. Product vision

A single internal platform that lets managers across every department assign,
track, and monitor work, and lets every employee see and act on the tasks
assigned to them — replacing scattered spreadsheets, chat messages, and verbal
task assignment with one system of record.

The tool must be simple enough for non-technical staff (e.g. FSRs, ISRs) to use
daily, while still supporting the operational depth that departments like
Development, Support, and Finance need (time tracking, SLAs, approvals, custom
fields, reporting).

## 2. Organization context [Fixed]

- **Single organization** — not multi-tenant. No client-facing or cross-company
  data isolation is required.
- **Internal tool only** — no external/public users. External integration
  happens exclusively through the REST API (see `04-API-SPEC.md`), not through
  direct product access.
- **Departments in scope:** Development, HR & Admin, Sales, Pre-sales, Customer
  Support, Finance & Revenue, Management, Field Sales Representatives (FSRs),
  Inside Sales Representatives (ISRs), Marketing.

## 3. Users [Fixed]

Every employee in the organization is a user. Every user has one or more roles
that determine what they can see and do (see `03-RBAC-AUTH.md`). There is no
"read-only public" or anonymous access.

Broad user categories:
- **Managers** — assign tasks, monitor team/department progress, approve
  workflows, view dashboards and reports for their scope.
- **Individual contributors** (all departments, including FSRs/ISRs) — receive
  tasks, update status, log time, comment, attach files.
- **Admins** — configure the system: roles, permissions, custom fields,
  departments, SSO settings.
- **Executives/Management team** — cross-department visibility and reporting,
  typically read/report-heavy rather than task-assigning.

Exact role definitions and permission granularity are in `03-RBAC-AUTH.md`.

## 4. Platform targets [Fixed]

- **Web application** — primary interface, used by all roles.
- **Mobile application** — React Native, iOS and Android, single codebase.
- Both platforms consume the same REST API. No platform-specific backend logic.

## 5. Core constraints [Fixed]

- **Cloud provider:** Google Cloud Platform (GCP).
- **Cost-conscious infrastructure:** prefer scale-to-zero / pay-per-use managed
  services over always-on heavy infrastructure. Every infra decision in
  `08-INFRA-DEPLOYMENT.md` documents a cost trade-off.
- **Auth:** "Sign in with Google" at launch, plus a pluggable SSO abstraction
  (OIDC/SAML-capable) so a to-be-determined internal SSO can be integrated later
  without reworking the auth system. Full detail in `03-RBAC-AUTH.md`.
- **No SEO requirements** — this is an internal tool behind authentication.
  This ruled out SSR frameworks in favor of a plain SPA (see
  `01-ARCHITECTURE.md`).
- **Reporting/dashboards are built in-app** — no dependency on third-party BI
  tools (e.g. Looker Studio). Detailed in `05-FEATURES.md` (Phase v1.2).
- **RBAC is custom and fine-grained** — permissions are configurable per action,
  not just three fixed roles. Detailed in `03-RBAC-AUTH.md`.
- **The system is admin-configurable by design, not just by RBAC.** This goes
  beyond permissions: roles, custom fields, task statuses/workflows, priority
  levels, approval chains, SLA rules, and **operational integration settings
  (e.g. the outbound email/SMTP configuration)** must all be creatable,
  editable, and retirable by Admins through the product itself, without a
  code change or redeploy. The organization's structure, processes, *and*
  operational settings will evolve, and the tool needs to evolve with them
  without depending on engineering time for every change. Concretely: if the
  org's SMTP provider or credentials change, an Admin updates that in the
  Admin UI and it takes effect immediately — it is not a hardcoded deployment
  secret that only an engineer can rotate. (A small, genuinely
  bootstrap-only set of secrets — e.g. the database connection string, the
  JWT signing key — are the one deliberate exception; see
  `01-ARCHITECTURE.md` §2.9a for exactly where that line sits and why.) This
  principle applies across every doc in this set — anywhere a list of values
  (roles, statuses, fields, workflow steps, integration credentials) might
  look "fixed" in an example, assume it is admin-editable data, not hardcoded
  logic, unless a document explicitly says otherwise for a technical/safety
  reason.
- **REST API is a first-class deliverable**, not an afterthought — built to
  support future third-party integrations from day one.

## 6. Phased roadmap [Fixed]

The full feature vision is documented across these docs, but it is **built and
shipped in phases**. Each phase is a usable, deployable increment.

### Phase v1 — Core platform
- Auth (Google Sign-In) + pluggable SSO abstraction
- Custom RBAC (roles, permissions, department scoping)
- Task CRUD: tasks, subtasks, due dates, status, priority, assignment
- Comments and file attachments
- Department-specific custom fields (generic task structure + per-department
  extra fields)
- Basic notifications: in-app + email
- Basic dashboards: task counts, overdue, by status, by assignee
- Web app + mobile app (core flows)
- REST API covering all v1 functionality

### Phase v1.1 — Operational depth
- Time tracking
- SLA definitions + escalation rules/notifications
- Approval workflows (task/status transitions requiring sign-off)
- Recurring tasks
- Task dependencies
- Kanban and/or Gantt views
- Push notifications (mobile), Slack/Teams notification channel (stretch)

### Phase v1.2 — Reporting & analytics
- Full BI-style in-app reporting engine
- Team performance analytics (workload, completion rates, trends)
- Custom, exportable reports (CSV/PDF/Excel)
- Department- and org-level dashboards

> Reporting design will be discussed in detail when we reach `05-FEATURES.md` /
> the v1.2 section — deferred intentionally per product owner request.

## 7. What "done" looks like for this doc set

By the end of this documentation set, a build agent should be able to:
1. Stand up the monorepo with correct tooling and structure.
2. Provision GCP infrastructure for a dev/staging environment.
3. Build the v1 backend, web app, and mobile app end to end.
4. Deploy v1 to GCP with CI/CD in place.
5. Know exactly which decisions are still open, and what assumption to make in
   the meantime if the product owner isn't immediately available.

## 8. Next document

Proceed to `01-ARCHITECTURE.md` for the system design, full tech stack with
reasoning, and monorepo layout.
