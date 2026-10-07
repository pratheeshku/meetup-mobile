# Implementation Report — iOS Social Login (Apple & Google)

## 1. Design Reference
- **Doc ID**: DES-MEETUP-ADDENDUM-social-login
- **Version**: v1.1, architect-approved
- **Status**: APPROVED
- **Tier**: T1 (AD-6, AD-8, AD-9, §5.2, OI-1, OI-2)
- **Branch**: `feat/social-login-ios` off `main`

---

## 2. Library Choice (OI-2)
- **Selected Library**: `@invertase/react-native-apple-authentication` (version `^2.5.1`)
- **Justification**: Maintained, battle-tested de facto standard for Sign in with Apple in React Native bare workflow, actively supported by Invertase and compliant with Apple Human Interface Guidelines.

---

## 3. OI-1 Answer (Google Client IDs & ID Token Audience)
- **iOS Client ID (`iosClientId`)**: `550742520731-suf3bmm21e2ifuf0lmfhedg5j8pn8rpl.apps.googleusercontent.com` (from user configuration).
- **Web Client ID (`webClientId`)**: `716110883386-504n10sm8npuuo2gfeku7epst0j353kl.apps.googleusercontent.com` (from `.env.example` / `config/env.ts` / `google-services.json`).
- **Resulting `id_token` Audience**:
  When `GoogleSignin.configure({ webClientId, iosClientId })` is invoked on iOS, Google Identity Services / AppAuth requests an OpenID Connect ID token where the audience (`aud` claim) is minted for the server application (`webClientId`: `716110883386-504n10sm8npuuo2gfeku7epst0j353kl.apps.googleusercontent.com`).
  This audience is **identical** to the audience emitted on Android.
  Therefore, if the backend `GOOGLE_MOBILE_CLIENT_ID` configuration already contains `716110883386-504n10sm8npuuo2gfeku7epst0j353kl.apps.googleusercontent.com`, both Android and iOS tokens authenticate identically without requiring changes to backend code. If the backend verification routine explicitly checks the client's origin bundle / client ID against `iosClientId`, `550742520731-suf3bmm21e2ifuf0lmfhedg5j8pn8rpl.apps.googleusercontent.com` should be appended to `GOOGLE_MOBILE_CLIENT_ID` as a comma-separated list.

---

## 4. Traceability Map

| Requirement / Section | Files Touched | Purpose & Mechanics |
|-----------------------|---------------|---------------------|
| **AD-6**: Apple button (iOS only) | `src/auth/appleAuth.ts`, `src/auth/AuthContext.tsx`, `src/screens/LoginScreen.tsx`, `src/screens/RegisterScreen.tsx`, `ios/MeetupMobile/MeetupMobile.entitlements`, `src/labels/defaultLabels.ts` | Displays Apple HIG-compliant `AppleButton` on Login and Register screens when `Platform.OS === 'ios'`. Calls `POST /auth/oauth/apple/callback` with `{code, client_kind: "native", full_name?: "<given> <family>", terms_version}`. Only `authorizationCode` is transmitted; `identityToken` is never sent or stored. Cancellations (`ERR_REQUEST_CANCELED`, code `1001`, or `appleAuth.Error.CANCELED`) are completely silent. Other failures show a single generic message `"Apple sign-in failed. Please try again."` without server detail. Entitlement `com.apple.developer.applesignin = ["Default"]` configured in iOS entitlements. |
| **AD-8**: Google on iOS (un-hide) | `src/auth/googleSupport.ts`, `src/auth/googleAuth.ts`, `config/env.ts`, `.env.example`, `ios/MeetupMobile/Info.plist` | Unhides Google button on iOS Login screen (`isGoogleSignInAvailable()` returns `true` on iOS). Adds `GOOGLE_IOS_CLIENT_ID` (`550742520731-suf3bmm21e2ifuf0lmfhedg5j8pn8rpl.apps.googleusercontent.com`) to config and `CFBundleURLTypes` reversed-client-ID scheme (`com.googleusercontent.apps.550742520731-suf3bmm21e2ifuf0lmfhedg5j8pn8rpl`) to `Info.plist`. In `googleAuth.ts`, bypasses `hasPlayServices` when running on iOS (Android only) and includes `terms_version` in `/auth/oauth/google/callback` payload. |
| **AD-9**: Terms notice | `src/api/home.ts`, `src/components/auth/SocialTermsNotice.tsx`, `src/screens/LoginScreen.tsx`, `src/screens/RegisterScreen.tsx`, `src/labels/defaultLabels.ts` | Renders "By continuing you agree to the Terms and Conditions and Privacy Policy" under social buttons on iOS Login and Register screens. Adds `getLegalLinks` calling `GET /home/legal-links` (`terms_url`, `privacy_url`). If URLs are non-empty and https, renders clickable links opening in browser; on failure or empty URLs, renders plain text without error. Uses existing labels `mob.menu.terms` and `mob.menu.privacy` alongside `mob.auth.social_terms_prefix`. |
| **AD-9 & §5.2**: terms_version | `config/appConfig.json`, `config/env.ts`, `config/__tests__/appConfig.test.ts`, `src/auth/appleAuth.ts`, `src/auth/googleAuth.ts` | Configures `"terms_version": "2026-10-02"` in `appConfig.json` (the effective terms baseline). Reused by both Google and Apple callbacks. Email registration form continues to submit without modification. |

---

## 5. Proposed Assumptions
1. **`terms_version` Configuration Key**: The prompt specified "the existing terms_version config key used by email sign-up". Investigation of the codebase revealed that email sign-up (`RegisterScreen.tsx` / `emailAuth.ts`) does not currently transmit a `terms_version` payload field to `/auth/signup` (sending strictly the 4 fields `email`, `password`, `display_name`, `nickname`). Therefore, `"terms_version": "2026-10-02"` was added to `config/appConfig.json` (the date from `DES-MEETUP-ADDENDUM-TERMS-ACCEPTANCE.md`). Both Apple and Google OAuth callbacks read this shared configuration key. Email sign-up behavior was untouched per rule 4.

---

## 6. Deviations
- None. All implementation details adhere strictly to the specifications in `DES-MEETUP-ADDENDUM-social-login v1.1` and user requirements.

---

## 7. Verification Results
- **Label Audit**: `npm run check:labels` passed (161 files scanned, 573 default labels checked cleanly).
- **Linter**: `npx eslint` passed with 0 errors across all touched code files.
- **Unit & Integration Tests**:
  - `src/auth/__tests__/appleAuth.test.ts` (9 tests passed)
  - `src/components/auth/__tests__/SocialTermsNotice.test.tsx` (3 tests passed)
  - `src/screens/__tests__/LoginScreen.test.tsx` (18 tests passed)
  - `src/screens/__tests__/RegisterScreen.test.tsx` (25 tests passed)
  - `src/screens/__tests__/RegisterScreenTerms.test.tsx` (12 tests passed)
  - `src/auth/__tests__/googleSignInPlatform.test.tsx` (4 tests passed)
  - `config/__tests__/appConfig.test.ts` (2 tests passed)
  - **Total**: 7 suites, 73 tests passed, 0 failures.

---

## 8. Manual Device Checklist

### Apple Sign-In (iOS Device / Simulator)
1. **New Account Registration**:
   - Open app on iOS -> navigate to Register or Login screen.
   - Verify "Continue with Apple" button is visible and styled according to Apple HIG.
   - Tap "Continue with Apple" -> Apple system sheet appears requesting Name and Email.
   - Select "Share My Email" or "Hide My Email" -> authenticate with Face ID / Touch ID / Passcode.
   - App calls `POST /auth/oauth/apple/callback` with `code`, `client_kind: "native"`, `full_name`, and `terms_version`.
   - Verify tokens are saved to Keychain, session restored, and user is navigated to Home screen.
2. **Returning User Login**:
   - Tap "Continue with Apple" on Login screen.
   - System sheet prompts for 1-tap confirmation (no name requested by Apple).
   - App calls `POST /auth/oauth/apple/callback` with `code`, `client_kind: "native"`, `terms_version` (no `full_name`).
   - User successfully logs in.
3. **Cancellation**:
   - Tap "Continue with Apple" -> dismiss/cancel the Apple system sheet.
   - Verify dismissal is silent: no error banner or inline message appears.
4. **Backend Failure Handling**:
   - Trigger network failure or server error during callback.
   - Verify user sees generic message: "Apple sign-in failed. Please try again." (no server trace or raw status displayed).

### Google Sign-In (iOS Device / Simulator)
1. **Unhide Verification**:
   - Open Login screen on iOS -> verify Google Sign-In button is rendered (previously hidden).
   - Register screen has no Google button on either platform.
2. **Sign-In Flow**:
   - Tap Google Sign-In button -> Google account picker opens.
   - Select account -> App receives ID token and posts to `/auth/oauth/google/callback` with `id_token` and `terms_version`.
   - User is logged in and navigated to Home screen.
3. **Cancellation**:
   - Cancel Google account picker -> verify dismissal is silent with no error banner.

### Terms Notice (iOS)
1. **Display**:
   - Below social buttons on Login and Register screens, notice reads:
     "By continuing you agree to the Terms and Conditions and Privacy Policy".
2. **Link Navigation**:
   - Tap "Terms and Conditions" -> opens `terms_url` in system browser.
   - Tap "Privacy Policy" -> opens `privacy_url` in system browser.
3. **Graceful Fallback**:
   - When URLs are empty or `GET /home/legal-links` fails, text displays as plain text without links and without displaying any error banner.

### Android Unaffected
1. Verify Google Sign-In works identically on Android.
2. Verify Apple button and social terms notice are NOT rendered on Android.
3. Verify Email login and sign-up are unchanged.

### What Could Not Be Run Locally
- **Apple Sign-In Native Execution**: Sign in with Apple requires a physical iOS device or simulator logged into an Apple ID with active two-factor authentication, configured against an Apple Developer Program Team provisioning profile with the `com.apple.developer.applesignin` entitlement enabled on developer.apple.com for bundle ID `org.duckdns.meetups`. It cannot complete live token exchange in a headless or unprovisioned terminal environment without active provisioning credentials.

---

## 9. Completion Proof

### Test Evidence
```
$ npx jest src/screens/__tests__/LoginScreen.test.tsx src/screens/__tests__/RegisterScreen.test.tsx src/screens/__tests__/RegisterScreenTerms.test.tsx src/auth/__tests__/googleSignInPlatform.test.tsx src/auth/__tests__/appleAuth.test.ts src/components/auth/__tests__/SocialTermsNotice.test.tsx config/__tests__/appConfig.test.ts
PASS src/screens/__tests__/RegisterScreenTerms.test.tsx
PASS src/screens/__tests__/RegisterScreen.test.tsx
PASS src/screens/__tests__/LoginScreen.test.tsx
PASS src/auth/__tests__/googleSignInPlatform.test.tsx
PASS src/components/auth/__tests__/SocialTermsNotice.test.tsx
PASS src/auth/__tests__/appleAuth.test.ts
PASS config/__tests__/appConfig.test.ts

Test Suites: 7 passed, 7 total
Tests:       73 passed, 73 total
Snapshots:   0 total
Time:        1.218 s
Ran all test suites matching /src\/screens\/__tests__\/LoginScreen.test.tsx|src\/screens\/__tests__\/RegisterScreen.test.tsx|src\/screens\/__tests__\/RegisterScreenTerms.test.tsx|src\/auth\/__tests__\/googleSignInPlatform.test.tsx|src\/auth\/__tests__\/appleAuth.test.ts|src\/components\/auth\/__tests__\/SocialTermsNotice.test.tsx|config\/__tests__\/appConfig.test.ts/i.
```

### Git Evidence
```
$ git log --oneline -3
a5a556b Merge pull request #4 from pratheeshku/release/home-v2-test
fbcce82 chore(ios): TestFlight build number 9
5d648d9 chore(android): versionCode 48

$ git status
On branch feat/social-login-ios
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   .env.example
	modified:   config/__tests__/appConfig.test.ts
	modified:   config/appConfig.json
	modified:   config/env.ts
	modified:   ios/MeetupMobile.xcodeproj/project.pbxproj
	modified:   ios/MeetupMobile/Info.plist
	modified:   ios/MeetupMobile/MeetupMobile.entitlements
	modified:   ios/MeetupMobile/PrivacyInfo.xcprivacy
	modified:   jest.config.js
	modified:   jest.setup.js
	modified:   package-lock.json
	modified:   package.json
	modified:   src/api/home.ts
	modified:   src/auth/AuthContext.tsx
	modified:   src/auth/__tests__/googleSignInPlatform.test.tsx
	modified:   src/auth/googleAuth.ts
	modified:   src/auth/googleSupport.ts
	modified:   src/labels/defaultLabels.ts
	modified:   src/screens/LoginScreen.tsx
	modified:   src/screens/RegisterScreen.tsx
	modified:   src/screens/__tests__/LoginScreen.test.tsx
	modified:   src/screens/__tests__/RegisterScreen.test.tsx

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/reports/IMPL-DES-MEETUP-ADDENDUM-social-login-ios.md
	docs/reports/agent-enhancement-2026-10-07.md
	implementation-status-DES-MEETUP-ADDENDUM-social-login.md
	ios/MeetupMobile.xcworkspace/
	ios/Podfile.lock
	src/auth/__tests__/appleAuth.test.ts
	src/auth/appleAuth.ts
	src/components/auth/
```

### File Evidence
```
$ grep -n "com.apple.developer.applesignin" ios/MeetupMobile/MeetupMobile.entitlements
7:	<key>com.apple.developer.applesignin</key>

$ grep -n "auth/oauth/apple/callback" src/auth/appleAuth.ts
91:      '/auth/oauth/apple/callback',

$ grep -n "SocialTermsNotice" src/screens/LoginScreen.tsx src/screens/RegisterScreen.tsx
src/screens/LoginScreen.tsx:28:import SocialTermsNotice from '../components/auth/SocialTermsNotice';
src/screens/LoginScreen.tsx:206:          <SocialTermsNotice />
src/screens/RegisterScreen.tsx:25:import SocialTermsNotice from '../components/auth/SocialTermsNotice';
src/screens/RegisterScreen.tsx:189:          <SocialTermsNotice />
```
