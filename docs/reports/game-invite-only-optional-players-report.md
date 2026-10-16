# game-invite-only-optional-players report

Branch: `fix/create-game-optional-invites-map` (from `origin/main`).

## Files changed
- `src/screens/CreateGameScreen.tsx`
  - Removed the `step_invite_required` validation block in `handleSubmit` (invite-only with 0 invitees is now valid).
  - Removed `isStep6Disabled`; the Create Game button is disabled only while submitting.
  - `invite_user_ids` is sent only when `invitedPlayers.length > 0`; with zero invites the field is **omitted** (the backend task has not been confirmed merged, and the brief says to omit when unsure).
  - Completion screen already pushes the `Invited players` row for invite-only games using `invitedPlayers.length`, so it shows `0`.
  - Step 6 heading: it said "Who is invited? (at least 1)" for invite-only. It now always uses the existing neutral labels `mob.create_game.invite_players` + `mob.create_game.optional_parentheses` ("Invite players (optional)"), i.e. what non-invite-only games already showed. **No new label keys.**
- `src/screens/__tests__/CreateGameOptionalInvites.test.tsx` — new (3 tests).

## Tests (raw)
```
PASS src/screens/__tests__/CreateGameOptionalInvites.test.tsx
    ✓ step 6 does not say players are mandatory
    ✓ submits with zero invites: no invite_user_ids, completion shows invited = 0
    ✓ still sends invite_user_ids when players are invited
Tests: 3 passed, 3 total
```
With the screen change stashed: 2 fail (heading / zero-invite submit), 1 passes (invites still sent).
Full suite: `Test Suites: 15 failed, 116 passed, 131 total` / `Tests: 180 failed, 1398 passed, 1578 total`. The 180 failures are the same pre-existing 15 stale suites as on `origin/main` (180 before my change too); no new failures. `tsc` and `eslint` clean.

## Deviations / notes
- Unused leftovers: labels `step_invite_required`, `who_invited`, `at_least_one` and the `requiredSubtitle` style are now unreferenced; left in place (label inventory/docs untouched).
- The existing `CreateGameScreen.test.tsx` is stale (written for the pre-wizard single-form) and already fails; not modified.
- Confirm with the backend task that omitting `invite_user_ids` (vs `[]`) is accepted for `invite_only`.
- No screenshots: no emulator/device in this container.
