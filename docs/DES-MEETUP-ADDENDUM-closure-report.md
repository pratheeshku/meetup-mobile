# DES-MEETUP-ADDENDUM-closure-report

| Field | Value |
|---|---|
| Doc ID | DES-MEETUP-ADDENDUM-closure-report |
| Version | v1.0 |
| Status | APPROVED (owner, 2026-10-20). Requirements confirmed by the owner in conversation the same day |
| Owner | Pratheesh |
| Date | 2026-10-20 |
| Scale tier | T1 |
| Baseline | `DES-MEETUP.md` v1.75 (not edited). Amends `DES-MEETUP-ADDENDUM-dashboard.md` (v1.9, AD-20, AD-21) and `DES-MEETUP-ADDENDUM-tournament-lifecycle.md` (v1.3, AD-18) |
| Governing files | `Enterprise_Design_Principles.md` v1.1 (P1-P17), `design-best-practices.md` v1.0 (BP-01 to BP-13) |
| Platforms | Backend + web: `~/meetup`. Mobile: `~/Developer/meetup-mobile`. Separate briefs per repo |

## Change log

- v1.0 (2026-10-20): approved by the owner. No content change from v0.1. Open items OI-1 to OI-5 are non-blocking. Tasks cr-backend, cr-web, cr-mobile.
- v0.1 (2026-10-20): first draft. Owner feedback of 2026-10-20 (profile stats, upcoming games, create-game dates), after the review of the live code on the same day.

## Plain-language summary

1. **Stats were RSVP counts.** Played counted every past game where the user was `going`, and creating a game makes the organizer `going`. So hosting 32 games gave 32 "played". Won counted tournament fixture wins only. Nothing recorded whether anyone actually played or won a game.
2. **A closure report fixes that.** After a game or tournament ends, the organizer (for a tournament, any active committee member) fills a closure report: was it completed or not held; who actually played; who won and who was runner-up. That report is the only source of Played, Won and Hosted.
3. **Four statuses**, computed: active, cancelled, past (ended, no closure report yet, shown as "Pending closure"), closed (has a closure report).
4. **After the end time a game is frozen** except for its closure report, which stays editable (versioned, audited).
5. **Upcoming games** become one simple definition: the user's own games starting in the next N days, earliest first, never past. N and the number of rows shown are admin settings. The tab badge, the tab count and the list all use it.
6. **The Games view** shows active games only, with an "All games" button for past, cancelled and closed games, each with its status.
7. **Create and edit game** reject a start time in the past.
8. **Existing past games get no backfill.** They show "Pending closure" and count towards nothing until closed. Existing stats reset to 0 on release (owner decision).

## 1. Requirements (owner decisions, 2026-10-20)

| ID | Requirement |
|---|---|
| CR-01 | Every game and tournament has one lifecycle status: `active`, `cancelled`, `past` or `closed`. Computed, never stored (AD-1). |
| CR-02 | After a game's end time its organizer can submit a closure report: outcome (`completed` or `not_held`); if completed, who attended, the winner and the runner-up. No scores, no free text. |
| CR-03 | Tournaments have the same closure report. The organizer or any active committee member submits it, after the tournament's end time. Winner and runner-up are registrations (a player or a team). |
| CR-04 | After the end time nothing on a game can be edited except its closure report. |
| CR-05 | A closure report stays editable after submission. Every submission is a numbered version and is kept (append-only). |
| CR-06 | Played, Won and Hosted come only from closure reports (AD-5). RSVP rows and tournament fixtures are no longer a source. |
| CR-07 | Games and tournaments that ended before release have no closure report and are not backfilled. They show as `past` ("Pending closure"). |
| CR-08 | Upcoming games: the user's own games (organizer, going or waitlisted) that start within the next N days, earliest first. A past game never appears. N and the number of rows shown are set in the admin interface; default 7. |
| CR-09 | The tab badge, the tab count and the list use one definition. The count is the total in the window; the list shows up to the configured number. |
| CR-10 | The Games view lists `active` games by default. An "All games" button adds past, cancelled and closed games. Every row shows its status. |
| CR-11 | Create game (and a later change of start or end time) rejects a start time in the past. |
| CR-12 | Attendance step (owner decision): the closure form starts with everyone who was `going` ticked; the organizer unticks no-shows. Winner and runner-up are chosen only from the ticked people. |
| CR-13 | The same four statuses and the active/all toggle apply to the tournaments list. |

## 2. Scope and constraints

**In scope.** Backend and web and mobile: lifecycle status field, closure report (games and tournaments), post-end lock for games, profile summary source, upcoming endpoint and admin settings, create/edit time validation, Games and Tournaments list status filter, UI labels.

**Out of scope (named, not forgotten).** Scores or free-text notes in the report; notifications about closure (reminder, "you won"); a closure deadline or automatic closing; leaderboards; backfill of past games; making check-in (`event_checkins`) the attendance source; merging the tournament close-out feedback (`tournament_closeouts`) with the closure report. Gates in §7.

**Constraints.** No new RLS, DB triggers or DB-side validation (owner rule and AGENTS.md): every rule below is enforced in the application layer. Migrations are written, never run by an agent. Zero sibling imports between modules: the users module reads the closure tables with raw SQL, as `users/repository.py` does today. Interfaces change additively (P14), with the one named exception D-2.

## 3. Architecture decisions

**AD-1 Lifecycle status is computed (P14, no new stored status).** Evaluated in this order, first match wins:

| Status | Rule | Label |
|---|---|---|
| `closed` | a closure row exists (either outcome) | Closed |
| `cancelled` | game: `events.status = 'cancelled'`. Tournament: `tournaments.status` is `cancelled` or `dissolved` | Cancelled |
| `past` | not cancelled, no closure row, `coalesce(ends_at, starts_at) <= now` | Pending closure |
| `active` | everything else, including a game in progress | Active |

`closed` wins over `cancelled`, so a closure with outcome `not_held` shows as Closed with the sub-label "Did not take place". An organizer cancelling before the end is terminal: no closure report is needed or accepted, and it never becomes `past`. The closure outcome `not_held` exists only for a game that passed its end time without being played. The boundary is `<=` for both the status and the lock (AD-4); the existing `display_status` field keeps its `<` rule and is left unchanged (deprecated, removal needs a versioned deprecation, P14). One pure function per module returns the status; clients never compute it. A tournament's stored `completed` (committee close-out) does not imply `closed`.

**AD-2 Game closure report (events module).** Written only by `closure_service` in `events/`.
- Eligible: caller is `events.organizer_id`, and `now >= coalesce(ends_at, starts_at)`, and the game is not cancelled. Otherwise 403 / 409.
- Input: `outcome` (`completed` | `not_held`), `attendee_user_ids`, `winner_user_id`, `runner_up_user_id`, `expected_version` (0 for the first submission).
- Validation (P9, server side; client checks are UX only):
  - `not_held`: no attendees, no winner, no runner-up.
  - `completed`: at least one attendee; every attendee is an `event_participants` row with `status = 'going'` for that game (the organizer is one, created as `going`); the winner is an attendee; the runner-up is required when there are two or more attendees, is an attendee, and differs from the winner.
  - `expected_version` must equal the current version, else 409 with the current state (optimistic concurrency).
- Defaults offered to the client: all `going` participants ticked.
- Write: one transaction, game row locked `FOR UPDATE` first (lock order of access-consistency AD-4: event row first). Replaces the attendee rows, writes a revision (AD-6), increments the version. A resubmission with identical content changes nothing and writes no revision (P5 idempotent).
- Read: `GET` returns outcome, version, winner and runner-up to anyone who can view the game (the one view rule, `events/policies.py::can_view_event`). The attendee list is returned to the organizer only (data minimisation).

**AD-3 Tournament closure report (tournaments module).** Same contract and same validation, in `tournaments/closure_service.py`.
- Eligible: the organizer, or an active committee member under the AD-7 rule of the lifecycle addendum (the implementer names the table and policy after verifying them, BP-01); `now >= coalesce(ends_at, starts_at)`; status not `cancelled` or `dissolved`.
- Attendees, winner and runner-up are `tournament_registrations` with `status = 'registered'` (individual or team).
- Credit rows: on every submission the service writes one row per **person** to the closure player table: the registration's user for an individual registration; for a team registration, each member of that registration as the tournament module defines it (AD-6 of the lifecycle addendum: `tournament_registration_members` once populated, otherwise active `team_memberships`). The set is a snapshot at submission time, so later roster edits never change past stats (P6).
- The tournament's own status machine, close-out feedback and standings publication are untouched (D-3).

**AD-4 Post-end lock.**
- Games: from `now >= coalesce(ends_at, starts_at)` every game write returns 409 `game_ended`: edit, cancel, join, withdraw, waitlist promotion by a user action, invitations (create, accept, revoke). Only the closure report is writable. Tests list every write route (§9).
- Tournaments: from the same boundary the tournament's details, registration, invitations and committee membership are locked. Result entry, standings publication and close-out stay open, because a tournament can overrun its stated end date and its record keeping must not be blocked (D-3).
- A write route not listed in §9 and not named here is a gap: the implementer files a blocked report.

**AD-5 Stats source (users module).** `get_profile_summary` is rewritten. Three counts, all read from the closure tables with raw SQL:

| Stat | Definition |
|---|---|
| Played | closed games and tournaments with outcome `completed` where the user has a closure player row |
| Won | closure player rows with role `winner` (one per game or tournament; for a team win each member gets one) |
| Hosted | games and tournaments the user organized that are closed with outcome `completed` |

`not_held`, `cancelled`, `past` and `active` count towards none. The RSVP query (`_PLAYED_SQL`), the hosted-by-organizer query and the fixture-win query are removed. `recent_games` is read from closed games the user played, still filtered through the view rule (the counters stay the user's own data, as today). Field names `games_played`, `games_hosted`, `games_won` are unchanged (D-2). The dashboard stats strip (Played, Won, Hosted, Groups) is unchanged otherwise.

**AD-6 Revisions are append-only (P6).** Every submission writes a row to the module's revision table: full snapshot (outcome, version, attendee ids, winner, runner-up), actor, time. No UPDATE or DELETE path exists in code. The player rows hold the current state; the revision rows hold the history. User ids are stored, never names or emails (D-1).

**AD-7 Create and edit time validation (games).**
- `POST /events` (and `create_event_service`): `starts_at` must be later than the request time, timezone-aware (a naive datetime is rejected), else 422 `start_in_past`. `ends_at`, when sent, must be later than `starts_at` (existing rule kept; the implementer verifies it).
- `PATCH /events/{id}`: a new `starts_at` or `ends_at` must be in the future under the same rule. The existing lock once the game has started is unchanged.
- Clients set the picker minimum to the current time and show the server message on 422. The recurrence job generates future dates only and is unaffected; the implementer confirms it does not call the API validator with past dates.
- Tournament creation is not changed here: it already has its own date rules (lifecycle addendum AD-5, AD-6). Assumption, flagged in OI-3.

**AD-8 Upcoming games, one definition (home module).** See the dashboard addendum AD-20 for the screen. Backend:
- `GET /home/upcoming` (new, additive) returns `{ total, items, window_days }`. `total` is the count of every qualifying game; `items` is the first `upcoming_max_items`.
- Qualifying: not cancelled; the user is the organizer or has a `going` or `waitlisted` participant row; `starts_at >= now` and `starts_at <= now + window_days * 24h` (a rolling window, UTC instants). A game in progress is not upcoming. The one view rule still applies (access consistency). **No sport filter.**
- Order: `starts_at` ascending, ties by `created_at`.
- The existing `GET /home/menu` field `upcoming_games` and `GET /home/summary` field `upcoming_games_this_week` become aliases of `total` from the same function (`home/service.py`, replacing `_my_upcoming_games_filter` plus the optional day bound). No other query counts upcoming games. Field names unchanged.
- `window_days` and `upcoming_max_items` are admin settings (AD-9).

**AD-9 Admin settings (P1).** Two keys in `platform_config` under the existing home-settings pattern (`update_home_settings`, audited with `write_config_audit_log`, written only through the admin console, never by hand in the database):

| Key | Default | Bounds |
|---|---|---|
| `home_upcoming_window_days` | `settings.HOME_UPCOMING_WINDOW_DAYS` (7) | 1-30, clamped like the banner interval |
| `home_upcoming_max_items` | `settings.HOME_UPCOMING_MAX_ITEMS` (new, 5) | 1-20, clamped |

Both are read on every request (no cache) so a change takes effect immediately. The admin console home settings screen gets two number fields. Missing or invalid rows fall back to the defaults and never raise.

**AD-10 Games and Tournaments lists.** Additive query parameter `view=active|all` on `GET /events` and the tournaments list; absent means today's behaviour, so old clients are unaffected (P14). Responses gain `lifecycle_status` (AD-1) and, for closed items, `closure_outcome`.
- `view=active`: items with `lifecycle_status = active` only. The Games segment keeps AD-15 of the dashboard addendum (my games plus open public games), with past, cancelled and closed removed.
- `view=all`: the active set above, plus the caller's **own** past, cancelled and closed items (organizer, `going`, or `waitlisted`) from the last `history_days` (existing parameter: default 30, maximum 90). Other people's past games never appear for anyone.
- Both go through the one view rule; status is computed after visibility (P15).

## 4. Components

| Component | Module | Behaviour |
|---|---|---|
| `lifecycle.py` | events, tournaments (one pure function each) | AD-1 status |
| `closure_service.py` | events, tournaments | AD-2, AD-3, AD-4 gate, AD-6 revisions |
| closure routes | events, tournaments | `GET` and `PUT /events/{id}/closure`, `GET` and `PUT /tournaments/{id}/closure`; access rules declared in each module's `policies.py` (P15); rate limit 30 per minute per user on PUT (P17) |
| `get_profile_summary` | users | AD-5, raw SQL, no sibling import |
| `upcoming` function and route | home | AD-8 |
| home settings | home, admin | AD-9 |
| Game and tournament detail | web, mobile | Status badge. Organizer (or committee) sees "Close game" ("Close tournament") from the end time while `past`, "Edit closure" when `closed`. Viewers see outcome, winner and runner-up on closed items. Edit fields hidden or disabled after the end |
| Closure form | web, mobile | Outcome choice; if completed, attendee checklist (all going ticked), winner picker, runner-up picker from the ticked people; save shows a completion screen with the summary (existing completion-screen pattern) |
| Games and Tournaments lists | web, mobile | Default active; "All games" button; status chip on every row: Active, Pending closure, Cancelled, Closed |

UI labels (status names, button texts, form text, error messages) are rows in `ui_labels`, seeded by a written migration with fallbacks in `core/label_fallbacks_web.py` (existing pattern; no hardcoded strings).

## 5. Data contracts

### 5.1 Schema (additive; migrations written, not executed; no CHECK, trigger or RLS)

Verified against the live models on 2026-10-20 (BP-01): `events` (`organizer_id`, `starts_at`, `ends_at` nullable, `status`), `event_participants` (`user_id`, `status`), `tournaments` (`organizer_id`, `starts_at`, `ends_at` nullable, `status`), `tournament_registrations` (`user_id` or `team_id`, `status`).

| Table | Columns |
|---|---|
| `event_closures` | `event_id` PK, FK events (ON DELETE CASCADE); `outcome` VARCHAR(20); `version` INT; `closed_by` FK users; `closed_at`; `updated_by`; `updated_at` |
| `event_closure_players` | `event_id` FK (CASCADE), `user_id` FK users (CASCADE); `role` VARCHAR(20) (`player`, `winner`, `runner_up`); PK (`event_id`, `user_id`) |
| `event_closure_revisions` | `id` PK, `event_id` FK (CASCADE), `version`, `snapshot` JSONB, `changed_by`, `changed_at`; UNIQUE (`event_id`, `version`); no UPDATE or DELETE path in code |
| `tournament_closures` | as `event_closures`, keyed by `tournament_id` |
| `tournament_closure_players` | `tournament_id` FK (CASCADE), `registration_id` FK tournament_registrations, `user_id` FK users (CASCADE), `role`; PK (`tournament_id`, `user_id`) |
| `tournament_closure_revisions` | as `event_closure_revisions`, keyed by `tournament_id` |

Winner and runner-up are stored only as `role` on the player rows, never as separate columns, so deleting an account removes the credit with the row and nothing dangles (BP-09). A game's winner is the single `winner` row; a tournament's winner is every `winner` row sharing one `registration_id`. Allowed values and the rules in AD-2 are enforced in the service, not in the database. Indexes: `(user_id, role)` on both player tables.

### 5.2 Data lineage (one source per field, BP-09)

| Field | Source | Never |
|---|---|---|
| `lifecycle_status` | AD-1 function over the stored rows | Stored, cached or computed in a client |
| Played, Won, Hosted | closure tables (AD-5) | `event_participants`, `tournament_fixtures`, `events.organizer_id` alone |
| Winner, runner-up | `role` on the closure player rows | Separate columns, fixtures, results |
| Upcoming total and list | `home/service.py` upcoming function | Any other count or any client-side list assembly |
| Window days, list size | `platform_config` rows (AD-9) | `settings` at runtime once a row exists, or the database edited by hand |

## 6. Security and compliance

| Rule | Declared access | Denied |
|---|---|---|
| `PUT /events/{id}/closure` | game organizer | everyone else: 403 for viewers, 404 for people who cannot view the game |
| `PUT /tournaments/{id}/closure` | organizer or active committee member | everyone else, same split |
| `GET` closure | anyone who can view the game or tournament (view rule); the attendee list only for the organizer or committee | no access: 404 |
| `PATCH` home settings (AD-9) | platform admin, existing console rule | all others |
| `GET /home/upcoming` | any authenticated user, own data only | unauthenticated |

- Authorisation is enforced at the entry point before the data layer (P15). Every rule above has an API-level negative test with no database backstop involved (P13).
- Integrity: an organizer could name a winner falsely. At T1 this is accepted: the organizer owns the record, every change is versioned and attributable (AD-6), and stats are personal, not competitive. Gate for a stronger control in §7.
- Privacy: closure data holds user ids and roles only. Names are resolved at read time under the view rule. Revision snapshots hold ids only (D-1).
- Denied closure attempts are logged to the security event stream (P4), with no names.

## 7. Configuration, failure modes, deferred decisions

| Failure | Behaviour |
|---|---|
| Closure submitted before the end time | 409 `closure_not_open` |
| Closure on a cancelled game | 409 |
| Stale `expected_version` | 409 with current state; client reloads |
| Attendee who is not a going participant | 422, nothing written |
| Write to an ended game | 409 `game_ended` |
| Two submissions race | game row lock serialises; the second sees the new version and gets 409 |
| Admin setting missing or invalid | default used, never an error |
| Account deleted | the user's player rows are removed with the account; their stats vanish with them; revision snapshots keep only an unlinkable id (D-1) |

**Deferred (BP-10).**

| Deferred | Gate (build when) |
|---|---|
| Reminder to the organizer to close a game | more than 30% of games stay `past` 7 days after their end time, measured weekly over four consecutive weeks |
| "You won" or closure notifications to players | owner request, or 5 or more user reports |
| Stronger integrity (second confirmation of winner) | 3 or more reported disputes in a quarter, or any competitive feature (leaderboard) is designed |
| Merging closure with the tournament close-out feedback | owner decision after the first 10 tournaments are closed |
| Check-in (`event_checkins`) as an attendance source | check-in used on more than 50% of games over a month |

## 8. Observability and operability (P4)

- Log closure submit and edit at INFO with correlation id, game or tournament id, version, outcome, attendee count. Never names or emails.
- Metrics: closures submitted and edited per day; gauge of `past` games older than 7 days (feeds the first deferred gate).
- Admin setting changes use the existing audited path.

## 9. Test requirements

Risk class: closure service **High** (it feeds every stat and is a write with access rules); status function **Medium**; upcoming **Medium**; lists **Medium**; admin settings **Low-Medium**. Tests are written and run once, in the single testing phase, not per task.

Backend:
1. Status table: each row of AD-1; precedence (closure plus cancelled gives `closed`); in-progress is `active`; end exactly now is `past`; a game with no `ends_at` uses `starts_at`; tournament `dissolved` gives `cancelled`; tournament stored `completed` without closure gives `past`.
2. Closure access (negative, API level): non-organizer 403; user who cannot view 404; unauthenticated 401; tournament member who is not an active committee member 403; before the end 409; cancelled game 409.
3. Closure validation: attendee not going 422; winner not an attendee 422; runner-up equals winner 422; runner-up missing with two or more attendees 422; `not_held` with a winner 422; `completed` with no attendees 422; stale `expected_version` 409; identical resubmission writes no revision.
4. Edit after closure: version increments, revision appended, stats recompute; no UPDATE or DELETE path on revision tables.
5. Post-end lock, per route: PATCH, cancel, join, withdraw, invitation create, accept and revoke all 409 `game_ended` on an ended game; the closure PUT still works. Tournament details and registration locked after the end; result entry and close-out still work (D-3).
6. Stats: RSVP-only past game counts nothing; hosted past game without closure counts nothing; closed `completed` counts Played for each ticked attendee and Hosted for the organizer; Won only for the winner; `not_held` counts nothing; fixture wins no longer count; team win credits each snapshot member once; changing a team roster after closure does not change stats; legacy data gives 0, 0, 0.
7. Upcoming: window boundaries (start exactly now included, exactly now+N days included, one second past excluded); past, cancelled, in-progress, someone else's public game excluded; ordered earliest first; `total` equals the full count while `items` is capped; badge, summary and list agree; a changed admin value applies on the next request; out-of-range values are clamped; non-admin cannot change them.
8. Create and edit: past `starts_at` 422; naive datetime 422; `starts_at` exactly now rejected; past `ends_at` on PATCH 422; the recurrence job still creates future instances.
9. Lists: `view=active` excludes past, cancelled and closed; `view=all` adds only the caller's own non-active items within `history_days`; another user's past game never appears; absent `view` keeps today's response; `lifecycle_status` present on both lists.

Clients (web and mobile): status chip on every row; "All games" toggle; closure form defaults and picker limits; fields disabled after the end; closure visible to viewers (winner, runner-up) and attendee list only to the organizer; date picker minimum; completion screen.

**Existing tests to rewrite (the old behaviour is removed):** `tests/test_profile_summary.py`, `tests/test_profile_games_won.py`, `tests/test_web_home_stats_and_tournament_cards.py`, `tests/test_playwright_home_stats_tournament_cards.py`, `api-regression/suite/journeys/test_j02_profile.py`, `test_j03_games.py` (stats and past-game assertions), and the access-consistency tests that create games with past dates.

## 10. Implementation phases and tasks

1. **cr-backend** (`~/meetup`): migrations (written only), lifecycle functions, closure services and routes, post-end lock, stats rewrite, `GET /home/upcoming` and aliases, admin settings (API), create/edit validation, `view` parameter, label seeds. Acceptance: §9 backend tests.
2. **cr-web** (`~/meetup/frontend`, after cr-backend is deployed): statuses, toggle, closure form, detail changes, admin console fields, picker minimum, PWA version bump.
3. **cr-mobile** (`~/Developer/meetup-mobile`, after cr-backend is deployed): same screens.

Migration execution is the owner's, one at a time (`alembic upgrade +1`). No conformance review or testing agent unless the owner asks.

## 11. Deployment and rollback

Backend first, then clients. Old clients keep working: field names are unchanged and `view` is optional. **Release effect (owner decision):** every user's Played, Won and Hosted shows 0 until games are closed. Rollback is a code revert; the new tables are additive and stay unused.

## 12. Principles and best-practices compliance

| Principle | Element |
|---|---|
| P1 | Window and list size are admin-managed config (AD-9); no hardcoded thresholds; no hand edits in the database |
| P4 | Closure logging, security stream for denials, unclosed-games gauge |
| P5 | Identical resubmission is idempotent; version check |
| P6 | Append-only revisions with full snapshot (D-1) |
| P9 | All validation server side; clients are UX only |
| P12 | Closure data follows the game's retention; account deletion removes the user's rows (D-1) |
| P13 | API-level negative tests for every declared rule |
| P14 | Additive fields and parameters; `display_status` untouched (D-2 for the one semantic change) |
| P15 | Access rules declared per route; checked at entry; view rule reused |
| P17 | Rate limit on closure writes |
| BP-01 | Tables and columns verified against the live models, 2026-10-20 |
| BP-09 | One source per field (§5.2); winner stored once |
| BP-10 | Deferred items carry measurable gates (§7) |
| BP-12 | Computed status, no state machine; no triggers |
| BP-13 | Every 2026-10-20 decision is written here |

**Deliberate deviations**

| ID | Deviation | From | Rationale |
|---|---|---|---|
| D-1 | Revision snapshots keep user ids and are not crypto-shredded | `Enterprise_Design_Principles.md` P6 (PII crypto-shredding) | They hold ids only. When an account is deleted the id no longer links to a person, so it is not PII. Crypto-shredding adds key management for no in-scope benefit at T1 (BP-12). Gate: snapshots ever hold names, emails or free text |
| D-2 | `games_played`, `games_hosted`, `games_won` change meaning with the same shape; stats reset to 0 | `Enterprise_Design_Principles.md` P14 (consumers never broken silently) | The old numbers were wrong (RSVP counts including hosting). Owner decision, 2026-10-20. Shape unchanged so no client breaks; release note and the Pending closure status explain the reset |
| D-3 | Tournament result entry, standings and close-out stay open after the end time | Owner's "nothing else editable after the end" (CR-04), which the owner applied to games | A tournament can overrun its stated end date; blocking result entry would stop its record being kept. Needs owner confirmation (OI-1) |
| D-4 | Requirements restated in this document, no REQ addendum | solution-design precondition | Same departure as the other addenda |

No deviation from `design-best-practices.md`.

## 13. Requirements coverage

| Requirement | Where |
|---|---|
| CR-01 | AD-1, AD-10 |
| CR-02, CR-12 | AD-2 |
| CR-03 | AD-3 |
| CR-04 | AD-4, D-3 |
| CR-05 | AD-2, AD-6 |
| CR-06, CR-07 | AD-5, §11 |
| CR-08, CR-09 | AD-8, AD-9, dashboard AD-20 |
| CR-10, CR-13 | AD-10, dashboard AD-21 |
| CR-11 | AD-7 |

## 14. Open items

| ID | Item | Severity | Blocking |
|---|---|---|---|
| OI-1 | D-3: confirm that tournament result entry, standings and close-out stay open after the end time | 🟡 MEDIUM | No |
| OI-2 | Implementer to name the committee table and policy used by AD-3 and the registration-member source for team credit (OI-5 of the lifecycle addendum is still open) | 🟡 MEDIUM | Phase gate for tournaments |
| OI-3 | Tournament creation date validation: confirm the lifecycle addendum already rejects past dates; if not, extend AD-7 | 🟡 MEDIUM | No |
| OI-4 | Confirm the recurrence job and any other internal caller of `create_event_service` never pass a past start | 🟢 LOW | No |
| OI-5 | Whether a game in progress should appear in Upcoming (this design: no, it is `active` in the Games view only) | 🟢 LOW | No |

Status: v1.0 APPROVED by the owner on 2026-10-20. No blocking items. OI-1 and OI-2 are checked by the implementer and reported.
