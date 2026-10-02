# Proposed Amendments — DES-MEETUP-MOBILE.md, Part 2 (2026-09-24)

**Status**: PROPOSED ONLY. Not applied. Companion to
`doc-code-sync-audit-full-repo-20260924.md`. Two kinds of change are mixed
together in this domain, and this file deliberately treats them
differently:

1. **§F–§H below are status-flag amendments**, not implementation
   write-backs — they mark existing, confirmed-complete-sounding sections
   as not actually built (or not actually functional), without deciding
   *what happens next* (build it, defer it, or descope it). That decision
   is the architect's; these diffs only stop the document asserting
   something false in the meantime.
2. **§I–§J are ordinary write-backs**, same pattern as Part 1's §D/§E —
   shipped, working features with no design-doc record yet.

Do not apply §F–§H as a substitute for the architect's actual decision —
they are a stopgap so the document stops overstating status while that
decision is pending.

---

## §F. §4.13 / Executive Summary / §2.2 — flag account deletion as non-functional against the live backend

**Rationale**: `requestDeletion()`/`confirmDeletion()` call endpoints
confirmed (2026-09-18, unresolved as of this audit) to 404 on the real
backend. DES currently asserts R-031 is "already... designed... no
undocumented or additional backend change is required." That assertion is
false as of the last live check and should not stand unqualified while a
Must/Compliance requirement (R-124) is silently broken in production.

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ## 1. Executive Summary
 
 **What is being built**: a React Native (bare workflow) Android
 application, minimum API level 26, distributed via Google Play, that
 consumes the existing Meetup backend. The only backend-side changes
 supporting mobile launch are the two already-ratified, explicitly-named
 amendments (mobile push token registration, R-029/R-030; self-service
-account deletion, R-031) — per the corrected R-005, no undocumented or
-additional backend change is required.
+account deletion, R-031) — per the corrected R-005, no undocumented or
+additional backend change is required. **STATUS FLAG (2026-09-24, not yet
+architect-resolved)**: a live backend-contract check found
+`POST /users/me/deletion-request` and `POST /users/me/deletion-confirm`
+both return 404 on the real backend as of that check — R-031 may not
+actually be deployed, or may be deployed under a different path. Client
+code implementing this design (§4.13) is built and calls the paths named
+here; until this is resolved, treat R-124/R-031 as **NOT** satisfied
+end-to-end regardless of client-side completeness. See
+`docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md` and
+`docs/reports/doc-code-sync-audit-full-repo-20260924.md` §2.4.
```

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 4.13 App Store Compliance
 
 **Screens**: Privacy Policy viewer, Account Deletion flow.
 
 **API endpoints consumed**: `POST /users/me/deletion-request`,
 `POST /users/me/deletion-confirm`.
+
+**STATUS FLAG (2026-09-24)**: both endpoints above are confirmed absent
+(404) from the live backend schema as of the last check
+(`AUDIT-API-CONTRACTS-2026-09-18.md`; unresolved as of this amendment).
+Client implementation is complete and matches this section; the gap is
+entirely backend-side. Do not mark this section "implemented" in any
+status summary until re-verified live. This blocks Play Store submission
+per R-124's own text ("must be completed before marketplace submission").
 
 **Role/permission gates**: Any authenticated user, own account only.
```

---

## §G. §3.7 / §4.7 — correct "CLOSED"/"fully satisfied" to distinguish requirements-reconciliation from implementation

**Rationale**: "OI-7 CLOSED" and "Fully satisfied against the reconciled
REQ-MEETUP-MOBILE.md" are both true statements about *requirements
wording* (the organiser-displays/participant-scans actor model matches the
backend schema) but are being read — reasonably, given the phrasing — as
statements about *implementation status*. No QR check-in code exists
anywhere in `src/` (confirmed by repo-wide grep; dependencies
`react-native-qrcode-svg`/`react-native-vision-camera` are installed but
unused). This diff does not remove the OI-7 closure (the wording
reconciliation is real and should stay closed) — it adds the missing
implementation-status fact alongside it.

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 3.7 QR Display and Scan (R-060–R-064) — RECONCILED, OI-7 CLOSED
 
+**IMPLEMENTATION STATUS FLAG (2026-09-24)**: OI-7's closure above
+resolved a *requirements-wording* question (actor-role model vs. the
+backend schema) — it did not build this feature. As of this flag, **no
+QR check-in code exists in the mobile codebase**: no screen, no
+`checkin`/`qrcode`/camera usage anywhere in `src/`, despite
+`react-native-qrcode-svg` and `react-native-vision-camera` being
+installed as dependencies (unused). Do not read "RECONCILED, OI-7 CLOSED"
+as "implemented." See
+`docs/reports/doc-code-sync-audit-full-repo-20260924.md` §2.1.
+
 **Decision**:
 - **Display (R-060)**: the **organiser** retrieves and displays the
   event's check-in code via `GET /events/{id}/checkin-qr`
```

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 4.7 QR Code Check-In — RECONCILED, OI-7 CLOSED
 
 **Screens**: Organiser "Display Check-In Code" view (within Event
 Detail), Participant "Scan to Check In" camera screen, Scan Result
 overlay.
 
 **API endpoints consumed**: `POST /events/{id}/checkin`,
 `GET /events/{id}/checkin-qr` (organiser-only display path).
 
 **Role/permission gates**: Displaying — organiser only. Scanning — any
 authenticated participant with a `going` RSVP status.
 
-**Conformance status**: **Fully satisfied against the reconciled
-REQ-MEETUP-MOBILE.md.** R-060 (organiser displays) and R-061
-(participant scans) are both matched exactly by this design, verified
-independently against the backend schema across multiple review rounds
-before the requirement wording itself was corrected to align.
+**Conformance status (design-level)**: **Fully satisfied against the
+reconciled REQ-MEETUP-MOBILE.md** — the design's actor-role model (R-060
+organiser displays, R-061 participant scans) matches the backend schema.
+**Implementation status: NOT BUILT (flagged 2026-09-24).** None of the
+three screens above, nor either endpoint, exist in the mobile codebase
+today. This is a design-conformance statement, not a claim that check-in
+works on-device.
```

---

## §H. §4.6 / §4.9 — flag Committee Governance and Admin Module as fully specified but unbuilt

**Rationale**: both sections are written in full present-tense detail (screens,
endpoints, role gates, error cases) with no "not yet built" signal
anywhere, and §2.1 lists both as flatly "In Scope." Zero corresponding
code exists for either. Same treatment as §G — flag, don't rewrite the
design content, since the design itself may still be exactly what gets
built.

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 4.6 Organising Committee Governance
 
+**IMPLEMENTATION STATUS FLAG (2026-09-24)**: no code implementing any
+part of this section exists in the mobile codebase as of this flag — no
+screens, no calls to any `/tournaments/{id}/committee/*` endpoint. This
+design content is believed still current/desired; it has simply not been
+built yet. Remove this flag once implementation lands, or convert this
+section to an explicit deferral (with a Non-Goal entry in
+REQ-MEETUP-MOBILE.md) if it is being pushed to a later phase.
+
 **Screens**: Committee tab (within Tournament Detail, per DES-MEETUP.md
 §4.12's explicit design), Committee Members list, Pending Actions queue,
 Step-Up Challenge Modal, Submit Action sheet.
```

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 4.9 Admin Module
 
+**IMPLEMENTATION STATUS FLAG (2026-09-24)**: no code implementing any
+part of this section exists in the mobile codebase as of this flag. The
+app currently consumes only the two *unauthenticated* endpoints this
+section itself distinguishes (`GET /admin/sports/public`, `GET
+/api/labels`) for read-only pickers elsewhere in the app (Create
+Game/Group, Profile) — not the admin-gated CRUD screens described below.
+Remove this flag once implementation lands, or convert to an explicit
+deferral if pushed to a later phase.
+
 **Screens**: Admin Home, Approval Queue, Sports List/CRUD form, Platform
 Config screen, UI Labels management screen.
```

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 2.1 In Scope
 
 - Organising Committee maker-checker governance actions and step-up
-  challenge flow (§4.6).
-- Admin sports CRUD and platform config/UI label management (§4.9).
+  challenge flow (§4.6). **Designed, not yet implemented as of
+  2026-09-24 — see §4.6's status flag.**
+- Admin sports CRUD and platform config/UI label management (§4.9).
+  **Designed, not yet implemented as of 2026-09-24 — see §4.9's status
+  flag.**
```

---

## §I. §4.3 — flag "Cancel Event" as currently unavailable, and §7.4's cancel row

**Rationale**: the Cancel button was deliberately removed from the UI
(commit `454c038`, architect-directed) because the real
`POST /events/{id}/cancel` requires a `reason` (1–500 chars, required)
with no client UI to collect it yet. §4.3's role/permission line currently
implies Cancel is available.

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 4.3 Event Management
 
 **Role/permission gates**: Create — any authenticated user.
-Edit/Cancel/manual participant management — organiser only.
+Edit/manual participant management — organiser only. **Cancel is
+currently hidden from the UI entirely (architect-directed, 2026-09-24)**
+— the real `POST /events/{id}/cancel` requires a required `reason` field
+(1–500 chars) with no cancellation-reason UI built yet. Re-enable this
+line once that UI ships.
```

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 7.4 Events
 
-| POST | `/events/{id}/cancel` | Yes | Organiser only |
+| POST | `/events/{id}/cancel` | Yes | Organiser only; requires `reason` (1–500 chars, required) — **not currently callable from the UI, button hidden pending a reason-entry screen (2026-09-24)** |
```

---

## §J. New §4.18 App Update Gate, and new §7.11 Platform / App table

**Rationale**: folds in the shipped force-update mechanism
(`ForceUpdateScreen.tsx`, `useForceUpdate.ts`, `ForceUpdateGate.tsx`,
`versionPolicy.ts`, commit `29b6243`). No existing REQ-MEETUP-MOBILE.md
requirement covers minimum-version enforcement at all — recommend a new
R-170 there in addition to this DES section.

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 4.17 Home — Event Feed and Sport Filter
 
 [... §4.17 content from Part 1 §E ...]
+
+### 4.18 App Update Gate
+
+**Screens**: Force Update (`ForceUpdateScreen.tsx`) — a full-screen,
+non-dismissible blocking view shown when the installed app version falls
+below the backend's declared minimum.
+
+**API endpoints consumed**: `GET /app/version-policy`.
+
+**Behaviour**: checked on cold start (`useForceUpdate` hook,
+`ForceUpdateGate` wrapping the navigation root). If the installed
+`versionCode` is below the policy's minimum, the Force Update screen
+replaces the entire app UI (no navigation escape) with an update
+prompt/store link; otherwise the app proceeds normally. No caching of the
+policy response beyond the current app session (re-checked each cold
+start).
+
+**Role/permission gates**: none — applies to all users, pre- and
+post-authentication.
+
+**Error/edge cases**: policy check failure (network/5xx) — fails open
+(does not block the app) rather than fails closed, so a backend outage
+cannot lock out every user; confirm this against the actual
+`useForceUpdate.ts` behaviour before relying on this line (added from
+inspection, not independently re-verified against a live failure case in
+this pass).
+
+**Offline behaviour**: requires connectivity for the check itself; see
+Error/edge cases for the fail-open behaviour when connectivity is
+absent.
```

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 7.10 Admin — Sports and Config
 
 | GET | `/api/labels` | No | Runtime label-serving, separate integration point |
 
 ---
 
+### 7.11 Platform / App
+
+| Method | Path | Auth Required | Notes |
+|---|---|---|---|
+| GET | `/app/version-policy` | No | Drives the force-update gate, §4.18. Fail-open on failure — unverified, flag for confirmation. |
+
+---
+
 ## 8. Testing Strategy
```

---

## §K. New §4.19 Notification History, and §7.6 row

**Rationale**: folds in the shipped bell-badge/history feature
(`NotificationHistoryScreen.tsx`, `getNotificationHistory()`, route
`NotificationHistory` in `RootNavigator.tsx`).

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 4.8 Push Notifications
 
-**Screens**: Notification Permission rationale, Notification Preferences.
+**Screens**: Notification Permission rationale, Notification Preferences,
+Notification History (bell icon with unread-count badge — see §4.19).
```

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 4.18 App Update Gate
 
 [... §4.18 content from §J above ...]
+
+### 4.19 Notification History
+
+**Screens**: Notification History (`NotificationHistoryScreen.tsx`),
+reached via a bell icon carrying an unread-count badge, shown app-wide
+in the header.
+
+**API endpoints consumed**: `GET /notifications/history` — paginated,
+`next_cursor`-based (cursor = `created_at` of the last item on the page).
+
+**Behaviour**: newest-first list of all notifications the account has
+received (not just push-delivered ones), with read/unread state.
+Tapping an item navigates the same way a live push tap would (§3.1,
+§4.8's deep-link table), via `notification_type`/`entity_id` — both
+nullable on this endpoint's response shape, so callers must guard before
+routing (unlike the always-present fields on a live FCM payload).
+
+**Role/permission gates**: any authenticated user, own notifications
+only.
+
+**Offline behaviour**: last-fetched page viewable per §3.8; pagination
+requires connectivity.
```

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 7.6 Notifications
 
 | Method | Path | Auth Required | Notes |
 |---|---|---|---|
 | GET | `/notifications/vapid-public-key` | No | Not used by mobile — Web Push only |
 | POST | `/notifications/subscriptions` | Yes | Not used by mobile — Web Push only |
 | DELETE | `/notifications/subscriptions/{id}` | Yes | Not used by mobile — Web Push only |
+| GET | `/notifications/history` | Yes | Paginated (`next_cursor`), §4.19. `notification_type`/`title`/`body`/`entity_id`/`entity_type` all nullable on this endpoint — unlike the FCM payload shape |
 | GET | `/notifications/preferences` | Yes | |
```

---

## Summary of what NOT to do with this file

Do not apply §F–§H as if they resolve the underlying problems — they only
stop the document lying about status while it's pending a real decision.
In particular:
- §F (account deletion): needs a **backend-team confirmation**, not a doc
  edit, to actually close. The doc flag is a stopgap.
- §G (QR check-in): needs an **architect decision** on whether this ships
  before GA or gets a Non-Goal deferral entry — either way, someone has to
  decide, not just note the gap.
- §H (Committee/Admin): same — these may simply be later-phase work
  correctly scoped into the design early; the flag exists so nobody reads
  "In Scope" + a fully-detailed section as "already built."

§I–§K are ordinary, safe write-backs (shipped, working, no open decision
needed) and can be applied on the same pass as Part 1's §A–§E.
