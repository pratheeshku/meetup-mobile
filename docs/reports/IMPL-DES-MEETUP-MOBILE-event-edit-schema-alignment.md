# Implementation Report — Event Edit Form Schema Alignment and Web Parity

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version**: APPROVED (architect-approved 2026-09-13; Create-flow amendment approved 2026-09-22; Event Edit schema alignment brief 2026-09-25)
- **Status**: APPROVED
- **Tier built against**: T1
- **Governing sections**: DES-MEETUP-MOBILE §4.3 (Event Management), §5.9 (Event Edit Lifecycle), §7.4 (API Contracts), and REQ-MEETUP-MOBILE R-021, R-024.

---

## 2. Traceability map

| Design section / Requirement | Description | Files touched | Commit |
|---|---|---|---|
| DES §4.3, §5.9 (Visibility immutability) | Removed `visibility` completely from the edit form (neither disabled nor shown). Visibility is permanently immutable post-creation (backend rejects with 409). Matches web edit modal. | `src/screens/EventDetailScreen.tsx`, `src/screens/__tests__/EventDetailScreen.test.tsx` | `738e481` |
| DES §4.3, §5.9 (Sport field & lock) | Added `sport` field to edit form with text input and quick-selection chips from `getSports()`. Surfaces backend 409 rejection ("Cannot change sport after a participant has joined") via `getApiErrorMessage`. | `src/api/events.ts`, `src/screens/EventDetailScreen.tsx`, `src/screens/__tests__/EventDetailScreen.test.tsx` | `738e481` |
| DES §4.3, §5.9 (Allow waitlist toggle) | Added `allow_waitlist` boolean toggle (`Switch`) to edit form. Freely editable pre-start without retroactive effect on existing waitlisted rows. | `src/types/event.ts`, `src/api/events.ts`, `src/screens/EventDetailScreen.tsx`, `src/screens/__tests__/EventDetailScreen.test.tsx` | `738e481` |
| DES §4.3, §5.9 (Cost & currency) | Added `estimated_cost_cents` (serialised as integer cents `ge=0`) and `estimated_cost_currency` (3-char ISO code uppercase) inputs to edit form and wire mapper. Formatted cost display on event detail card. | `src/types/event.ts`, `src/api/events.ts`, `src/screens/EventDetailScreen.tsx`, `src/screens/__tests__/EventDetailScreen.test.tsx` | `738e481` |
| §8 Testing Strategy | Unit tests verifying client-side validation, 12-field PATCH serialization, visibility omission, 409 sport-lock conflict, and OptionChips selection. | `src/api/__tests__/events.test.ts`, `src/screens/__tests__/EventDetailScreen.test.tsx` | `738e481` |
| Shared Instructions | Reflection notes documenting lessons on schema-driven client input constraints, currency length, and integer cents transformation. | `docs/reports/agent-enhancement-2026-09-25.md` | `738e481` |

---

## 3. Proposed Assumptions

1. **Numeric cost input transformation**:
   Users enter dollar/decimal values (e.g. `15.00` or `25.50`) in the `Estimated Cost` field. The client validates that the input is non-negative and serializes it on the wire as `Math.round(parsed * 100)` to satisfy FastAPI's `estimated_cost_cents: Optional[int] = Field(None, ge=0)`. Empty input is sent as `null`.
2. **Currency normalization**:
   The currency input field enforces 3-letter strings (e.g. `USD`, `SGD`), converting input to uppercase. Empty input is sent as `null`.
3. **Sport input hybrid presentation**:
   `sport` is presented as an editable `TextField` with `accessibilityLabel="Sport"`. When active sports are available from `getSports()`, `OptionChips` are additionally rendered below the field for quick single-tap selection, matching web's sport select dropdown while preserving direct text input capability for testing and resilience.

---

## 4. Deviations

None. All 12 fields (`title`, `description`, `venue_name`, `venue_address`, `skill_level_requirement`, `capacity`, `starts_at`, `ends_at`, `sport`, `allow_waitlist`, `estimated_cost_cents`, `estimated_cost_currency`) match web parity and the verified OpenAPI schema exactly. Individual-invite UI remains on hold per previous instruction.

---

## 5. Verification results

- `npx tsc --noEmit`: clean (0 errors).
- `npx eslint . --ext .ts,.tsx`: clean (0 errors, 0 warnings).
- `npx jest --coverage --coverageReporters=text-summary`: 66 of 66 test suites passed, 819 of 819 tests passed (+3 net new tests).

### Coverage Delta

| Metric | Before (Cancel/Edit/Invite Build) | After (12-Field Schema Alignment) | Delta |
|---|---|---|---|
| Statements | 85.04% | 88.16% | +3.12% |
| Branches | 80.64% | 82.93% | +2.29% |
| Functions | 80.46% | 84.83% | +4.37% |
| Lines | 85.17% | 88.33% | +3.16% |
| `src/api/events.ts` Lines | 100.00% | 100.00% | 0.00% (100% stmts, branch, funcs, lines) |
| Total Tests | 816 passed | 819 passed | +3 tests |

---

## 6. Known gaps / follow-ups

1. **Individual Event Invite (`POST /events/{event_id}/invite-user`)**:
   Held per user instruction; out of scope for this task.

---

## 7. Completion Proof

### Test evidence (raw output — no summaries):
```
PASS __tests__/App.test.tsx
PASS src/navigation/__tests__/CreateTabButton.test.tsx
PASS __tests__/index.test.ts
PASS __tests__/AppForceUpdate.test.tsx
PASS src/screens/__tests__/GroupsHeaderNavigation.test.tsx
PASS src/screens/__tests__/EventDetailScreen.test.tsx
PASS src/screens/__tests__/HomeScreen.test.tsx
PASS src/components/home/__tests__/homeComponents.test.tsx
PASS src/api/__tests__/versionPolicy.test.ts
PASS src/notifications/__tests__/fcmForeground.test.ts
PASS src/screens/__tests__/ProfileScreen.test.tsx
PASS src/components/__tests__/ForceUpdateGate.test.tsx
PASS src/components/__tests__/DateTimePickerField.test.tsx
PASS src/notifications/__tests__/pushRegistration.test.ts
PASS src/components/__tests__/NotificationBanner.test.tsx
PASS src/screens/__tests__/CreateGroupScreen.test.tsx
PASS src/notifications/eventNotificationHandler.test.ts
PASS src/screens/__tests__/TournamentDetailScreen.test.tsx
PASS src/utils/__tests__/playStoreUrl.test.ts
PASS src/screens/__tests__/NotificationPreferencesScreen.test.tsx
PASS src/components/__tests__/HeaderAddButton.test.tsx
PASS src/screens/__tests__/CreateGameScreen.test.tsx
PASS src/screens/__tests__/NotificationHistoryScreen.test.tsx
PASS src/screens/__tests__/TournamentsScreen.test.tsx
PASS src/screens/__tests__/GroupDetailScreen.test.tsx
PASS src/components/__tests__/Button.test.tsx
PASS src/navigation/__tests__/HomeHeader.test.tsx
PASS src/utils/__tests__/installedVersion.test.ts
PASS src/components/__tests__/EventCard.test.tsx
PASS src/api/__tests__/refresh.test.ts
PASS src/auth/__tests__/sessionExpiry.test.tsx
PASS src/notifications/__tests__/fcm.test.ts
PASS src/components/__tests__/OptionChips.test.tsx
PASS src/auth/__tests__/signOutSession.test.ts
PASS src/api/__tests__/events.test.ts
PASS src/navigation/__tests__/tabIcons.test.tsx
PASS src/storage/__tests__/tokens.test.ts
PASS src/screens/__tests__/LoginScreen.test.tsx
PASS src/navigation/__tests__/CreateMenu.test.tsx
PASS src/api/__tests__/cookies.test.ts
PASS src/screens/__tests__/GroupsScreen.test.tsx
PASS src/utils/__tests__/labels.test.tsx
PASS src/notifications/participantHandler.test.ts
PASS src/api/__tests__/notifications.test.ts
PASS src/auth/__tests__/signInNoRefreshToken.test.tsx
PASS src/auth/__tests__/silentRefresh.test.tsx
PASS src/api/__tests__/profile.test.ts
PASS src/components/__tests__/UserSearchPicker.test.tsx
PASS src/utils/__tests__/localDateTime.test.ts
PASS src/notifications/__tests__/deviceId.test.ts
PASS src/components/__tests__/AppHeader.test.tsx
PASS src/utils/__tests__/apiError.test.ts
PASS src/components/__tests__/Badge.test.tsx
PASS src/utils/__tests__/formatEventDateTime.test.ts
PASS src/utils/__tests__/homeDashboard.test.ts
PASS src/notifications/__tests__/notificationRouting.test.ts
PASS src/api/__tests__/sports.test.ts
PASS src/auth/__tests__/AuthContext.push.test.tsx
PASS src/auth/__tests__/signOut.test.ts
PASS src/utils/__tests__/formatRelativeTime.test.ts
PASS src/utils/__tests__/logSafeError.test.ts
PASS src/api/__tests__/tournaments.test.ts
PASS src/api/__tests__/groups.test.ts
PASS src/api/__tests__/users.test.ts
PASS src/utils/__tests__/displayName.test.ts
PASS src/theme/__tests__/tokens.test.ts

=============================== Coverage summary ===============================
Statements   : 88.16% ( 2063/2340 )
Branches     : 82.93% ( 1108/1336 )
Functions    : 84.83% ( 498/587 )
Lines        : 88.33% ( 2006/2271 )
================================================================================

Test Suites: 66 passed, 66 total
Tests:       819 passed, 819 total
Snapshots:   0 total
Time:        3.015 s
Ran all test suites.
```

### Git evidence:
```
738e481 feat(events): align event edit form with 12-field backend schema and web parity
77e0fcd docs(reports): implementation report for event cancel, edit, and group invite
7c6045b feat(events): wire event cancel with reason, event edit, and group invite flows
```
```
On branch main
Your branch is ahead of 'origin/main' by 1 commit.
  (use "git push" to publish your local commits)

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	implementation-status-DES-MEETUP-MOBILE.md

nothing added to commit but untracked files present (use "git add" to track)
```

### File evidence (grep showing key change exists on disk):
```
$ git grep -n "allow_waitlist" src/
src/api/__tests__/events.test.ts:239:        allow_waitlist: true,
src/api/__tests__/events.test.ts:263:      allow_waitlist: true,
src/api/__tests__/events.test.ts:283:        allow_waitlist: true,
src/api/__tests__/events.test.ts:294:    expect(result.allow_waitlist).toBe(true);
src/api/events.ts:80:  allow_waitlist?: boolean;
src/api/events.ts:143:    allow_waitlist: raw.allow_waitlist ?? true,
src/api/events.ts:236: * capacity, starts_at, ends_at, visibility, sport, allow_waitlist,
src/api/events.ts:257:  if (input.allow_waitlist !== undefined) payload.allow_waitlist = input.allow_waitlist;
src/screens/EventDetailScreen.tsx:271:    setEditAllowWaitlist(event.allow_waitlist !== false);
src/screens/EventDetailScreen.tsx:352:        allow_waitlist: editAllowWaitlist,
src/screens/__tests__/EventDetailScreen.test.tsx:51:    allow_waitlist: true,
src/screens/__tests__/EventDetailScreen.test.tsx:421:      allow_waitlist: false,
src/screens/__tests__/EventDetailScreen.test.tsx:478:        allow_waitlist: false,
src/types/event.ts:64:  allow_waitlist?: boolean;
src/types/event.ts:80:  allow_waitlist?: boolean;
```
