# REQ-MEETUP-MOBILE — Meetup Android Mobile App: Requirements Brief

**Status:** APPROVED — architect-approved 2026-09-13
**Governing principles in scope:** Enterprise_Design_Principles_v1.0.md (P1–P17), design-best-practices.md (BP-01–BP-13) — both confirmed in context at drafting time.
**Parent system:** Meetup (PWA) — REQ-MEETUP-001, DES-MEETUP-001 (backend contracts referenced, not re-specified here).
**Tier:** T1 (per 01-projects.md — Meetup is T1; no tier change introduced by mobile client).

**Changelog:**
- Corrected R-005 wording to accurately reflect that R-029, R-030, R-031 introduce named backend changes — the prior wording "no backend-side changes required" was a literal contradiction.
- **Reconciliation pass** — this is the single, canonical REQ-MEETUP-MOBILE.md, consolidating two previously-divergent editing branches into one file:
  - Rewrote R-060 and R-061 to match the verified backend design (DES-MEETUP-001): the backend implements one event-scoped `checkin_qr_token` per event, stored on the `events` table, with no per-participant token. The organiser retrieves the code via `GET /events/{id}/checkin-qr` and displays it; participants scan it; `POST /events/{id}/checkin` validates the submitted token. The prior wording ("a personal check-in code") described a participant-unique token model the backend does not implement.
  - Closed Assumption 9: `POST /events/{id}/checkin` is confirmed to exist in the backend (verified against DES-MEETUP.md §5.5's API contract and §5.8's full six-step authorization sequence). No backend scope change required.
  - Updated Assumption 6 to name the actual backend mechanism (`checkin_qr_token` on the `events` table) rather than referring to it generically, for consistency with the R-060/R-061 rewrite and the Assumption 9 closure.
  - Deferred R-011 (Facebook OAuth) from this release via new Non-Goal 9 — implementation follows Google OAuth reaching production stability. Re-entry trigger: Google OAuth live and stable in production with no auth-related incidents for 30 days.
  - Narrowed R-018 to Google-only credential provisioning (Facebook credentials are not a pre-implementation gate while R-011 is deferred).
  - Updated Non-Goal 6 to reflect the Facebook deferral, cross-referencing new Non-Goal 9.
  - Updated R-140 to drop the Facebook reference from the sign-in testing requirement, consistent with the deferral.
  - Removed the "rate limiting" assumption — rate limiting is a backend concern; mobile app is just another client. No assumption warranted.
  - Closed OAuth credential provisioning ownership and rate limiting coverage open questions per architect resolution. Removed the Open Questions section entirely. Status changed to APPROVED, architect-approved.
  - Merged duplicate account deletion requirements (dropped a redundant requirement; rewrote R-124). Closed notification-provider isolation open question → Assumption 11.
  - Stripped all technology/framework/protocol names from requirement statements (BP-02). Closed the QR payload open question → Assumption 9 (subsequently closed further, see above). Closed the account deletion open question → R-124. Promoted the push token de-registration open question → R-077 (Must). Added R-018 (OAuth provisioning pre-gate). Closed the minimum Android version open question → Assumption 10. Promoted R-007 to Must.
  - Initial draft.

---

## 1. Requirements Table

Format: `R-ID | Type | Statement | Priority | Tier | Status`

### 1.1 Platform & Build

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-001 | Functional | The app shall deliver a native mobile experience indistinguishable from a platform-native app, with no browser or web-view dependency anywhere in the user-facing flow. | Must | T1 | PROPOSED |
| R-002 | Functional | The app shall be available to the public via the standard Android application marketplace. | Must | T1 | PROPOSED |
| R-003 | Functional | The app shall install and operate correctly on a current-generation Android device. | Must | T1 | PROPOSED |
| R-004 | Functional | An equivalent experience for Apple's mobile platform is deferred to a later phase and is out of scope for this release. | Should | T1 | PROPOSED |
| R-005 | Functional | The app consumes existing backend services. The only backend-side changes introduced to support mobile are those explicitly named in this document (R-029, R-030, R-031) and designed in DES-MEETUP.md — no undocumented or additional backend changes are required for mobile launch. | Must | T1 | APPROVED |
| R-006 | Functional | The app shall externalise all environment-specific values (service addresses, third-party identity/notification integration identifiers) to configuration, with no such value fixed in source code. | Must | T1 | PROPOSED |
| R-007 | Non-Functional | Release builds shall be produced through an automated, repeatable process that generates identical output from the same source and configuration every time. | Must | T1 | PROPOSED |

### 1.2 Authentication

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-010 | Functional | Users can sign in with their Google account without being redirected to a browser or leaving the app. | Must | T1 | PROPOSED |
| R-011 | Functional | Users can sign in with their Facebook account without being redirected to a browser or leaving the app. | Must | T1 | DEFERRED |
| R-012 | Functional | Users can register and sign in using an email address and password, consistent with the existing sign-in options offered on the web experience. | Must | T1 | PROPOSED |
| R-013 | Functional | Users can sign out, and doing so removes all locally held session and personal data from the device. | Must | T1 | PROPOSED |
| R-014 | Security | User credentials and session data are stored securely on the device and cannot be recovered by another app, nor by extracting the device's storage. | Must | T1 | PROPOSED |
| R-015 | Security | Every action a user takes that reaches the backend is independently verified as coming from a genuinely signed-in user; no action is trusted merely because it came from within the app. | Must | T1 | PROPOSED |
| R-016 | Functional | When a session becomes stale, the app renews it automatically wherever possible without losing any work the user has in progress; otherwise it asks the user to sign in again without discarding that work. | Should | T1 | PROPOSED |
| R-017 | Functional | The app shall enforce the same role model as the existing web experience — participant, organiser, admin — with visible actions and screens matching what each role is permitted to do, and with the app never being the final authority on whether an action is allowed. | Must | T1 | PROPOSED |
| R-018 | Operational | Before implementation begins, the platform-specific credentials required for Google sign-in on this app shall be obtained and made available; this is a pre-implementation gate, not a task completed during or after build. | Must | T1 | PROPOSED |

### 1.3 Event Management

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-020 | Functional | Users can create events, with the same information and rules as the existing web experience. | Must | T1 | PROPOSED |
| R-021 | Functional | Users can browse events using the same filtering and grouping (e.g., upcoming, past, mine) as the existing web experience. | Must | T1 | PROPOSED |
| R-022 | Functional | Authorised users (creator/organiser) can edit an existing event. | Must | T1 | PROPOSED |
| R-023 | Functional | The app supports both private and public events, with the same visibility and access rules as the existing web experience. | Must | T1 | PROPOSED |
| R-024 | Functional | Users can RSVP to an event and see their current status (confirmed, waitlisted, declined) reflected accurately. | Must | T1 | PROPOSED |
| R-025 | Functional | A waitlisted user sees their status update if they are promoted to confirmed. | Must | T1 | PROPOSED |
| R-026 | Security | Every value a user submits when creating or editing an event is independently checked for correctness and permission before it is accepted; on-screen checks are a convenience only and never the actual safeguard. | Must | T1 | PROPOSED |

### 1.4 Groups & Teams

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-030 | Functional | Users can create, browse, and join groups, matching existing web functionality. | Must | T1 | PROPOSED |
| R-031 | Functional | Group membership can be managed (invite, accept, remove) according to each user's role permissions. | Must | T1 | PROPOSED |
| R-032 | Functional | Users can create and manage teams within a group or event, matching existing web functionality. | Must | T1 | PROPOSED |

### 1.5 Tournaments

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-040 | Functional | Users can create a tournament with a group-stage structure, matching existing web setup. | Must | T1 | PROPOSED |
| R-041 | Functional | Users can view a tournament's fixtures and their scheduling. | Must | T1 | PROPOSED |
| R-042 | Functional | Users can view tournament standings/leaderboard exactly as calculated and provided by the backend, with no separate calculation performed by the app itself. | Must | T1 | PROPOSED |
| R-043 | Functional | Authorised users (organiser/admin) can record or edit fixture results, under the same permission rules as the existing web experience. | Must | T1 | PROPOSED |

### 1.6 Organising Committee Governance

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-050 | Functional | Organising committee membership and governance actions available to organisers on the existing web experience (e.g., committee assignment, approval workflows) are also available in the app. | Must | T1 | PROPOSED |
| R-051 | Functional | Approval workflows that require sign-off from more than one admin are presented and behave the same way in the app as on the web experience, with no change to what counts as valid approval evidence. | Must | T1 | PROPOSED |

### 1.7 QR Code Check-In

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-060 | Functional | An organiser can display the event's check-in code on their device for participants to scan. | Must | T1 | APPROVED |
| R-061 | Functional | A participant can scan the organiser's displayed check-in code using their device camera to check in to the event. | Must | T1 | APPROVED |
| R-062 | Functional | Camera access is requested only at the moment scanning is first used, with a clear explanation of why it's needed, and the rest of the app continues to work normally if access is refused. | Must | T1 | PROPOSED |
| R-063 | Security | A scanned check-in code is only accepted once the backend has independently confirmed it is valid; the app never grants check-in status on its own. | Must | T1 | PROPOSED |
| R-064 | Functional | The organiser sees a clear success, failure, or already-checked-in result immediately after each scan attempt. | Must | T1 | PROPOSED |

### 1.8 Push Notifications

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-070 | Functional | The app receives push notifications reliably on the device without requiring the app to be open or running in the foreground. | Must | T1 | PROPOSED |
| R-071 | Functional | Every notification a user currently receives through the existing web experience is also delivered through the app, with no notification type missing. | Must | T1 | PROPOSED |
| R-072 | Functional | Users can grant or deny notification permission, and the app continues to function normally (aside from not receiving notifications) if permission is denied. | Must | T1 | PROPOSED |
| R-073 | Functional | Tapping a notification takes the user directly to the relevant screen (event, fixture, approval item) it relates to, including when the app was not already open. | Must | T1 | PROPOSED |
| R-074 | Security | A device's notification registration is only accepted by the backend from a genuinely signed-in user, transmitted securely, and never accepted from an unauthenticated source. | Must | T1 | PROPOSED |
| R-075 | Functional | If a device's notification registration changes, the app updates the backend automatically without requiring the user to sign in again. | Should | T1 | PROPOSED |
| R-076 | Observability | Every notification sent to or acknowledged by the app can be traced back to the operational event that triggered it, consistent with how the backend already tracks dispatched notifications. | Should | T1 | PROPOSED |
| R-077 | Functional | On sign-out, the app shall notify the backend to stop sending push notifications to that device before clearing local session data, such that the signed-out user receives no further push notifications on that device. | Must | T1 | PROPOSED |

### 1.9 Admin Module

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-080 | Functional | Admin users can access sports management functions matching existing web admin scope. | Must | T1 | PROPOSED |
| R-081 | Functional | Admin users can access configuration/label management functions matching existing web admin scope. | Must | T1 | PROPOSED |
| R-082 | Security | Admin-only screens and actions are hidden from non-admins in the app, and separately, the backend independently refuses any admin action attempted by a non-admin regardless of what the app displays. | Must | T1 | PROPOSED |

### 1.10 Onboarding & Navigation

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-090 | Functional | Unauthenticated users see a landing/onboarding screen matching the intent of the existing web landing experience. | Must | T1 | PROPOSED |
| R-091 | Functional | Links shared to users (e.g., event invites, notification links) take them directly to the relevant screen in the app, even when the app was not already running. | Must | T1 | PROPOSED |
| R-092 | Functional | If an unauthenticated user follows a link into the app, they are prompted to sign in or register, and are then taken to the originally intended destination after doing so. | Should | T1 | PROPOSED |

### 1.11 Offline & Network Resilience

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-100 | Functional | The app detects loss of network connectivity and shows a clear offline state, rather than failing silently or showing an indefinite loading indicator. | Must | T1 | PROPOSED |
| R-101 | Functional | The most recently viewed event, tournament, and group information remains viewable while offline; any action that changes data (RSVP, check-in, edits) is disabled while offline rather than silently queued for later. | Must | T1 | PROPOSED |
| R-102 | Functional | If a request fails due to a temporary network problem, the app retries a bounded number of times and then shows a clear error if it still cannot succeed. | Should | T1 | PROPOSED |

### 1.12 Security & Boundary Validation

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-110 | Security | Every request from the app is independently checked and authorised by the backend using the same rules as the web experience; the app is never a trusted source of truth on its own. | Must | T1 | PROPOSED |
| R-111 | Security | User credentials, passwords, and check-in codes are never written to device logs, crash reports, or analytics in a readable form. | Must | T1 | PROPOSED |
| R-112 | Security | High-frequency user actions (such as repeated check-in attempts) remain protected against abuse at the point they reach the backend, regardless of how quickly the app allows a user to trigger them; the app additionally limits how fast a user can trigger such actions as a secondary safeguard. | Should | T1 | PROPOSED |
| R-113 | Observability | Every request the app makes to the backend can be traced end-to-end using a consistent tracking identifier, consistent with how the backend already tracks operations. | Must | T1 | PROPOSED |

### 1.13 App Store Compliance

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-120 | Compliance | The app accurately discloses to the marketplace what personal data it collects (identity information, location if used, camera use for check-in scanning). | Must | T1 | PROPOSED |
| R-121 | Compliance | The app requests only the device permissions it actually needs (camera, notifications), each with a justified and minimal scope. | Must | T1 | PROPOSED |
| R-122 | Compliance | A privacy policy is accessible both from within the app and from its marketplace listing, consistent with existing web privacy disclosures. | Must | T1 | PROPOSED |
| R-124 | Compliance | The app shall provide users with an in-app path to request permanent deletion of their account and all associated personal data, consistent with the mobile marketplace's data deletion policy. If this capability does not already exist in the backend, its addition is a mandatory backend scope item that must be completed before marketplace submission. | Must | T1 | PROPOSED |

### 1.14 Performance NFRs

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-130 | Non-Functional | The app becomes usable within 3 seconds of being opened, on the reference test device under typical network conditions. | Should | T1 | PROPOSED |
| R-131 | Non-Functional | A check-in scan produces a result within 2 seconds under typical network conditions. | Should | T1 | PROPOSED |
| R-132 | Non-Functional | Primary list and navigation screens scroll and transition smoothly on the reference test device. | Could | T1 | PROPOSED |

### 1.15 Testing & Coverage

| R-ID | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-140 | Testing | Sign-in and session-handling flows (Google, email/password, renewal, sign-out) are tested against failure and denial cases, not only the successful path, in proportion to their status as security-critical. | Must | T1 | PROPOSED |
| R-141 | Testing | Check-in scanning is tested against invalid codes, duplicate scans, and unauthorised scanning attempts, not only the successful path. | Must | T1 | PROPOSED |
| R-142 | Testing | Admin-only screens and actions are tested to confirm non-admin users are denied both visibly in the app and when the backend is called directly. | Must | T1 | PROPOSED |

---

## 2. Numbered Assumptions

1. Existing backend API contracts are stable and require no modification to serve the mobile client; any endpoint gap discovered during design is a scope change, not assumed away here.
2. The existing web experience's full notification catalogue is reproduced 1:1 for mobile; this brief does not enumerate individual notification types because that catalogue was not confirmed against DES-MEETUP-001 at drafting time.
3. Sign-in via Google on mobile will use platform-specific credentials distinct from the web experience's credentials, requiring new credential registrations for the Android app (see R-018). No new backend work is required for this — the mobile app is a new client against the existing OAuth-handling backend endpoint.
4. The existing web experience's email/password sign-in is assumed compatible with a fully in-app implementation without backend change.
5. The push notification integration is net-new and unrelated to any existing identity-provider project; expected usage at T1 scale (hundreds to low thousands of users) is assumed to sit comfortably within free-tier limits of whatever provider is selected at design time.
6. The event-scoped check-in token (`checkin_qr_token` on the `events` table) and its validation logic exist in the backend and are reused unmodified by the mobile client.
7. "Full parity" excludes any web-only affordance that has no mobile equivalent by platform convention (e.g., browser URL bar); such cases are resolved case-by-case during design.
8. Camera and notification permissions follow the current major Android permission model; no assumption is made about future OS permission changes.
9. The check-in validation endpoint `POST /events/{id}/checkin` is confirmed to exist in the backend (verified against DES-MEETUP.md and the running codebase). No backend scope change required.
10. Minimum supported Android version is set to Android 8.0 (API level 26). Devices below this version are out of scope for support.
11. The push notification delivery project is isolated from any existing identity provider project, with no shared quota or access permissions between them.

## 3. Non-Goals

1. An equivalent experience for Apple's mobile platform is explicitly out of scope for this brief; it is acknowledged as a future phase only, not specified here.
2. No backend API, schema, or access-control changes are in scope. Any backend change required to support mobile is a separate requirements change against REQ-MEETUP-001, not this document — except where an amendment explicitly names a mandatory backend scope addition (see R-124).
3. No reduction of feature scope relative to the existing web experience — this is not an MVP; partial-parity phasing is out of scope.
4. Offline write support (queued/sync-later changes) is explicitly out of scope — offline is read-only per R-101.
5. The existing web-based push notification mechanism is not retained on the mobile app; this brief does not specify a dual-channel fallback.
6. No sign-in method beyond Google and email/password is introduced in this release. Facebook OAuth is covered separately by Non-Goal 9.
7. No multi-tenant, white-label, or B2B distribution model is in scope — single marketplace listing, single brand.
8. Wearables, tablets, and foldable-specific layouts are not in scope.
9. Facebook OAuth (R-011) is deferred from this release. Re-entry trigger: Google OAuth is live and stable in production with no auth-related incidents for 30 days.

## 4. Success Criteria

1. All Must-priority requirements in this document are implemented and pass their associated negative and functional test cases.
2. The app is published to the target marketplace (at minimum, a closed testing track) and installs/runs correctly on the physical reference test device.
3. Every feature enumerated in the existing web experience's feature set maps to at least one R-ID in this document with no unmapped gap.
4. No P1–P17 principle is violated without a named, approved deviation recorded in this document.
5. Sign-in, check-in, and admin-gated flows pass adversarial and security test categories per the project's standard review conventions.
6. Push notification delivery is verified end-to-end (backend dispatch → device receipt → tap-through to correct screen) for at least one representative notification per type once the type catalogue is confirmed.

---

*REQ-MEETUP-MOBILE · APPROVED, architect-approved 2026-09-13 · Reconciliation pass (R-060/R-061 event-scoped rewrite, Assumption 9 closure, Assumption 6 update, R-011 deferral via Non-Goal 9, R-005 wording correction) applied, architect-directed, 2026-09-13 · This is the single canonical file — supersedes all prior divergent copies · Governance files (Enterprise_Design_Principles_v1.0.md, design-best-practices.md) confirmed in context at drafting.*
