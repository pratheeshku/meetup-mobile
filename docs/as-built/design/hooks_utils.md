# As-built design: mobile hooks and utils (`src/hooks`, `src/utils`)

Status: AS-BUILT, reverse-engineered from code at `main` 79b9a3a (2026-10-17). Not ratified. Version/approval: owner to assign.
Related: [requirements/hooks_utils.md](../requirements/hooks_utils.md) · [screens](screens.md) · [api](api.md)

## Hooks (`src/hooks`, 11 files)
| Hook | Purpose | Behaviour to know |
|---|---|---|
| `useResource` | one independently loading data source per screen section | `loading` only until first result; reload keeps stale data; failed reload keeps stale data; never fetches by itself (owner calls `load(correlationId?)`); emits perf spans |
| `useSportFilter` | sport chip selection shared by Home and Games | `null` until default decided; skill-based default applied once after sports list and profile settle; user tap wins; not persisted |
| `useForceUpdate` | policy check for the update gate | fails open on any error |
| `useOnboardingRequired` | decides whether onboarding shows | fails open, with timeout |
| `useMobileNumberConfig`, `useMobileNumberSave` | mobile-number feature config and save | shared by Settings, Profile, onboarding |
| `useUnreadCount` | bell badge | reads notification unread count |
| `useAppShare` | share-the-app action | uses `utils/shareLink`, `playStoreUrl` |
| `useFieldChain` | next-field focus chain for forms | |
| `useKeyboardOverlap` | keyboard avoidance helper | |
| `usePerfScreen` | screen-level perf spans | no-op unless `PERF_LOG` enabled |

## Utils (`src/utils`, 28 files)
| Group | Files |
|---|---|
| Game lists and grouping | `gameLists` (the one shared pure-function module for Home and Games: My games = organised, or going/waitlisted; Open games = public/group games with rsvp none; order `starts_at` ascending), `gameGroups`, `gameDuration`, `skillRequirement`, `inviteEmails` |
| Date and time | `formatEventDateTime`, `formatGameTime`, `formatRelativeTime`, `localDateTime`, `notificationDateUtils` |
| Errors and logging | `apiError` (maps API errors to user text), `networkError`, `logSafeError` (status/code/name only, never the error object, R-111), `tournamentInviteError` |
| Links and store | `httpsUrl` (https-only validation), `openLink`, `shareLink`, `playStoreUrl` (validates `store_url`), `supportLink`, `supportInfo` |
| Identity and media | `avatar`, `avatarTint`, `displayName`, `imagePicker`, `phoneNumber` (libphonenumber-js) |
| Platform | `installedVersion` (Android `versionCode` via `react-native-config` `Config.VERSION_CODE`; `null` if unreadable), `delay` |
| Labels glue | `labels` (sport display-name lookup `useSportDisplayName`, cached module-wide via `src/sports/catalog`) |

## Drift and findings
- 🟡 MEDIUM `installedVersion` depends on R8 not minifying `BuildConfig`; if release minification is enabled, the version arrives null and the force-update gate cannot compare (it then fails open, so a required update is silently not enforced).
- 🟢 LOW `utils/labels.ts` header comment is partly historical (references BUG-M02 and the removed hardcoded maps); only the sport display-name hook is live.
- 🟢 LOW Mixed date formatting helpers (`formatEventDateTime`, `formatGameTime`, `formatRelativeTime`, `localDateTime`) overlap; no single formatting policy is documented.
