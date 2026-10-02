# DESIGN ADDENDUM — iOS Mobile App (iPhone, v1)

**Amends:** DES-MEETUP-MOBILE.md (new section; touches §4.x push, auth, profile photo)
**Companion to:** DES-MEETUP-ADDENDUM-IOS-PN-Support.md (backend, merged to main)
**DES-MEETUP-MOBILE version:** [assign]  |  **Status:** APPROVED
**Approved by:** Pratheesh  |  **Date:** 2026-10-02
**Repo:** meetup-mobile (React Native, bare)  |  **Branch:** feat/ios-mobile (merged to main later)

---

## 1. Objective and principles
Deliver an iPhone build of the existing Android app with feature parity and no behaviour change on Android.
- **One codebase.** Platform differences live in a thin adapter layer (`*.ios.ts` / `*.android.ts` behind one interface). Screens and business logic stay platform-blind.
- **No hardcoding (P1).** The platform value sent to the backend comes from `Platform.OS`, never a literal. Store links, privacy URL, support contact, display name and build numbers come from a configuration file.
- **Android is frozen.** Every shared-file change must leave Android behaviour byte-for-byte equivalent. Existing Android tests pass unmodified.

## 2. Scope
**In scope:** email registration and login; forgot password; email sign-up fix; account deletion; profile (photo, skills, mobile number); home, games, groups; invites; shareable links (browser, no deep linking); push notifications (basic alert); the existing photo report.
**Out of scope / deferred:** see Part 9.

## 3. Platform adapters (the complete list)
| Area | Today (Android-only) | iOS design |
|---|---|---|
| Device ID (`deviceId.ts`) | `getAndroidId()`, '' elsewhere | iOS: UUID generated once and stored in Keychain; survives reinstall. Android unchanged. Never return an empty string. |
| Push registration (`fcm.ts`) | literal `platform: 'android'`; user agent `MeetupMobile-Android/…` | `platform` = `Platform.OS`; user agent built from `Platform.OS` and `Platform.Version`. |
| Push permission (`fcm.ts`) | `PermissionsAndroid` for API ≥33 | iOS: Firebase `requestPermission`; the existing non-Android fallback is used. |
| Permission rationale copy (`pushRegistration.ts`) | "Android will ask…" | Platform-neutral wording. |
| Notification channels (`channels.ts`, `index.js`) | Notifee channel creation | Guard so it runs on Android only. |
| Notification display (`participantHandler.ts`, `eventNotificationHandler.ts`) | `android:` options only | Add an `ios:` options block (banner, sound, list; no category, no action buttons). Do not merge the two handlers. |
| Google sign-in (`LoginScreen.tsx`, `AuthContext.tsx`, `googleAuth.ts`) | Always shown | Not rendered on iOS. `configureGoogleSignIn()` and `hasPlayServices` are never called on iOS. Check the Register screen too. |
| Images | Android picker | iOS picker output must be JPEG (HEIC never reaches the backend); crop UI as Android; no flip (unsupported by the native crop controllers). |
| Date/time picker | Android two-step dialog | Existing iOS branch retained; tested on iOS, not rewritten. |

## 4. Push behaviour (iOS)
- Backend sends iOS a visible alert (notification block plus apns config) for every type, including `event_participant_added` and `event_participant_removed`.
- **Killed or background:** the system displays the alert. The app's background handler must not render a second notification for alerts the system already displayed.
- **Foreground:** the app displays the notification through Notifee with iOS foreground presentation options.
- Tapping a notification navigates exactly as on Android (`url` in the payload).
- Token registration sends the stable device ID and the `Platform.OS` platform; token rotation upserts on `(user, platform, device_id)`.

## 5. Native project (written as text; compiled later on a Mac)
- Bundle identifier `org.duckdns.meetups`; display name from config (same as Android); iPhone only (iPad runs in compatibility mode).
- `Info.plist`: photo-library and camera usage strings, `LSApplicationQueriesSchemes` including `whatsapp`, remote-notification background mode.
- Entitlements: push notifications (`aps-environment`).
- Firebase: iOS config file `GoogleService-Info.plist` is supplied by Pratheesh, handled by the same git rule as `google-services.json`, never fabricated.
- App icons and launch screen as iOS asset catalog entries.
- iOS marketing version and build number come from config, as separate counters from Android's `versionCode`.
- Do not commit `Pods/`. `Podfile.lock` is generated and committed from the first Mac or CI build.

## 6. Shared features (no iOS-specific code expected)
Forgot password (emailed link, opens in the browser, no deep linking), the email sign-up fix, account deletion (reachable from Profile, required by App Review), skills, mobile number, and share links. The implementing agent verifies each is present in the shared code and reports any that are Android-only.

## 7. Configuration (P1)
A single configuration file holds: privacy-policy URL, support contact, display name, iOS marketing version and build number. Values not yet available are explicit placeholders, and screens that show them handle empty values.

## 8. Architecture decisions
- **AD-iOS-M1:** one repo, one branch lineage, adapter layer (no fork).
- **AD-iOS-M2:** Google sign-in hidden on iOS; Google registration to be removed before production; Sign in with Apple deferred (guideline 4.8 applies if any third-party login is ever offered on iOS).
- **AD-iOS-M3:** iOS push relies on system alerts, with foreground rendering in-app (data-only does not work reliably on iOS).
- **AD-iOS-M4:** content reporting reuses the existing photo report (profile-photo addendum); no new backend.
- **AD-iOS-M5:** client converts to JPEG; backend image rules unchanged.
- **Deviation from `design-best-practices.md` or `Enterprise_Design_Principles`:** none.

## 9. Deferred decisions (measurable gates, BP-10)
- **D-M1 iOS rich notifications** (actions, images, categories): >20 active iOS tokens, or an explicit product requirement.
- **D-M2 Sign in with Apple:** any third-party login re-enabled on iOS.
- **D-M3 Reporting and per-user block for text content** (event/group names): App Review asks for it, or an abusive text report is received.
- **D-M4 iOS entry in `GET /app/version-policy`:** before the first public App Store release.
- **D-M5 Per-user block feature:** same trigger as D-M3.

## 10. Verification
- **Cloud environment (no Mac):** TypeScript compile, lint, and Jest with the platform mocked as both `android` and `ios`. Required tests: device ID never empty on iOS; registration sends `Platform.OS`; Google sign-in not rendered or initialised on iOS; notification handlers produce `ios` options on iOS and unchanged output on Android; rationale copy is platform-neutral.
- **Mac or CI (first real compile):** `pod install`, build, simulator run, then device and TestFlight.
- **On-device checks:** push in foreground, background and force-quit; no duplicate notification; photo upload yields JPEG; forgot-password link opens in Safari; account deletion works; date/time picker behaves.

## 11. Open items
1. `GoogleService-Info.plist` and the APNs key: Pratheesh supplies; the key is uploaded to Firebase.
2. Confirm Android already exposes the photo-report action in the app; if not, iOS inherits the gap and carries App Review risk.
3. Confirm a UUID source exists in current dependencies. If a new dependency is needed, stop and report before adding it.
4. Confirm the picker's JPEG-forcing option on the installed version.
5. Confirm the Android date/time AM/PM bug is separate from iOS (iOS uses its own spinner).

## 12. Consistency checks on write-back (BP-03, BP-09)
Grep DES-MEETUP-MOBILE and REQ-MEETUP-MOBILE for "iOS", "Android", "deferred" and "out of scope"; reconcile the Non-Goals entry and any statement that iOS push is deferred.