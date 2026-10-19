# ui-mobile report

Task: ui-mobile (Part A dashboard sport chips, Part B "+ / −"). Branch `claude/upbeat-lovelace-lnblk2`. Design: AD-18/AD-19, TL-81, TL-82, test 51 (docs on branch `docs/tournament-lifecycle-v1.3-approved`, read-only). No design doc edited, no version chosen.

Status: implemented. NOT self-certified. After the follow-up verification below: jest on the final commit has 14 failing suites, the same 14 as on its parent (no suite fails on the final commit that passes on the parent); UserSearchPicker passes; lint is 32 problems on both.

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
- UserSearchPicker.test.tsx: added selection-mode tests and updated row assertions. It passes on the final commit (see verification below); a first-run failure (`shows the display name first...`) was fixed by pointing it at `user-search-row-body`.

## Verification on the final commit vs its parent (run once each)
Final = 09af54f (code identical to the commit that carries this report). Parent = 5365484, run in a separate git worktree (`git worktree add <dir> 09af54f^`, node_modules symlinked to the main checkout). Same machine, Node v22.22.0, `npx jest` once per tree. Full raw logs are committed next to this report: `ui-mobile-logs/jest-final-09af54f.txt`, `ui-mobile-logs/jest-parent-5365484.txt`, `ui-mobile-logs/lint-final-09af54f.txt`, `ui-mobile-logs/lint-parent-5365484.txt` (jest logs are ~0.5 MB each, so only the summary and the suite lines are pasted here).

### 1. UserSearchPicker on the final commit
```
PASS src/components/__tests__/UserSearchPicker.test.tsx
(raw line 4492 of ui-mobile-logs/jest-final-09af54f.txt)
```

### 2. Raw jest summary, both trees
Final (09af54f):
```
Test Suites: 14 failed, 160 passed, 174 total
Tests:       167 failed, 2020 passed, 2187 total
Snapshots:   0 total
Time:        53.99 s, estimated 65 s
exit 1
```
Parent (5365484):
```
Test Suites: 14 failed, 158 passed, 172 total
Tests:       168 failed, 2000 passed, 2168 total
Snapshots:   0 total
Time:        69.344 s
exit 1
```
(Test counts differ because the final commit adds 2 test files and 19 tests.)

Raw PASS/FAIL suite lines, final commit:
```
PASS __tests__/App.test.tsx
FAIL __tests__/AppForceUpdate.test.tsx
PASS __tests__/index.test.ts
FAIL config/__tests__/appConfig.test.ts
PASS config/__tests__/iosPodDeploymentTarget.test.ts
PASS config/__tests__/iosSceneLifecycle.test.ts
PASS src/api/__tests__/config.test.ts
PASS src/api/__tests__/cookies.test.ts
PASS src/api/__tests__/events.test.ts
PASS src/api/__tests__/groups.test.ts
PASS src/api/__tests__/groupsNoCache.test.ts
PASS src/api/__tests__/labels.test.ts
PASS src/api/__tests__/mobileNumber.test.ts
PASS src/api/__tests__/notifications.test.ts
PASS src/api/__tests__/profile.test.ts
PASS src/api/__tests__/profileNormalizer.test.ts
PASS src/api/__tests__/refresh.test.ts
PASS src/api/__tests__/refreshForAction.test.ts
PASS src/api/__tests__/sports.test.ts
PASS src/api/__tests__/tournaments.test.ts
PASS src/api/__tests__/users.test.ts
PASS src/api/__tests__/venues.test.ts
PASS src/api/__tests__/versionPolicy.test.ts
FAIL src/assets/__tests__/headerIcon.test.ts
PASS src/auth/__tests__/AuthContext.push.test.tsx
PASS src/auth/__tests__/appleAuth.test.ts
PASS src/auth/__tests__/googleSignInPlatform.test.tsx
PASS src/auth/__tests__/sessionExpiry.test.tsx
PASS src/auth/__tests__/signInNoRefreshToken.test.tsx
PASS src/auth/__tests__/signOut.test.ts
PASS src/auth/__tests__/signOutSession.test.ts
PASS src/auth/__tests__/silentRefresh.test.tsx
PASS src/components/__tests__/AddRemoveControl.test.tsx
PASS src/components/__tests__/Badge.test.tsx
PASS src/components/__tests__/Button.test.tsx
PASS src/components/__tests__/DateTimePickerField.test.tsx
PASS src/components/__tests__/DropdownField.test.tsx
PASS src/components/__tests__/EventCard.test.tsx
FAIL src/components/__tests__/ForceUpdateGate.test.tsx
PASS src/components/__tests__/GroupCard.test.tsx
PASS src/components/__tests__/GroupNamesRow.test.tsx
PASS src/components/__tests__/HeaderAddButton.test.tsx
PASS src/components/__tests__/KeyboardAwareScreen.test.tsx
PASS src/components/__tests__/MobileNumberCard.test.tsx
PASS src/components/__tests__/MobileNumberInput.test.tsx
PASS src/components/__tests__/NotificationBanner.test.tsx
PASS src/components/__tests__/NotificationCard.test.tsx
PASS src/components/__tests__/OptionChips.test.tsx
PASS src/components/__tests__/SessionCheckRetry.test.tsx
PASS src/components/__tests__/ShareActionSheet.test.tsx
PASS src/components/__tests__/Toast.test.tsx
PASS src/components/__tests__/TournamentsListContent.test.tsx
PASS src/components/__tests__/UserSearchPicker.test.tsx
PASS src/components/__tests__/inviteControlsStatic.test.ts
PASS src/components/__tests__/iosPickerTheme.test.ts
FAIL src/components/__tests__/keyboardInventory.test.ts
PASS src/components/auth/__tests__/SocialTermsNotice.test.tsx
FAIL src/components/home/__tests__/homeComponents.test.tsx
PASS src/components/icons/__tests__/DashboardIcons.test.tsx
PASS src/components/icons/__tests__/RegistryIcons.test.tsx
PASS src/components/skills/__tests__/LevelPerSportCard.test.tsx
PASS src/components/skills/__tests__/MySportRow.test.tsx
PASS src/components/skills/__tests__/SkillLevelFlow.test.tsx
PASS src/components/skills/__tests__/SportPicker.test.tsx
PASS src/components/venue/__tests__/OthersVenueModal.test.tsx
PASS src/components/venue/__tests__/VenueDetailCard.test.tsx
PASS src/components/venue/__tests__/VenueMapFallback.test.tsx
PASS src/components/venue/__tests__/VenuePicker.test.tsx
PASS src/hooks/__tests__/useFieldChain.test.tsx
PASS src/hooks/__tests__/useMobileNumberConfig.test.tsx
PASS src/hooks/__tests__/useOnboardingRequired.test.tsx
PASS src/hooks/__tests__/useRefetchOnFocus.test.tsx
PASS src/hooks/__tests__/useResource.test.tsx
PASS src/hooks/__tests__/useResourceFresh.test.tsx
PASS src/hooks/__tests__/useSportFilter.test.tsx
PASS src/labels/__tests__/LabelsContext.test.tsx
PASS src/navigation/__tests__/CreateMenu.test.tsx
PASS src/navigation/__tests__/CreateTabButton.test.tsx
PASS src/navigation/__tests__/OnboardingOverlay.test.tsx
PASS src/navigation/__tests__/RootNavigatorHomeTab.test.tsx
PASS src/navigation/__tests__/accessNotice.test.ts
PASS src/navigation/__tests__/tabIcons.test.tsx
PASS src/notifications/__tests__/deviceId.test.ts
PASS src/notifications/__tests__/deviceIdIos.test.ts
PASS src/notifications/__tests__/fcm.test.ts
PASS src/notifications/__tests__/fcmForeground.test.ts
PASS src/notifications/__tests__/iosPush.test.ts
PASS src/notifications/__tests__/notificationEventDispatcher.test.ts
PASS src/notifications/__tests__/notificationRouting.test.ts
PASS src/notifications/__tests__/pushActions.test.ts
PASS src/notifications/__tests__/pushActionsDisplay.test.ts
PASS src/notifications/__tests__/pushActionsIosPress.test.ts
PASS src/notifications/__tests__/pushRegistration.test.ts
PASS src/notifications/eventNotificationHandler.test.ts
PASS src/notifications/participantHandler.test.ts
PASS src/onboarding/__tests__/steps.test.ts
PASS src/screens/__tests__/AccessActionNotFound.test.tsx
PASS src/screens/__tests__/AccessRefetchDetails.test.tsx
PASS src/screens/__tests__/AccessRefetchLists.test.tsx
PASS src/screens/__tests__/CreateGameDuration.test.tsx
PASS src/screens/__tests__/CreateGameDurationRow.test.tsx
PASS src/screens/__tests__/CreateGameEmailInvites.test.tsx
PASS src/screens/__tests__/CreateGameGroupCount.test.tsx
PASS src/screens/__tests__/CreateGameInviteeList.test.tsx
PASS src/screens/__tests__/CreateGameInviteeVisibility.test.tsx
PASS src/screens/__tests__/CreateGameMultiGroup.test.tsx
PASS src/screens/__tests__/CreateGameOptionalInvites.test.tsx
FAIL src/screens/__tests__/CreateGameScreen.test.tsx
PASS src/screens/__tests__/CreateGroupScreen.test.tsx
PASS src/screens/__tests__/DetailGroupRow.test.tsx
PASS src/screens/__tests__/EditSkillLevelsScreen.test.tsx
PASS src/screens/__tests__/EventDetailGroups.test.tsx
PASS src/screens/__tests__/EventDetailPlayers.test.tsx
PASS src/screens/__tests__/EventDetailRsvpError.test.tsx
FAIL src/screens/__tests__/EventDetailScreen.test.tsx
PASS src/screens/__tests__/EventDetailShareInvite.test.tsx
PASS src/screens/__tests__/ForgotPasswordScreen.test.tsx
PASS src/screens/__tests__/GamesScreen.test.tsx
PASS src/screens/__tests__/GroupDetailMembers.test.tsx
PASS src/screens/__tests__/GroupDetailScreen.test.tsx
PASS src/screens/__tests__/GroupsHeaderNavigation.test.tsx
PASS src/screens/__tests__/GroupsScreen.test.tsx
FAIL src/screens/__tests__/HomeScreen.test.tsx
PASS src/screens/__tests__/HomeStatsStrip.test.tsx
PASS src/screens/__tests__/HomeTabs.test.tsx
PASS src/screens/__tests__/HomeUpcomingJoin.test.tsx
PASS src/screens/__tests__/InviteMembersScreen.test.tsx
PASS src/screens/__tests__/InviteSearchConsistency.test.tsx
PASS src/screens/__tests__/LegacyVenuePayloadContracts.test.tsx
PASS src/screens/__tests__/LoginScreen.test.tsx
PASS src/screens/__tests__/NotificationHistoryScreen.test.tsx
PASS src/screens/__tests__/NotificationPreferencesScreen.test.tsx
PASS src/screens/__tests__/OnboardingScreen.test.tsx
PASS src/screens/__tests__/ProfileNoStats.test.tsx
FAIL src/screens/__tests__/ProfileScreen.test.tsx
FAIL src/screens/__tests__/ProfileScreenLinks.test.tsx
FAIL src/screens/__tests__/ProfileScreenReportRow.test.tsx
PASS src/screens/__tests__/ProfileScreenSkillLevel.test.tsx
FAIL src/screens/__tests__/ProfileScreenTerms.test.tsx
PASS src/screens/__tests__/RegisterScreen.test.tsx
PASS src/screens/__tests__/RegisterScreenKeyboard.test.tsx
PASS src/screens/__tests__/RegisterScreenPrivacy.test.tsx
PASS src/screens/__tests__/RegisterScreenTerms.test.tsx
PASS src/screens/__tests__/SettingsAppVersion.test.tsx
PASS src/screens/__tests__/SkillRequirementPills.test.tsx
PASS src/screens/__tests__/TournamentDetailScreen.test.tsx
PASS src/screens/__tests__/TournamentInvite.test.tsx
PASS src/screens/__tests__/TournamentRespond.test.tsx
PASS src/screens/__tests__/TournamentShare.test.tsx
PASS src/screens/__tests__/VenuePayloadContracts.test.tsx
PASS src/screens/__tests__/VerifyScreen.test.tsx
PASS src/screens/__tests__/VerifyScreenOneTimeCode.test.tsx
PASS src/screens/__tests__/emailAuthSecurityAndAudit.test.tsx
PASS src/sports/__tests__/style.test.ts
PASS src/storage/__tests__/tokens.test.ts
PASS src/theme/__tests__/tokens.test.ts
PASS src/utils/__tests__/apiError.test.ts
PASS src/utils/__tests__/avatar.test.ts
PASS src/utils/__tests__/displayName.test.ts
PASS src/utils/__tests__/formatEventDateTime.test.ts
PASS src/utils/__tests__/formatGameTime.test.ts
PASS src/utils/__tests__/formatRelativeTime.test.ts
PASS src/utils/__tests__/gameGroups.test.ts
PASS src/utils/__tests__/gameLists.test.ts
PASS src/utils/__tests__/httpsUrl.test.ts
PASS src/utils/__tests__/installedVersion.test.ts
PASS src/utils/__tests__/labels.test.tsx
PASS src/utils/__tests__/localDateTime.test.ts
PASS src/utils/__tests__/logSafeError.test.ts
PASS src/utils/__tests__/notificationDateUtils.test.ts
PASS src/utils/__tests__/phoneNumber.test.ts
PASS src/utils/__tests__/playStoreUrl.test.ts
FAIL src/utils/__tests__/shareLink.test.ts
PASS src/utils/__tests__/supportLink.test.ts
```
Raw PASS/FAIL suite lines, parent:
```
PASS __tests__/App.test.tsx
FAIL __tests__/AppForceUpdate.test.tsx
PASS __tests__/index.test.ts
FAIL config/__tests__/appConfig.test.ts
PASS config/__tests__/iosPodDeploymentTarget.test.ts
PASS config/__tests__/iosSceneLifecycle.test.ts
PASS src/api/__tests__/config.test.ts
PASS src/api/__tests__/cookies.test.ts
PASS src/api/__tests__/events.test.ts
PASS src/api/__tests__/groups.test.ts
PASS src/api/__tests__/groupsNoCache.test.ts
PASS src/api/__tests__/labels.test.ts
PASS src/api/__tests__/mobileNumber.test.ts
PASS src/api/__tests__/notifications.test.ts
PASS src/api/__tests__/profile.test.ts
PASS src/api/__tests__/profileNormalizer.test.ts
PASS src/api/__tests__/refresh.test.ts
PASS src/api/__tests__/refreshForAction.test.ts
PASS src/api/__tests__/sports.test.ts
PASS src/api/__tests__/tournaments.test.ts
PASS src/api/__tests__/users.test.ts
PASS src/api/__tests__/venues.test.ts
PASS src/api/__tests__/versionPolicy.test.ts
FAIL src/assets/__tests__/headerIcon.test.ts
PASS src/auth/__tests__/AuthContext.push.test.tsx
PASS src/auth/__tests__/appleAuth.test.ts
PASS src/auth/__tests__/googleSignInPlatform.test.tsx
PASS src/auth/__tests__/sessionExpiry.test.tsx
PASS src/auth/__tests__/signInNoRefreshToken.test.tsx
PASS src/auth/__tests__/signOut.test.ts
PASS src/auth/__tests__/signOutSession.test.ts
PASS src/auth/__tests__/silentRefresh.test.tsx
PASS src/components/__tests__/Badge.test.tsx
PASS src/components/__tests__/Button.test.tsx
PASS src/components/__tests__/DateTimePickerField.test.tsx
PASS src/components/__tests__/DropdownField.test.tsx
PASS src/components/__tests__/EventCard.test.tsx
FAIL src/components/__tests__/ForceUpdateGate.test.tsx
PASS src/components/__tests__/GroupCard.test.tsx
PASS src/components/__tests__/GroupNamesRow.test.tsx
PASS src/components/__tests__/HeaderAddButton.test.tsx
PASS src/components/__tests__/KeyboardAwareScreen.test.tsx
PASS src/components/__tests__/MobileNumberCard.test.tsx
PASS src/components/__tests__/MobileNumberInput.test.tsx
PASS src/components/__tests__/NotificationBanner.test.tsx
PASS src/components/__tests__/NotificationCard.test.tsx
PASS src/components/__tests__/OptionChips.test.tsx
PASS src/components/__tests__/SessionCheckRetry.test.tsx
PASS src/components/__tests__/ShareActionSheet.test.tsx
PASS src/components/__tests__/Toast.test.tsx
PASS src/components/__tests__/TournamentsListContent.test.tsx
PASS src/components/__tests__/UserSearchPicker.test.tsx
PASS src/components/__tests__/iosPickerTheme.test.ts
FAIL src/components/__tests__/keyboardInventory.test.ts
PASS src/components/auth/__tests__/SocialTermsNotice.test.tsx
FAIL src/components/home/__tests__/homeComponents.test.tsx
PASS src/components/icons/__tests__/DashboardIcons.test.tsx
PASS src/components/icons/__tests__/RegistryIcons.test.tsx
PASS src/components/skills/__tests__/LevelPerSportCard.test.tsx
PASS src/components/skills/__tests__/MySportRow.test.tsx
PASS src/components/skills/__tests__/SkillLevelFlow.test.tsx
PASS src/components/skills/__tests__/SportPicker.test.tsx
PASS src/components/venue/__tests__/OthersVenueModal.test.tsx
PASS src/components/venue/__tests__/VenueDetailCard.test.tsx
PASS src/components/venue/__tests__/VenueMapFallback.test.tsx
PASS src/components/venue/__tests__/VenuePicker.test.tsx
PASS src/hooks/__tests__/useFieldChain.test.tsx
PASS src/hooks/__tests__/useMobileNumberConfig.test.tsx
PASS src/hooks/__tests__/useOnboardingRequired.test.tsx
PASS src/hooks/__tests__/useRefetchOnFocus.test.tsx
PASS src/hooks/__tests__/useResource.test.tsx
PASS src/hooks/__tests__/useResourceFresh.test.tsx
PASS src/hooks/__tests__/useSportFilter.test.tsx
PASS src/labels/__tests__/LabelsContext.test.tsx
PASS src/navigation/__tests__/CreateMenu.test.tsx
PASS src/navigation/__tests__/CreateTabButton.test.tsx
PASS src/navigation/__tests__/OnboardingOverlay.test.tsx
PASS src/navigation/__tests__/RootNavigatorHomeTab.test.tsx
PASS src/navigation/__tests__/accessNotice.test.ts
PASS src/navigation/__tests__/tabIcons.test.tsx
PASS src/notifications/__tests__/deviceId.test.ts
PASS src/notifications/__tests__/deviceIdIos.test.ts
PASS src/notifications/__tests__/fcm.test.ts
PASS src/notifications/__tests__/fcmForeground.test.ts
PASS src/notifications/__tests__/iosPush.test.ts
PASS src/notifications/__tests__/notificationEventDispatcher.test.ts
PASS src/notifications/__tests__/notificationRouting.test.ts
PASS src/notifications/__tests__/pushActions.test.ts
PASS src/notifications/__tests__/pushActionsDisplay.test.ts
PASS src/notifications/__tests__/pushActionsIosPress.test.ts
PASS src/notifications/__tests__/pushRegistration.test.ts
PASS src/notifications/eventNotificationHandler.test.ts
PASS src/notifications/participantHandler.test.ts
PASS src/onboarding/__tests__/steps.test.ts
PASS src/screens/__tests__/AccessActionNotFound.test.tsx
PASS src/screens/__tests__/AccessRefetchDetails.test.tsx
PASS src/screens/__tests__/AccessRefetchLists.test.tsx
PASS src/screens/__tests__/CreateGameDuration.test.tsx
PASS src/screens/__tests__/CreateGameDurationRow.test.tsx
PASS src/screens/__tests__/CreateGameEmailInvites.test.tsx
PASS src/screens/__tests__/CreateGameGroupCount.test.tsx
PASS src/screens/__tests__/CreateGameInviteeList.test.tsx
PASS src/screens/__tests__/CreateGameInviteeVisibility.test.tsx
PASS src/screens/__tests__/CreateGameMultiGroup.test.tsx
PASS src/screens/__tests__/CreateGameOptionalInvites.test.tsx
FAIL src/screens/__tests__/CreateGameScreen.test.tsx
PASS src/screens/__tests__/CreateGroupScreen.test.tsx
PASS src/screens/__tests__/DetailGroupRow.test.tsx
PASS src/screens/__tests__/EditSkillLevelsScreen.test.tsx
PASS src/screens/__tests__/EventDetailGroups.test.tsx
PASS src/screens/__tests__/EventDetailPlayers.test.tsx
PASS src/screens/__tests__/EventDetailRsvpError.test.tsx
FAIL src/screens/__tests__/EventDetailScreen.test.tsx
PASS src/screens/__tests__/EventDetailShareInvite.test.tsx
PASS src/screens/__tests__/ForgotPasswordScreen.test.tsx
PASS src/screens/__tests__/GamesScreen.test.tsx
PASS src/screens/__tests__/GroupDetailMembers.test.tsx
PASS src/screens/__tests__/GroupDetailScreen.test.tsx
PASS src/screens/__tests__/GroupsHeaderNavigation.test.tsx
PASS src/screens/__tests__/GroupsScreen.test.tsx
FAIL src/screens/__tests__/HomeScreen.test.tsx
PASS src/screens/__tests__/HomeStatsStrip.test.tsx
PASS src/screens/__tests__/HomeTabs.test.tsx
PASS src/screens/__tests__/HomeUpcomingJoin.test.tsx
PASS src/screens/__tests__/InviteMembersScreen.test.tsx
PASS src/screens/__tests__/InviteSearchConsistency.test.tsx
PASS src/screens/__tests__/LegacyVenuePayloadContracts.test.tsx
PASS src/screens/__tests__/LoginScreen.test.tsx
PASS src/screens/__tests__/NotificationHistoryScreen.test.tsx
PASS src/screens/__tests__/NotificationPreferencesScreen.test.tsx
PASS src/screens/__tests__/OnboardingScreen.test.tsx
PASS src/screens/__tests__/ProfileNoStats.test.tsx
FAIL src/screens/__tests__/ProfileScreen.test.tsx
FAIL src/screens/__tests__/ProfileScreenLinks.test.tsx
FAIL src/screens/__tests__/ProfileScreenReportRow.test.tsx
PASS src/screens/__tests__/ProfileScreenSkillLevel.test.tsx
FAIL src/screens/__tests__/ProfileScreenTerms.test.tsx
PASS src/screens/__tests__/RegisterScreen.test.tsx
PASS src/screens/__tests__/RegisterScreenKeyboard.test.tsx
PASS src/screens/__tests__/RegisterScreenPrivacy.test.tsx
PASS src/screens/__tests__/RegisterScreenTerms.test.tsx
PASS src/screens/__tests__/SettingsAppVersion.test.tsx
PASS src/screens/__tests__/SkillRequirementPills.test.tsx
PASS src/screens/__tests__/TournamentDetailScreen.test.tsx
PASS src/screens/__tests__/TournamentInvite.test.tsx
PASS src/screens/__tests__/TournamentRespond.test.tsx
PASS src/screens/__tests__/TournamentShare.test.tsx
PASS src/screens/__tests__/VenuePayloadContracts.test.tsx
PASS src/screens/__tests__/VerifyScreen.test.tsx
PASS src/screens/__tests__/VerifyScreenOneTimeCode.test.tsx
PASS src/screens/__tests__/emailAuthSecurityAndAudit.test.tsx
PASS src/sports/__tests__/style.test.ts
PASS src/storage/__tests__/tokens.test.ts
PASS src/theme/__tests__/tokens.test.ts
PASS src/utils/__tests__/apiError.test.ts
PASS src/utils/__tests__/avatar.test.ts
PASS src/utils/__tests__/displayName.test.ts
PASS src/utils/__tests__/formatEventDateTime.test.ts
PASS src/utils/__tests__/formatGameTime.test.ts
PASS src/utils/__tests__/formatRelativeTime.test.ts
PASS src/utils/__tests__/gameGroups.test.ts
PASS src/utils/__tests__/gameLists.test.ts
PASS src/utils/__tests__/httpsUrl.test.ts
PASS src/utils/__tests__/installedVersion.test.ts
PASS src/utils/__tests__/labels.test.tsx
PASS src/utils/__tests__/localDateTime.test.ts
PASS src/utils/__tests__/logSafeError.test.ts
PASS src/utils/__tests__/notificationDateUtils.test.ts
PASS src/utils/__tests__/phoneNumber.test.ts
PASS src/utils/__tests__/playStoreUrl.test.ts
FAIL src/utils/__tests__/shareLink.test.ts
PASS src/utils/__tests__/supportLink.test.ts
```

Failing suites side by side:

| Suite | Final 09af54f | Parent 5365484 |
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

Suites failing on the final commit but not on the parent: **none**. Failing test titles on the final commit that do not fail on the parent: none (compared by title). The one title that differs the other way is `ProfileScreen names > titles the profile with display_name`, which fails on the parent only (ProfileScreen is untouched by this task; looks intermittent). The first run's "15 failing suites" included UserSearchPicker; after the fix it passes, so the final commit has 14, identical to the parent.

### 3. Lint (`npm run lint`, i.e. `eslint .`)
| | Final 09af54f | Parent 5365484 |
|---|---|---|
| Problems | 32 (31 errors, 1 warning), exit 1 | 32 (31 errors, 1 warning), exit 1 |
Files with problems are the same list on both trees (none changed by this task):
```
jest.setup.js
scripts/check-labels.js
src/components/__tests__/NotificationCard.test.tsx
src/components/icons/__tests__/RegistryIcons.test.tsx
```

### 4. New labels (`src/labels/defaultLabels.ts`; to be seeded in `ui_labels`)
| Key | Default text |
|---|---|
| `mob.add_remove.sent` | Invited |
| `mob.add_remove.error` | Could not send the invitation. Try again. |

### 5. Left unchanged on request
The Group view `plusSquare` "+" that closes the invite panel, and `UndoAddButton` "−", are untouched in this follow-up (no code change at all in this round).

## Other commands (first run, unchanged)
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
