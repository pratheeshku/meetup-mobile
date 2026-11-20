# rn-t3 Status: Organizer response notice, mobile

Branch: `rn-t3` (from main 6800a7b). Not merged. Gate: `/api/version` = 198 (checked 2026-11-20).
Source: DES-MEETUP-ADDENDUM-response-notice v1.0.1 (contract block in the task).

## Phase 1 findings
- **Tap routing is by type + entity id, not entity_ref.** `resolveNotificationTarget(type, entityId)` in `src/notifications/notificationRouting.ts` is shared by the foreground banner, the background/cold-start push tap (`RootNavigator.tsx`) and history rows.
- **History row:** `NotificationHistoryScreen.openNotification` first opens an absolute `https`/app-scheme `display.url`. A web-relative url (`/#event-detail/{id}`, as these two types send) is ignored and the row routes by type using `item.entity_id`.
- **Preference screen types are hard-coded** (`NOTIFICATION_TYPES` + `NOTIFICATION_TYPE_LABEL_KEYS` in `NotificationPreferencesList.tsx`), not server-driven. Missing server row means on.
- **Unknown type today:** history tap is a silent no-op (`isKnownType` guard); push payload is dropped by `extractPushPayload` (`isKnownNotificationType`); the pref list never shows it. So both new types needed adding to `NOTIFICATION_TYPES`.
- **Icons:** `NotificationIcon` map is partial (many types fall back to the generic icon), so no icon added.

## Changes
- `src/types/notification.ts`: added `event_response`, `tournament_response` (27 types).
- `src/notifications/notificationRouting.ts`: `event_response` -> EventDetail; `tournament_response` -> TournamentDetail (entity_id = id).
- `NotificationPreferencesList.tsx` + `defaultLabels.ts`: labels `mob.notif_pref.type_event_response` = "Guest replies to your games", `mob.notif_pref.type_tournament_response` = "Guest replies to your tournaments" (same `mob.notif_pref.type_*` style as the other rows). Default on.
- Tests: routing test (27 types, both targets), prefs test (both rows shown, default on).

## Not done / drift
- "Land where Responses is visible": EventDetail/TournamentDetail render the Responses section inline and have no scroll-to-section param, so no new UI was added; the tap opens the detail screen.
- New label keys are not seeded server-side (listed for the owner).
- Push `data.entity_id` for these types is assumed to carry the id (contract only shows entity_ref); not verifiable without a live push.
- Device test and screenshots: pending.
