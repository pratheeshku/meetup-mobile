# Full API Contract Audit — live OpenAPI schema vs. app types

**Date:** 2026-09-18
**Trigger:** the HomeScreen `undefined.length` crash (see
`docs/rca/RCA-2026-09-18-homescreen-events-crash.md`) showed that
`src/api/events.ts`/`src/types/event.ts` were built against assumed
field names, not the real backend. This audit checks every other module
(events follow-up, groups, tournaments, profile, notifications) against
the same live source of truth, in one pass.

**Method:** `curl -s https://meetups.duckdns.org/openapi.json`, read in
full, cross-referenced against every endpoint currently called by this
app and every corresponding type file. Not self-certified — findings
below are traceable to specific schema excerpts; fixes were verified
with `tsc`, `eslint`, and new regression tests (raw output in §5).

---

## 1. Mismatches found, per endpoint

### Events (`src/api/events.ts`, `src/types/event.ts`)

| Endpoint | Finding |
|---|---|
| `GET /events` | Already fixed prior to this audit (see the RCA) — bare array, not `{items,...}`; field renames (`organizer_id`, `venue_name`, `going_count`, `user_rsvp_status`, `recurrence_rule_id`). |
| `GET /events/{id}` | **Same class of gap, confirmed here and fixed** — was typed as the app's `Event` shape directly; real shape is the same `EventResponse` as the list endpoint. |
| `POST /events/{id}/rsvp` | **BLOCKED.** Real body is `RSVPRequest { action: string }`, **required**, no enum of accepted values documented anywhere. Current code sends no body → 422 on the real backend. |
| `POST /events/{id}/withdraw` | **BLOCKED — path doesn't exist.** No `/events/{event_id}/withdraw` route on the real backend at all (404). Plausible real mechanisms: `POST .../rsvp` with some `action` value, or `DELETE /events/{event_id}/participants/{user_id}` — both unconfirmed. |
| `POST /events/{id}/cancel` | **BLOCKED.** Real body is `EventCancelRequest { reason: string }` (1–500 chars, **required**). Current code sends no body → 422. Needs a cancellation-reason UI that doesn't exist yet (design decision, not an API-layer fix). |

### Groups (`src/api/groups.ts`, `src/types/group.ts`)

| Endpoint | Finding |
|---|---|
| `GET /settings/groups-owned`, `GET /settings/groups-member` | Already correctly typed as bare arrays. Per-item shape wrong: real `GroupResponse` is `{id, name, description, owner_id, members_can_invite, created_at}` — **no `owner_nickname`, `member_count`, or `current_user_role` field exists at all.** **Fixed** the shape mismatch (mapper added); `owner_nickname`/`member_count` flagged (see §3) since deriving them for a *list* needs an N+1 fan-out. |
| `GET /groups/{id}` | Same per-item gap as above. **Fixed.** |
| `GET /groups/{group_id}/members` | **Not previously used at all** — the prior Implementation Report's Proposed Assumption ("no member-listing endpoint exists, assumed embedded in `GET /groups/{id}`") was **wrong**; this endpoint exists and is now used to populate `GroupDetail.members` correctly. |
| `POST /groups/{id}/invite` | Verified compatible (`GroupInviteRequest {user_id, role?}` matches current `{user_id}` body). |
| `PATCH /groups/{id}/members/{user_id}/role` | **Fixed — wrong path.** Real path has no `/role` suffix: `PATCH /groups/{group_id}/members/{user_id}`. The old path 404'd on the real backend. Body shape was already correct. |
| `DELETE /groups/{id}/members/{user_id}` | Verified compatible, no fix needed. |

### Tournaments (`src/api/tournaments.ts`, `src/types/tournament.ts`)

| Endpoint | Finding |
|---|---|
| `GET /tournaments` | **Fixed — same envelope bug as events' original crash.** Real response is a bare array of `TournamentResponse`, not `TournamentsListResponse`. Per-item field renames/gaps: `organizer_id` not `organiser_id`; `title` (required) is the real display name, not `name` (nullable, secondary); `capacity` not `max_participants`; no `organiser_nickname`, `participant_count`, `current_user_registration_status`, `is_organiser` fields at all; `registration_open` doesn't exist but is derivable from the real `registration_closes_at`. |
| `GET /tournaments/{id}` | Same per-item gaps. **Fixed the same way**; `TournamentDetailScreen` now derives the fields the API layer can't (see §2) since it already has the needed data. |
| `POST /tournaments/{id}/registrations` | Verified compatible — `TournamentRegistrationRequest {user_id?, team_id?}` has no required fields; an empty body is schema-valid. |
| `DELETE /tournaments/{id}/registrations/{registration_id}` | Verified compatible, no fix needed. |
| `GET /tournaments/{id}/fixtures` | **BLOCKED.** Real `TournamentFixtureResponse` uses `participant_a_registration_id`/`participant_b_registration_id` (not `home_team`/`away_team` strings) and a single free-form `score_summary` string (not separate `home_score`/`away_score` numbers); `round_number` is an integer, not a string. Resolving registration ids to display names needs a join against the registrations list (a design decision on what to show, since this backend has no "home/away" concept at all); parsing `score_summary` with no documented format would be inventing a parser. **Not fixed — flagged.** |
| `GET /tournaments/{id}/registrations` | **Fixed.** Real `TournamentRegistrationResponse` has no `nickname` (mapped from `participant_name`, which may be a team name); added the real `status` field and widened `user_id` to nullable (team-based registrations have no `user_id`). |
| `POST /tournaments/{id}/cancel` | Verified compatible — no request body needed. |

### Profile (`src/api/profile.ts`, `src/types/user.ts`)

| Endpoint | Finding |
|---|---|
| `GET /users/me` | **Fixed the reconcilable part.** Real `PrivateUserProfile`: `id, display_name, nickname, avatar_storage_key, theme_preference, created_at, email, is_admin, tournament_participation_history`. No `skill_levels` field (see below) and no `role` field at all. `avatar_url` was assumed to be a ready URL; the real field is `avatar_storage_key` (a storage key). |
| — `role` | **BLOCKED.** No source field anywhere on this response for the app's 3-way `'participant'\|'organiser'\|'admin'` enum — only a binary `is_admin`. `useRole()` (an auth-module file, out of this audit's authorized scope) always sees `undefined` against the real backend. |
| — `avatar_url` | **BLOCKED.** `avatar_storage_key` is a storage key, not a URL; no documented scheme (CDN base path, signed-URL endpoint) exists to resolve one to the other. Left `null` (`ProfileScreen` already degrades safely to its placeholder avatar). |
| — `skill_levels` | **Partially fixed.** Confirmed NOT embedded in `GET /users/me` as previously assumed. A real `GET /users/me/skill-levels` endpoint exists (the prior "no read endpoint exists" assumption was also wrong) but its OpenAPI response schema is undeclared (`{}` — FastAPI's default with no `response_model`). Wired up assuming the same shape as the confirmed write-side `UserSkillLevelUpdate` (`{sport, skill_level}`) — a Proposed Assumption, flagged for confirmation with real credentials. |
| `PATCH /users/me` | **BLOCKED.** Real `UserUpdate` body only accepts `{display_name?, theme_preference?}` — **neither `nickname` nor `avatar_url` is accepted.** `ProfileScreen`'s "Edit nickname" flow is a no-op/broken against the real backend today. Not fixed — renaming `nickname`→`display_name` would conflate two fields the backend keeps distinct (product decision). |
| `PUT /users/me/skill-level` | Verified compatible (`UserSkillLevelUpdate {sport, skill_level}` matches exactly). |
| `POST /users/me/deletion-request` | **BLOCKED — CRITICAL.** This path does not exist on the real backend at all (confirmed against the full 123-path listing). Not a field mismatch — a 404. |
| `POST /users/me/deletion-confirm` | **BLOCKED — CRITICAL.** Same as above; does not exist. The entire "Delete Account" feature is non-functional against the real backend. No alternative deletion mechanism is visible anywhere in the schema. |

### Notifications (`src/api/notifications.ts`, `src/types/notification.ts`)

| Endpoint | Finding |
|---|---|
| `GET /notifications/preferences` | **Fixed — envelope bug, opposite direction from events.** Real response is `NotificationPreferencesResponse`, `{preferences: NotificationPreferenceItem[]}`, not a bare array. Per-item shape (`{notification_type, enabled}`) already matched exactly. |
| `PUT /notifications/preferences/{type}` | Verified compatible, no fix needed. |
| `POST /notifications/mobile-subscriptions` / `DELETE .../mobile-subscriptions/{token}` (`src/notifications/fcm.ts`) | **BLOCKED — CRITICAL, and NOT in this audit's authorized fix list, so left untouched; flagged prominently because Step 1 explicitly asked to check this exact endpoint.** This path does not exist. The real endpoints (`POST /notifications/subscriptions`, `DELETE /notifications/subscriptions/{subscription_id}`) expect a **Web Push subscription** (`{endpoint, p256dh_key, auth_key}`) — not an FCM device token. This is not a field-rename: FCM tokens and Web Push subscription objects are different push-delivery protocols. The delete path also needs the server-issued subscription `id` returned by the register call, not the token itself (`fcm.ts` currently deletes by token). Push notification registration is fully non-functional against the real backend today. |

### Auth (`src/api/client.ts`, auth module) — read-only, per "do not modify auth files"

Checked per Step 1 for completeness of this audit, **not modified**:
- `POST /auth/oauth/{provider}/callback` uses `OAuthCallbackRequest {code?, id_token?}` — matches the `id_token` fix from the prior commit (`fix(auth): correct field name idToken → id_token`).
- `POST /auth/refresh`'s real `RefreshResponse` is `{access_token: string | null}` **only** — `src/api/client.ts`'s `RefreshResponse` interface assumes both `access_token` AND `refresh_token`. If the real backend never returns a `refresh_token` on refresh, the token-rotation logic may be storing `undefined` as the new refresh token. **Flagged for the architect** — not touched (auth file, explicitly off-limits, "already fixed" per the task rules).

---

## 2. Fixes applied, per file

- **`src/api/events.ts`**: `getEvent()` now reuses the `mapEventApiItem` adapter already built for `getEvents()`. `rsvpEvent()`/`withdrawEvent()`/`cancelEvent()` left behaviorally unchanged, each with a `BLOCKED` comment explaining exactly why (see §1) — implementing a guess for any of the three risks a wrong RSVP/withdraw action or a shipped feature that always 422s with no visible signal beyond a generic error toast.
- **`src/api/groups.ts`**: `GroupApiItem`/`GroupMembershipApiItem` raw types + `mapGroupApiItem`/`mapGroupMember` adapters. `getMyGroups()` infers `current_user_role` from which settings-endpoint sourced the item. `getGroup()` now also calls `GET /groups/{id}/members` (one extra call, single-detail-view, not a list fan-out) to accurately populate `owner_nickname`, `member_count`, and `members`. `updateMemberRole()`'s path fixed.
- **`src/types/group.ts`**: `owner_nickname`/`member_count` made optional on `Group` (real backend has no source for either on a list item).
- **`src/screens/GroupsScreen.tsx`**: guards the now-optional `member_count` render (licensed by the type mismatch — the real backend cannot supply it for a list without an N+1 decision).
- **`src/screens/GroupDetailScreen.tsx`**: computes `currentUserRole` locally from `group.members` + `useAuth()`'s `currentUserId` (data the screen already has) instead of trusting `group.current_user_role`, which `api/groups.ts` cannot supply accurately. This is a *correctness* fix, not just cosmetic — the previous inert placeholder would have hidden invite/role-change/leave controls from every legitimate owner/admin.
- **`src/api/tournaments.ts`**: `TournamentApiItem`/`TournamentRegistrationApiItem` raw types + `mapTournamentApiItem`/`mapTournamentRegistration` adapters, applied to `getTournaments()` (fixes the envelope bug) and `getTournament()`. `getRegistrations()` fixed to the real per-item shape. `getFixtures()` left unchanged with a `BLOCKED` comment (see §1). `registerForTournament()`/`cancelTournament()`/`withdrawFromTournament()` verified compatible, comments added, no behavior change.
- **`src/types/tournament.ts`**: `TournamentRegistration.user_id` widened to nullable; added `status`. `Tournament`'s header comment documents which fields are reliable from `getTournament()` (all of them, since the detail screen self-corrects) vs. the list (`organiser_nickname`, `participant_count`, `current_user_registration_status`, `is_organiser` are flagged placeholders there).
- **`src/screens/TournamentDetailScreen.tsx`**: derives `currentUserRegistrationStatus` and `isOrganiser` locally from `registrations` + `tournament.organiser_id` vs. `currentUserId` (data it already loads), instead of trusting the now-honestly-inert `tournament.current_user_registration_status`/`is_organiser`. Also renders `registrations.length` instead of the unavailable `tournament.participant_count`. Same correctness rationale as the groups fix — this was silently breaking the Register/Withdraw/Cancel buttons for every real user.
- **`src/api/profile.ts`**: `PrivateUserProfileApiItem` raw type + `mapPrivateUserProfile` adapter. `getProfile()` now calls `GET /users/me` and the real `GET /users/me/skill-levels` in parallel (mirrors the two-call pattern already established in `groups.ts`), with the skill-levels call defensively falling back to `[]` on any failure since its schema is unconfirmed. `updateProfile()`, `requestDeletion()`, `confirmDeletion()` left unchanged with `BLOCKED` comments (see §1).
- **`src/types/user.ts`**: added `display_name`; documented exactly which fields are confirmed-always-present vs. `BLOCKED` vs. unconfirmed-assumption, per field.
- **`src/api/notifications.ts`**: `getPreferences()` now unwraps the real `{preferences: [...]}` envelope.

No UI/screen files were touched beyond the three licensed exceptions above (`GroupsScreen.tsx`, `GroupDetailScreen.tsx`, `TournamentDetailScreen.tsx`) — in each case because a confirmed missing backend field could only be reconciled with data the screen already independently loads, exactly the "type mismatch requires it" exception in the task rules.

---

## 3. Items requiring an architect decision — NOT implemented, do not guess

1. **`rsvpEvent()`** — what exact `action` string(s) does `RSVPRequest.action` accept? No enum documented.
2. **`withdrawEvent()`** — the endpoint it calls doesn't exist. Is withdrawal `POST /events/{id}/rsvp` with some action, or `DELETE /events/{id}/participants/{user_id}`?
3. **`cancelEvent()`** — needs a cancellation-reason UI (`EventCancelRequest.reason` is required, 1–500 chars). What's the UX (this codebase's own established pattern for text-entry-without-`Alert.prompt` is an inline `TextInput`, e.g. `ProfileScreen`'s deletion-code flow — a reasonable starting point, but a UI addition, not an API-layer fix)?
4. **Groups list (`getMyGroups()`) — `owner_nickname`/`member_count`**: only derivable via an N+1 `GET /groups/{id}/members` call per row. Accept the N+1 cost, drop these fields from the list card, or ask the backend to denormalize them onto `GroupResponse` (the pattern it already uses for events' `organizer_nickname`)?
5. **Tournaments list (`getTournaments()`) — `organiser_nickname`, `participant_count`, `current_user_registration_status`**: same N+1 question as #4, plus `organiser_nickname` has no resolution path at all (no `GET /users/{id}` endpoint exists anywhere in the schema — only `/users/by-nickname/{nickname}`, `/users/search`, `/users/me`). Backend denormalization is the only clean fix for the nickname specifically.
6. **`getFixtures()` / `TournamentFixture`** — this backend's fixture model has no "home/away" concept (`participant_a`/`participant_b` registration ids) and a free-form `score_summary` string. What should the UI actually show, and should the backend denormalize participant display names onto the fixture response (as it already does for events' organiser fields)?
7. **`updateProfile()`** — `UserUpdate` doesn't accept `nickname` or `avatar_url` at all, only `display_name`/`theme_preference`. Is "Edit nickname" supposed to edit `display_name` instead (a product decision, not a rename — the backend keeps `nickname` and `display_name` as distinct fields)? Is avatar editing in scope at all yet?
8. **`avatar_url` resolution** — `avatar_storage_key` needs a documented URL-resolution scheme (CDN base path? signed-URL endpoint?) before any avatar can ever be displayed.
9. **`role` (`UserProfile.role`, backs `useRole()`)** — no source field on `GET /users/me` for the 3-way enum, only binary `is_admin`. Is role UI-gating being retired, or does it need a different, currently-missing endpoint?
10. **`requestDeletion()`/`confirmDeletion()`** — **CRITICAL.** Both endpoints 404. Does account deletion exist under a different mechanism, or was this never built server-side? Needs the backend team, not a client-side guess.
11. **`src/notifications/fcm.ts` push registration** — **CRITICAL, and outside this audit's authorized file list, so not touched.** The real backend implements Web Push (VAPID keys), not FCM device-token registration. This is an architecture-level question (does the backend need an FCM-specific registration path added, or does the mobile app need to move to a different push mechanism?), not an adapter-function fix.
12. **`src/api/client.ts`'s `RefreshResponse`** — real `POST /auth/refresh` only returns `access_token`, not `refresh_token`. Flagged for the architect; not touched (auth file, off-limits per the task rules, and the rules state auth is "already fixed").

---

## 4. Traceability

| Finding | Files | R-ID / design section |
|---|---|---|
| `getEvent()` field mapping | `src/api/events.ts` | §4.3, §7.4; R-021, R-024 |
| Groups shape + path fixes | `src/api/groups.ts`, `src/types/group.ts`, `GroupsScreen.tsx`, `GroupDetailScreen.tsx` | §4.4, §7.3, §7.5; R-030, R-031 |
| Tournaments shape fixes | `src/api/tournaments.ts`, `src/types/tournament.ts`, `TournamentDetailScreen.tsx` | §4.5, §7.7; R-041, R-042 |
| Profile shape fixes | `src/api/profile.ts`, `src/types/user.ts` | §4.13, §7.2; R-124 |
| Notifications envelope fix | `src/api/notifications.ts` | §4.8, §7.6; R-076 |

## 5. Verification results

**Type-check:**
```
$ npx tsc --noEmit
(no output, exit 0)
```

**Lint:**
```
$ npx eslint . --ext .ts,.tsx
(no output, exit 0)
```

**Tests, run 3x for stability** (new regression tests: `groups.test.ts`,
`tournaments.test.ts`, `profile.test.ts`, `notifications.test.ts`, each
built from the real OpenAPI schemas above, plus the existing
`events.test.ts`/`App.test.tsx`):
```
$ for i in 1 2 3; do npx jest 2>&1 | tail -6; echo "--- Run $i ---"; done
Test Suites: 6 passed, 6 total
Tests:       13 passed, 13 total
Snapshots:   0 total
Time:        0.707 s, estimated 1 s
Ran all test suites.
--- Run 1 ---
Test Suites: 6 passed, 6 total
Tests:       13 passed, 13 total
Snapshots:   0 total
Time:        0.51 s, estimated 1 s
Ran all test suites.
--- Run 2 ---
Test Suites: 6 passed, 6 total
Tests:       13 passed, 13 total
Snapshots:   0 total
Time:        0.515 s, estimated 1 s
Ran all test suites.
--- Run 3 ---
```

## 6. Not self-certified

This report is produced by the same session that wrote the fixes. Per
the task rules, it is **not** a self-certification of correctness — the
13 items in §3 are explicitly not implemented pending an architect
decision, and every fix above is traceable to a specific OpenAPI schema
excerpt (quoted inline in the corresponding source-file comments) so it
can be independently checked rather than taken on faith. Recommend
routing this through `conformance-review` and the testing agent, in
fresh sessions, before treating any of §2's fixes as production-ready —
particularly since none of them could be verified end-to-end against a
real authenticated session (no test credentials were available in this
session).
