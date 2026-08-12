# 02 — Data Model

Read `00-OVERVIEW.md` and `01-ARCHITECTURE.md` first. This document defines the
core entities, their relationships, and the custom-fields design. It covers the
full multi-phase data model — fields/tables only needed in v1.1/v1.2 are marked
accordingly so the build agent knows what to create now vs. later.

All tables use **PostgreSQL** conventions: UUID primary keys, `created_at` /
`updated_at` timestamps (UTC), and soft deletes (`deleted_at`, nullable) unless
noted otherwise — internal tools regularly need to recover accidentally deleted
records, and hard deletes remove that option.

---

## 1. Entity overview

```
Organization (singleton — see §2.1)
 └── Department (1..N)
      └── User (N) ──── UserRole (N) ──── Role (N) ──── RolePermission (N) ─── Permission
                                                              │
Task ── belongs to ── Department                             │
 ├── has many ── Subtask (self-referential Task, see §3)      │
 ├── has many ── TaskComment                                  │
 ├── has many ── TaskAttachment                                │
 ├── has many ── TaskCustomFieldValue ── belongs to ── CustomFieldDefinition
 ├── has many ── TaskDependency (v1.1)                          │
 ├── has many ── TimeLog (v1.1)                                 │
 ├── belongs to ── SLAPolicy (v1.1, nullable)                    │
 ├── has many ── ApprovalStep (v1.1)                              │
 └── has many ── ActivityLogEntry (audit trail)

Notification ── belongs to ── User
Report / SavedReport (v1.2) ── belongs to ── User
```

## 2. Core entities

### 2.1 Organization **[Default — single row]**

Since the system is single-organization (`00-OVERVIEW.md` §2), a full
multi-tenant `Organization` table is not required. However, a **singleton
`organization_settings` table** is still created (one row) to hold org-wide
config: org name, logo, timezone default, SSO configuration, working days,
etc. This keeps the door open for multi-tenancy later without a full
migration, at negligible cost now.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| timezone | text | IANA tz, default org timezone |
| logo_url | text | nullable |
| sso_config | jsonb | nullable; populated when SSO is added |
| created_at / updated_at | timestamptz | |

### 2.1a IntegrationSetting **[Fixed — admin-configurable operational settings]**

Backs the admin-configurable settings described in `01-ARCHITECTURE.md`
§2.9a — SMTP configuration and any future integration credentials, editable
by Admins at runtime rather than baked into deployment secrets.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| key | text | unique, e.g. `smtp`, `slack_webhook` (future) |
| config | jsonb | non-sensitive fields in plain jsonb (e.g. SMTP host, port, from-address) |
| encrypted_config | bytea | sensitive fields (e.g. SMTP password) as Cloud KMS-encrypted ciphertext — see `01-ARCHITECTURE.md` §2.9a for the encryption approach |
| updated_by_id | uuid | FK → User — audit trail for who last changed operational config |
| updated_at | timestamptz | |

Only Admins (`integration_settings.manage` permission) can read/write this
table; `encrypted_config` is never returned decrypted to the client — only
used server-side when actually sending email/etc.

### 2.2 Department **[Fixed]**

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | e.g. "Development", "Sales", "FSR", "ISR" |
| slug | text | unique, URL-safe |
| description | text | nullable |
| is_active | boolean | default true |
| created_at / updated_at | timestamptz | |

Seed data: the 10 departments listed in `00-OVERVIEW.md` §2. Departments are
manageable (add/rename/deactivate) by Admins post-launch — not hardcoded in
application code.

### 2.3 User **[Fixed]**

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| email | text | unique, not null |
| full_name | text | |
| avatar_url | text | nullable |
| primary_department_id | uuid | FK → Department. Users can be linked to additional departments via `UserDepartment` for cross-functional cases |
| auth_provider | text | enum: `google`, `sso` (extensible) |
| auth_provider_id | text | external ID from the provider |
| is_active | boolean | default true (deactivation over hard delete) |
| last_login_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | |

**`UserDepartment`** (join table, many-to-many): supports users who work
across departments (e.g. a manager overseeing both Pre-sales and Sales) without
forcing a single primary department to carry that weight everywhere.

### 2.4 Role, Permission, RolePermission, UserRole **[Fixed — full detail in `03-RBAC-AUTH.md`]**

Summarized here for data-model completeness; RBAC logic itself lives in
`03-RBAC-AUTH.md`.

- **Role**: `id`, `name`, `description`, `is_system_role` (boolean — protects
  built-in roles like Admin from deletion), `department_id` (nullable — null
  means org-wide role, e.g. "Admin"; set means department-scoped role, e.g.
  "Sales Manager").
- **Permission**: `id`, `key` (e.g. `task.create`, `task.assign`,
  `report.export`, `user.manage`), `description`.
- **RolePermission**: join table, `role_id` + `permission_id`.
- **UserRole**: join table, `user_id` + `role_id` (+ optional `department_id`
  override for cases where a role's scope needs per-assignment narrowing).

### 2.5 Task **[Fixed]**

The central entity. One generic structure for all departments, extended via
custom fields (§4) rather than per-department tables — per your decision to
keep a generic core + department-specific fields.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| title | text | not null |
| description | text | rich text / markdown, nullable |
| department_id | uuid | FK → Department (which department owns this task) |
| workflow_id | uuid | FK → WorkflowDefinition (which status set/flow this task follows) |
| status_id | uuid | FK → WorkflowStatus (current status, must belong to `workflow_id`) |
| priority_id | uuid | FK → PriorityDefinition (see §2.5b — admin-configurable, like status) |
| assignee_id | uuid | FK → User, nullable (unassigned allowed) |
| created_by_id | uuid | FK → User |
| parent_task_id | uuid | FK → Task, nullable — self-referential, enables subtasks |
| due_date | timestamptz | nullable |
| start_date | timestamptz | nullable |
| completed_at | timestamptz | nullable, set when status → done |
| sla_policy_id | uuid | FK → SLAPolicy, nullable — **v1.1** |
| is_recurring | boolean | default false — **v1.1** |
| recurrence_rule | text | iCal RRULE format, nullable — **v1.1** |
| created_at / updated_at / deleted_at | timestamptz | |

**Status/workflow is fully admin-configurable, not a hardcoded enum** — per
your requirement that any flow in the application be configurable by Admins.
See §2.5a below for the workflow model, and §2.5b for the equivalent design
now applied to `priority`.

### 2.5a Workflow configuration **[Fixed — admin-configurable statuses & transitions]**

Rather than a global status enum, statuses and their allowed transitions are
data, editable through the product:

**WorkflowDefinition**
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | e.g. "Default Workflow", "Support Ticket Workflow" |
| department_id | uuid | FK → Department, nullable (null = available org-wide) |
| is_default | boolean | used when a task's department has no explicit workflow assigned |
| is_active | boolean | |

**WorkflowStatus**
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workflow_id | uuid | FK → WorkflowDefinition |
| key | text | machine name, e.g. `awaiting_customer` |
| label | text | display name, e.g. "Awaiting Customer" |
| category | text | enum: `todo`, `in_progress`, `done`, `cancelled` — a small **fixed** meta-category so dashboards/reports (v1.2) can aggregate across differently-named statuses consistently |
| display_order | integer | |
| color | text | nullable, for UI |

**WorkflowTransition**
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workflow_id | uuid | FK → WorkflowDefinition |
| from_status_id | uuid | FK → WorkflowStatus |
| to_status_id | uuid | FK → WorkflowStatus |
| required_permission | text | nullable — optional permission key (ties into RBAC, `03-RBAC-AUTH.md`) required to perform this transition, e.g. only Finance Approver can move a task from `pending_approval` → `approved` |
| requires_approval | boolean | default false — **v1.1**, links to `ApprovalStep` |

**Why this shape:** it lets Admins fully design a department's workflow
(statuses, order, allowed transitions, and who's permitted to make each
transition) without engineering involvement — directly serving your
requirement that flows be configurable "as per the org need and changes they
require at any given time." The `category` field is the one fixed piece,
kept deliberately small, so cross-department reporting (v1.2) still has a
consistent way to answer "how many tasks are done vs. in progress" even when
every department's actual status labels differ.

A default `WorkflowDefinition` + a sensible starter status set (Todo → In
Progress → In Review → Done, plus Blocked/Cancelled) is seeded at launch so
the system is usable immediately — but it's editable data, not code, from day
one.

### 2.5b Priority configuration **[Fixed — confirmed admin-configurable]**

Priority is modeled the same way as status: a small, Admin-editable list
rather than a hardcoded enum.

**PriorityDefinition**
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| department_id | uuid | FK → Department, nullable (null = org-wide, applies to all departments unless overridden) |
| key | text | machine name, e.g. `high` |
| label | text | display name, e.g. "High" |
| display_order | integer | also used for sort/urgency ranking |
| color | text | nullable, for UI |
| is_default | boolean | pre-selected when a new task is created |
| is_active | boolean | |

Seeded at launch with the starter set (Low, Medium, High, Urgent), org-wide
(`department_id = null`) — editable/extendable by Admins exactly like
workflow statuses, including the option to define department-specific
priority scales later if ever needed, without a schema change.

### 2.6 Subtasks **[Fixed]**

Implemented via `Task.parent_task_id` (self-referential), not a separate
table. A subtask is a Task like any other — it can be assigned, have its own
due date, custom fields, etc. This avoids duplicating logic between "tasks"
and "subtasks."

### 2.7 TaskComment **[Fixed]**

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| task_id | uuid | FK → Task |
| author_id | uuid | FK → User |
| body | text | |
| created_at / updated_at / deleted_at | timestamptz | |

### 2.8 TaskAttachment **[Fixed]**

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| task_id | uuid | FK → Task |
| uploaded_by_id | uuid | FK → User |
| file_name | text | |
| storage_path | text | Cloud Storage object path |
| mime_type | text | |
| size_bytes | bigint | |
| created_at | timestamptz | |

## 3. Task relationships

- **Subtasks:** via `parent_task_id` (§2.6).
- **Dependencies (v1.1):** separate `TaskDependency` table (`task_id`,
  `depends_on_task_id`, `type` enum: `blocks` / `relates_to`) — kept separate
  from parent/child since dependency graphs are not strictly hierarchical.
- **Assignment history:** not modeled as a separate table in v1; the current
  `assignee_id` plus `ActivityLogEntry` (§6) provides an audit trail of
  reassignments without a dedicated table. Revisit if reporting needs
  (v1.2) require structured reassignment analytics.

## 4. Custom fields design **[Fixed — this is the department-extensibility mechanism]**

Per your decision (generic task structure + department-specific custom
fields), this uses a **schema-defined dynamic fields** pattern rather than
sparse columns or a table-per-department:

### CustomFieldDefinition
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| department_id | uuid | FK → Department, nullable (null = applies to all departments) |
| key | text | machine name, e.g. `deal_value` |
| label | text | display name, e.g. "Deal Value" |
| field_type | text | enum: `text`, `number`, `date`, `boolean`, `select`, `multi_select`, `user_reference` |
| options | jsonb | for `select`/`multi_select`, e.g. `["Low","Medium","High"]` |
| is_required | boolean | |
| display_order | integer | |
| is_active | boolean | |

### TaskCustomFieldValue
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| task_id | uuid | FK → Task |
| field_definition_id | uuid | FK → CustomFieldDefinition |
| value | jsonb | stores the typed value; validated against `field_type` at the API layer |

**Why this approach:** Admins can define new department-specific fields (e.g.
Sales → `deal_value` (number), Support → `ticket_priority` (select),
`sla_breach_risk` (boolean)) through the product itself, without schema
migrations or code changes. The API layer validates `value` against the
field's declared `field_type` before persisting. This directly supports "DIY"
configurability without requiring a redeploy every time a department needs a
new field.

## 5. Phase v1.1 entities (documented now, built later)

- **SLAPolicy** — `id`, `name`, `department_id`, `response_time_minutes`,
  `resolution_time_minutes`, `escalation_rules` (jsonb: who to notify/escalate
  to at what thresholds).
- **TimeLog** — `id`, `task_id`, `user_id`, `minutes`, `note`, `logged_at`.
- **ApprovalStep** — `id`, `task_id`, `approver_id`, `status` (enum:
  `pending`/`approved`/`rejected`), `step_order`, `decided_at`, `comment`.
  Supports multi-step approval chains for status transitions that require
  sign-off (e.g. Finance approvals).
- **TaskDependency** — see §3.

## 6. Audit / activity trail **[Fixed — needed from v1 for accountability]**

### ActivityLogEntry
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| task_id | uuid | FK → Task, nullable (also used for non-task events, e.g. role changes) |
| actor_id | uuid | FK → User |
| action | text | e.g. `status_changed`, `reassigned`, `commented`, `field_updated` |
| metadata | jsonb | before/after values, contextual detail |
| created_at | timestamptz | |

This single append-only table backs "who did what, when" across the system —
important for a multi-department tool where managers need accountability, and
cheap to build once rather than retrofitted later.

## 7. Notifications **[Fixed for v1 in-app/email; push/Slack are v1.1]**

### Notification
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → User (recipient) |
| type | text | e.g. `task_assigned`, `due_soon`, `comment_mention`, `sla_breach` (v1.1) |
| payload | jsonb | contextual data (task id, actor, etc.) |
| channel | text | enum: `in_app`, `email`, `push` (v1.1), `slack` (v1.1) |
| is_read | boolean | default false |
| sent_at | timestamptz | nullable |
| created_at | timestamptz | |

## 8. Reporting entities (v1.2) **[Fixed — full design in `05-FEATURES.md` §3]**

### SavedReport
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| created_by_id | uuid | FK → User |
| config | jsonb | metrics, dimensions/grouping, date range, filters, chart type |
| visibility | text | enum: `private`, `shared_roles`, `shared_org` |
| shared_with_role_ids | uuid[] | nullable, used when `visibility = shared_roles` |
| is_template | boolean | marks the pre-built starter templates (§3.3 of `05-FEATURES.md`) |
| created_at / updated_at | timestamptz | |

### ReportSchedule
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| saved_report_id | uuid | FK → SavedReport |
| frequency | text | enum: `daily`, `weekly`, `monthly` |
| send_at | text | time of day, e.g. `08:00`, org timezone |
| day_of_week | integer | nullable, for weekly |
| day_of_month | integer | nullable, for monthly |
| recipient_user_ids | uuid[] | nullable |
| recipient_role_ids | uuid[] | nullable — resolved to current role holders at send time |
| export_format | text | enum: `pdf`, `csv`, `xlsx` |
| is_active | boolean | |

### Materialized aggregate tables **[Fixed — approach, not exact schema]**

Per the data-recency decision (`05-FEATURES.md` §3.6), a set of materialized
aggregate tables/views back report metrics (e.g. `task_counts_by_department_daily`,
`sla_compliance_by_department_daily`), refreshed on a scheduled job
(**Default: every 15 minutes**). Exact aggregate table shapes are an
implementation detail for the build agent to define per metric in §3.2 of
`05-FEATURES.md`, following this refresh pattern rather than querying raw
transactional tables live on every report view.

## 9. Indexing notes **[Default]**

At minimum, index: `Task.department_id`, `Task.assignee_id`, `Task.status`,
`Task.due_date`, `Task.parent_task_id`, `TaskCustomFieldValue.task_id`,
`TaskCustomFieldValue.field_definition_id`, and `ActivityLogEntry.task_id`.
These back the most common dashboard/filter queries. Revisit based on real
query patterns once v1 is live.

## 10. Open items from this document

Tracked in `10-OPEN-DECISIONS.md`:
- Confirm `Organization` singleton approach is acceptable vs. skipping it
  entirely for v1 (low-risk either way, cheap to keep).

## 11. Next document

Proceed to `03-RBAC-AUTH.md` for the full roles/permissions model and the
authentication/SSO abstraction design.
