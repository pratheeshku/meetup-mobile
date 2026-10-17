# As-built architecture overview (mobile)

Status: AS-BUILT, reverse-engineered from code at `main` 79b9a3a (2026-10-17). Not ratified. Version/approval: owner to assign.
Backend counterpart: `~/meetup/docs/as-built/design/architecture_overview.md`. Monolith for intent: `docs/DES-MEETUP-MOBILE.md`.

## Stack
React Native 0.86.3 (bare workflow, TypeScript), React 19.2.3, React Navigation 7 (native stack + bottom tabs), axios 1.x, `react-native-keychain` (access token), `@react-native-firebase/messaging` (FCM), `react-native-notify-kit` (local notifications), `@react-native-google-signin/google-signin`, `@invertase/react-native-apple-authentication` (iOS), `react-native-config` (build-time env), AsyncStorage (labels cache, flags), `libphonenumber-js`, `react-native-vision-camera`, image crop picker, QR code SVG. Android is the main target; iOS shares the code base (iOS-specific paths exist for Apple sign-in, push options and device id).

## Layout
| Area | Doc | Files / lines (non-test) |
|---|---|---|
| `src/api` | [api](api.md) | 21 files, about 3.3k lines |
| `src/auth`, `src/storage` | [auth_storage](auth_storage.md) | 10 files, about 1.2k lines |
| `src/navigation` | [navigation](navigation.md) | 9 files, about 1.3k lines |
| `src/notifications` | [notifications](notifications.md) | 11 files, about 1.5k lines |
| `src/screens` | [screens](screens.md) | 27 files, about 13.9k lines |
| `src/components` | [components](components.md) | 84 files, about 16.2k lines |
| `src/hooks`, `src/utils`, `src/sports`, `src/onboarding` | [hooks_utils](hooks_utils.md) | 43 files, about 2.8k lines |
| `src/labels`, `src/theme`, `src/diagnostics`, `src/types`, `src/test-utils`, `config/` | [labels_theme_diagnostics](labels_theme_diagnostics.md) | 23 files, about 4.5k lines |

## Runtime composition (`App.tsx`)
`LabelsProvider` (outside the gate so label text is available on the update screen) → `ForceUpdateGate` (blocking screen when the installed `versionCode` is below the server minimum; fails open) → `AuthProvider` (session restore, sign-in methods, push registration) → `RootNavigator` (Auth stack when no user; tabs and stacks when signed in; `Completion` modal; `OnboardingOverlay` over the app when the server says first-run is required). A `NotificationBanner` and `Toast` render foreground feedback.

## Backend coupling
- Base URL from `ENV.API_BASE_URL` (`config/env.ts`); all authenticated calls through one axios instance with bearer injection, correlation IDs and single-flight 401 refresh-and-retry-once.
- 89 distinct API calls; each was checked against the backend route tables and all match (table in [api](api.md)). The app calls no standings endpoint; standings are not recomputed client-side.
- Authorisation in the UI is UX only; the backend decides (as AGENTS.md requires).

## Drift and findings (cross-cutting)
- 🟠 HIGH `config/env.ts` defaults `API_BASE_URL` to `https://meetups.duckdns.org` and the avatar bucket to a Hetzner bucket, both retired hosts, while `docs/ENVIRONMENTS.md` states production is `https://meetupaws.duckdns.org` and says to leave `.env` unset. A build made without a local `.env` override targets the old, stopped server. Production builds are presumably made with an override on the Mac (not in the repo); verify, then fix the defaults (owner decision, touches `config/env.ts` and `ENVIRONMENTS.md`).
- 🟡 MEDIUM AGENTS.md says "Tokens live in Keychain only". The access token does; the refresh token is an HttpOnly cookie held in the OS cookie jar (Android WebView `CookieManager`, the platform cookie store on iOS (not verified in this pass)), never in Keychain; the Keychain refresh slot in `tokens.ts` is only written if the API ever returns a `refresh_token` in the body, which it does not. Behaviour is by design (see [auth_storage](auth_storage.md)); the rule text needs restating.
- 🟡 MEDIUM Brand and scheme names are inconsistent: `appConfig.json` says "GameOn SG", UI text and navigation comments say "Shuttlr", URL schemes `shuttlr:` and `meetup:`, package ids `com.meetupmobile.*`.
- 🟢 LOW Several comments cite `meetups.duckdns.org` (retired) and the backend's removed Hetzner object storage.
