# Implementation Report — Organizer add/remove notification types (mobile)

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version**: APPROVED, architect-approved 2026-09-13 (full document read before starting)
- **Status**: APPROVED, no Open Questions blocking (OI-6/13/14/15 unrelated)
- **Tier**: T1
- **Sections**: §3.6, §4.8 (notification type → deep link), §4.3 (organiser-only
  `POST /events/{id}/participants`, `DELETE /events/{id}/participants/{user_id}`), §5.4 (R-111 logging),
  R-073.
- **Base**: `main` @ `fe44841`. Work branch: `chore/organizer-notification-verification` (report only, not pushed).

## 2. Traceability map

**Result: no application source file was modified.** Steps 1 and 3 were already implemented on `main` by
commit `f41db4d` (*"feat(notifications): add event_participant_added and event_participant_removed"*,
2026-09-19), so this task made no change to code that already satisfies it.

| Step | Requirement | Where it already is (file:line, main @ fe44841) |
|---|---|---|
| 1 | Both types in `NotificationType` | `src/types/notification.ts:24-25` (union members); `:41-42` (runtime `NOTIFICATION_TYPES` list) |
| 2 | Preference labels | `src/screens/NotificationPreferencesScreen.tsx:45-46` |
| 3 | Tap routing → Event Detail with `entity_id` | `src/notifications/notificationRouting.ts:90-99` |
| 4 | Unknown type behaviour | `src/notifications/fcm.ts:177-179`, `:211-214` |
| 5 | Duplicate-notification analysis | see §5 |

Files changed by this task: `docs/reports/IMPL-DES-MEETUP-MOBILE-organizer-notification-types.md` (new, this file),
`docs/reports/agent-enhancement-2026-09-20.md` (appended sections 5-7). Nothing else.

## 3. Proposed Assumptions

1. **`NotificationType` is a string-literal union, not an `enum`, so Step 1's enum syntax was not applied.**
   `src/types/notification.ts:19-33` declares `export type NotificationType = | 'global' | ...`; its header
   (`:5-12`) records that string unions are the codebase convention. `grep -rnE '^\s*(export )?(const )?enum ' src`
   finds no enum declaration anywhere. Step 1's `event_participant_added = 'event_participant_added'` and
   Step 3's `NotificationType.event_participant_added` would not compile against a type alias, and turning the
   union into a real enum would change every consumer (and every test using string literals) — outside the
   stated scope. Conservative reading taken: the step's intent (both values are valid members of the type and of
   the runtime list) is already met. If an actual enum is wanted, that is a design/convention change for the architect.
2. **"EventDetailScreen" in Step 3 = the `EventDetail` route in the Home tab stack**, which is what
   `event_changed`/`event_cancelled` already target (`notificationRouting.ts:71-79`).

## 4. Deviations

None introduced. Pre-existing and still open: the two participant types are beyond §4.8's 12-type table and
still need architect ratification (recorded in `notification.ts:11-17` and `notificationRouting.ts:81-89`).

## 5. Verification results — Step 2, 4, 5 confirmations

### Step 2 — preference labels: MATCH, no change

```
$ sed -n 39,51p src/screens/NotificationPreferencesScreen.tsx
39  /** Human-readable labels for every known notification type (§4.8 + the two participant types). */
40  const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
...
45    event_participant_added: 'Added to an event',
46    event_participant_removed: 'Removed from an event',
```

`NotificationPreferencesScreen.tsx:45` `event_participant_added: 'Added to an event'`;
`:46` `event_participant_removed: 'Removed from an event'`. The keys are typed `Record<NotificationType, string>`
(`:40`), so they are compiler-checked against the two values in `notification.ts:24-25`; the strings are the
user-visible labels only.

### Step 3 — tap routing (already present, shown for the record)

```
$ grep -n "event_participant\|event_changed\|event_cancelled" src/notifications/notificationRouting.ts
72:    case 'event_changed':
73:    case 'event_cancelled':
90:    case 'event_participant_added':
91:    case 'event_participant_removed':
```
`notificationRouting.ts:90-99` → `{ tab: 'Home', screen: 'EventDetail', params: { eventId: entityId } }`.
**Difference from the "same pattern as event_changed" wording:** `:92-94` adds a guard — a blank/whitespace
`entity_id` routes to `Home > EventsList` instead of opening `EventDetail` with an empty id. `event_changed`/
`event_cancelled` (`:71-79`) have no such guard.

### Step 4 — unknown `notification_type`: DROPPED, not shown

- `src/notifications/fcm.ts:158-160` `isKnownNotificationType` tests membership in `NOTIFICATION_TYPES`.
- `fcm.ts:177-179`: `if (!isKnownNotificationType(notificationType)) { return null; }`.
- `fcm.ts:211-214` (foreground `onMessage`): `const payload = extractPushPayload(remoteMessage); if (payload) { showBanner(payload); }`
  → `null` means `showBanner` is never called. Only the `console.log` at `:206-209` (message id + raw type) runs.
- Same `null` on tap paths: `fcm.ts:258` (`onNotificationOpenedApp`, handler only `if (payload)`), `:272-278`
  (`getInitialNotification` returns `null`).
- Tested: `src/notifications/__tests__/fcmForeground.test.ts:81` — *"still drops a type the app does not know (unchanged behaviour)"*.
- With the two types in the list (`notification.ts:41-42`) they are **shown** as a banner: `NotificationBanner.tsx:120-125`
  renders `title` (`numberOfLines={1}`) and `body` (`numberOfLines={2}`); tests `NotificationBanner.test.tsx:154-155`.
- **Payload dependency (from code, not previously stated):** `extractPushPayload` reads the type only from
  `remoteMessage.data?.notification_type` (`fcm.ts:176`). A server message carrying a `notification` block but no
  `data.notification_type` is dropped on every path above, including taps.

### Step 5 — duplicate on Android when the FCM `notification` block is present: NOT CONFIRMED (no duplicate path found)

Verified in this repo / `node_modules`:
- The app renders **no** OS notification itself. `grep -rnE "displayNotification|notifee|NotificationCompat|NotificationManager|createChannel" src android/app/src index.js App.tsx | grep -v __tests__`
  returns only comments and type names (`fcm.ts:197`, `notificationBannerStore.ts:7-10`, `NotificationBanner.tsx:4`); `package.json` has no notifee.
- Foreground: `fcm.ts:204-215` only calls `showBanner`. `fcm.ts:194-197` states the banner is used "instead of an OS notification".
- RN Firebase receiver `node_modules/@react-native-firebase/messaging/android/src/main/java/io/invertase/firebase/messaging/ReactNativeFirebaseMessagingReceiver.java`:
  - `:60-64` app in foreground → `emitter.sendEvent(...)` to JS, `return` (no notification built);
  - `:70-81` background/quit → starts `ReactNativeFirebaseMessagingHeadlessService` (runs the JS background handler);
  - `ReactNativeFirebaseMessagingService.java:34-36` `onMessageReceived` is a no-op ("handled in receiver").
- The JS background handler is an empty body (`fcm.ts:239-243`).
- Does the foreground handler suppress the OS banner? **No — it does not, and nothing in this repo needs to.** No suppression API is
  used (`setForegroundPresentationOptions` is iOS-only; grep: no hit), and no RN Firebase code path renders a tray entry.
  So at most one surface appears per state: foreground → in-app banner; background/killed → the tray entry only.

**Not verifiable from this repo:** whether the closed-source Firebase Android SDK itself puts a notification-block message in
the tray while the app is foregrounded. Documented Firebase behaviour is that it does not (delivers to the app instead); that is
recorded here as documented behaviour, not as tested behaviour. It is on the device checklist (§7, item 1). No code change made.

### Correction to an earlier answer (first report of this conversation, Q2d)

That report said `default_notification_channel_id` meta-data was "not found". True of the app's own manifest, but incomplete:
the library manifest injects it and the merged manifest contains it with an **empty** value:
```
$ grep -n -A1 "default_notification_channel_id" android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml
113:            android:name="com.google.firebase.messaging.default_notification_channel_id"
114-            android:value="" />
$ grep -n -A1 "default_notification_channel_id" android/app/build/intermediates/merged_manifests/release/*/AndroidManifest.xml
91:            android:name="com.google.firebase.messaging.default_notification_channel_id"
92-            android:value="" />
```
(Both merged manifests are earlier local builds; the debug one was regenerated on a spike branch, but this entry comes from the
RN Firebase library manifest, not from spike code.) The app still creates no channel of its own.

### Test / static evidence

```
$ npx jest src/notifications src/components/__tests__/NotificationBanner.test.tsx src/screens/__tests__/NotificationPreferencesScreen.test.tsx --verbose  (filtered)
    ✓ event_participant_added: shows the banner text (2 ms)
    ✓ event_participant_removed: shows the banner text (3 ms)
    ✓ event_participant_added: tapping opens Event Detail and dismisses the banner (2 ms)
    ✓ event_participant_removed: tapping opens Event Detail and dismisses the banner (3 ms)
    ✓ event_participant_added: a missing entity_id taps through to the events list, not a blank event (2 ms)
    ✓ event_participant_removed: a missing entity_id taps through to the events list, not a blank event (2 ms)
  ✓ shows a row for every known type, with the two participant labels (65 ms)
  ✓ toggling event_participant_added saves it under its own type (8 ms)
  ✓ toggling event_participant_removed saves it under its own type (6 ms)
    ✓ contains both participant types, alongside the original 12 (14 total, no duplicates)
  ✓ still drops a type the app does not know (unchanged behaviour) (1 ms)
Test Suites: 6 passed, 6 total
Tests:       63 passed, 63 total
```
`npx tsc --noEmit` → `tsc-exit=0`. `npx eslint src/notifications src/types/notification.ts src/screens/NotificationPreferencesScreen.tsx src/components/NotificationBanner.tsx --ext .ts,.tsx` → `eslint-exit=0`.

Negative test confirmed: unknown type dropped (`fcmForeground.test.ts:81`).

## 6. Known gaps / follow-ups

- `entity_id` for the two types is still **unverified** against the server payload builders (`notificationRouting.ts:81-89`).
- Server payload must carry `data.notification_type` (and `data.entity_id`) — see Step 4 payload dependency.
- Foreground banner body is limited to 2 lines (`NotificationBanner.tsx:123`); title 1 line (`:120`). Longer/multi-line bodies are truncated in the banner.
- Step 3 wording "same pattern as event_changed" differs by the blank-`entity_id` guard (above).
- The two types are still outside §4.8's table — awaiting architect ratification.
- Local branch `spike/data-only-fcm` (commit `ad0c015`, adds notifee) from the earlier spike still exists; not deleted (spike result was inconclusive, no device).
- No build, deploy, push, or new dependency in this task.

## 7. On-device checklist (needs a real device)

1. **Foreground, notification block present:** send FCM with a `notification` block + `data {notification_type: event_participant_added, entity_id: <real event id>, title, body}`. Expect only the in-app banner and **no** tray entry (Step 5's unverified SDK point); tap opens that event. Repeat with `event_participant_removed`.
2. **Background (Home pressed) and killed (force-stopped):** same payload. Expect exactly one tray notification; tapping opens the event in both states. Also send one without `data.notification_type` and confirm the tap does nothing (Step 4 payload dependency).
3. **Body rendering + channel:** send a body with real newlines: check the expanded tray text, the 2-line truncation in the foreground banner, and which channel the tray entry lands in (Settings → Apps → Meetup → Notifications), given the empty default channel id.

## Completion Proof

**Test evidence** (raw output):
```
Test Suites: 57 passed, 57 total
Tests:       580 passed, 580 total
Snapshots:   0 total
Time:        2.158 s
--- Run 1 ---
Test Suites: 57 passed, 57 total
Tests:       580 passed, 580 total
Snapshots:   0 total
Time:        1.996 s, estimated 2 s
--- Run 2 ---
Test Suites: 57 passed, 57 total
Tests:       580 passed, 580 total
Snapshots:   0 total
Time:        1.933 s, estimated 2 s
--- Run 3 ---
```

**Git evidence** (captured before this report was committed; the report's own commit hash is given in the hand-off message):
```
$ git log --oneline -3   (base main)
fe44841 bump versionCode
3602ade bump versionCode
29b6243 feat(update): force-update gate driven by GET /app/version-policy

$ git status --short
?? .claude/
```

**File evidence** (the primary change already exists on disk):
```
$ grep -n "event_participant" src/types/notification.ts src/notifications/notificationRouting.ts src/screens/NotificationPreferencesScreen.tsx
src/notifications/notificationRouting.ts:90:    case 'event_participant_added':
src/notifications/notificationRouting.ts:91:    case 'event_participant_removed':
src/screens/NotificationPreferencesScreen.tsx:45:  event_participant_added: 'Added to an event',
src/screens/NotificationPreferencesScreen.tsx:46:  event_participant_removed: 'Removed from an event',
src/types/notification.ts:13: * plus `event_participant_added` / `event_participant_removed`, which the
src/types/notification.ts:24:  | 'event_participant_added'
src/types/notification.ts:25:  | 'event_participant_removed'
src/types/notification.ts:41:  'event_participant_added',
src/types/notification.ts:42:  'event_participant_removed',
```

No migrations run; no frontend build run (instructed not to build).
