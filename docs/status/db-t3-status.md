# db-t3 Status: iOS Debug build crashes at start-up, and CI Debug link fails

Branch: `db-t3` (PR #126), cut from main 1132bd9. Not merged; kept open.
Scope: `ios/Podfile` and its `Podfile.lock` checksum line only. No app code, no dependency change, no React Native upgrade, Android untouched.

The runtime crash and the CI link failure are the same layout disagreement seen from two sides: Debug-compiled pod code against a React binary of the other flavor. Two things were wrong, and both are fixed.

## 1. Runtime crash (simulator)
### Reproduction
Simulator GameOnTest (iOS 27.0, Xcode 27.2), Debug build with the original Podfile, Metro running: the app aborts at launch with `EXC_BAD_ACCESS` (SIGBUS, KERN_PROTECTION_FAILURE) in `facebook::react::Props::Props()` inside the `React` binary, called from `RNCSafeAreaProviderProps` in `MeetupMobile.debug.dylib` (component descriptor registration, before any screen renders). Release builds start.

### Confirmed cause
1. `React-Core-prebuilt` ships a Debug and a Release flavor and swaps them per configuration (its "[RNCore] Replace React Native Core" script phase). In a Debug build the Debug flavor is linked: `.last_build_configuration` = Debug and the binary exports `Sealable::Sealable()`.
2. The Podfile `post_install` added `-DREACT_NATIVE_PRODUCTION=1` to every configuration, Debug included (commit 77059cf). Debug pods therefore compiled with the production header layout while the linked binary had the debug layout (the generated Debug xcconfig showed `-DREACT_NATIVE_PRODUCTION=1` and no `-DNDEBUG`).
3. Layout proof (clang `-fdump-record-layouts` on the same headers, `-DREACT_NATIVE_DEBUG=1` vs `-DREACT_NATIVE_PRODUCTION=1`): `sizeof(Props)` is 40 under DEBUG and 32 under PRODUCTION; `Sealable` and `DebugStringConvertible` (virtual bases of `Props`) are shaped by the same macros. A pod built with the 32-byte layout constructing into the 40-byte binary faults in `Props::Props()`.

### Fix 1
`post_install`: the production define is applied to non-Debug configurations only (aggregate xcconfigs, pod-target xcconfigs, pod native-target build settings). Debug pods keep React Native's default (`REACT_NATIVE_DEBUG`, derived from the absence of `NDEBUG`). Note: pod-target `build_settings` is keyed by `:debug`/`:release` symbols, not the `"Debug"`/`"Release"` strings of `user_build_configurations` (a first attempt compared the wrong key and skipped nothing).

## 2. CI failure on PR #126 (run 44665327164, job "Simulator build (Debug, unsigned)", xcodebuild exit 65)
### First real error
The workflow's "First errors" printout showed only NSError warnings. In the uploaded `xcodebuild-log` the first real error is a link failure: `Ld ... MeetupMobile.debug.dylib`, "Undefined symbols for architecture arm64", 23 symbols, all debug-only React ones: `facebook::react::Sealable::Sealable()`, `~Sealable()`, `ensureUnsealed()`, `Props/BaseViewProps/YogaStylableProps/ShadowNode::getDebugProps/getDebugName/getDebugValue/getDebugChildren`, `DebugStringConvertible` vtable, `typeinfo`/`VTT` for `Props`, `BaseViewProps`, `YogaStylableProps`. Referenced from the Debug-compiled pod libraries (`libRNSVG`, `libRNFastImage`, `libRNDateTimePicker`, `libRNGoogleSignin`, ...). Debug pods (after Fix 1) need symbols that only the Debug flavor of React exports.

### Confirmed cause
- The "Cache Pods" step found no exact key (the key hashes `ios/Podfile`, `ios/Podfile.lock`, `package-lock.json`, all changed) and restored a stale fallback cache (`pods-macOS-none-c441c92e...`, created 2026-11-07, 266 MiB). `pod install` keeps an unchanged `React-Core-prebuilt` as it is.
- A temporary Podfile diagnostic (commit 7db7de3, now removed) printed the restored state in CI's `pod install` log: all three prebuilts `marker=none`, and `DIAG React simulator binary: size=24451312 ... exports_Sealable_ctor=0`. That is the Release flavor (same byte size as the Release tarball's binary locally), with no `.last_build_configuration` marker.
- React Native's swap script, when there is no marker and the configuration is Debug, assumes the Pods folder already holds the Debug flavor and replaces nothing (CI log: "No previous build detected, but Debug Configuration. No need to replace React-Core-prebuilt"). So the Debug build linked the Release flavor.
- Reproduced locally: with the Release flavor in `ios/Pods` and no marker, `pod install` left it unchanged (diagnostic: `marker=none`, 24451312 bytes, `exports_Sealable_ctor=0`) and the exact CI command failed with the same undefined-symbol set.
- This also explains the early-October history: the old production-define hack only linked because it matched a Release-flavor binary; it was the other half of the same disagreement.

### Fix 2
`post_install` now installs the Debug flavor of `React-Core-prebuilt` after every `pod install` and writes the marker: it writes a non-Debug marker (the script replaces unconditionally unless the marker already equals the target) and runs React Native's own `scripts/replace-rncore-version.js -c Debug -r <rn version> -p <Pods>`. A failure raises and fails `pod install` loudly. It logs "React-Core-prebuilt reset to the Debug flavor (marker: Debug)". Skipped when `RCT_TESTONLY_RNCORE_TARBALL_PATH` is set. The Xcode build phase then swaps to Release (and back) from a known state.
`ios/Podfile.lock`: only the `PODFILE CHECKSUM` line (SHA1 of the Podfile).

## Results
### Generated settings
- Pods project build settings: Debug configs with the define 0 of 146; Release 119 of 146. Release xcconfigs unchanged (`-DREACT_NATIVE_PRODUCTION=1` present).
### Local, exact CI command
`xcodebuild build -workspace ios/MeetupMobile.xcworkspace -scheme MeetupMobile -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath <tmp> ARCHS=arm64 ONLY_ACTIVE_ARCH=NO CODE_SIGNING_ALLOWED=NO`
- Fresh `pod install` (Pods and build output deleted first): BUILD SUCCEEDED.
- Stale Release-flavor state, Podfile with Fix 1 only: BUILD FAILED, undefined symbols (reproduces CI).
- Same stale state, after `pod install` with Fix 2: prebuilt back to the Debug flavor (136,947,536 bytes, `Sealable` exports present, marker Debug); BUILD SUCCEEDED ("Same config of the previous build. No need to replace React-Core-prebuilt").
### CI (PR #126, run 44669585655 on 12b1e43)
- iOS CI (compile check) / Simulator build (Debug, unsigned): PASS (12m39s). label-scan: PASS.
### Simulator launches (GameOnTest)
- Debug (Metro running): BUILD SUCCEEDED; app starts, JS bundle loads, Home renders; no new crash report. A dismissable Debug-only red box appears (see drift).
- Release (swap from Debug baseline to Release performed, marker Release, fresh bundle): BUILD SUCCEEDED; app starts, Home renders; no new crash report.
- Android: not built. The diff touches no file under `android/`.

## Drift and risks (not fixed here)
- `Podfile.lock` on main is out of sync with `package.json`/`node_modules`: `react-native-blob-util` and `react-native-document-picker` are autolinked but absent from the committed lock. A plain `pod install` adds them (and reorders `project.pbxproj`, adds two reasons to `PrivacyInfo.xcprivacy`); a build that skips `pod install` fails "Check Pods Manifest.lock". CI runs `pod install`, so it is unaffected. NOT committed here (a dependency-lock decision).
- Debug-only red box: "change `UIViewControllerBasedStatusBarAppearance` in Info.plist to YES" (`RNSScreenWindowTraits`). Hidden before by the crash. App config, not changed.
- `ReactNativeDependencies` and `hermes-engine` also swap Debug/Release by marker and showed `marker=none` in the stale CI cache. Only React-Core-prebuilt is proven to break the build, so only it is normalized; if a similar stale-flavor failure appears for those two, the same pattern (their replace scripts) applies.
- CI and release risk:
  - `ios-ci.yml` Debug build: now green. The fix removes the dependency on the cache's history, so any Podfile/lock/package-lock change (which always hits a stale fallback cache) is covered.
  - `ios-testflight.yml` archives Release: generated Release flags unchanged; the Release swap works from the new Debug baseline (verified locally). The first TestFlight run after merge is the only untested path.
  - Cost: one extraction of the Debug tarball (about 100 MB, seconds) on every `pod install`.
- Local-only helpers for the simulator runs (not committed): `ios/GoogleService-Info.plist` copied into the untracked build output; simulator reboots when its runtime mount went stale.
- Debug runs on a real device were not tested.
