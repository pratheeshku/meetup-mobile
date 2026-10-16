# dashboard-profile-stats report

Branch: `feat/dashboard-stats-tournament-card` (from `origin/main`).

## Files changed
- `src/components/ProfileStatsStrip.tsx` — new shared component: the exact strip moved out of Profile (same IconBadge + count + label styling, same tokens). Columns are `flex: 1` with dividers, so 3 and 4 tiles both fill the card. Fourth "Won" tile (purple IconBadge + `MedalIcon`, count in `colors.textPrimary`) renders only when `gamesWon` is a number > 0.
- `src/screens/HomeScreen.tsx` — calls the existing `getProfileSummary()` (`GET /users/me/profile-summary`) as part of the dashboard dynamic load (no new API, not awaited by first paint). The block renders directly below the banner carousel and above the tab tiles when data arrives; on failure state is cleared and the block is hidden with no banner/error. Because it is part of `loadDynamicHomeData`, pull-to-refresh, the foreground throttle (30 s) and the re-entrancy guard apply unchanged.
- `src/screens/ProfileScreen.tsx` — stats strip, its styles and now-unused imports removed; recent games section kept; the summary is still fetched for recent games.
- `src/api/profile.ts` — `ProfileSummary.games_won?: number` (optional; per your brief the field may be absent).
- `src/labels/defaultLabels.ts` — **one new key**: `mob.profile.stat_won` = "Won".
- Tests (new): `src/screens/__tests__/HomeStatsStrip.test.tsx` (7), `src/screens/__tests__/ProfileNoStats.test.tsx` (1).

## Tests (raw)
```
PASS src/screens/__tests__/ProfileNoStats.test.tsx
PASS src/screens/__tests__/HomeStatsStrip.test.tsx
Tests: 8 passed, 8 total
```
Covers: strip below the banner and above the tab tiles; absent from Profile (recent games still shown); 3 tiles with `games_won` absent; 3 tiles for `games_won: 0`; 4 tiles for `games_won: 5`; silent hide on failure; Home not blocked while the call is pending; pull-to-refresh refetches and updates.

## Checks
- `npm run check:labels`: `OK - 203 files scanned, 933 default labels checked.`
- `npx tsc --noEmit`: clean.
- `npx eslint` on the changed files: clean.
- Full suite: `Test Suites: 15 failed, 116 passed, 131 total` / `Tests: 180 failed, 1399 passed, 1579 total`. `origin/main` baseline: 15 suites / 180 tests failed. Same pre-existing failures; +2 suites and +8 passing tests from this task.

## Deviations / notes
- "Directly below the top banner": the shipped Home is Shuttlr Home v2 (top bar, banner carousel, tab tiles). The addendum's older AD-1 order (next-game card overlapping the banner) is not what the screen renders, so I placed the strip between the banner carousel and the tab tiles, with `spacing.md` side padding and top margin to match the tab tiles.
- On failure of a *refresh*, the block is hidden (state cleared), following "on failure hide the block silently", rather than keeping stale numbers.
- Won tile count colour uses `colors.textPrimary`; there is no purple text token and I did not add one.
- Existing `ProfileScreen.test.tsx` / `HomeScreen.test.tsx` were already failing on main and were not modified.
- No screenshots: no emulator/device in this container.
