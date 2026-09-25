# TaskApp (Task Management Application) — Complete System Documentation

Welcome to the comprehensive technical and operational guide for the **Task Management Application (TaskApp)**. This document explains how the entire platform works, where data is stored, how the frontend and backend communicate, how security and authentication operate, and how infrastructure components connect on Google Cloud Platform (GCP).

---

## 1. System Architecture Overview

TaskApp is built as a **Turborepo monorepo** with a decoupled frontend single-page application (SPA), a RESTful backend API, and a managed PostgreSQL database deployed on Google Cloud Platform.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENTS (BROWSER)                               │
│                                                                             │
│  React 18 + Vite + Tailwind CSS + Lucide Icons + Zustand + TanStack Query  │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
       1. OAuth / SSO  │                               │ 2. Authenticated REST
          Google Login │                               │    Requests (Bearer JWT)
                       ▼                               ▼
       ┌───────────────────────────────┐   ┌──────────────────────────────────┐
       │   Firebase Authentication     │   │     Backend API (NestJS)         │
       │  (testing-sujeeth.firebase)   │   │  (Google Cloud Run: taskapp-api) │
       └───────────────────────────────┘   └─────────────────┬────────────────┘
                                                             │
                                                             │ Prisma ORM
                                                             │ Cloud SQL Socket
                                                             ▼
                                           ┌──────────────────────────────────┐
                                           │   Google Cloud SQL (PostgreSQL)  │
                                           │   (Database Instance: taskapp-db)│
                                           └──────────────────────────────────┘
```

---

## 2. Where & How Data Is Stored

Data in TaskApp is categorized across three storage layers:

### A. Central Persistent Database (Google Cloud SQL PostgreSQL)
All operational data, business rules, task histories, and configurations are stored in a managed PostgreSQL 15 database hosted on Google Cloud SQL (`taskapp-db` in `us-central1`).

| Storage Entity / Table | What It Stores |
| :--- | :--- |
| **`users`** | User ID, email, full name, avatar URL, active status, last login timestamp, primary department, and auth provider details. |
| **`departments`** | Department names, slugs, descriptions, active state, and assigned Department Head User ID. |
| **`roles` & `permissions`** | Role definitions (Admin, Management, Head, Manager, Employee), role scopes, and granular permission keys (`task.create`, `task.delete`, `user.manage`, etc.). |
| **`tasks` & `subtasks`** | Task title, description (rich text HTML/JSON), priority ID, status ID, department ID, creator ID, assignee ID, reporter ID, start date, due date, completion date, and SLA response timestamps. |
| **`task_custom_field_values`** | Department-specific metadata values dynamically attached to tasks (text, numbers, dropdowns, dates, booleans). |
| **`task_dependencies`** | Dependency graph edges (`blocks`, `blocked_by`, `relates_to`) between tasks used by the Gantt Timeline. |
| **`task_recurrences`** | Recurrence rules, cron intervals, timezone offsets, and next run schedules for automated recurring tasks. |
| **`task_comments` & `task_comment_mentions`** | Discussion threads, rich text formatting, and `@user` mention relationships. |
| **`workflow_definitions`, `workflow_statuses`, `workflow_transitions`** | Status lifecycle state machine, color tokens, categories (`todo`, `in_progress`, `done`, `cancelled`), and transition permission gates. |
| **`priority_definitions`** | Priority levels (e.g. Critical, High, Normal, Low), visual badge colors, and sorting weight. |
| **`sla_policies` & `holiday_calendars`** | Response and resolution hour targets by priority, business hour definitions, country/state official holiday exclusion lists. |
| **`scorecard_config`** | Admin-tunable weights for employee scorecards (completion rate, on-time percentage, quality index). |
| **`notifications` & `push_subscriptions`** | In-app notification center records, read/unread states, and browser Web Push VAPID credentials. |
| **`audit_logs`** | Tamper-evident activity stream tracking every state change, assignment update, and deletion across the system. |

---

### B. Cloud Storage (Google Cloud Storage)
- **Avatars & Attachments**: Uploaded task files, documents, screenshots, and user profile pictures are stored as binary objects in cloud storage and referenced by persistent URLs in the database.

---

### C. Client Browser Storage (`localStorage` & Memory)
On the user's browser, data is cached for fast responsiveness and secure session handling:
- **`taskapp.auth` (Session Store)**: Stores the user profile, active role, and TaskApp JWT token.
- **`taskapp.sidebarCollapsed`**: Remembers whether the user preferred a collapsed or expanded sidebar.
- **`theme` (`taskapp.theme`)**: Remembers user dark mode vs. light mode setting.
- **`onboarding_dismissed`**: Remembers if the onboarding welcome tour has been completed.
- **Memory Cache (TanStack Query)**: Live query cache that invalidates and updates UI without full-page reloads.

---

## 3. How Everything Is Linked & Working End-to-End

### Step 1: Authentication & User Provisioning Flow
1. The user clicks **Sign in with Google** on the web login page (`LoginPage.tsx`).
2. Firebase Authentication handles OAuth 2.0 with Google and returns a verified Google ID Token (restricted to `@econz.net`).
3. The frontend sends this token to the backend endpoint `POST /auth/firebase`.
4. The backend verifies the token with Firebase Admin:
   - If the user doesn't exist in PostgreSQL, they are automatically created in the `users` table.
   - If the user is `sujeeth.k@econz.net`, they are automatically granted the **Admin** role.
   - All other users receive the **Employee** role by default.
5. The backend issues a signed **TaskApp JWT Access Token** along with the user's permissions and profile.
6. The frontend stores this token and sets up the authenticated API client.

```
[User Browser]
      │  (1) Google Sign-In Popup
      ▼
[Firebase Auth]
      │  (2) Firebase ID Token
      ▼
[Frontend: LoginPage.tsx]
      │  (3) POST /auth/firebase { idToken }
      ▼
[Backend: AuthService.loginWithFirebase()]
      │  (4) Verify token with Firebase SDK
      │  (5) prisma.user.upsert() in Cloud SQL PostgreSQL
      │  (6) Generate TaskApp JWT with user ID, email, role, permissions
      ▼
[Frontend: SessionStore]
      │  (7) Saves session to memory & localStorage -> Redirects to Dashboard
```

---

### Step 2: Task Operations & State Machine Flow
1. **Creating a Task**:
   - The user fills the **New Task** modal or page.
   - `apiClient.tasks.create()` sends a `POST /tasks` payload to the backend.
   - The backend validates custom fields, computes initial SLA targets based on the department's priority policy, assigns the initial workflow status (`todo`), and writes the record to PostgreSQL inside a transaction.
2. **Kanban Drag-and-Drop & Status Transitions**:
   - When a user moves a task card to a new column on `KanbanBoardPage.tsx`, the frontend calls `PATCH /tasks/:id/status`.
   - The backend looks up `workflow_transitions` to check if moving from status `A` to status `B` is legally allowed and if the user has the required permission.
   - If valid, the task's status is updated, audit log written, and notifications dispatched.
3. **Gantt Timeline Calculation**:
   - The `TimelinePage.tsx` fetches tasks with start and due dates.
   - Dependencies are loaded via `GET /tasks/:id/dependencies`.
   - The browser computes day column coordinates, draws connecting SVG arrows from blockers to blocked tasks, highlights overdue deadlines, and renders vertical today guide markers.

---

### Step 3: Role-Based Access Control (RBAC) & Dynamic Permissions
- **5 Core Roles**:
  1. **Admin**: Global administrative control (Departments, Roles, Users, Workflows, SLA, Custom Fields, Integrations).
  2. **Management**: High-level cross-department visibility, executive reports, and aggregate scorecards.
  3. **Head**: Full leadership authority over their specific assigned department.
  4. **Manager**: Team oversight, task assignment, review, and member workload tracking.
  5. **Employee**: Day-to-day personal task execution, subtasks, time logging, and collaboration.
- **Frontend Enforcement**: UI components use `usePermission('key')` or `useHasAnyPermission('key')` to conditionally show/hide admin buttons, settings tabs, and management routes.
- **Backend Enforcement**: NestJS `@UseGuards(JwtAuthGuard, PermissionsGuard)` and `@RequirePermissions('...')` enforce strict server-side verification on every API route.

---

## 4. Google Cloud Infrastructure Topology

All production workloads run on Google Cloud Platform in the `testing-sujeeth` project:

| GCP Component | Resource Name | Description / URL |
| :--- | :--- | :--- |
| **Cloud Run (Frontend)** | `taskapp-web` | Serves the production React SPA bundle on port 8080. Accessible at: `https://taskapp-web-430674734301.us-central1.run.app` |
| **Cloud Run (Backend API)** | `taskapp-api` | Serves the NestJS REST API and connects to Cloud SQL via Unix Domain Socket. Accessible at: `https://taskapp-api-430674734301.us-central1.run.app` |
| **Cloud SQL** | `taskapp-db` | Managed PostgreSQL 15 database instance with automated backups and connection pooling. |
| **Artifact Registry** | `taskapp-repo` | Docker registry hosting versioned container images (`us-central1-docker.pkg.dev/testing-sujeeth/taskapp-repo/web:latest` and `api:latest`). |
| **Cloud Build** | Multi-stage builder | Automated container build pipeline building from source with environment substitutions. |
| **Firebase Project** | `testing-sujeeth` | Manages OAuth2 client IDs, Google authentication credentials, and security rules. |

---

## 5. Codebase Directory Map

```
Task Management/
├── apps/
│   ├── api/                       # Backend NestJS REST API
│   │   ├── prisma/                # Prisma schema, migrations, and seed scripts
│   │   ├── src/
│   │   │   ├── auth/              # JWT, Firebase OAuth, Passwordless strategies
│   │   │   ├── tasks/             # Tasks, Subtasks, Dependencies, Recurrence
│   │   │   ├── users/             # User management, profile, avatar handling
│   │   │   ├── rbac/              # Roles, Permissions, RoleSwitcher
│   │   │   ├── workflows/         # Status transitions and state machine engine
│   │   │   ├── departments/       # Department structures and membership
│   │   │   ├── priorities/        # Priority levels and colors
│   │   │   ├── sla/               # SLA calculators and holiday calendar engine
│   │   │   ├── scorecards/        # Performance weights and leaderboard calculations
│   │   │   ├── custom-fields/     # Custom metadata definitions and validation
│   │   │   ├── notifications/     # Notification dispatching and Web Push service
│   │   │   └── reports/           # Custom report builder and aggregator
│   │   ├── Dockerfile             # Multi-stage production Docker build for API
│   │   └── cloudbuild.yaml        # Cloud Build instructions for API
│   │
│   └── web/                       # Frontend React Single Page Application
│       ├── src/
│       │   ├── app/               # Shell, Navbar, Breadcrumbs, ThemeToggle, App router
│       │   ├── components/        # Lucide vector icons, Badges, Modals, Toast, RichText
│       │   ├── features/          # Feature hooks, forms, auth providers, bootstrap
│       │   ├── pages/             # Route pages: MyTasks, Kanban, Timeline, Reports, Admin
│       │   └── lib/               # API client instance, Zustand stores, Push client
│       ├── Dockerfile             # Multi-stage production Docker build for Web SPA
│       └── cloudbuild.yaml        # Cloud Build instructions for Web SPA
│
├── packages/
│   ├── api-client/                # Strongly-typed isomorphic HTTP client SDK
│   ├── config/                    # Shared TypeScript configs and Tailwind presets
│   └── shared-types/              # Shared data contracts, TypeScript interfaces, Zod schemas
│
├── docs/                          # Comprehensive technical design specifications
└── turbo.json                     # Turborepo build pipeline and caching rules
```

---

## 6. How to Run & Build Locally

### Prerequisites
- Node.js 20+
- npm 10+
- PostgreSQL (or local Docker container)

### Step-by-Step Local Setup
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Generate Database Client**:
   ```bash
   npx prisma generate --schema=apps/api/prisma/schema.prisma
   ```
3. **Run Full Build**:
   ```bash
   npx turbo run build
   ```
4. **Start Development Servers (Frontend + Backend concurrently)**:
   ```bash
   npx turbo run dev
   ```
   - Frontend runs on: `http://localhost:5173`
   - Backend API runs on: `http://localhost:3000`
