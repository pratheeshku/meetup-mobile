# tl-r1m-game-restore report

Branch: `feat/game-restore-tournament-share-invite` (from `origin/main`). Task B was **not started** (see bottom).

## Files changed
- `src/screens/EventDetailScreen.tsx` — restored Share, Invite Group, Invite Individual (user search + email) on the current detail view. Ported from `5f04b95^` only the share/invite pieces; the rewrite is untouched.
  - Hooks and components reused unchanged: `useAppShare`, `ShareActionSheet`, `Toast`, `UserSearchPicker`, `OptionChips`, `TextLink`.
  - API: `inviteGroupToEvent`, `inviteUserToEvent`, `inviteEmailToEvent`, `getMyGroups`. No new endpoints or fields.
  - Labels: existing `mob.game_detail.*` / `mob.group_detail.*` keys only. **No new keys.**
  - Styles: theme tokens only; icon+text rows use a fixed-size icon box (`spacing.lg`) and `sizes.touchTarget` min height.
- `src/screens/__tests__/EventDetailShareInvite.test.tsx` — new regression test (6 tests).

## Tests (raw)
New file:
```
PASS src/screens/__tests__/EventDetailShareInvite.test.tsx
    ✓ shows Invite Group, Invite Player and Share for the organiser
    ✓ hides them for a non-organiser
    ✓ hides them on a cancelled event
    ✓ Share opens the share sheet
    ✓ Invite Player posts invite-user for a picked user
    ✓ Invite Player posts invite-email for a picked email
Tests: 6 passed, 6 total
```
With the screen change stashed, 4 of 6 fail (organiser presence, share sheet, invite-user, invite-email), so the test does catch the regression.

Full suite (`npx jest`):
- Before (origin/main): `Test Suites: 15 failed, 114 passed, 129 total` / `Tests: 180 failed, 1391 passed, 1571 total`
- After: `Test Suites: 15 failed, 115 passed, 130 total` / `Tests: 177 failed, 1400 passed, 1577 total`
- The 15 failing suites are pre-existing and identical in both runs (stale assertions, e.g. `EventDetailScreen.test.tsx` still expects "Invite Individual" / "Share Event" and the old layout). I did not touch them. Full log: not committed.
- `npx tsc --noEmit`: clean. `npx eslint` on changed files: clean.

## Screenshots
**Not produced.** This cloud container has no Android emulator/device, so I could not run the app. Needs a run on a device.

## Deviations / items to confirm
1. **Visibility rule.** Brief says group invite is "organizer or group owner/admin". The pre-removal code gated *all* actions (Share, Invite Group, Invite Individual) on `isOrganiser` and not-cancelled/completed; it had no owner/admin check, and `Event` has no field telling the client whether the viewer owns/administers a group. I restored the pre-removal behaviour (organiser-only) and did not derive group-admin client-side. If non-organisers who own/admin a group should invite, the backend contract needs a capability field first — please confirm.
2. Share shown to organiser only (as before removal), not to participants.
3. Layout: current detail screen has no action-button card (edit/delete are banner icons), so I added a card of three buttons below Players; forms render inline in the same scroll, as before.
4. Branch: instructed `feat/game-restore-tournament-share-invite`; the session also designates `claude/game-tournament-share-invite-562t69`. I pushed to the latter (see below).
5. The repo clone was shallow; I ran `git fetch --unshallow` to reach `5f04b95`.

## Q5: accept/decline UI for game invitations
**None.** No code in `src` calls a respond/accept/decline endpoint for events (`src/api/events.ts` has only invite-group/user/email), no screen lists the user's pending game invitations, and no `?invite=` link handling exists (`RootNavigator.tsx` notes URL-scheme/App-Links deep linking is not built). Only the *sending* side exists. Relevant to Task B steps 5–6: game-equivalent deep link handling does not exist, so per the brief it would be reported, not built.

## Task B
Not started. It is gated on the meetup backend `tl-r1-p3-invitations` being merged, and I cannot confirm that: the `meetup` backend repo is not in this session's scope (only `pratheeshku/meetup-mobile`). I also have no confirmed route paths, and the brief says not to guess.
