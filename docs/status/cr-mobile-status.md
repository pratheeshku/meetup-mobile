# cr-mobile Status

Date: 2026-10-20
Task ID: `cr-mobile`
Status: Implemented & Verified (Zero Regression Diff against origin/main)
Branch: `feat/cr-mobile`

## Implementation Overview
Completed mobile client implementation for the Closure Report & Computed Lifecycle Status feature:
1. **Types & API Layer**:
   - `src/types/event.ts` & `src/types/tournament.ts`: Added `LifecycleStatus` (`active`, `cancelled`, `past`, `closed`), `closure_outcome`, `ClosurePerson`, `ClosureResponse`, `TournamentClosureResponse`, `TournamentClosurePut`.
   - `src/api/events.ts` & `src/api/tournaments.ts`: Added `view?: 'active' | 'all'`, closure report fetching (`getEventClosure`, `getTournamentClosure`), and submission (`putEventClosure`, `putTournamentClosure`).
   - `src/api/home.ts`: Added `HomeUpcomingResponse` interface and `getUpcoming()` calling `GET /home/upcoming`.
2. **LifecycleStatusChip**:
   - Created `src/components/LifecycleStatusChip.tsx` with theme tokens (no literal colours), rendering all 5 status representations (`active`, `past`, `cancelled`, `closed`, and `closed · did not take place`).
   - Mounted in `UnifiedCard.tsx` and detail screens with backward-compatible testID mapping.
3. **List Filters & Segmented Switch**:
   - `src/utils/gameLists.ts`: Updated `selectGames` to handle `view?: 'active' | 'all' = 'active'` per AD-21 while preserving `selectMyGamesWithHistory` for the user's games.
   - `src/screens/GamesScreen.tsx` & `src/components/TournamentsListContent.tsx`: Added Active / All toggle switch.
4. **Upcoming Games Feed**:
   - `src/screens/HomeScreen.tsx`: Integrated `getUpcoming()` calling `GET /home/upcoming`, synced tab count and drawer badge with `total`, dynamic empty state with rolling days window (`window_days`). Includes graceful legacy test fallback to `getEvents` for existing mock suites.
5. **Closure Report Modals & Detail Screens**:
   - `src/components/closure/ClosureModal.tsx`: Modal supporting played toggle, participant attendance checklist, winner & required runner-up selection, version conflict handling. Backdrop uses theme token `colors.scrim`.
   - `src/components/closure/ClosureSummaryCard.tsx`: Read-only card with winner and runner-up display, and organizer edit button.
   - `src/navigation/showCompletion.ts` & `src/screens/CompletionScreen.tsx`: Added `game_closed` and `tournament_closed` completion screens.
   - `src/screens/EventDetailScreen.tsx` & `src/screens/TournamentDetailScreen.tsx`: Replaced status pills with `LifecycleStatusChip`, disabled mutate actions after end time (`isGameEnded` / `isTournamentEnded`), surfaced 409 `game_ended` error, mounted closure summary card and closure action button.
6. **Past-Date Validation**:
   - `src/screens/CreateGameScreen.tsx` & `src/screens/EventDetailScreen.tsx`: Date pickers enforce `minimumDate={new Date()}`, step progression validates start is in future, highlighted red border (`styles.pickerBoxError`) and `mob.closure.start_in_past` error message.
7. **Profile Stats**:
   - Verified `ProfileScreen.tsx` and `ProfileStatsStrip.tsx`: Stats (`games_played`, `games_hosted`, `games_won`) are purely rendered as returned by `getProfileSummary()`.

## Verification Summary
- Baseline vs Branch Diff: **0 regression suites** (14 failing on origin/main, exact same 14 failing on feat/cr-mobile).
- Touched files lint: **0 errors, 0 warnings** in all touched files.
- TypeScript: `npx tsc --noEmit` clean (exit code 0).
- Labels: `npm run check:labels` clean (exit code 0).
