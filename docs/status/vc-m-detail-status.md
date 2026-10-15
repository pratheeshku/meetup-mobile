# Status — vc-m-detail

**Task ID**: `vc-m-detail`  
**Description**: Show venue from the snapshot on game and tournament detail; shared and organizer photo strip on `GameDetail`; legacy fallback.  
**Status**: Completed  
**Timestamp**: 2026-10-15T21:00:00+08:00  

### Completed
- Created reusable `VenueDetailCard` component (`src/components/venue/VenueDetailCard.tsx`) implementing:
  - Reads venue details strictly from `VenueSnapshot`: name, address line (`block` + `street` or `address`), and "Listed hours" (when `operating_hours` present).
  - External link button "More information" when `info_url` is present (`http(s)` only).
  - Fixed pin map card when coordinates (`lat`, `lng`) exist, with caption `"Pin set from the venue address"`.
  - Fallback to legacy plain venue text / label when snapshot is absent or empty.
  - "Venue photos" strip displaying fresh signed photo URLs on load without caching.
  - Photo viewer modal with full image view.
  - Integrated into `EventDetailScreen` behind `venue_catalogue_enabled` gate.
  - Integrated into `TournamentDetailScreen` behind `venue_catalogue_enabled` gate.
- Unit tests written and verified: `src/components/venue/__tests__/VenueDetailCard.test.tsx` (tests for snapshot rendering, address, hours, info link, fixed pin, legacy fallback, and uncached photo loading).
- TypeScript check passes clean (`npx tsc --noEmit` exited 0).
- ESLint passes clean.

### Pending / Integration
- Integration pending backend deployment of `GET /venues/{id}` and snapshot data in games/tournaments. Built against spec with typed mocks.
