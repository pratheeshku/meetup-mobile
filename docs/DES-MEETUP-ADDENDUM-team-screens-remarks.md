# DES-MEETUP-ADDENDUM-TEAM-SCREENS-REMARKS

**Doc ID:** DES-MEETUP-ADDENDUM-TEAM-SCREENS-REMARKS
**Version:** v1.0
**Status:** **DRAFT for owner review (2026-10-28).** Requested by the owner in conversation on 2026-10-28 ("we need the screen for this, if not the purpose is lost. can you build this", then "go ahead" to draft). Not yet approved: no brief is written and no step starts until the owner approves.
**Owner:** Pratheesh
**Date:** 2026-10-28
**Scale Tier:** T1
**Baseline:** repo `pratheeshku/meetup` `main` and `pratheeshku/meetup-mobile` `main` after the tournament-edit-recurring release (mobile `20cd9fd`, Android versionCode 105, iOS build 48; code read 2026-10-28). Design-only addendum. It does not edit other documents; section 9 lists what it amends.
**Governing files:** `Enterprise_Design_Principles.md` v1.1 (P1-P17) and `design-best-practices.md` v1.0 (BP-01-BP-13). Both read in full from the Project knowledge base before drafting (Phase 1.5 gate passed). Deviations are listed in section 3 (D-1 to D-3), each naming the file and rule.
**Depends on:** `DES-MEETUP-ADDENDUM-teams-payments` v1.2 (AD-4, AD-14, AD-15; this addendum is the follow-on task `tp-mobile-teams` it named), `-access-consistency`, `-tournament-edit-recurring` v1.13, `-tournament-lifecycle` v1.4, `docs/glossary.json`.

**Process notes (flagged):**
1. **There is no mobile design for the team screens.** `teams-payments` AD-4 and AD-16 only name the follow-on task `tp-mobile-teams` and its scope in one line (team detail, browse and request to join, invite response, captain request list, final push routing). No board exists in either repo. This addendum is the board of record for these screens (the same ruling as `tournament-edit-recurring` B-1 and A38); the mobile "no board, stop and ask" rule is answered by this document.
2. **"Remarks" is the existing `description` field.** `events.description` and `tournaments.description` are nullable `Text` columns, already accepted by the create and update schemas and shown on web. A new column would duplicate it. No migration for the field; see AD-4.
3. **The tagline is not in this design.** The home top bar already renders `mob.brand.tagline` under the wordmark. The server label was seeded as "PLAY TOGETHER" and overrides the app default "Create. Connect. Play.". The owner edits the label in the admin console (labels editor, immediate effect). Recorded in section 7.
4. Facts below were read from the code on 2026-10-28 (BP-01): `teams/router.py`, `teams/policies.py`, `teams/schemas.py`, `teams/models.py`, `events/models.py`, `tournaments/models.py`, `frontend/app.js` (web team detail), mobile `src/api/teams.ts`, `src/navigation/types.ts`, `src/notifications/notificationRouting.ts`, `src/components/venue/VenueRow.tsx`.

---

## 1. Executive summary

Three items from the owner's requests of 2026-10-28.

1. **Tournament team screens on mobile.** Tapping a tournament team in Groups does nothing today, by design of `teams-payments` AD-4. This addendum builds the team detail screen and the journeys around it: open a team, discover public tournament teams, request to join, respond to an invitation, and, for the captain, approve requests, invite, remove, make captain, edit and leave. All endpoints exist; the one backend change is that a person invited to a private team may open it (TS-08).
2. **Remarks on games and tournaments.** An optional free-text field on the last input step of game and tournament creation, on web and mobile, stored in the existing `description` column, visible to everyone who can see the game or tournament, editable by the organizer, copied into later games of a series.
3. **Venue address cut off** in the mobile tournament list card: a layout fix to the venue row.

Nothing here changes registration, payments, fixtures or the release just shipped.

## 2. Requirements and constraints

### 2.1 Requirements (restated from the owner's words of 2026-10-28)

| ID | Requirement |
|---|---|
| TS-01 | Tapping a tournament team in Groups > Tournament teams opens its detail screen (owner: "tournament teams in my groups are not opening when I click on them"). |
| TS-02 | The detail shows name, sport, visibility, the captain, and for people with a membership row the team players with their roles and status. |
| TS-03 | Public tournament teams can be discovered and joined (owner: "it should have public teams to be discovered and allowing option to join"). Discovery sits in Groups > Tournament teams as a Mine / Discover switch. |
| TS-04 | A person requests to join a public team; the screen then shows "Join request pending"; the captain is notified (exists, `teams-payments` AD-14). |
| TS-05 | A person invited to a team accepts or declines from the team detail, including from the push. |
| TS-06 | The captain approves or rejects join requests, edits name and visibility, makes another team player captain, and removes a team player. |
| TS-07 | Any active team player invites a player by search (the server rule today); a team player leaves; a captain who leaves names a replacement captain. |
| TS-08 | A person who holds an `invited` membership row can open that team's detail even if it is private. |
| TS-09 | The pushes `team_invite` and `team_join_request` open the team detail (final routing, `teams-payments` AD-15). |
| TS-10 | Remarks: optional free text at the end of game and tournament creation, on web and mobile (owner: "optional", "capture any specific information which we didn't capture"). |
| TS-11 | Remarks are visible to everyone who can see the game or tournament (owner: "should be visible to everyone"). The existing access rules decide who can see the game or tournament; remarks add no rule. |
| TS-12 | The organizer can edit remarks after creation in the existing edit screens. Later games of a series copy them. |
| TS-13 | The venue name and address in the mobile tournament list card are not cut off while space remains on the right. |

### 2.2 Constraints

Additive only (P14, with D-1). No RLS, DB triggers or DB-side validation. Authorization in the app layer at the entry point (P15, `policies.py`). Mobile never invents endpoints and never recomputes what the backend returns. All customer text through labels and `docs/glossary.json` (bare "team", "member", "event" are banned: use "tournament team", "team player", "group member", "game"). Migrations are written by agents and run by the owner one at a time. Briefs are separate per repo and in chat only.

**Out of scope.** The tournaments a team has entered, team statistics, team chat, disbanding a team (admin only today), team logo, merging teams, server-side search and pagination of the team list (OI-2), editing remarks for the whole series at once (OI-7).

## 3. Architecture decisions

**AD-1: One detail screen, four viewer states (TS-01, TS-02, TS-04, TS-05).** The screen calls `GET /teams/{id}` and `GET /teams/{id}/members`. The viewer state comes from the caller's own row in the roster: `active` (team player, shown the roster and the player actions), `invited` (shown Accept and Decline), `requested` (shown "Join request pending"). A viewer with no row gets `403` from the roster route (the roster rule is "any membership row or admin" and it answers a denial with 403): that is not an error, it means non-member, and the screen shows the header and a Request to join button for a public team. A `404` from the team route itself means "not available" (deleted, or private and not visible) and shows the not-available notice. The server stays the authority; the client never infers a right it was not given.

**AD-2: Discover (TS-03).** Groups > Tournament teams gets a Mine | Discover switch (the existing switch component). Mine is today's list (`GET /teams/mine`). Discover reads `GET /teams` (visible teams: public, plus the caller's own private ones), removes the teams already in Mine and shows public teams as cards in the tournament-list card layout, with a client-side sport filter and name search. `player_count` is returned only by `/teams/mine`, so Discover cards show no count (null hides the line). Mine cards become tappable and open the detail. Unbounded list: see OI-2.

**AD-3: Invited people can open a private team (TS-08).** Today `can_view_team` allows public, or private for an active member, the captain or an admin. A person invited to a private team therefore gets `404` on `GET /teams/{id}` and cannot see what they are accepting. The rule gains one clause: a caller holding a membership row with status `invited` for the target team may view it. Not `requested`, `rejected`, `removed` or `left`. Roster read is unchanged (any membership row already covers `invited`; a denial there stays 403). This is an authorization change under P15; section 5 lists the negative tests.

**AD-4: Remarks reuse `description` (TS-10 to TS-12).**
- **Storage:** no new column. `events.description` and `tournaments.description` stay as they are.
- **Label:** the customer-facing label of the game and tournament field becomes "Remarks" (optional). Group descriptions are untouched. The keys of the existing description labels stay and their texts are reworded (section 6); the owner can revert the wording in the admin label editor with no build.
- **Position:** the last input step of creation. Mobile game: step 6 (invites). Mobile tournament wizard: the description row moves from step 1 (board `TournBasics`) to the last input step before the review; the addendum supersedes that row of the board (D-2). Web game form: the bottom of the form before the submit button. Web tournament wizard: the last input step before the summary.
- **Display:** web already shows it on the game and tournament pages (empty text becomes "No remarks."). Mobile tournament overview already shows it; the mobile game view gains a Remarks section, shown only when non-empty, plain text.
- **Validation (P9):** server-side maximum 5000 characters on create and update of games and tournaments (the value the web tournament form and the mobile wizard already use); trimmed; blank stored as null. Clients enforce the same limit as UX only.
- **Series:** the recurring-games job already copies `description` from the latest game; the "this and following" edit does not carry remarks (OI-7).
- **Access:** remarks are shown wherever the game or tournament is shown, so `access-consistency` applies unchanged. They are user content: displayed as plain text, escaped on web, never interpreted.

**AD-5: Push routing (TS-09).** `team_invite` and `team_join_request` open the team detail with the notification's `entity_id` as the team id. History rows use the same route. The notification payload is unchanged.

**AD-6: Venue row (TS-13).** The venue name and address column fills the width of the card's detail area to the right of the pin; the address wraps to up to three lines before truncating. The task reproduces the fault with a long address first (OI-5); if it cannot be reproduced from the code, it stops with a Blocked Report.

### 3.1 Deviations from the governing files

| ID | File and rule | Deviation | Rationale |
|---|---|---|---|
| D-1 | `Enterprise_Design_Principles.md` P14 (additive only) | A maximum length (5000) is added to `description` on game and tournament create and update. This tightens an input that had none. | P9 (validate at every boundary) is not met today: the field accepts unbounded text from any authenticated user. No known client exceeds 5000 (web tournament form `maxlength` 5000, mobile `DESCRIPTION_MAX` 5000; the web game form has no limit and mobile has no game description input). Updates send changed fields only, so a stored value above the limit that is not edited is unaffected. P9 outranks a strict reading of P14 here. |
| D-2 | Board `TournBasics` of the tournament wizard (`tournament-lifecycle` AD-20) | The description row moves from step 1 to the last input step and is relabelled. | The owner asked for remarks "at the end of tournament and game creation". A second field would duplicate `description` (AD-4). The addendum is the board of record for the moved row. |
| D-3 | `Enterprise_Design_Principles.md` P1 (config-driven) | The limit 5000 is a schema constant, not configuration. | It is an input bound like the existing `max_length` values of the same schemas (team name 100, event title 150), not a behaviour threshold. Moving all schema bounds to configuration is a separate, larger change. |

## 4. Component and integration design

| Component | Change |
|---|---|
| `teams/policies.py` | `can_view_team` gains the `invited` clause (AD-3). |
| `events/schemas.py`, `tournaments/schemas.py` | `description` bounded to 5000, trimmed, blank to null on create and update (AD-4). |
| `frontend/app.js` (web) | Remarks label and placeholder on the game form, the game edit form, the tournament wizard (moved to the last input step), the tournament edit and the summary; the game and tournament pages' "No remarks." text. Label rewording only for existing keys. |
| Mobile `src/api/teams.ts` | Clients for team, members, join request, invite, invite respond, request respond, remove or leave, captaincy, update. |
| Mobile screens | `TeamDetailScreen` (new), Groups Tournament teams Mine / Discover, tappable team cards, `CreateGameScreen` step 6 remarks, tournament wizard last input step remarks, `EventDetailScreen` Remarks section, `VenueRow` width. |
| Mobile `notificationRouting.ts` | Team pushes route to `TeamDetail` (AD-5). |
| Migrations | M1: label seeds only (section 6). No schema change. |

**Contract used (all existing):** `GET /teams`, `GET /teams/mine`, `GET /teams/{id}`, `GET /teams/{id}/members`, `POST /teams/{id}/requests`, `POST /teams/{id}/invites` (body `user_id`), `POST /teams/{id}/invites/respond?accept=`, `POST /teams/{id}/requests/{user_id}/respond?accept=`, `DELETE /teams/{id}/members/{user_id}` (leave when the id is the caller's; `replacement_captain_id` query for a captain who leaves), `POST /teams/{id}/captaincy` (body `new_captain_id`), `PATCH /teams/{id}` (name, visibility), `GET /users/search`. Statuses: `invited`, `requested`, `active`, `rejected`, `removed`, `left`.

**Failure behaviour (P7).** A failed team read shows a retry state, never a stale detail. A failed action keeps the screen in its previous state and shows the coded or labelled reason; the server refusal text is never shown raw. A failed Discover read shows a retry state and leaves Mine usable. A failed remarks save is the normal create or edit failure of the game or tournament.

## 5. Security and compliance

- **P15 and P13.** Every route above already declares its access rule. The one rule that changes (`can_view_team`, AD-3) needs API-level negative tests with the database backstop absent: an anonymous caller is refused; a user with no row cannot open a private team; a user whose row is `requested`, `rejected`, `removed` or `left` cannot open a private team; an `invited` user can; roster read is unchanged for a non-member (403). Tests TS-T1 to TS-T5.
- **Discover leaks nothing private:** `GET /teams` applies the same visibility filter in the application query. Test TS-T6: a private team of another user is absent from the list.
- **Remarks (P9):** bound and trimmed on the server; plain text only; escaped on web output; no HTML or link rendering on mobile. Access follows the game or tournament (TS-11).
- **P6, P12:** remarks are part of the game or tournament record and follow its retention and deletion. No new personal-data store.
- **Logging (P4):** team actions already log with the correlation ID; remarks text is never written to logs (the masking rule for free text applies: log lengths, not content).
- **Rate limits (P17):** existing limits on team routes and game and tournament create and update are unchanged.

## 6. Observability, operability and labels

No new metrics or alerts: failures of these paths are already counted by the existing request metrics. Rollout: backend and web first, then mobile; the invited-viewer rule is backward compatible, and the web and mobile changes are independent. Rollback: label wording by the admin editor; the policy clause and the length bound by redeploying the previous image (no data change to undo).

**Label wording (glossary-compliant).** M1 seeds these keys. Existing description keys keep their keys and take the new text.

| Keys | Text |
|---|---|
| `mob.remarks.label`, `web.remarks.label` | Remarks (optional) |
| `mob.remarks.placeholder`, `web.remarks.placeholder` | Anything else players should know |
| `mob.remarks.title`, `web.remarks.title` | Remarks |
| `web.remarks.none` | No remarks. |
| Existing: `web.event.description`, `web.event_create_form_html.description`, `web.tournament.description`, `web.tournament_create_form_html.description`, `web.tw.basics.description`, `web.tw.sum.description`, `mob.tw.description` | Remarks (the agent confirms each against the code and lists the before and after text) |
| `mob.team.detail_title` | Tournament team |
| `mob.team.section_players` | Team players |
| `mob.team.captain_badge` | Captain |
| `mob.team.request_join` / `request_sent` / `request_pending` | Request to join / Join request sent / Join request pending |
| `mob.team.invited_banner` | You were invited to join this tournament team |
| `mob.team.accept` / `decline` | Accept / Decline |
| `mob.team.invite_player` / `invite_search_placeholder` / `invite_sent` | Invite a player / Search by name or nickname / Invitation sent |
| `mob.team.requests_title` / `approve` / `reject` | Join requests / Approve / Reject |
| `mob.team.make_captain` / `remove_player` / `leave` / `edit` | Make captain / Remove from tournament team / Leave tournament team / Edit tournament team |
| `mob.team.leave_pick_captain` | Choose a new captain before you leave |
| `mob.team.not_available` | This tournament team is not available. |
| `mob.team.action_failed` | That did not work. Please try again. |
| `mob.teams.switch_mine` / `switch_discover` | Mine / Discover |
| `mob.teams.discover_empty` | There are no public tournament teams to join yet. |
| `mob.teams.discover_search` | Search tournament teams |

## 7. Operational note (not a build item)

Tagline: in the admin console labels editor set `mob.brand.tagline` to "Create. Connect. Play." (owner action, immediate, no build). Verified cause: the seed `3dfac04dd7ed` set "PLAY TOGETHER" and the server value overrides the bundled default.

## 8. Test requirements

Risk: the viewing rule **High** (authorization); remarks bound **Medium**; screens **Medium**; label wording **Low**. Affected modules only, one run.

| # | Test |
|---|---|
| TS-T1 | Anonymous `GET /teams/{id}` of a private team: refused. |
| TS-T2 | A user with no membership row, private team: `404`. |
| TS-T3 | A user whose row is `requested`, `rejected`, `removed` or `left`, private team: `404`. |
| TS-T4 | A user whose row is `invited`, private team: team `200`, and the roster read `200` for that user. |
| TS-T5 | A non-member of a public team: team `200`, roster `403`. |
| TS-T6 | `GET /teams` omits another user's private team. |
| TS-T7 | `description` above 5000 characters on game create, game update, tournament create and tournament update: `422`; exactly 5000: accepted; whitespace only: stored as null. |
| TS-T8 | A recurring game's later games carry the first game's description (existing behaviour pinned). |
| TS-T9 | Mobile: team card tap opens the detail; viewer states `active`, `invited`, `requested` and non-member render the right actions; a `403` roster is non-member, a `404` team is the not-available notice. |
| TS-T10 | Mobile: Discover excludes Mine teams, filters by sport and name; Request to join moves the screen to pending. |
| TS-T11 | Mobile: captain actions call the right route; a captain who leaves must name a replacement; coded refusals show labels. |
| TS-T12 | Mobile: `team_invite` and `team_join_request` pushes and history rows open the detail. |
| TS-T13 | Mobile: remarks field is optional, enforces 5000, sends null when blank; the game view shows the Remarks section only when non-empty. |
| TS-T14 | Web: remarks on the last input step of the game form and the tournament wizard; "No remarks." shown when empty. |

## 9. Amends

`teams-payments` AD-4 and AD-15 (mobile team journey now built; Mine cards become tappable; final routing). `tournament-lifecycle` AD-20 and board `TournBasics` (description row moved and relabelled, D-2). `access-consistency` (one read clause added for invited people, AD-3). Wording only in those documents; their versions are not bumped.

## 10. Steps and progress tracking

Tasks are named `{step}.{n} {repo} ({machine}) {task}` and progress is reported as `Step x.y of n · overall d of 19 (p%)`, updated after every step. Machines: Cloud (an agent session), Mac (`~/Developer/meetup-mobile`), AWS (`/home/ubuntu/meetup`, see `docs/ENVIRONMENTS.md`).

**Step 1: Instruction execution for meetup (backend and web), 3 steps**

| # | Task ID | Content |
|---|---|---|
| 1.1 | `tm-bw-teams-remarks` | `can_view_team` invited clause, description bound on games and tournaments, tests TS-T1 to TS-T8 |
| 1.2 | `tm-web-remarks-labels` | Web remarks placement and wording, M1 (label seeds, existing description label rewording), TS-T14 |
| 1.3 | `tm-bw-review-merge` | Reports reviewed and merged by the architect |

**Step 2: Build for meetup (owner, AWS), 5 steps**

| # | Content |
|---|---|
| 2.0 | Backup and rollback tag recorded |
| 2.1 | `git pull --ff-only`, build `api worker` |
| 2.2 | Run M1 (`alembic upgrade +1`) |
| 2.3 | Restart `api` and `worker`, health and version check |
| 2.4 | Browser verification: remarks on game and tournament create, view, edit and recurring copy; the invited-viewer rule through the API |

**Step 3: Instruction execution for meetup-mobile, 6 steps**

| # | Task ID | Content |
|---|---|---|
| 3.1 | `tm-m-team-detail` | Team API clients, `TeamDetailScreen` with the four viewer states, tappable Mine cards, push routing (AD-1, AD-5) |
| 3.2 | `tm-m-discover-join` | Mine / Discover switch, Discover list, request to join, invite response (AD-2) |
| 3.3 | `tm-m-captain` | Approve or reject requests, invite player, make captain, remove, edit, leave with replacement captain |
| 3.4 | `tm-m-remarks-venue` | Remarks on game step 6 and tournament wizard, Remarks section on the game view, venue row width (AD-4, AD-6) |
| 3.5 | `tm-m-report` | `check:labels`, type-check, scoped tests, label audit against M1, consolidated report |
| 3.6 | `tm-m-review-merge` | Reports reviewed and merged by the architect |

**Step 4: Build the mobile app (owner), 5 steps**

| # | Content |
|---|---|
| 4.0 | Mac: `git pull --ff-only` in `~/Developer/meetup-mobile` |
| 4.1 | Mac: Android AAB with `npm run build:aab`; commit `version.properties` |
| 4.2 | iOS: raise `ios.buildNumber` (and the Xcode defaults), run the iOS TestFlight workflow |
| 4.3 | Device test: tap a tournament team, discover and join, invite response, captain tools, remarks, venue address |
| 4.4 | Release to Play internal testing and TestFlight |

**Totals: 3 + 5 + 6 + 5 = 19 steps.** Order: strictly sequential within a step; step 2 starts after 1.3; step 3 starts after step 2 (the viewing rule is deployed); step 4 starts after 3.6. Every step produces a report; the architect rates it and either accepts it or sends a fix brief. Agents never self-certify, never choose versions and never edit governance documents.

## 11. Risks and mitigations

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Existing tournament descriptions suddenly read as "Remarks" | Wording change only; the owner can revert the label in the admin editor (OI-4) |
| R-2 | The venue fault is not what the code suggests | Step 3.4 reproduces first and stops with a Blocked Report if it cannot (OI-5) |
| R-3 | The 5000 bound rejects a client that sends more | No known client does (D-1); the PATCH sends changed fields only |
| R-4 | Discover is slow with many public teams | OI-2 gate |
| R-5 | The invited clause exposes a private team to the wrong person | Exactly one row status, scoped to the target team, five negative tests (TS-T1 to TS-T5) |

## 12. Open items

| ID | Item | Severity | Gate or status |
|---|---|---|---|
| OI-1 | Owner approval of this draft | 🟠 HIGH | Blocks step 1 |
| OI-2 | `GET /teams` has no search or paging; Discover filters on the client | 🟡 MEDIUM | Reopen when the visible public teams exceed 300, or the list response p95 exceeds 500 ms over 7 days: add `q`, `sport`, `limit` and `offset` additively |
| OI-3 | Discover cards have no player count (`player_count` only from `/teams/mine`) | 🟢 LOW | Add the field to `GET /teams` additively if the owner asks |
| OI-4 | Existing descriptions now display as "Remarks" | 🟢 LOW | Accepted; label revert is an admin edit |
| OI-5 | The venue fault is read from code, not reproduced | 🟡 MEDIUM | Step 3.4 reproduces first |
| OI-6 | Tagline label | 🟢 LOW | Owner action in section 7 |
| OI-7 | "This and following" edit does not carry remarks | 🟢 LOW | Accepted; remarks edit per game. Reopen if the owner asks for series-wide remarks |
| OI-8 | A team detail has no list of the tournaments the team entered | 🟢 LOW | Out of scope; separate request |

## 13. Approval record

**v1.0 DRAFT, 2026-10-28.** Awaiting the owner's approval (OI-1). Decisions taken from the owner's words: discovery and request to join are in scope; remarks are optional and visible to everyone who can see the game or tournament. Decisions taken by the architect and open to the owner's objection: remarks reuse `description` with the label "Remarks" (AD-4, D-2); bound of 5000 (D-1); Discover as a Mine / Discover switch (AD-2); mirror of the web team actions (AD-1, TS-06, TS-07).
