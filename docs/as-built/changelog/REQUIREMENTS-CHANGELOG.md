# As-built requirements change log (mobile)

Scope: the per-module files in [../requirements/](../requirements/). Separate from `docs/CHANGELOG-DOCS.md` (architect only). Version and status columns are blank on purpose.

How to use: add one entry per change to any file under `docs/as-built/requirements/`, newest first. Record when a provisional `AB-M<MOD>-nn` ID is mapped to, or replaced by, an approved `R-xxx` ID. Do not renumber existing IDs.

| Date | Version | Status | Type | Files | Summary | Source / evidence |
|---|---|---|---|---|---|---|
| 2026-10-17 | | | Initial | All 8 files in `requirements/` | First as-built pass: behaviours inferred from code at `main` 79b9a3a, with provisional IDs (AB-MAPI, AB-MAUTH, AB-MNAV, AB-MNTF, AB-MSCR, AB-MCMP, AB-MHKU, AB-MLTD). They are not approved requirements and are not mapped to `R-xxx` yet. | Branch `docs/as-built-sync` |

## Pass 1: owner decisions raised ("Not evidenced in code")
- Deep linking (URL schemes, App Links).
- Team list/detail/entry on mobile; tournament organiser actions on mobile.
- Retry/backoff and circuit breaker.
- Accessibility results; offline behaviour; label versioning; crash reporting.
