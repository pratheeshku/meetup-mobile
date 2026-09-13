# Meetup Mobile

Mobile app for creating and joining sports events, groups, and tournaments.
Built with React Native (bare workflow, Android). Consumes the Meetup
platform API.

## Stack

- Language/Runtime: TypeScript on React Native 0.86.3 (bare workflow, no Expo)
- Framework: React Navigation (native-stack + bottom-tabs); React Query planned for server state (§3.2, not yet wired)
- Database: None on-device beyond React Query's planned cache persister (§3.8) — all durable state lives in the backend
- Frontend: React Native (Android target only; iOS scaffold present but out of scope per design)
- Infrastructure: GitHub Actions CI/CD → signed AAB/APK → Google Play (§3.11, not yet built)

## Commands

- Run: `npm run android` (requires an Android emulator/device and a configured Android SDK)
- Test: `npx jest`
- Migrate: N/A — this app has no local database/migrations
- Lint: `npx eslint . --ext .ts,.tsx`
- Type-check: `npx tsc --noEmit`

## Architecture

- `src/api/` — shared Axios client, correlation ID propagation, auth event bus
- `src/storage/` — Keychain-backed secure token storage (never AsyncStorage)
- `src/navigation/` — root Auth/App stack switch
- `src/screens/` — screen components
- `src/notifications/` — FCM registration/lifecycle
- `config/` — environment configuration (no secrets committed)
- Zero sibling imports between `src/api`, `src/storage`, `src/notifications` beyond the documented dependencies above — enforced by review.

## Active Design Document

- Doc ID: DES-MEETUP-MOBILE
- Version: APPROVED, architect-approved 2026-09-13
- Status: APPROVED
- Location: `docs/DES-MEETUP-MOBILE.md`
- Requirements baseline: `docs/REQ-MEETUP-MOBILE.md`
- Active phase: Scaffold (navigation skeleton, API client, secure token storage, FCM registration primitives, Android signing config)

## Off-limits

- `docs/` — governing design/requirements baselines; do not edit as part of implementation work
- `android/key.properties` — real release-signing credentials; gitignored, never committed
- Never execute migration scripts — write only; human runs them (N/A for this app currently, but the rule carries forward if one is added)
- Never commit secrets or API keys — `google-services.json`, OAuth client config, and any populated `.env` file are forbidden from version control (P10; §3.11)

## Key Conventions

- Approved design document (DES-MEETUP-MOBILE.md) is the non-negotiable source of truth; REQ-MEETUP-MOBILE.md is the requirements baseline it must trace to.
- Blocked Report required for any CRITICAL/HIGH gap before proceeding.
- Tokens: Keychain only, never AsyncStorage or logs (R-014, R-111).
- Correlation ID: one UUIDv4 per logical user action via `withCorrelationId()`, not per HTTP call (§3.12, R-113).
- All role/permission gating in the UI is a UX convenience only — the backend is the sole authority (R-017, R-082).
- No client-side recalculation of anything the backend returns (e.g. tournament standings, R-042).

## Stack Gotchas

- **Node engine**: react-native@0.86.3 requires Node `^20.19.4 || ^22.13.0 || ^24.3.0 || >=25`. `npx react-native@latest`/`init` currently resolves to a version requiring Node ≥22.13 — this repo is deliberately pinned to 0.86.3 to stay compatible with Node 20.19.4+ development machines. Confirm the installed Node version satisfies this before bumping `react-native`.
- **`react-native-template-typescript` is obsolete**: React Native ≥0.71 ships TypeScript by default via `@react-native-community/template`; the standalone template package (last published 2023) is ignored by the current CLI. Do not chase template-flag errors — omit `--template` entirely for TS projects.
- **Jest + ESM-published RN libraries**: `@react-navigation/*`, `react-native-screens`, `react-native-svg`, etc. ship ES modules under `node_modules` and need explicit `transformIgnorePatterns` overrides in `jest.config.js` (already configured) or test suites fail with `Unexpected token 'export'`.
- **`react-native-keychain` in tests**: the native Keystore/Keychain bridge doesn't exist under Jest — mocked in `jest.setup.js`. Add to that mock (not a new ad hoc mock per test file) if new keychain APIs are used.
- **`react-native-camera` is unmaintained** (last publish 2021, archived upstream in favor of `react-native-vision-camera`/`expo-camera`). Installed per explicit instruction for this scaffold; expect native build friction (New Architecture/Fabric, current AGP/Gradle) when the QR-scan screen is actually implemented — flag to the architect before deep investment.
- **`process.env` in RN**: bare RN does not substitute custom env vars into the bundle by default (no `react-native-config`/babel env plugin wired). `config/env.ts`'s `process.env.API_BASE_URL` will read `undefined` at runtime today and fall through to the hardcoded default — this is a known scaffold-stage gap, not a working env-injection pipeline. `global.d.ts` supplies only the ambient TypeScript type for `process.env`, not a runtime polyfill.
