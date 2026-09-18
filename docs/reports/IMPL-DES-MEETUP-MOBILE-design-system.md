# Implementation Report — Design System Foundation

**Task**: design system foundation (tokens, reusable components, applied to every screen, navigation styling)
**Repo**: pratheeshku/meetup-mobile · **Date**: 2026-09-19
**Commits**: `6878801` (feature), `8833859` (fix: test type errors introduced in `6878801`)

> This report is an as-built record. It does **not** certify the work. Visual
> correctness has not been observed on a device or emulator (see §6), and the
> testing-agent and conformance-review passes have not run.

## 1. Design reference

| | |
|---|---|
| Doc ID | DES-MEETUP-MOBILE |
| Version / status | APPROVED — architect-approved 2026-09-13 |
| Tier | T1 |
| Requirements baseline | REQ-MEETUP-MOBILE |

**Traceability gap (recorded, not resolved):** neither the design document nor
the requirements baseline contains any styling, theming, or design-system
requirement (searched for theme / design system / colour / dark mode /
accessibility / contrast / touch target — no hits relevant to visual design).
This work is therefore **user-directed visual-layer work with no R-ID**. It was
treated as a LOW-severity gap under Propose & Proceed (nothing here touches a
contract, schema, security, or money). `docs/DES-*.md` and `docs/REQ-*.md` were
not edited; only new files under `docs/reports/` were added, following the
existing report convention.

## 2. Traceability map

| Task step | Files | Commit |
|---|---|---|
| Step 1 — design tokens | `src/theme/tokens.ts` | 6878801 |
| Step 2 — components (6 requested) | `src/components/Button.tsx`, `Card.tsx`, `Badge.tsx`, `EmptyState.tsx`, `LoadingView.tsx`, `ErrorView.tsx` | 6878801 |
| Step 2 — additional components (see A2) | `src/components/TextLink.tsx`, `TextField.tsx` | 6878801 |
| Step 3 — screens (10) | `src/screens/{Home,EventDetail,Groups,GroupDetail,Tournaments,TournamentDetail,Profile,Login,Register,NotificationPreferences}Screen.tsx` | 6878801 |
| Step 4 — navigation | `src/navigation/RootNavigator.tsx`, `src/theme/navigationTheme.ts` | 6878801 |
| Tests | `src/components/__tests__/Button.test.tsx`, `Badge.test.tsx` | 6878801, 8833859 |

**Files created (12, verified with `git diff --name-status --diff-filter=A d3952ce HEAD`):** `src/theme/tokens.ts`, `src/theme/navigationTheme.ts`,
`src/components/{Button,Card,Badge,EmptyState,LoadingView,ErrorView,TextLink,TextField}.tsx`,
`src/components/__tests__/{Button,Badge}.test.tsx`.
**Files modified (11):** the 10 screens above + `src/navigation/RootNavigator.tsx`.
**Not modified:** all of `src/auth/`, `src/api/`, `src/storage/`, `src/notifications/`, `App.tsx`, `docs/DES-*`, `docs/REQ-*`, `android/`.

## 3. Proposed Assumptions

Each is the most conservative reading of a gap; for conformance review to ratify or reject.

- **A1 — Additive tokens.** The specified `colors/spacing/radius/typography/shadows` values are unchanged. Added `typography.label` (12/600), `borderWidth`, `opacity`, `sizes`, so the screens contain no remaining sizing literals. All additive.
- **A2 — Two components beyond the six requested.** `TextLink` (text-only inline action: Edit / Invite / Remove / Register link) and `TextField` (TextInput wrapper). Rationale: these patterns repeat across 4–5 screens; centralising gives one place for button semantics, a larger hit area, and — for `TextField` — explicit text/placeholder colours (see A6).
- **A3 — Warning badge colours.** `colors.warning` on `colors.warningLight` measures 2.47:1 (fails AA). Warning badges use `textPrimary` on `warningLight` (15.4:1) instead of the same-hue text. Neutral badge uses `textSecondary` on `background` (4.86:1) with a thin border. Locked in by `Badge.test.tsx`.
- **A4 — `textMuted` is used only where specified.** `textMuted` is 2.92:1 on `surface` and 2.65:1 on `background` (fails AA for text). It is used for the inactive tab tint (as specified) and the Switch off-thumb (non-text). Placeholders use `textSecondary` (5.35:1). See §6 G2.
- **A5 — Badge variant mapping.** RSVP: going→success, waitlisted→warning, none/withdrawn→neutral. Group role: owner/admin→primary, member/none→neutral. Tournament registration: registered→success, withdrawn→warning, none→neutral. Event "Recurring"→neutral.
- **A6 — Explicit text colours everywhere.** `android/app/src/main/res/values/styles.xml` uses `Theme.AppCompat.DayNight.NoActionBar`. In system dark mode, a `Text`/`TextInput` with no explicit colour would render light text on this app's light surfaces. Every text style therefore sets a colour, and inputs go through `TextField`.
- **A7 — Navigation theme.** A fixed light `Theme` (built from tokens) is passed to `NavigationContainer` so screen backgrounds use `colors.background`. `statusBarStyle: 'dark'` is set on every stack because the header is now a light surface. Header back-arrow tint is `colors.primary`; title is `colors.textPrimary`.
- **A8 — Button mapping.** Join / Register / Sign In / Save / Retry → `primary`; Leave / Withdraw / Sign Out / Notification Preferences / row-level Cancel → `secondary`; Cancel Event / Cancel Tournament / Leave Group / Delete Account / Confirm Deletion → `destructive`. Note "Leave Group" was an outlined-red button and is now solid destructive.
- **A9 — Loading affordance.** A loading `Button` keeps its label in layout (opacity 0) under an overlaid spinner so its width doesn't change; it is non-pressable and reports `busy`. It no longer dims to 0.6 while loading (only when `disabled`).
- **A10 — Detail screens use Cards.** Info blocks, member lists, fixtures/registrations, and preferences are wrapped in `Card`; inline notices (cancelled / at-capacity / registration-closed) are local tinted blocks, not a component.
- **A11 — Two small non-visual JSX additions.** `accessibilityRole="tab"` + `accessibilityState.selected` on the tournament Fixtures/Registrations toggles; `accessibilityRole="button"` on Profile skill-level rows; a `(type, index)` map so the last preference row has no divider.
- **A12 — Numeric-literal interpretation.** "No magic numbers" was read as sizing/colour values (font size, padding, margin, radius, border width, width/height, opacity, elevation). Layout constants (`flex: 1`, `numberOfLines={1}`, `zIndex`) and `opacity: 0` (fully hidden label) are not treated as design values.

## 4. Deviations

No approval reference exists for any of these — each needs a decision.

- **D1 — `NotificationBanner.tsx` not converted.** It is a global overlay component, not one of the 10 listed screens, so it was left untouched. It still contains 5 hex literals and several numeric literals (`#1f2937` grey background — off-palette). The literal reading of "no hardcoded hex colors … outside `src/theme/tokens.ts`" is therefore **not** met repo-wide; it is met for the 10 screens, `RootNavigator`, and all new files. Converting it is a ~10-line style-only change awaiting your call.
- **D2 — Google sign-in button unchanged.** `GoogleSigninButton` is a native, brand-controlled component and cannot take tokens.

**Process deviations (mine, disclosed):**

- **P1 — Attribution trailer.** Commit `d3952ce` (previous task, already pushed) contains a `Co-Authored-By` trailer, contrary to the developer instructions. It cannot be removed without a force-push, which is denied. Commits `6878801` and `8833859` have none (verified: see §5).
- **P2 — A commit was pushed with a failing type-check.** `6878801` was pushed while `tsc --noEmit` exited 2 (two TS2367 errors in the new test files). My last tsc run pre-dated writing the tests; Jest (Babel) does not type-check, so it could not catch this. Found by the final evidence run; fixed in `8833859` (test files only, no production code).
- **P3 — Status file cadence.** `implementation-status-DES-MEETUP-MOBILE.md` was created at task start but was not overwritten every 5 minutes — there is no timer in this environment. It was updated at start and at close only.

## 5. Verification results

### Completion Proof

**Test evidence** (raw output — `npx jest`, 3 runs, final code state at `8833859`):

```

Test Suites: 9 passed, 9 total
Tests:       33 passed, 33 total
Snapshots:   0 total
Time:        0.836 s, estimated 1 s
Ran all test suites.
--- Run 1 ---

Test Suites: 9 passed, 9 total
Tests:       33 passed, 33 total
Snapshots:   0 total
Time:        0.644 s, estimated 1 s
Ran all test suites.
--- Run 2 ---

Test Suites: 9 passed, 9 total
Tests:       33 passed, 33 total
Snapshots:   0 total
Time:        0.613 s, estimated 1 s
Ran all test suites.
--- Run 3 ---
```

**Type-check** (`npx tsc --noEmit`):

```
tsc exit: 0
```

**Lint** (`npx eslint . --ext .ts,.tsx`, whole repo):

```
eslint exit: 0
```

**Git evidence** (captured after the last code commit, before this report was committed):

```
8833859 fix(design): correct TypeScript errors in component tests
6878801 feat(design): implement design system tokens and apply consistent visual styling across all screens
d3952ce fix(events): resolve Invalid Date on event end time — correct field mapping and null handling

## main...origin/main
 M implementation-status-DES-MEETUP-MOBILE.md
?? .claude/
```

**File evidence** (primary change exists on disk):

```
$ grep -n "navigationTheme\|tabBarActiveTintColor\|tabBarInactiveTintColor\|tabBarStyle\|headerTitleStyle" src/navigation/RootNavigator.tsx
62:import { navigationTheme } from '../theme/navigationTheme';
105: * `navigationTheme` supplies screen background/card/border colours; these
112:  headerTitleStyle: { color: colors.textPrimary, ...typography.h3 },
120:  headerTitleStyle: { color: colors.textPrimary, ...typography.h3 },
121:  tabBarActiveTintColor: colors.primary,
122:  tabBarInactiveTintColor: colors.textMuted,
123:  tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
282:        theme={navigationTheme}

$ grep -c "from '../theme/tokens'" src/screens/*.tsx
src/screens/GroupDetailScreen.tsx:1
src/screens/EventDetailScreen.tsx:1
src/screens/GroupsScreen.tsx:1
src/screens/NotificationPreferencesScreen.tsx:1
src/screens/HomeScreen.tsx:1
src/screens/LoginScreen.tsx:1
src/screens/TournamentsScreen.tsx:1
src/screens/ProfileScreen.tsx:1
src/screens/RegisterScreen.tsx:1
src/screens/TournamentDetailScreen.tsx:1
```

**Build evidence.** This is a React Native app with no `npm run build` script; the equivalent is a full Metro bundle of the Android entry point, which resolves every import including the new theme and component files:

```

LOG:Writing bundle output to: /private/tmp/claude-502/-Users-pratheesh-Developer-meetup-mobile/43521e9d-42fa-4ef4-a684-18c8d5db2dff/scratchpad/out.android.bundle
LOG:Done writing bundle output
Copying 19 asset files
Done copying assets
bundle exit: 0
1449471 bytes  /private/tmp/claude-502/-Users-pratheesh-Developer-meetup-mobile/43521e9d-42fa-4ef4-a684-18c8d5db2dff/scratchpad/out.android.bundle
```

### Token-hygiene greps

Hex colours outside `src/theme/tokens.ts`, with a positive control (the `tokens.ts` count proves the pattern matches hex):

```
$ grep -rnE "#[0-9a-fA-F]{3,8}" src --include=*.ts --include=*.tsx | grep -v src/theme/tokens.ts | grep -v __tests__
src/components/NotificationBanner.tsx:146:    backgroundColor: '#1f2937',
src/components/NotificationBanner.tsx:152:    shadowColor: '#000',
src/components/NotificationBanner.tsx:158:  title: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 2 },
src/components/NotificationBanner.tsx:159:  body: { color: '#e5e7eb', fontSize: 13 },
src/components/NotificationBanner.tsx:161:  dismissText: { color: '#e5e7eb', fontSize: 16, fontWeight: '600' },

$ (positive control) grep -cE "#[0-9a-fA-F]{3,8}" src/theme/tokens.ts
17
```

Numeric style literals. NOTE: this glob includes `src/components/NotificationBanner.tsx` (pre-existing, out of scope — D1). Every hit outside it is in code from this task; the only one is `Button.tsx:145 opacity: 0` (fully-hidden label, A12):

```
$ grep -nE "<style/number-literal pattern>" screens + RootNavigator + components + navigationTheme
src/components/Button.tsx:145:  hidden: { opacity: 0 },
src/components/NotificationBanner.tsx:131:        hitSlop={12}
src/components/NotificationBanner.tsx:142:    left: 12,
src/components/NotificationBanner.tsx:143:    right: 12,
src/components/NotificationBanner.tsx:145:    elevation: 10,
src/components/NotificationBanner.tsx:147:    borderRadius: 12,
src/components/NotificationBanner.tsx:148:    paddingVertical: 12,
src/components/NotificationBanner.tsx:149:    paddingHorizontal: 14,
src/components/NotificationBanner.tsx:153:    shadowOffset: { width: 0, height: 2 },
src/components/NotificationBanner.tsx:154:    shadowOpacity: 0.25,
src/components/NotificationBanner.tsx:155:    shadowRadius: 6,
src/components/NotificationBanner.tsx:157:  pressable: { flex: 1, marginRight: 8 },
src/components/NotificationBanner.tsx:158:  title: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 2 },
src/components/NotificationBanner.tsx:159:  body: { color: '#e5e7eb', fontSize: 13 },
src/components/NotificationBanner.tsx:160:  dismissButton: { padding: 4 },
src/components/NotificationBanner.tsx:161:  dismissText: { color: '#e5e7eb', fontSize: 16, fontWeight: '600' },
(end)
```

Hex-bearing lines per screen, before (`d3952ce`) → after:

| Screen | before (d3952ce) | after |
|---|---|---|
| HomeScreen | 9 | 0 |
| EventDetailScreen | 14 | 0 |
| GroupsScreen | 9 | 0 |
| GroupDetailScreen | 25 | 0 |
| TournamentsScreen | 9 | 0 |
| TournamentDetailScreen | 23 | 0 |
| ProfileScreen | 31 | 0 |
| LoginScreen | 6 | 0 |
| RegisterScreen | 6 | 0 |
| NotificationPreferencesScreen | 5 | 0 |

### Negative / adversarial checks

- **Mutation check.** Temporarily changed `Button` so `loading` no longer disables the pressable (`isInactive = disabled`). Result: `✕ is not pressable and reports busy while loading` failed (1 failed, 6 passed); file restored byte-identical from a backup, 7/7 pass again.
- **Contrast guard has a negative control.** `Badge.test.tsx` asserts `colors.warning`-on-`warningLight` is < 4.5:1, so the AA assertions can't pass vacuously.
- **Logic preserved (visual layer only).** Compared state-setter / API / navigation / auth / handler lines between `d3952ce` and the working tree for all 10 screens. `HomeScreen`, `GroupsScreen`, `TournamentsScreen`: identical. Every difference in the other seven is render-layer only: inline error blocks → `ErrorView`; `isX && styles.buttonDisabled` style toggles → `Button` `loading`/`disabled` props; `disabled={removingUserId === …}` → `loading={…}` (same non-pressable behaviour); `onPress` moved from `Pressable` to `TextLink`; the A11 additions. No handler, `useState`, API call, or `useAuth` line changed.
- **Two failures found and fixed during verification** (not hidden): a first grep run silently matched nothing because zsh expanded an unquoted `--include=*.ts` glob and aborted — re-run with quoted patterns plus the positive control above; and the tsc failure (P2).

## 6. Known gaps / follow-ups

**G1 — No visual verification. This requires a device or emulator and was not done.** Nothing in this task was observed running: no screenshots were taken, and `npm run android` was not run. The before/after descriptions below are **derived from the code diff, not observed**. Layout risks I cannot rule out from code alone: skill-level chip wrapping, header/tab-bar appearance, `Card` elevation on Android, wrapped button rows on narrow screens.

**G2 — Palette contrast.** As specified, `textMuted` fails AA on both surfaces (2.92:1 / 2.65:1) — the inactive tab labels are affected. Recommend darkening it or using `textSecondary` for inactive tabs.

**G3 — Dark mode.** The app is deliberately light-only. Explicit colours are set (A6) but behaviour on a device in system dark mode is unverified. `App.tsx`'s `StatusBar` still switches on `useColorScheme` (not changed — outside the listed files); stack screens override it with `dark`.

**G4 — Tab bar has no icons configured.** Nothing in this task adds them (no icon library installed; would be a new dependency). What React Navigation renders in that case was not verified here.

**G5 — Tournament/event `status` remains plain text** (`Status: upcoming`), not a `Badge` — no status→variant mapping is specified anywhere, and the task named RSVP/role badges.

**G6 — `EmptyState` has no real illustration** — a placeholder circle stands in (no icon library). It accepts an `icon` node when one exists.

**G7 — Inline action errors** (`errorText`) are still per-screen styles using tokens, not a shared component.

### Before / after by screen (code-derived, not observed — see G1)

| Screen | Before | After |
|---|---|---|
| HomeScreen | Plain white cards with grey border, all-blue "Going/None" pill, default grey page, bare spinner, red text + blue Retry, plain empty text | Cards on `#F0F4FF` with soft shadow; RSVP pill colour-coded (green Going, amber Waitlisted, neutral None); `LoadingView` / `ErrorView` / `EmptyState` (icon circle + title + subtitle); pull-to-refresh spinner in primary blue |
| EventDetailScreen | Bare text on grey, generic blue/red buttons, grey "Recurring" pill | Info in a Card with H2 title; neutral Recurring badge; cancelled / at-capacity as tinted notices; Join primary, Leave secondary (outlined), Cancel Event destructive; 48dp buttons, spinner without width change |
| GroupsScreen | As Home (blue role pill on every card) | Cards; role badges (owner/admin blue, member neutral); shared loading / error / empty views |
| GroupDetailScreen | Unstyled member rows, blue/red text links, small blue buttons, outlined red Leave | Info Card + Members Card; role Badge per member; `TextLink` actions with enlarged hit area; `TextField` invite input with focus border; small Save/Cancel `Button`s; solid destructive Leave Group |
| TournamentsScreen | As Home (blue pill) | Cards; registration badge (green Registered, amber Withdrawn, neutral Not Registered) |
| TournamentDetailScreen | Bare text, blue buttons, 2px grey/blue tab underline, grey rows | Info Card; Register primary / Withdraw secondary; 48dp tab toggles with selected state; fixtures/registrations in a Card; destructive Cancel Tournament; registration-closed as tinted notice |
| ProfileScreen | Bare avatar/header, blue text links, outlined buttons, red delete | Header Card; skill levels in a Card with wrapping chips; `TextField`s; Notification Preferences + Sign Out secondary; destructive Delete Account with confirm-code flow using small `Button`s |
| LoginScreen | Default `TextInput`s, blue button, blue text link | H1 title, `TextField`s, primary `Button`, `TextLink`. Native Google button unchanged (D2) |
| RegisterScreen | As Login | As Login |
| NotificationPreferencesScreen | Plain rows with grey dividers, default Switch | Rows inside a Card; Switch tinted with primary track/thumb; shared loading / error views |
| Navigation (`RootNavigator`) | React Navigation default grey background, default header and tab bar | Token-based theme (`#F0F4FF` screens); white header, `textPrimary` title, blue back arrow; white tab bar, active `#1565C0`, inactive `textMuted`; auth-gate uses `LoadingView` |

### Follow-ups
1. Run the app on a device/emulator (light **and** system dark mode) and review each screen — the single most important next step.
2. Decide on D1 (`NotificationBanner`) and G2 (`textMuted`).
3. Testing-agent pass in a fresh session, then conformance-review (needs this report + the Test Report).


---

## Addendum — 2026-09-19: D1 and G2 addressed (commit `85da015`)

The sections above are left as the original as-built record. Two items they list as open were resolved afterwards:

- **D1 (`NotificationBanner.tsx` not converted) — resolved.** All 5 hex literals (incl. the off-palette `#1f2937`) and all sizing literals now use tokens; a new additive `shadows.overlay` token carries the banner's previous heavier shadow values. Only the import and one `hitSlop` literal changed outside the stylesheet (diffed against the prior commit) — no pan-responder, timer, or handler change. Geometry was snapped to the token scale (inset/padding 12–14 → 16, radius 12 → 10, title weight 700 → 600), so it differs slightly from before; not visually verified (G1 still applies). The repo-wide hex grep outside `tokens.ts` and tests is now empty (positive controls: 21 hits in `tokens.ts`, 5 in the pre-fix banner).
- **G2 (`textMuted` fails AA) — resolved.** `#8B97B5` (2.92:1 / 2.65:1) → `#5E6D94`, computed from the token file: **5.13:1 on `surface` (#FFFFFF), 4.67:1 on `background` (#F0F4FF)**. The page background is the binding constraint. Trade-off: at AA, `textMuted` is nearly as dark as `textSecondary` (#5C6B8A: 5.35:1 / 4.86:1), so the hierarchy between the two text tones is weak. A regression guard (`src/theme/__tests__/tokens.test.ts`) asserts AA for all three text tokens on both surfaces, with a negative control on the old value; a banner render test covers its palette use and legibility. Both guards were mutation-checked (old values restored → they fail).

Final-state evidence for this addendum: `tsc --noEmit` exit 0, `eslint . --ext .ts,.tsx` exit 0, `jest` 11 suites / 44 tests passed on each of 3 runs. Still not done: visual verification on a device (G1), and the testing-agent / conformance-review passes.
