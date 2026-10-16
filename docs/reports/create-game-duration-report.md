# create-game-duration report

Branch: `feat/create-game-duration-email-invites-tournament-card` (from `origin/main`).

## Files changed
- `src/utils/gameDuration.ts` (new): options 1-8 hrs, default 2, `computeEndsAtIso(start, hours)` = start + whole hours as an absolute instant, same UTC ISO form as `starts_at` (so midnight/DST need no special handling).
- `src/screens/CreateGameScreen.tsx`: Duration `DropdownField` under the date/time in step 3, **games only** (`mode === 'game'`); submit sends `ends_at = starts_at + duration` (always after `starts_at`); step 6 review and the completion "Date and time" row show the range via the existing `formatEventTimeRange(start, end)`. Tournament payloads untouched (no `ends_at`).
- `src/types/event.ts`: `CreateEventInput.ends_at: string | null` (was `null`); comment in `src/api/events.ts` updated.
- `src/labels/defaultLabels.ts`: new keys `mob.create_game.duration_label`, `duration_hours_one` ("{count} hr"), `duration_hours_other` ("{count} hrs").
- Tests: `src/screens/__tests__/CreateGameDuration.test.tsx` (14); `LegacyVenuePayloadContracts.test.tsx` updated (expected `ends_at: null` is now start + 2 hrs).

## Tests (raw)
```
CreateGameDuration.test.tsx: Tests: 14 passed, 14 total
 ✓ offers 1-8 hours with 2 hrs selected by default
 ✓ sends ends_at = starts_at + 2 hrs by default, after starts_at
 ✓ sends starts_at + 1..8 hr(s) when chosen (8 cases)
 ✓ crosses midnight correctly (default 19:30 start + 8 hrs ends the next day at 03:30)
 ✓ shows the end time in the review and on the completion screen
 ✓ tournaments: no Duration field, no ends_at in createTournament
```

## Checks
- `npm run check:labels`: OK - 206 files scanned, 944 default labels checked.
- `npx tsc --noEmit`: clean. `npx eslint` on all changed files: clean.
- Full suite on this branch: `Test Suites: 15 failed, 122 passed, 137 total` / `Tests: 177 failed, 1455 passed, 1632 total`. `origin/main`: `15 failed suites / 177 failed tests`. The failing-suite lists are identical (diff empty); the branch adds 7 passing suites and 40 passing tests across the four tasks.
- No screenshots: no emulator/device in this container.

## Deviations
- Game detail already formats `ends_at` through `formatEventTimeRange`; game cards show the start time only (no `ends_at` formatting exists), so I did not change either.
- The review row now uses the device-locale formatter (`formatEventTimeRange`) for games instead of the previous fixed en-US format, to match the completion screen.
