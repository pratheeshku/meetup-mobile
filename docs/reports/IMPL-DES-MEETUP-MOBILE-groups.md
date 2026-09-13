# Implementation Report — meetup-mobile groups module

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version / Status**: APPROVED, architect-approved 2026-09-13
- **Tier**: T1
- **Requirements baseline**: REQ-MEETUP-MOBILE, APPROVED (architect-approved 2026-09-13, R-005 corrected 2026-09-13)
- **Sections read**: §4.4 (Groups & Teams — correctly cited this time), §7.3 (Groups & Teams API contract), §7.5 (Settings API — see R-ID/endpoint note below), §3.10/§5.3 (role gating is UX-only), §3.12 (correlation ID)
- **Scope of this pass**: browse the user's groups, group detail, invite member, change member role, remove member, leave group. Explicitly excluded per the brief: group creation, ownership transfer, Teams (§4.4 covers both Groups and Teams; the brief's "What to build" only requests Groups).

### R-ID citation discrepancy

The task brief cited "R-038 through R-048." **None of these exist anywhere in `REQ-MEETUP-MOBILE.md`** (confirmed via full-document grep) — the requirements table jumps from R-032 (Groups & Teams, §1.4) straight to R-040 (Tournaments, §1.5), and R-040–R-043 are all Tournament requirements, unrelated to Groups. This is the third task in a row in this project with a broken R-ID citation range (see `docs/reports/IMPL-DES-MEETUP-MOBILE-events.md` and `docs/reports/IMPL-DES-MEETUP-MOBILE-profile.md` for the prior two, and `docs/reports/agent-enhancement-2026-09-13.md` §8/§10 for the established handling pattern). Unlike those two, **§4.4 itself was correctly cited** this time.

The actual governing requirements are **R-030** ("Users can create, browse, and join groups...") and **R-031** ("Group membership can be managed (invite, accept, remove) according to each user's role permissions") — both in `REQ-MEETUP-MOBILE.md` §1.4, both squarely matching this task's scope. R-032 (teams) is out of scope per the brief. Not treated as a blocker — flagged here for the architect to fix the task-brief template.

### API contract discrepancy — `getMyGroups()`'s actual source endpoint

The brief's Step 2 specifies `getMyGroups() -> GET /groups (user's groups)`. **No bare `GET /groups` endpoint exists anywhere in the design's API contract.** §7.3 lists only `POST /groups` (create) and `GET /groups/{id}` (single-group detail) — confirmed by grepping every `/groups` mention in the design document. By contrast, §7.3 does list a bare `GET /teams` for the analogous Teams listing, which makes the absence of a `GET /groups` look like a deliberate omission rather than an editorial gap.

Grepping further turned up the actual endpoints for "browse groups the user belongs to": **§7.5 (Settings)** lists `GET /settings/groups-owned` and `GET /settings/groups-member`. `src/api/groups.ts`'s `getMyGroups()` calls both and merges the results, preserving the brief's single-function call shape and its `GroupsListResponse` return type while sourcing data from endpoints that actually exist in the contract. See Proposed Assumption §2.

## 2. Traceability map

| Brief step | Design section / R-ID (corrected) | Files | Notes |
|---|---|---|---|
| 1. Types | §7.3, §7.5 | `src/types/group.ts` | See Proposed Assumptions §1, §3 |
| 2. Groups API | §3.3 (client reuse), §3.12, §7.3, §7.5, R-030, R-031 | `src/api/groups.ts` | See the API contract discrepancy note above and Proposed Assumptions §2, §4 |
| 3. Groups list screen | §4.4, R-030 | `src/screens/GroupsScreen.tsx` | Replaces the scaffold placeholder |
| 4. Group detail screen | §4.4, §3.10, R-030, R-031 | `src/screens/GroupDetailScreen.tsx` | New. See Deviation §1 (role-management gate) |
| 5. Navigation | §3.1, §4.4 | `src/navigation/RootNavigator.tsx`, `src/navigation/types.ts` | Nested stack (`GroupsStack`) inside the Groups tab, matching the pattern already established for the Home tab in the events module |

## 3. Proposed Assumptions

1. **`GroupDetail` (extending `Group` with `members: GroupMember[]`) added beyond the brief's literal single `Group` interface.** The brief's Step 1 `Group` field list has no member-list field, but Step 4 explicitly requires a "Members list with role badges" on the detail screen, and no separate "list group members" endpoint exists anywhere in §7.3. Assumed `GET /groups/{id}` embeds the member list — the same resolution already applied to `UserProfile.skill_levels` in the profile module. Kept as a separate `GroupDetail` type rather than adding `members` directly onto `Group`, since `Group` is also the lightweight item shape returned by `getMyGroups()`'s list, which has no reason to embed every group's full roster. `src/types/group.ts`.
2. **`getMyGroups()` merges `GET /settings/groups-owned` and `GET /settings/groups-member`** rather than calling a nonexistent `GET /groups` — see the API contract discrepancy note in §1. Each settings endpoint is assumed to return a bare `Group[]` (no pagination envelope — no `page`/`page_size` query parameters are implied anywhere for these routes, unlike the Events feed). The merged result is wrapped into the brief's requested `GroupsListResponse` shape with `total`/`page`/`page_size` synthesized from the merged array's own length, since there's no real server-side pagination happening across a client-side merge of two full lists. `src/api/groups.ts`.
3. **`inviteMember`'s input collects a literal user ID, not a nickname/search result.** The brief's Step 4 describes "input for nickname/user search," but `inviteMember`'s own Step 2 signature takes a raw `userId`, and no user-search-by-nickname endpoint exists anywhere in the design's API contract. Rather than inventing an undocumented search endpoint, or assuming — unverified — that the invite endpoint's body field accepts a nickname interchangeably with a genuine user ID, the invite form's text input is literally labeled "User ID" and its value is passed straight through to `inviteMember(groupId, userId)`. `src/screens/GroupDetailScreen.tsx`, `src/api/groups.ts`.
4. **`updateMemberRole`'s `role` parameter is typed `GroupMemberRole` (a `'member' | 'admin'` picker in practice, `'owner'` also representable in the type), not the brief's loosely-worded `role: string`.** A concrete union type is strictly more correct than an unconstrained string for a field the UI itself only ever offers two values for (Step 4: "picker: member/admin"); this doesn't change what value the request body actually carries. `src/api/groups.ts`.
5. **Role-change/remove controls are hidden on the group owner's own member row**, in addition to being hidden on the viewer's own row. Demoting or removing the owner isn't meaningful without an ownership-transfer flow (explicitly out of scope for this task), and §4.4 separately notes last-owner removal is rejected server-side regardless — this is a conservative UX-only gate, not a substitute for that server-side check. `src/screens/GroupDetailScreen.tsx`.

## 4. Deviations

1. **"Change member role" is gated to owner **or admin**, not "owner only" as the brief's Step 4 literally states.** §4.4 explicitly says "Role management — owner/admin only." Per this project's established fidelity rule (the design document is the non-negotiable source of truth on behavioral conflicts with the brief — see `docs/reports/agent-enhancement-2026-09-13.md` §2, from the very first auth-module task), followed §4.4's wording. `src/screens/GroupDetailScreen.tsx`, `canChangeRoles`. This is a UX-gate-only change (§3.10/§5.3) — the backend remains the actual authority on whether an admin's role-change call is accepted either way.

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
$ grep -rn "console\." src/api/groups.ts src/screens/GroupsScreen.tsx src/screens/GroupDetailScreen.tsx src/types/group.ts
(no output)
```

**No auth/events/profile files modified** (brief rule):
```
$ git diff --name-only src/auth/
$ git diff --name-only src/api/events.ts src/screens/HomeScreen.tsx src/screens/EventDetailScreen.tsx src/types/event.ts
$ git diff --name-only src/api/profile.ts src/screens/ProfileScreen.tsx src/types/user.ts
(no output for any of the three — none touched)
```

**`docs/` untouched** (brief rule):
```
$ git diff --name-only docs/DES-MEETUP-MOBILE.md docs/REQ-MEETUP-MOBILE.md
(no output)
```

**No group-creation code introduced** (brief's explicit exclusion):
```
$ grep -rn "createGroup\|POST.*'/groups'\|apiClient.post('/groups'" src/api/groups.ts src/screens/GroupsScreen.tsx src/screens/GroupDetailScreen.tsx
(no output)
```

## 6. Known gaps / follow-ups

1. **`getMyGroups()`'s two-endpoint-merge assumption needs backend confirmation** — see Proposed Assumption §2. If `/settings/groups-owned`/`/settings/groups-member` actually return a paginated envelope rather than a bare array, or if a `GET /groups` endpoint does exist but wasn't documented in this design excerpt, this function will need rework.
2. **`GroupDetail.members` embedding assumption needs backend confirmation** — see Proposed Assumption §1, same class of gap as `UserProfile.skill_levels`.
3. **No pagination on the groups list** — same category of gap as the events feed (`docs/reports/IMPL-DES-MEETUP-MOBILE-events.md` Known Gap #1); not requested by this brief either.
4. **§4.4's offline behaviour ("Last-fetched data viewable; mutating actions disabled offline")** is not implemented — same pre-existing gap flagged in every prior module report (no connectivity-detection primitive exists in this codebase).
5. **Teams (§4.4's other half) are entirely out of scope** — this task's brief only requested Groups; no Team screens/API were touched or stubbed.
6. **No Android SDK/emulator in this environment** — verification limited to `tsc`, `eslint`, and the Jest smoke test, consistent with every prior module pass.

## 7. Completion Proof

**Test evidence** (raw output, 3 runs):
```
$ for i in 1 2 3; do npx jest 2>&1 | tail -6; echo "--- Run $i ---"; done
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.947 s, estimated 1 s
Ran all test suites.
--- Run 1 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.443 s, estimated 1 s
Ran all test suites.
--- Run 2 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.41 s, estimated 1 s
Ran all test suites.
--- Run 3 ---
```

**Type-check evidence**:
```
$ npx tsc --noEmit
(exit 0, no output)
```

**Git evidence**: recorded in a follow-up commit/push-evidence addendum, matching the convention from every prior module report in this project.

**File evidence**:
```
$ grep -n "export " src/api/groups.ts
export async function getMyGroups(
export async function getGroup(
export async function inviteMember(
export async function updateMemberRole(
export async function removeMember(
```

**Build evidence**: no Android SDK in this environment (unchanged from prior passes) — `npx tsc --noEmit` and `npx eslint` (both exit 0) stand in as the applicable build-adjacent evidence; a real `npm run android` build has not been exercised for this feature.

## 8. Full file tree created/modified in this pass

```
src/types/group.ts (new)
src/api/groups.ts (new)
src/screens/GroupsScreen.tsx (modified — replaced placeholder with the groups list)
src/screens/GroupDetailScreen.tsx (new)
src/navigation/types.ts (modified — GroupsStackParamList added)
src/navigation/RootNavigator.tsx (modified — nested Groups stack, GroupDetailScreen wired in)
implementation-status-DES-MEETUP-MOBILE.md (modified — live status)
docs/reports/IMPL-DES-MEETUP-MOBILE-groups.md (this file)
```
