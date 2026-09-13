# Implementation Report — meetup-mobile UserProfile type consolidation

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version / Status**: APPROVED, architect-approved 2026-09-13
- **Tier**: T1
- **Scope of this pass**: pure type-level refactor — no design section/R-ID targeted directly; this closes Known Gap #1 from `docs/reports/IMPL-DES-MEETUP-MOBILE-profile.md` ("Two divergent `UserProfile` types now exist") and Proposed Assumption #4 in that same report. Gate 3 (task confirmation) only — small scoped edit, no new dependency/schema/feature.
- **Task confirmation**: consolidate the two independently-grown `UserProfile` interfaces (auth module vs. profile module, both describing `GET /users/me`) into one canonical type in `src/types/user.ts`, update every import site, change no business logic/API calls/UI behavior.

## 2. Both original type shapes

**`src/auth/types.ts`** (built in the auth-module task):
```ts
export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  role: 'participant' | 'organiser' | 'admin';
}
```

**`src/types/user.ts`** (built in the profile-module task):
```ts
export interface UserProfile {
  id: string;
  nickname: string;
  email: string;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  skill_levels: SkillLevel[];
}
```

**Field-by-field comparison**:

| Field | Auth shape | Profile shape | In canonical type |
|---|---|---|---|
| `id: string` | required | required | **required** (in both) |
| `email: string` | required | required | **required** (in both) |
| `nickname: string` | required | required | **required** (in both) |
| `role: 'participant' \| 'organiser' \| 'admin'` | required | — | optional (auth-only) |
| `avatar_url: string \| null` | — | required | optional (profile-only) |
| `is_admin: boolean` | — | required | optional (profile-only) |
| `created_at: string` | — | required | optional (profile-only) |
| `skill_levels: SkillLevel[]` | — | required | optional (profile-only) |

Per the task brief's explicit merge rule ("All fields optional where one definition had them and the other did not"): the three fields present in *both* shapes stay required; every field present in only one becomes optional in the canonical type.

## 3. Canonical merged shape

`src/types/user.ts`:
```ts
export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  role?: 'participant' | 'organiser' | 'admin';
  avatar_url?: string | null;
  is_admin?: boolean;
  created_at?: string;
  skill_levels?: SkillLevel[];
}
```

`SkillLevel`, `SkillLevelValue`, and `UpdateProfilePayload` (all profile-module-only types, no auth-side equivalent to merge against) are unchanged in the same file.

## 4. Files modified

| File | Change |
|---|---|
| `src/types/user.ts` | `UserProfile` replaced with the canonical merged shape (§3 above); header comment rewritten to document the consolidation and point at this report |
| `src/auth/types.ts` | Local `UserProfile` interface **removed**; now `import type { UserProfile } from '../types/user'` instead, used only by the still-local `AuthResponse` interface |
| `src/auth/googleAuth.ts` | Import split: `AuthResponse` still from `./types`, `UserProfile` now from `../types/user` |
| `src/auth/emailAuth.ts` | Same import split as `googleAuth.ts` |
| `src/auth/AuthContext.tsx` | `UserProfile` import changed from `./types` to `../types/user` |
| `src/screens/ProfileScreen.tsx` | One necessary type-safety fix (see §5 Deviations) — no other change |

`src/api/profile.ts` and `src/screens/ProfileScreen.tsx`'s existing `import ... from '../types/user'` needed no path change (they already pointed at the canonical location); `ProfileScreen.tsx` needed one compile-fix, detailed below.

## 5. Deviations

1. **One necessary compile-error fix in `src/screens/ProfileScreen.tsx`, beyond a pure import-path change.** Making `skill_levels` optional (per the brief's own explicit merge rule) broke two existing call sites that assumed it was always present (`profile.skill_levels.length`, `profile.skill_levels.map(...)`), since TypeScript now correctly flags `profile.skill_levels` as possibly `undefined` (`TS18048`). Fixed with a single local binding, `const skillLevels = profile.skill_levels ?? [];`, used at both call sites in place of the direct property access. This introduces **zero behavioral change**: the actual `GET /users/me` response is assumed (per the profile module's own Proposed Assumption, unchanged by this task) to always include `skill_levels` in practice, so this fallback path is never actually exercised at runtime today — it exists purely to make the new, more honest optional type check cleanly. This was unavoidable: the task's own instruction ("all fields optional where one definition had them and the other did not") is what introduced the possibility of `undefined` at the type level, and `tsc --noEmit` passing is an explicit, mandatory deliverable of this same task. Not fixing it would leave the codebase in a state that fails the task's own verification requirement.

No other deviations. No business logic changed, no API call changed (every `apiClient.get/post/patch/put` call site is untouched — confirmed by diff review, §6), no UI behavior changed (the fallback-to-empty-array path is unreachable under the same assumption the profile module already made).

## 6. Verification results

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

**Tests**, run 3x for stability (see Completion Proof §8). No new native-module imports were introduced — the existing `__tests__/App.test.tsx` smoke test needed no new mocks.

**Exactly one `UserProfile` interface definition remains**:
```
$ grep -rn "^export interface UserProfile" src/
src/types/user.ts:28:export interface UserProfile {
```

**No stray duplicate or leftover local re-declaration**:
```
$ grep -rn "UserProfile" src/
src/auth/types.ts:19:import type { UserProfile } from '../types/user';
src/auth/types.ts:35: (AuthResponse's `user: UserProfile` field)
src/auth/googleAuth.ts:46:import type { UserProfile } from '../types/user';
src/auth/emailAuth.ts:12:import type { UserProfile } from '../types/user';
src/auth/AuthContext.tsx:26:import type { UserProfile } from '../types/user';
src/screens/ProfileScreen.tsx:44:import type { SkillLevelValue, UserProfile } from '../types/user';
src/api/profile.ts:26:import type { SkillLevelValue, UpdateProfilePayload, UserProfile } from '../types/user';
src/types/user.ts:28:export interface UserProfile {
(every usage now resolves to the single canonical definition)
```

**No business-logic/API-call/UI-behavior change** (diff review of every modified file):
```
$ git diff --stat
 src/auth/AuthContext.tsx      |  2 +-
 src/auth/emailAuth.ts         |  3 ++-
 src/auth/googleAuth.ts        |  3 ++-
 src/auth/types.ts             | 33 +++++++++++--------------
 src/screens/ProfileScreen.tsx | 12 +++++++--
 src/types/user.ts             | 57 +++++++++++++++++++++++++------------------
```
`AuthContext.tsx`/`emailAuth.ts`/`googleAuth.ts`: one import line each, no other change. `types.ts` files: type declarations and comments only, no runtime code. `ProfileScreen.tsx`: the single null-safety shim described in §5, no other line touched — confirmed no `apiClient.get/post/patch/put/delete` call site anywhere in the diff.

## 7. Known gaps / follow-ups

1. **The canonical type's field-optionality is now honest about what each original call site actually verified, but neither original assumption about the true backend shape has been independently re-verified.** This task didn't attempt to determine which fields `GET /users/me` truly always returns — it only formalized the existing disagreement into one optional-superset type, per the brief's explicit instruction. A future conformance-review/backend-verification pass should confirm the real shape and tighten `role`/`avatar_url`/`is_admin`/`created_at`/`skill_levels` back to required wherever the backend guarantees them, removing the now-unneeded `?? []` fallback in `ProfileScreen.tsx` at that point.
2. **No Android SDK/emulator in this environment** — verification limited to `tsc`, `eslint`, and the Jest smoke test, consistent with every prior module pass in this project.

## 8. Completion Proof

**Test evidence** (raw output, 3 runs):
```
$ for i in 1 2 3; do npx jest 2>&1 | tail -6; echo "--- Run $i ---"; done
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.966 s, estimated 1 s
Ran all test suites.
--- Run 1 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.423 s, estimated 1 s
Ran all test suites.
--- Run 2 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.419 s, estimated 1 s
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
31a8d86 refactor(types): consolidate duplicate UserProfile into single canonical type
dfca90e docs(report): record actual git push evidence for profile module implementation report
242ff76 feat(profile): implement profile view, edit, skill level management, and account deletion flow

$ git status
On branch main
Your branch is up to date with 'origin/main'.
Untracked files:
	.claude/
(pre-existing, unrelated to this task — left untracked)

$ git push origin main
To https://github.com/pratheeshku/meetup-mobile.git
   dfca90e..31a8d86  main -> main
```

**File evidence**:
```
$ grep -n "export interface UserProfile" -A 9 src/types/user.ts
export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  role?: 'participant' | 'organiser' | 'admin';
  avatar_url?: string | null;
  is_admin?: boolean;
  created_at?: string;
  skill_levels?: SkillLevel[];
}
```

**Build evidence**: no Android SDK in this environment (unchanged from prior passes) — `npx tsc --noEmit` and `npx eslint` (both exit 0) stand in as the applicable build-adjacent evidence for a type-only refactor with no compiled artifact target.
