# ui-mobile report

Task: ui-mobile (Part A dashboard sport chips, Part B "+ / −"). Branch `claude/upbeat-lovelace-lnblk2`. Design: AD-18/AD-19, TL-81, TL-82, test 51 (docs on branch `docs/tournament-lifecycle-v1.3-approved`, read-only). No design doc edited, no version chosen.

Status: implemented. NOT self-certified: 15 jest suites fail; one of those failures was mine and was fixed after the run (not re-run); the rest are listed below and none is in the invite or chip code paths I changed, but I did not run a baseline to prove it.

## Owner decision recorded (Part A step 3)
The brief's contrast gate (lightest grey in #E6EAF0..#CBD2DC passing 3:1 for all icons) cannot be met. Owner decision: use #E6EAF0 fixed and accept a documented exception. Numbers measured against #E6EAF0 (best colour of each glyph):
- Below 3:1 (accepted, follow-up for the icon library): **Tennis 1.84, Walking 2.10, Running 2.10, Breaking 2.10.**
- Pass at #E6EAF0: Diving 3.39, Wrestling 3.39, Speed skating 3.39, "All" 3.28 (and all others).
- The visible label under each chip carries the meaning; no outline, no artwork change.
Earlier blocked report (commit 5365484) had the per-colour table against #CBD2DC too.

## Part A: changes
- `src/theme/dashboardTheme.ts`: new token `sportTileColors.idle = '#E6EAF0'`.
- `src/components/home/SportChipsRow.tsx`: unselected chip (including "All") is a full circle (`borderRadius = dashSize.sportTile / 2`, 60 footprint, 2px transparent border kept) filled with the idle token. Selected chip unchanged (sport tint, rounded tile, 2px brand ring, `sport-chip-ring`, bold brand label). Not touched: useSportFilter, order, space-between layout, skeleton, icons, accessibilityState.selected, pressed opacity 0.7, 44 touch target.
- Tests (`src/components/home/__tests__/homeComponents.test.tsx`): idle chip has circle radius, idle token, transparent 2px border (All and a sport); selected chip unchanged; pressed opacity and 44 target kept.

## Part B: inventory (every per-person / per-group Invite control and Invite entry button)
Mode: STAGED = screen has a submit step; IMMEDIATE = no submit step, "+" sends.

| # | Where | Control | Mode | Now |
|---|---|---|---|---|
| 1 | UserSearchPicker, classic rows (text "Invite" pill) | per person | STAGED (CreateGameScreen step 6, EventDetailScreen invite player, TournamentInvitePanel) | shared control, "+" |
| 2 | UserSearchPicker, `invite` variant (text "+" box) | per person | IMMEDIATE (GroupDetailScreen invite panel, InviteMembersScreen = create-group suggested members; the group already exists and each "+" sends) | shared control, "+", chip after confirm |
| 3 | UserSearchPicker email row ("Invite {email}" pressable row) | per email | STAGED or IMMEDIATE as its host | shared control "+" |
| 4 | CreateGameScreen invitee chips (cross icon) | per person/email | STAGED | shared control "−" |
| 5 | EventDetailScreen / TournamentInvitePanel selected person/email row ("Change" text link) | per person | STAGED | shared control "−" |
| 6 | EventDetailScreen / TournamentInvitePanel group form (OptionChips toggle) | per group | STAGED | GroupInviteList rows, "+" / "−" |
| 7 | EventDetailScreen / TournamentInvitePanel "Invite Group", "Invite Player" buttons | entry that opens a picker | n/a | AddEntryRow: visible title + "+" (label keeps "Invite") |
| 8 | GroupDetailScreen "Invite" button (icon + text) | entry | n/a | AddEntryButton "+", label "Invite" |

Kept as they are (listed, not converted, per the brief):
- "Send Invite" / "Send Group Invite" buttons: the submit step of the staged forms (not per-person/per-group controls).
- UndoAddButton "−" (GroupDetailScreen added list, InviteMembersScreen): existing undo/revoke of a person already added; it is a text-character "−" next to the "Added" chip. AD-19 says the revoke control is not changed, so it stays. Note for the owner: after a confirmed "+" these rows show chip AND this "−", which differs from "Sent = chip, no glyph".
- GroupDetailScreen `plusSquare` (a text "+" square that CLOSES the invite panel; label "Invite players" collapsed). Outside the inventory brief; left as is. It draws a "+" that does not add, which conflicts with AD-19 meaning; owner to decide.
- GroupMultiSelect (CreateGameScreen step 4 share-to-groups, EventDetailScreen edit): checkbox visibility selection, not an Invite control. Left for tl-c-mobile step 4.
- TournamentInvitationBanner Accept/Decline and notification screens: responses to an invitation, not invite controls.

## Part B: implementation
- `src/components/AddRemoveControl.tsx` (new, the one shared component): `AddRemoveControl` (staged: "+" stages, "−" removes and sends nothing; immediate: "+" sends, chip only after `onSend` resolves, failure returns to "+" with error label, double tap sends once; `sentStatus` shows an existing server status chip with no glyph), `AddEntryButton`, `AddEntryRow`, `GroupInviteList`. Glyphs `PlusIcon`/`MinusIcon` added to the existing icon set (`icons/ActionIcons.tsx`). Theme tokens only. Touch target 48 (>= 44). Plus vs minus differ in shape, not only colour.
- `UserSearchPicker`: new props `selectionMode` ('staged' default | 'immediate'), `stagedUserIds`, `onUnstage`; immediate resets the list only after the server confirmed. Rows are no longer whole-row buttons: the control is the action (testID `user-search-row`), the row body has testID `user-search-row-body`.
- Screens: GroupDetailScreen and InviteMembersScreen handlers now reject on failure (control shows the error label; their own add-error text was removed, so the error is shown once). CreateGameScreen, EventDetailScreen, TournamentInvitePanel converted as in the inventory.
- Labels added to `src/labels/defaultLabels.ts`: `mob.add_remove.invite_a11y` "Invite {name}", `mob.add_remove.remove_a11y` "Remove {name}", `mob.add_remove.sending_a11y` "Sending invitation to {name}", `mob.add_remove.sent` "Invited", `mob.add_remove.error` "Could not send the invitation. Try again.". **Backend seed needed:** these 5 keys must be seeded in `ui_labels` in the backend repo (`~/meetup`, not reachable from this sandbox). STACK-GOTCHAS.md does not describe a seeding procedure; I followed the `defaultLabels.ts` mechanism that `check:labels` enforces. Unused now (left in place): `mob.user_search.invite_button`, `mob.invite.add_error`.
- Not changed: who may invite, windows, caps, notifications, revoke control, API calls.

## Tests (test 51)
New/updated and PASSING in the run below:
- `AddRemoveControl.test.tsx` (9): staged "+" stages / "−" removes and sends nothing; names from labels; touch target >= 44; glyph changes; status chip no glyph; immediate chip only after confirm (not optimistic); double tap sends once; failure returns to "+" with error label and retries; sync throw; entry button "+" 44pt; group rows "+"/"−".
- `inviteControlsStatic.test.ts` (3): TypeScript-AST scan of every non-test .tsx under src: no per-person/per-group Invite text button outside `AddRemoveControl.tsx` (keys `mob.user_search.invite_button`, `mob.group_detail.invite`, `mob.game_detail.invite_group`, `mob.game_detail.invite_player` allowed only as accessibilityLabel, on AddEntryRow/AddEntryButton, or as a `formTitle` heading). Detector self-check included. No exceptions.
- Updated and passing: GroupDetailScreen, InviteMembersScreen, TournamentInvite, EventDetailShareInvite, CreateGameInviteeList/Visibility/EmailInvites/OptionalInvites, InviteSearchConsistency, homeComponents SportChipsRow cases.
- UserSearchPicker.test.tsx: added selection-mode tests and updated row assertions. In the run, 1 test failed (`shows the display name first...`, it read texts of the control instead of the row). I fixed it afterwards by pointing it at `user-search-row-body`; **that fix was not re-run** (one jest run only).

## Raw command output (run once each, from `cd /home/user/meetup-mobile && pwd`)
`npx jest` (node v22.22.0, jest 29.7.0, after `npm ci`): 
```
Test Suites: 15 failed, 159 passed, 174 total
Tests:       169 failed, 2018 passed, 2187 total
exit 1
```
Failing suites (15) and what they are:
- NOT in my changed areas, environment or stale tests: ProfileScreen, ProfileScreenLinks, ProfileScreenReportRow, ProfileScreenTerms, ForceUpdateGate, __tests__/AppForceUpdate, shareLink, appConfig (iOS project values), headerIcon (ENOENT `src/assets/shuttlr-icon.png`, binary assets missing in this checkout), keyboardInventory (lists screens with bare TextInput), HomeScreen (`sports-section` testID not found), CreateGameScreen.test (looks for label "🎮 Casual Game"), homeComponents DashboardBanner brand block ×7 (missing `shuttlr-icon-header.png`).
- EventDetailScreen.test: failures are label mismatches ("Cancel Event", "Invite Individual" while the label is "Invite Player") plus Edit-flow cases. The cases I touched (group invite flow BUILD 3, which selects groups by "Invite {group}") pass; the BUILD C individual-invite cases fail on the stale label "Invite Individual" before reaching my change.
I did NOT run a baseline of the original code, so "not mine" is from reading the failure messages, not from a before/after comparison.

`npx tsc --noEmit`: exit 0, no output.
`npm run lint` (eslint .): exit 1, 32 problems (31 errors, 1 warning), all in files this task did not touch (jest.setup.js, scripts/check-labels.js, NotificationCard.test.tsx, RegistryIcons.test.tsx). Files I changed lint clean (`npx eslint src` shows only the 3 pre-existing test-file errors, same with my changes stashed).
`npm run check:labels`:
```
check-labels: OK - 231 files scanned, 1012 default labels checked.
```

## Deviations / notes
- docs/agent-handoff-template.md does not exist in the repo; proceeded without it, nothing prepended.
- Coverage delta not produced (no coverage run requested/available in this single run). Screenshots not produced: no emulator in this sandbox, so no visual check against boards; Part A follows the brief's numbers, Part B has no board.
- ~/meetup (backend repo and Tourn boards) is not in this sandbox. Not needed for ui-mobile; blocks tl-c-mobile.
- Immediate-mode picker rows: after a confirmed send the list resets, so the row's own chip is brief; the persistent confirmation is the screen's existing "Added" chip list.
- Overlay risk: row a11y group info (shared group) now lives on the row body label; the action's accessible name is "Invite {display name}" (email rows keep "Invite {email} as new {entity}" via a label-system override).
- Follow-up (icon library): Tennis, Walking, Running, Breaking icons are below 3:1 on the idle grey.
