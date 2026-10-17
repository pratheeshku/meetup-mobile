# As-built design: mobile auth and token storage (`src/auth`, `src/storage`)

Status: AS-BUILT, reverse-engineered from code at `main` 79b9a3a (2026-10-17). Not ratified. Version/approval: owner to assign.
Related: [requirements/auth_storage.md](../requirements/auth_storage.md) · [api](api.md) · backend auth design in `~/meetup/docs/as-built/design/auth.md` · `docs/DES-MEETUP-ADDENDUM-email-auth.md`, `-social-login.md`, `-IOS-App.md`

## Purpose
Sign-in by email/password, Google and Apple; session restore; sign-out; secure access-token storage.

## Files
| File | Lines | Role |
|---|---|---|
| `auth/AuthContext.tsx` | 466 | provider and `useAuth()`; session restore, sign-in/out, `auth-expired` handling, push registration lifecycle |
| `auth/emailAuth.ts` | 78 | login, signup, verify-email, resend-verification, reset request |
| `auth/googleAuth.ts` | 205 | Google Sign-In (classic `GoogleSignin`; returns an ID token) |
| `auth/googleSupport.ts` | 6 | Google sign-in offered on Android and iOS |
| `auth/appleAuth.ts` | 99 | Apple sign-in (iOS), sends only the authorization code |
| `auth/sessionRestore.ts` | 59 | classifies a failed startup/resume check as transient or definitive |
| `auth/messages.ts`, `types.ts`, `terms.ts` | 12, 43, 1 | shared message, `AuthResponse`, empty module |
| `storage/tokens.ts` | 227 | Keychain token storage |

## Token model
- **Access token** (15-minute JWT): in `react-native-keychain` (Android Keystore; `ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY`; library picks the best backing, software AES fallback logged as a non-PII flag) plus an in-memory cache for the process lifetime. Concurrent cold reads share one promise; a generation counter stops a stale read from repopulating after a save/clear.
- **Refresh token**: never seen by JavaScript. The backend sets it as an HttpOnly cookie (`refresh_token`, `Path=/auth`, 30 days, rotating). The OS networking stack stores and sends it (`withCredentials`). The only JS operation is "clear all cookies" (`api/cookies.ts`, 2 s guard because the native callback may never fire). `tokens.ts` still has a second Keychain slot for a refresh token and writes it only when `saveTokens(access, refresh)` is given one; the login responses carry none, so the slot stays empty. The refresh token is never cached in memory.

## Flows
- **Email** (`/auth/login`, `/signup`, `/verify-email`, `/resend-verification`, `/reset-password-request`): credentials pass straight to the API call and are never stored or logged. Registration collects four fields plus the terms version (`getTermsVersion()` from `api/home.ts`: server value, else `appConfig.terms_version`).
- **Google**: `GoogleSignin.configure` with web and iOS client ids from `ENV`; a missing ID token fails closed; `POST /auth/oauth/google/callback {id_token, terms_version}`. Deviates from the design's Credential Manager flow (recorded in the file header; needs ratification).
- **Apple** (iOS): `POST /auth/oauth/apple/callback {code, client_kind:'native', terms_version, full_name?}`; the identity token is never sent or stored; generic failure text; cancellation is silent.
- **Session restore** (`AuthContext` on mount and when resuming from the retry splash): stored access token → `GET /users/me`; if absent or unreadable → `POST /auth/refresh`. Only a definitive rejection (refresh 401, no session, or a 401 on a retried request) signs the user out and shows "session expired". Network errors, timeouts, 5xx and 429 are retried with bounded backoff (`SESSION_RESTORE_*`), then the splash retry state is shown (`SessionCheckRetry`); tokens and cookie stay.
- **Auth expiry**: `auth-expired` event from the API client clears the user; the root navigator swaps to the Auth stack.
- **Sign-out**: best-effort `POST /auth/logout`, Google sign-out, clear tokens and cookie jar, stop push registration (de-registers the device token), clear user.
- **Push**: `startPushRegistration()` runs whenever a session exists and its stop function on sign-out (see [notifications](notifications.md)).

## Security properties observed
Passwords, codes and tokens are never logged; log lines carry error class tags only (`utils/logSafeError.ts`). Tokens are not in AsyncStorage. Google and Apple client ids are public identifiers kept in `config/env.ts` and `.env.example`.

## Drift and findings
- 🟡 MEDIUM Refresh token lives in the OS cookie jar rather than Keychain (see [architecture_overview](architecture_overview.md)); the Android jar is the WebView's persistent cookie database, readable by anything with app-private storage access (root, backups if enabled). `AndroidManifest.xml` sets `android:allowBackup="false"`, which keeps the cookie database out of device backups.
- 🟡 MEDIUM `clearCookieJar` clears every cookie in the shared store; fine while the app has no other cookie user.
- 🟢 LOW `tokens.ts` retains a refresh-token slot that the current contract never fills.
- 🟢 LOW Google flow uses the legacy SDK (documented deviation, awaiting ratification).
