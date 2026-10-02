# Proposed Amendments — DES-MEETUP-MOBILE.md (2026-09-24)

**Status**: PROPOSED ONLY. Not applied. `docs/DES-MEETUP-MOBILE.md` is
off-limits to implementation work per `CLAUDE.md`; these are literal diff
suggestions for the architect to review and apply by hand (or delegate).
Line numbers below refer to `docs/DES-MEETUP-MOBILE.md` as it stood at
commit `af8121a` (2026-09-24, the state audited in the companion Gap
Report). Each block is a unified-diff-style suggestion, not a verified
patch — re-check line anchors before applying if the file has moved on.

---

## §A. §4.4 Groups & Teams — document the Players Group / Tournament Team toggle

**Rationale**: `CreateGroupScreen.tsx` (commit `f8efd71`) ships a single
screen with a mode toggle, a distinct `TeamVisibility` enum, and
backend-only captain assignment. None of this is in §4.4 today. Also
folds in the already-shipped `UserSearchPicker` (commit `e08dff4`) and the
shared sport/enum label-map convention (commits `65e9337`, `afeae33`)
that §4.4's screens now depend on.

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 4.4 Groups & Teams
 
-**Screens**: Group List, Group Detail, Create Group, Team List, Team
-Detail, Create Team.
+**Screens**: Group List, Group Detail, Create Group/Team (merged — see
+Create Group/Team Amendment below), Team List, Team Detail.
 
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
+
+**Create Group/Team Amendment (architect-approved 2026-09-23, doc
+write-back pending as of this amendment)**
+
+`CreateGroupScreen.tsx` is a single screen with a segmented toggle at
+top: **Players Group | Tournament Team** (default: Players Group).
+Toggle changes the visible field set and submit target within the same
+screen — not a screen navigation. Both forms' state is retained
+independently across toggles.
+
+*Players Group* → `POST /groups` (`GroupCreate`): Name* (1–100,
+trimmed), Description (optional). On success: navigate to
+`GroupDetail` for the new group.
+
+*Tournament Team* → `POST /teams` (`TeamCreate`): Team Name* (1–100),
+Sport* (from `GET /admin/sports/public`), Visibility* — **`public` /
+`private`**, a `TeamVisibility` enum distinct from and never aliased to
+Event's (`public`/`invite_only`/`group`) or Tournament's
+(`public`/`invite`/`group`) visibility. **Captain is not a form field —
+the backend auto-assigns the creator as captain.** No member-invite
+step on this screen (invites happen from Team Detail, `POST
+/teams/{id}/invite`, once available on mobile — see Known Gap below).
+
+**Known gap**: `TeamDetailScreen` does not exist on mobile yet.
+Tournament Team creation currently falls back to navigating to the
+Groups list (`refreshKey`-driven refresh) instead of a team detail
+screen. Update this section and the create-flow's post-submit
+navigation once `TeamDetailScreen` ships.
+
+**Group/Team member search**: Group invite uses `UserSearchPicker.tsx`,
+a live-search-by-nickname/name component (backend endpoint per
+existing user-search contract), replacing an earlier free-text invite
+field.
+
+**Shared enum/label convention**: sport and enum values
+(`skill_level`, visibility) are resolved to display labels through a
+shared label map (`src/utils/labels.ts`) rather than per-screen
+hardcoding, applied consistently across Group, Team, Event, and Profile
+screens.
```

---

## §B. §3.11 Build and Release Pipeline — name the actual app identity

**Rationale**: The app ships as `applicationId "org.duckdns.meetups"`
(namespace `com.meetupmobile`, deliberately different — see the comment in
`android/app/build.gradle`) under the product name "Shuttlr" (adaptive
launcher icon, commit `3a9f0c0`; release shell, commit `144087b`;
`docs/reports/IMPL-DES-MEETUP-MOBILE-shuttlr-release-shell.md`). Nothing
in the design doc names either fact today.

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 3.11 Build and Release Pipeline (R-007)
 
+**App identity**: the shipped Android application ID is
+`org.duckdns.meetups` (Gradle `applicationId`), distinct and
+intentionally divergent from the source-code package/namespace
+`com.meetupmobile` (Kotlin files, generated `BuildConfig`/`R` — do not
+conflate the two when reading build config). The marketplace-facing
+product name is **Shuttlr**, with its own adaptive launcher icon
+distinct from the working repository/project name "Meetup Mobile."
+This is a deliberate branding decision, not a placeholder — update this
+entry if either identity changes again before GA release.
+
 **Decision**: GitHub Actions with a single release workflow: checkout →
 install dependencies (committed lockfile) → write decoded
 `google-services.json` from a base64-encoded GitHub Actions secret to
```

---

## §C. §2.1 and §4.8 — reconcile the notification-type count and fix the stale cross-reference

**Rationale**: `src/types/notification.ts`'s `NotificationType` union has
15 literal values, not 12 — `event_participant_added`,
`event_participant_removed` (commit `f41db4d`), and `group_event_created`
(notify-kit Part 3) are live, shipped, and routed, but absent from §4.8's
table and uncounted in §2.1/§3.6. §2.1 also cites a nonexistent "§5.17."

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 2.1 In Scope
 - FCM-based push notification receipt for all 12 confirmed notification
-  types (§5.17), including tap-through deep linking.
+  types (§4.8), plus three additionally-ratified types
+  (`event_participant_added`, `event_participant_removed`,
+  `group_event_created` — added post-approval by explicit instruction;
+  see §4.8), including tap-through deep linking.
```

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 4.8 Push Notifications
 
-**Notification type → deep link mapping** (all 12 confirmed types):
+**Notification type → deep link mapping** (the 12 originally-confirmed
+types, plus three ratified-by-instruction additions below — 15 total,
+matching `src/types/notification.ts`'s `NotificationType` union):
 
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
+| `event_participant_added` | Event Detail |
+| `event_participant_removed` | Event Detail |
+| `group_event_created` | Event Detail (Join + OK actions — Join
+  navigates only, it is not a direct RSVP call; see below) |
+
+**Action buttons beyond tap-to-navigate**: `event_changed`,
+`event_participant_added`, `event_participant_removed`, and
+`group_event_created` are delivered data-only (no native FCM
+`notification` block) so they can carry custom Android action buttons
+via `notifee`: **View + OK** (the first three) or **Join + OK**
+(`group_event_created`). In every case the primary action (View/Join)
+is **navigation-only** — it opens the relevant detail screen, the same
+destination a body-tap would use — and **never** performs an RSVP,
+invitation-accept, or any other mutating API call directly from the
+notification tray. OK dismisses the notification only. A direct-accept
+RSVP flow from Join was investigated and explicitly rejected for the
+current release (see `docs/reports/INV-DES-MEETUP-MOBILE-notify-kit-direct-accept.md`
+for the open blockers: unverified Keychain behavior under a headless
+handler while the device is locked, no R-101 connectivity-check
+implementation in any context, and unconfirmed iOS background-execution
+support).
```

---

## §D. New §4.16 Profile — Skill Levels, and §7.2 Users API table rows

**Rationale**: folds in `MOBILE-ADDENDUM-skill-level-delete.md`
(APPROVED 2026-09-24, fully implemented) per its own §5 Merge
Instructions. Assign the real R-ID and section number shown here as
placeholders once the architect confirms numbering; retire the standalone
addendum file immediately after this lands, per the Addendum-A precedent
it cites.

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 4.15 Testing & Coverage
 
 Covered by §8.
 
+### 4.16 Profile — Skill Levels
+
+**Screens**: Profile (`ProfileScreen.tsx`) — no separate Settings
+screen exists; this is the one screen for viewing and managing the
+caller's per-sport skill levels.
+
+**API endpoints consumed**: `GET /users/me/skill-levels`,
+`PUT /users/me/skill-level`, `DELETE /users/me/skill-level/{sport}`.
+
+**Behaviour**: the profile screen renders a per-sport skill-level list
+(Add/Modify already live prior to this section's write-back; Delete
+added under ADDENDUM-MOBILE-SKILL-DELETE-001, 2026-09-24). Each row has
+a destructive "Remove" affordance (reusing the same confirm-then-call
+UI pattern as Group Detail's member-removal action, not a new pattern):
+on confirm, calls `DELETE /users/me/skill-level/{sport}`; a `409`
+response (active/unconcluded tournament registration for that sport,
+per `DES-MEETUP-001` v1.71 §5.13's `fn_has_active_tournament_registration`
+guard) is surfaced to the user verbatim, the entry is not removed, and
+no retry is attempted automatically; on success the entry is removed
+from the list.
+
+**Role/permission gates**: any authenticated user, own skill levels
+only.
+
+**Error/edge cases**: `409` guard (active tournament registration) —
+message shown verbatim, not genericized. Network/5xx failure — generic
+fallback message, entry unchanged.
+
+**Offline behaviour**: requires connectivity; disabled offline,
+consistent with other mutating actions (§3.8).
+
+**Known documentation gap, inherited and still open**: the response
+shape of `GET /users/me/skill-levels` has no backend `response_model`
+in the live OpenAPI schema; the client's shape is empirically correct
+(Add/Modify/Delete all work against it in production) but formally
+unverified. Tracked separately from this section; not blocking.
```

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 7.2 Users
 
 | Method | Path | Auth Required | Notes |
 |---|---|---|---|
 | GET | `/users/me` | Yes | Drives `useRole()` |
 | PATCH | `/users/me` | Yes | |
 | GET | `/users/nickname-available` | Yes | |
+| GET | `/users/me/skill-levels` | Yes | Response shape unverified against a formal backend schema — see §4.16 |
 | PUT | `/users/me/skill-level` | Yes | |
+| DELETE | `/users/me/skill-level/{sport}` | Yes | R-339 (shared with web); 409 if an active/unconcluded tournament registration exists for that sport (§4.16) |
 | POST | `/users/me/deletion-request` | Yes | R-031 |
 | POST | `/users/me/deletion-confirm` | Yes | R-031 |
```

---

## §E. New §4.17 Home — Sport Filter Pre-Selection

**Rationale**: folds in `MOBILE-ADDENDUM-sports-filter-preselect.md`
(APPROVED 2026-09-24, fully implemented,
`docs/reports/IMPL-ADDENDUM-MOBILE-SPORTS-FILTER-PRESELECT-001.md`). The
Home screen has no existing §4 entry at all today despite being a live,
central screen — this also closes that pre-existing gap.

```diff
--- a/docs/DES-MEETUP-MOBILE.md
+++ b/docs/DES-MEETUP-MOBILE.md
@@ ### 4.16 Profile — Skill Levels
 
 [... §4.16 content from §D above ...]
+
+### 4.17 Home — Event Feed and Sport Filter
+
+**Screens**: Home (`HomeScreen.tsx`, route `EventsList` in `HomeStack`).
+
+**API endpoints consumed**: `GET /events`, `GET /groups` (for the
+groups tile), `GET /admin/sports/public` (sport filter pill options,
+per BUG-M06 — sourced from the admin sports list, not the event feed),
+`GET /users/me/skill-levels` (default sport-filter pre-selection only).
+
+**Sport filter**: `SportFilterPills` is single-select
+(`selectedSport: string | null`, "All" = `null`); pill options come
+from `GET /admin/sports/public`, not from the sports present in the
+current event feed and not from the caller's own skill levels.
+
+**Default pre-selection** (ADDENDUM-MOBILE-SPORTS-FILTER-PRESELECT-001,
+2026-09-24): on initial load only (never re-applied on refresh),
+`selectedSport`'s starting value is derived from the caller's
+`GET /users/me/skill-levels`: rank the caller's sports by skill level
+(`expert` > `intermediate` > `beginner`); if exactly one sport occupies
+the top tier, pre-select it; if multiple tie, pre-select whichever has
+the most recent `updated_at`; if the caller has zero skill-level rows,
+default remains `null` ("All"). If the selected sport has no
+corresponding pill currently rendered, fall back to `null` rather than
+referencing a nonexistent pill. The user may freely change the
+selection afterward, including back to "All" — this is a default only.
+
+**Explicitly not built** (deliberate, architect-directed scope
+boundaries — not oversights): `SportFilterPills` remains single-select
+(no multi-select rework); pill options remain admin-sports-sourced, not
+skill-level-sourced (a sport the caller plays but has no current event
+for still won't appear as a selectable pill); no stored, explicit
+user-chosen default-sport preference exists.
+
+**Role/permission gates**: none beyond standard authentication.
+
+**Offline behaviour**: last-fetched feed viewable per §3.8; the
+pre-selection fetch is best-effort and swallows failure to `[]`/`null`
+(pill row degrades to "All" only), matching the existing groups-tile
+failure pattern.
```

---

## Summary of section/version bump needed

Per this project's own convention (cited in both addenda:
`DES-MEETUP-001` v1.70/v1.71's document-history entries), applying §A–§E
should be accompanied by:
1. A new version-history entry at the top of `DES-MEETUP-MOBILE.md`
   dated to the actual amendment date, naming what changed (Groups/Team
   toggle write-back, app-identity documentation, notification-type
   reconciliation, skill-level-delete fold-in, sports-filter-preselect
   fold-in).
2. Real R-ID assignment in `REQ-MEETUP-MOBILE.md` for
   `R-MOBILE-SKILL-DELETE-1` and `R-MOBILE-SPORTS-FILTER-PRESELECT-1`
   (both currently placeholders in their standalone addenda), most
   naturally as new subsections (e.g. "1.16 Profile & Skill Levels")
   rather than shoehorned into an existing numbered block.
3. Retirement of `docs/MOBILE-ADDENDUM-skill-level-delete.md` and
   `docs/MOBILE-ADDENDUM-sports-filter-preselect.md` once §D/§E and the
   corresponding REQ entries are live — both files' own §5 instructions
   say to do this, and neither has been done yet.
4. A one-line fix to §4.4's screen inventory even independent of the
   fuller §A rewrite, since "Create Group, ... Create Team" as two
   separate screens is factually wrong today regardless of how much of
   the rest of §A the architect chooses to accept verbatim.

None of the above was applied to `docs/DES-MEETUP-MOBILE.md` or
`docs/REQ-MEETUP-MOBILE.md` by this audit — both remain byte-for-byte
unchanged from `commit af8121a`, per the audit's read-only mode.
