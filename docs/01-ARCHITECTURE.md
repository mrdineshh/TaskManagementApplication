# 01 — Architecture

Read `00-OVERVIEW.md` first. This document defines the system design, the full
technology stack with reasoning, and the monorepo layout the build agent should
create.

---

## 1. Guiding principles [Fixed]

These principles drive every choice below:

1. **Cost-conscious** — prefer managed, scale-to-zero / pay-per-use GCP services
   over always-on infrastructure. Don't provision for scale we don't have yet.
2. **One language across the stack where practical** — reduces context-switching
   for a small team and allows type sharing between backend, web, and mobile.
3. **Internal tool, not a public product** — no SEO, no marketing site, no
   multi-tenant isolation. Optimize for maintainability and developer speed,
   not for public-internet scale.
4. **API-first** — the REST API is a real product surface (future
   integrations), not just a private contract between frontend and backend.
5. **Boring technology where it counts** — the data layer (Postgres) and auth
   are the two places where reliability matters most; keep those simple and
   proven. Reserve newer/trendier tooling for lower-stakes layers.

## 2. Tech stack [Default unless noted, with reasoning]

### 2.1 Backend — Node.js + NestJS + TypeScript **[Default]**

- **Why NestJS over FastAPI (Python) or plain Express:**
  - Shares TypeScript with the web app and the React Native mobile app —
    types (task shapes, DTOs, enums) can be defined once in a shared package
    and imported everywhere, cutting a whole class of bugs where frontend and
    backend drift apart.
  - NestJS's module/provider structure maps naturally onto this domain:
    a module per department-facing feature (Tasks, Users, RBAC, Notifications,
    Reporting, etc.), with dependency injection making RBAC guards and
    department-scoping logic reusable and testable.
  - Built-in support for guards/interceptors is a good fit for the fine-grained
    custom RBAC requirement (`03-RBAC-AUTH.md`) — permission checks become
    declarative decorators on endpoints rather than scattered if-checks.
  - Mature ecosystem for the pieces we need: validation (class-validator),
    OpenAPI generation (for `04-API-SPEC.md`), queues, scheduling, WebSockets
    (if real-time notifications are added later).
- This is a **Default**, not a **Fixed** choice — if there's a strong reason to
  prefer Python/FastAPI (e.g. existing team expertise, planned ML/reporting
  workloads in Python), that's an easy substitution before build starts. Flagged
  in `10-OPEN-DECISIONS.md`.

### 2.2 Database — PostgreSQL via Cloud SQL **[Fixed — relational integrity is required]**

- Tasks, subtasks, dependencies, approvals, custom fields, and RBAC permissions
  are all relational by nature (foreign keys, joins, constraints matter more
  than horizontal write scale). Postgres is the right fit over a NoSQL store.
- **Cost approach:** start on the smallest viable tier (shared-core / e.g.
  `db-f1-micro` or the current GCP equivalent) with automated backups enabled;
  scale vertically only when metrics justify it. Full sizing detail in
  `08-INFRA-DEPLOYMENT.md`.
- Department-specific custom fields are modeled via a flexible
  **JSONB column + schema definition table**, not a separate table per
  department — see `02-DATA-MODEL.md` for the full design and reasoning.

### 2.3 Caching / queues — deferred, DB-backed initially **[Default]**

- No Redis/Memorystore in v1. Scheduled jobs (SLA checks, digest emails) use
  **Cloud Scheduler + Cloud Tasks**, and any short-term caching needs are
  handled in-process or via Postgres, to avoid paying for an always-on
  Memorystore instance before it's needed.
- Redis (Memorystore) is reintroduced in **v1.1** if/when SLA escalation
  volume, job queue throughput, or session load actually require it. This is a
  cost/complexity trade-off explicitly deferred, not forgotten.

### 2.4 File storage — Cloud Storage **[Fixed]**

- Task attachments, exported reports (v1.2), and any user-uploaded files go to
  **Cloud Storage** buckets, served via signed URLs. Pay-per-use, no idle cost.

### 2.5 Web frontend — React + TypeScript + Vite **[Fixed: no SSR framework, per no-SEO requirement]**

- Plain **Vite + React + TypeScript** SPA. No Next.js — there's no SEO
  requirement and this is an authenticated internal tool, so SSR only adds
  hosting complexity and cost without benefit.
- Routing: React Router.
- State/data-fetching: **TanStack Query** for server state (caching, refetching
  task/report data) + lightweight local state (React state / Zustand) for UI
  state. Avoids the overhead of a heavier global state library like Redux for
  data that mostly mirrors the API.
- UI components: a headless/utility component approach (e.g. Radix primitives +
  Tailwind CSS) so the UI can be styled DIY per your earlier requirement,
  without fighting an opinionated design system. Full detail in
  `06-FRONTEND-WEB.md`.

### 2.6 Mobile frontend — React Native + TypeScript **[Fixed]**

- Single codebase for iOS and Android, per your requirement.
- Shares the same API client and type definitions as the web app via a shared
  package in the monorepo (see §4). Full detail in `07-FRONTEND-MOBILE.md`.

### 2.7 Auth — Google Sign-In + pluggable SSO abstraction **[Fixed]**

- **v1:** "Sign in with Google" via OAuth 2.0, implemented using **Firebase
  Auth** — confirmed as the identity integration layer (over a raw Google
  OAuth 2.0 implementation) for its built-in token refresh/verification and
  ready-made client SDKs for both web and React Native.
- **Sign-in is restricted to the organization's email domain: `@econz.net`.**
  No other Google account can sign in.
- **Architecture requirement:** all auth flows go through an internal
  `AuthProvider` abstraction in the backend, so a second provider (your
  internal OIDC/SAML-based SSO, once ready) can be added as a new
  implementation of that interface — not a rewrite. This is the key
  architectural commitment from this section: **do not hardcode Google as the
  only possible identity source anywhere in the codebase.**
- Full detail, including token handling and session strategy, in
  `03-RBAC-AUTH.md`.

### 2.8 Reporting/dashboards — built in-app **[Fixed]**

- No third-party BI dependency. Charting via a frontend library (e.g. Recharts)
  against API endpoints purpose-built for aggregation queries. Full design
  deferred to `05-FEATURES.md` (Phase v1.2), per your request to discuss it
  when we reach that stage.

### 2.9 Notifications **[Fixed]**

- **v1:** in-app notifications (DB-backed) + email, sent via **Google
  SMTP** (Google Workspace's SMTP relay) as the transactional email
  mechanism. **Note for the build agent:** Google Workspace SMTP relay has
  daily sending limits (historically in the low thousands of messages/day,
  varies by plan) — comfortably enough for task notifications and scheduled
  reports at this organization's scale, but worth a quick volume sanity-check
  once real usage patterns are known, particularly once scheduled report
  emails (`05-FEATURES.md` §3.4) are added in v1.2.
- **v1.1:** push notifications via **Firebase Cloud Messaging** (mobile),
  and optionally Slack/Teams webhook integration.

### 2.9a Admin-configurable settings vs. deployment secrets **[Fixed — important distinction]**

Per the configurability principle (`00-OVERVIEW.md` §5), most operational
settings — including the SMTP configuration used for email (§2.9), and any
future integration credentials — are **not** deployment-time secrets that
only an engineer can change. They are stored as encrypted configuration in
the database, editable by Admins through the Admin UI (`06-FRONTEND-WEB.md`
§6) at any time, taking effect immediately without a redeploy.

This is a deliberate architectural line, not a loose guideline, so it's worth
being explicit about where it sits:

- **Admin-UI-configurable (DB-stored, encrypted at rest):** SMTP
  host/port/credentials, notification preferences/thresholds, SLA policy
  values, workflow/status/transition definitions, custom field definitions,
  role/permission assignments, org name/timezone/logo, and any future
  third-party integration credentials (Slack/Teams webhook URLs, etc.).
- **Deployment-only (GCP Secret Manager, requires a deploy to rotate):**
  the small, genuinely bootstrap-only set of secrets the application needs
  before it can even read its own configuration — the database connection
  string/credentials, the JWT signing key, and the Firebase/Google OAuth
  client secret. These exist "below" the application's own settings layer by
  necessity: the app can't look up DB-stored config before it has a DB
  connection.

**Implementation note for the build agent:** encrypted values in the DB (e.g.
SMTP password) should use envelope encryption via **Cloud KMS** — the DB
stores ciphertext, KMS holds the key, and only the running application (via
its service account IAM permissions) can decrypt. This keeps the "admin
changes it instantly, no engineer needed" property while still keeping
credentials out of plaintext storage.

## 3. System design overview

```
                          ┌─────────────────────┐
                          │   React Native App    │
                          │   (iOS / Android)      │
                          └──────────┬─────────────┘
                                     │  HTTPS / REST (JSON)
┌───────────────────────┐           │
│   React Web App (SPA)  │───────────┤
└───────────┬─────────────┘           │
            │ HTTPS / REST             │
            ▼                          ▼
      ┌─────────────────────────────────────┐
      │        NestJS API (Cloud Run)         │
      │  Modules: Auth, RBAC, Users, Tasks,   │
      │  Departments, CustomFields,           │
      │  Notifications, Reporting, Files      │
      └───────┬───────────┬───────────┬───────┘
              │           │           │
              ▼           ▼           ▼
      ┌──────────┐ ┌────────────┐ ┌───────────────┐
      │ Cloud SQL │ │ Cloud       │ │ Cloud Storage  │
      │ (Postgres)│ │ Scheduler/  │ │ (attachments,  │
      │           │ │ Tasks       │ │ exports)       │
      └──────────┘ └────────────┘ └───────────────┘
              │
              ▼
      ┌──────────────────┐
      │  External SSO /   │  (added in a later phase — via
      │  Identity Provider│   AuthProvider abstraction)
      └──────────────────┘

Third-party integrations ──▶ REST API (versioned, documented in 04-API-SPEC.md)
```

- Web and mobile are both thin clients against the same REST API — no
  business logic is duplicated client-side beyond form validation/UX.
- The API is stateless (JWT-based sessions), which is what makes Cloud Run
  (scale-to-zero, horizontally scaled containers) a good fit — no server-side
  session affinity required.

## 4. Monorepo layout [Default]

Using **Turborepo** (simpler setup than Nx for a team of this size, still gives
build caching and task orchestration across apps/packages).

```
/ (repo root)
├── apps/
│   ├── api/              # NestJS backend
│   ├── web/               # Vite + React web app
│   └── mobile/             # React Native app
├── packages/
│   ├── shared-types/      # Task, User, Role, etc. TypeScript types + DTOs
│   ├── api-client/        # Typed fetch/axios client used by web + mobile
│   ├── ui/                 # Shared design tokens/components usable by web
│   │                       #   (RN can't reuse React DOM components directly,
│   │                       #   but shares tokens/theme values)
│   └── config/              # Shared eslint/tsconfig/prettier config
├── docs/                    # This documentation set
├── infra/                   # Terraform or deployment configs (see 08-INFRA)
├── turbo.json
├── package.json
└── README.md
```

- **Why a monorepo:** a Claude Code build agent working DIY benefits enormously
  from everything — API, web, mobile, shared types, infra config — living in
  one place it can navigate and cross-reference, rather than juggling multiple
  repos and keeping them in sync manually.
- `shared-types` is the single source of truth for data shapes; the API,
  web app, and mobile app all import from it instead of redefining types.

## 5. Environments [Default]

Three environments, all on GCP, isolated via separate GCP projects (not just
separate namespaces) to keep cost tracking, IAM, and blast radius clean:

- **dev** — for active development, may be reset/reseeded freely.
- **staging** — mirrors production config, used for pre-release verification.
- **production** — live environment.

Full provisioning steps and CI/CD pipeline are in `08-INFRA-DEPLOYMENT.md`.

## 6. API versioning [Default]

REST API is versioned from day one via URL prefix: `/api/v1/...`. This costs
nothing now and avoids breaking future third-party integrations when the API
evolves. Detail in `04-API-SPEC.md`.

## 7. Open items from this document

Tracked in full in `10-OPEN-DECISIONS.md`; summarized here:
- Backend framework: NestJS (TypeScript) vs. FastAPI (Python) — Default is
  NestJS; confirm before build starts if there's a team preference.

## 8. Next document

Proceed to `02-DATA-MODEL.md` for entities, relationships, the ERD, and the
custom-fields design.
