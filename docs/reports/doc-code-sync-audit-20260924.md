# Documentation–Code Synchronization Audit — Meetup Mobile

**Date**: 2026-09-24
**Repo**: `pratheeshku/meetup-mobile` (audited on `main` @ `af8121a`)
**Mode**: Read-only audit. No file under `docs/` and no application code was
modified as part of this audit. This report and its companion amendments
file are new files under `docs/reports/`, consistent with this repo's
existing convention (every prior implementation/status report lives there).
**Auditor**: Claude (single pass, no self-certification — this session did
not write any of the code or docs it is auditing).

---

## 0. Priority Finding — device_id / deviceId.ts (RESOLVED FIRST, per brief)

**The premise in the task brief does not match this repository's actual
state.** There are not two independent `device_id` implementations. There
is exactly one.

### What the brief asserted
- A reviewed branch `fix/mobile-push-token-device-id`, commits `464c3e1` /
  `91f6d5f`, using `react-native-device-info`.
- A **separate**, pre-existing, **unreviewed** `deviceId.ts` module "with
  apparent caching," already merged to `main` and already shipped in the
  live **versionCode-14** AAB on Play Internal Testing — implying a
  functional conflict between the two (caching vs. no-caching).

### What the git history actually shows

```
$ git rev-list --all | grep -E "^464c3e1|^91f6d5f"
(no output)
$ git log --all --oneline --grep="464c3e1\|91f6d5f"
(no output)
$ git branch -a | grep -i "device-id"
(no output)
$ git log --all --oneline --follow -- '**/deviceId.ts'
bb5031b fix(notifications): device-scoped push token registration to stop duplicate pushes
```

- Commit hashes `464c3e1` and `91f6d5f` **do not exist anywhere** in this
  repository — not in any branch, not in the reflog, not as a dangling
  object reachable from any ref.
- A branch named `fix/mobile-push-token-device-id` **does not exist** —
  not locally, not on `origin`, not in the reflog.
- `src/notifications/deviceId.ts` has **exactly one** commit in its entire
  history: `bb5031b8e6850703fee8491b7e21ff531d182622`, authored by
  Pratheesh (`pratheeshknow@gmail.com`), committed **2026-09-24 19:30:33
  +0800**, message `fix(notifications): device-scoped push token
  registration to stop duplicate pushes`. It was committed straight onto
  the mainline (no merge commit, no separate feature branch reachable in
  this repo's history) and is co-authored by Claude Sonnet 5. It **is**
  the implementation using `react-native-device-info` (`getAndroidId()`,
  `Settings.Secure.ANDROID_ID`) that the brief describes as "(a)".
- There is no second file, no second commit, and no second code path
  anywhere in git history that reads or sends a device identifier for push
  registration. `git log --all --diff-filter=A -- '*deviceId*'` returns
  only `bb5031b`.

### The "already shipped in versionCode-14" claim, checked directly

`android/version.properties` bump history (each commit's parent chain,
newest→oldest):

| Commit | Date | versionCode | Parent |
|---|---|---|---|
| `a2661da` | 2026-09-24 20:49:56 +0800 | 14→15 ("device-id push fix") | `34b2072` |
| `34b2072` | 2026-09-24 20:36:53 +0800 | 13→14 | `bb5031b` |
| `bb5031b` | 2026-09-24 19:30:33 +0800 | (adds `deviceId.ts`; does not touch `version.properties`) | `bc3d58b` |

`git merge-base --is-ancestor bb5031b 34b2072` → true: **`bb5031b` (the
commit that introduces `deviceId.ts`) is an ancestor of the commit that
bumped `versionCode` to 14.** There is no commit anywhere in this repo's
history that sets `versionCode=14` on a tree *without* `deviceId.ts`. If a
versionCode-14 AAB was actually built and uploaded from this repository,
the only `deviceId.ts` it could have contained is the same one shipped at
15 — there is no earlier, different module for it to have carried.

### Conclusion

No conflict exists to resolve because there is only one implementation.
The scenario described in the brief (two independently-built device-id
mechanisms, one unreviewed and already live with caching behavior, the
other newly reviewed and cache-free) is **not supported by any evidence in
this repository's git history** and should not be acted on as if it were
real. If the requester has evidence of this second implementation living
somewhere else (a different clone, an unmerged local branch never pushed,
a different repository), that evidence was not reachable from
`pratheeshku/meetup-mobile` as checked out for this audit and needs to be
supplied directly (patch, bundle, or pushed branch) before it can be
compared here.

One accurate, lower-severity note *is* worth carrying forward from the
brief's underlying concern: `bb5031b` was committed directly to the
mainline with no PR/branch-based review step visible in git history (no
merge commit, no review artifact beyond its own self-authored
Implementation Report, `docs/reports/IMPL-BUGFIX-push-device-scope-2026-09-24.md`,
which is explicit that it is "author's own account, not a certification").
That report itself flags, unresolved: the backend does not yet accept
`deviceId` on `POST /notifications/mobile-subscriptions` (verified live,
2026-09-24 — field absent from `MobilePushTokenRegisterRequest`), so the
fix is currently inert in production regardless of client-side
correctness. That is a real, currently-open gap — just not the one the
brief described.

---

## 1. Method

Every §-numbered section of `DES-MEETUP-MOBILE.md` and every R-ID in
`REQ-MEETUP-MOBILE.md` was checked against the corresponding screen/module
in `src/`. Every screen/feature found in `src/screens/`,
`src/notifications/`, `src/navigation/` was checked for a corresponding
requirement/design section. All 60 `.md` files under `docs/` (both design
docs, both standalone addenda, the one RCA, and all 55 files under
`docs/reports/`) were read or grepped. `git log --all`, `git branch -a`,
and the full commit graph were inspected for the specific commits/branches
named in the brief and for the general merge history of the features
listed below.

---

## 2. Status by checklist item

### 2.1 Accept/Decline direct-from-notification — **doc and code agree; no gap**

`DES-MEETUP-MOBILE.md` §4.8's notification→deep-link table routes every
invitation-type notification (`event_invite`, `group_invite`,
`team_invite`) to its **detail screen in a "pending invitation state,"**
never to an in-tray accept/decline action. A repo-wide search of
`DES-MEETUP-MOBILE.md` for "Accept"/"Decline" returns zero hits outside
unrelated text ("Accepted T1 residual risk"). The doc has never described
direct-from-notification accept/decline.

Code confirms the same: `eventNotificationHandler.ts` (`group_event_created`,
`event_changed`) and `participantHandler.ts` (`event_participant_added`/
`removed`) both implement **Join / View + OK** action buttons, and the
code comments and `docs/reports/INV-DES-MEETUP-MOBILE-notify-kit-direct-accept.md`
are explicit that Join/View are **navigation-only** — they call
`navigateToNotificationTarget(...)`, never an RSVP or invitation
accept/decline endpoint. A same-day investigation into making Join a real
accept-RSVP call was run and **explicitly rejected for now** (Keychain
read/write behavior under a headless handler while the device is locked is
unverified; R-101's offline gate has no implementation in any context; iOS
background execution is unconfirmed) — recorded as a CRITICAL/HIGH gap
routed back to the architect, not built around.

**Verdict**: doc wording matches reality. No amendment needed here.

### 2.2 Create flow (Game+Tournament toggle) — **already written into the doc; not blocked**

`DES-MEETUP-MOBILE.md`'s header states "Create-flow amendment (§4.3/§4.5)
architect-approved 2026-09-22," and §4.3 contains a full "Create Flow
Amendment (architect-approved 2026-09-22)" subsection describing exactly
the shipped behavior: FAB → Create Game / Create Group only;
`CreateGameScreen.tsx` as one screen with a Casual Game | Tournament
segmented toggle (default Casual Game); the field sets and submit targets
for each mode; and the deliberate removal of the `group_stage` Format chip
(documented as a bug fix, not a regression). This matches
`d08bc47 feat(create-flow): merge Casual Game/Tournament creation into one
screen` and the earlier design-merge commit `7a9c4d6`/`fab9855`.

**Verdict**: not a gap. The brief's assumption that this might "still be
blocked" is stale — it was closed on 2026-09-22, two days before this
audit.

### 2.3 §4.4 Groups-create (Players Group / Tournament Team, captain auto-assign, UserSearchPicker, sport-label-map) — **CODE-AHEAD-OF-DOC (confirmed gap)**

Code (`src/screens/CreateGroupScreen.tsx`, commit `f8efd71 feat(groups):
add Players Group / Tournament Team toggle to CreateGroupScreen`) has, on
`main`, a single screen with a **Players Group | Tournament Team** toggle,
distinct submit targets (`POST /groups` vs `POST /teams`), a self-contained
`TeamVisibility` enum (`public`/`private`, deliberately not aliased to
Event or Tournament visibility), and an explicit comment that "Captain is
NOT a form field — backend auto-assigns to the creator."

`DES-MEETUP-MOBILE.md` §4.4 ("Groups & Teams") still describes only the
pre-toggle screen inventory (Group List, Group Detail, **Create Group**,
Team List, Team Detail, **Create Team** — as two separate screens) with no
mention of a toggle, no mention of captain auto-assignment, no mention of
`TeamVisibility`, and no mention of `UserSearchPicker` (grep for all of
these terms across `DES-MEETUP-MOBILE.md`: zero hits).

The implementation's own report,
`docs/reports/implementation-report-create-group-2026-09-23.md`, states
this explicitly as a known gap: *"§4.4 not yet amended. The task spec is
the authoritative source for this build; the doc amendment will be made
separately by the architect."* That amendment has not happened as of this
audit (2026-09-24).

`UserSearchPicker.tsx` (commit `e08dff4 feat(groups): real UserSearchPicker
component for group invite (BUG-M01)`) and the sport-label-map work
(commit `65e9337 fix(labels): shared enum label map for skill_level/visibility
(BUG-M02)`, `afeae33 fix(labels): resolve sport slug to display_name
across 5 screens`) are both live on `main` and used inside the Groups
screens, and are likewise absent from §4.4 and from §7 (no mention of
`labels.ts` or the sport-name/slug/display-name convention it centralizes).

**Verdict**: confirmed code-ahead-of-doc. See amendments file, §A.

### 2.4 BUG-M01–M05 batch + Groups-create toggle branch — **merged; no conformance review ran**

`git log` on `main` shows every BUG-M01–M05 commit present and reachable
from `HEAD`:

```
65e9337 fix(labels): shared enum label map for skill_level/visibility (BUG-M02)
f8efd71 feat(groups): add Players Group / Tournament Team toggle to CreateGroupScreen
51e4631 fix(home): wire the "My Games" tile to a filtered dashboard view (BUG-M04)
8e24eab fix(profile): replace free-text sport field with the sport picker (BUG-M05)
e08dff4 feat(groups): real UserSearchPicker component for group invite (BUG-M01)
afeae33 fix(labels): resolve sport slug to display_name across 5 screens (BUG-M02 remainder)
```

The branch `fix/mobile-bug-batch-m01-m05` itself is not present in
`git branch -a` today (already merged and its ref deleted — the
`implementation-report-create-group-2026-09-23.md`'s own git evidence
section, captured *while that branch was still checked out*, shows `HEAD ->
fix/mobile-bug-batch-m01-m05` at commit `f8efd71`, which is the exact
commit now sitting on `main`'s linear history). This is normal
merge-then-delete hygiene, not a missing merge.

**No conformance-review report exists anywhere under `docs/`** for this
batch (or for any other change in this repository). A grep for
"conformance" across all of `docs/` returns only incidental uses of the
word — DES-MEETUP-MOBILE.md's own "Conformance status:" headings, and
implementation reports' standard disclaimer that "conformance review...
must verify independently" — never an actual conformance-review *outcome*
document. The project's `.claude/agents/` tooling references a
conformance-review process, but this repository's `docs/` contains no
evidence it has ever been run against merged mobile code.

**Verdict**: merged, confirmed. Conformance review: **never ran** — flag
as an open process gap, independent of the doc-content gap in §2.3.

### 2.5 Android applicationId / "Shuttlr" identity — **CODE-AHEAD-OF-DOC (confirmed gap)**

`android/app/build.gradle`:
```
namespace "com.meetupmobile"
applicationId "org.duckdns.meetups"
```
with an explicit comment warning that `namespace` and `applicationId` now
intentionally differ and must not be conflated. This dates to commit
`144087b build(android): Shuttlr release identity, auto versionCode,
upload-key signing and AAB script`, with the visual/branding side in
`3a9f0c0 Shuttlr adaptive launcher icon, versionCode bump` and
`docs/reports/IMPL-DES-MEETUP-MOBILE-shuttlr-release-shell.md`.

`DES-MEETUP-MOBILE.md` contains **zero** mentions of `applicationId`,
`Shuttlr`, or `org.duckdns.meetups` anywhere in the document (§3.11 "Build
and Release Pipeline" describes the CI/signing pipeline in the abstract
but never names the actual package identity or product name the app ships
under). `REQ-MEETUP-MOBILE.md` likewise never names a product identity.

**Verdict**: confirmed code-ahead-of-doc — a shipped, user-facing identity
decision (the app is literally named and packaged differently from what
every design-doc reference to "the Meetup mobile app" implies) with no
design-doc record at all. See amendments file, §B.

### 2.6 `group_event_created` — **in the TS union; NOT in DES-MEETUP-MOBILE.md's type list — CODE-AHEAD-OF-DOC**

`src/types/notification.ts`'s `NotificationType` union has **15** literal
values: the 12 from §4.8's table, plus `event_participant_added`,
`event_participant_removed`, and `group_event_created` — all three added
after the design doc's 12-type table was written, and the file's own
header comment says so explicitly: *"a third ratified addition beyond
§4.8's 12... the design still needs to formally ratify it."*

`DES-MEETUP-MOBILE.md` §2.1 states "FCM-based push notification receipt
for all **12 confirmed notification types** (§5.17)" (note: the doc's own
cross-reference to "§5.17" is itself stale/wrong — the actual table is at
§4.8, not §5.17, which doesn't exist in the current document numbering)
and §4.8's table lists exactly the same 12, with `group_event_created` and
the two participant types absent from all of it. `§3.6`'s R-ID list for
FCM Integration likewise makes no mention of these three types.

**Verdict**: confirmed. Three shipped, code-live notification types
(`event_participant_added`, `event_participant_removed`,
`group_event_created`) are undocumented in the design doc's type
inventory and deep-link mapping table. See amendments file, §C.

### 2.7 MOBILE-ADDENDUM-skill-level-delete.md — **fully implemented in code; NOT folded into REQ/DES; standalone file should be retired only after that fold-in**

Confirmed against code:
- `src/api/profile.ts`: `deleteSkillLevel(sport)` → `DELETE
  /users/me/skill-level/{sport}`, matching the addendum's §4 Design exactly.
- `src/screens/ProfileScreen.tsx`: per-row destructive "Remove" affordance
  (reusing `GroupDetailScreen`'s existing confirm→destructive-action UI
  pattern, per the addendum's own instruction not to invent a new one),
  confirm dialog, 409-guard message surfaced verbatim (not swallowed), list
  refresh on success — all as specified in the addendum's §3/§4.
- Implementation Report `docs/reports/IMPL-ADDENDUM-MOBILE-SKILL-DELETE-001.md`
  independently re-verified the live backend contract
  (`DELETE /users/me/skill-level/{sport}`, 404/409/204/422 responses,
  citing `DES-MEETUP-001 v1.71, R-339, §5.1/§5.5/§5.13`) rather than
  trusting the addendum's own claim — confirms R-339 is live and this
  mobile change correctly targets it. No backend work was needed or done
  from this repo, consistent with the addendum's scope.
- Test coverage exists for the 409 path, the generic-failure path, and a
  regression check that the pre-existing tap-to-edit row behavior still
  works after the row layout was split to fit the new control.

**Gap**: exactly what the addendum's own §5 "Merge Instructions" and the
Implementation Report's "Known gaps" both flag and neither one is
authorized to fix — the fold-in into `REQ-MEETUP-MOBILE.md` /
`DES-MEETUP-MOBILE.md` has not happened. Confirmed by inspection:
- `DES-MEETUP-MOBILE.md` has **no dedicated Profile-screen subsection**
  anywhere in §4 (the addendum's own §2 notes this too).
- `DES-MEETUP-MOBILE.md` §7.2's Users API table lists only
  `PUT /users/me/skill-level` — both `GET /users/me/skill-levels` (used by
  Add/Modify, already live before this addendum) and
  `DELETE /users/me/skill-level/{sport}` (this addendum) are absent from
  that table.
- `REQ-MEETUP-MOBILE.md` has no R-ID at all for per-sport skill-level
  management in any form (Add, Modify, or Delete) — this whole capability
  has apparently shipped and been iterated on mobile without ever getting
  a permanent R-ID, only the placeholder `R-MOBILE-SKILL-DELETE-1` in the
  standalone addendum.

**A second, structurally identical standalone addendum exists with the
same unresolved status**: `MOBILE-ADDENDUM-sports-filter-preselect.md`
(Home screen sport-filter default pre-selection from `user_skill_levels`)
— also APPROVED, also fully implemented
(`docs/reports/IMPL-ADDENDUM-MOBILE-SPORTS-FILTER-PRESELECT-001.md`,
`getPreselectedSportKey()` in `homeDashboard.ts`, wired into
`HomeScreen.tsx`, 791/791 tests passing), also explicitly not yet folded
into either governing doc. Its own §5 references the skill-level addendum
as "the same pattern... which is itself still pending merge," i.e. the
project has now produced **two** approved-and-shipped addenda in
succession without closing the loop on either.

**Recommendation** (see amendments file §D for literal proposed text):
fold `MOBILE-ADDENDUM-skill-level-delete.md`'s content into
`REQ-MEETUP-MOBILE.md` (new R-ID under a new "1.16 Profile & Skill
Levels" subsection, or extend §1.9-adjacent numbering — architect's call)
and into a new `DES-MEETUP-MOBILE.md` §4.16 "Profile — Skill Levels"
subsection plus the two missing `§7.2` rows, then retire the standalone
file per its own §5 precedent (Addendum A's history, cited in the
addendum itself). Do the same for the sports-filter-preselect addendum
once the architect assigns it a section (its own §4 notes "investigation
did not confirm an existing design-doc section for this component" —
likely a new Home-screen subsection is needed, since §4 currently has no
Home-screen entry at all despite `HomeScreen.tsx`/`SportFilterPills`
being a live, central screen).

---

## 3. Additional findings not explicitly requested but material

### 3.1 §4.8's own internal cross-reference is broken
§2.1 says "all 12 confirmed notification types (**§5.17**)" — there is no
§5.17 in the current document; the actual table lives at §4.8. This
predates the notification-type additions in §2.6 and should be fixed in
the same pass as the type-list update (see amendments file).

### 3.2 No standalone addendum has ever completed its own merge-and-retire cycle
Both `MOBILE-ADDENDUM-skill-level-delete.md` and
`MOBILE-ADDENDUM-sports-filter-preselect.md` cite "Addendum A" on the
*backend* side (`REQ-MEETUP-001`) as the precedent for eventually folding
in and retiring a standalone file — but no mobile-side addendum has yet
completed that cycle. This is a process gap (docs accumulate faster than
they're reconciled), worth flagging to the architect independent of any
single addendum's content.

### 3.3 `docs/MOBILE-ADDENDUM-skill-level-delete.md` had a transient corruption, already resolved
The Implementation Report for that addendum
(`docs/reports/IMPL-ADDENDUM-MOBILE-SKILL-DELETE-001.md` §1) records that
at the start of *that* session, the working-tree copy of the addendum was
found textually corrupted (garbled sentences, and critically a rewritten
final paragraph falsely claiming the backend dependency was "already...
live" with "no further backend confirmation needed"). That session
correctly did not trust the corrupted copy, diffed it against
`origin/main` (clean), left the corruption uncommitted, and independently
re-verified the backend precondition live instead of trusting either
copy. As of this audit, `git status` is clean and the committed
`docs/MOBILE-ADDENDUM-skill-level-delete.md` matches the version quoted
throughout this report — **the corruption was never committed and is not
present today.** Noted here only for the record; no action needed.

---

## 4. Could not verify (and why)

- **Play Console internal-testing track state** (which versionCode is
  actually live, whether a versionCode-14 AAB was ever uploaded at all) —
  no Play Console access from this environment; only the git history of
  `android/version.properties` could be checked, which shows what *would
  have been built*, not what was *actually uploaded*.
- **On-device behavior** of `getAndroidId()`/`react-native-device-info`
  under the current Android autolinking config, and of Keychain
  read/write from a headless notification handler while the device is
  locked (the exact question the direct-accept investigation in §2.1
  left open) — no Android emulator/device is attached to this
  environment; this matches the same limitation every relevant
  Implementation Report in this repo already self-reports.
- **Whether a second `device_id` implementation exists outside this
  repository** (a different local clone, an un-pushed branch, a different
  repo) — by definition unreachable from a `git`-based audit of
  `pratheeshku/meetup-mobile`; see §0.
- **Backend-side confirmation** that `POST /notifications/mobile-subscriptions`
  now accepts `deviceId` (checked live as of `bb5031b`'s own report,
  2026-09-24; not re-checked in this audit) and that `DES-MEETUP-001`
  v1.71's `R-339`/`fn_has_active_tournament_registration` is deployed
  (checked live in `IMPL-ADDENDUM-MOBILE-SKILL-DELETE-001.md`, same date;
  not re-checked here) — this repo has no backend code to inspect
  directly; both were verified via live `curl` against
  `meetups.duckdns.org` by the implementing sessions, not re-verified by
  this audit.

---

## 5. Summary table

| Item | Status | Severity |
|---|---|---|
| Priority Finding: two device_id implementations | **Premise false** — only one exists (`bb5031b`) | — |
| Accept/Decline direct-from-notification wording | Doc and code agree (navigate-only) | None |
| Create flow toggle (§4.3/§4.5) | Already written into DES, 2026-09-22 | None |
| §4.4 Groups-create toggle / captain auto-assign / UserSearchPicker | Code-ahead-of-doc | Medium |
| BUG-M01–M05 batch merge | Merged | — |
| Conformance review for BUG-M01–M05 / groups toggle | Never ran | Process gap |
| Android applicationId / Shuttlr identity | Code-ahead-of-doc | Medium |
| `group_event_created` + 2 participant types in TS union vs. DES §4.8 | Code-ahead-of-doc (3 undocumented types) | Medium |
| MOBILE-ADDENDUM-skill-level-delete.md | Implemented; not folded in | Low–Medium (process) |
| MOBILE-ADDENDUM-sports-filter-preselect.md | Implemented; not folded in | Low–Medium (process) |
| §4.8/§2.1 stale "§5.17" cross-reference | Doc defect, unrelated to any code change | Low |

---

*Companion file*: `docs/reports/proposed-DES-MEETUP-MOBILE-amendments-20260924.md`
contains literal proposed diff text for §4.4, §4.8, §7.2, a new §4.16, and
§3.11, for the architect to apply manually.
