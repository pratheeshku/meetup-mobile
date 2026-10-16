# tournament-card-like-games report

Branch: `feat/create-game-duration-email-invites-tournament-card` (from `origin/main`). Status: **done** (previous blocked status removed; backend now returns `registered_count` and `my_registration_status`).

## Files changed
- `src/api/tournaments.ts` — mapper reads `registered_count` -> `participant_count`, `my_registration_status` -> `current_user_registration_status`, `venue_name/venue_label/venue_id/venue_snapshot`, `registration_closes_at`. `null`/absent count or status stay `null` (unknown), never 0 / `'none'`. `is_organiser` = `organizer_id === currentUserId` via new optional `getTournaments({ currentUserId })`. The single-tournament endpoint does not carry the list-only fields, so they map to `null` there (detail screen already recomputes locally).
- `src/types/tournament.ts` — `participant_count: number | null`, `current_user_registration_status: ... | null`, `registration_closes_at?`.
- `src/components/home/UnifiedCard.tsx` — new `UnifiedTournamentCard` + `TournamentRegistrationBadge` next to `UnifiedGameCard`, reusing `UnifiedCard`, `DateBlock`, icon rows, status-pill styles. Rows: clock + date/time, map pin + venue (falls back to existing "Location TBC"), people icon + "{sport} · {format}", status line. Count on the right (`{n}/{max} registered`) only when known. Button "View tournament" reuses existing key `mob.done.btn_view_tournament`. Registration badge: Not Registered takes the game `Open` highlighted look; Registered/Withdrawn the default pill. No skill pill, no "via group", no avatars (list has no photos).
- `src/components/TournamentsListContent.tsx` — renders `UnifiedTournamentCard`; passes the signed-in user id for `is_organiser`. Tap -> `onOpenTournament`, pull-to-refresh, empty/loading/error and `refreshKey` path unchanged.
- Tests: `src/components/__tests__/TournamentsListContent.test.tsx` (+9 incl. fields, 3 badge states, null handling, zero count, tap, empty, no per-row calls), `src/api/__tests__/tournaments.test.ts` (+3 mapper tests; one assertion updated from `'none'` to `null`).
- No new label keys.

## Checks
- `check:labels`: OK, 204 files, 933 default labels. `tsc`: clean. `eslint` on changed files: clean.
- Targeted: `GamesScreen`, `TournamentsListContent`, `tournaments` api tests pass.
- Full suite: branch `15 failed suites / 177 failed tests`; `origin/main` `15 failed suites / 177 failed tests`; identical failing-suite list (diff empty).

## Deviations
- The status line (`Status: upcoming`) is kept on every card, as before, so existing behaviour/test is unchanged.
- `registration_closes_at` is mapped but not displayed (would need a new label); not requested for the card.
- Backend field names/values (`registered_count`, `my_registration_status` in `none|registered|withdrawn`) taken from your brief; not independently verifiable from this repo.
- No screenshots: no device in this container.
