# As-built design: labels, theme, sports, diagnostics, config

Status: AS-BUILT, reverse-engineered from code at `main` 79b9a3a (2026-10-17). Not ratified. Version/approval: owner to assign.
Related: [requirements/labels_theme_diagnostics.md](../requirements/labels_theme_diagnostics.md) · [components](components.md) · [api](api.md)

## Labels (`src/labels`)
- `LabelsProvider` mounts with bundled `FALLBACK_LABELS` (`fallbackLabels.ts`, never a blank map), then replaces from the AsyncStorage cache, then fetches `GET /api/labels` (`src/api/labels.ts`).
- Cache keys `@meetup/labels-cache`, `@meetup/labels-fetched-at`; TTL `labelsCacheTtlSeconds` in `config/appConfig.json` (300 s).
- Fetch runs on every app launch and on foreground return only when the cache is older than the TTL; one fetch in flight at a time.
- On failure the current map stays and `getLabel` falls back per key to the bundled default.
- Placeholders use `{name}` params. A module-level `latestLabels` serves non-component code (notification channel names and action buttons).
- Label values are never logged. `npm run check:labels` guards key usage.
- `defaultLabels.ts` (904 lines) is the source of default text; `fallbackLabels.ts` is the runtime bundle.

## Theme (`src/theme`)
`tokens.ts` (colours, spacing, type), `dashboardTheme.ts` (Home/dashboard tokens), `navigationTheme.ts`. Components use tokens only.

## Sports (`src/sports`)
- `catalog.ts`: in-memory copy of `GET /admin/sports/public` with a pending-promise guard; `findSport` matches on name or slug (case-insensitive); Edit Skill Levels replaces the copy with a fresh response.
- `iconKeys.ts`: checked-in copy of the backend icon-key manifest. `style.ts`: per-sport presentation.

## Diagnostics (`src/diagnostics/perfLog.ts`, 758 lines)
Leaf module (no sibling imports). Spans and counters for fetches and screens, enabled by a `PERF_LOG` build flag plus a runtime toggle; `useResource` and `usePerfScreen` call into it.

## Config (`config/`)
`env.ts` (typed access to `react-native-config`), `appConfig.json` (non-secret tunables), `.env.example`. Release builds: `npm run build:aab` bumps `versionCode` unless `SKIP_VERSION_BUMP=1`. CI: `ios-ci`, `ios-testflight`, `label-scan`.

## Drift and findings
- 🟠 HIGH `config/env.ts` default API host (see [architecture_overview](architecture_overview.md)): a build without a populated `.env` points at a non-production host.
- 🟡 MEDIUM Labels fetch has no ETag or version check; each launch downloads the full map.
- 🟡 MEDIUM `iconKeys.ts` and `sportGlyphs` are manually synced copies of the backend manifest; drift is undetected.
- 🟢 LOW `perfLog.ts` at 758 lines is large for a diagnostics leaf.
