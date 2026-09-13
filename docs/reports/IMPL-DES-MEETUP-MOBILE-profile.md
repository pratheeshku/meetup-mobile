# Implementation Report — meetup-mobile profile module

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version / Status**: APPROVED, architect-approved 2026-09-13
- **Tier**: T1
- **Requirements baseline**: REQ-MEETUP-MOBILE, APPROVED (architect-approved 2026-09-13, R-005 corrected 2026-09-13)
- **Scope of this pass**: view/edit profile (nickname), skill level management (add/update), account deletion request+confirm flow, sign out. Explicitly excluded per the brief: password change, avatar upload, admin features.

### R-ID / section citation discrepancy — read before the traceability map

The task brief's governing-document citations do not match their stated content:

- **§3.6** is "FCM Integration" (push notification lifecycle) — unrelated to profile.
- **§4.5** is "Tournaments" (tournament screens/endpoints) — unrelated to profile.
- **R-003** ("operate correctly on a current-generation Android device"), **R-004** (iOS deferred), **R-005** ("app consumes existing backend services") — all general platform/scope statements, none about profile/account management.
- **R-031**, as cited, is actually *"Group membership can be managed (invite, accept, remove)"* in the canonical `REQ-MEETUP-MOBILE.md` §1.3 — not account deletion. (The design document's own §7.2 API table mis-annotates the deletion endpoints with "R-031" too — this exact inconsistency was already flagged as a Known Gap in the scaffold pass's Implementation Report, §6 item 6: the correct R-ID for self-deletion is **R-124**, confirmed present in `REQ-MEETUP-MOBILE.md`'s Compliance section.)
- **R-033, R-034, R-035** do not exist anywhere in `REQ-MEETUP-MOBILE.md` (confirmed via full-document grep).

Per the precedent established in the events-module task (`docs/reports/agent-enhancement-2026-09-13.md` §8: a citation mismatch is a traceability problem, not automatically a blocker, provided the design document independently and unambiguously specifies the requested behavior), this was **not treated as a Blocked Report**. The actual behavior was located instead:

- **§4.13 App Store Compliance**: "Screens: Privacy Policy viewer, Account Deletion flow." Endpoints, role gate ("any authenticated user, own account only"), and edge cases (admin self-deletion rejected server-side; expired/consumed token gets an enumeration-safe rejection) all explicitly specified.
- **§7.2 Users**: `GET /users/me`, `PATCH /users/me`, `PUT /users/me/skill-level`, `POST /users/me/deletion-request`, `POST /users/me/deletion-confirm` — exact methods/paths/auth-required, matching the brief's Step 2 one-to-one.
- **R-124**: "The app shall provide users with an in-app path to request permanent deletion of their account..." — the correct requirement for this task's deletion flow.

This is flagged here for the architect to reconcile the task-brief template and/or the requirements baseline; it did not block implementation.

## 2. Traceability map

| Brief step | Design section / R-ID (corrected) | Files | Notes |
|---|---|---|---|
| 1. Types | §7.2, §4.13 | `src/types/user.ts` | See Proposed Assumptions §1–3 |
| 2. Profile API | §3.3 (client reuse), §3.12, §7.2, §4.13, R-124 | `src/api/profile.ts` | Correlation-ID threading added per the same §3.12/R-113 pattern already used in `src/api/events.ts` |
| 3. Profile screen | §4.13 (screen concept), §7.2 (data), R-124 | `src/screens/ProfileScreen.tsx` | Replaces the scaffold placeholder |
| 4. Account deletion flow | §4.13, R-124 | `src/screens/ProfileScreen.tsx` | See Deviations §1 (Step 2 UI mechanism) |
| 5. Settings/Profile tab reuse | — (brief-only instruction) | `src/navigation/RootNavigator.tsx` | No change needed — Profile tab already routes to `ProfileScreen`; confirmed, not modified |

## 3. Proposed Assumptions

1. **`UserProfile.skill_levels: SkillLevel[]` added beyond the brief's literal 6-field list.** The brief's Step 1 field list for `UserProfile` (`id, nickname, email, avatar_url, is_admin, created_at`) omits any field for the declared skill levels that Step 3 explicitly requires displaying ("Skill levels section: list of sports with declared skill level"). No GET endpoint for skill levels exists anywhere in the design's API contract (§7.2 lists only `PUT /users/me/skill-level`). Assumed `GET /users/me` embeds the list — the only plausible data source. `src/types/user.ts`. Correct against the actual backend contract on conformance review.
2. **`UserProfile.avatar_url` is nullable (`string | null`).** Not every user will have set one (no avatar upload in this task), and Step 3 only asks to display it, implying optionality. `src/types/user.ts`.
3. **`POST /users/me/deletion-confirm` request body field name (`confirmation_token`, snake_case).** Not specified anywhere in the local design excerpt. Matched this backend's dominant JSON convention seen elsewhere (`access_token`/`refresh_token`, event fields like `starts_at`). `src/api/profile.ts`, `confirmDeletion()`.
4. **A second, distinct `UserProfile` type now exists in this codebase** (`src/types/user.ts`, this task) alongside the one already in `src/auth/types.ts` (auth-module task) — different shapes (`is_admin` vs `role`; `avatar_url`/`created_at`/`skill_levels` vs none) describing the same `GET /users/me` endpoint from two different call sites. Not reconciled here because doing so would require editing `src/auth/`, which this task's rules explicitly forbid ("Do not modify auth files"). Flagged for the architect/conformance review to consolidate into one shared `src/types/user.ts` in a dedicated follow-up, rather than silently merged or silently left unremarked.
5. **`requestDeletion()`/`confirmDeletion()` are not threaded onto a shared correlation ID**, unlike other multi-call action sequences in this codebase (e.g. RSVP-then-refetch). §4.13's own flow puts a real-world gap between them — the user has to leave the app to read an email — so they read as two separate logical user actions (§3.12's own worked example, "challenge → verify → submit," describes calls made back-to-back within one gesture, which this is not). `src/screens/ProfileScreen.tsx`.

## 4. Deviations

1. **Account-deletion "Step 2" (entering the emailed confirmation code) is a plain inline `TextInput` + button on the Profile screen, not a second native `Alert`.** The brief's Step 4 literally says "confirmation dialog (Alert with two steps)." React Native's only `Alert` variant with a text-input field is `Alert.prompt`, which is **iOS-only** — it does not exist on Android at all, and this app is Android-only per `CLAUDE.md` ("Frontend: React Native (Android target only)"). There is no way to satisfy "Alert" + "user enters a code" simultaneously on this platform. Step 1 (a plain yes/no confirmation, no text input) uses `Alert.alert` exactly as specified — only the code-entry step needed a different mechanism. This is a platform-capability constraint, not a design choice; flagged rather than silently worked around without comment.
2. **The skill-level "Beginner/Intermediate/Expert picker" is three selectable buttons (a segmented control), not a native picker component.** No picker library (e.g. `@react-native-picker/picker`) is installed in this repo, and this task's brief has no dependency-installation step (unlike the auth module's Step 1). Adding a new native dependency requiring native linking/rebuild for a 3-option selector wasn't requested and would have exceeded this task's scope. Three buttons satisfy the same functional requirement (choose one of three fixed values) without the extra dependency.

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

**Tests**, run 3x for stability (see Completion Proof §7). The existing `__tests__/App.test.tsx` smoke test still passes unchanged — no new native-module imports were introduced by this pass (unlike the auth-module pass), so no new Jest mocks were needed.

**No `console.*` in any new/modified file** (explicit brief rule):
```
$ grep -rn "console\." src/api/profile.ts src/screens/ProfileScreen.tsx src/types/user.ts
(no output)
```

**No auth files modified** (brief rule):
```
$ git diff --name-only src/auth/
(no output)
```

**No events files modified** (brief rule):
```
$ git diff --name-only src/api/events.ts src/screens/HomeScreen.tsx src/screens/EventDetailScreen.tsx src/types/event.ts
(no output)
```

**`docs/` untouched** (brief rule):
```
$ git diff --name-only docs/DES-MEETUP-MOBILE.md docs/REQ-MEETUP-MOBILE.md
(no output)
```

**No password-change or avatar-upload code introduced** (brief's explicit exclusions):
```
$ grep -rn "password\|ImagePicker\|launchImageLibrary\|uploadAvatar" src/api/profile.ts src/screens/ProfileScreen.tsx src/types/user.ts
(no output)
```

## 6. Known gaps / follow-ups

1. **Two divergent `UserProfile` types now exist** (`src/auth/types.ts` vs `src/types/user.ts`) — see Proposed Assumption §4. Needs a dedicated consolidation task once the architect confirms the actual `GET /users/me` response shape.
2. **`GET /users/nickname-available`** (§7.2) is not used — this task's brief has no nickname-uniqueness-check UI in its steps, so it wasn't built. Not invented; flagged rather than silently added or silently omitted without comment.
3. **§4.13's offline behaviour ("Requires connectivity; disabled offline")** is not implemented — same pre-existing gap already flagged in the events-module report (no connectivity-detection primitive exists in this codebase yet). Network failures currently surface via the existing inline-error pattern.
4. **`GET /users/me`'s response shape assumption (`skill_levels` embedded array) needs backend confirmation** — see Proposed Assumption §1. If the actual backend instead requires a separate list endpoint or paginates skill levels, this screen's "list of sports with declared skill level" section will need rework.
5. **No Android SDK/emulator in this environment** — verification limited to `tsc`, `eslint`, and the Jest smoke test, consistent with prior module passes. The actual profile view/edit/skill-level/deletion flows have not been exercised against a real device or the live backend.

## 7. Full file tree created/modified in this pass

```
src/types/user.ts (new)
src/api/profile.ts (new)
src/screens/ProfileScreen.tsx (modified — replaced placeholder with real UI)
implementation-status-DES-MEETUP-MOBILE.md (modified — live status)
docs/reports/IMPL-DES-MEETUP-MOBILE-profile.md (this file)
```

## 8. Completion Proof

**Test evidence** (raw output, 3 runs):
```
$ for i in 1 2 3; do npx jest 2>&1 | tail -6; echo "--- Run $i ---"; done
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.937 s, estimated 1 s
Ran all test suites.
--- Run 1 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.422 s, estimated 1 s
Ran all test suites.
--- Run 2 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.411 s, estimated 1 s
Ran all test suites.
--- Run 3 ---
```

**Type-check evidence**:
```
$ npx tsc --noEmit
(exit 0, no output)
```

**Git evidence**: recorded in a follow-up commit/push-evidence addendum, matching the convention from the auth and events module reports.

**File evidence**:
```
$ grep -n "export " src/api/profile.ts
export async function getProfile(
export async function updateProfile(
export async function updateSkillLevel(
export async function requestDeletion(
export async function confirmDeletion(
```

**Build evidence**: no Android SDK in this environment (unchanged from prior passes) — `npx tsc --noEmit` and `npx eslint` (both exit 0) stand in as the applicable build-adjacent evidence; a real `npm run android` build has not been exercised for this feature.
