# pa-spike build report (throwaway)

**Task:** pa-spike. **Branch:** `spike/pa-spike` (never merge). **Design:** `DES-MEETUP-ADDENDUM-push-actions` v1.0 (AD-3, AD-5, OI-1), read from `pratheeshku/meetup` branch `docs/push-actions-addendum`.
**Status:** built and type-checked only. There is no pass/fail from this report; the owner runs the device matrix.

## What was built (dev builds only, all behind `__DEV__`)

| File | Change |
|---|---|
| `src/devspike/paSpike.ts` (new) | Scheduling, iOS categories, Accept/Ignore handler, on-device log |
| `src/screens/PaSpikeScreen.tsx` (new) | Hidden dev screen |
| `index.js` | `if (__DEV__)` block calling `registerSpikeBackgroundHandler()` |
| `src/navigation/RootNavigator.tsx`, `types.ts` | `PaSpike` route in the Profile stack, only when `__DEV__` |
| `src/screens/SettingsScreen.tsx` | `__DEV__` only: 5 quick taps on the version line open the dev screen |

`src/api/client.ts`, production handlers, labels, backend and design docs are untouched.

**Notification:** notify-kit local notification with a timestamp trigger (`SET_AND_ALLOW_WHILE_IDLE` on Android, so no exact-alarm permission). Two actions: Accept (test) and Ignore, both background-only.
- Android: `pressAction` with no `launchActivity`; channel `pa_spike`.
- iOS: categories `pa_spike` and `pa_spike_auth` registered via `setNotificationCategories`, both actions `foreground: false`; Accept in `pa_spike_auth` has `authenticationRequired: true`. The dev-screen toggle picks the category.

**Accept handler:** starts a timer, then inside one `withCorrelationId()`:
1. `refreshAccessToken()` (step `refresh`).
2. `GET /notifications/unread-count` through `apiClient` (step `read`; read-only; the same endpoint `getUnreadCount()` uses). The token returned in step 1 is sent as the `Authorization` header from memory.
3. Cancels the original, shows `OK <ms> <platform> <state>` or `FAIL <step> <errclass> <ms>`, appends a log line.

Ignore only cancels the tray entry. No respond/join/accept/leave/write endpoint is called anywhere. The handler never reads Keychain itself and logs no token, title, body or id.

**Log line** (AsyncStorage `pa_spike_log`): platform, variant (plain/auth), state label, attempt number, ok flag, elapsed ms, failing step, error class. Error class is an HTTP status (`http_401`), axios code (`net_ECONNABORTED`), `session_rejected`/`session_no-session`, or `nonhttp_<ErrorName>` (not an HTTP error; in this flow that means the Keychain write inside `refreshAccessToken()`).

## How to run

Machine: MacBook.
```
cd ~/Developer/meetup-mobile && pwd
git fetch origin spike/pa-spike && git checkout spike/pa-spike
npm ci
npx tsc --noEmit
```
Android (physical phone, debug build):
```
cd ~/Developer/meetup-mobile && pwd && npm run android
```
iOS (physical iPhone, debug build; pods first if needed):
```
cd ~/Developer/meetup-mobile/ios && pwd && pod install
cd ~/Developer/meetup-mobile && pwd && npm run ios -- --device
```
A debug build needs Metro only to load the bundle. For the **killed** state, close the app after the bundle has loaded once; for a headless start without Metro reachable, use a release-like run or keep the phone on the same network as Metro. Log in first (a session must exist).

Open the screen: Profile, Settings, tap the version line 5 times quickly.

## Tester procedure and tally

For each cell of the matrix (platform x state; iOS also x variant plain/auth):
1. On the dev screen set **N** (default 30), pick the **state** you are about to use, set the auth toggle (iOS), tap **Schedule test notification**.
2. Put the phone in that state before it fires:
   - `unlocked`: press Home (app backgrounded, phone unlocked).
   - `locked`: press Home, then lock the screen.
   - `killed`: swipe the app away from the app switcher, then lock the screen.
3. When it fires, tap **Accept (test)** without opening the app (iOS auth variant: authenticate when asked). On iOS also time tap to result notification with a stopwatch; the logged ms excludes native process start-up.
4. Wake the phone, read the result notification. Repeat until 10 attempts per cell.
5. Open the dev screen, **Copy results**, paste into the report. A cell passes the gate at 9 of 10 `OK`; on iOS also the result within about 30 s of the tap. Failed attempts count too (they are logged). Use **Clear** before a fresh run.

Attempt numbers are counted per state and variant, assigned when scheduled, so do not schedule two at once.

## Library findings (react-native-notify-kit 10.7.1, read from installed source)

Open limitations, none worked around silently:

1. **iOS categories: supported.** `setNotificationCategories`, per-action `foreground`, `authenticationRequired` and `destructive` exist (`IOSNotificationCategoryAction`; native maps `authenticationRequired` to `UNNotificationActionOptionAuthenticationRequired`). A notification refers to a category via `ios.categoryId`. Nothing missing for this spike. For the real remote push, the category comes from `aps.category` and must be registered at every launch (done here at launch in `index.js`).
2. **iOS: no background execution is held for the JS handler (RISK to the gate).** In `NotifeeCore+UNUserNotificationCenter.m` the delegate emits the event to JS and then calls `completionHandler()` immediately. Nothing like `beginBackgroundTask` keeps the app awake until the JS promise settles, so the OS may suspend the app mid-refresh or mid-request. The spike will show whether the ~30 s result is met. Nearest alternative if it fails: a native `beginBackgroundTask` in `AppDelegate` around the notify-kit delegate call (native change, not done here), or a Notification Service Extension route.
3. **One background handler only.** `onBackgroundEvent` keeps a single module-level handler; the last call wins. `index.js` already registers the participant handler and then the event handler, so today the participant handler (View/OK for participant types) is overwritten by the event handler. Likely a latent defect in the existing app, reported not fixed. The spike wraps by registering last and delegating to the event handler, so existing behaviour is unchanged. The real build needs one dispatcher.
4. **iOS event routing is by app state.** Events go to the background channel when `applicationState != Active` (including Inactive). Acceptable for this use.
5. **Android launch behaviour.** An action without `launchActivity` does not open the app; confirm on device. Body tap uses the default press action and opens the app.

## Findings from reading the existing code (not library)

- **The `client.ts` flow cannot be pure "memory only".** `refreshAccessToken()` calls `saveTokens()` (Keychain, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) before returning. If that write throws while the phone is locked, step 1 fails (class `nonhttp_*`) even though the server already rotated the refresh cookie; the app recovers on next foreground refresh, but a locked failure here is the likely result on both platforms. This is the main thing the spike measures. Design AD-5 item 3 says "persist the new token best effort only"; that needs a change in `client.ts` that this spike was told not to make.
- **Step 2 uses the in-memory token only if the Keychain read fails.** The request interceptor sets `Authorization` from Keychain when the read succeeds, and keeps the caller's header only when the read throws. A locked-device read that returns empty without throwing would send no usable header; `read` would then show `http_401`.
- `describeError`-style classification is reimplemented in the spike file only to separate HTTP errors from non-HTTP (Keychain) errors.
- No connectivity check exists (design D-4); the spike does none.
- Elapsed ms starts at handler entry, so it excludes native start-up and JS bundle load for a killed app.
- Android headless start in a debug build needs Metro reachable; test the killed state on the same network or accept that bundle-load time is part of the result.

## Checks run

- `npx tsc --noEmit`: clean.
- `npx eslint` on the new files and `index.js`: clean.
- `npm run check:labels`: **fails because of the spike code** (hardcoded dev strings, 17 problems, all from spike strings in `src/devspike/`, `src/screens/PaSpikeScreen.tsx` and the `PaSpike` route title in `RootNavigator.tsx`). Not fixed on purpose: the task forbids touching labels, and CI runs the scan only on PRs and `main`, neither of which this branch should reach. Do not merge.
- Jest not run (no tests written for the spike, per the task).
- Nothing was run on a device; no behaviour is verified.

## Open library limitations to carry into the report

1. iOS: notify-kit does not hold background time for the JS handler (item 2).
2. Single global `onBackgroundEvent` handler (item 3), plus the existing participant handler being overwritten.
3. `refreshAccessToken()` persists to Keychain before returning, with no best-effort mode (needs `client.ts` change for the real build).
4. iOS category persistence across launches is assumed from registering at every launch; confirm on the killed state.
