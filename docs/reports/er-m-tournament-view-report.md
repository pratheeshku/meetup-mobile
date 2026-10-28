# er-m-tournament-view report (step 3.1)

Task ID: `er-m-tournament-view`. Machine: Cloud (agent session), repo root `/home/user/meetup-mobile`. Branch `claude/beautiful-hypatia-1wa00s`, restarted from `origin/main` @ `082e921` (PR #73 was merged; addendum v1.8 present).
Design: `docs/DES-MEETUP-ADDENDUM-tournament-edit-recurring.md` v1.8, AD-1, AD-4, rulings A38 to A41. **No board exists for this change; the addendum is the board of record (A38).**
Scope kept: tournament view paths only. Not touched: committee add/remove and Edit tournament (3.2), Shuffle (3.3), series and push routing for the new types (3.4), `docs/`, package files, native config. No build, no `versionCode`, no version chosen, no agent dispatched.

## 1. What changed (against the 3.0 report)

| Step | Change | Files |
|---|---|---|
| 1 Count, Full chip | Participant surfaces show `{registered_count} registered` and a Full chip when `is_full` is true; cap, "x of y", spots left and progress bar removed from them. Committee keeps `{count} of {max}` and the bar. `registered_count` and `is_full` added to the wire and app types. | `src/components/home/UnifiedCard.tsx` (list card), `src/screens/TournamentDetailScreen.tsx` (v1 meta line), `src/components/tournament/v2/TournamentOverview.tsx` (status cards, Format card), `.../tabs/ParticipantsTab.tsx`, `.../TournamentHeader.tsx` (chip, spots-left line removed), `src/types/tournament.ts`, `src/api/tournaments.ts` |
| 2 Phase | New `registrationStage()`: `open`; `closed`, `committee_only`, `frozen` all read as closed; any other value falls back to the API `registration_open`, then to closed, so the status block is never empty. `registration_open` is read from the API (mapper); Register on the v2 page uses `tournament.registration_open`, no longer the phase string. | `src/utils/tournamentExperience.ts`, `TournamentDetailV2.tsx`, `TournamentDetailScreen.tsx`, `src/api/tournaments.ts` |
| 3 Key dates | Participant: "Registration closes" row (`registration_closes_at`) plus the public rows. "Soft block" and "Hard block" rows only for committee (or an admin, recognised by the API having returned `registration_hard_block_at`); Hard block only when that field was returned. | `TournamentOverview.tsx` |
| 4 Withdrawal | 409 `WITHDRAWAL_LOCKED` on the withdraw attempt shows `mob.reg.err.withdrawal_locked`; also added to `CODE_LABELS`. Nothing else. | `TournamentDetailScreen.tsx`, `src/utils/refusal.ts` |
| 5 Labels | Four bundled defaults, seeded wording (section 4). | `src/labels/defaultLabels.ts` |
| 6 Theme | Existing `Badge` component and theme tokens only; no literal colours; no icon-plus-text rows added. | n/a |

Diff against main (code and tests, before this report):

```
 src/api/tournaments.ts                             | 11 ++-
 .../__tests__/TournamentsListContent.test.tsx      | 14 +++-
 src/components/home/UnifiedCard.tsx                | 11 ++-
 .../tournament/v2/TournamentDetailV2.tsx           |  2 +
 src/components/tournament/v2/TournamentHeader.tsx  | 14 ++--
 .../tournament/v2/TournamentOverview.tsx           | 50 +++++++++---
 .../tournament/v2/tabs/ParticipantsTab.tsx         | 30 +++++---
 src/labels/defaultLabels.ts                        |  4 +
 src/screens/TournamentDetailScreen.tsx             | 28 ++++---
 src/screens/__tests__/TournamentDetailV2.test.tsx  | 88 ++++++++++++++++++++--
 src/screens/__tests__/TournamentTabBodies.test.tsx |  8 +-
 src/types/tournament.ts                            | 11 ++-
 src/utils/refusal.ts                               |  1 +
 src/utils/tournamentExperience.ts                  | 39 +++++++---
 14 files changed, 239 insertions(+), 72 deletions(-)
```

Commits (one per logical change): types/mapper/labels; phase handling; views (count, Full chip, key dates, withdrawal); tests.

## 2. Checks (each run once; raw)

`npx tsc --noEmit`: no output (clean).

`npm run check:labels`:
```
check-labels: OK - 316 files scanned, 1962 default labels checked.
```

`npm run lint` (whole repo): 35 problems (34 errors, 1 warning), **identical to `origin/main`** (diff of the two full outputs is empty). `npx eslint` on the 11 files I touched: no output (clean) on the branch and on main.
```
✖ 35 problems (34 errors, 1 warning)
```

`npx jest`, only the 19 files covering the touched modules (api tournaments, list content and rows, registration labels, the Tournament* screen tests, tournamentExperience, refusal, tournamentTabs):
```
FAIL src/components/home/__tests__/TournamentListRows.test.tsx
FAIL src/screens/__tests__/TournamentTabBodies.test.tsx (8.177 s)
Test Suites: 2 failed, 17 passed, 19 total
Tests:       3 failed, 380 passed, 383 total
```
The 3 failures are the same 3 on `origin/main` when the same single files were run there (main: `3 failed, 106 passed, 109 total` over the 5 suites that touch changed code):
```
  ● Invite type line › a group line opens the existing group pop-up (the Invited sheet) listing every group, without any request
  ● Media upload rights and read-only (tournament-registration AD-6) › committee members (the server sends tabs.approvals) see the upload control
  ● Media upload rights and read-only (tournament-registration AD-6) › the organizer sees the upload control
```
An earlier run showed 11 failures; 8 were old assertions of the behaviour this task removes (cap text, spots left, `Min 6, max 32` and `Hard block` for a participant, closed phase driven by the phase string) and were updated in the test files; one timeout in `TournamentParticipantsPayments` passed on re-run. The full suite was not run.

New tests (in `TournamentDetailV2.test.tsx`, `TournamentsListContent.test.tsx`, updated `TournamentTabBodies.test.tsx`): count and Full chip for a participant (no cap, no Register when full); `registration_open` from the API beats the closing date; phase `closed` and an unknown phase draw a status card; participant Key dates show "Registration closes" and no block rows; organizer sees Soft block, Hard block only when returned; organizer keeps `18 of 32`; participant not shown the cap in the Format card; labelled `WITHDRAWAL_LOCKED` message with the raw server text not shown; list card Full chip.

## 3. Screenshots

**Not produced.** This session has no emulator, device or React Native web target (`react-native-web` is not installed), so the list card, view and Key dates cannot be rendered as images for a participant or an organizer. The evidence offered instead is the rendered text assertions of the tests above (each asserts the visible strings per role). The owner or the Mac session can capture the four screens (list card, view, Key dates; participant and organizer).

## 4. Labels (step 5)

| Key | Default bundled | Source |
|---|---|---|
| `web.tournament.registered_count` | `{count} registered` | `er-config-labels-report.md` §4 / `core/label_fallbacks_tp.py` `ER_WEB_LABELS` |
| `web.tournament.full_chip` | `Full` | same |
| `web.tournament.v2.kd_registration_closes` | `Registration closes` | same |
| `mob.reg.err.withdrawal_locked` | `The organizer has switched off withdrawals for this tournament.` | `ER_WEB_ERR_LABELS` mirrored as `mob.reg.err.*`; seeded by M3 |

## 5. Drift and judgement calls (for the architect)

1. **Label key prefix.** The seed (M3, report §4 and D-4) has `web.*` keys for the count, the Full chip and "Registration closes" and **no `mob.*` equivalents**. A41 says mobile bundles "new `mob.*` label keys with the seeded wording". Rather than invent `mob.*` keys (forbidden) or stop, the screens use the seeded `web.*` keys with the seeded wording, which the app's single `GET /api/labels` map already serves. If the owner wants `mob.*` copies, they need seeding first.
2. **Format card cap hidden for participants.** The 3.0 table listed the Format card ("Max {max}" / entrants rule row) as a cap surface; I hid it for non-committee viewers, since AD-1 says the cap is shown only on the committee participants screen.
3. **Register hidden when `is_full`.** Mirrors the web (`er-web-tournament-report.md` §3); the server still refuses with `TOURNAMENT_FULL`. Not in the step list; it follows from reading `is_full`.
4. **Fallbacks when the API omits a field.** `registration_open`: only a server that does not send it falls back to the old closing-date derivation (`src/api/tournaments.ts`). `registered_count`: no longer falls back to the registrations list length; the count line is hidden when the field is absent (never shows 0).
5. **Admin who is not on the committee** is recognised only by the API having returned `registration_hard_block_at`; UI role checks stay UX.
6. **Left unchanged (not in this task):** the committee note and frozen note in the Participants tab, "Roster frozen {date}" in the closed card (renders only when the field is returned), the other "frozen" copy, `mob.tournament.v2.ov_open_body`, and the now unused labels `mob.tournament.registered_line`, `mob.tournament.v2.register_spots_left`, `mob.tournament.v2.ov_progress` (still used by the committee view), `mob.tournament.participants.registered_of`.
7. **Pre-existing failures** (3 tests) and lint errors (34) are untouched.

No CRITICAL or HIGH gap; no Blocked Report. Nothing is self-certified; the architect rates this report.
