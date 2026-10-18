# Build Brief: Invitation response (Accept = join)

Prepend `docs/agent-handoff-template.md` (sections 0–end) to this brief. Repos: `~/meetup` (backend + web) and `~/Developer/meetup-mobile` (mobile).

**Design:** `docs/DES-MEETUP-ADDENDUM-invitation-response.md` v1.0 (APPROVED by the owner, 2026-10-18). Governing: `Enterprise_Design_Principles.md` v1.1, `design-best-practices.md` v1.0.
**One rule:** Accept means "I'm playing". The invitee ends `going` or `waitlisted` in one atomic action. If the join fails, nothing changes.

## Hard rules
- Stay inside the task ID. No view or access rule changes. Do not edit design docs or choose version numbers. Report drift.
- Authorization stays in `policies.py`. No RLS, no triggers, no DB-side validation. No migration is expected; if one seems needed, STOP and ask.
- Never commit secrets. Zero sibling imports.
- Tests: read `docs/ENVIRONMENTS.md` first. Never use the prod database. Run `pytest` once per task (backend) or `npx jest` once (mobile).
- No conformance review or testing-agent dispatch.
- Backend contract comes from `~/meetup`. Do not invent fields: the only new field is `participation_status`.

## Task `ia-backend` (repo `~/meetup`; start only after PR `ac-p2-p3` is merged)
1. Extract the join logic of `rsvp_to_event_transactional` so both entry points share it (capacity, waitlist, skill check, eligibility). No duplicated capacity logic.
2. `respond_to_invitation(accept=True)`: lock the event row `FOR UPDATE`, then the invitation row, require `pending`, set `accepted`, run the shared join, return the invitation plus `participation_status`. Any refusal aborts the whole transaction (invitation stays `pending`). Lock order: event, invitation, participant.
3. `accept=False`: unchanged, `participation_status` null, no participant row.
4. Router: broadcast the real outcome (`going` or `waitlisted`) after an accept; decline keeps its current broadcast. Organizer notification comes from the shared path once; no new notification type.
5. Update the stale comment at `events/service.py:571-574`.
6. Script `scripts/report_accepted_without_participation.py`: read-only, terminal output only, no `--apply`.
7. Tests IA-1 to IA-10 (design section 4) at API level, plus fix any old test that asserts the old behaviour, citing the design clause.
Report `docs/reports/ia-backend-report.md`: raw test output, coverage delta, test results IA-1 to IA-10, git evidence, deviations. Stop.

## Task `ia-clients` (mobile + web; start only after `ia-backend` is deployed and OI-2 is resolved)
1. After Accept, show the outcome from `participation_status`: going or waitlisted. Use the existing label system (`npm run check:labels` on mobile) and an existing component. If no board or component fits, STOP and ask.
2. If accept returns an error, keep Accept and Decline available and show the server's reason using the existing error handling.
3. Refetch detail and lists after the response; no cached rows.
4. Tests IA-11. Mobile: `npx jest` once, `npx tsc --noEmit`, `npm run lint`, `npm run check:labels`. Web: `cd frontend && npm run lint && npm run build`; bump the PWA version constant on deploy.
Report `docs/reports/ia-clients-report.md` with screenshots. Stop.
