# ud-p1-verify-mobile report (read-only, no code changed)

Repo `meetup-mobile`, branch `claude/busy-faraday-ir0umx`, HEAD `3a5565f`. Line numbers are from that commit.

## 0. Inputs that were not available (read first)

| Expected input | Status |
|---|---|
| `docs/agent-handoff-template.md` | Not in the repo. Not prepended. |
| `docs/DES-MEETUP-ADDENDUM-user-details-menu.md` v1.0 | Not in the repo. `docs/INDEX.md` does not list it. Design sections 8 (UM-T10), AD-6, AD-8, OI-6 and D-1 could not be read. |
| `~/meetup` (backend repo, brief `BRIEF-user-details-menu-backend-web.md`, card endpoints) | Not on this machine. `UserCardOut` and the card endpoints are unverified. |
| Board for the menu and details view | None in `docs/mockups/` (only `group-view/`) or `docs/design*`. Matches design OI-6. |

This report is code facts only, so it is complete for the questions asked. Everything marked **(assumption)** needs the design or the backend to confirm.

## 1. Person sites

Excluded as instructed: `HomeTopBar.tsx:127`, `DrawerMenu.tsx:248`.

Context is what the screen belongs to. "Id available" says whether the row data carries a user id the card call would need.

| # | File:line | What is shown | Context | Id available | Plain tap today (must stay) |
|---|---|---|---|---|---|
| 1 | `screens/GroupDetailScreen.tsx:664-671` | Member row: `UserAvatar` + `PersonNames`, role chip | group (`groupId`) | `member.user_id` | **Nothing.** The row `Pressable` (649) has only `onLongPress` (652, `delayLongPress` 350) and no `onPress`. |
| 2 | `GroupDetailScreen.tsx:484-491` | "Added" list after "+" in the invite panel | candidate, invited just now (group, **assumption**) | `invitee.id` | None. Row is a `View`; the only control is `UndoAddButton`. |
| 3 | `GroupDetailScreen.tsx:509-511` | Same list, invited by email | none (email, not a person) | no | None. Not a person with a card; recommend no menu. |
| 4 | `screens/EventDetailScreen.tsx:1313` | Going players, avatar only (name only in `name=`, not rendered) | game (`eventId`) | `p.user_id` | None. Wrapped in a `View` (testID `player-avatar`). |
| 5 | `EventDetailScreen.tsx:1412-1423` | Selected invitee in "Invite individual" | candidate (none, **assumption**) | `selectedInviteUser.id` | None. Only `AddRemoveControl` (unstage). |
| 6 | `screens/InviteMembersScreen.tsx:161-168` | Added people, group-create invite step | candidate (none, **assumption**; the group exists, `groupId` is used at line 142) | `user.id` | None. `UndoAddButton` only. Email chips (182) are not persons. |
| 7 | `screens/CreateGameScreen.tsx:1062-1069` | Invitee chip, create-game wizard | none (game not created yet) | `person.id` | None. `AddRemoveControl` unstage only. Email chips (1082) are not persons. |
| 8 | `components/UserSearchPicker.tsx:327-334` | Every search/suggestion result row (shared component) | none, per the brief ("search and suggested-player lists") | `user.id` | None on the row. Only the `AddRemoveControl` / `+` is tappable; the left part is `accessible` with a combined label. Used by GroupDetail (invite), EventDetail, CreateGame, InviteMembers, TournamentInvitePanel and others. |
| 9 | `components/tournament/TournamentInvitePanel.tsx:263-270` | Picked invitee | candidate (none, **assumption**) | `pickedUser.id` | None. `AddRemoveControl` unstage only. |
| 10 | `components/home/UnifiedCard.tsx:112-118` | 22 px preview avatars on game and group cards | none or game/group | **No.** `players_preview` (`types/event.ts:90`) and `members_preview` (`types/group.ts:46`) are `{display_name, photo_url}` only | The whole card is one `Pressable` (`onPress`, line 87) and opens the game or group. A long-press on a 22 px avatar nested inside it is a poor target. |
| 11 | `UnifiedCard.tsx:487-492` | Group owner name in text ("Owner: X") | group | `group.owner_id` exists on `Group` | Part of the card, so same tap as #10. Text, not an avatar. |
| 12 | `components/GroupCard.tsx:65-66` | Owner nickname in text | group | `owner_id` | Card tap. |
| 13 | `components/EventCard.tsx:137-163` | Organiser initials in a hand-drawn circle, plus a hard-coded second circle "RS" (allowlisted in `check-labels.allowlist.json`). Does not use `UserAvatar`. | game | `organiser_id` | Card tap. |
| 14 | `screens/TournamentDetailScreen.tsx:309` | "Organised by {nickname}" (text) | tournament | `organiser_id` | None. |
| 15 | `TournamentDetailScreen.tsx:433` | Registrations tab: `registration.nickname` as plain text, no avatar | tournament | `user_id` is `string \| null` (null for team registrations) | None. |
| 16 | `TournamentDetailScreen.tsx:418-421` | Fixture rows: `home_team` / `away_team` | not people (team names) | n/a | None. No person site. |

Checked, with no person site:
- `NotificationCard.tsx`: server-built title and body only. Its only long-press is the swipe toggle (test line 128). No avatar and no person field.
- `TournamentTeamsScreen.tsx` is a 45-line placeholder (title only).
- There are no separate fixture or result screens; fixtures live in `TournamentDetailScreen`.
- `GameRow.tsx`, `GroupRow.tsx`, `NextGameCard.tsx`: no person rendering. They go through `UnifiedCard`.
- `GroupMultiSelect.tsx` uses `getAvatarTint` for **group** names, not people.

Findings that affect `ud-mobile`:
1. **#10 cannot call a card.** The preview arrays have no user id. Needs a backend field, or home avatars stay out of scope. Owner decision.
2. **#15 has a nullable `user_id`.** Team registrations have none. They need "no menu", or a different context.
3. **Candidate rows (#2, #5, #6, #7, #9) and search rows (#8)** are not members of the entity yet. The brief says search and suggested lists use context `none`. The same reading is the safe one for the staged and just-added rows, but the design is not available to confirm. Owner decision.
4. **Text-only sites (#11-#14)** are in the brief's "name in text" scope. A long-press on a name inside a card that is itself a `Pressable` conflicts with the card tap. Owner decision before building.
5. **#13 duplicates avatar logic** instead of using `UserAvatar`, and has the hard-coded "RS". Migrating it also removes that allowlist entry.
6. **#3, #6 email and #7 email chips** are not persons.

## 2. `GroupDetailScreen` member actions today

State: `cardMember` (120), `memberError` (121). The card opens on `onLongPress={() => setCardMember(member)}` (652). `MemberActionCard` is rendered at 703-710 with `actions={cardMember ? buildActions(cardMember) : []}`.

Rights, all computed on the client (`group.members` + `currentUserId`, because the backend `GroupResponse` has no `current_user_role`; see the audit comment at 371):

| Item | Line | Logic | Remove in `ud-mobile`? |
|---|---|---|---|
| `currentUserRole` | 375 | role of the signed-in user found in `members`, else `'none'` | Only if nothing else uses it. It also feeds `canInvite` (378) and `canLeave` (382). |
| `isOwner` | 376 | `currentUserRole === 'owner' \|\| group.owner_id === currentUserId` | **Keep.** Also drives the Edit/Delete icons (558), `canLeave` and `buildActions`. Not member-menu logic. |
| `canInvite` | 378 | owner or admin | **Keep.** Share/Invite buttons. Out of scope. |
| `canChangeRoles` | 380 | owner or admin | **Remove.** |
| `canRemoveMembers` | 381 | owner or admin | **Remove.** |
| `canLeave` | 382 | not owner and role not `'none'` | **Keep.** |
| `buildActions(member)` | 399-447 | `actionable = member.user_id !== currentUserId && member.role !== 'owner'`. Then: **role** if `canChangeRoles` (label `action_demote` if the member is admin, else `action_make_admin`; icons `ShieldMinusIcon` / `ShieldPlusIcon`); **owner** if `isOwner` (`action_make_owner`, `OwnerIcon`); **remove** if `canRemoveMembers` (`action_remove`, destructive, `PersonMinusIcon`). Each closes the card first. | **Remove.** The server's `allowed_actions` replaces this. |

Handlers and the `src/api` calls (all in `api/groups.ts`):

| Handler | Line | Confirmation | API call | After success | On error |
|---|---|---|---|---|---|
| `handleChangeRole` | 259-271 | none | `updateMemberRole(groupId, userId, nextRole, {correlationId})` = `PATCH /groups/{id}/members/{user}` (api line 387-394); `nextRole` = admin→member, else admin | `getGroup(groupId, {correlationId})` inside the same `withCorrelationId` and `setGroup`; then `goToDashboard(t('mob.success.group_updated'))` | `memberError` = `mob.group_detail.role_error` (no 404 handling) |
| `handleRemoveMemberPress` | 286-299 | `Alert.alert` with `remove_title`, `remove_message {name}`, `mob.common.cancel`, destructive `mob.common.remove` | via `handleRemoveMember` (273-284) | same refetch, then `goToDashboard(t('mob.success.group_updated'))` | `memberError` = `remove_error` (no 404 handling) |
| `handleRemoveMember` | 273-284 | n/a | `removeMember(groupId, userId, {correlationId})` = `DELETE /groups/{id}/members/{user}` (api line ~405) | as above | as above |
| `handleMakeOwnerPress` | 314-326 | `Alert.alert` with `group_transfer.confirm_prompt {name}`, `confirm_message`, cancel, `confirm_button` (not destructive) | via `handleMakeOwner` (301-312) | | |
| `handleMakeOwner` | 301-312 | n/a | `transferGroupOwnership(groupId, userId, {correlationId})` = `POST /groups/{id}/transfer-ownership` (api line 484-490) | refetch, then `goToDashboard(t('mob.group_transfer.success'))` | `memberError` = `group_transfer.error` |

Other callers of the same API in this file, which stay: `inviteMember` (207), `removeMember` for undo (227) and leave (335), `createGroupInvitation` (251), `getGroup` (138).

Behaviour drift against the new brief, to confirm with the owner:
- **All three actions leave the screen today** (`goToDashboard(...)`). The brief says "refresh the host and show `action_done`". These conflict.
- **No 404 handling** on member actions today. The brief requires the AD-8 close-with-notice (`useUnavailableScreen.onNotFound`, already wired for the detail fetch at 143).
- **The card fetch and the action share one correlation id** per the brief. Today the correlation id covers only the action and its refetch.
- Today **a member sees the card with no actions**, but a plain Group member can still open it. Under D-1 it would open View Details.

## 3. Labels

How `npm run check:labels` works (`scripts/check-labels.js`, uses the TypeScript compiler API; CI is `.github/workflows/label-scan.yml`):
- Scans `src/**` and `App.tsx`. Test files, `__tests__/` and `src/test-utils/` are excluded by regex.
- Fails on (a) hard-coded customer text in JSX text, props `title/label/placeholder/accessibilityLabel/accessibilityHint/subtitle/message/description`, `Alert.alert` and toast arguments; (b) a key used via `t`, `getLabel`, `currentT`, `bundledT` or a `mob.*` literal with no entry in `src/labels/defaultLabels.ts` or `BASE_LABELS` in `fallbackLabels.ts`; (c) a banned term from `docs/glossary.json` (`banned[]`, regex) in a default label **value**.
- Exclusions live only in `scripts/check-labels.allowlist.json`, each with a reason.
- **It does not read `docs/label-inventory-mobile.json`.** The inventory is a documentation mirror (`defaultLabels.ts` header line 8): 530 entries `{key, defaultText, screen, placeholders, status}`. Keys there do not carry the `mob.` prefix.

Drift: brief step 6 says "add them to the mobile label inventory", but that file is under `docs/`, which the hard rules say not to edit. The check passes with `defaultLabels.ts` alone. Needs an owner ruling (edit the inventory, or leave it for the owner).

Existing keys reusable for the AD-6 set (AD-6 itself is unread):

| Need | Existing key | Text |
|---|---|---|
| Make admin | `mob.group_detail.action_make_admin` | Make admin |
| Demote | `mob.group_detail.action_demote` | Demote |
| Make owner | `mob.group_detail.action_make_owner` | Make owner |
| Remove from group | `mob.group_detail.action_remove` | Remove from group |
| Remove confirm | `mob.group_detail.remove_title`, `remove_message {name}`, `mob.common.remove`, `mob.common.cancel` | |
| Make owner confirm | `mob.group_transfer.confirm_prompt {name}`, `confirm_message`, `confirm_button` | |
| Role/remove/transfer errors | `mob.group_detail.role_error`, `remove_error`, `mob.group_transfer.error` | |
| Success | `mob.success.group_updated`, `mob.group_transfer.success` | |
| Roles | `mob.group_role.owner / admin / member` | |
| a11y/hint | `mob.group_detail.member_card_a11y {name}`, `member_row_hint` ("Long-press for details") | |
| Notice for 404 | `mob.access.no_longer_available` | This is no longer available. |
| Close, generic errors | `mob.common.close`, `mob.errors.server`, `mob.errors.forbidden`, `mob.errors.network` | |

Not present, so the backend seed must supply them: `no_nickname`, `action_done`, a "View Details" label, any "Request ..." labels, and game or tournament actions. A grep for `no_nickname`, `action_done` and `view_details` in `defaultLabels.ts` returned nothing. Check the exact key names against the backend seed before adding. The glossary terms ("Group member", "Player", "Team player") apply to the labels.

## 4. `MemberActionCard` and its tests

- Production use: only `GroupDetailScreen.tsx:47` (import) and `703-710` (render). It exports the `MemberAction` type, also used by `buildActions` in the same file. Nothing else imports it.
- Mentioned in `src/labels/defaultLabels.ts` only through the `member_card_a11y` key. No doc besides `docs/mockups/group-view/2-long-press-member.png` references it.
- It renders its own `Modal` with `UserAvatar` (96 px) + `PersonNames large centered`, then one `Pressable` row per action, with a 28×28 fixed icon box (`actionIcon`). It uses `groupView.*` theme tokens.
- `PersonNames` has a `large` prop commented "for the long-press member card".

Tests:
- `src/screens/__tests__/GroupDetailMembers.test.tsx` (describe blocks at lines 97, 131, 161): the `long-press card` block (line 161 to about 240) asserts the old behaviour: per-role action lists, display name above nickname on the card, no actions for self or owner, plain Group member sees a card with no actions, confirmations for Remove and Make owner, and `updateMemberRole` for Make admin. The helpers at lines 79-91 (`memberRows`, `rowFor`, `longPress`, `hasAction`, `shownActions`, `ACTIONS`) find rows by `onLongPress` + `accessibilityLabel`. The `member order` and `member row` blocks (97-160) do not touch the card, but `memberRows` locates rows by `onLongPress`, so those depend on the new `UserPressable` exposing the same props. All of this needs rewriting for UM-T10.
- `src/screens/__tests__/GroupDetailScreen.test.tsx`: **does not reference the card or long-press.** It covers the invite panel and share link (mocks `removeMember`, `transferGroupOwnership`, `updateMemberRole`). The brief's "update the existing group detail tests that asserted the old card" applies to `GroupDetailMembers.test.tsx` only; this file needs at most the mock updates for the new card API.
- Other tests that render sites from section 1 and may need touching when migrated: `EventDetailPlayers.test.tsx`, `EventDetailScreen.test.tsx`, `InviteMembersScreen.test.tsx`, `UserSearchPicker.test.tsx`, `TournamentInvite.test.tsx`, `CreateGame*.test.tsx`, `InviteSearchConsistency.test.tsx`, `DetailGroupRow.test.tsx`. Not opened, so impact is unknown.

## Blockers for `ud-mobile` (summary)

1. Design addendum, handoff template, backend brief and the card endpoints are not available here. They must be supplied.
2. No board for the menu and details view (OI-6). The brief says STOP.
3. `ud-backend` deployment is unconfirmed.
4. Owner decisions listed in section 1 (home preview avatars without ids, null `user_id` in tournament registrations, candidate-row context, text-only sites, the card-tap conflict), plus the two drifts in section 2 and the label inventory in section 3.

No commands were run beyond reading; `npx jest`, `tsc`, lint and `check:labels` were not run because no code changed. Stopped as instructed.
