# Implementation Report — Firebase Google Services Gradle plugin wiring

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version / Status**: APPROVED, architect-approved 2026-09-13
- **Tier**: T1
- **Requirements baseline**: REQ-MEETUP-MOBILE, APPROVED
- **Scope of this pass**: closes Known Gap #2 from `docs/reports/IMPL-DES-MEETUP-MOBILE-scaffold.md` §6 — `@react-native-firebase/app`/`messaging` (§3.6, R-070–R-076) needed native Android Gradle wiring to build. This pass wires the Google Services Gradle plugin only; it does not add any new JS/TS code, screens, or FCM behavior.

## 2. Traceability map

| Task brief step | File | Exact line(s) added |
|---|---|---|
| 1. Project-level classpath | `android/build.gradle` | `classpath("com.google.gms:google-services:4.4.2")` added to the existing `buildscript { dependencies { ... } }` block, alongside the other three classpath entries already there (matched their double-quoted style rather than the brief's single-quoted example — same Groovy string literal, no functional difference) |
| 2. App-level plugin application | `android/app/build.gradle` | `apply plugin: 'com.google.gms.google-services'` added at the bottom of the file, after the existing `dependencies { ... }` block (single-quoted, exactly as the brief specified) |
| 3. Confirm `google-services.json` present, not committed | — (verification only, no file change) | See §5 |
| 4. `.gitignore` entry for `google-services.json` | — (no change — already present) | `android/app/google-services.json` was already added to `.gitignore` during the original scaffold pass (`docs/reports/IMPL-DES-MEETUP-MOBILE-scaffold.md`); verified, not re-added, per the brief's own "if not already there" phrasing and the rule against touching files outside the two Gradle files |
| 5. Verify build | — | `cd android && ./gradlew assembleDebug` — see §5 |

No files other than `android/build.gradle` and `android/app/build.gradle` were modified, per the brief's explicit constraint.

## 3. Proposed Assumptions

1. **Google Services plugin version `4.4.2`** was used exactly as specified in the brief. Verified indirectly but concretely: `./gradlew assembleDebug` successfully resolved this exact Maven coordinate from Google's repository as part of the `buildscript` classpath resolution phase (the build progressed past that phase into project configuration — see §5) — if the artifact or version didn't exist, Gradle would have failed immediately at dependency resolution, before any "Configure project" output. No further version-currency check was performed beyond this successful resolution.

## 4. Deviations

None functionally. One cosmetic note: `android/build.gradle`'s new `classpath(...)` line uses double quotes to match that file's three existing classpath lines (all double-quoted) rather than the brief's single-quoted example — a purely stylistic string-literal choice with no functional difference. `android/app/build.gradle`'s new `apply plugin: 'com.google.gms.google-services'` line uses single quotes exactly as the brief specified, even though every other `apply plugin` line already in that file is double-quoted — left exactly as the brief wrote it rather than silently "correcting" an explicit instruction for a one-line style inconsistency.

## 5. Verification results

**`google-services.json` presence and structure** (validated as well-formed JSON with the expected top-level shape, without printing its contents — it carries a real Firebase project's API key/app ID and must never be logged in full, consistent with P10/the design's secrets-exclusion requirement, §3.11):
```
$ ls -la android/app/google-services.json
-rw-r--r--@ 1 pratheesh staff 684 ... android/app/google-services.json

$ python3 -c "
import json
with open('android/app/google-services.json') as f:
    data = json.load(f)
print('valid JSON:', True)
print('top-level keys:', sorted(data.keys()))
print('project_id present:', 'project_id' in data.get('project_info', {}))
print('client entries:', len(data.get('client', [])))
"
valid JSON: True
top-level keys: ['client', 'configuration_version', 'project_info']
project_id present: True
client entries: 1
```

**`google-services.json` confirmed gitignored (already present from the original scaffold pass, not re-added)**:
```
$ grep -n "google-services" .gitignore
40:android/app/google-services.json

$ git check-ignore -v android/app/google-services.json
.gitignore:40:android/app/google-services.json	android/app/google-services.json

$ git add -n android/app/google-services.json
The following paths are ignored by one of your .gitignore files:
android/app/google-services.json
```

**Only the two permitted files touched**:
```
$ git status --short
 M android/app/build.gradle
 M android/build.gradle
```

**Gradle build attempt** (`cd android && ./gradlew assembleDebug`):
```
> Configure project :app
Reading env from: .env

FAILURE: Build failed with an exception.
* Where: Build file '.../android/build.gradle' line: 26
* What went wrong:
A problem occurred evaluating root project 'MeetupMobile'.
> Failed to apply plugin 'com.facebook.react.rootproject'.
   > A problem occurred configuring project ':app'.
      > SDK location not found. Define a valid SDK location with an
        ANDROID_HOME environment variable or by setting the sdk.dir path
        in your project's local properties file at
        '.../android/local.properties'.
```
This is the expected failure on a Mac without Android Studio/an installed Android SDK — no `ANDROID_HOME`/`local.properties` exists in this environment (same pre-existing gap noted in both prior reports).

**Confirmed the failure is the SDK-missing error, not a Firebase/plugin-wiring error, via `--stacktrace`**:
```
$ ./gradlew assembleDebug --stacktrace 2>&1 | grep -A5 "Caused by"
Caused by: org.gradle.api.internal.plugins.PluginApplicationException: Failed to apply plugin 'com.facebook.react.rootproject'.
Caused by: org.gradle.api.ProjectConfigurationException: A problem occurred configuring project ':app'.
	at org.gradle.configuration.project.LifecycleProjectEvaluator$NotifyAfterEvaluate.run(...)
Caused by: com.android.builder.errors.EvalIssueException: SDK location not found. ...
	at com.android.build.gradle.internal.SdkLocator.getSdkLocation(...)
	at com.android.build.gradle.internal.cxx.configure.NdkLocator.findNdkPath(...)
```
The failure is raised from `LifecycleProjectEvaluator$NotifyAfterEvaluate` — Gradle's `afterEvaluate` lifecycle hook, which only runs *after* a project's entire `build.gradle` script (every line, including the newly-added `apply plugin: 'com.google.gms.google-services'` at the bottom of `android/app/build.gradle`) has already executed without error. This directly confirms: the Google Services classpath dependency resolved successfully (buildscript dependency resolution — which happens before any project configuration — would have failed immediately and differently if the `4.4.2` artifact were unavailable), and the `apply plugin: 'com.google.gms.google-services'` line itself applied without throwing (no "google-services.json is missing" or "plugin not found" error anywhere in the output). The build fails strictly at the pre-existing, unrelated SDK-location check that runs afterward — exactly what the brief asked to confirm.

## 6. Known gaps / follow-ups

- A real Android SDK is still required in this environment to run an actual `assembleDebug`/`assembleRelease` past Gradle-configuration-time evaluation and confirm the FCM registration flow (`src/notifications/fcm.ts`) works against a running app.
- Carried forward unchanged from prior reports: `react-native-camera` remains unmaintained; §3.3's retry/backoff and Circuit Breaker interceptors, deep-link routing (§3.9), and session silent-restore (R-016) are still not built.
