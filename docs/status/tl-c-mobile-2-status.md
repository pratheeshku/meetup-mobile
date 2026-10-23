# Status: tl-c-mobile-2

**Started**: 2026-10-23
**Last updated**: 2026-10-23
**Last updated by**: claude-code (session)
**Design doc reference**: DES-MEETUP-ADDENDUM-tournament-lifecycle v1.4 AD-19, AD-20, TL-19, TL-78 to TL-86 (identical in ~/meetup and here)

## Current step
Finished (4 of 4). PR 1 wizard delivered (two items blocked), PR 2 accept layer delivered, accept screen BLOCKED (no mobile board). Both PRs open against main.

## Files touched so far
| File | Action | Status |
|---|---|---|
| src/types/tournamentWizard.ts, src/utils/tournamentWizard.ts | created | done and verified (jest) |
| src/screens/TournamentWizardScreen.tsx | created | done and verified (jest) |
| src/components/tournament/wizard/*.tsx (12 files) | created | done and verified at test-renderer level; look not verified on a device |
| src/api/tournaments.ts | modified (wizard calls, committee calls) | done and verified |
| src/screens/CreateGameScreen.tsx, src/navigation/{types,RootNavigator}.ts(x) | modified (entry, route) | done and verified |
| src/components/AddRemoveControl.tsx, addRemoveGlyphStatic.test.ts | modified (disabledIds, stepper exception) | done and verified |
| src/labels/defaultLabels.ts, scripts/check-labels.allowlist.json | modified | done and verified (check:labels OK) |
| src/utils/committeeInvitation.ts, src/hooks/useCommitteeInvitationResponse.ts, src/types/tournament.ts | created / modified (PR 2) | done and verified |
| tests (9 files) | created | pass |
| docs/reports/tl-c-mobile-2-report.md, docs/status/tl-c-mobile-2-status.md | created | done |

## Blockers / open questions
A. Accept screen: no mobile board (NFCommittee and TPCommitteeDash do not show it; WebCommitteeAccept is web). B. Group-stage option picker: no create field carries the choice. See the report.

## Handoff notes
- Run `npm ci` first (the container had no node_modules).
- `CreateGameScreen.test.tsx` fails 37 of 38 on untouched main; not mine.
- No screenshots: no device. Steps to produce them are in the report.
- Accept/decline have no request-id field in the contract; one correlation id is used instead.
