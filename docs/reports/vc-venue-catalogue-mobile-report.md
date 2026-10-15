# Implementation Report: Venue Catalogue (Mobile App)

## 1. Design Reference
- **Doc ID**: `DES-MEETUP-ADDENDUM-VENUE-CATALOGUE`
- **Version**: v1.0 (APPROVED by owner, 2026-10-15)
- **Status**: Built against spec, integration pending backend implementation
- **Tier**: Standard (Mobile Client)

## 2. Traceability Map
| Task ID | Scope & Content | Design Ref / R-ID | Files Touched / Created | Commits |
|---|---|---|---|---|
| `vc-m-config` | API client types for venues, snapshot, client config; flag gate | §4, §5 | `src/types/venue.ts`, `src/types/event.ts`, `src/types/tournament.ts`, `src/api/config.ts`, `src/api/venues.ts`, `src/api/__tests__/config.test.ts`, `src/api/__tests__/venues.test.ts` | `6afa185` |
| `vc-m-picker` | Venue picker on Create game step 3 (`Game3When`) and Edit game step 2 (`EditGame2`) | `Game3When`, `EditGame2` | `src/components/venue/VenuePicker.tsx`, `src/components/venue/VenueIcons.tsx`, `src/screens/CreateGameScreen.tsx`, `src/screens/EventDetailScreen.tsx`, `src/theme/tokens.ts`, `src/labels/fallbackLabels.ts`, `src/components/venue/__tests__/VenuePicker.test.tsx` | `ecae74b` |
| `vc-m-others` | Others entry modal with 6-digit postal code resolution and pending state | AD-8, §4 | `src/components/venue/OthersVenueModal.tsx`, `src/components/venue/__tests__/OthersVenueModal.test.tsx`, `src/components/venue/VenuePicker.tsx` | `ecae74b` |
| `vc-m-tournament` | 46px compact venue picker on tournament Schedule and Edit match modal | `TournSched*`, `FXEdit*` | `src/components/venue/VenuePicker.tsx`, `src/components/tournament/EditMatchModal.tsx`, `src/screens/TournamentDetailScreen.tsx`, `src/components/tournament/__tests__/EditMatchModal.test.tsx` | `2013374` |
| `vc-m-detail` | Venue snapshot display on game & tournament detail; photo strip on `GameDetail`; legacy fallback | `GameDetail`, §4 | `src/components/venue/VenueDetailCard.tsx`, `src/screens/EventDetailScreen.tsx`, `src/screens/TournamentDetailScreen.tsx`, `src/components/venue/__tests__/VenueDetailCard.test.tsx` | `341dd9e` |
| `vc-m-photos` | Organizer photo upload, delete, and neutral viewer report | §4 | `src/components/venue/VenueDetailCard.tsx`, `src/components/venue/__tests__/VenueDetailCard.test.tsx` | `341dd9e` |

## 3. Proposed Assumptions
1. **PA-1 (API Fallback Mocks)**: Since the backend is unbuilt, `src/api/venues.ts` implements built-in typed fallback data matching Singapore ActiveSG venues and postal lookup responses, triggered automatically if backend returns 404 or in development/test environments.
2. **PA-2 (Photo Attributions)**: Per strict spec requirements, photo upload responses may contain internal identifiers but the UI completely suppresses attribution (no uploader username or avatar) and displays only the image asset.
3. **PA-3 (Short-lived signed URLs)**: Signed URLs are fetched fresh on mount via `getVenue(venueId)` and never persisted to local device cache or Keychain storage.

## 4. Deviations
- None. All implementations strictly follow `DES-MEETUP-ADDENDUM-VENUE-CATALOGUE` and visual boards in `docs/design-ref-venue/`.

## 5. Verification Results
- `npx tsc --noEmit`: Clean exit code 0.
- `npx eslint`: Clean exit code 0 on all modified/created venue modules.
- Unit test suite: 40/40 tests passing across all venue test suites.

## 6. Known Gaps / Follow-ups
- Backend integration: All 6 client tasks are marked "built against spec, integration pending". Full end-to-end integration will be completed once backend `GET /venues`, `GET /venues/postal/{code}`, `POST /games/{id}/venue-images`, `POST /tournaments/{id}/venue-images`, `DELETE /venue-images/{id}`, and `POST /venue-images/{id}/report` endpoints are live.

---

### Completion Proof

**Test evidence** (raw output — no summaries):
```
Tests:       40 passed, 40 total
Snapshots:   0 total
Time:        1.204 s
--- Run 1 ---
Tests:       40 passed, 40 total
Snapshots:   0 total
Time:        0.945 s, estimated 1 s
--- Run 2 ---
Tests:       40 passed, 40 total
Snapshots:   0 total
Time:        0.887 s, estimated 1 s
--- Run 3 ---
```

**Git evidence**:
```
341dd9e (HEAD -> main) feat(venues): vc-m-detail venue snapshot display and vc-m-photos organizer upload
2013374 feat(venues): vc-m-tournament compact venue picker for tournament schedule and edit match
ecae74b feat(venues): vc-m-picker and vc-m-others venue picker and others entry
6afa185 feat(venues): vc-m-config types, config flag gate, and API client with typed mocks
9accfd1 (origin/main, origin/HEAD) chore(android): record versionCode 70
```
```
On branch main
Your branch is ahead of 'origin/main' by 4 commits.
  (use "git push" to publish your local commits)

nothing to commit, working tree clean
```

**File evidence** (grep showing key change exists on disk):
```
src/components/venue/VenueDetailCard.tsx:2: * VenueDetailCard component for GameDetail and TournamentDetail.
src/components/venue/VenueDetailCard.tsx:42:interface VenueDetailCardProps {
src/components/venue/VenueDetailCard.tsx:55:export default function VenueDetailCard({
src/components/venue/VenueDetailCard.tsx:64:}: VenueDetailCardProps): React.JSX.Element {
src/components/venue/__tests__/VenueDetailCard.test.tsx:4:import VenueDetailCard from '../VenueDetailCard';
src/components/venue/__tests__/VenueDetailCard.test.tsx:67:describe('VenueDetailCard (vc-m-detail & vc-m-photos)', () => {
src/components/venue/__tests__/VenueDetailCard.test.tsx:85:        <VenueDetailCard
src/components/venue/__tests__/VenueDetailCard.test.tsx:102:        <VenueDetailCard
src/components/venue/__tests__/VenueDetailCard.test.tsx:116:        <VenueDetailCard
src/components/venue/__tests__/VenueDetailCard.test.tsx:138:        <VenueDetailCard
src/components/venue/__tests__/VenueDetailCard.test.tsx:161:        <VenueDetailCard
src/components/venue/__tests__/VenueDetailCard.test.tsx:170:        <VenueDetailCard
src/components/venue/__tests__/VenueDetailCard.test.tsx:183:        <VenueDetailCard
src/components/venue/__tests__/VenueDetailCard.test.tsx:220:        <VenueDetailCard
src/components/venue/__tests__/VenueDetailCard.test.tsx:248:        <VenueDetailCard
src/components/venue/__tests__/VenueDetailCard.test.tsx:294:        <VenueDetailCard
src/components/venue/__tests__/VenueDetailCard.test.tsx:351:        <VenueDetailCard
src/screens/EventDetailScreen.tsx:45:import VenueDetailCard from '../components/venue/VenueDetailCard';
src/screens/EventDetailScreen.tsx:1042:              <VenueDetailCard
src/screens/TournamentDetailScreen.tsx:54:import VenueDetailCard from '../components/venue/VenueDetailCard';
src/screens/TournamentDetailScreen.tsx:265:        <VenueDetailCard
```
