# bell-badge-mobile Status: Task 3.1, notification bell unread badge

Branch: `claude/inspiring-keller-rmeu33`, cut from main (1ec9779). Not merged.
Source: task brief (DES-MEETUP-ADDENDUM-NOTIFICATION-BELL-BADGE v1.0, NB-01..NB-07). The addendum itself is NOT in this repo's `docs/` and this session can only read `meetup-mobile`, so the brief's text is the only spec used. No board exists for the badge (see Drift).

## AUDIT (before any code change)

**1. Existing badge / count on the bell**
- `HomeTopBar` (live on Home): shows a bare red DOT (`bell-unread-dot`) when count > 0. No number. Hard-coded colour/size literals.
- `DashboardBanner`: has a numeric badge with its own `MAX_BADGE_COUNT` / `99+` logic, but is NOT mounted anywhere (RootNavigator only mentions it in a comment; only `homeComponents.test.tsx` renders it). Dead placement; it duplicates the display rule.
- Store: `src/notifications/unreadCountStore.ts` (module-level number, `set`/`get`/`subscribe`). Hook: `src/hooks/useUnreadCount.ts` (`refreshUnreadCount`, `useUnreadBadgeCount`). Both already exist.
- Clearing on sign-out / account switch: NOT done anywhere (`AuthContext.signOut` only clears `user`). The old count would show for the next user until their first fetch.

**2. Every screen showing the bell**
- `HomeScreen` -> `HomeTopBar` (only live bell). `DashboardBanner` unused. `NotificationHistoryScreen` is the bell's target and has no bell itself. No bell in tab headers or other stacks (grep of `src/`).

**3. Existing unread-count read**
- `GET /notifications/unread-count` -> `{ count: number }` (`src/api/notifications.ts:106` `getUnreadCount`, commented as live OpenAPI `UnreadCountResponse`). Usable, so no STOP. I cannot read `~/meetup`, so "same number as the Unread tab, retracted excluded" (NB-02) is NOT verified from here; it depends on backend task 1.1. The list response (`GET /notifications/history`) carries no count field and is not used for counting.

**4. Existing triggers**
- Sign-in / Home focus / app foreground while Home focused: `HomeScreen.loadOnOpen` -> `refreshUnreadCount()` through `useRefetchOnFocus` (focus + AppState).
- Push while open: `fcm.ts` foreground handler -> `refreshUnreadCount()`.
- Notifications screen: own copy of the fetch (`syncUnreadCount`, local `unreadCount` state, writes the store) on load and after each mark call settles. It deliberately never adjusts the count before the server answers.
- Mark actions on the screen: `POST /notifications/{id}/read`, `POST /notifications/{id}/unread`, `POST /notifications/read-all` (`markNotificationRead/Unread`, `markAllNotificationsRead`); card tap (read), swipe/long-press toggle, Mark all, and Undo (re-unread / re-read / bulk unread).

## GAPS vs requirements
- NB-01: HomeTopBar shows a dot, not the count. Rule duplicated in DashboardBanner, no shared formatter.
- NB-03: no immediate update after mark actions (waits for server). A refresh that joins an already-running request can return a stale value (mark -> refresh reuses the earlier in-flight read).
- NB-04: not cleared on sign-out / account switch; a late response from the old user can also land after sign-out.
- NB-05: already keeps last value, no error UI (OK).
- NB-06: label `mob.dashboard.notifications_unread_a11y` ("Notifications, {count} unread") already exists in `defaultLabels.ts` and the inventory; reuse, add nothing.
- NB-07: no polling today (OK).

## Plan
One store (existing) + one refresh path (hook) with epoch reset and no-stale-join; `formatBadgeCount` in `src/utils/badgeCount.ts` used by HomeTopBar and DashboardBanner; screen reads the store (drops its own state and fetch); optimistic +/-1 and 0 on mark actions then server reconcile; reset on user change in `AuthContext`.
