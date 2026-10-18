# ac-m-refetch: implementation report

Task: `ac-m-refetch` (access consistency, mobile scope AD-8 / AC-10).
Design: `docs/DES-MEETUP-ADDENDUM-access-consistency.md` v1.0. Brief: `docs/briefs/BRIEF-access-consistency-mobile.md`.
Branch: `ac/ac-m-refetch` (off `main` @ `f7e465d`). Not merged; PR opened.

## 1. Audit (before the change)

Line numbers are from `main` @ `f7e465d`, before this task's edits.

### 1.1 Rows or counts kept beyond the screen's life

| # | Where | What it kept | Verdict |
|---|---|---|---|
| A1 | `src/api/groups.ts:183-229` (`HOME_GROUPS_CACHE_KEY`, `getCachedHomeGroups`, `setCachedHomeGroups`) | Group rows in `AsyncStorage`, 24 h | Violates AC-10. Removed. |
| A2 | `src/api/groups.ts:242` | `getGroups({mine:true})` wrote that cache after every success | Removed. |
| A3 | `src/api/groups.ts:252` | `getGroups({mine:true})` returned the cached rows when the live call failed | Removed: the call now rejects. |
| A4 | `src/screens/HomeScreen.tsx:164`, `:241` | Home hydrated the groups list from that cache on mount and on a failed fetch | Removed. |
| A5 | `src/screens/GroupsScreen.tsx:61` | Groups tab hydrated from that cache on mount | Removed. |
| A6 | `src/notifications/unreadCountStore.ts:14` (module `count`) | Bell count held in memory | Kept as a display store, but only the server writes it (see A12). |
| A7 | `src/notifications/fcm.ts:273` | Foreground push did `incrementUnreadBadgeCount()` | Local count arithmetic; removed (brief item 4). |
| A8 | `src/screens/NotificationHistoryScreen.tsx:167`, `:230` and 12 other `updateUnreadCount(prev ± n)` sites | Count computed from the rows on screen and adjusted locally | Removed (brief item 4). |
| A9 | `src/api/home.ts:59-61, 85, 152, 206` (`BANNERS_`, `MENU_`, `LEGAL_LINKS_CACHE_KEY`) | Banners, drawer menu, legal links in `AsyncStorage` | Not a games / tournaments / groups / notifications list. Out of scope; left. |
| A10 | `src/sports/catalog.ts:13` (`let cached`) | Sports catalogue, module cache | Not access-controlled. Out of scope; left. |
| A11 | `src/labels/LabelsContext.tsx` (`AsyncStorage`), `src/notifications/pushRegistration.ts:65`, `src/diagnostics/perfLog.ts` | Labels, a "rationale shown" flag, a perf flag | No game / group rows. Out of scope. |
| A12 | `src/hooks/useUnreadCount.ts:19` (`let inFlight`) | De-duplicates one in-flight request, holds no data | Fine. |
| A13 | `src/navigation/groupCreateDraft.ts:16-27`, `src/navigation/showCompletion.ts:61-64` | In-memory one-shot hand-off (group-create draft, completion screen rows) | Hold the user's own just-submitted values, cleared after use; no server rows. Left. |

### 1.2 `useResource`

`src/hooks/useResource.ts:91` and `:116`: a reload kept the data already held, and a failed reload kept it instead of showing an error. Used by `GamesScreen` (events, sports, profile) and `HomeScreen` (sports, profile, banners). Fixed for lists with an opt-in `{ fresh: true }` load (see 2.1). Sports, profile and banners keep the old behaviour (not access-controlled lists).

### 1.3 Navigation params

`src/navigation/types.ts:35, 47, 76`: `EventDetail { eventId }`, `GroupDetail { groupId }`, `TournamentDetail { tournamentId }`. Params carry ids only. No full object travels through navigation. Push routing (`src/notifications/notificationRouting.ts`) also builds id-only params.

### 1.4 Hooks that hold game lists

`src/hooks/useSportFilter.ts` holds the sport selection and the user's skill sports (not game rows). `src/hooks/useResource.ts` is the only hook that holds fetched rows (see 1.2). No other hook keeps a games list.

### 1.5 When each screen fetched (original behaviour)

| Screen | Fetched | Problem |
|---|---|---|
| Home | mount, focus and foreground, throttled to once per 30 s (`HomeScreen.tsx:322`) | Not "every" focus; rows kept while loading; cached groups |
| All Games (`GamesScreen`) | mount and pull-to-refresh only (`:155`) | No focus / foreground fetch; rows kept |
| All Tournaments (`TournamentsListContent`) | mount only (`:63`) | No focus / foreground fetch |
| Groups | mount only (`GroupsScreen.tsx:98`) + cache | No focus / foreground fetch; cached rows |
| Group detail | `useFocusEffect` (`:143`) | No foreground fetch; 404 showed the generic error view |
| Game detail | mount only (`EventDetailScreen.tsx:224`) | No focus / foreground fetch; 404 showed the generic error view |
| Tournament detail | mount only (`TournamentDetailScreen.tsx:136`) | Same |
| Notifications list | mount only (`NotificationHistoryScreen.tsx:178`) | No focus / foreground fetch; count arithmetic |

### 1.6 Streams and links

No event stream: a search for `EventSource`, `WebSocket`, `text/event-stream`, `/stream`, `realtime` and `socket` in `src/` found nothing, so brief item 5 (STOP and report) does not trigger. There is also no `Linking` listener in the app and no Associated Domains, so deep links other than push taps do not exist today.

## 2. What changed

### 2.1 Refetch rule (AC-10)

- New `src/hooks/useRefetchOnFocus.ts`: fetches on every focus (the first included) and when the app returns to the foreground while that screen is the focused one. Takes the screen's `navigation` prop; a changing key (the id shown) also refetches. No throttle.
- `useResource.load(correlationId, { fresh })`: with `fresh`, the held rows are dropped for the loading state and a failure shows the error state, not the old rows.
- Home: uses the hook, drops the 30 s throttle and the groups cache, clears Home's upcoming and groups rows to the loading state on every focus / foreground (pull-to-refresh and the post-create refresh keep the rows of this open), and ignores a slower, older response.
- All Games: `GamesScreen` bumps a counter on every focus / foreground; the games segment loads `fresh`. The Tournaments segment reloads on every focus / foreground and every time the segment is opened (`reloadKey`).
- Groups: fresh load on every focus / foreground, no cache.
- Group, game and tournament detail: fetch on every focus / foreground. The first load shows the loading view; later ones refresh in place without flashing. Detail screens opened from a push always fetch on mount (nothing is passed except the id).
- Notifications list: every open / focus / foreground starts from nothing and renders exactly what the API returns.

### 2.2 Removed access (404)

- `isNotFoundError()` in `src/utils/apiError.ts`.
- New `src/navigation/accessNotice.ts` (one-shot store + `closeUnavailableScreen(navigation)`) and `src/components/AccessNoticeToast.tsx`, mounted once in `RootNavigator`. It renders the **existing `Toast`** with the new label `mob.access.no_longer_available` ("This is no longer available."). Added to `defaultLabels.ts`.
- A 404 on a game, tournament or group detail fetch (first load, refocus, foreground, or opened from a push) goes back and shows the message once. A second 404 on the same screen is ignored; the store also ignores a second show while one is on screen. If the screen is the stack root (nothing to go back to), the message still shows and nothing crashes.
- No "forbidden", "removed" or permission text exists for this path; a non-404 error (500, offline) keeps the existing error view and does not close the screen.

### 2.3 Notifications and the unread count

- The count is only ever set from `GET /notifications/unread-count`. Removed: the foreground-push increment (`fcm.ts`, now calls `refreshUnreadCount()`), `incrementUnreadBadgeCount`, the "count unread rows in the page" fallback, and every optimistic `± 1` in `NotificationHistoryScreen`. After each mark read / unread / mark-all / undo, the screen reads the count back from the server. The rows still flip optimistically (and roll back on failure), as before.

## 3. Verification

### 3.1 Commands (raw output in the PR conversation / CI; summary here)

```
npx jest          -> Test Suites: 15 failed, 150 passed, 165 total
                     Tests:       174 failed, 1858 passed, 2032 total
npx tsc --noEmit  -> exit 0, no output
npm run lint      -> exit 1: 32 problems (31 errors, 1 warning), all in files this task did not touch
npm run check:labels -> check-labels: OK - 222 files scanned, 969 default labels checked.
```

- **Jest failures are pre-existing.** `main` @ `f7e465d` run the same way: 15 failed, 144 passed, 159 suites; 174 failed, 1800 passed, 1974 tests. This branch: 15 failed, 150 passed, 165 suites; 174 failed, 1858 passed, 2032 tests (+6 suites, +58 passing tests, 0 new failures). The 15 failing suites are identical (`AppForceUpdate`, `appConfig`, `headerIcon`, `ForceUpdateGate`, `keyboardInventory`, `homeComponents`, `CreateGameScreen`, `EventDetailScreen`, `GroupDetailScreen`, `HomeScreen`, `ProfileScreen*` x4, `shareLink`) and the failed-test count is the same (174). None of the new or touched passing suites regressed.
- **Lint failures are pre-existing.** `main` reports 33 problems (`jest.setup.js` `jest` undefined, two test files with unused imports, and so on); this branch reports 32. No changed file appears in the lint output.
- **Coverage delta: not measured.** The repo has no coverage configuration, and the brief asks for one `npx jest` run, so no before / after coverage was produced.

### 3.2 Acceptance tests (all passing)

| Brief | Test | File |
|---|---|---|
| (a) each listed screen refetches on focus | Home, All Games, All Tournaments, Groups, Notifications: "fetches on mount, on every focus, and on app foreground"; "does not refetch on foreground when it is not the focused screen" | `src/screens/__tests__/AccessRefetchLists.test.tsx` |
| (a) detail screens | Game, tournament, group detail: "fetches on mount, on every focus, and on app foreground" | `src/screens/__tests__/AccessRefetchDetails.test.tsx` |
| (b) no previous rows | "renders no previous rows while the fetch is in flight"; "...after a refetch that returns fewer items"; "shows the error state, not the old rows, when the refetch fails" (x5 lists) | `AccessRefetchLists.test.tsx` |
| (c) 404 closes once with the message | "a 404 on open goes back and shows the neutral message once"; "a 404 on a later focus closes the screen once"; "never shows a forbidden / removed message"; "does not close the screen for a server error" (x3 details) | `AccessRefetchDetails.test.tsx` |
| (d) push for a 404 target | `event_changed`, `tournament_invited`, `group_invite` open the detail, which closes with the message and does not crash; a stack-root detail still shows the message | `AccessRefetchDetails.test.tsx` |
| Notifications | count read from the server after a change; not derived from rows when the count call fails | `AccessRefetchLists.test.tsx` |
| Support | `useRefetchOnFocus` (5), `useResource` fresh load (2), access notice store (3), groups never cached (3), foreground push reads the count back (updated `fcmForeground.test.ts`) | `src/hooks/__tests__`, `src/navigation/__tests__`, `src/api/__tests__`, `src/notifications/__tests__` |

Existing test doubles were adjusted only where the behaviour changed on purpose: removed the stale `getCachedHomeGroups` mocks (6 files) and rewrote the old "increments by 1" unread-count tests in `fcmForeground.test.ts`.

### 3.3 Screenshots

None. This cloud run has no emulator or device, so the "no longer available" message was not captured. It is the existing `Toast` (bottom, dark pill) with the text above.

## 4. Deviations, decisions and risks

1. **Backend not exercised.** The backend repo (`~/meetup`) is not available to this run, and the brief says this task starts after `ac-p2-view-rule` and `ac-p3-cascade` are deployed. No new endpoint or field is used (only the existing GETs); the 404 behaviour is covered by mocked responses only. End-to-end check against the deployed backend is still to do.
2. **Neutral message text.** The brief did not give the wording. I used "This is no longer available." under the new key `mob.access.no_longer_available`. The owner can amend it. `docs/label-inventory-mobile.json` (which mirrors the default labels) was **not** updated because `docs/` must not be edited: drift to record.
3. **Existing component.** The message uses `Toast`. It needed a root-mounted host (`AccessNoticeToast`) so it survives the detail screen closing. If a host component counts as new UI, tell me.
4. **Pull-to-refresh keeps the rows.** Only focus / foreground / opening fetch `fresh`. Pull-to-refresh and the post-create refresh keep the rows loaded in the same open, then replace them. This is a reading of "list rows are not persisted past the screen".
5. **Home counts.** The Home tile counts and stats strip (`/home/summary`, profile summary) are refetched on every focus but not cleared while loading. They are numbers, not rows.
6. **More requests.** Home used to fetch at most once every 30 s on focus / foreground; it now fetches on every one. Detail screens now fetch on every focus and foreground too.
7. **Not covered: 404 on an action.** A 404 returned by an action on an open screen (join, leave, group member changes, the follow-up `getGroup` after a role change) is not turned into the close-and-message path. Only the detail **fetches** are. Worth a decision.
8. **Own cancel / delete.** After the organiser cancels or deletes a game, or someone leaves or deletes a group, the screen they come back to will not show the 404 message as long as the detail screen is gone from the stack. I did not check the completion-screen flows on a device.
9. **Stale API surface.** `getCachedHomeGroups` / `setCachedHomeGroups` / `HOME_GROUPS_CACHE_KEY` no longer exist. `clearLegacyHomeGroupsCache()` removes the old entry from devices on the first `getGroups` call.
10. **Lint / test baselines.** Both `npm run lint` and 15 jest suites already fail on `main`; this task did not try to fix them.
