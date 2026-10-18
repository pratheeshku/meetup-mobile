# pa-clients-mobile report: action buttons on push notifications

**Branch:** `pa/pa-clients-mobile` (from `origin/main` @ `54275aa`). **Design:** `DES-MEETUP-ADDENDUM-push-actions` v1.0 (AD-1, 3, 4, 5, 6, 7, 10, section 9), read from `pratheeshku/meetup` branch `docs/push-actions-addendum`. **Backend contract read from:** `pratheeshku/meetup` branch `pa/pa-backend` @ `b67aa26` (read only).
**Status:** implemented and unit-tested. Nothing was run on a device. No conformance review run, no pass/fail certified here.

## What changed

| Step | Change |
|---|---|
| 0 | `git revert -m 1 d18677e` (spike removed from `main` line). `config/appConfig.json`, `android/`, `ios/` untouched. `spike/pa-spike` not deleted. The revert also removes `docs/reports/pa-spike-build.md` from this branch (it stays on `spike/pa-spike`). |
| 1 | `src/notifications/notificationEventDispatcher.ts`: ONE `onBackgroundEvent` handler routing by `notification_type` to push-action, participant and event handlers. `registerParticipantBackgroundHandler` and `registerEventBackgroundHandler` deleted (their tests now go through the dispatcher). `index.js` registers the dispatcher once. |
| 2 | `src/notifications/pushActions.ts`: scope table, display (Android, data-only push, id = `tag` else `notification_id`), press handler, result notifications, per-notification in-flight guard, foreground handler, quit-state body-tap lookup. Wired in `fcm.ts` (foreground `onMessage` and the headless background handler) and `RootNavigator.tsx`. |
| 3 | Game Accept `POST /events/{id}/invitations/respond {accept:true}`; tournament Accept `POST /tournaments/{id}/invitations/respond {accept:true}`; Leave `DELETE /groups/{group_id}/members/{user_id}`; Ignore cancels the entry then `POST /notifications/{delivery_id}/read` best effort. One `withCorrelationId()` per action. Result text per AD-7. |
| 4 | `refreshAccessTokenForAction()` in `src/api/client.ts`. The POST was split into a shared single-flight `fetchNewAccessToken()`; `refreshAccessToken()` is the same call plus `saveTokens()` and behaves as before (tests below). |
| 5 | `registerPushActionCategories()`: `invite_game`, `invite_tournament`, `group_added`, `foreground:false`; `IOS_ACTIONS_REQUIRE_AUTH = true` in `pushActions.ts` applies `authenticationRequired` to Accept and Leave group. Called in `index.js` at launch and again on `RootNavigator` mount. No native `beginBackgroundTask` (open risk 2). |
| 6 | `pushActionsVersion: 1` added to the `POST /notifications/mobile-subscriptions` body (`registerDeviceToken`), both platforms. |
| 7 | 24 label keys with defaults in `src/labels/defaultLabels.ts` (`mob.notification_action.{accept,ignore,leave_group}`, `mob.push_action_result.*`, `mob.notif_action_state.*`). `jest.setup.js` notify-kit mock gained `setNotificationCategories`. |
| 8 | `NotificationCard.tsx`: one extra `Text` line in the existing row using the existing body styles; no new component, no buttons. |
| 9 | Tests below. |

Title and body are displayed exactly as received (tests assert untrimmed, uncapitalised pass-through). No tokens, titles, bodies or ids are logged (a test spies on `console`).

## Commands (MacBook)

```
cd ~/Developer/meetup-mobile && pwd
git fetch origin pa/pa-clients-mobile && git checkout pa/pa-clients-mobile
npx jest            # once
npx tsc --noEmit
npm run lint
npm run check:labels
```

## Raw results (this sandbox, Linux, Node 22)

`npx tsc --noEmit`: exit 0, no output.
`npm run check:labels`: `check-labels: OK - 225 files scanned, 993 default labels checked.`
`npm run lint`: 30 errors + 1 warning on this branch, all in files I did not introduce (`jest.setup.js` `jest` no-undef, `RootNavigator.tsx` react-hooks, `NotificationCard.test.tsx` unused imports, others). The same 4 spot-checked files give the same 30 on `origin/main`; ESLint on every new or rewritten source file is clean.

`npx jest --coverage` (one run on the branch; one run on `origin/main` for the baseline):

```
main    Test Suites: 15 failed, 151 passed, 166 total | Tests: 175 failed, 1881 passed, 2056 total
branch  Test Suites: 15 failed, 155 passed, 170 total | Tests: 174 failed, 1968 passed, 2142 total
```
The 15 failing suites are identical on `main` and on the branch (`diff` of the FAIL lists is empty); they fail on `main` too in this sandbox, e.g. `ENOENT .../src/assets/shuttlr-icon.png` (binary asset absent), `appConfig.test.ts` (iOS project defaults), ProfileScreen/HomeScreen/EventDetailScreen suites. I did not investigate or touch them. The one-test difference (175 vs 174) is not explained by anything I changed; I did not chase it.
New or changed suites, all PASS: `pushActions`, `pushActionsDisplay`, `notificationEventDispatcher`, `refreshForAction`, `NotificationCard`, `participantHandler`, `eventNotificationHandler`, `fcm`, `fcmForeground`, `pushRegistration`.
Raw logs: scratchpad files `/tmp/claude-0/base-jest.txt` and `/tmp/claude-0/branch-jest.txt` (not committed).

| Coverage | main | branch | delta |
|---|---|---|---|
| Statements | 74.27% (6006/8086) | 75.62% (6146/8127) | +1.35 |
| Branches | 63.73% (3745/5876) | 64.96% (3845/5919) | +1.23 |
| Functions | 73.36% (1551/2114) | 74.27% (1571/2115) | +0.91 |
| Lines | 74.45% (5787/7772) | 75.86% (5928/7814) | +1.41 |

Tests added (AD-7 and section 9): every AD-7 row (game: going, waitlisted, refusal reason, already accepted, 404; tournament: 200, 409, 400, 404; leave: 200, 400 owner, 404; generic for 401, network, timeout, 5xx, refresh failure), Ignore (cancel first, delivery id not notification id, never a respond/leave call, best effort, no token work without delivery id), in-flight guard, duplicate delivery replaces (same id), dispatcher routing including "participant View press still navigates", three iOS categories with `foreground:false` and the auth constant, registration field on both platforms, `action_state` labels in the list row (no extra pressables), and `refreshAccessTokenForAction` (Keychain failure, single flight with the regular refresh, `refreshAccessToken` unchanged).

## Git evidence

```
git log --oneline origin/main..pa/pa-clients-mobile   # revert commit, then the feature commit
git diff origin/main --stat -- config android ios     # empty
```

## Behaviour change to know about

Today `index.js` registers the participant handler and then the event handler; the last wins, so participant View/OK presses (`event_participant_added` / `_removed`) were dead in background and quit state. They work again through the dispatcher. That is the requested fix, but it is a visible change for those notifications.

## Drift and contract notes

1. **`participation_status` is not in the `pa/pa-backend` code.** `EventInvitationResponse` there has no such field; it comes from `ia-backend` (invitation-response AD-3, additive). The client reads it if present. When it is absent a successful Accept shows "Accepted" (not "You're in"), so the app never claims a status it was not given. OI-3 (deploy `ia-backend` before enabling the game button) stands.
2. **Group name and caller id need extra calls.** The push carries neither. Leave does `GET /users/me` and `GET /groups/{id}` (parallel, name best effort) before the DELETE, using existing endpoints only. Alternative: add the group name to the push data (backend change, not made).
3. **"Already accepted" for games is detected by the word "already" in the 400 `detail`** (server text: `Invitation is already <status>`). Any other 400 shows the server text followed by "Open the app."; a server wording change would show that text instead of "Already accepted".
4. **`action_state` values without a label show nothing:** `pending`, `member`, `closed`, `withdrawn`. The brief listed six outcomes (Joined, Waitlisted, Accepted, Declined, Left group, no longer available); I did not invent labels for the rest.
5. **Android foreground rule:** a data-only message (no `notification` block) for the three types is rendered locally; a message with a `notification` block keeps the existing banner. `fcmForeground.test.ts` previously fed `event_invite` as data-only and expected the banner; I changed that fixture to carry a `notification` block (the real flag-off shape). `fcm.test.ts` and `pushRegistration.test.ts` expectations gained `pushActionsVersion: 1`.
6. `docs/` was not edited (the spike report disappears only because of the requested revert).

## Open risks (read these first)

1. **iOS: action presses on a REMOTE push may never reach JS.** notify-kit's `didReceiveNotificationResponse` forwards a response to the "original" `UNUserNotificationCenter` delegate and does not emit a JS event when that delegate responds to the selector and the notification has no notify-kit payload (`NotifeeCore+UNUserNotificationCenter.m`). `@react-native-firebase/messaging` installs such a delegate and handles only the default tap. Which side ends up first in the chain depends on initialisation order, which I cannot determine without a device. If it forwards, Accept/Leave/Ignore on iOS do nothing in JS. The spike did not test this (it used local notifications). Nearest alternatives: a native delegate in `AppDelegate` that handles the three categories, or notify-kit's `ios.handleRemoteNotifications` setting with a verified chain order. Needs the iOS device matrix before `pa-enable` for iOS.
2. **No `beginBackgroundTask` (as instructed).** notify-kit emits the event to JS and calls `completionHandler()` immediately, so iOS may suspend the app mid-refresh or mid-request. A Leave group action makes four calls (refresh, me, group, delete), the most exposed to the ~30 s gate.
3. **Keychain unreadable while locked:** the token lives in memory for the action and `saveTokens` failure is swallowed (step 4). If the Keychain read succeeds but the write failed, the request interceptor replaces the in-memory token with the older stored one; that gives a 401 and the generic message. Rare, unmeasured.
4. **iOS category titles come from labels at registration.** `index.js` registers at launch, possibly before the label cache is read, so a server-edited button title may only appear after the app has been opened once (the re-registration on `RootNavigator` mount). Default English labels are used until then.
5. **iOS result replacement and Android same-id replacement** (result notification reuses the original id) are by library contract, untested on device.
6. **Group Leave has no confirmation (design D-5)** and the iOS authentication constant (`IOS_ACTIONS_REQUIRE_AUTH`) is `true` as instructed; the owner may flip it after the matrix.
7. Pre-existing: 15 failing suites in this sandbox on `main` (assets/env), 30 lint errors in files outside this change.

No version numbers or build numbers were chosen or changed. The server flag was not touched. No PR was opened.
