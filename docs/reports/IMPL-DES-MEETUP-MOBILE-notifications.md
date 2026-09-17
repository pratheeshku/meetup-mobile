# Implementation Report — Push Notifications Module

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version**: APPROVED, architect-approved 2026-09-13
- **Status**: APPROVED
- **Tier**: T1
- **Sections built against**: §3.6 (FCM Integration), §3.9 (Deep Link
  Handling), §4.8 (Push Notifications), §5.2 (FCM Token Lifecycle —
  Architect-Approved Deviation), §5.4 (Data Never Written to Logs),
  §7.6 (Notifications API contract)
- **Requirements baseline**: REQ-MEETUP-MOBILE, R-070 through R-077
  (all confirmed present and consistent with the design excerpt above;
  no missing/mismatched R-ID citations found this pass)

## 2. Traceability map

| Design section / R-ID | Behaviour | Files | 
|---|---|---|
| Task brief Step 1 | `NotificationType`, `NotificationPreference`, `PushNotificationPayload` types | `src/types/notification.ts` |
| §7.6, R-076 | `getPreferences()` / `updatePreference()` | `src/api/notifications.ts` |
| §3.6, §4.8, R-073 | Foreground message handler shows in-app banner (not OS notification) | `src/notifications/fcm.ts` (`onMessage`), `src/notifications/notificationBannerStore.ts` |
| §4.8, R-073 | Simple state-based banner UI, tap-to-navigate, 4s auto-dismiss, swipe/tap dismiss | `src/components/NotificationBanner.tsx` |
| §3.6, §4.8, R-073 | Background-state tap routing | `src/notifications/fcm.ts` (`onNotificationOpenedApp`), `src/navigation/RootNavigator.tsx` |
| §3.6, §4.8, R-073 | Quit-state tap routing (cold start) | `src/notifications/fcm.ts` (`getInitialNotification`), `src/navigation/RootNavigator.tsx` |
| §4.8's 12-type mapping table, R-073 | Notification type → screen resolution (single source of truth for both tap paths) | `src/notifications/notificationRouting.ts` |
| §4.8, R-076 | Notification Preferences screen — all 12 types, toggles, loading/error states | `src/screens/NotificationPreferencesScreen.tsx` |
| Task brief Step 7 | "Notification Preferences" link on Profile | `src/screens/ProfileScreen.tsx` |
| Task brief Step 8, §3.1, §3.9 | `NotificationPreferencesScreen` reachable in the App Stack; initial-route handling for a quit-state tap | `src/navigation/RootNavigator.tsx`, `src/navigation/types.ts` |
| R-111, §5.4 | No notification content (title/body/entity id) ever logged | all files above — see §5 Verification |

**Untouched per explicit brief rule** ("Do not modify the registration
flow"): `getToken`, `registerDeviceToken`, `deregisterDeviceToken`,
`onTokenRefresh`, `requestPermission`, `buildUserAgent` in
`src/notifications/fcm.ts` — byte-identical to their pre-task form.

## 3. Proposed Assumptions

1. **`NotificationType` is a string-literal union, not a TypeScript
   `enum`.** Every other domain type file in this codebase
   (`EventStatus`, `RsvpStatus`, `GroupMemberRole`, etc.) uses string
   unions; kept consistent with that established convention rather than
   introducing the only runtime `enum` in the codebase. Values are
   unaffected — this is a TypeScript-authoring-style choice only.
   (`src/types/notification.ts`)

2. **A notification type absent from `GET /notifications/preferences`'s
   response defaults to "on".** The brief doesn't specify a default for
   a type with no stored preference row; "on" is the conservative
   reading, consistent with R-071's "no notification type missing"
   intent (a silent, unrequested opt-out would contradict it).
   (`src/screens/NotificationPreferencesScreen.tsx`)

3. **`title`/`body` for a push payload are read from the FCM `data`
   block first, falling back to the FCM `notification` block.** The
   task brief's `PushNotificationPayload` (Step 1) models them as part
   of the same `data`-shaped payload as `notification_type`/`entity_id`;
   the fallback to `notification.title`/`notification.body` covers a
   message sent with both blocks (the normal shape for a message the OS
   also auto-displays in background/killed state per §3.6).
   (`src/notifications/fcm.ts`, `extractPushPayload`)

4. **`registerBackgroundMessageHandler`'s handler body is a deliberate
   no-op.** This app's pushes always carry a `notification` block
   (server-controlled), which Android's FCM SDK displays in the system
   tray automatically while backgrounded/killed — no client code is
   needed to *display* it, only to route the subsequent tap (handled
   separately by `onNotificationOpenedApp`/`getInitialNotification`).
   Registering the handler itself is still required by the Firebase
   Android SDK regardless of an empty body. (`src/notifications/fcm.ts`)

## 4. Deviations (need architect ratification)

1. **Foreground rendering does not use `notifee`.** DES-MEETUP-MOBILE.md
   §3.6 names `notifee` as a fixed technology decision for foreground
   message rendering, with documented trade-offs accepted. The task
   brief explicitly and repeatedly (Step 3, and again in the Rules
   section) prohibits any third-party toast/notification library and
   asks for "a simple state-based banner component" instead. `notifee`
   is not installed in this repo (`package.json` has no dependency on
   it, confirmed before writing any code) — no existing integration was
   removed or worked around. Followed the brief's explicit, repeated
   instruction: `src/notifications/notificationBannerStore.ts` (a
   dependency-free pub/sub store, same pattern as the existing
   `src/api/authEvents.ts`) plus `src/components/NotificationBanner.tsx`
   (a plain React Native `Animated`/`PanResponder` component) replace
   `notifee` for the foreground case only. Background/killed-state
   display is unaffected — the OS system tray still displays those
   automatically, exactly as §3.6 describes, with no `notifee`
   involvement either way.

2. **Background/quit-state tap routing does not touch native Android
   Java** (`MainApplication.java`). The task brief's Step 4 says to
   implement this "in `MainApplication.java` or equivalent." This uses
   the official `@react-native-firebase/messaging` JS SDK's
   `onNotificationOpenedApp`/`getInitialNotification` functions instead
   (`src/notifications/fcm.ts`, wired from `src/navigation/RootNavigator.tsx`).
   DES-MEETUP-MOBILE.md §3.6 explicitly lists "a custom native module
   instead of the official Firebase RN SDK" under **Alternatives
   rejected** — writing routing logic into `MainApplication.java` would
   be exactly that rejected alternative. The brief's own "or equivalent"
   wording was read as accepting a design-compliant substitute. No
   native Android file was modified by this task.

3. **`team_invite` routes to `GroupDetailScreen`, not a Team Detail
   screen.** DES-MEETUP-MOBILE.md §4.8's own 12-type mapping table names
   "Team Detail" for `team_invite`, backed by the design's separate
   `/teams/*` API family (§4.4, §7.3) — a distinct resource from Groups.
   No Team module (screen, API client route, or nav route) exists
   anywhere in this codebase; only Groups does. Building a Team Detail
   screen is outside this task's stated scope (its own step list only
   adds `NotificationPreferencesScreen`). Followed the task brief's
   explicit, literal instruction (its own routing table lists
   `team_invite → GroupDetailScreen with group id`).
   **Real functional risk, not cosmetic**: if a real `team_invite`
   notification's `entity_id` is actually a team id (not a group id),
   `GroupDetailScreen`'s `GET /groups/{id}` fetch will 404 or return the
   wrong record against the real backend — the two are separate id
   spaces per the design's own resource split. This fails safely
   (`GroupDetailScreen` already has a generic "could not load this
   group" retry state, not a crash), but the tap will land the user on
   the wrong screen. **Needs architect resolution**: either confirm
   `team_invite`'s `entity_id` is in fact a group id in the ratified
   backend contract, or approve building a Team Detail screen in a
   follow-up task. Recorded in code at
   `src/notifications/notificationRouting.ts`'s file header and inline
   at the `team_invite` case.

## 5. Verification results

**Type-check** (`npx tsc --noEmit`):
```
$ npx tsc --noEmit
EXIT:0
```
(No output — clean.)

**Lint** (`npx eslint . --ext .ts,.tsx`):
```
$ npx eslint . --ext .ts,.tsx
EXIT:0
```
(No output — clean.)

**Tests**, run 3x for stability:
```
$ for i in 1 2 3; do npx jest 2>&1 | tail -6; echo "--- Run $i ---"; done
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.61 s, estimated 1 s
Ran all test suites.
--- Run 1 ---

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.444 s, estimated 1 s
Ran all test suites.
--- Run 2 ---

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.44 s, estimated 1 s
Ran all test suites.
--- Run 3 ---
```
The existing `__tests__/App.test.tsx` smoke test still passes, now
exercising the full new wiring (`ProfileStack`, `NotificationBanner`,
`RootNavigator`'s FCM effects) since it renders the whole app tree.
`jest.setup.js`'s centralised `@react-native-firebase/messaging` mock
was extended with `onNotificationOpenedApp`, `getInitialNotification`,
`setBackgroundMessageHandler` (added to the existing mock per this
file's own established convention, not a new ad hoc mock).

**No notification content logged** (R-111, §5.4, explicit brief rule):
```
$ grep -rn "console\." src/types/notification.ts src/api/notifications.ts \
  src/notifications/notificationRouting.ts src/notifications/notificationBannerStore.ts \
  src/notifications/fcm.ts src/components/NotificationBanner.tsx \
  src/screens/NotificationPreferencesScreen.tsx src/screens/ProfileScreen.tsx \
  src/navigation/RootNavigator.tsx src/navigation/types.ts
src/notifications/fcm.ts:180:    console.log('[fcm] foreground message received', {
```
That single, pre-existing (unmodified) line logs only `messageId` and
`notification_type` (a fixed backend enum value) — never title, body, or
entity id.

**Registration flow untouched** (explicit brief rule):
```
$ git diff HEAD -- src/notifications/fcm.ts | grep -A2 "^-export async function getToken\|^-export async function deregisterDeviceToken\|^-export function onTokenRefresh\|^-export async function requestPermission"
(no output — none of these functions appear in the diff's removed lines)
```

**All 12 notification types handled in routing** (explicit brief rule) —
enforced at the type-checker level via an exhaustive `switch` with a
`never` fallthrough in both `resolveNotificationTarget` and
`navigateToNotificationTarget` (`src/notifications/notificationRouting.ts`);
`tsc --noEmit` above would fail if a 13th type were added to
`NotificationType` without a corresponding `case`.

**Formatting discipline**: `npx prettier --write` was applied to the new
files only; running it against the pre-existing modified files
(`RootNavigator.tsx`, `fcm.ts`, `ProfileScreen.tsx`, `jest.setup.js`)
first produced large unrelated reformatting of untouched lines (the
codebase's existing files are not prettier-clean at 80 columns despite
the committed `.prettierrc`), so those four files were reverted and
re-edited with targeted patches instead — see
`docs/reports/agent-enhancement-2026-09-17.md` #15 for the generalized
lesson.

**Git evidence**:
```
$ git status --short
 M jest.setup.js
 M src/navigation/RootNavigator.tsx
 M src/navigation/types.ts
 M src/notifications/fcm.ts
 M src/screens/ProfileScreen.tsx
?? docs/reports/IMPL-DES-MEETUP-MOBILE-notifications.md
?? docs/reports/agent-enhancement-2026-09-17.md
?? src/api/notifications.ts
?? src/components/
?? src/notifications/notificationBannerStore.ts
?? src/notifications/notificationRouting.ts
?? src/screens/NotificationPreferencesScreen.tsx
?? src/types/notification.ts

$ git diff --cached --stat
 docs/reports/agent-enhancement-2026-09-17.md  | 139 ++++++++++++++++++++
 jest.setup.js                                 |   9 ++
 src/api/notifications.ts                      |  46 +++++++
 src/components/NotificationBanner.tsx         | 162 +++++++++++++++++++++++
 src/navigation/RootNavigator.tsx              | 163 ++++++++++++++++++++---
 src/navigation/types.ts                       |  32 +++++
 src/notifications/fcm.ts                      | 143 ++++++++++++++++++--
 src/notifications/notificationBannerStore.ts  |  61 +++++++++
 src/notifications/notificationRouting.ts      | 179 ++++++++++++++++++++++++++
 src/screens/NotificationPreferencesScreen.tsx | 179 ++++++++++++++++++++++++++
 src/screens/ProfileScreen.tsx                 |  29 ++++-
 src/types/notification.ts                     |  72 +++++++++++
 12 files changed, 1189 insertions(+), 25 deletions(-)
```
**Actual commit and push evidence** (recorded after committing, matching
this project's established pattern of confirming the real values rather
than pre-stating them):
```
$ git log --oneline -3
d713814 feat(notifications): implement foreground banner, background deep-link routing, and notification preferences screen
907ce8a Updated Design
1ba9362 docs(report): record actual git push evidence for tournaments module implementation report

$ git status
On branch main
Your branch is up to date with 'origin/main'.

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	.claude/

nothing added to commit but untracked files present (use "git add" to track)

$ git push origin main
To https://github.com/pratheeshku/meetup-mobile.git
   907ce8a..d713814  main -> main

$ git log origin/main -1 --oneline
d713814 feat(notifications): implement foreground banner, background deep-link routing, and notification preferences screen
```
Note: the commit was amended once, locally, before this push — the
initial `git commit` inadvertently included a `Co-Authored-By` trailer
from this session's general attribution instructions, which conflicts
with CLAUDE.md's explicit "Never add Co-Authored-By trailers or any AI
tool attribution to commit messages" rule. Caught immediately, before
any push, and fixed with `git commit --amend` (no push had happened yet,
so nothing shared was rewritten) to the exact brief-specified commit
message with no trailer. Recorded here for transparency rather than
silently corrected.

## 6. Known gaps / follow-ups

1. **Deviation #3 (team_invite → GroupDetailScreen id-space mismatch)**
   is the most important open item — see §4.3. Needs an explicit
   architect call before this path is exercised against a real backend.
2. **No new unit tests were added for this module**, consistent with
   every prior module report in this codebase (Groups, Tournaments,
   etc. — see e.g. `IMPL-DES-MEETUP-MOBILE-groups.md` §Known gaps): the
   existing `__tests__/App.test.tsx` smoke test is the only test
   coverage, extended only via the Jest mock additions this task
   required. DES-MEETUP-MOBILE.md §8.3 ("FCM payload tampering against
   an unrecognized `notification_type`") and §8.5 ("unit tests including
   deep-link mapping completeness") both describe test coverage this
   module doesn't yet have as dedicated test files — the exhaustive
   `switch`/`never` pattern in `notificationRouting.ts` gives compile
   -time completeness, and `extractPushPayload`'s `isKnownNotificationType`
   guard gives runtime tamper-safety (an unrecognized type is dropped,
   not routed or displayed), but neither is exercised by an actual test
   file. Flagged for the testing agent's adversarial QA pass per this
   project's established handoff workflow.
3. **Pre-auth quit-state notification taps are dropped, not queued.**
   If the app cold-starts from a notification tap with no restored
   session (signed out), the tap is silently dropped — this app has no
   `pendingDestination` mechanism (§3.9 describes one for URL-based deep
   links, itself not yet built either, per `RootNavigator`'s own file
   header). Same class of gap as every other module's unimplemented
   §3.9/§3.8 offline/deep-link edge cases.
4. **FCM registration/de-registration is still not wired into the
   sign-in/cold-start lifecycle** — a pre-existing gap from the original
   `fcm.ts` scaffold (§3.5 auth flow dependency), explicitly out of
   scope for this task ("do not modify the registration flow") and
   unchanged by it.
5. **`registerBackgroundMessageHandler` is called from `RootNavigator`'s
   effect, not from `index.js` at true top level.** Firebase's own
   recommendation is to register the background handler as early as
   possible, ideally outside any React component. Since this task's
   background handler is a documented no-op (Proposed Assumption #4),
   the practical difference is minimal, but a stricter reading of the
   Firebase SDK's guidance would move this one call into `index.js`
   before `AppRegistry.registerComponent`. Flagged rather than silently
   moved, since `index.js` is outside this task's named file list.

### Completion Proof

**Test evidence** (raw output — see §5 above for the full 3-run output;
repeated here per the mandatory format):
```
$ for i in 1 2 3; do npx jest 2>&1 | tail -6; echo "--- Run $i ---"; done
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.61 s, estimated 1 s
Ran all test suites.
--- Run 1 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.444 s, estimated 1 s
Ran all test suites.
--- Run 2 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.44 s, estimated 1 s
Ran all test suites.
--- Run 3 ---
```

**Git evidence**:
```
$ git log --oneline -3
d713814 feat(notifications): implement foreground banner, background deep-link routing, and notification preferences screen
907ce8a Updated Design
1ba9362 docs(report): record actual git push evidence for tournaments module implementation report

$ git status
On branch main
Your branch is up to date with 'origin/main'.

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	.claude/

nothing added to commit but untracked files present (use "git add" to track)
```
(See §5 "Actual commit and push evidence" above for the push confirmation
against `origin/main`.)

**File evidence** (all 12 notification types present in the routing
table):
```
$ grep -c "case '" src/notifications/notificationRouting.ts
12
```

**Build evidence**: not applicable — Android build/`npm run android`
requires an emulator/device and Android SDK not available in this
session; `tsc --noEmit` (clean) is the compile-correctness proof for a
React Native/TypeScript change of this kind, consistent with every
prior module report in this codebase.
