# Implementation Report — notify-kit View/OK actions for participant notifications

## 1. Design reference

- Doc ID: DES-MEETUP-MOBILE — APPROVED, architect-approved 2026-09-13
- Section: §3.6 FCM Integration (R-070–R-077), R-073 tap routing; "foreground messages rendered through `notifee`"
- Tier / phase: Scaffold-phase notification wiring (no new tier activated)
- Task source: user brief "Notifee — action buttons for organizer notifications" (2026-09-21)
- Library: `react-native-notify-kit@10.7.1` (maintained drop-in for the archived `@notifee/react-native`)

## 2. Traceability map

| Requirement / brief step | Files | Commit |
|---|---|---|
| Step 1 — install / link | `package.json:27`, `package-lock.json` | c82e3df |
| Step 2 — channel `plan` (HIGH) | `src/notifications/channels.ts:13,15`; call `index.js:21` | c82e3df |
| Step 3 — display + press handling | `src/notifications/participantHandler.ts:72` (display), `:123` (event handler), `:150` (background), `:159` (foreground), `:170` (quit-state); call `index.js:25` | c82e3df |
| Step 4 — foreground `onMessage` | `src/notifications/fcm.ts:235-241` (early return before `showBanner`) | c82e3df |
| Step 5 — background handler | `src/notifications/fcm.ts:280-286` (was an empty body) | c82e3df |
| R-073 quit-state / foreground routing (added, user-approved) | `src/navigation/RootNavigator.tsx:93-94,294,324,329` | c82e3df |
| Step 7 — tests | `src/notifications/participantHandler.test.ts` (new), `src/notifications/__tests__/fcmForeground.test.ts` (updated), `jest.setup.js:88` (mock) | c82e3df |

## 3. Proposed Assumptions

1. **`ACTION_PRESS`, not `PRESS`, for the View/OK buttons.** notify-kit's `EventType` docs/source (`src/types/Notification.ts:359-376`): button presses emit `ACTION_PRESS`; `PRESS` is body tap only. The brief's literal handler would never fire.
2. **View sets `launchActivity: 'default'`; OK does not.** `validateAndroidPressAction.ts:26-35` only defaults it when `id === 'default'`. Without it View never opens the app; OK must not open it.
3. **Notification carries `data`** (the full FCM data map) so `detail.notification.data.entity_id` exists on press. The brief's display spec omitted it.
4. **Body tap (`PRESS`) routes to the event too.** Previously FCM displayed these types and taps routed via `onNotificationOpenedApp`; with local display FCM no longer sees the tap.
5. **`onForegroundEvent` + notify-kit `getInitialNotification`** wired (RootNavigator) so foreground presses and quit-state View/body-tap work. Approved by the user in-session (AskUserQuestion: "Fix within named files + wire the rest").
6. **Navigation helper:** the brief's `navigate` from `../navigation/RootNavigation` does not exist; used the codebase's `resolveNotificationTarget` + `navigateToNotificationTarget` (`notificationRouting.ts`).
7. **Test file path:** `src/notifications/participantHandler.test.ts` as the brief specified, although existing notification tests live in `__tests__/`.
8. **Explicit jest mock** in `jest.setup.js` rather than notify-kit's shipped `jest-mock.js` (ESM under `node_modules`; would need `transformIgnorePatterns` changes).
9. **Status file** written as `implementation-status-DES-MEETUP-MOBILE-notify-kit.md` because the tracked `implementation-status-DES-MEETUP-MOBILE.md` belongs to the Shuttlr release-shell task and still holds a live Blocked note. The new file is untracked and not committed.

## 4. Deviations

- **Existing tests changed (spec-mandated behaviour change).** `fcmForeground.test.ts`: the 8 `describe.each` participant cases asserted "shows the in-app banner". Step 4 says "return early — do not fall through to showBanner", so all 8 failed (572/580) after the `fcm.ts` change. They were rewritten to assert the notify-kit path (banner stays `null`), keeping the same four scenarios per type; 3 unchanged-behaviour tests were added. Approval reference: brief Step 4 wording. **Reviewer should confirm this is the intended reading of "580 tests must still pass".**
- Assumptions 1–5 depart from the brief's literal code; approval reference for 5 is the in-session decision, for 1–4 they are defect corrections verified in library source.

## 5. Verification results

- Step 1 (`./gradlew :app:dependencies | grep -i notify`, exit 0, `BUILD SUCCESSFUL`): 15 lines, one reads `+--- project :react-native-notify-kit FAILED`. That line is in the `implementationDependenciesMetadata` configuration, where **every** autolinked project (keychain, firebase_app, vision-camera, …) also prints `FAILED`; it is not a notify-kit link failure. notify-kit resolves normally in the real classpath configurations.
- Gate 2: single `react@19.2.3` / `react-native@0.86.3` (deduped); `npm ls --depth=0` reports no invalid/missing/extraneous; notify-kit peers `react-native >=0.73.0` (satisfied), `expo` optional/unused. Lockfile additions all trace to notify-kit (`npm ls @expo/image-utils`).
- `npx tsc --noEmit`: exit 0. `npx eslint index.js src --ext .ts,.tsx,.js`: exit 0.
- `jest.setup.js` lint: 24 `'jest' is not defined` errors at `HEAD`, 31 now (7 more `jest.` references in the new mock) — pre-existing config gap, not addressed.
- Negative tests confirmed passing: OK press cancels and never navigates; DISMISSED cancels and never navigates; unknown action id does nothing; non-participant type never navigates; missing `data` does not throw; nav container not ready drops silently; initial notification is `null` for normal launch / OK press / non-participant type; OK action has no `launchActivity`; display rejection produces no unhandled rejection.
- Step 6: `./gradlew assembleDebug` → `BUILD SUCCESSFUL in 1m 17s` (435 tasks); notify-kit `compileDebugKotlin`, `compileDebugJavaWithJavac`, `bundleDebugAar` all ran; 7 `app.notifee` entries in the merged manifest. **`adb install -r` FAILED: `adb: no devices/emulators found`. The APK is built at `android/app/build/outputs/apk/debug/app-debug.apk` but has not been installed or exercised on a device.**

### Completion Proof

**Test evidence** (raw):
```
Test Suites: 58 passed, 58 total
Tests:       610 passed, 610 total
Snapshots:   0 total
--- Run 1 ---

Test Suites: 58 passed, 58 total
Tests:       610 passed, 610 total
Snapshots:   0 total
--- Run 2 ---

Test Suites: 58 passed, 58 total
Tests:       610 passed, 610 total
Snapshots:   0 total
--- Run 3 ---
```
(Baseline before changes: 57 suites / 580 tests. `pytest` command in the template is Python-specific; `npx jest` is this repo's equivalent.)

**Git evidence**:
```
c82e3df feat(notifications): View/OK action buttons for organizer participant notifications
e47da84 docs(report): implementation report for organizer add/remove notification types
fe44841 bump versionCode
```
`git status --short` (before this report commit): `?? .claude/` and `?? implementation-status-DES-MEETUP-MOBILE-notify-kit.md` only.

**File evidence**:
```
src/notifications/participantHandler.ts:72:export async function displayParticipantNotification(
src/notifications/fcm.ts:235:    if (isParticipantNotificationType(remoteMessage.data?.notification_type)) {
src/notifications/fcm.ts:280:    if (isParticipantNotificationType(remoteMessage.data?.notification_type)) {
index.js:21:createNotificationChannels().catch(() => {});
index.js:25:registerParticipantBackgroundHandler();
```

**Build evidence** (Android; no `npm run build` applicable): `BUILD SUCCESSFUL in 1m 17s`, `435 actionable tasks: 79 executed, 356 up-to-date`.

## 6. Known gaps / follow-ups

1. **Not verified on a device.** No device/emulator was attached; all three on-device checklist items are untested. Behaviours that only a device can confirm: View from killed state actually lands on `EventDetail` (depends on notify-kit returning the View press from `getInitialNotification()` when the action launches the app — inferred from source, not observed); `launchActivity` on an action button on Android 12+.
2. **`RootNavigator` wiring has no automated test** (no RootNavigator test exists, including for the pre-existing FCM cold-start path). Underlying logic is covered via `getInitialParticipantNotification` tests.
3. **Multi-line body.** `body` may contain `\n`; no `AndroidStyle.BIGTEXT` was set (not in brief), so the collapsed notification shows it on one line and the expanded view may truncate. Check on device.
4. **View does not cancel the notification** after pressing (brief only specified OK/DISMISSED cancel). It may remain in the tray.
5. **Stale initial notification risk:** `getInitialNotification()` reads the launching intent; re-opening from recents after process death could re-route once. Guarded by the existing one-shot ref per JS instance only.
6. **Checklist item 1 wording:** the brief says foreground shows an "in-app banner with View and OK". Step 4 (and design §3.6) produce a notify-kit **heads-up OS notification**; the in-app `NotificationBanner` has no buttons and is no longer used for these two types. Verify against that expectation.
7. `entity_id` = event id remains the unverified assumption already recorded in `notificationRouting.ts`.
8. Design §3.6 says foreground uses notifee; all *other* types still use the in-app banner (existing, previously recorded deviation) — architect ratification pending.
9. `jest.setup.js` ESLint `no-undef` errors (pre-existing) — needs a jest env override for that file.
10. Working tree carried an uncommitted `package.json`/`package-lock.json` (notify-kit add) from before this session; committed here as Step 1.
