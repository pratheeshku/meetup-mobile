# Implementation Report — DES-MEETUP-ADDENDUM-profile-photo (Mobile)

## 1. Design Reference

| Field | Value |
|---|---|
| Doc ID | DES-MEETUP-ADDENDUM-profile-photo.md |
| Version | 1.0 |
| Status | APPROVED — architect-approved 2026-09-26 |
| Tier | T1 |
| Scope | §10 — Mobile Client Design (ProfileScreen only) |
| Secondary docs | DES-MEETUP-MOBILE.md (mobile-repo copy), REQ-MEETUP-MOBILE.md |

## 2. Traceability Map

| Design Section / R-ID | Files & Commits |
|---|---|
| §10.1 — Fix `avatar_url: null` bug | `src/api/profile.ts` (L62 — `getAvatarUrl(raw.avatar_storage_key)`), `src/utils/avatar.ts`, `config/env.ts` (L28–29 `AVATAR_BUCKET_BASE_URL`) |
| §10.2 — New dependencies | `package.json` (`react-native-image-picker@8.2.1`, `@d11/react-native-fast-image@8.13.0`), `jest.config.js`, `jest.setup.js` |
| §10.3 / R-NEW-2 — No client-side HEIC conversion | No client-side format logic added (confirmed) |
| §10.4 steps 1–5 — Upload flow | `src/screens/ProfileScreen.tsx` (`handleAvatarPress`, `pickImage`, `uploadAvatar` API call) |
| §10.4 — Remove flow | `src/screens/ProfileScreen.tsx` (`handleRemoveAvatar`), `src/api/profile.ts` (`deleteAvatar`) |
| §5 / R-NEW-1 — POST/DELETE `/users/me/avatar` | `src/api/profile.ts` (`uploadAvatar`, `deleteAvatar`) |
| §10.6 / R-NEW-8 — FastImage disk cache (P16 deviation) | `src/screens/ProfileScreen.tsx` (FastImage component usage, no custom encryption) |
| P1 — Config-driven bucket URL | `config/env.ts` (`AVATAR_BUCKET_BASE_URL`, overridable via `.env`) |
| P4 — Correlation ID threading | `uploadAvatar`/`deleteAvatar` both accept `{ correlationId }` via `withCorrelationId` |
| Commit | `8330110` — `feat(profile): add profile photo upload/remove flow` |

## 3. Proposed Assumptions

1. **PA-1 (LOW):** The design says `react-native-fast-image` but the original package is unmaintained (last publish ~2022). Used `@d11/react-native-fast-image@8.13.0` instead — the actively maintained community fork, same API, Glide-backed on Android, supports RN 0.86 New Architecture. Import is `from '@d11/react-native-fast-image'` instead of `from 'react-native-fast-image'`.

2. **PA-2 (LOW):** The upload sends `quality: 0.8` to the image picker — this is a standard compression hint that reduces file size for typical phone photos before upload. The design doesn't specify a quality level; 0.8 is a conservative default (visually lossless at avatar sizes).

3. **PA-3 (LOW):** The action sheet when a user already has an avatar offers "Take Photo", "Choose from Library", and "Remove Photo". The design specifies "camera/gallery action sheet" (§10.4 step 1) but doesn't specify the Remove option's placement. Integrated it into the same sheet (not a separate tap target) to match the platform convention for photo-change flows.

## 4. Deviations

| # | Deviation | Approval Reference |
|---|---|---|
| D-1 | §10.6 — FastImage disk cache is unencrypted (P16) | Architect-approved in addendum §10.6, per task description |

## 5. Verification Results

### TypeScript
```
npx tsc --noEmit → clean (exit 0, no output)
```

### Tests (3 consecutive runs)
```
Run 1: Test Suites: 70 passed, 70 total / Tests: 889 passed, 889 total
Run 2: Test Suites: 70 passed, 70 total / Tests: 889 passed, 889 total
Run 3: Test Suites: 70 passed, 70 total / Tests: 889 passed, 889 total
```

New tests added (15 total):
- `src/utils/__tests__/avatar.test.ts` — 5 tests (null/undefined/empty guards, URL construction)
- `src/screens/__tests__/ProfileScreen.test.tsx` — 10 tests (placeholder, photo rendering, action sheet options, upload flow, upload failure, remove flow, remove failure, cancelled picker)
- `src/api/__tests__/profile.test.ts` — 2 assertions updated (avatar_url resolved, null key → null URL)

### Negative tests confirmed
- Upload failure: reverts preview, shows error via `getApiErrorMessage` (same 4xx pattern as skill-level 409)
- Remove failure: shows generic fallback, avatar stays visible
- Cancelled picker: no upload triggered
- Null/undefined/empty avatar_storage_key: returns null (placeholder renders)

## 6. Known Gaps / Follow-ups

1. **Photo reporting UI (R-NEW-5):** Out of scope per task definition. The backend endpoint exists (`POST /users/{user_id}/photo-reports`), but there is currently no screen where a user sees another user's photo to report it — participant lists are initials-only. Building report UI now would have no trigger point. Flagged for when a participant-detail or member-list screen shows real photos.

2. **EventCard/EventDetailScreen avatar display:** Explicitly out of scope. Web has zero avatar rendering; these screens' initials-circles have no web precedent. The `getAvatarUrl()` utility is ready to reuse there when scope expands (P3).

3. **R-251 / avatar_seed generated-avatar:** Untouched, separate backlog item per addendum scope.

4. **`.env.example`:** `AVATAR_BUCKET_BASE_URL` not added to `.env.example` — follows the existing pattern where `API_BASE_URL` is also not in `.env.example` (it has a default in `config/env.ts`). Could be added for documentation completeness.

### Completion Proof

**Test evidence** (raw output — no summaries):
```
Test Suites: 70 passed, 70 total
Tests:       889 passed, 889 total
Snapshots:   0 total
Time:        2.424 s, estimated 3 s
--- Run 1 ---

Test Suites: 70 passed, 70 total
Tests:       889 passed, 889 total
Snapshots:   0 total
Time:        2.413 s, estimated 3 s
--- Run 2 ---

Test Suites: 70 passed, 70 total
Tests:       889 passed, 889 total
Snapshots:   0 total
Time:        2.356 s, estimated 3 s
--- Run 3 ---
```

**Git evidence**:
```
8330110 (HEAD -> main) feat(profile): add profile photo upload/remove flow
6b96b24 (origin/main, origin/HEAD) chore: bump versionCode to 25 (recover from Play Console drift)
ee1a49d docs(reports): archive implementation-status for event-reminder task

On branch main
Your branch is ahead of 'origin/main' by 1 commit.
nothing to commit, working tree clean
```

**File evidence** (grep showing key changes exist on disk):
```
src/utils/avatar.ts:24:export function getAvatarUrl(storageKey: string | null | undefined): string | null {
src/api/profile.ts:26:import { getAvatarUrl } from '../utils/avatar';
src/api/profile.ts:62:    avatar_url: getAvatarUrl(raw.avatar_storage_key),
src/api/profile.ts:166:export async function uploadAvatar(
src/api/profile.ts:195:export async function deleteAvatar(options?: RequestOptions): Promise<void> {
config/env.ts:28:  AVATAR_BUCKET_BASE_URL:
config/env.ts:29:    Config.AVATAR_BUCKET_BASE_URL ?? 'https://meetup.hel1.your-objectstorage.com',
src/screens/ProfileScreen.tsx:39:import FastImage from '@d11/react-native-fast-image';
src/screens/ProfileScreen.tsx:40:import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
src/screens/ProfileScreen.tsx:181:  const handleAvatarPress = (): void => {
```
