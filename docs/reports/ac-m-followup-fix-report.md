# ac-m-followup-fix: report

Task: `ac-m-followup-fix`. Branch `ac/ac-m-followup-fix`, off `ac/ac-m-followup` (PR #35). The PR is opened against `ac/ac-m-followup`, not `main`.

Why: in PR #35 a 404 returned by "change member role" and "remove member" was routed to `closeUnavailableScreen`. For those two a 404 can mean "member not found", not "the screen is gone", so closing was wrong. The code matched the description given for this task (the two catch blocks at `GroupDetailScreen.tsx:~278` and `:~298`), so nothing needed a stop-and-ask.

## 1. Change

`src/screens/GroupDetailScreen.tsx` only (two catch blocks, no other line on the screen):

- `handleSaveRole` (`:262`): the catch is back to `setRoleError(t('mob.group_detail.role_error'))` for every error, 404 included.
- `handleRemoveMember` (`:287`): the catch is back to `setRemoveError(t('mob.group_detail.remove_error'))` for every error, 404 included.

A 404 on either action now shows today's normal error line ("Could not update this group member's role. Please try again." / "Could not remove this group member. Please try again."), the screen stays open, there is no `goBack` and no "no longer available" message. These two blocks went back to exactly what they were before PR #35. No label, screen or colour was added.

Unchanged and still routed through `closeUnavailableScreen` (the `unavailable.onNotFound()` calls): game Join/RSVP, Leave, edit save and host Delete; group Leave and Delete group; tournament Register, Withdraw, Cancel and invitation respond; and every detail fetch (game, group, tournament).

Side effect worth knowing: both actions re-read the group (`getGroup`) inside the same try block. If that re-read returns 404 because the group itself vanished, the user now sees the normal error line instead of the close. The next focus or app foreground fetch of the detail still closes the screen with the message.

## 2. Diff stat

```
 src/screens/GroupDetailScreen.tsx                   | 17 ++++-------------
 src/screens/__tests__/AccessActionNotFound.test.tsx | 21 ++++++++++++++-------
 2 files changed, 18 insertions(+), 20 deletions(-)
```

## 3. Tests changed (`src/screens/__tests__/AccessActionNotFound.test.tsx`)

| Test | Change | Reason |
|---|---|---|
| `remove member 404: goes back, shows the message` → `remove member 404: keeps today's error, no goBack, no notice` | Rewritten | It asserted the old behaviour. Now: no `goBack`, no notice, no completion screen, and the normal remove error is shown. |
| `change role 404: goes back, shows the message` → `change role 404: keeps today's error, no goBack, no notice` | Rewritten | Same. Now: no `goBack`, no notice, no completion screen, and the normal role error is shown. |
| `change role with another error keeps the role error` | One added assertion | It now also checks the role error text is shown (same text as the 404 case, so the two are visibly handled alike). |
| Suite heading | Wording | Notes the two exceptions. |

All other tests are untouched. Count is unchanged: 24 tests in the file, all passing.

## 4. Verification (raw output summary)

```
npx jest             Test Suites: 15 failed, 151 passed, 166 total
                     Tests:       174 failed, 1882 passed, 2056 total
npx tsc --noEmit     exit 0, no output
npm run lint         exit 1: 32 problems (31 errors, 1 warning), same four untouched files as before:
                     jest.setup.js, scripts/check-labels.js,
                     src/components/__tests__/NotificationCard.test.tsx,
                     src/components/icons/__tests__/RegistryIcons.test.tsx
npm run check:labels check-labels: OK - 223 files scanned, 969 default labels checked.
```

- **Failing suites vs `ac/ac-m-followup`: identical.** The same 15 pre-existing suites fail and the failed / passed totals match (174 failed, 1882 passed). I did not touch any of them.
- No device or emulator and no backend were available: the 404 responses are mocked, there are no screenshots, and the repo has no coverage setup, so no coverage delta.
