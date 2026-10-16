## Status — 2026-10-15T21:40:00+08:00
### Completed
- `vc-m-config`: Types, config flag gate, and API client. (Commit `6afa185`, runtime mock fallbacks removed in `5c6575f`)
- `vc-m-picker`: Venue picker on Create game step 3 (`Game3When`) and Edit game step 2 (`EditGame2`).
- `vc-m-others`: Others entry with 6-digit postal code resolution and pending geocode state.
- `vc-m-detail`: Venue snapshot display on game and tournament detail; fresh signed photo strip on `GameDetail`; legacy fallback.
- `vc-m-photos`: Organizer photo upload with ownership statement, delete, and neutral viewer report.

### In Progress
- Final verification and reporting.

### Pending
- None.

### Blocked
- `vc-m-tournament`: BLOCKED-pending-lifecycle-mobile. Tournament creation is wired with the 46px compact tournament `VenuePicker` (`POST /tournaments`), but tournament schedule/edit screens and per-match venue mutation endpoints (`TournSched*`, `FXEdit*`) are not part of `DES-MEETUP-ADDENDUM-VENUE-CATALOGUE` §4 or the backend API and belong to the Tournament Lifecycle mobile work (`DES-MEETUP-ADDENDUM-tournament-lifecycle`). Placeholder `EditMatchModal` removed; awaiting lifecycle mobile implementation.
