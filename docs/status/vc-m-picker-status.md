# Status: vc-m-picker

**Started**: 2026-10-15T20:21:45+08:00
**Last updated**: 2026-10-15T20:39:00+08:00
**Last updated by**: agy (Senior Full-Stack Developer)
**Design doc reference**: DES-MEETUP-ADDENDUM-VENUE-CATALOGUE v1.0, §4, §5, §8; Boards: Game3When, EditGame2

## Current step
5 of 5 — Task complete: VenuePicker component built, wired into CreateGameScreen & EventDetailScreen, unit tests passing. Built against spec, integration pending.

## Files touched so far
| File | Action | Status |
|---|---|---|
| src/theme/tokens.ts | modified | done and verified |
| src/labels/fallbackLabels.ts | modified | done and verified |
| src/components/venue/VenueIcons.tsx | created | done and verified |
| src/components/venue/VenuePicker.tsx | created | done and verified |
| src/components/venue/__tests__/VenuePicker.test.tsx | created | done and verified |
| src/screens/CreateGameScreen.tsx | modified | done and verified |
| src/screens/EventDetailScreen.tsx | modified | done and verified |
| docs/status/vc-m-picker-status.md | updated | done and verified |

## Blockers / open questions
None. Task built against spec (§4/§5) and boards `Game3When` and `EditGame2`. Built against spec, integration pending.

## Handoff notes
vc-m-picker acceptance met:
- VenuePicker component matches visual boards `Game3When` (open/search) and `EditGame2` (selected state).
- Search input with helper text: "Showing venues for <Sport>".
- Queries `getVenues({ sport_id, q, cursor })` sending sport at all times.
- Infinite scroll with cursor pagination.
- Row layout: 34x34 red pin badge, venue name, address line (block + street), and source tag ("ActiveSG" from label `venue.source.catalogue`).
- Last row is ALWAYS **Others** with 34x34 plus icon badge and subtitle "Not listed? Enter the name and postal code".
- Selected state: 50px card with name, address line, source tag, chevron down to reopen.
- Map card with fixed pin and caption "Pin set from the venue address"; client never allows dragging pin or current location link when catalogue is enabled.
- Changing sport clears catalogue venue with notice "Sport changed. Please select a venue again.", while Others venue survives.
- Selecting a venue sends `venue_id` on save; address fields are omitted.
- Wired behind `venue_catalogue_enabled` flag gate in both `CreateGameScreen.tsx` (Step 3) and `EventDetailScreen.tsx` (Edit Step 2); old Places autocomplete and free-text flow remains 100% untouched when flag is false.
- All 7 tests in `VenuePicker.test.tsx` pass.
