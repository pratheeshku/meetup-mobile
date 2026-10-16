# create-game-added-invitees-list report

Branch: `feat/create-game-duration-email-invites-tournament-card`.

## Files changed
- `src/screens/CreateGameScreen.tsx`: directly under the player search box and above the suggestions, a wrapping chip list of everyone added (players and emails). Each chip is a fixed-height (36) row: 28x28 avatar box with initials (email: first letter), name or email (single line, truncates), and a 32x32 remove control (`CrossIcon`, accessibility label "Remove {name}"). Nothing renders when the list is empty. Toggling a suggestion adds/removes the person here; removing from the list updates the suggestion toggle state. Review "{n} invited" stays in sync (players + emails). Suggestion toggles got a `testID` (`invite-toggle-<id>`).
- `src/labels/defaultLabels.ts`: `mob.create_game.invitee_remove_a11y` ("Remove {name}").
- Tests: `src/screens/__tests__/CreateGameInviteeList.test.tsx` (6).

## Tests (raw)
```
 ✓ shows nothing when no one is added
 ✓ adds a player to the list under the search box when a suggestion is toggled, and keeps the review count in sync
 ✓ toggling the suggestion again removes the person from the list
 ✓ removes a player with the x control in the list
 ✓ lists emails with players, removes them, and counts both
 ✓ removing a listed player does not send them on submit
Tests: 6 passed, 6 total
```

## Follow-up fix: invite-only only
- Step 6 now renders the heading, player search, added-invitees chips, suggestions and the "Invite by email" input **only when the game is invite-only**. Public and group games show just the review, so no one who will not be invited is displayed.
- New test `src/screens/__tests__/CreateGameInviteeVisibility.test.tsx` (3): invite-only shows search, suggestions and email input; public and group hide search, suggestions, email input and chips. `createGameHarness` gained an optional `groups` argument. The group case first switches to Public (a group is pre-selected by default when the user has one), then clicks the group, and asserts the review shows `4 players · Sunday Footballers` before asserting the invitee UI is hidden. Verified: with the group click commented out the group case fails (review shows `4 players · Public`); restored, all 3 pass.

## Checks
- `npm run check:labels`: OK - 206 files scanned, 944 default labels checked.
- `npx tsc --noEmit`: clean. `npx eslint` on all changed files: clean.
- Full suite on this branch: `Test Suites: 15 failed, 123 passed, 138 total` / `Tests: 177 failed, 1458 passed, 1635 total`. `origin/main`: 15 failed suites / 177 failed tests; failing-suite lists identical (diff empty).
- No screenshots: no emulator/device in this container.

## Deviations
- Chips use the same initials/tint avatar as the suggestion rows (the search results carry no photo URL in this screen's flow), not `UserAvatar` images.
- The remove control is a vector cross, not a text glyph, to avoid a hard-coded string.
