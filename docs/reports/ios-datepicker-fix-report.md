# Blocked Report: ios-datepicker-fix

Status: **Original: BLOCKED (no documented upstream fix). Continuation: owner chose option C (implemented) and option D (drafted). A and B NOT implemented. UNVERIFIED on iOS 27.** Machine: Claude Code cloud sandbox, not the MacBook. Repo used: `/home/user/meetup-mobile` (`~/Developer/meetup-mobile` does not exist here). Base `origin/main` = `e0b0182`.

## Deviations from the brief
- `docs/agent-handoff-template.md` **does not exist** on origin/main (`git ls-files | grep -i handoff` is empty), so it could not be prepended. Please supply it if required.
- The GitHub tools in this session are scoped to this repo only, so upstream was read through public web pages and the npm registry, not the GitHub API.

## 1. Upstream evidence
Package in use: `@react-native-community/datetimepicker ^9.2.1` (Podfile.lock: `RNDateTimePicker (9.2.1)`).

- npm registry (`https://registry.npmjs.org/@react-native-community/datetimepicker`): dist-tag `latest` = **9.2.1**, published 2026-09-07. Newest versions: 9.2.0 (2026-09-01), 9.2.1 (2026-09-07). **No release newer than the one installed exists.**
- CHANGELOG (https://github.com/react-native-datetimepicker/datetimepicker/blob/master/CHANGELOG.md): 9.0.0 to 9.2.1 entries are Android removals/fixes, event listeners, Flow type, config plugin, Windows. **No entry mentions iOS 26/27, UIDatePicker, spinner or invisible rendering.**
- Issue search (https://github.com/react-native-datetimepicker/datetimepicker/issues?q=is%3Aissue+iOS+27), first page only (32 results): no issue about iOS 26/27 or invisible spinner wheels. Closest, unrelated: [#1014 iOS DatePicker width issue](https://github.com/react-native-datetimepicker/datetimepicker/issues/1014) (width below 280pt, reported on 8.4.4). Later result pages and the web-search index were not exhaustive, so "none found" is not "none exists".
- Verdict: **no documented iOS 27 problem and no documented fix.** The cause is not shown, and I am not claiming one.

## 2. Local code facts (not a cause)
- All iOS pickers use `display="spinner"` with no `textColor`, `themeVariant` or style override: `src/components/DateTimePickerField.tsx:203`, `src/screens/CreateGameScreen.tsx:793,802`, `src/screens/EventDetailScreen.tsx:901,910`.
- The modal picker sits in our own themed container, so a text-vs-background colour clash is possible but **unproven**. The iPhone-vs-iPad difference is unexplained.
- No board for the date/time picker was found under `docs/design*` or in INDEX.md, so any change in look has no board to match.

## 3. Options (none applied)
| Option | What | Trade-off |
|---|---|---|
| A. `display="inline"` on iOS | Calendar-style picker (date) | Changes the look and height (modals/layout). Time mode inline is a compact control. Needs a board; STOP and ask. |
| B. `display="compact"` on iOS | Tappable pill that opens a system popover | Changes the look and interaction; replaces the Cancel/Done modal flow. Needs a board; STOP and ask. |
| C. Explicit iOS theming on the spinner | Pass theme-token `textColor` (iOS spinner prop, added in 2.3.0 per CHANGELOG) and a theme variant, wrapped in a fixed-size themed container | Keeps the spinner look. May do nothing if the wheel is not rendering at all, so it is a diagnostic as much as a fix. Theme tokens only. Smallest change. |
| D. Report upstream and wait | Open an issue with iPhone 16 / iOS 27.0.1 repro | No code risk; no fix timeline; users stay blocked. |

Recommendation: C first as a TestFlight experiment (no look change), D in parallel. A/B only after you approve a board.

## 4. Verification
Not verified. No iOS 27 simulator is available here, and nothing was changed to verify. Confirmation of any future fix needs a **TestFlight build on an iPhone running iOS 27**.

TestFlight steps (once a change exists): install the build on an iPhone 16 / iOS 27.0.1; open Create Game and tap the date and time fields; open Event Detail edit and tap its date/time; open any `DateTimePickerField` modal. Pass = wheels visible in Light and Dark, values change, Done saves. Repeat on an iPad as a regression check.

## 5. Test output (baseline only; code identical to origin/main so delta = 0)
Run on `e0b0182` after `npm ci --ignore-scripts`:
```
npx jest:            Test Suites: 15 failed, 155 passed, 170 total
                     Tests:       174 failed, 1968 passed, 2142 total
npx tsc --noEmit:    exit 0, no output
npm run lint:        ✖ 32 problems (31 errors, 1 warning)
npm run check:labels: check-labels: OK - 225 files scanned, 993 default labels checked.
```
(Jest sample failing line: `config/__tests__/appConfig.test.ts:32`.)

## 6. Git evidence
Only this report was added. Branch `pa/ios-datepicker-fix`. See the final chat message for `git ls-remote` vs local HEAD.

---

# Continuation (owner decision: implement C, draft D)

## What changed
- New `src/components/iosPickerTheme.ts`: `iosPickerThemeProps()` returns `{ themeVariant: 'light', textColor: colors.textPrimary }` on iOS and `{}` on any other platform (theme token, no literal colour).
- Spread into every iOS `DateTimePicker`:
  - `src/components/DateTimePickerField.tsx` (modal)
  - `src/screens/CreateGameScreen.tsx` (date + time inline spinners)
  - `src/screens/EventDetailScreen.tsx` (date + time inline spinners)
- `display="spinner"`, layout, sizes, copy and labels unchanged. Android gets `{}`, so its props are unchanged; its dialog flow is untouched.
- Why light: the pickers sit on `colors.surface` containers. Both props exist in the installed library (`src/datetimepicker.ios.js` passes `textColor` and `themeVariant` to the native view).
- Limitation: the root cause is still not shown. C may have no effect if the wheel is not drawn at all.
- Option D: `docs/reports/ios-datepicker-upstream-issue.md`, a draft, NOT posted. TODOs left for the owner (iPad iOS version, architecture, build type, repro confirmation, workaround outcome).

## Tests
- New `src/components/__tests__/iosPickerTheme.test.ts` (iOS returns props, Android returns `{}`).
- `DateTimePickerField.test.tsx`: iOS modal picker asserts `themeVariant === 'light'` and `textColor === colors.textPrimary`; Android picker asserts both are undefined.
- Gap: the two screens spread the same helper but have no screen-level assertion (their suites, CreateGameScreen/EventDetailScreen, are in the baseline failing set).

Raw tail output, after change vs baseline (origin/main `e0b0182`):
```
                    baseline            after
jest suites failed  15                  15   (same failing files)
jest tests failed   174                 174
jest suites passed  155 / 170 total     156 / 171 total  (+1 new suite)
jest tests passed   1968 / 2142         1970 / 2144      (+2 new tests, +2 new assertions in existing)
tsc --noEmit        exit 0              exit 0
lint                31 errors, 1 warn   31 errors, 1 warn (none in changed files)
check:labels        OK, 225 files       OK, 226 files
```
Delta: **0 new failures.** (Failing-suite lists differ only in timing text.)

## UNVERIFIED. TestFlight verification (needs an iPhone on iOS 27)
This was not tested on any iOS device or simulator, and iOS 27 cannot be run here. Do not treat C as a fix until confirmed.

Ask the friend with the iPhone 16 / iOS 27.0.1 to install the new TestFlight build, Dark Mode off, then:
1. Create Game: tap the date field, then the time field. **Expect:** visible dark-grey wheels with the selected row legible; scrolling changes the value and the field updates.
2. Event Detail (host edit mode): tap the date and time fields. **Expect:** same.
3. Any screen using the date field modal (`DateTimePickerField`). **Expect:** wheels visible above Cancel/Done; Done saves the chosen value; Cancel discards.
4. Repeat once with Dark Mode on. **Expect:** wheels still visible (light variant is pinned).
5. Regression on an iPad: still shows the picker as before.
Pass = wheels visible on all three. Fail = still invisible: then post the option D issue (fill its TODOs) and bring options A/B with a board.
