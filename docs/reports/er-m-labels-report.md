# er-m-labels-report (step 3.5): consolidated verification of the tournament-edit-recurring mobile feature

Task ID: `er-m-labels-report`. Machine: Cloud (agent session), repo root `/home/user/meetup-mobile`. Verification and reporting only: no feature code, no fix, no change to `src/`, `scripts/`, package files, native config or any `docs/` file other than this report. Nothing is self-certified; the architect rates this report in 3.6.

## 0. Git evidence

- Branch `claude/beautiful-hypatia-1wa00s` off `origin/main` @ `414e176` (addendum v1.12). Addendum version read: v1.12 (`docs/DES-MEETUP-ADDENDUM-tournament-edit-recurring.md:4`).
- Commit before PR #75: `082e921`. The four PRs were squash-merged, one commit each:

```
b611994 er-m-tournament-view: count and Full chip, phase, key dates, withdrawal notice (step 3.1) (#75)
 15 files changed, 333 insertions(+), 72 deletions(-)
f7f13e9 er-m-committee: committee roster override, Add team, Edit tournament (step 3.2) (#77)
 21 files changed, 1343 insertions(+), 11 deletions(-)
bd29a4c er-m-shuffle: Shuffle again on the fixture draft screen (step 3.3) (#79)
 8 files changed, 260 insertions(+), 2 deletions(-)
ee14389 er-m-series: recurring games and new tournament notification routing (step 3.4) (#81)
 21 files changed, 1253 insertions(+), 8 deletions(-)
```

Combined diff of the four PRs (`git diff --stat 082e921 ee14389 -- src scripts`):

```
scripts/check-labels.allowlist.json                |  18 ++
 src/api/events.ts                                  |  46 +++
 src/api/teams.ts                                   |  11 +
 src/api/tournaments.ts                             |  52 +++-
 src/components/NotificationPreferencesList.tsx     |   2 +
 src/components/RepeatWeeklyControl.tsx             | 132 +++++++++
 .../__tests__/TournamentsListContent.test.tsx      |  14 +-
 src/components/home/UnifiedCard.tsx                |  11 +-
 src/components/icons/NotificationIcon.tsx          |   2 +
 src/components/series/SeriesParts.tsx              | 231 +++++++++++++++
 .../tournament/participants/AddTeamSheet.tsx       | 203 +++++++++++++
 .../tournament/v2/TournamentDetailV2.tsx           |   5 +
 src/components/tournament/v2/TournamentHeader.tsx  |  14 +-
 .../tournament/v2/TournamentOverview.tsx           |  61 +++-
 .../tournament/v2/tabs/FixturesSetup.tsx           |  57 +++-
 .../tournament/v2/tabs/ParticipantsTab.tsx         |  77 +++--
 src/labels/defaultLabels.ts                        |  79 +++++
 src/navigation/RootNavigator.tsx                   |   6 +
 src/navigation/types.ts                            |   2 +
 src/notifications/__tests__/fcmForeground.test.ts  |   6 +
 .../__tests__/notificationRouting.test.ts          |  27 +-
 src/notifications/notificationRouting.ts           |   4 +
 src/screens/CreateGameScreen.tsx                   |  43 +++
 src/screens/EventDetailScreen.tsx                  | 110 ++++++-
 src/screens/TournamentDetailScreen.tsx             |  30 +-
 src/screens/TournamentEditScreen.tsx               | 325 +++++++++++++++++++++
 src/screens/__tests__/CreateGameRepeat.test.tsx    | 158 ++++++++++
 src/screens/__tests__/EventSeries.test.tsx         | 221 ++++++++++++++
 .../__tests__/NotificationHistoryScreen.test.tsx   |   9 +
 .../NotificationPreferencesScreen.test.tsx         |   4 +-
 src/screens/__tests__/TournamentDetailV2.test.tsx  |  88 +++++-
 src/screens/__tests__/TournamentEdit.test.tsx      | 189 ++++++++++++
 .../__tests__/TournamentFixturesSetup.test.tsx     |  90 ++++++
 .../TournamentParticipantsInvite.test.tsx          |   4 +-
 .../TournamentParticipantsPayments.test.tsx        |   5 +-
 src/screens/__tests__/TournamentTabBodies.test.tsx | 109 ++++++-
 src/types/event.ts                                 |  26 ++
 src/types/notification.ts                          |   6 +-
 src/types/tournament.ts                            |  30 +-
 src/types/tournamentTabs.ts                        |  12 +
 src/utils/__tests__/tournamentEdit.test.ts         |  80 +++++
 src/utils/fixturesSetup.ts                         |   2 +
 src/utils/refusal.ts                               |  10 +
 src/utils/repeatWeekly.ts                          |  55 ++++
 src/utils/seriesDisplay.ts                         |  37 +++
 src/utils/tournamentEdit.ts                        | 187 ++++++++++++
 src/utils/tournamentExperience.ts                  |  39 ++-
 47 files changed, 2836 insertions(+), 93 deletions(-)
```

Union of changed files: 52 (32 source files under `src/`, 14 test files, 5 `docs/` files, 1 `scripts/` file); lists in sections 3 and 4.

## 1. Lint, type check, label scan (on main @ `414e176`; each run once; raw)

`npm run lint` exit 1, last lines:
```
144:7  error  'of' is assigned a value but never used     @typescript-eslint/no-unused-vars

✖ 35 problems (34 errors, 1 warning)
```
The same 35 problems were reported on `origin/main` in each earlier step (full-output diff empty in 3.1, 3.2, 3.3 and 3.4). Lint was also run on the touched files only in those steps; none had a finding in a file the PRs touched except the pre-existing `no-unused-vars` errors in `src/screens/__tests__/TournamentParticipantsInvite.test.tsx` (lines 133, 138, 144), which the PRs did not add.

`npx tsc --noEmit` exit 0, output empty.

`npm run check:labels` exit 0:
```
> MeetupMobile@0.0.1 check:labels
> node scripts/check-labels.js

check-labels: OK - 323 files scanned, 2037 default labels checked.
```

Allowlist entries added during the feature (`git diff 082e921 HEAD -- scripts/check-labels.allowlist.json`, PR #77 only):

| Entry (`kind: banned-term`, file `src/labels/defaultLabels.ts`) | Reason (verbatim) |
|---|---|
| `web.tournament.participants.add_team` | Seeded wording of the M3 label migration (er-config-labels-report: 'Add team', 'Add a team', 'Search teams'); the addendum requires the bundled default to carry the seeded text exactly. Says 'team' for a tournament team on a tournament screen. Owner to decide whether the seed or the glossary changes (er-m-committee report, drift). |
| `web.tournament.participants.add_team_title` | Seeded wording of the M3 label migration (er-config-labels-report: 'Add team', 'Add a team', 'Search teams'); the addendum requires the bundled default to carry the seeded text exactly. Says 'team' for a tournament team on a tournament screen. Owner to decide whether the seed or the glossary changes (er-m-committee report, drift). |
| `web.tournament.participants.search_teams` | Seeded wording of the M3 label migration (er-config-labels-report: 'Add team', 'Add a team', 'Search teams'); the addendum requires the bundled default to carry the seeded text exactly. Says 'team' for a tournament team on a tournament screen. Owner to decide whether the seed or the glossary changes (er-m-committee report, drift). |

Accepted by ruling A48 (OI-18). PRs #75, #79 and #81 added no allowlist entry.

## 2. Label audit

Method: added lines of `src/labels/defaultLabels.ts` in `git diff 082e921 HEAD`; seeded list = the 101-key `LABELS` of M3 `migrations/versions/c4e9a2d71f08_er_config_labels_m3_config_and_label_seed.py` in `pratheeshku/meetup` @ `c962b2b` (the same keys as `er-config-labels-report.md` §4); keys not in M3 were looked up in the other seed migrations. Text compared by exact string equality.

**Result: 79 keys added; 75 are in the M3 seed with the text exactly equal; 4 are not in M3 but are seeded earlier by `f40ce522636c_seed_web_ui_labels.py` with equal text (not part of er-config-labels-report's 101); 0 mismatches; 0 keys not seeded anywhere.**

Earlier-seeded keys (text checked equal to the migration's):

- `web.tournament.edit_tournament` = 'Edit Tournament'
- `web.edit_tournament.registration_closes_at` = 'Registration Closes At'
- `web.edit_tournament.tournament_updated_successfully` = 'Tournament updated successfully!'
- `web.edit_tournament.failed_to_update_tournament` = 'Failed to update tournament.'

Keys added, by step (all in the M3 seed, text exact):

| Key | Bundled default |
|---|---|
| `web.tournament.v2.kd_registration_closes` | Registration closes |
| `web.tournament.registered_count` | {count} registered |
| `web.tournament.full_chip` | Full |
| `web.console.shuffle.button` | Shuffle again |
| `web.console.shuffle.done` | Draw {n} of {total}. |
| `web.console.shuffle.hint` | Shows the next balanced draw. The strongest players stay in separate groups. |
| `web.console.shuffle.single` | This is the only balanced draw for this tournament. |
| `web.series.repeat_toggle` | Repeat weekly |
| `web.series.every_label` | Repeat every |
| `web.series.weeks_suffix` | week(s) |
| `web.series.weekday_note` | On {weekday}, the weekday of the first game. |
| `web.series.end_title` | The series ends |
| `web.series.end_count` | After a number of games |
| `web.series.end_count_label` | Number of games, the first one included |
| `web.series.end_date` | On a date |
| `web.series.end_date_label` | Last date |
| `web.series.end_required` | Choose how the series ends: after a number of games or on a date. |
| `web.series.every_invalid` | Enter a whole number of weeks, 1 or more. |
| `web.series.invite_note` | Invitations go to the first game. Each person accepts once and joins the whole series. |
| `web.series.review_line` | Repeats {every}, {end} |
| `web.series.every_one` | every week |
| `web.series.every_many` | every {n} weeks |
| `web.series.end_after` | ends after {total} games |
| `web.series.end_on` | ends on {date} |
| `web.series.chip` | Weekly · {index} of {total} |
| `web.series.chip_open` | Weekly · game {index} |
| `web.series.repeats_weekly` | Repeats weekly |
| `web.series.repeats_every` | Repeats every {n} weeks |
| `web.series.ends_after` | Ends after {total} games |
| `web.series.ends_on` | Ends on {date} |
| `web.series.accept_note` | Accepting joins every future game of this series. Declining applies to this game only. |
| `web.series.skip` | Skip this game |
| `web.series.skip_confirm` | Skip this game? You stay in the series and keep your place in the other games. |
| `web.series.skipped` | You skipped this game. You are still in the series. |
| `web.series.leave` | Leave series |
| `web.series.leave_confirm` | Leave this series? You will be withdrawn from every future game. |
| `web.series.left` | You left the series. You were withdrawn from {games_left} game(s). |
| `web.series.scope_edit_title` | Edit which games? |
| `web.series.scope_cancel_title` | Cancel which games? |
| `web.series.scope_this` | This game |
| `web.series.scope_following` | This and following games |
| `web.series.scope_hint` | This game uses the usual form. This and following changes this game and every later game that has not started. |
| `web.series.edit_title` | Edit this and following games |
| `web.series.edit_start_time` | Start time |
| `web.series.edit_duration` | Duration (minutes) |
| `web.series.edit_hint` | Only the time of day and the length change. Every game keeps its date. |
| `web.series.edit_none` | Change the start time or the duration first. |
| `web.series.edit_saved` | This and the following games were updated. |
| `web.series.cancel_confirm` | Cancel this game and every later game in the series? This cannot be undone. |
| `web.series.cancel_done` | This and the following games were cancelled. |
| `web.tournament.participants.add_team` | Add team |
| `web.tournament.participants.add_team_empty` | No tournament team for this sport yet. |
| `web.tournament.participants.add_team_title` | Add a team |
| `web.tournament.participants.search_teams` | Search teams |
| `web.tournament.participants.team_players` | {count} players |
| `web.tournament_edit.dates_future` | Dates you change must be in the future. |
| `web.tournament_edit.hard_block` | Registration hard block |
| `web.tournament_edit.hard_block_hint` | Visible to the organizer and the committee only. |
| `web.tournament_edit.may_withdraw` | Registered players can withdraw until registration closes |
| `web.tournament_edit.may_withdraw_hint` | Applies to this change. Switch it off to stop players withdrawing themselves; the committee can still remove entries. |
| `web.tournament_edit.reset_confirm` | Fixtures have already been generated. Changing the dates or the venue resets them, and the committee will have to generate them again. Save these changes? |
| `web.tournament_edit.reset_confirm_roster` | Fixtures have already been generated. Adding or removing an entry resets them, and the committee will have to generate them again. |
| `web.tournament_edit.reset_done` | Saved. The fixtures were reset: generate them again. |
| `mob.reg.err.withdrawal_locked` | The organizer has switched off withdrawals for this tournament. |
| `mob.reg.err.series_end_invalid` | Choose either an end date or a number of games, with at least two games in the series. |
| `mob.reg.err.series_limit_exceeded` | This series is longer than allowed. Choose fewer games, an earlier end date or a shorter interval. |
| `mob.reg.err.series_has_participants` | Players have already joined games this change would move or cancel, so it cannot be applied. |
| `mob.reg.err.series_organizer_cannot_leave` | The organizer cannot leave their own series. Cancel it instead. |
| `mob.reg.err.shuffle_unavailable` | There is no other balanced draw to show, or the draft can no longer be shuffled. |
| `mob.reg.err.roster_locked` | The entries can no longer be changed: a result has been recorded or the tournament has started. |
| `mob.reg.err.tournament_started` | This tournament has started, so its dates and venue can no longer be changed. |
| `mob.reg.err.tournament_has_results` | A result has been recorded, so the dates and venue can no longer be changed. |
| `mob.reg.err.registration_dates_required` | Set a new registration closing date in the future to change the start, the end or the venue. |
| `mob.notif_pref.type_tournament_updated` | Tournament dates or venue changed |
| `mob.notif_pref.type_tournament_registration_added` | Added to a tournament |

Other keys named in lines these PRs added to source files (28), all pre-existing mobile keys already in `src/labels/defaultLabels.ts`, not part of the seeded list and not changed: `mob.common.{cancel,done,save}`, `mob.create_game.{err_game_create,venue_label}`, `mob.game_detail.{cancel_error,edit_error,leave_error}`, `mob.part.{remove_body_player,remove_body_team}`, `mob.reg.err.internal_error`, `mob.scoring.draw.generated_ok`, `mob.scoring.error.generic`, `mob.tournament.close.cancel`, `mob.tournament.not_found`, `mob.tournament.participants.{registered_label,registered_of}`, `mob.tournament.v2.{format_max,kd_soft,kd_soft_sub}`, `mob.tw.{description,ends,name,pick_date,starts,venue_address,venue_name,window_section}`. Date-failure messages for the edit screen come from the existing wizard function `dateFailureIssue` (`src/utils/tournamentWizard.ts:251`), not from added lines.

Seeded keys in M3 that mobile does not bundle (not added): `notif.*` (server-composed push text), `web.notif_pref.*`, the other `web.*` keys of the web screens, `web.console.shuffle.groups_title`, `web.reg.err.*`, and the reworded `mob.reg.err.{committee_add_closed,withdrawal_closed,roster_frozen}` (mobile keeps the old bundled text for those three; the remote value overrides once labels load).

## 3. Scoped tests: union of the test files of PRs #75, #77, #79, #81, plus the two named suites

Files (14 touched by the PRs, from `git diff --name-only` per PR, plus `CreateGameScreen.test.tsx` and `EventDetailScreen.test.tsx`, which no PR touched but the task names):

```
src/components/__tests__/TournamentsListContent.test.tsx
src/notifications/__tests__/fcmForeground.test.ts
src/notifications/__tests__/notificationRouting.test.ts
src/screens/__tests__/CreateGameRepeat.test.tsx
src/screens/__tests__/EventSeries.test.tsx
src/screens/__tests__/NotificationHistoryScreen.test.tsx
src/screens/__tests__/NotificationPreferencesScreen.test.tsx
src/screens/__tests__/TournamentDetailV2.test.tsx
src/screens/__tests__/TournamentEdit.test.tsx
src/screens/__tests__/TournamentFixturesSetup.test.tsx
src/screens/__tests__/TournamentParticipantsInvite.test.tsx
src/screens/__tests__/TournamentParticipantsPayments.test.tsx
src/screens/__tests__/TournamentTabBodies.test.tsx
src/utils/__tests__/tournamentEdit.test.ts
src/screens/__tests__/CreateGameScreen.test.tsx
src/screens/__tests__/EventDetailScreen.test.tsx
```

One `npx jest <files> --coverage ...` run on main @ `414e176` and one on `082e921` (separate git worktree, `node_modules` linked, removed afterwards). Four of the 16 files do not exist at `082e921` (`CreateGameRepeat`, `EventSeries`, `TournamentEdit`, `tournamentEdit`), so that run had 12 suites.

Raw summary, main:
```
FAIL src/screens/__tests__/CreateGameScreen.test.tsx (16.921 s)
FAIL src/screens/__tests__/EventDetailScreen.test.tsx (20.553 s)
FAIL src/screens/__tests__/TournamentTabBodies.test.tsx (27.392 s)
PASS src/components/__tests__/TournamentsListContent.test.tsx
PASS src/notifications/__tests__/fcmForeground.test.ts
PASS src/notifications/__tests__/notificationRouting.test.ts
PASS src/screens/__tests__/CreateGameRepeat.test.tsx
PASS src/screens/__tests__/EventSeries.test.tsx
PASS src/screens/__tests__/NotificationHistoryScreen.test.tsx
PASS src/screens/__tests__/NotificationPreferencesScreen.test.tsx
PASS src/screens/__tests__/TournamentDetailV2.test.tsx
PASS src/screens/__tests__/TournamentEdit.test.tsx
PASS src/screens/__tests__/TournamentFixturesSetup.test.tsx
PASS src/screens/__tests__/TournamentParticipantsInvite.test.tsx
PASS src/screens/__tests__/TournamentParticipantsPayments.test.tsx
PASS src/utils/__tests__/tournamentEdit.test.ts
Test Suites: 3 failed, 13 passed, 16 total
Tests:       74 failed, 307 passed, 381 total
```
Raw summary, before #75 (`082e921`):
```
FAIL src/screens/__tests__/CreateGameScreen.test.tsx
FAIL src/screens/__tests__/EventDetailScreen.test.tsx (18.821 s)
FAIL src/screens/__tests__/NotificationPreferencesScreen.test.tsx
FAIL src/screens/__tests__/TournamentTabBodies.test.tsx (23.335 s)
PASS src/components/__tests__/TournamentsListContent.test.tsx
PASS src/notifications/__tests__/fcmForeground.test.ts
PASS src/notifications/__tests__/notificationRouting.test.ts
PASS src/screens/__tests__/NotificationHistoryScreen.test.tsx
PASS src/screens/__tests__/TournamentDetailV2.test.tsx
PASS src/screens/__tests__/TournamentFixturesSetup.test.tsx
PASS src/screens/__tests__/TournamentParticipantsInvite.test.tsx
PASS src/screens/__tests__/TournamentParticipantsPayments.test.tsx (18.688 s)
Test Suites: 4 failed, 8 passed, 12 total
Tests:       74 failed, 239 passed, 313 total
```

**Set difference of failing test names (file + full name):**

- Failing on main, not failing before: **1**
  - `src/screens/__tests__/TournamentTabBodies.test.tsx`: Participants (TV2MobOpenParticipants) lists the players by name with Organizer and Committee marks; a player has no Add and no Remove, and sees the server count without the cap (AD-1)
- Failing before, not failing on main: **1**
  - `src/screens/__tests__/NotificationPreferencesScreen.test.tsx`: shows a row for every known type, with the two participant labels

Explanation of the two entries, from the raw runs: the first is the Participants test that PR #75 renamed and extended (the same-named test before passes, so by name it is absent from the "before" set). On main it fails only as `Exceeded timeout of 5000 ms for a test` (raw message in the run's JSON, `TournamentTabBodies.test.tsx:201`) in the instrumented run, where that file took 27 s; run alone without coverage, twice, the file reports 2 failed (the two Media tests below) and 38 passed, so this test passes there. The second is the stale `toHaveLength(19)` pin that PR #81 updated to 25 (it failed on `082e921` with `Expected length: 19 / Received length: 23`).

Failing counts by file: main {"src/screens/__tests__/CreateGameScreen.test.tsx": 37, "src/screens/__tests__/EventDetailScreen.test.tsx": 34, "src/screens/__tests__/TournamentTabBodies.test.tsx": 3}; before {"src/screens/__tests__/CreateGameScreen.test.tsx": 37, "src/screens/__tests__/EventDetailScreen.test.tsx": 34, "src/screens/__tests__/NotificationPreferencesScreen.test.tsx": 1, "src/screens/__tests__/TournamentTabBodies.test.tsx": 2}.

**`src/screens/__tests__/CreateGameScreen.test.tsx`: 37 failing on main, 37 failing before; same set: YES.**

**`src/screens/__tests__/EventDetailScreen.test.tsx`: 34 failing on main, 34 failing before; same set: YES.**

Failing test names (identical on both commits for these two files):

`src/screens/__tests__/CreateGameScreen.test.tsx`:
- CreateGameScreen — Casual Game form contract blank title
- CreateGameScreen — Casual Game form contract fills the date portion of Start Date & Time from the quick-select chips, keeping any selected time
- CreateGameScreen — Casual Game form contract offers the amended field set with public visibility and all-levels skill pre-selected
- CreateGameScreen — Casual Game form contract rejects capacity "" (2–200, matching web)
- CreateGameScreen — Casual Game form contract rejects capacity "1" (2–200, matching web)
- CreateGameScreen — Casual Game form contract rejects capacity "201" (2–200, matching web)
- CreateGameScreen — Casual Game form contract rejects capacity "abc" (2–200, matching web)
- CreateGameScreen — Casual Game form contract rejects submit with Visibility = Group and no group chosen
- CreateGameScreen — Casual Game form contract shows the conditional Group picker only when Visibility = Group
- CreateGameScreen — Casual Game submit includes sport, skill level, venue, description and group_id when set
- CreateGameScreen — Casual Game submit sends the minimal EventCreate payload (no sport chosen, defaults, ends_at null) and pops back with a refresh key
- CreateGameScreen — Casual Game submit shows the backend validation message inline on a 422 and stays on the form
- CreateGameScreen — Tournament form contract offers the amended field set, pre-fills format=knockout and capacity=8, and excludes Group Stage
- CreateGameScreen — Tournament form contract shows the conditional Group picker only when Visibility = Group Only
- CreateGameScreen — Tournament submit blank title
- CreateGameScreen — Tournament submit includes description, venue_name and group_id (Visibility = Group Only) when set
- CreateGameScreen — Tournament submit no participation mode
- CreateGameScreen — Tournament submit no sport
- CreateGameScreen — Tournament submit on success, navigates cross-tab to the Tournaments list with a refresh key (no local Tournaments route to popTo)
- CreateGameScreen — Tournament submit rejects an unselected tournament start date
- CreateGameScreen — Tournament submit sends the TournamentCreate payload with public visibility default and no group_stage option available
- CreateGameScreen — Tournament submit shows a generic message on a network failure and stays on the form
- CreateGameScreen — chip colors and CTA styling Skill Level and Visibility chips use the neutral #1B1918 selected color, not the sport color or default primary
- CreateGameScreen — chip colors and CTA styling Sport chip selected state uses that sport's own color, not a neutral or the default primary
- CreateGameScreen — chip colors and CTA styling the Create Game CTA uses the standing-rule blue (#1D5FA3), not the app-wide primary blue
- CreateGameScreen — chip colors and CTA styling the Create Tournament CTA uses the standing-rule blue (#1D5FA3) too
- CreateGameScreen — cost and currency (kept and restyled, EventCreate.estimated_cost_cents/currency) converts a typed cost to integer cents and uppercases the currency code
- CreateGameScreen — cost and currency (kept and restyled, EventCreate.estimated_cost_cents/currency) omits cost/currency from the payload when left blank
- CreateGameScreen — cost and currency (kept and restyled, EventCreate.estimated_cost_cents/currency) rejects a currency code that is not exactly 3 letters
- CreateGameScreen — cost and currency (kept and restyled, EventCreate.estimated_cost_cents/currency) rejects a negative or non-numeric cost
- CreateGameScreen — keyboard avoidance and date/time picker integration Casual Game: manual picker interaction produces the correct UTC ISO 8601 starts_at timestamp
- CreateGameScreen — keyboard avoidance and date/time picker integration Tournament: picking start date and optional registration close sends exact ISO timestamps
- CreateGameScreen — keyboard avoidance and date/time picker integration handles the keyboard on Android through KeyboardAwareScreen (no KeyboardAvoidingView behavior prop)
- CreateGameScreen — sports loading (shared by both modes) degrades gracefully (empty group list, form still usable) when groups fail to load
- CreateGameScreen — sports loading (shared by both modes) shows an error with retry when sports cannot be loaded, and recovers on retry
- CreateGameScreen — toggle defaults to Casual Game and offers a Tournament toggle
- CreateGameScreen — toggle switching to Tournament shows the tournament form and hides the casual one, without losing typed casual values

`src/screens/__tests__/EventDetailScreen.test.tsx`:
- BUILD 1: Event Cancel Flow closes cancel form on Close press
- BUILD 1: Event Cancel Flow opens cancel form and rejects empty cancellation reason
- BUILD 1: Event Cancel Flow sends POST /events/{id}/cancel with { reason } and refreshes the event to cancelled
- BUILD 1: Event Cancel Flow surfaces backend cancel error via getApiErrorMessage
- BUILD 2: Event Edit Flow closes edit form on Cancel press without saving
- BUILD 2: Event Edit Flow does not render cost or currency in edit form (hidden per BUILD B)
- BUILD 2: Event Edit Flow does not render visibility in edit form (immutable post-creation)
- BUILD 2: Event Edit Flow opens edit form pre-populated with current event values
- BUILD 2: Event Edit Flow populates sportOptions and allows selecting sport from OptionChips
- BUILD 2: Event Edit Flow submits PATCH /events/{id} with EventUpdate field set (omits immutable visibility and cost/currency)
- BUILD 2: Event Edit Flow surfaces 409 conflict when edit is locked after event start
- BUILD 2: Event Edit Flow surfaces 409 conflict when sport change is locked after participant joined
- BUILD 2: Event Edit Flow validates client-side constraints on edit fields before submitting
- Mobile Artboard Stacked Cards Layout Event Details Card renders Cost row as last row when cost is present
- Mobile Artboard Stacked Cards Layout Event Details Card renders heading "Event Details" and row order: Visibility, Skill level, Waitlist
- Mobile Artboard Stacked Cards Layout Event Details Card renders 👥 Group when visibility is group
- Mobile Artboard Stacked Cards Layout Event Details Card renders 🔒 Invite Only when visibility is invite_only
- Mobile Artboard Stacked Cards Layout renders "About this game" Card with description only
- Mobile Artboard Stacked Cards Layout renders Capacity Card with ratio, players going label, and remaining spots
- Mobile Artboard Stacked Cards Layout renders Participants Card with participant names and roles
- Mobile Artboard Stacked Cards Layout renders back navigation button and calls goBack on tap
- RSVP / withdraw contract shows the join error when the RSVP request fails
- keyboard avoidance (same class of bug as Create Game — the Edit Event form has TextInputs and previously had no KeyboardAvoidingView wrapper at all) the Edit Event form (with its TextInputs) renders inside the keyboard-aware scroll view
- keyboard avoidance (same class of bug as Create Game — the Edit Event form has TextInputs and previously had no KeyboardAvoidingView wrapper at all) wraps the screen in a KeyboardAvoidingView with padding behavior on iOS
- organiser (organizer_id === signed-in user id) renders the Edit Game button in the standing-rule CTA blue (#1D5FA3), not the accent color
- organiser (organizer_id === signed-in user id) sees "Edit Game", "Invite Group", "Invite Individual", and "Cancel Event", but not "Join" or "Leave"
- organiser (organizer_id === signed-in user id) sees organiser actions for an in-progress (active) event
- organiser (organizer_id === signed-in user id) sees organiser controls and no RSVP control even when they also have an RSVP row (going)
- renders formatted cost with currency when estimated_cost_cents is set
- resolves the sport slug to its display_name from GET /admin/sports/public (BUG-M02)
- share event flow copies canonical event link with ?ref= to clipboard and displays toast
- share event flow opens ShareActionSheet when tapping "Share Event"
- share event flow triggers WhatsApp share with composed message
- share event flow triggers generic share with composed message and URL with ?ref=

Remaining failures on both commits in `TournamentTabBodies.test.tsx`: `Media upload rights and read-only ... the organizer sees the upload control` and `... committee members (the server sends tabs.approvals) see the upload control` (`Expected length: 1, Received length: 2`, `TournamentTabBodies.test.tsx:730` and `:737`). Not caused by the PRs; not fixed here.

## 4. Coverage delta (statements; jest coverage restricted to the 32 source files changed by the four PRs, scoped tests of section 3 only; one run each)

This is coverage by the scoped test files, not by the full suite. The failing suites above (screens covered mainly by `CreateGameScreen.test.tsx` and `EventDetailScreen.test.tsx`) contribute what their passing tests execute.

| File | before #75 (statements covered/total) | on main |
|---|---|---|
| `src/api/events.ts` | 33/101 = 32.7% | 42/110 = 38.2% |
| `src/api/teams.ts` | 0/5 = 0.0% | 3/7 = 42.9% |
| `src/api/tournaments.ts` | 87/133 = 65.4% | 98/140 = 70.0% |
| `src/components/NotificationPreferencesList.tsx` | 44/56 = 78.6% | 44/56 = 78.6% |
| `src/components/RepeatWeeklyControl.tsx` | n/a (file absent) | 10/10 = 100.0% |
| `src/components/home/UnifiedCard.tsx` | 29/75 = 38.7% | 29/75 = 38.7% |
| `src/components/icons/NotificationIcon.tsx` | 3/3 = 100.0% | 3/3 = 100.0% |
| `src/components/series/SeriesParts.tsx` | n/a (file absent) | 54/55 = 98.2% |
| `src/components/tournament/participants/AddTeamSheet.tsx` | n/a (file absent) | 52/53 = 98.1% |
| `src/components/tournament/v2/TournamentDetailV2.tsx` | 63/71 = 88.7% | 63/71 = 88.7% |
| `src/components/tournament/v2/TournamentHeader.tsx` | 16/18 = 88.9% | 16/18 = 88.9% |
| `src/components/tournament/v2/TournamentOverview.tsx` | 51/55 = 92.7% | 59/63 = 93.7% |
| `src/components/tournament/v2/tabs/FixturesSetup.tsx` | 91/96 = 94.8% | 109/114 = 95.6% |
| `src/components/tournament/v2/tabs/ParticipantsTab.tsx` | 163/174 = 93.7% | 170/181 = 93.9% |
| `src/labels/defaultLabels.ts` | 1/1 = 100.0% | 1/1 = 100.0% |
| `src/navigation/RootNavigator.tsx` | 0/76 = 0.0% | 0/76 = 0.0% |
| `src/navigation/types.ts` | 0/0 = 100.0% | 0/0 = 100.0% |
| `src/notifications/notificationRouting.ts` | 21/30 = 70.0% | 21/30 = 70.0% |
| `src/screens/CreateGameScreen.tsx` | 92/349 = 26.4% | 189/361 = 52.4% |
| `src/screens/EventDetailScreen.tsx` | 170/484 = 35.1% | 197/516 = 38.2% |
| `src/screens/TournamentDetailScreen.tsx` | 155/334 = 46.4% | 168/337 = 49.9% |
| `src/screens/TournamentEditScreen.tsx` | n/a (file absent) | 64/78 = 82.0% |
| `src/types/event.ts` | 0/0 = 100.0% | 0/0 = 100.0% |
| `src/types/notification.ts` | 1/1 = 100.0% | 1/1 = 100.0% |
| `src/types/tournament.ts` | 0/0 = 100.0% | 0/0 = 100.0% |
| `src/types/tournamentTabs.ts` | 0/0 = 100.0% | 0/0 = 100.0% |
| `src/utils/fixturesSetup.ts` | 85/102 = 83.3% | 85/102 = 83.3% |
| `src/utils/refusal.ts` | 24/33 = 72.7% | 30/33 = 90.9% |
| `src/utils/repeatWeekly.ts` | n/a (file absent) | 14/14 = 100.0% |
| `src/utils/seriesDisplay.ts` | n/a (file absent) | 10/11 = 90.9% |
| `src/utils/tournamentEdit.ts` | n/a (file absent) | 51/59 = 86.4% |
| `src/utils/tournamentExperience.ts` | 63/67 = 94.0% | 65/72 = 90.3% |

common 25 files: before 1192/2264=52.7% ; main 1393/2367=58.9% ; all-on-main 1648/2647=62.3%. Seven files exist only on main (statements counted in the all-on-main figure).

## 5. Rules audit (grep over the 32 changed source files; each hit with file and line; "new" = on a line one of the four PRs added)

| Pattern | New-line hits | Hits on lines the PRs did not add |
|---|---|---|
| literal colours (`#hex`, `rgb(`, `color/backgroundColor/borderColor: '...'`) | 0 | 15 |
| `AsyncStorage`, `console.*`, `Keychain`, the word `token` | 0 | 0 |
| `apiClient.get/post/put/patch/delete` | 7 | 69 |
| `.length`, `Date.now(`, `new Date(`, `Math.`, `.reduce(`, `.sort(` | 9 | 99 |

HTTP calls added by the PRs (all inside `src/api/`; each is used under `withCorrelationId()` at the call sites listed):

- `src/api/events.ts:618`: `const { data } = await apiClient.post<{ left?: boolean; games_left?: number } | undefined>(`/events/${id}/series/leave`, undefined, {`
- `src/api/events.ts:633`: `await apiClient.patch(`/events/${id}/series`, body, { correlationId: options?.correlationId });`
- `src/api/events.ts:638`: `await apiClient.post(`/events/${id}/series/cancel`, { reason }, { correlationId: options?.correlationId });`
- `src/api/teams.ts:70`: `const { data } = await apiClient.get<TeamApiItem[]>('/teams', {`
- `src/api/tournaments.ts:893`: `await apiClient.post(`/tournaments/${id}/registrations/committee-add`, { team_id: teamId }, {`
- `src/api/tournaments.ts:907`: `const { data } = await apiClient.patch<{ fixtures_reset?: boolean | null } | undefined>(`/tournaments/${id}`, body, {`
- `src/api/tournaments.ts:989`: `const { data } = await apiClient.post<unknown>(`/tournaments/${id}/fixtures/shuffle`, undefined, {`

Call sites of the new client functions (grep `src`, excluding tests):

```
src/components/tournament/participants/AddTeamSheet.tsx:80:  await withCorrelationId(correlationId => committeeAddTeam(...))
src/components/tournament/participants/AddTeamSheet.tsx:62:  withCorrelationId(correlationId => getTeams({ correlationId }))
src/screens/TournamentEditScreen.tsx:114:                      withCorrelationId(correlationId => updateTournament(...))
src/components/tournament/v2/tabs/FixturesSetup.tsx:245:      withCorrelationId(correlationId => shuffleFixtureDraft(...))
src/components/series/SeriesParts.tsx:65:                    withCorrelationId(correlationId => leaveEventSeries(...))
src/components/series/SeriesParts.tsx:155:                   withCorrelationId(correlationId => updateEventSeries(...))
src/components/series/SeriesParts.tsx:107:                   withCorrelationId(correlationId => cancelEventSeries(...))
```

Calls added by the PRs that are **not** under `withCorrelationId()`: `src/screens/TournamentEditScreen.tsx:67` (`getClientConfig()`) and `:73` (`getSports()`), both reads on screen open, not user actions. (Existing unwrapped reads on lines the PRs did not add: `src/screens/TournamentDetailScreen.tsx:275` and `:358`, `getTournament`.) Skip this game uses the existing `handleWithdraw` (`src/screens/EventDetailScreen.tsx`, `withCorrelationId` wrapper unchanged).

Client-side arithmetic, counts and dates on lines the PRs added (all new-line hits, no judgement):

- `src/api/tournaments.ts:192`: `: raw.registration_closes_at === null || Date.parse(raw.registration_closes_at) > Date.now(),`
- `src/components/series/SeriesParts.tsx:148`: `if (Object.keys(body).length === 0) {`
- `src/components/tournament/participants/AddTeamSheet.tsx:142`: `) : offered.length === 0 ? (`
- `src/components/tournament/v2/tabs/ParticipantsTab.tsx:403`: `<Text style={styles.countText}>{t('mob.tournament.participants.registered_of', { count: rows.length, max: tournament.max_participants })}</Text>`
- `src/components/tournament/v2/tabs/ParticipantsTab.tsx:407`: `<View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />`
- `src/screens/TournamentDetailScreen.tsx:811`: `onEdit={canOfferEdit(tournament, isOrganiser, new Date()) ? () => navigation.navigate('TournamentEdit', { tournamentId: tournament.id }) : null}`
- `src/screens/TournamentEditScreen.tsx:53`: `const [now] = useState(() => new Date());`
- `src/utils/tournamentEdit.ts:36`: `const date = new Date(iso);`
- `src/utils/tournamentEdit.ts:134`: `const hasChanges = Object.keys(body).length > 0;`

Facts for reading the list: `src/api/tournaments.ts:192` is the fallback that derives `registration_open` from `registration_closes_at` only when the API field is absent (the API value is read at `src/api/tournaments.ts:188-191`); `ParticipantsTab.tsx:403-407` is the committee-only "{count} of {max}" line and bar that the addendum keeps (computed from `rows.length` and `tournament.max_participants`, as before PR #75); `tournamentEdit.ts:36` converts a server ISO string to the picker's local text. No standings or draw balance is computed in a changed file: `src/components/tournament/v2/tabs/FixturesSetup.tsx` reads `shuffle_total` and `shuffle {index, total}` as sent.

## 6. Contract audit (every endpoint and field the four steps call or read, with its backend source)

Sources: `er-bw-tournament-report.md` (ER-T), `er-bw-shuffle-report.md` (ER-S), `er-bw-series-report.md` (ER-E), `er-web-tournament-report.md` (WEB-T), `er-web-series-report.md` (WEB-E), `er-config-labels-report.md` (ER-L); and backend code in `pratheeshku/meetup` @ `c962b2b` where a field is named.

| Call or field | Source |
|---|---|
| `GET /tournaments`, `GET /tournaments/{id}`, `/mine`: `registered_count`, `is_full`, `registration_open` | ER-T §3 (AD-4 visibility and counts); `tournaments/schemas.py:268-273` |
| same routes: `registration_hard_block_at`, `roster_frozen_at` absent for non-privileged viewers | ER-T §3; `tournaments/schemas.py:332-335` |
| `GET /tournaments/{id}/scoring/state`: `registration_phase` as `open`/`closed` (or the three committee values) | ER-T §3 (scoring/state narrowing) |
| `DELETE /tournaments/{id}/registrations/{rid}`; 409 `WITHDRAWAL_LOCKED`, 409 `ROSTER_LOCKED` | ER-T §3 (AD-5, `withdraw_self`); ER-L §4 (`mob.reg.err.*`) |
| `POST /tournaments/{id}/registrations/committee-add` with `team_id` or `user_id` | ER-T §3 (AD-5, AD-2); addendum §5.2 |
| `PATCH /tournaments/{id}`: `title`, `description`, `starts_at`, `ends_at`, `registration_closes_at`, `registration_hard_block_at`, `venue_id`, `others`, `venue_name`, `venue_address`, `registrants_may_withdraw`; answer `fixtures_reset` | `TournamentUpdate` and `fixtures_reset`, `tournaments/schemas.py:274`, `:478-502`; ER-T §3 (AD-3); WEB-T §3 |
| `PATCH` codes: `TOURNAMENT_DATES_INVALID` with `reason` and `field`, `REGISTRATION_DATES_REQUIRED`, `TOURNAMENT_HAS_RESULTS`, `TOURNAMENT_STARTED` | ER-T §3; `tournaments/create_contract.py:45`, `:206-207` |
| `PATCH /tournaments/{id}` fee fields (`registration_fee_cents`, `payment_contact_number`), unchanged client | `tournaments/schemas.py` (`TournamentUpdate`); pre-existing |
| `GET /teams`: `id`, `name`, `sport` (`player_count` null) | `teams/router.py:24`, `teams/schemas.py:27-37`; WEB-T D-6; addendum A40 |
| `POST /tournaments/{id}/fixtures/shuffle` (no body); answer: draft fields plus `shuffle {index, total}`; payload `shuffle_index`, `shuffle_total` | ER-S §3 (route, `draft_response`, `with_shuffle`); `tournaments/fixture_core_adapter.py:569-571` |
| shuffle codes: 409 `SHUFFLE_UNAVAILABLE` (+ `reason`), 409 `FIXTURE_FROZEN`, 429 (10 per minute) | ER-S §3 (route and codes) |
| `GET /tournaments/{id}/drafts/{draft_id}` | pre-existing (read by `getFixtureDraft`) |
| `POST /events`: `recurrence_frequency`, `recurrence_interval`, `recurrence_ends_on`, `recurrence_occurrence_limit` | `events/schemas.py:51-56`; ER-E §1; addendum §5.2 |
| `EventResponse.series`: `rule_id`, `interval`, `ends_on`, `occurrence_limit`, `index`, `total`, `my_membership` | `events/schemas.py:154-161`, `:225`; ER-E §1 |
| `POST /events/{id}/series/leave` answer `{left, games_left}` | `events/router.py:169-185`; ER-E §7 D-10 |
| `PATCH /events/{id}/series` body `start_time`, `duration_minutes` | `events/schemas.py:570-`, `events/router.py:189`; ER-E §7 D-10; addendum A21 |
| `POST /events/{id}/series/cancel` body `{reason}` | `events/router.py:231-248`, `EventCancelRequest` `events/schemas.py:619-620` |
| series codes `SERIES_END_INVALID`, `SERIES_LIMIT_EXCEEDED`, `SERIES_HAS_PARTICIPANTS`, `SERIES_ORGANIZER_CANNOT_LEAVE` | ER-E §1, §7; ER-L §3-4; addendum A20 |
| `POST /events/{id}/rsvp` `{action: 'withdrawn'}` (Skip this game) | pre-existing route; addendum AD-8 "Skip one" (existing withdraw); ER-E §1 |
| push types `tournament_updated`, `tournament_registration_added`; `entity_id` = the tournament id (routing) | ER-T §3 (AD-9); `tournaments/edit_notifications.py:90` and `registration_v2.py` `EntityRef(type="tournament", id=tournament.id)` |
| `GET /api/labels` keys (section 2) | ER-L §4; M3 `c4e9a2d71f08` |

**Calls or fields with no source in the backend reports or code: none found.** Notes: (a) the live API was not reachable from the cloud sessions (proxy 403), so no field was checked against production; (b) `GET /config/game-limits` returns no recurrence bounds, so none is read (ER-E / WEB-E D-1, addendum A40, A55); (c) the withdrawal-locked flag is not in `TournamentResponse` and is not read (A40).

## 7. Drift list (consolidated from the four reports)

| # | Item | Step | Ruling |
|---|---|---|---|
| 1 | Seeded keys used are `web.*` (no `mob.*` copy seeded) for count, Full chip, "Registration closes", Edit/Add team/Shuffle/series text | 3.1, 3.2, 3.3, 3.4 | A43 |
| 2 | Cap hidden from participants in the Format card (not one of the five listed places) | 3.1 | A44 |
| 3 | Register hidden while `is_full` | 3.1 | A44 |
| 4 | `registered_count` missing hides the count (never 0); `registration_open` missing falls back to the closing-date derivation | 3.1 | A44 |
| 5 | Admin who is not on the committee recognised only by the API having returned `registration_hard_block_at` | 3.1 | none found |
| 6 | v1 detail page no longer falls back to the registrations list length for the count | 3.1 | none found (covered by the A44 "missing hides the count" ruling) |
| 7 | Unchanged "frozen" copy and now-unused labels (`mob.tournament.registered_line`, `register_spots_left`) | 3.1 | none found for the unused labels; committee note: A50 |
| 8 | Edit tournament offered to the organizer only (brief said organizer and committee) | 3.2 | A47 |
| 9 | Seeded "Add team", "Add a team", "Search teams" trip the glossary; 3 allowlist entries | 3.2 | A48 (OI-18) |
| 10 | Edit covers title, description, dates, hard block, venue, withdrawal switch; not capacity, visibility, audience groups, fee (own sheet), `venue_detail` | 3.2 | A49 |
| 11 | Reset warning for Add player is shown in the sheet, not as a per-row confirmation | 3.2 | none found |
| 12 | Fixtures-exist test reads `schedule_published_at` or status `schedule_draft`/`published` (no `schedule_generated_at` on mobile) | 3.2 | none found |
| 13 | Participants-tab committee note wrong under AD-5, no seeded replacement | 3.2 | A50 (OI-19) |
| 14 | Edit not offered for version 1 tournaments | 3.2 | none found |
| 15 | "Shuffle again" placement in the draft card; shown while a publication request is pending; no confirmation | 3.3 | A52 |
| 16 | "Draw n of N" only from the response; disable on in-flight and on `shuffle_total` <= 1 | 3.3 | A53 |
| 17 | Series layout (Repeat weekly under date and time; chip and line under the time row; Skip replaces Decline; scope alert on Edit/Cancel icons) | 3.4 | A55 covers the four items below; layout itself: none found |
| 18 | Start-time box typed `HH:MM`; invalid or empty box not sent | 3.4 | A55 |
| 19 | Game count checked as a whole number only (no bound on the device) | 3.4 | A55 |
| 20 | Chip hidden when the server sends no `index` | 3.4 | A55 |
| 21 | Series cancel reuses the single cancel's fixed reason text | 3.4 | A55 |
| 22 | Skip appears only for a member who is going | 3.4 | none found |
| 23 | History row of a tournament type with no `entity_id` does nothing | 3.4 | none found |
| 24 | `NotificationPreferencesScreen.test.tsx` pin updated 19 to 25 (stale before) | 3.4 | none found |
| 25 | Two suites (71 tests) fail on main; screens changed in 3.4 have no working screen-level suite | 3.4 | A56 |
| 26 | Screenshots not taken (no emulator) | 3.1 to 3.4 | A45 |
| 27 | Pre-existing failures and lint errors left untouched (lint 34 errors; `TournamentTabBodies` Media tests x2) | 3.1 to 3.4 | none found |

## 8. Failures and findings listed, not fixed

1. 71 tests in `CreateGameScreen.test.tsx` (37) and `EventDetailScreen.test.tsx` (34) fail on main and on `082e921`, the same set (section 3).
2. `TournamentTabBodies.test.tsx`: two Media tests fail on both commits (`:730`, `:737`).
3. `TournamentTabBodies.test.tsx` Participants test timed out once in the instrumented run (section 3 explanation); passes without coverage.
4. Lint: 34 errors and 1 warning, identical to the `origin/main` baseline recorded in steps 3.1 to 3.4.
5. `src/screens/TournamentEditScreen.tsx:67`, `:73` read config and sports without `withCorrelationId()` (section 5).
6. Section 2: no key mismatch and no key unseeded.

Nothing in this report is a conformance verdict; that is the architect's step 3.6.
