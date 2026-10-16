# tournament-invite report

Branch: `feat/tournament-share-invite-respond`. Not merged.

## Files changed
- `src/api/tournaments.ts`: `inviteUserToTournament`, `inviteGroupToTournament`, `inviteEmailToTournament` (paths and bodies exactly per the contract: `/invite-user {user_id}`, `/invite-group {group_id}`, `/invite-email {email}`), each taking the caller's correlation id.
- `src/components/tournament/TournamentInvitePanel.tsx`: buttons by access level: **full** = Invite Group + Invite Player (+ Share); **individuals** = Invite Player (+ Share); none = nothing. Reuses the game patterns and components (`UserSearchPicker` with its email affordance, `OptionChips` group chooser, `getMyGroups`, `TextLink`, `Button`, `Card`). Group invite: one call per chosen group; individual: user or email through the same picker as games. One `withCorrelationId` per user action (a multi-group action shares one id). No email address is logged anywhere.
- `src/utils/tournamentInviteError.ts` (new): reads a failed call and returns `{status, code, message}`; accepts a string `detail`, a 422 array, or an object detail with `code`/`message`.
- Error handling: 4xx -> the server's own text (409 duplicate, 409/422 `INVITES_CLOSED`, 403 not allowed); a bare `INVITES_CLOSED` code with no text -> new label; **404 (feature flag off) hides the invite actions silently** (Share stays; nothing shown as broken); network/5xx -> the existing generic game invite messages. A group invite that adds nobody new shows a "already invited" note instead of "success".
- Tests: `src/screens/__tests__/TournamentInvite.test.tsx` (21), `src/api/__tests__/tournaments.test.ts` (invitation call paths/bodies/correlation id).
- Reused existing keys: `mob.game_detail.invite_group`, `invite_player`, `invite_group_select`, `send_group_invite`, `groups_loading`, `invite_group_sent_one/_other`, `invite_group_error`, `invite_choose`, `invite_sent`, `invite_error`, `mob.group_detail.send_invite`, `invitee_line`, `invite_by_email`, `mob.create_game.no_groups`, `mob.user_search.entity_player`, `mob.common.close`, `mob.common.change`.

New label keys (English text), added to the bundled `src/labels/defaultLabels.ts` only (required for `check:labels`); **nothing seeded** to the backend `ui_labels`:
- `mob.tournament.invite_group_hint` = "Select one of your groups to invite all its group members to this tournament."
- `mob.tournament.invite_player_hint` = "Search for and invite a player to this tournament."
- `mob.tournament.invite_group_none_new` = "Everyone in that group is already invited."
- `mob.tournament.invites_closed` = "Invitations are closed for this tournament."
- `mob.tournament.invited_banner_title` = "You're invited to this tournament"
- `mob.tournament.invited_accepted` = "You're invited"
- `mob.tournament.invite_accept` = "Accept"
- `mob.tournament.invite_decline` = "Decline"
- `mob.tournament.invite_respond_error` = "Could not send your response. Please try again."
- `mob.notif_pref.type_tournament_invited` = "Tournament invitations"
(For this task: invite_group_hint, invite_player_hint, invite_group_none_new, invites_closed.)

## Tests (raw)
```
TournamentInvite.test.tsx  Tests: 21 passed, 21 total
 buttons per access: full / individuals / none, null, undefined; picker not given an event-only filter
 invite-user, invite-email, invite-group (one call per group, one shared correlation id); new id per action; empty group result
 errors: 409 duplicate, INVITES_CLOSED (string, object, bare code), 422 list, 403, network, 404 hides actions, group 404
 logging: email never reaches the console, even on failure
```

## Checks
- `npm run check:labels`: OK - 211 files scanned, 954 default labels checked.
- `npx tsc --noEmit`: clean. `npx eslint` on all changed files: clean.
- Full suite: branch `Test Suites: 15 failed, 126 passed, 141 total` / `Tests: 177 failed, 1607 passed, 1784 total`; `origin/main` baseline `15 failed suites / 177 failed tests`. Failing-suite lists identical (diff empty). The branch adds 5 passing suites and the new tests below.
- No screenshots: no emulator/device in this container.

## Deviations / notes
1. **"Invite Individual" and "Invite by email" are one button, "Invite Player"**, exactly as on game detail: the picker takes a user or, via its email affordance, an email address. Both are available at both access levels.
2. Group invite for a viewer who only owns/administers a group is not built (OI-14); `individuals` access gets no group invite.
3. The picker is not given an exclude filter: `searchUsers` only has game/group/team excludes and no tournament one exists (not invented). Already-invited people can still be picked; the server's duplicate response is shown as text.
4. The exact error body shape for `INVITES_CLOSED` (string vs object, field names) is not documented in the repo, so the reader accepts the plausible shapes; verify against the live backend.
5. List/revoke invitations (GET `/tournaments/{id}/invitations`) is not in these tasks and was not built.
