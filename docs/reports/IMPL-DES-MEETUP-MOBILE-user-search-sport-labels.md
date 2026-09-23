# Implementation Report — UserSearchPicker (BUG-M01 rebuild) + Sport Display-Name Lookup (BUG-M02 remainder)

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version**: APPROVED — architect-approved 2026-09-13; Create-flow amendment (§4.3/§4.5) architect-approved 2026-09-22
- **Status**: APPROVED
- **Tier built against**: T1
- **Requirements baseline**: REQ-MEETUP-MOBILE (APPROVED, architect-approved 2026-09-13)
- **Branch**: `fix/mobile-bug-batch-m01-m05` (continued per instruction — already carries the unrelated Groups-create commits `f8efd71`/`e3fb909`, accepted as-is)

Sections consulted (Data Contracts / Test Requirements / sections built only, per the dynamic-context rule): §4.4 (Groups & Teams), §7.2 (Users), §7.3 (Groups & Teams), §8 (Testing Strategy), and REQ-MEETUP-MOBILE's R-030/R-031.

## Step 0 (mandatory, before any Part 1 code) — `GET /users/search` contract verification

§7.2 and §7.3 list **no** `GET /users/search` endpoint at all — the same class of local-design-excerpt gap this document's own §7 provenance note already accepts for `GET /admin/sports/public` ("committee-governance and admin sports/config endpoint paths verified directly against the running backend codebase"). Resolved the same way, not by guessing:

- Fetched `pratheeshku/meetup`'s `users/router.py` and `users/schemas.py` directly via `gh api`.
- **Confirmed real, not invented.** `search_users(q, exclude_group_id=None, exclude_event_id=None, exclude_team_id=None)`:
  - `q` required; server treats `len(q.strip()) < 1` as `[]` (no minimum-length floor beyond "not empty").
  - `exclude_group_id`, `exclude_event_id`, `exclude_team_id` are three **independent** optional UUID params — `exclude_group_id` is its own real param, not something inferred or assumed from `exclude_event_id` (the task explicitly warned against that assumption; verification showed it wasn't needed — the param already exists).
  - No `Depends(get_current_user)` — unauthenticated, same posture as `GET /admin/sports/public`.
  - Response: `list[UserSearchResult(UserProfile)]`, capped at 10 server-side (`stmt.limit(10)`), matched via `ILIKE` on `nickname`/`display_name`. `pending: bool` — true when the searching context (only meaningful for `exclude_team_id` today) has an outstanding `invited` membership for that user.
- Since the exclude param for groups genuinely exists, the task's fallback instruction ("if no group-exclude param exists, filter client-side using the group member list") did not apply — used the server-side param instead, the correct behaviour per the verified contract.

This is recorded as the provenance basis for `src/api/users.ts`, `src/types/user.ts`'s `UserSearchResult`, and the doc comments in both files — not a Blocked Report, since it follows the exact precedent this design document already sanctions for an equivalent gap.

## 2. Traceability map

| Design section / R-ID | Files | Commit |
|---|---|---|
| §4.4, §7.3, R-031 (group membership invite) | `src/api/users.ts`, `src/components/UserSearchPicker.tsx`, `src/types/user.ts`, `src/screens/GroupDetailScreen.tsx` | `e08dff4` |
| — (test coverage) | `src/api/__tests__/users.test.ts`, `src/components/__tests__/UserSearchPicker.test.tsx`, `src/screens/__tests__/GroupDetailScreen.test.tsx` | `e08dff4` |
| BUG-M02 remainder (no single R-ID; a display-correctness fix, not new functional scope) | `src/utils/labels.ts` (`useSportDisplayName`), `src/components/EventCard.tsx`, `src/screens/EventDetailScreen.tsx`, `src/screens/TournamentDetailScreen.tsx`, `src/screens/TournamentsScreen.tsx`, `src/screens/ProfileScreen.tsx` | `afeae33` |
| — (test coverage) | `src/utils/__tests__/labels.test.tsx`, `src/components/__tests__/EventCard.test.tsx`, `src/components/home/__tests__/homeComponents.test.tsx`, `src/screens/__tests__/EventDetailScreen.test.tsx`, `src/screens/__tests__/TournamentDetailScreen.test.tsx` (new file), `src/screens/__tests__/TournamentsScreen.test.tsx`, `src/screens/__tests__/HomeScreen.test.tsx`, `src/screens/__tests__/ProfileScreen.test.tsx` | `afeae33` |

Prior commits `65e9337`/`51e4631`/`8e24eab` (BUG-M02 label maps, BUG-M04, BUG-M05) are earlier work on this branch from the previous task, not part of this report.

## 3. Proposed Assumptions

1. **UserSearchPicker clears itself on selection** (query + results reset) rather than the parent controlling that. Conservative reading: `onSelect` is a pure "found a user" callback; re-searching for the same text after picking someone has no use case, and every other picker pattern in this codebase (`OptionChips`) is similarly self-contained.
2. **A `pending` result is shown but disabled**, not filtered out. The backend deliberately keeps it visible ("so the inviter can still find them") rather than excluding it — matched that intent literally, greyed out with a "Pending" label instead of a selectable row, since the only documented meaning of `pending` (team context) implies "don't let them invite twice," not "hide."
3. **`GroupDetailScreen`'s invite flow keeps its existing two-step "search → select → Send Invite" shape** (a Button press still triggers `inviteMember`) rather than inviting immediately on selection. Conservative reading: preserves the existing `isInviting`/`inviteError` state machine and Cancel affordance unchanged, minimising the diff to "swap the input mechanism," which is what the task asked for.
4. **`useSportDisplayName`'s cache has no TTL / manual invalidation path** beyond the test-only reset — `GET /admin/sports/public` is a small, rarely-changing admin-curated list (confirmed by `CreateGameScreen`'s own long-standing pattern of fetching it once per screen mount with no refresh mechanism either). A stale sport display name for the remainder of an app session is the same trade-off already accepted there.
5. **EventCard's own doc comment ("purely presentational" language does not appear verbatim, but its "no group-specific/no owned state" spirit) now includes a read-only hook call.** Read as compatible: the component still owns no selection state and takes no new props: it now resolves one more piece of already-implicit data (the sport's display name) the same way `Badge`/`Pill` already format their inputs, not a new architectural role.

## 4. Deviations

None. No behaviour outside the design document or this task's explicit brief was introduced.

## 5. Verification results

```
$ npx tsc --noEmit
(no output — clean)

$ npx eslint . --ext .ts,.tsx
(no output — clean)

$ npx jest
Test Suites: 63 passed, 63 total
Tests:       704 passed, 704 total
Snapshots:   0 total
Time:        2.37 s
```

**Suite/test count delta** (this repo has no coverage-percentage tooling configured — `package.json` only defines `"test": "jest"`, matching CLAUDE.md's command list — so this is the delta actually available):

| | Before this task | After this task |
|---|---|---|
| Test suites | 61 | 63 (+2: `TournamentDetailScreen.test.tsx`, `labels.test.tsx`) |
| Tests | 691 | 704 (+13) |

New tests added, by area:
- `api/users.test.ts` (2): `q`-only call shape; `exclude_group_id` passthrough with the other excludes left `undefined`.
- `UserSearchPicker.test.tsx` (9): below-threshold no-search; debounce coalesces rapid typing into one call; `exclude*Id` passthrough; results render nickname+display name; empty state; error state; selection clears the picker and calls `onSelect`; a `pending` result is shown but not selectable; a slow earlier response can never overwrite a newer one (stale-response guard).
- `GroupDetailScreen.test.tsx` (5, new file): the free-text "User ID" field is gone; search excludes the current group and lets a found user be invited; Send Invite is disabled with nothing chosen; "Change" returns to the picker; invite failure shows an error and keeps the form open.
- `labels.test.tsx` (5, new file): raw-slug-then-upgrade timing; unknown-slug fallback; fetch-failure fallback; single fetch shared across two components; a component mounted after the cache warms renders resolved immediately with no refetch.
- Plus one new assertion each in `EventCard.test.tsx`, `EventDetailScreen.test.tsx`, `TournamentsScreen.test.tsx`, and two in `ProfileScreen.test.tsx`, `TournamentDetailScreen.test.tsx` (new file, 2 tests) verifying the resolved-vs-fallback sport label specifically.

**Negative/adversarial coverage relevant to this change** (§8.2/§8.3 posture — proportional, not the auth/check-in-tier coverage those sections mandate for higher-risk flows): search failure (network error) surfaces an inline error, not a crash; an unknown/never-loaded sport slug never renders blank or throws; a stale (superseded) search response can never clobber a newer one's results; invite failure leaves the form open with an error rather than silently discarding the user's selection.

**A real regression caught and fixed during verification, not shipped**: initially, wiring `useSportDisplayName` into `EventCard` caused two existing test files that render it transitively (`homeComponents.test.tsx`, `HomeScreen.test.tsx`) to make a real, unmocked `GET /admin/sports/public` call during test runs (surfaced as a `console.error` "state update not wrapped in act(...)" warning from a promise resolving after test teardown). Fixed by adding `api/sports` mocks to both files before considering this done — verified by re-running the full suite and confirming the warning is gone.

## 6. Known gaps / follow-ups

- **Sport slug fixes are per-screen fetches of the display map, not a single global preload.** `useSportDisplayName`'s module-wide cache means only the *first* screen to mount pays the fetch cost; every other screen in the same app session reuses it synchronously. This is intentionally not a bigger "preload sports at app boot" change — out of scope for a labels-lookup fix.
- **`ProfileScreen` now calls `GET /admin/sports/public` twice** on mount from two independent call sites: its own `OptionChips` sport-picker fetch (added in the prior BUG-M05 task, needs the full `Sport[]` for `{value, label}` pairs) and `useSportDisplayName`'s shared cache (needs only a slug→name map, used by `SkillLevelRow`). Not unified in this task — the two call sites want different-shaped data from the same endpoint, and unifying them would mean extending the shared cache to also expose the full `Sport[]`, a larger refactor than "add a lookup and route five screens through it." Flagged for a follow-up, not silently done.
- **`UserSearchPicker`'s `excludeTeamId`/`pending` handling is exercised by tests but has no real caller yet** — Team invite doesn't exist on mobile (per this task's brief, the component is built now so that a future Team invite task reuses it unchanged). This is deliberate forward design, not dead code shipped without a consumer of its primary path (`excludeGroupId`, which `GroupDetailScreen` does use).
- **`TournamentDetailScreen.test.tsx` and its screen had zero test coverage before this task.** Added narrow, purpose-built coverage for the sport-label fix only (2 tests) — a full behavioural suite for its registration/fixtures/cancel flows remains a pre-existing gap, unrelated to this task's scope, not backfilled here.

## Git push evidence

```
$ git push origin fix/mobile-bug-batch-m01-m05
To https://github.com/pratheeshku/meetup-mobile.git
   8e24eab..afeae33  fix/mobile-bug-batch-m01-m05 -> fix/mobile-bug-batch-m01-m05
```

Commits this task added: `e08dff4` (Part 1 — UserSearchPicker), `afeae33` (Part 2 — sport display-name lookup).

---
This report is the mandatory input to conformance-review, which must run in a fresh session that did not write this code.
