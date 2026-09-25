# TaskApp (Task Management Application) — Comprehensive Master Review & Technical Blueprint

Welcome to the definitive, all-inclusive architectural, operational, and technical review of the **Task Management Application (TaskApp)**. This document contains an exhaustive breakdown of every subsystem, role, UI component, library, database entity, business rule, and infrastructure topology in the entire project.

---

## Table of Contents
1. [Executive Summary & Core Philosophy](#1-executive-summary--core-philosophy)
2. [Monorepo Structure & Package Ecosystem](#2-monorepo-structure--package-ecosystem)
3. [Full Technology Stack & Dependencies Directory](#3-full-technology-stack--dependencies-directory)
4. [System Architecture & Data Flow](#4-system-architecture--data-flow)
5. [Complete Database Schema & Data Models (All 28+ Entities)](#5-complete-database-schema--data-models-all-28-entities)
6. [Role-Based Access Control (RBAC) & Authorization Engine](#6-role-based-access-control-rbac--authorization-engine)
7. [Comprehensive UI Breakdown: Pages, Views & Cards](#7-comprehensive-ui-breakdown-pages-views--cards)
8. [Core Business Logic, Workflows & Special Algorithms](#8-core-business-logic-workflows--special-algorithms)
9. [Reporting, Analytics & Scheduled Export Engine](#9-reporting-analytics--scheduled-export-engine)
10. [Notifications, Email & Push Infrastructure](#10-notifications-email--push-infrastructure)
11. [Mobile Application Architecture (React Native & Expo)](#11-mobile-application-architecture-react-native--expo)
12. [Complete REST API Surface Directory](#12-complete-rest-api-surface-directory)
13. [Cloud Infrastructure, Security & DevOps Topology](#13-cloud-infrastructure-security--devops-topology)
14. [Testing, Quality Assurance & Operational Runbook](#14-testing-quality-assurance--operational-runbook)

---

## 1. Executive Summary & Core Philosophy

**TaskApp** is an enterprise-grade, multi-department task management and operational productivity platform engineered as a decoupled monorepo. It bridges individual contributor execution, managerial team oversight, department head leadership, executive organization analytics, and administrative configurability into a cohesive, high-performance ecosystem.

### Key Architectural Pillars:
1. **Admin-Configurable Everything**: No business workflows, department hierarchies, priority levels, custom fields, SLA response targets, or scorecard weights are hardcoded. Admins customize workflows, statuses, permission gates, and data schemas dynamically via the UI without code changes or redeployments.
2. **5-Tier Role-Based Access Control (RBAC)**: Custom three-tier RBAC (`User -> Role -> Permission`) featuring org-wide scopes (Admin, Management) and department scopes (Head, Manager, Employee), with server-enforced permission guards on every single API endpoint.
3. **Studio Desk Aesthetic & Seamless Dark Mode**: Designed with warm putty/greige neutrals (`#F5F4F0`), forest-green primary accents (`#235247`), warm ochre highlights (`#D97706`), Google Fonts typography (Fraunces serif headings + Karla body), and native `dark:` Tailwind class integration.
4. **Power BI-Style Granular Drill-Down**: Every high-level metric card, department breakdown, manager team row, and report chart bar/slice allows instant drill-down into filtered task lists and individual contributor counters.
5. **Rigorous Operational Integrity**: Features mandatory effort estimates before starting active work, stopwatch-based work session time tracking, business-day overdue math (excluding regional holidays and weekends), review gates with manager feedback, and 6-parameter employee scorecards.

---

## 2. Monorepo Structure & Package Ecosystem

TaskApp is organized using **Turborepo** and **npm workspaces**, enforcing strict separation of concerns, code reuse, and unified type safety.

```
Task Management/
├── apps/
│   ├── api/                       # Backend REST API (NestJS + Prisma + PostgreSQL)
│   ├── web/                       # Web Single Page Application (React 18 + Vite + Tailwind CSS)
│   └── mobile/                    # Native Mobile App (React Native 0.74 + Expo SDK 51)
├── packages/
│   ├── api-client/                # Isomorphic, strongly-typed HTTP API SDK (Axios/Fetch wrapper)
│   ├── shared-types/              # Shared data contracts, TypeScript interfaces, Zod schemas, Enums
│   └── config/                    # Shared TypeScript (tsconfig.base.json) and ESLint/Prettier configs
├── docs/                          # Architectural specifications (00 to 10)
├── infra/                         # Terraform IaC modules and GCP environment definitions
├── patches/                       # Durable native package patches (patch-package)
├── package.json                   # Root workspace manifest
└── turbo.json                     # Turborepo task pipeline configuration
```

---

## 3. Full Technology Stack & Dependencies Directory

### 3.1 Root Workspace
- **Turborepo** (`v2.1.3`): High-performance monorepo build system and caching engine.
- **TypeScript** (`v5.6.3`): Universal type checking across all packages and apps.
- **Prettier** (`v3.3.3`): Unified code formatting.
- **patch-package** (`v8.0.1`): Post-install patch applier for native and third-party dependencies.

---

### 3.2 Backend API (`apps/api`)
| Library / Package | Version | Purpose |
| :--- | :--- | :--- |
| `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` | `^10.4.6` | Enterprise Node.js MVC framework providing Dependency Injection, Modules, Controllers, and Guards. |
| `@nestjs/config` | `^3.2.3` | Environment variable management and schema validation. |
| `@nestjs/jwt` | `^10.2.0` | Signing and verifying stateless HMAC/RSA JWT access tokens. |
| `@nestjs/swagger` | `^7.4.2` | Auto-generated OpenAPI / Swagger API interactive documentation. |
| `@nestjs/throttler` | `^6.2.1` | In-memory API rate-limiting against abuse and brute-force attacks. |
| `@prisma/client`, `prisma` | `^5.20.0` | Type-safe ORM for PostgreSQL 15, handling migrations, queries, and relations. |
| `firebase-admin` | `^12.6.0` | Server-side verification of Google OAuth / Firebase ID tokens. |
| `nodemailer` | `^9.0.5` | Transactional SMTP email delivery engine connecting to Google Workspace SMTP relay. |
| `pdfkit` | `^0.19.1` | Server-side programmatic PDF generation for scheduled reports. |
| `exceljs` | `^4.4.0` | Programmatic Excel (.xlsx) workbook generator with styled headers and sheets. |
| `rrule` | `^2.8.1` | iCal RRULE parsing and next-occurrence calculation engine for recurring tasks. |
| `class-validator`, `class-transformer` | `^0.14.1`, `^0.5.1` | Declarative request payload validation and DTO transformation. |
| `zod` | `^3.23.8` | Schema validation for complex dynamic configuration objects (scorecards, reports). |
| `rxjs` | `^7.8.1` | Reactive event streaming for NestJS core internals. |

---

### 3.3 Frontend Web SPA (`apps/web`)
| Library / Package | Version | Purpose |
| :--- | :--- | :--- |
| `react`, `react-dom` | `^18.3.1` | Core UI rendering library. |
| `vite`, `@vitejs/plugin-react` | `^5.4.10`, `^4.3.3` | Ultra-fast build tool and local development HMR server. |
| `tailwindcss`, `autoprefixer`, `postcss` | `^3.4.14` | Utility-first CSS framework customized with the Studio Desk design tokens and dark mode. |
| `@tanstack/react-query` | `^5.59.16` | Asynchronous server state management, query caching, background refetching, and mutations. |
| `zustand` | `^5.0.1` | Client-side reactive state store for user authentication session, active roles, and sidebar state. |
| `react-router-dom` | `^6.27.0` | Client-side declarative routing and URL parameter synchronization. |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | `^6.3.1`, `^10.0.0`, `^3.2.2` | Accessible, drag-and-drop toolkit powering the Kanban Board columns and cards. |
| `@radix-ui/react-dialog`, `react-dropdown-menu`, `react-select`, `react-tabs` | `^1.1.2`, `^2.1.2`, `^2.1.2`, `^1.1.1` | Unstyled, fully accessible UI primitives for modals, dropdowns, popovers, and tabs. |
| `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-mention`, `@tiptap/extension-placeholder`, `@tiptap/pm` | `^3.31.2` | Headless, extensible rich text editor supporting formatted descriptions and `@user` mentions. |
| `tippy.js` | `^6.3.7` | Tooltip and popover positioning engine used for rich mention suggestion popups. |
| `recharts` | `^3.10.1` | Composable SVG charting library rendering Bar, Line, and Pie charts with interactive click drill-down. |
| `lucide-react` | `^1.40.0` | Comprehensive, consistent SVG icon set. |
| `react-hook-form` | `^7.53.1` | High-performance, zero-re-render form state handling. |
| `country-region-data` | `^4.1.0` | Complete ISO country and administrative state dataset for regional holiday selection. |
| `firebase` | `^10.14.1` | Client-side Firebase Authentication SDK handling Google Sign-In popups. |

---

### 3.4 Mobile Application (`apps/mobile`)
| Library / Package | Version | Purpose |
| :--- | :--- | :--- |
| `react-native`, `expo` | `0.74.5`, `~51.0.28` | Cross-platform native mobile application framework. |
| `@react-navigation/native`, `native-stack`, `bottom-tabs` | `^6.1.18`, `^6.11.0`, `^6.6.1` | Native mobile navigation stack and bottom tab bar. |
| `@expo-google-fonts/fraunces`, `karla`, `expo-font` | `^0.4.1`, `^0.4.2`, `~12.0.10` | Custom typography loader for mobile parity with web. |
| `expo-secure-store` | `~13.0.2` | Hardware-backed encrypted keychain/keystore storage for session tokens. |
| `expo-notifications` | `~0.28.19` | Push notification token registration and foreground/background handling. |
| `expo-auth-session`, `expo-web-browser`, `expo-crypto` | `~5.5.2`, `~13.0.3`, `~13.0.2` | OAuth 2.0 / OpenID Connect browser authentication flows. |
| `expo-dev-client` | `~4.0.29` | Custom native development client for EAS Build debugging. |
| `@expo/vector-icons` | `^14.0.3` | Vector icon library (Ionicons, Feather, MaterialIcons). |

---

## 4. System Architecture & Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       CLIENT PLATFORMS                                           │
│                                                                                                  │
│   Web SPA (React 18 + Vite + Tailwind)              Mobile App (React Native + Expo SDK 51)     │
└───────────────────────────────┬──────────────────────────────────────────┬───────────────────────┘
                                │                                          │
                1. OAuth Popup  │                                          │ 1. OAuth WebBrowser
                (Google Auth)   ▼                                          ▼ (Google Auth)
                    ┌──────────────────────────────────────────────────────────┐
                    │               Firebase Authentication                    │
                    │               (Project: testing-sujeeth)                 │
                    └─────────────────────────────┬────────────────────────────┘
                                                  │
                                                  │ 2. Verified Google ID Token
                                                  ▼
                    ┌──────────────────────────────────────────────────────────┐
                    │                 TaskApp Backend API                      │
                    │         (NestJS on Google Cloud Run: taskapp-api)        │
                    └──────────────┬─────────────────────────────┬─────────────┘
                                   │                             │
                   3. Prisma ORM   │                             │ 4. Notifications & Outbound
                   Unix Socket /   │                             │    External Integrations
                   Direct SQL      │                             │
                                   ▼                             ▼
        ┌──────────────────────────────────────┐     ┌─────────────────────────────────────────────┐
        │     Google Cloud SQL (PostgreSQL 15) │     │  • Google Workspace SMTP (Nodemailer)       │
        │     (Instance: taskapp-db)           │     │  • Expo Push Notification Service           │
        └──────────────────────────────────────┘     │  • Google Cloud Storage (Task Attachments)  │
                                                     └─────────────────────────────────────────────┘
```

### End-to-End Operational Flow:
1. **User Authentication & Onboarding**:
   - The user signs in via Google OAuth. The client receives a Google ID token.
   - The token is sent to `POST /auth/firebase`.
   - The backend validates the domain restriction (`@econz.net`) and matches the user in the `users` table.
   - Note: TaskApp enforces an **Invite-Only** policy. An Admin must have pre-created the user record with their full name, department, region, roles, and manager.
   - The server returns an application JWT containing the user ID, active role, and cached permission keys.
2. **Task Creation & SLA Calculation**:
   - Creating a task (`POST /tasks`) evaluates the department's active `SLAPolicy`.
   - Initial workflow status is automatically assigned to the lowest `display_order` status (defaulting to `Todo`).
   - If custom fields are defined for the department, their values are validated and stored in `task_custom_field_values`.
3. **Task Progression & Gates**:
   - Entering an active work status (e.g. `In Progress`) enforces the **Mandatory Estimate Gate** (`requiresEstimateBeforeEntry = true`). If no estimate is submitted, the transition is rejected.
   - Transitioning starts the live stopwatch timer (`timerStartedAt = now()`).
   - Transitioning into an `isReviewStatus = true` status (e.g. `In Review`) automatically stops the timer, calculates session duration, appends to `totalLoggedMinutes`, creates a `TimeLog` entry, and notifies the assignee's manager.
   - Completing a task (`Done`) performs a **Hard Subtask Check**: if any subtask remains open, the parent task transition is blocked.
4. **Periodic Background daemons**:
   - **Overdue Escalation Job**: Evaluates open tasks using business-day calculation (excluding regional holidays). If overdue, notifies the manager.
   - **Report Aggregation Job**: Computes snapshots and metric aggregations into `report_aggregate_cache`.
   - **Report Scheduling Job**: Dispatches scheduled reports via PDF/Excel/CSV attachments through SMTP.

---

## 5. Complete Database Schema & Data Models (All 28+ Entities)

The PostgreSQL database is managed via Prisma schema (`apps/api/prisma/schema.prisma`).

```
                              ┌─────────────────────────┐
                              │  OrganizationSettings   │
                              │  ScorecardConfig        │
                              │  IntegrationSetting     │
                              └─────────────────────────┘
                                           │
                ┌──────────────────────────┼─────────────────────────┐
                ▼                          ▼                         ▼
      ┌──────────────────┐       ┌──────────────────┐      ┌──────────────────┐
      │    Department    │       │ HolidayCalendar  │      │     Role /       │
      │                  │       │                  │      │   Permission     │
      └─────────┬────────┘       └─────────┬────────┘      └─────────┬────────┘
                │                          │                         │
                ├──────────────────────────┼─────────────────────────┘
                ▼                          ▼
      ┌─────────────────────────────────────────────┐
      │                    User                     │◄────────┐
      │  (workCountry, workState, managerId, role)  ├─────────┤ (Direct Reports)
      └─────────────────────┬───────────────────────┘
                            │
       ┌────────────────────┼──────────────────────────────┬────────────────────┐
       ▼                    ▼                              ▼                    ▼
┌──────────────┐   ┌─────────────────┐             ┌──────────────┐    ┌─────────────────┐
│ WorkflowDef  │   │  PriorityDef    │             │  SLAPolicy   │    │  CustomFieldDef │
│ & Statuses   │   │                 │             │              │    │                 │
└──────┬───────┘   └────────┬────────┘             └──────┬───────┘    └────────┬────────┘
       │                    │                             │                     │
       └────────────────────┼─────────────────────────────┴─────────────────────┘
                            ▼
              ┌───────────────────────────┐
              │           Task            │◄───────────────────────┐ (Subtasks)
              └─────────────┬─────────────┘                        │
                            │                                      │
    ┌──────────────┬────────┴─────┬──────────────┬─────────────────┴─────────────┐
    ▼              ▼              ▼              ▼                               ▼
┌────────┐   ┌───────────┐  ┌───────────┐  ┌───────────┐                    ┌───────────┐
│TimeLog │   │TaskComment│  │Attachment │  │Dependency │                    │TaskReview │
└────────┘   └───────────┘  └───────────┘  └───────────┘                    └─────┬─────┘
                                                                                  ▼
                                                                            ┌───────────┐
                                                                            │ReviewAtt. │
                                                                            └───────────┘
```

### 5.1 System & Org Configuration Models
1. **`OrganizationSettings`**: Org metadata (`name`, `timezone`, `logo_url`, `sso_config`).
2. **`ScorecardConfig`**: Singleton JSON configuration for employee scorecard weights (on-time rate, estimate accuracy, volume, overdue, over-budget, rework).
3. **`IntegrationSetting`**: Key-value integration credentials (`smtp`, `slack`) with KMS encryption support (`encrypted_config`).

### 5.2 Hierarchy & User Models
4. **`Department`**: Department entity with unique `slug`, `is_active`, and a 1-to-1 `headUserId` foreign key.
5. **`User`**: User entity with `email`, `full_name`, `avatar_url`, `primary_department_id`, `work_country`, `work_state`, self-referencing `manager_id`, `active_role_id`, and `push_token`.
6. **`UserDepartment`**: Many-to-many junction table for users belonging to multiple secondary departments.
7. **`HolidayCalendar`**: Regional calendar entity uniquely keyed by `country` and `state`.
8. **`Holiday`**: Specific holiday dates (`date`, `name`) linked to a `HolidayCalendar`.

### 5.3 RBAC Models
9. **`Role`**: Role definitions (`name`, `description`, `is_system_role`, optional `department_id` for scoped roles).
10. **`Permission`**: Granular capability keys (e.g. `task.create`, `role.manage`, `report.export`).
11. **`RolePermission`**: Junction table mapping roles to permissions.
12. **`UserRole`**: Junction table assigning roles to users with optional `department_override`.

### 5.4 Workflow & Priority Engine Models
13. **`WorkflowDefinition`**: Configurable workflow entity (`name`, `department_id`, `is_default`, `is_active`).
14. **`WorkflowStatus`**: Status steps within a workflow (`key`, `label`, `category` enum: `todo`, `in_progress`, `done`, `cancelled`, `display_order`, `color`, `requires_hold_reason`, `requires_estimate_before_entry`, `is_review_status`).
15. **`WorkflowTransition`**: Legal state transitions between statuses (`from_status_id`, `to_status_id`, `required_permission`, `requires_approval`).
16. **`PriorityDefinition`**: Priority options (`key`, `label`, `display_order`, `color`, `is_default`, `department_id`).
17. **`OnHoldReason`**: Admin-configured reasons for placing tasks on hold.

### 5.5 Dynamic Metadata (Custom Fields)
18. **`CustomFieldDefinition`**: Dynamic field definitions per department (`key`, `label`, `field_type` enum: `text`, `number`, `date`, `boolean`, `select`, `multi_select`, `user_reference`, `options` JSON, `is_required`).
19. **`TaskCustomFieldValue`**: Stored values mapped to tasks and field definitions.

### 5.6 Core Task Models
20. **`Task`**: Core entity containing `title`, `description`, `department_id`, `workflow_id`, `status_id`, `priority_id`, `assignee_id`, `created_by_id`, self-referencing `parent_task_id`, `start_date`, `due_date`, `completed_at`, `is_recurring`, `recurrence_rule`, `sla_policy_id`, `on_hold_reason_id`, `estimate_value`, `estimate_unit`, `estimate_submitted_at`, `estimate_submitted_by_id`, `timer_started_at`, `total_logged_minutes`, and timestamps.
21. **`TimeLog`**: Manual and automatic time log entries (`task_id`, `user_id`, `minutes`, `note`, `logged_at`, `created_at`, `updated_at`).
22. **`TaskDependency`**: Dependency relationships between tasks (`task_id`, `depends_on_task_id`, `type` enum: `blocks`, `relates_to`).
23. **`ApprovalStep`**: Multi-step transition approval gate records (`task_id`, `transition_id`, `approver_id`, `status` enum: `pending`, `approved`, `rejected`, `step_order`, `comment`, `decided_at`).
24. **`TaskActionRequest`**: Role-gated approval requests for archiving or deleting tasks (`task_id`, `action_type` enum: `archive`, `delete`, `requester_id`, `reviewer_id`, `status`, `reason`, `reviewer_note`).
25. **`TaskReview` & `TaskReviewAttachment`**: Feedback records generated during task review stages (`task_id`, `reviewer_id`, `decision` enum: `changes_requested`, `approved`, `feedback`, `status`, plus file attachments).
26. **`TaskComment`**: Discussion thread comments on tasks.
27. **`TaskAttachment`**: Uploaded file attachments (`file_name`, `storage_path`, `mime_type`, `size_bytes`).
28. **`ActivityLogEntry`**: Immutable audit trail of every state change, field edit, and system escalation.

### 5.7 SLA, Notifications & Reporting
29. **`SLAPolicy`**: Response and resolution hour targets, escalation rules JSON.
30. **`Notification`**: In-app, push, and email notification logs (`user_id`, `type`, `payload`, `channel`, `is_read`).
31. **`NotificationPreference`**: User opt-out matrix per notification event and channel.
32. **`SavedReport`**: User and shared custom report definitions (`name`, `config` JSON, `visibility`, `shared_with_role_ids`, `is_template`).
33. **`ReportSchedule`**: Recurring email delivery schedules (`frequency`, `send_at`, `day_of_week`, `day_of_month`, `recipient_user_ids`, `export_format`).
34. **`ReportAggregateCache`**: Pre-aggregated metrics table refreshed periodically for high-speed reporting.
35. **`BugReport`**: User-submitted bug tickets (`reporter_id`, `description`, `page_url`, `screenshot_base64`).

---

## 6. Role-Based Access Control (RBAC) & Authorization Engine

TaskApp implements a **5-Tier Role System** with clear separation of scope and responsibilities:

| Role | Scope | Authority & Responsibilities | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | Org-wide | Global System Administrator. System-protected from deletion or lockout. | Manages departments, users, roles, workflows, priorities, SLA policies, integrations, scorecard weights, and overrides locked estimates/timesheets. |
| **Management** | Org-wide | Executive Leadership & Cross-Department Oversight. | High-level read access across all departments, organizational health dashboards, cross-department comparisons, executive reports, and leaderboards. |
| **Head** | Department-scoped | Department Head / General Manager of a specific Department. | Full leadership over their department, workflow transitions, team-wide workload views, manager breakdown, department reports, and scorecard tracking. |
| **Manager** | Department-scoped | Team Leader & Direct Line Manager. | Manages assigned direct reports (`User.managerId`), assigns tasks, reviews and approves work, receives overdue escalations, tracks team timesheets. |
| **Employee** | Department-scoped | Individual Contributor. | Executes personal tasks, creates subtasks, submits mandatory effort estimates, tracks time via live timer, requests reviews, views personal scorecard. |

### Dynamic Role Switcher (`RoleSwitcher.tsx`)
Users holding multiple roles (e.g. an Admin who is also a Manager, or a Head viewing an Employee's perspective) can switch active presentation views using the top-bar dropdown.
- **Presentation Lens Only**: Switching the active role changes navigation menus and dashboard scoping, but does **not** revoke the user's underlying permissions on the backend.
- **Backend Resolution**: `RbacService.resolveActiveRoleName(userId)` computes the effective active role dynamically.

---

## 7. Comprehensive UI Breakdown: Pages, Views & Cards

### 7.1 Web Application Pages Directory

#### A. Authentication & Onboarding
- **`LoginPage.tsx`**: Clean, centered login card with Google Sign-In popup integration, domain verification badge, and dev-mode fallback.
- **`OnboardingModal.tsx`**: First-time user welcome tour highlighting key UI features and navigation shortcuts.

#### B. Dashboards & Workspaces
- **`MyTasksPage.tsx`**: Personal workspace for individual contributors:
  - Metric Cards: Open Tasks, Overdue (business-day accurate), Over Budget (logged > estimate), Due This Week, Completed.
  - Quick action toolbar: Create Task, Filter by Priority, Search.
  - Interactive table grouping tasks by status with quick transition dropdowns.
- **`TeamDashboardPage.tsx`**: Role-adaptive team dashboard with 4 distinct operational scopes:
  1. *Org Scope (Admin / Management)*: Summary cards for every department with health indicators, click-to-drill into department views.
  2. *Department Scope (Head)*: Department-wide task metrics with a breakdown by Manager team.
  3. *Manager Scope (Manager)*: Filtered view of explicit direct reports (`User.managerId = caller`), member workload bars, overdue task lists.
  4. *Employee Scope*: Graceful redirect to personal dashboard.
- **`EmployeeDetailPage.tsx`**: Contributor profile displaying individual workload, completed tasks history, SLA compliance rate, and recent activity.
- **`EmployeeTimesheetPage.tsx`**: Daily and weekly timesheet calendar view breaking down logged work sessions against estimates.

#### C. Task Views & Management
- **`TaskListPage.tsx`**: Comprehensive data grid with multi-column filtering:
  - Filters: Department, Status, Priority, Assignee (single or multi-select), Business-Day Overdue, Over-Budget.
  - Search bar with instant debounced text matching.
  - Bulk Action Toolbar: Multi-select tasks for bulk reassignment, bulk status changes, or bulk archiving.
- **`TaskDetailPage.tsx`**: The operational hub for any single task:
  - Header: Editable title, Priority badge, Workflow Status transition dropdown, Department badge.
  - Assignee Selector: Department-scoped member dropdown with instant reassignment and notification triggers.
  - Rich Text Description: Tiptap WYSIWYG editor supporting headers, bullet lists, code blocks, bold/italics, and `@user` mentions.
  - **`WorkSessionTimer.tsx`**: Interactive live stopwatch widget. Tracks active time, displays elapsed session minutes, and syncs with backend state.
  - **`EstimateWidget.tsx`**: Effort estimation input (hours or days). Enforces the 30-minute self-edit lock and logs Admin overrides.
  - **`TimeLogWidget.tsx`**: Manual timesheet logger (hours + date + note) with history list and 30-minute edit restriction.
  - **`SubtasksWidget`**: Hierarchical subtask list with independent assignees, statuses, and progress completion bar.
  - **`DependenciesWidget.tsx`**: Graph editor defining `blocks` and `relates_to` relationships with visual blocker warnings.
  - **`CustomFieldsWidget.tsx`**: Dynamic form rendering department-specific custom fields (dates, dropdowns, numbers, text, user pickers).
  - **`ApprovalBanner.tsx`**: Prominent approval callout for transitions requiring manager/finance approval.
  - **`ReviewFeedbackCard.tsx`**: Review decision widget displaying reviewer feedback, change requests, and attached reference files.
  - Comments & Activity Stream: Threaded comments with rich text and full audit log of every transition and edit.
- **`KanbanBoardPage.tsx`**: Drag-and-drop board powered by `@dnd-kit`:
  - Columns mapped dynamically to workflow statuses in defined `display_order`.
  - Rich Task Cards: Title, task ID, priority color pill, due date relative badge (e.g. "Due in 2 days", "Overdue by 1 day"), assignee avatar, subtask progress counter (`2/5`).
  - Drag-and-drop status update with transition permission checks and modal prompts for on-hold reasons or mandatory estimates.
- **`TimelinePage.tsx`**: Visual Gantt chart plotting task bars along a calendar timeline based on `startDate` and `dueDate`, rendering connecting SVG arrows for dependencies and a vertical "Today" marker.

#### D. Performance & Scorecards
- **`ScorecardPage.tsx`**: Employee appraisal and department performance leaderboard:
  - Overall Score Radial Gauge: Weighted 0-100 performance score.
  - 6 Sub-Score Metric Cards: On-Time Completion Rate, Estimate Accuracy, Volume Throughput, Overdue Penalty, Over-Budget Penalty, Rework Penalty.
  - Date Range Selector: Preset dropdowns (This Month, Last Month, This Quarter, Custom).
  - Department Leaderboard: Ranked list of department members with top performers highlighted, with click-to-expand raw performance counters.

#### E. Reporting & Business Intelligence
- **`ReportsListPage.tsx`**: Grid of pre-built starter templates (Department Overview, Overdue Tasks, Team Workload, SLA Compliance) and custom saved reports.
- **`ReportBuilderPage.tsx`**: Custom report designer:
  - Metric Selection: Status counts, department counts, assignee counts, overdue rate, SLA compliance, throughput, time tracked.
  - Dimensions & Grouping: Group by Department, Assignee, Priority, Status, Date.
  - Chart Type: Bar Chart, Line Chart, Pie Chart, Summary Data Table.
  - Schedule Dispatch: Attach recurring email schedules (Daily, Weekly, Monthly).
- **`ReportViewerPage.tsx`**: Interactive report viewer with Recharts visualization, Power BI-style click drill-down into contributing tasks, and one-click export to CSV, Excel (.xlsx), and PDF.

#### F. Settings & User Profile
- **`SettingsPage.tsx`**: User preferences workspace:
  - Profile card: Full name, email, department, assigned manager.
  - Work Location Picker: Cascading Country & State dropdowns for regional holiday calculations.
  - Theme Selector: Light, Dark, or System preference.
  - Notification Matrix: Toggle email and push notifications per event type.
  - Active Role Switcher.

#### G. Administration Suite (15 Dedicated Admin Modules)
1. **`AdminHomePage.tsx`**: Overview control panel linking to all administrative configuration modules.
2. **`AdminLayout.tsx`**: Dedicated admin sidebar navigation.
3. **`UsersAdminPage.tsx`**: User provisioning, invite modal, role assignment, primary and secondary department assignment, manager linking, and account deactivation.
4. **`DepartmentsAdminPage.tsx`**: Department CRUD, unique slug configuration, department head assignment, and activation toggles.
5. **`RolesAdminPage.tsx`**: Custom role builder with a fine-grained permission checkbox matrix (`resource.action`).
6. **`WorkflowsAdminPage.tsx`**: Workflow state machine designer. Add/reorder statuses, assign color tokens, categories, and configure `requiresHoldReason`, `requiresEstimateBeforeEntry`, and `isReviewStatus` flags. Define transition rules with permission and approval gates.
7. **`PrioritiesAdminPage.tsx`**: Manage priority levels, color badges, display weights, and default assignments.
8. **`CustomFieldsAdminPage.tsx`**: Department-specific dynamic field creator (Text, Number, Date, Boolean, Dropdown, Multi-Select, User Reference).
9. **`SLAAdminPage.tsx`**: SLA policy manager. Configure response and resolution target minutes, escalation thresholds, and manager notification rules.
10. **`HolidayCalendarsAdminPage.tsx`**: Create Country/State holiday calendars, add individual holidays, or bulk upload holiday lists via CSV.
11. **`ScorecardWeightsAdminPage.tsx`**: Live weight tuning for the 6 scorecard parameters (validates sum = 1.0).
12. **`OnHoldReasonsAdminPage.tsx`**: Administer standard reasons for pausing tasks.
13. **`IntegrationsAdminPage.tsx`**: Runtime configuration of Google Workspace SMTP settings and connection testing (`POST /integration-settings/smtp/test`).
14. **`OrgSettingsAdminPage.tsx`**: Organization name, timezone, company logo, and official working days.
15. **`AdminBugReportsPage.tsx`**: Administrative triage queue for user-submitted bug tickets, including page URLs and screenshot previews.

---

### 7.2 Shared UI Component Library

| Component | File Path | Functionality & Features |
| :--- | :--- | :--- |
| **`NotificationBell.tsx`** | `components/NotificationBell.tsx` | Interactive top-bar bell with unread badge counter, live notification dropdown list, mark-as-read, and direct links. |
| **`GlobalSearch.tsx`** | `components/GlobalSearch.tsx` | Modal search palette (`Cmd+K` / `Ctrl+K`) for quick navigation to tasks, users, and reports. |
| **`BugReportModal.tsx`** | `components/BugReportModal.tsx` | Floating bug submission dialog capturing issue descriptions, current route URL, and base64 screenshot uploads. |
| **`DateRangePicker.tsx`** | `components/DateRangePicker.tsx` | Standardized date filter dropdown with 9 preset periods (Today, This Week, Last Month, This Quarter, Custom). |
| **`CountryStateSelect.tsx`**| `components/CountryStateSelect.tsx`| Cascading country and state dropdown powered by `country-region-data`. |
| **`RichTextEditor.tsx`** | `components/RichTextEditor.tsx` | Tiptap rich text editor with toolbar (H1-H3, Bold, Italic, Lists, Code) and `@user` mention suggestions via Tippy.js. |
| **`MentionList.tsx`** | `components/MentionList.tsx` | Dropdown popup displaying matching active users during `@mention` typing. |
| **`ToastContainer.tsx`** | `components/ToastContainer.tsx` | Global reactive toast notification system for success, error, warning, and info alerts. |
| **`ConfirmDialog.tsx`** | `components/ConfirmDialog.tsx` | Accessible modal dialog for confirming destructive actions (archive, delete, deactivation). |
| **`DepartmentPickerModal.tsx`**| `components/DepartmentPickerModal.tsx`| Modal allowing users to switch or filter active department scopes. |
| **`Badge.tsx`** | `components/Badge.tsx` | Multi-theme badge with contrast-safe border rendering dynamic hex colors from workflows and priorities. |
| **`Toggle.tsx`** | `components/Toggle.tsx` | Accessible animated switch toggle for boolean settings and status activations. |
| **`ErrorBoundary.tsx`** | `components/ErrorBoundary.tsx` | React error boundary catching runtime exceptions and displaying recovery options. |
| **`Breadcrumbs.tsx`** | `app/Breadcrumbs.tsx` | Automatic route tree breadcrumb navigation with dynamic task title resolution. |
| **`ThemeToggle.tsx`** | `app/ThemeToggle.tsx` | Light/Dark/System theme switch button. |
| **`Shell.tsx`** | `app/Shell.tsx` | App layout shell containing collapsible sidebar, top navigation bar, active role badge, and content viewport. |

---

## 8. Core Business Logic, Workflows & Special Algorithms

### 8.1 Mandatory Effort Estimate Gate & 30-Minute Edit Window
- **Requirement**: A task cannot enter an active work status (e.g. `In Progress`) without an effort estimate (`estimateValue` + `estimateUnit`).
- **Gate Logic**: Any status flagged with `requiresEstimateBeforeEntry = true` blocks transitions if `task.estimateValue == null`.
- **Self-Service Window**: The assignee can freely edit the estimate within 30 minutes of submission (`estimateSubmittedAt`).
- **Admin Override**: After 30 minutes, edits are locked. Only users holding `task.override_locked_edits` (Admin) can modify the estimate, and all overrides are permanently flagged in the activity audit log.

### 8.2 Work Session Timer & Review Gate Auto-Logging
- **Live Stopwatch**: Moving a task to `In Progress` records `timerStartedAt = now()`. The frontend computes live elapsed time as `(now - timerStartedAt) + totalLoggedMinutes`.
- **Review Gate**: Moving into an `isReviewStatus = true` status (e.g. `In Review`):
  1. Stops the timer (`timerStartedAt = null`).
  2. Computes the elapsed work session in minutes.
  3. Appends the minutes to `totalLoggedMinutes`.
  4. Automatically generates a `TimeLog` record with a system note.
  5. Sends an instant notification to the assignee's direct manager (`User.managerId`).

### 8.3 Hard Subtask Block vs. Soft Dependency Warning
- **Parent-Subtask Hard Block**: A parent task is strictly forbidden from transitioning into a `done`-category status if any child subtask is still open (`tasks.service.ts`).
- **Task Dependencies Soft Warning**: If a task has open blocking dependencies (`type = blocks`), transitioning to `Done` is permitted, but the API returns a structured warning (`warnings.open_blockers`) which the UI surfaces as a confirmation prompt.

### 8.4 Regional Business-Day & Holiday Overdue Calculation
- **Algorithm** (`business-days.util.ts`):
  1. Retrieves the assignee's regional `HolidayCalendar` using `User.workCountry` and `User.workState`.
  2. Iterates each day between `dueDate` and `currentDate`.
  3. Excludes Saturdays, Sundays, and all dates matching records in the `Holiday` table.
  4. A task is strictly marked **Overdue** only when $\ge 1$ full business day has elapsed past its due date.

### 8.5 Overdue vs. Over-Budget Independent Dual Tracking
- **Overdue**: A task where the due date has elapsed in business days.
- **Over-Budget**: A task where total logged minutes exceed the effort estimate (`totalLoggedMinutes > estimateMinutes`).
- **Independence**: These two failure modes are tracked as separate, independent metrics across dashboards, reports, and scorecards.

### 8.6 Normalized 6-Parameter Employee Scorecard Algorithm
The employee performance engine computes a weighted score (0–100) across six distinct sub-scores:

$$\text{Overall Score} = \sum_{i=1}^{6} (\text{SubScore}_i \times \text{Weight}_i)$$

| Sub-Metric | Default Weight | Mathematical Formula / Scoring Basis |
| :--- | :---: | :--- |
| **On-Time Rate** | `0.25` | $(\text{Tasks Completed on or before Due Date} / \text{Total Completed Tasks with Due Date}) \times 100$ |
| **Estimate Accuracy** | `0.20` | Normalized ratio of $\text{Actual Logged Time} / \text{Estimated Time}$ across completed tasks. |
| **Volume Throughput**| `0.15` | Scaled relative to the highest volume performer in the same department over the selected date range. |
| **Overdue Penalty** | `0.15` | $100 - (\text{Overdue Tasks Count} \times \text{Penalty Factor})$ (bounded at 0). |
| **Over-Budget Penalty**| `0.15` | $100 - (\text{Tasks Exceeding Estimate} / \text{Total Estimated Tasks}) \times 100$. |
| **Rework Penalty** | `0.10` | Frequency of tasks transitioned back from `Done` into an active status. |

Weights are stored in `ScorecardConfig` and editable in real-time by Admins.

---

## 9. Reporting, Analytics & Scheduled Export Engine

### 9.1 Report Builder Architecture
- **Metrics Catalog**: Task Counts by Status, Department, Assignee, Priority; Overdue Count & Rate; Over-Budget Count & Rate; Average Time to Completion; SLA Compliance Rate; Throughput; Time Tracked.
- **Dimensions**: Group by Department, Assignee, Status, Priority, Creation Date, Due Date.
- **Pre-Aggregated Cache**: `ReportAggregateCache` pre-computes daily metrics via background cron, ensuring instant report loading without scanning millions of raw task rows.

### 9.2 Export Engines
1. **CSV Export** (`csv.ts`): Client-side and server-side RFC 4180-compliant CSV generation.
2. **Excel (.xlsx) Export** (`exceljs`): Multi-sheet workbooks with formatted headers, auto-width columns, and data types.
3. **PDF Export** (`pdfkit`): Multi-page document generator with organization branding, chart summaries, and data tables.

---

## 10. Notifications, Email & Push Infrastructure

TaskApp provides a multi-channel notification engine:

```
[System Event: Assignment / Overdue / Review / Mention]
                        │
                        ▼
       [NotificationsService.notify()]
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
   [In-App DB]    [Push Service]   [Mail Service]
   (PostgreSQL)    (Expo Relay)   (Google SMTP)
```

1. **In-App Notifications**: Stored in `notifications` table, displayed in `NotificationBell.tsx`, with unread counts and direct deep links.
2. **Expo Mobile Push**: Sent via HTTPS POST to `https://exp.host/--/api/v2/push/send`. Fanned out to Apple APNs and Google FCM.
3. **Google Workspace SMTP Email**: Connects to Google Workspace SMTP relay using credentials configured in `IntegrationSetting`. Dispatches HTML emails for task assignments, overdue alerts, and scheduled report attachments.

---

## 11. Mobile Application Architecture (React Native & Expo)

The mobile application (`apps/mobile`) provides native task management on iOS and Android:

- **Navigation Structure**:
  - `TasksStack`: My Tasks Dashboard, Task List, Task Detail, Create Task.
  - `TeamStack`: Role-adaptive Team Dashboard.
  - `ScorecardStack`: Personal Scorecard, Sub-scores, Department Leaderboard.
  - `NotificationsStack`: Notification feed and preferences.
- **Theme Provider** (`useAppTheme`): Resolves Studio Desk colors (Forest Green, Putty, Ochre) and typography for light and dark modes.
- **Native Patching (`patches/`)**: Uses `patch-package` to resolve monorepo module-hoisting paths in Expo CLI and Gradle scripts.

---

## 12. Complete REST API Surface Directory

All endpoints are prefixed with `/api/v1` (or root where noted) and protected by `JwtAuthGuard` and `PermissionsGuard`.

### Authentication & User Profile
- `POST /auth/firebase`: Exchange Firebase Google ID token for application JWT.
- `POST /auth/dev-login`: Mock authentication for local development and role testing.
- `GET /me`: Get current authenticated user profile and permissions.
- `PATCH /me/preferences`: Update user notification preferences.
- `PATCH /me/location`: Update user work location (country/state).
- `POST /me/push-token`: Register Expo mobile push token.
- `PATCH /me/active-role`: Switch active presentation role.

### Tasks & Subtasks
- `GET /tasks`: List tasks with filtering (status, priority, department, assignee, overdue, over_budget, search, pagination).
- `POST /tasks`: Create a new task or subtask.
- `GET /tasks/:id`: Get full task details including custom fields, subtasks, dependencies, time logs, and comments.
- `PATCH /tasks/:id`: Update task attributes.
- `DELETE /tasks/:id`: Delete a task (or create a delete action request).
- `PATCH /tasks/:id/status`: Transition task workflow status (evaluates gates, estimates, holds, and approvals).
- `POST /tasks/:id/assign`: Assign or reassign a task.
- `POST /tasks/:id/estimate`: Submit or edit effort estimate.
- `POST /tasks/:id/time-logs`: Log work session or manual time entry.
- `GET /tasks/:id/dependencies`: Get blocking and related dependencies.
- `POST /tasks/:id/dependencies`: Add dependency edge.
- `DELETE /tasks/:id/dependencies/:depId`: Remove dependency edge.
- `POST /tasks/:id/comments`: Add rich-text comment with mentions.
- `POST /tasks/:id/attachments`: Upload attachment metadata.
- `GET /tasks/:id/activity`: Retrieve immutable activity audit log.

### Reviews & Approvals
- `POST /tasks/:id/reviews`: Submit review feedback (changes requested or approved).
- `GET /tasks/:id/reviews`: List review history and attachments.
- `POST /tasks/:id/action-requests`: Create archive or delete request.
- `PATCH /action-requests/:id`: Approve or reject archive/delete action request.
- `POST /approval-steps/:id/decide`: Approve or reject workflow transition approval step.

### Dashboards & Scorecards
- `GET /dashboards/personal`: Get personal task counts and overdue statistics.
- `GET /dashboards/team`: Get role-adaptive team metrics (Org / Department / Manager scope).
- `GET /scorecards/me`: Get personal 6-parameter scorecard and overall rating.
- `GET /scorecards/users/:userId`: Get individual user scorecard breakdown.
- `GET /scorecards/leaderboard`: Get ranked department performance leaderboard.
- `GET /scorecards/config`: Get admin scorecard weights.
- `PUT /scorecards/config`: Update admin scorecard weights (Admin only).

### Reporting & Analytics
- `GET /reports`: List saved reports and starter templates.
- `POST /reports`: Create a custom saved report.
- `GET /reports/:id`: Get report configuration and run cached aggregate query.
- `PATCH /reports/:id`: Update saved report.
- `DELETE /reports/:id`: Delete saved report.
- `GET /reports/:id/export`: Generate and stream CSV, Excel (.xlsx), or PDF export.
- `POST /reports/:id/schedules`: Add recurring email schedule.
- `DELETE /reports/:id/schedules/:schedId`: Remove email schedule.

### Administration Suite
- `GET /users`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id`: User management.
- `GET /departments`, `POST /departments`, `PATCH /departments/:id`: Department management.
- `GET /roles`, `POST /roles`, `PATCH /roles/:id`, `DELETE /roles/:id`: Role & permission management.
- `GET /workflows`, `POST /workflows`, `PATCH /workflows/:id`: Workflow state machine builder.
- `GET /priorities`, `POST /priorities`, `PATCH /priorities/:id`: Priority definitions.
- `GET /custom-fields`, `POST /custom-fields`, `PATCH /custom-fields/:id`: Dynamic custom fields.
- `GET /sla-policies`, `POST /sla-policies`, `PATCH /sla-policies/:id`: SLA policies and escalation rules.
- `GET /holiday-calendars`, `POST /holiday-calendars`, `POST /holiday-calendars/:id/csv`: Holiday calendar manager.
- `GET /on-hold-reasons`, `POST /on-hold-reasons`, `PATCH /on-hold-reasons/:id`: On-hold reasons.
- `GET /organization-settings`, `PATCH /organization-settings`: Org branding and timezone.
- `GET /integration-settings`, `PUT /integration-settings/:key`: Integration credentials & SMTP.
- `POST /integration-settings/smtp/test`: Test live SMTP email connectivity.
- `GET /bug-reports`, `POST /bug-reports`: Bug reporting and admin triage.

---

## 13. Cloud Infrastructure, Security & DevOps Topology

### 13.1 Google Cloud Platform Resources (`infra/`)
- **Google Cloud Run**:
  - `taskapp-web`: Serves production React SPA bundle on Port 8080.
  - `taskapp-api`: Serves NestJS backend REST API on Port 3000.
- **Google Cloud SQL**:
  - `taskapp-db`: Managed PostgreSQL 15 instance in `us-central1` with automated backups and private VPC connection.
- **Google Artifact Registry**:
  - `taskapp-repo`: Secure Docker container registry storing versioned API and Web container images.
- **Google Cloud Build**:
  - Automated CI/CD pipeline triggered by Git commits, building multi-stage Docker images and deploying to Cloud Run.
- **Google Secret Manager & KMS**:
  - Stores bootstrap secrets (database credentials, JWT signing keys) and encrypts sensitive integration tokens.

---

## 14. Testing, Quality Assurance & Operational Runbook

### Local Development Setup
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Generate Database Client**:
   ```bash
   npx prisma generate --schema=apps/api/prisma/schema.prisma
   ```
3. **Execute Database Migrations & Seeds**:
   ```bash
   npx prisma migrate dev --schema=apps/api/prisma/schema.prisma
   npm run prisma:seed --workspace=@taskapp/api
   ```
4. **Start Development Servers Concurrently**:
   ```bash
   npm run dev
   ```
   - Web SPA runs on: `http://localhost:5173`
   - API runs on: `http://localhost:3000`
   - Mobile Metro bundler runs on: `http://localhost:8081`

### Build & Typecheck Commands
- Full Workspace Build: `npm run build`
- Typecheck All Packages: `npm run typecheck`
- Code Formatting: `npm run format`

---
*Document compiled and verified against TaskApp codebase master repository.*
