# Implementation Report: tr-mobile-4

Branch `tr-mobile-4` from `origin/main` (0780f6e, which contains tr-mobile). Design: addendum v1.3 (header checked). **Not self-certified.** Screenshots: none (no emulator or device build in this session), see section 5.

## 1. Status per item
- **M1 team picker: done.** Not verified on a device.
- **M2 organizer fee edit: BLOCKED, nothing built.** See section 2.
- **M3 fee entry in currency units: done** for the create wizard. The M2 edit sheet does not exist, so it could not reuse the field.

## 2. Blocked Report: M2
The brief says: "Use the existing registered_count field ... If the backend does not return it on GET /tournaments/{id}, stop with a Blocked Report."
Evidence (backend `origin/main`): `tournaments/schemas.py` documents `registered_count` as "Set ONLY by GET /tournaments; every other endpoint using this model returns null"; `tournaments/router.py` sets it only in `_with_registration_summary` (the list), and `get_tournament` (GET /tournaments/{id}) does not call it. So the warning condition ("registered_count > 0 AND the value changed") cannot be evaluated from the single read.
Options for the owner (none built, no field invented): (a) the backend sets `registered_count` on GET /tournaments/{id}; (b) the app uses the length of the active rows from `GET /tournaments/{id}/registrations`, which the detail screen already loads, as the count (a mobile-only change, but a different source than the brief names); (c) pass the list row's count in the navigation params. M2 also needs `tournament_fee_enabled` on the detail screen (the app reads it from `GET /config/client`, which that screen does not call today). I stopped as instructed and did not start the sheet, the row or the PATCH call.

## 3. What was built
- **M1.** `getMyTeams` (`GET /teams/mine`, `src/api/teams.ts`). `registerForTournament` sends `{ team_id, accepted_fee_cents? }` for team mode; individual mode unchanged (no team_id, no user_id). In `useTournamentRegistration`, a team-mode `start()` reads the teams first (own correlation id), keeps those whose sport equals the tournament sport (case-insensitive, `teamsForSport`), preselects the first, and opens the confirmation with a radio list under `mob.reg.team_label`, above the fee line. Confirm is disabled until a team is chosen and the fee is readable. An empty list does not open the confirmation: the existing result pop-up shows `mob.reg.team_empty`, no Try again. A failed teams read shows the generic label with Try again, which reads the list again. FEE_CHANGED re-shows the sheet with the same team selected. The push `open_app` path already opened this flow; it now reaches the selector (tested). Files: `src/api/teams.ts`, `src/api/tournaments.ts`, `src/hooks/useTournamentRegistration.tsx`, `src/components/tournament/RegistrationDialogs.tsx`, `src/utils/registration.ts`.
- **M3.** `parseAmountToCents` and `centsToAmountText` in `src/utils/money.ts` (dot only, at most two decimals, integer arithmetic; "" gives no fee, null, not 0). The wizard field now holds an amount (`feeAmount`), uses a decimal keypad, validates 0..max (the maximum shown formatted as currency in the error), sends whole cents as `registration_fee_cents`, and previews the amount. Hint and error labels use the new text. Files: `src/utils/money.ts`, `src/utils/tournamentWizard.ts`, `src/screens/TournamentWizardScreen.tsx`, `src/components/tournament/wizard/RegistrationStep.tsx`, `src/labels/defaultLabels.ts`.
- **Labels.** Only the listed keys: `mob.reg.team_label`, `mob.reg.team_empty` (new), and the new text of `mob.tw.fee_hint` and `mob.tw.fee_error` (existing keys; the hint now takes `{currency}`, the error `{max}` as formatted currency). `mob.tw.fee_label` and `mob.tw.fee_preview` unchanged. The M2 keys were not added (no M2).

## 4. Tests and checks (raw)
Jest, the files I added or changed, run once; one failed file re-run once after an in-scope fix. `EventDetailScreen.test.tsx` was not touched; its count is **still 34 failed** (24 passed, 58 total; the total grew from 56 to 58 because tr-mobile-3 added two tests there).
```
PASS src/utils/__tests__/tournamentWizardFee.test.ts
PASS src/api/__tests__/tournamentRegistrationApi.test.ts
PASS src/utils/__tests__/tournamentWizard.test.ts
PASS src/utils/__tests__/registration.test.ts
PASS src/components/__tests__/RegistrationStepFee.test.tsx
FAIL src/screens/__tests__/TournamentRegistrationFlow.test.tsx
  ● Register opens the confirmation sheet (AD-5) › a team tournament reads "per tournament team"
PASS src/screens/__tests__/TournamentWizardScreen.test.tsx
Test Suites: 1 failed, 6 passed, 7 total
Tests:       1 failed, 161 passed, 162 total
--- TournamentRegistrationFlow.test.tsx re-run ---
PASS src/screens/__tests__/TournamentRegistrationFlow.test.tsx
Tests:       37 passed, 37 total
--- EventDetailScreen.test.tsx (OI-24, untouched) ---
Tests:       34 failed, 24 passed, 58 total
```
The one failure in the first run was an older test ("a team tournament reads per tournament team") that now needs a team for the sport; I gave it one and kept its assertion.
Not covered because M2 is blocked: organizer-only fee row, warning condition, PATCH body.
`npx tsc --noEmit` (exit 0, no output):
```
(no output)
```
`npm run check:labels` (exit 0):
```
> node scripts/check-labels.js

check-labels: OK - 305 files scanned, 1777 default labels checked.
```
`npm run lint`: exit 1, the same 31 errors and 1 warning as before; a diff of the full output against the previous run shows no new problem. Raw tail:
```

✖ 32 problems (31 errors, 1 warning)
```

## 5. Screenshots
Not captured: no emulator or device build was made in this session. Needed from the owner: the team selector, the create-wizard fee field (iOS and Android). The fee edit sheet does not exist (M2 blocked).

## 6. Drift from the design and brief
1. M2 blocked (section 2).
2. `~/Developer/meetup` `origin/main` does not contain the keys `mob.reg.team_label` and `mob.reg.team_empty` (searched `core` and `migrations`); the brief says tr-close seeds them. The app uses the exact text as its fallback, so it works either way; the owner should check the seed.
3. Team mode still has no way to create a team from the empty state; the message only tells the person to create or join one first (as the brief specifies).
4. The old wizard field took whole cents (tr-mobile); it now takes an amount. Nothing is stored by the app, so there is nothing to migrate.

## 7. Git evidence
Branch `tr-mobile-4`; code commit `8ed1629`; the report commit follows it.
```
 .../__tests__/tournamentRegistrationApi.test.ts    |  25 +++++
 src/api/teams.ts                                   |   8 ++
 src/api/tournaments.ts                             |  14 ++-
 .../__tests__/RegistrationStepFee.test.tsx         |  18 +--
 src/components/tournament/RegistrationDialogs.tsx  |  52 ++++++++-
 .../tournament/wizard/RegistrationStep.tsx         |  14 ++-
 src/hooks/useTournamentRegistration.tsx            |  69 ++++++++++--
 src/labels/defaultLabels.ts                        |   6 +-
 src/screens/TournamentWizardScreen.tsx             |   7 +-
 .../__tests__/TournamentRegistrationFlow.test.tsx  | 122 ++++++++++++++++++++-
 src/utils/__tests__/registration.test.ts           |  51 ++++++++-
 src/utils/__tests__/tournamentWizardFee.test.ts    |  34 +++---
 src/utils/money.ts                                 |  26 +++++
 src/utils/registration.ts                          |  15 +++
 src/utils/tournamentWizard.ts                      |  48 ++++----
 15 files changed, 438 insertions(+), 71 deletions(-)
```
