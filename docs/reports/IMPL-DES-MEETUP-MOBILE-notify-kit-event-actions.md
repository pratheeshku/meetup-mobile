# Implementation Report — group_event_created / event_changed notify-kit actions (mobile, Part 3)

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version**: APPROVED, architect-approved 2026-09-13 (full document read before starting)
- **Status**: APPROVED, no Open Questions blocking
- **Tier**: T1
- **Sections**: §4.8 (notification type → deep link mapping), §3.6 (notification handling), R-073
- **Base**: `main` @ `824d81c`

## 2. Task history — one correction cycle

The first version of this brief asked to mirror an "organizer_add/organizer_remove" precedent and
have `group_event_created`'s Join action make a direct mutating RSVP call from the notification
action. Neither existed in this codebase (grepped, confirmed absent) and the direct-mutation pattern
has no precedent anywhere in this app (event_invite navigates to a screen; it does not call an API from
a notification button). A Blocked Report was filed instead of inventing that contract. The brief's author
corrected both points: the real precedent is `event_participant_added`/`event_participant_removed`
(`participantHandler.ts`), and Join navigates to Event Detail — it does not call the RSVP API. This report
covers the corrected, unblocked scope.

## 3. Traceability map

| Requirement (corrected brief) | File(s) | Notes |
|---|---|---|
| `group_event_created` added to `NotificationType` union + `NOTIFICATION_TYPES` | `src/types/notification.ts` | Third ratified addition beyond §4.8's 12, same mechanism as the two participant types |
| `group_event_created` added to `resolveNotificationTarget`'s exhaustive switch, entity_id = event id, routes like `event_invite` | `src/notifications/notificationRouting.ts` | Grouped with `event_invite`/`event_changed`/`event_cancelled`/`waitlist_promoted` — no blank-id guard |
| `group_event_created`: single "Join" action, navigates (not a direct RSVP call), body tap same target | `src/notifications/eventNotificationHandler.ts` (`displayEventNotification`, `handleEventNotificationEvent`) | `JOIN_ACTION_ID` action only; no OK/dismiss action |
| `event_changed`: View+OK, mirrors `participantHandler.ts` exactly | `src/notifications/eventNotificationHandler.ts` | Same action ids/labels/launchActivity/cancel semantics as the participant handler |
| Notification preference label for the new type (compiler-enforced `Record<NotificationType, string>`) | `src/screens/NotificationPreferencesScreen.tsx` | `group_event_created: 'New group events'` |
| FCM dispatch wiring (foreground/background) for both types, bypassing the generic banner path | `src/notifications/fcm.ts` (`onMessage`, `registerBackgroundMessageHandler`) | Mirrors the existing `isParticipantNotificationType` branches |
| Top-level background handler registration | `index.js` | `registerEventBackgroundHandler()` alongside the existing participant one |
| Foreground listener + quit-state read wiring | `src/navigation/RootNavigator.tsx` | `registerEventForegroundHandler()`, `getInitialEventNotification()` chained into the existing `getInitialNotification ?? getInitialParticipantNotification` fallback |
| Tests | `src/notifications/eventNotificationHandler.test.ts` (new), `src/notifications/__tests__/fcmForeground.test.ts`, `src/notifications/__tests__/notificationRouting.test.ts`, `src/screens/__tests__/NotificationPreferencesScreen.test.tsx` (updated) | See §5 |

Existing RSVP button/flow (`EventDetailScreen`, `src/api/events.ts`'s `rsvpEvent`) — **untouched**, per explicit
instruction.

## 4. Proposed Assumptions

1. **`event_changed`'s delivery mode flips from notification-block to data-only.** Before this task,
   `event_changed` was one of the 12 §4.8 types delivered *with* an FCM `notification` block — shown by the OS
   automatically and via the in-app banner in the foreground (`fcm.ts`'s `extractPushPayload`/`showBanner`),
   with plain tap-to-navigate and no action buttons. Giving it a "View" action button (this task's explicit
   instruction: "mirror participantHandler.ts's existing shape exactly") is only possible if the backend also
   makes it data-only — a native FCM `notification` block cannot carry custom-labelled action buttons. This
   mirrors the same flip the two participant types already went through, for the identical reason. **Risk if
   wrong**: if the backend keeps sending `event_changed` with a `notification` block, a live push will show
   *both* the OS's auto-rendered plain notification *and* this app's locally-built View/OK one — a duplicate
   tray entry. This cannot be verified without a live backend payload and is flagged for conformance-review.
   Documented in `eventNotificationHandler.ts`'s file header.
2. **`group_event_created`'s notification preference label**: "New group events". No copy was specified by
   the brief; kept in the same short, sentence-fragment style as the other 14 labels in
   `NotificationPreferencesScreen.tsx`.
3. **`group_event_created` has no OK/dismiss action** (single "Join" action only), per the brief's literal
   "Single action: 'Join'" — a deliberate difference from `event_changed`'s and the participant types' two
   -action (View+OK) shape. Android's native swipe-to-dismiss still works regardless of the absence of an
   explicit OK button.
4. **`group_event_created` is grouped with `event_invite`/`event_changed`/`event_cancelled`/`waitlist_promoted`
   in `resolveNotificationTarget`'s switch (no blank-`entity_id` fallback to the events list)**, rather than
   with the two participant types (which do have that guard). The brief says Join "navigates ... same
   target/mechanism event_invite already uses" — `event_invite` has no blank-id guard, so this preserves that
   literal instruction rather than importing the participant types' extra defensiveness.

## 5. Deviations

None from the corrected brief. (The now-superseded first brief's premises — a same-repo "organizer_add/remove"
precedent, and a direct-mutating-RSVP Join action — were never implemented; see §2.)

## 6. Verification results

### Type-check

```
$ npx tsc --noEmit
(no output — clean)
```

### Lint

```
$ npx eslint . --ext .ts,.tsx
(no output — clean)
```

### Tests (3 runs)

```
$ npx jest
Test Suites: 64 passed, 64 total
Tests:       749 passed, 749 total
Snapshots:   0 total
Time:        2.747 s, estimated 3 s
Ran all test suites.
--- Run 1 ---

Test Suites: 64 passed, 64 total
Tests:       749 passed, 749 total
Snapshots:   0 total
Time:        2.471 s, estimated 3 s
Ran all test suites.
--- Run 2 ---

Test Suites: 64 passed, 64 total
Tests:       749 passed, 749 total
Snapshots:   0 total
Time:        2.315 s, estimated 3 s
Ran all test suites.
--- Run 3 ---
```

Negative tests confirmed passing (in `eventNotificationHandler.test.ts`): unknown action id → no navigation/no
cancel; non-matching notification type → no navigation; missing notification data → no throw/no navigation;
navigation container not ready (headless/quit) → drops silently; OK press / DISMISSED → cancel only, never
navigates; Join press is explicitly asserted to be a navigation call, not an API call (no `rsvpEvent`/API
client mock is even wired into this test file — a direct-call regression would show up as a missing import
error or an unexpected mock call if one were accidentally added).

### Android debug build

```
$ cd android && ./gradlew assembleDebug --offline
...
BUILD SUCCESSFUL in 16s
435 actionable tasks: 37 executed, 398 up-to-date
```

### Git evidence

```
$ git log --oneline -3
(see commit below, this report's commit will be HEAD)
$ git status
(clean after commit)
```

### File evidence

```
$ grep -n "JOIN_ACTION_ID\|group_event_created" src/notifications/eventNotificationHandler.ts | head -5
70:const JOIN_ACTION_ID = 'join';
95:  const isJoinShape = data.notification_type === 'group_event_created';
```

## 7. Known gaps / follow-ups

1. **Unverified against a live backend payload** (both the `event_changed` data-only delivery-mode assumption
   in §4.1 and `group_event_created`'s `entity_id` = event id, per the brief's own "confirm ... once backend
   Part 2 is live" caveat). Must be checked against a real push once Part 2 ships.
2. **No on-device verification performed** — no emulator/device was attached in this session (same limitation
   as the prior notify-kit task). `assembleDebug` succeeded; a human should install the APK and exercise the
   3 real states (foreground, backgrounded, quit-state launch) for both new types before this ships.
3. **`group_event_created`/`event_changed` are still an unratified deviation from §4.8's "12 confirmed types"
   table**, same status as the two participant types before them — needs formal architect ratification of the
   design document itself (not blocking implementation, per the established precedent for the participant
   types).
4. Handoff to the testing agent (adversarial QA, fresh session) and then conformance-review, per the standard
   workflow.
