# Implementation Report: tl-c-mobile-2

Mobile only. Re-run of PR 2 of tl-c-mobile (the creation wizard), now that the backend create contract is merged, plus the committee invitation accept and decline. Handoff template: `~/meetup/docs/agent-handoff-template.md` (this repo has no copy; `docs/agent-handoff-template.md` does not exist here). Backend read from `pratheeshku/meetup` main at `0109c9b` (read-only clone at `/home/user/meetup`; nothing in it was edited; `~/meetup` itself is not present in this cloud session).

| PR | Branch | Status |
|---|---|---|
| 1 Creation wizard (AD-20) | `claude/confident-mccarthy-72jomw` (code `0be040a`, fix `90f442d`) | **Delivered, with two items not built and reported below (Blocked Reports A and B)** |
| 2 Committee invitation accept / decline | `claude/tl-c-mobile-2-pr2-committee-accept` (code `e178bf0`) | **Partly delivered. The accept screen is BLOCKED (Blocked Report C): no mobile board.** The API, answer states and hook are delivered and tested. |

Both PRs branch from `origin/main` (`882e9ba`). This report is identical on both branches.

## Blocked Reports (an item each, nothing invented)

**A. Accept screen (PR 2): no mobile board.** The task names `NFCommittee`, `TPCommitteeDash` and `WebCommitteeAccept`. I opened all three. `NFCommittee` (390x844) is the Notifications list with one "Committee change / Alicia Lim was added to the committee" row; `TPCommitteeDash` (390x844) is the committee dashboard (Overview, People, Fixtures, Results, Committee tabs, the timeline); neither shows an invitation, an Accept or a Decline. `WebCommitteeAccept` (1280x800) is the only accept layout and is a web page (side rail, a centred card, two right-aligned buttons). The task says: "If a screen has no mobile board, stop and ask for that screen only; do not invent." AGENTS.md says the same. (`docs/INDEX.md` says to build a minimal screen with existing components when no board exists; the task and AGENTS.md are stricter, so I followed them.) **Question for the owner:** is there a mobile board for the accept card (`TPCommitteeAccept` or similar), or should the mobile screen be the web card re-flowed to 390 wide (shield badge, "{organizer} invited you to the committee", the description, a summary card with Sport, Dates and Organizer, a Decline and an "Accept and join committee" button)? Once decided, the screen only has to call `useCommitteeInvitationResponse` (delivered) and show `GET /tournaments/{id}/committee/invitation`.

**B. Group-stage option picker (PR 1): no field carries the choice.** Boards `TournFormatGroups` and `TournFormatGroupsErr` let the organizer choose "4 groups, top 2 qualify" or "8 groups, top 1 qualifies". `POST /tournaments/v2/create` (`WizardCreateBody`, `extra="forbid"`) has no such field, and `overrides` accepts only `entrants_min`, `entrants_max`, `team_size_min`, `team_size_max` (`template_definition.OVERRIDABLE_FIELDS`; `resolve_snapshot` rejects anything else with `OVERRIDE_NOT_LISTED`). The template's `group_stage_options` come back in `GET /tournaments/v2/templates` but nothing in the create contract accepts a selection. So the format step shows the template cards and stops; the per-template option list, "Teams per group 4-5", the knockout bracket card and the placeholder note are not built. **Question for the architect/backend:** how is the group option chosen at create (a new body field, or one option per template)?

**Also not built, same reason (no contract field), listed so nothing is silent:** `TournSched` / `TournSchedErr`: "Courts", "Match length", the changeover note and the Fit check (no `court_count`, no match length in the template summary); `TournSchedWarn` (fit warning). `TournFormatOverrides` (Single elimination match rules: best of, points, third place, extra rules): that is a knockout template and not groups+knockout, and the create body has no such fields. `TournVis` "Invite groups (optional)" button and note under **Public**: the contract accepts `group_ids` only when visibility is `group` (`group_ids is only accepted when visibility is group`). `TournCreated`: the share link, "Share on WhatsApp", "Copy" and "More": the response carries no tournament link and the app has no tournament link to share. `TournReview`: "4 courts", "link", "best of 3 / 3rd place" (no data). `TournBasics`: the "Singles or doubles" hint under the sport (no data).

## 1. Design reference

`DES-MEETUP-ADDENDUM-tournament-lifecycle` v1.4: AD-20 (creation wizard contract), AD-19 (the shared "+" and "-" control), TL-19, TL-78 to TL-86, tests 43 to 50 (client halves). **The `~/meetup` copy of the addendum is byte-identical to `docs/DES-MEETUP-ADDENDUM-tournament-lifecycle.md` here** (`diff -q`: no output), so nothing to follow differently. Backend contract read from `tournaments/create_contract.py`, `tournaments/template_router.py`, `tournaments/committee_invitation.py`, `tournaments/router.py` (accept/decline/invitation, `list_committee_members`, `my_committee_invitation`), `tournaments/service.py::wizard_response`. Web reference: `docs/reports/tl-c-web-report-pr3.md`, `tl-c-accept-report.md`, `frontend/tournament-wizard.js` summary in those reports (I read the reports, not the JS line by line).

### Boards used
Opened, with the screens they drive (390x844 PNG, `~/meetup/docs/design/tournament-lifecycle/`): `TournBasics`, `TournBasicsErr` (step 1); `TournFormat`, `TournFormatEmpty` (step 2); `TournPart`, `TournPartErr`, `TournPartTeam` (step 3); `TournReg`, `TournRegErrGap`, `TournRegErrOrder`, `TournRegErrStart` (step 5); `TournCommittee`, `TournCommitteeAdd`, `TournCommitteeMin` (step 7); `TournReview`, `TournReviewErr`, `TournReviewFail` (step 8); `TournCreated`; `TournDiscard`. **Used but not on your list:** `TournSched`, `TournSchedErr` (step 4, needed for `starts_at`, `ends_at`, venue) and `TournVis`, `TournVisCap` (step 6, needed for visibility and `group_ids`). Opened and not built (Blocked Reports A/B): `TournFormatGroups`, `TournFormatGroupsErr`, `TournFormatOverrides`, `NFCommittee`, `TPCommitteeDash`, `WebCommitteeAccept`. Not opened: `TournSchedWarn`, `TournVisNoResults`, `TournVisPeople`, `TournVisPrivate`, `TournVisSearch`.
**HTML for sizes:** the wizard boards have PNG only (no html in `~/meetup/docs/design/tournament-lifecycle/`); `TournSched*` html exists in this repo (`docs/design-ref-venue/html/`, read earlier for the 46 px field). Layout is built from the existing components (`WizardHeader`, `WizardFooter`, `SelectableCard`, `SegmentedSwitch`, `DateTimePickerField`, `VenuePicker`, `UserSearchPicker`, `GroupInviteList`) and tokens, not measured from the PNG; sizes were not compared against a device render (see Screenshots).

## 2. Traceability map

| Design item | Files | Commit |
|---|---|---|
| AD-20 request body, `client_request_id` once per session, 201 and 200 | `src/types/tournamentWizard.ts`, `src/utils/tournamentWizard.ts` (`buildCreateBody`), `src/api/tournaments.ts` (`createWizardTournament`), `src/screens/TournamentWizardScreen.tsx` (`submit`) | `0be040a` |
| `GET /tournaments/v2/templates`: groups+knockout only, Empty board | `src/utils/tournamentWizard.ts` (`listableTemplates`), `FormatStep.tsx`, `CreateGameScreen.tsx` (`openTournamentEntry`) | `0be040a` |
| Step rules: dates (the five rules, in the server order), counts, committee min and max, cap | `src/utils/tournamentWizard.ts` | `0be040a` |
| Server errors to step and field (`TOURNAMENT_DATES_INVALID`, `GROUP_CAP_EXCEEDED`, `GROUP_NOT_MEMBER`, `COMMITTEE_INVALID`, template and venue codes) | `src/utils/tournamentWizard.ts` (`mapCreateRejection`, `boardStepFor`) | `0be040a`, `90f442d` |
| Eight board steps and Created | `src/components/tournament/wizard/*.tsx`, `src/screens/TournamentWizardScreen.tsx` | `0be040a`, `90f442d` |
| Discard confirmation | `DiscardDialog.tsx`, `TournamentWizardScreen.tsx` (`beforeRemove`) | `0be040a` |
| AD-19 shared control: committee "+"/"-", group "+"/"-", cap | `CommitteeStep.tsx`, `CommitteePicker.tsx`, `VisibilityStep.tsx`, `AddRemoveControl.tsx` (`disabledIds`) | `0be040a` |
| Venue via the existing `VenuePicker` | `WhenWhereStep.tsx` | `0be040a` |
| Labels | `src/labels/defaultLabels.ts`, `scripts/check-labels.allowlist.json` | `0be040a` |
| Navigation and entry | `src/navigation/types.ts`, `RootNavigator.tsx`, `CreateGameScreen.tsx` | `0be040a` |
| PR 2: `my_committee_invitation`, invitation card read, accept, decline, member names | `src/types/tournament.ts`, `src/api/tournaments.ts` | `e178bf0` |
| PR 2: answer states without a crash, one correlation id for answer and refresh | `src/utils/committeeInvitation.ts`, `src/hooks/useCommitteeInvitationResponse.ts` | `e178bf0` |

## 3. Files created / modified / deleted (final)

**PR 1** (28 files vs `origin/main` in `0be040a`; `90f442d` then touches `TournamentWizardScreen.tsx` and its test only): created `src/types/tournamentWizard.ts`, `src/utils/tournamentWizard.ts`, `src/screens/TournamentWizardScreen.tsx`, `src/components/tournament/wizard/{BasicsStep,CommitteePicker,CommitteeStep,CreatedView,DiscardDialog,FormatStep,ParticipationStep,RegistrationStep,ReviewStep,VisibilityStep,WhenWhereStep,parts}.tsx`, `src/test-utils/tournamentWizardFixtures.ts`, tests `src/utils/__tests__/tournamentWizard.test.ts`, `src/api/__tests__/tournamentWizardApi.test.ts`, `src/screens/__tests__/TournamentWizardScreen.test.tsx`, `src/screens/__tests__/CreateTournamentEntry.test.tsx`. Modified `src/api/tournaments.ts`, `src/components/AddRemoveControl.tsx` (`disabledIds`, 4 lines), `src/components/__tests__/addRemoveGlyphStatic.test.ts` (one listed exception: the wizard's count stepper, "not an invite control"), `src/labels/defaultLabels.ts`, `src/navigation/RootNavigator.tsx`, `src/navigation/types.ts`, `src/screens/CreateGameScreen.tsx` (entry), `scripts/check-labels.allowlist.json`. Deleted: none. **The v1 create form is untouched** (a later task removes it).
**PR 2** (8 files): created `src/utils/committeeInvitation.ts`, `src/hooks/useCommitteeInvitationResponse.ts`, tests `src/utils/__tests__/committeeInvitation.test.ts`, `src/hooks/__tests__/useCommitteeInvitationResponse.test.tsx`, `src/api/__tests__/committeeInvitationApi.test.ts`. Modified `src/api/tournaments.ts`, `src/types/tournament.ts`, `src/labels/defaultLabels.ts`. Deleted: none.
`docs/` is not edited (this report and `docs/status/tl-c-mobile-2-status.md` are the two new files under it, as the template requires). No `~/meetup` file edited.

## 4. Commands run, raw output

Machine: Claude cloud container (Linux, Node v22.22.0), `cd /home/user/meetup-mobile && pwd` -> `/home/user/meetup-mobile`. `npm ci` was run once to install `node_modules` (the container had none); no dependency was added or changed.

### PR 1 (`claude/confident-mccarthy-72jomw`)
```
$ npx tsc --noEmit
exit 0
$ npm run check:labels

check-labels: OK - 266 files scanned, 1333 default labels checked.
$ npx eslint <touched files>
exit 0
```
Targeted jest, once on the final code, with coverage (`--collectCoverageFrom` the new and changed source files; the per-test `✓` lines are in the jest output of the run, trimmed here):
```
PASS src/components/__tests__/AddRemoveControl.test.tsx
PASS src/utils/__tests__/tournamentWizard.test.ts
PASS src/components/__tests__/inviteControlsStatic.test.ts
PASS src/api/__tests__/tournamentWizardApi.test.ts
PASS src/screens/__tests__/CreateTournamentEntry.test.tsx
PASS src/components/__tests__/addRemoveGlyphStatic.test.ts
PASS src/api/__tests__/tournaments.test.ts
PASS src/screens/__tests__/TournamentWizardScreen.test.tsx
------------------------------|---------|----------|---------|---------|-------------------------------------------------------------
File                          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s                                           
------------------------------|---------|----------|---------|---------|-------------------------------------------------------------
All files                     |   85.67 |    79.32 |   77.63 |   86.49 |                                                             
 api                          |   48.07 |    87.23 |   57.69 |   47.05 |                                                             
  tournaments.ts              |   48.07 |    87.23 |   57.69 |   47.05 | 162-205,250,338-433                                         
 components                   |   79.16 |    73.41 |   66.66 |   83.58 |                                                             
  AddRemoveControl.tsx        |   79.16 |    73.41 |   66.66 |   83.58 | 93,275-301                                                  
 components/tournament/wizard |   82.55 |    67.64 |   71.64 |   84.89 |                                                             
  BasicsStep.tsx              |   53.33 |       50 |    37.5 |   53.84 | 44-68,96                                                    
  CommitteePicker.tsx         |   71.42 |    66.66 |   55.55 |      90 | 45                                                          
  CommitteeStep.tsx           |   88.88 |       75 |      75 |   88.88 | 61                                                          
  CreatedView.tsx             |     100 |       75 |     100 |     100 | 68                                                          
  DiscardDialog.tsx           |     100 |      100 |     100 |     100 |                                                             
  FormatStep.tsx              |    90.9 |       80 |     100 |    90.9 | 46                                                          
  ParticipationStep.tsx       |   76.92 |       70 |      80 |   76.92 | 39-40,87                                                    
  RegistrationStep.tsx        |     100 |    93.75 |     100 |     100 | 45                                                          
  ReviewStep.tsx              |     100 |    46.15 |     100 |     100 | 14,42-50,70                                                 
  VisibilityStep.tsx          |   86.66 |    77.77 |   71.42 |   91.66 | 65                                                          
  WhenWhereStep.tsx           |   68.75 |    42.85 |   55.55 |   68.75 | 97-110,123                                                  
  parts.tsx                   |      85 |    79.06 |   77.77 |      85 | 132-145                                                     
 screens                      |   89.07 |    77.27 |   82.43 |   89.15 |                                                             
  TournamentWizardScreen.tsx  |   89.07 |    77.27 |   82.43 |   89.15 | 129,137,145,181-185,196,217,257,281-290,354,390-394,437-438 
 utils                        |   96.39 |    91.62 |     100 |   96.31 |                                                             
  tournamentWizard.ts         |   96.39 |    91.62 |     100 |   96.31 | 146,190,206,360,364,483,578                                 
------------------------------|---------|----------|---------|---------|-------------------------------------------------------------

Test Suites: 8 passed, 8 total
Tests:       98 passed, 98 total
Snapshots:   0 total
Time:        3.685 s, estimated 4 s
Ran all test suites matching /src\/utils\/__tests__\/tournamentWizard.test.ts|src\/api\/__tests__\/tournamentWizardApi.test.ts|src\/api\/__tests__\/tournaments.test.ts|src\/screens\/__tests__\/TournamentWizardScreen.test.tsx|src\/screens\/__tests__\/CreateTournamentEntry.test.tsx|src\/components\/__tests__\/addRemoveGlyphStatic.test.ts|src\/components\/__tests__\/AddRemoveControl.test.tsx|src\/components\/__tests__\/inviteControlsStatic.test.ts/i.
```
`npm run lint` (whole repo): `✖ 36 problems (31 errors, 5 warnings)` on `claude/confident-mccarthy-72jomw`, and the same `✖ 36 problems (31 errors, 5 warnings)` on untouched `origin/main`: all pre-existing, none in a touched file (the eslint run on the touched files above exits 0 with no output).

**Pre-existing failure, not mine:** `src/screens/__tests__/CreateGameScreen.test.tsx` fails on untouched `origin/main` and on this branch alike (the test drives a one-page Create Game form; the screen is a six-step wizard). I ran it once with my branch (inside the first targeted run: `Test Suites: 1 failed, 7 passed, 8 total`, `Tests:       37 failed, 71 passed, 108 total`, which includes 71 passing tests from the other 7 files) and once on a stash of my work:
```
Test Suites: 1 failed, 1 total
Tests:       37 failed, 1 passed, 38 total   (src/screens/__tests__/CreateGameScreen.test.tsx on untouched origin/main 882e9ba, node_modules from npm ci)
```
Same 37 failures before and after. I did not touch that file.

### PR 2 (`claude/tl-c-mobile-2-pr2-committee-accept`)
```
$ npx tsc --noEmit
exit 0
$ npm run check:labels

check-labels: OK - 253 files scanned, 1197 default labels checked.
$ npx eslint <touched files>
exit 0
```
```
PASS src/hooks/__tests__/useCommitteeInvitationResponse.test.tsx
PASS src/utils/__tests__/committeeInvitation.test.ts
PASS src/api/__tests__/committeeInvitationApi.test.ts
PASS src/api/__tests__/tournaments.test.ts
------------------------------------|---------|----------|---------|---------|---------------------
File                                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s   
------------------------------------|---------|----------|---------|---------|---------------------
All files                           |    68.6 |     91.3 |   67.64 |   68.23 |                     
 api                                |      50 |    88.23 |   59.25 |   49.05 |                     
  tournaments.ts                    |      50 |    88.23 |   59.25 |   49.05 | 162-205,250,338-433 
 hooks                              |     100 |      100 |     100 |     100 |                     
  useCommitteeInvitationResponse.ts |     100 |      100 |     100 |     100 |                     
 utils                              |     100 |      100 |     100 |     100 |                     
  committeeInvitation.ts            |     100 |      100 |     100 |     100 |                     
------------------------------------|---------|----------|---------|---------|---------------------

Test Suites: 4 passed, 4 total
Tests:       54 passed, 54 total
Snapshots:   0 total
Time:        1.117 s
Ran all test suites matching /src\/utils\/__tests__\/committeeInvitation.test.ts|src\/hooks\/__tests__\/useCommitteeInvitationResponse.test.tsx|src\/api\/__tests__\/committeeInvitationApi.test.ts|src\/api\/__tests__\/tournaments.test.ts/i.
```
`npm run lint`: same `36 problems (31 errors, 5 warnings)` as the base.

Not run (instructed or impossible): the full jest suite; any emulator or device; `npm run android`, `npm run ios`, `npm run build:aab`; any backend call (the backend is not running here; nothing was curled); conformance review; testing-agent dispatch.

## 5. Test coverage

### Coverage delta
| File | Before | After |
|---|---|---|
| `src/utils/tournamentWizard.ts`, `src/screens/TournamentWizardScreen.tsx`, `src/components/tournament/wizard/*`, `src/types/tournamentWizard.ts` | do not exist (0%) | 96.39% / 89.07% / 82.55% statements (table above) |
| `src/api/tournaments.ts` (existing `tournaments.test.ts` only) | 43.75% statements, 86.66% branches | 48.07% / 87.23% with the wizard calls tested (PR 1 run); 50% / 88.23% with the committee calls tested (PR 2 run) |
| `src/components/AddRemoveControl.tsx` | 77.77% / 69.33% | 79.16% / 73.41% |
| `src/utils/committeeInvitation.ts`, `src/hooks/useCommitteeInvitationResponse.ts` | do not exist | 100% / 100% (statements, branches, functions, lines) |
Before-numbers are from a run on a stash of my work (`AddRemoveControl.test.tsx` + `tournaments.test.ts`, `--collectCoverageFrom` the two files). The remaining `tournaments.ts` gap is old code (invites, registrations, closure), not mine.
Not covered in the wizard (see the table): `BasicsStep` sport picker open/choose (lines 44-68), `WhenWhereStep` catalogue branch (the `VenuePicker` catalogue path is exercised by its own tests, not here), `ParticipationStep` fixed-value rows, `CommitteePicker` cap guard. Each is a rendering branch, not a rule.

### Mandated tests (design §9, client halves), each with the test that proves it. All pass (output above).
| Design test | Test (file: name) |
|---|---|
| 43 dates: one case per rule in order, boundary passes, lower rule wins | `tournamentWizard.test.ts`: "the five date rules ... in the server order" (rules 1 to 5, "when two rules fail the lower-numbered one is returned", "the exact boundary passes") |
| 43 server `TOURNAMENT_DATES_INVALID` shows on the right step and field | `tournamentWizard.test.ts`: "server rejections map ..." (6 field/reason cases); `TournamentWizardScreen.test.tsx`: "TOURNAMENT_DATES_INVALID returns to Registration ..." |
| 44/45 groups: cap enforced, only own groups, `group_ids` only for `group` | `TournamentWizardScreen.test.tsx`: "step 6: private with groups, and the cap turns the other + off"; `tournamentWizard.test.ts`: "visibility mapping", "group visibility carries group_ids" and "has exactly the contract fields" (no `group_ids` otherwise) |
| 46 committee: organizer pinned, at least one more, max, "+"/"-" | `TournamentWizardScreen.test.tsx`: "step 7 needs one more committee person ..."; `tournamentWizard.test.ts`: "committee: at least one besides the organizer, at most committee_max - 1" |
| 47 nothing created on failure; state kept | `TournamentWizardScreen.test.tsx`: "a dropped connection keeps everything ...", the three server-error tests ("state intact") |
| 48 client half: one `client_request_id` per session, reused on retry; 201 and 200 | `TournamentWizardScreen.test.tsx`: "a dropped connection ... retry reuses the same client_request_id", "a replay (200) is also success"; `tournamentWizardApi.test.ts`: "201 is a new tournament, 200 is the replay" |
| 48 submit disabled in flight, one request | `TournamentWizardScreen.test.tsx`: "a second tap while the request is in flight sends nothing" |
| 49 client half: stale group or user returns to that step, other state intact | `TournamentWizardScreen.test.tsx`: "COMMITTEE_INVALID USER_UNAVAILABLE ...", "GROUP_NOT_MEMBER ..." |
| 50 review shows every value, Edit returns with state kept | `TournamentWizardScreen.test.tsx`: "Edit on the review returns to that step ...", "sends one request with the contract body ..." (review text) |
| 50 only server templates, groups+knockout only, Empty board | `tournamentWizard.test.ts`: "lists only groups and knockout templates"; `TournamentWizardScreen.test.tsx`: "step 2 lists only ...", "step 2 with no template shows the empty board ..." |
| Entry: wizard when published, v1 form otherwise (empty list, other formats, failed call) | `CreateTournamentEntry.test.tsx` (4 cases) |
| Discard | `TournamentWizardScreen.test.tsx`: "leaving a started wizard asks first ...", "an untouched wizard leaves without asking" |
| 51 AD-19 static check still passes with the new stepper listed | `addRemoveGlyphStatic.test.ts` (3 tests, pass) |
| TL-19 accept/decline: states, one correlation id, no crash, names by name | `committeeInvitation.test.ts`, `useCommitteeInvitationResponse.test.tsx`, `committeeInvitationApi.test.ts` (PR 2 raw output above) |
| Labels | `npm run check:labels` OK on both branches |
Test 52 and tests 43 to 49 server halves are backend tests (out of scope here). Not tested: a real device, a real backend, the catalogue `VenuePicker` inside the wizard.

## Silent items I hit
1. **No mobile board for the accept screen** (Blocked Report C above).
2. **Accept and decline take no `client_request_id`.** The task says "call accept or decline with a client request id". The routes (`tournaments/router.py`) take no body and no id; the server makes the answer once (`UPDATE ... WHERE status = 'invited'`) and refuses a second with a coded 409. I sent nothing extra (no invented field) and used one `withCorrelationId()` id for the answer and the refresh. If you want a request id on these routes, the backend needs the field first.
3. **An invited person cannot list the committee.** `GET /tournaments/{id}/committee/members` returns `[]` unless the caller is an ACTIVE member, so names from "the committee members response display_name" are not available before accepting. The accept card's names come from `GET .../committee/invitation` (`organizer_name`). Names after accepting (and for any active member) come from the members route; `committeeNames` shows the `display_name`, a neutral label when it is missing, and never an id.
4. **An invited person may not be able to view the tournament**, so `GET /tournaments/{id}` may 404 for them (the web card handles "a tournament the user cannot view" through the summary route). The hook's refresh callback is supplied by the screen; a 404 on that re-read is swallowed, not thrown.
5. **"Already declined" and "removed" are one code.** A decline and an organizer withdrawal both set the row to `removed`; the server answers `committee_invitation_closed` for both. One state, one message.
6. **Boards are eight steps, AD-20 is seven.** The boards (Format is step 2; Schedule, Registration and Visibility are separate) and AD-20's text (steps 1 to 7) disagree. AD-20's own note says the wizard boards are "not redrawn until the owner confirms" and the text governs, but your task lists the steps in board order (Basics, Format, Participation, Registration, Committee, Review). I followed the boards' eight-step order and translate the server's `step` (AD-20 numbering: 1 basics+venue, 2 participation, 3 dates, 4 groups, 5 format, 6 committee) to a board step. Flagged because AGENTS.md says to stop when board and design disagree; I judged the task's own ordering as the instruction.
7. **Board "Public / Private" versus the contract's `public / group / invite`.** I map Private with at least one group to `group`, Private with none to `invite`. That uses only existing contract values. If "Private" should mean something else, this is one line (`visibilityOf`).
8. **Board "Registration opens: Today"** is shown as read-only text: AD-20 says registration opens at creation (DB `now()`), and the contract has no field.
9. **Board vs glossary.** The boards say "committee member" and "Players per team", "Minimum teams"; `docs/glossary.json` bans bare "member" and "team". I reworded the team wording to the glossary (tournament team, team player) and kept the board wording for the ten "committee member" labels, each listed in `scripts/check-labels.allowlist.json` with a reason (the check's own exclusion mechanism). Owner decision needed: does the glossary gain "committee member"? (docs/ not edited.)
10. **Templates are not per sport.** `template_summary` carries no sport, so the Format list is the same for every sport, and the Empty board's "No formats are available for {sport} yet" names the selected sport although the server did not filter by it.
11. **Time zone.** Dates are entered in the device's local time and sent as instants. The server derives the daily playing window in `HOME_TIMEZONE` (Asia/Singapore). On a device in another zone the "Daily playing hours" shown on step 4 (device local) differ from the window the server stores. The web wizard works around it by entering times in the server zone; mobile has no timezone library and I did not add one (STACK-GOTCHAS: dependencies are a decision).
12. **Entry rule when the list has formats but none are groups+knockout.** The wizard opens only when at least one groups+knockout template is listed; otherwise the v1 form stays reachable exactly as today (also for an empty list, a failed call, or the flag off). So the Empty board is reachable only when the list empties while the wizard is open (a format retired mid-edit), not from the entry. I read "keep the v1 path reachable" as taking precedence at the entry, because opening an Empty board while the v2 flag is off would block all tournament creation.
13. **The committee field name.** The task and AD-20's text say `committee_user_ids`; `WizardCreateBody` names it `committee_member_ids` and accepts both (`AliasChoices`). I send `committee_member_ids`.
14. **The create route.** AD-20's text says `POST /tournaments`; the merged route is `POST /tournaments/v2/create` (the task names it). Used the merged route.
15. **Tournament form sizes.** The wizard step headers use `WizardHeader` as the Create Game flow does; I did not measure fields against the PNG (`TournSched.html` is 46 px for the venue field; `TextField` is the app's standard height).
16. **`docs/label-inventory-mobile.json`** (the mirror the `defaultLabels.ts` header mentions) is not updated: `docs/` is not edited. No test reads it.
17. **Pre-existing:** `CreateGameScreen.test.tsx` (37 failures on untouched main), the repo's 31 lint errors.

## Values I chose (the boards or the design do not fix them)
- Wizard step order and count: the boards' eight (item 6). Progress bar and "Step n of 8" come from the shared `WizardHeader`.
- Count steppers: start at the template's own value, move by 1 inside the template's override limits (`organizer_overrides`); a count the template does not list is shown locked, not editable; only fields the organizer changed from the template value travel as `overrides`.
- In team mode "Minimum teams / Maximum teams" map to `entrants_min / entrants_max`, and "Minimum / Maximum team players" to `team_size_min / team_size_max`.
- The hard block follows the soft block until the organizer sets it (AD-20); the date fields are the shared date-time picker (date and time) for start, end, soft and hard block.
- Group list: `GET /groups` mine (`getMyGroups`), client-side name filter, the cap from `limits.audience_group_cap` (20 if absent), at the cap the other rows' "+" is off and the board's error shows.
- Committee: at most `limits.committee_max - 1` additional people (9 if the server sends no limits); the add picker stages people and applies them with "Add 1 member" / "Add n members".
- When the server says the format was retired: stay on Review with the board banner, clear the format, re-read the list, and send the next "Create tournament" to the Format step.
- Gap wording: "{n} days" when the minimum gap is a whole number of days, otherwise hours; shown before the server is asked, from `limits.min_gap_hours` (72 if absent).
- Discard: the Android back and the navigation `beforeRemove` ask once something is entered (any step); the header arrow goes back one step and, on step 1, leaves (asking if dirty).
- Created screen: the title, "Registration is open until {date}", the three next steps from the response dates, a note when committee people were invited, and "Open tournament" (Games tab, tournament detail).
- Fallbacks if the server omits `limits`: cap 20, committee max 10, gap 72 hours (the backend's own defaults, `create_contract.DEFAULT_*`).
- Branch names: `claude/confident-mccarthy-72jomw` (the session's designated branch) for PR 1 and `claude/tl-c-mobile-2-pr2-committee-accept` for PR 2.
- No version numbers were chosen or changed.

## Screenshots next to each board
**None.** This is a cloud container with no Android emulator, iOS simulator or device, and the app (bare React Native) does not run in a browser without a dependency I may not add. Screens were exercised with `react-test-renderer` only (output above). Device sizes the boards use: mobile 390x844, `WebCommitteeAccept` 1280x800. The owner can produce them with `npm run android` on a 390x844 emulator: Home, Create (+), Tournament, then each step. The board-versus-build comparison is therefore **not done**; "UI work must match its board" is unverified on a device.

## 6. Proposed Assumptions
Numbered items 6, 7, 8, 10, 11, 12 of "Silent items" are the LOW/MEDIUM readings I took; items 1, 2 and Blocked Reports A and B are the CRITICAL/HIGH gaps I stopped on and did not fill. (2 changed nothing in the contract.)

## 7. Deviations from instructions
1. Two PRs, not three: PR 2's accept screen is not built (Blocked Report A), so PR 2 is the layer under it.
2. Boards used beyond the list (`TournSched*`, `TournVis`, `TournVisCap`), because the contract needs `starts_at`, `ends_at`, the venue, visibility and `group_ids`.
3. Board elements without a contract field are not built (list above).
4. `scripts/check-labels.allowlist.json` is edited (ten reasoned `banned-term` entries). It is the check's documented exclusion file, not `docs/`.
5. `AddRemoveControl.tsx` (shared component) gets a 4-line optional `disabledIds` prop for the cap, and `addRemoveGlyphStatic.test.ts` lists the wizard's count stepper as an exception, as the earlier NumberField stepper is.
6. `~/meetup` and `~/Developer/meetup-mobile` are not present; the work is in `/home/user/meetup-mobile` and the backend is read from a read-only clone. The session's default attribution reminder was not applied: your rule (no Co-Authored-By or AI attribution) overrides it.
7. jest was run in a few batches while building (a first run exposed a wrong expectation in my own date-boundary test; fixed); the final numbers above are from one clean run per PR on the final code.

## 8. Self-declared confidence per item
| Item | Level | Evidence |
|---|---|---|
| Wizard logic: step rules, five date rules, body, error mapping | **Done and verified** | `tournamentWizard.test.ts` (96% lines), output above |
| Wizard screens (eight steps, Created, Discard), flows and server errors | **Done and verified at test-renderer level** | `TournamentWizardScreen.test.tsx` (19 tests) |
| Entry: wizard vs v1 form | **Done and verified** | `CreateTournamentEntry.test.tsx` |
| Match to the boards (look, sizes, colours, spacing) | **Done, not verified** | no device render (Screenshots) |
| Catalogue `VenuePicker` inside the wizard | **Done, not verified** | covered only by its own tests; the wizard tests run with the catalogue off |
| Against the real backend | **Done, not verified** | body built from `WizardCreateBody`; no call made |
| Format step group-option picker | **Attempted, blocked** | Blocked Report B |
| Accept screen | **Attempted, blocked** | Blocked Report A |
| Accept/decline API, answer states, hook, names | **Done and verified** | the three new PR 2 test files, 100% on the two new source files |
| Labels | **Done and verified** (check passes) | seed still needed |

## 9. Known gaps / follow-ups
- Owner: mobile board for the accept card, or approval to re-flow the web card (Blocked Report A).
- Backend/architect: how the group-stage option is chosen at create (Blocked Report B); whether the create response should carry a tournament link for the Created screen's share row; whether "committee member" joins the glossary.
- Screenshots next to the boards (needs a device).
- Architect: meetup-repo label seed task for the keys below.
- The v1 form is still live behind the flag-off/empty path; a later task removes it.
- PR 2 hook is not wired to a screen yet (no screen).
- Time zone item 11 if non-SGT devices matter.

## Labels needing a backend seed
New keys added by this task (152) plus the five unseeded AD-19 keys from the earlier report. Names follow the existing `mob.<screen>.<key>` pattern (`mob.tw.*`: tournament wizard; `mob.committee_invite.*`: committee invitation states).

### PR 1: wizard (144 keys, `src/labels/defaultLabels.ts`)

| Key | Default text |
|---|---|
| `mob.tw.title` | Create tournament |
| `mob.tw.step_basics` | Tournament basics |
| `mob.tw.step_format` | Choose a format |
| `mob.tw.step_participation` | Who plays? |
| `mob.tw.step_when` | When and where |
| `mob.tw.step_registration` | Registration dates |
| `mob.tw.step_visibility` | Who can see it? |
| `mob.tw.step_committee` | Committee |
| `mob.tw.step_review` | Review |
| `mob.tw.submit` | Create tournament |
| `mob.tw.loading` | Loading formats |
| `mob.tw.sport` | Sport |
| `mob.tw.sport_change` | Change sport |
| `mob.tw.name` | Tournament name |
| `mob.tw.name_placeholder` | e.g. Punggol Open 2026 |
| `mob.tw.description` | Description (optional) |
| `mob.tw.err_sport` | Choose a sport. |
| `mob.tw.err_title` | Enter a name for the tournament. |
| `mob.tw.err_title_long` | The name can be at most {max} characters. |
| `mob.tw.err_description_long` | The description can be at most {max} characters. |
| `mob.tw.format_note` | Formats are set up by platform admins. Retired formats are not listed. |
| `mob.tw.format_tag_group` | Group stage |
| `mob.tw.format_tag_entrants` | {min} to {max} |
| `mob.tw.format_tag_version` | v{version} |
| `mob.tw.format_empty_banner` | No formats are available for {sport} yet. Ask a platform admin to publish a format template. |
| `mob.tw.format_empty_title` | No formats for this sport |
| `mob.tw.format_empty_sub` | Formats are managed in the admin console. |
| `mob.tw.format_load_error` | Could not load the formats. Please try again. |
| `mob.tw.format_a11y` | {name}, version {version} |
| `mob.tw.err_format` | Choose a format. |
| `mob.tw.err_format_retired` | The "{name} v{version}" format was retired while you were editing. Choose the current version to continue. |
| `mob.tw.part_individual` | Individual |
| `mob.tw.part_team` | Tournament team |
| `mob.tw.part_players_section` | Players |
| `mob.tw.part_teams_section` | Tournament teams |
| `mob.tw.part_min_players` | Minimum players |
| `mob.tw.part_max_players` | Maximum players |
| `mob.tw.part_min_teams` | Minimum tournament teams |
| `mob.tw.part_max_teams` | Maximum tournament teams |
| `mob.tw.part_team_min` | Minimum team players |
| `mob.tw.part_team_max` | Maximum team players |
| `mob.tw.part_template_allows` | Template allows {min} to {max} |
| `mob.tw.part_set_by_format` | Set by the format |
| `mob.tw.part_locked_note` | Participation is fixed once the tournament is created. |
| `mob.tw.part_team_note` | Players create a tournament team when they register, or pick one they already belong to. |
| `mob.tw.err_count_required` | Enter a number. |
| `mob.tw.err_count_range` | Use a number from {min} to {max}. |
| `mob.tw.err_players_order` | Maximum players cannot be less than the minimum. |
| `mob.tw.err_teams_order` | Maximum tournament teams cannot be less than the minimum. |
| `mob.tw.err_team_size_order` | Maximum team players cannot be less than the minimum. |
| `mob.tw.err_overrides` | These numbers are outside what the format allows. Check them and try again. |
| `mob.tw.window_section` | Tournament window |
| `mob.tw.starts` | Starts |
| `mob.tw.ends` | Ends |
| `mob.tw.pick_date` | Choose date and time |
| `mob.tw.daily_hours` | Daily playing hours |
| `mob.tw.daily_hours_value` | {start} to {end} |
| `mob.tw.daily_hours_empty` | Set by the start and end times |
| `mob.tw.venue` | Venue |
| `mob.tw.venue_name` | Venue name |
| `mob.tw.venue_address` | Venue address (optional) |
| `mob.tw.when_footer` | Match times are suggested after fixtures are generated. You can edit each one. |
| `mob.tw.err_window` | The end must be after the start, and the start must be in the future. |
| `mob.tw.err_daily_window` | The daily end time must be after the daily start time. |
| `mob.tw.err_venue` | Choose a venue. |
| `mob.tw.err_required` | Choose a date and time. |
| `mob.tw.reg_section` | Registration |
| `mob.tw.reg_opens` | Registration opens |
| `mob.tw.reg_opens_today` | Today, {date} |
| `mob.tw.reg_soft` | Soft block (registration closes) |
| `mob.tw.reg_soft_help` | Players can no longer register themselves after this date. The committee can still add players one by one. |
| `mob.tw.reg_hard` | Hard block (roster frozen) |
| `mob.tw.reg_hard_help` | After this date nobody can be added, changed or withdrawn. |
| `mob.tw.reg_means` | What this means |
| `mob.tw.reg_tl_opens` | Registration opens |
| `mob.tw.reg_tl_soft` | Soft block: self-registration ends |
| `mob.tw.reg_tl_hard` | Hard block: roster frozen, fixtures can be generated |
| `mob.tw.reg_tl_start` | Tournament starts |
| `mob.tw.reg_tl_unset` | — |
| `mob.tw.err_reg_past` | Registration dates must be in the future. |
| `mob.tw.err_soft_after_hard` | Soft block must be on or before the hard block. |
| `mob.tw.err_hard_after_start` | Hard block must be before the tournament starts. |
| `mob.tw.err_hard_gap_days` | Hard block must be at least {gap} days before the start ({start}). |
| `mob.tw.err_hard_gap_hours` | Hard block must be at least {gap} hours before the start ({start}). |
| `mob.tw.vis_public` | Public |
| `mob.tw.vis_public_sub` | Listed for everyone. Anyone can register. |
| `mob.tw.vis_private` | Private |
| `mob.tw.vis_private_sub` | Only people who are invited or have the link. |
| `mob.tw.vis_groups` | Invite groups |
| `mob.tw.vis_groups_count` | {count} of {cap} |
| `mob.tw.vis_groups_search` | Search your groups |
| `mob.tw.vis_groups_none` | You are not in any groups yet. |
| `mob.tw.vis_groups_no_match` | No groups match. |
| `mob.tw.vis_groups_load_error` | Could not load your groups. Please try again. |
| `mob.tw.vis_group_members` | {count} group members |
| `mob.tw.err_group_cap` | A tournament can be shared with up to {cap} groups in total, including groups invited later. |
| `mob.tw.err_group_not_member` | You are no longer in one of the selected groups. It was removed from the list. |
| `mob.tw.committee_you` | You |
| `mob.tw.committee_you_sub` | Organizer · counts as 1 |
| `mob.tw.committee_creator` | Creator |
| `mob.tw.committee_member` | Committee member |
| `mob.tw.committee_add` | Add committee member |
| `mob.tw.committee_search` | Search people |
| `mob.tw.committee_add_one` | Add 1 member |
| `mob.tw.committee_add_many` | Add {count} members |
| `mob.tw.committee_info` | Two committee members must approve fixtures, final standings, disqualifications, dissolution and committee changes. Score entry needs one. |
| `mob.tw.committee_remove_a11y` | Remove {name} from the committee |
| `mob.tw.err_committee_few` | A tournament needs at least 2 committee members. Add one more to continue. |
| `mob.tw.err_committee_many` | A committee has at most {max} members including you. |
| `mob.tw.err_committee_duplicate` | A committee member is listed twice. |
| `mob.tw.err_committee_is_organizer` | You are already on the committee. |
| `mob.tw.err_committee_unavailable` | One of the people you added is not available any more. They were removed from the list. |
| `mob.tw.review_name` | Name |
| `mob.tw.review_format` | Format |
| `mob.tw.review_players` | Players |
| `mob.tw.review_window` | Window |
| `mob.tw.review_block` | Soft / hard block |
| `mob.tw.review_visibility` | Visibility |
| `mob.tw.review_committee` | Committee |
| `mob.tw.review_format_value` | {name} · v{version} |
| `mob.tw.review_individuals` | Individuals · {min} to {max} |
| `mob.tw.review_teams` | Tournament teams · {min} to {max} · {sizeMin} to {sizeMax} team players |
| `mob.tw.review_window_value` | {start} to {end} · {venue} |
| `mob.tw.review_block_value` | {soft} / {hard} |
| `mob.tw.review_public` | Public |
| `mob.tw.review_private_groups` | Private · {count} groups |
| `mob.tw.review_private` | Private |
| `mob.tw.review_edit_a11y` | Edit {section} |
| `mob.tw.review_accept_note` | People you add to the committee must accept before they can act. Until two members are active, fixtures cannot be uploaded or published. |
| `mob.tw.err_create_failed` | Could not create the tournament. Check your connection and retry. |
| `mob.tw.err_disabled` | Tournament creation with formats is not available right now. Go back and use the standard form. |
| `mob.tw.discard_title` | Discard this tournament? |
| `mob.tw.discard_body` | Your answers so far will be lost. Nothing has been created yet. |
| `mob.tw.discard` | Discard |
| `mob.tw.keep_editing` | Keep editing |
| `mob.tw.created_title` | {title} is live |
| `mob.tw.created_sub` | Registration is open until {date}. |
| `mob.tw.created_next` | What happens next |
| `mob.tw.created_next_register` | Players register until the soft block |
| `mob.tw.created_next_register_when` | Now to {date} |
| `mob.tw.created_next_roster` | Roster frozen, then generate fixtures |
| `mob.tw.created_next_start` | Tournament starts |
| `mob.tw.created_committee_note` | Committee members you invited join when they accept. |
| `mob.tw.created_open` | Open tournament |

### PR 2: committee invitation states (8 keys; the copy is proposed, there is no board for it)

| Key | Default text |
|---|---|
| `mob.committee_invite.already_active` | You are already on this committee. |
| `mob.committee_invite.closed` | This committee invitation is no longer open. |
| `mob.committee_invite.not_invited` | You have no committee invitation for this tournament. |
| `mob.committee_invite.cancelled` | This tournament was cancelled. |
| `mob.committee_invite.ended` | This tournament has ended, so the committee can no longer change. |
| `mob.committee_invite.disabled` | Committee invitations are not available right now. Please try again later. |
| `mob.committee_invite.failed` | Could not send your answer. Please try again. |
| `mob.committee_invite.unknown_person` | A committee person |

### Still unseeded from tl-c-mobile PR 3 (5 keys, unchanged)

| Key | Text |
|---|---|
| `mob.add_remove.invite_a11y` | Invite {name} |
| `mob.add_remove.remove_a11y` | Remove {name} |
| `mob.add_remove.sending_a11y` | Sending invitation to {name} |
| `mob.add_remove.sent` | Invited |
| `mob.add_remove.error` | Could not send the invitation. Try again. |

## Git evidence
(generated last, after the final code commits; the report commits sit above these and are not self-cited)
```
$ git log --oneline origin/main..claude/confident-mccarthy-72jomw
90f442d Wizard: retired-format banner on Review as on board TournReviewErr; next Create returns to Format
0be040a Tournament creation wizard (AD-20): eight board steps, POST /tournaments/v2/create, field errors, discard dialog

$ git show --stat --format='%h %s' 0be040a 90f442d
0be040a Tournament creation wizard (AD-20): eight board steps, POST /tournaments/v2/create, field errors, discard dialog

 scripts/check-labels.allowlist.json                |  60 ++
 src/api/__tests__/tournamentWizardApi.test.ts      |  50 ++
 src/api/tournaments.ts                             |  30 +
 src/components/AddRemoveControl.tsx                |   5 +-
 .../__tests__/addRemoveGlyphStatic.test.ts         |   1 +
 src/components/tournament/wizard/BasicsStep.tsx    | 125 +++++
 .../tournament/wizard/CommitteePicker.tsx          |  60 ++
 src/components/tournament/wizard/CommitteeStep.tsx | 106 ++++
 src/components/tournament/wizard/CreatedView.tsx   |  91 +++
 src/components/tournament/wizard/DiscardDialog.tsx |  48 ++
 src/components/tournament/wizard/FormatStep.tsx    | 101 ++++
 .../tournament/wizard/ParticipationStep.tsx        | 102 ++++
 .../tournament/wizard/RegistrationStep.tsx         | 119 ++++
 src/components/tournament/wizard/ReviewStep.tsx    | 119 ++++
 .../tournament/wizard/VisibilityStep.tsx           | 126 +++++
 src/components/tournament/wizard/WhenWhereStep.tsx | 145 +++++
 src/components/tournament/wizard/parts.tsx         | 214 +++++++
 src/labels/defaultLabels.ts                        | 144 +++++
 src/navigation/RootNavigator.tsx                   |   6 +
 src/navigation/types.ts                            |   6 +
 src/screens/CreateGameScreen.tsx                   |  31 +-
 src/screens/TournamentWizardScreen.tsx             | 558 ++++++++++++++++++
 .../__tests__/CreateTournamentEntry.test.tsx       |  68 +++
 .../__tests__/TournamentWizardScreen.test.tsx      | 387 +++++++++++++
 src/test-utils/tournamentWizardFixtures.ts         |  62 ++
 src/types/tournamentWizard.ts                      | 113 ++++
 src/utils/__tests__/tournamentWizard.test.ts       | 306 ++++++++++
 src/utils/tournamentWizard.ts                      | 623 +++++++++++++++++++++
 28 files changed, 3802 insertions(+), 4 deletions(-)
90f442d Wizard: retired-format banner on Review as on board TournReviewErr; next Create returns to Format

 src/screens/TournamentWizardScreen.tsx                | 11 ++++-------
 src/screens/__tests__/TournamentWizardScreen.test.tsx |  9 +++++++--
 2 files changed, 11 insertions(+), 9 deletions(-)

$ git log --oneline origin/main..claude/tl-c-mobile-2-pr2-committee-accept
e178bf0 Committee invitation accept/decline: API, answer states and hook (accept screen not built: no mobile board)

$ git show --stat --format='%h %s' e178bf0
e178bf0 Committee invitation accept/decline: API, answer states and hook (accept screen not built: no mobile board)

 src/api/__tests__/committeeInvitationApi.test.ts   |  51 +++++++++
 src/api/tournaments.ts                             |  43 ++++++++
 .../useCommitteeInvitationResponse.test.tsx        | 120 +++++++++++++++++++++
 src/hooks/useCommitteeInvitationResponse.ts        |  68 ++++++++++++
 src/labels/defaultLabels.ts                        |   8 ++
 src/types/tournament.ts                            |  34 ++++++
 src/utils/__tests__/committeeInvitation.test.ts    |  52 +++++++++
 src/utils/committeeInvitation.ts                   |  65 +++++++++++
 8 files changed, 441 insertions(+)

$ git log -1 --format='%an <%ae>%n%B' 0be040a   # no Co-Authored-By, no AI attribution
Claude <noreply@anthropic.com>
Tournament creation wizard (AD-20): eight board steps, POST /tournaments/v2/create, field errors, discard dialog

Create tournament entry opens the wizard when GET /tournaments/v2/templates lists a groups
and knockout format; otherwise the v1 form is unchanged. One client_request_id per wizard
session, reused on retry; 201 and 200 replay both succeed. Server rejections map to the step
and field the boards show. GroupInviteList gains disabledIds for the group cap.
```
Every cited hash is reachable from its branch head (`git log --oneline origin/main..<branch>` above). `docs/` is unchanged except the two new files of this task; `git diff --stat origin/main -- docs` on each branch shows only them (checked after the report commit).
