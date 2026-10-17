# As-built requirements (mobile): Labels, theme, sports, diagnostics, config

Status: AS-BUILT behaviours inferred from code at `main` 79b9a3a. Provisional IDs `AB-MLTD-nn`. Owner assigns version and status.
Design: [design/labels_theme_diagnostics.md](../design/labels_theme_diagnostics.md)

| ID | Behaviour (as built) | Evidence |
|---|---|---|
| AB-MLTD-01 | All user-facing text is resolved by key with a bundled default for every key, so no blank or raw key appears. | `LabelsContext.tsx`, `fallbackLabels.ts` |
| AB-MLTD-02 | Labels refresh from the server on launch, and on foreground when older than 5 minutes; the last copy is cached on the device. | `LabelsContext.tsx`, `appConfig.json` |
| AB-MLTD-03 | Label text is never logged. | `LabelsContext.tsx` |
| AB-MLTD-04 | The sports list comes from the server, cached in memory, and sport names resolve case-insensitively by name or slug. | `sports/catalog.ts` |
| AB-MLTD-05 | Performance logging is off unless enabled at build and by a runtime toggle, and records no personal data. | `perfLog.ts` |
| AB-MLTD-06 | Release builds raise the Android version code on every run unless told not to. | `build:aab` script |
| AB-MLTD-07 | The API host, bucket and auth client ids come from build-time environment values. | `config/env.ts` |

## Not evidenced in code (owner decision needed)
- Label versioning or ETag.
- Dark theme.
- Crash reporting service (none present).
