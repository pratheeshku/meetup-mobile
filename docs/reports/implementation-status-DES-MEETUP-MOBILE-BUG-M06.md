## Status — 2026-09-24T00:30:00Z (BUG-M06) — COMPLETE

### Completed
- `src/utils/homeDashboard.ts`: added `getSportOptionsFromAdminSports(sports)`,
  mapping admin `Sport[]` → `SportOption[]` (key from `sportKey(sport.name)`,
  label from `sport.display_name` as-is, emoji from the existing
  `sportEmoji()`/`SPORT_EMOJI` map — architect-directed reuse, unblock
  confirmed no extension/new map). `getSportOptions(events)` kept
  untouched as a pure selector / test fixture helper (no longer
  HomeScreen's pill source).
- `src/screens/HomeScreen.tsx`: pill row now sourced from `getSports()`
  (`GET /admin/sports/public`) instead of `getSportOptions(events)`.
  Fetched under the same correlation ID as events/groups (§3.12), on every
  load including pull-to-refresh. A failed fetch swallows to `[]`
  (pill row degrades to "All" only), same pattern as the groups tile.
  "All" remains first/default-selected. The existing "selected sport has
  no matching pill -> fall back to All" guard now checks the admin-sourced
  list instead of the feed-derived one (still needed for the skill-level
  pre-select case).
- Tests updated/added: `src/utils/__tests__/homeDashboard.test.ts`
  (new `getSportOptionsFromAdminSports` suite), `src/screens/__tests__/HomeScreen.test.tsx`
  (default `ADMIN_SPORTS` fixture incl. a sport with zero feed events;
  rewrote the pill-row, empty-feed, and refresh-fallback tests for the new
  admin-sourced behaviour; added sports-fetch-failure, correlation-ID, and
  refetch-cadence coverage).
- `ProfileScreen.tsx` and `docs/` untouched (verified via `git diff --name-only`).

### In Progress
- None.

### Pending
- None for this ticket's scope.

### Blocked
- None (unblocked by architect direction: reuse `SPORT_EMOJI` as-is,
  `DEFAULT_SPORT_EMOJI` fallback accepted for admin sports outside the
  5-entry map, `labels.ts` confirmed out of scope).
