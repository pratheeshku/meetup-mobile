## Status — 2026-09-19 (ARCHIVED — EventDetailScreen organiser fix committed; awaiting testing-agent and conformance review)

Task: fix EventDetailScreen organiser detection (stubbed `is_organiser`), follow-up to the Home dashboard work.
Design: DES-MEETUP-MOBILE, APPROVED 2026-09-13, tier T1. Baseline before change: tsc 0, jest 139/139.
Updated at milestones only (no timer available); the status file was not written at task start this time.

### Completed
- Code commit `2483a71`: `EventDetailScreen` uses `isOrganiserOf(event, user?.id)`; stale comment in `events.ts` corrected (comment-only)
- Regression tests (14) through the real mapper; fail on the original code (5 failures), pass with the fix
- tsc 0, eslint 0, jest 153/153 x3 after last code edit
- Report `docs/reports/IMPL-DES-MEETUP-MOBILE-event-detail-organiser-fix.md`; reflection entry #13 in `docs/reports/agent-enhancement-2026-09-19.md`

### In Progress
- None

### Pending
- Testing-agent pass (fresh session), then conformance-review
- DECISION for user: Cancel is now visible but the live API requires a `reason` body the app does not send -> expected 422. Join (rsvp needs `action` body -> 422) and Leave (no `/withdraw` route -> 404) are blocked too (report §0)
- Follow-ups: cancel-reason UI (+ confirmation), remove dead `Event.is_organiser`, extract `isOrganiserOf` to a neutral module

### Blocked
- Join, Leave and Cancel Event cannot succeed against the live API (pre-existing blocks from the 2026-09-18 API audit, re-verified against the live schema; not changed by this task)
