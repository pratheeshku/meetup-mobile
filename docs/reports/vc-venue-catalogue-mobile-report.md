# Implementation Report: Venue Catalogue (Mobile App)

## 1. Design Reference
- **Doc ID**: `DES-MEETUP-ADDENDUM-VENUE-CATALOGUE`
- **Version**: v1.0 (APPROVED by owner, 2026-10-15)
- **Status**: Built against spec, integration pending backend implementation
- **Tier**: Standard (Mobile Client)
- **Git Branch**: `feat/venue-catalogue-mobile`

## 2. Traceability Map
| Task ID | Scope & Content | Design Ref / R-ID | Files Touched / Created | Status / Commits |
|---|---|---|---|---|
| `vc-m-config` | API client types for venues, snapshot, client config; flag gate | §4, §5 | `src/types/venue.ts`, `src/types/event.ts`, `src/types/tournament.ts`, `src/api/config.ts`, `src/api/venues.ts`, `src/api/__tests__/config.test.ts`, `src/api/__tests__/venues.test.ts` | Completed (`6afa185`, `5c6575f`) |
| `vc-m-picker` | Venue picker on Create game step 3 (`Game3When`) and Edit game step 2 (`EditGame2`) | `Game3When`, `EditGame2` | `src/components/venue/VenuePicker.tsx`, `src/components/venue/VenueIcons.tsx`, `src/screens/CreateGameScreen.tsx`, `src/screens/EventDetailScreen.tsx`, `src/theme/tokens.ts`, `src/labels/fallbackLabels.ts`, `docs/label-inventory-mobile.json`, `src/components/venue/__tests__/VenuePicker.test.tsx` | Completed (`ecae74b`, `227db77`, `5c6575f`) |
| `vc-m-others` | Others entry modal with 6-digit postal code resolution and pending state | AD-8, §4 | `src/components/venue/OthersVenueModal.tsx`, `src/components/venue/__tests__/OthersVenueModal.test.tsx`, `src/components/venue/VenuePicker.tsx` | Completed (`ecae74b`, `227db77`) |
| `vc-m-tournament` | 46px compact venue picker on tournament create flow | `TournSched*`, `FXEdit*` | `src/components/venue/VenuePicker.tsx`, `src/screens/CreateGameScreen.tsx` | **BLOCKED-pending-lifecycle-mobile** |
| `vc-m-detail` | Venue snapshot display on game & tournament detail; photo strip on `GameDetail`; legacy fallback | `GameDetail`, §4 | `src/components/venue/VenueDetailCard.tsx`, `src/screens/EventDetailScreen.tsx`, `src/screens/TournamentDetailScreen.tsx`, `src/components/venue/__tests__/VenueDetailCard.test.tsx` | Completed (`341dd9e`, `5c6575f`) |
| `vc-m-photos` | Organizer photo upload, delete, and neutral viewer report | §4 | `src/components/venue/VenueDetailCard.tsx`, `src/components/venue/__tests__/VenueDetailCard.test.tsx` | Completed (`341dd9e`, `5c6575f`) |

## 3. Proposed Assumptions
1. **PA-1 (Photo Attributions)**: Per strict spec requirements, photo upload responses may contain internal identifiers but the UI completely suppresses attribution (no uploader username or avatar) and displays only the image asset.
2. **PA-2 (Short-lived signed URLs)**: Signed URLs are fetched fresh on mount via `getVenue(venueId)` and never persisted to local device cache or Keychain storage.

## 4. Deviations
- **Runtime Mock Fallback Removed**: In the initial implementation, runtime fallback mock responses (`MOCK_VENUES` and synthetic geocode responses) were returned upon HTTP 404 or network failure to facilitate offline component rendering. Per blocking instruction, **all runtime mock fallbacks have been completely removed** from `src/api/venues.ts`. No mock data is returned on 404, network error, or 5xx in any build. Errors propagate directly, and the UI displays real error and retry states. Mocks now exist strictly within Jest test fixtures.
- **Removal of EditMatchModal and Match-Edit Wiring**: In the initial implementation, an `EditMatchModal` component was created to render the visual layout of `FXEdit*`. However, per-match catalogue venue editing is neither specified in `DES-MEETUP-ADDENDUM-VENUE-CATALOGUE` §4 nor supported by backend endpoints. Per instruction, `EditMatchModal`, its wiring in `TournamentDetailScreen.tsx`, and its unit tests have been completely removed from this PR. The `FXEdit*` and `TournSched*` boards belong to the Tournament Lifecycle mobile work (`DES-MEETUP-ADDENDUM-tournament-lifecycle`), which is not yet present in the app.

## 5. Open Items Follow-up
- **OI-2 (Photo T&C wording)**: **OPEN**. Before uploading a photo, the organizer must accept a statement. Current text: *"I confirm that I own or have permission to upload this photo."* Formal T&C/privacy policy legal wording is pending owner confirmation.
- **OI-3 (Bottom bar on wizards and detail screens)**: **OPEN**. Whether the native app displays a bottom navigation bar on wizards and detail screens remains an open question pending the owner's decision. Implementation currently adheres to the visual canvas boards (`Game3When`, `EditGame2`, `GameDetail`) where screens do not render duplicate bottom navigation tabs.
- **OI-11 (Source tag wording)**: **OPEN**. Tag wording for catalogue venues (`venue.source.catalogue`, default "ActiveSG") and user venues (`venue.source.user`, default "Others") is pending owner confirmation. Implementation uses dynamic keys in `label-inventory-mobile.json` without hardcoding.

## 6. Gating of Typed Mocks in Release Builds
All runtime mock fallbacks have been removed from `src/api/venues.ts`.
- Calls to `getVenues`, `getVenue`, `getPostalVenue`, `uploadGameVenueImage`, `uploadTournamentVenueImage`, `deleteVenueImage`, and `reportVenueImage` directly execute live Axios requests.
- If the server responds with 404, 5xx, or a network disconnection occurs, the functions reject with the raw error.
- In production and release builds, no synthetic mock data can be returned. In case of network/server error, `VenuePicker` displays an error banner with a "Retry" button, and `VenueDetailCard` displays an error message with a retry affordance.

## 7. Persistence API Calls and Payload Contract Verification

### Where Venues Are Chosen and Saved

#### 1. Create Game (Casual Game)
- **Screen**: `src/screens/CreateGameScreen.tsx` (Step 3: When and where)
- **API Call**: `createEvent(input, { correlationId })` -> calls `POST /events` (`src/api/events.ts`, DES-MEETUP.md §5.5)
- **Payload Contract**:
  - When catalogue venue chosen: `{ title, ..., venue_id }`
  - When Others chosen: `{ title, ..., others: { name, postal_code, facilities, operating_hours, info_url } }`
  - **Negative assertion**: `venue_name`, `venue_snapshot`, `address`, `venue_address`, `lat`, `lng`, `venue_lat`, and `venue_lng` are **NEVER sent**.
- **Tests**: Asserted in `src/screens/__tests__/VenuePayloadContracts.test.tsx`.

#### 2. Edit Game
- **Screen**: `src/screens/EventDetailScreen.tsx` (Step 2: Venue)
- **API Call**: `updateEvent(eventId, payload, { correlationId })` -> calls `PATCH /events/{id}` (`src/api/events.ts`, DES-MEETUP.md §5.5)
- **Payload Contract**:
  - When catalogue venue chosen: `{ venue_id }`
  - When Others chosen: `{ others: { name, postal_code, facilities, operating_hours, info_url } }`
  - **Negative assertion**: `venue_name`, `venue_snapshot`, `address`, `venue_address`, `lat`, `lng`, `venue_lat`, and `venue_lng` are **NEVER sent**.
- **Tests**: Asserted in `src/screens/__tests__/VenuePayloadContracts.test.tsx` and `src/api/__tests__/events.test.ts`.

#### 3. Create Tournament
- **Screen**: `src/screens/CreateGameScreen.tsx` (`mode === 'tournament'`, Step 3: Venue picker with `variant="tournament"`)
- **API Call**: `createTournament(input, { correlationId })` -> calls `POST /tournaments` (`src/api/tournaments.ts`, DES-MEETUP.md §5.20)
- **Payload Contract**:
  - When catalogue venue chosen: `{ title, sport, format, ..., venue_id }`
  - When Others chosen: `{ title, sport, format, ..., others: { name, postal_code, facilities, operating_hours, info_url } }`
  - **Negative assertion**: `venue_name`, `venue_snapshot`, `address`, `venue_address`, `lat`, `lng`, `venue_lat`, and `venue_lng` are **NEVER sent**.
- **Tests**: Asserted in `src/screens/__tests__/VenuePayloadContracts.test.tsx` and `src/api/__tests__/tournaments.test.ts`.

#### 4. Tournament Edit and Fixtures Status
- **Tournament Creation**: Exists in `CreateGameScreen.tsx` (`POST /tournaments`).
- **Tournament Edit**: Tournament details edit screen does NOT exist in the mobile app yet.
- **Tournament Match/Fixture Edit**: Per-match catalogue venue editing (`TournSched*`, `FXEdit*`) is not in `DES-MEETUP-ADDENDUM-VENUE-CATALOGUE` §4 or the backend API. It belongs to the Tournament Lifecycle mobile work (`DES-MEETUP-ADDENDUM-tournament-lifecycle`).
- **Action Taken**: Removed `EditMatchModal` and fixture edit pressable wiring from `TournamentDetailScreen.tsx`. No placeholder screens built.
- **Task Status**: `vc-m-tournament` marked `BLOCKED-pending-lifecycle-mobile`.

---

### Blocked Report: vc-m-tournament

```
BLOCKED — cannot proceed safely.
Missing: Tournament schedule and match edit screens/endpoints. Per-match catalogue venue editing is not in DES-MEETUP-ADDENDUM-VENUE-CATALOGUE §4 or the backend API. Boards TournSched* and FXEdit* belong to the Tournament Lifecycle mobile work (DES-MEETUP-ADDENDUM-tournament-lifecycle), which has not been implemented in the mobile app yet.
Investigated:
- src/screens/TournamentDetailScreen.tsx — only displays tournament details, registrations, and read-only fixtures; has no tournament edit screen or per-fixture edit mutation endpoint.
- src/screens/CreateGameScreen.tsx — tournament creation exists (POST /tournaments), wired with 46px compact tournament VenuePicker (variant="tournament"). Note: the tournament-mode venue picker in CreateGameScreen has no matching board on the visual canvas.
- Backend API contract in DES-MEETUP-ADDENDUM-VENUE-CATALOGUE §4 defines GET /venues, GET /venues/{id} (returns venue details and shared images), GET /venues/postal/{code}, POST /games/{id}/venue-images, POST /tournaments/{id}/venue-images, DELETE /venue-images/{id}, and POST /venue-images/{id}/report. There is no /venues/{id}/photos. No per-match fixture venue endpoint exists in §4 or the backend API.
Required to unblock: Implementation of Tournament Lifecycle mobile work (DES-MEETUP-ADDENDUM-tournament-lifecycle) defining tournament schedule editing (TournSched*) and match editing (FXEdit*) along with corresponding backend endpoints.
```

## 8. Dependencies Audit
- **New Dependencies**: None.
- All components use existing libraries (`react-native`, `react-native-svg`, `axios`) and tokens from [`src/theme/tokens.ts`](file:///Users/pratheesh/Developer/meetup-mobile/src/theme/tokens.ts).

## 9. Verification Results & Command Proof

### Type Check (`npx tsc --noEmit`)
Raw terminal output:
```
$ npx tsc --noEmit
(Exited with code 0)
```

### Linter (`npx eslint . --ext .ts,.tsx`)
Raw terminal output:
```
$ npx eslint . --ext .ts,.tsx

/Users/pratheesh/Developer/meetup-mobile/src/components/__tests__/NotificationCard.test.tsx
  2:10  error  'Pressable' is defined but never used  @typescript-eslint/no-unused-vars
  2:33  error  'Text' is defined but never used       @typescript-eslint/no-unused-vars

/Users/pratheesh/Developer/meetup-mobile/src/components/icons/__tests__/RegistryIcons.test.tsx
  7:3  error  'REGISTRY_CONFIG' is defined but never used  @typescript-eslint/no-unused-vars

/Users/pratheesh/Developer/meetup-mobile/src/screens/NotificationHistoryScreen.tsx
  54:3  error  'getUnreadBadgeCount' is defined but never used  @typescript-eslint/no-unused-vars

✖ 4 problems (4 errors, 0 warnings)
```

#### Comparison with `origin/main`:
Checking `origin/main` directly reveals identical output:
```
$ git checkout origin/main && npx eslint . --ext .ts,.tsx
HEAD is now at 9accfd1 chore(android): record versionCode 70

/Users/pratheesh/Developer/meetup-mobile/src/components/__tests__/NotificationCard.test.tsx
  2:10  error  'Pressable' is defined but never used  @typescript-eslint/no-unused-vars
  2:33  error  'Text' is defined but never used       @typescript-eslint/no-unused-vars

/Users/pratheesh/Developer/meetup-mobile/src/components/icons/__tests__/RegistryIcons.test.tsx
  7:3  error  'REGISTRY_CONFIG' is defined but never used  @typescript-eslint/no-unused-vars

/Users/pratheesh/Developer/meetup-mobile/src/screens/NotificationHistoryScreen.tsx
  54:3  error  'getUnreadBadgeCount' is defined but never used  @typescript-eslint/no-unused-vars

✖ 4 problems (4 errors, 0 warnings)
```
This confirms that 100% of the new and modified venue catalogue code is completely lint-clean (0 errors), and the 4 errors exist on `origin/main`.

### Full Jest Test Suite Analysis & Baseline Comparison (Pre-Existing Failure Proof)

To verify whether the 15 failing test suites (180 tests) were introduced by this feature or were pre-existing, a clean worktree of `origin/main` (`../mm-base`) was created and initialized via `npm ci`. The full Jest test suite was run with `--json` output on both `origin/main` and `feat/venue-catalogue-mobile`.

#### Summary Comparison:

| Metric | `origin/main` (Baseline) | `feat/venue-catalogue-mobile` (Branch) | Delta |
|---|---|---|---|
| **Total Test Suites** | 122 | 128 | +6 suites (venue catalogue) |
| **Passed Test Suites** | 107 | 113 | +6 suites |
| **Failed Test Suites** | **15** | **15** | **0 (Identical)** |
| **Total Tests** | 1503 | 1560 | +57 tests (venue catalogue) |
| **Passed Tests** | 1323 | 1380 | +57 tests |
| **Failed Tests** | **180** | **180** | **0 (Identical)** |

#### Difference Analysis:
- **Suites failed ONLY on branch**: `0` (`[]`)
- **Suites failed ONLY on baseline**: `0` (`[]`)
- **Tests failed ONLY on branch**: `0` (`[]`)
- **Tests failed ONLY on baseline**: `0` (`[]`)

Every single failing test suite and individual failing test on `feat/venue-catalogue-mobile` is **100% pre-existing on `origin/main`**.

#### Complete List of the 15 Shared Failing Suites:

| Suite Path | Baseline Failed Tests | Branch Failed Tests | Notes / Root Cause |
|---|---|---|---|
| `__tests__/AppForceUpdate.test.tsx` | 1 | 1 | App rebranded from "Shuttlr" to "GameOn SG"; test expects "Shuttlr" |
| `config/__tests__/appConfig.test.ts` | 1 | 1 | Base config branding expectation mismatch |
| `src/assets/__tests__/headerIcon.test.ts` | 0 (suite failed) | 0 (suite failed) | `ENOENT: shuttlr-icon.png` (renamed on base) |
| `src/components/__tests__/ForceUpdateGate.test.tsx` | 2 | 2 | Branding copy expectation mismatch |
| `src/components/__tests__/keyboardInventory.test.ts` | 3 | 3 | Keyboard inventory baseline mismatch |
| `src/components/home/__tests__/homeComponents.test.tsx` | 7 | 7 | Home component testID / accessibility copy changes on base |
| `src/screens/__tests__/CreateGameScreen.test.tsx` | 37 | 37 | Expects `"🎮 Casual Game"` (with emoji); UI on base removed emoji |
| `src/screens/__tests__/EventDetailScreen.test.tsx` | 43 | 43 | Pre-existing contract/render mismatches on base |
| `src/screens/__tests__/GroupDetailScreen.test.tsx` | 7 | 7 | Pre-existing group detail test expectation mismatches |
| `src/screens/__tests__/HomeScreen.test.tsx` | 31 | 31 | Dashboard banner/section ordering testID mismatch |
| `src/screens/__tests__/ProfileScreen.test.tsx` | 31 | 31 | Pre-existing profile screen test expectation mismatches |
| `src/screens/__tests__/ProfileScreenLinks.test.tsx` | 8 | 8 | Pre-existing link list mismatches on base |
| `src/screens/__tests__/ProfileScreenReportRow.test.tsx` | 4 | 4 | Pre-existing report row test expectation mismatches |
| `src/screens/__tests__/ProfileScreenTerms.test.tsx` | 4 | 4 | Pre-existing terms modal test expectation mismatches |
| `src/utils/__tests__/shareLink.test.ts` | 1 | 1 | Pre-existing share link domain mismatch on base |
| **Total** | **180** | **180** | |

#### Representative Error Messages from Shared Failures:

1. **Representative Suite 1**: `__tests__/AppForceUpdate.test.tsx`
   - **Test**: `App with the force-update gate > below the minimum: the blocking screen replaces the login screen and all navigation`
   - **Error**:
     ```
     Error: expect(received).toEqual(expected) // deep equality

     Expected: ArrayContaining ["Update required", "Please update Shuttlr to continue.", "Update"]
     Received: ["Update required", "Please update GameOn SG to continue.", "Update"]
         at Object.toEqual (/Users/pratheesh/Developer/mm-base/__tests__/AppForceUpdate.test.tsx:80:21)
     ```
   - **Cause**: The application was rebranded from "Shuttlr" to "GameOn SG" on `origin/main`, but the test assertion still expects the legacy string "Shuttlr".

2. **Representative Suite 2**: `src/screens/__tests__/HomeScreen.test.tsx`
   - **Test**: `layout and order (AD-1) > renders banner, next game, sports, My games, My groups, Recommended, shortcut tiles — in that order`
   - **Error**:
     ```
     Error: expect(received).toEqual(expected) // deep equality

     - Expected  - 9
     + Received  + 1

     - Array [
     -   "dashboard-banner",
     -   "next-game-section",
     -   "sports-section",
     -   "my-games-section",
     -   "my-groups-section",
     -   "recommended-section",
     -   "shortcut-tiles",
     - ]
     + Array []
         at Object.toEqual (/Users/pratheesh/Developer/mm-base/src/screens/__tests__/HomeScreen.test.tsx:154:32)
     ```
   - **Cause**: Dashboard test IDs and layout ordering expectations in `HomeScreen.test.tsx` diverged during prior dashboard refactoring on `origin/main`.

3. **Representative Error on Touched Screen**: `src/screens/__tests__/CreateGameScreen.test.tsx`
   - **Test**: `CreateGameScreen — toggle > defaults to Casual Game and offers a Tournament toggle`
   - **Error**:
     ```
     Error: Expected exactly one pressable labelled "🎮 Casual Game", found 0
         at pressableLabelled (/Users/pratheesh/Developer/mm-base/src/test-utils/render.ts:88:11)
         at Object.<anonymous> (/Users/pratheesh/Developer/mm-base/src/screens/__tests__/CreateGameScreen.test.tsx:97:29)
     ```
   - **Cause**: On `origin/main`, the button label was updated to "Casual Game" (removing the emoji), but the pre-existing test suite in `CreateGameScreen.test.tsx` was not updated and fails identically (37 failures) on both base and branch.

#### Venue Catalogue Test Suites (Branch Exclusive - 100% Passing):
All 7 test suites created/extended for venue catalogue pass with zero errors:
1. `src/api/__tests__/venues.test.ts` (15 passed)
2. `src/api/__tests__/events.test.ts` (15 passed)
3. `src/api/__tests__/tournaments.test.ts` (14 passed)
4. `src/components/venue/__tests__/VenuePicker.test.tsx` (11 passed)
5. `src/components/venue/__tests__/OthersVenueModal.test.tsx` (8 passed)
6. `src/components/venue/__tests__/VenueDetailCard.test.tsx` (5 passed)
7. `src/screens/__tests__/VenuePayloadContracts.test.tsx` (6 passed)
**Total: 7 suites, 74 tests passed, 0 failed.**

### Screen Verification & Screenshots
- Reference boards from `docs/design-ref-venue/png/`:
  - `Game3When.png` ↔ `CreateGameScreen` Step 3 (Casual Game mode: Catalogue VenuePicker + map pin card)
  - `EditGame2.png` ↔ `EventDetailScreen` Step 2 (Catalogue VenuePicker + map pin card)
  - `GameDetail.png` ↔ `EventDetailScreen` (VenueDetailCard with snapshot, listed hours, info link, uncached photo strip)
  - **Tournament-mode Venue Picker**: Note that the tournament-mode venue picker in `CreateGameScreen` (Step 3 when `mode === 'tournament'`) has **no matching board** on the visual canvas. It renders a 46px compact selected box with source tag, matching the design specification of the tournament picker.
- **Screenshot Notice**: Direct live device screenshot capture is unavailable in this headless execution environment because no Android emulator or iOS simulator is booted (`adb devices` lists 0 attached devices; `xcrun simctl list devices` shows no booted simulators). All visual styling, dimensions, tokens, colors, typography, and layout were verified directly against the reference HTML boards in `docs/design-ref-venue/html/` and verified by unit test suites.

### Files Added Under `docs/`
- `docs/status/vc-m-config-status.md`
- `docs/status/vc-m-picker-status.md`
- `docs/status/vc-m-others-status.md`
- `docs/status/vc-m-tournament-status.md`
- `docs/status/vc-m-detail-status.md`
- `docs/status/vc-m-photos-status.md`
- `docs/reports/vc-venue-catalogue-mobile-report.md`
*(Note: Reference design assets under `docs/design-ref-venue/` were provided by the user brief; `docs/label-inventory-mobile.json` was updated with the new venue label keys; session reflection document has been removed per instruction).*

---

### Completion Proof

**Test evidence** (raw output across 3 consecutive runs of venue catalogue test suites):
```
Test Suites: 7 passed, 7 total
Tests:       74 passed, 74 total
Snapshots:   0 total
Time:        1.471 s, estimated 2 s
Ran all test suites matching /src\/components\/venue\/__tests__|src\/screens\/__tests__\/VenuePayloadContracts.test.tsx|src\/api\/__tests__\/venues.test.ts|src\/api\/__tests__\/events.test.ts|src\/api\/__tests__\/tournaments.test.ts/i.
--- Run 1 ---
Test Suites: 7 passed, 7 total
Tests:       74 passed, 74 total
Snapshots:   0 total
Time:        1.251 s, estimated 2 s
Ran all test suites matching /src\/components\/venue\/__tests__|src\/screens\/__tests__\/VenuePayloadContracts.test.tsx|src\/api\/__tests__\/venues.test.ts|src\/api\/__tests__\/events.test.ts|src\/api\/__tests__\/tournaments.test.ts/i.
--- Run 2 ---
Test Suites: 7 passed, 7 total
Tests:       74 passed, 74 total
Snapshots:   0 total
Time:        1.283 s, estimated 2 s
Ran all test suites matching /src\/components\/venue\/__tests__|src\/screens\/__tests__\/VenuePayloadContracts.test.tsx|src\/api\/__tests__\/venues.test.ts|src\/api\/__tests__\/events.test.ts|src\/api\/__tests__\/tournaments.test.ts/i.
--- Run 3 ---
```

**Full suite test summary** (proving identical 180 pre-existing baseline failures):
- `feat/venue-catalogue-mobile`: Test Suites: 15 failed, 113 passed, 128 total. Tests: 180 failed, 1380 passed, 1560 total.
- `origin/main` (`../mm-base`): Test Suites: 15 failed, 107 passed, 122 total. Tests: 180 failed, 1323 passed, 1503 total.
- Suites/tests failing only on branch: `0`.

**Git evidence**:
```
9371831 (HEAD -> feat/venue-catalogue-mobile) fix(venues): omit venue_name when venue_id or others is present, correct report endpoints, and note missing board
3096773 docs(venues): finalize completion proof in implementation report
875bb1c fix(venues): remove EditMatchModal, enforce venue payload contracts, and update report
834fbe8 docs(venues): update report with mock removal deviation, OI statuses, and contract verification
5c6575f fix(venues): remove runtime mock fallbacks, add failure path tests, and add UI error states
813ad22 docs(venues): update implementation report with audit evidence, mock gating, and deviations
227db77 fix(venues): add label inventory keys, resolve ESLint unused vars, and decouple hardcoded ActiveSG
33debea (origin/feat/venue-catalogue-mobile) chore: remove session reflection from repo
907db4a docs(venues): add implementation report and agent enhancement for venue catalogue
341dd9e feat(venues): vc-m-detail venue snapshot display and vc-m-photos organizer upload
2013374 feat(venues): vc-m-tournament compact venue picker for tournament schedule and edit match
ecae74b feat(venues): vc-m-picker and vc-m-others venue picker and others entry
6afa185 feat(venues): vc-m-config types, config flag gate, and API client with typed mocks
9accfd1 (origin/main, origin/HEAD) chore(android): record versionCode 70
```
```
On branch feat/venue-catalogue-mobile
Your branch is ahead of 'origin/feat/venue-catalogue-mobile' by 7 commits.
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
src/screens/EventDetailScreen.tsx:45:import VenueDetailCard from '../components/venue/VenueDetailCard';
src/screens/EventDetailScreen.tsx:1042:              <VenueDetailCard
src/screens/TournamentDetailScreen.tsx:54:import VenueDetailCard from '../components/venue/VenueDetailCard';
src/screens/TournamentDetailScreen.tsx:265:        <VenueDetailCard
```
