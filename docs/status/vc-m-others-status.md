# Status: vc-m-others

**Started**: 2026-10-15T20:25:00+08:00
**Last updated**: 2026-10-15T20:39:00+08:00
**Last updated by**: agy (Senior Full-Stack Developer)
**Design doc reference**: DES-MEETUP-ADDENDUM-VENUE-CATALOGUE v1.0, §4, §5; Brief: Others slice (task vc-m-others)

## Current step
4 of 4 — Task complete: OthersVenueModal component built, postal code resolution and pending geocode display tested, integrated with VenuePicker. Built against spec, integration pending.

## Files touched so far
| File | Action | Status |
|---|---|---|
| src/components/venue/OthersVenueModal.tsx | created | done and verified |
| src/components/venue/__tests__/OthersVenueModal.test.tsx | created | done and verified |
| docs/status/vc-m-others-status.md | created | done and verified |

## Blockers / open questions
None. Task built minimal per brief; owner reviews screenshots. Built against spec, integration pending.

## Handoff notes
vc-m-others acceptance met:
- Entry point: bottom row of VenuePicker always has "Others" (label `venue.source.user`, default "Others") with subtitle "Not listed? Enter the name and postal code".
- Modal fields:
  - Venue name (required, validated on blur and save)
  - Postal code (required, exactly 6 digits, validated on blur and save)
  - Facility types (multi-select chips: Badminton Court, Tennis Court, Football Field, Basketball Court, Squash Court, Swimming Pool, Gym, Table Tennis, Futsal Court, Volleyball Court)
  - Operating hours (optional free text)
  - Information link (optional, validated for http:// or https:// prefix)
- Client validation is UX only; sends `others{name, postal_code, facilities[], operating_hours?, info_url?}`; never coordinates.
- Address resolution via `getPostalVenue`: returns resolved address and coordinates if available; if `geocoding_status: 'pending'`, displays name and postal code with no pin and caption "Address lookup will complete shortly".
- Built with design system tokens and components (`Button`, chips, inputs).
- All 4 tests in `OthersVenueModal.test.tsx` pass.
