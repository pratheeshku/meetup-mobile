## Status — 2026-09-24 (code + tests committed; awaiting on-device verification)

Task: group_event_created mobile notification UI — Join navigates, does not
accept (design amendment: group_event_created now also carries an OK
action, matching event_changed's View+OK shape).
Doc: DES-MEETUP-MOBILE §4.8. Report:
docs/reports/IMPL-DES-MEETUP-MOBILE-notify-kit-event-actions-addendum.md

### Completed
- Prerequisite investigation (direct-accept from Join) completed and
  rejected for now — no code change from that task; findings folded into
  this file's header comment as a pointer, not duplicated.
- `group_event_created` shape changed from Join-only to Join + OK
  (`src/notifications/eventNotificationHandler.ts`) — OK dismiss-only,
  identical semantics to `event_changed`'s existing OK action.
- `handleEventNotificationEvent`'s OK/DISMISSED branch required no logic
  change (already type-agnostic); only its doc comment was corrected.
- Header comments updated across `eventNotificationHandler.ts`, `fcm.ts`,
  `RootNavigator.tsx`, `fcmForeground.test.ts` to drop the stale
  "Join-only" description.
- Body rendering: no code change — `data.body` is already displayed
  verbatim via the existing BigText mechanism regardless of line count, so
  the pending backend enrichment ("Brief A": sport/organizer/date/time/
  venue/capacity) needs no new parsing here. Recorded as Proposed
  Assumption #1 below pending that backend change landing.
- Tests updated/added: displayNotification action-shape assertion,
  OK-press behavioural test, quit-state OK-press negative test — all for
  `group_event_created`.
- tsc --noEmit clean; 64 suites / 751 tests passing (3 consecutive runs).

### In Progress
- none

### Pending
- Confirm the enriched multi-line `group_event_created` body renders
  correctly once Brief A (backend enrichment) ships — coordinate with
  backend, do not assume the shape (per task brief).
- Human: on-device verification of the Join/OK notification in all three
  states (foreground, backgrounded, quit-state), same as Part 3's original
  pending item — not yet done for the original Join-only shape either.
- Fresh-session testing-agent QA, then conformance-review.
- Not pushed.

### Blocked
- none
