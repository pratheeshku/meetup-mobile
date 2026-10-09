# Implementation Report: In-App Notifications Screen Revamp

## 1. Design Reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version**: APPROVED, architect-approved 2026-09-13
- **Status**: APPROVED
- **Tier**: Tier 1 / In-app notifications screen revamp (React Native bare workflow)
- **Visual Design Reference**: `docs/design/notifications/01-13.png`
  - 01: All tab
  - 02: Unread tab
  - 03: Read tab
  - 04/05: After Mark all as read (All & Read tabs)
  - 06: Unread empty state ("You're all caught up")
  - 07/08: Swipe on All tab (Mark read & Mark unread)
  - 09: Icon registry & glyph specs
  - 10/11: Unread tab swipe and after Mark read (toast & list removal)
  - 12/13: Read tab swipe and after Mark unread (toast & list removal)

---

## 2. Traceability Map

| Design Requirement / Spec | Implementation Files | Commit |
|---|---|---|
| **A. Labels**: No hard-coded text; admin-managed `ui_labels` via `useT()`; template rendering with placeholders; `check-labels.js` passing | `src/labels/defaultLabels.ts`, `src/labels/fallbackLabels.ts`, `src/labels/LabelsContext.tsx`, `src/utils/notificationTemplateUtils.ts` | `e38e5bb` |
| **B.1 Header**: Back button, title ("Notifications"), right-hand "Mark all as read" (blue check icon, disabled/muted when unread count = 0) | `src/screens/NotificationHistoryScreen.tsx`, `src/components/icons/ActionIcons.tsx` | `e38e5bb` |
| **B.2 Tabs**: All \| Unread \| Read pill tabs (min-height 44px); Unread count chip when > 0 (white on active blue pill, blue on inactive white pill) | `src/screens/NotificationHistoryScreen.tsx` | `e38e5bb` |
| **B.3 List & Grouping**: Single SectionList, newest first, cursor-paged, grouped Today / Yesterday / Earlier by device local date; empty groups hidden | `src/screens/NotificationHistoryScreen.tsx`, `src/utils/notificationDateUtils.ts` | `e38e5bb` |
| **B.4 Card Styles**: Unread: bg `#EAF1FF`, border `#C6D9FF`, title weight 800, body `#52617E`, blue time + 10px blue dot, full-colour icon tile with shadow. Read: white bg, border `#E3EAF7`, title weight 600, body `#62718F`, grey time, no dot, icon tile at 60% opacity with no shadow | `src/components/NotificationCard.tsx`, `src/components/icons/NotificationIcon.tsx` | `e38e5bb` |
| **B.5 Footer**: "Notifications are kept for {days} days" (days from API, default 90) | `src/screens/NotificationHistoryScreen.tsx` | `e38e5bb` |
| **B.6 Empty States**: Image 06 style (76px amber bell icon, "You're all caught up", subtitle, "View all notifications" CTA on Unread; matching styles for All and Read) | `src/screens/NotificationHistoryScreen.tsx` | `e38e5bb` |
| **B.7 Typography & Targets**: Plus Jakarta Sans, min 44px touch targets | `src/screens/NotificationHistoryScreen.tsx`, `src/components/NotificationCard.tsx` | `e38e5bb` |
| **C.1 Tap Card**: Marks read if unread, then navigates to related event or group | `src/screens/NotificationHistoryScreen.tsx`, `src/components/NotificationCard.tsx` | `e38e5bb` |
| **C.2 Swipe Left**: Reveals 96px action button (Unread: "Mark read" blue `#1961F7` with check; Read: "Mark unread" grey `#52617E` with mark-unread icon). Accessible via long-press and `toggle_read` custom action | `src/components/NotificationCard.tsx`, `src/components/icons/ActionIcons.tsx` | `e38e5bb` |
| **C.3 Mark All as Read**: Calls bulk endpoint (`POST /notifications/read-all`), flips all to read, decrements chip and unread badge to 0 | `src/api/notifications.ts`, `src/screens/NotificationHistoryScreen.tsx` | `e38e5bb` |
| **C.4 Tab Filtering Behaviour**: All tab: styling flips in place. Unread tab: card leaves list after mark read. Read tab: card leaves list after mark unread | `src/screens/NotificationHistoryScreen.tsx` | `e38e5bb` |
| **C.5 Undo Toast**: Dark bar `#0F2347` at bottom with 16px margins, message + right-hand "Undo" (`#9CC0FF`, 44px target), 5-second auto-dismiss, restores state and invokes opposite endpoint (`POST /notifications/{id}/unread` or read) | `src/screens/NotificationHistoryScreen.tsx`, `src/api/notifications.ts` | `e38e5bb` |
| **C.6 Optimistic Updates**: Optimistic UI updates with rollback on failure; tab chip and badge store kept in sync | `src/screens/NotificationHistoryScreen.tsx` | `e38e5bb` |
| **D Icons (Image 09)**: Registry component mapping 10 notification types. 4 new registry icons added: `cancelled` (red), `player-removed` (orange), `owner` (amber), `mark-unread` (gray). Fallback to `notifications` (amber) for unknown types | `src/components/icons/RegistryIcons.tsx`, `src/components/icons/NotificationIcon.tsx`, `src/components/icons/ActionIcons.tsx` | `e38e5bb` |

### Label Audit: Reused Keys vs New Keys

#### Reused Keys:
- `mob.common.back` ('Back')
- `mob.nav.title_notifications` ('Notifications')
- `mob.time.today` ('Today')
- `mob.time.yesterday` ('Yesterday')
- `mob.time.earlier` ('Earlier')
- `mob.common.undo` ('Undo')
- `mob.notif_history.load_error` ('Could not load your notifications. Please try again.')
- `mob.notif_history.more_error` ('Could not load more. Tap to retry.')
- `mob.notif_history.unread_prefix` ('Unread notification:')

#### New Keys:
- `mob.notif_history.mark_all_read`: 'Mark all as read'
- `mob.notif_history.mark_all_read_a11y`: 'Mark all notifications as read'
- `mob.notif_history.tab_all`: 'All'
- `mob.notif_history.tab_unread`: 'Unread'
- `mob.notif_history.tab_unread_a11y`: 'Unread notifications, {count} unread'
- `mob.notif_history.tab_read`: 'Read'
- `mob.notif_history.action_mark_read`: 'Mark read'
- `mob.notif_history.action_mark_unread`: 'Mark unread'
- `mob.notif_history.swipe_hint`: 'Swipe left on a notification to mark it read or unread'
- `mob.notif_history.footer_retention`: 'Notifications are kept for {days} days'
- `mob.notif_history.empty_unread_title`: "You're all caught up"
- `mob.notif_history.empty_unread_subtitle`: 'New notifications will show up here. Earlier ones are still in All.'
- `mob.notif_history.empty_unread_button`: 'View all notifications'
- `mob.notif_history.empty_all_title`: 'No notifications yet'
- `mob.notif_history.empty_all_subtitle`: "We'll notify you about games, updates, and invitations here."
- `mob.notif_history.empty_read_title`: 'No read notifications'
- `mob.notif_history.empty_read_subtitle`: "Notifications you've read will appear here."
- `mob.notif_history.toast_marked_read`: 'Marked as read'
- `mob.notif_history.toast_marked_unread`: 'Marked as unread'
- `mob.notif_history.toast_all_marked_read`: 'Marked all as read'
- `mob.notif_history.fallback_title`: 'Notification'
- Notification per-type title and body template keys:
  - `notif.event_reminder.title` / `notif.event_reminder.body`
  - `notif.event_changed.title` / `notif.event_changed.body`
  - `notif.event_participant_added.title` / `notif.event_participant_added.body`
  - `notif.waitlist_promoted.title` / `notif.waitlist_promoted.body`
  - `notif.group_event_created.title` / `notif.group_event_created.body`
  - `notif.event_cancelled.title` / `notif.event_cancelled.body`
  - `notif.event_participant_removed.title` / `notif.event_participant_removed.body`
  - `notif.group_ownership_transferred.title` / `notif.group_ownership_transferred.body`
  - `notif.group_deleted.title` / `notif.group_deleted.body`
  - `notif.event_invite.title` / `notif.event_invite.body`
  - `notif.group_invite.title` / `notif.group_invite.body`
  - `notif.tournament_match_scheduled.title` / `notif.tournament_match_scheduled.body`
  - `notif.tournament_result_posted.title` / `notif.tournament_result_posted.body`
  - `notif.tournament_cancelled.title` / `notif.tournament_cancelled.body`
  - `notif.tournament_schedule_published.title` / `notif.tournament_schedule_published.body`

---

## 3. Proposed Assumptions

1. **Assumption 1**: Retention period `days` defaults to 90 days if the backend `NotificationHistoryPage` response omits `retention_days` / `days`.
2. **Assumption 2**: Both long-press on a notification card and custom accessibility action `toggle_read` are provided to meet accessible alternatives requirement for the horizontal swipe gesture.
3. **Assumption 3**: When an unknown notification type is encountered and neither `title` nor template exists, the title safely falls back to `mob.notif_history.fallback_title` ("Notification").

---

## 4. Deviations

None. All visual and behavioral contracts from images 01-13 and the user brief were implemented exactly.

---

## 5. Verification Results

- `node scripts/check-labels.js`: OK — 184 files scanned, 846 default labels checked.
- `npx jest`: All 6 notification-related test suites passed (63/63 tests passing across 3 runs).
- Negative tests verified:
  - Unknown notification type fallback to `notifications` icon and safe template rendering.
  - Missing entity IDs safely ignored during routing without errors.
  - API errors on `markNotificationRead`, `markNotificationUnread`, `markAllNotificationsRead` roll back optimistic UI state cleanly and dismiss undo toast.
  - Empty notification states per tab verified.
  - "Mark all as read" disabled when unread count is 0.

---

## 6. Known Gaps / Follow-ups

- Push notifications SDK and system notification routing are out of scope per user specification.
- Category filtering tabs and multi-select are out of scope per user specification.

---

## 7. Completion Proof

### Completion Proof

**Test evidence** (raw output — no summaries):
```
Test Suites: 6 passed, 6 total
Tests:       63 passed, 63 total
Snapshots:   0 total
Time:        1.093 s
Ran all test suites matching /src\/api\/__tests__\/notifications.test.ts|src\/utils\/__tests__\/notificationDateUtils.test.ts|src\/utils\/__tests__\/notificationTemplateUtils.test.ts|src\/components\/icons\/__tests__/RegistryIcons.test.tsx|src\/components\/__tests__/NotificationCard.test.tsx|src\/screens\/__tests__/NotificationHistoryScreen.test.tsx/i.
--- Run 1 ---
Test Suites: 6 passed, 6 total
Tests:       63 passed, 63 total
Snapshots:   0 total
Time:        0.87 s, estimated 1 s
Ran all test suites matching /src\/api\/__tests__\/notifications.test.ts|src\/utils\/__tests__\/notificationDateUtils.test.ts|src\/utils\/__tests__\/notificationTemplateUtils.test.ts|src\/components\/icons\/__tests__/RegistryIcons.test.tsx|src\/components\/__tests__/NotificationCard.test.tsx|src\/screens\/__tests__/NotificationHistoryScreen.test.tsx/i.
--- Run 2 ---
Test Suites: 6 passed, 6 total
Tests:       63 passed, 63 total
Snapshots:   0 total
Time:        0.853 s, estimated 1 s
Ran all test suites matching /src\/api\/__tests__\/notifications.test.ts|src\/utils\/__tests__\/notificationDateUtils.test.ts|src\/utils\/__tests__\/notificationTemplateUtils.test.ts|src\/components\/icons\/__tests__/RegistryIcons.test.tsx|src\/components\/__tests__/NotificationCard.test.tsx|src\/screens\/__tests__/NotificationHistoryScreen.test.tsx/i.
--- Run 3 ---
```

**Git evidence**:
```
e38e5bb (HEAD -> chore/merge-p2p3-into-main) feat(notifications): revamp in-app notifications screen to match design
77059cf (origin/chore/merge-p2p3-into-main) fix(ios): add REACT_NATIVE_PRODUCTION=1 in post_install for React-Core-prebuilt
58d63e8 test(ci): handle array and string in post_install strip_flag
```
```
On branch chore/merge-p2p3-into-main
Your branch is ahead of 'origin/chore/merge-p2p3-into-main' by 1 commit.
  (use "git push" to publish your local commits)

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   implementation-status-DES-MEETUP-MOBILE.md

no changes added to commit (use "git add" and/or "git commit -a")
```

**File evidence** (grep showing key change exists on disk):
```
src/screens/NotificationHistoryScreen.tsx:40:import NotificationCard from '../components/NotificationCard';
src/screens/NotificationHistoryScreen.tsx:616:            <NotificationCard
```
