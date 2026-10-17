# As-built requirements (mobile): Hooks and utilities

Status: AS-BUILT behaviours inferred from code at `main` 79b9a3a. Provisional IDs `AB-MHKU-nn`. Owner assigns version and status.
Design: [design/hooks_utils.md](../design/hooks_utils.md)

| ID | Behaviour (as built) | Evidence |
|---|---|---|
| AB-MHKU-01 | My games are games the user organises or is going/waitlisted for; open games are public or group games the user has not responded to; both ordered by start time. | `gameLists.ts` |
| AB-MHKU-02 | Sport filter defaults to the user's skill sports once data has loaded; a user's tap wins and the choice is not saved. | `useSportFilter` |
| AB-MHKU-03 | A reload keeps the previous data on screen; a failed reload does not replace it with an error. | `useResource` |
| AB-MHKU-04 | Update and onboarding checks fail open. | `useForceUpdate`, `useOnboardingRequired` |
| AB-MHKU-05 | Only https links from configuration are opened; the store link is validated. | `httpsUrl.ts`, `playStoreUrl.ts` |
| AB-MHKU-06 | Phone numbers are validated and formatted with libphonenumber-js. | `phoneNumber.ts` |
| AB-MHKU-07 | Errors are reduced to a status or code before logging. | `logSafeError.ts` |
| AB-MHKU-08 | The installed Android version code is read from the build config. | `installedVersion.ts` |

## Not evidenced in code (owner decision needed)
- A single date/time formatting policy.
- Telemetry beyond the opt-in perf log.
