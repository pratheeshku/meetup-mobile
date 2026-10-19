# pa-clients-ios-press: Blocked Report (delivery path) plus the client changes that were safe

Branch `pa/clients-ios-press`, from `origin/main` `7038f47` (contains `f1fa47d`; main moved on after PR #39 and two build-number commits, none touch notifications). No backend change, no new endpoint, no PR opened.

**Status: PARTLY BLOCKED. iOS device behaviour is UNVERIFIED. Nothing here has run on an iPhone or iPad.**

## 1. Verdict on the three suspects (read from the installed sources)

Libraries: `react-native-notify-kit` 10.7.1, `@react-native-firebase/messaging` ^26.4.0.

### Suspect 1: `handlePushActionEvent` returns silently on missing id / type. NOT the cause (JS side is fine when the event arrives)
- When notify-kit does parse a remote push it builds `detail.notification` in `NotifeeCoreUtil.m:1152-1176`: `dictionary[@"id"] = request.identifier` (line 1156, the APNs request id, always present) and `dictionary[@"data"] = [self parseDataFromUserInfo:userInfo]` (line 1175). `parseDataFromUserInfo` (line 1180) copies every top-level custom key and skips only `aps`, `gcm.*`, `google.*`, `notifee*`, `fcm*`. So an iOS push's `notification_type`, `entity_id`, `delivery_id` land in `data` exactly as on Android, provided the backend sends them as top-level custom keys.
- Still hardened: `pushActions.ts` now falls back to `data.delivery_id` when `notification.id` is missing (tracking and result notification), as asked. This does not fix the symptom.

### Suspect 2: the press never reaches JS. THIS IS THE LIKELY ROOT CAUSE (static evidence; chain order not proven on device)
Delivery of a remote-push action press, in `NotifeeCore+UNUserNotificationCenter.m` `didReceiveNotificationResponse` (line 275 on):
- Line 283: a remote push has no notify-kit payload, so `notifeeNotification == nil`.
- Lines 299-305: with `shouldHandleRemoteNotifications` on (the default, line 97), **if `_originalDelegate != nil` and it responds to `didReceiveNotificationResponse`, the response is forwarded to it and the method returns. No JS event is emitted.**
- Only when there is no responding original delegate does it reach line 307, `parseUNNotificationRequest`, and then emit `ACTION_PRESS` to JS.
- Turning the flag off (lines 284-296) forwards to the original delegate unconditionally, which is worse, not better.

Who is the "original delegate" here: `@react-native-firebase/messaging` installs one (`RNFBMessaging+UNUserNotificationCenter.m`, `observe`, line ~85 of `RNFBMessaging+NSNotificationCenter.m`). Its `didReceiveNotificationResponse` (lines 150-173) emits `messaging_notification_opened` **only for the default tap** (line 155, `UNNotificationDefaultActionIdentifier`), then forwards to its own original delegate or just calls `completionHandler()` (line 172). It never emits custom actions. So if RNFB sits behind notify-kit, an Accept/Ignore press is swallowed natively: no JS event, no POST. That matches the report exactly ("server logs show no request").

Chain order: both libraries observe `UIApplicationDidFinishLaunchingNotification` from `+load` (notify-kit `NotifeeCore+NSNotificationCenter.m:67-78`, RNFB `RNFBMessaging+NSNotificationCenter.m:74-85`), and notify-kit also re-chains on every `UIApplicationDidBecomeActive` (line 81-82 → `rechainUserNotificationCenterDelegate`, `NotifeeCore+UNUserNotificationCenter.m:124-137`, which makes whatever delegate is current its `originalDelegate`). Which class's `+load` runs first depends on link order, and I cannot determine it without a build. Inference only: if RNFB is first, notify-kit captures it as the original delegate and swallows every remote press. The previous task (`docs/reports/pa-clients-mobile-report.md`, Open risk 1) flagged this exact possibility and said it needed the iOS device matrix; the spike used local notifications, which carry a notify-kit payload and therefore bypass this branch (line 191/275 `notifeeNotification != nil`).

`FirebaseAppDelegateProxyEnabled` is not set in `ios/MeetupMobile/Info.plist` (default on). `AppDelegate.swift` only calls `FirebaseApp.configure()`; it does not set a notification-center delegate. The proxy setting does not change the delegate chain described above.

### Suspect 3: category registration. Looks correct
- `registerPushActionCategories` runs at top level in `index.js:54` and again on `RootNavigator` mount (`RootNavigator.tsx:475`), before any press of a later push.
- Category ids registered: `invite_game`, `invite_tournament`, `group_added` (`PUSH_ACTION_SCOPE`, `pushActions.ts`), actions `accept`/`leave` and `ignore`, `foreground:false`. The buttons do appear on device, so the category and `aps.category` match.
- Not verified here: that the backend `aps.category` strings equal these (backend repo not in scope).

## 2. BLOCKED: what would actually fix delivery (needs your decision)
A client-only JS change cannot fix suspect 2: the press is consumed natively before JS. Every fix is native or contract-level, so per the brief I stopped instead of choosing.

| Option | What | Trade-off |
|---|---|---|
| A. Native delegate in the app | Add a small `UNUserNotificationCenterDelegate` (Swift, in `ios/MeetupMobile`) installed after both libraries, that for `invite_game`/`invite_tournament`/`group_added` action ids builds the notify-kit event and hands it to notify-kit, and forwards everything else down the chain | Fixes the cause for remote pushes. Native code, relies on notify-kit internals (`NotifeeCoreDelegateHolder`), cannot be unit-tested here, needs a TestFlight round. Touches native config (STACK-GOTCHAS). |
| B. Fix the chain order | Make notify-kit the outermost delegate with no original (or RNFB inside it, answering only default taps) | Smaller, but fragile: notify-kit re-chains on every `didBecomeActive`, and if each ends up as the other's original the forward loops. RNFB would then lose its `messaging_notification_opened` / foreground `onMessage` events. Not safe to choose blind. |
| C. Server sends iOS action pushes data-only, app displays them locally with notify-kit | A notify-kit-owned notification always emits to JS (`NotifeeCore+UNUserNotificationCenter.m:191, 275`) | Needs a backend contract change and silent-push delivery is not guaranteed on iOS. Out of scope here. |
| D. `foreground:true` on the buttons | Opens the app on press | Does not help: the press is still swallowed by the same delegate chain, and it changes the no-open design. Not recommended. |

Recommendation: A, after one TestFlight build with the diagnostics below, because they will show whether the press reaches JS at all.

## 3. What changed (client, safe, no behaviour risk on Android)
- `src/notifications/pushActions.ts`
  - `handlePushActionEvent`: `notificationId = detail.notification?.id || data.delivery_id`; early returns now log a reason.
  - New exported `describeNotificationEvent(event)`: shape only.
  - Doc header notes the diagnostics.
- `src/notifications/notificationEventDispatcher.ts`: logs one `notif_dispatch` event per dispatch, with the route (`push_action` / `participant` / `event` / `none`).
- Diagnostics use the existing switchable layer (`perfLog`, `src/diagnostics/perfLog.ts`): off by default; ON via `PERF_LOG=true` build flag or the runtime toggle (tap the display name 7 times within 3 s on Profile), then share the log. It fits; no new logger was added.
- Logged fields (never values): `platform`, `eventType`, `pressAction` (`accept|leave|ignore|default`, anything else `other`), `hasNotification`, `hasId`, `hasType`, `hasDeliveryId`, `dataKeys` (key names, max 20), `route`; skip reasons: `no_push_action_type`, `no_id_and_no_delivery_id`, `result_notification`, `unknown_action`, `in_flight`. No tokens, ids, titles, bodies or PII; a test asserts the ids/token/title strings never appear in the log calls.
- Tests: new `src/notifications/__tests__/pushActionsIosPress.test.ts` (15 tests): iOS-shaped payload (APNs request id, top-level data, no `tag`/`notification_id`), Accept calls `/events/{id}/invitations/respond` once, Ignore cancels and marks read, double press (with and without id) guarded, id-less fallback to `delivery_id`, no id and no delivery id does nothing, dispatcher routing, diagnostics shape.

## 4. How to read the next TestFlight run (this settles suspect 2)
Enable diagnostics (PERF_LOG build or the 7-tap toggle), press Accept on an `event_invite` push with the app backgrounded, then share the log.
- **No `notif_dispatch` line at all** → the press never reached JS: the native chain swallowed it (suspect 2 confirmed; go to option A).
- `notif_dispatch` present with `hasType:false` → the push is missing top-level `notification_type`/`entity_id` (backend payload shape).
- `route:push_action` and a `push_action_event` but no POST → read the `push_action_skip` reason.
- `route:push_action` and a POST fails → normal API error path.
Note a background press may be cut short by iOS suspension (previous report, Open risk 2); also unverified.

## 5. Checks (raw)
Baseline is `origin/main` `7038f47` measured in this sandbox (the "15 failing suites" in the brief predates PR #39, which fixed `GroupDetailScreen.test`). The full Jest suite was run twice here (baseline with changes stashed, then with changes) to get a true delta; normally it is run once.

```
                       origin/main 7038f47        this branch
jest suites failed     14                         14   (same 14 files, diff empty)
jest suites passed     157 / 171 total            158 / 172 total  (+1 new suite)
jest tests failed      167                        167
jest tests passed      1986 / 2153                2001 / 2168      (+15 new tests)
tsc --noEmit           exit 0                     exit 0
npm run lint           31 errors, 1 warning       31 errors, 1 warning (none in src/notifications)
npm run check:labels   OK (230 files)             OK (230 files, 1007 labels)
```
Notification suites on their own: `npx jest src/notifications` → 13 suites, 240 tests, all passed before the new file; the new file: 15 passed.
The 14 pre-existing failing suites are unrelated (`AppForceUpdate`, `appConfig`, `headerIcon`, `ForceUpdateGate`, `keyboardInventory`, `homeComponents`, `CreateGameScreen`, `EventDetailScreen`, `HomeScreen`, `ProfileScreen` + `Links`/`ReportRow`/`Terms`, `shareLink`).

## 6. Not done / not verified
- The press delivery fix (Section 2), pending your choice.
- Everything iOS at runtime: whether the press reaches JS, whether the result notification replaces the original, Keychain access while locked, background suspension.
- Backend `aps.category` strings and the top-level data keys on the iOS payload.
- `docs/` baselines not edited; this report is a new file in `docs/reports/` like earlier task reports (move it if you want docs untouched).
- No version or build numbers chosen.
