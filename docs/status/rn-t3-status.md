# rn-t3 Status: Organizer response notice, mobile

Branch: `rn-t3` (from main 6800a7b). Not merged. Gate: `/api/version` = 198 (checked 2026-11-20).
Source: DES-MEETUP-ADDENDUM-response-notice v1.0.1 (contract block in the task).

## Phase 1 findings
- **Tap routing is by type + entity id, not entity_ref.** `resolveNotificationTarget(type, entityId)` in `src/notifications/notificationRouting.ts` is shared by the foreground banner, the background/cold-start push tap (`RootNavigator.tsx`) and history rows.
- **History row:** `NotificationHistoryScreen.openNotification` first opens an absolute `https`/app-scheme `display.url`. A web-relative url (`/#event-detail/{id}`, as these two types send) is ignored and the row routes by type using `item.entity_id`.
- **Preference screen types are hard-coded** (`NOTIFICATION_TYPES` + `NOTIFICATION_TYPE_LABEL_KEYS` in `NotificationPreferencesList.tsx`), not server-driven. Missing server row means on.
- **Unknown type today:** history tap is a silent no-op (`isKnownType` guard); push payload is dropped by `extractPushPayload` (`isKnownNotificationType`); the pref list never shows it. So both new types needed adding to `NOTIFICATION_TYPES`.
- **Icons:** `NotificationIcon` map is partial (many types fall back to the generic icon), so no icon added.

## Changes
- `src/types/notification.ts`: added `event_response`, `tournament_response` (27 types).
- `src/notifications/notificationRouting.ts`: `event_response` -> EventDetail; `tournament_response` -> TournamentDetail (entity_id = id).
- `NotificationPreferencesList.tsx` + `defaultLabels.ts`: labels `mob.notif_pref.type_event_response` = "Guest replies to your games", `mob.notif_pref.type_tournament_response` = "Guest replies to your tournaments" (same `mob.notif_pref.type_*` style as the other rows). Default on.
- Tests: routing test (27 types, both targets), prefs test (both rows shown, default on).

## Not done / drift
- "Land where Responses is visible": EventDetail/TournamentDetail render the Responses section inline and have no scroll-to-section param, so no new UI was added; the tap opens the detail screen.
- New label keys are not seeded server-side (listed for the owner).
- Push `data.entity_id` for these types is assumed to carry the id (contract only shows entity_ref); not verifiable without a live push.
- Device test: PARTIAL (iOS simulator GameOnTest, iOS 27.0, Xcode 27.2; no Android SDK/AVD on this Mac).
  - `npm run ios` fails before building (`Simulator.app` not found under /Applications/Xcode.app/Contents/Developer/Applications/). Direct `xcodebuild` works.
  - DEBUG build crashes at start-up: native EXC_BAD_ACCESS in the prebuilt `React` binary's `Props::Props()` (called from `RNCSafeAreaProviderProps` compiled in the debug dylib). Likely cause: Debug-compiled pods vs the release-built `React-Core-prebuilt` (Podfile already forces REACT_NATIVE_PRODUCTION=1 as a partial workaround). NOT fixed (Podfile is outside Task 3).
  - RELEASE build (`-configuration Release`, JS bundled) starts and runs signed in as the test account. The Notification history screen renders on this branch's build; the test account has no response-type rows (only reminders and a cancellation), so no response row could be tapped.
  - Release build needed `ios/GoogleService-Info.plist` copied into the untracked build output (the gitignored file is not referenced by the Xcode project); nothing committed.
  - The simulator's runtime mount went stale twice (dyld "Library not loaded: libSystem"); a simulator shutdown/boot fixed it.
- DRIFT (on main, not from this branch): the per-type preference list (`NotificationPreferencesScreen`) is registered in `ProfileStack` but nothing in the UI navigates to it. Settings shows only Push and Email master toggles; the per-type list appears only in first-run onboarding. So the user cannot reach the new rows (or any type toggle) after onboarding. Needs a design decision.
- Not verified on a device: push delivery, tapping a real `event_response` / `tournament_response` row, the mute toggle. Push cannot be tested on the iOS simulator, and a real notice needs a second account to answer a game on production.
