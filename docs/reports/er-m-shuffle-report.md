# er-m-shuffle report (step 3.3)

Task ID: `er-m-shuffle`. Machine: Cloud (agent session), repo root `/home/user/meetup-mobile`. Branch `claude/beautiful-hypatia-1wa00s`, restarted from `origin/main` @ `ccd2c7a` (addendum v1.10; PRs #75 and #77 merged).
Design: `docs/DES-MEETUP-ADDENDUM-tournament-edit-recurring.md` v1.10, AD-7 (Shuffle again) and rulings A38 to A51. **No board exists; the addendum is the board of record (A38).** Screenshots are taken later on the Mac (A45); none are attached.
Scope kept: committee/edit screens, series, push routing, native config, package files and `docs/` (other than this report) untouched. No version chosen, no build, no force-push, no agent dispatched.

## 1. What was built

| Step | Change | Files |
|---|---|---|
| 1 Shuffle again | In the draft card of the committee Fixtures setup, shown while the latest draft is open (`status: draft`): a "Shuffle again" button with the hint. It calls `POST /tournaments/{id}/fixtures/shuffle` with **no body** under one `withCorrelationId()`. The answer's draft replaces the group list shown (the web's Groups card), then the host re-reads the page. The committee-only rule is the setup screen's own; the route is committee-only on the server. | `src/components/tournament/v2/tabs/FixturesSetup.tsx`, `src/api/tournaments.ts` (`shuffleFixtureDraft`) |
| 2 No counter unless returned | "Draw {n} of {total}." shows only when the answer carries `shuffle {index, total}`; otherwise the existing "Draft created." The client computes no draw counts or balance. The button is also disabled, with the single-draw text, when the draft's own payload says `shuffle_total <= 1` (the web reads the same key; a fresh draft carries none, A40, so the server answers then). | `FixturesSetup.tsx`, `src/utils/fixturesSetup.ts`, `src/types/tournamentTabs.ts` |
| 3 Errors | `SHUFFLE_UNAVAILABLE` (`reason` ignored) shows its label; 429 shows the existing rate-limit label; `FIXTURE_FROZEN` shows the existing fixtures label; anything else the generic label. The server `detail` is never shown. The button is disabled and a second tap ignored while a request runs. | `src/utils/refusal.ts`, `FixturesSetup.tsx` |
| 4 Group plus knockout only | Decided by the server: a refusal shows the labelled message. | n/a |
| 5 Types and client | `ShuffleResult`, `shuffleFixtureDraft`, and `shuffleIndex`/`shuffleTotal` on `DraftDetail` read from the payload. No new endpoint. | see above |
| 6 Labels | Seeded keys and wording only (section 4). | `src/labels/defaultLabels.ts` |
| 7 Rules | Theme tokens and the shared `Button` only; no literal colours; no icon-plus-text rows added. | n/a |

Diff against main (code and tests, before this report):

```
 src/api/tournaments.ts                             | 18 ++++-
 .../tournament/v2/tabs/FixturesSetup.tsx           | 57 +++++++++++++-
 src/labels/defaultLabels.ts                        |  5 ++
 .../__tests__/TournamentFixturesSetup.test.tsx     | 90 ++++++++++++++++++++++
 src/types/tournamentTabs.ts                        | 12 +++
 src/utils/fixturesSetup.ts                         |  2 +
 src/utils/refusal.ts                               |  1 +
 7 files changed, 183 insertions(+), 2 deletions(-)
```

Commits: client, types, draft shuffle keys, labels and code mapping; the screen action with its tests.

## 2. Checks (each once; raw)

`npx tsc --noEmit`: no output (clean).

`npm run check:labels`:
```
check-labels: OK - 319 files scanned, 1988 default labels checked.
```
No allowlist entry was needed (no seeded text trips the glossary).

`npm run lint` (whole repo): `✖ 35 problems (34 errors, 1 warning)`, **identical to `origin/main`** (diff of the full outputs empty); no problem in a touched file.

`npx jest`, only the 6 files covering the touched modules (`TournamentFixturesSetup`, `TournamentTabBodies`, `fixturesSetup`, `refusal`, api `tournaments`, `TournamentScoringScreen`):
```
FAIL src/screens/__tests__/TournamentTabBodies.test.tsx (8.29 s)
Test Suites: 1 failed, 5 passed, 6 total
Tests:       2 failed, 143 passed, 145 total
```
The 2 failures are the same 2 that fail on `origin/main` (seen on main in steps 3.1 and 3.2, untouched here):
```
  ● Media upload rights and read-only (tournament-registration AD-6) › committee members (the server sends tabs.approvals) see the upload control
  ● Media upload rights and read-only (tournament-registration AD-6) › the organizer sees the upload control
```
The full suite was not run.

New tests (`TournamentFixturesSetup.test.tsx`, 7 cases): route called with no body and one correlation id, new groups shown, "Draw 2 of 28." from the answer; no counter and a disabled button while the request runs (a second tap sends nothing); `SHUFFLE_UNAVAILABLE`, 429 and `FIXTURE_FROZEN` show labels and never the raw text, button usable again; single-draw draft disables the button with the single text; no button when the latest draft is published.

## 3. Screenshots

Not taken: no emulator in the cloud session. Taken on the Mac at the 4.3 device test and attached to the 3.6 review (A45).

## 4. Labels (seeded keys, seeded wording; `er-config-labels-report.md` §4 / M3)

`web.console.shuffle.button` "Shuffle again"; `web.console.shuffle.hint` "Shows the next balanced draw. The strongest players stay in separate groups."; `web.console.shuffle.done` "Draw {n} of {total}."; `web.console.shuffle.single` "This is the only balanced draw for this tournament."; `mob.reg.err.shuffle_unavailable` "There is no other balanced draw to show, or the draft can no longer be shuffled." As in 3.1 and 3.2 (A43) the `web.*` seeded keys are used where no `mob.*` copy is seeded. Existing keys reused: `mob.reg.err.rate_limited`, `mob.scoring.err.FIXTURE_FROZEN`, `mob.scoring.draw.generated_ok`, `mob.scoring.error.generic`. `web.console.shuffle.groups_title` ("Groups") is seeded but not bundled: the draft card already lists the groups under its own headings. No key renamed or invented; every needed key was seeded.

## 5. Drift and judgement calls (for the architect)

1. **Placement.** The addendum gives no mobile layout (A38). The action sits inside the existing draft card, between the group list and the submit or waiting block, offered while the latest draft is open. It is also shown while a publication request is pending, as on the web; the server leaves a pending request to fail stale by payload hash (shuffle report D-6).
2. **"n of N".** The answer does return `shuffle {index, total}`, so the counter is shown from it (the web does the same). After the page re-reads, the counter is not kept (the web behaves the same); only a draft that a shuffle made carries `shuffle_total` in its payload.
3. **Single-draw disable.** Reads `payload.shuffle_total` of the displayed draft; nothing is computed. A fresh draft has none, so the button stays enabled and the server answer decides (A40).
4. **Not confirmed.** No confirmation dialog before shuffling (the task says confirm nothing the server guards; the old draft is kept as a superseded version on the server).
5. **Pre-existing** failures (2 tests) and lint errors (34) are untouched.

No CRITICAL or HIGH gap; no Blocked Report. Nothing is self-certified; the architect rates this report.
