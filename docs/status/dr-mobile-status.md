# dr-mobile Status

Date: 2026-10-20  
Task ID: `dr-mobile`  
Status: Implemented & Verified (Zero Regression Diff against origin/main)  
Branch: `feat/dr-mobile`  

## Implementation Overview

Completed mobile client implementation for the Accept / Decline, Remembered Declined State, Organizer Response List, and Notification Push Actions feature (`DES-MEETUP-ADDENDUM-decline-response` v1.0 / `BRIEF-decline-response-mobile.md`):

1. **Labels (`src/labels/defaultLabels.ts`)**:
   - Added all 19 `mob.respond.*` keys seeded by `dr-backend`: `accept`, `decline`, `declined`, `join`, `responses`, `section.accepted`, `section.pending`, `section.declined`, `waitlisted`, `empty.accepted`, `empty.pending`, `empty.declined`, `you_declined`, `already_answered`, `unavailable`, `declined_hidden`, `via.invitation`, `via.public`, `via.joined`.
   - Verified clean with `npm run check:labels`.

2. **Types & API Layer (`src/types/`, `src/api/`)**:
   - `src/types/event.ts` & `src/types/tournament.ts`: Added `my_declined?: boolean;`, `ResponsePerson`, `ResponseSection`, `ResponsesResponse`, `DeclineAck`.
   - `src/api/events.ts`: Added `my_declined` mapping on `EventApiItem`, `declineEvent(id, options)` calling `POST /events/{id}/decline`, `getEventResponses(id, options)` calling `GET /events/{id}/responses`, and `respondToEventInvitation(id, accept, options)` calling `POST /events/{id}/invitations/respond`.
   - `src/api/tournaments.ts`: Added `my_declined` mapping on `TournamentApiItem`, `declineTournament(id, options)` calling `POST /tournaments/{id}/decline`, `getTournamentResponses(id, options)` calling `GET /tournaments/{id}/responses`, and `respondToTournamentInvitation(id, accept, options)` calling `POST /tournaments/{id}/invitations/respond`.

3. **Badge & Lists (`src/utils/gameLists.ts`, `GameRow.tsx`, `UnifiedCard.tsx`)**:
   - Updated `getGameBadge` to return `'Declined'` when `event.my_declined` is true.
   - Updated `isMyGame` and `isOpenGame` to filter `!event.my_declined`.
   - Configured badge styling with theme tokens (`dash.tabIdleBg`, `dash.cardBorder`, `dash.textMuted`). Zero literal colours.

4. **Organizer Responses Component (`src/components/responses/ResponsesSection.tsx`)**:
   - Built card component rendering Accepted, Pending, and Declined sections with total counts and person rows.
   - Person rows show user avatar, display name (fallback to email for unclaimed invitations), waitlisted badge tag, and decline via source pill (`Invited`, `Public`, `Joined`).
   - Empty states rendered cleanly: "No one yet", "No one has declined". Read-only with zero inline mutating actions.

5. **Detail Screens (`EventDetailScreen.tsx`, `TournamentDetailScreen.tsx`)**:
   - **Invited state**: Displays Accept and Decline buttons.
   - **Public open state**: Displays Join and Decline buttons (tournament: Register and Decline).
   - **Joined state**: Withdraw control displays Decline label and surfaces server reason on refusal while maintaining accessibility.
   - **Declined state**: Displays `Declined` status pill and recovery action button (Accept for invited items; Join/Register for public items).
   - **Organizer responses**: Mounted `ResponsesSection` visible only to the organizer when responses are returned.
   - **Locking**: Mutate actions disabled when ended; surfaces 409 `game_ended`.

6. **Push Actions (`src/notifications/pushActions.ts`)**:
   - Replaced Ignore with Decline (`DECLINE_ACTION_ID = 'decline'`) for `event_invite` and `tournament_invited` across Android action buttons and iOS category configurations.
   - Decline calls `POST .../invitations/respond` with `{ accept: false }`.
   - Result notifications display localized messages: "You declined" (200), "Already answered" (400), "This game is no longer available" / "This tournament is no longer available" (404).
   - Preserved Leave group and Ignore for `group_invite`.

## Verification Summary
- **Baseline vs Branch Diff**: **0 regression suites** (14 failing on origin/main, exact same 14 failing on feat/dr-mobile).
- **Touched files lint**: **0 errors, 0 warnings** in all touched files.
- **TypeScript**: `npx tsc --noEmit` clean (exit code 0).
- **Labels**: `npm run check:labels` clean (exit code 0).
- **Test Suites**: 182 total (168 passing, 14 pre-existing failures).
- **Tests**: 2260 total (2092 passing, 168 pre-existing failures).
