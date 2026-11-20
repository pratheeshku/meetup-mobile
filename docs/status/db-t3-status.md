# db-t3 Status: iOS Debug build crashes at start-up

Branch: `db-t3`, cut from main 1132bd9. Not merged; pushed for review.
Scope: `ios/Podfile` and its `Podfile.lock` checksum line only. No app code, no dependency change, no React Native upgrade, Android untouched.

## Reproduction
Simulator GameOnTest (iOS 27.0, Xcode 27.2), Debug build with the unchanged Podfile, Metro running: the app aborts at launch with `EXC_BAD_ACCESS` (SIGBUS, KERN_PROTECTION_FAILURE) in `facebook::react::Props::Props()` inside the `React` binary, called from `RNCSafeAreaProviderProps` in `MeetupMobile.debug.dylib` (component descriptor registration, before any screen renders). Release builds start.

## Confirmed cause
1. `React-Core-prebuilt` ships a Debug and a Release flavor and swaps them per configuration (its "[RNCore] Replace React Native Core" script phase). In a Debug build the Debug flavor is linked: `.last_build_configuration` = Debug and the binary exports `Sealable::Sealable()`.
2. The Podfile `post_install` added `-DREACT_NATIVE_PRODUCTION=1` to every configuration, Debug included (commit 77059cf). Debug pods therefore compile with the production header layout while the linked binary has the debug layout. Generated Debug xcconfig for `react-native-safe-area-context` showed `-DREACT_NATIVE_PRODUCTION=1` and no `-DNDEBUG`.
3. Layout proof (clang `-fdump-record-layouts` on the same headers, with `-DREACT_NATIVE_DEBUG=1` vs `-DREACT_NATIVE_PRODUCTION=1`): `sizeof(Props)` is 40 under DEBUG and 32 under PRODUCTION; `Sealable` and `DebugStringConvertible` (virtual bases of `Props`) are shaped by the same macros (`REACT_NATIVE_DEBUG` -> `RN_DEBUG_STRING_CONVERTIBLE=1`). A pod built with the 32-byte layout constructing into the 40-byte binary faults in `Props::Props()`.

## Fix
`ios/Podfile` `post_install`: the production define is applied to non-Debug configurations only (aggregate xcconfigs, pod-target xcconfigs, pod native-target build settings), with an explanatory comment. Debug pods now keep React Native's default (`REACT_NATIVE_DEBUG`, derived from the absence of `NDEBUG`). Note: pod-target `build_settings` is keyed by `:debug`/`:release` symbols, not the `"Debug"`/`"Release"` strings of `user_build_configurations` (a first attempt compared the wrong key and skipped nothing; caught with a temporary print, removed).
`ios/Podfile.lock`: only the `PODFILE CHECKSUM` line (SHA1 of the new Podfile; algorithm checked against the old Podfile).

## Results (generated settings)
- Pods project build settings: Debug configs with the define 0 of 146; Release 119 of 146 (the old Podfile applied it to Debug as well; the original Debug xcconfig showed it).
- Debug and Release xcconfigs for `react-native-safe-area-context` and `Pods-MeetupMobile`: Debug 0, Release unchanged (`-DREACT_NATIVE_PRODUCTION=1` present).

## Results (builds, simulator GameOnTest)
- Debug (with Metro): BUILD SUCCEEDED; app starts, JS bundle loads, Home screen renders for the test account; no new crash report. A dismissable Debug-only red box from `react-native-screens` appears (see drift).
- Release: BUILD SUCCEEDED (fresh bundle); app starts, Home screen renders; no new crash report. (An earlier Release build failed only at "Check Pods Manifest.lock" because I had restored the committed Podfile.lock while the installed pods had two extra entries; rebuilt after `pod install`.)
- Android: not built. Diff touches no file under `android/` and the change is in the iOS-only Podfile.

## Drift and risks (not fixed here)
- `Podfile.lock` on main is out of sync with `package.json`/`node_modules`: `react-native-blob-util` and `react-native-document-picker` are autolinked but absent from the committed lock. A plain `pod install` adds them (and reorders `project.pbxproj`, adds two reasons to `PrivacyInfo.xcprivacy`); any iOS build that skips `pod install` fails the "Check Pods Manifest.lock" phase. I did NOT commit those changes (outside scope; a dependency-lock decision).
- Debug-only red box now visible: "change `UIViewControllerBasedStatusBarAppearance` in Info.plist to YES" (`RNSScreenWindowTraits`). It was hidden before by the crash. App config, not changed.
- CI/release risk:
  - `ios-testflight.yml` archives Release: generated Release flags are unchanged (verified above), so that path is not affected.
  - `ios-ci.yml` builds the Debug simulator configuration (compile and link only, no launch), which is exactly what this change alters. Locally the Debug build compiled and linked cleanly and ran, with the same flow CI uses (fresh `pod install`, Debug flavor of the prebuilt). It has NOT been run on CI; the earlier hack (77059cf, `test(ci)` series) was added while chasing a CI Debug failure with undefined symbols, so watch the first CI run of this branch. The Debug-flavor binary exports `Sealable::Sealable()` (checked), which is what Debug-compiled pods need.
  - CI runs `pod install` itself, so the lockfile drift below does not break CI, but it does break a plain local `xcodebuild` without `pod install`.
- Local-only helpers used for the simulator runs (not committed): `ios/GoogleService-Info.plist` copied into the untracked build output (the file is gitignored and not referenced by the Xcode project); simulator reboots when its runtime mount went stale.
- Debug runs on a real device were not tested.
