## Status — 2026-10-15T20:40:00+08:00
### Completed
- Task vc-m-config: API client types for venues, snapshot, and venue_catalogue_enabled; flag gate [built against spec, integration pending]
  - `src/types/venue.ts` created
  - `src/types/event.ts` updated with venue_id, venue_snapshot, others
  - `src/types/tournament.ts` updated with venue_id, venue_snapshot, others
  - `src/api/config.ts` updated with venue_catalogue_enabled (default false)
  - `src/api/venues.ts` created with endpoints and typed mocks
  - `src/api/__tests__/config.test.ts` (6 tests passing)
  - `src/api/__tests__/venues.test.ts` (10 tests passing)
- Task vc-m-picker: Venue picker on Create game step 3 (`Game3When`) and Edit game step 2 (`EditGame2`) [built against spec, integration pending]
  - `src/theme/tokens.ts` semantic venue colors added
  - `src/labels/fallbackLabels.ts` venue fallback labels added
  - `src/components/venue/VenueIcons.tsx` created
  - `src/components/venue/VenuePicker.tsx` created
  - `src/screens/CreateGameScreen.tsx` step 3 integrated with VenuePicker behind flag gate
  - `src/screens/EventDetailScreen.tsx` edit step 2 integrated with VenuePicker behind flag gate
  - `src/components/venue/__tests__/VenuePicker.test.tsx` (7 tests passing)
- Task vc-m-others: Others entry (postal code resolves; pending state shown) [built against spec, integration pending]
  - `src/components/venue/OthersVenueModal.tsx` created with 6-digit postal code validation, facility chips, and pending geocode display
  - `src/components/venue/__tests__/OthersVenueModal.test.tsx` (4 tests passing)

### In Progress
- Task vc-m-tournament: Venue picker on tournament Schedule (`TournSched`, `TournSchedErr`, `TournSchedWarn`) and Edit match (`FXEdit*`)

### Pending
- Task vc-m-detail: Show venue from snapshot on game and tournament detail; photo strip on `GameDetail`; legacy fallback
- Task vc-m-photos: Organizer photo upload, delete and report

### Blocked
None.
