# As-built design: mobile notifications (`src/notifications`)

Status: AS-BUILT, reverse-engineered from code at `main` 79b9a3a (2026-10-17). Not ratified. Version/approval: owner to assign.
Related: [requirements/notifications.md](../requirements/notifications.md) · [navigation](navigation.md) · backend `~/meetup/docs/as-built/design/notifications.md` · `docs/DES-MEETUP-ADDENDUM-IOS-PN-Support.md`

## Purpose
Permission, FCM device registration, local rendering of data-only pushes, foreground banner, unread badge, tap routing.

## Files
| File | Lines | Role |
|---|---|---|
| `pushRegistration.ts` | 148 | per-session lifecycle: rationale once per install, system permission, register token, rotation listener, retry on foreground |
| `fcm.ts` | 393 | permission, token fetch/register/deregister, foreground/background/opened handlers |
| `deviceId.ts` / `iosDeviceId.ts` | 58 / 37 | stable device id (Android id; iOS UUID kept in Keychain) sent with the token |
| `eventNotificationHandler.ts` | 245 | local notifications for `group_event_created`, `event_changed`, `event_reminder` |
| `participantHandler.ts` | 195 | local notifications for `event_participant_added/removed` |
| `notificationRouting.ts` | 226 | type + entity id → tab / screen / params; root `navigationRef` |
| `notificationBannerStore.ts`, `unreadCountStore.ts` | 61, 41 | tiny external stores (banner, badge) |
| `channels.ts`, `platformOptions.ts` | 27, 25 | Android channel; iOS foreground options |

## Behaviour
- Registration calls `POST /notifications/mobile-subscriptions` with `{deviceToken, platform, userAgent, deviceId}` (camelCase; the backend accepts these as aliases of `device_token`, `user_agent`, `device_id`), at most once per distinct token per session; failure is logged and retried on next foreground; token rotation re-registers. Sign-out de-registers (`DELETE /notifications/mobile-subscriptions/{token}`).
- The server delivers data-only messages; the app builds the visible notification locally (notify-kit) so titles and actions come from labels. Foreground messages show an in-app banner instead of a system notification and increment the badge.
- Preferences: `GET/PUT /notifications/preferences` (shared list component in Settings and onboarding). History: `GET /notifications/history` with cursor, read/unread/read-all, `unread-count`.
- Routing is exhaustive over the 19 notification types; the set equals the backend `NOTIFICATION_TYPES` (checked). `team_invite` is routed to Group Detail with the notification's `entity_id` as `groupId` because no team detail screen exists.
- Permission rationale flag is device-level (`notifications.permissionRationaleShown.v1` in AsyncStorage); an unreadable flag fails closed (no prompt).
- Logging never includes tokens, error objects or notification content.

## Drift and findings
- 🟡 MEDIUM `team_invite` opens Group Detail with a team id; the group fetch fails and shows the retry state (fail-safe, but the invite cannot be acted on from the notification). Acknowledged in the file header; needs a Team Detail screen or a backend entity mapping.
- 🟡 MEDIUM Display strings for the two rich organiser messages (`event_participant_added/removed`) rely on the backend's multi-line body (up to 500 chars), deliberately outside the 120-char design limit.
- 🟢 LOW Foreground banner is a custom store, not the design's named library (documented deviation).
