# Stack gotchas: React Native (bare), TypeScript

## Tooling
- **Node engine:** react-native 0.86.3 requires Node `^20.19.4 || ^22.13.0 || ^24.3.0 || >=25`. The repo is deliberately pinned to 0.86.3 so Node 20.19.4+ machines work. Check the installed Node before bumping `react-native`.
- **No template flags:** `react-native-template-typescript` is obsolete. React Native 0.71+ ships TypeScript by default. Omit `--template` entirely.

## Release builds
- `scripts/build-release-aab.sh` bumps `versionCode` on every run, even if the build fails. An uncommitted bump reached the Play Console once and collided with the next build. Commit the bump immediately, or use `SKIP_VERSION_BUMP=1` (or `--no-bump`) to keep a manually set value.
- `android/key.properties` (release signing) is never committed.

## Testing
- **Jest and ESM libraries:** `@react-navigation/*`, `react-native-screens`, `react-native-svg` and similar ship ES modules and need entries in `transformIgnorePatterns` in `jest.config.js` (already configured). Failure shows as `Unexpected token 'export'`.
- **Keychain in tests:** the native bridge does not exist under Jest. It is mocked in `jest.setup.js`. Extend that mock instead of adding ad hoc mocks per test file.
- Run the suite once per task.

## Dependencies
- **QR scanning:** `react-native-vision-camera` is in `package.json` (pinned to 4.7.3, the v4 line) but no source file uses it yet. When a scan screen is built, use its built-in `useCodeScanner`. Do not add `vision-camera-code-scanner` (incompatible) or `@mgcrea/vision-camera-barcode-scanner` (pulls in a mandatory worklets peer dependency). The unpinned `latest` dist-tag is v5, which needs the Nitro Modules architecture.
- **Camera permission:** `android.permission.CAMERA` is not declared in `AndroidManifest.xml`. Add it, with the pre-scan rationale flow, when a scan screen is built.

## Environment
- Bare React Native does not substitute custom env vars into the bundle. `config/env.ts` holds the default API base URL; `process.env.API_BASE_URL` is only an optional override and `global.d.ts` supplies the type only. Verify how the override is injected before depending on it.

## UI
- Theme tokens only (no literal colours). Fixed-size boxes for icon-plus-text rows; do not rely on content-driven sizing for alignment.
