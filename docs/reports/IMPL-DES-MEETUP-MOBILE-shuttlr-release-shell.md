# Implementation Report — Shuttlr release shell (signed AAB wiring)

## 1. Design reference
- Doc ID: DES-MEETUP-MOBILE, APPROVED (architect-approved 2026-09-13), tier T1.
- Authority for deviation: architect authorisation (Option A) in-session 2026-09-20 —
  identity change com.meetupmobile → org.duckdns.meetups, label "Shuttlr", automatic
  versionCode, new upload keystore. Design amendment deferred by the architect; `docs/DES-*`
  and `docs/REQ-*` were NOT edited (only new files added under `docs/reports/`).
- Task premise correction: brief assumed Capacitor; repo is bare React Native. Option A
  (keep React Native) chosen by the architect. No Capacitor artefacts were added.

## 2. Traceability map
Commit 144087b (all items) — R-IDs: none; the work is release engineering outside the R-ID set.
| Brief step | Files |
|---|---|
| 1 Identity | android/app/build.gradle, android/app/src/main/res/values/strings.xml |
| 2 Config (host in ONE constant) | config/env.ts (unchanged; sole default), .env.example |
| 3 Versioning | android/version.properties, android/app/build.gradle, scripts/build-release-aab.sh |
| 4 SDK levels | android/build.gradle (unchanged, targetSdk 36) |
| 5 Signing | android/app/build.gradle, .gitignore, README.md, ~/keys/shuttlr/ (outside repo) |
| 6 Build | scripts/build-release-aab.sh, package.json (`build:aab`) |

## 3. Proposed Assumptions
1. `namespace` kept as `com.meetupmobile` (source package); only `applicationId` changed. Avoids
   moving Kotlin files. `build_config_package` therefore stays `com.meetupmobile` (BuildConfig is
   generated in the namespace package).
2. Keychain service names in `src/storage/tokens.ts` (`com.meetupmobile.auth.*`) left unchanged —
   they are opaque storage keys, not the package identity.
3. Existing FCM code was neither removed nor extended ("do not add FCM" read as "add nothing").
4. `android/key.properties` (which references another app's keystore) was left untouched; the new
   key is selected through `KEY_PROPERTIES_FILE` instead of overwriting the user's file.
5. Keystore: PKCS12, RSA 2048, SHA256withRSA, 10000-day validity, alias `shuttlr-upload`, DN
   "CN=Shuttlr Upload Key, OU=Mobile, O=Shuttlr", store and key password identical (PKCS12).
6. versionCode counter starts at 0 so the first release build is 1; file value floors at 1 for
   non-release (debug) builds so they still assemble.

## 4. Deviations
- Identity, label, versionCode scheme, new keystore: approved by architect (see §1).
- Writing new files under docs/reports/: required by the developer process; no governing
  document edited.

## 5. Verification results
- Negative test: `npm run build:aab` with the current google-services.json exits 1 with
  "no client for org.duckdns.meetups" and leaves versionCode at 0 (verified).
- Diagnostic release build (NOT the deliverable): `./gradlew bundleRelease` → BUILD SUCCESSFUL in 4m 34s,
  using a temporary rewritten Firebase file at `android/app/src/release/` (moved out of the repo
  afterwards; real google-services.json checksum verified unchanged). From that build:
  - AAB signer SHA-256 = upload key SHA-256 `89:80:A6:F8:63:81:2C:5E:0E:8D:94:97:CD:B0:E0:5E:D6:BE:BE:1D:9E:B7:B1:F0:A9:B2:97:00:7F:BC:E1:0C`
  - merged manifest: package org.duckdns.meetups, versionName 0.1.0, minSdk 26, targetSdk 36, usesCleartextTraffic=false
  - generated BuildConfig: APPLICATION_ID org.duckdns.meetups, API_BASE_URL https://meetups.duckdns.org
  - 72 .so files, 0 arm64-v8a/x86_64 libs with LOAD alignment < 16384 (16 KB page size)
  - That AAB was moved to the scratchpad as DIAGNOSTIC-NO-REAL-FIREBASE-DO-NOT-UPLOAD.aab.
    It has a fabricated Firebase package and must not be uploaded.
- targetSdk source: Google Play Console Help, "Target API level requirements for Google Play apps"
  (https://support.google.com/googleplay/android-developer/answer/11926878): from 2026-08-31 new apps
  and updates must target Android 16 (API 36) or higher. Repo already targets 36.

## 6. Known gaps / follow-ups
- **BLOCKING — no release AAB delivered.** `android/app/google-services.json` only has a client for
  com.meetupmobile. The Google Services plugin fails for org.duckdns.meetups, and
  `src/notifications/fcm.ts` runs `getMessaging(getApp())` at module scope (imported by index.js), so
  shipping without a valid Firebase app would crash at launch. Human action: register
  `org.duckdns.meetups` in Firebase project meetup-mobile-6b696 with the upload-key SHA-1/SHA-256
  (in section 5 for SHA-256; SHA-1 F4:D3:AB:1B:D9:81:AF:73:53:63:F8:FD:7F:AC:D1:8A:5B:1E:AB:E8),
  replace android/app/google-services.json, then run `npm run build:aab`.
- Google Sign-In: the OAuth Android client must be registered for org.duckdns.meetups with the
  upload-key SHA-1, and later the Play App Signing key SHA-1. Not verified; needs the Google/Firebase consoles.
- Not verified: runtime behaviour on a device/emulator; Play Console upload acceptance; that
  .env GOOGLE_WEB_CLIENT_ID is a correct value (only checked that it is not the placeholder).
- `android/key.properties` still points at another app's keystore. Direct `./gradlew bundleRelease`
  without KEY_PROPERTIES_FILE would sign with it. Consider deleting/renaming it (human action).
- versionCode in android/version.properties is still 0 because no release build has been run; the first
  `npm run build:aab` sets it to 1 and the bump must then be committed.
- CLAUDE.md / AGENTS.md still describe com.meetupmobile-era facts; not edited.
- Keystore backup: only copy is ~/keys/shuttlr/. Back it up; enrol in Play App Signing.

## 7. As-built delta list (for the architect's design amendment)
| File | Change | Previous | New |
|---|---|---|---|
| android/app/build.gradle | applicationId | "com.meetupmobile" | "org.duckdns.meetups" |
| android/app/build.gradle | namespace | "com.meetupmobile" | unchanged (now differs from applicationId; comment added) |
| android/app/build.gradle | resValue build_config_package | "com.meetupmobile" (comment said namespace == applicationId) | unchanged value; comment now says it must equal the namespace |
| android/app/build.gradle | versionCode | literal 1 | read from android/version.properties (floor 1) |
| android/app/build.gradle | versionName | literal "1.0" | read from android/version.properties |
| android/app/build.gradle | signing properties file | always android/key.properties | KEY_PROPERTIES_FILE env override (absolute path) else android/key.properties; fails if override file missing |
| android/app/build.gradle | version.properties guard | none | throws if file missing or versionName absent |
| android/app/src/main/res/values/strings.xml | app_name | MeetupMobile | Shuttlr |
| android/version.properties | new file | — | versionName=0.1.0, versionCode=0 (bumped per release build) |
| scripts/build-release-aab.sh | new file | — | preflight (signing file, google-services client for applicationId), versionCode bump, bundleRelease, signer verification |
| package.json | scripts | no build:aab | "build:aab": "bash scripts/build-release-aab.sh" |
| .gitignore | signing patterns | android/key.properties, *.keystore | added **/key.properties, **/keystore.properties, *.jks, *.p12, *.pfx, /keys/ |
| .env.example | API_BASE_URL | API_BASE_URL=https://meetups.duckdns.org | commented out with pointer to config/env.ts default (host default now lives only in config/env.ts) |
| README.md | docs | no release section | "Release build" section (command, signing location, Firebase requirement) |
| ~/keys/shuttlr/ (outside repo) | new | — | upload-keystore.jks (alias shuttlr-upload), key.properties (mode 600) |
| android/app/google-services.json (gitignored) | Firebase client | client for com.meetupmobile | NOT changed — still com.meetupmobile; replacement required (see §6) |
| targetSdk / minSdk / compileSdk | android/build.gradle | 36 / 26 / 36 | unchanged |
| AndroidManifest.xml, AndroidManifest permissions, FCM code | — | — | unchanged |
| Kotlin sources, iOS project, src/, config/env.ts | — | — | unchanged |

## Completion Proof

**Test evidence** (raw output):
```

Test Suites: 44 passed, 44 total
Tests:       348 passed, 348 total
Snapshots:   0 total
Time:        7.661 s
Ran all test suites.
--- Run 1 ---

Test Suites: 44 passed, 44 total
Tests:       348 passed, 348 total
Snapshots:   0 total
Time:        1.751 s, estimated 8 s
Ran all test suites.
--- Run 2 ---

Test Suites: 44 passed, 44 total
Tests:       348 passed, 348 total
Snapshots:   0 total
Time:        1.733 s, estimated 2 s
Ran all test suites.
--- Run 3 ---
```
tsc --noEmit exit=0; eslint . --ext .ts,.tsx exit=0 (both produced 0 lines of output).

**Git evidence** (taken before this report's own commit):
```
144087b build(android): Shuttlr release identity, auto versionCode, upload-key signing and AAB script
f41db4d feat(notifications): add event_participant_added and event_participant_removed
1731815 feat(fcm): request notification permission and register device token
?? .claude/
?? docs/reports/agent-enhancement-2026-09-20.md
```

**File evidence**:
```
21:// KEY_PROPERTIES_FILE environment variable (absolute path) overrides it.
24:// If KEY_PROPERTIES_FILE is set but the file is missing, fail rather than fall
27:def keyPropertiesOverride = System.getenv("KEY_PROPERTIES_FILE")
30:    throw new GradleException("KEY_PROPERTIES_FILE is set but the file does not exist: ${keyPropertiesOverride}")
132:        applicationId "org.duckdns.meetups"
135:        versionCode appVersionCode
2:    <string name="app_name">Shuttlr</string>
versionName=0.1.0
versionCode=0
```

**Build evidence**: no release AAB was produced (blocked, see §6). The diagnostic build result is in §5.
