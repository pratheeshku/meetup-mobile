# Status: tl-c-mobile-3

**Started**: 2026-10-23
**Last updated**: 2026-10-23
**Last updated by**: claude-code (session)
**Design doc reference**: DES-MEETUP-ADDENDUM-tournament-lifecycle v1.4 TL-19; board WebCommitteeAccept (web board re-flowed to 390, owner-approved; no mobile board exists)

## Current step
4 of 4 - finished: card, screen wiring, tests, report. PR open against main; not merged.

## Files touched so far
| File | Action | Status |
|---|---|---|
| src/components/tournament/CommitteeInvitationCard.tsx | created | done and verified (jest, test-renderer); look not verified on a device |
| src/screens/TournamentDetailScreen.tsx | modified | done and verified (jest) |
| src/utils/committeeInvitation.ts | modified (committeeDateRange) | done and verified |
| src/labels/defaultLabels.ts, scripts/check-labels.allowlist.json | modified | done and verified (check:labels OK) |
| tests (3 files: card, detail committee, util) | created / modified | pass |
| docs/reports/tl-c-mobile-3-report.md, docs/status/tl-c-mobile-3-status.md | created | done |

## Blockers / open questions
None. `docs/agent-handoff-template.md` is not in this repo; read from the `pratheeshku/meetup` clone (`/home/user/meetup`, read-only, `0109c9b`). `WebCommitteeAccept` has a PNG only (no html), so no sizes come from the board.

## Handoff notes
- `npm ci` already run in this container.
- No screenshots: no device. Report lists the sizes used.
- Reuse: `useCommitteeInvitationResponse`, `committeeAnswerOutcome`, `getCommitteeInvitation`.
