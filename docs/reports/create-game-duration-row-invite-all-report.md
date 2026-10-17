# create-game-duration-row-invite-all report

Branch: `fix/create-game-duration-row-invite-all` (from `origin/main` @ e285383). Only `CreateGameScreen`, its tests/styles and the label defaults were touched.

## TASK 1: duration-same-row
- `src/screens/CreateGameScreen.tsx` step 3: for games (`mode === 'game'`) Date, Start time and Duration are ONE row, columns flex **1.35 / 1 / 1**, same row gap as before (`spacing.md`). The old standalone duration row and its style are removed. Tournaments keep the existing two-column row (1 / 1), long date, icons, no Duration.
- Labels and values: `numberOfLines={1}`, `adjustsFontSizeToFit`, `minimumFontScale={0.7}` on the three field labels and the date and time values. The Duration control is the existing `DropdownField` (options 1 to 8 hrs, default 2; its sheet is full-width so the list is not limited by the field), with a row-local style override (`minHeight 44`, no bottom margin).
- Narrow/large-font rule (`isCompactDateRow`, exported): width < 420 **or** font scale > 1.15 uses the short date (`17 Oct`, day and month) and drops the decorative icons with tighter padding in that row only. This covers 360dp and 375pt at font scale 1 and 1.3. Wider screens at normal font keep the weekday date with icons.
- Arithmetic at 360dp (screen padding 16 + card padding 16 per side): usable 262dp after two 16dp gaps, so date about 106dp, time and duration about 78dp each. Time "7:30 PM" needs roughly 52dp at 15sp, which only fits without the icon; hence the compact variant.
- ends_at is unchanged (starts_at + chosen hours).
- Tests: `CreateGameDurationRow.test.tsx` (12): three fields in one row with flex 1.35/1/1 and no second Duration; tournaments two fields and no Duration; one-line/fit-to-size props; short date at 360dp, 375pt, 360dp at 1.3 and 375pt at 1.3 (window size and font scale mocked); long date on a wide screen and for tournaments; the compact rule; ends_at default 2 hrs and a chosen 5 hrs.

## TASK 2: invite-for-all-visibilities
- Step 6 shows the shared `UserSearchPicker`, the chips under its text box and the email affordance for **every** visibility; the `isInviteOnly` gating of that UI is removed.
- Payload: `invite_user_ids` is sent whenever players were added, for all visibilities (group games still send `group_ids`). After create, one `inviteEmailToEvent` per email for all visibilities, sequential under one correlation id with the existing partial-failure handling; failures never block or roll back the game.
- Completion rows: for invite-only games `Invited players` and `Invited by email` always show; for public and group games they show when anyone was added; `Could not invite` lists failed emails.
- Review: public and group show the invited count too (new keys below), invite-only unchanged; counts equal players + emails.
- Backend verified by you (no change): `create_event` invites every id in `invite_user_ids` regardless of visibility and `POST /events/{id}/invite-email` has no visibility check.
- Tests: `CreateGameInviteeVisibility.test.tsx` rewritten for public, group and invite-only (each: search field + suggestions present, one text input, review line proves the audience really took effect (group case moves off the default group first, then clicks it), person + email -> chips, review count, `invite_user_ids`, `group_ids` only for group, one email call with the created id and the create correlation id, completion counts; failure listed without blocking; nobody added -> no `invite_user_ids`, no email calls; removed person not sent).

## New label keys (English text; added to `defaultLabels.ts` only, not seeded)
- `mob.create_game.review_players_public_invited` = "{count} players · Public · {invited} invited"
- `mob.create_game.review_players_group_invited` = "{count} players · {group} · {invited} invited"

## Tests (raw)
```
npx jest src/screens/__tests__/CreateGameInvitee src/screens/__tests__/CreateGameEmail src/screens/__tests__/CreateGameOptional src/screens/__tests__/CreateGameDuration src/screens/__tests__/LegacyVenue
Tests: 68 passed, 68 total   (7 suites)
```

## Checks
- `npm run check:labels`: OK - 211 files scanned, 951 default labels checked.
- `npx tsc --noEmit`: clean. `npx eslint` on changed files: clean.
- Full suite: branch `Test Suites: 15 failed, 129 passed, 144 total` / `Tests: 177 failed, 1652 passed, 1829 total`; `origin/main` baseline `15 failed suites / 177 failed tests`. Failing-suite lists identical (diff empty).
- **Screenshots: none.** No device/emulator in this container; the 360dp/375pt/1.3-scale checks are render tests with mocked window size and font scale plus the arithmetic above, not visual verification. Please eyeball step 3 on a device.

## Deviations / notes
1. `DropdownField` is outside the allowed files, so its value text cannot get `numberOfLines`/`adjustsFontSizeToFit`; "2 hrs" is short enough for the column (about 36dp at 1.0, tighter padding in compact mode), but at font scale 1.3 on a 360dp phone it is close to the limit. If it wraps on a device, add `numberOfLines={1}` there.
2. The compact variant also removes the calendar/clock icons in the game row (they do not fit at 360dp); tournaments keep them.
3. The legacy `CreateGameScreen.test.tsx` (pre-wizard) still fails as on main and was not touched.
