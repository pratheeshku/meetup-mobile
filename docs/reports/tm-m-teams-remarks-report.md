# tm-m-teams-remarks report (step 3.1)

Task ID: `tm-m-teams-remarks`. Machine: Cloud (agent session), repo root `/home/user/meetup-mobile`. Branch `claude/dreamy-wozniak-hxyx3l` (the branch this session was assigned; `git ls-remote --heads origin` shows no `tm-m-teams-remarks` branch, so nothing of another session was reused), from `origin/main` @ `bcc55d8`.
Design: `docs/DES-MEETUP-ADDENDUM-team-screens-remarks.md` v1.1 (approved 2026-10-28): AD-1 to AD-6, TS-01 to TS-13, section 4 contract, section 6 labels, TS-T9 to TS-T13, D-1 to D-3, amendment A1. **No board exists for the team screens; the addendum is the board of record (process note 1).** Screenshots are taken later on the Mac at the 4.3 device test; none are attached. Nothing here is self-certified; the architect rates this report.

## 0. Blocked Report (one item, partly blocked; the rest was finished)

**Make captain (TS-06) and "a captain who leaves chooses a replacement captain first" (TS-07) are NOT built. The design and the deployed API disagree.**

| What the design says | What the server does (`pratheeshku/meetup` main @ `20a3989`) |
|---|---|
| Section 4 and AD-1/TS-06: `POST /teams/{id}/captaincy` with body `new_captain_id` is "existing" | `teams/router.py` has no such route. Its routes are `GET ""`, `GET /mine`, `POST ""`, `GET /{id}`, `GET /{id}/members`, `DELETE /{id}/members/{user_id}`, `POST /{id}/invites`, `POST /{id}/requests`, `POST /{id}/invites/respond`, `POST /{id}/requests/{user_id}/respond`, `PATCH /{id}`, `DELETE /{id}`. Only the schema `TeamCaptaincyTransferRequest` exists (`teams/schemas.py`); nothing uses it. The admin console posts to `/teams/{id}/captaincy` (`frontend/src/admin/pages/TeamsManagement.tsx`), which is not in this router either. |
| TS-07: `DELETE /teams/{id}/members/{user_id}?replacement_captain_id=` lets a captain leave | `teams/service.py::remove_member`: a self-removal by the captain answers 400 "Captains cannot leave the tournament team. Transfer captaincy first." and ignores `replacement_captain_id`. The query is read only for an admin override, and that branch calls `transfer_captaincy`, which is not defined anywhere in the repo (NameError, HTTP 500). The repo's own as-built notes say the same (`docs/as-built/design/teams.md`, "Drift and findings"; `docs/reports/doc-code-sync-audit-round2-20260924.md` item 4). |

Consequence on the app: the captain's detail shows Edit, Join requests, Remove and Invite, but **no Make captain and no Leave**; a team player gets Leave. The labels `mob.team.make_captain` and `mob.team.leave_pick_captain` are bundled (seeded) and unused. The client `removeTeamMember` accepts `replacementCaptainId` and sends the query only when given (the app never gives it), so nothing is invented. No captaincy client exists. **Needed to unblock:** a backend task that adds the route (or makes the DELETE with `replacement_captain_id` work for the captain) and defines `transfer_captaincy`; then a small mobile change adds the two controls. The design needs a decision on whether the captain may leave at all today.

## 1. What was built

| Stage | Change | Files |
|---|---|---|
| Labels | Section 6 keys and texts bundled exactly; `mob.tw.description` reworded to "Remarks" | `src/labels/defaultLabels.ts` |
| A | Clients for the nine team routes; types | `src/api/teams.ts`, `src/types/team.ts` |
| A | `TeamDetailScreen`, four viewer states from the caller's roster row (`src/utils/teamViewer.ts`); 403 roster = not on the roster, 404 team = not-available notice, other failed read = retry state; route `TeamDetail` in the Groups stack | `src/screens/TeamDetailScreen.tsx`, `src/utils/teamViewer.ts`, `src/navigation/{types,RootNavigator}.ts(x)` |
| A | Mine cards tappable (`UnifiedTeamCard` takes `onPress`, existing "View" label); `team_invite` and `team_join_request` open `TeamDetail` with `entity_id` as team id (history rows share the resolver; a blank id falls back to the Tournament teams list) | `src/components/home/UnifiedCard.tsx`, `src/components/TeamsListContent.tsx`, `src/screens/GroupsScreen.tsx`, `src/notifications/notificationRouting.ts` |
| B | Mine \| Discover with the existing `SegmentedSwitch`; Discover = `GET /teams` minus `GET /teams/mine`, tournament-list card layout, client-side sport filter and name search, no count, private invited team shows "Invite only" (A1); lists read again on return from a detail | `src/components/TeamsSection.tsx`, `src/components/TeamsDiscoverContent.tsx`, `src/screens/GroupsScreen.tsx` |
| B | Request to join (then "Join request pending", toast "Join request sent"), Accept and Decline for the invited viewer | `src/screens/TeamDetailScreen.tsx` |
| C | Captain: approve or reject requests, edit name and visibility (changed fields only), remove a team player. Any active team player: invite by search (`UserSearchPicker`, `GET /users/search`), leave. Remove and Leave ask first. Refusals show labels, never server text | `src/screens/TeamDetailScreen.tsx` |
| D1 | Remarks on `CreateGameScreen` step 6: multiline, `maxLength` 5000, sent as `description` trimmed, `null` when blank (game only) | `src/screens/CreateGameScreen.tsx`, `src/types/event.ts` |
| D2 | Wizard: the description row leaves `BasicsStep` and sits at the end of the Committee step (last input before the review); the 5000 check moves with it (after trimming, under its own field) | `BasicsStep.tsx`, `CommitteeStep.tsx`, `TournamentWizardScreen.tsx`, `src/utils/tournamentWizard.ts` |
| D3 | Game view Remarks section, only when non-empty, plain text | `src/screens/EventDetailScreen.tsx` |
| D4 | Tournament overview (v2) Remarks block and legacy page title, only when non-empty; edit screen reads "Remarks" through `mob.tw.description` | `TournamentOverview.tsx`, `TournamentDetailScreen.tsx` |
| D5 | `VenueRow` in the list card: column `flex 1`, `minWidth 0`, address up to 3 lines, name up to 2 | `src/components/venue/VenueRow.tsx` |

Commits (one per logical change, 13): labels; clients; A screen; A cards and routing; B Discover; B join and respond; C actions; D1 game step 6; D2 wizard; D3 game view; D4 overview; D5 venue; plus this report. (D3/D4/D5 each include their tests.)

`git diff --stat origin/main..HEAD` (before this report was added):

```
 src/api/__tests__/teams.test.ts                    |  68 ++++
 src/api/teams.ts                                   |  77 +++-
 src/components/TeamsDiscoverContent.tsx            | 159 ++++++++
 src/components/TeamsListContent.tsx                |  10 +-
 src/components/TeamsSection.tsx                    |  65 +++
 src/components/__tests__/TeamsDiscover.test.tsx    | 123 ++++++
 src/components/home/UnifiedCard.tsx                |   9 +-
 .../tournament/v2/TournamentOverview.tsx           |   9 +
 src/components/tournament/wizard/BasicsStep.tsx    |  19 +-
 src/components/tournament/wizard/CommitteeStep.tsx |  33 +-
 src/components/venue/VenueRow.tsx                  |   9 +-
 .../venue/__tests__/VenueRowAddress.test.tsx       |  49 +++
 src/labels/defaultLabels.ts                        |  33 +-
 src/navigation/RootNavigator.tsx                   |   6 +
 src/navigation/types.ts                            |   2 +
 .../__tests__/notificationRouting.test.ts          |  14 +-
 src/notifications/notificationRouting.ts           |  21 +-
 src/screens/CreateGameScreen.tsx                   |  28 ++
 src/screens/EventDetailScreen.tsx                  |  17 +
 src/screens/GroupsScreen.tsx                       |  13 +-
 src/screens/TeamDetailScreen.tsx                   | 451 +++++++++++++++++++++
 src/screens/TournamentDetailScreen.tsx             |  11 +-
 src/screens/TournamentWizardScreen.tsx             |   8 +-
 .../__tests__/CreateGameEmailInvites.test.tsx      |   3 +-
 .../__tests__/CreateGameInviteeVisibility.test.tsx |   4 +-
 src/screens/__tests__/CreateGameRemarks.test.tsx   |  56 +++
 src/screens/__tests__/EventDetailRemarks.test.tsx  |  74 ++++
 src/screens/__tests__/GroupsTeamsSwitch.test.tsx   |  15 +-
 src/screens/__tests__/TeamDetail.test.tsx          | 310 ++++++++++++++
 src/screens/__tests__/TournamentEdit.test.tsx      |  11 +
 src/screens/__tests__/TournamentRemarks.test.tsx   |  59 +++
 .../__tests__/TournamentWizardScreen.test.tsx      |  45 ++
 src/types/event.ts                                 |   3 +-
 src/types/team.ts                                  |  21 +
 src/utils/__tests__/tournamentWizard.test.ts       |  16 +-
 src/utils/teamViewer.ts                            |  30 ++
 src/utils/tournamentWizard.ts                      |  18 +-
 37 files changed, 1836 insertions(+), 63 deletions(-)
```

## 2. Checks (each once; raw)

`npm run lint` (whole repo): last lines

```

✖ 35 problems (34 errors, 1 warning)

lint exit 1
```
35 problems (34 errors, 1 warning), **the known baseline**; none is in a file this task added or edited (grep of the full output for each touched path: no hit).

`npx tsc --noEmit`: no output, exit 0.

`npm run check:labels`:
```
> node scripts/check-labels.js
check-labels: OK - 327 files scanned, 2066 default labels checked.
```
It passes **without** a new allowlist entry: the section 6 texts comply with the glossary ("tournament team", "team players" are glossary terms), so the er-m-committee precedent was not needed.

`npx jest`, only the files touched or added and the suites that cover the touched modules (35 files; the full suite was not run):
```
FAIL src/screens/__tests__/CreateGameScreen.test.tsx
FAIL src/screens/__tests__/EventDetailScreen.test.tsx (9.621 s)
FAIL src/components/home/__tests__/homeComponents.test.tsx
FAIL src/components/home/__tests__/TournamentListRows.test.tsx
FAIL src/screens/__tests__/TournamentTabBodies.test.tsx (21.37 s)
Test Suites: 5 failed, 30 passed, 35 total
Tests:       81 failed, 492 passed, 573 total
```
The 5 failing suites fail **identically on `origin/main`**, run as the same single files in a worktree of `bcc55d8` (compared test by test with `--json`: 81 failed on main, 81 on the branch, no test newly failing, none fixed):
```
Test Suites: 5 failed, 5 total
Tests:       81 failed, 103 passed, 184 total
```
Per file: `CreateGameScreen.test.tsx` 37 and `EventDetailScreen.test.tsx` 34 (the known 71), `TournamentTabBodies.test.tsx` 2 (the known Media pair), **plus `homeComponents.test.tsx` 7 and `TournamentListRows.test.tsx` 1**, which are not in the briefed baseline but fail the same on main (flagged, not fixed).

Existing tests that asserted the old behaviour were updated: `GroupsTeamsSwitch` ("the cards are not tappable"), `notificationRouting` (team pushes opened the Tournament teams list), `tournamentWizard` (`firstFocusField` for a description error on step 1), and two step-6 tests (`CreateGameEmailInvites`, `CreateGameInviteeVisibility`) that counted every text input and now ignore the Remarks field (before the edit they were 4 new failures vs main; after, none).
A cold first run of `TeamDetail.test.tsx` once exceeded the 5 s default on transform time for its first test; every later run passed (warm cache).

New tests: `teams.test.ts` (4), `TeamDetail.test.tsx` (21: viewer states, 403/404, request, accept, decline, approve, reject, edit, coded 409, remove, leave, invite, no captain-only tools for a player, no Leave/Make captain for the captain), `TeamsDiscover.test.tsx` (6), `CreateGameRemarks.test.tsx` (3), `EventDetailRemarks.test.tsx` (5), `TournamentRemarks.test.tsx` (8), `VenueRowAddress.test.tsx` (2), plus additions to `TournamentWizardScreen`, `tournamentWizard`, `TournamentEdit`, `GroupsTeamsSwitch`, `notificationRouting`. Mapping to the design: TS-T9 `TeamDetail` + `GroupsTeamsSwitch`; TS-T10 `TeamsDiscover` + request in `TeamDetail`; TS-T11 `TeamDetail` (captain and player tools; make-captain and captain-leave are blocked, section 0); TS-T12 `notificationRouting` (history rows use the same resolver; `NotificationHistoryScreen` has no change); TS-T13 `CreateGameRemarks`, wizard additions, `EventDetailRemarks`, `TournamentRemarks`.

**D5 reproduction.** The test `VenueRowAddress.test.tsx` was written first and failed on the unchanged `VenueRow` (address `numberOfLines` 2, name one line, no `minWidth`), then passed with the fix (checked with the fix stashed). Jest cannot measure layout, so what is reproduced is the line cap and the missing `minWidth`, not the pixel width. Whether that is the whole of the owner's "cut off" is OI-5 and must be looked at on the device at 4.3 with a long address.

## 3. Label audit

All 30 section 6 keys of the app (the `mob.*` ones) are in M1 `d5f1b7a3c926` (`LABELS`, read from `pratheeshku/meetup` main) with exactly the bundled text; the web keys of M1 are not bundled in the app and not used. No key was renamed or invented.

| Key | Seeded (M1) | Bundled text equal | Used in |
|---|---|---|---|
| `mob.remarks.label` | yes | yes | CreateGameScreen |
| `mob.remarks.placeholder` | yes | yes | CommitteeStep, CreateGameScreen |
| `mob.remarks.title` | yes | yes | TournamentOverview, EventDetailScreen, TournamentDetailScreen |
| `mob.team.accept` | yes | yes | TeamDetailScreen |
| `mob.team.action_failed` | yes | yes | TeamDetailScreen |
| `mob.team.approve` | yes | yes | TeamDetailScreen |
| `mob.team.captain_badge` | yes | yes | TeamDetailScreen |
| `mob.team.decline` | yes | yes | TeamDetailScreen |
| `mob.team.detail_title` | yes | yes | RootNavigator (screen title) |
| `mob.team.edit` | yes | yes | TeamDetailScreen |
| `mob.team.invite_player` | yes | yes | TeamDetailScreen |
| `mob.team.invite_search_placeholder` | yes | yes | TeamDetailScreen |
| `mob.team.invite_sent` | yes | yes | TeamDetailScreen |
| `mob.team.invited_banner` | yes | yes | TeamDetailScreen |
| `mob.team.leave` | yes | yes | TeamDetailScreen |
| `mob.team.leave_pick_captain` | yes | yes | **not used** (blocked, section 0) |
| `mob.team.make_captain` | yes | yes | **not used** (blocked, section 0) |
| `mob.team.not_available` | yes | yes | TeamDetailScreen |
| `mob.team.reject` | yes | yes | TeamDetailScreen |
| `mob.team.remove_player` | yes | yes | TeamDetailScreen |
| `mob.team.request_join` | yes | yes | TeamDetailScreen |
| `mob.team.request_pending` | yes | yes | TeamDetailScreen |
| `mob.team.request_sent` | yes | yes | TeamDetailScreen (toast) |
| `mob.team.requests_title` | yes | yes | TeamDetailScreen |
| `mob.team.section_players` | yes | yes | TeamDetailScreen |
| `mob.teams.discover_empty` | yes | yes | TeamsDiscoverContent |
| `mob.teams.discover_search` | yes | yes | TeamsDiscoverContent |
| `mob.teams.switch_discover` | yes | yes | TeamsSection |
| `mob.teams.switch_mine` | yes | yes | TeamsSection |
| `mob.tw.description` (reworded to "Remarks") | yes | yes | CommitteeStep (moved row), TournamentEditScreen |

Existing mobile keys reused where section 6 has no key for the text (all already bundled; none is part of M1, so whether the server holds a row for them was not checked): `mob.common.view_arrow` ("View", card button), `mob.dashboard.sports_all` ("All", sport chip), `mob.teams.load_error` (Discover read failure), `mob.teams.visibility_public` / `mob.teams.visibility_private` (the card and the edit chips; **"Invite only" is `mob.teams.visibility_private`**, section 6 has no separate key for the Discover mark), `mob.common.cancel`, `mob.common.save`, `mob.create_group.team_name` (the name field of the edit form), `mob.tw.err_description_long`, and the `mob.reg.err.*` labels reached through `refusalText` (for example `forbidden`, `not_found`, `team_name_taken`). The system labels of `UserSearchPicker` are its own.

## 4. Contract audit

Backend source: `pratheeshku/meetup` main @ `20a3989` (includes PR #180): `teams/router.py`, `teams/schemas.py`, `teams/policies.py`, `teams/service.py`, `migrations/versions/d5f1b7a3c926_*`, `docs/reports/tm-bw-web-report.md`.

| Call (client in `src/api/teams.ts`) | Backend source | Fields used |
|---|---|---|
| `GET /teams` `getTeams` (existing client) | `list_teams`, `visible_teams_filter` = `can_view_team.filter` (A1: includes a private team the caller is invited to) | `TeamResponse`: id, name, sport, visibility, captain_user_id, created_at (`player_count`, `my_role` null) |
| `GET /teams/mine` `getMyTeams` (existing) | `list_my_teams` | same + `player_count`, `my_role` |
| `GET /teams/{id}` `getTeam` | `get_team`; dependency `can_view_team` (404 when not visible, AD-3) | `TeamResponse` |
| `GET /teams/{id}/members` `getTeamMembers` | `get_team_members`; `can_read_roster` (403 for no row) | `TeamMembershipResponse`: id, team_id, user_id, role (`captain`/`member`), status, created_at, user_display_name, user_nickname |
| `POST /teams/{id}/requests` `requestToJoinTeam` | `request_to_join` (no body; 403 private, 400 existing row) | none |
| `POST /teams/{id}/invites` `inviteToTeam` | `invite_user`, `TeamInviteRequest` | body `user_id` |
| `POST /teams/{id}/invites/respond?accept=` `respondToTeamInvite` | `respond_invite` | query `accept` (bool) |
| `POST /teams/{id}/requests/{user_id}/respond?accept=` `respondToTeamRequest` | `respond_request` (captain) | path `user_id`, query `accept` |
| `DELETE /teams/{id}/members/{user_id}` `removeTeamMember` | `remove_team_member` / `service.remove_member` | optional query `replacement_captain_id` (client supports; the app never sends it, section 0) |
| `PATCH /teams/{id}` `updateTeam` | `update_team`, `TeamUpdate` (`extra = forbid`) | name, visibility, changed fields only |
| `GET /users/search` `searchUsers` (existing, through `UserSearchPicker`) | `users/router.py` (per `src/api/users.ts`) | q, exclude_team_id |
| `POST /events` `description` (existing client, field now sent) | `EventCreate.description`; 5000 bound, trimmed, blank to null per tm-bw-web report items 2 and A2 | `description` (string or null) |
| `POST /tournaments/v2/create` wizard body `description` (existing `createWizardTournament`) | unchanged; sent only when non-empty | `description` |
| `PATCH /tournaments/{id}` `description` (existing, er-m-committee) | unchanged | `description` |
| **`POST /teams/{id}/captaincy`** | **does not exist** | not used (section 0) |

Status handling that the screens rely on: 404 on the team = not available; 403 on the roster = no row (roster still loads for `invited` and `requested` rows, per `can_read_roster`); a refused action shows a label.

## 5. Rules audit

- **Literal colours:** none added (diff of added source lines searched for `#rrggbb` and `rgb(a)`: no hit). Styles use `colors`, `spacing`, `radius`, `typography`, `borderWidth` tokens only.
- **Fixed-size boxes for icon-plus-text rows:** player and request rows use a 40 by 40 avatar box (`AVATAR_BOX`) beside a flexible name; the venue pin box was already fixed (32) and is unchanged.
- **Tokens and logs:** no token, `AsyncStorage` or `Keychain` use and no `console` or logger call in added source. Remarks text and names are never logged.
- **Correlation id:** every user action goes through `withCorrelationId()` once: opening or re-reading the detail (team plus roster share one id), each action (request, accept, decline, approve, reject, edit, remove, leave, invite), opening or refreshing Discover (both reads share one id). One call is outside it: Discover's sports-name lookup `loadSportsCatalog()` (the shared cached `GET /admin/sports/public` loader every screen uses for sport names); it gets the interceptor's fallback id.
- **Client-side computation:** only what the design asks for: the viewer state is read from the caller's own roster row (AD-1); Discover removes the Mine ids and filters by sport and name on the client (AD-2); "captain" for the UX gating is `captain_user_id === me` and is UX only. Nothing the backend returns is recomputed (no counts, no standings; Discover shows no player count).
- **Plain text:** Remarks render in `Text` as typed; a test pins that `<b>` and links are not interpreted. Server refusal text is never shown (tests assert it is absent).
- **Secrets, native config, package files, `docs/`, versionCode:** untouched (`npm ci` only installed `node_modules`; `package-lock.json` unchanged).

## 6. Drift from the design, and things to decide

1. **Blocked: Make captain and captain leave (section 0).** The one gap that needs a backend task.
2. **TS-12 on mobile for games is not met.** The game edit flow (`EventDetailScreen` edit steps 1 to 4) has **no description field** (`mob.game_detail.edit_description_*` labels exist but nothing uses them), so there is nothing to relabel and the organizer cannot edit a game's remarks in the app. The design's mobile table (section 4) does not list a game-edit change, so no field was invented. Needs a decision (and a board or an addendum line) if the owner wants it.
3. **The tournament overview did not show the description at all** for lifecycle version 2 (the design says "already shows it"). `TournamentOverview` now has a Remarks block (only when non-empty); the legacy page, which showed the text bare, gets the title. Both are additions to make TS-11 true.
4. **Remarks on the v1 tournament form** (`CreateGameScreen` Tournament fallback when no wizard template is listable) is not added: that path has no description today. The field is drawn for a game only.
5. **Wizard label.** The moved row uses `mob.tw.description` (reworded to "Remarks" by M1, section 6 "Existing"), not `mob.remarks.label`; its placeholder is `mob.remarks.placeholder`. The length error uses the existing `mob.tw.err_description_long` whose text still says "The description can be at most {max} characters." (not reworded by M1). Cosmetic; the owner can edit the label in the admin editor.
6. **Wizard validation.** `validateBasics` no longer checks the description; the new `validateRemarks` runs on the Committee step and measures the length after trimming (A2). The committee banner now excludes the Remarks message, which shows under its own field.
7. **Venue row.** The name also goes from one to two lines in the list card (the design speaks only of the address); the chevron is kept. The width itself is a device check (section 2, D5).
8. **Detail screen layout.** No board: built minimal with existing components (header card, buttons, rows) and tokens, as INDEX.md instructs when no board exists; ask the owner to review on the device. An accepted invitation or request re-reads the detail; after Decline of a private team the re-read gives 404 and the screen shows the not-available notice (AD-1). Remove and Leave use a native confirmation titled with the action label (no extra copy was invented). The Join request sent text is a toast.
9. **Discover shows every team the server returns that is not in Mine.** The server already limits the list to public teams plus a private team the caller is invited to (or captains); the client does not try to tell them apart, so a private team the caller captains without an active row would also appear, marked "Invite only".
10. **Roster visibility of requested rows:** the captain sees pending requests in "Join requests"; other players do not (the section is captain-only, UX only; the roster route returns them to everyone with a row).
11. **Known failures** (section 2): 81 tests fail identically on main; two of the five files (`homeComponents`, `TournamentListRows`) are beyond the briefed baseline.
12. **Branch name.** The session was assigned `claude/dreamy-wozniak-hxyx3l`; there is no `tm-m-teams-remarks` branch.
13. The repo is not Prettier-clean (three existing files checked with `prettier --check` fail it), so Prettier was not applied; code follows the surrounding style.

Screenshots: taken on the Mac at the 4.3 device test and attached to the 3.2 review. Nothing was built, no version chosen, no agent dispatched, no force-push.
