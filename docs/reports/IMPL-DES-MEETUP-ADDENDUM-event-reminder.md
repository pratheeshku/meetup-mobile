# Implementation Report — event_reminder notification type support

## 1. Design reference

- **Doc ID**: DES-MEETUP-ADDENDUM-event-reminder
- **Version**: 1.1
- **Status**: APPROVED (shipped in backend repo)
- **Tier**: T1
- **Governing requirements**: Navigation-only to Event Detail (R-101 offline-RSVP confirmed blocking with zero implementation in any context; no direct mutation triggered from notifications).

## 2. Traceability map

| Requirement / Scope | Target File | Notes |
|---|---|---|
| Domain type extension | `src/types/notification.ts` | Added `'event_reminder'` to `NotificationType` union and `NOTIFICATION_TYPES` array (16 total). |
| Preference labels | `src/screens/NotificationPreferencesScreen.tsx` | Added `event_reminder: 'Event reminders'` to `NOTIFICATION_TYPE_LABELS` (`Record<NotificationType, string>`). |
| Target routing | `src/notifications/notificationRouting.ts` | Added `case 'event_reminder':` to `resolveNotificationTarget` switch (routes to Home > EventDetail with `{ eventId: entityId }`). |
| Local tray display handling | `src/notifications/eventNotificationHandler.ts` | Added `'event_reminder'` to `EVENT_NOTIFICATION_TYPES`, rendering dual actions (`View` + `OK`) on `PLAN_CHANNEL_ID`. View/body-tap navigates to EventDetail; OK dismisses only. |
| Routing tests | `src/notifications/__tests__/notificationRouting.test.ts` | Asserted 16 notification types; added tests for `event_reminder` routing to EventDetail identical to `event_changed`/`event_invite`. |
| Display & action tests | `src/notifications/eventNotificationHandler.test.ts` | Added test cases for `event_reminder` dual action rendering (`View`, `OK`), background press, quit-state launch, and type guard. |
| Preference tests | `src/screens/__tests__/NotificationPreferencesScreen.test.tsx` | Asserted 16 switches, "Event reminders" label presence, and toggle mutation for `event_reminder`. |
| History screen guard tests | `src/screens/__tests__/NotificationHistoryScreen.test.tsx` | Verified `event_reminder` recognized by `isKnownType`, marked as read, and routed to EventDetail. |
| FCM foreground tests | `src/notifications/__tests__/fcmForeground.test.ts` | Verified `event_reminder` delivered to `displayEventNotification` (not banner). |

## 3. Proposed Assumptions

1. **Entity ID Semantics (LOW)**: `entity_id` in the `event_reminder` push payload represents the event ID (matching `event_changed`, `event_invite`, and `group_event_created`). Unverified against a live backend push payload. If `entity_id` is missing or invalid, `EventDetailScreen`'s standard load-error state handles the condition safely without crashing.
2. **Data-only Delivery (LOW)**: Assumes backend delivers `event_reminder` as a data-only payload so that Notify-Kit can construct custom tray actions (`View` and `OK`). If sent with an FCM `notification` block, the system would show the default notification block alongside local notification.

## 4. Deviations

1. **Action Button Structure (Ratified Option B)**: The initial task brief suggested mirroring a "simpler single-action pattern" attributed to `event_changed`. Inspection revealed `event_changed` actually implements a dual-action pattern (`View` + `OK`). Per the brief's explicit tripwire instruction, a Blocked Report was issued. The architect confirmed Option B: dual-action pattern (`View` + `OK`) matching `event_changed` and `participantHandler.ts`.

## 5. Verification results

- **Type check** (`npx tsc --noEmit`): Clean (0 errors). Temporarily omitting `event_reminder` from `notificationRouting.ts` or `NotificationPreferencesScreen.tsx` verified that `exhaustiveCheck: never` and `Record<NotificationType, string>` compile guards actively catch missing cases (TS2322 and TS2741).
- **Linter** (`npx eslint . --ext .ts,.tsx`): Clean (0 errors, 0 warnings).
- **Test suite** (`npm test`): 69 passed, 69 total suites, 874 passed, 874 total tests.
- **Negative tests confirmed**:
  - OK action dismisses tray notification and makes no navigation (`eventNotificationHandler.test.ts`).
  - Dismissed event dismisses tray notification and makes no navigation (`eventNotificationHandler.test.ts`).
  - Unknown action ID does nothing (`eventNotificationHandler.test.ts`).
  - Quit-state launch from OK button returns `null` (`eventNotificationHandler.test.ts`).
  - Missing data or unhandled notification types do not navigate or throw (`eventNotificationHandler.test.ts`).
  - Unready navigation container drops navigation safely (`eventNotificationHandler.test.ts`).

## 6. Known gaps / follow-ups

- Verify end-to-end against live backend notification dispatch in staging when the backend scheduled reminder job runs.

---

### Completion Proof

**Test evidence** (raw output — no summaries):
```
$ for i in 1 2 3; do npm test -- --silent 2>&1 | tail -4; echo "--- Run $i ---"; done
Test Suites: 69 passed, 69 total
Tests:       874 passed, 874 total
Snapshots:   0 total
Time:        2.481 s, estimated 3 s
--- Run 1 ---
Test Suites: 69 passed, 69 total
Tests:       874 passed, 874 total
Snapshots:   0 total
Time:        2.871 s, estimated 3 s
--- Run 2 ---
Test Suites: 69 passed, 69 total
Tests:       874 passed, 874 total
Snapshots:   0 total
Time:        2.601 s, estimated 3 s
--- Run 3 ---
```

**Git evidence**:
```
$ git log --oneline -3
5ff9a7e feat(notifications): add event_reminder notification type support
ed75d58 chore: bump versionCode to 23
8bdf34e docs(reports): archive implementation-status for labels-api task

$ git status
On branch main
Your branch is ahead of 'origin/main' by 1 commit.
  (use "git push" to publish your local commits)

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/reports/IMPL-DES-MEETUP-ADDENDUM-event-reminder.md
	docs/reports/agent-enhancement-2026-09-26.md
	implementation-status-DES-MEETUP-ADDENDUM-event-reminder.md

nothing added to commit but untracked files present (use "git add" to track)
```

**File evidence** (grep showing key change exists on disk):
```
$ grep -rn "event_reminder" src/
src/types/notification.ts:31:  | 'event_reminder'
src/types/notification.ts:44:/** All 16 known notification types (the 12 from the task brief, the two participant types, group_event_created, plus event_reminder). */
src/types/notification.ts:50:  'event_reminder',
src/screens/__tests__/NotificationHistoryScreen.test.tsx:146:  it('recognizes event_reminder as a known type, marks read, and routes to EventDetail', async () => {
src/screens/__tests__/NotificationHistoryScreen.test.tsx:151:          notification_type: 'event_reminder',
src/screens/__tests__/NotificationPreferencesScreen.test.tsx:48:it.each(['event_participant_added', 'event_participant_removed', 'event_reminder'] as const)(
src/screens/NotificationPreferencesScreen.tsx:39:/** Human-readable labels for every known notification type (§4.8 + the two participant types + group_event_created + event_reminder). */
src/screens/NotificationPreferencesScreen.tsx:45:  event_reminder: 'Event reminders',
src/notifications/eventNotificationHandler.test.ts:48:  notification_type: 'event_reminder',
src/notifications/eventNotificationHandler.test.ts:119:  it('calls notifee.displayNotification with two actions (View, OK) for event_reminder — same shape as event_changed', async () => {
src/notifications/eventNotificationHandler.test.ts:247:  it('navigates to EventDetailScreen on a View press for event_reminder', async () => {
src/notifications/eventNotificationHandler.test.ts:258:  it('cancels the notification on an OK press (event_reminder) and makes no navigation (negative)', async () => {
src/notifications/eventNotificationHandler.test.ts:360:  it('returns the payload when the app was launched by pressing View (event_reminder)', async () => {
src/notifications/eventNotificationHandler.test.ts:367:      notification_type: 'event_reminder',
src/notifications/eventNotificationHandler.test.ts:410:  it('returns null when the initial press was the OK button on event_reminder (negative)', async () => {
src/notifications/eventNotificationHandler.test.ts:430:  it.each(['group_event_created', 'event_changed', 'event_reminder'])('accepts %s', type => {
src/notifications/__tests__/notificationRouting.test.ts:20:  it('contains both participant types, group_event_created, and event_reminder, alongside the original 12 (16 total, no duplicates)', () => {
src/notifications/__tests__/notificationRouting.test.ts:22:      expect.arrayContaining([...PARTICIPANT_TYPES, 'group_event_created', 'event_reminder']),
src/notifications/__tests__/notificationRouting.test.ts:79:describe('resolveNotificationTarget(event_reminder)', () => {
src/notifications/__tests__/notificationRouting.test.ts:81:    expect(resolveNotificationTarget('event_reminder', 'evt-42')).toEqual({
src/notifications/__tests__/notificationRouting.test.ts:89:    expect(resolveNotificationTarget('event_reminder', 'evt-42')).toEqual(
src/notifications/__tests__/notificationRouting.test.ts:92:    expect(resolveNotificationTarget('event_reminder', 'evt-42')).toEqual(
src/notifications/__tests__/notificationRouting.test.ts:98:    expect(resolveNotificationTarget('event_reminder', '')).toEqual({
src/notifications/__tests__/fcmForeground.test.ts:55:  ['event_reminder', 'Event reminder', 'Match starts in 1 hour'],
src/notifications/eventNotificationHandler.ts:3: * and `event_reminder` (DES-MEETUP-MOBILE.md §4.8; mobile notify-kit task Part 3;
src/notifications/eventNotificationHandler.ts:39: * - `event_changed` and `event_reminder`: View + OK, the identical shape
src/notifications/eventNotificationHandler.ts:88:  'event_reminder',
src/notifications/eventNotificationHandler.ts:110: * file (`event_changed`, `event_reminder`) gets View + OK — identical shape,
src/notifications/notificationRouting.ts:59: * participant types, `group_event_created`, plus `event_reminder` — 16 total) —
src/notifications/notificationRouting.ts:72:    // `group_event_created` (mobile notify-kit task, Part 3) and `event_reminder`
src/notifications/notificationRouting.ts:82:    case 'event_reminder':
```
