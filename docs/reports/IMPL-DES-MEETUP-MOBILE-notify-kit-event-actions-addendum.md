# Implementation Report — group_event_created notification: Join + OK addendum

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version/Status**: APPROVED (architect-approved 2026-09-13; Create-flow
  amendment 2026-09-22)
- **Tier**: T1
- **Governing section**: §4.8 (notification handling), extending
  `docs/reports/IMPL-DES-MEETUP-MOBILE-notify-kit-event-actions.md`
  (the original Part 3 Join/View task).
- **Task authorization**: this task's brief itself states the design
  change directly ("matches this morning's confirmed design"), amending
  the prior brief's explicit "no OK/dismiss action for
  `group_event_created`" instruction. Treated as a small, scoped edit to
  an already-implemented feature (Gate 3 only), not a new feature —
  no dependency, schema, or environment change involved.
- **Prerequisite investigation**: a same-day, separate investigate-only
  task (direct-accept RSVP from the Join action) was completed first and
  came back **rejected for now** — Keychain-under-lock behaviour
  unverified, R-101 has no connectivity-check implementation in any
  context (foreground or background), iOS background execution
  unconfirmed. No code resulted from that task; it is referenced here
  only because this task's brief explicitly built on it ("Direct-accept
  investigated and rejected for now").

## 2. Traceability map

| Behavior | File | R-ID / Section |
|---|---|---|
| `group_event_created` notification: Join + OK actions (was Join-only) | `src/notifications/eventNotificationHandler.ts` (`displayEventNotification`) | §4.8 |
| Join → navigate to Event Detail, not a direct RSVP call (unchanged) | same file (`handleEventNotificationEvent`) | §4.8, R-101 (deferred, see investigation) |
| OK → dismiss only, no navigation, no API call (new for this type; logic was already type-agnostic) | same file (`handleEventNotificationEvent`) | §4.8 |
| Quit-state launch never triggered by OK (unchanged, already excluded `OK_ACTION_ID`) | same file (`getInitialEventNotification`) | §4.8 |
| Stale "Join-only" prose corrected | `src/notifications/fcm.ts`, `src/navigation/RootNavigator.tsx`, `src/notifications/__tests__/fcmForeground.test.ts` | doc-comment only, no logic |
| Test coverage for the new shape | `src/notifications/eventNotificationHandler.test.ts` | — |

Commit: pending (this report is committed in the same commit as the code,
per the standard closing step).

## 3. Proposed Assumptions

1. **Body content/parsing** (LOW): the task brief states the backend will
   enrich `group_event_created`'s body into a multi-line string (sport,
   organizer as "display_name (nickname)", date, time, venue, capacity —
   "Brief A"), but also explicitly says not to assume the shape until
   Brief A lands. No backend enrichment reference was found anywhere in
   this repo (`grep -rn "Brief A" docs` — no hits), confirming it is an
   external/not-yet-landed change. Conservative reading taken: **no code
   change** — `displayEventNotification` already renders `data.title`/
   `data.body` verbatim through the existing BigText style (applied
   whenever `data.body` is a non-empty string, regardless of how many
   `\n`-separated lines it contains), which is exactly the mechanism the
   task brief says to reuse ("same rendering mechanism as
   event_participant_added, this is just a longer body string, no new
   parsing logic needed"). Flagged for conformance-review to confirm
   against a live payload once Brief A ships, same disposition as this
   file's pre-existing `event_changed` payload-shape assumption.

## 4. Deviations

None. The action-shape change matches the task brief's explicit
instruction ("Actions: Join and OK... OK: dismiss only, no navigation —
matches this morning's confirmed design").

## 5. Verification results

### Type check
```
$ npx tsc --noEmit
(no output — clean)
```

### Targeted test run
```
$ npx jest src/notifications/eventNotificationHandler.test.ts src/notifications/__tests__/fcmForeground.test.ts src/notifications/__tests__/notificationRouting.test.ts
PASS src/notifications/__tests__/notificationRouting.test.ts
PASS src/notifications/eventNotificationHandler.test.ts
PASS src/notifications/__tests__/fcmForeground.test.ts

Test Suites: 3 passed, 3 total
Tests:       73 passed, 73 total
```

### Negative tests confirmed
- `group_event_created` OK press: cancels notification, **no navigation**
  (new test, `eventNotificationHandler.test.ts`).
- `group_event_created` quit-state launch via OK press: returns `null`,
  **does not launch/route** (new test — OK never opens the app, unchanged
  exclusion logic, now exercised for this type too).
- Existing negative tests (unknown action id, non-matching notification
  type, no-data notification, navigation-not-ready/headless) re-run
  unchanged and still pass.

### Completion Proof

**Test evidence** (raw output — no summaries):
```
$ for i in 1 2 3; do npx jest --silent 2>&1 | tail -6; echo "--- Run $i ---"; done
PASS src/navigation/__tests__/CreateTabButton.test.tsx

Test Suites: 64 passed, 64 total
Tests:       751 passed, 751 total
Snapshots:   0 total
Time:        8.333 s
--- Run 1 ---
PASS src/utils/__tests__/formatRelativeTime.test.ts

Test Suites: 64 passed, 64 total
Tests:       751 passed, 751 total
Snapshots:   0 total
Time:        2.056 s, estimated 8 s
--- Run 2 ---
PASS src/utils/__tests__/installedVersion.test.ts

Test Suites: 64 passed, 64 total
Tests:       751 passed, 751 total
Snapshots:   0 total
Time:        2.228 s
--- Run 3 ---
```

**Git evidence**:
```
$ git log --oneline -3
173af3a feat(notifications): notify-kit Join/View actions for group_event_created / event_changed
824d81c chore(release): bump versionCode to 10 (skip 9 — already taken on Play Console)
6e0c92e chore(release): bump versionCode to 8 for internal-testing AAB

$ git status --short
(shown pre-commit in the session; this task's own commit follows this report)
```

**File evidence** (grep showing key change exists on disk):
```
$ grep -n "isJoinShape\|OK_ACTION_ID" src/notifications/eventNotificationHandler.ts | head -8
103:const OK_ACTION_ID = 'ok';
120:  const isJoinShape = data.notification_type === 'group_event_created';
139:        isJoinShape
142:        { title: 'OK', pressAction: { id: OK_ACTION_ID } },
```

**Build evidence**: not run — this task touched no Android/Gradle
config, only TypeScript notification-handler logic and comments (native
`android/` build already verified for this feature in the prior Part 3
report; nothing here changes the manifest, permissions, or native
dependencies).

## 6. Known gaps / follow-ups

- Brief A (backend body enrichment) not yet landed — see Proposed
  Assumption #1. Needs a coordinate/confirm step once it ships, per the
  task brief's own instruction.
- On-device verification (foreground/backgrounded/quit-state, real Join
  and OK presses) still pending for this notification type generally —
  carried over from the original Part 3 report, not newly introduced by
  this addendum.
- Direct-accept-from-Join remains explicitly out of scope per the
  same-day investigation; any future revisit requires the dedicated
  on-device spike named there, not ad hoc work inside this handler.
