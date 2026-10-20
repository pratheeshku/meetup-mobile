# ud-mobile report

Task `ud-mobile`, design `DES-MEETUP-ADDENDUM-user-details-menu` v1.4, board `docs/mockups/user-menu/user-menu-board` (read from `origin/docs/user-details-menu-v1.0-approved`; not in this working tree). Branch `claude/busy-faraday-ir0umx`, code commit `763c774` on top of `6968f98`. No `docs/` file edited except this report. Stopped after the report.

## 1. What was built

| Brief item | Where |
|---|---|
| Menu and details view (absorbs `MemberActionCard`, which is deleted) | `src/components/user/UserMenuSheet.tsx`, served by `src/components/user/UserMenuHost.tsx` (mounted once in `RootNavigator`, next to `AccessNoticeToast`) |
| Hook: opening, card fetch on every menu open, registry, confirmation, execution, `onChanged` | `src/hooks/useUserMenu.ts` (opener + request store), `src/hooks/useUserMenuEngine.ts` (engine), `src/hooks/userMenuActions.ts` (registry) |
| `UserPressable`: tap = View Details, long-press (350 ms) = menu; `tap={false}` for selectable rows, `longPress={false}` for 22 px avatars | `src/components/user/UserPressable.tsx` |
| Card calls typed `UserCardOut` | `getGroupMemberCard` (`api/groups.ts`), `getEventPlayerCard` (`api/events.ts`), `src/types/userCard.ts` |
| `remove_player` | `removeEventParticipant` (`api/events.ts`): `DELETE /events/{id}/participants/{user}`, optional `reason` query |
| 22 labels | `mob.user_menu.*` in `src/labels/defaultLabels.ts`, texts exactly as design AD-6. `label-inventory-mobile.json` untouched; old `mob.group_detail.action_*` keys left in place |
| Client rights logic removed | `canChangeRoles`, `canRemoveMembers`, `buildActions`, `handleChangeRole`, `handleMakeOwner(Press)`, `handleRemoveMember(Press)`, `cardMember`, `memberError` deleted from `GroupDetailScreen`. `isOwner`, `canInvite`, `canLeave` stay (Edit/Delete icons, invite, leave; not member-menu logic) |

Behaviour implemented (design AD-5, UM-06):
- Menu open: View Details shows at once from the row identity. For a group or game person other than the viewer, the card is fetched (new request every open, 8 s timeout, correlation id from `withCorrelationId`). Actions appear only after success.
- Card failure or timeout: View Details only, plus the `card_load_failed` message over the sheet.
- Card 404, or an action 404: menu closes, existing `showAccessNotice()` ("This is no longer available."), host screen refetches via `onChanged`.
- Actions: only keys in the registry for that context, taken from `allowed_actions` in server order. Unknown keys and keys from the other context are ignored. `is_self` or the viewer's own id: no actions, no card request.
- Contexts `tournament` and `none`, and a person with no id: no card request, View Details only.
- Every action asks for confirmation first (AD-6 defines a confirm body for all five). Success: close, "Done" toast, host refresh. Refusal: the server's message (generic `action_failed` for 5xx and network), host refresh. The action reuses the card fetch's correlation id.

## 2. Sites migrated

| Site | Context | Behaviour now |
|---|---|---|
| `GroupDetailScreen` member rows (first) | group, `groupId` | tap picture or name: View Details; long-press: menu. Row has no other tap (as before). Role chip stays outside the pressable. `onChanged` refetches the group silently |
| `GroupDetailScreen` Added list (invitees) | none | tap and long-press, View Details only |
| `EventDetailScreen` going-player pictures | game, `eventId` | tap and long-press; `onChanged` refetches the game |
| `EventDetailScreen` selected invitee | none | tap and long-press |
| `InviteMembersScreen` added people | none | tap and long-press |
| `CreateGameScreen` invitee chips | none | tap and long-press |
| `UserSearchPicker` rows | none | picture long-press only (`tap={false}`); selection stays on the `+` control |
| `TournamentInvitePanel` picked user | tournament | tap and long-press, View Details only |
| `UnifiedCard` preview avatars (22 px) | none | tap only, View Details, no card request; `user_id` typed on `players_preview` and `members_preview`; a tap does not open the card |
| `TournamentDetailScreen` registrations (UM-12) | tournament | new 40 px avatar beside the nickname. With `user_id`: initials avatar. Without: placeholder avatar (new `person` fallback in `UserAvatar`) and nickname. View Details only, no card request |

Unchanged as instructed: `HomeTopBar`, `DrawerMenu`. Email-only rows (not persons) have no menu.

### Deferred (UM-12 phasing, design OI-11): not touched, not blocked
- Game organiser line and the `EventCard` organiser circle.
- Tournament organiser line ("Organised by").
- Group owner on home cards (`UnifiedCard` owner text) and `GroupCard` owner text.
- Note on "group owner on `GroupDetail`": that screen has no separate owner line. The owner is already a member row (first row, with the Owner chip) and gets the standard tap/long-press there. I did not add a new owner line.

## 3. Tests (UM-T10, UM-T12)

New: `src/components/user/__tests__/UserMenu.test.tsx` (23), `UserMenuSites.test.tsx` (5), `src/api/__tests__/userMenuApi.test.ts` (3). Updated: `GroupDetailMembers.test.tsx` (old card assertions replaced; 16 pass), `AccessActionNotFound.test.tsx` (3 old member-action 404 tests rewritten for the new flow: notice shows, group refetched, screen stays), `EventDetailPlayers.test.tsx` (+2, game context). `GroupDetailScreen.test.tsx` needed no change.

UM-T10 coverage: avatar tap opens View Details and does not fire the row or card action; selectable rows keep tap-to-select (`tap={false}`); long-press opens the menu; View Details first; no actions on card failure; 404 closes with the notice and refetches; unknown key ignored; own avatar View Details only; tournament and none contexts make no card request; `requires_approval` dropped. Label check passes (section 4).

## 4. Raw output

`npx jest --coverage`, full suite, with my changes:
```
            <Text numberOfLines={1} style={styles.skillSportName}>
                      <Text numberOfLines={2} style={styles.groupName}>
                          <Text numberOfLines={1} style={styles.gameTitle}>
                            <Text numberOfLines={1} style={styles.gameMetaText}>
Test Suites: 14 failed, 163 passed, 177 total
Tests:       167 failed, 2053 passed, 2220 total
Snapshots:   0 total
Time:        42.044 s, estimated 51 s
```
Same command on the clean branch (my changes stashed):
```
            <Text numberOfLines={1} style={styles.skillSportName}>
                      <Text numberOfLines={2} style={styles.groupName}>
                          <Text numberOfLines={1} style={styles.gameTitle}>
                            <Text numberOfLines={1} style={styles.gameMetaText}>
Test Suites: 14 failed, 160 passed, 174 total
Tests:       167 failed, 2020 passed, 2187 total
Snapshots:   0 total
Time:        42.421 s
```
**Coverage delta (with minus without): statements +0.41 pts (76.51 vs 76.10), branches +0.47 (66.12 vs 65.65), functions +0.53 (75.11 vs 74.58), lines +0.43 (76.78 vs 76.35).** Passing tests 2020 to 2053 (+33); failing tests 167 both.

**The 167 failures are pre-existing, not caused by this task.** The same 14 suites and the same failing tests fail on the clean branch. A title-by-title comparison of failing tests shows none new (only the three `AccessActionNotFound` tests, rewritten). Failing suites:
```
__tests__/AppForceUpdate.test.tsx
config/__tests__/appConfig.test.ts
src/assets/__tests__/headerIcon.test.ts
src/components/__tests__/ForceUpdateGate.test.tsx
src/components/__tests__/keyboardInventory.test.ts
src/components/home/__tests__/homeComponents.test.tsx
src/screens/__tests__/CreateGameScreen.test.tsx
src/screens/__tests__/EventDetailScreen.test.tsx
src/screens/__tests__/HomeScreen.test.tsx
src/screens/__tests__/ProfileScreen.test.tsx
src/screens/__tests__/ProfileScreenLinks.test.tsx
src/screens/__tests__/ProfileScreenReportRow.test.tsx
src/screens/__tests__/ProfileScreenTerms.test.tsx
src/utils/__tests__/shareLink.test.ts
```
Causes seen on the clean branch: a missing `shuttlr-icon-header.png` asset, assertions still expecting "Shuttlr" where the label is now "GameOn SG", and similar stale expectations. I did not touch them.

`npx tsc --noEmit`:
```
(no output; exit 0)
```
`npm run lint` (with my changes), last lines; and the clean branch:
```

✖ 32 problems (31 errors, 1 warning)

--- clean branch ---

✖ 32 problems (31 errors, 1 warning)

```
Identical counts: all 31 lint errors are pre-existing (`jest` undefined in some test files, unused imports). None are in files I changed.

`npm run check:labels`:
```
check-labels: OK - 237 files scanned, 1034 default labels checked.
```

## 5. Screenshots next to the board: NOT PRODUCED
This session is a cloud container with no emulator or device, so I have no real screenshots of the new screens. Matching the board was done from `board.html` sizes and the PNG: sheet radius 16 (`radius.lg`), handle 40x4, person header with a 40 px avatar, action rows 52 px high with a 24 px icon box and 12 px gap, Details title 18/600 with Close 14/600, 88 px picture (`sizes.avatar`), name 22/700, nickname 15, confirmation dialog with Cancel (muted) and Yes (error red for destructive), scrim `colors.scrim`. Theme tokens only. **Owner action:** run `npm run android` and compare M1 to M8 against the board.

## 6. Deviations and open points (for the owner)
1. **One host instead of a sheet per screen.** The brief has the hook owning everything; I split it: `useUserMenu(context, onChanged)` is a light opener used by `UserPressable`, and a single `UserMenuHost` (via `useUserMenuEngine`) owns fetch, registry, confirmation and execution. Reason: avoids a Modal per row in lists and search results. Tests that render screens must mount `<UserMenuHost />` beside them.
2. **Behaviour change: after a member action the user stays on the screen.** Before, make or remove admin, make owner and remove all navigated to the dashboard with a success message (`goToDashboard`). Now they refresh the screen and show "Done" (design AD-5). Also: a member-action 404 used to keep the screen open with an inline error (ac-m-followup-fix); it now shows the "no longer available" notice and refetches (screen stays open unless that refetch also 404s).
3. **Items on the board with no label key, omitted:** the details footnote ("Picture, display name and nickname only. Nothing else is shown."), and "No linked user" under a placeholder registration. AD-6 defines no keys for them and I may not invent labels. I also read them as designer notes. Please confirm, or add keys.
4. **Home-card avatar details have no nickname line.** `AvatarPreview` carries `display_name`, `photo_url` and `user_id` only, so I show nothing rather than a false "No nickname". The board (M7) shows a nickname there: needs the backend to add it. Tournament registrations likewise have a nickname only (`participant_name`), no display name or photo.
5. **22 px target.** Tap target is the avatar itself; no `hitSlop` (overlapping avatars). Design OI-12, unaddressed.
6. **Icons:** the board uses text glyphs; I used the app's SVG icons (info circle added, shield plus/minus, crown, person-minus).
7. **`requires_approval: true`:** the brief says STOP. At runtime I cannot ask, so the action is dropped (fail closed) and tested. None exist in v1.
8. **Card timeout 8 s** is my choice (AD-5 says "slow" without a number).
9. **Accessibility:** in `UserSearchPicker` the row's left part is one accessible group, so the avatar long-press is not separately reachable by a screen reader. The row's own a11y label is unchanged.
10. **Loading state:** AD-5 mentions a loading state for actions; the board shows none, so none is drawn.
11. **Unused but kept:** `mob.group_detail.member_row_hint`, `member_card_a11y`, `action_*` labels. `mob.user_menu.not_available` is also unused (the shared notice uses `mob.access.no_longer_available`, same text).
12. **Process:** I ran the full jest suite more than once (with changes, on the clean branch for the baseline and coverage, and a targeted subset while developing) because the delta and the regression check needed it. Dependencies were installed with `npm ci --ignore-scripts` in the container. The backend contract was taken from design AD-1/AD-2 and the endpoint details in your brief; I could not call the live API from here (outbound network blocked), so nothing was checked against production.
13. **Git evidence:** `git log` on the branch: `763c774` (feature), `6968f98`, `842f917`, `3a5565f` base. 31 files, +1739 / -442. No secrets, `.env` or `docs/` edits in the code commit.
