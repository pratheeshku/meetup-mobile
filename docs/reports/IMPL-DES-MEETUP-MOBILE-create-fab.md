# Implementation Report — Create Game as a raised center FAB in the bottom tab bar

*Author's own account, not a certification. Conformance review and the testing
agent must verify independently, in fresh sessions.*

## 0. Read this first

1. **Nothing here has been seen on a device or emulator.** `adb devices` listed
   no device and no emulator binary is installed. Jest (`react-test-renderer`),
   `tsc`, ESLint and a production Android JS bundle pass. Placement, the raised
   overhang, the shadow and the **Android touch behaviour of the part of the
   circle that overhangs the bar** are unverified (see §6, item 1).
2. **Scope was extended, with the user's approval.** The brief said "only touch
   RootNavigator.tsx and GreetingHeader.tsx". That cannot hold without breaking
   `tsc`/Jest (details in §4, D1). I asked; the user chose "Extend scope
   minimally". One further file was added beyond that list (D2).
3. **No Co-Authored-By trailer** on the commit (standing rule). `git log -1
   --format=%B | grep -ci co-authored` returned `0`.
4. **The `RootNavigator` wiring itself (tab order, `tabBarButton`, `listeners`)
   has no unit test** — the navigator is not exported and no test mounts it. It
   is covered only by `tsc` and a successful bundle. See §6.

## 1. Design reference

- Doc ID: DES-MEETUP-MOBILE — APPROVED (2026-09-13), tier T1.
- Sections touched: §3.1 (navigation), §4.3 (Create/Edit Event entry point).
- The design does not specify tab-bar composition or a FAB, and no R-ID covers
  it: user-directed UI task, same provenance as the previous header task. The
  design does not conflict (the `CreateGame` route and placeholder screen are
  unchanged).
- Baseline before change: `tsc` 0 errors, Jest 169/169 (20 suites).

## 2. Traceability map

| Brief step | Files | Commit |
|---|---|---|
| Step 1 — remove header Create Game button | `src/components/home/GreetingHeader.tsx` (button, `onCreateGame` prop, `Button` import removed) | `19553b4` |
| Step 2 — center FAB: circular 56dp, raised, `colors.primary`, white "+", platform shadow | `src/navigation/CreateTabButton.tsx` (new) | `19553b4` |
| Step 2 — 5 tabs, FAB physically in the middle | `src/navigation/RootNavigator.tsx` (`Create` screen between Groups and Tournaments; `tabScreenOptions` skips the emoji for `Create`) | `19553b4` |
| Step 3 — tap opens CreateGameScreen, never selected | `CreateTabButton.tsx` (`createTabListeners`: `preventDefault` + `navigate('Home', { screen: 'CreateGame' })`; no `selected` state) | `19553b4` |
| Consequential (D1) | `src/screens/HomeScreen.tsx`, `src/navigation/types.ts`, `src/navigation/tabIcons.tsx` | `19553b4` |
| Tests | `src/navigation/__tests__/CreateTabButton.test.tsx` (new), `src/components/home/__tests__/homeComponents.test.tsx`, `src/screens/__tests__/HomeScreen.test.tsx` | `19553b4` |

Design details: 56dp = `spacing.xxl + spacing.sm`; raise = `-spacing.lg` (24);
`radius.full`; `colors.primary` / `colors.white`; `typography.h1` glyph;
`opacity.pressed`; shadow from `shadows.overlay`, split with `Platform.select`
(`elevation` on Android, `shadow*` props elsewhere). No hardcoded colours or
sizes.

## 3. Proposed Assumptions

- **A1 (LOW)** — FAB diameter has no token. Composed as `spacing.xxl + spacing.sm`
  (= 56) rather than editing `tokens.ts` (outside the approved file set). A
  `sizes.fab` token would be cleaner; left for the architect/user.
- **A2 (LOW)** — Shadow uses the existing `shadows.overlay` token (the heavier,
  floating-overlay elevation) rather than `shadows.card`, since the FAB floats
  above the bar.
- **A3 (LOW)** — The FAB has no text label under it and its accessibility label
  is "Create Game" (role `button`, not `tab`, no `selected` state).
- **A4 (LOW)** — `Create` is excluded from `TAB_EMOJI` (via an
  `EmojiTabName = Exclude<…, 'Create'>` type) instead of given a placeholder
  emoji, so the record still guarantees every *emoji* tab has one.
- **A5 (LOW)** — CreateGame is a screen in the Home stack, so while on it the
  **Home tab shows as active** and the FAB remains visible/tappable (re-tapping
  it is a no-op navigate to the same route). The brief only required that the
  FAB itself never highlights.
- **A6 (LOW)** — Existing tests that asserted the header button were replaced
  with negative tests ("no Create Game control on the header / dashboard")
  rather than deleted outright.

## 4. Deviations

- **D1 — scope beyond the two named files.** *Approval: user, via the scope
  question in this session ("Extend scope minimally (Recommended)").* Forced by
  the change itself, each verified by `tsc`/Jest:
  - `HomeScreen.tsx` passed `onCreateGame` to `GreetingHeader` → type error once
    the prop is removed.
  - `types.ts`: a `Create` route must exist in `AppTabParamList` for a fifth tab.
  - `tabIcons.tsx`: `TAB_EMOJI` was `Record<keyof AppTabParamList, string>`, so
    the new route made it a type error.
  - Two tests asserted the removed button (`homeComponents`, `HomeScreen`).
- **D2 — one new file, `src/navigation/CreateTabButton.tsx`, not in the user's
  approved list.** Chosen so the button and its listener are unit-testable
  without mounting the whole navigator (which pulls in FCM/auth), following the
  existing `HomeHeader.tsx` / `tabIcons.tsx` sibling pattern. *No explicit
  approval — flagging for the user/conformance review to ratify or reject.* The
  alternative was to put it inside `RootNavigator.tsx`.

## 5. Verification results

Raw output is in the Completion Proof below. Summary of what was checked:

- `npx tsc --noEmit` → rc 0, no output. Jest ×3 → 21 suites / 174 tests each.
  ESLint (whole repo) → rc 0.
- Production bundle: `npx react-native bundle --platform android --dev false
  --entry-file index.js …` wrote the bundle (rc 0 from the CLI, "Done writing
  bundle output"); the bundle contains `accessibilityLabel:"Create Game"`.
- **Negative / mutation check:** with `preventDefault()` removed and the target
  screen changed to `EventsList`, `npx jest src/navigation` reported
  `1 failed, 12 passed` — the listener test detects both regressions. File
  restored byte-identical (`diff` clean) afterwards.
- New tests assert: button is labelled "Create Game" with a white "+"; 56dp
  `colors.primary` circle with negative `marginTop`; no `selected` /
  `aria-selected`; `onPress` is forwarded; listener calls `preventDefault` and
  `navigate('Home', { screen: 'CreateGame' })`; header/dashboard render no
  Create Game control.
- Library behaviour checked in `node_modules/@react-navigation/bottom-tabs`
  source, not assumed: the tab item wrapper is `overflow: 'visible'` for the
  default `uikit` variant (it is `'hidden'` for `material`), and the wrapper
  passes `flex` to the custom button via `style`, which `CreateTabButton`
  applies so five slots stay equal width.

## 6. Known gaps / follow-ups

1. **Android touch on the overhang (highest risk).** The circle extends ~19dp
   above the bar. Android historically delivers touches only inside a parent's
   bounds; modern RN honours `overflow: visible` ancestors, and the tab item
   wrapper is `visible`, but I could not confirm the rest of the ancestor chain
   or the behaviour on a device. **Tap the top half of the circle on a real
   device.** If it fails, the fix is a taller tab bar (`tabBarStyle.height`) so
   the overhang is inside bounds.
2. Visual check: 56dp size, 24dp raise, shadow, spacing against the labelled
   tabs, safe-area/gesture-nav bottom inset.
3. No unit test covers the `RootNavigator` wiring (tab order and options).
4. Stale comment: `src/screens/CreateGameScreen.tsx:4` still says the
   "+ Create Game" button "leads somewhere honest" — outside the approved file
   set, left untouched. Comment-only.
5. Optional: add `sizes.fab` to `tokens.ts` (A1).
6. Home stays highlighted while on Create Game (A5) — confirm that's the
   desired UX.

## Completion Proof

**Test evidence** (raw output):

```
$ npx tsc --noEmit; echo "tsc rc=$?"
tsc rc=0

Test Suites: 21 passed, 21 total
Tests:       174 passed, 174 total
Snapshots:   0 total
--- Run 1 ---
Test Suites: 21 passed, 21 total
Tests:       174 passed, 174 total
Snapshots:   0 total
--- Run 2 ---
Test Suites: 21 passed, 21 total
Tests:       174 passed, 174 total
Snapshots:   0 total
--- Run 3 ---

$ npx eslint . --ext .ts,.tsx
eslint rc=0
```

**Git evidence** (taken after the feature commit, before this report's commit):

```
19553b4 feat(navigation): move Create Game to a raised center FAB in the bottom tab bar
de33a83 docs(report): implementation report and reflection for app header and Create Game placeholder
61bd0eb feat(home): add app header with logo and notifications, enable Create Game button with placeholder screen
?? .claude/
```

(`.claude/` is a pre-existing untracked directory, not part of this change.)
The post-report `git log` and the push output are in the session's final message.

**File evidence**:

```
$ grep -rnE 'name="Create"|tabBarButton|Create: undefined|listeners=\{createTabListeners\}|Create Game"' src --include='*.ts' --include='*.tsx' | grep -v __tests__
src/navigation/types.ts:62:  Create: undefined;
src/navigation/CreateTabButton.tsx:31: * `tabBarButton` for the `Create` tab. Only `onPress` (which emits
src/navigation/CreateTabButton.tsx:45:        accessibilityLabel="Create Game"
src/screens/CreateGameScreen.tsx:4: * "+ Create Game" button leads somewhere honest instead of being a
src/navigation/RootNavigator.tsx:230:        name="Create"
src/navigation/RootNavigator.tsx:232:        options={{ tabBarButton: CreateTabButton }}
src/navigation/RootNavigator.tsx:233:        listeners={createTabListeners}
```

Header-button removal: `grep -rn "onCreateGame\|+ Create Game" src | grep -v
__tests__` matched only the stale comment at `CreateGameScreen.tsx:4`
(positive control: the same pattern class does match, so the empty result for
`GreetingHeader.tsx`/`HomeScreen.tsx` is meaningful).

**Build evidence** (frontend changed — production Android JS bundle):

```
LOG:Writing bundle output to: …/scratchpad/index.android.bundle
LOG:Done writing bundle output
Copying 19 asset files
Done copying assets
$ grep -o 'accessibilityLabel:"Create Game"' index.android.bundle
accessibilityLabel:"Create Game"
```
