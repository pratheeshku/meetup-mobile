# Implementation Report — Email-Invite Search Extension (Mobile)

## 1. Design Reference
- **Document ID**: `DES-MEETUP-ADDENDUM-shareable-links`
- **Version**: v1.8
- **Status**: APPROVED
- **Scope**: Decisions 22–25 (Email-Invite Search Extension on Mobile)

## 2. Traceability Map
| Decision / Requirement | Description | Files Modified | Test Coverage |
| :--- | :--- | :--- | :--- |
| **Decision 22** | Matched email is never displayed in search results; name/nickname only. | [`src/components/UserSearchPicker.tsx`](file:///Users/pratheesh/Developer/meetup-mobile/src/components/UserSearchPicker.tsx) | [`src/components/__tests__/UserSearchPicker.test.tsx`](file:///Users/pratheesh/Developer/meetup-mobile/src/components/__tests__/UserSearchPicker.test.tsx) |
| **Decision 23** | When search query is a valid email (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) AND search returns 0 results, show "Invite \<email\> as new member/participant" affordance. | [`src/components/UserSearchPicker.tsx`](file:///Users/pratheesh/Developer/meetup-mobile/src/components/UserSearchPicker.tsx) | [`src/components/__tests__/UserSearchPicker.test.tsx`](file:///Users/pratheesh/Developer/meetup-mobile/src/components/__tests__/UserSearchPicker.test.tsx) |
| **Decision 24** | In `GroupDetailScreen`, selecting email affordance posts to `POST /groups/invitations` with `{ group_id, invited_email }` (distinct from existing `POST /groups/{id}/invite` user path). | [`src/api/groups.ts`](file:///Users/pratheesh/Developer/meetup-mobile/src/api/groups.ts), [`src/screens/GroupDetailScreen.tsx`](file:///Users/pratheesh/Developer/meetup-mobile/src/screens/GroupDetailScreen.tsx) | [`src/api/__tests__/groups.test.ts`](file:///Users/pratheesh/Developer/meetup-mobile/src/api/__tests__/groups.test.ts), [`src/screens/__tests__/GroupDetailScreen.test.tsx`](file:///Users/pratheesh/Developer/meetup-mobile/src/screens/__tests__/GroupDetailScreen.test.tsx) |
| **Decision 25** | In `EventDetailScreen`, selecting email affordance posts to `POST /events/{event_id}/invite-email` with `{ email }` (distinct from existing `POST /events/{id}/invite-user` user path). | [`src/api/events.ts`](file:///Users/pratheesh/Developer/meetup-mobile/src/api/events.ts), [`src/types/event.ts`](file:///Users/pratheesh/Developer/meetup-mobile/src/types/event.ts), [`src/screens/EventDetailScreen.tsx`](file:///Users/pratheesh/Developer/meetup-mobile/src/screens/EventDetailScreen.tsx) | [`src/api/__tests__/events.test.ts`](file:///Users/pratheesh/Developer/meetup-mobile/src/api/__tests__/events.test.ts), [`src/screens/__tests__/EventDetailScreen.test.tsx`](file:///Users/pratheesh/Developer/meetup-mobile/src/screens/__tests__/EventDetailScreen.test.tsx) |

## 3. Proposed Assumptions
None. Both endpoints (`POST /groups/invitations` with `invited_email` and `POST /events/{event_id}/invite-email`) were audited live on `https://meetups.duckdns.org/openapi.json` and matched against the web frontend reference (`frontend/app.js`).

## 4. Deviations
None.

## 5. Verification Results
- **TypeScript compilation**: `npx tsc --noEmit` exited 0 cleanly.
- **ESLint**: `npx eslint src/` exited 0 cleanly.
- **Full test suite execution**: `npm test -- --coverage` passed 75/75 test suites, 962/962 tests passing.
- **Negative tests confirmed**:
  - Invalid email addresses do not trigger the invite-by-email affordance; standard "No users found." is displayed.
  - Queries matching existing users do not show the affordance; matched users display display_name/nickname and never leak email addresses (Decision 22).
  - Unprovided `onSelectEmail` callback gracefully suppresses the email affordance even on valid email queries.
  - Error propagation on API failure properly surfaced to the user in both screens without closing the form.

## 6. Known Gaps / Follow-ups
None.

## 7. Completion Proof

### Test evidence (raw output — single run):
```
Test Suites: 75 passed, 75 total
Tests:       962 passed, 962 total
Snapshots:   0 total
Time:        6.516 s
Ran all test suites.
```

### Git evidence:
```
3835892 fix(share): align event share URL format with web router (#event-detail)
3c040fb chore: sync versionCode to 29 (local build drift, uncommitted across prior runs)
118218c Merge branch 'feat/mobile-shareable-links'
```

### File evidence:
```
$ grep -n "invite-email" src/api/events.ts
317: * Invite an email address to an event: calls `POST /events/{id}/invite-email`.
325:    `/events/${eventId}/invite-email`,

$ grep -n "invited_email" src/api/groups.ts
220: * When `invitedEmail` is specified, attaches `invited_email` to the request body.
226:  const body: { group_id: string; invited_email?: string } = { group_id: groupId };
228:    body.invited_email = options.invitedEmail;

$ grep -n "showEmailAffordance" src/components/UserSearchPicker.tsx
131:  const showEmailAffordance =
134:    !isSearching && !error && hasSearched && results.length === 0 && !showEmailAffordance;
151:      {showEmailAffordance ? (
```
