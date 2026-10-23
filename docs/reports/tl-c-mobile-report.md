# Implementation Report: tl-c-mobile

Lifecycle Phase C mobile, Phase P mobile, scoring contract check. Backend read from `pratheeshku/meetup` main at `94604e5` (cloned read-only into the session; `~/meetup` was not present, so it was attached for reading and nothing in it was edited).

| PR | Branch | Status |
|---|---|---|
| 1 Scoring contract check | `claude/tournament-lifecycle-mobile-c-912vtm` (commit d9499a2) | Delivered |
| 2 Creation wizard | none | **BLOCKED** (precondition not met on backend main; Blocked Report below) |
| 3 "+" / "-" controls | `claude/tl-c-mobile-pr3-add-remove` (commit d8d2b4e) | Delivered as an audit plus a stricter static check. The shared control already exists on main |

Branch names: PR 1 uses the session's designated branch; PR 3 uses a second branch because you asked for one branch per PR. This file is identical on both branches so the second merge does not conflict.

## 1. Design reference
`docs/DES-MEETUP-ADDENDUM-tournament-lifecycle.md` v1.4: AD-19, AD-20, TL-78 to TL-86, tests 50 and 51 (as mirrored in `~/meetup/docs`). `docs/DES-MEETUP-ADDENDUM-match-scoring.md` v1.2 for scoring. Handoff template: `~/meetup/docs/agent-handoff-template.md` (this repo has no copy; the task said to prepend it).

## PR 2 BLOCKED REPORT (Phase C wizard)

The task says to STOP when the template-list route, the extended create route or `tl-c-web-report.md` is missing from main. All three are missing on `pratheeshku/meetup` main (`94604e5`, "Merge pull request #117 ... tournament-v2-enable"):

1. **No non-admin template-list route.** `tournaments/template_router.py` exposes only `GET /admin/tournament-templates` (platform admin only, returns drafts and retired too). A normal organizer cannot list published templates, so step 5 and the "open the wizard only if at least one published template exists" rule have nothing to call.
2. **Create route is not the AD-20 contract.** `POST /tournaments/v2` (`TemplateV2CreateBody`, `extra="forbid"`) accepts `template_id, overrides, title, sport, participation_mode, visibility, starts_at`. It has no `client_request_id`, `ends_at`, `registration_closes_at`, `registration_hard_block_at`, `group_ids` or `committee_user_ids`; no `TOURNAMENT_DATES_INVALID` 422 with `reason/field/step`; no `tournament_audience_groups`. `grep` for `client_request_id|committee_user_ids|TOURNAMENT_DATES_INVALID|tournament_audience_groups` finds them only in migrations/models/fixture_workspace, not in the tournaments routes or schemas. `POST /tournaments` (v1) is unchanged.
3. **`docs/reports/tl-c-web-report.md` does not exist** (no `tl-c*` file anywhere in the repo).

Question for the owner: is tl-c-web PR 2 (backend create contract) merged anywhere other than `main`, or does it still need to land? Once it does, re-run this task for PR 2 only; the mobile wizard will be built against the merged routes. Nothing was invented, and no wizard code or labels were written.

## PR 1: scoring contract check

### What was compared
Backend: `tournaments/result_service.py::board_view` (`GET /tournaments/{id}/standings`, v2 shape), `tournaments/engine_service.py::scoring_state` (`GET /tournaments/{id}/scoring/state`), `tournaments/scoring_notifications.py`, `notifications/schemas.py`, plus the backend's own key-set tests (`tests/test_match_scoring_s4_unit.py`) and `tests/js/scoring_view.test.mjs`. Mobile: `src/types/tournamentScoring.ts`, `src/utils/tournamentScoring.ts`, `src/api/tournaments.ts`, `TournamentScoringScreen`, `src/components/scoring/*`, notification routing and preferences.

Python dependencies are not installed here, so the backend could not be run to dump a live response. The fixture is built from the backend's own tests (exact key sets, literal values and `bracket_slot` ids), and a jest test asserts the fixture has exactly the backend key sets.

### Result: no mismatch found in the standings, scoring/state or notification types
- Top level, group, table row, match, side, result fields all line up. `advance_per_group`, `qualifies` (true/false/null), `placeholder_detail` (`group_place`, `winner`, `loser`, feeder `match_id` = the feeder's `bracket_slot`), `is_mine` are read as sent. Statuses (`scheduled, completed, walkover, cancelled`) match the DB CHECK. Stages (`group, quarterfinal, semifinal, final, main, third_place`) match the adapter.
- Notification types `tournament_result_posted`, `tournament_advanced`, `tournament_result_corrected` exist in backend (`notifications/schemas.py`, `models.py` CHECK) and in mobile (`types/notification.ts`, routing, preferences).
- Screens gate on `scoring/state` (`enabled && applicable`), then call standings; v1 list shape and `published:false` mean no scoring UI.

### Backend returns, mobile ignores (by design; read-only app)
| Field | Where |
|---|---|
| `tiebreakers` | standings top level (the ordered criteria) |
| `summary` | `result.summary` ("21-15, 21-19", "W/O", "RET ..."); mobile renders the sets itself |
| `registration_phase`, `is_committee`, `fixtures_published`, `any_result_posted`, `committee` | `scoring/state`; mobile reads only `enabled`, `applicable` (committee entry stays on web) |

### Mobile reads, backend does not return
None. A jest test asserts every key on the normalised types is in the backend key sets. One defensive fallback exists: `match_id` falls back to `fixture_id` if absent (the backend always sends it).

### Venue picker finding (create game and create tournament)
- **Create game (standard variant):** after selection it shows name + address line + source tag + map card. Works.
- **Create tournament (`variant="tournament"`, a mode of CreateGameScreen):** after selection it showed the **name only**; the address line was never rendered (`VenuePicker.tsx` tournament branch drew name + tag + chevron). The state was correct (`selectedVenue.address` was set, and was in the accessibility label), only the render dropped it. Root cause is in the shared picker, not the screen, so the fix is there: the tournament variant now renders the address on a line under the 46 px field (board field height unchanged; the address sits below it as a caption, in theme tokens). One shared picker serves both screens, so no per-screen change.
- Test: `VenuePicker.test.tsx` adds a select-then-render case for both variants (name, address, list closed). Not verified red-first on the old code (I did not run the new tournament case against the pre-fix component); the old tournament branch has no address element, so it would fail.
- Board note: the TournSched/FXEdit board shows a 46 px compact field. The address line below it is an addition to the board, which you asked for; flagged under drift.

### Files (PR 1)
- `src/components/venue/VenuePicker.tsx` (modified), `src/components/venue/__tests__/VenuePicker.test.tsx` (modified)
- `src/test-utils/scoringBackendFixture.ts` (new), `src/utils/__tests__/tournamentScoringContract.test.ts` (new, 13 tests)

### Commands, raw output (PR 1)
`npx jest` on the affected files, after, with coverage (first run of the day timed out on the first VenuePicker test because the transform cache was cold; the final run below is clean; baseline VenuePicker file passed on the untouched code):
```
PASS src/utils/__tests__/tournamentScoring.test.ts
PASS src/utils/__tests__/tournamentScoringContract.test.ts
PASS src/components/venue/__tests__/VenuePicker.test.tsx
  VenuePicker.tsx      |   72.72 |     67.9 |   47.05 |   73.68 | 118,127,133-136,158-159,163-164,175-180,184-185,271-337,422 
  tournamentScoring.ts |   94.31 |    92.85 |   93.54 |    94.8 | 84,104,130,239                                              
Test Suites: 3 passed, 3 total
Tests:       41 passed, 41 total
```
Baseline (untouched code, existing tests only):
```
  VenuePicker.tsx      |   72.72 |    63.29 |   47.05 |   73.68 | 118,127,133-136,158-159,163-164,175-180,184-185,262-328,413 
  tournamentScoring.ts |   92.04 |    91.83 |   93.54 |    92.2 | 84,104,130,207-208,239                                      
Test Suites: 2 passed, 2 total
Tests:       26 passed, 26 total
```
`npx tsc --noEmit`: no output, exit 0. `npm run check:labels`: `check-labels: OK - 251 files scanned, 1189 default labels checked.` `npm run lint`: `✖ 32 problems (31 errors, 1 warning)` on the branch and `✖ 32 problems (31 errors, 1 warning)` on the untouched base: all pre-existing, none in the three files touched.

### Coverage delta (PR 1)
| File | Before | After |
|---|---|---|
| `VenuePicker.tsx` statements / branches | 72.72% / 63.29% | 72.72% / 67.9% |
| `utils/tournamentScoring.ts` statements / branches | 92.04% / 91.83% | 94.31% / 92.85% |

### Screenshots (PR 1)
No screenshots: not run on a device. No emulator or device was available.

## PR 3: "+" and "-" controls (AD-19)

### Finding: the shared component and test 51 already exist on main
`src/components/AddRemoveControl.tsx` (`AddRemoveControl`, `AddEntryButton`, `AddEntryRow`, `GroupInviteList`), `AddRemoveControl.test.tsx` and `inviteControlsStatic.test.ts` shipped earlier (ui-mobile, PR #40; extended by gv-mobile, PR #46; report `docs/reports/ui-mobile-report.md`). I did not rebuild them. This PR re-checks the inventory against today's code, adds a second static check, and lists what remains.

### Invite-control inventory (current code)
| # | Where | Control | Mode | State |
|---|---|---|---|---|
| 1 | `UserSearchPicker` rows (classic + `invite` variant) | per person | staged (CreateGame step 6, EventDetail invite picker, TournamentInvitePanel) or immediate (GroupDetail invite panel, InviteMembersScreen) | shared `AddRemoveControl` |
| 2 | `UserSearchPicker` email row | per email | as host | shared control |
| 3 | `CreateGameScreen` invitee chips | per person/email | staged | shared "-" |
| 4 | `InvitePicker` (GV-5) people, selected chips | per person/email | staged | shared control |
| 5 | `GroupInviteList` (EventDetail, TournamentInvitePanel, InvitePicker) | per group | staged | shared "+" / "-", "already in" chip |
| 6 | `GroupDetailScreen` "Invite" entry | entry to picker | n/a | shared `AddEntryButton` |
| 7 | `InviteCard` "Invite groups" / "Invite players" (game and tournament view) | entry to picker | n/a | **draws its own "+" circle** (exception, below) |
| 8 | `GroupDetailScreen` `plusSquare` "+" that closes the open panel | collapse | n/a | **own glyph** (exception, below) |
| 9 | `UndoAddButton` (GroupDetail added list, InviteMembersScreen) | undo of an added person | n/a | **own "-"** (exception, below) |

Out of scope, checked: GroupMultiSelect (visibility checkbox, wizard step 4 later), TournamentInvitationBanner Accept/Decline, "Send n invites" submit buttons, `NumberField` stepper, `HeaderAddButton`, `CreateGameCard`, `CreateTabButton` (create actions).

### Exceptions needing an owner decision (not converted; AGENTS.md: board and design disagree means stop and ask)
1. **InviteCard entries (7).** The approved GV-5 board (`docs/design/game-view-redesign/game-view.png`) draws a light-blue "+" circle, label and chevron, and the game-view addendum says the app-wide +/- conversion applies "only inside the new picker". AD-19 (v1.4, approved) says every entry button uses the shared component. The two disagree. Question: keep the GV-5 look (and let AD-19's rule exclude InviteCard), or restyle the shared `AddEntryRow` to the board and use it here?
2. **GroupDetail `plusSquare` (8).** A "+" that collapses the panel; the accessible label is "Invite players" collapsed. Question: replace with a "-"/close control, or keep?
3. **UndoAddButton (9).** Revoke/undo of someone already added; AD-19 says the revoke control is unchanged, but after a confirmed "+" the row shows the "Added" chip and this "-", whereas AD-19 says "sent = status chip, no glyph". Question: confirm it stays.

### Added: `src/components/__tests__/addRemoveGlyphStatic.test.ts` (3 tests)
Scans every non-test `.tsx` under `src`: a drawn glyph (`PlusIcon`/`MinusIcon`, a Text containing only "+" or a minus sign, `plusSquareText`) outside `AddRemoveControl.tsx` and the listed exceptions fails. Exceptions are the three open questions above plus non-invite create/stepper controls, each with a reason in the file. It also fails if a listed exception no longer exists or no longer draws a glyph. This extends test 51's "static check with exceptions listed in the Phase P report".

### Commands, raw output (PR 3)
```
PASS src/components/__tests__/addRemoveGlyphStatic.test.ts
PASS src/components/__tests__/AddRemoveControl.test.tsx
PASS src/components/__tests__/inviteControlsStatic.test.ts

Test Suites: 3 passed, 3 total
Tests:       16 passed, 16 total
Snapshots:   0 total
Time:        1.44 s, estimated 2 s
Ran all test suites matching /src\/components\/__tests__\/addRemoveGlyphStatic.test.ts|src\/components\/__tests__\/inviteControlsStatic.test.ts|src\/components\/__tests__\/AddRemoveControl.test.tsx/i.
```
`npx tsc --noEmit` exit 0. `npm run check:labels`: OK - 251 files scanned, 1189 default labels checked. `npx eslint` on the new file: no output. `npm run lint`: no errors from the new file (the repo total is unchanged at 31 errors; local `coverage/` artifacts from my coverage run were removed).

### Coverage delta (PR 3)
No source file changed; one test file added. Delta on source: none.

### Screenshots (PR 3)
No screenshots: not run on a device. No UI changed.

## Labels needing a backend seed
New labels added by this task: **none** (no label key was added in PR 1 or PR 3; PR 2 was blocked).

Still unseeded from earlier work (found while auditing PR 3; `grep mob.add_remove` in `~/meetup` finds nothing): the five AD-19 keys in `src/labels/defaultLabels.ts`. They work through the in-app fallback; the backend `ui_labels` seed still needs a migration in the meetup repo:
| Key | Text |
|---|---|
| `mob.add_remove.invite_a11y` | Invite {name} |
| `mob.add_remove.remove_a11y` | Remove {name} |
| `mob.add_remove.sending_a11y` | Sending invitation to {name} |
| `mob.add_remove.sent` | Invited |
| `mob.add_remove.error` | Could not send the invitation. Try again. |

## Values I chose
- Venue address line: 12 px, `colors.textSecondary`, 4 px above margin, one line, under the 46 px tournament field (copies the existing `helperText` / `selectedAddress` styles).
- Contract fixture ids and values copied from the backend web test (`tests/js/scoring_view.test.mjs`); `tournament_id` uses a made-up UUID.
- Branch name for PR 3: `claude/tl-c-mobile-pr3-add-remove`.
- Exception list contents for the glyph check (each reason is in the file).

## Proposed Assumptions
1. The standings "summary" and "tiebreakers" are intentionally not read (rendering sets directly is the existing screen behaviour).

## Deviations from instructions
1. `~/meetup` was not present; I attached `pratheeshku/meetup` read-only and cloned it to `/home/user/meetup` to read the contract. Nothing written there.
2. The task says "no Co-Authored-By or AI attribution"; commits carry none. The session's default attribution reminder was overridden by that rule.
3. PR 3 did not "build one shared component": it exists. See finding above.
4. Local `main` was stale in the sandbox; the PR 3 branch is cut from `origin/main` (`5a68f64`). PRs 1 and 3 are opened against main (PR 2 has no branch).
5. The handoff template asks for a status file; written at `docs/status/tl-c-mobile-status.md`.

## Ran / not run
- Ran: `npx jest` on affected files only (VenuePicker, scoring utils x2, AddRemoveControl, two static checks), tsc, lint, check:labels.
- Not run: full jest suite (instructed), any emulator or device, `npm run build:aab`, any backend call or backend test (Python deps not installed), the wizard.

## Drift from the design
- AD-19 versus the GV-5 board: InviteCard entries (above).
- Venue tournament field: board shows name + source tag only; address added below on request.
- Design docs list the tournament wizard "deferred until after the current release" in the game-view addendum while AD-20 is approved; not acted on.

## Known gaps / follow-ups
- PR 2 blocked (see above).
- Owner decisions on InviteCard, plusSquare, UndoAddButton.
- Backend seed for the five `mob.add_remove.*` keys.
- Web venue picker symptom was not touched (web repo out of scope).

## Confidence per item
| Item | Level | Evidence |
|---|---|---|
| Contract fixtures/test | Done and verified | jest output above, 13 tests |
| Venue address line | Done and verified (jest, render level); not run on a device | VenuePicker tests above |
| Glyph static check | Done and verified | jest output above |
| Inventory | Done, not verified beyond code reading and the static checks | |

## Git evidence
(see the end of this file)

```
$ git log --oneline -3 (PR 1 branch)
ce680c5 tl-c-mobile: report and status (PR 1 delivered, PR 2 blocked, PR 3 audit)
d9499a2 Scoring contract check: backend-shaped fixtures and contract test; tournament venue picker shows the address line after selection
5a68f64 Merge pull request #49 from pratheeshku/claude/charming-faraday-ppxgkm

$ git log --oneline -3 claude/tl-c-mobile-pr3-add-remove
bfdef76 tl-c-mobile: report and status (PR 1 delivered, PR 2 blocked, PR 3 audit)
d8d2b4e AD-19 static check: no screen draws its own + or - glyph outside the shared control, exceptions listed
5a68f64 Merge pull request #49 from pratheeshku/claude/charming-faraday-ppxgkm

$ git show --stat d9499a2
d9499a2 Claude Scoring contract check: backend-shaped fixtures and contract test; tournament venue picker shows the address line after selection

 src/components/venue/VenuePicker.tsx               |  14 ++
 .../venue/__tests__/VenuePicker.test.tsx           |  37 +++++
 src/test-utils/scoringBackendFixture.ts            | 120 ++++++++++++++++
 .../__tests__/tournamentScoringContract.test.ts    | 152 +++++++++++++++++++++
 4 files changed, 323 insertions(+)

$ git show --stat d8d2b4e
d8d2b4e Claude AD-19 static check: no screen draws its own + or - glyph outside the shared control, exceptions listed

 .../__tests__/addRemoveGlyphStatic.test.ts         | 79 ++++++++++++++++++++++
 1 file changed, 79 insertions(+)
```
The report commits sit above the code commits (PR 3 has one more report commit than shown, added after this was captured); their own hashes are not self-cited. Cited code hashes d9499a2 and d8d2b4e are reachable from their branch heads as shown.
