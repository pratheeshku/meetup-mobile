# Status: vc-m-tournament

**Started**: 2026-10-15T20:41:00+08:00
**Last updated**: 2026-10-15T21:40:00+08:00
**Last updated by**: Senior Full-Stack Developer
**Design doc reference**: DES-MEETUP-ADDENDUM-VENUE-CATALOGUE v1.0, §4, §5; Boards: `TournSched`, `TournSchedErr`, `TournSchedWarn`, `FXEdit*`

## Current step
BLOCKED-pending-lifecycle-mobile

## Status
BLOCKED — cannot proceed safely.
Missing: Tournament schedule and match edit screens/endpoints. Per-match catalogue venue editing is not in DES-MEETUP-ADDENDUM-VENUE-CATALOGUE §4 or the backend API. Boards `TournSched*` and `FXEdit*` belong to the Tournament Lifecycle mobile work (`DES-MEETUP-ADDENDUM-tournament-lifecycle`), which has not been implemented in the mobile app yet.
Investigated:
- `src/screens/TournamentDetailScreen.tsx` — only displays tournament details, registrations, and read-only fixtures; has no tournament edit screen or per-fixture edit mutation endpoint.
- `src/screens/CreateGameScreen.tsx` — tournament creation exists (`POST /tournaments`), wired with 46px compact tournament `VenuePicker` (`variant="tournament"`).
- Backend API contract in `DES-MEETUP-ADDENDUM-VENUE-CATALOGUE` §4 defines `GET /venues`, `GET /venues/{id}` (shared images), `GET /venues/postal/{code}`, `POST /games/{id}/venue-images`, `POST /tournaments/{id}/venue-images`, `DELETE /venue-images/{id}`, and `POST /venue-images/{id}/report`. There is no `/venues/{id}/photos`. No per-match fixture venue endpoint exists in §4 or backend API.
Required to unblock: Implementation of Tournament Lifecycle mobile work (`DES-MEETUP-ADDENDUM-tournament-lifecycle`) defining tournament schedule editing (`TournSched*`) and match editing (`FXEdit*`) along with corresponding backend endpoints.

## Files touched
| File | Action | Status |
|---|---|---|
| src/components/venue/VenuePicker.tsx | modified | 46px compact tournament variant built |
| src/screens/CreateGameScreen.tsx | modified | Tournament creation wired with tournament VenuePicker |
| src/components/tournament/EditMatchModal.tsx | deleted | Removed (per-match edit belongs to lifecycle mobile work) |
| src/components/tournament/__tests__/EditMatchModal.test.tsx | deleted | Removed |
| src/screens/TournamentDetailScreen.tsx | modified | Reverted placeholder fixture editing wiring |
| docs/status/vc-m-tournament-status.md | modified | BLOCKED-pending-lifecycle-mobile |
