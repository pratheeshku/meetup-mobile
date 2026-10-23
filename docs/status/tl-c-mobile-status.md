# Status: tl-c-mobile

**Last updated by**: claude-code (session)
**Design doc reference**: DES-MEETUP-ADDENDUM-tournament-lifecycle v1.4 AD-19, AD-20, TL-78 to TL-86; match-scoring v1.2

## Current step
Finished. PR 1 delivered, PR 2 BLOCKED, PR 3 delivered as audit plus static check.

## Files touched so far
| File | Action | Status |
|---|---|---|
| src/components/venue/VenuePicker.tsx | modified | done and verified (jest) |
| src/components/venue/__tests__/VenuePicker.test.tsx | modified | done and verified |
| src/test-utils/scoringBackendFixture.ts | created | done and verified |
| src/utils/__tests__/tournamentScoringContract.test.ts | created | done and verified |
| src/components/__tests__/addRemoveGlyphStatic.test.ts | created (PR 3 branch) | done and verified |
| docs/reports/tl-c-mobile-report.md | created | done |

## Blockers / open questions
PR 2: backend main lacks the template-list route, the AD-20 create route and tl-c-web-report.md. See the report's Blocked Report.
Owner decisions: InviteCard vs AD-19, GroupDetail plusSquare, UndoAddButton.

## Handoff notes
Backend was read from a read-only clone at /home/user/meetup (main 94604e5). Report file is identical on both branches.
