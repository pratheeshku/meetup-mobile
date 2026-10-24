# Status: te-a1

**Started**: 2026-10-24
**Last updated**: 2026-10-24
**Last updated by**: claude-code (claude-sonnet-5-5), final
**Design doc reference**: DES-MEETUP-ADDENDUM-TOURNAMENT-EXPERIENCE v1.0 (APPROVED), sections 1, 2, 3, 5, 8 (AD-T1, T2, T3, T4, T5, T6, T11); te-b1 and te-b2 reports (backend on main)

## Current step
7 of 7 — finished: items 1 to 5 built, tests and checks run, report written (docs/reports/te-a1-report.md). Screenshots were not produced (no device, no migrated backend). Nothing further to do except the owner's review.

## Files touched so far
| File | Action | Status |
|---|---|---|
| src/types/tournament.ts, tournamentScoring.ts, tournamentWizard.ts | modified (additive) | done and verified by tests |
| src/utils/tournamentScoring.ts, tournamentWizard.ts, imagePicker.ts | modified | done and verified |
| src/utils/tournamentExperience.ts | created | done and verified |
| src/api/tournaments.ts, home.ts | modified (mapper, upload/delete image, court booking) | done and verified |
| src/labels/defaultLabels.ts | modified (new keys; three Home card keys removed) | done |
| src/components/court/CourtBookingBlock.tsx | created | done and verified |
| src/components/home/CreateGameCard.tsx | deleted | done |
| src/screens/HomeScreen.tsx | modified | done and verified |
| src/components/tournament/wizard/{ImagesCard,RegistrationStep,ParticipationStep,ReviewStep,BasicsStep,CreatedView}.tsx | created/modified | done and verified |
| src/components/tournament/wizard/FormatStep.tsx | deleted | done |
| src/screens/TournamentWizardScreen.tsx | modified | done and verified |
| src/components/tournament/v2/{StatusStrip,TournamentHeader,TournamentTabs,LockedPreview,PeopleSheet,TournamentOverview,TournamentDetailV2}.tsx | created | done and verified |
| src/screens/TournamentDetailScreen.tsx | modified (v2 branch) | done and verified |
| src/components/AddRemoveControl.tsx | modified (group logo in GroupInviteList) | done and verified |
| src/components/__tests__/addRemoveGlyphStatic.test.ts | modified (card removed, two exceptions) | done |
| src/utils/__tests__/*, src/api/__tests__/*, src/screens/__tests__/{TournamentDetailV2,HomeCourtBooking,TournamentWizardScreen}, src/components/__tests__/GroupInviteListLogo, src/test-utils/tournamentWizardFixtures.ts | created/modified | done, 31 suites 351 tests pass |
| docs/reports/te-a1-report.md, docs/reports/te-a1-raw-output.txt | created | done |

## Blockers / open questions
- `GET /tournaments/{id}` carries no `lifecycle_version`: the presence of the server `tabs` object in `GET .../scoring/state` is the v2 signal.
- No hard-block date, registration-opened date or rules summary on `GET /tournaments/{id}`: those Overview rows are blocked (reported).
- TV2MobLive and TV2MobPlayerView are exported on the Fixtures tab: no Live Overview board (blocked, reported).
- Labels (reported, Appendix A of the report): the backend seeds only the court-booking and tab keys; every other new `mob.*` key is a bundled default awaiting a seed (reported).

## Handoff notes
- Uncommitted `android/version.properties` is not mine: never stage it. `git add` named files only.
- Backend repo `~/Developer/meetup` is read-only.
- Baseline `npm run check:labels` already fails on main with 7 stale-allowlist entries (glossary sync); not mine.
- Baseline `npm run lint` already fails on main (jest globals, hooks); my files are clean (`eslint` on changed files).
