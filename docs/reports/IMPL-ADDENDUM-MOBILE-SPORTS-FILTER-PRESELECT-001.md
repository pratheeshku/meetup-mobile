# Implementation Report — Mobile Home Screen Sports Filter Pre-Selection

## 1. Design reference

- **Doc ID**: ADDENDUM-MOBILE-SPORTS-FILTER-PRESELECT-001 (standalone; not
  yet folded into `REQ-MEETUP-MOBILE.md`/`DES-MEETUP-MOBILE.md` — see the
  addendum's own §5 Merge Instructions; same pattern as
  `ADDENDUM-MOBILE-SKILL-DELETE-001`)
- **Version / Status**: APPROVED, 2026-09-24 (architect-directed)
- **Tier**: T1 (`R-MOBILE-SPORTS-FILTER-PRESELECT-1`, Must)
- **Scope of this pass**: frontend-only default-value change to
  `HomeScreen.tsx`'s `selectedSport` initial state. No backend change, no
  multi-select rework, no change to `SportFilterPills`' rendering/tap
  behavior or to `getSportOptions(events)`'s data source — all per the
  addendum's explicit non-goals (§3 "Explicitly out of scope").

### Pre-implementation anomaly — the addendum did not exist locally at session start

At session start, `docs/MOBILE-ADDENDUM-sports-filter-preselect.md` did not
exist anywhere in the local repo, in any local/remote branch, or in git
history (`find`, `git log --all -- <path>`, `git branch -a` all came back
empty/absent). Per the Design document acceptance gate, this was treated as
a hard stop and a Blocked Report was issued — no code was touched.

The user then asked to fetch the latest from GitHub. `git fetch --all
--prune` pulled one new commit on `origin/main` (`2db67f4 "Home Screen
addendum"`, author `pratheeshku <pratheeshknow@gmail.com>` — the repo's own
git user), adding exactly `docs/MOBILE-ADDENDUM-sports-filter-preselect.md`
and nothing else. `git merge --ff-only origin/main` fast-forwarded local
`main` cleanly (working tree was already clean). The addendum was then read
in full and its Status confirmed APPROVED before any code was written.

## 2. Traceability map

| Design section / R-ID | Behavior | Files | Notes |
|---|---|---|---|
| Addendum §3/§4, R-MOBILE-SPORTS-FILTER-PRESELECT-1 | Ranking/tiebreak algorithm (expert > intermediate > beginner; tie → most recent `updated_at`; zero rows → `null`) | `src/utils/homeDashboard.ts` (`getPreselectedSportKey`, `skillTier`, `updatedAtMs`) | Pure function, unit-tested independently of the screen |
| Addendum §4 ("also fetch `getSkillLevels()`") | Fetch skill levels alongside `getEvents()`/`getMyGroups()`, under the same correlation ID | `src/screens/HomeScreen.tsx` (`loadDashboard`) | Only fetched on the qualifying load — see Proposed Assumption 2 |
| Addendum §4 ("set `selectedSport`'s initial value... instead of hardcoding `null`") | `selectedSport` seeded from the algorithm's result on first successful load only | `src/screens/HomeScreen.tsx` (`hasAppliedSportPreselectRef`) | See Proposed Assumption 2 |
| Addendum §3 ("falls back to `null`... rather than referencing a nonexistent pill") | No-pill fallback | `src/screens/HomeScreen.tsx` (`activeSport` — pre-existing computation, unmodified) | The existing "sport vanished from feed" fallback already covers this for free (see §3 below) |
| Addendum §4 (interface: `getSkillLevels()` callable from `HomeScreen`) | Export the previously-private function | `src/api/profile.ts` | See Proposed Assumption 1 |
| n/a (supporting) | `updated_at` field on the `SkillLevel` type | `src/types/user.ts` | Optional, defensively consumed — see Proposed Assumption 3 |
| Addendum §3 Test Requirements (all four branches) | Unit + integration tests | `src/utils/__tests__/homeDashboard.test.ts`, `src/screens/__tests__/HomeScreen.test.tsx` | See §5 Verification |

## 3. Design decisions worth recording

- **No new fallback logic needed for "no pill" case.** `HomeScreen.tsx`
  already computes `activeSport = sports.some(s => s.key === selectedSport)
  ? selectedSport : null` for the pre-existing "a refresh removed the
  selected sport's last event" behavior. Since this reads whatever
  `selectedSport` currently holds regardless of how it got there, seeding
  `selectedSport` from the algorithm automatically gets the addendum's
  "falls back to null if no pill" requirement for free — implementing it a
  second time inside `getPreselectedSportKey()` would have duplicated
  existing logic and required threading `events`/`sports` into a function
  that is otherwise a pure function of skill levels alone.
- **Pre-select runs once, on the first successful load only** — not on
  every pull-to-refresh or the post-create-game refetch. The addendum's
  wording ("on screen load... set `selectedSport`'s initial value") and
  item 5's explicit requirement that the user can "freely tap any pill
  afterward" both point at initial-load-only; re-running it on refresh
  would silently override a manual selection the user made in between,
  which nothing in the addendum asks for. Implemented with a
  `hasAppliedSportPreselectRef` guard so a failed initial load (network
  error, user hits Retry) still gets exactly one attempt at pre-selection
  once it does succeed, but refresh/refetch never re-applies it.

## 4. Proposed Assumptions

1. **`getSkillLevels()` exported and called directly from `HomeScreen`**,
   rather than routing through `getProfile()` (which `ProfileScreen`
   actually uses today — it reads `profile.skill_levels`, it does not call
   `getSkillLevels()` directly; that function was previously
   module-private in `src/api/profile.ts`). The addendum's own §4 Design
   section names `getSkillLevels()` explicitly ("also fetch
   `getSkillLevels()`"), and calling it directly avoids `HomeScreen`
   fetching the entire `GET /users/me` profile payload just to get
   `skill_levels`. Minimal interface change (adding `export`, no signature
   change). LOW gap.
2. **Skill levels fetched only on the load that will use them** (first
   successful load), not on every `loadDashboard()` call. The addendum
   says "on screen load," which is ambiguous between "every load" and
   "the initial load"; the conservative reading matching item 5's
   "existing behavior is unaffected" requirement is initial-load-only —
   fetching and reapplying on every refresh would risk visibly
   overwriting a manual selection. MEDIUM gap (behavioral, but the
   addendum itself frames this as a default-only, one-time state seed,
   and the more literal "every load" reading has no way to also satisfy
   "the user can still freely tap any pill afterward" once a refresh
   fires).
3. **`updated_at` added to `SkillLevel` as optional (`updated_at?:
   string`), consumed defensively.** The addendum asserts it is "an
   existing column, no new storage" (§3), but it could not be
   independently confirmed from this repo: no reference to `updated_at`
   exists anywhere in the current source, and the live
   `GET /users/me/skill-levels` OpenAPI response schema is undeclared
   (verified live this session — see §6). A row with a missing/unparseable
   `updated_at` is treated as older than any row with a valid one, so it
   only wins a tie against other equally-unparseable rows, rather than
   crashing or guessing a synthetic recency. LOW/MEDIUM gap — flagged for
   conformance review to confirm against a real authenticated response
   once credentials are available, same posture the codebase already
   takes toward this endpoint's other two fields.
4. **Unrecognised `skill_level` values are excluded from ranking** (tier
   0, never top tier) rather than guessed into a tier. `SkillLevelValue`
   is a closed union (`'Beginner' | 'Intermediate' | 'Expert'`), but the
   endpoint's response shape is unverified end-to-end (see above), so a
   malformed/unexpected value defensively drops out rather than crashing
   `getPreselectedSportKey()` or being ranked arbitrarily. LOW gap.

## 5. Deviations

None. No multi-select rework, no change to `getSportOptions(events)`'s data
source, no stored explicit user preference — all per the addendum's
explicit "Explicitly out of scope" list (§3).

## 6. Verification results

**Live contract re-check** (per this repo's own prior-session precedent —
re-verify a contract claim against the live schema rather than trusting a
report/addendum's assertion at face value where independently checkable):

```
$ curl -s https://meetups.duckdns.org/openapi.json | python3 -c "... paths['/users/me/skill-levels']['get']['responses'] ..."
{
  "200": {
    "description": "Successful Response",
    "content": { "application/json": { "schema": {} } }
  }
}
```

Confirms `GET /users/me/skill-levels` is live and its response schema is
still undeclared (`{}`) — matching `src/api/profile.ts`'s existing comment
exactly, as of this session. No `components.schemas` entry names any
skill-level *read* shape either (only the write-side `UserSkillLevelUpdate
{ sport, skill_level }` is declared). This neither confirms nor refutes the
addendum's `updated_at` claim — no credentials were available for an
authenticated live call — which is why it is handled defensively (Proposed
Assumption 3) rather than assumed.

**Type-check** — clean:
```
$ npx tsc --noEmit
(no output)
```

**Lint** — clean:
```
$ npx eslint . --ext .ts,.tsx
(no output)
```

**Full test suite — one run, verbatim** (per task instruction: "Single run, per standing rule"):
```
$ npx jest
PASS src/notifications/participantHandler.test.ts
PASS src/screens/__tests__/GroupsScreen.test.tsx
PASS src/components/__tests__/DateTimePickerField.test.tsx
PASS src/auth/__tests__/sessionExpiry.test.tsx
PASS src/screens/__tests__/GroupDetailScreen.test.tsx
PASS src/screens/__tests__/TournamentsScreen.test.tsx
PASS src/components/home/__tests__/homeComponents.test.tsx
PASS src/api/__tests__/refresh.test.ts
PASS src/auth/__tests__/silentRefresh.test.tsx
PASS src/components/__tests__/EventCard.test.tsx
PASS src/screens/__tests__/NotificationPreferencesScreen.test.tsx
PASS src/screens/__tests__/TournamentDetailScreen.test.tsx
PASS src/components/__tests__/UserSearchPicker.test.tsx
PASS src/components/__tests__/OptionChips.test.tsx
PASS src/navigation/__tests__/HomeHeader.test.tsx
PASS src/screens/__tests__/LoginScreen.test.tsx
PASS src/components/__tests__/NotificationBanner.test.tsx
PASS src/auth/__tests__/signOutSession.test.ts
PASS src/api/__tests__/versionPolicy.test.ts
PASS src/notifications/eventNotificationHandler.test.ts
PASS src/auth/__tests__/signInNoRefreshToken.test.tsx
PASS src/notifications/__tests__/notificationRouting.test.ts
PASS src/navigation/__tests__/CreateMenu.test.tsx
PASS src/components/__tests__/Button.test.tsx
PASS src/notifications/__tests__/pushRegistration.test.ts
PASS src/utils/__tests__/labels.test.tsx
PASS src/api/__tests__/tournaments.test.ts
PASS src/notifications/__tests__/fcmForeground.test.ts
PASS src/navigation/__tests__/tabIcons.test.tsx
PASS src/api/__tests__/notifications.test.ts
PASS src/screens/__tests__/CreateGameScreen.test.tsx
PASS src/components/__tests__/Badge.test.tsx
PASS src/theme/__tests__/tokens.test.ts
PASS src/utils/__tests__/homeDashboard.test.ts
PASS src/utils/__tests__/playStoreUrl.test.ts
PASS src/utils/__tests__/logSafeError.test.ts
PASS src/auth/__tests__/AuthContext.push.test.tsx
PASS src/components/__tests__/HeaderAddButton.test.tsx
PASS src/components/__tests__/AppHeader.test.tsx
PASS src/auth/__tests__/signOut.test.ts
PASS src/utils/__tests__/localDateTime.test.ts
PASS src/utils/__tests__/formatEventDateTime.test.ts
PASS src/api/__tests__/users.test.ts
PASS src/storage/__tests__/tokens.test.ts
PASS src/utils/__tests__/formatRelativeTime.test.ts
PASS src/api/__tests__/cookies.test.ts
PASS src/api/__tests__/events.test.ts
PASS src/utils/__tests__/apiError.test.ts
PASS src/notifications/__tests__/deviceId.test.ts
PASS src/api/__tests__/sports.test.ts
PASS src/utils/__tests__/installedVersion.test.ts
PASS src/api/__tests__/groups.test.ts
PASS src/api/__tests__/profile.test.ts
PASS src/utils/__tests__/displayName.test.ts

Test Suites: 66 passed, 66 total
Tests:       791 passed, 791 total
Snapshots:   0 total
Time:        2.369 s
Ran all test suites.
```

`src/notifications/__tests__/deviceId.test.ts` is part of the pre-existing
suite (unrelated `deviceId.ts` governance incident flagged in the task
brief) — not touched by this task, passes unchanged, included only because
`npx jest` runs the whole suite.

**Negative/edge cases confirmed passing** (within the 791 above):
- `getPreselectedSportKey`: single top-tier winner (tier ranking correctness), tie broken by `updated_at`, zero rows → `null`, sport-key normalisation, missing/unparseable `updated_at` treated as oldest, unrecognised `skill_level` value ignored rather than guessed (`homeDashboard.test.ts`).
- `HomeScreen`: pre-selects a sport with a matching pill on initial load; falls back to "All" when the pre-selected sport has no rendered pill; `getSkillLevels()` called exactly once and never re-applied on pull-to-refresh, so a manual pill tap survives a refresh; skill-levels fetch shares the same correlation ID as `getEvents()` (`HomeScreen.test.tsx`).
- All 20 pre-existing `HomeScreen.test.tsx` cases pass unchanged, including the pre-existing "falls back to All if a refresh removes the selected sport's last event" regression case (item 5's explicit ask) and the zero-skill-levels-by-default case implicit in every other test's `beforeEach`.

**Git evidence**:
```
$ git status --short
 M src/api/profile.ts
 M src/screens/HomeScreen.tsx
 M src/screens/__tests__/HomeScreen.test.tsx
 M src/types/user.ts
 M src/utils/__tests__/homeDashboard.test.ts
 M src/utils/homeDashboard.ts
?? docs/reports/IMPL-ADDENDUM-MOBILE-SPORTS-FILTER-PRESELECT-001.md
```

**File evidence**:
```
$ grep -n "getSkillLevels\|getPreselectedSportKey\|hasAppliedSportPreselectRef" src/screens/HomeScreen.tsx src/api/profile.ts src/utils/homeDashboard.ts
src/api/profile.ts:85:export async function getSkillLevels(options?: RequestOptions): Promise<SkillLevel[]> {
src/api/profile.ts:100:    getSkillLevels({ correlationId }),
src/screens/HomeScreen.tsx:44:import { getSkillLevels } from '../api/profile';
src/screens/HomeScreen.tsx:62:  getPreselectedSportKey,
src/screens/HomeScreen.tsx:89:  const hasAppliedSportPreselectRef = useRef(false);
src/screens/HomeScreen.tsx:98:    const shouldPreselectSport = !isRefresh && !hasAppliedSportPreselectRef.current;
src/screens/HomeScreen.tsx:111:          shouldPreselectSport ? getSkillLevels({ correlationId }) : Promise.resolve(null),
src/screens/HomeScreen.tsx:117:        hasAppliedSportPreselectRef.current = true;
src/screens/HomeScreen.tsx:118:        setSelectedSport(getPreselectedSportKey(skillLevels ?? []));
src/utils/homeDashboard.ts:187:export function getPreselectedSportKey(skillLevels: SkillLevel[]): string | null {
```

**Migration evidence**: N/A — no backend/database in this repo.

**Build evidence**: N/A — no bundler build step run for this frontend-only,
JS-level change; `tsc --noEmit` and the RN test suite are this repo's
compile/verification gates (per `CLAUDE.md`'s Commands section); both
included above.

## 7. Known gaps / follow-ups

- `updated_at`'s actual presence/shape on the live `GET
  /users/me/skill-levels` response remains unverified end-to-end (Proposed
  Assumption 3) — the OpenAPI schema for this endpoint is undeclared, and
  this session had no credentials for an authenticated live call. If the
  field turns out to be named differently or absent, the tiebreak silently
  degrades to "first row in API response order" among tied top-tier rows
  (still correct/non-crashing, just not "most recent" as specified) rather
  than failing loudly — flagged for conformance review to confirm with
  real credentials.
- The addendum's own §5 Merge Instructions (assign a real R-ID, fold into
  `DES-MEETUP-MOBILE.md`/`REQ-MEETUP-MOBILE.md`, retire the standalone
  file) are unactioned — `docs/` is off-limits to implementation work per
  project convention, same as `ADDENDUM-MOBILE-SKILL-DELETE-001`'s own
  precedent.
- The unrelated `deviceId.ts` governance incident noted in the task brief
  was not touched, resolved, or merged — out of scope, different files, as
  instructed.
