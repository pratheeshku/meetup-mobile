# ui-mobile: BLOCKED REPORT (Part A step 3, contrast gate)

Status: stopped as instructed ("If none passes, STOP and report the numbers"). No source files were changed. Part A steps 1, 2, 4, 5 and all of Part B are NOT started.

## Method
Static read of every colour literal (fill/stroke) in `src/components/icons/DashboardIcons.tsx` and `sportGlyphs.tsx` (83 sport glyphs incl. AllSportsIcon and the fallback ball). WCAG relative-luminance contrast of each glyph's colours against candidate greys, `python3 -I` script (not committed). Rule: a glyph passes if at least one of its colours reaches 3:1; per-glyph "best colour" below.

## Result: no grey in #E6EAF0..#CBD2DC passes for all icons
8 of 83 glyphs have no colour reaching 3:1 against ANY grey in the range (best case shown):

| Glyph | Colours: vs #E6EAF0 / vs #CBD2DC |
|---|---|
| Tennis | #D9F04A 1.05/1.20, #A3B825 1.84/1.46, #FFFFFF 1.21/1.52 |
| AllSports ("All" chip) | #3B82F6 3.05/2.42, #A855F7 3.28/2.60, #F97316 2.32/1.84, #22C55E 1.89/1.50 |
| Walking | #9CA3AF 2.10/1.67, #F59E0B 1.78/1.41 |
| Running | #9CA3AF 2.10/1.67, #F59E0B 1.78/1.41 |
| Breaking | #9CA3AF 2.10/1.67, #F59E0B 1.78/1.41 |
| Diving | #0284C7 3.39/2.69, #38BDF8 1.77/1.41, #9CA3AF 2.10/1.67, #F59E0B 1.78/1.41 |
| Wrestling | #0284C7 3.39/2.69, #F59E0B 1.78/1.41 |
| SpeedSkating | #0284C7 3.39/2.69, #38BDF8 1.77/1.41, #9CA3AF 2.10/1.67, #F59E0B 1.78/1.41 |

Notes:
- Diving, Wrestling, SpeedSkating and AllSports reach 3:1 only at the lightest grey (#E6EAF0), and only on one colour; every darker grey fails them. Tennis (lime/white ball) and Walking/Running/Breaking (amber/grey) fail everywhere in the range. Tennis fails worse as the grey gets darker; the amber ones fail worse as the grey gets darker too, so a darker grey cannot fix them.
- Most other glyphs pass only through dark colours (#1F2937, 9.6-12:1) or red #DC2626; the amber #F59E0B (used in ~60 glyphs) is 1.41-1.78:1 against the grey.
- Selected-chip tinted fills are untouched.

## Decisions needed from the owner
1. Accept the 8 failures as a documented exception (the glyphs are decorative; the label carries the meaning), or
2. Change the glyph artwork (out of scope: "DO NOT change the icons"), or
3. Use a different treatment (e.g. keep the grey circle and add a thin outline, or a lighter grey than #E6EAF0 for these 8, which makes Tennis worse).

## Other notes
- `docs/agent-handoff-template.md` does not exist in the repo; nothing was prepended.
- `~/meetup` (backend repo, boards) is not available in this sandbox. Not needed for ui-mobile, but blocks tl-c-mobile.
- Tests/tsc/lint/check:labels not run (no code changed).
- Git evidence: branch `claude/upbeat-lovelace-lnblk2`, only this report added.
