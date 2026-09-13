# Implementation Report — runtime environment config fix (react-native-config)

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version / Status**: APPROVED, architect-approved 2026-09-13
- **Tier**: T1
- **Requirements baseline**: REQ-MEETUP-MOBILE, APPROVED
- **Scope of this pass**: closes Known Gap #1 from `docs/reports/IMPL-DES-MEETUP-MOBILE-scaffold.md` §6 — `config/env.ts`'s `process.env.API_BASE_URL` never resolved at runtime in bare React Native. This is a config-mechanism fix only; no other behavior changes.

## 2. Traceability map

| Task brief step | Files | Notes |
|---|---|---|
| 1. Install `react-native-config` | `package.json`, `package-lock.json` | v1.7.2 (actively maintained, published 2026-08-28; requires RN ≥0.74, project is on 0.86.3 — satisfied) |
| 2. Create `.env` | `.env` (gitignored, not committed) | `API_BASE_URL=https://meetups.duckdns.org` |
| 3. Create `.env.example` | `.env.example` | Same value — no secret, safe to commit |
| 4. `.gitignore` | *(no change needed — already correct)* | `.env`/`.env.*` were already ignored with `!.env.example` un-ignored, added proactively during the original scaffold pass. Verified, not re-added. |
| 5. Rewrite `config/env.ts` | `config/env.ts` | Exactly the code given in the brief |
| 6. Wire Android | `android/app/build.gradle` | `apply from: .../dotenv.gradle` + `resValue "string", "build_config_package", "com.meetupmobile"`. Root `android/build.gradle` deliberately **not** touched — see Deviations. |
| 7. Verify `tsc --noEmit` | — | Passes, see §5 |

Related cleanup (not a numbered brief step, directly tied to the fix): removed `global.d.ts`, which existed solely to type the now-deleted `process.env` usage — see Deviations §2.

## 3. Proposed Assumptions

None beyond what's already recorded in the prior scaffold report. The `.env`/`.env.example` value is the same URL already used as the fallback default and previously hardcoded in `config/env.ts`, so no new value was invented.

## 4. Deviations

1. **No root `android/build.gradle` classpath addition.** The brief's step 6 named this "if required." Checked `react-native-config`'s own README/Setup section directly (`node_modules/react-native-config/README.md`): the only Android wiring it documents for RN ≥0.60 (autolinked) is the `apply from: .../dotenv.gradle` line in `android/app/build.gradle` and the optional `resValue` for non-standard `BuildConfig` package resolution. No `classpath` entry in the root `buildscript` block is part of its setup (unlike, e.g., the Google Services Gradle plugin for Firebase). Confirmed empirically: `./gradlew :app:tasks --all` progressed past both Gradle files and printed `Reading env from: .env` — proof the plugin applied and located the file — before failing only at the expected, pre-existing "SDK location not found" point (no Android SDK in this environment). Adding an unused classpath entry was judged worse than omitting a genuinely-not-required one, so it was left out and is recorded here rather than silently skipped.
2. **Manual Android linking (`android/settings.gradle`, `MainApplication`) explicitly not added**, even though it appears in the library's own README. That section is documented there only for "React Native below 0.60" and carries an explicit warning: adding it on RN ≥0.60 (autolinked, which this project is, including New Architecture/TurboModules) leaves the JS module resolving to `null` at runtime instead of registering it correctly. Not doing this is fidelity to the library's own documented behavior, not a deviation from the brief's intent.
3. **Removed `global.d.ts`.** It contained only an ambient `declare const process: { env: ... }` added in the prior scaffold pass specifically to type `config/env.ts`'s old `process.env.API_BASE_URL` usage. With that usage replaced by `Config.API_BASE_URL`, the file had no remaining purpose; leaving it in place would also leave a working ambient `process` global sitting in the codebase that could invite a future re-introduction of the exact non-functional pattern this task removes. Deleted rather than left as dead code.

## 5. Verification results

**Type-check** — clean:
```
$ npx tsc --noEmit
(no output, exit 0)
```

**Lint** — clean:
```
$ npx eslint . --ext .ts,.tsx
(no output, exit 0)
```

**Tests** (unaffected — `App.tsx`'s import graph does not currently reach `config/env.ts`; only `src/notifications/fcm.ts` → `src/api/client.ts` → `config/env.ts`, and nothing in the App-mount path imports `fcm.ts` yet), run 3x for stability:
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

**Gradle wiring evidence** (no Android SDK in this environment, so a full build isn't possible — see the prior scaffold report's same note):
```
$ cd android && ./gradlew -q :app:tasks --all
Reading env from: .env

FAILURE: Build failed with an exception.
...
> SDK location not found. Define a valid SDK location with an ANDROID_HOME
  environment variable or by setting the sdk.dir path in your project's
  local properties file at '.../android/local.properties'.
```
`Reading env from: .env` is `dotenv.gradle`'s own log line, printed *before* the SDK-location failure — direct evidence the plugin applied correctly and located the repo-root `.env` file exactly as expected, prior to the pre-existing, unrelated environment-provisioning gap (no local Android SDK) that also affected the original scaffold's Gradle verification.

**Secrets hygiene**:
```
$ git check-ignore -v .env
.gitignore:42:.env	.env

$ git check-ignore -q .env.example; echo "exit: $?"
exit: 1        # not ignored, as required

$ git add -n .env .env.example
The following paths are ignored by one of your .gitignore files:
.env
add '.env.example'
```

**No hardcoded URLs introduced elsewhere**:
```
$ grep -rn "https\?://" src config App.tsx android/app/build.gradle android/app/src/main/AndroidManifest.xml
config/env.ts:  API_BASE_URL: Config.API_BASE_URL ?? 'https://meetups.duckdns.org',   # brief-specified fallback only
android/app/src/main/AndroidManifest.xml:1: xmlns:android="http://schemas.android.com/apk/res/android"  # XML namespace, not app data
android/app/build.gradle: // See https://github.com/react-native-community/cli/...   # comment reference
```

## 6. Known gaps / follow-ups

- Carried forward unchanged from the prior report: `@react-native-firebase/*` still needs `google-services.json` + the Google Services Gradle plugin wired before `npm run android` succeeds; `react-native-camera` remains unmaintained; §3.3's retry/backoff and Circuit Breaker interceptors, deep-link routing (§3.9), and session silent-restore (R-016) are still not built.
- A real Android SDK is required in this environment to run an actual `assembleDebug`/`assembleRelease` and confirm `Config.API_BASE_URL` resolves to the `.env` value inside a running app, beyond the Gradle-evaluation-level evidence in §5.
