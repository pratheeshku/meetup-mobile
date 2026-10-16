# create-game-email-invites report

Branch: `feat/create-game-duration-email-invites-tournament-card`. Built together with create-game-added-invitees-list (same step 6 area).

## Files changed
- `src/utils/inviteEmails.ts` (new): `isValidInviteEmail`, `addInviteEmail` (trim, validate, case-insensitive de-dupe).
- `src/screens/CreateGameScreen.tsx`: step 6 "Invite by email" block (email input, validation error, **Add** button, keyboard Done also adds), shown for invite-only games, below the player suggestions. On submit, `createEvent` and then one `inviteEmailToEvent(created.id, email)` per email (sequential) run inside **one** `withCorrelationId`. A failed email invite never blocks or rolls back the game; failures are collected as `<email>: <message>` using `getApiErrorMessage(e, t('mob.game_detail.invite_error'))` (existing messages) and shown on the completion screen. Completion rows for invite-only: `Invited players`, new `Invited by email` (successful count), and `Could not invite` (only when something failed). Nothing logs addresses.
- `src/labels/defaultLabels.ts`: new keys `mob.create_game.invite_email_label|placeholder|add|invalid|duplicate`, `mob.done.f_invited_email`, `mob.done.f_invite_failed`.
- `src/test-utils/createGameHarness.tsx` (new shared wizard driver for tests).
- Tests: `src/screens/__tests__/CreateGameEmailInvites.test.tsx` (7).

## Tests (raw)
```
 ✓ rejects an invalid email with a message and does not add it
 ✓ adds a valid email and rejects a case-insensitive duplicate
 ✓ clears the error when typing again and trims whitespace
 ✓ calls inviteEmailToEvent once per email with the created event id and one shared correlation id
 ✓ shows partial failures on the completion screen without rolling back the game
 ✓ never writes email addresses to the console
 ✓ makes no email calls when none were added
Tests: 7 passed, 7 total
```

## Checks
- `npm run check:labels`: OK - 206 files scanned, 944 default labels checked.
- `npx tsc --noEmit`: clean. `npx eslint` on all changed files: clean.
- Full suite on this branch: `Test Suites: 15 failed, 122 passed, 137 total` / `Tests: 177 failed, 1455 passed, 1632 total`. `origin/main`: `15 failed suites / 177 failed tests`. The failing-suite lists are identical (diff empty); the branch adds 7 passing suites and 40 passing tests across the four tasks.
- No screenshots: no emulator/device in this container.

## Deviations
- The "invited by email" count is successful invites; failures are listed separately under "Could not invite" with the server's message (e.g. already invited) or the generic existing invite error.
- The email block shows only for invite-only games (as specified). Note a pre-existing quirk, unchanged: for non-invite-only games the player search is shown but `invite_user_ids` is only sent for invite-only.
- The review's "{n} invited" count is players + emails.
