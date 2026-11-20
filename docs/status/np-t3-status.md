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

## Persistence check (device): DONE
iOS simulator GameOnTest, Release build of np-t3, test account. Settings > Notifications opened the per-type list; "Game reminders" was switched off (it showed off); the app was terminated and relaunched as a new process; after navigating Profile > Settings > Notifications again the list (loaded from the server) still showed "Game reminders" off and every other type on. The switch was then turned back on (it shows on, no error text) so the test account is as found. Persistence is the existing `updatePreference` / `getPreferences` round trip, unchanged by this task.
Note: simulator input was unreliable (dropped taps, frames lagging one step); the toggle only registered reliably with a touch_path tap, and the result was confirmed from a fresh frame after the restart.

## NOT verified
- Android: no SDK/AVD on this Mac.

## Environment notes (see rn-t3 status for the Debug-build evidence)
- Release build only; Debug crashes natively (Podfile untouched, per ruling).
- `ios/GoogleService-Info.plist` was copied into the untracked build output only.
