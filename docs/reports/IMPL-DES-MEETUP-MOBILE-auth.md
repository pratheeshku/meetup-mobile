# Implementation Report — meetup-mobile auth module

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version / Status**: APPROVED, architect-approved 2026-09-13
- **Tier**: T1
- **Requirements baseline**: REQ-MEETUP-MOBILE, APPROVED (architect-approved 2026-09-13, R-005 corrected 2026-09-13)
- **Sections read**: §3.3 (API Client Design), §3.4 (Token Storage), §3.5 (Auth Flow), §3.10 (Role-Based UI Gating), §3.12 (Correlation ID), §4.2 (Authentication screens), §5.1 (Token Lifecycle), §5.2 (FCM Token Lifecycle), §5.4/§5.8 (logging/compliance), §7.1/§7.2 (API Contract), §10 (Open Items)
- **R-IDs targeted**: R-010, R-012, R-013, R-014, R-016, R-017 (per task brief); R-011 explicitly excluded (deferred, Non-Goal 9); R-030/R-077/OI-2 (FCM de-registration ordering) and R-113 (correlation ID) pulled in as direct consequences of §3.5's signOut sequence
- **Scope of this pass**: full auth module — Google OAuth, email/password sign-in and registration, token management (reusing the scaffold's existing Keychain storage), logout, Login/Register screens, and wiring `AuthContext` into the root navigator's Auth/App stack switch

## 2. Traceability map

| Brief step | Design section / R-ID | Files | Notes |
|---|---|---|---|
| 1. Install auth dependency | §3.5 (package named) | `package.json`, `package-lock.json` | `@react-native-google-signin/google-signin@16.1.5` — see Deviations §1 for the API-surface discrepancy discovered against §3.5's Credential Manager description |
| 2. Google Sign-In config/signIn/signOut | §3.5, §5.1, §5.2, R-010, R-013, R-030 | `src/auth/googleAuth.ts` | See Deviations §1 |
| 3. Email/password auth | §3.5, §4.2, R-012 | `src/auth/emailAuth.ts` | |
| 4. Auth context | §3.5, §4.2, §5.1, R-010, R-012, R-013, R-016 | `src/auth/AuthContext.tsx` | Session restore reuses existing `getAccessToken()`/`apiClient` from the scaffold pass unchanged |
| 5. Login screen | §4.2, R-010, R-012 | `src/screens/LoginScreen.tsx` | Replaces the scaffold placeholder |
| 6. Registration screen | §4.2, R-012 | `src/screens/RegisterScreen.tsx` | New |
| 7. Wire AuthContext into app | §3.1 (nav switch), §4.2 | `App.tsx`, `src/navigation/RootNavigator.tsx`, `src/navigation/types.ts` | `RootNavigator` now derives its Auth/App stack switch from `AuthContext`'s `user` instead of directly reading Keychain itself |
| 8. `GOOGLE_WEB_CLIENT_ID` config | R-010, R-018 | `config/env.ts`, `.env.example`, `.env` (gitignored, not committed) | See Proposed Assumption/gap note under R-018 in §3 below — value provided directly by the user mid-session after the `google-services.json` lookup the brief named came up empty |
| R-030 FCM de-registration primitive | §3.5, §5.2, R-030, R-077, OI-2 | `src/notifications/fcm.ts` (`deregisterDeviceToken`, new) | The scaffold's `fcm.ts` had `getToken`/`onTokenRefresh`/`onMessage` but no de-registration call; added the one function `googleAuth.signOut()` needs |
| Test infra for the newly-wired render tree | — | `jest.setup.js` | See Known Gaps §6 in `docs/reports/agent-enhancement-2026-09-13.md` — wiring auth into `App.tsx` pulled `react-native-config`, `@react-native-google-signin/google-signin`, and `@react-native-firebase/{app,messaging}` into the render tree for the first time; all four needed Jest mocks that didn't previously exist |

## 3. Proposed Assumptions

1. **Response body shape of `POST /auth/login`, `POST /auth/register`, and `POST /auth/oauth/google/callback`.** Not specified in the local design excerpt (§7.1 lists method/path/auth-required/notes only; the parent `DES-MEETUP.md` is not available in this repo — the same gap already recorded against `POST /auth/refresh` in the scaffold pass's `src/api/client.ts`). Assumed all three return `{ access_token, refresh_token, user }` in one response, consistent with the already-established snake_case token-field convention. `src/auth/types.ts`, `AuthResponse`. Correct against the actual backend contract on conformance review.
2. **`UserProfile` shape.** Not specified beyond §3.10's explicit requirement that `GET /users/me` include a `role` field (`'participant' | 'organiser' | 'admin'`, backing the design's `useRole()` hook). Added the minimal additional fields (`id`, `email`, `nickname`) a login/register/profile flow needs. `src/auth/types.ts`, `UserProfile`. Correct against the actual backend contract on conformance review.
3. **Cold-start session restore on a `GET /users/me` failure that is *not* a persistent-401 (`auth-expired`).** E.g. a plain network error while a valid token is still in Keychain. Design §4.2's edge-case list covers login/register submission failures and R-016's "renew automatically or ask to sign in again," but doesn't spell out cold-start-restore-specific handling. Implemented conservatively: catch the error, leave `user` as `null` (fail closed — the root navigator falls back to the Auth Stack), and do **not** clear the still-potentially-valid tokens from Keychain (only the `apiClient`'s own persistent-401 path does that, via the existing `auth-expired` event). `src/auth/AuthContext.tsx`, `restoreSession()`. Flagged for conformance review against the intended offline/degraded-connectivity behavior (§4.11, out of this task's explicit R-ID scope).
4. **`GoogleSignin.signOut()` sequencing relative to `POST /auth/logout` and Keystore clearing.** §3.5's generic signOut sequence (DELETE FCM subscription → `POST /auth/logout` → clear Keystore/session state) doesn't name a Google-specific step, since that sequence is written to cover both auth methods generically. The task brief's Step 2 explicitly orders `GoogleSignin.signOut()` between `POST /auth/logout` and `clearTokens()`; implemented exactly that order, wrapped in try/catch since it's a harmless no-op when the session never used Google sign-in (e.g. an email/password user calling the same shared `signOut()`). `src/auth/googleAuth.ts`, `signOut()`.

## 4. Deviations

1. **Google Sign-In uses the free package's classic `GoogleSignin.configure()/signIn()/signOut()` API (backed by the legacy Google Play Services `GoogleSignInClient`/`GoogleSignInOptions`), not Android Credential Manager (`androidx.credentials`) as DES-MEETUP-MOBILE.md §3.5 specifies.**

   §3.5 states Google sign-in is "implemented via Android Credential Manager (`androidx.credentials`), through the Universal Sign-In API of `@react-native-google-signin/google-signin` — Google's current, recommended replacement for the deprecated legacy `GoogleSignin` module," and explicitly names the classic module as a rejected/deprecated alternative.

   Verified empirically before writing any code (Gate 2 dependency audit, extended per this task's own enhancement note — see `docs/reports/agent-enhancement-2026-09-13.md` §5):
   - Installed the exact package the task brief names (`@react-native-google-signin/google-signin@16.1.5`, the current latest).
   - Its own `README.md`: *"This is the free (public) version, supporting Android and iOS. It uses the legacy Google Sign-In SDK on Android."* The Credential-Manager-backed flow the design describes is explicitly marketed as **"Universal Sign In"** (`universal-sign-in.com`) — a **separate commercial product** from the same author, not a mode or API surface of the free package.
   - Confirmed in the package's own Android native source (`node_modules/@react-native-google-signin/google-signin/android/.../RNGoogleSigninModule.java`): imports `com.google.android.gms.auth.api.signin.GoogleSignInClient`/`GoogleSignInOptions` (the legacy Play Services Sign-In SDK). No `androidx.credentials.CredentialManager` import anywhere in the module.
   - There is no `GoogleOneTapSignIn` export in this package version's public API (`index.d.ts`) despite being referenced in a stray doc-comment example inside `functions.d.ts` — confirming the "Universal Sign In"/Credential-Manager path is not reachable from this package at all, at any API name, for free.

   This is a factual discrepancy in the design document, not a genuine implementation ambiguity: no code path exists that satisfies §3.5's literal wording without either (a) purchasing a separate commercial license for a different product, or (b) writing a bespoke native Android module against `androidx.credentials` directly (unscoped, non-trivial native work). Flagged to the user mid-session as a CRITICAL/HIGH gap (touches architecture, security posture, and potential cost) per the Propose & Proceed rule, rather than silently implementing either the brief's literal instruction or the design's stated intent.

   **Resolution**: user confirmed 2026-09-13, in-session: proceed with the free package's classic API (matching the task brief's literal Step 2/5 instructions) — GoogleSignin.configure()/signIn()/signOut() and GoogleSigninButton. This still fully satisfies R-010's actual behavioral requirement ("sign in with Google account without being redirected to a browser or leaving the app") — the classic flow completes via a native Google Play Services account picker, with no browser or WebView involved, identically to Credential Manager from the user's perspective. **This deviation requires the architect's formal ratification against §3.5's wording** (either correct §3.5's technical description, or authorize/budget the commercial "Universal Sign In" product, or scope a bespoke native Credential Manager module as separate work). Not self-certified as compliant with §3.5 as currently worded.

2. **`android/app/google-services.json`'s `oauth_client` array is empty — no web OAuth client (type 3) existed for the `meetup-mobile-6b696` Firebase project at the location the task brief named.** R-018 designates this credential's provisioning as a pre-implementation gate ("Must," "before implementation begins"), and DES-MEETUP-MOBILE.md §10 OI-5 records it as formally CLOSED — but the credential itself was not actually present in the file the brief pointed to. Flagged to the user in-session (not resolved by guessing or fabricating a value); the user supplied the actual web client ID (`716110883386-504n10sm8npuuo2gfeku7epst0j353kl.apps.googleusercontent.com`, project number matches `google-services.json`'s own `project_number`) directly, added to the local, gitignored `.env` only — never committed, never hardcoded in source (P10). `config/env.ts`/`.env.example` wire the config path with the brief's exact `?? ''` fallback pattern regardless, so a checkout without a populated `.env` still compiles and fails closed (empty `webClientId` → native `signIn()` will fail, not silently succeed with a wrong audience).

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

**Tests**, run 3x for stability (see Completion Proof §9 for the literal transcript).

**Secrets hygiene**:
```
$ git check-ignore -v .env
.gitignore:42:.env	.env

$ git status --short
   (`.env` does not appear — confirmed excluded)
```

**No sensitive data in logs** (grep across the new/changed auth surface):
```
$ grep -rn "console\.\(log\|warn\|error\)" src
src/storage/tokens.ts:37: console.warn(...non-PII storage-backing flag...)
src/notifications/fcm.ts:121: console.log(...messageId, notificationType only...)
```
No new logging statements were added by this pass; neither pre-existing line logs a token, password, or credential value (both carried over unchanged from the scaffold pass).

```
$ grep -rn "password\|idToken\|access_token\|refresh_token" src/auth src/screens/LoginScreen.tsx src/screens/RegisterScreen.tsx | grep -i "console\|log"
(no output — nothing sensitive reaches console.*)
```

**No Facebook SDK/imports**:
```
$ grep -rln -i "facebook" src package.json
(no output)
```

**Google Sign-In package installed, no peer conflicts**:
```
$ npm ls @react-native-google-signin/google-signin
MeetupMobile@0.0.1 /Users/pratheesh/Developer/meetup-mobile
└── @react-native-google-signin/google-signin@16.1.5
```

**Android native config** — no manifest/Gradle changes required: `INTERNET` permission already present (scaffold pass); the classic Google Sign-In flow needs no additional permission declaration, and the `com.google.gms.google-services` Gradle plugin (wired in a prior session) already processes `google-services.json` for this app module.

## 6. Known gaps / follow-ups

1. **Deviation §1 (Google Sign-In SDK) needs formal architect ratification** — see §4 above. Until resolved, R-010's traceability to §3.5 is factually accurate for *behavior* (native, no-browser sign-in) but not for the specific *mechanism* (§3.5 names Credential Manager; the shipped code uses the legacy Play Services SDK).
2. **No Android SDK/emulator available in this environment** — `npm run android` was not exercised end-to-end; verification is limited to `tsc`, `eslint`, and the Jest smoke test. The actual Google Sign-In flow (native account picker, ID token exchange) has not been run against a real device or the live backend.
3. **`Forgot Password`** is listed as a screen in §4.2's screen inventory but was not part of this task brief's 8 steps and was not built. Not invented; flagged here as an explicit follow-up rather than silently included or silently dropped.
4. **§3.3's retry/backoff and Circuit Breaker interceptors remain unbuilt** (pre-existing gap from the scaffold pass, unchanged by this task — auth calls go through the same partial `apiClient` as everything else).
5. **Assumption 3 (cold-start restore on non-auth-expired failure)** should be revisited once the actual offline/degraded-connectivity UX (§4.11) is designed in more detail — currently just fails closed to the Auth Stack.
6. **`react-native-config`, `@react-native-google-signin/google-signin`, and `@react-native-firebase/{app,messaging}` are now mocked in `jest.setup.js`** for the first time (previously unnecessary, since nothing in the render tree imported them). See `docs/reports/agent-enhancement-2026-09-13.md` §6 for the generalized lesson.

## 7. Dependencies installed

**Runtime**: `@react-native-google-signin/google-signin@16.1.5` (added). All other dependencies unchanged from the prior scaffold/FCM/vision-camera passes.

## 8. Full file tree created/modified in this pass

```
src/auth/types.ts (new)
src/auth/googleAuth.ts (new)
src/auth/emailAuth.ts (new)
src/auth/AuthContext.tsx (new)
src/navigation/types.ts (new)
src/screens/RegisterScreen.tsx (new)
src/screens/LoginScreen.tsx (modified — real UI replacing placeholder)
src/navigation/RootNavigator.tsx (modified — AuthContext-driven stack switch, Register route added)
src/notifications/fcm.ts (modified — deregisterDeviceToken added)
App.tsx (modified — wrapped in AuthProvider)
config/env.ts (modified — GOOGLE_WEB_CLIENT_ID added)
.env.example (modified — GOOGLE_WEB_CLIENT_ID placeholder added)
.env (modified, gitignored, not committed — real GOOGLE_WEB_CLIENT_ID value added)
jest.setup.js (modified — mocks for react-native-config, google-signin, firebase app/messaging)
package.json / package-lock.json (modified — @react-native-google-signin/google-signin added)
docs/reports/agent-enhancement-2026-09-13.md (modified — appended this session's lessons, §5–§7)
docs/reports/IMPL-DES-MEETUP-MOBILE-auth.md (this file)
```

## 9. Completion Proof

**Test evidence** (raw output, 3 runs):
```
$ for i in 1 2 3; do npx jest 2>&1 | tail -6; echo "--- Run $i ---"; done
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.578 s, estimated 1 s
Ran all test suites.
--- Run 1 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.419 s, estimated 1 s
Ran all test suites.
--- Run 2 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.398 s, estimated 1 s
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
0d7797e feat(auth): implement Google OAuth and email/password auth module with login, registration, and logout flows
ac2012b fix(deps): replace unmaintained react-native-camera with react-native-vision-camera v4
68a7721 feat(android): wire Firebase Google Services Gradle plugin for FCM support

$ git status
On branch main
Your branch is up to date with 'origin/main'.
Untracked files:
	.claude/
(pre-existing, unrelated to this task — left untracked)

$ git push origin main
To https://github.com/pratheeshku/meetup-mobile.git
   ac2012b..0d7797e  main -> main
```

**File evidence**:
```
$ grep -n "export " src/auth/googleAuth.ts src/auth/emailAuth.ts src/auth/AuthContext.tsx
src/auth/googleAuth.ts:configureGoogleSignIn
src/auth/googleAuth.ts:class GoogleSignInCancelledError
src/auth/googleAuth.ts:async function signIn
src/auth/googleAuth.ts:async function signOut
src/auth/emailAuth.ts:async function login
src/auth/emailAuth.ts:async function register
src/auth/AuthContext.tsx:function AuthProvider
src/auth/AuthContext.tsx:function useAuth
```

**Build evidence**: no Android SDK in this environment (unchanged from the scaffold pass) — `npx tsc --noEmit` and `npx eslint` (both exit 0) stand in as the applicable build-adjacent evidence; a real `npm run android` build has not been exercised for this feature.
