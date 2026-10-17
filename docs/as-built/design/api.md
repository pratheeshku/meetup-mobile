# As-built design: mobile API layer (`src/api`)

Status: AS-BUILT, reverse-engineered from code at `main` 79b9a3a (2026-10-17). Not ratified. Version/approval: owner to assign.
Related: [requirements/api.md](../requirements/api.md) · [auth_storage](auth_storage.md) · backend as-built docs in `~/meetup/docs/as-built/design/` · monolith `docs/DES-MEETUP-MOBILE.md` §3.3, §5.1, §7

## Purpose
One configured axios client plus thin per-domain modules (events, groups, tournaments, venues, profile, notifications, home, labels, sports, teams, users, onboarding, mobile number, config, version policy, places). No business rules; shaping of responses and typed errors.

## Files
| File | Lines | Role |
|---|---|---|
| `client.ts` | 354 | `apiClient`, `refreshClient`, interceptors, single-flight refresh, `endSession` |
| `authEvents.ts` | 30 | tiny event bus; `auth-expired` |
| `correlationId.ts` | 32 | `generateCorrelationId`, `withCorrelationId` |
| `cookies.ts` | 56 | `clearCookieJar` (the only JS-reachable cookie operation) |
| `config.ts` | 34 | `GET /config/game-limits`, `GET /config/client` |
| `versionPolicy.ts` | 98 | force-update policy fetch (own bare axios, no auth, no cookies, 5 s) |
| `events.ts` 367 · `groups.ts` 570 · `tournaments.ts` 310 · `venues.ts` 176 · `profile.ts` 365 · `home.ts` 273 · `notifications.ts` 112 · `users.ts` 78 · `teams.ts` 51 · `sports.ts` 55 · `labels.ts` 46 · `mobileNumber.ts` 83 · `onboarding.ts` 41 · `places.ts` 112 · `loginRouteLog.ts` 13 | | per-domain calls |

## Client behaviour (`client.ts`)
- `apiClient`: `baseURL = ENV.API_BASE_URL`, timeout 30 s, `withCredentials: true` (the refresh cookie is sent and stored by the OS networking layer).
- Request interceptor: reads the access token (in-memory cache over Keychain) and sets `Authorization: Bearer`; sets `X-Correlation-ID` to the caller's `config.correlationId` (from `withCorrelationId()`) or a fresh UUIDv4 per call. Token read failure is logged by error class only and the request proceeds unauthenticated.
- Response interceptor: only a 401 on a non-`/auth/` URL is handled. If the request was already retried once, the session is ended (`endSession()`: clear tokens, clear the cookie jar, raise `auth-expired`). Otherwise: no stored access token → reject untouched; if the token that was sent differs from the stored one (another request refreshed meanwhile) retry with the stored token without refreshing; else `refreshAccessToken()` (single-flight, so two refreshes never overlap, which would trip backend reuse detection), save the token, retry once. A definitive refusal (`SessionEndedError`: refresh answers 401, or `{access_token:null}`) ends the session. Transport errors and 5xx never end the session.
- `refreshClient`: separate instance, timeout 10 s, `POST /auth/refresh` with no body.
- Perf diagnostics (build flag `PERF_LOG` plus runtime toggle): per-request timing events; never logs tokens, headers, bodies, query strings or ids (path templates only).
- Not built (per the file header): the retry/backoff allowlist and per-endpoint-family circuit breaker designed in DES-MEETUP-MOBILE.md §3.3.

## Domain modules (conventions)
Each function takes optional `{correlationId}`, calls `apiClient`, and returns typed data. Notable shapes: events and groups lists accept either a bare array or `{items}`; `GET /notifications/preferences` returns `{preferences: []}`; group creation, edits, logo and invitations use multipart or JSON as in the backend; `places.ts` calls the Google Places Autocomplete and Details HTTP APIs directly with an API key supplied by `GET /config/client` (empty or missing key → no suggestions).

## Endpoint inventory (generated; "Backend route" = present in the backend as-built route tables)
| Method | Path | Mobile source | Backend route |
|---|---|---|---|
| GET | `/admin/sports/public` | `src/api/sports.ts` | yes |
| GET | `/api/labels` | `src/api/labels.ts` | yes |
| POST | `/auth/login` | `src/auth/emailAuth.ts` | yes |
| POST | `/auth/logout` | `src/auth/googleAuth.ts` | yes |
| POST | `/auth/oauth/apple/callback` | `src/auth/appleAuth.ts` | yes |
| POST | `/auth/oauth/google/callback` | `src/auth/googleAuth.ts` | yes |
| POST | `/auth/refresh` | `src/api/client.ts` | yes |
| POST | `/auth/resend-verification` | `src/auth/emailAuth.ts` | yes |
| POST | `/auth/reset-password-request` | `src/auth/emailAuth.ts` | yes |
| POST | `/auth/signup` | `src/auth/emailAuth.ts` | yes |
| POST | `/auth/verify-email` | `src/auth/emailAuth.ts` | yes |
| GET | `/config/client` | `src/api/config.ts` | yes (`client_config_router.py`) |
| GET | `/config/game-limits` | `src/api/config.ts` | yes (`client_config_router.py`) |
| GET | `/events` | `src/api/events.ts` | yes |
| POST | `/events` | `src/api/events.ts` | yes |
| GET | `/events/{}` | `src/api/events.ts` | yes |
| PATCH | `/events/{}` | `src/api/events.ts` | yes |
| POST | `/events/{}/cancel` | `src/api/events.ts` | yes |
| POST | `/events/{}/invite-email` | `src/api/events.ts` | yes |
| POST | `/events/{}/invite-group` | `src/api/events.ts` | yes |
| POST | `/events/{}/invite-user` | `src/api/events.ts` | yes |
| POST | `/events/{}/rsvp` | `src/api/events.ts` | yes |
| POST | `/games/{}/venue-images` | `src/api/venues.ts` | yes |
| GET | `/groups` | `src/api/groups.ts` | yes |
| POST | `/groups` | `src/api/groups.ts` | yes |
| POST | `/groups/invitations` | `src/api/groups.ts` | yes |
| DELETE | `/groups/{}` | `src/api/groups.ts` | yes |
| GET | `/groups/{}` | `src/api/groups.ts` | yes |
| PATCH | `/groups/{}` | `src/api/groups.ts` | yes |
| POST | `/groups/{}/invite` | `src/api/groups.ts` | yes |
| DELETE | `/groups/{}/logo` | `src/api/groups.ts` | yes |
| POST | `/groups/{}/logo` | `src/api/groups.ts` | yes |
| GET | `/groups/{}/members` | `src/api/groups.ts` | yes |
| DELETE | `/groups/{}/members/{}` | `src/api/groups.ts` | yes |
| PATCH | `/groups/{}/members/{}` | `src/api/groups.ts` | yes |
| GET | `/groups/{}/suggested-members` | `src/api/groups.ts` | yes |
| POST | `/groups/{}/transfer-ownership` | `src/api/groups.ts` | yes |
| GET | `/home/banners` | `src/api/home.ts` | yes |
| GET | `/home/legal-links` | `src/api/home.ts` | yes |
| GET | `/home/menu` | `src/api/home.ts` | yes |
| GET | `/home/summary` | `src/api/home.ts` | yes |
| GET | `/notifications/history` | `src/api/notifications.ts` | yes |
| POST | `/notifications/mobile-subscriptions` | `src/notifications/fcm.ts` | yes |
| DELETE | `/notifications/mobile-subscriptions/{}` | `src/notifications/fcm.ts` | yes |
| GET | `/notifications/preferences` | `src/api/notifications.ts` | yes |
| PUT | `/notifications/preferences/{}` | `src/api/notifications.ts` | yes |
| POST | `/notifications/read-all` | `src/api/notifications.ts` | yes |
| GET | `/notifications/unread-count` | `src/api/notifications.ts` | yes |
| POST | `/notifications/{}/read` | `src/api/notifications.ts` | yes |
| POST | `/notifications/{}/unread` | `src/api/notifications.ts` | yes |
| GET | `/public/consent/mobile-number` | `src/api/mobileNumber.ts` | yes |
| GET | `/public/country-codes` | `src/api/mobileNumber.ts` | yes |
| GET | `/settings/groups-member` | `src/api/groups.ts` | yes |
| GET | `/settings/groups-owned` | `src/api/groups.ts` | yes |
| POST | `/teams` | `src/api/teams.ts` | yes |
| GET | `/tournaments` | `src/api/tournaments.ts` | yes |
| POST | `/tournaments` | `src/api/tournaments.ts` | yes |
| GET | `/tournaments/{}` | `src/api/tournaments.ts` | yes |
| POST | `/tournaments/{}/cancel` | `src/api/tournaments.ts` | yes |
| GET | `/tournaments/{}/fixtures` | `src/api/tournaments.ts` | yes |
| POST | `/tournaments/{}/invitations/respond` | `src/api/tournaments.ts` | yes |
| POST | `/tournaments/{}/invite-email` | `src/api/tournaments.ts` | yes |
| POST | `/tournaments/{}/invite-group` | `src/api/tournaments.ts` | yes |
| POST | `/tournaments/{}/invite-user` | `src/api/tournaments.ts` | yes |
| GET | `/tournaments/{}/registrations` | `src/api/tournaments.ts` | yes |
| POST | `/tournaments/{}/registrations` | `src/api/tournaments.ts` | yes |
| DELETE | `/tournaments/{}/registrations/{}` | `src/api/tournaments.ts` | yes |
| POST | `/tournaments/{}/venue-images` | `src/api/venues.ts` | yes |
| GET | `/users/me` | `src/api/onboarding.ts`, `src/api/profile.ts`, `src/auth/AuthContext.tsx` | yes |
| PATCH | `/users/me` | `src/api/mobileNumber.ts`, `src/api/profile.ts` | yes |
| DELETE | `/users/me/avatar` | `src/api/profile.ts` | yes |
| POST | `/users/me/avatar` | `src/api/profile.ts` | yes |
| DELETE | `/users/me/cover` | `src/api/profile.ts` | yes |
| POST | `/users/me/cover` | `src/api/profile.ts` | yes |
| POST | `/users/me/deletion-confirm` | `src/api/profile.ts` | yes |
| POST | `/users/me/deletion-request` | `src/api/profile.ts` | yes |
| GET | `/users/me/notification-settings` | `src/api/profile.ts` | yes |
| PUT | `/users/me/notification-settings` | `src/api/profile.ts` | yes |
| POST | `/users/me/onboarding/complete` | `src/api/onboarding.ts` | yes |
| GET | `/users/me/profile-summary` | `src/api/profile.ts` | yes |
| PUT | `/users/me/skill-level` | `src/api/profile.ts` | yes |
| DELETE | `/users/me/skill-level/{}` | `src/api/profile.ts` | yes |
| GET | `/users/me/skill-levels` | `src/api/profile.ts` | yes |
| GET | `/users/search` | `src/api/users.ts` | yes |
| DELETE | `/venue-images/{}` | `src/api/venues.ts` | yes |
| POST | `/venue-images/{}/report` | `src/api/venues.ts` | yes |
| GET | `/venues` | `src/api/venues.ts` | yes |
| GET | `/venues/postal/{}` | `src/api/venues.ts` | yes |
| GET | `/venues/{}` | `src/api/venues.ts` | yes |

Also called without `apiClient`: `GET {host}/app/version-policy` (`versionPolicy.ts`), Google Places (`places.ts`), and `POST /auth/refresh` (`refreshClient`). Two `fetch` calls in `places.ts` target Google, not the backend.

## Error handling
`utils/apiError.ts` turns 4xx bodies into user messages (only 4xx text is trusted); `utils/networkError.ts` classifies transport failures; `utils/logSafeError.ts` reduces any error to a log-safe tag. Auth screens show generic messages and never server detail.

## Drift and findings
- 🟡 MEDIUM Circuit breaker and retry/backoff designed in §3.3 are not built; only refresh-and-retry-once exists.
- 🟡 MEDIUM `NotificationHistoryScreen` reads `item.payload.display.url`, but the backend returns a top-level `url` and no `payload`; the deep-link branch is therefore dead and the screen falls through to routing by notification type and entity id (works, but the stored URL is ignored). It also whitelists the retired host `meetups.duckdns.org` for https links.
- 🟡 MEDIUM Google Places key is delivered to the client by `GET /config/client` and used directly against Google from the device; protect it with Google-side restrictions (package/SHA, API list). Cannot be verified from the repo.
- 🟢 LOW `events.ts` header cites an OpenAPI URL on the retired host; the generated contract notes in several files are dated 2026-09 and may predate backend changes.
