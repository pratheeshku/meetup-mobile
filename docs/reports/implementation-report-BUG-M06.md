# Implementation Report — BUG-M06

Fix HomeScreen sport filter pills to use admin sports list

## 1. Design reference

- Doc ID: DES-MEETUP-MOBILE
- Version/Status: APPROVED, architect-approved 2026-09-13
- Tier: Scaffold (per CLAUDE.md "Active phase"); this ticket is a bug fix
  within HomeScreen's existing §4.3-derived dashboard (itself a documented
  design deviation from §4.3's flat "Event List", already ratified in
  `HomeScreen.tsx`'s file header — unchanged by this ticket)
- Ticket: BUG-M06 (pasted brief, 2026-09-24), unblocked by architect
  direction on the emoji-source question (same date)

## 2. Traceability map

| Ticket requirement | File(s) | Commit |
|---|---|---|
| Pills render one per sport from `GET /admin/sports/public`, reusing `getSports()` — no new endpoint | `src/screens/HomeScreen.tsx`, `src/utils/homeDashboard.ts` (`getSportOptionsFromAdminSports`) | `219271e` |
| "All" stays first/default-selected | `src/components/home/SportFilterPills.tsx` (unchanged — already did this) | n/a |
| Zero-matching-events sport falls through to existing empty-state copy, no new empty state | `src/screens/HomeScreen.tsx` (`upcoming`/`recommended` memos unchanged; only their input `activeSport` source changed) | `219271e` |
| Reuse BUG-M02's map; flag blocked report if it lacks emoji | Investigated `src/utils/labels.ts` (BUG-M02, commits `65e9337`/`afeae33`) — confirmed no emoji; blocked report filed and unblocked by architect direction: reuse `SPORT_EMOJI`/`sportEmoji()` (`src/utils/homeDashboard.ts`) as-is | n/a (investigation) / `219271e` |
| Do not touch ProfileScreen | Verified via `git diff --name-only` — no changes | n/a |

## 3. Proposed Assumptions

1. **Sports list refetch cadence.** Refetched on every `loadDashboard` call
   (initial load and every pull-to-refresh), not cached/one-shot like the
   skill-level pre-select. Rationale: an admin adding/deactivating a sport
   should reach the pill row without requiring an app restart, and
   `GET /admin/sports/public` is documented as unauthenticated/cheap
   (`src/api/sports.ts` header). Conservative, LOW risk — reversible to a
   one-shot fetch with no contract change if this proves too chatty.
2. **Sports-fetch failure handling.** A failed `getSports()` call swallows
   to `[]` (pill row shows only "All"), mirroring the existing
   groups-tile-failure pattern (`getMyGroups()` → `null`) already in this
   same function. Not specified by the ticket; chosen because it's the
   established precedent in this exact code path and events (the primary
   data) remain a full error state, unaffected.
3. **Pill label source.** Uses admin `Sport.display_name` directly (already
   the authoritative casing, same field BUG-M02's `useSportDisplayName`
   resolves to) rather than recomputing via `sportLabel()` on the raw
   `name`. Conservative — avoids a second, potentially divergent casing
   derivation for the same data.
4. **Pill sort order.** Kept alphabetical-by-label, matching the previous
   `getSportOptions(events)` convention, for a pill order stable across
   admin API response-order changes. Not specified by the ticket.

## 4. Deviations

None from the ticket as written. One premise in the ticket itself was
corrected during investigation (see Blocked Report below) — not a
deviation from an approved design, since the ticket's Rules section
explicitly pre-authorized this exact contingency.

## 5. Verification results

### Blocked Report (filed, then unblocked)

Investigated and confirmed the ticket's premise — "the sport emoji/label
map built in BUG-M02" — does not exist as described:
- BUG-M02 (`65e9337`, `afeae33`) built `src/utils/labels.ts`
  (`SKILL_LEVEL_LABELS`, `EVENT_VISIBILITY_LABELS`,
  `TOURNAMENT_VISIBILITY_LABELS`, `useSportDisplayName`) — display-label
  casing/resolution only, zero emoji entries.
- The only sport→emoji map in the repo, `SPORT_EMOJI`
  (`src/utils/homeDashboard.ts`), predates BUG-M02 (introduced in
  `44d8bc8`, the original HomeScreen dashboard rebuild).
- Neither `ProfileScreen` (BUG-M05) nor `CreateGameScreen` render sport
  emoji at all.

Filed per the ticket's own explicit contingency ("flag it in a blocked
report rather than inventing new emoji mappings"). Architect responded
same session: reuse the existing `SPORT_EMOJI` map as-is, no extension, no
new API field, `DEFAULT_SPORT_EMOJI` fallback accepted for sports outside
the 5-entry map. Implemented as directed.

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

### Test evidence (raw output, 3 consecutive full-suite runs)

```
$ npx jest 2>&1 | tail -15
PASS src/theme/__tests__/tokens.test.ts
PASS src/api/__tests__/tournaments.test.ts
PASS src/utils/__tests__/logSafeError.test.ts
PASS src/utils/__tests__/apiError.test.ts
PASS src/api/__tests__/events.test.ts
PASS src/utils/__tests__/formatEventDateTime.test.ts
PASS src/utils/__tests__/displayName.test.ts
PASS src/utils/__tests__/installedVersion.test.ts
PASS src/api/__tests__/profile.test.ts

Test Suites: 66 passed, 66 total
Tests:       800 passed, 800 total
Snapshots:   0 total
Time:        2.432 s, estimated 3 s
Ran all test suites.
--- Run 1 ---
PASS src/api/__tests__/groups.test.ts
PASS src/api/__tests__/sports.test.ts
PASS src/storage/__tests__/tokens.test.ts
PASS src/components/__tests__/HeaderAddButton.test.tsx
PASS src/api/__tests__/cookies.test.ts
PASS src/theme/__tests__/tokens.test.ts
PASS src/api/__tests__/profile.test.ts
PASS src/api/__tests__/users.test.ts
PASS src/utils/__tests__/displayName.test.ts

Test Suites: 66 passed, 66 total
Tests:       800 passed, 800 total
Snapshots:   0 total
Time:        2.274 s, estimated 3 s
Ran all test suites.
--- Run 2 ---
PASS src/api/__tests__/users.test.ts
PASS src/utils/__tests__/playStoreUrl.test.ts
PASS src/utils/__tests__/apiError.test.ts
PASS src/api/__tests__/notifications.test.ts
PASS src/api/__tests__/cookies.test.ts
PASS src/theme/__tests__/tokens.test.ts
PASS src/api/__tests__/sports.test.ts
PASS src/utils/__tests__/logSafeError.test.ts
PASS src/utils/__tests__/formatRelativeTime.test.ts

Test Suites: 66 passed, 66 total
Tests:       800 passed, 800 total
Snapshots:   0 total
Time:        2.208 s
Ran all test suites.
--- Run 3 ---
```

### Negative tests confirmed (new/updated, `HomeScreen.test.tsx`)

- Sport pill exists for a sport with **zero events in the feed**
  (`basketball`) — proves admin-sourced, not feed-derived (the core bug).
- Selecting that zero-match pill falls through to the existing
  Upcoming/Recommended empty-state copy — no new empty state added.
- Admin sports fetch failure degrades the row to "All" only, without
  breaking the rest of the dashboard (events still render, no error state).
- Pre-selected sport (from skill levels) with no matching admin-sport pill
  still falls back to "All".
- A sport pill **persists** across a refresh that removes its last event
  (previously it reset to "All" — now correctly shows the section's empty
  state instead, per the ticket's explicit "no new empty state" rule).
- A sport pill **disappears** (falls back to "All") only when the admin
  list itself drops it on refresh — the still-relevant edge case.

### File evidence

```
$ grep -n "getSportOptionsFromAdminSports" src/utils/homeDashboard.ts src/screens/HomeScreen.tsx
src/utils/homeDashboard.ts:100:export function getSportOptionsFromAdminSports(sports: Sport[]): SportOption[] {
src/screens/HomeScreen.tsx:71:  getSportOptionsFromAdminSports,
src/screens/HomeScreen.tsx:171:  const sports = useMemo(() => getSportOptionsFromAdminSports(adminSports), [adminSports]);
```

### Git evidence

```
$ git log --oneline -3
219271e fix(home): source sport filter pills from admin sports list (BUG-M06)
27e8faa feat(home): pre-select sport filter from user skill levels
2db67f4 Home Screen addendum

$ git status
On branch main
Your branch is ahead of 'origin/main' by 2 commits.
  (use "git push" to publish your local commits)
...
```

(Push evidence captured after this report and the enhancement doc are
committed — see final commit/push block appended below by the session, or
`git log`/`git push` output in the session transcript.)

## 6. Known gaps / follow-ups

- Admin sports outside the existing 5-entry `SPORT_EMOJI` map render with
  the generic `DEFAULT_SPORT_EMOJI` ('🎯') — explicitly accepted for this
  ticket's scope per architect direction, not a defect, but worth a future
  ticket if/when the admin sports catalogue grows meaningfully beyond
  those 5 and visual distinction becomes a real problem.
- `android/version.properties` had a pre-existing unstaged
  `versionCode` bump (15→16) at session start, unrelated to this ticket —
  left untouched, not committed as part of this change.
