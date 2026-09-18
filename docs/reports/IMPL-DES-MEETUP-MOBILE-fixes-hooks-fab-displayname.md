# Implementation Report — Consolidated fix: hooks violation, screen registration, FAB menu, display name

*Author's own account, not a certification. Conformance review and the testing agent must verify independently, in fresh sessions.*

## 0. Read this first

1. **Nothing was run on a device or emulator** (`adb devices` listed none). The on-device console errors were not reproduced on hardware. What *was* done: Jest tests that mount **real** React Navigation navigators (native stack + bottom tabs) and reproduce the exact hooks warning on the pre-fix code; `tsc`, ESLint, and a production Android bundle compile. The "manually trace" step in the brief was done by code trace plus those tests, not by tapping through the app (§6.1).
2. **Issue 2 needed no code change.** `CreateGroup`/`CreateTournament` were already registered (commit `c13c941`). I did not verify which build the device was running; that it was an older build is a hypothesis (§6.2).
3. **Three changes go beyond the brief's list** (P1–P3 in §3): an `updateUser` on the auth context, a narrowed `UpdateProfilePayload`, and removal of the now-dead `createTabListeners`.
4. No Co-Authored-By trailer (`git log -1 --format=%B 52250ae | grep -ci co-authored` → `0`).

## 1. Design reference

- Doc ID: DES-MEETUP-MOBILE — APPROVED (2026-09-13), tier T1. `docs/` not edited.
- Baseline: the full-suite baseline was not re-measured at the start of this session (the previous task's report recorded 174 tests / 21 suites; the suite is now 268 tests / 35 suites). `tsc` and ESLint are clean now; my first ESLint run mid-session showed 2 warnings that I introduced and then fixed (§2, Issue 1).

## 2. Per-issue status

| # | Issue | Status | Evidence |
|---|---|---|---|
| 1 | Rules-of-Hooks on Groups tab (and Tournaments) | **Fixed now** — both screens had the identical bug | Root cause below; negative control below |
| 2 | `CreateTournament`/`CreateGroup` not registered | **Already fixed** — no change | `RootNavigator.tsx:189` `name="CreateGroup"`, `:211` `name="CreateTournament"`; `navigate('CreateGroup')`/`('CreateTournament')` are type-checked against `GroupsStackParamList`/`TournamentsStackParamList`, and the `Screen name=` props are typed by the same lists, so a mismatch would fail `tsc`. Real-stack test navigates to a screen registered under that name. |
| 3 | FAB opens Create Game directly | **Fixed now** | New `CreateMenu` (core `Modal` + `View`, no dependency); FAB opens it |
| 4 | Profile/Home use nickname instead of display_name | **Fixed now** | Profile edits `display_name`, shows nickname read-only; Home greeting uses `display_name` |

### Issue 1 — root cause
`headerRight` was set to a module-level component that called `useNavigation()`. React Navigation's native-stack does **not** render that option as a component: `useHeaderConfigProps.tsx:320` calls `headerRight?.({...})` as a plain function inside its own hook. So `useNavigation` became an extra hook in the *host's* hook list, and only after `useLayoutEffect` installed the option → "change in the order of Hooks called by SceneView". The old unit tests did `render(<HeaderRight />)` with a mocked `useNavigation`, the one calling convention the framework does not use, so they could not see it.
Fix: `headerRight: headerAddButton(label, () => navigation.navigate(...))` — a module-level factory returning a hook-free render function that closes over the `navigation` prop. (An inline arrow was tried first and raised two `react/no-unstable-nested-components` ESLint warnings, hence the factory.) Applied to `GroupsScreen` and `TournamentsScreen`.

### Issue 3 — design
- `CreateTabButton` now returns `<CreateFab/>`; hooks live in `CreateFab`, a real component. The tab bar invokes `tabBarButton` as a plain function (`BottomTabItem.tsx:343`), so hooks in `CreateTabButton` itself would have repeated Issue 1's class of bug.
- Tap opens the menu (never calls the tab bar's `onPress`, so the `Create` tab is never focused). Options 🎮 Create Game / 👥 Create Group / 🏆 Create Tournament navigate; the backdrop, a Close button, and the Android back button (`onRequestClose`) dismiss without navigating. Backdrop is a *sibling* of the sheet so taps on the sheet's padding don't close it.
- `useNavigation()` inside the tab bar resolves to the container-level navigation (the tab bar is outside every screen's context). Verified empirically, not assumed — see the end-to-end test.
- Navigation uses `initial: false` so, if the target tab's stack has not been visited yet (tabs are lazy), Back returns to that tab's list rather than leaving the create screen as the only route. Asserted: `[GroupsList, CreateGroup]`, etc.

### Issue 4 — where display_name vs nickname now applies
Changed (addressing the current user): `ProfileScreen` (title, avatar initial, edit field, PATCH body), `HomeScreen`→`GreetingHeader` (via `utils/displayName.getDisplayName`, nickname only as fallback when display name is empty/blank).
Deliberately **unchanged** (audit of `grep -rn nickname src/` minus tests/comments): `RegisterScreen`/`emailAuth`/`AuthContext.register*` (nickname is the unique handle chosen at sign-up); `EventDetailScreen`, `TournamentDetailScreen`, `GroupDetailScreen` (organiser/owner/member = other users' identity); `api/groups.ts`, `api/events.ts`, `api/tournaments.ts` mappers.

## 3. Proposed Assumptions

1. **P1 — `AuthContext.updateUser(patch)` added.** Without it, editing the display name on Profile leaves the Home greeting stale until restart (Home reads the cached auth user). Local merge only; called after a successful save with the refreshed `display_name`. Not called on failure or on empty input (tested). Touches the auth module, which the brief did not name.
2. **P2 — `UpdateProfilePayload` narrowed to `{ display_name?: string }`.** It previously held `nickname?`/`avatar_url?`, neither of which the live `UserUpdate` accepts (per the schema notes already in the code and the brief's "confirmed via live schema"). `tsc` found no other caller. `theme_preference` is accepted by the backend but unused by the app, so not added.
3. **P3 — `createTabListeners` and the `listeners` prop removed.** Dead once the FAB stops intercepting `tabPress`. FAB accessibility label changed `Create Game` → `Create` (with a hint), since it no longer creates a game directly.
4. **P4 — `colors.scrim` (`rgba(13,27,62,.5)` = `textPrimary` at 50%) added as an additive token** for the modal backdrop; no scrim existed.
5. **P5 — Read-only nickname copy:** `Nickname: <nickname> (can't be changed)`. Wording is mine.
6. **P6 — Empty display name is rejected client-side** ("Display name cannot be empty.") as the previous nickname edit did. No max length or other rule was invented; the backend remains the authority.

## 4. Deviations

None from the approved design. (P1–P3 are scope notes above, not deviations from a design clause; flagged for ratification.)

## 5. Verification results

Raw output, all from this session (`.../scratchpad/verify.txt`):

```
$ npx tsc --noEmit
exit=0

$ npx eslint . --ext .ts,.tsx
exit=0

$ npx jest  (run 1)
Test Suites: 35 passed, 35 total
Tests:       268 passed, 268 total
--- Run 1 ---
$ npx jest  (run 2)
Test Suites: 35 passed, 35 total
Tests:       268 passed, 268 total
--- Run 2 ---
$ npx jest  (run 3)
Test Suites: 35 passed, 35 total
Tests:       268 passed, 268 total
--- Run 3 ---
```

`npx react-native bundle --platform android --dev false --entry-file index.js` → `Done writing bundle output` (1,481,543 bytes).

**Negative controls (regression tests fail on the old code):**
- Old `GroupsScreen`/`TournamentsScreen` restored from `HEAD` → `GroupsHeaderNavigation` + `TournamentsHeaderNavigation`: `Tests: 2 failed, 2 total`; the received log was `"React has detected a change in the order of Hooks called by %s…"` — the same message as the device. With the fix: `2 passed`.
- `GroupsScreen.test`'s mocked `useNavigation` now **throws**, so any hook in `headerRight` fails immediately; on old code that test failed (`headerRight must not call hooks such as useNavigation`).
- A first version of the real-stack test put both screens in one file; the *Tournaments* case passed on old code because React logs a hook-order warning once per component name per process. Split into two files (lesson #26).

**New/changed tests:** `CreateMenu.test` (entries, select, Close/backdrop/back-button dismiss), `CreateTabButton.test` (menu opens, navigates, dismissals never navigate, *end-to-end with real tab + stack navigators* asserting focused tab and stack `[List, Create…]`, `Create` never focused), `ProfileScreen.test` (title, read-only nickname line, prefill, PATCH `{display_name}` only, refresh + `updateUser`, empty rejection, failure path), `HomeScreen.test`/`homeComponents.test` (greeting by display name, blank fallback, nickname not shown), `displayName.test`, `profile.test` (`updateProfile` body).

**Test data:** none created; no backend calls made (all API modules mocked).

### Completion Proof

**Test evidence** (raw, from the run above): see three `Tests: 268 passed, 268 total` blocks in §5.

**Git evidence** (at the time of the code commit; the report/reflection commit follows):
```
$ git log --oneline -3
52250ae fix: resolve hooks violation, missing screen registration, FAB menu, and display_name/nickname usage across Profile and Home
8b68464 docs(report): implementation report and reflection for Create Group and Create Tournament
c13c941 feat(create): add Create Group and Create Tournament screens with direct entry points from their respective tabs

$ git status --short   # before adding this report
 M docs/reports/agent-enhancement-2026-09-19.md
 M implementation-status-DES-MEETUP-MOBILE.md
?? .claude/
```
(`.claude/` was untracked before this session and is left uncommitted.)

**File evidence:**
```
$ grep -n "headerRight\|useNavigation" src/screens/GroupsScreen.tsx src/screens/TournamentsScreen.tsx
src/screens/GroupsScreen.tsx:88:      headerRight: headerAddButton('Create Group', () => navigation.navigate('CreateGroup')),
src/screens/TournamentsScreen.tsx:82:      headerRight: headerAddButton('Create Tournament', () => navigation.navigate('CreateTournament')),
  (remaining matches are comments)
$ grep -n 'name="CreateGroup"\|name="CreateTournament"' src/navigation/RootNavigator.tsx
189:        name="CreateGroup"
211:        name="CreateTournament"
$ grep -n "getDisplayName\|display_name" src/screens/HomeScreen.tsx src/screens/ProfileScreen.tsx
src/screens/HomeScreen.tsx:144:        <GreetingHeader name={getDisplayName(user)} />
src/screens/ProfileScreen.tsx:124:        await updateProfile({ display_name: displayNameDraft.trim() }, { correlationId });
```

Migration / build (frontend) evidence: N/A migrations; Android production bundle compiled (above).

## 6. Known gaps / follow-ups

1. **No on-device check.** Please confirm on a device: Groups and Tournaments tabs load with no hooks console error; "+" opens Create Group / Create Tournament; the FAB opens the 3-option menu, each entry navigates, tapping outside / Close / Back dismisses; Profile shows Display Name + read-only Nickname; Home greeting uses the display name and updates after an edit.
2. **Issue 2's cause on the device is unverified.** If it still reproduces on a fresh build of `main`, something other than registration is wrong — the "not handled by any navigator" message would then point at where `navigate` is being called from, which I could not observe. Restart Metro with `--reset-cache` and reinstall first.
3. **`POST /auth/login|register` `user` payload** may not include `display_name` (only `GET /users/me` was schema-confirmed). If absent, the greeting falls back to nickname until the next session restore/`updateUser`; not verified against a live login.
4. **Bottom-sheet insets:** the menu sheet uses fixed bottom padding, not safe-area insets; on gesture-nav devices with a tall inset the Close button could sit close to the edge. Visual check needed.
5. **Design doc drift:** DES §4.4/§4.5 describe Create Group/Tournament but nothing in `docs/` documents the FAB menu; the architect may want it recorded.
6. **Handoff:** next step is the testing agent in a fresh session, then conformance review (needs this report + the Test Report).
