# Implementation Report — meetup-mobile tournaments module

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version / Status**: APPROVED, architect-approved 2026-09-13
- **Tier**: T1
- **Requirements baseline**: REQ-MEETUP-MOBILE, APPROVED (architect-approved 2026-09-13, R-005 corrected 2026-09-13)
- **Scope of this pass**: browse tournaments, tournament detail, register, withdraw, view fixtures, view registrations, organiser cancel. Explicitly excluded per the brief: tournament creation, fixture result entry, schedule generation.

### Section citation discrepancy

The task brief cited **§4.6** and **§7.6** as governing sections. Neither is about Tournaments:
- **§4.6** is "Organising Committee Governance" — a distinct, more advanced feature (committee members, step-up challenge/verify, approve/reject actions) unrelated to browsing/registering for tournaments.
- **§7.6** is "Notifications" — an API contract table for push-notification endpoints, not Tournaments.

This is the fourth task in a row in this project with a citation discrepancy in its governing-document references (see `docs/reports/IMPL-DES-MEETUP-MOBILE-events.md`, `-profile.md`, `-groups.md`, and `docs/reports/agent-enhancement-2026-09-13.md` §8/§10/§13 for the established handling pattern). Located the actual governing content instead:
- **§4.5 "Tournaments"** — screens (Tournament List, Tournament Detail with fixtures/standings tabs, Create Tournament, Fixture Result Entry), endpoints, role gates, and R-042's "no client-side recalculation" edge case, matching this task's scope exactly.
- **§7.7 "Tournaments"** — the full API contract table, confirming every endpoint the brief's Step 2 names plus `POST /tournaments/{id}/cancel` (needed for Step 4's cancel button, not in the brief's Step 2 function list — see Proposed Assumption §1).
- **R-041, R-042** in `REQ-MEETUP-MOBILE.md` §1.5 — "view fixtures and scheduling" and "view standings/leaderboard exactly as calculated and provided by the backend, with no separate calculation" — both directly on point. (This brief didn't cite specific R-IDs, just "docs/REQ-MEETUP-MOBILE.md" generally, so there's no citation-number mismatch to report here — just confirming the right ones were found.)

Not treated as a blocker — flagged for the architect to fix the task-brief template.

### Design gap found (not a blocker for this task): no Standings endpoint exists

§4.5's screen inventory says "Tournament Detail (fixtures **+ standings** tabs)," R-042 explicitly requires a standings/leaderboard view "provided by the backend," and §4.8's notification-type table even maps `tournament_standings_published` to a "Standings tab" (§4.8, line 783). **No endpoint for standings/leaderboard data exists anywhere in §7.7's API contract** (confirmed by a full-document grep for "standing"/"leaderboard" — every hit is a description of the concept, none is a route). Building a real Standings tab is not possible without either inventing an undocumented endpoint (forbidden) or computing it client-side from fixture results (forbidden outright by R-042's own wording).

This task's brief already sidesteps the gap — it asks for "Fixtures tab" and "Registrations tab" only, never mentioning Standings. Built exactly that. This is not this task's gap to resolve, but it is flagged here because it will block any *future* task that does ask for a real Standings view, until the architect either adds the missing endpoint to the design or clarifies fixtures-only is sufficient.

## 2. Traceability map

| Brief step | Design section / R-ID (corrected) | Files | Notes |
|---|---|---|---|
| 1. Types | §7.7 | `src/types/tournament.ts` | See Proposed Assumptions §2–5 |
| 2. Tournaments API | §3.3 (client reuse), §3.12, §7.7, R-041 | `src/api/tournaments.ts` | `cancelTournament()` added beyond the brief's literal function list — see Proposed Assumption §1 |
| 3. Tournaments list screen | §4.5, R-041 | `src/screens/TournamentsScreen.tsx` | Replaces the scaffold placeholder |
| 4. Tournament detail screen | §4.5, R-041, R-042 | `src/screens/TournamentDetailScreen.tsx` | See the Design gap note above and Deviation §1 (no confirmation dialog on cancel) |
| 5. Navigation | §3.1, §4.5 | `src/navigation/RootNavigator.tsx`, `src/navigation/types.ts` | Nested stack (`TournamentsStack`), matching the pattern already established for Home and Groups |

## 3. Proposed Assumptions

1. **`cancelTournament()` added to `src/api/tournaments.ts`, beyond the brief's literal Step 2 function list.** The brief's Step 4 explicitly requires a "Cancel tournament button (organiser only, not completed/cancelled)," and `POST /tournaments/{id}/cancel` is an already-documented endpoint in §7.7 — this fills a brief gap using an endpoint the design itself specifies, the same class of reasonable extension already applied to R-030/R-031 in the groups module's `getMyGroups()`/gating work.
2. **`TournamentStatus` (`'upcoming' | 'active' | 'completed' | 'cancelled'`) is not specified anywhere for Tournaments.** Reused the Events module's status vocabulary (same backend, plausibly the same general lifecycle shape) since the brief's own Step 4 explicitly names `'completed'` and `'cancelled'` as real values ("not completed/cancelled"). `src/types/tournament.ts`.
3. **`FixtureStatus` (`'scheduled' | 'in_progress' | 'completed' | 'cancelled'`) is likewise not specified.** A conservative, analogous guess. `src/types/tournament.ts`.
4. **`TournamentFixture.home_score`/`away_score` are nullable.** The brief's own Step 3 says "with scores if available," implying a fixture can exist before it has been played. `src/types/tournament.ts`.
5. **`TournamentFixture.round` and `Tournament.format` are kept as free-form strings**, not closed enums — no enum evidence exists anywhere in the local design excerpt for either field (R-040 mentions "a group-stage structure" as one example format, not a closed list; round labels like "Semifinal" are often non-numeric). `src/types/tournament.ts`.

## 4. Deviations

1. **"Cancel Tournament" has no confirmation dialog.** The brief's Step 4 for Tournaments doesn't request one (unlike the Groups module's explicit "confirmation alert" instruction for remove-member/leave-group, or the Profile module's explicit two-step `Alert` flow for account deletion). Matched this project's own existing precedent for the structurally identical action in `EventDetailScreen` (events module) — cancel-event also has no confirmation dialog there, because that brief didn't request one either. Consistent internal precedent, not an invented omission.

No other deviations.

## 5. Verification results

**Type-check** — clean, no errors:
```
$ npx tsc --noEmit
(no output, exit 0)
```

**Lint** — clean, no errors/warnings:
```
$ npx eslint . --ext .ts,.tsx
(no output, exit 0)
```

**Tests**, run 3x for stability (see Completion Proof §7). The existing `__tests__/App.test.tsx` smoke test still passes unchanged — no new native-module imports were introduced, so no new Jest mocks were needed.

**No `console.*` in any new/modified file** (explicit brief rule):
```
$ grep -rn "console\." src/api/tournaments.ts src/screens/TournamentsScreen.tsx src/screens/TournamentDetailScreen.tsx src/types/tournament.ts
(no output)
```

**No auth/events/profile/groups files modified** (brief rule):
```
$ git diff --name-only src/auth/
$ git diff --name-only src/api/events.ts src/screens/HomeScreen.tsx src/screens/EventDetailScreen.tsx src/types/event.ts src/utils/formatEventDateTime.ts
$ git diff --name-only src/api/profile.ts src/screens/ProfileScreen.tsx src/types/user.ts
$ git diff --name-only src/api/groups.ts src/screens/GroupsScreen.tsx src/screens/GroupDetailScreen.tsx src/types/group.ts
(no output for any of the four — none touched)
```

**`docs/` untouched** (brief rule):
```
$ git diff --name-only docs/DES-MEETUP-MOBILE.md docs/REQ-MEETUP-MOBILE.md
(no output)
```

**No creation/fixture-result-entry/schedule-generation code introduced** (brief's explicit exclusions):
```
$ grep -rn "createTournament\|fixtures/.*result\|schedule/generate\|schedule.publish\|discard-draft\|close-registration\|PATCH.*tournaments" src/api/tournaments.ts src/screens/TournamentsScreen.tsx src/screens/TournamentDetailScreen.tsx
(no output)
```

## 6. Known gaps / follow-ups

1. **No Standings/leaderboard view exists anywhere in this module** — see the Design gap section in §1. Not this task's brief's scope, but it is a real, confirmed gap in the design's API contract that will need architect input before a future task can build one.
2. **Every response-body-shape assumption in `src/types/tournament.ts` needs backend confirmation** — §7.7 lists endpoints only, no schemas, the same class of gap recorded against every other module in this project.
3. **No pagination on the tournaments list** — same category of gap as the events feed and groups list; not requested by this brief either.
4. **§4.5's offline behaviour ("Last-fetched fixtures/standings viewable; mutating actions disabled offline")** is not implemented — same pre-existing gap flagged in every prior module report (no connectivity-detection primitive exists in this codebase).
5. **No Android SDK/emulator in this environment** — verification limited to `tsc`, `eslint`, and the Jest smoke test, consistent with every prior module pass.

## 7. Completion Proof

**Test evidence** (raw output, 3 runs):
```
$ for i in 1 2 3; do npx jest 2>&1 | tail -6; echo "--- Run $i ---"; done
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.965 s, estimated 1 s
Ran all test suites.
--- Run 1 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.451 s, estimated 1 s
Ran all test suites.
--- Run 2 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.435 s, estimated 1 s
Ran all test suites.
--- Run 3 ---
```

**Type-check evidence**:
```
$ npx tsc --noEmit
(exit 0, no output)
```

**Git evidence**:
```
$ git log --oneline -3
c3761b5 feat(tournaments): implement tournaments list, detail, register, withdraw, fixtures and standings views
2a7fc64 docs(report): record actual git push evidence for groups module implementation report
87840de feat(groups): implement groups list, detail, member invite, role management, and remove flows

$ git status
On branch main
Your branch is up to date with 'origin/main'.
Untracked files:
	.claude/
(pre-existing, unrelated to this task — left untracked)

$ git push origin main
To https://github.com/pratheeshku/meetup-mobile.git
   2a7fc64..c3761b5  main -> main
```

**File evidence**:
```
$ grep -n "export " src/api/tournaments.ts
export async function getTournaments(
export async function getTournament(
export async function registerForTournament(
export async function withdrawFromTournament(
export async function getFixtures(
export async function getRegistrations(
export async function cancelTournament(
```

**Build evidence**: no Android SDK in this environment (unchanged from prior passes) — `npx tsc --noEmit` and `npx eslint` (both exit 0) stand in as the applicable build-adjacent evidence; a real `npm run android` build has not been exercised for this feature.

## 8. Full file tree created/modified in this pass

```
src/types/tournament.ts (new)
src/api/tournaments.ts (new)
src/screens/TournamentsScreen.tsx (modified — replaced placeholder with the tournaments list)
src/screens/TournamentDetailScreen.tsx (new)
src/navigation/types.ts (modified — TournamentsStackParamList added)
src/navigation/RootNavigator.tsx (modified — nested Tournaments stack, TournamentDetailScreen wired in)
implementation-status-DES-MEETUP-MOBILE.md (modified — live status)
docs/reports/IMPL-DES-MEETUP-MOBILE-tournaments.md (this file)
```
