# Implementation Report: tr-mobile-5

Branch `tr-mobile-5` from `origin/main` (01b5d65). **M2: done** (organizer fee edit, option (b) of the architect decision). **Not self-certified.** No screenshots (no emulator or device build in this session): the fee edit row and sheet, with and without the warning, still need the owner's review on iOS and Android.

## What was built
- **Row** `mob.tournament.fee_edit_action` ("Registration fee", with the current fee beside it) on `TournamentDetailScreen`, shown only when: the viewer is the organizer, `tournament_fee_enabled` is true (read by the screen's existing `GET /config/client` call; no new request), the tournament `status` is `registration_open` and `registration_open` (closing date not passed) is true. Committee members and everyone else do not see it (UX only).
- **Sheet** (`src/components/tournament/FeeEditSheet.tsx`): title `mob.tw.fee_edit_title`; the M3 field (label `mob.tw.fee_label`, hint `mob.tw.fee_hint` with the currency, error `mob.tw.fee_error` with the maximum as an amount) using `parseAmountToCents`, `centsToAmountText` and the same max formatting as the wizard; prefilled with the stored fee (empty when free); Save `mob.tw.fee_edit_save`.
- **Warning** `mob.tw.fee_edit_warning`: active registrations > 0 AND the valid entry differs from the stored fee. "Active" = rows whose status is not `withdrawn`, counted from the `registrations` list the screen already holds (no request added; the sheet reads nothing when it opens). An invalid entry shows the field error and no warning.
- **Save:** `updateTournamentFee` in `src/api/tournaments.ts`: `PATCH /tournaments/{id}` with exactly `{ registration_fee_cents: <int or null> }`, under one `withCorrelationId()`. Sent only when the value changed (unchanged just closes). Errors: 409 `mob.tw.fee_edit_closed`; 422 `mob.tw.fee_error`; anything else `mob.tw.fee_edit_failed`; the raw detail is never shown and the sheet stays open. Success: toast `mob.tw.fee_edit_saved`, the tournament is refetched, the sheet closes.
- **Labels:** only the keys listed in the brief, with the exact text as the code fallback (`src/labels/defaultLabels.ts`).
Files: `src/components/tournament/FeeEditSheet.tsx` (new), `src/api/tournaments.ts`, `src/screens/TournamentDetailScreen.tsx`, `src/labels/defaultLabels.ts`, `src/screens/__tests__/TournamentFeeEdit.test.tsx` (new, 21 tests).

## Tests and checks (raw)
Jest: the new file plus the five existing files for the screen I changed, run once; the one failing file was corrected and re-run once. `EventDetailScreen.test.tsx` untouched: **still 34 failed of 58** (24 passed).
```
PASS src/screens/__tests__/TournamentResponses.test.tsx
PASS src/screens/__tests__/TournamentRespond.test.tsx
PASS src/screens/__tests__/AccessActionNotFound.test.tsx
PASS src/screens/__tests__/TournamentRegistrationFlow.test.tsx
FAIL src/screens/__tests__/TournamentFeeEdit.test.tsx
  ● Save (PATCH /tournaments/{id}) › an invalid entry cannot be saved
PASS src/screens/__tests__/TournamentDetailV2.test.tsx
Test Suites: 1 failed, 5 passed, 6 total
Tests:       1 failed, 127 passed, 128 total
--- TournamentFeeEdit.test.tsx re-run ---
PASS src/screens/__tests__/TournamentFeeEdit.test.tsx
Tests:       21 passed, 21 total
--- EventDetailScreen.test.tsx (untouched) ---
Tests:       34 failed, 24 passed, 58 total
```
The first-run failure was a wrong premise in my test, not a code fault: "-1" cannot be typed because the field drops signs and letters as you type ("-1" becomes "1", which is a valid 1.00). I changed the test to use entries the field lets through ("15.005", "1.2.3"; both save nothing) and added a check that a typed minus is dropped. The assertion that an invalid entry sends no PATCH is unchanged.
Covered: row visible to the organizer only; hidden for a player, with the flag off or unreadable, for `registration_closed`, `upcoming`, and a passed closing date; prefill (amount, and empty when free); warning (changed with players, cleared, unchanged, nobody registered, only withdrawn rows, invalid); PATCH body is exactly `{ registration_fee_cents }` (int and null), correlation id, toast, refetch, close; unchanged sends nothing; 409 / 422 / 500 / 403 / network mappings.
`npx tsc --noEmit` (exit 0, no output):
```
(no output)
```
`npm run check:labels` (exit 0):
```
> node scripts/check-labels.js

check-labels: OK - 306 files scanned, 1784 default labels checked.
```
`npm run lint`: exit 1, the same 31 errors and 1 warning as before; a diff of the full output against the previous run shows **no new problem**. Raw tail:
```

✖ 32 problems (31 errors, 1 warning)
```

## Drift from the design
1. "status is registration_open" is read literally from `tournament.status` (the backend's stored value). The mobile `TournamentStatus` type does not list it (it lists upcoming, active, completed, cancelled), so the code compares `String(tournament.status)`. Tournaments whose status is anything else do not show the row; the server still decides and answers 409 if the window has closed.
2. The count is the active rows of `GET /tournaments/{id}/registrations`, not `registered_count` (list only), as decided. Rows the caller cannot see are not counted; the organizer sees all.
3. Whether the status check matches v2 tournaments' real status values on the deployed backend was not verified against a live server.
4. There is still no full edit screen (out of scope).

## Git evidence
Branch `tr-mobile-5`; code commit `b7e832e`; the report commit follows it.
```
 src/api/tournaments.ts                           |  12 ++
 src/components/tournament/FeeEditSheet.tsx       | 197 ++++++++++++++++++
 src/labels/defaultLabels.ts                      |   7 +
 src/screens/TournamentDetailScreen.tsx           |  48 ++++-
 src/screens/__tests__/TournamentFeeEdit.test.tsx | 246 +++++++++++++++++++++++
 5 files changed, 509 insertions(+), 1 deletion(-)
```
