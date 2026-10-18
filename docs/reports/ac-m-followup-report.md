# ac-m-followup: implementation report

Task: `ac-m-followup` (access consistency, mobile AD-8 follow-up). Design: `docs/DES-MEETUP-ADDENDUM-access-consistency.md` v1.2 (AD-8 only). Brief: `docs/briefs/BRIEF-access-consistency-mobile.md`, section "Task `ac-m-followup`". Closes the gaps listed in `docs/reports/ac-m-refetch-report.md` (section 4, items 7 and 8, and the label drift in item 2).

Branch: `ac/ac-m-followup`, off `ac/ac-m-refetch` (PR #34). The PR is opened **against `ac/ac-m-refetch`**, not `main`. `main` includes `e9a0abd`.

## 1. What changed

New:

- `src/hooks/useUnavailableScreen.ts`: one place for what a detail screen does on a 404.
  - `onNotFound()`: close the screen and show the neutral message, once.
  - `markOwnAction()`: call right after the user's OWN successful cancel / delete / leave / withdraw / decline. A 404 after that closes the screen quietly: no message.
  - `reset()`: the screen now shows another id.
- `closeScreenQuietly()` in `src/navigation/accessNotice.ts`.

Changed (line numbers are on this branch):

| Screen | 404 on an action goes through `onNotFound` | Own action marked (quiet close afterwards) |
|---|---|---|
| Game detail `EventDetailScreen.tsx` | detail fetch `:217`; edit save `:684`; host delete `:721`; Join / RSVP `:740`; Leave `:763` | host delete `:703`; Leave `:758` |
| Group detail `GroupDetailScreen.tsx` | detail fetch `:148`; change role `:278`; remove member `:298`; Leave group `:342`; Delete group `:697` (via `DeleteGroupSheet`) | Leave group `:331`; Delete group `:700` |
| Tournament detail `TournamentDetailScreen.tsx` | detail fetch `:141`; refresh `:178`; Register `:200`; Withdraw `:231`; Cancel `:261`; invitation respond `:340` | Withdraw `:221`; Cancel `:246`; Decline invitation `:336` |
| `DeleteGroupSheet.tsx:55`, `TournamentInvitationBanner.tsx:67` | new optional `onNotFound` prop | none |

Other errors keep today's handling (the backend `detail` text or the generic error line, screen stays). `TournamentInvitationBanner.onResponded` now receives `{ accepted }` so only a decline counts as the user's own removal.

## 2. Flow trace: every create / cancel / delete / leave completion

`showCompletion()` is `src/navigation/showCompletion.ts:84` (pushes the root `Completion` screen). The buttons and hardware back all end in `leaveCompletion()` (`:246`): `clearCompletion()`, then `goToTarget()` (`:168`, which pops to the target with `pop: true`), then `dismissCompletionRoute()` (`:114`). Hardware back (`CompletionScreen.tsx:150`) and the `beforeRemove` listener (`:161`) both run the primary action.

| Flow | Call site | Primary / secondary target | Can a detail fetch 404 afterwards? | Guard |
|---|---|---|---|---|
| `game_created` | `CreateGameScreen.tsx:519` | dashboard (`showCompletion.ts:174`) / `view_game` → `openGame` (`:132`) | No: creating does not remove access | none needed |
| `tournament_created` | `CreateGameScreen.tsx:551` | dashboard / `view_tournament` (`:218`) | No | none needed |
| `team_created` (Create Group form) | `CreateGroupScreen.tsx:216` | dashboard | No | none needed |
| `group_created` (invite step) | `InviteMembersScreen.tsx:102` | dashboard / `view_group` → `openGroup` (`:150`) | No | none needed |
| `game_updated` | `EventDetailScreen.tsx:675` | dashboard / `view_game` | No (edit) | none needed |
| `group_updated` | `EditGroupScreen.tsx:178` | `groups` (`:195`) / `view_group` | No (edit) | none needed |
| **`game_cancelled`** (host "Delete game") | `EventDetailScreen.tsx:705` | dashboard: `Home/EventsList` with `pop: true` pops `EventDetail` | Yes: "the game is removed for everyone" | `markOwnAction()` at `:703` before the completion call |
| **`tournament_cancelled`** | `TournamentDetailScreen.tsx:248` | dashboard: `Tournaments/TournamentsList` then `Home/EventsList`, both `pop: true` (`:182`) | Possible | `markOwnAction()` at `:246` |
| **`group_deleted`** | `GroupDetailScreen.tsx:701` (from `DeleteGroupSheet` `onDeleted`) | `groups`: `Groups/GroupsList` `pop: true` pops `GroupDetail` | Yes | `markOwnAction()` at `:700` |
| **`group_left`** | `GroupDetailScreen.tsx:332` | `groups` (`:195`) | Yes | `markOwnAction()` at `:331` |
| `profile_updated`, `skills_updated`, `account_created`, `account_deleted` | `EditProfileScreen.tsx:321`, `EditSkillLevelsScreen.tsx:165`, `VerifyScreen.tsx:80`, `AccountDeletionCodeScreen.tsx:93` | profile / sign-in | Not a game, group or tournament | n/a |

Own removals with NO completion screen (the user stays on the detail while the action runs):

| Action | Call site | Guard |
|---|---|---|
| Leave a game | `EventDetailScreen.tsx:750-763` (`handleWithdraw`, then `loadEvent(true)`) | `markOwnAction()` `:758` |
| Withdraw from a tournament | `TournamentDetailScreen.tsx:209-231` (then refetch inside the action) | `markOwnAction()` `:221` |
| Decline a tournament invitation | `TournamentInvitationBanner.tsx` → `TournamentDetailScreen.tsx:336` | `markOwnAction()` when `accepted === false` |

Group member / invite actions that end in `goToDashboard()` (`GroupDetailScreen.tsx:243, 274, 295`) do not remove the user from the group, so there is no own-removal guard there.

How the normal path already avoids the notice: for the four removal flows above, `goToTarget` pops the detail screen before the user can see it again, so no refocus fetch happens. The guard covers the paths where that does not hold: the detail still on the stack when the completion is dismissed, an in-flight fetch that answers 404 after the action, and the refetch that follows leave / withdraw / decline inside the action itself.

What the user sees after an own action that makes the next fetch 404: the existing completion screen (cancel / delete / leave), or, for Leave a game / Withdraw / Decline (no completion screen exists), the screen closes by itself with no message. That last part is my reading of "closes on 404"; see decision 2.

## 3. Label inventory drift (do NOT edit docs/)

`docs/label-inventory-mobile.json` (`DES-MEETUP-FEEDBACK-001`, `entries[]`) is missing the one label PR #34 added. The exact entry to append to `entries`:

```json
{
  "key": "mob.access.no_longer_available",
  "defaultText": "This is no longer available.",
  "screen": "Shared (game, group and tournament detail)",
  "placeholders": [],
  "status": "new-label"
}
```

Wider drift found while checking (not part of this task): `defaultLabels.ts` has far more keys than the inventory. Counting the keys in `src/labels/defaultLabels.ts` that are not in the inventory's 530 entries gives 358 on this branch (357 on `main`), for example all `mob.account_delete.*`, `mob.auth.*`, `mob.create_game.at_least_one` and the labels of the recent skill, game-status, multi-group and settings work. The inventory is a v1.0 snapshot. Whether it should be regenerated is the owner's call.

## 4. Tests

New: `src/screens/__tests__/AccessActionNotFound.test.tsx` (24 tests, all passing). I also checked that they bite: with every `markOwnAction()` call removed, 7 of them fail (host delete, Leave game, Leave group, Delete group, Withdraw, tournament cancel, Decline).

| Brief | Tests |
|---|---|
| (1) 404 on an action closes with the message | Game: Join, Leave, host Delete game. Group: Leave group, remove member, change role, Delete group. Tournament: Register, Withdraw, Accept invitation. Each asserts `goBack` once and the notice showing, and that no completion screen is shown. |
| (1) other errors keep today's handling | Game Join with a 409 (backend text shown, screen stays), game Leave with a 500, group Leave with a 500, change role with a 500, tournament Register with a 500: no `goBack`, no notice. |
| (2) own action then 404 | Host deletes the game, leave the game, leave the group, owner deletes the group, withdraw from the tournament, organiser cancels the tournament, decline an invitation: completion flow (where one exists) shown, a later 404 closes quietly, notice NOT showing, no "could not leave / withdraw" text. |
| (2) control | A 404 with no own action shows the notice; accepting an invitation whose refetch 404s is not treated as the user's removal. |

## 5. Verification (raw output summary)

```
npx jest             Test Suites: 15 failed, 151 passed, 166 total
                     Tests:       174 failed, 1882 passed, 2056 total
npx tsc --noEmit     exit 0, no output
npm run lint         exit 1: 32 problems (31 errors, 1 warning)
npm run check:labels check-labels: OK - 223 files scanned, 969 default labels checked.
```

- **Failing suites vs `main`: identical.** The 15 failing suites are the same as on `main` (`__tests__/AppForceUpdate`, `config/appConfig`, `src/assets/headerIcon`, `ForceUpdateGate`, `keyboardInventory`, `homeComponents`, `CreateGameScreen`, `EventDetailScreen`, `GroupDetailScreen`, `HomeScreen`, `ProfileScreen`, `ProfileScreenLinks`, `ProfileScreenReportRow`, `ProfileScreenTerms`, `shareLink`) and 174 tests fail on both. `main` has had no `src/` change since `f7e465d` (`e9a0abd` is docs only), so the baseline run at `f7e465d` (144 passed / 15 failed suites, 1800 passed / 174 failed tests) still applies. This branch: +7 passing suites and +82 passing tests over `main` (PR #34's 58 plus this task's 24).
- **Lint.** The 32 problems are the same as on `main` and PR #34: `jest.setup.js`, `scripts/check-labels.js`, `NotificationCard.test.tsx`, `RegistryIcons.test.tsx`. None are in a file this task changed.
- **Coverage delta: none.** The repo has no coverage setup (no `collectCoverage`, no `--coverage` script), and the brief asks for one `npx jest` run.
- **Screenshots: none.** No emulator or device in this cloud run. No UI was added or restyled; the message is the existing `Toast` from PR #34.

## 6. Decisions, deviations and risks

1. **Invite actions are not routed on 404.** The brief lists "join, leave, RSVP, withdraw, member changes". I did not route these: inviting a group or a person to a game (`EventDetailScreen.tsx:290-371`), inviting a member to a group (`GroupDetailScreen.tsx:222-251`), and the tournament invite panel (`TournamentInvitePanel.tsx`). A 404 there can mean the invitee or group being invited is unknown, and the tournament panel already treats a 404 as "the invite feature is off" and hides the actions (`TournamentInvitePanel.tsx:80-84`, covered by `TournamentInvite.test.tsx`). Closing the screen on those would be wrong in the worst case. If the owner wants them routed, the server needs to tell "the game is gone" from "the invitee is unknown". Same for "remove member" and "change role": I followed the brief ("member changes"), but a 404 there could in principle mean "member not found".
2. **Quiet close for own actions without a completion screen.** After Leave a game, Withdraw from a tournament or Decline an invitation, a 404 closes the screen with no message. The brief says to show the completion flow only; none exists for these, so the screen closes silently rather than staying on a page the server no longer shows. If you prefer it stays, or goes to a toast, say so.
3. **`goBack` from a screen that is not in focus.** The quiet close and the message path call `navigation.goBack()` on the detail screen itself. In React Navigation, `goBack` from a screen removes that screen's own route, so it still works if the Completion screen is on top. This is from reading the router, and the unit tests use a navigation double: not checked on a device.
4. **Backend not exercised.** As in PR #34, 404 responses are mocked; nothing was run against the deployed backend.
5. **Two hand-offs not traced end to end on a device:** dismissing the Completion screen with hardware back after `game_cancelled` / `group_deleted` / `group_left`, and `view_game` after `game_updated`. The code path was read (section 2); a quick manual run is worth doing.

## 7. Drift to record (not fixed here)

- `docs/label-inventory-mobile.json`: see section 3.
- `AGENTS.md` says briefs live in `~/meetup/docs/briefs/`, but a copy is in `docs/briefs/` in this repo; the two may differ.
