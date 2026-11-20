# np-t3 Status: Notification preferences access, mobile

Branch: `np-t3`, cut from latest main (6800a7b). rn-t3 is not merged and np-t3 does not depend on it. Not merged; pushed for review.
Source: task brief (DES-MEETUP-ADDENDUM-notification-preferences-access v1.0). No backend change.

## Changes
- `src/screens/SettingsScreen.tsx`: a "Notifications" row (existing `IconBadge` + `BellIcon`, `ArrowRightIcon`, theme tokens only) directly under the Push and Email switches, inside the same card, with a one-line caption. It navigates to `NotificationPreferences` (already registered in `ProfileStack`). It is rendered regardless of the two master switches. `NotificationsStep` (onboarding) is untouched.
- `src/labels/defaultLabels.ts`: `mob.settings.notifications` = "Notifications"; `mob.settings.notifications_sub` = "Choose which notifications you get". Not seeded on the server (listed for the owner).
- `src/screens/__tests__/SettingsNotificationsRow.test.tsx` (new): label and caption shown, and the row navigates to `NotificationPreferences`, with the master switches both on and both off.

## Verified
- Unit tests: `SettingsNotificationsRow`, `SettingsAppVersion`, `NotificationPreferencesScoring` = 3 suites, 20 tests passed. Full suite not run, as instructed.
- `npx tsc --noEmit` clean; `npm run check:labels` OK; eslint clean on touched files.
- Device (iOS simulator GameOnTest, iOS 27.0, Release build of this branch, test account): Profile > Settings shows the Notifications row under Push and Email with its caption; tapping it opens the Notification Preferences list (screen title "Notification Preferences", all types on). Screenshots in the report.

## NOT verified
- Toggle a type, restart the app, confirm it persisted: NOT DONE. On the simulator the taps on the type switch did not produce a visible change (three single taps, the screen showed every type on each time, no error text), and input to this simulator was unreliable throughout (many taps dropped, frames lagging a step behind). I could not tell whether a tap was dropped or toggled and reverted, so I did not restart-test. The toggle state of "Game reminders" on the test account is believed unchanged (on) but not confirmed. Toggle/persist behaviour is existing code (`NotificationPreferencesList`, `updatePreference`/`getPreferences`) not changed by this task.
- Android: no SDK/AVD on this Mac.

## Environment notes (see rn-t3 status for the Debug-build evidence)
- Release build only; Debug crashes natively (Podfile untouched, per ruling).
- `ios/GoogleService-Info.plist` was copied into the untracked build output only.
