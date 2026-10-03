# Implementation Report — Mobile skill-level selection UX redesign

Date: 2026-10-03 · Branch: `claude/laughing-fermat-3ytdb2` (base `origin/main` @ `ce481f7`) · Design doc: none (style change, architect-approved). `docs/` design baselines untouched; drift is flagged below only.

## Step 0 (fact-find, as reported before build)

1. **Skill UI.** Profile: `src/screens/ProfileScreen.tsx` (`SkillLevelRow` with tap-to-edit + Remove link, inline add/edit picker, `SKILL_LEVEL_OPTIONS`). Onboarding: `src/components/onboarding/SkillsStep.tsx` (`OptionChips`), wired by `src/onboarding/steps.ts` / `OnboardingScreen.tsx`. API: `getSkillLevels`, `updateSkillLevel` (PUT), `deleteSkillLevel` (DELETE) in `src/api/profile.ts`.
2. **Tournament lock.** Known **only on rejection**: `DELETE /users/me/skill-level/{sport}` → 409, `detail` shown verbatim via `getApiErrorMessage`. No lock flag on `SkillLevel` or any response.
3. **Icons / theme.** Custom `react-native-svg` set (`DashboardIcons.tsx`, `SPORT_ICONS`, `SportIcon`); tint via `sportTileColor` / `sportTileColors` (`dashboardTheme.ts`). No icon library. **No dark mode.** Tokens: `src/theme/tokens.ts`.
4. **iOS.** On origin/main (`ios/` has 9 tracked files). No iOS file was changed.
5. **Labels.** `useLabels()` returns a flat `Record<string,string>`; `getLabel(labels, key)` falls back per key to `FALLBACK_LABELS`, then to the key. The requested keys were absent from the snapshot; the architect decision supplied the strings (below).

Architect decisions applied: stored values stay `'Beginner' | 'Intermediate' | 'Expert'` (the brief's "Advanced" = Expert, violet); display text from `skill_level.beginner/.intermediate/.expert`; `skill_level.all_levels` not used; labels added to `fallbackLabels.ts`.

**Branch note.** The 5 Terms-of-Use commits were already pushed on the session branch; after `git fetch`, `origin/main` had fast-forwarded to the same commit (`ce481f7`), so the session branch **is** origin/main plus this change — no reset/backup needed and no history rewritten. The session only permits pushing to `claude/laughing-fermat-3ytdb2`, so `feat/mobile-skill-level-ux` was not created.

## What was built

New shared set in `src/components/skills/` (no platform forks, no new dependencies):

| File | Role |
|---|---|
| `levels.ts` | Level order/dot count/label+desc keys/tint, all keyed by stored level value; dots = order index + 1 |
| `LevelDots.tsx`, `LevelPill.tsx` | Dots (decorative) and read-only pill (dots + label, level tint) |
| `SportPicker.tsx` | A. 2-column multi-select tiles, tinted circular icon, name, tick badge, `checkbox` role |
| `LevelSegmentedControl.tsx`, `LevelPerSportCard.tsx` | B/C. Per-sport card; 3 `radio` segments (dots above label); descriptor line or `mob_skill_pick_level_hint` |
| `SkillLevelFlow.tsx` | D. Picker → cards → Save; no default level; Save with a missing level shows an inline alert hint (not silently disabled) |
| `MySportRow.tsx`, `BottomSheet.tsx`, `SportLevelSheet.tsx` | E. Read-only row (icon, name, pill, chevron); `Modal` bottom sheet (Android Back → `onRequestClose`; bottom inset via `SafeAreaInsetsContext`, 0 without a provider) |

Files changed: `src/theme/tokens.ts` (`levelColors` bg/text/border per level, `levelColorsUnknown`, `levelDotEmpty`, `skillSizes`), `src/labels/fallbackLabels.ts` (10 keys), `src/screens/ProfileScreen.tsx`, `src/components/onboarding/SkillsStep.tsx`; tests: `src/theme/__tests__/tokens.test.ts` (AA contrast for level tints), `ProfileScreen.test.tsx`, `OnboardingScreen.test.tsx`, new `src/components/skills/__tests__/*` (SportPicker, LevelPerSportCard, SkillLevelFlow, MySportRow), `src/test-utils/skillControls.ts`.

H. Old UI removed: `SkillLevelRow`, `SKILL_LEVEL_OPTIONS`, inline picker + its styles, `OptionChips` use in Profile/SkillsStep (component itself remains; still used by Create Game/Group/Event screens).

## Lock case (F)
**Case B — known only on rejection.** No padlock row state, no extra backend call. The 409 message is shown inside the edit sheet (sheet stays open, entry stays listed, no re-fetch). Covered by test. A modify (PUT) rejection shows the existing generic save error; no lock behaviour is documented for PUT.

## Onboarding step (G)
Exists; its skill UI was replaced with `SkillLevelFlow`. `steps.ts` and `OnboardingScreen.tsx` untouched. Only changed levels are PUT, using the existing lowercased sport key (same as before).

## Drift / behaviour changes to review
1. **AD-5 "every step has Save and Skip"**: on the skills step the first phase (sport picker) shows **Next + Skip**; **Save** appears after Next. "Save with nothing chosen advances" is no longer reachable on step 1 (Next is disabled until a sport is picked; Skip remains). Tests updated accordingly.
2. Old "tap selected level again to unselect" is gone (no-default flow; deselect by untapping the sport). In onboarding, deselecting a sport that already had a level does not delete it (onboarding has no delete).
3. Profile section title "Skill Levels" → "My sports" and "Add" → "Add sport" (labels). The per-row Remove link moved into the sheet (same `Alert` text and `deleteSkillLevel`).
4. No label keys exist for Next/Back/Save/Remove/Cancel, so the screens pass those captions (existing literals) to the components; components themselves contain no user-visible strings. The empty-state "No skill levels declared yet." and error strings are unchanged screen literals. Suggest backend keys later.
5. **Labels fetch replaces, does not merge:** `LabelsProvider` does `setLabels(fetched)`. Per-key merge-over-snapshot happens only because every lookup goes through `getLabel()` (falls back to `FALLBACK_LABELS`). New components use `getLabel` only; a direct `labels[key]` read would not fall back. Covered by a test.
6. A stored level this build doesn't recognise renders a neutral pill with 0 filled dots and the raw text instead of crashing.

## Verification
- `npx tsc --noEmit` and `npx eslint src --ext .ts,.tsx`: clean (run after final edits). Node deps were installed with `npm ci --ignore-scripts` for this (no package file changed).
- **Jest (confirming run, architect-approved exception), tree at `8e84082`, `tsc` and `eslint .` clean:** 112 suites passed / 112, **1396 tests passed / 1396**, 0 failures, no suite "failed to run", and no non-test file under any `__tests__/`. This supersedes the earlier run, which was invalidated by the misplaced helper (now `src/test-utils/skillControls.ts`).
- **Baseline** (separate worktree of origin/main `ce481f7`, same flags): 108 suites, 1362 tests, all passed.

| Coverage | origin/main | this branch (final) |
|---|---|---|
| Statements | 90.94% (3386/3723) | 91.28% (3490/3823) |
| Branches | 84.55% (1900/2247) | 84.77% (1955/2306) |
| Functions | 88.25% (842/954) | 88.90% (889/1000) |
| Lines | 91.22% (3274/3589) | 91.54% (3367/3678) |

New components: 100% lines; branch gaps in `MySportRow` (50%), `LevelSegmentedControl` (89%), `SportPicker` (91%) are the unused `disabled`/default-prop branches.

**Not verified:** nothing was rendered on a device/emulator or simulator (native code can't be built here); visual layout, tint legibility and safe-area/sheet behaviour need the manual QA below.

## Manual QA checklist (run on **both** Android and iOS)
- [ ] Add sport: Profile → Add sport → tiles list only sports not yet set; pick 2 → Next → both cards show "Pick a level to continue", no level preselected → Save with one missing shows red hint and does not save → pick both → Save → rows appear with correct dots/colour (Beginner green 1, Intermediate blue 2, Expert violet 3).
- [ ] Back in the add flow keeps the selection; deselecting a sport drops its card.
- [ ] Change level: tap a row → sheet for that sport only, current level selected, descriptor shown; change → Save → row updates.
- [ ] Delete: Remove in sheet → existing confirm alert → confirm → sheet closes, row gone; Cancel keeps it.
- [ ] Locked state: with an active tournament registration for the sport, Remove → confirm → backend message appears inside the open sheet, row stays, no padlock.
- [ ] Onboarding step 1: tiles → Next → cards → Save advances; Skip advances at both phases; pre-existing levels are preselected.
- [ ] Small screen (iPhone SE and a small Android): 2-column tiles don't clip names, 3 segments fit with long labels, sheet scrolls, Save/Remove reachable above the home indicator.
- [ ] iOS safe areas: sheet bottom padding clears the home indicator; no content under the notch in onboarding.
- [ ] Android hardware/gesture Back closes the sheet (and doesn't leave Profile); backdrop tap closes on both platforms.
- [ ] Touch targets ≥ 44pt (tiles, segments, rows, buttons).
- [ ] Accessibility (TalkBack / VoiceOver): tiles announce as checkboxes with checked state; segments as radios "Sport, Level" with selected state; level is never colour-only (dots + label).
- [ ] Dark mode: app has no dark theme — confirm the new screens stay legible when the OS is in dark mode (light tokens only; no dark support was added).
- [ ] Labels: with the live `/api/labels` seeded, display names/descriptors follow the backend; offline shows the bundled text.
