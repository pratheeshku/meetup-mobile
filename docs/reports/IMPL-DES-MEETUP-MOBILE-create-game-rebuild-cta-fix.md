# Implementation Report — Edit Game CTA Color Fix & Create Game Screen Rebuild

## 1. Design Reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version/Status**: APPROVED — architect-approved 2026-09-13; Create-flow
  amendment (§4.3/§4.5) architect-approved 2026-09-22
- **Tier**: T1
- **Relevant sections**: §4.3 Event Management / Create Flow Amendment
  (field list for Casual Game create — verified to match this
  implementation exactly, see §2 below)
- **Open Items reviewed**: none of OI-6/13/14/15 (the only open items)
  touch this work; no blocking Open Questions.
- **Note on scope**: the exact hex colors, chip-selection styling pattern,
  Group-picker control type, and cost/currency-field restyling are UI
  polish directed by the user's task brief and the referenced mockup
  artifact (`https://claude.ai/artifact/S7V1xJ3912GC78up1v4Nms`,
  `CreateGameForm.dc.html` / `CreateGameKeyboardBefore.dc.html` /
  `CreateGameKeyboardAfter.dc.html`) — the design doc does not specify
  colors or control widgets (confirmed: no `#1D5FA3`/`#C2481F`/chip/sport
  color hits in `docs/DES-MEETUP-MOBILE.md`), consistent with
  `theme/tokens.ts`'s own provenance note that styling traces to
  user-directed tasks, not design R-IDs.

## 2. Traceability Map

| Item | Files | Source |
|---|---|---|
| PART 1: Edit Game CTA blue (#1D5FA3, not accent) | `src/theme/tokens.ts` (new `colors.ctaBlue`), `src/screens/EventDetailScreen.tsx` (`editGameBtn` style) | User instruction; mockup's `cta` prop default `#1D5FA3` |
| PART 2: Sport chips → sport-colored selected state | `src/components/OptionChips.tsx` (new `color`/`selectedColor` props), `src/screens/CreateGameScreen.tsx` (`sportOptions` now carries `color: getSportColor(...)`) | Mockup `CreateGameForm.dc.html`: `SPORT_COLORS` map, sport chip `bg: on ? color : '#ffffff'` |
| PART 2: Skill Level / Visibility chips → neutral #1B1918 selected state | `src/components/OptionChips.tsx`, `src/screens/CreateGameScreen.tsx` (`selectedColor={colors.textPrimary}` on both Casual and Tournament Skill/Visibility chip groups) | Mockup: `NEUTRAL_SELECTED = '#1B1918'` (== `colors.textPrimary`, verified) |
| PART 2: Group → dropdown/picker (conditional on Visibility = Group) | `src/components/DropdownField.tsx` (new), `src/screens/CreateGameScreen.tsx` (`renderGroupPicker` now renders `DropdownField`, shared by both Casual and Tournament forms) | Mockup: native `<select>` for Group; DES §4.3 (`group_id` conditional-required on `visibility === 'group'`, both Casual and Tournament) |
| PART 2: Cost/currency kept and restyled (not removed) on Create | `src/types/event.ts` (`CreateEventInput.estimated_cost_cents`/`estimated_cost_currency`), `src/screens/CreateGameScreen.tsx` (`gCost`/`gCurrency` state, validation, restyled row UI) | Verified live against `events/schemas.py`'s `EventCreate` (`pratheeshku/meetup`, fetched via `gh api` this session) — both fields ARE part of the real create schema; see §3 Proposed Assumption #1 |
| PART 2: CTA blue on Create Game / Create Tournament submit | `src/components/Button.tsx` (new `cta` variant), `src/screens/CreateGameScreen.tsx` (`variant="cta"` on both submit buttons) | Mockup `cta` default `#1D5FA3`; extended to both screen CTAs, not just Casual — see §3 Proposed Assumption #2 |
| THE BUG FIX: keyboard-avoidance on Create Game (Android, the shipped platform) | `src/screens/CreateGameScreen.tsx` (`behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`, was `undefined` on Android) | Mockup `CreateGameKeyboardBefore.dc.html`/`CreateGameKeyboardAfter.dc.html`; user instruction |
| THE BUG FIX: keyboard-avoidance on Edit Game form (EventDetailScreen — same class of bug, checked and fixed) | `src/screens/EventDetailScreen.tsx` (screen wrapped in `KeyboardAvoidingView` for the first time — previously had none at all) | User instruction: "same class of bug likely exists there too — check and report, fix if in scope" |

## 3. Proposed Assumptions

1. **(LOW→resolved by verification) Cost/currency were never actually on
   Create, despite the task's "keep... not removed" framing.** Verified:
   `git log --all -- src/screens/CreateGameScreen.tsx` and a full read of
   the file show cost/currency UI never existed on Create; they existed
   only on the Edit form (`EventDetailScreen.tsx`) until
   `docs/reports/IMPL-DES-MEETUP-MOBILE-builds-a-b-c.md` (BUILD B) removed
   them from Edit, explicitly leaving "Creation forms... untouched" — at
   the time, "untouched" meant "still absent," not "still present."
   Rather than block on this (money/contract-adjacent, normally a
   CRITICAL/HIGH trigger), I fetched the live backend schema directly
   (`gh api repos/pratheeshku/meetup/contents/events/schemas.py`) and
   confirmed `EventCreate` genuinely declares both
   `estimated_cost_cents: Optional[int] = Field(None, ge=0)` and
   `estimated_cost_currency: Optional[str] = Field("USD", min_length=3,
   max_length=3)`. This closes the gap as a normal contract extension:
   added both fields to `CreateEventInput`, wired them through
   `createEvent()` (which passes `input` through verbatim — no change
   needed there), and built the UI using the exact same
   validation/conversion logic the pre-BUILD-B Edit form used (parseFloat
   → round to cents; uppercase 3-letter currency check), which is the
   established, already-reviewed precedent in this codebase for this
   exact pair of fields.
2. **(LOW) CTA blue applied to both "Create Game" and "Create Tournament"
   submit buttons, not just Casual Game's.** The task's mockup only
   depicts the Casual Game view, and Part 1 named only the Edit Game
   button. But both submit buttons live on the same physical screen this
   task calls "the Create Game screen," both were already using the
   generic `Button` "primary" variant (`colors.primary`, #1565C0 — close
   but not identical to the mockup's exact #1D5FA3), and leaving one CTA
   at the old shade while the other used the new one would produce a
   visibly inconsistent pair of near-identical blues on the same screen.
   Applied the new `cta` variant to both.
3. **(LOW) Sport/Visibility chip color treatment on the Tournament side of
   the screen, matching Casual Game's.** The task names
   "Sport/Skill Level/Visibility" without specifying Casual vs. Tournament,
   and both forms share the same `sportOptions` array and the same
   `renderGroupPicker` helper. Tournament has no Skill Level field (by
   design, §4.3), so only Sport/Visibility apply there; extended
   consistently rather than leaving Tournament's chips visually
   inconsistent with Casual's on the same screen. Format/Participation
   chips and the quick-date/mode-toggle chips were left untouched
   (default `colors.primary`) — not named by the task or the mockup.
4. **(LOW) New `colors.ctaBlue` token added rather than repointing the
   existing `colors.primary`.** `colors.primary` (#1565C0) is used by ~30
   call sites app-wide (nav, tab bar, links, badges, the shared `Button`
   "primary" variant, etc.) — repointing it to #1D5FA3 would have been a
   much wider, unrequested blast radius. Added a narrowly-scoped additive
   token instead, used only by the two CTAs this task named plus the two
   Create-screen submit buttons (Assumption #2).

## 4. Deviations

None from the design document. All deviations above are from the *task
brief's own framing* (not from DES-MEETUP-MOBILE), resolved via direct
verification per §3, and recorded as Proposed Assumptions per the
micro-gap exception (LOW/MEDIUM, conservative reading, no contract
invention — the cost/currency fields were verified against the live
backend schema before use, not guessed).

## 5. Current CreateGameScreen.tsx field list and control types (as requested, reported before any change)

**Before this task**, `CreateGameScreen.tsx` was a single screen with a
Casual Game/Tournament segmented toggle (`OptionChips`, default Casual
Game). Casual Game fields: Title (`TextField`), Sport (`OptionChips`,
selected = `colors.primary` for every chip group uniformly), Visibility
(`OptionChips`), conditional Group (`OptionChips`, shown when
Visibility = Group), Skill Level (`OptionChips`), Capacity (`TextField`,
number-pad), Start Date & Time (quick-select `OptionChips` +
`DateTimePickerField`), Venue Name/Address (`TextField`), Description
(`TextField`, multiline), submit `Button` (variant `primary`, i.e.
`colors.primary` blue — not the accent color). No cost/currency fields
existed on Create at all. The screen was wrapped in a
`KeyboardAvoidingView` whose `behavior` was
`Platform.OS === 'ios' ? 'padding' : undefined` — a no-op on Android, the
only platform this app ships (CLAUDE.md). Tournament fields mirrored the
same control set minus Skill Level/Venue Address, plus
Participation/Format/Registration-Close. This is unchanged in this task
except where called out in §2 above (chip colors, Group control type,
cost/currency addition, CTA color, keyboard fix).

`EventDetailScreen.tsx`'s Edit Game form (same class of bug, checked per
instruction): had **no** `KeyboardAvoidingView` at all — the entire screen
(including the multi-field Edit form) was a bare `ScrollView`. Fixed in
this task (see §2).

## 6. Verification Results

### Type-check
```
$ npx tsc --noEmit
(no output — clean)
```

### Lint
```
$ npx eslint . --ext .ts,.tsx
(no output — clean)
```

### Completion Proof

**Test evidence** (raw output, single run — no summaries):
```
$ npx jest
...
Test Suites: 67 passed, 67 total
Tests:       849 passed, 849 total
Snapshots:   0 total
Time:        2.404 s, estimated 4 s
Ran all test suites.
```

**Coverage delta (before/after)** — before = `git stash` to the
pre-task commit (`cf9fda6`), after = this task's working tree, same
`npx jest --coverage` command both times:

| | Before | After | Δ |
|---|---|---|---|
| Statements | 88.20% | 88.32% | +0.12 |
| Branches | 82.56% | 82.84% | +0.28 |
| Functions | 85.02% | 85.26% | +0.24 |
| Lines | 88.46% | 88.58% | +0.12 |
| Test suites | 66 | 67 | +1 (`DropdownField.test.tsx`) |
| Tests | 829 | 849 | +20 |

Per-file coverage for the touched/new files (after):
```
Button.tsx             |     100 |    83.33 |     100 |     100
DropdownField.tsx       |   94.44 |    82.35 |     100 |   93.75
OptionChips.tsx          |     100 |    92.85 |     100 |     100
CreateGameScreen.tsx     |   94.24 |     93.4 |     100 |   94.11
EventDetailScreen.tsx    |   90.44 |    74.86 |    87.5 |   91.66
```

**Git evidence**:
```
$ git log --oneline -3
6c2566e fix(screens): correct CTA blue, fix Android keyboard-avoidance bug, rebuild Create Game controls
cf9fda6 fix(build): add SKIP_VERSION_BUMP / --no-bump escape hatch to build-release-aab.sh
706c245 chore(release): bump versionCode to 21

$ git status --short
(clean)

$ git push
To https://github.com/pratheeshku/meetup-mobile.git
   cf9fda6..6c2566e  main -> main
```

Note: an intermediate commit accidentally included a wide, unrelated
`prettier --write` reformatting pass on `CreateGameScreen.tsx` and
`EventDetailScreen.tsx` (neither file was prettier-clean before this
task under this repo's own config, so the formatter rewrote almost the
whole file). Caught before push by the implausibly large diff stat;
undone with `git reset --soft` (non-destructive) and every edit
manually reapplied without the formatter pass. The pushed commit above
is the corrected, minimal-diff version. See
`docs/reports/agent-enhancement-2026-09-25.md` §9 for the write-up.

**File evidence** (key changes on disk):
```
$ grep -n "ctaBlue" src/theme/tokens.ts src/components/Button.tsx src/screens/EventDetailScreen.tsx src/screens/CreateGameScreen.tsx
src/theme/tokens.ts:  ctaBlue: '#1D5FA3',
src/components/Button.tsx:    background: colors.ctaBlue,
src/components/Button.tsx:    border: colors.ctaBlue,
src/screens/EventDetailScreen.tsx:    backgroundColor: colors.ctaBlue,
src/screens/EventDetailScreen.tsx:    borderColor: colors.ctaBlue,

$ grep -n "behavior={Platform.OS" src/screens/CreateGameScreen.tsx src/screens/EventDetailScreen.tsx
src/screens/CreateGameScreen.tsx:      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
src/screens/EventDetailScreen.tsx:      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
```

**Build evidence**: N/A — no frontend bundling step was run (Android
native build requires an SDK/emulator, unavailable in this session; see
§7 below). Type-check and lint (above) cover the static-analysis surface
that `npm run android` would additionally exercise at the JS layer.

## 7. Known Gaps / Follow-ups

1. **Manual device/simulator keyboard-behavior check could not be
   performed in this session.** The task explicitly required this
   ("a passing test suite doesn't verify this, describe what you actually
   observed"), and I did not skip it silently — I checked thoroughly and
   found no way to do it here:
   - `adb devices` → daemon started, zero attached devices.
   - `emulator` binary not on PATH; no `$ANDROID_HOME`/`$ANDROID_SDK_ROOT`
     set; no AVD images found under the default SDK path.
   - `xcrun simctl` unavailable (no Xcode command-line tools) — and iOS is
     out of scope for this app regardless (Android-only per CLAUDE.md).
   
   What I verified instead: (a) the exact mechanism — the fix changes
   `KeyboardAvoidingView`'s `behavior` prop from `undefined` to `'height'`
   on Android, which is the standard, widely-documented RN fix for this
   exact class of bug, and is the same `behavior="padding"`
   mechanism already shipped and working on this exact screen's iOS path
   before this task; (b) automated tests assert the wrapper resolves to
   `behavior === 'height'` specifically on Android (not `'padding'`, not
   `undefined`) for both `CreateGameScreen` and `EventDetailScreen`; (c)
   `windowSoftInputMode="adjustResize"` is already set in
   `AndroidManifest.xml`, which is the correct manifest-level complement
   to `KeyboardAvoidingView`'s `'height'` behavior on Android (the two are
   meant to work together, not as alternatives). **This gap should be
   closed with an actual on-device/emulator check before this is
   considered fully verified** — flagging for the user or a subsequent
   session with a working Android SDK/emulator attached.
2. Per Assumption #3, chip-color restyling was not extended to
   Format/Participation/quick-date/mode-toggle chips or to
   `EventDetailScreen`'s own Sport edit-chips — out of the task's named
   scope. If a future task wants full visual consistency across every
   chip group in the app, that's a separate, explicitly-scoped follow-up
   (the `OptionChips` extension added here is backward-compatible and
   ready to support it).
3. `CreateGroupScreen.tsx`, `ProfileScreen.tsx`, `GroupDetailScreen.tsx`
   still have bare `ScrollView`s with no `KeyboardAvoidingView` (documented
   as deliberately out-of-scope in
   `docs/reports/IMPL-DES-MEETUP-MOBILE-create-game-datepicker-keyboard.md`
   and not named by this task either) — same class of bug, not touched.
