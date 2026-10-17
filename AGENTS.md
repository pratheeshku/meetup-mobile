# Meetup Mobile (GameonSG)

React Native app (bare workflow, TypeScript) for creating and joining sports games, groups and tournaments. It consumes the Meetup backend API, which lives in a separate repo: `~/meetup` (backend + web). Android is the main target; iOS is covered by docs/DES-MEETUP-ADDENDUM-IOS-App.md.

## Commands (state the machine, then `cd ~/Developer/meetup-mobile && pwd`, in every command you give; see docs/ENVIRONMENTS.md)
- Test: `npx jest`, run ONCE (never repeatedly).
- Lint: `npm run lint`. Type-check: `npx tsc --noEmit`. Labels: `npm run check:labels`.
- Run: `npm run android` (emulator or device) or `npm run ios`.
- Release AAB: `npm run build:aab`. It bumps `versionCode` on every run; to keep a manually set value use `SKIP_VERSION_BUMP=1 npm run build:aab`.
- Migrate: not applicable (no local database).

## Modules under `src/`
api (Axios client, correlation IDs, auth event bus) · auth · storage (Keychain tokens) · navigation (Auth/App stacks, tabs) · screens · components · hooks · notifications (FCM) · onboarding · sports · labels · theme · diagnostics · types · utils · test-utils. `config/` holds environment config (no secrets). Zero sibling imports between `src/api`, `src/storage` and `src/notifications` beyond documented dependencies.

## Hard rules
- The backend contract comes from `~/meetup`. Do not invent endpoints or fields. If one is missing, stop and ask.
- Never commit secrets: `android/key.properties`, `google-services.json`, any populated `.env`.
- `docs/` holds the governing baselines. Do not edit it during implementation; report drift in your implementation report. Never choose version numbers.
- The approved design doc is the source of truth. A CRITICAL/HIGH gap means a Blocked Report, not an invented solution.
- Tokens live in Keychain only, never AsyncStorage or logs.
- One correlation ID (UUIDv4) per logical user action via `withCorrelationId()`, not per HTTP call.
- Role and permission checks in the UI are UX only; the backend is the authority. Never recompute anything the backend returns (for example standings).
- Theme tokens only: no literal colours. Fixed-size boxes for any icon-plus-text row.
- UI work must match its board. If the board and the design doc disagree, or no board exists, stop and ask. Do not invent.
- Never self-certify. Reports carry raw test output, coverage delta and screenshots next to the board.
- Stay inside your task ID. No conformance review or testing-agent dispatch unless the owner asks.

## Read before acting (open the file when the trigger matches)
| When you are about to... | Read first |
|---|---|
| Give or run any command, path, build or release step | docs/ENVIRONMENTS.md |
| Debug a crash, failing test, build or API problem | docs/DEBUG-FAQ.md |
| Add a dependency, touch native config, tests or env handling | docs/STACK-GOTCHAS.md |
| Build or change a feature (task ID) | docs/INDEX.md, then the DES addendum and the brief in `~/meetup/docs/briefs/` for that task |
| Build or change any screen, form or navigation | docs/INDEX.md, section "Design reference (UI)": open the matching board (png for look, html for sizes) before writing UI |
| Check what a requirement or design says | docs/INDEX.md |
| Need a doc's amendment history | docs/CHANGELOG-DOCS.md |
