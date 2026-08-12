# 05 — Features

Read docs `00`–`04` first. This document specifies feature behavior in detail,
organized by the phased roadmap from `00-OVERVIEW.md` §6. It's the layer above
data model / API — how these building blocks combine into actual product
behavior and UX flows.

> **Note on reporting (Phase v1.2):** per your request, that section is
> intentionally left as an outline with open questions rather than a frozen
> spec — see §3 below. Everything else in this document is a complete v1/v1.1
> spec.

---

## 1. Phase v1 — Core platform

### 1.1 Task creation & management **[Fixed]**

- Any user with `task.create` can create a task: title, description,
  department, assignee (optional at creation), due date, priority, workflow
  (defaults to the department's default workflow), and any applicable custom
  fields (rendered dynamically based on `CustomFieldDefinition` for the
  selected department).
- Subtasks: created from within a parent task, inherit the parent's
  department by default (editable), independently assignable.
- Bulk actions **[Default, v1 scope]**: multi-select tasks in list view to
  bulk-reassign, bulk-change status (respecting transition permissions), or
  bulk-archive.

### 1.2 Task views **[Fixed for List; Kanban/Gantt deferred to v1.1]**

- **List view**: sortable/filterable table — by department, assignee, status,
  priority, due date. This is the v1 baseline view.
- **My Tasks**: default landing view for individual contributors — tasks
  assigned to them, grouped by status.
- **Team/Department view**: for Managers — all tasks within their scoped
  department(s), same filter/sort capability.
- Kanban board and Gantt/timeline views are **v1.1** (§2.3) — they depend on
  the workflow model being fully exercised first and are more complex UI to
  get right, so they're sequenced after the core CRUD experience ships and is
  validated.

### 1.3 Assignment & reassignment **[Fixed]**

- A task can be unassigned, or assigned to exactly **one primary assignee**
  (confirmed) — multiple people working the same piece of work is handled via
  subtasks, not multiple assignees on one task.
- Reassignment is logged in `ActivityLogEntry` and triggers a notification to
  both the old and new assignee.
- Anyone with `task.assign` for that department can reassign at any time.

### 1.4 Comments & attachments **[Fixed]**

- Threaded flat (not nested-reply) comments per task, per `02-DATA-MODEL.md`.
- `@mention` of a user in a comment triggers a notification.
- Attachments: any file type, size limit **[Default: 25MB per file]** enforced
  client- and server-side; multiple attachments per task.

### 1.5 Notifications **[Fixed, v1 channels: in-app + email]**

Triggering events in v1:
- Task assigned/reassigned to you
- Task due soon (**[Default: 24h before due_date]**, configurable later)
- Task overdue
- Comment mention
- Status changed on a task you're assigned to or created
- Custom field marked required and missing on save (validation, not a
  notification — noted here for completeness)

Users can manage per-event notification preferences (channel on/off) via a
settings page — **[Default, v1 scope]**, low effort to include from the start
and expected by most users of a daily-use tool.

### 1.6 Dashboards (basic, v1) **[Fixed]**

- **Personal dashboard**: my open tasks, overdue count, due this week,
  recently completed.
- **Department/manager dashboard**: task counts by status, overdue tasks,
  tasks by assignee (workload glance), recently created.
- These are simpler precursors to the full v1.2 reporting engine — built with
  the same underlying aggregation-query approach so v1.2 extends rather than
  replaces them.

### 1.7 Admin configuration screens **[Fixed — this is where the configurability principle becomes real UI]**

A dedicated **Admin area**, visible only to users with the relevant `*.manage`
permissions, covering:
- Departments (create/edit/deactivate)
- Roles & permissions (create/edit roles, assign permission bundles)
- User management (invite, deactivate, assign departments/roles)
- Custom field definitions (per department)
- Workflow builder: create workflows, define statuses (label, order,
  category, color), define transitions and which permission gates each one
- Priority list management (add/edit/reorder/deactivate priority levels,
  org-wide or per department — per `02-DATA-MODEL.md` §2.5b)
- Integration settings: SMTP configuration (host, port, credentials,
  from-address) and any future integration credentials, editable at runtime
  with no redeploy required (per `01-ARCHITECTURE.md` §2.9a) — this is where
  an Admin would update the outbound email settings if they ever change
- Org settings (name, timezone, logo, working days)

This admin area is not an afterthought bolted on later — it's core v1 scope,
because without it the "admin-configurable by design" principle from
`00-OVERVIEW.md` has no interface to act through.

## 2. Phase v1.1 — Operational depth

### 2.1 Time tracking **[Fixed]**

- Users log time against a task (`TimeLog`): duration + optional note,
  either via manual entry or a start/stop timer widget **[Default: support
  both]**.
- Aggregate time-per-task and time-per-user available on the task detail view
  and (later) in reporting.
- **Open question:** is time tracking mandatory for certain departments (e.g.
  billable work in Development/Support) or always optional? Flagged in
  `10-OPEN-DECISIONS.md` — defaults to optional everywhere until specified.

### 2.2 SLA & escalation **[Fixed]**

- Admins define `SLAPolicy` records per department: response time,
  resolution time, and escalation rules (who gets notified/reassigned-to at
  which thresholds — e.g. 80% of SLA elapsed → notify assignee; 100% elapsed
  → notify assignee's manager).
- A scheduled job (Cloud Scheduler + Cloud Tasks, per `01-ARCHITECTURE.md`)
  evaluates open tasks against their SLA policy periodically and fires
  escalation notifications/reassignments as configured.
- SLA breach status is visible on the task (badge/indicator) and factors into
  dashboards.

### 2.3 Kanban & Gantt views **[Fixed]**

- **Kanban**: columns = the task's current `WorkflowDefinition` statuses, in
  their defined `display_order`. Drag-and-drop between columns triggers the
  same `/tasks/:id/transition` endpoint as any other status change — so
  permission gates on transitions apply identically in Kanban as in list view.
- **Gantt/timeline**: based on `start_date`/`due_date` and (once added)
  `TaskDependency` relationships, for departments where sequencing matters
  (e.g. Development, Marketing campaign planning).

### 2.4 Dependencies & recurring tasks **[Fixed]**

- Dependencies: `blocks` type prevents (or at minimum warns on, **[Open —
  hard block vs. soft warning]**) transitioning a task to a "done"-category
  status while a blocking dependency is still open.
- Recurring tasks: `recurrence_rule` (iCal RRULE) on a task; a scheduled job
  generates the next occurrence when the current one is completed or on
  schedule, per the rule.

### 2.5 Approval workflows **[Fixed]**

- A `WorkflowTransition` can be flagged `requires_approval` — attempting that
  transition creates an `ApprovalStep` instead of immediately changing status.
- Approval chains support multiple sequential steps (`step_order`) — e.g.
  Manager approval, then Finance approval, before a task reaches "Approved."
  Configured by Admins per workflow, consistent with the configurability
  principle.
- Approvers are notified; approving/rejecting a step resolves it and either
  advances to the next step or completes/reverts the transition.

### 2.6 Push & chat notifications **[Fixed for push; Slack/Teams is stretch]**

- Push via Firebase Cloud Messaging on mobile for the same event set as §1.5.
- Slack/Teams integration: outbound webhook per department/channel, mapped to
  the same notification events — treated as a stretch goal for v1.1, may slip
  to a later phase without blocking the rest of v1.1.

## 3. Phase v1.2 — Reporting & analytics **[Fixed]**

### 3.1 Audience & scoping **[Fixed]**

Reporting is RBAC-driven, same principle as everywhere else in the system —
no separate "reporting permissions" system:
- **Managers** (department-scoped roles with `report.view`) see reports
  scoped to their department(s) only — enforced at the query layer, same as
  task visibility (`03-RBAC-AUTH.md` §2.5).
- **Executives/Management team** (org-wide role with `report.view`) see
  cross-department, org-wide reports and can drill into any department.
- The same report *templates and builder* are used by both — what differs is
  the data each user's scope resolves to, not separate UI. A manager building
  a report simply can't select departments outside their scope; an exec can
  select all or filter to one.

### 3.2 Key metrics **[Default — starter set, extensible]**

Available as selectable metrics in the report builder (§3.3):
- Task counts by status/category, department, assignee, priority
- Overdue count / overdue rate
- Average time-to-completion (created → completed)
- SLA compliance rate, average SLA breach severity (**v1.1 data dependency**)
- Workload distribution (open tasks per assignee) — surfaces
  over/under-loaded team members
- Time tracked vs. task count (from `TimeLog`, **v1.1 data dependency**)
- Completion rate / throughput over a time range (tasks completed per
  week/month)
- Department-to-department comparison views (for exec/org-wide reports)

New metrics are added as new report "metric definitions" registered in code
(they require a real backing query), but *which metrics appear in which
report, with what filters/grouping* is entirely user-configured — consistent
with the configurability principle.

### 3.3 Custom report builder **[Fixed]**

- UI lets a user: pick one or more metrics (§3.2), pick dimensions to group by
  (department, assignee, status, priority, time period), pick a date range,
  pick a chart type (bar, line, pie, table), and pick filters (same filter
  vocabulary as the task list view: department, workflow, custom field
  values, etc.).
- Reports can be **saved** (`SavedReport`, see `02-DATA-MODEL.md` update
  below) for reuse, and optionally shared with specific roles/departments or
  kept private to the creator.
- A small set of **pre-built starter templates** ship at launch (e.g.
  "Department Overview," "Overdue Tasks," "Team Workload," "SLA Compliance")
  so the system is useful immediately — these are just pre-configured
  `SavedReport` rows an Admin could have created, not special code paths.

### 3.4 Scheduling & email delivery **[Fixed]**

- Any `SavedReport` can have one or more `ReportSchedule` entries: frequency
  (daily/weekly/monthly), day/time, and recipient list (users and/or roles —
  e.g. "email this to whoever holds the Sales Manager role," which
  auto-adjusts if role membership changes).
- Delivery: rendered as PDF (or the report's export format, §3.5) and emailed
  via the same transactional email provider used for other notifications
  (`01-ARCHITECTURE.md` §2.9).
- Scheduled generation runs via **Cloud Scheduler + Cloud Tasks**, consistent
  with SLA-check jobs — no new infra pattern introduced.

### 3.5 Export formats **[Fixed — all three, on-demand and for scheduled delivery]**

- **CSV** — raw data export, simplest to generate, no additional library cost.
- **Excel (.xlsx)** — for users who want to pivot/manipulate further.
- **PDF** — for scheduled/emailed reports and presentation-style sharing;
  rendered server-side from the same chart/table components conceptually
  used in-app (implementation detail for the build agent: a headless
  rendering approach, e.g. a server-side chart image generation library, is
  acceptable — avoid standing up a separate heavyweight rendering service
  purely for this).
- No priority ordering needed since all three are in scope for launch; CSV is
  the simplest to build first and can be sequenced first within v1.2 if the
  build agent wants to sequence the work internally.

### 3.6 Data recency & aggregation strategy **[Fixed]**

Since near-real-time isn't required, use a **periodic aggregation** approach
rather than computing expensive aggregate queries live on every report view:
- A scheduled job (every few minutes to hourly — **[Default: 15 minutes]**,
  tunable) refreshes materialized aggregate tables/views that back the report
  metrics in §3.2.
- Report reads hit the materialized aggregates, not raw `Task`/`TimeLog`
  tables directly — keeps report load fast and cheap regardless of total task
  volume, and avoids putting read load on the primary transactional tables
  that the live task-management UI depends on.
- This is also the cost-conscious choice: periodic batch aggregation on
  Cloud Run/Cloud SQL is far cheaper than a live-query or streaming-analytics
  setup, and is more than sufficient given the accepted data-recency window.
- The v1 basic dashboards (§1.6) can be migrated to read from the same
  materialized aggregates once they exist, rather than maintaining two
  separate aggregation approaches.

## 4. Open items from this document

Tracked in `10-OPEN-DECISIONS.md`:
- Single vs. multiple assignees per task.
- Whether time tracking is mandatory for any department.
- Dependency blocking: hard block vs. soft warning on transitioning a task
  with open blockers.
- (Reporting's open questions from the original outline were resolved and are
  now fully specified in §3 — no longer open.)

## 5. Next document

Proceed to `06-FRONTEND-WEB.md` for the web app structure, routing, state
management, and UI conventions.
