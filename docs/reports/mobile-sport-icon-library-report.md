# mobile-sport-icon-library report

Branch: `feat/sport-icon-library` (from `origin/main`). Not merged.

## Source
`pratheeshku/meetup` main @ `b1c9d275442d754ed5b4af3192b870fd8d2a7e78`, `icons/manifest.json` + `icons/svg/<key>.svg`, read with `gh api` (nothing cloned into the repo). The manifest has 125 entries; the **sport keys are the 84 entries that carry a `group`** (54 summer-olympic, 16 winter-olympic, 14 everyday). UI-only icons (home, bell, trophy, ...) are not sports and were not ported.

## Files changed
- `src/components/icons/sportGlyphs.tsx` (new): 77 `react-native-svg` glyph components generated mechanically from the SVGs (circle, ellipse, path, polygon, rect; viewBox 0 0 48 48; attributes and the literal colours kept exactly as drawn) plus `SPORT_GLYPHS` (key -> glyph). Own `Frame` (decorative: hidden from screen readers) to avoid a circular import.
- `src/components/icons/DashboardIcons.tsx`: `ICON_GLYPHS` now spreads `SPORT_GLYPHS`; the existing 7 (badminton, basketball, football, tennis, volleyball, swimming, sport-marker) untouched. `SportIcon`/`sportSlug`/`hasSportIcon` unchanged.
- `src/sports/iconKeys.ts` (new): `SPORT_ICON_KEYS`, checked-in copy of the 84 keys with a comment naming the source and commit.
- `src/components/icons/__tests__/DashboardIcons.test.tsx`: new "shared sport icon library" tests; the old unknown-key list dropped `curling` (now a real key) and uses `curling-stone` instead.
- No API change, no new dependency, no new label key.

## Sizes checked (render tests)
Every key renders (case-insensitively) at every size the named components use: SportPicker `skillSizes.sportIcon` (32), GameRow/GroupRow `dashSize.rowIcon` (28), HomeTopBar chips (20), NextGameCard/SportChipsRow `dashSize.sportIcon` (38), default 24: viewBox 0 0 48 48, width = size, not the fallback ball. EventCard and UnifiedCard do not render `SportIcon` at all (they use no sport glyph), so nothing to check there.

## Tests (raw)
```
npx jest src/components/icons
Tests: 117 passed, 117 total
```
Covers: 84 unique keys; a glyph for each key at all five sizes; new glyphs hidden from screen readers; `ICON_GLYPHS` keys == the key list exactly; unknown key -> fallback.

## Checks
- `npm run check:labels`: OK - 208 files scanned, 944 default labels checked.
- `npx tsc --noEmit`: clean.
- `npx eslint` on changed files: clean (the one reported error is `RegistryIcons.test.tsx`, an untouched file with a pre-existing unused variable).
- Full suite: branch `15 failed suites / 177 failed tests`, `origin/main` the same; failing-suite lists identical (diff empty). +1,545 passing tests overall vs the earlier baseline due to the new per-key cases.

## Key list (84)
`badminton`, `basketball`, `football`, `tennis`, `sport-marker`, `volleyball`, `swimming`, `cycling`, `walking`, `running`, `hiking`, `yoga`, `fitness`, `dance`, `pickleball`, `padel`, `bowling`, `darts`, `frisbee`, `cricket`, `archery`, `athletics`, `track-and-field`, `race-walking`, `marathon`, `artistic-swimming`, `diving`, `water-polo`, `marathon-swimming`, `baseball`, `softball`, `basketball-3x3`, `beach-volleyball`, `boxing`, `breaking`, `canoe-slalom`, `canoe-sprint`, `road-cycling`, `track-cycling`, `mountain-biking`, `bmx-racing`, `bmx-freestyle`, `equestrian`, `fencing`, `field-hockey`, `flag-football`, `golf`, `artistic-gymnastics`, `rhythmic-gymnastics`, `trampoline`, `handball`, `judo`, `karate`, `lacrosse`, `modern-pentathlon`, `rowing`, `rugby-sevens`, `sailing`, `shooting`, `skateboarding`, `sport-climbing`, `squash`, `surfing`, `table-tennis`, `taekwondo`, `triathlon`, `weightlifting`, `wrestling`, `alpine-skiing`, `biathlon`, `bobsleigh`, `cross-country-skiing`, `curling`, `figure-skating`, `freestyle-skiing`, `ice-hockey`, `luge`, `nordic-combined`, `short-track`, `skeleton`, `ski-jumping`, `snowboarding`, `speed-skating`, `ski-mountaineering`

## Deviations / decisions for you
1. **Unknown-key fallback.** Your brief says unknown keys fall back to `sport-marker`, but the existing `SportIcon` (and its existing test) falls back to the neutral `FallbackBallIcon`, and the brief also says to keep `SportIcon`'s behaviour. I kept the neutral ball and tested that. If you want the marker instead, it is a one-line change in `glyphFor` plus two test assertions.
2. Source colours (e.g. `#1F2937` strokes) are kept as drawn per the brief; some are dark and assume a light tile background, as in the existing sport glyphs.
3. The four sport keys that have no SVG in `icons/svg` (badminton, basketball, football, tennis; sourced from the web `dashboard-icons.js`) and volleyball/swimming/sport-marker keep their existing mobile glyphs.
4. No screenshots: no device/emulator in this container. Sizes were verified by render tests, not visually.
5. Reading the backend repo required attaching `pratheeshku/meetup` (read access) to this session.
