# 04 — API Specification

Read docs `00`–`03` first. This document defines REST conventions and the
concrete endpoint list. It is the contract the web app, mobile app, and any
future third-party integrations all build against — per `00-OVERVIEW.md`, the
API is a first-class deliverable, not an internal implementation detail.

---

## 1. Conventions **[Fixed]**

- **Base path & versioning:** `/api/v1/...`. Breaking changes ship as `/api/v2`
  rather than mutating v1 — required for third-party integration stability.
- **Format:** JSON request/response bodies. `Content-Type: application/json`.
- **Auth:** Bearer JWT in `Authorization: Bearer <token>` header on every
  endpoint except `/api/v1/auth/*` (see `03-RBAC-AUTH.md` §3).
- **Pagination:** cursor-based for list endpoints —
  `?limit=25&cursor=<opaque>`, response includes `next_cursor` (null when
  done). Chosen over offset pagination because task lists are frequently
  filtered/sorted and mutated concurrently across many users; cursor
  pagination avoids skipped/duplicated rows under concurrent writes.
- **Filtering/sorting:** query params, e.g.
  `GET /api/v1/tasks?department_id=...&status_id=...&assignee_id=...&sort=-due_date`.
  `-` prefix = descending.
- **Errors:** consistent envelope —
  ```json
  {
    "error": {
      "code": "TASK_NOT_FOUND",
      "message": "Human-readable message",
      "details": { }
    }
  }
  ```
  HTTP status codes used conventionally (400 validation, 401 unauthenticated,
  403 unauthorized/permission denied, 404 not found, 409 conflict, 422
  unprocessable, 500 server error).
- **Idempotency:** mutation endpoints accept an optional
  `Idempotency-Key` header, useful for mobile clients on flaky connections
  retrying a create/update safely.
- **Soft deletes:** `DELETE` endpoints set `deleted_at`; deleted records are
  excluded from list/get responses by default but not physically removed
  (matches `02-DATA-MODEL.md`).
- **OpenAPI:** the NestJS backend generates an OpenAPI 3.0 spec automatically
  (via `@nestjs/swagger` decorators on every controller) — this becomes the
  living source of truth and is what's shared with future third-party
  integrators. This document defines the required endpoints; the generated
  OpenAPI spec is the precise, always-current contract.

## 2. Auth endpoints (see `03-RBAC-AUTH.md` §3) **[Fixed]**

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/auth/google` | Exchange Google identity token for app JWT |
| POST | `/api/v1/auth/sso/:provider` | (added when SSO ships) exchange SSO token for app JWT |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Revoke refresh token |
| GET | `/api/v1/me` | Current user profile + effective permissions |
| PATCH | `/api/v1/me` | Update own profile (name, avatar) |

## 3. Users & Departments **[Fixed]**

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/v1/users` | List users (filter by department, role, active status) | `user.view` |
| GET | `/api/v1/users/:id` | Get user detail | `user.view` |
| POST | `/api/v1/users` | Invite/create user | `user.manage` |
| PATCH | `/api/v1/users/:id` | Update user (departments, active status) | `user.manage` |
| DELETE | `/api/v1/users/:id` | Deactivate user (soft) | `user.manage` |
| GET | `/api/v1/departments` | List departments | `department.view` |
| POST | `/api/v1/departments` | Create department | `department.manage` |
| PATCH | `/api/v1/departments/:id` | Update department | `department.manage` |
| DELETE | `/api/v1/departments/:id` | Deactivate department | `department.manage` |

## 4. Roles & Permissions **[Fixed — this is the RBAC configuration surface]**

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/v1/roles` | List roles | `role.manage` |
| POST | `/api/v1/roles` | Create role | `role.manage` |
| GET | `/api/v1/roles/:id` | Get role + its permissions | `role.manage` |
| PATCH | `/api/v1/roles/:id` | Update role (name, department scope, permission set) | `role.manage` |
| DELETE | `/api/v1/roles/:id` | Delete role (blocked if `is_system_role`) | `role.manage` |
| GET | `/api/v1/permissions` | List all available permission keys (system-defined, read-only) | `role.manage` |
| POST | `/api/v1/users/:id/roles` | Assign role to user | `role.manage` |
| DELETE | `/api/v1/users/:id/roles/:roleId` | Remove role from user | `role.manage` |

## 5. Tasks **[Fixed]**

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/v1/tasks` | List/filter/search tasks | `task.view` |
| POST | `/api/v1/tasks` | Create task | `task.create` |
| GET | `/api/v1/tasks/:id` | Get task detail (incl. custom field values, subtasks) | `task.view` |
| PATCH | `/api/v1/tasks/:id` | Update task fields | `task.edit` |
| DELETE | `/api/v1/tasks/:id` | Soft-delete task | `task.delete` |
| POST | `/api/v1/tasks/:id/assign` | Assign/reassign task | `task.assign` |
| POST | `/api/v1/tasks/:id/transition` | Change status via a `WorkflowTransition` (validated against allowed transitions + `required_permission`) | per-transition, see `03-RBAC-AUTH.md` §2.3 |
| GET | `/api/v1/tasks/:id/activity` | Get audit trail for a task | `task.view` |
| GET | `/api/v1/tasks/:id/comments` | List comments | `task.view` |
| POST | `/api/v1/tasks/:id/comments` | Add comment | `task.comment` |
| PATCH | `/api/v1/comments/:id` | Edit own comment | `task.comment` |
| DELETE | `/api/v1/comments/:id` | Delete own comment (or any, with `task.moderate`) | `task.comment` |
| POST | `/api/v1/tasks/:id/attachments` | Upload attachment (returns signed upload URL, see §9) | `task.edit` |
| DELETE | `/api/v1/attachments/:id` | Delete attachment | `task.edit` |

**v1.1 additions:**

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/tasks/:id/dependencies` | Add a dependency (`blocks` / `relates_to`) |
| DELETE | `/api/v1/tasks/:id/dependencies/:depId` | Remove dependency |
| POST | `/api/v1/tasks/:id/time-logs` | Log time against a task |
| GET | `/api/v1/tasks/:id/time-logs` | List time logs for a task |
| POST | `/api/v1/tasks/:id/approval-steps` | Submit for approval |
| POST | `/api/v1/approval-steps/:id/decide` | Approve/reject a pending step |

## 6. Custom fields (admin-configurable) **[Fixed]**

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/v1/custom-fields` | List field definitions (optionally filter by department) | `custom_field.view` |
| POST | `/api/v1/custom-fields` | Create field definition | `custom_field.manage` |
| PATCH | `/api/v1/custom-fields/:id` | Update field definition | `custom_field.manage` |
| DELETE | `/api/v1/custom-fields/:id` | Deactivate field definition | `custom_field.manage` |

## 7. Workflow configuration (admin-configurable) **[Fixed]**

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/v1/workflows` | List workflow definitions | `workflow.view` |
| POST | `/api/v1/workflows` | Create workflow | `workflow.manage` |
| PATCH | `/api/v1/workflows/:id` | Update workflow (name, department, default flag) | `workflow.manage` |
| GET | `/api/v1/workflows/:id/statuses` | List statuses in a workflow | `workflow.view` |
| POST | `/api/v1/workflows/:id/statuses` | Add status | `workflow.manage` |
| PATCH | `/api/v1/statuses/:id` | Update status (label, order, category, color) | `workflow.manage` |
| DELETE | `/api/v1/statuses/:id` | Remove status (blocked if in use by open tasks) | `workflow.manage` |
| GET | `/api/v1/workflows/:id/transitions` | List allowed transitions | `workflow.view` |
| POST | `/api/v1/workflows/:id/transitions` | Define a transition (from/to status, required permission) | `workflow.manage` |
| DELETE | `/api/v1/transitions/:id` | Remove a transition | `workflow.manage` |

## 7a. Priority configuration (admin-configurable) **[Fixed]**

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/v1/priorities` | List priority definitions | `priority.view` |
| POST | `/api/v1/priorities` | Create priority level | `priority.manage` |
| PATCH | `/api/v1/priorities/:id` | Update priority (label, order, color, department scope) | `priority.manage` |
| DELETE | `/api/v1/priorities/:id` | Deactivate priority level | `priority.manage` |

## 7b. Integration settings (admin-configurable, e.g. SMTP) **[Fixed]**

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/v1/integration-settings/:key` | Get an integration's non-sensitive config (e.g. `smtp` host/port/from-address) — never returns decrypted secrets | `integration_settings.manage` |
| PUT | `/api/v1/integration-settings/:key` | Create/update an integration's config, including sensitive fields (encrypted server-side before storage, per `01-ARCHITECTURE.md` §2.9a) | `integration_settings.manage` |
| POST | `/api/v1/integration-settings/:key/test` | Send a test (e.g. test email) using the currently saved config, without exposing the secret back to the client | `integration_settings.manage` |

## 8. Notifications **[Fixed]**

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/notifications` | List current user's notifications (paginated, filterable by read/unread) |
| PATCH | `/api/v1/notifications/:id/read` | Mark as read |
| PATCH | `/api/v1/notifications/read-all` | Mark all as read |

## 9. File uploads **[Default]**

Two-step upload to keep the API stateless and cheap: client requests a
short-lived **signed upload URL** for Cloud Storage, uploads directly to GCS,
then confirms with the API to attach metadata to the task.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/tasks/:id/attachments/upload-url` | Get a signed PUT URL + attachment record stub |
| POST | `/api/v1/attachments/:id/confirm` | Confirm upload completed, finalize metadata |

## 10. Reporting (v1.2) **[Fixed]**

| Method | Path | Purpose | Permission |
|---|---|---|---|
| GET | `/api/v1/report-metrics` | List available metrics/dimensions the builder can use | `report.view` |
| GET | `/api/v1/reports` | List saved reports visible to the user (own + shared + templates) | `report.view` |
| POST | `/api/v1/reports` | Create/save a report config | `report.create` |
| GET | `/api/v1/reports/:id` | Get a saved report's config | `report.view` |
| PATCH | `/api/v1/reports/:id` | Update a saved report | `report.create` (own) or `report.manage` (any) |
| DELETE | `/api/v1/reports/:id` | Delete a saved report | as above |
| POST | `/api/v1/reports/preview` | Run an ad-hoc (unsaved) report config, returns data for chart rendering | `report.view` |
| GET | `/api/v1/reports/:id/run` | Execute a saved report against current data | `report.view` |
| GET | `/api/v1/reports/:id/export` | Export a saved report — `?format=csv\|xlsx\|pdf` | `report.export` |
| POST | `/api/v1/reports/:id/schedules` | Create a `ReportSchedule` for a saved report | `report.manage` |
| PATCH | `/api/v1/schedules/:id` | Update a schedule | `report.manage` |
| DELETE | `/api/v1/schedules/:id` | Delete a schedule | `report.manage` |

All report data endpoints (`preview`, `run`, `export`) are scoped by the
requesting user's department access per `03-RBAC-AUTH.md` §2.5 — a manager's
report never returns data outside their department(s) even if the report
config itself requests it.

## 11. Rate limiting **[Default]**

Per `03-RBAC-AUTH.md` §4: in-memory rate limiting via `@nestjs/throttler` in
v1 (no Redis dependency yet). Applies primarily to `/auth/*` and any bulk
export endpoints once reporting ships.

## 12. Open items from this document

Tracked in `10-OPEN-DECISIONS.md`:
- Whether external third-party integrations (mentioned in `00-OVERVIEW.md` as
  a driver for having a REST API at all) need **API keys / service accounts**
  as a distinct auth mechanism from user JWTs — likely yes, but no specific
  integration has been named yet, so this is deferred until a concrete
  integration is planned.

## 13. Next document

Proceed to `05-FEATURES.md` for detailed feature specs organized by phase
(v1, v1.1, v1.2).
