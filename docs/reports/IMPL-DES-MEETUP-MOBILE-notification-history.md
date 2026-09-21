# Implementation Report — Notification bell + history screen

## 1. Design reference
DES-MEETUP-MOBILE, APPROVED 2026-09-13. **Tier note:** the design (§4.8, §7.6) does not list a
history screen, unread count, or the three endpoints. Built on explicit user instruction after the
backend endpoints were confirmed live (contract = live OpenAPI, fetched 2026-09-22). The design
needs to be extended to cover this (see Deviations).

## 2. Traceability map
| Brief step | Files |
|---|---|
| 1 API client + types | `src/api/notifications.ts`, `src/types/notification.ts` |
| 2 Bell badge | `src/notifications/unreadCountStore.ts`, `src/hooks/useUnreadCount.ts`, `src/navigation/HomeHeader.tsx`, `src/notifications/fcm.ts` (`onMessage`) |
| 3 History screen | `src/screens/NotificationHistoryScreen.tsx`, `src/utils/formatRelativeTime.ts` |
| 4 Bell → screen | `src/navigation/HomeHeader.tsx`, `src/navigation/RootNavigator.tsx`, `src/navigation/types.ts` |
| 5 Tests | `src/api/__tests__/notifications.test.ts`, `src/screens/__tests__/NotificationHistoryScreen.test.tsx`, `src/navigation/__tests__/HomeHeader.test.tsx`, `src/notifications/__tests__/fcmForeground.test.ts`, `src/utils/__tests__/formatRelativeTime.test.ts` |

## 3. Proposed Assumptions
1. `NotificationHistoryItem` follows the live schema, not the brief: `notification_type: string`
   (not `NotificationType`), `title/body/entity_id/entity_type: string | null`; `next_cursor` is
   `string | null`.
2. Tapping an already-read row skips `markNotificationRead` (still navigates).
3. A failed mark-read reverts the row to unread; navigation still happens.
4. No navigation on tap when the type is unknown to this build, or `entity_id` is blank (except
   `global`). `resolveNotificationTarget` throws on unknown types.
5. Any foreground push with a string `notification_type` increments the badge (incl. participant
   types); the header re-syncs with the server on mount and every focus.
6. Unread state lives in a tiny external store (banner-store pattern), because `fcm.ts` runs outside
   React; the hook wraps it.
7. Screen is registered in the Home stack (title "Notifications").
8. Page-load failure shows a footer "Tap to retry"; first-load failure uses `ErrorView`.

## 4. Deviations
- Feature, endpoints and screen absent from DES §4.8/§7.6 — architect to ratify and extend the design.
- Brief said `notification_type: NotificationType`, string-typed nullable fields; live schema used instead (assumption 1).
- Test baseline was 615 (brief/status said 610); measured before changes.

## 5. Verification
`npx jest` → 60 suites / 647 tests (615 baseline + 32 new), 3 consecutive runs green;
`npx tsc --noEmit` and `npx eslint . --ext .ts,.tsx` clean. Negative tests: unknown type, null
entity_id, missing next_cursor, mark-read failure revert, page-load failure, null title/body, failed
count request. Not verified on a device (no build per brief).

## 6. Known gaps / follow-ups
- Badge is not refreshed when the app returns from background (only mount/focus/foreground push).
- Badge count is not reset on sign-out until the next refresh.
- `team_invite` routing caveat inherited from `notificationRouting.ts`.

### Completion Proof
**Test evidence**
```
Tests:       647 passed, 647 total
--- Run 1 ---
Tests:       647 passed, 647 total
--- Run 2 ---
Tests:       647 passed, 647 total
--- Run 3 ---
```
**File evidence**
```
src/api/notifications.ts:73:export async function getNotificationHistory(
src/api/notifications.ts:87:export async function markNotificationRead(id: string): Promise<void> {
src/api/notifications.ts:92:export async function getUnreadCount(): Promise<{ count: number }> {
```
Git evidence: see commit below / `git status` in the hand-off message.
