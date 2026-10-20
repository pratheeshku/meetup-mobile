# DES-MEETUP-ADDENDUM-PUSH-ACTIONS

**Doc ID:** DES-MEETUP-ADDENDUM-PUSH-ACTIONS
**Version:** v1.0
**Status:** APPROVED by the owner, 2026-10-18 (decisions Q1 to Q14 are recorded as PA-01 to PA-14 below). Approved with the open items in section 16 still open; OI-1 (spike) gates all client work.
**Owner:** Pratheesh
**Date:** 2026-10-18
**Scale Tier:** T1
**Baseline:** repo `pratheeshku/meetup` `main` @ `251d929` and repo `pratheeshku/meetup-mobile` `main` @ `1d94102` (code read 2026-10-18). Design-only addendum. Does not edit the baseline or other addenda.
**Governing files:** `Enterprise_Design_Principles.md` v1.1 (P1–P17), `design-best-practices.md` v1.0 (BP-01–BP-13). Both read in full before drafting.
**Depends on:** `DES-MEETUP-ADDENDUM-invitation-response` v1.0 (Accept means joining; task `ia-backend` must be deployed before `pa-clients` ships the game Accept button) and `DES-MEETUP-ADDENDUM-access-consistency` v1.4 (404 on lost access, AC-11).
**Supersedes (explicit deviations, section 11):** the out-of-scope line for iOS action buttons in `DES-MEETUP-ADDENDUM-IOS-PN-Support` (D-1 there); the 2026-09-23 mobile decision that push actions only navigate (`docs/reports/INV-DES-MEETUP-MOBILE-notify-kit-direct-accept.md`); the double push for group games (`event_invite` plus `group_event_created`).
**Fold-in:** written as a standalone addendum so it can become one chapter of the consolidated `DES-MEETUP-NOTIFICATIONS` (owner decision, 2026-10-18; section 14).

**Process notes (flagged, not silent):**
1. No `REQ-MEETUP` addendum exists. Requirements were stated by the owner in conversation on 2026-10-18 and are restated in section 1 as `PA-01…PA-14`. Same departure as the access-consistency and invitation-response addenda. Section 1 is approved together with this document.
2. `solution-design` references `PRINCIPLES.md` P1–P23. The authoritative file is `Enterprise_Design_Principles.md` v1.1 (P1–P17). P1–P17 are used.
3. **Feasibility is not yet proven.** A Join or Accept tap from a locked or killed phone has never run in this codebase. The mobile investigation of 2026-09-23 rejected it for exactly that reason. This addendum therefore puts an on-device spike (`pa-spike`) in front of any client build (AD-5, section 10). The backend can ship without the spike because it is capability-gated per device (AD-3).
4. Every claim about code carries a file and, where useful, a line. Phase 1 re-verifies the ones marked "to verify".

---

## Plain-language summary

When someone invites you to a game or a tournament, or adds you to a group, the notification on your phone gets buttons. You can answer without opening the app.

- **Game invitation:** Accept or Ignore. Accept means you are playing (or on the waitlist if the game is full). You get a short result message such as "You're in" or "Game is full".
- **Tournament invitation:** Accept or Ignore. Accept means you are eligible to register. The result message says so and tells you to open the app to register, because registering is a separate step.
- **Added to a group:** Leave group or Ignore. You are already a member when the notification arrives; Leave group removes you.
- **Ignore** only clears the notification and marks it read. The invitation stays open.

Group games used to send two notifications for the same game. They now send one.

After you answer, the notification list in the app shows what happened ("Joined", "Waitlisted", "Accepted", "Left group") instead of a stale invitation, whether you answered from the notification, from the list or from the game screen.

---

## 1. Requirements baseline (owner, 2026-10-18; approved with this document)

| ID | Requirement |
|---|---|
| PA-01 | A game invitation push carries Accept and Ignore. Accept completes the invitation response without opening the app. |
| PA-02 | A tournament invitation push carries Accept and Ignore. Accept only confirms eligibility; registration stays in the app. |
| PA-03 | A group-addition push carries Leave group and Ignore. The user is already a member when it arrives. |
| PA-04 | Ignore clears the notification from the tray and marks it read. It never changes the invitation or membership, and the history entry stays. |
| PA-05 | A group game sends one push per member (the invitation, with Accept and Ignore). The duplicate `group_event_created` push is stopped. |
| PA-06 | The push body carries the game details the old group push carried (sport, organizer, date, time, venue, capacity), so the user can decide without opening the app. |
| PA-07 | Android and iOS ship together. |
| PA-08 | The push action uses the existing device session. On a locked iPhone, if the session route fails the spike, Join may require Face ID or the passcode first. |
| PA-09 | After a push action, and after an answer given anywhere else, the in-app notification shows the outcome and no longer offers the answered action. |
| PA-10 | After every action the user gets a result message: success, waitlist, or the reason it failed. |
| PA-11 | Actions reuse only existing endpoints (invitation respond for games and tournaments, group self-removal, notification mark-read). No new action endpoints. |
| PA-12 | If a notification is lost, the user can still answer from the notification list or from the game, tournament or group screen. |
| PA-13 | All button and result text comes from admin label management (`ui_labels`). |
| PA-14 | A kill switch (configuration flag) returns the apps to plain pushes without a redeploy. |

---

## 2. Scope & Constraints

**In scope:** backend `~/meetup` (`notifications`, `events`, `groups`, `tournaments` callbacks); one additive migration; mobile app (Android and iOS); label keys; the notification-list outcome field (API plus mobile list label).

**Out of scope (v1):**
- Web PWA push buttons. The service worker keeps its generic View and Dismiss actions (`frontend/service-worker.js:197-200`). Deferred with a gate (section 13).
- Action buttons on any other notification type (`waitlist_promoted`, `event_changed`, `event_reminder`, `team_invite`, tournament results).
- Accept and Ignore buttons inside the in-app notification list. The list shows the outcome label only; buttons there need a UI board (OI-2).
- An offline queue for actions taken without a connection.

**Constraints**
- Migrations are written, never executed by agents; the human runs them one at a time (`AGENTS.md`).
- Additive only (P14). No RLS, no DB triggers, no DB-side validation. Authorisation stays in `policies.py` (P15).
- Zero sibling imports. `notifications` must not import `events`, `groups` or `tournaments`; outcome state is supplied by registered resolvers (AD-6), the pattern already used in `groups/access_hooks.py`.
- `notifications.mobilepushsender` stays worker-only (never imported by the API process; existing test).
- Tier T1: one Postgres, one api process, one worker. No new service or queue (BP-12).

---

## 3. Architecture Decisions

**AD-1: Scope table (PA-01 to PA-04, PA-11).** One table in the backend and one in the app, kept identical.

| `notification_type` | Buttons | Call on tap | Existing endpoint (verified) |
|---|---|---|---|
| `event_invite` | Accept, Ignore | respond, `accept: true` | `POST /events/{event_id}/invitations/respond` (`events/router.py:415`) |
| `tournament_invited` | Accept, Ignore | respond, `accept: true` | `POST /tournaments/{tournament_id}/invitations/respond` (`tournaments/router.py:1089`; answers 404 while `invitations.enabled` is false, OI-5) |
| `group_invite` | Leave group, Ignore | self removal | `DELETE /groups/{group_id}/members/{user_id}` with `user_id` = caller (`groups/router.py:436`; `groups/service.py:184` allows self removal) |
| all three | Ignore | mark read | `POST /notifications/{notification_id}/read` (`notifications/router.py:303`) |

Ignore is the only button that works with no response body to interpret. It never calls a respond or leave endpoint.

**AD-2: One push per group game, with the full body (PA-05, PA-06).** `fan_out_to_groups` (`events/service.py:339-360`) creates a pending invitation and an `event_invite` for each member, then calls `_enqueue_group_event_created_notification` for the same audience. Change:
1. Stop calling `_enqueue_group_event_created_notification` from `fan_out_to_groups` (both the create path and the `only_new` edit path). The function, the type, its preference toggle and its history rows remain (P14); it is simply no longer emitted by this path.
2. `event_invite` (direct and group-sourced) takes the body built by `build_group_event_created_display` (`notifications/service.py:549`): sport, organizer, date, time, venue, capacity. Add `event_invite` to `RICH_BODY_NOTIFICATION_TYPES` (`notifications/schemas.py`) so the 500-character budget applies. The title stays `Game Invitation: {title}` (50 characters, `events/service.py:557`).
3. A member who had switched off `event_invite` but kept `group_event_created` on now receives nothing for new group games. Accepted: one switch now governs one notification.

**AD-3: Per-device capability gate (PA-07, PA-14, P14).** An Android push can carry buttons only if the app builds the notification itself, which means the FCM message must be data-only (same reason as `event_participant_added`, `mobilepushsender.py:84`). An installed app that does not know this change would show nothing for a data-only `event_invite`. So the server decides per token:

| Condition | Android message | iOS message |
|---|---|---|
| Flag off | unchanged (notification block, no buttons) | unchanged |
| Flag on, token has `push_actions_version` >= 1 | **data-only** (no notification block), app renders buttons | alert plus `aps.category` |
| Flag on, token without `push_actions_version` (old app) | unchanged (notification block, no buttons) | alert plus `aps.category` (an unregistered category is ignored by the OS; no buttons appear) |

- New nullable column `notifications.mobile_push_tokens.push_actions_version` (integer; NULL means an app that predates this feature). Set on every registration; no DB-side validation.
- `POST /notifications/mobile-subscriptions` accepts an optional `pushActionsVersion` integer (additive request field, ignored by old servers the same way `deviceId` was). Upsert on `(user_id, platform, device_id)` already exists, so a token upgrades in place when the app updates.
- Message construction (`build_fcm_message`, `_build_android_message`, `_build_ios_message` in `notifications/mobilepushsender.py:195-349`) takes the token's `push_actions_version`, the flag, and the new `delivery_id` (AD-4). `_DATA_ONLY_TYPES` (today `event_participant_added`, `event_participant_removed`) is unchanged; a second set, `_ACTION_TYPES` (`event_invite`, `tournament_invited`, `group_invite`), is data-only only when the table above says so.
- iOS categories: `aps.category` values `invite_game`, `invite_tournament`, `group_added`. iOS already receives the alert block for every type (`_build_ios_message`, requirement R-004.1 item 3), so no iOS data-only flip exists or is needed.
- This removes the dual-deploy hazard: backend and app can ship in either order, and the flag is flipped last.

**AD-4: What the push carries (PA-04).** Existing FCM `data` keys are unchanged (`notification_id`, `notification_type`, `entity_type`, `entity_id`, `url`, `tag`, `title`, `body`). One key is added: `delivery_id`, the id of this device's `notification_deliveries` row.
- Why (found while reading the code, BP-01): the mark-read endpoint takes a **delivery id** (`notifications/service.py:731`, `WHERE d.id = :id`). The push today carries `notification_id`, which is the payload uuid generated at enqueue (`PushFanoutPayload.notification_id`), not a delivery id. Ignore could not mark the right row read without this. Mark-read already marks every delivery of the same outbox job for the user, so any of the user's delivery ids works.
- `delivery_id` is not a reserved FCM key. `build_fcm_message` has the delivery row's id from the dispatch context (`DispatchContext.delivery_id`); it is passed in as a parameter. It is never logged beyond the existing log line.

**AD-5: Handler behaviour and the spike gate (PA-08, PA-10).**
1. **Android.** The app renders the notification with `react-native-notify-kit` (as `eventNotificationHandler.ts` does for `group_event_created`) with two action buttons. The notify-kit notification id is set to the push `tag` (or `notification_id`) so an at-least-once FCM redelivery replaces the entry instead of duplicating it.
2. **iOS.** The app registers three categories at launch (titles from labels) with Accept or Leave group as a background action (`foreground: false`) and Ignore as a background action. If the spike shows the session route fails while the device is locked, the Accept and Leave actions are registered with the OS option that requires authentication, so the system asks for Face ID or the passcode before the action runs. The app does not open.
3. **Action flow (both platforms), per action, one correlation id (`withCorrelationId()`):** ignore a second press while one is in flight; obtain an access token through the existing `refreshAccessToken()` (`src/api/client.ts`), which uses the refresh cookie held in the native cookie jar and needs no Keychain read; call the endpoint in table AD-1 with that token held in memory; persist the new token best effort only; build the result notification (AD-7); replace the original notification with it. Ignore does no token work if the mark-read call cannot be made; it cancels the tray entry first, then calls mark-read best effort.
4. **Spike `pa-spike` (gates every client build; the backend ships independently).** A throwaway branch that does one thing: on a physical Android phone and a physical iPhone, call the Accept endpoint from a notification action with the device (a) unlocked, app backgrounded; (b) locked, app backgrounded; (c) locked, app killed. Acceptance (measurable, BP-10): for each of the six Android and iOS cases combined with the three states, 10 attempts, at least 9 succeed, and on iOS the result is delivered inside the OS background allowance (about 30 seconds from tap). Outputs: a report with raw results, which route worked (session refresh, or authenticated action), and a go or no-go per platform. A no-go on a platform keeps the flag off for that platform and the buttons absent there; it is not a design failure.
5. **Offline or network error:** no pre-flight connectivity check exists anywhere in the app (R-101 has no implementation; investigation report, question 4). The handler attempts the call and, on failure, shows "Couldn't complete this. Open the app." whose tap opens the entity (deviation D-4).

**AD-6: Outcome shown in the notification list is derived, never stored (PA-09, PA-12).**
- `GET /notifications/history` items (`NotificationHistoryItem`, `notifications/schemas.py:357`) gain one additive field, `action_state` (string or null). The list already carries `notification_type`, `entity_type` and `entity_id`.
- The `notifications` module cannot import the three owning modules, so it exposes `register_action_state_resolver(notification_type, fn)` (same shape as `groups/access_hooks.py`). `events`, `tournaments` and `groups` each register one resolver at startup. The list service groups the page's items by type and makes one batched resolver call per type for the caller (no query per row).
- Each resolver applies the module's current view predicate for the caller first. A caller who can no longer see the entity gets `unavailable` and nothing else (AC-08, AC-11; no existence leak).

| Type | `action_state` values | Source (single source, section 5.2) |
|---|---|---|
| `event_invite` | `pending`, `going`, `waitlisted`, `declined`, `withdrawn`, `unavailable` | `event_invitations.status` joined to `event_participants.status` |
| `tournament_invited` | `pending`, `accepted`, `declined`, `closed`, `unavailable` | `tournament_invitations.status`, and `closed` when `invites_open` is false |
| `group_invite` | `member`, `left`, `unavailable` | `group_memberships` (row present or not) |
| all other types | `null` | n/a |

- Why derived: the same outcome shows whether the user answered from the push, from the list, from the game screen or from another device, with no second copy to keep in sync (BP-09).
- The mobile list renders the `action_state` label and does not offer the answered action. Buttons inside the list for `pending` items are not part of this version (OI-2).

**AD-7: Result messages (PA-10, PA-13).** After an action the original notification is replaced by one result notification (no buttons; tap opens the entity). Text is label-driven; new keys are added to admin label management and the existing `npm run check:labels` gate.

| Action | Response | Result message |
|---|---|---|
| Accept game | 200, `participation_status` `going` | "You're in" |
| Accept game | 200, `waitlisted` | "You're on the waitlist" |
| Accept game | 400 refusal (cancelled, skill requirement) | the server's reason, then "Open the app" |
| Accept game | 400 already accepted | "Already accepted" |
| Accept game | 404 | "This game is no longer available" |
| Accept tournament | 200 | "Accepted. Open the app to register." (tap opens the tournament) |
| Accept tournament | 409 invitations closed | "Invitations are closed" |
| Accept tournament | 400 already answered | "Already answered" |
| Accept tournament | 404 | "This tournament is no longer available" |
| Leave group | 200 | "You left {group}" |
| Leave group | 400 owner | "Owners can't leave. Open the app." |
| Leave group | 404 | "You're no longer in this group" |
| any | 401 after refresh, network error, timeout | "Couldn't complete this. Open the app." |
| Ignore | n/a | none (the entry is cleared) |

The `participation_status` field exists only after `ia-backend` ships (invitation-response AD-3). Until then the game Accept button must not be enabled (OI-3).

**AD-8: Wording fix for group additions (PA-03).** `POST /groups/{group_id}/invite` creates the membership immediately (`groups/service.py:107-112`, `groups/router.py:353`), but the push says "You've been invited to join {group}". With a Leave button that reads as "decline". The body becomes "You were added to {group}." The title "Group invite" becomes "Added to a group". This text is built in code today, not in labels; moving producer-composed text to labels is a parked task, so this is a flagged exception (D-6).

**AD-9: Kill switch (P1, PA-14).** `meetup.notifications.push_actions.enabled` (boolean, default false), read from `platform_config` by the worker at send time the same way `notifications/retention.py` reads `notifications_retention_days`, because `notifications` cannot import `home.service`. A missing key means false. The flag gates AD-3 only; AD-2 (single push, rich body), AD-6 and AD-8 are not behind it. Flipping the flag off takes effect on the next delivery batch, with no deploy.

**AD-10: Security (P9, P15).**
- The tap carries an entity id from the push payload. Authority is the backend: the respond endpoints declare `is_event_invitee` or the tournament invitee check, the leave route allows only the caller's own membership, mark-read accepts only the caller's own delivery row. A forged or replayed action therefore reaches the same denial a client call would (404, AC-11).
- Idempotency (P5): a second Accept returns the existing 400 "already accepted" (invitation-response AD-5); a second Leave returns 404. The handler maps both to a result message and creates no second effect.
- Lock-screen content: `event_invite` now carries organizer, date, time and venue in the body. This extends the 2026-09-20 deviation already applied to the participant types and to `group_event_created` (D-3).
- Logs: never the token, title, body, entity id or delivery id in app logs (R-111); server logs keep the existing `token_hash` only (P4).
- The iOS authenticated-action option (AD-5 item 2) is the control against someone with a locked, unattended phone accepting for the user.

---

## 4. Component / Integration Design

| Component | Change |
|---|---|
| `events/service.py` | Stop emitting `group_event_created` from `fan_out_to_groups`; `_enqueue_event_invite_notification` builds the rich body; register the `event_invite` outcome resolver. |
| `groups/service.py`, `groups/router.py` | `group_invite` title and body (AD-8); register the `group_invite` resolver. |
| `tournaments/` | Register the `tournament_invited` resolver. |
| `notifications/schemas.py`, `service.py` | `action_state` on the history item; resolver registry; `event_invite` in `RICH_BODY_NOTIFICATION_TYPES`; `pushActionsVersion` on mobile registration. |
| `notifications/mobilepushsender.py`, `delivery.py` | Per-token message selection (AD-3), `delivery_id` in data, `aps.category`, flag read. |
| Migration (one) | `mobile_push_tokens.push_actions_version INTEGER NULL` (section 5.1). |
| Mobile `src/notifications/` | Action-capable renderer for the three types, category registration, action handler, result notifications, registration sends `pushActionsVersion`. |
| Mobile list | Renders `action_state` as a label (OI-2). |
| Label management | New keys (AD-7 table, button titles). |

**Integration boundaries**

| Boundary | Failure behaviour |
|---|---|
| Tap to respond endpoint | One attempt, no retry; failure becomes a result message (AD-7). |
| Session refresh in a background context | Failure becomes the generic "Open the app" message; no crash, no retry loop. |
| Resolver call in the list | A failed resolver returns `action_state: null` for that type; the list still loads (fail soft; the value is display only). |
| Flag read | A read failure is treated as off (fail to the plain push). |
| Mark-read from Ignore | Best effort; a failure leaves the item unread in the list, nothing else. |

---

## 5. Data Contracts

### 5.1 Schema (additive; migration written, not executed)

| Change | Detail |
|---|---|
| `notifications.mobile_push_tokens.push_actions_version` | `INTEGER NULL`. NULL means an app that predates this feature. No CHECK, no default (no DB-side validation). Existing columns verified in `as-built/design/notifications.md` (BP-01): `id`, `user_id`, `device_token`, `device_id`, `platform`, `user_agent`, `created_at`, `deactivated_at`. |
| Existing tables | No column removed or retyped. |

### 5.2 Data lineage (one source per field)

| Field | Single source | "If it comes from elsewhere, it is a bug" |
|---|---|---|
| Whether an invitation is answered, and how | `event_invitations`, `tournament_invitations` | a flag on the notification row, or client state |
| Whether the user is still in a group | `group_memberships` | the notification, the push, the client |
| Which buttons a push shows | the app's table keyed by `notification_type` (AD-1) | a server-sent action list |
| Whether a device can render actions | `mobile_push_tokens.push_actions_version` | the user agent string |
| Whether actions are on | `platform_config` key (AD-9) | an environment variable or a client constant |

### 5.3 Sensitive fields

| Field | Handling |
|---|---|
| FCM device token, session token, refresh cookie | Never logged. The refresh cookie never leaves the native cookie jar. The in-memory access token lives only for the one action. |
| Push body (organizer name, venue) | Displayed on the lock screen; excluded from logs (R-111). |
| `delivery_id` | Ids only; same handling as `notification_id`. |

---

## 6. Security & Compliance Considerations

| Resource | Allowed | Explicitly denied |
|---|---|---|
| Respond to an invitation | the invitee, per the existing endpoint rules | everyone else, 404 |
| Leave a group | the member themselves | removing another user is a different route and rule |
| Mark read | the owner of the delivery row | others, 404 |
| History `action_state` | the caller, after the view predicate | an entity the caller cannot view returns `unavailable` only |

**Threats and controls**
- *Stolen or unattended unlocked phone accepts an invitation:* worst case is an unwanted join or a group exit; both are reversible by the user in-app except leaving a group (needs a new invitation). Accepted for Accept, mitigated for iOS by the authenticated-action option, and visible through the result notification (D-5).
- *Replayed or forged tap:* AD-10, same denials as a client call.
- *Stale buttons on a second device:* a tap returns "already answered" and becomes the correct outcome message.
- *Old app receives a data-only push and shows nothing:* prevented by the capability gate (AD-3).
- *Lock-screen disclosure:* D-3, owner decision.

**Compliance (PDPA):** no new personal data stored. `push_actions_version` is a device capability integer. The privacy policy needs no change.

---

## 7. Failure Modes & Resilience

| Scenario | Behaviour |
|---|---|
| Session cannot be refreshed in the background | Generic result message; the notification remains actionable only by opening the app. |
| iOS background allowance exceeded | The OS ends the task; the user sees the original notification gone and no result. Mitigation: no retries, one fast call; spike measures the margin; the list shows the true outcome when opened. |
| Two taps in quick succession | The handler ignores the second while one is in flight; the server is idempotent anyway. |
| Two devices answer at once | One succeeds, the other gets "already answered" (400). |
| Game full, cancelled, or skill not met | The respond endpoint refuses and the invitation stays pending (invitation-response IR-03); the result message shows the reason. |
| Invitations closed (tournament) | 409; "Invitations are closed". |
| User lost access after the push was sent | 404 (AC-11); "no longer available". |
| FCM delivers the same message twice | Same notify-kit id replaces the entry (AD-5 item 1). |
| Worker down | Pushes are delayed as today; nothing new. |
| Flag turned off mid-flight | Pushes already in the tray keep their buttons until tapped; their taps still work. |

---

## 8. Observability & Operability

- Correlation id per action from the app through to the respond endpoint (existing `withCorrelationId()`).
- Server metrics: `push_action_messages_total{type,platform,mode}` where mode is `data_only`, `alert_category` or `plain`; `push_action_taps_total{type,action,outcome}` is derived from the existing request logs of the respond, leave and mark-read endpoints (no new endpoint, no new log source).
- Alert on a sustained rise in `outcome=network_or_auth_failure` reported by the app's diagnostics layer (the switchable diagnostics layer already in the app), threshold set after the spike with its baseline. Not per error.
- Kill switch AD-9 is the first response to any platform fault.
- Runbook entry: flipping the flag, reading `mode` counts, checking a token's `push_actions_version`.

---

## 9. Test Requirements

Risk classification: respond and leave call paths **High**; capability gate **High** (can silence a push); history `action_state` **Medium**; label text **Low**.

**Backend (API level; P13, DB backstop absent)**

| # | Test |
|---|---|
| PA-T1 | A group game with N members creates exactly N `event_invite` pushes and no `group_event_created` push, on create and on `only_new` group addition. |
| PA-T2 | `event_invite` body contains sport, organizer, date, time, venue, capacity within 500 characters; title unchanged. |
| PA-T3 | Flag off: every token gets the pre-change message (Android notification block, iOS alert without `aps.category`). |
| PA-T4 | Flag on, Android token with `push_actions_version` 1: data-only message with `delivery_id`; token with NULL: notification block. |
| PA-T5 | Flag on, iOS token: alert plus `aps.category` of `invite_game`, `invite_tournament` or `group_added` for the three types, and no category for any other type. |
| PA-T6 | `delivery_id` equals the delivery row id and, passed to `POST /notifications/{id}/read`, marks the user's deliveries of that job read; another user's id returns 404. |
| PA-T7 | Registration with `pushActionsVersion` upserts on `(user_id, platform, device_id)` and an old client without the field leaves the column unchanged. |
| PA-T8 | History `action_state`: each value for each of the three types; a caller who lost access gets `unavailable` and no detail; other types return null; one query per type per page. |
| PA-T9 | Respond by a non-invitee returns 404; leave of another user's membership is denied; mark-read of another user's id returns 404 (negative tests under P13, one per button). |
| PA-T10 | `group_invite` title and body read "Added to a group" and "You were added to {group}". |
| PA-T11 | Accept a game invitation twice: second returns 400 and exactly one participant row (relies on `ia-backend`). |
| PA-T12 | Flag read failure behaves as off. |

**Mobile:** action handler tests for every row of the AD-7 table (mocked endpoint), double-press guard, redelivery replaces the entry, the three iOS categories register with label titles, `npm run check:labels` passes for the new keys.

**On-device (the spike, `pa-spike`, then repeated once as acceptance in `pa-clients`):** the six-by-three matrix of AD-5 item 4 on Android and iPhone.

---

## 10. Implementation Phases

Migrations are written per phase; the human runs them. Each phase ends with an implementation report written back here (BP-13). Mobile work follows the repo split (mobile to agy, backend to Claude Code).

| Task ID | Content | Starts after | Acceptance |
|---|---|---|---|
| `pa-spike` | AD-5 item 4: throwaway branch, physical Android and iPhone, six-by-three matrix | nothing | Report with raw results and a go or no-go per platform |
| `pa-backend` | Migration; registration field; per-token message selection; `delivery_id`; `aps.category`; flag; rich `event_invite` body; `group_invite` wording; stop `group_event_created` emission; `action_state` plus resolvers | nothing (ships dark: flag off) | PA-T1 to PA-T12 |
| `pa-clients-mobile` | Renderer, categories, handler, result notifications, registration field, list label, label keys | `pa-spike` go, `pa-backend` deployed, `ia-backend` deployed (game Accept), OI-2 answered | Mobile tests; AD-5 matrix repeated as acceptance; screenshots next to any board |
| `pa-enable` | Owner flips the flag on, platform by platform if the spike said so | the three above | Live check with a real invitation per type, per platform |

Rollback is the flag (AD-9); a code rollback is a redeploy. The migration is additive and stays.

---

## 11. Deployment & Rollback

- Order: migration, api, worker (capability column and `delivery_id` are additive); then the app release; then the flag. No window exists where an installed app can receive a push it cannot render (AD-3).
- If an app release misbehaves: flag off. Android falls back to notification-block pushes, iOS to alerts without categories. No data is changed by any of this.
- Participant, invitation and membership rows changed by a push action are normal rows created by the normal endpoints and stay on rollback.

---

## 12. Principles & Best-Practices Compliance

| Principle | Design element | Status |
|---|---|---|
| P1 Config-driven | AD-9 flag, default false, missing means false | Met |
| P2, P3 | Baseline | Unchanged |
| P4 Observability | Correlation id per action; metrics section 8; no secrets in logs | Met |
| P5 Idempotency | Respond and leave are idempotent; handler single-flight; redelivery replaces | Met |
| P6 Immutable context | No new decision records; participant action logs unchanged | Unchanged |
| P7 Fault isolation | One attempt, no retry loop; fail-soft resolvers; flag as circuit breaker | Met |
| P8 | Baseline | Unchanged |
| P9 Validate at boundary | Server-side respond rules; the app is UX only | Met |
| P10 Least privilege | No new grants; no new role | Met |
| P11 | Baseline | Unchanged |
| P12 Retention | No new stored personal data | Met |
| P13 Negative tests | PA-T9 per button | Met |
| P14 Additive evolution | New field, new column, new key; `group_event_created` kept; capability gate | Met |
| P15 Shift-left authz | Existing declared endpoint rules reused; no new route | Met |
| P16 Encryption at rest | Baseline | Unchanged |
| P17 Rate limits | Respond routes: not verified (OI-7) | To verify in Phase 1 |
| BP-01 Verify schema | Names checked against `as-built/design/notifications.md` and code, with lines | Met; Phase 1 re-verifies |
| BP-03 Consistency | Section 1 to section 13 mapping | Met |
| BP-09 Canonical source | Section 5.2 | Met |
| BP-10 Measurable gates | AD-5 spike acceptance; section 13 | Met |
| BP-12 T1 simplicity | One column, one flag, one registry; no queue, no service | Met |
| BP-13 Write-back | Per-phase reports | Planned |

---

## 13. Requirements Coverage and Deferred Decisions

| Requirement | Section |
|---|---|
| PA-01, PA-02, PA-03, PA-11 | AD-1 |
| PA-04 | AD-1, AD-4 |
| PA-05, PA-06 | AD-2 |
| PA-07, PA-14 | AD-3, AD-9 |
| PA-08 | AD-5 |
| PA-09, PA-12 | AD-6 |
| PA-10 | AD-7 |
| PA-13 | AD-7 |

**Deferred decisions (BP-10)**

| Deferred | Why | Gate to revisit |
|---|---|---|
| Action buttons on the web PWA push | Not requested; the service worker has only View and Dismiss | Owner requests, or more than 20 active web push subscriptions |
| Buttons for `pending` items inside the in-app list | Needs a UI board; the fallback is the game, tournament or group screen | Owner supplies a board, or more than 20% of pending invites are answered from the list screen |
| Queue for actions taken offline | Adds state and replay rules at T1 | More than 5% of action taps end in the network-failure message over 7 days |
| Action buttons on other notification types | Not requested | Owner requests |

---

## 14. Relationship to the consolidation task

Owner decision, 2026-10-18: all notification design documents are to be combined into one. This addendum is written to fold in unchanged. The consolidation itself is a separate doc-sync task (note `TASK-notification-doc-consolidation.md`), run after this addendum is approved. It must also correct the drift found while reading: `DES-MEETUP-MOBILE.md` section 4.8 lists `group_invite` as a "pending invitation state" although the backend creates the membership immediately.

---

## 15. Deviations (deliberate, flagged)

| # | Deviation | From | Rationale |
|---|---|---|---|
| D-1 | Action buttons on iOS push for three types | `DES-MEETUP-ADDENDUM-IOS-PN-Support` out-of-scope line (D-1 there) | Owner requirement PA-07; the gate there ("more than 20 active iOS tokens or an explicit product requirement") is met by the explicit requirement |
| D-2 | A push action calls an endpoint directly instead of navigating | Mobile decision of 2026-09-23 (investigation report) | Owner requirement; the blocking unknowns become the spike (AD-5) |
| D-3 | `event_invite` body carries organizer, date, time, venue on the lock screen | `DES-MEETUP.md` section 4.11 (body 120 characters, no private details) | Extends the owner's 2026-09-20 decision already applied to the participant types and `group_event_created` |
| D-4 | No offline pre-check before a push action; a reactive message is shown | R-101 (RSVP disabled while offline) | R-101 has no implementation in any context; a headless handler has no screen to disable. Needs owner acceptance (OI-6) |
| D-5 | Leave group runs from a push with no confirmation dialog | The in-app Leave confirmation (`GroupDetailScreen.tsx`) | Notification buttons cannot show a confirmation; owner chose the button; the result message makes a mis-tap visible; a new invitation is needed to rejoin |
| D-6 | `group_invite` title and body rewritten in code | Parked task: producer text moves to labels | The old wording ("invited to join") contradicts the immediate membership and would read as "decline" next to Leave |
| D-7 | `group_event_created` no longer emitted for group fan-out | Existing behaviour (both pushes sent, flagged earlier as a product question) | Owner requirement PA-05; the type, preference and history rows remain |

---

## 16. Open Items

| ID | Item | Severity | Status |
|---|---|---|---|
| OI-1 | Spike result per platform (AD-5 item 4). Decides the session route on iOS (refresh, or authenticated action) and whether buttons ship on each platform. | 🔴 CRITICAL | Open; gates `pa-clients-mobile` |
| OI-2 | No UI board for the `action_state` label in the notification list or for the result notification text. Reuse the existing notification-list and completion patterns, or the owner supplies a board. | 🟡 MEDIUM | Open; blocks `pa-clients-mobile` only |
| OI-3 | `ia-backend` must be deployed before the game Accept button is enabled, otherwise Accept only marks the invitation accepted. | 🟠 HIGH | Open; sequencing |
| OI-4 | Web PWA keeps View and Dismiss in v1. | 🟢 LOW | Default accepted by silence; owner to confirm |
| OI-5 | `meetup.tournament.invitations.enabled` must be true in production for the tournament Accept to work (the endpoint answers 404 otherwise). | 🟠 HIGH | Open; verify before `pa-enable` |
| OI-6 | Owner acceptance of D-4 (reactive message instead of R-101 pre-check). | 🟡 MEDIUM | Open |
| OI-7 | P17: confirm rate limits on the three respond or leave routes; no limiter decorator was found on the tournament router (`groups/router.py` uses `limiter.limit`). | 🟡 MEDIUM | Open; Phase 1 verify |
| OI-8 | Phase 1 re-verification of the "to verify" items: `RICH_BODY_NOTIFICATION_TYPES` location, resolver registry placement, iOS category support in the installed notify-kit version, retention-style flag read in the worker. | 🟡 MEDIUM | Open |

---

## 17. Risks & Mitigations

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | The spike fails on a platform | Flag off for that platform; the rest of the work (single push, rich body, outcome list) still ships |
| R-2 | iOS background allowance too short | One fast call, no retry; authenticated-action option; spike measures the margin |
| R-3 | A mis-tap on Leave group | D-5; result message; Ignore sits beside it |
| R-4 | Old app builds in the field | Capability gate (AD-3) |
| R-5 | Tournament Accept read as "registered" | Result text says to open the app to register (AD-7); button label is Accept, not Join |

---

## 18. Review Log

| Version | Date | Note |
|---|---|---|
| v1.0 | 2026-10-18 | Approved by the owner, no content change from v0.1. |
| v0.1 | 2026-10-18 | First draft after elicitation Q1 to Q14. Code facts read from `meetup` @ `251d929` and `meetup-mobile` @ `1d94102`. Finding recorded while drafting: the mark-read endpoint takes a delivery id, which the push did not carry (AD-4). |
