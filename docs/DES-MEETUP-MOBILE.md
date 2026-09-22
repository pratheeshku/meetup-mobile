# DES-MEETUP-MOBILE — Meetup Android Mobile App: Solution Design

**Doc ID**: DES-MEETUP-MOBILE
**Status**: APPROVED — architect-approved 2026-09-13; Create-flow
amendment (§4.3/§4.5) architect-approved 2026-09-22
**Tier**: T1
**Requirements Baseline**: REQ-MEETUP-MOBILE — reconciled, single canonical file (APPROVED, architect-approved 2026-09-13; R-005 corrected 2026-09-13)
**Parent Backend Design**: DES-MEETUP.md (DES-MEETUP-001), v1.66, APPROVED
**Governing Files**: Enterprise_Design_Principles_v1.0.md (P1–P17), design-best-practices.md (BP-01–BP-13) — both confirmed in context at drafting time.

**Review history**: Eight external adversarial review rounds completed
against prior versions of this document, closing real gaps across
cache-at-rest deviation documentation (P16), QR check-in risk severity,
CI security gating (SAST/secrets detection), third-party PII reasoning,
OAuth fail-closed feasibility (researched and verified, not asserted),
a genuine internal self-contradiction on Facebook's sign-in status
(caught and corrected), and a temporary divergence between two
independently-edited REQ-MEETUP-MOBILE.md files (reconciled into one
canonical source before this version was produced). This version
reconciled the design against the corrected, single, canonical
REQ-MEETUP-MOBILE.md — closing OI-7 (QR check-in actor-role model),
OI-10 (Facebook OAuth deferral), OI-8 (R-005 wording, corrected by the
architect to name its own exceptions), OI-5, and OI-9.

**Architect sign-offs recorded**: the P16 cache-at-rest deviation
(§3.13) and the R-077 partial-satisfaction deviation (§5.2) are both
explicitly approved by the architect, with the P16 upgrade trigger
narrowed to the architect-supplied criterion (regulatory audit finding
or PII breach incident), which supersedes this document's earlier,
broader four-condition draft trigger.

**Provenance note on backend contract (BP-01 compliance statement)**:
The API endpoint table in §7 combines the original architect-supplied
extraction from DES-MEETUP.md §5.5 with the committee-governance and
admin sports/config endpoint paths verified directly against the
running backend codebase (`tournaments/router.py`,
`tournaments/committee_step_up.py`, `admin/router.py`,
`admin/config_router.py`). The write-back of these paths into
DES-MEETUP.md §5.5 itself remains a separate backend-documentation task
(OI-9, closed here as a non-blocking item with that task named
explicitly, not as a completed write-back).

---

## 1. Executive Summary

This document is the frontend-only Solution Design for the native Android
Meetup mobile app. It specifies **how** the app is built — navigation,
state management, API client behaviour, authentication flows, push
notification integration, QR check-in, offline/cache behaviour, deep
linking, role-based UI gating, and the build/release pipeline. It does
**not** redesign, extend, or reproduce the backend contract defined in
DES-MEETUP.md; every backend capability is referenced by endpoint and
section only.

**What is being built**: a React Native (bare workflow) Android
application, minimum API level 26, distributed via Google Play, that
consumes the existing Meetup backend. The only backend-side changes
supporting mobile launch are the two already-ratified, explicitly-named
amendments (mobile push token registration, R-029/R-030; self-service
account deletion, R-031) — per the corrected R-005, no undocumented or
additional backend change is required.

**Conformance status**: This design is reconciled against a single,
corrected REQ-MEETUP-MOBILE.md.
- **R-060/R-061** (QR check-in): the organiser displays the event's
  check-in code (via `GET /events/{id}/checkin-qr`); the participant
  scans it with their device camera; `POST /events/{id}/checkin`
  validates the submitted token server-side. This matches the verified
  backend schema (one `checkin_qr_token` per event, no per-participant
  token) and the corrected requirement wording exactly. **OI-7 closed.**
- **R-011** (Facebook OAuth): formally deferred from this release per
  REQ-MEETUP-MOBILE Non-Goal 9. No Facebook code path is built. Re-entry
  trigger: Google OAuth live and stable in production with no
  auth-related incidents for 30 days. **OI-10 closed.**
- **R-077** (stop push notifications before clearing local session
  data): satisfied on a best-effort basis; the client-enforced-only
  ordering mechanism cannot guarantee completion under crash or
  network-loss conditions (§5.2). **Architect-approved deviation,
  2026-09-13.** Accepted T1 residual risk.
- **R-005**: corrected by the architect to explicitly name its own
  exceptions (R-029, R-030, R-031) rather than asserting an absolute "no
  backend changes" claim contradicted by those same ratified amendments.
  **OI-8 closed** on this corrected basis.

**What is not being built**: an iOS app (R-004, explicitly deferred), any
backend logic, schema, or endpoint beyond the two named, ratified
exceptions (Non-Goal 2, corrected R-005), any offline write/sync
capability (Non-Goal 4 — offline is strictly read-only per R-101), or
Facebook sign-in in this release (Non-Goal 9).

**Key decisions** (elaborated in §3): React Query for server-state
management with a thin global store for session/device state only;
Keystore-backed encrypted token storage; FCM for push; no certificate
pinning at T1 (justified in §5); an architect-approved P16 deviation for
non-credential cached data (§3.13); a client-side Circuit Breaker tuned
against mobile-network false-positive risk (§3.3); correlation ID
generated client-side per logical action and propagated per P4/R-113;
Google sign-in via Android Credential Manager, verified to achieve
genuine fail-closed, browser-free completion; Facebook sign-in formally
deferred with a measurable re-entry trigger.

---

## 2. Scope & Constraints

### 2.1 In Scope

- Full native Android UI covering every REQ-MEETUP-MOBILE feature
  domain, all closed against a single, corrected requirements baseline.
- Google OAuth (fully in-app, verified fail-closed achievable via
  Credential Manager) and email/password authentication.
- QR check-in: organiser displays the event code; participant scans it
  with their camera; server validates.
- FCM-based push notification receipt for all 12 confirmed notification
  types (§5.17), including tap-through deep linking.
- Read-only offline caching of most-recently-viewed event/tournament/group
  data, under an architect-approved P16 deviation (§3.13).
- Deep link handling for shared links and notification taps.
- Self-service account deletion (R-124).
- Organising Committee maker-checker governance actions and step-up
  challenge flow (§4.6).
- Admin sports CRUD and platform config/UI label management (§4.9).
- GitHub Actions CI/CD producing signed, reproducible release builds
  (R-007), including SAST/dependency/secrets-detection gates and a
  verified secrets-injection path for Firebase/OAuth config (§8.5,
  §3.11).

### 2.2 Out of Scope

- iOS (R-004 / Non-Goal 1).
- Any backend API, schema, or access-control change beyond the two
  named, ratified exceptions (Non-Goal 2, corrected R-005: R-029/R-030
  mobile push endpoints, R-031 self-deletion endpoints — both already
  designed in DES-MEETUP.md and explicitly named in REQ-MEETUP-MOBILE,
  not undocumented dependencies).
- Offline write/queue/sync (Non-Goal 4).
- A dual web-push/mobile-push fallback channel (Non-Goal 5).
- **Facebook sign-in (R-011) — deferred per Non-Goal 9.** Re-entry
  trigger: Google OAuth stable in production for 30 days with no
  auth-related incidents. A scheduled future scope item, not an open
  design question (§10, OI-10 CLOSED).
- Tablets, foldables, wearables (Non-Goal 8).
- A server-side fallback for mobile push de-registration-before-logout
  ordering — considered during external review and rejected as an
  out-of-scope backend redesign already declined at the DES-MEETUP.md
  layer; the resulting partial R-077 satisfaction is an
  architect-approved deviation (§5.2), not an open question.
- A participant-scoped check-in token — the architect's resolution was
  to correct the requirement wording to match the existing event-scoped
  backend design (§3.7), not to change the backend schema.
- Writing the committee-governance and admin sports/config endpoint
  paths back into DES-MEETUP.md §5.5 — named as a separate backend
  -documentation task (§10, OI-9 CLOSED as non-blocking), not performed
  by this document.

### 2.3 Constraints Inherited From Backend

- All authorisation is server-authoritative; the app is UX gating only
  (R-017, R-082, R-110).
- The backend's rate-limiting posture (slowapi, 100 req/min per
  authenticated user, DES-MEETUP.md §6) governs the mobile client
  identically to the web client.
- Refresh token rotation and revocation semantics (DES-MEETUP.md §6) are
  consumed as-is.
- Notification type catalogue (12 values, §5.17) is fixed by the backend.
- Organising Committee actions operate against `tournament_approval_requests`
  (DES-MEETUP.md §4.12, §5.21), distinct from platform-admin
  `admin_approval_requests`/`/admin/approvals/*`.
- Admin sports and platform config/UI label management operate against
  distinct endpoint families from platform-admin dual-approval.
- The committee-governance and admin sports/config endpoint paths (§7.8,
  §7.10) are verified directly against the running backend codebase;
  their formal write-back into DES-MEETUP.md §5.5 is a separate,
  non-blocking backend-documentation task (OI-9).
- The check-in validation endpoint `POST /events/{id}/checkin` and its
  full six-step authorization sequence are independently verified
  directly against DES-MEETUP.md §5.5 and §5.8 — authenticated caller,
  `going` RSVP status required, event must be `active`, submission must
  fall within a configured time window, submitted token must exactly
  match `events.checkin_qr_token`, and the resulting insert is
  idempotent (`ON CONFLICT DO NOTHING`). DES-MEETUP.md's own §5.8 text
  independently names the same screenshot-sharing risk this document
  tracks in §9, with an identical T1-acceptable rationale and T2 upgrade
  trigger — independent convergence corroborating this document's own
  risk assessment.

### 2.4 T1 Tier Posture

Per BP-12, complexity is justified only against concrete in-scope
threats at this volume:
- No client-side offline write queue.
- No certificate pinning (§5.3).
- No cache-at-rest encryption for non-credential server-state data
  (§3.13) — an architect-approved deviation.
- A client-side Circuit Breaker (§3.3) tuned specifically to avoid
  false-opening on ordinary mobile network flakiness. No Bulkhead
  pattern added.
- No client-side analytics/crash-reporting vendor lock-in beyond what's
  needed to satisfy R-111's exclusion list (§6).
- Facebook sign-in resolved via a time-boxed, criterion-gated deferral,
  adopted directly once the architect supplied it rather than forced
  into this document's own earlier, narrower framing.

---

## 3. Architecture Decisions

Each decision states: Decision, Rationale, Trade-offs, Alternatives
rejected, R-ID(s) served, and any deviation from governing files.

### 3.1 Navigation Architecture

**Decision**: React Navigation (native-stack + bottom-tabs), with a
single root stack gating on auth state (`Auth Stack` vs. `App Stack`),
and a nested deep-link-aware linking configuration mapping every
notification type and shared-link pattern to a concrete screen route.

**Rationale**: React Navigation is the de facto standard for React Native
bare workflow, has first-class deep-linking support required for R-091,
R-092, R-073, and integrates cleanly with a single top-level
authentication gate satisfying R-090 without duplicating navigation
logic per screen.

**Trade-offs accepted**: Native-stack requires each screen to be a
registered route with a stable name; mitigated by a single
source-of-truth route-name enum checked at build time.

**Alternatives rejected**: A custom router — unjustified complexity
(BP-12). Expo Router — contradicts the fixed "React Native bare workflow
(no Expo)" decision.

**R-ID(s) served**: R-001, R-073, R-090, R-091, R-092.

**Deviation**: None.

### 3.2 State Management

**Decision**: Two-layer state model — React Query for server-derived
state; a minimal global store (React Context + `useReducer`) for
session/device state only.

**Rationale**: React Query's built-in stale-while-revalidate, retry, and
cache-invalidation primitives directly implement R-100/R-101/R-102
without custom code.

**Trade-offs accepted**: Two state paradigms — accepted because forcing
either into the other's role is a worse fit.

**Alternatives rejected**: Redux Toolkit for everything — unjustified
complexity (BP-12). Zustand-only — would require hand-rolled cache
invalidation with cross-cutting correctness risk.

**R-ID(s) served**: R-100, R-101, R-102, R-016.

**Deviation**: None.

### 3.3 API Client Design

**Decision**: A single Axios instance with four composed interceptors:
(1) **auth header injection**; (2) **correlation ID injection** — one
UUIDv4 per logical user action (§3.12), not per HTTP call; (3)
**retry/backoff** — idempotent requests only, up to 3 retries,
exponential backoff plus jitter (base 500ms, factor 2, max 4s), on
network-layer failures and `5xx` only; (4) **Circuit Breaker (P7
compliance)** — per-endpoint-family consecutive-failure tracking: only
`5xx` responses and timeouts count toward the trip threshold; `4xx`
never counts. Check-in is isolated into its own failure-counting family.
Threshold: 8 consecutive qualifying failures within a rolling 60-second
window. On trip, calls fail fast for a 30-second cooldown before a
half-open probe.

**Rationale**: Centralising these four concerns guarantees R-113,
R-015/R-110, R-102, and P7 compliance hold universally. The Circuit
Breaker is a client-side-only, best-effort mechanism, not a substitute
for server-side circuit breaking.

**Trade-offs accepted**: The retry interceptor maintains a static
allowlist of retry-safe endpoints. Circuit Breaker family-scoping
requires deliberate maintenance as endpoints are added.

**Alternatives rejected**: Per-screen manual retry logic (BP-12).
Automatic retry on all HTTP methods (unsafe). A flat threshold counting
all status codes — rejected after review identified false-opening risk
on mobile networks. A Bulkhead pattern — no concurrent-resource
-contention profile exists to justify it (BP-12).

**R-ID(s) served**: R-015, R-102, R-110, R-113 (P4), P7.

**Deviation**: None.

### 3.4 Token Storage and Security Model (R-014)

**Decision**: Access token and refresh token stored using
`react-native-keychain`, backed by Android Keystore
(`ENCRYPTION_TYPE: AES`, hardware-backed where supported,
`ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Never written to
`AsyncStorage`, logs, or crash reports (§5.4). Access token additionally
held in-memory for the process lifetime, read from Keystore once at
cold start and on refresh; Keystore remains the sole persistent store.

**Rationale**: Directly satisfies R-014.

**Trade-offs accepted**: Devices without hardware-backed Keystore fall
back to software-backed AES — logged (non-PII flag) for fleet
-visibility.

**Alternatives rejected**: `AsyncStorage` (plaintext) — fails R-014
outright. Custom encryption atop `AsyncStorage` — reinvents Keystore
(BP-12).

**R-ID(s) served**: R-014.

**Deviation**: None.

### 3.5 Auth Flow (R-010, R-012)

**Decision**:
- **Google (R-010)**: implemented via the legacy GoogleSignin API of
  `@react-native-google-signin/google-signin` (v16.1.5). The design
  originally specified Android Credential Manager (`androidx.credentials`)
  via the Universal Sign-In API, but the free/public package uses the
  legacy Google Sign-In SDK on Android — Credential Manager is only
  available in a separate paid product (Universal Sign In). The legacy
  API fully satisfies R-010 (native picker, no browser, no WebView).
  Architect-ratified deviation — see Deviation entry below.
- **Facebook OAuth — deferred.** Facebook OAuth deferred. Re-entry
  trigger: Google OAuth live and stable in production with no
  auth-related incidents for 30 days. No Facebook button, SDK
  initialization, or `provider=facebook` code path is built or shipped
  in this release.
- **Email/password (R-012)**: in-app form calling `POST /auth/register`
  or `POST /auth/login` directly — no OAuth redirect possible by
  construction.
- Google and email/password both converge on the same post-auth
  sequence: store both tokens (§3.4), populate the session store,
  navigate to the App Stack (§3.1).
- **Sign-out (R-013)**: calls
  `DELETE /notifications/mobile-subscriptions/{deviceToken}` **first**
  (§5.2), then `POST /auth/logout`, then clears Keystore and in-memory
  session state.

**Rationale**: Google's Credential Manager path directly and fully
satisfies R-010/R-001 with verified platform behavior. The Facebook
deferral is the architect's resolution, adopted directly.

**Trade-offs accepted**: Google credential provisioning overhead is
inherent to native sign-in, gated by R-018 (Google-only). The sign-in
method set is two (Google, email/password) for the duration of the
deferral.

**Alternatives rejected**: In-app WebView-based OAuth — fails
R-010/R-012 by definition.

**R-ID(s) served**: R-010 (fully), R-012 (fully), R-013, R-016, R-017.

**Deviation**: Credential Manager not used. The free
`@react-native-google-signin` package uses the legacy Google Sign-In SDK.
The paid Universal Sign-In product would be required for Credential
Manager support. Architect-ratified 2026-09-13: legacy SDK fully
satisfies R-010 at zero additional cost. Named OI-12 below.

### 3.6 FCM Integration (R-070–R-077)

**Decision**: Firebase Cloud Messaging (fixed technology decision). On
successful sign-in and cold start with a valid session: (1) request the
FCM registration token; (2) request Android notification permission
(API 33+ runtime; API 26–32 none needed) with a rationale dialog first
(R-072); (3) on grant, register via `POST /notifications/mobile-subscriptions`
with `{ deviceToken, platform: "android", userAgent }`; (4) on FCM token
rotation (`onTokenRefresh`), silently re-register using the existing
session (R-075); (5) on sign-out, call
`DELETE /notifications/mobile-subscriptions/{deviceToken}` before
`POST /auth/logout` (§3.5).

**Notification handling**: Foreground messages via
`messaging().onMessage`, rendered through `notifee`. Background/killed
-state messages via FCM's native background handler. Tapping any
notification invokes the deep-link router (§3.1) mapped against the 12
confirmed types (§5.17) to a concrete screen route (R-073).

**Rationale**: FCM is a fixed technology decision; the lifecycle maps
directly onto the ratified backend contract's device-token model.

**Trade-offs accepted**: `notifee` is a third-party dependency beyond
Firebase's own SDK — accepted over hand-rolling a native
notification-channel wrapper (BP-12).

**Alternatives rejected**: Polling instead of push. A custom native
module instead of the official Firebase RN SDK.

**R-ID(s) served**: R-070, R-071, R-072, R-073, R-074, R-075, R-076,
R-077 (partially — see §5.2, architect-approved), R-029/R-030.

**Deviation**: None.

### 3.7 QR Display and Scan (R-060–R-064) — RECONCILED, OI-7 CLOSED

**Decision**:
- **Display (R-060)**: the **organiser** retrieves and displays the
  event's check-in code via `GET /events/{id}/checkin-qr`
  (organiser-only, verified), rendered from the `checkin_qr_token` field
  (event-scoped, `NOT NULL UNIQUE`, per DES-MEETUP.md §5.1) using
  `react-native-qrcode-svg`.
- **Scan (R-061, R-062)**: the **participant** scans the organiser's
  displayed code using their device camera, with camera permission
  requested only when scanning is first initiated, and a rationale shown
  before the OS dialog. On denial, a clear explanation and settings
  link; every other feature remains functional.
- **Validation (R-063)**: scanned payload submitted via
  `POST /events/{id}/checkin` with `{ checkin_token }`; check-in status
  set only by the backend's response, per the independently-verified
  six-step server-side authorization sequence (§2.3).
- **Result feedback (R-064)**: success, already-checked-in (not an
  error, per the backend's idempotent `ON CONFLICT DO NOTHING` design),
  or failure — within the R-131 2-second target.

**This model is confirmed correct against the reconciled,
architect-approved REQ-MEETUP-MOBILE.md** (R-060: "An organiser can
display the event's check-in code on their device for participants to
scan"; R-061: "A participant can scan the organiser's displayed check-in
code using their device camera to check in to the event") — matching
exactly what this document independently derived from the verified
backend contract across multiple prior review rounds. **No per
-participant tokens exist; none are required. OI-7 closed.**

**Trade-offs accepted (HIGH severity, §9 Risk #2)**: The event-scoped
token permits screenshot-sharing before scan. Identity binding happens
server-side via `UNIQUE(event_id, user_id)`, which bounds the blast
radius to one fraudulent check-in per shared code — DES-MEETUP.md's own
§5.8 independently names this identical risk with an identical T1
-acceptable rationale and T2 upgrade trigger, corroborating this
document's assessment. This residual risk is accepted, not resolved by
the R-060/R-061 wording correction — the wording correction closed a
requirements-conformance gap, not a security gap, which remains
correctly tracked as Risk #2.

**Alternatives rejected**: A client-side, participant-unique QR payload
independent of the backend's token — would invent a validation scheme
the backend does not implement (BP-01).

**R-ID(s) served**: R-060, R-061, R-062, R-063, R-064, R-131, R-141.

**Deviation**: None.

### 3.8 Offline/Cache Strategy (R-100, R-101)

**Decision**: React Query's cache persisted to on-device storage
(`@tanstack/query-async-storage-persister` backed by `AsyncStorage`),
24-hour cache time, 5-minute stale time for lists, 2-minute for details.
A network-state listener drives a global offline banner (R-100) and
disables every mutation-triggering control while offline (Non-Goal 4,
R-101). **This cache posture is an architect-approved P16 deviation —
see §3.13.**

**Rationale**: React Query's built-in persistence directly implements
R-101 without custom caching code.

**Trade-offs accepted**: Data grows stale the longer a user remains
offline, bounded at 24 hours (config-driven, P1).

**Alternatives rejected**: A custom offline mutation queue — explicitly
out of scope (Non-Goal 4).

**R-ID(s) served**: R-100, R-101, R-102.

**Deviation**: See §3.13.

### 3.9 Deep Link Handling (R-091, R-092)

**Decision**: A custom URL scheme (`meetup://`) plus Android App Links
(verified via `assetlinks.json`), both routed through the same React
Navigation linking configuration. Unauthenticated deep links store the
target as `pendingDestination`, route to the Auth Stack, and navigate to
`pendingDestination` on successful sign-in (R-092). Authenticated users
route directly (R-091).

**Rationale**: App Links avoid the disambiguation dialog for the primary
notification-tap path (R-073); the custom scheme is a fallback.

**Trade-offs accepted**: `assetlinks.json` publication is a deployment
dependency outside this app's own release pipeline (OI-6). The
custom-scheme fallback carries a minor, named, deliberate link-hijacking
exposure (LOW, no change required).

**Alternatives rejected**: Custom scheme only — produces a
disambiguation prompt on every tap.

**R-ID(s) served**: R-091, R-092, R-073.

**Deviation**: None.

### 3.10 Role-Based UI Gating (R-017, R-082)

**Decision**: A `useRole()` hook (backed by `GET /users/me`'s `role`
field) gates organiser/admin screens. A separate
`isCommitteeMember(tournamentId)` check, sourced from
`GET /tournaments/{tournament_id}/committee/members`, gates committee
governance UI. Every gated action still calls its endpoint normally; the
gate hides the affordance, it does not replace handling a `403`.

**Rationale**: Directly implements R-017/R-082's "never the final
authority."

**Trade-offs accepted**: A stale cached role can briefly show an
affordance that then fails server-side — acceptable per R-017/R-082's
own wording.

**Alternatives rejected**: Continuous polling — disproportionate cost
(BP-12).

**R-ID(s) served**: R-017, R-082, R-050, R-051, R-080, R-081, R-142.

**Deviation**: None.

### 3.11 Build and Release Pipeline (R-007)

**Decision**: GitHub Actions with a single release workflow: checkout →
install dependencies (committed lockfile) → write decoded
`google-services.json` from a base64-encoded GitHub Actions secret to
`android/app/google-services.json`, and inject OAuth client IDs via
Gradle `-P` properties or a `local.properties` write step — both at CI
runtime only, never persisted to the repository → Gradle build with a
pinned JDK/AGP version (config-driven, P1) → signed APK/AAB using a
release keystore stored as a separate GitHub Actions encrypted secret →
upload to Google Play via the Play Developer API. Every build tagged
with the git commit SHA and an incrementing `versionCode`.

**Explicit secrets-exclusion requirement**: `google-services.json`, OAuth
client configuration files, and any `.env` file with populated values
are forbidden from version control — `.gitignore` excludes them by
name; the CI secrets-detection stage (§8.5) scans for this class of file
specifically. Only placeholder files may be committed, clearly named.

**Rationale**: Pinned dependencies/toolchain implement R-007's
determinism (P8). The CI-time injection path ensures the Android build
actually succeeds while keeping real secrets out of the repository
entirely (P10).

**Trade-offs accepted**: Requires periodic, deliberate version-bump PRs.

**Alternatives rejected**: Building "latest" dependencies on every CI
run — violates R-007/P8.

**R-ID(s) served**: R-007, R-002, R-003.

**Deviation**: None.

### 3.12 Correlation ID Propagation (R-113, P4)

**Decision**: A correlation ID (UUIDv4) generated client-side at the
start of each logical user action, not per raw HTTP call. Multi-call
sequences (including committee action challenge→verify→submit/approve
flows, §4.6) share one ID via `X-Correlation-ID`. Included in local
crash-reporting breadcrumbs (§6), following DES-MEETUP.md's own
correlation-ID convention (§5.12).

**Rationale**: Scoping to a logical action satisfies R-113's "traced
back to the operational event."

**Trade-offs accepted**: Requires threading the ID through multi-call
sequences — mitigated by a `withCorrelationId()` wrapper utility.

**Alternatives rejected**: Per-HTTP-call correlation IDs — would
fragment a single action's trace.

**R-ID(s) served**: R-113, R-076.

**Deviation**: None.

### 3.13 Cache-at-Rest Posture — Named P16 Deviation (ARCHITECT-APPROVED)

**Decision**: Cached server-state data (§3.8) is stored in plaintext
`AsyncStorage`, not encrypted at rest.

**Governing principle deviated from**: P16 (Encryption at Rest).

**Why the deviation is justified**:

1. **Retention scope is bounded and matches live-view scope exactly** —
   the cache stores nothing beyond what a single `GET` response already
   returns to the authenticated user in that moment.
2. **The backend itself does not classify this data as requiring
   at-rest encryption beyond its database-wide baseline** —
   DES-MEETUP.md's data model does not flag roster/membership data with
   the `SENSITIVE` annotation applied to tokens.
3. **The realistic T1 threat is device loss/theft**, and Android's app
   sandbox is the control that matters for that threat, independent of
   cache encryption.

**Mitigating control**: (1) Any `SENSITIVE`-flagged field is never
written to this cache. (2) Cache TTL bounded at 24 hours. (3) This
decision is explicitly named per the governing-files deviation
requirement.

**P16 deviation APPROVED by architect 2026-09-13. Upgrade trigger: any
regulatory audit finding or PII breach incident.** This supersedes this
document's earlier, broader four-condition draft trigger — the
architect-supplied criterion is now the sole authoritative trigger for
this deviation.

**R-ID(s) served**: R-100, R-101.

---

## 4. Screen & Feature Design

### 4.1 Platform & Build

No dedicated screens — covered by §3.11 and app-wide configuration
(environment-driven, R-006/P1, injected via CI-time secrets, §3.11).

### 4.2 Authentication

**Screens**: Landing/Onboarding, Sign In, Register (email/password),
Forgot Password. No Facebook sign-in screen or button — deferred (§3.5).

**Navigation flow**: Landing → [Sign In | Register] → App Stack home.
Session restore on cold start checks Keystore; if present, silently
refreshes (R-016).

**API endpoints consumed**: `POST /auth/oauth/{provider}/callback`
(`provider=google` only), `POST /auth/login`, `POST /auth/register`,
`POST /auth/logout`, `POST /auth/refresh`.

**Role/permission gates**: None (pre-authentication).

**Error/edge cases**: Invalid credentials (enumeration-safe error),
network failure (retry affordance, no partial session state), refresh
token expiry (silent re-auth, then forced re-login preserving form
state, R-016).

**Offline behaviour**: Sign-in/register require connectivity; offline
shows the standard banner and disables submission.

### 4.3 Event Management

**Screens**: Event List, Event Detail, Create Game (merged
Casual/Tournament — see Create Flow Amendment below), RSVP sheet.

**API endpoints consumed**: `POST /events`, `GET /events`,
`GET /events/{id}`, `PATCH /events/{id}`, `POST /events/{id}/cancel`,
`POST /events/{id}/invite-user`, `POST /events/{id}/invite-group`,
`POST /events/{id}/invitations/{id}/accept`,
`POST /events/{id}/invitations/{id}/decline`,
`DELETE /events/{id}/invitations/{id}`,
`POST /events/{id}/rsvp` (Join sends body `{ action: "going" }`; withdraw sends
`{ action: "withdrawn" }` — same endpoint, there is no separate withdraw path),
`POST /events/{id}/participants`,
`DELETE /events/{id}/participants/{user_id}`.

**Role/permission gates**: Create — any authenticated user.
Edit/Cancel/manual participant management — organiser only.

**Error/edge cases**: Full-event RSVP returns waitlisted status (R-024).
Waitlist promotion (R-025) via push. Edit on cancelled event rejected
server-side.

**Offline behaviour**: Last-fetched data viewable (R-101); mutating
controls disabled offline.

**Create Flow Amendment (architect-approved 2026-09-22)**

FAB "Create" menu (`CreateMenu.tsx`): two entries only — Create Game,
Create Group. ("Create Tournament" removed as a separate entry; see §4.5.)

`CreateGameScreen.tsx` becomes a single screen with a segmented toggle
at top: **Casual Game | Tournament** (default: Casual Game). Toggle
changes visible fields and submit target within the same screen.

*Casual Game* → `POST /events` (`EventCreate`): Title* (1–150), Sport
(from `GET /admin/sports/public`), Visibility* (`public`/`invite_only`/
`group`, with conditional required Group picker when `group`), Skill
Level (`all_levels`/`beginner`/`intermediate`/`expert`), Capacity*
(2–200), Start Date & Time* (quick-select: Today/Tomorrow/This Sat/This
Sun), Venue Name, Venue Address, Description. `ends_at` always `null`.

*Tournament* → `POST /tournaments` (`TournamentCreate`): Tournament
Title* (1–150), Tournament Start Date*, Sport* (from
`GET /admin/sports/public`), Visibility* (`public`/`invite`/`group` —
distinct literal from Event's `invite_only`, with conditional required
Group picker when `group`), Description (optional), Participation Mode*
(`individual`/`team`), Registration Closes At (optional), Format*
(Knockout (Single Elimination) / Round Robin — Group Stage deliberately
excluded, see below), Capacity* (min 2, default 8), Venue Name. No Venue
Address, no Skill Level in Tournament mode (both confirmed absent from
web's tournament form).

*Deferred — Format: Group Stage.* `structured_rules` has a full backend
contract (`tournaments/schemas.py`) but no UI populates it on web or
mobile today; web's Format control has no reachable option for it.
Mobile's prior 3rd Format chip (`group_stage`, no `structured_rules`
sent) is removed — it always produced a guaranteed 422, so this is a bug
fix, not a regression. Re-introduce only after a `structured_rules` UI is
designed on web first — mobile does not lead web on this contract.

### 4.4 Groups & Teams

**Screens**: Group List, Group Detail, Create Group, Team List, Team
Detail, Create Team.

**API endpoints consumed**: `POST /groups`, `GET /groups/{id}`,
`POST /groups/{id}/invite`, `PATCH /groups/{id}/members/{user_id}/role`,
`DELETE /groups/{id}/members/{user_id}`, `POST /teams`, `GET /teams`,
`GET /teams/{id}`, `PATCH /teams/{id}`, `DELETE /teams/{id}`,
`POST /teams/{id}/join-request`, `POST /teams/{id}/invite`,
`POST /teams/{id}/memberships/{id}/accept`,
`POST /teams/{id}/memberships/{id}/decline`,
`DELETE /teams/{id}/memberships/{user_id}`,
`POST /teams/{id}/transfer-captaincy`.

**Role/permission gates**: Role management — owner/admin only. Team
edit/delete/captaincy transfer — captain only.

**Error/edge cases**: Last-owner removal rejected server-side.

**Offline behaviour**: Last-fetched data viewable; mutating actions
disabled offline.

### 4.5 Tournaments

**Screens**: Tournament List, Tournament Detail (fixtures + standings
tabs), Fixture Result Entry. (Tournament creation moved into §4.3's
merged Create Game screen — see Create Flow Amendment.)

**API endpoints consumed**: `POST /tournaments`, `GET /tournaments`,
`GET /tournaments/{id}`, `PATCH /tournaments/{id}`,
`POST /tournaments/{id}/cancel`, `POST /tournaments/{id}/registrations`,
`DELETE /tournaments/{id}/registrations/{registration_id}`,
`GET /tournaments/{id}/fixtures`, `PATCH /tournaments/{id}/fixtures/{id}`,
`POST /tournaments/{id}/fixtures/{id}/result`,
`GET /tournaments/{id}/registrations`.

**Role/permission gates**: Create/Edit/Cancel/schedule actions —
organiser only. Result entry — organiser/admin.

**Error/edge cases**: Standings rendered exactly as returned — **no
client-side recalculation** (R-042).

**Offline behaviour**: Last-fetched fixtures/standings viewable;
mutating actions disabled offline.

### 4.6 Organising Committee Governance

**Screens**: Committee tab (within Tournament Detail, per DES-MEETUP.md
§4.12's explicit design), Committee Members list, Pending Actions queue,
Step-Up Challenge Modal, Submit Action sheet.

**API endpoints consumed** (verified against
`tournaments/router.py`/`tournaments/committee_step_up.py`; write-back
to DES-MEETUP.md §5.5 is a separate, non-blocking backend
-documentation task, OI-9 CLOSED): `GET /tournaments/{tournament_id}/committee/members`,
`GET /tournaments/{tournament_id}/committee/actions`,
`POST /tournaments/{tournament_id}/committee/actions`,
`POST /tournaments/{tournament_id}/committee/actions/{request_id}/approve`,
`POST /tournaments/{tournament_id}/committee/actions/{request_id}/reject`,
`POST /tournaments/{tournament_id}/committee/actions/{request_id}/confirm`,
`POST /tournaments/{tournament_id}/committee/step-up/challenge`,
`POST /tournaments/{tournament_id}/committee/step-up/verify`.

**Sequencing**: submit/approve actions require
challenge → verify → (submit or approve), using entirely separate
endpoints and token state from the platform-admin step-up mechanism.

**Role/permission gates**: Visible/actionable only for committee members
of that tournament (§3.10).

**Error/edge cases**: Expired/consumed step-up token — enumeration-safe
rejection. Wrong-action token replay — rejected server-side per
DES-MEETUP.md §4.12's exact-action binding. Non-member access attempt —
blocked by UI gate and independently rejected server-side.

**Offline behaviour**: All committee actions require connectivity;
Members list/Pending Actions queue follow the standard read-cache
pattern.

### 4.7 QR Code Check-In — RECONCILED, OI-7 CLOSED

**Screens**: Organiser "Display Check-In Code" view (within Event
Detail), Participant "Scan to Check In" camera screen, Scan Result
overlay.

**API endpoints consumed**: `POST /events/{id}/checkin`,
`GET /events/{id}/checkin-qr` (organiser-only display path).

**Role/permission gates**: Displaying — organiser only. Scanning — any
authenticated participant with a `going` RSVP status.

**Conformance status**: **Fully satisfied against the reconciled
REQ-MEETUP-MOBILE.md.** R-060 (organiser displays) and R-061
(participant scans) are both matched exactly by this design, verified
independently against the backend schema across multiple review rounds
before the requirement wording itself was corrected to align.

**Error/edge cases**: Invalid/malformed payload — client format check
plus mandatory server validation (R-063). Duplicate scan — idempotent,
shown as "already checked in." Unauthorised scan attempt — blocked by UI
gate, independently rejected server-side.

**Offline behaviour**: Check-in requires connectivity; disabled offline
with an explanatory message.

### 4.8 Push Notifications

**Screens**: Notification Permission rationale, Notification Preferences.

**API endpoints consumed**: `POST /notifications/mobile-subscriptions`,
`DELETE /notifications/mobile-subscriptions/{deviceToken}`,
`GET /notifications/preferences`, `PUT /notifications/preferences/{type}`.

**Notification type → deep link mapping** (all 12 confirmed types):

| Notification Type | Deep Link Destination |
|---|---|
| `global` | App home / announcements banner |
| `event_invite` | Event Detail (pending invitation state) |
| `event_changed` | Event Detail |
| `event_cancelled` | Event Detail (cancelled state) |
| `waitlist_promoted` | Event Detail (confirmed state) |
| `group_invite` | Group Detail (pending invitation state) |
| `tournament_match_scheduled` | Tournament Detail — Fixtures tab |
| `tournament_result_posted` | Tournament Detail — Fixtures tab |
| `tournament_cancelled` | Tournament Detail (cancelled state) |
| `tournament_schedule_published` | Tournament Detail — Fixtures tab |
| `tournament_standings_published` | Tournament Detail — Standings tab |
| `team_invite` | Team Detail (pending invitation state) |

**Conformance status**: R-077 partial satisfaction accepted by architect
2026-09-13. FCM token de-registration is client-enforced only (OI-2).
Accepted T1 residual risk.

**Offline behaviour**: Notifications queue at the FCM level; tap-through
requires connectivity, falling back to cached data if available.

### 4.9 Admin Module

**Screens**: Admin Home, Approval Queue, Sports List/CRUD form, Platform
Config screen, UI Labels management screen.

**API endpoints consumed** (verified against
`admin/router.py`/`admin/config_router.py`; write-back to DES-MEETUP.md
§5.5 is a separate, non-blocking backend-documentation task, OI-9
CLOSED): platform dual-admin approvals (`/admin/approvals/*`); sports
CRUD; platform config; UI labels.

**Role/permission gates**: Admin only for all `/admin/*` paths.
`/admin/sports/public` and `/api/labels` are unauthenticated by design.

**Error/edge cases**: Sports deletion while referenced by events —
rejected server-side. Malformed structured config/label field —
rejected server-side. Non-admin direct API call — rejected server-side
independent of UI gate.

**Offline behaviour**: Admin mutations require connectivity; reads
follow the standard cache pattern.

### 4.10 Onboarding & Navigation

Covered by §3.1, §3.9.

### 4.11 Offline & Network Resilience

Covered by §3.8.

### 4.12 Security & Boundary Validation

Covered by §3.3, §3.4, §5.

### 4.13 App Store Compliance

**Screens**: Privacy Policy viewer, Account Deletion flow.

**API endpoints consumed**: `POST /users/me/deletion-request`,
`POST /users/me/deletion-confirm`.

**Role/permission gates**: Any authenticated user, own account only.

**Error/edge cases**: Admin self-deletion rejected server-side with an
explicit error. Expired/consumed confirmation token — enumeration-safe
rejection.

**Offline behaviour**: Requires connectivity; disabled offline.

### 4.14 Performance NFRs

Covered by §3.11 and engineering practice — validated in §8.

### 4.15 Testing & Coverage

Covered by §8.

---

## 5. Security Design

### 5.1 Token Lifecycle

**Acquire/Store/Use/Refresh/Revoke**: as detailed in §3.4, §3.5. Sign-out
and self-deletion both trigger `POST /auth/logout`, revoking the refresh
token family server-side; Keystore clears locally in the same operation.

### 5.2 FCM Token Lifecycle — ARCHITECT-APPROVED DEVIATION

**Register/Rotate/De-register**: as detailed in §3.6.

R-077 requires the app to stop push delivery **before** clearing local
session data. The client-enforced-only ordering makes a best-effort
attempt but cannot **guarantee** completion — a crash or network loss
between the `DELETE` call and `POST /auth/logout` leaves the FCM token
active. A server-side fix was proposed during external review and
rejected: DES-MEETUP.md's own ratified amendment explicitly declined
this mechanism.

**R-077 partial satisfaction accepted by architect 2026-09-13. FCM token
de-registration is client-enforced only (OI-2). Accepted T1 residual
risk.**

**Measurable upgrade trigger (BP-10 compliant)**: Revisit if telemetry
shows **≥10 confirmed post-logout FCM deliveries to a signed-out device
within any rolling 7-day window**, measured via the backend's
`notification_deliveries` table cross-referenced against
`mobilepushtokens.deactivatedat` timestamps.

### 5.3 Role Enforcement — Client UX Gate + Server Authority

Every role-gated and committee-gated UI element is UX-only (§3.10).
Enforcement is exclusively server-side.

### 5.4 Data Never Written to Logs (R-111)

Excluded from all logging, crash reporting, analytics: access/refresh
tokens, email/password values, `checkin_qr_token`/`checkin_token`
values, FCM device tokens (beyond a truncated reference), and committee
step-up OTP codes.

### 5.5 Secure Storage Model (R-014)

Android Keystore-backed AES encryption (§3.4). Committee step-up tokens
held only in-memory for the challenge→verify→action sequence, never
persisted.

### 5.6 Certificate Pinning Decision

**Not implemented at T1** — justified per BP-12 against the actual T1
threat model, with measurable upgrade triggers.

### 5.7 Cache-at-Rest Deviation (P16) — ARCHITECT-APPROVED

See §3.13. **P16 deviation APPROVED by architect 2026-09-13. Upgrade
trigger: any regulatory audit finding or PII breach incident.**

### 5.8 P9, P10, P15 Compliance

**P9**: client-side validation is UX only; server is the actual
authority.

**P10**: OAuth secrets never embedded in the app. Firebase/OAuth config
and the release signing key are GitHub Actions secrets only, injected at
CI time (§3.11), never committed.

**P15**: every request carries a short-lived signed access token,
validated server-side per call.

---

## 6. Observability & Operability

### 6.1 Correlation ID Strategy

One correlation ID per logical user action (§3.12).

### 6.2 Crash Reporting

**Captured**: stack traces, device model, OS version, app version,
memory/storage at crash time, current screen route, most recent
correlation ID.

**Excluded (R-111)**: tokens, passwords, check-in codes, committee OTP
codes, and PII beyond the user's own account data.

**Tooling**: A minimal, swappable crash reporter, config-driven (P1).

### 6.3 Build Versioning Strategy

`versionCode`/`versionName` embedded via `gradle.properties` (P1),
surfaced in Settings, crash reports, and the mobile push registration
`userAgent` field.

---

## 7. API Contract

### 7.1 Auth

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| POST | `/auth/oauth/{provider}/callback` | No | `provider` = `google` only this release; Facebook deferred (§3.5) |
| POST | `/auth/refresh` | Refresh token | |
| POST | `/auth/login` | No | Email/password |
| POST | `/auth/register` | No | Email/password |
| POST | `/auth/logout` | Yes | Called after mobile push de-registration (§5.2) |

### 7.2 Users

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| GET | `/users/me` | Yes | Drives `useRole()` |
| PATCH | `/users/me` | Yes | |
| GET | `/users/nickname-available` | Yes | |
| PUT | `/users/me/skill-level` | Yes | |
| POST | `/users/me/deletion-request` | Yes | R-031 |
| POST | `/users/me/deletion-confirm` | Yes | R-031 |

### 7.3 Groups & Teams

| Method | Path | Auth Required |
|---|---|---|
| POST | `/groups` | Yes |
| GET | `/groups/{id}` | Yes |
| POST | `/groups/{id}/invite` | Yes |
| PATCH | `/groups/{id}/members/{user_id}/role` | Yes |
| DELETE | `/groups/{id}/members/{user_id}` | Yes |
| POST | `/teams` | Yes |
| GET | `/teams` | Yes |
| GET | `/teams/{id}` | Yes |
| PATCH | `/teams/{id}` | Yes |
| DELETE | `/teams/{id}` | Yes |
| POST | `/teams/{id}/join-request` | Yes |
| POST | `/teams/{id}/invite` | Yes |
| POST | `/teams/{id}/memberships/{id}/accept` | Yes |
| POST | `/teams/{id}/memberships/{id}/decline` | Yes |
| DELETE | `/teams/{id}/memberships/{user_id}` | Yes |
| POST | `/teams/{id}/transfer-captaincy` | Yes |

### 7.4 Events

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| POST | `/events` | Yes | |
| GET | `/events` | Optional | Public feed |
| GET | `/events/{id}` | Optional | Includes `checkin_qr_token` (§3.7) |
| PATCH | `/events/{id}` | Yes | Organiser only |
| POST | `/events/{id}/cancel` | Yes | Organiser only |
| POST | `/events/{id}/invite-user` | Yes | |
| POST | `/events/{id}/invite-group` | Yes | |
| POST | `/events/{id}/invitations/{id}/accept` | Yes | |
| POST | `/events/{id}/invitations/{id}/decline` | Yes | |
| DELETE | `/events/{id}/invitations/{id}` | Yes | Organiser only |
| POST | `/events/{id}/rsvp` | Yes | Join and withdraw share this one endpoint; body `{ action: "going" }` to join, `{ action: "withdrawn" }` to withdraw. There is no separate `/withdraw` path |
| POST | `/events/{id}/participants` | Yes | Organiser only |
| DELETE | `/events/{id}/participants/{user_id}` | Yes | Organiser only |
| POST | `/events/{id}/checkin` | Yes | Participant scans; verified six-step auth sequence; idempotent; own Circuit Breaker family (§3.3) |
| GET | `/events/{id}/checkin-qr` | Yes | Organiser only; organiser displays |

### 7.5 Settings

| Method | Path | Auth Required |
|---|---|---|
| GET | `/settings/organizing` | Yes |
| GET | `/settings/participating` | Yes |
| GET | `/settings/groups-owned` | Yes |
| GET | `/settings/groups-member` | Yes |

### 7.6 Notifications

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| GET | `/notifications/vapid-public-key` | No | Not used by mobile — Web Push only |
| POST | `/notifications/subscriptions` | Yes | Not used by mobile — Web Push only |
| DELETE | `/notifications/subscriptions/{id}` | Yes | Not used by mobile — Web Push only |
| GET | `/notifications/preferences` | Yes | |
| PUT | `/notifications/preferences/{type}` | Yes | |
| POST | `/notifications/mobile-subscriptions` | Yes | R-029 |
| DELETE | `/notifications/mobile-subscriptions/{deviceToken}` | Yes | R-030; called before `/auth/logout` |

### 7.7 Tournaments

| Method | Path | Auth Required |
|---|---|---|
| POST | `/tournaments` | Yes |
| GET | `/tournaments` | Yes |
| GET | `/tournaments/{id}` | Yes |
| PATCH | `/tournaments/{id}` | Yes |
| POST | `/tournaments/{id}/cancel` | Yes |
| POST | `/tournaments/{id}/registrations` | Yes |
| DELETE | `/tournaments/{id}/registrations/{registration_id}` | Yes |
| POST | `/tournaments/{id}/close-registration` | Yes |
| POST | `/tournaments/{id}/schedule/generate` | Yes |
| POST | `/tournaments/{id}/discard-draft` | Yes |
| PATCH | `/tournaments/{id}/fixtures/{id}` | Yes |
| POST | `/tournaments/{id}/schedule/publish` | Yes |
| POST | `/tournaments/{id}/fixtures/{id}/result` | Yes |
| GET | `/tournaments/{id}/fixtures` | Yes |
| GET | `/tournaments/{id}/registrations` | Yes |

### 7.8 Tournament Committee Governance

*Verified against `tournaments/router.py`, `tournaments/committee_step_up.py`. Write-back to DES-MEETUP.md §5.5 is a separate, non-blocking backend-documentation task (OI-9 CLOSED).*

| Method | Path | Auth Required |
|---|---|---|
| GET | `/tournaments/{tournament_id}/committee/members` | Yes |
| GET | `/tournaments/{tournament_id}/committee/actions` | Yes |
| POST | `/tournaments/{tournament_id}/committee/actions` | Yes |
| POST | `/tournaments/{tournament_id}/committee/actions/{request_id}/approve` | Yes |
| POST | `/tournaments/{tournament_id}/committee/actions/{request_id}/reject` | Yes |
| POST | `/tournaments/{tournament_id}/committee/actions/{request_id}/confirm` | Yes |
| POST | `/tournaments/{tournament_id}/committee/step-up/challenge` | Yes |
| POST | `/tournaments/{tournament_id}/committee/step-up/verify` | Yes |

### 7.9 Admin — Platform Approvals

| Method | Path | Auth Required |
|---|---|---|
| POST | `/admin/approvals` | Yes (admin) |
| POST | `/admin/approvals/{id}/approve` | Yes (admin) |
| POST | `/admin/approvals/{id}/reject` | Yes (admin) |
| DELETE | `/admin/approvals/{id}` | Yes (admin) |
| POST | `/admin/approvals/{id}/verify` | Yes (admin) |

### 7.10 Admin — Sports and Config

*Verified against `admin/router.py`, `admin/config_router.py`. Write-back to DES-MEETUP.md §5.5 is a separate, non-blocking backend-documentation task (OI-9 CLOSED).*

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| GET | `/admin/sports` | Yes (admin) | |
| GET | `/admin/sports/public` | No | Distinct from admin-only list |
| POST | `/admin/sports` | Yes (admin) | |
| PATCH | `/admin/sports/{id}` | Yes (admin) | |
| DELETE | `/admin/sports/{id}` | Yes (admin) | Blocked while referenced by any event |
| GET | `/admin/config/platform` | Yes (admin) | |
| POST | `/admin/config/platform/default_tiebreaker_sequence` | Yes (admin) | Structured field only |
| POST | `/admin/config/platform/default_points_system` | Yes (admin) | Structured field only |
| POST | `/admin/config/platform/{config_key}/rollback` | Yes (admin) | N-1 revert |
| GET | `/admin/config/ui_labels` | Yes (admin) | |
| POST | `/admin/config/ui_labels/{label_key}` | Yes (admin) | Structured field only |
| GET | `/api/labels` | No | Runtime label-serving, separate integration point |

---

## 8. Testing Strategy

### 8.1 Functional

Standard positive-path coverage for every screen/flow in §4, including
check-in (§4.7, now fully reconciled) and Facebook-absent auth flows
(§4.2).

### 8.2 Negative

Per R-140, R-141, R-142: auth failure/denial cases across Google and
email/password; check-in invalid/duplicate/unauthorised scans; admin/
committee non-member direct API call attempts; committee step-up token
replay and expiry.

### 8.3 Adversarial

Token extraction from a rooted device; token/correlation-ID/step-up
-token replay across sessions or actions; deep-link injection to
unauthorized entities; FCM payload tampering against an unrecognized
`notification_type`.

### 8.4 Security

Coverage proportional to risk (P13): auth, token storage, check-in
validation, and committee step-up flows receive high coverage including
negative/adversarial cases.

### 8.5 CI Gate

Before any release build: (1) SAST scanning, dependency vulnerability
scanning, secrets detection — blocking on high/critical severity; (2)
unit tests including deep-link mapping completeness and Circuit Breaker
trip-condition tests; (3) integration tests against a mocked backend
contract matching §7 exactly; (4) the full negative/adversarial suite. A
CI check verifying no Facebook SDK reference, initialization call, or
`provider=facebook` code path exists in the build is included as a
regression guard consistent with the Facebook deferral.

---

## 9. Risks & Mitigations

| # | Risk | Domain | Severity | Mitigation / Deferral |
|---|---|---|---|---|
| 1 | OAuth credential provisioning (R-018, Google-only) not completed before implementation start | Auth | 🔴 CRITICAL | Named pre-implementation gate, §10 OI-5 CLOSED (as a gate, not eliminated as a dependency) |
| 2 | QR check-in token is event-scoped, permitting screenshot-sharing before scan | QR Check-In | 🟠 HIGH | Inherited backend schema design (§3.7); `UNIQUE(event_id, user_id)` bounds blast radius; corroborated by DES-MEETUP.md §5.8's independent identical risk assessment; residual risk, distinct from and unaffected by the R-060/R-061 wording reconciliation |
| 3 | Facebook OAuth (R-011) deferred by REQ-MEETUP-MOBILE | Auth | 🟢 LOW (closed) | Resolved via requirements-level deferral with a measurable re-entry trigger; no design action remains |
| 4 | R-077 not fully satisfiable — client-enforced-only push de-registration ordering | Push Notifications | 🟠 HIGH (architect-approved deviation) | Explicit architect sign-off recorded 2026-09-13, §5.2, with a numeric (BP-10-compliant) upgrade trigger |
| 5 | Hardware-backed Keystore unavailable on some low-end OEM devices | Token Security | 🟡 MEDIUM | Detected and logged; software-backed AES still materially better than plaintext |
| 6 | Certificate pinning absence | Network Security | 🟢 LOW | Deliberate, justified T1 non-control, §5.6 |
| 7 | Cache-at-rest (P16) exposes non-credential, third-party-PII-bearing roster data on a lost/stolen device | Offline Cache | 🟡 MEDIUM (architect-approved deviation) | Explicit architect sign-off recorded 2026-09-13, §3.13, with a narrowed, architect-supplied upgrade trigger |
| 8 | GitHub Actions release-signing secret compromise | Build Pipeline | 🟠 HIGH | Standard encrypted-secret handling, scoped access |
| 9 | Offline banner / mutation-disable timing gap mid-request | Offline Handling | 🟢 LOW | Retry/backoff and timeout handling cover this at the request layer |
| 10 | Committee step-up token replay or cross-action misuse | Committee Governance | 🟠 HIGH | Server-side exact-action binding is the actual control; listed to ensure test coverage |
| 11 | Admin config/label structured-field validation gap | Admin Config | 🟡 MEDIUM | Backend validates-before-accept (P9) |
| 12 | DES-MEETUP.md §5.5 does not yet document committee/admin-config endpoint paths verified against the running codebase | Documentation Drift | 🟢 LOW (closed as non-blocking) | Named as a separate backend-documentation task, §10 OI-9 CLOSED; does not block mobile implementation |
| 13 | Circuit Breaker false-opening on ordinary mobile network flakiness | API Client Resilience | 🟢 LOW (residual, post-correction) | Corrected trip conditions specifically address this |
| 14 | A future code change silently re-enables Facebook sign-in without confirming the deferral trigger has been met | Auth / Process | 🟢 LOW | CI regression guard (§8.5) checks for absence of Facebook SDK code paths |

---

## 10. Open Items

| # | Item | Owner | Resolution Condition |
|---|---|---|---|
| OI-1 (inherited) | Mobile push provider validation rules at implementation time | Claude Code (implementation) | Already closed at backend design level (FCM confirmed) |
| OI-2 (inherited) | FCM de-registration-before-logout ordering is client-enforced only | Pratheesh (architect) | **CLOSED — architect-approved 2026-09-13.** Accepted T1 residual risk (§5.2); revisit at ≥10 confirmed post-logout deliveries per 7-day rolling window. |
| ~~OI-3~~ | ~~Committee endpoint paths~~ | — | **CLOSED.** |
| ~~OI-4~~ | ~~Admin sports/config endpoint paths~~ | — | **CLOSED.** |
| ~~OI-5~~ | ~~R-018 OAuth credential provisioning~~ | — | **CLOSED.** Google OAuth Android credentials provisioning is a pre-implementation gate per R-018. Not a design blocker. |
| ~~OI-7~~ | ~~R-060/R-061 actor-role model~~ | — | **CLOSED.** REQ-MEETUP-MOBILE reconciled and corrected: organiser displays, participant scans, matching the verified backend contract exactly. No per-participant tokens exist or are required. |
| ~~OI-8~~ | ~~R-005 wording contradiction~~ | — | **CLOSED.** R-005 corrected by the architect to explicitly name its own exceptions (R-029, R-030, R-031) — both already designed in DES-MEETUP.md and explicitly named in REQ-MEETUP-MOBILE. No undocumented backend dependency. |
| ~~OI-9~~ | ~~DES-MEETUP.md §5.5 write-back~~ | — | **CLOSED (non-blocking).** Committee and sports/config endpoint paths verified from the running codebase and recorded in §7. The formal write-back into DES-MEETUP.md §5.5 is a separate backend-documentation task, not a mobile-design blocker. |
| OI-6 | Android App Links domain verification (`assetlinks.json`) pending | Pratheesh (architect) / backend deploy owner | Blocks full App-Links-quality deep linking; custom-scheme fallback remains functional in the interim |
| ~~OI-10~~ | ~~Facebook Custom-Tab fallback conflict~~ | — | **CLOSED.** REQ-MEETUP-MOBILE Non-Goal 9 formally defers R-011 with a measurable, automatic re-entry trigger. No Facebook code path ships this release. |
| ~~OI-11~~ | ~~REQ-MEETUP-MOBILE.md branch divergence~~ | — | **CLOSED.** A single, canonical, reconciled REQ-MEETUP-MOBILE.md now exists, containing both the R-060/R-061 rewrite and the R-011 deferral, plus the R-005 correction. |
| OI-12 | §3.5 Credential Manager deviation — legacy Google Sign-In SDK used instead of Credential Manager (paid product required) | Pratheesh (architect) | CLOSED — architect-ratified 2026-09-13. Legacy SDK satisfies R-010 fully. Upgrade path: if Credential Manager becomes available in the free package or cost justification exists, migrate at that point. |
| OI-13 | Standings view for tournaments — design references a Standings tab in §4.5, screen inventory, and notification mapping table, but no standings endpoint exists in §7.7 or the running backend. R-042 explicitly forbids client-side computation. | Pratheesh (architect) / backend owner | OPEN — unblocked for current implementation (Fixtures + Registrations tabs shipped instead). Requires a new backend endpoint before a Standings tab can be built. Resolution: add endpoint to DES-MEETUP.md and REQ-MEETUP.md, then implement. |
| OI-14 | Offline gating — §4.11 specifies mutating controls disabled when offline, but no connectivity-detection library exists in the codebase. Current behaviour: inline network error on failure. | Claude Code (implementation) | OPEN — accepted T1 interim behaviour. Resolution trigger: implement when offline-first UX becomes a user-reported pain point or when connectivity library is added for another feature. |
| OI-15 | Forgot Password screen — listed in screen inventory but not yet implemented. | Claude Code (implementation) | OPEN — deferred by architect. Implement after core feature modules are complete. |

Approval status: APPROVED — architect-approved 2026-09-13. Open Items OI-6,
OI-13, OI-14, OI-15 remain open — all are named deferrals with defined resolution
conditions, not design defects. OI-12 is closed (architect-ratified deviation).
Both architect sign-off deviations (OI-2/R-077, P16/§3.13) remain explicitly
recorded as approved.

---

*DES-MEETUP-MOBILE · APPROVED — architect-approved 2026-09-13 · T1 · Requirements Baseline: REQ-MEETUP-MOBILE (APPROVED 2026-09-13) · Parent Backend Design: DES-MEETUP.md (APPROVED) · Governing files Enterprise_Design_Principles_v1.0.md (P1–P17) and design-best-practices.md (BP-01–BP-13) confirmed in context at drafting. Eight external adversarial review rounds completed. Open Items: OI-6 (deployment gate), OI-13 (standings endpoint), OI-14 (offline gating), OI-15 (forgot password) — all named deferrals. OI-12 (Credential Manager deviation) closed.*