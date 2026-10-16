# tournament-respond report

Branch: `feat/tournament-share-invite-respond`. Not merged.

## Files changed
- `src/api/tournaments.ts`: `respondToTournamentInvitation(id, accept)` -> `POST /tournaments/{id}/invitations/respond { accept }`.
- `src/components/tournament/TournamentInvitationBanner.tsx` (new), rendered by `TournamentDetailScreen` from `my_invitation_status`: **pending** = "You're invited to this tournament" with Accept / Decline; **accepted** = "You're invited" pill, no buttons; **null/other** = nothing. One correlation id per response. After success the tournament is re-fetched (`GET /tournaments/{id}`), so the banner reflects the server (accepted -> pill; declined -> gone). Accepting does not register the user.
- `409 INVITES_CLOSED`: the server's text (or the new fallback label for a bare code) is shown and the tournament is refreshed; the component stays mounted so the message survives the refresh even if the status becomes null. Other errors: generic message, buttons stay.
- Notification type `tournament_invited`: added to `NotificationType` and `NOTIFICATION_TYPES` (19 types), to `resolveNotificationTarget` (opens Tournaments > TournamentDetail with `entity_id` as `tournamentId`, same as the other tournament types), and to the notification-preferences label map (so push payloads of that type are accepted and tapping a banner or push navigates). Updated the two existing tests that pinned the count to 18.
- Tests: `src/screens/__tests__/TournamentRespond.test.tsx` (11), `src/notifications/__tests__/notificationRouting.test.ts` (+2, count 19), `src/components/__tests__/NotificationBanner.test.tsx` (+1: tapping opens Tournament Detail), `src/screens/__tests__/NotificationPreferencesScreen.test.tsx` (count 19 + label), `src/api/__tests__/tournaments.test.ts`.

New label keys (English text), added to the bundled `src/labels/defaultLabels.ts` only (required for `check:labels`); **nothing seeded** to the backend `ui_labels`:
- `mob.tournament.invite_group_hint` = "Select one of your groups to invite all its group members to this tournament."
- `mob.tournament.invite_player_hint` = "Search for and invite a player to this tournament."
- `mob.tournament.invite_group_none_new` = "Everyone in that group is already invited."
- `mob.tournament.invites_closed` = "Invitations are closed for this tournament."
- `mob.tournament.invited_banner_title` = "You're invited to this tournament"
- `mob.tournament.invited_accepted` = "You're invited"
- `mob.tournament.invite_accept` = "Accept"
- `mob.tournament.invite_decline` = "Decline"
- `mob.tournament.invite_respond_error` = "Could not send your response. Please try again."
- `mob.notif_pref.type_tournament_invited` = "Tournament invitations"
(For this task: invited_banner_title, invited_accepted, invite_accept, invite_decline, invite_respond_error, invites_closed, and `mob.notif_pref.type_tournament_invited`.) The notification's icon/label mapping follows the other types: it has a preferences row label; there is no per-type icon map in this codebase.

## Tests (raw)
```
TournamentRespond.test.tsx  Tests: 11 passed, 11 total
 banner per status: pending / accepted / null, undefined, declined, bogus; shows regardless of my_invite_access
 Accept -> {accept:true} + refresh + "You're invited"; Decline -> {accept:false} + banner gone
 INVITES_CLOSED (object / string / bare code): server text shown and tournament refreshed; network error keeps the banner
 Accept makes only the respond call (does not register)
notificationRouting + NotificationBanner + NotificationPreferencesScreen: pass
```

## Checks
- `npm run check:labels`: OK - 211 files scanned, 954 default labels checked.
- `npx tsc --noEmit`: clean. `npx eslint` on all changed files: clean.
- Full suite: branch `Test Suites: 15 failed, 126 passed, 141 total` / `Tests: 177 failed, 1607 passed, 1784 total`; `origin/main` baseline `15 failed suites / 177 failed tests`. Failing-suite lists identical (diff empty). The branch adds 5 passing suites and the new tests below.
- No screenshots: no emulator/device in this container.

## Deviations / notes
- A new notification type adds a toggle row in Notification preferences (default on). If the backend preferences API does not yet know `tournament_invited`, toggling that row may be rejected; the screen already tolerates unlisted types by defaulting them on.
- Deep link `#tournament-detail/{id}?invite={invitation_id}` (email invites) is not handled: the app has no deep-linking infrastructure (see the earlier game-restore report), so it was not built.
