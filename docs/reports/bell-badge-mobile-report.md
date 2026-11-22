# Implementation report: Task 3.1, notification bell unread badge (mobile)

Design: DES-MEETUP-ADDENDUM-NOTIFICATION-BELL-BADGE v1.0 (not in this repo; this session reads only `meetup-mobile`, so the brief's NB-01..NB-07 were the spec). Branch `claude/inspiring-keller-rmeu33`. Not self-certified: this is evidence for the owner's review.

## Audit (done before any code change; full text in docs/status/bell-badge-mobile-status.md)
- Bell placements: `HomeTopBar` (only live one; showed a bare dot, no number) and `DashboardBanner` (own numeric badge, not mounted anywhere, only rendered in tests). The notifications screen has no bell.
- Count read that already exists: `GET /notifications/unread-count` -> `{ count: number }` (`getUnreadCount`, `src/api/notifications.ts`). The list response has no count field. No endpoint or field invented.
- Mark actions on the screen: `POST /notifications/{id}/read`, `/unread`, `POST /notifications/read-all`; card tap, swipe/long-press toggle, Mark all, Undo.
- Store and hook already existed; gaps were: dot instead of number, duplicated display rule, no clear on sign-out, no immediate update after mark actions, and a refresh joining an older in-flight read could return a stale value.

## Changes
- `src/utils/badgeCount.ts`: `formatBadgeCount` (0 hidden, 1-99 exact, 100+ "99+"), used by `HomeTopBar` and `DashboardBanner`.
- `HomeTopBar`: dot replaced by the numeric badge (same look as the banner badge; `dash.badgeRed`, `sizes.notificationBadge`, `colors.white`, no literals). Accessibility label is the existing `mob.dashboard.notifications_unread_a11y` ("Notifications, {count} unread"); no new label, no new icon.
- `unreadCountStore`: `adjustUnreadBadgeCount`, `clearUnreadBadgeCount`.
- `useUnreadCount`: a refresh requested while one is in flight now triggers one follow-up read (no stale answer); `resetUnreadCount` clears and drops any response still on its way for the old user.
- `AuthContext`: `resetUnreadCount()` whenever the user id changes (sign-out, session expiry, account switch).
- `NotificationHistoryScreen`: reads the shared store (own count state and own fetch removed); on each mark action the badge changes at once (-1, +1, or 0 for read-all, same for Undo), then the server value replaces it.
- Triggers unchanged and per NB-03 only: Home focus/foreground (`useRefetchOnFocus`), foreground push (`fcm.ts`), notifications screen load/mark. No polling, no stream, no new library.

## Checks
- `npx tsc --noEmit`: clean. `npm run lint`: clean. `npm run check:labels`: OK - 352 files scanned, 2169 default labels checked.
- Tests added: formatter (0, 1, 5, 99, 100, 250, negative, NaN); store/hook (server value, last value kept on failure, immediate adjust floor 0, cleared on reset with late response dropped, no stale join, no polling); `HomeTopBar` badge at 0/5/99/150 incl. a11y label; screen updates store before the server answers, 0 on mark-all, last value kept when the read fails; `AuthContext` clears on sign-out and on `auth-expired`. Existing `HomeScreen` tests already cover refetch on focus and foreground.
- Two jest runs, both on affected files only (not the full suite): run 1 = 12 suites / 200 tests passed; run 2 (adds all of `src/auth` and coverage) output below.

### Raw jest output (run 2, coverage limited to touched files)
```
PASS src/auth/__tests__/socialSignupTicket.test.tsx
PASS src/auth/__tests__/silentRefresh.test.tsx
PASS src/auth/__tests__/sessionExpiry.test.tsx
PASS src/auth/__tests__/appleAuth.test.ts
PASS src/auth/__tests__/signInNoRefreshToken.test.tsx
PASS src/auth/__tests__/signOut.test.ts
PASS src/auth/__tests__/signOutSession.test.ts
PASS src/auth/__tests__/invitationFields.test.ts
PASS src/auth/__tests__/googleSignInPlatform.test.tsx (5.512 s)
PASS src/screens/__tests__/NotificationHistoryScreen.test.tsx
PASS src/auth/__tests__/AuthContext.push.test.tsx
PASS src/components/home/__tests__/homeComponents.test.tsx
PASS src/components/home/__tests__/HomeTopBarBadge.test.tsx
PASS src/hooks/__tests__/useUnreadCount.test.ts
PASS src/utils/__tests__/badgeCount.test.ts
PASS src/screens/__tests__/HomeScreen.test.tsx (7.58 s)
--------------------------------|---------|----------|---------|---------|--------------------------------------------------------------------------------------
File                            | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s                                                                    
--------------------------------|---------|----------|---------|---------|--------------------------------------------------------------------------------------
  DashboardBanner.tsx           |     100 |     87.5 |     100 |     100 | 101,114                                                                              
  HomeTopBar.tsx                |     100 |    73.91 |     100 |     100 | 62-79,117,133,166,185                                                                
  useUnreadCount.ts             |     100 |      100 |     100 |     100 |                                                                                      
  unreadCountStore.ts           |     100 |      100 |     100 |     100 |                                                                                      
  NotificationHistoryScreen.tsx |   70.77 |    60.25 |   60.52 |   72.13 | 81-84,93-102,165,202,273-280,287-312,346-351,374-375,381-408,434-437,452,459,491,531 
  badgeCount.ts                 |     100 |      100 |     100 |     100 |                                                                                      
--------------------------------|---------|----------|---------|---------|--------------------------------------------------------------------------------------
Test Suites: 16 passed, 16 total
Tests:       198 passed, 198 total
```
Coverage delta: baseline was not measured (no pre-change coverage run), so there is no delta to report. Absolute figures above; `NotificationHistoryScreen.tsx` is 70.8% statements because most of that screen's older paths are covered by other suites not run here.

## NOT done / owner action
- **Screenshots (0, 5, 100+): not produced.** No emulator or device in this environment. The badge states are asserted in tests only.
- **NB-02 not verified end to end**: whether `/notifications/unread-count` equals the Unread tab count with retracted excluded depends on backend task 1.1 in `~/meetup`, which I cannot read. The app never counts from the list.
- Design drift: the addendum is not in `docs/`, and no board exists for the badge. Built minimal from the existing banner badge style; owner to review. `DashboardBanner` is unmounted dead code and is only kept in step with the formatter.
- Optimistic -1/+1 on mark actions is the NB-03 "update immediately"; it replaces an earlier deliberate "never adjust locally" rule in the screen's comments/tests (the final value is still always the server's).
- No version numbers or build numbers touched; `docs/` governance files untouched (only this report and the status file added).

## Git
Push evidence is appended below after the push.
