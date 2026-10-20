# ud-mobile report

Task: ud-mobile (user details menu, mobile). Design: `docs/DES-MEETUP-ADDENDUM-user-details-menu.md` v1.4. Board: `docs/mockups/user-menu/user-menu-board.png` and `.html`. Basis: `docs/reports/ud-p1-verify-mobile-report.md`. Branch `claude/upbeat-lovelace-lnblk2`, restarted from `origin/main` (45a7109) because the earlier work on this branch was already merged (PR #40). No design doc edited, no version chosen.

`docs/agent-handoff-template.md` is not in this repo; I proceeded without it and nothing was prepended.

Status: implemented. Not self-certified: no emulator, so no screenshots (see section 6); several points where the board and the data disagree are listed in section 4 for the owner.

## 1. What was built
- `src/components/user/UserMenuSheet.tsx`: the menu (person header, View Details first, then only the server's actions; destructive in the error tone; loading row while the card loads), the details view ("Details", Close, 88 px picture via `sizes.avatar`, display name, nickname or the "No nickname" label in muted text), the confirmation dialog (title, body, Cancel, Yes) and the notice toast (shown above the sheet while it is open). Reuses `UserAvatar`. `MemberActionCard` is removed (`git rm`); `buildActions`, `canChangeRoles`, `canRemoveMembers`, `handleChangeRole`, `handleRemoveMember*`, `handleMakeOwner*` and the `memberError` state are removed from `GroupDetailScreen`. `isOwner`, `canInvite` and `canLeave` stay (they drive Edit/Delete, Invite and Leave, not the member menu).
- `src/hooks/useUserMenu.ts`: context `{type: group|game|tournament|none, id}`; opens (`openDetails` for tap, `openMenu` for long-press); fetches the card on every open of the menu (no cache; latest open wins; 10 s timeout counts as failure); the action registry (key to label key, icon, tone, confirm flag, handler); the confirmation; execution through existing `src/api` (`updateMemberRole`, `transferGroupOwnership`, `removeMember`) and the new `removeEventPlayer`; `onChanged` for the host refetch. The card fetch and the action share one correlation id (generated once per open, passed to both; `withCorrelationId`'s generator is used, `generateCorrelationId`).
- `src/components/user/UserPressable.tsx`: avatar plus name wrapper, `onPress` = View Details, `onLongPress` = menu, `delayLongPress` 350. Props `tap="none"` (long-press only) and `longPress={false}` (tap only).
- API: `getGroupMemberCard` (`src/api/groups.ts`), `getEventPlayerCard` and `removeEventPlayer` (`src/api/events.ts`, `DELETE /events/{id}/participants/{user_id}`, optional `reason` query, returns the participant row). Types `UserCardOut`, `AllowedAction`, `UserIdentity`, `UserMenuContext` in `src/types/userMenu.ts`. `user_id?: string` added to `players_preview` and `members_preview` types.
- Labels: the 22 `mob.user_menu.*` keys with the AD-6 texts in `src/labels/defaultLabels.ts` (`check:labels` passes). `docs/label-inventory-mobile.json` untouched; `mob.group_detail.action_*` untouched.

## 2. Behaviour (items 4 and 5)
- View Details shows at once from the row identity. Actions appear only after a successful card fetch; a failed or slow fetch leaves View Details only and shows "Could not load options.". Unknown action keys are ignored, as are keys that do not belong to the context (a game key in a group menu and the reverse) and any action with `requires_approval: true` (dropped fail-closed at runtime; v1 never sends one).
- 404 from the card: the menu closes, the existing "no longer available" notice shows (`showAccessNotice`), the host refetches (`onChanged`). 404 from an action: the same. Any other refusal: the server's message (or "Could not complete this action. Please try again."), the host refetches. Success: the sheet closes, "Done" shows, the host refetches. The screen no longer leaves to the dashboard after a member action (the old behaviour; the brief says refresh and show `action_done`).
- Own avatar and context `tournament` / `none` and a person without a user id: View Details only, no card request.
- Confirmation (owner decision, section 4.1): all five actions (`make_admin`, `remove_admin`, `make_owner`, `remove_from_group`, `remove_player`) ask first, using `mob.user_menu.confirm_body_<action>`.

## 3. Sites migrated (every site on the verify list)
| Verify # | Site | Context | Tap | Long-press |
|---|---|---|---|---|
| 1 | `GroupDetailScreen` member rows (replaces PR #39; first) | group | View Details | menu with server actions |
| 2 | `GroupDetailScreen` Added list (people) | none | View Details | View Details only |
| 3 | email rows on Group detail, Invite members, Create game | not persons | n/a | n/a |
| 4 | `EventDetailScreen` going-players avatars | game | View Details | menu with server actions (`remove_player`) |
| 5 | `EventDetailScreen` picked invitee | none | View Details | View Details only |
| 6 | `InviteMembersScreen` Added people | none | View Details | View Details only |
| 7 | `CreateGameScreen` invitee chips | none | View Details | View Details only |
| 8 | `UserSearchPicker` result rows (also used by 5, 6, 7, 9) | none | none (the row's "+" selects) | View Details only |
| 9 | `TournamentInvitePanel` picked invitee | none | View Details | View Details only |
| 10 | `UnifiedCard` 22 px avatars (game and group cards) | none | View Details, stops the card tap | none (tap only) |
| 15 | `TournamentDetailScreen` registrations (new avatar) | tournament | View Details | View Details only |
| UM-12 | group owner on Group detail | group | same as #1 | same as #1 |
Group owner on `GroupDetail`: that screen has no separate owner line; the owner is a member row, so it is covered by #1 (with the Owner chip).

Deferred, not blocked (data missing; no field invented; a follow-up backend task adds the fields, the UM-06 tap rule then applies): game organiser, tournament organiser (`TournamentDetailScreen` "Organised by" text, `EventDetailScreen` organiser), group owner on home cards (`UnifiedCard` "Owner:" text and `GroupCard` owner nickname), `EventCard` organiser circle (also still has the hard-coded "RS" circle, allowlisted). Not touched: `HomeTopBar`, `DrawerMenu`. Checked, no person site: fixture rows (team names), `NotificationCard`, `TournamentTeamsScreen`.

## 4. Questions and deviations for the owner
Owner decisions (recorded after review):
1. **Confirmation: all five confirm.** `make_admin`, `remove_admin`, `make_owner`, `remove_from_group` and `remove_player` each ask first, with the existing `confirm_body_<action>` labels from the design. (The first version asked only for the destructive ones and Make owner.) All five `confirm_body_*` keys are now used.
2. **Nickname on home-card avatars: deferred to a backend field.** `AvatarPreview` carries `display_name`, `photo_url`, `user_id` only. Board M7 shows a nickname ("Mei"); until the field exists the nickname line is left out (no false "No nickname").
3. **"No linked user": deferred to a label seed.** Board M8 shows it under a tournament registration with no user id; no seeded label exists, so it is not rendered. Tournament registrations carry only a nickname, shown as the name with no nickname line; the placeholder is the app's initials circle ("?" when empty), not the board's smiley glyph.
4. **Game screen stays as built; the board M4 redesign is a separate task.** Today `EventDetailScreen` draws only avatars of the going players (no names or status rows, no waitlisted, no organiser line). The menu is attached to those avatars. So `remove_player` on a waitlisted player cannot be reached from the UI until that task.

Other deviations:
5. **Board captions not rendered.** "Picture, display name and nickname only. Nothing else is shown." has no AD-6 key; it is a board note, not UI text.
6. **A 404 on a member action** used to keep an inline error and stay on the screen (ac-m-followup-fix). Per AD-5 it now closes the menu with the neutral notice and refetches the group; the screen closes only if that refetch also returns 404. `AccessActionNotFound.test.tsx` was updated for this.
7. **Selectable rows.** `UserSearchPicker` rows have no row-level tap since the AD-19 change (the "+" control is the action), so the avatar and name get long-press only and a tap on them does nothing, as before.
8. **Accessibility.** The 22 px avatars sit inside the card's own accessible `Pressable`, so a screen reader does not reach them separately. Accepted by the design (OI-12 covers the small target); flagged here.
9. Unused keys left in place: `mob.user_menu.not_available` (the 404 notice uses the existing `mob.access.no_longer_available`, same text), `mob.group_detail.member_card_a11y`, `member_row_hint`, `action_*`.
10. `removeEventPlayer` accepts the optional `reason` but no screen sends one.

## 5. Tests (UM-T10, T12)
New: `src/components/user/__tests__/UserMenu.test.tsx` (tap opens View Details with no card request and does not trigger the row; long-press menu with View Details first; selectable rows long-press only; 22 px tap only; 350 ms; loading state; card failure; slow card timeout; 404 closes with the notice and refetch; unknown and approval and wrong-context keys ignored; own avatar and `is_self`; tournament and none contexts and no-user-id make no card request; no cache; No nickname label; confirmations; role, owner, remove and remove-player calls with the card's correlation id; refusal message; 404 on action; double tap runs once), `UnifiedCardAvatars.test.tsx`, `TournamentRegistrationsMenu.test.tsx`, and added cases in `EventDetailPlayers.test.tsx` and `UserSearchPicker.test.tsx`. Rewritten for the new behaviour: `GroupDetailMembers.test.tsx` (the old card block) and the three member-action cases in `AccessActionNotFound.test.tsx`. `npm run check:labels` passes (UM-T12).
Note: during development I ran jest on the changed suites more than once to fix my own failures (a first full run had 20 failing suites: 14 baseline plus 6 of mine, all fixed). The numbers below are the one full run on the final code commit and one on the parent.

Suites touched by this task, final commit:
```
PASS src/components/__tests__/UserSearchPicker.test.tsx
PASS src/components/home/__tests__/UnifiedCardAvatars.test.tsx
PASS src/components/user/__tests__/UserMenu.test.tsx
PASS src/screens/__tests__/AccessActionNotFound.test.tsx
PASS src/screens/__tests__/EventDetailPlayers.test.tsx
PASS src/screens/__tests__/GroupDetailMembers.test.tsx
PASS src/screens/__tests__/TournamentRegistrationsMenu.test.tsx
```

## 6. Raw output (run from `cd /home/user/meetup-mobile && pwd`; logs not committed, summaries pasted)
Final commit 05609b8 (`npx jest --coverage --coverageReporters=text-summary`):
```
Statements   : 76.59% ( 6478/8458 )
Branches     : 66.01% ( 4093/6200 )
Functions    : 74.98% ( 1646/2195 )
Lines        : 76.83% ( 6243/8125 )
Test Suites: 14 failed, 163 passed, 177 total
Tests:       167 failed, 2058 passed, 2225 total
Time:        27.679 s, estimated 36 s
exit 1
```
Parent `origin/main` 45a7109, separate git worktree (`git worktree add <dir> origin/main`, node_modules symlinked):
```
Statements   : 76.14% ( 6339/8325 )
Branches     : 65.7% ( 4013/6108 )
Functions    : 74.58% ( 1626/2180 )
Lines        : 76.38% ( 6108/7996 )
Test Suites: 14 failed, 160 passed, 174 total
Tests:       167 failed, 2020 passed, 2187 total
Time:        42.114 s
exit 1
```
Coverage delta (final minus parent): statements 76.14% to 76.59% (+0.45), branches 65.70% to 66.01% (+0.31), functions 74.58% to 74.98% (+0.40), lines 76.38% to 76.83% (+0.45).

Failing suites side by side:

| Suite | Final | Parent |
|---|---|---|
| `__tests__/AppForceUpdate.test.tsx` | FAIL | FAIL |
| `config/__tests__/appConfig.test.ts` | FAIL | FAIL |
| `src/assets/__tests__/headerIcon.test.ts` | FAIL | FAIL |
| `src/components/__tests__/ForceUpdateGate.test.tsx` | FAIL | FAIL |
| `src/components/__tests__/keyboardInventory.test.ts` | FAIL | FAIL |
| `src/components/home/__tests__/homeComponents.test.tsx` | FAIL | FAIL |
| `src/screens/__tests__/CreateGameScreen.test.tsx` | FAIL | FAIL |
| `src/screens/__tests__/EventDetailScreen.test.tsx` | FAIL | FAIL |
| `src/screens/__tests__/HomeScreen.test.tsx` | FAIL | FAIL |
| `src/screens/__tests__/ProfileScreen.test.tsx` | FAIL | FAIL |
| `src/screens/__tests__/ProfileScreenLinks.test.tsx` | FAIL | FAIL |
| `src/screens/__tests__/ProfileScreenReportRow.test.tsx` | FAIL | FAIL |
| `src/screens/__tests__/ProfileScreenTerms.test.tsx` | FAIL | FAIL |
| `src/utils/__tests__/shareLink.test.ts` | FAIL | FAIL |

Suites that fail on the final commit and not on the parent: **none**. Failing test titles on the final commit that do not fail on the parent: none (compared by title). The 14 failing suites are the same ones the brief names as not mine (missing PNG assets in this checkout, stale labels such as "Invite Individual", Profile, ForceUpdate, config).

`npx tsc --noEmit`: exit 0, no output.
`npm run lint`: final `32 problems (31 errors, 1 warning)`, parent `32 problems (31 errors, 1 warning)`; same files on both, none changed by this task:
```
jest.setup.js
scripts/check-labels.js
src/components/__tests__/NotificationCard.test.tsx
src/components/icons/__tests__/RegistryIcons.test.tsx
```
`npm run check:labels`:
```
check-labels: OK - 234 files scanned, 1034 default labels checked.
```
Screenshots: not produced. This sandbox has no Android emulator or iOS simulator, so no screenshot next to the board; the sheet follows the board's structure and the token sizes (88 px picture, 48 px rows, 28 px icon boxes), but I could not compare pixels.

## 7. Git evidence
Branch `claude/upbeat-lovelace-lnblk2` from `origin/main` 45a7109. Commits: `ud-mobile: user details menu ...`, `ud-mobile: update tests for the new menu behaviour` (code, 05609b8), then this report. `git rm src/components/groups/MemberActionCard.tsx`. No secrets, no `docs/` edit other than this report, no change to `HomeTopBar` or `DrawerMenu`.
