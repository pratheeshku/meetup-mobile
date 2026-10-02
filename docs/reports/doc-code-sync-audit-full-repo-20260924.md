# Documentation–Code Synchronization Audit — Full-Repository Pass (Part 2)

**Date**: 2026-09-24 (same day as Part 1)
**Repo**: `pratheeshku/meetup-mobile`, audited at `main`/`claude/focused-ramanujan-2jf7v0`
@ `8b147f8`
**Mode**: Read-only. No file under `docs/` and no application code modified.
**Scope**: requested follow-up — a full-repository pass (every screen, every
API module, every navigation route) against `DES-MEETUP-MOBILE.md`, using
all 60 `.md` files under `docs/` as context, superseding the narrower
checklist in Part 1 (`doc-code-sync-audit-20260924.md`, still valid — this
file adds to it, it does not replace it).

**Direction of this pass**: primarily code→doc (is everything in code
represented in the design?), but the full-repo sweep surfaced the reverse
direction too — entire sections of the design document describing features
that do not exist in code at all, in some cases explicitly marked
"CLOSED"/"fully satisfied." Both directions are reported below, ranked by
severity, because the doc→doc-ahead-of-code findings are materially more
important than anything in Part 1.

---

## 0. Two explicit follow-ups from the triage message

### 0.1 Backend live-check (`~/meetup`, `MobilePushTokenRegisterRequest`) — NOT RUN, out of session scope

This session cannot execute that check. `~/meetup` does not exist on this
container's filesystem (only `meetup-mobile` is checked out), and this
session's GitHub access is scoped to `pratheeshku/meetup-mobile` only — no
backend repository is attached. This has to be dispatched to a session
that has the backend repo (either `pratheeshku/meetup` added via
`add_repo` in a session with that authorization, or a session already
running against a local backend checkout). Not attempting it from here
rather than guessing at an answer.

### 0.2 DES header/changelog line and current highest R-IDs

**`docs/DES-MEETUP-MOBILE.md` header** (verbatim, lines 1–9):
```
# DES-MEETUP-MOBILE — Meetup Android Mobile App: Solution Design

**Doc ID**: DES-MEETUP-MOBILE
**Status**: APPROVED — architect-approved 2026-09-13; Create-flow
amendment (§4.3/§4.5) architect-approved 2026-09-22
**Tier**: T1
**Requirements Baseline**: REQ-MEETUP-MOBILE — reconciled, single canonical file (APPROVED, architect-approved 2026-09-13; R-005 corrected 2026-09-13)
**Parent Backend Design**: DES-MEETUP.md (DES-MEETUP-001), v1.66, APPROVED
**Governing Files**: Enterprise_Design_Principles_v1.0.md (P1–P17), design-best-practices.md (BP-01–BP-13) — both confirmed in context at drafting time.
```
No changelog/version-history table exists in this file today (unlike the
backend `DES-MEETUP-001`, which the two standalone addenda cite as having
v1.70/v1.71-style dated entries) — the "Status" line above is the only
place amendment dates are recorded. Any amendment applied per this or the
Part 1 report should be the first such changelog entry, or should extend
the "Status" line the same way the 2026-09-22 Create-flow amendment did.

**Highest existing R-IDs** (`grep -oE "R-[0-9]+" docs/REQ-MEETUP-MOBILE.md | sort -t- -k2 -n -u | tail -5`):
```
R-131
R-132
R-140
R-141
R-142
```
Recommend **R-150** and **R-160** for the two pending addenda (leaving
R-143–149 free rather than crowding them into the 1.15 Testing block,
since neither new requirement is a testing requirement) — see §4 below for
the reasoning on numbering and two more candidates this pass surfaced.

---

## 1. Method for this pass

- Enumerated every file in `src/screens/`, `src/api/`, `src/navigation/`,
  and every registered route in `RootNavigator.tsx`.
- For each, grepped `DES-MEETUP-MOBILE.md` for the corresponding feature
  name, screen name, or endpoint path.
- For each of DES §4.1–§4.15's screens and §7's endpoint tables, grepped
  `src/` for a corresponding implementation.
- Cross-checked every "BLOCKED"/"CRITICAL" code comment currently present
  in `src/api/*.ts` against `docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md`
  (the live-schema audit those comments originate from) to determine which
  are still open six days later, as of this audit.
- Checked `package.json` for native dependencies implied by DES features
  (`react-native-vision-camera`, `react-native-qrcode-svg`) against actual
  usage in `src/`.

---

## 2. NEW findings — doc describes features that do not exist in code

These are more severe than anything in Part 1: DES doesn't just omit
detail about something built, it asserts completion of things that were
never built.

### 2.1 QR Code Check-In (§3.7, §4.7) — **CRITICAL: zero implementation exists**

DES states, in two places, that this feature is done:
- §3.7 header: *"QR Display and Scan (R-060–R-064) — **RECONCILED, OI-7
  CLOSED**"*
- §4.7 header: *"QR Code Check-In — **RECONCILED, OI-7 CLOSED**"*, with
  *"**Conformance status**: Fully satisfied against the reconciled
  REQ-MEETUP-MOBILE.md."*

Actual code:
```
$ grep -rli "checkin\|qrcode\|vision-camera\|VisionCamera\|useCodeScanner" src/
(no matches)
```
No screen, no component, no API call, no route for `GET
/events/{id}/checkin-qr` or `POST /events/{id}/checkin` exists anywhere in
`src/`. `react-native-qrcode-svg` and `react-native-vision-camera` **are**
present in `package.json` (matching `CLAUDE.md`'s own Stack Gotchas note
that vision-camera was deliberately pinned to v4), but neither is imported
by any file in `src/`. `CLAUDE.md`'s own gotcha entry says as much:
*"no QR-scan screen exists yet to need it (scaffold only, per rule)"* and
*"`android.permission.CAMERA` is not yet declared... no QR-scan screen
exists yet to need it."*

**This is the single largest gap in the entire audit.** "OI-7 CLOSED" and
"Fully satisfied" describe a *requirements-wording* reconciliation (the
organiser-displays/participant-scans actor model matching the backend
schema) — they do not mean the feature was built, and the doc does not
distinguish the two. A reader of §4.7 in isolation would reasonably
believe check-in works today; it does not exist at all.

### 2.2 Organising Committee Governance (§4.6) — **HIGH: zero implementation exists**

DES §4.6 specifies five screens (Committee tab, Committee Members list,
Pending Actions queue, Step-Up Challenge Modal, Submit Action sheet),
eight API endpoints, a challenge→verify→submit/approve sequencing model,
and specific error/edge cases (expired token, wrong-action replay,
non-member access). §2.1 lists it as flatly "In Scope."

Actual code: no file under `src/` references `committee` except a single,
unrelated comment in `src/api/users.ts` documenting how the *admin sports
endpoint* was verified (mentions "committee-governance and admin
sports/config endpoint paths" only as a citation of the design doc's own
provenance note — not committee feature code). No screens, no API calls
to any `/tournaments/{id}/committee/*` path anywhere in `src/api/`.

### 2.3 Admin Module (§4.9) — **HIGH: zero implementation exists**

DES §4.9 specifies five screens (Admin Home, Approval Queue, Sports
List/CRUD, Platform Config, UI Labels), platform dual-admin approvals,
sports CRUD, config/label management, all admin-gated.

Actual code: the app calls exactly two of §4.9's *unauthenticated*
endpoints — `GET /admin/sports/public` (sport pickers in
`CreateGameScreen`/`CreateGroupScreen`/`ProfileScreen`) and (per the
labels work) presumably `GET /api/labels` — both explicitly called out in
DES itself as "unauthenticated by design," i.e. **not** the admin-gated
CRUD surface §4.9 actually describes. No Admin Home, no Approval Queue, no
Sports CRUD form, no Platform Config screen, no UI Labels screen, no
`/admin/approvals/*` call, anywhere in `src/`.

### 2.4 Account Deletion (§4.13, R-124, R-031) — **CRITICAL: implemented client-side, confirmed non-functional against the live backend**

This one is different in kind from 2.1–2.3: the mobile *code* is built —
`requestDeletion()`/`confirmDeletion()` in `src/api/profile.ts`, wired
into `ProfileScreen.tsx`'s account-deletion flow — matching DES §4.13
exactly. The gap is that `docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md`
(live OpenAPI schema audit, six days before this pass) found, and the
still-present code comments in `src/api/profile.ts` (lines 150–169, dated
today, unchanged since) confirm:

> "confirmed against the live OpenAPI schema that neither
> `/users/me/deletion-request` nor `/users/me/deletion-confirm` exists on
> the real backend at all — not a field mismatch, the paths themselves
> 404... Nothing in the live schema suggests an alternative account
> -deletion mechanism."

This is marked `BLOCKED — CRITICAL` in the source itself, not resolved as
of this audit. It directly contradicts:
- DES's Executive Summary: *"The only backend-side changes supporting
  mobile launch are the two already-ratified, explicitly-named amendments
  (mobile push token registration, R-029/R-030; **self-service account
  deletion, R-031**)... per the corrected R-005, no undocumented or
  additional backend change is required."*
- §2.2's Out of Scope list, which names R-031 as "already designed in
  DES-MEETUP.md and explicitly named in REQ-MEETUP-MOBILE, not an
  undocumented dependency."
- REQ-MEETUP-MOBILE.md R-124 (Must, Compliance): *"If this capability
  does not already exist in the backend, its addition is a mandatory
  backend scope item that must be completed before marketplace
  submission."* — the live evidence says it does not exist.

**This is a live production/compliance risk, not just a doc-sync issue**:
R-124 is a Google Play data-deletion policy requirement (R-120–R-124,
§1.13 App Store Compliance), and the feature is currently non-functional
end-to-end. It should be escalated ahead of any cosmetic doc amendment.

### 2.5 "Cancel Event" is currently hidden entirely from the UI — doc doesn't reflect this

§4.3's role/permission gates state: *"Edit/Cancel/manual participant
management — organiser only,"* implying Cancel is an available organiser
action today. Per `docs/reports/IMPL-DES-MEETUP-MOBILE-rsvp-withdraw-fix.md`
(commit `454c038`) and the current `src/api/events.ts` comment (lines
205–216), the real `POST /events/{id}/cancel` requires a `reason` field
(1–500 chars) with no client UI to collect it, so **the Cancel Event
button was deliberately removed from the UI entirely** ("architect
-directed") pending that UI. §4.3's "Edit/Cancel... organiser only" line
is therefore currently inaccurate for Cancel specifically (Edit and manual
participant management are unaffected).

---

## 3. NEW findings — code exists, doc silent (code-ahead-of-doc, additional to Part 1)

### 3.1 Force-Update Gate — entirely undocumented

`ForceUpdateScreen.tsx`, `useForceUpdate.ts`, `ForceUpdateGate.tsx`,
`versionPolicy.ts` (commit `29b6243 feat(update): force-update gate driven
by GET /app/version-policy`) implement an app-wide gate that blocks usage
below a minimum version. `GET /app/version-policy` does not appear
anywhere in `DES-MEETUP-MOBILE.md` §7 (no "App" or "Platform" subsection
exists there at all), and no screen inventory entry exists for it in §4.
This is a whole app-level control mechanism with no design-doc record.

### 3.2 Notification History screen / `GET /notifications/history` — undocumented

`NotificationHistoryScreen.tsx` and `getNotificationHistory()` in
`src/api/notifications.ts` (bell unread-badge + history list, commits
`7dd908f`, `173af3a` and the history-specific implementation report) are
live and routed (`RootNavigator.tsx`'s `NotificationHistory` route). §4.8's
screen list names only "Notification Permission rationale, Notification
Preferences" — no History screen. §7.6's Notifications table lists
`vapid-public-key`, `subscriptions` (both explicitly "not used by
mobile"), `preferences`, and `mobile-subscriptions` — no
`/notifications/history` row.

---

## 4. R-ID / section numbering recommendation, consolidated

Building on Part 1's §D/§E (R-150 skill-level delete, R-160 sports-filter
pre-select), this pass adds two more undocumented-but-shipped areas that
need their own R-ID/section once triaged by the architect (distinct from
the CRITICAL findings in §2, which need a decision before any doc
amendment, not just a write-back):

| Proposed ID | Feature | Note |
|---|---|---|
| R-150 | Skill-level delete (Part 1 §D) | Already implemented, addendum APPROVED |
| R-160 | Home sport-filter pre-select (Part 1 §E) | Already implemented, addendum APPROVED |
| R-170 (new) | Force-update / minimum-version gate | Implemented; no requirement or design section exists for it at all today — this is a gap in REQ, not just DES |
| R-180 (new) | Notification history / bell badge | Implemented; §4.8/§7.6 write-back only (R-071/R-076 arguably already cover the *intent*, but no screen or endpoint is named) |

R-124/R-031 (§2.4) and the two entirely-unbuilt feature areas (§2.1–2.3)
are **not** write-back candidates — they need an architect/product
decision on disposition (build it, formally defer it with a Non-Goal
update, or correct the doc's "CLOSED"/"fully satisfied" claims to
"designed, not yet implemented") before any diff is proposed against them.
Proposing amendment text for those three would risk asserting a status
the architect hasn't actually decided on, which is why no diff is
included in the companion Part 2 amendments file for §2.1–2.4 — only a
recommended doc-status correction (see companion file).

---

## 5. Severity-ranked summary (all findings, Part 1 + Part 2)

| # | Finding | Direction | Severity |
|---|---|---|---|
| 1 | Account deletion (R-124/R-031) calls 404 endpoints in production | Code built, backend missing | **CRITICAL** |
| 2 | QR Check-In (§3.7/§4.7) marked "CLOSED"/"fully satisfied," zero code exists | Doc claims completion; unbuilt | **CRITICAL** |
| 3 | Organising Committee Governance (§4.6) fully specified, zero code exists | Doc-ahead-of-code | **HIGH** |
| 4 | Admin Module (§4.9) fully specified, zero code exists | Doc-ahead-of-code | **HIGH** |
| 5 | "Cancel Event" hidden from UI entirely, doc implies it's available | Doc stale vs. current UI | **MEDIUM** |
| 6 | Groups/Team toggle, captain auto-assign, UserSearchPicker (§4.4) | Code-ahead-of-doc | Medium (Part 1) |
| 7 | Android applicationId/"Shuttlr" identity | Code-ahead-of-doc | Medium (Part 1) |
| 8 | 3 notification types missing from §4.8 + stale §5.17 ref | Code-ahead-of-doc + doc defect | Medium (Part 1) |
| 9 | Force-update gate — no REQ or DES entry at all | Code-ahead-of-doc | Medium (new) |
| 10 | Notification History screen/endpoint undocumented | Code-ahead-of-doc | Medium (new) |
| 11 | Two APPROVED addenda (skill-level delete, sports-filter preselect) unmerged | Process gap | Low–Medium (Part 1) |
| 12 | Conformance review never run, repo-wide | Process gap | Structural (Part 1) |
| 13 | Priority finding: "two device_id implementations" | Premise false | Retracted (Part 1) |

Items 1–4 are recommended as the next thing put in front of the architect
— they are materially different from the rest of this audit (a live
compliance/functionality gap and two entire feature areas presented as
built when they are not), whereas items 5–12 are the kind of steady
doc-drift this project's own addendum process already has a template for
closing.

---

## 6. Could not verify (this pass)

- Same three items as Part 1 §4 (Play Console state, on-device Keychain
  behavior, an out-of-repo second `device_id` implementation).
- Whether `GET /app/version-policy` (§3.1 new finding) is itself
  confirmed live against the real backend, or an assumed contract — no
  live-schema check was re-run for it in this pass; recommend the same
  live-`curl`-and-compare treatment every other endpoint in this repo has
  already received (`AUDIT-API-CONTRACTS-2026-09-18.md`'s own method).
- Whether the backend actually has *no* account-deletion mechanism at all
  (§2.4) or one under an undiscovered path — the 2026-09-18 audit checked
  "the full 123-path listing" at that time; the live schema may have
  changed since (the push-registration endpoint did, per Part 1's
  Priority Finding evidence) and deserves the same kind of re-check before
  this is escalated as unconditionally CRITICAL rather than "CRITICAL as
  of the last live check, six days ago."

---

*Companion file*: `docs/reports/proposed-DES-MEETUP-MOBILE-amendments-part2-20260924.md`.
