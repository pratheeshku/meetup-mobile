# Implementation Report: tl-c-mobile-3

Mobile only, one PR. The committee invitation accept card on the tournament detail screen, using the merged hook and utils from tl-c-mobile-2. Handoff template: `docs/agent-handoff-template.md` does not exist in this repo; read from `pratheeshku/meetup` main at `0109c9b` (read-only clone at `/home/user/meetup`, attached with `add_repo` this session; `~/meetup` is not present in the cloud container). Nothing in it was edited.

Branch `claude/awesome-dirac-amt97a`, created from `origin/main` (`1e3c232`, which already contains PR 2 of tl-c-mobile-2). PR to `main`; not merged.

## 1. Design reference
`DES-MEETUP-ADDENDUM-tournament-lifecycle` v1.4 TL-19 (an invited committee member becomes active only by accepting). Board: `WebCommitteeAccept` (PNG only; there is no html next to it, so no board sizes were available). **Owner decision (task text):** no mobile board exists; the web card is re-flowed to a 390-wide column. That is the only deviation from "UI must match its board". Web behaviour read from `frontend/committee-invitation.js`, `frontend/app.js` (`renderCommitteeInvitationPage`, `tcaRespond`, `viewTournament`), `core/label_fallbacks_web.py` (`web.tca.*`) and `docs/reports/tl-c-accept-report.md`. Built screenshots of the web card at 390 (`docs/reports/tl-c-accept/card-390.png`) were used as the re-flow reference.

## 2. Traceability map
| Item | Files | Commit |
|---|---|---|
| Card at the top of the tournament detail, content and order of the web card in one column | `src/components/tournament/CommitteeInvitationCard.tsx`, `src/screens/TournamentDetailScreen.tsx` | `cf6c0f9` |
| Accept / Decline through the merged hook, one correlation id reused for the re-read, busy and disabled in flight | `TournamentDetailScreen.tsx` (`answerCommitteeInvitation`, `refreshAfterCommitteeAnswer`, `loadAll(silent, correlationId)`) | `cf6c0f9` |
| States (already active, closed, not invited, cancelled, ended, disabled, failed): inline label, Retry for failed only | `CommitteeInvitationCard.tsx`, `TournamentDetailScreen.tsx` (`committeeNote`), `src/utils/committeeInvitation.ts` (existing) | `cf6c0f9` |
| "Dates" row as the web writes it | `src/utils/committeeInvitation.ts` (`committeeDateRange`) | `cf6c0f9` |
| People by name | card shows `organizer_name` only; no id is passed to the card | `cf6c0f9` |
| Labels | `src/labels/defaultLabels.ts`, `scripts/check-labels.allowlist.json` | `cf6c0f9` |
| Tests | `CommitteeInvitationCard.test.tsx`, `TournamentDetailCommittee.test.tsx`, `committeeInvitation.test.ts` | `cf6c0f9` |

## 3. Files created / modified / deleted (final)
Created: `src/components/tournament/CommitteeInvitationCard.tsx`, `src/components/__tests__/CommitteeInvitationCard.test.tsx`, `src/screens/__tests__/TournamentDetailCommittee.test.tsx`, `docs/status/tl-c-mobile-3-status.md`, `docs/reports/tl-c-mobile-3-report.md`.
Modified: `src/screens/TournamentDetailScreen.tsx`, `src/utils/committeeInvitation.ts` (adds `committeeDateRange`), `src/utils/__tests__/committeeInvitation.test.ts`, `src/labels/defaultLabels.ts` (+8 keys), `scripts/check-labels.allowlist.json` (+1 entry).
Deleted: none. `docs/` is not edited (the report and status file are the two new files the template requires). No `~/meetup` file edited. No endpoint or field added: `getCommitteeInvitation`, `respondToCommitteeInvitation`, `my_committee_invitation` and `CommitteeInvitationSummary` already existed.

## 4. Commands run, raw output
Machine: Claude cloud container (Linux, Node v22), `cd /home/user/meetup-mobile && pwd` -> `/home/user/meetup-mobile`. `npm ci` run once (the container had no `node_modules`); no dependency added or changed.

Targeted jest, the five files in one run, with coverage (the two new test files, the extended util test, and the two existing detail-screen tests that exercise the screen I changed). The two `console.error` act warnings are from my first version of the card test (sync `render`); fixed by `renderAsync` and the card file re-run once (second block below).
```
PASS src/components/__tests__/CommitteeInvitationCard.test.tsx (5.364 s)
  ● Console

    console.error
      An update to CommitteeInvitationCard inside a test was not wrapped in act(...).
      
      When testing, code that causes React state updates should be wrapped into act(...):
      
      act(() => {
        /* fire events that update state */
      });
      /* assert on the output */
      
      This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

      80 |       () => {
      81 |         if (!cancelled) {
    > 82 |           setSports([]);
         |           ^
      83 |         }
      84 |       },
      85 |     );

      at node_modules/react-test-renderer/cjs/react-test-renderer.development.js:14402:19
      at runWithFiberInDEV (node_modules/react-test-renderer/cjs/react-test-renderer.development.js:2315:13)
      at warnIfUpdatesNotWrappedWithActDEV (node_modules/react-test-renderer/cjs/react-test-renderer.development.js:14401:9)
      at scheduleUpdateOnFiber (node_modules/react-test-renderer/cjs/react-test-renderer.development.js:12086:9)
      at dispatchSetStateInternal (node_modules/react-test-renderer/cjs/react-test-renderer.development.js:6208:13)
      at dispatchSetState (node_modules/react-test-renderer/cjs/react-test-renderer.development.js:6165:7)
      at setSports (src/sports/catalog.ts:82:11)

    console.error
      An update to CommitteeInvitationCard inside a test was not wrapped in act(...).
      
      When testing, code that causes React state updates should be wrapped into act(...):
      
      act(() => {
        /* fire events that update state */
      });
      /* assert on the output */
      
      This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

      80 |       () => {
      81 |         if (!cancelled) {
    > 82 |           setSports([]);
         |           ^
      83 |         }
      84 |       },
      85 |     );

      at node_modules/react-test-renderer/cjs/react-test-renderer.development.js:14402:19
      at runWithFiberInDEV (node_modules/react-test-renderer/cjs/react-test-renderer.development.js:2315:13)
      at warnIfUpdatesNotWrappedWithActDEV (node_modules/react-test-renderer/cjs/react-test-renderer.development.js:14401:9)
      at scheduleUpdateOnFiber (node_modules/react-test-renderer/cjs/react-test-renderer.development.js:12086:9)
      at dispatchSetStateInternal (node_modules/react-test-renderer/cjs/react-test-renderer.development.js:6208:13)
      at dispatchSetState (node_modules/react-test-renderer/cjs/react-test-renderer.development.js:6165:7)
      at setSports (src/sports/catalog.ts:82:11)

PASS src/utils/__tests__/committeeInvitation.test.ts
PASS src/screens/__tests__/TournamentDetailScreen.test.tsx (5.942 s)
PASS src/screens/__tests__/TournamentRespond.test.tsx (11.536 s)
PASS src/screens/__tests__/TournamentDetailCommittee.test.tsx (11.762 s)
------------------------------|---------|----------|---------|---------|-----------------------------------------------------------------------------------------------------------------------------
File                          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s                                                                                                           
------------------------------|---------|----------|---------|---------|-----------------------------------------------------------------------------------------------------------------------------
All files                     |   58.95 |    56.01 |   42.85 |   59.87 |                                                                                                                             
 components/tournament        |     100 |      100 |     100 |     100 |                                                                                                                             
  CommitteeInvitationCard.tsx |     100 |      100 |     100 |     100 |                                                                                                                             
 screens                      |   54.29 |    48.45 |   31.91 |   55.24 |                                                                                                                             
  TournamentDetailScreen.tsx  |   54.29 |    48.45 |   31.91 |   55.24 | 154,185,199,240-246,256,271,277-278,318-322,335,344,351-354,387-413,418-452,457-478,483-506,517-590,595-620,742-753,794-985 
 utils                        |     100 |      100 |     100 |     100 |                                                                                                                             
  committeeInvitation.ts      |     100 |      100 |     100 |     100 |                                                                                                                             
------------------------------|---------|----------|---------|---------|-----------------------------------------------------------------------------------------------------------------------------

Test Suites: 5 passed, 5 total
Tests:       57 passed, 57 total
Snapshots:   0 total
Time:        12.446 s
Ran all test suites matching /src\/components\/__tests__\/CommitteeInvitationCard.test.tsx|src\/screens\/__tests__\/TournamentDetailCommittee.test.tsx|src\/utils\/__tests__\/committeeInvitation.test.ts|src\/screens\/__tests__\/TournamentDetailScreen.test.tsx|src\/screens\/__tests__\/TournamentRespond.test.tsx/i.
```
Card test file, re-run once after the act fix (the only file re-run):
```
PASS src/components/__tests__/CommitteeInvitationCard.test.tsx
  CommitteeInvitationCard
    ✓ shows the web card content in the web order, re-flowed to one column (331 ms)
    ✓ names people by name and never renders an id (13 ms)
    ✓ Accept and Decline call their handlers; touch targets are at least 44pt (8 ms)
    ✓ while accept is in flight both buttons are disabled and one is busy (58 ms)
    ✓ while decline is in flight both buttons are disabled and one is busy (6 ms)
    ✓ already_active: its label shows inline, no buttons, no Retry, no crash (4 ms)
    ✓ closed: its label shows inline, no buttons, no Retry, no crash (5 ms)
    ✓ not_invited: its label shows inline, no buttons, no Retry, no crash (7 ms)
    ✓ cancelled: its label shows inline, no buttons, no Retry, no crash (4 ms)
    ✓ ended: its label shows inline, no buttons, no Retry, no crash (4 ms)
    ✓ disabled: its label shows inline, no buttons, no Retry, no crash (4 ms)
    ✓ failed: the label, Retry (the only state with one), and the buttons stay for another try (8 ms)
    ✓ without a summary only the state label shows (a failed read still offers Retry) (3 ms)

Test Suites: 1 passed, 1 total
Tests:       13 passed, 13 total
Snapshots:   0 total
Time:        4.051 s, estimated 6 s
Ran all test suites matching /src\/components\/__tests__\/CommitteeInvitationCard.test.tsx/i.
```
```
$ npx tsc --noEmit
exit 0
$ npx eslint <touched files: CommitteeInvitationCard.tsx, its test, TournamentDetailScreen.tsx, TournamentDetailCommittee.test.tsx, committeeInvitation.ts, its test, defaultLabels.ts>
exit 0 (no output)
$ npm run check:labels

> MeetupMobile@0.0.1 check:labels
> node scripts/check-labels.js

check-labels: OK - 269 files scanned, 1349 default labels checked.
```
`npm run check:labels` first FAILED on `mob.committee_invite.body` (banned term "bare member": the web copy says "committee members"). I added one `banned-term` entry with a reason to `scripts/check-labels.allowlist.json`, the check's documented exclusion file, exactly as tl-c-mobile-2 did for the `mob.tw.committee_*` keys; it then passed (output above is the passing run).
`npm run lint` on the whole repo was not run (the repo has pre-existing errors: 31 errors and 5 warnings on main per tl-c-mobile-2); eslint on touched files only, as asked.

Not run: the full jest suite; any emulator, device or `npm run android/ios/build:aab`; any backend call; conformance review; testing-agent dispatch.

## 5. Test coverage
### Coverage delta
Before (existing `TournamentDetailScreen.test.tsx` + `TournamentRespond.test.tsx` against `origin/main`'s screen, same files, one run):
```
PASS src/screens/__tests__/TournamentDetailScreen.test.tsx (8.908 s)
PASS src/screens/__tests__/TournamentRespond.test.tsx (9.127 s)
----------------------------|---------|----------|---------|---------|---------------------------------------------------------------------------------------------------------
File                        | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s                                                                                       
----------------------------|---------|----------|---------|---------|---------------------------------------------------------------------------------------------------------
All files                   |      40 |    36.92 |   21.95 |   40.95 |                                                                                                         
 TournamentDetailScreen.tsx |      40 |    36.92 |   21.95 |   40.95 | 148,168,187-193,203,211-214,248-252,257-283,288-322,327-348,353-376,387-460,465-490,499,606-617,658-849 
----------------------------|---------|----------|---------|---------|---------------------------------------------------------------------------------------------------------

Test Suites: 2 passed, 2 total
Tests:       16 passed, 16 total
Snapshots:   0 total
Time:        9.734 s, estimated 12 s
Ran all test suites matching /src\/screens\/__tests__\/TournamentDetailScreen.test.tsx|src\/screens\/__tests__\/TournamentRespond.test.tsx/i.
```
| File | Before | After |
|---|---|---|
| `src/screens/TournamentDetailScreen.tsx` | 40.00% stmts / 36.92% branch / 21.95% funcs / 40.95% lines | 54.29% / 48.45% / 31.91% / 55.24% (after-run table above, same two existing test files plus `TournamentDetailCommittee.test.tsx`) |
| `src/components/tournament/CommitteeInvitationCard.tsx` | does not exist | 100% / 100% / 100% / 100% |
| `src/utils/committeeInvitation.ts` | 100% (tl-c-mobile-2) | 100% / 100% / 100% / 100% with `committeeDateRange` |
The rest of the detail screen (register, withdraw, closure, cancel) is old code with no tests; I did not add any.

### Requested tests, individually (all pass, output above)
| Requirement | Test |
|---|---|
| Card renders content and order of the web card | `CommitteeInvitationCard.test.tsx`: "shows the web card content in the web order, re-flowed to one column" |
| One state per label (already_active, closed, not_invited, cancelled, ended, disabled): label inline, no buttons, no Retry, no crash | card test: `it.each` x6; screen test: `it.each` x6 ("the label stays inline on the card, even once the tournament no longer says pending") |
| failed: label, Retry, buttons stay; Retry only for failed | card test: "failed: the label, Retry ..." and "without a summary ..."; screen test: "failed: label and Retry; Retry repeats the same answer" |
| Card cannot be read: failed + Retry reads again; coded refusal on read: label, no Retry | screen tests: "the card cannot be read (network) ...", "the card read refused with a coded state ..." |
| Accept call path (hook mocked) | screen test: "Accept: the hook is called with true, the tournament is re-read with the same correlation id, the card closes" (checks `getTournament`, `getFixtures`, `getRegistrations` all receive `{ correlationId: 'cid-1' }`) |
| Decline call path (hook mocked) | screen test: "Decline: the hook is called with false, the card closes and the plain tournament shows" |
| In flight: both buttons disabled, one busy | card test (accept and decline); screen test: "reports the in-flight answer from the hook to the card" |
| No id rendered | card test: "names people by name and never renders an id"; screen test: "shows at the top ... with the inviter by name and no id" (tournament id and organiser id never appear) |
| Touch targets at least 44pt | card test: "Accept and Decline call their handlers; touch targets are at least 44pt" (Button `size="md"` minHeight is `sizes.touchTarget`, 48) |
| No card when no invitation | screen test: "no invitation: no card and no card read" |
| Tournament not viewable by the invited person: card alone, screen not closed | screen test: "a tournament the invited person cannot view still shows the card ..." |
| Gone tournament, no invitation: closes as before | screen test: "a tournament that is gone and has no invitation closes as before" (asserts no card; the close itself goes through the unchanged `useUnavailableScreen`) |
| Dates value | `committeeInvitation.test.ts`: "committeeDateRange" (2 tests) |
The two existing detail tests still pass (16 tests in the before run, included in the 57 after).

## 6. Proposed Assumptions
1. **Card at the top of the existing screen, tournament view below.** The web page replaces the whole page with the card and offers "View tournament details". The task says "a card at the top of the tournament detail", so the card sits above the normal view and there is no "View tournament details" link (it is a web-only addition, not on the board).
2. **Web crumb ("Notifications") and page title ("Committee invitation") are not repeated.** They are web page chrome; inside the tournament screen the crumb would be wrong and the heading already names the invitation.
3. **Card-only fallback when `GET /tournaments/{id}` is a 404.** The web page does this (`viewTournament`: an invited person outside a group or invite tournament cannot view it; the card read is theirs alone). Mobile does the same: on a 404 it reads the card; if that succeeds the card shows by itself; if not, the screen closes exactly as before. Cost: one extra request when a detail screen 404s.
4. **Card stays up after a refusal** so its label can be read (the refreshed tournament no longer says `pending` after closed/cancelled/etc.). Only a successful answer closes it.
5. **Retry** re-sends the last answer when the failure was the answer, and re-reads the card when the failure was the read. On a failed answer the Accept and Decline buttons also stay (as on web).
6. **Dates in device local time**, day first ("14 - 15 Nov", "30 Nov - 2 Dec"); only the month name follows the device language. The web card uses Asia/Singapore; mobile has no timezone library (see tl-c-mobile-2 item 11).
7. **Shield icon drawn in the card** (white outline on the blue tile) rather than using the generated `ShieldIcon`: that one is a blue shield with literal colours and is hard to see on the blue tile; the board shows a white outline. Stroke colour is `colors.white`.
8. **Sport shown by display name** (`useSportDisplayName`), falling back to the slug when the sports list fails, as the rest of the screen does.

## 7. Deviations from instructions
1. Handoff template and web references read from a fresh read-only clone of `pratheeshku/meetup` (added with `add_repo`); `~/meetup` does not exist in this container.
2. `scripts/check-labels.allowlist.json` edited (one reasoned entry), as in tl-c-mobile-2.
3. The card test file was run twice (act-warning fix); every other file once.
4. Git identity is the repo's configured one (`Claude <noreply@anthropic.com>`); commit and PR text carry no Co-Authored-By or AI attribution, overriding the session's default attribution reminder, as the task says.
5. No screenshots (below).

## Silent items
1. **Missing `docs/agent-handoff-template.md` in this repo** (same as tl-c-mobile-2).
2. **`WebCommitteeAccept` has no html**, so "html for sizes" was not available; sizes below are mine.
3. **No committee name list after accepting.** "Accept shows the active-committee view" is built as: the card closes and the screen re-reads everything with the action's correlation id, so whatever an active committee member gets (`my_invite_access`, Responses, Invite panel, Scoring entry) appears. I did not add a committee list: no board, no label, and `getCommitteeMembers`/`committeeNames` stay unused by this screen (they were delivered in tl-c-mobile-2 for a later task).
4. **No toast** ("You joined the committee." / "You declined...", `web.tca.accepted/declined` on web): not asked for, and it would be two more labels.
5. **Decline in card-only mode** (the person cannot view the tournament): the re-read is a 404, so after a successful decline the screen closes quietly through `useUnavailableScreen.markOwnAction()`; the "plain tournament view" exists only when the person can view the tournament.
6. **Accept in card-only mode:** the re-read normally succeeds (the person is now an active committee member); if it is still a 404 the screen closes with the usual "no longer available" notice.
7. **Backend not called.** The routes are as read from `tournaments/router.py` and the tl-c-accept report; no live call was made.
8. `loadAll` now takes an optional correlation id and passes it to the six reads it already made; with no id it behaves exactly as before.
9. Pre-existing and not mine: `CreateGameScreen.test.tsx` (not run here), 31 lint errors in the repo.

## Values I chose (the web card or the board do not fix them)
Sizes, all from `src/theme/tokens.ts` unless noted. Mobile width 390, screen padding `spacing.md` (16, the screen's own), so the card is 358 wide.
- Card: `colors.surface`, `radius.lg` (16), `borderWidth.thin`, `colors.border`, padding `spacing.md` (16), `shadows.card`, gap `spacing.sm` (8), margin-bottom `spacing.md`.
- Icon tile: fixed 56 x 56 (the web's 56 px), `radius.md` (10), `colors.ctaBlue`; glyph box 28 x 28 (the web's 28), `colors.white` stroke 3.5 in a 48 viewBox.
- Heading `typography.h2` (22/700), body `typography.body` (15), summary box padding 16, `radius.md`, title `typography.bodyBold`, rows: label `colors.textSecondary`, value `typography.bodyBold` right-aligned, row gap 16.
- Buttons: shared `Button` size md (min height 48, the 44pt minimum is met), Accept `cta` variant first, Decline `secondary` second, stacked full width as in the web 390 screenshot; Retry `secondary`.
- State message: `typography.body`, `colors.error`.
- No literal colours anywhere in the new component.
- Eight new label keys (below); `mob.common.retry` reused.

## Screenshots next to the board
**None.** The container has no Android emulator, iOS simulator or device, and bare React Native does not run in a browser here without a dependency I may not add. The screens were exercised with `react-test-renderer` only. Board: `WebCommitteeAccept` 1280x800; web 390 reference: `~/meetup/docs/reports/tl-c-accept/card-390.png`. The look match against both is **not verified**. To produce them: `npm run android` on a 390x844 emulator, open a tournament whose `GET` returns `my_committee_invitation: "pending"`.

## 8. Self-declared confidence per item
| Item | Level | Evidence |
|---|---|---|
| Card content, order, states, Retry rule, no id | **Done and verified** (test-renderer) | `CommitteeInvitationCard.test.tsx`, 13 tests, 100% |
| Accept and Decline paths, one correlation id, re-read, card closes, refusal states kept | **Done and verified** (hook mocked) | `TournamentDetailCommittee.test.tsx`, 17 tests |
| Card-only fallback on a 404 | **Done and verified** (mocked API) | same file, 2 tests |
| `committeeDateRange` | **Done and verified** | `committeeInvitation.test.ts` |
| Labels | **Done and verified** (check passes), seed needed | `check:labels` OK |
| Look, sizes and spacing against the web card/board | **Done, not verified** | no device render |
| Against the real backend, real hook with the real API | **Done, not verified** | the hook is mocked in the screen test; the hook itself is tested in tl-c-mobile-2 |
| Real device behaviour of the busy state and touch targets | **Done, not verified** | token values only |

## 9. Known gaps / follow-ups
- Owner: screenshots on a device/emulator; confirm the web copy "committee members" is acceptable on mobile (allowlisted) or add the term to the glossary.
- Architect: meetup-repo label seed task for the keys below.
- Optional: a toast on answer; a committee list after accepting (needs a board).
- A person who declined has no re-invite route (backend, tl-c-accept report).

## Labels needing a backend seed
New keys (8), `src/labels/defaultLabels.ts`, same pattern as the existing `mob.committee_invite.*`; copy is the web copy (`web.tca.*`) unchanged.

| Key | Default text | Web key |
|---|---|---|
| `mob.committee_invite.heading` | {organizer} invited you to the committee | `web.tca.heading` |
| `mob.committee_invite.heading_anonymous` | You are invited to the committee | `web.tca.heading_anonymous` |
| `mob.committee_invite.body` | {title} needs at least two committee members. As a committee member you can enter scores, review fixtures, and approve big decisions such as publishing fixtures. You are accountable for what you approve. | `web.tca.body` |
| `mob.committee_invite.row_sport` | Sport | `web.tca.row.sport` |
| `mob.committee_invite.row_dates` | Dates | `web.tca.row.dates` |
| `mob.committee_invite.row_organizer` | Organizer | `web.tca.row.organizer` |
| `mob.committee_invite.accept` | Accept and join committee | `web.tca.accept` |
| `mob.committee_invite.decline` | Decline | `web.tca.decline` |

Still unseeded from earlier tasks (not touched here): the 8 states keys `mob.committee_invite.already_active|closed|not_invited|cancelled|ended|disabled|failed|unknown_person` and the 144 `mob.tw.*` keys (tl-c-mobile-2 report), and 5 `mob.add_remove.*` keys.

## Git evidence
(generated last, after the final code commit; the report commit sits above it and is not self-cited)
```
$ git log --oneline origin/main..HEAD   # before the report commit
cf6c0f9 Tournament detail: committee invitation card (accept and decline)

$ git show --stat --format='%h %s' cf6c0f9
cf6c0f9 Tournament detail: committee invitation card (accept and decline)

 scripts/check-labels.allowlist.json                |   6 +
 .../__tests__/CommitteeInvitationCard.test.tsx     | 144 ++++++++++++
 .../tournament/CommitteeInvitationCard.tsx         | 173 +++++++++++++++
 src/labels/defaultLabels.ts                        |   8 +
 src/screens/TournamentDetailScreen.tsx             | 156 ++++++++++++-
 .../__tests__/TournamentDetailCommittee.test.tsx   | 241 +++++++++++++++++++++
 src/utils/__tests__/committeeInvitation.test.ts    |  19 +-
 src/utils/committeeInvitation.ts                   |  25 +++
 8 files changed, 761 insertions(+), 11 deletions(-)

$ git log -1 --format='%an <%ae>%n%B' cf6c0f9   # no Co-Authored-By, no AI attribution
Claude <noreply@anthropic.com>
Tournament detail: committee invitation card (accept and decline)

Shows the WebCommitteeAccept card, re-flowed to one 390-wide column, at the top of the
tournament detail when GET /tournaments/{id} returns my_committee_invitation. Accept and
Decline use useCommitteeInvitationResponse (one correlation id per action, reused for the
re-read), buttons disabled and busy in flight. Accept closes the card and shows the
refreshed tournament; Decline hides the card. Each refusal state keeps its label inline,
Retry only for failed. People by name. Falls back to the card alone when the tournament
cannot be read, as the web page does.
```
`cf6c0f9` is reachable from the branch head. `git diff --stat origin/main -- docs` before the report commit shows nothing (the two new docs files are added in the report commit).
