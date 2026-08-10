# Task Management Application

A single-organization task management platform for econz.net — web + mobile clients on one
REST API, replacing spreadsheets/chat for cross-department task assignment and tracking.

Full specification: [`docs/`](./docs) (start at `docs/00-OVERVIEW.md`).

## Stack

- **API:** NestJS + TypeScript + Prisma + PostgreSQL — `apps/api`
- **Web:** Vite + React + TypeScript + Tailwind — `apps/web`
- **Mobile:** Expo (React Native) + TypeScript — `apps/mobile`
- **Shared:** `packages/shared-types` (types/Zod schemas), `packages/api-client` (typed API client used by both web and mobile)
- **Infra:** Terraform for GCP — `infra/` (not yet applied; see `infra/README.md`)

## Local development

Requires Node 22+, PostgreSQL 16, and npm workspaces.

```bash
npm install

# Database (local Postgres — see apps/api/docker-compose.yml for a Docker alternative)
cd apps/api
cp .env.example .env
npx prisma migrate dev
npx prisma db seed

# Terminal 1 — API
npm run dev            # from apps/api, or `npm run dev --workspace=@taskapp/api` from root

# Terminal 2 — Web
npm run dev --workspace=@taskapp/web
```

Sign in locally via the "dev sign-in (mock)" field on the login page with any seeded email
(e.g. `admin@econz.net`) — this exercises the exact same auth flow real Google Sign-In will
use once Firebase/GCP OAuth credentials are provided (see `apps/api/src/auth/providers/`).

Seeded accounts: `admin@econz.net` (Admin), `manager.dev@econz.net` (Manager), `employee.dev@econz.net` / `employee.sales@econz.net` (Employee).

## Mobile

```bash
cd apps/mobile
npm run start   # Expo dev server — scan with Expo Go, or run --ios / --android
```

## Status

Phase v1 (core platform) is built: auth, RBAC, departments/users, admin-configurable
workflows/priorities/custom fields, task CRUD with subtasks/comments/attachments/activity
log, in-app + mocked email notifications, basic dashboards, and the full admin UI. Terraform
is written but not applied — no GCP project exists yet. See `docs/10-OPEN-DECISIONS.md` for
open items and `docs/00-OVERVIEW.md` §6 for the v1.1/v1.2 roadmap.
