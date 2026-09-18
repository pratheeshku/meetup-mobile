# Implementation Report — EventCard rebuild (web-reference layout)

## 1. Design reference

- Doc ID: DES-MEETUP-MOBILE, APPROVED (architect-approved 2026-09-13), Tier T1
- Design section: §4.3 events feed (R-021) governs *that a feed exists*. Like
  the design-system task, this change has **no styling requirement in the
  design doc**; it traces to the user-directed brief "Rebuild EventCard to
  match the actual web app layout", not to a design section / R-ID.
- Code commit: `fdb1896`

### Provenance of the reference layout (read this first)

The layout is **supplied by the user**, who states they inspected the live
web app (meetups.duckdns.org) directly. **I did not open or view the web
app**; nothing in this report is independently verified against it. The
commit message says "verified" because the user's brief prescribes that
wording — it refers to the user's inspection, not mine. Whether the built
card matches the web app visually is **unconfirmed on-device**: the app was
not run on an emulator, and no screenshot comparison was made.

## 2. Traceability map

| Brief item | Implementation | File |
|---|---|---|
| Row 1 pills: sport, category | `Pill` tone `tag` (`primaryLight` bg, `primary` text, 12px/700, uppercase, letter-spacing 0.5, `radius.full`, 6px/12px padding) | `src/components/EventCard.tsx` |
| Row 1 RSVP pill: Going→success, Waitlisted→warning, None→omit | `RSVP_PILL` map; `withdrawn` also omitted | same |
| Row 2 title bold/uppercase/textPrimary, `numberOfLines={2}` | `styles.title` | same |
| Row 3 single inline icon meta line, missing segments dropped with icon | `buildMetaSegments()` joined by ` · ` inside one `Text` | same |
| Container: surface, 1px `colors.border`, `radius.md`, `spacing.md` padding, no shadow | `Card` + style override (`borderWidth.thin`, `borderColor`, `shadowOpacity 0`, `shadowRadius 0`, `elevation 0`) | same |
| Card margin / edge margin `spacing.md` | `marginBottom: spacing.md` on card; horizontal from existing `listContainer` padding (unchanged) | same / `HomeScreen.tsx` |
| Replace prior card layout | Inline card JSX, `RSVP_BADGE_*` maps, unused imports removed; renders `<EventCard>` | `src/screens/HomeScreen.tsx` |
| Tests | 17 tests | `src/components/__tests__/EventCard.test.tsx` |

`HomeScreen.tsx` was edited only to render the extracted component and drop
what became unused (there was no separate `EventCard` file before — the
brief allowed extraction). No other screen or shared component was touched;
`Badge`, `Card` and `tokens.ts` are unmodified.

## 3. Proposed Assumptions (for conformance review to ratify or reject)

1. **Skill-level segment (🎯) is never rendered.** `Event` has no skill-level
   field, and no design/audit doc defines one for events (skill levels
   exist only per-user, `GET /users/me/skill-levels`). Nothing was invented;
   the segment is omitted, which the brief's "omit if missing" rule permits.
   **This is a visible difference from the web reference** — needs a
   backend/design answer on where event skill level comes from.
2. **Category pill is derived from `visibility`:** public→PUBLIC,
   group→GROUP, invite→INVITE. The reference lists PUBLIC/GROUP/TOURNAMENT;
   this feed contains events, not tournaments, and `invite` exists in the
   enum but not in the reference. INVITE is the enum value, chosen over
   dropping a pill the brief says is "always present".
3. **Tournament-only pills not built.** "TOURNAMENT" and the emphasised
   "REGISTRATION OPEN" (`colors.primary` bg) pill belong to tournament
   cards; the brief limits this change to the event card, so no socket for
   them was added.
4. **Title 18px (`typography.h3` size, weight raised to 700), meta 13px
   (`typography.caption`).** The brief says "~20px" / "~14px"; the tokens
   have 18/22 and 13/15. Used the existing tokens rather than adding sizes;
   both are ~2px off the approximation. Easy to change to `h2` / `body`.
5. **Pill padding 6px/12px is derived from tokens** (`spacing.xs + spacing.xs/2`,
   `spacing.sm + spacing.xs`) because no 6 or 12 token exists. Letter-spacing
   0.5 is a card-local constant (no letter-spacing token exists). Neither
   adds a colour or a token.
6. **`Badge` not reused for pills.** Its padding/weight/no-letter-spacing do
   not match the reference pill and it cannot be changed under the scope
   rule, so `EventCard` has a local `Pill` using the same token pairings
   (incl. warning = `textPrimary` on `warningLight`). The colour pairings
   are therefore duplicated in two places.
7. **Shadow removal is done by override, not by editing `Card`.** `Card` is
   shared by other screens, so the event card zeroes `shadowOpacity`,
   `shadowRadius` and `elevation` through its style prop.
8. **Time shown as a range** (`6:00 PM – 8:00 PM`) via the existing
   formatter, not start time only, and the date/time are joined with a comma
   as in the brief's `[date, time]`.
9. **`withdrawn` shows no RSVP pill** (folded into None), as the previous
   card did.
10. **Attendee segment is `👤 n/capacity`** — the brief says `👤 [count]`;
    the previous card showed `n/capacity going`, so capacity is kept.

## 4. Deviations

None from the design doc. Premise mismatch with the brief, not a deviation:
the brief says to replace an "icon-circle/progress-bar approach from the
prior task". **The event card in the repo had neither** (it was a title +
badge header and three text rows; the only icon circle is `EmptyState`,
untouched, and no progress bar exists in `src`). Nothing of that kind was
removed because nothing existed. If a different branch or unpushed work
contains such a card, it was not what this change was built on.

## 5. Verification results

Ran at commit `fdb1896` (plus this report). Not run: the app on an
emulator/device — **no visual verification was performed** by me.

- `npx tsc --noEmit` → no output, `tsc exit: 0`
- `npx eslint . --ext .ts,.tsx` → no output, `eslint exit: 0`
- `npx jest` ×3 → 12 suites / 61 tests, all passing each run (raw output below)
- Negative tests present: RSVP `none` and `withdrawn` render no pill; empty
  location drops `📍` and leaves no stray/double `·`; empty sport renders no
  empty pill; `ends_at: null` renders no dash/"Invalid Date"; no `🎯` ever
  rendered; card has no elevation/shadow.
- Contrast (tested, WCAG AA ≥ 4.5:1): tag `primary` on `primaryLight`,
  `success` on `successLight`, `textPrimary` on `warningLight`.
- Test-caveat: layout assertions read resolved style objects; they confirm
  the styles are applied, not how Android renders them (e.g. emoji glyph
  width, `gap` and wrapping of the meta line are unobserved).

## 6. Known gaps / follow-ups

- **G1 — No on-device/visual check.** Someone should run `npm run android`
  and compare against the web card. Emoji rendering on Android, `gap`
  wrapping of pills, and two-line uppercase titles are untested visually.
- **G2 — Skill level missing from events** (Assumption 1): needs a backend
  contract answer before the 🎯 segment can exist.
- **G3 — Meta line wraps** on narrow screens / long locations (single `Text`
  with no line cap); the brief did not specify a cap.
- **G4 — Tournament card** (`TOURNAMENT`, `REGISTRATION OPEN` pills) still
  uses the old layout; out of scope here.
- **G5 — Pill colour pairings duplicated** between `Badge` and `EventCard`
  (Assumption 6); a shared pill variant would remove it.
- Prior report `IMPL-DES-MEETUP-MOBILE-design-system.md` still describes the
  HomeScreen card as "soft shadow / Badge"; left unedited as a historical
  record, now superseded by this report.

## Completion Proof

**Test evidence** (raw output — `tail -6` per run, full suite):

```
Test Suites: 12 passed, 12 total
Tests:       61 passed, 61 total
Snapshots:   0 total
Time:        1.066 s
Ran all test suites.
--- Run 1 ---

Test Suites: 12 passed, 12 total
Tests:       61 passed, 61 total
Snapshots:   0 total
Time:        0.696 s, estimated 1 s
Ran all test suites.
--- Run 2 ---

Test Suites: 12 passed, 12 total
Tests:       61 passed, 61 total
Snapshots:   0 total
Time:        0.705 s, estimated 1 s
Ran all test suites.
--- Run 3 ---
```

**Type-check / lint evidence:**

```
tsc exit: 0
eslint exit: 0
```

**Git evidence** (captured after the code commit, before this report's commit):

```
fdb1896 feat(design): rebuild EventCard to match verified web app reference layout (pill tags, uppercase title, single icon meta line, border not shadow)
fc2019d docs(report): addendum recording banner conversion and textMuted contrast fix
85da015 fix(design): convert NotificationBanner to token system, fix textMuted WCAG AA contrast failure
```

```
 M docs/reports/agent-enhancement-2026-09-19.md
?? .claude/
```

(`.claude/` was untracked before this session and is intentionally not
committed. The final `git log`/`git status`/push output after the report
commit is given in the hand-off message.)

**File evidence:**

```
$ grep -nE "borderWidth: borderWidth.thin|elevation: 0|numberOfLines=\{2\}|textTransform: 'uppercase'|📅|📍|👤" src/components/EventCard.tsx
8: *   Row 3  ONE inline meta line: 📅 date, time · 📍 location · 👤 n/cap
82:    segments.push(`📅 ${when}`);
85:    segments.push(`📍 ${event.location}`);
87:  segments.push(`👤 ${event.participant_count}/${event.capacity}`);
101:      <Text style={styles.title} numberOfLines={2}>
113:    borderWidth: borderWidth.thin,
117:    elevation: 0,
130:    textTransform: 'uppercase',
136:    textTransform: 'uppercase',
```

Not applicable: migration evidence (no DB), build evidence (`npm run build`
does not apply to this bare-RN app; no Android build was run).
