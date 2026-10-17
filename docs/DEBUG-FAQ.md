# Debug FAQ
Open ENVIRONMENTS.md first so you are on the right machine.

## First checks
1. Reproduce with a scoped test (`npx jest path/to/test -t "name"`), not the full suite.
2. Type and lint: `npx tsc --noEmit`, `npm run lint`.
3. Backend suspected: curl the endpoint on the public URL and compare with the contract in the backend design docs.
4. Stale bundle or odd native state: restart Metro with a clean cache (`npx react-native start --reset-cache`), then rebuild.

## Known causes
- `Unexpected token 'export'` in Jest: an ESM-only library is missing from `transformIgnorePatterns` in `jest.config.js`.
- Keychain/Keystore undefined in tests: the native bridge does not exist under Jest. Extend the mock in `jest.setup.js`.
- Labels missing or wrong: run `npm run check:labels`; labels come from the backend and `label-inventory-mobile.json`.
- Performance or slowness: enable the diagnostics layer. Build flag `PERF_LOG=true`, or at runtime tap the display name 7 times within 3 seconds on the Profile screen.
- Duplicate or wrong `versionCode`: see STACK-GOTCHAS.md ("Release builds").
- Notification or push issues: check `src/notifications/` first, then confirm the backend side in `~/meetup/docs/DEBUG-FAQ.md`.

## Verification rules
- A source-text check is not proof of the built artifact. Check the built app or bundle.
- Agent self-reports are verified by git evidence and raw test output, not summaries.
