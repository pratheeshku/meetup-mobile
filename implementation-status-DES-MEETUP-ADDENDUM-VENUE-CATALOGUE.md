## Status — 2026-10-15T20:20:00+08:00
### Completed
- Task vc-m-config: API client types for venues, snapshot, and venue_catalogue_enabled; flag gate [built against spec, integration pending]
  - `src/types/venue.ts` created
  - `src/types/event.ts` updated with venue_id, venue_snapshot, others
  - `src/types/tournament.ts` updated with venue_id, venue_snapshot, others
  - `src/api/config.ts` updated with venue_catalogue_enabled (default false)
  - `src/api/venues.ts` created with endpoints and typed mocks
  - `src/api/__tests__/config.test.ts` (6 tests passing)
  - `src/api/__tests__/venues.test.ts` (10 tests passing)

### In Progress
- Task vc-m-picker: Venue picker on Create game step 3 (`Game3When`) and Edit game step 2 (`EditGame2`)

### Pending
- Task vc-m-others: Others entry (postal code resolves; pending state shown)
- Task vc-m-tournament: Venue picker on tournament Schedule (`TournSched*`) and Edit match (`FXEdit*`)
- Task vc-m-detail: Show venue from snapshot on game and tournament detail; photo strip on `GameDetail`; legacy fallback
- Task vc-m-photos: Organizer photo upload, delete and report

### Blocked
None.
