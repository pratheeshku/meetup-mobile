# invite-search-unified report

Branch: `fix/invite-search-unified` (from `origin/main` @ d982491).

Principle implemented: ONE player search field everywhere (`UserSearchPicker`). A name adds that person; a valid email that matches nobody shows the picker's existing "Invite <email> as new <entity>" button; anything else shows no email button. No separate email input remains anywhere. `UserSearchPicker`'s matching rules are unchanged.

## Files changed
- `src/components/UserSearchPicker.tsx`: new optional `belowInput?: ReactNode` slot rendered directly under the text field, above the results. Existing callers unaffected.
- `src/screens/CreateGameScreen.tsx` (Task 2): removed the custom player search, suggestion list, toggle code, the separate "Invite by email" input and all their state, validation and styles. Step 6 renders `UserSearchPicker` (`onSelect` adds a person, `onSelectEmail` adds an email with case-insensitive de-duplication, `excludeUserIds` hides added people from suggestions, `belowInput` = the chips with remove controls). The create/submit logic is unchanged (see deviation 1).
- `src/screens/InviteMembersScreen.tsx` (Task 3): custom `searchUsers` search and suggestion list replaced by `UserSearchPicker` (`suggestionContext="group_members"`, `excludeGroupId`, `excludeUserIds`, `onSelectEmail`). A tapped person is invited with `inviteMember` as before; a tapped email is invited with `createGroupInvitation(groupId, { invitedEmail })`, the same call Group Detail uses. The "added" card moved into the picker's `belowInput` slot and also lists invited emails; the completion row counts both.
- `src/labels/defaultLabels.ts`: removed the 5 now-unused keys I added earlier for the separate email input (`mob.create_game.invite_email_label/_placeholder/_add/_invalid/_duplicate`).
- Tests (new/rewritten): `CreateGameEmailInvites.test.tsx` (11), `CreateGameInviteeList.test.tsx` (6), `CreateGameInviteeVisibility.test.tsx` (3), `CreateGameOptionalInvites.test.tsx` (updated), `InviteMembersScreen.test.tsx` (9, new), `InviteSearchConsistency.test.tsx` (6, new), `src/test-utils/createGameHarness.tsx` (picker helpers).

## Task 3 precondition (group exists at step 2): confirmed
`CreateGroupScreen` calls `createGroup(...)` (and uploads the logo) in step 1 and only then `navigation.replace('InviteMembers', { groupId: created.id })`. The group already exists on the server at step 2 (the old screen already called `inviteMember(groupId, ...)` there), so an email invite via `POST /groups/invitations` is possible. No new endpoint.

## Task 4 consistency check (by reading the code)
- `EventDetailScreen` (line ~1395): `UserSearchPicker` with `onSelectEmail`; its other `TextInput`s are edit-form fields (title, venue search, court details), no email field.
- `TournamentInvitePanel` (line ~285): `UserSearchPicker` with `onSelectEmail`; no other input.
- `GroupDetailScreen` (line ~496): `UserSearchPicker` with `onSelectEmail`, `excludeUserIds`, `suggestionContext="group_members"`; no other input.
- No fix was needed. Added `InviteSearchConsistency.test.tsx` (real picker, Game Detail and Tournament Detail): one search field, no email-keyboard input, valid email with no match shows the button and selects that email, non-email shows none.
- Difference that is by design and unchanged: on the three detail screens a picked email/person is a pending selection sent with "Send Invite"; on Create game and Group create step 2 it is added immediately to the chips / invited at once.

## Tests (raw)
```
npx jest (new/changed suites)
 CreateGameEmailInvites 11, CreateGameInviteeList 6, CreateGameInviteeVisibility 3, CreateGameOptionalInvites 3,
 CreateGameDuration 14, InviteMembersScreen 9, InviteSearchConsistency 6, UserSearchPicker (existing) all pass
```
Covered: typing a name shows suggestions and adds a chip (and the person leaves the suggestions); a valid email with no match shows the Invite button and tapping it adds a chip; non-email strings (`not-an-email`, `zzz`, `a@b`, `@example.com`) show no button; a valid email that matches a person shows the person, not the button; duplicate email in a different case added once; remove works for people and emails; exactly one `inviteEmailToEvent` call per email chip after create (created event id, same correlation id as create, none for removed chips); partial failures listed; no email in logs; exactly one text input and no "Invite by email" input on step 6; group create: name search -> `inviteMember`, email -> `createGroupInvitation({ invitedEmail })`, same email twice -> one call, failure message, completion count.

## Checks
- `npm run check:labels`: OK - 211 files scanned, 949 default labels checked.
- `npx tsc --noEmit`: clean. `npx eslint` on all changed files: clean.
- Full suite: branch `Test Suites: 15 failed, 128 passed, 143 total` / `Tests: 177 failed, 1630 passed, 1807 total`; `origin/main` baseline `15 failed suites / 177 failed tests`. Failing-suite lists identical (diff empty).
- No screenshots: no emulator/device in this container.

## New label keys
None. Reused `mob.user_search.invite_email_title/_a11y/_hint`, `mob.user_search.entity_player`, `mob.create_game.search_players_placeholder`, `mob.invite.*` (including `add_error`, `added_pill`).

## Deviations / notes
1. **Invite-for-all-visibilities is not on main.** The brief says to keep that behaviour if already on main and describes the current build as sending `invite_user_ids` for all visibilities. On main today, the invitee UI and the payload (`invite_user_ids` and the email calls) are **invite-only** only (owner decision on 2026-10-16: "hide unless invite-only"). I kept exactly that behaviour and only swapped the search UI; no payload or visibility change. If public/group games should also show the picker and send invites, it is a small follow-up (show the picker for all visibilities and drop the `gVisibility === 'invite_only'` conditions in `handleSubmit`), but it also needs the backend to accept `invite_user_ids` for those games, which I did not verify.
2. TASK 1 (duration on the same row) was referenced as "unchanged and independent" but is not described in this brief, so it was not touched.
3. On Create game / Group create step 2 the picker button label for a person is the shared "Invite" (existing key), not "+".
4. Group create: an email invite is sent immediately when the button is tapped (the screen invites people immediately too), rather than staged behind a Send button as on Group Detail.
