# Report: gv-mobile-bugfix-1 and gv-mobile-bugfix-2

Branch `claude/cool-pascal-84tbeh`, restarted from `origin/main` 905d3e6 (PR #47 already merged). Not self-certified.

## Changes
1. `src/components/home/HomeTopBar.tsx`: `chipIdle` background `'transparent'` -> `sportTileColors.idle` (`#E6EAF0`, imported from `theme/dashboardTheme`). Same token the Games-tab `SportChipsRow` uses. I did not see web's `--hv2-sport-idle` (web repo not available), so the match to web is by the brief's stated value.
2. `src/components/venue/VenueRow.tsx`: removed the `ScreenContainer` wrapper; `sheet` is now a direct child of `backdrop` (`flex: 1`, `justifyContent: 'flex-end'`), so `maxHeight: '90%'` resolves against a real ancestor. Bottom inset read with `useContext(SafeAreaInsetsContext)` and applied as `paddingBottom: spacing.md + insets.bottom` on the sheet, as `BottomSheet.tsx` does. Grabber stays decorative; no drag gesture. Close button, backdrop tap and Android back are untouched. The same component serves game and tournament detail.

Nothing else touched: no web, no other screen, no labels, no versions.

## Checks (raw)
```
npx tsc --noEmit                      -> exit 0
npx eslint VenueRow.tsx HomeTopBar.tsx -> exit 0
npx jest --ci (scoped: src/components/venue, EventDetailGameView, TournamentGameView, HomeTopBar-related)
  Test Suites: 8 passed, 8 total
  Tests:       157 passed, 157 total
```
One scoped run; the full suite was not re-run (the change is two style edits).

## Not done
- **No before/after screenshots and no device check.** No emulator or device exists in this environment, and a Jest render cannot show layout height or safe-area behaviour. Please verify on a device with a home indicator and one without, on both game and tournament detail: the sheet should reach about 90% of screen height with the content reachable via the inner ScrollView, and close, backdrop tap and back should dismiss it.
- The side-by-side check of the idle chip against the Games-tab chips needs eyes on a device.
