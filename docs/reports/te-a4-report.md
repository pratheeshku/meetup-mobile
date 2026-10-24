# Implementation Report: te-a4

Agent: claude-code (claude-sonnet-5-5). Machine: MacBook. Branch `claude/te-a4-mobile` from `origin/main`. Status file: `docs/status/te-a4-status.md`. Raw output: `docs/reports/te-a4-raw-output.txt`. PR: see the end. **Not self-certified.** No screenshots (no simulator); nothing run on a device.

State back: te-a4 polishes the create-tournament wizard per AD-T13: group rows with their size, focus and scroll on every step, one Venue heading, and the Create-game venue block (map preview, optional "Court or hall details" sent as `venue_detail`) shown in the review, the tournament header and the Overview. Create game is untouched.

## 1. Design reference
AD-T13 (source of truth) of `DES-MEETUP-ADDENDUM-tournament-experience` v1.0; te-b6 report (`venue_detail` field, error code `VENUE_DETAIL_TOO_LONG`, labels); te-a1 and te-a3 reports. Reference code: `CreateGameScreen` court field, `VenuePicker`. No boards (AD-T13: none new). Governing docs not edited.

## 2. Traceability map
| Item | Where | Test |
|---|---|---|
| 1 Group rows "(10 members)", "(1 member)", name only when null | `GroupInviteList` (`showMemberCount`, opt-in so other callers are unchanged), `VisibilityStep`; `member_count` was already mapped by `getMyGroups` and typed on `Group` (verified, backend `GroupResponse.member_count`) | TournamentWizardPolish.test |
| 2 Focus on every step change, first error field, scroll to top | `useAccessibilityFocus`/`useTextFocus` (hooks), `firstFocusField` (utils), `TournamentWizardScreen` (`focusToken`, `scrollToTopKey`), each step, `DateTimePickerField`, `SegmentedSwitch`, `SelectableCard`, `AddEntryButton`, `KeyboardAwareScreen` | TournamentWizardPolish.test, tournamentWizard.test |
| 2 Owner's case: "Step 3 of 6" lands at the start date | same; plus the cause below | "When and where: the screen goes to the top ..." |
| 3 One Venue heading | `WhenWhereStep` (second `FieldLabel` removed; kept only when there is no picker) | TournamentWizardPolish.test |
| 4 Venue block, `venue_detail`, `VENUE_DETAIL_TOO_LONG` | `WhenWhereStep`, `tournamentWizard.ts` (`venueDetail`, `VENUE_DETAIL_MAX`, `buildCreateBody`, `mapCreateRejection`), `ReviewStep`, `TournamentDetailV2`, `TournamentOverview`, mapper in `api/tournaments.ts` | TournamentWizardPolish.test, tournamentWizard.test, TournamentDetailV2.test |
| 5 Labels | `src/labels/defaultLabels.ts` | check:labels, Appendix A |

**Cause of the owner's report (When and where lands at Venue).** Two things were found. (a) `KeyboardAwareScreen` is one `ScrollView` for all steps, so the scroll position of the previous step stayed. (b) With the venue catalogue on, `VenuePicker`'s search box has `autoFocus` while no venue is chosen, so the keyboard opened on the venue search as soon as the step appeared. Both are fixed: scroll goes to the top on every step change, and the wizard passes the new `autoFocusSearch={false}` (default true: Create game is unchanged).

## 3. Files created, modified, deleted
Created: src/hooks/useAccessibilityFocus.ts; src/screens/__tests__/TournamentWizardPolish.test.tsx; status, report, raw output.
Modified: src/components/{DateTimePickerField,SegmentedSwitch,SelectableCard,AddRemoveControl,KeyboardAwareScreen}.tsx (additive optional props); src/components/venue/VenuePicker.tsx; src/components/tournament/wizard/{BasicsStep,ParticipationStep,WhenWhereStep,RegistrationStep,VisibilityStep,CommitteeStep,ReviewStep,parts}.tsx; src/screens/TournamentWizardScreen.tsx; src/utils/tournamentWizard.ts; src/types/{tournament,tournamentWizard}.ts; src/api/tournaments.ts; src/components/tournament/v2/{TournamentDetailV2,TournamentOverview}.tsx; src/labels/defaultLabels.ts; scripts/check-labels.allowlist.json; tests src/utils/__tests__/tournamentWizard.test.ts, src/screens/__tests__/TournamentDetailV2.test.tsx.
Deleted: none. Not touched: `CreateGameScreen`. Not mine and not staged: `android/version.properties`.

## 4. Commands run, raw output
Every command from `cd ~/Developer/meetup-mobile && pwd`. Full output in the raw file.
| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint <the 26 changed ts and tsx files>` | exit 0 |
| `npm run check:labels` | exit 1, 7 problems, the same 7 stale-allowlist entries as `origin/main` (my first run showed 2 banned-term hits on the new rows, see section 7.4) |
| `npm run lint` | exit 1, 32 problems (31 errors, 1 warning), identical to `origin/main` |
| scoped `npx jest`, 22 files, with coverage, one invocation | 20 suites passed, 2 failed (`keyboardInventory.test.ts` 3 tests and `CreateGameScreen.test.tsx` 37 tests, both failing identically on clean `origin/main`); 336 tests: 296 passed, 40 failed (the same 40) |
| same list on clean `origin/main` (new test file left out) | 2 suites failed, 40 tests failed (the same two files), 281 passed |
| `HomeScreen.test.tsx` + `EventDetailScreen.test.tsx`, `origin/main` and branch | both 64 failed, 26 passed |
**Baseline failures, reported separately and none new:** Home and EventDetail tests (64), `keyboardInventory.test.ts` (3), `CreateGameScreen.test.tsx` (37; not in your list, found because the Create game screen shares the picker: same count on `origin/main`), lint (31 errors, 1 warning), check:labels (7).
Jest was run more than once: the wizard tests after my changes (all passed), the new test file while I built it (6 of 11 failed first: my test doubles, a focus-handle mock and a `style` lookup; fixed), the one scoped run above, the baseline worktree, and a last re-run of the two wizard test files after adding the no-catalogue heading (34 passed).

## 5. Test coverage (statements %, touched files; before = `origin/main`, after = this branch)
| File | Before | After |
|---|---|---|
| ALL | 86.75 | 88.01 |
| api/tournaments.ts | 73.73 | 73.73 |
| components/AddRemoveControl.tsx | 79.45 | 81.01 |
| components/DateTimePickerField.tsx | 100.0 | 100.0 |
| components/KeyboardAwareScreen.tsx | 98.0 | 98.14 |
| components/SegmentedSwitch.tsx | 100.0 | 100.0 |
| components/SelectableCard.tsx | 100.0 | 100.0 |
| components/tournament/v2/TournamentDetailV2.tsx | 88.88 | 89.04 |
| components/tournament/v2/TournamentOverview.tsx | 92.72 | 92.72 |
| components/tournament/wizard/BasicsStep.tsx | 61.9 | 64.0 |
| components/tournament/wizard/CommitteePicker.tsx | 71.42 | 71.42 |
| components/tournament/wizard/CommitteeStep.tsx | 88.88 | 88.88 |
| components/tournament/wizard/CreatedView.tsx | 100.0 | 100.0 |
| components/tournament/wizard/DiscardDialog.tsx | 100.0 | 100.0 |
| components/tournament/wizard/ImagesCard.tsx | 81.25 | 81.25 |
| components/tournament/wizard/ParticipationStep.tsx | 100.0 | 100.0 |
| components/tournament/wizard/RegistrationStep.tsx | 100.0 | 100.0 |
| components/tournament/wizard/ReviewStep.tsx | 100.0 | 100.0 |
| components/tournament/wizard/VisibilityStep.tsx | 86.66 | 86.66 |
| components/tournament/wizard/WhenWhereStep.tsx | 68.75 | 83.33 |
| components/tournament/wizard/parts.tsx | 60.0 | 65.21 |
| components/venue/VenuePicker.tsx | 75.32 | 75.32 |
| hooks/useAccessibilityFocus.ts | new | 100.0 |
| screens/TournamentWizardScreen.tsx | 88.12 | 90.51 |
| utils/tournamentWizard.ts | 97.0 | 97.19 |
Not exercised: the real keyboard and screen reader (doubles: `focus()` on the text input, `setAccessibilityFocus`), the static map image with a real key (the placeholder path is tested).

## 6. What each requirement is proven by
- Group rows: three groups with counts 10, 1 and null read "Punggol Smashers (10 members)", "Weekend Warriors (1 member)", "Tue Tennis".
- "Step 3 of 6": after Next from Participation the scroll view is told to go to y 0, the start date has the ring and the screen-reader focus, no picker opens, and neither the venue name nor the court field is focused.
- Every step: Basics (name, keyboard), Participation (selected segment), When (start date), Registration (soft block), Who can see it (selected card), Committee (add row), Review (heading), on Next and on Back (the scroll test); a step with an error focuses its first field with an error (name; end date before start date; the venue message).
- Venue: one heading with and without the catalogue; map preview placeholder after choosing a venue (picker variant is no longer the compact one); court field optional, trimmed, omitted when empty, 100 limit with the new text; `VENUE_DETAIL_TOO_LONG` returns to "Step 3 of 6" with the message and focuses the court field; review shows "Venue, Court 2"; header and Overview show it, hidden when null or blank.

## 7. Silent items and deviations
1. **First field per step.** Basics: the name field (the images card and the pre-filled sport row come first on screen but are optional or already answered); an error on the sport row takes the ring instead. Participation: the selected segment. Who can see it: the selected Public or Private card. Committee: the "Add" entry. Review: the heading (it has no fields). The wizard does not move focus on first open, only on a step change.
2. **A date, choice or add field gets a 2 px primary-colour ring** (theme tokens) and screen-reader focus; the ring clears when the control is pressed or loses focus. The venue error has no field to ring: its message gets the screen-reader focus.
3. **Venue block look.** The wizard now uses the picker's standard state (the one Create game uses, with the map card) instead of the compact "tournament" variant that the earlier board TournSched drew. AD-T13 asks for "like Create game" and the map; the old compact variant has no map. The map needs the key from `getClientConfig`; without it the picker's own placeholder shows.
4. **Glossary.** The row text "(10 members)" is the addendum's wording ("Members is correct here"); `check:labels` bans a bare "member", so two allowlist entries (with the reason) were added to `scripts/check-labels.allowlist.json`. That file is not a design doc.
5. **Catalogue off.** The plain venue name and address fields stay, with one "Venue" heading (drawn by the wizard, because the picker is absent) and the court field below. No map there (no coordinates).
6. **Coordinates** of the chosen venue are kept in the wizard state only for the map; they are never sent. The "Others" venue path is unchanged and passes its coordinates the same way.
7. **Two keys seeded by te-b6 are bundled with their exact text** (`mob.tw.err_venue_detail_too_long`); `mob.create_game.court_details_*` already existed. The server's `venue_detail` is trimmed on read and treated as none when blank.
8. No screenshots; the keyboard, screen-reader behaviour and the map are not verified on a device.

## 8. Self-declared confidence
- Group rows, `venue_detail` (request, error, review, header, Overview), one heading: **Done and verified** by tests; real backend **not verified**.
- Focus and scroll on all seven screens: **Done and verified** with doubles; real keyboard, VoiceOver and TalkBack **not verified**.
- Map preview: **Done**, placeholder path verified; real map image not verified.

## 9. Known gaps and follow-ups
- Device pass: keyboard on every step, VoiceOver and TalkBack focus, the map with a key, Android back.
- Seed the two new keys (Appendix A).
- `CreateGameScreen.test.tsx` fails 37 tests on `origin/main`: a separate task.
- Same baseline failures as te-a3.

## Drift found
- `docs/reports/te-b6-report.md` and AD-T13 agree with the code; the older board TournSched draws the compact venue field, AD-T13 says "like Create game" (7.3).
- `docs/ENVIRONMENTS.md` still names the backend repo `~/meetup`.

## Appendix A. New `mob.*` label keys (bundled defaults; need a later server seed)
| Key | Text |
|---|---|
| `mob.tw.group_row_one` | {name} (1 member) |
| `mob.tw.group_row_many` | {name} ({count} members) |

Seeded already, bundled with exact text (not new): `mob.tw.err_venue_detail_too_long` = Keep it to 100 characters or fewer; `mob.create_game.court_details_label`, `mob.create_game.court_details_placeholder`, `mob.create_game.venue_label` (existing).

## Git evidence (literal output, after the code commit and the push)
PR: https://github.com/pratheeshku/meetup-mobile/pull/59 (not a draft, open, not merged). Evidence added in one later commit (report text only).
```
$ git log --oneline origin/main..HEAD
074fe05 te-a4: create-wizard polish (group sizes, focus on every step, one Venue heading, court or hall details)

$ git show HEAD --stat --format="%H %s"
074fe05bed8b3d2ef60c0418c723995e07468c1e te-a4: create-wizard polish (group sizes, focus on every step, one Venue heading, court or hall details)

 docs/reports/te-a4-raw-output.txt                  | 6458 ++++++++++++++++++++
 docs/reports/te-a4-report.md                       |  108 +
 docs/status/te-a4-status.md                        |   30 +
 scripts/check-labels.allowlist.json                |   12 +
 src/api/tournaments.ts                             |    2 +
 src/components/AddRemoveControl.tsx                |   31 +-
 src/components/DateTimePickerField.tsx             |    9 +
 src/components/KeyboardAwareScreen.tsx             |   10 +
 src/components/SegmentedSwitch.tsx                 |    8 +
 src/components/SelectableCard.tsx                  |    8 +
 .../tournament/v2/TournamentDetailV2.tsx           |    4 +-
 .../tournament/v2/TournamentOverview.tsx           |    5 +
 src/components/tournament/wizard/BasicsStep.tsx    |   19 +-
 src/components/tournament/wizard/CommitteeStep.tsx |    5 +-
 .../tournament/wizard/ParticipationStep.tsx        |    5 +-
 .../tournament/wizard/RegistrationStep.tsx         |    6 +-
 src/components/tournament/wizard/ReviewStep.tsx    |   13 +-
 .../tournament/wizard/VisibilityStep.tsx           |    7 +-
 src/components/tournament/wizard/WhenWhereStep.tsx |   41 +-
 src/components/tournament/wizard/parts.tsx         |   33 +-
 src/components/venue/VenuePicker.tsx               |    8 +-
 src/hooks/useAccessibilityFocus.ts                 |   50 +
 src/labels/defaultLabels.ts                        |    5 +
 src/screens/TournamentWizardScreen.tsx             |   23 +-
 src/screens/__tests__/TournamentDetailV2.test.tsx  |   13 +
 .../__tests__/TournamentWizardPolish.test.tsx      |  353 ++
 src/types/tournament.ts                            |    2 +
 src/types/tournamentWizard.ts                      |    4 +
 src/utils/__tests__/tournamentWizard.test.ts       |   39 +
 src/utils/tournamentWizard.ts                      |   48 +-
 30 files changed, 7328 insertions(+), 31 deletions(-)

$ git branch -r --contains HEAD
  origin/claude/te-a4-mobile

$ git rev-parse origin/claude/te-a4-mobile
074fe05bed8b3d2ef60c0418c723995e07468c1e

$ git status --short
 M android/version.properties
 M docs/reports/te-a4-report.md
```
