# Implementation Report: te-a3

Agent: claude-code (claude-sonnet-5-5). Machine: MacBook. Branch `claude/te-a3-mobile` from `origin/main` a8ff762 (te-a2 merged). Status file: `docs/status/te-a3-status.md`. Raw output: `docs/reports/te-a3-raw-output.txt`. PR: see the end. **Not self-certified.**

State back: te-a3 builds AD-T12 on the version 2 tournament page, committee only, with no backend change: the four fixtures setup steps (template, upload points, draw, submit), the Review fixtures sheet in Approvals, the optional results file, the file handling (two new libraries) and the labels. Nothing outside AD-T12 was started. **No screenshots exist** (no simulator) and **nothing was run on a device or against the deployed backend**; the native pieces (picker, share sheet, save dialog) are untested outside Jest doubles.

## 1. Design reference
AD-T12 (source of truth) and sections 2, 5, 8 of `DES-MEETUP-ADDENDUM-tournament-experience` v1.0; match-scoring AD-S2, AD-S3, AD-S4 and section 14 were not re-read beyond what the routes and the web code show (the web behaviour is the reference). Routes read: `tournaments/scoring_router.py` (`points/template`, `points`, `fixtures/generate`, `drafts/{id}`, `fixtures/workbook`, `fixtures/results-upload`), `engine_service.scoring_state` and `draft_response`, `router.py` committee actions. Web: `cnDownload`, `cnUpload`, `cnGenerate`, `cnSubmit`, `cnDrawModel`, `scoring-view.js` (`drawModel`, `draftReview`, `uploadErrorView`), `console-model.js` `draftRounds`; label texts from `core/label_fallbacks*.py`. Boards read (png): TV2MobSetupPoints, TV2MobSetupPointsErr, TV2MobSetupDraw, TV2MobSetupSubmit, TV2MobSetupResultsFile, TV2MobReviewFixtures (read in te-a2). The html files were not opened, so sizes follow the te-a1 and te-a2 tokens. TV2MobClosedFixtureSetup was not used (superseded). Governing docs were not edited. The fixture-workspace addendum was not read: error codes were taken from the web's code lists.

## 2. Traceability map
| Scope item | Where | Server source | Test |
|---|---|---|---|
| 1a Template to the share sheet | tabs/FixturesSetup.tsx, utils/fileTransfer.ts `downloadAndShare` | `GET .../points/template` | TournamentFixturesSetup.test, fixturesSetup.test |
| 1b Pick and upload points, 422 rows with labels, "nothing saved" | FixturesSetup, RefusalList, WorkbookPicker, `pickWorkbook`, `uploadPoints`, `refusalView` | `POST .../points` | same |
| 1c Groups and advance from the server's options; generate; draft view; confirm replace; FIXTURE_FROZEN | FixturesSetup, `drawChoice`, `normaliseDraft`, `generateFixtureDraft`, `getFixtureDraft` | `scoring/state` `committee.group_options`, `POST .../fixtures/generate`, `GET .../drafts/{id}` | same |
| 1d Submit for review; waiting state from the server | FixturesSetup, `submitFixturePublication`, `publicationPending` | `POST .../committee/actions` (`fixture_publication`), `GET .../committee/actions` | same |
| 2 Review fixtures sheet (names for ids, no reject reason) | tabs/ReviewFixturesSheet.tsx, ApprovalsTab | `GET .../drafts/{id}`, `approve`, `reject` | same |
| 3 Results file | tabs/ResultsFileCard.tsx (inside FixturesTab) | `GET .../fixtures/workbook`, `POST .../fixtures/results-upload` | same |
| 4 File handling | utils/fileTransfer.ts, jest.setup.documents.js | | fixturesSetup.test |
| 5 Labels | src/labels/defaultLabels.ts | web.scoring.*, web.tournament.* | check:labels |

## 3. Files created, modified, deleted
Created: src/utils/{fileTransfer,fixturesSetup}.ts; src/components/tournament/v2/tabs/{FixturesSetup,ResultsFileCard,ReviewFixturesSheet,RefusalList,WorkbookPicker}.tsx; jest.setup.documents.js; tests src/utils/__tests__/fixturesSetup.test.ts, src/screens/__tests__/TournamentFixturesSetup.test.tsx; status, report, raw output.
Modified: package.json, package-lock.json; jest.config.js; src/api/tournaments.ts; src/types/{tournamentScoring,tournamentTabs}.ts; src/utils/{tournamentScoring,tournamentTabs}.ts; src/components/tournament/v2/{TournamentDetailV2.tsx,tabs/FixturesTab.tsx,tabs/ApprovalsTab.tsx}; src/labels/defaultLabels.ts; tests tournamentScoring.test.ts and tournamentScoringContract.test.ts (the state now also carries `is_committee`).
Deleted: none. Not mine and not staged: `android/version.properties`.

## 4. Commands run, raw output
Full output in the raw file. Every command from `cd ~/Developer/meetup-mobile && pwd`.
| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint <the 28 changed ts and tsx files + jest.setup.documents.js>` | exit 0 |
| `npm run check:labels` | exit 1, 7 problems, all the stale-allowlist entries of `origin/main` (none new; my first run showed 2 hard-coded strings in WorkbookPicker, fixed) |
| `npm run lint` (whole repo) | exit 1, 32 problems (31 errors, 1 warning), the same as `origin/main` (my first run showed 7 extra `jest` global errors from adding mocks to `jest.setup.js`; moved to a new file with `eslint-env jest`) |
| scoped `npx jest`, 31 files, with coverage, one invocation | 3 suites failed of 31: `keyboardInventory.test.ts` (3 tests, baseline), and `tournamentScoring.test.ts` + `tournamentScoringContract.test.ts` (3 tests): the state now carries `is_committee`; both tests updated and re-run alone: 31 passed |
| same list on clean `origin/main` minus the 2 new files (coverage before) | 29 suites, 1 failed (`keyboardInventory`, 3 tests), 440 of 443 tests passed |
| `HomeScreen.test.tsx` + `EventDetailScreen.test.tsx`, on `origin/main` and on the branch | both 64 failed, 26 passed (identical baseline) |
Jest was run more than once: the list above, the new util test file alone, the new screen test file alone (one test of mine asserted the wrong thing about a disabled button; fixed), the two baseline runs, and the re-run of the two tests I changed.

## 5. Test coverage (statements %, touched files; before = `origin/main`, after = this branch)
| File | Before | After |
|---|---|---|
| ALL | 86.56 | 87.51 |
| api/tournaments.ts | 88.37 | 89.89 |
| components/tournament/v2/LockedPreview.tsx | 100.0 | 100.0 |
| components/tournament/v2/PeopleSheet.tsx | 100.0 | 100.0 |
| components/tournament/v2/StatusStrip.tsx | 100.0 | 100.0 |
| components/tournament/v2/TournamentDetailV2.tsx | 88.4 | 88.88 |
| components/tournament/v2/TournamentHeader.tsx | 88.88 | 88.88 |
| components/tournament/v2/TournamentOverview.tsx | 90.9 | 92.72 |
| components/tournament/v2/TournamentTabs.tsx | 100.0 | 100.0 |
| components/tournament/v2/tabs/ApprovalsTab.tsx | 86.74 | 86.95 |
| components/tournament/v2/tabs/CloseSheet.tsx | 79.31 | 79.31 |
| components/tournament/v2/tabs/FixturesSetup.tsx | new | 92.56 |
| components/tournament/v2/tabs/FixturesTab.tsx | 92.45 | 93.1 |
| components/tournament/v2/tabs/KnockoutBracket.tsx | 86.66 | 86.66 |
| components/tournament/v2/tabs/MediaTab.tsx | 88.88 | 88.88 |
| components/tournament/v2/tabs/ParticipantsTab.tsx | 90.24 | 90.24 |
| components/tournament/v2/tabs/RefusalList.tsx | new | 93.75 |
| components/tournament/v2/tabs/ResultsFileCard.tsx | new | 90.0 |
| components/tournament/v2/tabs/ResultsTab.tsx | 87.09 | 87.09 |
| components/tournament/v2/tabs/ReviewFixturesSheet.tsx | new | 72.0 |
| components/tournament/v2/tabs/ScoreSheet.tsx | 83.48 | 83.48 |
| components/tournament/v2/tabs/StandingsTab.tsx | 91.66 | 91.66 |
| components/tournament/v2/tabs/WorkbookPicker.tsx | new | 100.0 |
| components/tournament/v2/tabs/matchLabels.ts | 52.17 | 52.17 |
| components/tournament/v2/tabs/parts.tsx | 100.0 | 100.0 |
| components/tournament/v2/tabs/useStandingsBoard.ts | 93.47 | 93.47 |
| screens/TournamentDetailScreen.tsx | 74.84 | 74.84 |
| utils/fileTransfer.ts | new | 96.77 |
| utils/fixturesSetup.ts | new | 89.21 |
| utils/tournamentScoring.ts | 97.29 | 97.54 |
| utils/tournamentTabs.ts | 92.81 | 92.81 |
Not exercised by Jest: the real picker, the native share sheet and save dialog (doubles only). `ReviewFixturesSheet` 72%: the "See all" path.
Checks and where they are proven: nothing is built or seeded on the device (the draft, seeds and counts are the server's; `TournamentFixturesSetup.test` "shows the draft ..."); group counts and advance values are only the server's (`drawChoice` tests and "offers only ..."); no id is shown (draft and review tests assert none of the ids appear); Reject sends no body and the sheet has no reason field; the waiting state is read from the server's request list; a successful results upload reloads the board.

## 6. The library choice (item 4)
Neither a document picker nor a file store was installed (`package.json`, `node_modules`). The app is bare React Native 0.86 (not Expo; new architecture on). Added:
1. **`@react-native-documents/picker` 12.0.3**: the maintained successor of `react-native-document-picker` (peer `react-native >= 0.79`). `pick({type: xlsx, mode: 'import'})` gives a file the app can read and upload (a `file://` copy on iOS, a `content://` URI on Android, both usable as a multipart part); `saveDocuments` is the Android save dialog.
2. **`react-native-blob-util` 0.25.1** (peer `react-native: *`): writes the downloaded bytes to the cache folder, deletes a copy, and opens the iOS share sheet (`ios.presentOptionsMenu`). React Native's own `Share` cannot share a file on Android and has no file system, so a file library is unavoidable; this one was chosen because it is small for what it does here, maintained, and works with the new architecture.
The download goes through the shared `apiClient` (`responseType: 'arraybuffer'`), not through the library's own network layer, so the access token, its refresh and the correlation id behave as for every other call. Bytes are base64-encoded by a small tested function (`bytesToBase64`; React Native has no `Buffer`).
Platform behaviour: **iOS** opens the system share sheet (Save to Files, open in Excel or Sheets). **Android** opens the system save dialog, not a share sheet (`saveDocuments`); the board's wording "opens the share sheet" is exact on iOS only. Not verified on either platform.
Handling: `.xlsx` only (the picker filter; the server checks again); no size limit on the device (the server's `FILE_TOO_LARGE` is shown); contents are never logged; the picker's own copy (iOS) is deleted after the upload and when a file is replaced; an Android `content://` source belongs to the other app and is left alone; the downloaded file stays in the app's cache folder (the OS clears it; it is not deleted right after the share sheet because the sheet may still be reading it).
**Owner steps (native rebuild):** `cd ios && pod install` (Podfile.lock changes), then rebuild the iOS and Android apps (`npm run ios`, `npm run android`); Metro alone is not enough. `package-lock.json` changed by 38 lines.

## 7. Proposed Assumptions
1. **Where the results file lives.** The board draws it under a tab called "Results"; the addendum (section 2) moved score entry to the Fixtures tab and the Results tab is the closure view. The card is at the foot of the Fixtures tab for the committee once fixtures are published and results are not locked (AD-T12 says "after publication").
2. **Wording.** Where the board's text has no web key, the web key's wording is used, as asked (for example step titles "1. Points", "2. Groups and qualifiers", "3. Draft"; "Upload points"; "Generate draft"; "Submit for approval"). Board texts not drawn: "Opens the share sheet: ...", "After you submit ...", "Any one of Alicia, Joyce or Sam can approve", "8 groups needs at least 32 players", "4 unrated players are seeded last", "Enter many scores at once", the Optional badge. The board's "Top 1 / Top 2" and "2 / 4 / 8" controls are drawn only for the values the server allows (a greyed "8" is not drawn).
3. **The "Choose file" button** uses the web key `upload_label` ("Points file (.xlsx)") as its text; a picked file shows its name and size with "Change".
4. **Template and draw need `registration_phase = frozen`**, as in the web model; otherwise the server's `REGISTRATION_NOT_FROZEN` text is shown and the controls are disabled. When points are locked the upload is not offered.
5. **Review fixtures chips** show matches and players counts (te-b4 `approvals.summary_*`); the board's "1 warning" chip, the seeds note and "Showing 4 of 28 matches" are not drawn (no data or key). The first four matches are listed; "See all" shows the rest.
6. **Download file names** use the tournament title (never an id): `<title>-points.xlsx`, `<title>-scoring.xlsx`.
7. **A download refusal** (the body is binary) cannot be read as a coded error, so any failed download says "The file could not be downloaded." The screen prevents the usual refusals before asking.
8. **Draft status words** use the web's `draw.status.*` ("Open", "Published", "Replaced").
9. **NO_DERIVABLE_WINNER** keeps its old label for an old server; a level match in a results file is `MATCH_TIED` ("The sets and the points are level. Add another set.").

## 8. Deviations from instructions
1. No screenshots (no simulator). Visual match to the boards is not verified.
2. Jest was run more than once (section 4).
3. `jest.setup.documents.js` and a line in `jest.config.js` were added instead of editing `jest.setup.js` (lint: the existing file has `jest` global errors that are baseline; adding more there would have added new ones).
4. Two tests that I changed because behaviour changed (`is_committee`).
5. Labels: two keys with no web equivalent (`mob.tournament.setup.file_tile`, `file_size`), because the label check forbids hard-coded text in the picked-file row.

## 9. Self-declared confidence per item
- 1a to 1d, 2, 3: **Done and verified** by tests (behaviour, request bodies, refusal text, names for ids); **not verified** against the real backend or on a device; look **not verified** against the boards.
- File handling: logic **verified** (base64, pick, cancel, discard, platform branch); the native modules **not verified**.
- Labels: **Done**; not seeded (Appendix A).

## 10. Known gaps and follow-ups
- Pod install, native rebuild, then a device pass: download on iOS and Android, pick from Files, upload to the deployed backend, review and approve with two committee accounts.
- Seed the 118 keys of Appendix A under `mob.*` (a later server task).
- The Android save dialog differs from the board's share sheet: an owner decision whether to add a real Android share (needs a file provider setup).
- Same baseline failures as te-a2 (Home, EventDetail, keyboardInventory, lint, check:labels).

## Drift found
- The board TV2MobSetupResultsFile is drawn under a tab named "Results"; the addendum places score entry on Fixtures and Results is the closure view (assumption 1).
- Board text and web keys differ in several places (assumption 2); the web keys won.
- The board's greyed "8 groups" option needs a "minimum players" text the server does not send; only allowed values are drawn.
- `te-a2`'s report said the app had no workbook flow; this task adds it (the te-a2 "blocked" items B1 and B2 are now closed).

## Appendix A. New `mob.*` label keys (bundled defaults; need a later server seed)
Text mirrors the web key in the last column (the backend serves it). Glossary: no bare "member".

| Key | Text | Mirrors |
|---|---|---|
| `mob.scoring.download.failed` | The file could not be downloaded. | `web.scoring.download.failed` |
| `mob.scoring.draft.summary` | Version {version}, groups: {groups}, advancing per group: {advance} | `web.scoring.draft.summary` |
| `mob.scoring.draw.advance` | Qualifiers from each group | `web.scoring.draw.advance` |
| `mob.scoring.draw.advance_option` | Top {n} | `web.scoring.draw.advance_option` |
| `mob.scoring.draw.blocked.no_options` | Group options are not available yet. Registration must be closed, with enough entries. | `web.scoring.draw.blocked.no_options` |
| `mob.scoring.draw.blocked.not_open` | This draft is no longer open. | `web.scoring.draw.blocked.not_open` |
| `mob.scoring.draw.blocked.pending` | A publication request for this draft is waiting for approval. See Approvals. | `web.scoring.draw.blocked.pending` |
| `mob.scoring.draw.choose_file` | Choose a file first. | `web.scoring.draw.choose_file` |
| `mob.scoring.draw.detail_missing` | The draft's groups could not be loaded. | `web.scoring.draw.detail_missing` |
| `mob.scoring.draw.download_template` | Download points template | `web.scoring.draw.download_template` |
| `mob.scoring.draw.draft_counts` | {group} group matches, {knockout} knockout matches | `web.scoring.draw.draft_counts` |
| `mob.scoring.draw.draft_title` | Current draft | `web.scoring.draw.draft_title` |
| `mob.scoring.draw.generate` | Generate draft | `web.scoring.draw.generate` |
| `mob.scoring.draw.generated_ok` | Draft created. | `web.scoring.draw.generated_ok` |
| `mob.scoring.draw.group_count` | Number of groups | `web.scoring.draw.group_count` |
| `mob.scoring.draw.group_title` | Group {group} | `web.scoring.draw.group_title` |
| `mob.scoring.draw.groups_option` | {n} groups | `web.scoring.draw.groups_option` |
| `mob.scoring.draw.member` | {seed}. {name} | `web.scoring.draw.member` |
| `mob.scoring.draw.member_noseed` | {name} | `web.scoring.draw.member_noseed` |
| `mob.scoring.draw.points_intro` | Download the template, fill in each entry's points (leave a cell blank if the entry is unrated) and upload the file. Points are used for seeding only. | `web.scoring.draw.points_intro` |
| `mob.scoring.draw.points_none` | No points have been uploaded yet. | `web.scoring.draw.points_none` |
| `mob.scoring.draw.points_on_file` | Points on file: {entrants} entries, {rated} rated, {unrated} unrated. Uploaded {when}. | `web.scoring.draw.points_on_file` |
| `mob.scoring.draw.regenerate` | Generate a new draft | `web.scoring.draw.regenerate` |
| `mob.scoring.draw.regenerate_confirm` | Generate a new draft? It replaces the current draft (version {version}). A publication request for the old draft will go out of date. | `web.scoring.draw.regenerate_confirm` |
| `mob.scoring.draw.status.draft` | Open | `web.scoring.draw.status.draft` |
| `mob.scoring.draw.status.published` | Published | `web.scoring.draw.status.published` |
| `mob.scoring.draw.status.superseded` | Replaced | `web.scoring.draw.status.superseded` |
| `mob.scoring.draw.step_draft` | 3. Draft | `web.scoring.draw.step_draft` |
| `mob.scoring.draw.step_options` | 2. Groups and qualifiers | `web.scoring.draw.step_options` |
| `mob.scoring.draw.step_points` | 1. Points | `web.scoring.draw.step_points` |
| `mob.scoring.draw.submit` | Submit for approval | `web.scoring.draw.submit` |
| `mob.scoring.draw.submit_confirm` | Submit this draft for approval? Another committee member has to approve it before the fixture is published. | `web.scoring.draw.submit_confirm` |
| `mob.scoring.draw.submitted_ok` | Submitted. Another committee member now has to approve it. | `web.scoring.draw.submitted_ok` |
| `mob.scoring.draw.upload` | Upload points | `web.scoring.draw.upload` |
| `mob.scoring.draw.upload_label` | Points file (.xlsx) | `web.scoring.draw.upload_label` |
| `mob.scoring.draw.upload_ok` | Points accepted: {entrants} entries, {rated} rated, {unrated} unrated. | `web.scoring.draw.upload_ok` |
| `mob.scoring.err.ADVANCING_SIDE_INVALID` | The advancing side must be A or B. | `web.scoring.err.ADVANCING_SIDE_INVALID` |
| `mob.scoring.err.ADVANCING_SIDE_REQUIRED` | Name the advancing side (A or B). | `web.scoring.err.ADVANCING_SIDE_REQUIRED` |
| `mob.scoring.err.CORRECTION_NEEDS_APPROVAL` | This changes the winner or the result type. It needs another committee member to approve it. | `web.scoring.err.CORRECTION_NEEDS_APPROVAL` |
| `mob.scoring.err.DOWNSTREAM_PLAYED` | A later match already has a result. Clear it first. | `web.scoring.err.DOWNSTREAM_PLAYED` |
| `mob.scoring.err.DUPLICATE_MATCH` | This match appears more than once. | `web.scoring.err.DUPLICATE_MATCH` |
| `mob.scoring.err.DUPLICATE_REGISTRATION` | This entry appears more than once. | `web.scoring.err.DUPLICATE_REGISTRATION` |
| `mob.scoring.err.ENCRYPTED` | The file is password protected. | `web.scoring.err.ENCRYPTED` |
| `mob.scoring.err.FILE_TOO_LARGE` | The file is too large. | `web.scoring.err.FILE_TOO_LARGE` |
| `mob.scoring.err.FIXTURES_NOT_PUBLISHED` | The fixture has not been published yet. | `web.scoring.err.FIXTURES_NOT_PUBLISHED` |
| `mob.scoring.err.FIXTURE_FROZEN` | The fixture cannot be generated again because a result has been posted. | `web.scoring.err.FIXTURE_FROZEN` |
| `mob.scoring.err.FORMAT_GROUP_TOO_SMALL` | There are too few entries for that number of groups. | `web.scoring.err.FORMAT_GROUP_TOO_SMALL` |
| `mob.scoring.err.FORMAT_PARAM_INVALID` | That number of groups is not allowed. | `web.scoring.err.FORMAT_PARAM_INVALID` |
| `mob.scoring.err.FORMAT_QUALIFIERS_INVALID` | That number of qualifiers per group is not allowed. | `web.scoring.err.FORMAT_QUALIFIERS_INVALID` |
| `mob.scoring.err.FORMAT_SPEC_MISSING` | The tournament format is not set up for scoring. | `web.scoring.err.FORMAT_SPEC_MISSING` |
| `mob.scoring.err.FORMULA_NOT_ALLOWED` | The file contains formulas, which are not allowed. | `web.scoring.err.FORMULA_NOT_ALLOWED` |
| `mob.scoring.err.HEADER_MISMATCH` | The column headings were changed. Download a fresh template. | `web.scoring.err.HEADER_MISMATCH` |
| `mob.scoring.err.LOCKED_CELL_EDITED` | A locked cell was changed. | `web.scoring.err.LOCKED_CELL_EDITED` |
| `mob.scoring.err.MACROS_OR_EXTERNAL_CONTENT` | The file contains macros or external links, which are not allowed. | `web.scoring.err.MACROS_OR_EXTERNAL_CONTENT` |
| `mob.scoring.err.MATCH_TIED` | The sets and the points are level. Add another set. | `web.scoring.err.MATCH_TIED` |
| `mob.scoring.err.MISSING_REGISTRATION` | A registered entry is missing from the file. | `web.scoring.err.MISSING_REGISTRATION` |
| `mob.scoring.err.NOT_GROUPS_KNOCKOUT` | Scoring is only available for groups and knockout tournaments. | `web.scoring.err.NOT_GROUPS_KNOCKOUT` |
| `mob.scoring.err.NOT_XLSX` | The file is not an .xlsx workbook. | `web.scoring.err.NOT_XLSX` |
| `mob.scoring.err.NO_COMPLETED_SET` | A normal result needs at least one completed set. | `web.scoring.err.NO_COMPLETED_SET` |
| `mob.scoring.err.NO_DERIVABLE_WINNER` | The sets do not give a winner. | `web.scoring.err.NO_DERIVABLE_WINNER` |
| `mob.scoring.err.POINTS_LOCKED` | The points are locked because the fixture has been generated. | `web.scoring.err.POINTS_LOCKED` |
| `mob.scoring.err.POINTS_NEGATIVE` | Points cannot be negative. | `web.scoring.err.POINTS_NEGATIVE` |
| `mob.scoring.err.POINTS_NOT_NUMERIC` | Points must be a number or left blank. | `web.scoring.err.POINTS_NOT_NUMERIC` |
| `mob.scoring.err.POINTS_OUT_OF_BOUNDS` | Points are outside the allowed range. | `web.scoring.err.POINTS_OUT_OF_BOUNDS` |
| `mob.scoring.err.POINTS_REQUIRED` | Upload the points before generating the fixture. | `web.scoring.err.POINTS_REQUIRED` |
| `mob.scoring.err.POINTS_ROSTER_MISMATCH` | The points do not match the registered entries. Upload them again. | `web.scoring.err.POINTS_ROSTER_MISMATCH` |
| `mob.scoring.err.POINTS_UPLOAD_INVALID` | The points file was not accepted. Nothing was saved. | `web.scoring.err.POINTS_UPLOAD_INVALID` |
| `mob.scoring.err.REGISTRATION_NOT_FROZEN` | Registration has not closed yet. | `web.scoring.err.REGISTRATION_NOT_FROZEN` |
| `mob.scoring.err.RESULTS_UPLOAD_INVALID` | The results file was not accepted. Nothing was saved. | `web.scoring.err.RESULTS_UPLOAD_INVALID` |
| `mob.scoring.err.RESULT_TYPE_INVALID` | The result type must be Normal, WO or RET. | `web.scoring.err.RESULT_TYPE_INVALID` |
| `mob.scoring.err.SECOND_DERIVABLE_WINNER` | The extra sets would give a second winner. | `web.scoring.err.SECOND_DERIVABLE_WINNER` |
| `mob.scoring.err.SET_INCOMPLETE` | A set needs a score for both sides. | `web.scoring.err.SET_INCOMPLETE` |
| `mob.scoring.err.SET_NEGATIVE` | Set scores cannot be negative. | `web.scoring.err.SET_NEGATIVE` |
| `mob.scoring.err.SET_NOT_INTEGER` | Set scores must be whole numbers. | `web.scoring.err.SET_NOT_INTEGER` |
| `mob.scoring.err.SET_ORDER` | Fill the sets in order, without gaps. | `web.scoring.err.SET_ORDER` |
| `mob.scoring.err.SET_TIED` | A set cannot end level. | `web.scoring.err.SET_TIED` |
| `mob.scoring.err.SET_TOO_LARGE` | A set score is too large. | `web.scoring.err.SET_TOO_LARGE` |
| `mob.scoring.err.SHEET_MISMATCH` | This match does not belong on this sheet. | `web.scoring.err.SHEET_MISMATCH` |
| `mob.scoring.err.SHEET_MISSING` | A required sheet is missing. | `web.scoring.err.SHEET_MISSING` |
| `mob.scoring.err.SHEET_UNKNOWN` | This sheet is not part of the workbook. | `web.scoring.err.SHEET_UNKNOWN` |
| `mob.scoring.err.SIDE_MISMATCH` | The players on this row do not match the fixture. | `web.scoring.err.SIDE_MISMATCH` |
| `mob.scoring.err.SIDE_UNRESOLVED` | Both sides of this match are not known yet. | `web.scoring.err.SIDE_UNRESOLVED` |
| `mob.scoring.err.TOO_MANY_ROWS` | The file has too many rows. | `web.scoring.err.TOO_MANY_ROWS` |
| `mob.scoring.err.TOO_MANY_SETS` | There are more sets than the workbook allows. | `web.scoring.err.TOO_MANY_SETS` |
| `mob.scoring.err.UNEXPECTED_CELLS` | There is data outside the table. | `web.scoring.err.UNEXPECTED_CELLS` |
| `mob.scoring.err.UNKNOWN` | This could not be accepted. | `web.scoring.err.UNKNOWN` |
| `mob.scoring.err.UNKNOWN_MATCH` | This match is not in the fixture. | `web.scoring.err.UNKNOWN_MATCH` |
| `mob.scoring.err.UNKNOWN_REGISTRATION` | This entry is not registered in the tournament. | `web.scoring.err.UNKNOWN_REGISTRATION` |
| `mob.scoring.err.UNREADABLE` | The file could not be read. | `web.scoring.err.UNREADABLE` |
| `mob.scoring.err.WORKBOOK_STALE` | This workbook is out of date. Download a fresh one. | `web.scoring.err.WORKBOOK_STALE` |
| `mob.scoring.err.WO_HAS_SCORES` | A walkover cannot have set scores. | `web.scoring.err.WO_HAS_SCORES` |
| `mob.scoring.err.ZIP_BOMB` | The file is not a safe workbook. | `web.scoring.err.ZIP_BOMB` |
| `mob.scoring.error.generic` | Something went wrong. Please try again. | `web.scoring.error.generic` |
| `mob.scoring.error.more` | More problems exist than are listed here: {count} not shown. | `web.scoring.error.more` |
| `mob.scoring.error.row` | Row {row}, {column}: {message} | `web.scoring.error.row` |
| `mob.scoring.error.row_nocol` | Row {row}: {message} | `web.scoring.error.row_nocol` |
| `mob.scoring.error.sheet` | {sheet}: {message} | `web.scoring.error.sheet` |
| `mob.scoring.placeholder.group_place` | Group {group}, place {place} | `web.scoring.placeholder.group_place` |
| `mob.scoring.placeholder.loser_generic` | Loser of an earlier match | `web.scoring.placeholder.loser_generic` |
| `mob.scoring.placeholder.tbd` | To be decided | `web.scoring.placeholder.tbd` |
| `mob.scoring.placeholder.winner_generic` | Winner of an earlier match | `web.scoring.placeholder.winner_generic` |
| `mob.scoring.results.download_workbook` | Download scoring workbook | `web.scoring.results.download_workbook` |
| `mob.scoring.results.needs_approval_hint` | Submit a change for this match from the match list below. Another committee member has to approve it. | `web.scoring.results.needs_approval_hint` |
| `mob.scoring.results.step_upload` | 2. Upload results | `web.scoring.results.step_upload` |
| `mob.scoring.results.step_workbook` | 1. Scoring workbook | `web.scoring.results.step_workbook` |
| `mob.scoring.results.upload` | Upload results | `web.scoring.results.upload` |
| `mob.scoring.results.upload_label` | Results file (.xlsx) | `web.scoring.results.upload_label` |
| `mob.scoring.results.upload_ok` | Results saved: {posted} posted, {corrected} corrected, {unchanged} unchanged. | `web.scoring.results.upload_ok` |
| `mob.scoring.results.workbook_intro` | Download the workbook, enter the set scores and the result type for each match that was played, and upload it. The winner is worked out from the scores; nobody types a winner. | `web.scoring.results.workbook_intro` |
| `mob.scoring.unknown_entry` | Unknown entry | `web.scoring.unknown_entry` |
| `mob.tournament.approvals.review_and_approve` | Review and approve | `web.tournament.approvals.review_and_approve` |
| `mob.tournament.approvals.show_all` | See all | `web.tournament.approvals.show_all` |
| `mob.tournament.approvals.summary_matches` | {count} matches | `web.tournament.approvals.summary_matches` |
| `mob.tournament.approvals.summary_players` | {count} players | `web.tournament.approvals.summary_players` |
| `mob.tournament.fixtures.draft_badge` | Draft, hidden from players | `web.tournament.fixtures.draft_badge` |
| `mob.tournament.fixtures.setup_note` | Players cannot see these fixtures until a second committee member approves. After approval the Fixtures and Standings tabs open. | `web.tournament.fixtures.setup_note` |
| `mob.tournament.setup.file_tile` | XLS | none (board text) |
| `mob.tournament.setup.file_size` | {kb} KB | none (board text) |

## Git evidence (literal output, after the code commit and the push)
PR: https://github.com/pratheeshku/meetup-mobile/pull/58 (not a draft, open, not merged). Evidence added in one later commit (report text only).
```
$ git log --oneline origin/main..HEAD
a9e9dc1 te-a3: fixtures setup, Review fixtures sheet and results file on mobile (AD-T12)

$ git show HEAD --stat --format="%H %s"
a9e9dc1cd1afbb665766cb5bc0b7cff47488de40 te-a3: fixtures setup, Review fixtures sheet and results file on mobile (AD-T12)

 docs/reports/te-a3-raw-output.txt                  | 3761 ++++++++++++++++++++
 docs/reports/te-a3-report.md                       |  243 ++
 docs/status/te-a3-status.md                        |   30 +
 jest.config.js                                     |    2 +-
 jest.setup.documents.js                            |   16 +
 package-lock.json                                  |   38 +
 package.json                                       |    2 +
 src/api/tournaments.ts                             |   63 +
 .../tournament/v2/TournamentDetailV2.tsx           |   16 +-
 src/components/tournament/v2/tabs/ApprovalsTab.tsx |   34 +
 .../tournament/v2/tabs/FixturesSetup.tsx           |  440 +++
 src/components/tournament/v2/tabs/FixturesTab.tsx  |   34 +-
 src/components/tournament/v2/tabs/RefusalList.tsx  |   69 +
 .../tournament/v2/tabs/ResultsFileCard.tsx         |  143 +
 .../tournament/v2/tabs/ReviewFixturesSheet.tsx     |  132 +
 .../tournament/v2/tabs/WorkbookPicker.tsx          |   52 +
 src/labels/defaultLabels.ts                        |  120 +
 .../__tests__/TournamentFixturesSetup.test.tsx     |  404 +++
 src/types/tournamentScoring.ts                     |   36 +
 src/types/tournamentTabs.ts                        |   63 +
 src/utils/__tests__/fixturesSetup.test.ts          |  196 +
 src/utils/__tests__/tournamentScoring.test.ts      |    4 +-
 .../__tests__/tournamentScoringContract.test.ts    |    3 +-
 src/utils/fileTransfer.ts                          |   83 +
 src/utils/fixturesSetup.ts                         |  272 ++
 src/utils/tournamentScoring.ts                     |   43 +
 src/utils/tournamentTabs.ts                        |    5 +
 27 files changed, 6297 insertions(+), 7 deletions(-)

$ git branch -r --contains HEAD
  origin/claude/te-a3-mobile

$ git rev-parse origin/claude/te-a3-mobile
a9e9dc1cd1afbb665766cb5bc0b7cff47488de40

$ git status --short
 M android/version.properties
 M docs/reports/te-a3-report.md
```
