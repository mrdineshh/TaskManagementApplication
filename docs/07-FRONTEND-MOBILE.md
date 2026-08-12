# 07 — Frontend (Mobile)

Read docs `00`–`06` first, especially `06-FRONTEND-WEB.md` §5 — the
authorization rule there (backend-only enforcement) applies identically here
and is not repeated in full; see §5 of this document for the mobile-specific
restatement.

---

## 1. Stack recap **[Fixed, per `01-ARCHITECTURE.md` §2.6]**

- **Framework:** React Native, TypeScript, single codebase for iOS + Android.
- **Tooling [Default]:** Expo (managed/EAS build workflow) over bare React
  Native — Expo significantly reduces native-build complexity (no need to
  maintain Xcode/Android Studio project files by hand) and EAS Build/Submit
  handles app store packaging and OTA updates, which matters for an internal
  tool with a small team maintaining it. Bare React Native is the fallback if
  a specific native module ends up requiring it (unlikely for this app's
  feature set — no camera/AR/heavy native SDK requirements identified so far).
- **Navigation:** React Navigation (stack + bottom tabs).
- **Server state:** TanStack Query — same library as web, same query keys and
  patterns where reasonable, for consistency and shared mental model across
  platforms.
- **Local/UI state:** React state + Zustand, same as web.
- **Forms:** React Hook Form + Zod — same validation schemas shared from
  `packages/shared-types`, per `01-ARCHITECTURE.md` §4.
- **Push notifications:** Firebase Cloud Messaging via Expo's notification
  APIs (v1.1, per `05-FEATURES.md` §2.6).
- **Secure token storage:** `expo-secure-store` (wraps iOS Keychain / Android
  Keystore) for refresh tokens — never AsyncStorage for anything auth-related.

## 2. What's shared with web vs. mobile-specific **[Default]**

**Shared (via monorepo packages, `01-ARCHITECTURE.md` §4):**
- `shared-types` — all TypeScript types/DTOs/Zod schemas.
- `api-client` — the typed API client (same request/response handling,
  auth-header injection, token refresh logic). Both platforms call the same
  functions, e.g. `tasksApi.list(filters)`.
- Business logic that isn't rendering — validation rules, permission-check
  helpers (cosmetic use only, §5), date/formatting utilities.

**Not shared (platform-specific by necessity):**
- All actual UI components — React Native's primitives (`View`, `Text`,
  `Pressable`, etc.) aren't DOM elements, so web's Radix/Tailwind components
  can't be reused directly. Shared **design tokens** (colors, spacing,
  typography scale) live in `packages/ui` and both platforms consume the same
  token values, styled through platform-appropriate means (Tailwind on web
  via NativeWind is an option worth considering to unify the styling
  *syntax*, if not the components themselves — flagged as a build-time choice
  for the agent, not a hard requirement).
- Navigation structure (React Navigation vs. React Router).
- Anything touching native device capability (camera for attachments, push
  notification permission prompts, biometric app-lock if added later).

## 3. App structure **[Default]**

```
apps/mobile/src/
├── app/                     # Navigation container, root providers
├── screens/                  # One per navigable screen, mirrors web's pages/ conceptually
│   ├── auth/
│   ├── tasks/
│   ├── dashboard/
│   ├── reports/               # v1.2
│   └── admin/                  # see §4 — likely reduced scope on mobile
├── features/                   # Same feature-sliced pattern as web
│   ├── tasks/
│   ├── auth/
│   └── notifications/
├── components/                  # Mobile-specific shared UI components
├── lib/
│   ├── auth/                    # secure token storage, refresh logic
│   └── permissions/               # cosmetic-only gating helpers, mirrors web
├── hooks/
└── App.tsx
```

## 4. Scope differences from web **[Fixed — confirmed]**

Full admin configuration (role editor, workflow builder, custom field editor
— `06-FRONTEND-WEB.md` §6) is complex, desk-oriented configuration work.
**Recommendation: v1 mobile scope excludes the admin area entirely**,
deep-linking or directing admins to the web app for those flows, and mobile
focuses on the day-to-day task-management flows individual contributors and
managers need on the go:
- View/update assigned tasks, change status (within allowed transitions),
  comment, attach files (including camera capture for attachments — a
  genuinely mobile-native advantage over web here)
- Personal dashboard
- Team dashboard (view-only depth is fine; manager task assignment/editing
  should still work, just not full admin config)
- Push notifications
- Basic report viewing (v1.2) — not the report *builder*, which is
  desk-oriented like admin config

This is confirmed as v1 scope — full admin config *could* technically be
built for mobile, but it's a poor fit for the device and not worth the build
time versus directing admins to web.

## 5. Permissions & authorization **[Fixed — identical rule to web, restated for this platform]**

Exactly as in `06-FRONTEND-WEB.md` §5 and `03-RBAC-AUTH.md` §2.3: **the mobile
app performs no authorization of its own.** `GET /api/v1/me`'s permission set
is used only to hide actions/screens the user can't use, so they aren't shown
something that will fail with a 403. The backend Guard layer is the sole
enforcement point, with no exception for the mobile client — a modified or
tampered mobile client (APK reverse-engineered, jailbroken device, etc.) must
be no more capable of unauthorized action than what the API itself allows.
Nothing about being a "trusted first-party app" changes this; the API treats
every client, first- or third-party, identically for authorization purposes.

## 6. Offline behavior **[Fixed — confirmed]**

No offline support in v1. The mobile app requires connectivity — it does not
cache tasks for offline viewing, nor queue status changes/comments made while
disconnected. Clear, explicit error/empty states are shown when the device is
offline (rather than a silent failure or stale data with no indication).

This may be revisited in a later phase if field usage (FSRs/ISRs) shows a
real need, but it's out of scope for v1 by design, not by oversight — offline
sync carries real architectural cost (local persistence, conflict
resolution) that isn't justified until there's evidence it's needed.

## 7. App store considerations **[Fixed — confirmed: internal distribution]**

- Internal distribution question: does this ship via the public App
  Store/Play Store (even if just "unlisted"), or via enterprise/internal
  distribution (Apple Business Manager / Google Play's internal testing
  track)? For an internal-only tool, internal distribution avoids public App
  Store review cycles for every release. **Confirmed: internal distribution**
  via EAS Build + Apple Business Manager / Play internal track — this affects
  Apple/Google developer account setup work in `08-INFRA-DEPLOYMENT.md`.

## 8. Open items from this document

Tracked in `10-OPEN-DECISIONS.md`:
- None remaining — admin scope (§4), authorization model (§5), offline
  support (§6), and app distribution (§7) are all confirmed.

## 9. Next document

Proceed to `08-INFRA-DEPLOYMENT.md` for GCP setup, CI/CD, environments, and
cost estimates.
