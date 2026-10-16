# Status — vc-m-photos

**Task ID**: `vc-m-photos`  
**Description**: Organizer photo upload, delete, and neutral viewer report.  
**Status**: Completed  
**Timestamp**: 2026-10-15T21:00:00+08:00  

### Completed
- Implemented photo management capabilities in `VenueDetailCard` (`src/components/venue/VenueDetailCard.tsx`):
  - "Add venue photos" entry row visible strictly to organizers (`isOrganiser === true`).
  - Upload modal accepting image URL/file for JPEG, PNG, and WebP types.
  - Mandatory ownership confirmation statement checkbox before upload button is enabled: `"I confirm that I own or have permission to upload this photo."`.
  - Sends ownership confirmation (`confirmedOwnership: true`) along with photo to `POST /games/{id}/venue-images` or `POST /tournaments/{id}/venue-images`.
  - Rejection errors from server displayed directly to user.
  - In photo viewer modal:
    - Neutral "Report" action available for all viewers, submitting `POST /venue-images/{id}/report` and displaying neutral confirmation without revealing reporter identity.
    - "Delete" action available for organizer/committee, executing `DELETE /venue-images/{id}` and updating local photo strip immediately.
  - Zero photo attribution displayed anywhere in the UI (no author name, uploader avatar, or upload timestamp).
- Unit tests written and verified: `src/components/venue/__tests__/VenueDetailCard.test.tsx` (tests for organizer-only add button, ownership confirmation check, game photo upload, tournament photo upload, delete, and neutral viewer report).
- TypeScript check passes clean (`npx tsc --noEmit` exited 0).
- ESLint passes clean.

### Pending / Integration
- Integration pending backend deployment of `POST /games/{id}/venue-images`, `POST /tournaments/{id}/venue-images`, `DELETE /venue-images/{id}`, and `POST /venue-images/{id}/report`. Built against spec with typed mocks.
