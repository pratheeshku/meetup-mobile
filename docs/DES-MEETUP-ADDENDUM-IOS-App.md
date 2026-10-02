# DESIGN ADDENDUM — iOS Mobile App (iPhone, v1)

**Document:** DES-MEETUP-ADDENDUM-IOS-App.md
**Version:** 1.1
**Status:** APPROVED
**Approved by:** Pratheesh
**Date:** 2026-10-02
**Supersedes:** v1.0 (2026-10-02)
**Amends:** DES-MEETUP-MOBILE.md (new section; touches push, auth, profile and settings)
**Authority:** authoritative until folded into DES-MEETUP-MOBILE.md. It does not itself bump that document's version number.
**Companion:** DES-MEETUP-ADDENDUM-IOS-PN-Support.md v1.1 (backend push support, merged to main)
**Repo:** meetup-mobile (React Native, bare) | **Branch:** feat/ios-mobile (merged to main later)

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-02 | Original approved design: adapter layer, push as system alerts, Google sign-in hidden on iOS, native project files, configuration file, deferred decisions. |
| 1.1 | 2026-10-02 | Corrects AD-iOS-M4: content reporting is a linked form (new section 7), not the photo report, which the mobile app does not have. Records build outcomes and accepted deviations: runtime `Platform.OS` branching instead of platform-extension files; iOS notification permission fix; background-handler skip for system-displayed alerts; `FirebaseApp.configure()`; version and name defaults duplicated in native files with a drift test. Adds open items from the first build (icon, Firebase Podfile settings, email sign-up verification). Revises deferred decisions D-M3 and D-M5. |

---

## 1. Objective and principles
Deliver an iPhone build of the existing Android app with feature parity and no behaviour change on Android.
- **One codebase.** Platform differences are isolated in small helpers and adapter modules. Screens and business logic stay platform-blind.
- **No hardcoding (P1).** The platform value sent to the backend comes from `Platform.OS`. Store links, privacy URL, support contact, report-form URL, display name and iOS version and build number come from `config/appConfig.json`.
- **Android is frozen.** Every shared-file change leaves Android behaviour equivalent. Existing Android tests pass unmodified.

## 2. Scope
**In scope:** email registration and login; forgot password; email sign-up; account deletion; profile (photo, skills, mobile number); home, games, groups; invites; shareable links (browser, no deep linking); push notifications (basic alert); the report form (section 7).
**Out of scope or deferred:** see section 9.

## 3. Platform differences (the complete list)
| Area | Android | iOS design |
|---|---|---|
| Device ID | Android ID | UUID generated once and kept in Keychain; survives reinstall; never empty. |
| Push registration | `platform` and user agent derived from `Platform.OS` and `Platform.Version` (no literals). | Same code path; iOS value is `ios`. |
| Push permission | `PermissionsAndroid` for API 33 and above. | Firebase permission API (`hasPermission` check, then `requestPermission`). |
| Permission rationale copy | Platform-neutral wording. | Same. |
| Notification channels | Created through Notifee. | Not created; the guard lives inside the channel module. |
| Notification display | `android:` options. | `ios:` options (banner, sound, list) through one shared platform-options helper; no category, no action buttons. |
| Google sign-in | Shown. | Not rendered, configured, or initialised. Registration screen has no Google element on either platform. |
| Photo picker | As today. | `forceJpg: true` so HEIC never reaches the backend; crop UI as Android; no flip (unsupported by the native crop controllers). |
| Date and time picker | Android two-step dialog. | Existing iOS spinner branch, tested on iOS and not rewritten. |

**Implementation convention (replaces the v1.0 file-extension rule).** Differences are implemented with runtime `Platform.OS` branching inside small helper modules, not `*.ios.ts` and `*.android.ts` files. Reason: Jest resolves to the iOS platform by default, so extension-resolved files would have changed which code the existing Android tests exercised.

## 4. Push behaviour (iOS)
- The backend sends iOS a visible alert (notification block plus apns config) for every notification type, including the two types that are data-only on Android.
- **Killed or background:** the system displays the alert. The app's background handler returns immediately on iOS when the message carries a notification block, so a second copy is never rendered. Android still renders its data-only messages.
- **Foreground:** the participant and event notification types are displayed through Notifee with iOS foreground presentation options. Other types continue to use the in-app banner, as on Android.
- **Permission:** the previous code returned `true` for the permission check on iOS, so the prompt would never have appeared. The iOS branch now checks Firebase's permission state.
- Tapping a notification navigates through the existing path, which routes on notification type and entity id.
- Token registration sends the stable device ID and `Platform.OS`; token rotation upserts on `(user, platform, device_id)`.

## 5. Native project (written as text; compiled later on a Mac or CI)
- Bundle identifier `org.duckdns.meetups`; display name from configuration; iPhone only (iPad runs in compatibility mode).
- `Info.plist`: photo-library and camera usage strings, `LSApplicationQueriesSchemes` including `whatsapp`, remote-notification background mode.
- `MeetupMobile.entitlements`: `aps-environment`, referenced by the Xcode project.
- `AppDelegate.swift` calls `FirebaseApp.configure()`; push cannot work without it.
- `GoogleService-Info.plist` is supplied by Pratheesh, git-ignored (same handling as `google-services.json`), and never fabricated.
- Marketing version and build number come from configuration, as separate counters from Android's `versionCode`. The native project cannot import the JSON file, so the defaults are duplicated in the Xcode project and `Info.plist`; a test fails if they drift from the configuration. At build time the values are passed to `xcodebuild` from the configuration.
- Do not commit `Pods/`. `Podfile.lock` is generated and committed from the first Mac or CI build.
- App icon: the iOS asset catalog has no images. The existing artwork is 192×192; iOS requires 1024×1024, supplied by Pratheesh.

## 6. Shared features (no iOS-specific code)
Forgot password (emailed link, opens in the browser, no deep linking), account deletion (reachable from Profile, required by App Review), skills, mobile number and share links are present in the shared code. Email sign-up exists; its 2026-10-01 fix is unverified (open item 3).

## 7. Report form (new)
**Purpose:** the App Review expectation for a way to report content or a problem, and the owner's "simple form to capture report/block" requirement.
- **Mechanism:** a form hosted outside the app, opened in the system browser. It captures the report, or a request to block a user. No in-app form, no new backend, no new table.
- **Configuration:** the form's URL is a key in `config/appConfig.json`, beside the privacy-policy URL and support contact. It is an empty placeholder until the form exists.
- **Entry point:** one row, "Report a problem or content", on the Profile screen near account deletion. It is shared code, so Android shows it too once the URL is set.
- **Empty or invalid URL:** the row is hidden. Only `https://` URLs are opened (P9). The URL is opened without a capability check, and an open failure shows a generic alert.
- **Handling:** reports and block requests are actioned manually by the admin using existing admin tools. A "block" means the admin removes or suppresses the user; there is no per-user hide in the app.
- **Responsibility:** the owner monitors the form's responses. App Review expects timely handling of reports.
- **Release gate:** the URL must be filled in before App Store submission.

## 8. Architecture decisions
- **AD-iOS-M1:** one repo, one branch lineage, small platform helpers (no fork).
- **AD-iOS-M2:** Google sign-in hidden on iOS; Google registration to be removed before production; Sign in with Apple deferred (guideline 4.8 applies if any third-party login is offered on iOS).
- **AD-iOS-M3:** iOS push relies on system alerts, with foreground rendering in-app (data-only does not work reliably on iOS).
- **AD-iOS-M4 (corrected in v1.1):** content reporting is a linked form with its URL in configuration (section 7). The v1.0 decision to reuse the photo report was wrong: the mobile app has no photo-report action.
- **AD-iOS-M5:** the client forces JPEG; backend image rules are unchanged.
- **Deviation from `design-best-practices.md` or `Enterprise_Design_Principles`:** none. The duplicated native version and name defaults (section 5) are covered by a drift test.

## 9. Deferred decisions (measurable gates, BP-10)
- **D-M1 iOS rich notifications** (actions, images, categories). Gate: more than 20 active iOS tokens, or an explicit product requirement.
- **D-M2 Sign in with Apple.** Gate: any third-party login re-enabled on iOS.
- **D-M3 In-app per-photo report action** (the photo report in the profile-photo addendum). Gate: App Review requires an in-app control, or the form receives 3 or more reports about the same photo, or more than 2% of uploaded photos are reported in any 30 days.
- **D-M4 iOS entry in `GET /app/version-policy`.** Gate: before the first public App Store release.
- **D-M5 Per-user block inside the app** (hiding a user's content from the blocker). Gate: App Review requires it, or more than 5 block requests are received through the form in any 30 days.

## 10. Verification
- **Cloud environment (no Mac):** TypeScript compile, lint and Jest with the platform mocked as both `android` and `ios`. Required: device ID never empty on iOS; registration sends `Platform.OS`; Google sign-in not rendered or initialised on iOS; handlers produce `ios` options on iOS and unchanged output on Android; rationale copy is platform-neutral; background handler skips system-displayed alerts on iOS; report-form helper and row behave as in section 7; configuration and native defaults do not drift.
- **Mac or CI (first real compile):** install dependencies, `pod install`, build, simulator run, then device and TestFlight. Commit the generated `Podfile.lock`.
- **On-device checks:** push in foreground, background and force-quit; no duplicate notification; notification tap from a killed app; photo upload yields JPEG; forgot-password link opens in Safari; account deletion works; date and time picker; report-form link opens.

## 11. Open items
1. Supply `GoogleService-Info.plist`, upload the APNs key to Firebase, and set the signing team and provisioning.
2. Supply a 1024×1024 app icon.
3. Verify email sign-up end to end; iOS v1 depends on it.
4. First Mac build: the Podfile has no static-framework or modular-headers setting for Firebase; `import FirebaseCore` may fail on first compile.
5. Notification tap from a killed app: verify that the iOS opened-app path reaches the existing navigation.
6. Fill the privacy-policy URL, support contact and report-form URL in the configuration; the report-form URL is a submission gate. No screen currently displays the privacy URL or support contact.
7. The backend migrations for iOS push (platform CHECK drop) are pending live deployment; iOS token registration cannot succeed until they are applied.
8. The test suite has intermittent timing failures that pass when re-run alone (`CreateGameScreen`, `CreateTabButton`, `UserSearchPicker`); they pre-date this work.

## 12. Consistency checks on write-back (BP-03, BP-09)
Grep DES-MEETUP-MOBILE.md and REQ-MEETUP-MOBILE.md for "iOS", "Android", "deferred", "out of scope" and "report"; reconcile the Non-Goals entry and any statement that iOS push is deferred or that mobile photo reporting exists.
