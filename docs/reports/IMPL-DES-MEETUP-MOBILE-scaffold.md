# Implementation Report — meetup-mobile scaffold

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version / Status**: APPROVED, architect-approved 2026-09-13
- **Tier**: T1
- **Requirements baseline**: REQ-MEETUP-MOBILE, APPROVED (architect-approved 2026-09-13, R-005 corrected 2026-09-13)
- **Scope of this pass**: the 10-step scaffold brief (RN init, core dependencies, Android signing config, env config, API client, secure token storage, navigation skeleton, placeholder screens, FCM setup primitives, CLAUDE.md/AGENTS.md) — a scaffold, not a feature build. No screen carries real feature logic.

## 2. Traceability map

| Brief step | Design section / R-ID | Files | Notes |
|---|---|---|---|
| 1. RN init | §1 (bare workflow, Android, min API 26) | `package.json`, `App.tsx`, `index.js`, `android/`, `ios/`, `tsconfig.json`, etc. | See Deviations §1 (RN/CLI version pin) and §2 (min SDK fix) |
| 2. Core dependencies | §3.1 (nav), §3.4 (keychain), §3.6 (FCM), §3.7 (QR), §5.1 | `package.json` | See Deviations §3 (react-native-camera risk) |
| 3. Android signing | §3.11 | `android/app/build.gradle`, `android/build.gradle` (comment only), `android/key.properties` (gitignored), `android/key.properties.example`, `.gitignore` | Pattern translated from Kotlin DSL (`newgames/android/app/build.gradle.kts`) to Groovy |
| 4. Env config | §3.11, P1 | `config/env.ts`, `global.d.ts` | See Deviations §4 (process.env runtime gap) |
| 5. API client | §3.3 (partial), §3.12, R-113, R-111, P4, P10 | `src/api/client.ts`, `src/api/correlationId.ts`, `src/api/authEvents.ts` | Only the interceptors named in the brief's Step 5 are built — retry/backoff and Circuit Breaker (§3.3 items 3–4) are designed but not in this pass; see Known Gaps |
| 6. Secure token storage | §3.4, R-014 | `src/storage/tokens.ts` | `ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY`; storage left library-default so hardware-backed Keystore is used where available with automatic software fallback, logged as a non-PII flag |
| 7. Navigation skeleton | §3.1 (partial) | `src/navigation/RootNavigator.tsx`, `App.tsx` | Auth/App stack switch on token presence only; deep-linking (§3.9) and silent session-restore-on-cold-start (R-016) are the designed next steps, not built here |
| 8. Placeholder screens | §4.2–§4.5 (screen inventory only) | `src/screens/{Home,Groups,Tournaments,Profile,Login}Screen.tsx` | Centred text only, no logic |
| 9. FCM setup | §3.6, R-070, R-072, R-075, R-111 | `src/notifications/fcm.ts`, `android/app/src/main/AndroidManifest.xml` (`POST_NOTIFICATIONS` permission) | Standalone functions, not yet wired into the sign-in/cold-start lifecycle (that lifecycle depends on the unbuilt auth flow); see Deviations §5 (permission API choice) |
| 10. CLAUDE.md / AGENTS.md | — (process artifact) | `CLAUDE.md`, `AGENTS.md` | Filled in from sadhana templates for React Native bare workflow |

## 3. Proposed Assumptions

1. **`POST /auth/refresh` response body shape.** The local excerpt of DES-MEETUP-MOBILE.md references DES-MEETUP.md §6 for refresh/revocation semantics, but that parent document isn't available in this repo. Assumed the conventional `{ access_token: string, refresh_token: string }` shape (`src/api/client.ts`, `RefreshResponse`). Correct against the actual backend contract on conformance review.
2. **`userAgent` field format for `POST /notifications/mobile-subscriptions`.** Not specified in the local design excerpt. Used a minimal, non-PII `MeetupMobile-Android/<Platform.Version>` string (`src/notifications/fcm.ts`, `buildUserAgent()`). Correct once the backend's expected format is confirmed.
3. **iOS scaffold left in place, unconfigured.** `react-native init`/CLI generates both `android/` and `ios/` by default; the design is Android-only (R-004/Non-Goal 1). Left the default `ios/` directory as-is (untouched, unconfigured) rather than deleting it, since the brief didn't ask for its removal and deleting generated scaffold output seemed like a larger, unrequested change. No iOS build target is wired or implied to work.
4. **Firebase Android Gradle plugin not wired.** The brief's Step 2 was JS-level dependency installation only (`npm install @react-native-firebase/app @react-native-firebase/messaging`). Wiring the native `com.google.gms.google-services` Gradle plugin and a `google-services.json` placeholder was not in the brief's numbered steps, so it was left undone rather than invented — see Known Gaps.

## 4. Deviations

1. **React Native pinned to 0.86.3, not "latest" (0.87.1), and the `@react-native-community/cli` init flow used instead of the deprecated `react-native init`.** `npx react-native@latest init` failed outright (no project created) because RN 0.87.1's own toolchain requires Node `^22.13.0 || ^24.3.0 || >=26.0.0`, and this machine runs Node v20.20.2. 0.86.3 is the newest stable release whose `engines.node` (`^20.19.4 || ^22.13.0 || ^24.3.0 || >=25`) is satisfied by the installed Node. This is a Gate 1 environment-conflict resolution, not a design deviation — the design names no specific RN version. `package.json`'s `engines.node` was also corrected from the generator's own default (`>=22.11.0`, inconsistent with what 0.86.3 itself needs) to `>=20.19.4`.
2. **`--template react-native-template-typescript` omitted.** The current `@react-native-community/cli` explicitly ignores this flag ("Starting from React Native v0.71 TypeScript is used by default") and using it with an explicit `--version` produced a template-resolution error. The resulting scaffold is TypeScript by default, matching the brief's intent (a TS project) even though the specific package name in the brief's command is now a no-op/obsolete instruction under the current toolchain.
3. **`minSdkVersion` corrected from the generator's default (24) to 26.** DES-MEETUP-MOBILE.md §1 and REQ-MEETUP-MOBILE.md Assumption 10 both explicitly pin minimum API level 26; the RN CLI's own template defaults to 24. Corrected in `android/build.gradle` to match the already-decided design value — not a deviation from the design, a correction of the generator's default *toward* the design.
4. **Correlation ID: implemented per logical action (design §3.12), not "per request" as the brief's Step 5 literally worded it.** DES-MEETUP-MOBILE.md §3.12 explicitly rejects per-HTTP-call correlation IDs ("would fragment a single action's trace") in favor of one ID per logical action shared across a multi-call sequence via a `withCorrelationId()` wrapper — which the design names explicitly. Implemented `withCorrelationId()` in `src/api/correlationId.ts` per the design; the axios request interceptor falls back to generating a fresh per-call ID only when no logical-action ID was threaded in, so a single ad hoc call still gets a valid, traceable ID (R-113 holds either way).
5. **FCM Android 13+ permission requested via core `PermissionsAndroid`, not `messaging().requestPermission()`.** The installed `@react-native-firebase/messaging` version's `requestPermission()` is documented in its own type declarations as deprecated and iOS-oriented; it does not represent Android's actual runtime `POST_NOTIFICATIONS` permission model described in §3.6. Used React Native's core `PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS')` for API 33+, gated by `Platform.Version`, matching the design's actual described behavior rather than the (non-functional-for-this-purpose) library method the brief's wording could be read to imply.

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

**Tests** (default RN smoke test, exercising `App.tsx` → `RootNavigator` → keychain-backed token check), run 3x for stability:
```
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
--- Run 1 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
--- Run 2 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
--- Run 3 ---
```

**Gradle config evaluation** — no Android SDK is installed in this environment (no `ANDROID_HOME`/`local.properties`), so a full build could not be run. `./gradlew :app:tasks --all` was run to confirm the edited `android/app/build.gradle` and `android/build.gradle` parse: the run proceeded past both files and failed only at the expected point — "SDK location not found" — confirming no Groovy syntax errors were introduced by the signing-config edit or the `minSdkVersion` change. A real Android SDK is required to go further; this is an environment-provisioning task, not a scaffold defect.

**Secrets hygiene** (negative-test-equivalent — confirms the exclusion actually works, not just the presence of a `.gitignore` line):
```
$ git check-ignore -v android/key.properties
.gitignore:39:android/key.properties	android/key.properties

$ git add -n . | grep -i key.properties
add 'android/key.properties.example'
```
Only the placeholder file (`android/key.properties.example`, no real values) would be staged; the real `android/key.properties` (copied from `~/Developer/newgames/android/key.properties`, mode 600) is excluded.

**No sensitive data in logs** (grep across `src/`):
```
$ grep -rn "console\.\(log\|warn\|error\)" src
src/storage/tokens.ts:37: console.warn(`[tokens] ${label} stored with a legacy, unauthenticated backing (${storage})`)
src/notifications/fcm.ts: console.log('[fcm] foreground message received', { messageId, notificationType })
```
Neither line logs a token, password, or check-in code value — only a non-PII storage-backing flag and message metadata, per R-111/§5.4.

## 6. Known gaps / follow-ups

1. **`process.env.API_BASE_URL` does not actually resolve at runtime yet.** Bare React Native does not substitute custom env vars into the Metro bundle without an additional mechanism (e.g. `react-native-config` or a babel env-inline plugin) — none is wired. `config/env.ts` is exactly as specified in the brief and will fall through to the hardcoded default today. Flagged in `CLAUDE.md`/`AGENTS.md` Stack Gotchas; needs a follow-up task once the env-injection mechanism is decided.
2. **`@react-native-firebase/app`/`messaging` need native Android wiring to build**: a `google-services.json` and the `com.google.gms.google-services` Gradle plugin are not yet added (see Proposed Assumption 4). `npm run android` will fail at the Firebase native layer until this is done.
3. **`react-native-camera` is unmaintained** (last publish 2021, archived upstream). Installed exactly as specified in the brief; flagged as a real build-compatibility risk against RN's current Android toolchain/New Architecture before the QR-scan screen is built out. Not swapped for an alternative unilaterally — that decision belongs to the architect.
4. **§3.3's retry/backoff and Circuit Breaker interceptors are not built.** Only auth-header injection, correlation-ID injection, and the 401-refresh-and-retry-once flow are implemented in `src/api/client.ts`, per the brief's explicit Step 5 list. The other two interceptors are fully designed (§3.3) but out of this scaffold pass's scope.
5. **Deep-link routing (§3.9) and session silent-restore-on-cold-start (R-016) are not built.** `RootNavigator` checks token presence once at mount and listens for `auth-expired`; it does not yet attempt a silent refresh on cold start or handle `meetup://`/App Links.
6. **A documentation inconsistency was noticed but is out of this task's scope to fix**: REQ-MEETUP-MOBILE.md's R-005 changelog text names R-029/R-030/R-031 as the mobile push-registration and self-deletion amendments, but the requirements table itself shows R-030/R-031 as pre-existing group-management requirements and R-124 as the actual self-deletion requirement. This did not block this scaffold (the concrete endpoint paths used, `POST`/`DELETE /notifications/mobile-subscriptions`, are unambiguous from DES-MEETUP-MOBILE.md §7.6 regardless of the R-ID numbering question) but should be reconciled by the architect in the requirements baseline.
7. **iOS scaffold present but fully unconfigured** — see Proposed Assumption 3.

## 7. Dependencies installed

**Runtime** (`package.json` dependencies, exact resolved versions from `npm ls`):
@react-native-async-storage/async-storage@3.1.1, @react-native-firebase/app@26.4.0, @react-native-firebase/messaging@26.4.0, @react-navigation/bottom-tabs@7.18.18, @react-navigation/native@7.3.18, @react-navigation/native-stack@7.18.10, axios@1.20.0, react@19.2.3, react-native@0.86.3, react-native-camera@4.2.1, react-native-keychain@10.0.0, react-native-qrcode-svg@6.3.24, react-native-safe-area-context@5.9.1, react-native-screens@4.27.0, react-native-svg@15.15.5, react-native-uuid@2.0.4.

**Dev**: @types/react@19.3.0, @types/react-native@0.72.8 (deprecated by upstream since RN ships its own types — installed exactly as the brief specified), typescript@5.9.3, plus the RN-generated devDependencies (`@react-native/*` toolchain, jest, eslint, prettier).

## 8. Android signing config confirmation

- `android/key.properties` copied from `~/Developer/newgames/android/key.properties` (real values), permissions set to `600`.
- Confirmed excluded via `git check-ignore -v android/key.properties` (see §5).
- `android/app/build.gradle`: release `signingConfigs` block reads `keyAlias`/`keyPassword`/`storeFile`/`storePassword` from `key.properties` (pattern translated from the Kotlin DSL in `~/Developer/newgames/android/app/build.gradle.kts` into this project's Groovy `build.gradle`), falling back to the debug signing config only when `key.properties` is absent so a checkout without the real keystore can still assemble a debug build.
- `android/key.properties.example` committed as the clearly-named placeholder (§3.11's "only placeholder files may be committed" requirement).

## 9. Completion Proof

**Test evidence** (raw output):
```
$ for i in 1 2 3; do npx jest 2>&1 | tail -6; echo "--- Run $i ---"; done
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.575 s, estimated 1 s
Ran all test suites.
--- Run 1 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.373 s, estimated 1 s
Ran all test suites.
--- Run 2 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.368 s, estimated 1 s
Ran all test suites.
--- Run 3 ---
```

**Git evidence**:
```
$ git log --oneline -3
b7965c0 feat(scaffold): initialise bare React Native project with navigation, API client, FCM setup, and Android signing config
562e6f4 Delete docs/design.md
ad87440 docs: add DES-MEETUP-MOBILE and REQ-MEETUP-MOBILE design baselines

$ git status
On branch main
Your branch is up to date with 'origin/main'.
```
The initial push (`git push origin main`) was rejected — `origin/main` had advanced with an unrelated commit (`562e6f4 Delete docs/design.md`, made outside this session) that this session's local branch didn't have. Fetched and rebased the scaffold commit onto the updated `origin/main` (linear replay, no conflicts — the two commits touch disjoint files) rather than force-pushing, then pushed successfully:
```
$ git push origin main
To https://github.com/pratheeshku/meetup-mobile.git
   562e6f4..b7965c0  main -> main
```

**File evidence**:
```
$ grep -n "export async function" src/storage/tokens.ts
41:export async function saveTokens(access: string, refresh: string): Promise<void> {
61:export async function getAccessToken(): Promise<string | null> {
66:export async function getRefreshToken(): Promise<string | null> {
71:export async function clearTokens(): Promise<void> {
```

**Build evidence**: no JS bundle/Android build was produced (no Android SDK in this environment — see §5 Gradle config evaluation note). `npx tsc --noEmit` and `npx eslint` (both exit 0, §5) stand in as the applicable build-adjacent evidence for a scaffold with no compiled artifact target in this pass.

## 10. Deliverable checklist (per task brief)

- Every file created — see §2 traceability map and the file tree below.
- npm packages installed with versions — §7.
- Android signing config confirmed — §8.
- key.properties confirmed in `.gitignore` — §5, §8.
- Git push evidence — pushed to `origin/main` (`https://github.com/pratheeshku/meetup-mobile.git`) after rebasing onto an out-of-band remote commit; see §5/§9 Git evidence.
- Deviations from brief — §4.

### Full file tree created/modified in this pass

```
config/env.ts
global.d.ts
src/api/authEvents.ts
src/api/client.ts
src/api/correlationId.ts
src/navigation/RootNavigator.tsx
src/notifications/fcm.ts
src/screens/GroupsScreen.tsx
src/screens/HomeScreen.tsx
src/screens/LoginScreen.tsx
src/screens/ProfileScreen.tsx
src/screens/TournamentsScreen.tsx
src/storage/tokens.ts
App.tsx (modified — renders RootNavigator instead of the generated template screen)
jest.config.js (modified — transformIgnorePatterns + setupFiles)
jest.setup.js (new — react-native-keychain mock)
.gitignore (modified — key.properties/.env/google-services.json exclusions added)
android/build.gradle (modified — minSdkVersion 24 → 26)
android/app/build.gradle (modified — release signingConfigs from key.properties)
android/app/src/main/AndroidManifest.xml (modified — POST_NOTIFICATIONS permission)
android/key.properties (new, gitignored, real values — not committed)
android/key.properties.example (new — placeholder, committed)
package.json (RN-generated + brief's dependency installs; engines.node corrected)
CLAUDE.md (new, from sadhana template)
AGENTS.md (new, from sadhana template)
README.md (modified — merged original repo description with RN template README)
plus the standard RN-generated scaffold: index.js, app.json, babel.config.js, metro.config.js,
tsconfig.json, .eslintrc.js, .prettierrc.js, .watchmanconfig, .bundle/, Gemfile, __tests__/,
android/, ios/
```
