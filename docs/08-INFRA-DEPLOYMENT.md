# 08 — Infrastructure & Deployment

Read docs `00`–`07` first. This document covers GCP provisioning, CI/CD,
environment setup, secrets, monitoring, and cost estimates — everything
needed to take the application from code to a running, deployed system.

---

## 1. GCP project structure **[Fixed, per `01-ARCHITECTURE.md` §5]**

Three separate GCP projects, not just namespaces within one project:

| Project | Purpose |
|---|---|
| `<org>-taskapp-dev` | Active development, freely resettable data |
| `<org>-taskapp-staging` | Pre-release verification, mirrors prod config |
| `<org>-taskapp-prod` | Live environment |

**Why separate projects, not one project with environments as labels:**
clean IAM boundaries (who can touch prod vs. dev), clean cost attribution per
environment, and it makes it structurally impossible for a dev-environment
mistake (e.g. a bad migration script) to touch production data.

## 2. Core GCP services per environment **[Fixed]**

| Service | Purpose | Notes |
|---|---|---|
| **Cloud Run** | Hosts the NestJS API | Scale-to-zero in dev/staging; min instances = 1 in prod to avoid cold-start latency for users (see cost note §6) |
| **Cloud SQL (PostgreSQL)** | Primary database | Smallest viable tier to start (§6); automated daily backups + point-in-time recovery enabled in staging/prod |
| **Cloud Storage** | Attachments, report exports | One bucket per environment, lifecycle rules to move old report exports to cheaper storage class after N days |
| **Cloud Scheduler + Cloud Tasks** | SLA checks, recurring task generation, report aggregation refresh, scheduled report emails | Replaces Redis/queue infra per the cost-conscious decision in `01-ARCHITECTURE.md` §2.3 |
| **Secret Manager** | Bootstrap-only secrets: DB connection credentials, JWT signing key, Firebase/Google OAuth client secret | Never committed to source; injected into Cloud Run as env vars at deploy time. **Narrower scope than a typical setup**: operational settings like SMTP config are deliberately *not* here — see `01-ARCHITECTURE.md` §2.9a — they're Admin-UI-configurable and encrypted via Cloud KMS in the database instead, so Admins can change them without a redeploy |
| **Cloud KMS** | Encryption key for Admin-UI-configured secrets (e.g. SMTP password) stored in Cloud SQL | Application service account has decrypt permission; no human or console access to plaintext values |
| **Artifact Registry** | Docker image storage for the API | Built by Cloud Build |
| **Cloud Build** | CI/CD pipeline execution | Triggered by pushes/PRs, see §4 |
| **Cloud Logging / Monitoring** | Centralized logs, uptime checks, alerting | Free tier covers this app's expected volume comfortably |
| **Firebase Auth** | Google Sign-In identity layer (per `03-RBAC-AUTH.md` §1.1, if this Default is confirmed) | Free at this scale |
| **Firebase Cloud Messaging** | Mobile push (v1.1) | Free |
| **Cloud DNS** (optional) | If domain is managed through GCP rather than existing registrar | See §7 |

## 3. Networking **[Default]**

- Cloud Run services are deployed with **direct public HTTPS ingress**
  (Cloud Run provides this by default) — no need for a load balancer or VPC
  for an API of this scale, which would add cost without benefit.
- Cloud SQL connects via the **Cloud SQL Auth Proxy / Cloud SQL connector**
  from Cloud Run — no public IP on the database, no VPC peering complexity
  required for this setup.
- If a custom domain is used (recommended — see §7), Cloud Run's built-in
  domain mapping handles TLS certificate provisioning automatically.

## 4. CI/CD pipeline **[Default]**

**Source control:** **GitHub** (confirmed).

**Pipeline stages (Cloud Build, triggered on push):**

```
1. On PR open/update → dev project:
   - Install deps, lint, typecheck, unit tests
   - Build Docker image (API), build web app
   - Deploy PR preview (Cloud Run revision with a unique URL) — optional but
     valuable for reviewing changes before merge

2. On merge to `main` → dev project:
   - Full test suite (unit + integration)
   - Build & push Docker image to Artifact Registry
   - Run DB migrations against dev Cloud SQL
   - Deploy API to Cloud Run (dev)
   - Deploy web app (static build → Cloud Storage + Cloud CDN, or Cloud Run
     serving the static build — see §5)
   - Mobile: build via EAS (not Cloud Build) — see §8

3. On tag/release → staging, then prod (manual approval gate before prod):
   - Same build artifact promoted (not rebuilt) from dev → staging → prod,
     so what's tested in staging is bit-for-bit what ships to prod
   - DB migrations run as a distinct, reviewable step before traffic shifts
   - Prod deploy uses Cloud Run's traffic-splitting for a gradual rollout
     (e.g. 10% → 100%) with automatic rollback if error rates spike
```

- **Why promote-not-rebuild:** rebuilding at each environment risks
  environment-specific build differences causing prod issues that never
  showed up in staging. One image, promoted through registries/environments,
  removes that class of bug.

## 5. Web app hosting **[Default]**

Since the web app is a pure SPA (no SSR, per `01-ARCHITECTURE.md` §2.5), two
viable options:
- **Cloud Storage + Cloud CDN**: cheapest option — static files served
  directly from a bucket, CDN-cached globally. No server compute cost at all.
  **Recommended default** given the cost-conscious requirement.
- **Cloud Run serving the static build**: simpler to keep consistent with the
  API's deployment pattern, marginal cost given scale-to-zero, but strictly
  unnecessary for a static SPA.

**Default: Cloud Storage + Cloud CDN.** Flagged as a Default rather than Fixed
since either works fine; this is the cheaper of two reasonable options.

## 6. Cost estimate **[Default — rough figures, GCP pricing changes over time]**

Given low-to-medium internal usage (an organization's staff, not
public-internet scale), rough **monthly** estimates at prod scale (dev/staging
cost less, given scale-to-zero and lighter use):

| Service | Estimated monthly cost | Notes |
|---|---|---|
| Cloud Run (API) | $10–40 | Depends on min-instance setting; scale-to-zero in dev/staging is ~$0 when idle |
| Cloud SQL (Postgres, smallest tier) | $10–30 | Single instance, no HA replica initially; add HA (~2x cost) only if uptime requirements justify it |
| Cloud Storage | $1–10 | Attachments + exports; pay-per-GB, very low at this scale |
| Cloud Scheduler/Tasks | ~$0–5 | Generous free tier |
| Secret Manager | ~$1 | Per-secret, negligible |
| Cloud Build | ~$0–10 | Free tier covers most CI usage at this team size |
| Firebase Auth/FCM | $0 | Free at this scale |
| Cloud CDN (web hosting) | $1–10 | Low-traffic internal tool |
| Email provider (transactional) | $0 | Confirmed: Google SMTP (Google Workspace's SMTP relay) — no separate signup/subscription; uses your existing Workspace account, subject to Google's sending limits at that tier |
| **Estimated total** | **~$25–120/month** | Wide range because it depends heavily on final headcount/usage; **the point of this table is to confirm the architecture is cheap by design, not to be a binding quote** |

**Cost-control practices baked into the architecture already:**
- Scale-to-zero everywhere possible (Cloud Run, no idle Redis/queue infra).
- No managed BI tool subscription (in-app reporting).
- No SSR hosting overhead (static SPA).
- Deferred Memorystore/Redis until real load justifies it.
- Smallest viable Cloud SQL tier to start, scaled based on real metrics, not
  provisioned for hypothetical peak up front.

## 7. Domain & DNS **[Fixed — confirmed]**

Launch on GCP/Firebase's auto-generated URLs (`*.run.app` for the API,
`*.web.app` / the Cloud Storage+CDN default URL for the web app — see §5). No
custom domain mapping at launch. A custom domain can be added later via Cloud
Run domain mapping and updating Firebase Auth's authorized domains list —
this is a low-effort addition when a domain is chosen, not a blocker for
launch.

## 8. Mobile build & release **[Fixed — per `07-FRONTEND-MOBILE.md`]**

- **EAS Build** (Expo Application Services) builds iOS and Android binaries —
  separate from the Cloud Build pipeline, since mobile builds require Apple/
  Google-specific toolchains EAS manages on your behalf.
- **Internal distribution** (confirmed in `07-FRONTEND-MOBILE.md` §7):
  - iOS: Apple Business Manager / Apple Developer Enterprise Program, or
    TestFlight for a smaller pilot group if a full enterprise account isn't
    set up yet.
  - Android: Google Play Console's internal testing track, or direct APK
    distribution via a private link/MDM if preferred.
- **Accounts needed from you** (see §9) before this can be executed: an Apple
  Developer account (individual or organizational) and a Google Play
  Console account.

## 9. Accounts & credentials the build agent cannot self-provision **[Open — action needed from you]**

A DIY build agent can provision GCP infrastructure programmatically (via
`gcloud`/Terraform, given appropriate credentials), but the following require
a human with account/billing authority and cannot be created by the build
agent on its own:

- **GCP billing account** linked to the three projects (§1) — needed before
  any resource provisioning.
- **Google OAuth client** (for Sign-In with Google, `03-RBAC-AUTH.md` §1.1) —
  created in Google Cloud Console / Firebase console, requires org
  verification for production use.
- **Apple Developer account** and **Google Play Console account** (§8).
- **Domain registrar access** (§7), if a custom domain is used.
- **GitHub organization/repo access** with permission to configure Cloud
  Build triggers.

Note: a Google SMTP-relay email provider was confirmed instead of a
third-party transactional email service, so no separate email-provider
signup is needed — Google Workspace SMTP credentials are what's required
here, entered via the Admin UI at runtime (§2.9a of `01-ARCHITECTURE.md`),
not provisioned as infrastructure.

**Recommended process:** the build agent should provision everything it can
via infrastructure-as-code (Terraform, suggested in `01-ARCHITECTURE.md` §4's
`infra/` folder), and clearly enumerate the remaining manual steps (with exact
console screens/actions) as a setup checklist for you to complete once, rather
than blocking silently on any one of them.

## 10. Infrastructure as code **[Default — see dedicated document]**

**Terraform** is used for all GCP resource provisioning, chosen over manual
console setup or shell scripts because it's declarative, versioned alongside
the app code, and provisions dev/staging/prod consistently — avoiding
config-drift between environments, a common source of "works in staging,
breaks in prod" bugs.

Per your request, the Terraform setup is documented as its own file rather
than folded into this one, so the team can pick it up and modify it
independently of the broader infra narrative here — see
`09-TERRAFORM-IAC.md` for module structure, state management, variables, and
how to apply changes per environment.

## 11. Monitoring & alerting **[Default]**

- **Uptime checks** on the API's health endpoint and the web app.
- **Error rate / latency alerts** on the Cloud Run service via Cloud
  Monitoring, notifying via email (and Slack, if/when that integration
  exists per `05-FEATURES.md` §2.6) on threshold breach.
- **SLA/escalation job failure alerts** — since these scheduled jobs are
  operationally important (per `05-FEATURES.md` §2.2), a failed run should
  itself trigger an alert, not fail silently.

## 12. Open items from this document

Tracked in `10-OPEN-DECISIONS.md`:
- Timeline for obtaining the manual accounts listed in §9 — you've indicated
  these are ready and will be provided to Claude Code on request when it
  reaches that step, so this is noted as "on-demand," not blocking.

## 13. Next document

Proceed to `09-TERRAFORM-IAC.md` for the Terraform module structure and how
the team applies infrastructure changes per environment.
