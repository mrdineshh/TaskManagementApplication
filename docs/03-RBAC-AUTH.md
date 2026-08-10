# 03 — RBAC & Authentication

Read `00-OVERVIEW.md`, `01-ARCHITECTURE.md`, and `02-DATA-MODEL.md` first. This
document defines how authentication and authorization work end to end.

---

## 1. Authentication

### 1.1 v1: Sign in with Google **[Fixed]**

- OAuth 2.0 / OpenID Connect flow against Google as the identity provider.
- **Implementation: Firebase Authentication** confirmed as the integration
  layer (per `01-ARCHITECTURE.md` §2.7) — handles token refresh, verification,
  and provides client SDKs for both web and React Native, at negligible cost
  at this scale.
- Flow: user signs in with Google on web/mobile → identity provider returns a
  verified identity token → backend verifies the token, looks up or creates a
  `User` record matched on email → backend issues its own **application JWT**
  (see §1.3) → client uses that JWT for all subsequent API calls.
- **Domain restriction: confirmed.** Sign-in is restricted to
  **`@econz.net`** — any Google account outside that domain is rejected at
  the token-verification step, before a `User` record is ever created.

### 1.2 Pluggable SSO abstraction **[Fixed — required architectural pattern]**

Because your internal SSO is being built separately and will be integrated
later, the backend must not hardcode Google as the sole identity source.

**Required pattern:**

```
interface AuthProvider {
  name: string;                       // "google", "internal-sso", etc.
  verifyToken(rawToken: string): Promise<VerifiedIdentity>;
  // VerifiedIdentity = { email, externalId, name, ... }
}
```

- Each identity source (Google, and later the internal SSO — likely
  OIDC or SAML based) implements this interface.
- The `User.auth_provider` + `User.auth_provider_id` fields (§2.3 of
  `02-DATA-MODEL.md`) record which provider authenticated a given user,
  supporting multiple providers being active simultaneously during a
  transition period.
- A config value (env var / org settings) determines which provider(s) are
  enabled at any time. Adding the internal SSO later means: implement the
  interface, register it, flip the config — **not** a rewrite of auth logic
  elsewhere in the app.
- **When the internal SSO is ready, per your stated plan, Google Sign-In can
  eventually be disabled entirely** — the abstraction supports removing a
  provider as cleanly as adding one.

### 1.3 Session strategy **[Default]**

- **Stateless JWT** issued by the backend after successful auth (short-lived
  access token, e.g. 15–60 min, + longer-lived refresh token).
- Chosen because it fits the Cloud Run deployment model (§3 of
  `01-ARCHITECTURE.md`) — no server-side session store required, so the API
  stays horizontally scalable and cheap to run at low, spiky internal-tool
  traffic.
- Refresh tokens stored securely (httpOnly cookie on web; secure storage /
  Keychain-Keystore on mobile via a library like `react-native-keychain`).
- Token payload includes `user_id` and a permissions cache (§2.4) to avoid a
  DB round-trip on every request; permissions are refreshed on token refresh
  or role change (see §2.5 for cache invalidation).

## 2. Authorization (RBAC)

### 2.1 Model **[Fixed — custom, fine-grained RBAC per your requirement]**

Three-tier model, backed by the tables in `02-DATA-MODEL.md` §2.4:

```
User ──has many──▶ Role ──has many──▶ Permission
```

- **Permission** = a single fine-grained capability, expressed as a string key
  in the form `resource.action`. The exact set is defined by the codebase
  (each key maps to a real guarded action), and grows as features ship. As of
  this documentation set, the full v1/v1.1/v1.2 key set referenced across
  `04-API-SPEC.md` includes:
  - `task.create`, `task.view`, `task.edit`, `task.delete`, `task.assign`,
    `task.comment`, `task.moderate` (delete/edit others' comments)
  - `department.view`, `department.manage`
  - `user.view`, `user.manage`
  - `role.manage`
  - `custom_field.view`, `custom_field.manage`
  - `workflow.view`, `workflow.manage`
  - `priority.view`, `priority.manage`
  - `integration_settings.manage`
  - `report.view`, `report.create`, `report.export`, `report.manage`
  - `approval.approve` (v1.1)
  This list is illustrative, not exhaustive — treat `04-API-SPEC.md`'s
  per-endpoint permission column as the definitive source, and this list as
  a convenient summary kept in sync with it.
- **Role** = a named, configurable bundle of permissions (e.g. "Sales
  Manager", "Support Agent", "Admin"). Roles are **not hardcoded** — Admins
  can create new roles and adjust permission bundles through the product.
  A small set of **system roles** (`is_system_role = true`, per the data
  model) are protected from deletion to guarantee the system always has at
  least one Admin-equivalent role: **Admin**, **Manager**, **Employee** are
  seeded as system roles at launch; everything beyond that is configurable.
- **Scoping:** a Role can be **org-wide** (`department_id IS NULL`, e.g.
  Admin) or **department-scoped** (e.g. "Sales Manager" only grants those
  permissions within the Sales department's data). Department scoping is
  enforced at the query layer — department-scoped roles are automatically
  filtered to `task.department_id IN (user's assigned departments)`.

### 2.2 Baseline seeded roles **[Default — starting point, fully editable]**

| Role | Scope | Summary |
|---|---|---|
| Admin | Org-wide | Full access: users, roles, departments, custom fields, all tasks/reports |
| Manager | Department-scoped | Assign/edit/monitor tasks within their department(s); view department reports; approve (v1.1) |
| Employee | Department-scoped | View/update tasks assigned to them; comment; log time (v1.1); no assignment/report-admin rights |

This is a **starting point, not a limit.** Per your requirement, Admins must
be able to create, edit, and delete roles — and assemble any combination of
permissions into them — entirely through the product, at any time, without
engineering involvement. The three seeded roles above exist only so the
system is usable on day one (someone needs Admin access to start configuring
anything). Beyond that seed:

- Admins can create new roles (e.g. "FSR", "ISR", "Finance Approver", "Pre-sales
  Lead") freely, org-wide or department-scoped.
- Admins can edit any non-system role's permission bundle at any time; changes
  take effect per the cache-invalidation behavior in §2.4.
- **Only `Admin` is a protected system role** (`is_system_role = true`) — it
  cannot be deleted or stripped of the `role.manage`/`user.manage`
  permissions, to guarantee the org can never accidentally lock itself out of
  its own configuration. `Manager` and `Employee` are seeded as convenient
  starting points but are ordinary, fully editable/deletable roles like any
  other — not specially protected.
- New `Permission` keys (§2.1) are added as new features ship (e.g.
  `approval.approve` lands with v1.1); Admins then decide which roles get
  them. Permissions themselves are defined by the codebase (they map to real
  guarded actions), but which roles hold which permissions is 100% Admin
  configuration.

### 2.3 Enforcement pattern **[Fixed]**

- Every API endpoint declares its required permission(s) via a NestJS **Guard**
  (per `01-ARCHITECTURE.md` §2.1), e.g. `@RequirePermission('task.assign')`.
- Guards check: (1) does the user have this permission via any assigned role,
  and (2) if the role is department-scoped, does the target resource belong
  to a department the user has that role in.
- This keeps permission logic declarative and centrally testable rather than
  scattered through business logic.
- **This is the single, exclusive enforcement point.** No client (web,
  mobile, or third-party integration) is ever trusted to self-enforce
  permissions. Every request is authorized here, on the server, regardless of
  what the calling client displayed, hid, or assumed. Client-side permission
  checks (see `06-FRONTEND-WEB.md` §5 and `07-FRONTEND-MOBILE.md`) exist only
  to shape the UI so users aren't shown actions they'll be denied — they carry
  no security weight and must never be relied upon as one.
- **Workflow transitions are a special case worth calling out:** moving a task
  from one status to another (`02-DATA-MODEL.md` §2.5a) can itself require a
  specific permission (`WorkflowTransition.required_permission`), set by the
  Admin per transition, per workflow. This is how "only a Finance Approver can
  move a task to Approved" gets enforced — it's config (a value on a
  `WorkflowTransition` row Admins edit), not a special code path per
  department.

### 2.4 Permission caching **[Default]**

- A user's effective permission set is computed once per login/token-refresh
  and embedded in the JWT (or cached server-side keyed by user id, whichever
  proves simpler at build time) to avoid recomputing role→permission joins on
  every request.
- **Invalidation:** any role/permission change triggers invalidation of
  affected users' cached permissions (force a token refresh or cache bust) —
  changes should take effect within one refresh cycle (≤ the access token
  TTL), not require a full re-login.

### 2.5 Field/data-level visibility **[Default]**

Beyond endpoint-level permissions, two visibility rules apply consistently
across the API:
- A department-scoped role only ever sees tasks/reports within its
  department(s) — enforced at the query layer, not just hidden in the UI.
- Custom field visibility (§4 of `02-DATA-MODEL.md`) can optionally be
  restricted per field to specific roles (e.g. `deal_value` visible only to
  Sales roles + Management) — this is a **nice-to-have flag on
  `CustomFieldDefinition`**, not required for v1 launch, but the schema (an
  optional `visible_to_role_ids` array) should be left easy to add without a
  migration headache. Flagged as v1.1-or-later scope.

## 3. Auth-related API surface (preview — full spec in `04-API-SPEC.md`)

- `POST /api/v1/auth/google` — exchange a Google identity token for an app JWT.
- `POST /api/v1/auth/refresh` — refresh an access token.
- `POST /api/v1/auth/logout` — revoke refresh token.
- `GET /api/v1/me` — current user profile + effective permissions.
- Once SSO is added: `POST /api/v1/auth/sso/:provider` following the same
  `AuthProvider` abstraction (§1.2).

## 4. Security notes **[Default]**

- All endpoints require authentication except the auth endpoints themselves.
- Rate limiting on auth endpoints (via Cloud Run + a lightweight
  in-app limiter, e.g. `@nestjs/throttler`) to reduce brute-force/abuse risk,
  without needing Redis in v1 (in-memory limiting is acceptable at this scale
  and traffic profile; revisit if horizontal scaling makes in-memory limits
  unreliable).
- Secrets (JWT signing key, Google OAuth client secret, future SSO certs)
  stored in **GCP Secret Manager**, never in source control or plain env
  files committed to the repo. Detailed in `08-INFRA-DEPLOYMENT.md`.

## 5. Open items from this document

Tracked in `10-OPEN-DECISIONS.md`:
- Whether additional department-specific roles (FSR, ISR, Finance Approver,
  etc.) should be pre-seeded at launch as a convenience, given they're fully
  creatable via the Admin UI regardless (low-stakes either way).
- Timeline/requirements for the internal SSO integration, once specs for that
  system are available, so the `AuthProvider` implementation can be scoped.

## 6. Next document

Proceed to `04-API-SPEC.md` for REST endpoint conventions and the full v1
endpoint list.
