# er-m-committee report (step 3.2)

Task ID: `er-m-committee`. Machine: Cloud (agent session), repo root `/home/user/meetup-mobile`. Branch `claude/beautiful-hypatia-1wa00s`, restarted from `origin/main` @ `3b62281` (addendum v1.9; PR #75 merged).
Design: `docs/DES-MEETUP-ADDENDUM-tournament-edit-recurring.md` v1.9, AD-2, AD-3, AD-5, AD-6, rulings A38 to A46. **No board exists; the addendum is the board of record (A38); the `CMAddTeam` board is superseded by AD-2 and AD-5.** Screenshots are taken later on the Mac (A45); none are attached.
Scope kept: no shuffle, series, push routing, native config, package files or `docs/` (other than this report). No version chosen, no build, no force-push, no agent dispatched.

## 1. What was built

| Step | Change | Files |
|---|---|---|
| 1 Committee add/remove | Add player and Remove are offered to the organizer and committee in every phase (the `phase !== 'frozen'` gate is gone); the server ends it with 409 `ROSTER_LOCKED`, mapped to its label. When fixtures exist the Add sheet shows the reset warning and the Remove confirmation carries it. | `.../tabs/ParticipantsTab.tsx`, `src/utils/refusal.ts` |
| 2 Add team | New sheet for team tournaments: `GET /teams`, kept to the tournament's sport, minus teams already entered (their `team_id`), searchable; a tap sends `committee-add` with `team_id` only; a confirmation first when fixtures exist; server refusals (skill, size, capacity, ...) use the existing labels. The old note "The committee adds individual players only" is gone. | `.../participants/AddTeamSheet.tsx`, `src/api/teams.ts` (`getTeams`), `src/api/tournaments.ts` (`committeeAddTeam`) |
| 3 Edit tournament | New screen `TournamentEdit` (title, description, start, end, registration closes, hard block, venue, withdrawal switch). Local-time pickers (`DateTimePickerField`), ISO UTC out, **only changed fields sent**, `registrants_may_withdraw` starts on and is sent with a start, end or venue change or when switched off. Future-date check is a UX hint. Confirmation when fixtures exist and a start, end, venue or block date changes; `fixtures_reset` in the answer shows the reset message. `TOURNAMENT_DATES_INVALID` (by `reason` and `field`, `DATE_IN_PAST` included), `REGISTRATION_DATES_REQUIRED`, `TOURNAMENT_HAS_RESULTS`, `TOURNAMENT_STARTED` show labelled messages, never the server text. Entry: "Edit Tournament" row in the Overview organizer tools. The fee client `updateTournamentFee` and its sheet are unchanged. | `src/screens/TournamentEditScreen.tsx`, `src/utils/tournamentEdit.ts`, `src/api/tournaments.ts` (`updateTournament`), `src/types/tournament.ts` (`TournamentEditBody`), `src/navigation/{types,RootNavigator}.ts(x)`, `TournamentOverview.tsx`, `TournamentDetailV2.tsx`, `TournamentDetailScreen.tsx` |
| 4 Types and clients | Only the three routes above (`committee-add` with `team_id`, `PATCH /tournaments/{id}`, `GET /teams`); all exist in the backend. No endpoint invented. | see above |
| 5 Labels | Seeded keys and wording only (section 4). | `src/labels/defaultLabels.ts` |
| 6 Rules | Theme tokens and shared components only; one `withCorrelationId()` per user action (add, remove, add team, save); the team row's icon sits in a fixed 40 box. | n/a |

Diff against main (code and tests, before this report):

```
 scripts/check-labels.allowlist.json                |  18 ++
 src/api/teams.ts                                   |  11 +
 src/api/tournaments.ts                             |  23 ++
 .../tournament/participants/AddTeamSheet.tsx       | 203 +++++++++++++
 .../tournament/v2/TournamentDetailV2.tsx           |   3 +
 .../tournament/v2/TournamentOverview.tsx           |  11 +
 .../tournament/v2/tabs/ParticipantsTab.tsx         |  47 ++-
 src/labels/defaultLabels.ts                        |  21 ++
 src/navigation/RootNavigator.tsx                   |   6 +
 src/navigation/types.ts                            |   2 +
 src/screens/TournamentDetailScreen.tsx             |   2 +
 src/screens/TournamentEditScreen.tsx               | 325 +++++++++++++++++++++
 src/screens/__tests__/TournamentEdit.test.tsx      | 189 ++++++++++++
 .../TournamentParticipantsInvite.test.tsx          |   4 +-
 .../TournamentParticipantsPayments.test.tsx        |   5 +-
 src/screens/__tests__/TournamentTabBodies.test.tsx | 101 +++++++
 src/types/tournament.ts                            |  19 ++
 src/utils/__tests__/tournamentEdit.test.ts         |  80 +++++
 src/utils/refusal.ts                               |   4 +
 src/utils/tournamentEdit.ts                        | 187 ++++++++++++
 20 files changed, 1250 insertions(+), 11 deletions(-)
```

Commits (one per logical change): clients, types, labels and code mapping; edit helpers; roster override and Add team; Edit tournament screen; tests; test expectations and label-scan allowlist.

## 2. Checks (each once; raw)

`npx tsc --noEmit`: no output (clean).

`npm run check:labels`:
```
check-labels: OK - 319 files scanned, 1983 default labels checked.
```
(It first failed on the glossary rule for the seeded wording "Add team", "Add a team", "Search teams"; see drift 2.)

`npm run lint` (whole repo, run before the last two test-file edits): `✖ 35 problems (34 errors, 1 warning)`, **identical to `origin/main`** (diff of the full outputs empty). The two test files edited afterwards were linted on their own: only the 3 `no-unused-vars` errors already present in `TournamentParticipantsInvite.test.tsx` on main (the 34 above include them), nothing new.

`npx jest`, only the 23 files covering the touched modules (tournament api, list content/rows, registration labels, `TournamentDetail*`, the new `TournamentEdit`, game view, tab bodies, registration, participants, fee edit, responses, fixtures setup, tournamentExperience, the new `tournamentEdit`, refusal, tournamentTabs, `RootNavigatorHomeTab`, `GroupsTeamsSwitch`):
```
FAIL src/components/home/__tests__/TournamentListRows.test.tsx
FAIL src/screens/__tests__/TournamentTabBodies.test.tsx (10.562 s)
Test Suites: 2 failed, 21 passed, 23 total
Tests:       3 failed, 413 passed, 416 total
```
The 3 failures are the same 3 that fail on `origin/main` (seen when the same single files were run there in step 3.1, and unchanged here):
```
  ● Invite type line › a group line opens the existing group pop-up (the Invited sheet) listing every group, without any request
  ● Media upload rights and read-only (tournament-registration AD-6) › committee members (the server sends tabs.approvals) see the upload control
  ● Media upload rights and read-only (tournament-registration AD-6) › the organizer sees the upload control
```
Two existing tests asserted the removed behaviour and were updated (`TournamentParticipantsPayments`: team mode used to show a note instead of an add control; `TournamentParticipantsInvite`: a frozen roster used to hide Register a player). The full suite was not run.

New tests: `TournamentEdit.test.tsx` (11), `tournamentEdit.test.ts` (8), six in `TournamentTabBodies.test.tsx` (add in the frozen phase with `user_id` only, `ROSTER_LOCKED` label, fixtures warning shown/not shown, Add team list/filter/`team_id` only, confirmation and labelled refusal, a player sees neither control).

## 3. Screenshots

Not taken: no emulator in the cloud session. Taken on the Mac at the 4.3 device test and attached to the 3.6 review (A45).

## 4. Labels (seeded keys, seeded wording; `er-config-labels-report.md` §4 and the M3 seed)

`web.tournament.edit_tournament`; `web.tournament.participants.{add_team, add_team_title, add_team_empty, search_teams, team_players}`; `web.tournament_edit.{dates_future, hard_block, hard_block_hint, may_withdraw, may_withdraw_hint, reset_confirm, reset_confirm_roster, reset_done}`; `web.edit_tournament.{registration_closes_at, tournament_updated_successfully, failed_to_update_tournament}`; `mob.reg.err.{roster_locked, tournament_started, tournament_has_results, registration_dates_required}`. As in step 3.1 (A43) the `web.*` seeded keys are used where no `mob.*` copy is seeded. Existing mobile keys are reused where they already exist (`mob.tw.name`, `mob.tw.description`, `mob.tw.starts`, `mob.tw.ends`, `mob.tw.pick_date`, `mob.tw.window_section`, `mob.create_game.venue_label`, `mob.common.save`, `mob.common.cancel`, `mob.common.done`, and the create wizard's date messages for `TOURNAMENT_DATES_INVALID`). No key was renamed or invented; every needed key was seeded.

## 5. Drift and judgement calls (for the architect)

1. **Who may edit.** The task text says "organizer and active committee per AD-3". AD-3 (line 108), OI-5 and ER-T4 say the **organizer only** and "committee member edit denied". I followed the addendum: the Edit row is offered to the organizer of a version 2 tournament that has not started; committee members still add and remove. The server is the authority either way.
2. **Glossary conflict in the seed.** The seeded wording "Add team", "Add a team" and "Search teams" contains the glossary's banned bare "team", so `check:labels` fails when the seeded text is bundled exactly. I kept the seeded wording and added three entries with a reason to `scripts/check-labels.allowlist.json` (the only place exclusions live, same pattern as the committee labels). The owner decides whether the seed or the glossary changes.
3. **Edit fields.** Covered: title, description, start, end, registration closes, hard block, venue, withdrawal choice. Not covered: capacity and visibility (the web form has them; addendum AD-3 says capacity is immutable and visibility stays as is), the fee and payee number (their own sheet, unchanged), audience groups, and the optional court or hall text (`TournamentUpdate` has no `venue_detail`).
4. **Warning on Add player.** The picker adds on a tap, so the reset warning is shown in the Add sheet before the tap (and as a confirmation for Add team and Remove) rather than as an extra confirmation per row.
5. **Fixtures-exist test.** Mobile has no `schedule_generated_at`; it reads `schedule_published_at` or a raw status of `schedule_draft` or `published`, as the web does.
6. **Left unchanged (not in this task):** the committee note in the Participants tab ("until the roster is frozen on {date}") is now wrong under AD-5 and has no seeded replacement for mobile; the web key was reworded by M3, the `mob.*` text was not. Flagged for the architect. Edit is not offered on version 1 tournaments (the server refuses the new fields there).
7. **Pre-existing** failures (3 tests) and lint errors (34) are untouched.

No CRITICAL or HIGH gap; no Blocked Report. Nothing is self-certified; the architect rates this report.
