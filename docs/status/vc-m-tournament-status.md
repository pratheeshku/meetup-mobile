# Status: vc-m-tournament

**Started**: 2026-10-15T20:41:00+08:00
**Last updated**: 2026-10-15T20:46:00+08:00
**Last updated by**: agy (Senior Full-Stack Developer)
**Design doc reference**: DES-MEETUP-ADDENDUM-VENUE-CATALOGUE v1.0, §4, §5; Boards: `TournSched`, `TournSchedErr`, `TournSchedWarn`, `FXEdit*`

## Current step
4 of 4 — Task complete: 46px compact tournament VenuePicker variant built, wired into CreateGameScreen (tournament mode) and EditMatchModal on TournamentDetailScreen, unit tests passing. Built against spec, integration pending.

## Files touched so far
| File | Action | Status |
|---|---|---|
| src/components/venue/VenuePicker.tsx | modified | done and verified |
| src/components/tournament/EditMatchModal.tsx | created | done and verified |
| src/components/tournament/__tests__/EditMatchModal.test.tsx | created | done and verified |
| src/screens/CreateGameScreen.tsx | modified | done and verified |
| src/screens/TournamentDetailScreen.tsx | modified | done and verified |
| docs/status/vc-m-tournament-status.md | created | done and verified |

## Blockers / open questions
None. Task built against spec and boards `TournSched*` and `FXEdit*`. Built against spec, integration pending.

## Handoff notes
vc-m-tournament acceptance met:
- Tournament boards (`TournSched*`, `FXEdit*`) require a 46px selected-state venue field with name, source tag, and chevron down.
- Added `variant="tournament"` and `helperText` props to `VenuePicker`:
  - Renders 46px compact selected box with name, tag, and chevron.
  - Omit map preview in tournament variant (matching canvas boards).
  - Tapping opens the catalogue search list/modal to pick a venue.
  - Courts and match length stay organizer-entered; the catalogue never fills them.
- Wired into `CreateGameScreen.tsx` step 3 when `mode === 'tournament'`.
- Built `EditMatchModal` matching `FXEdit.html` (and variants `FXEditCourt`, `FXEditPlayer`, `FXEditRest`, `FXEditRound`, `FXEditWindow`):
  - Displays match participants, round, date, start time, 46px compact venue picker, court input, and court clash warnings.
  - Wired into `TournamentDetailScreen.tsx` for organizers on the Fixtures tab.
- All unit tests in `EditMatchModal.test.tsx` and `VenuePicker.test.tsx` pass.
