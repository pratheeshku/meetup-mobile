# DES-MEETUP-ADDENDUM-game-view-redesign

**Version:** v1.0
**Status:** APPROVED (owner, 2026-10-21)
**Applies to:** backend + web (`pratheeshku/meetup`), mobile (`pratheeshku/meetup-mobile`)
**Amends:** DES-MEETUP-ADDENDUM-user-details-menu v1.4 (UM-06), DES-MEETUP-ADDENDUM-decline-response v1.1 (AD-5 display order), DES-MEETUP-ADDENDUM-dashboard v1.9 (AD-21 toggle placement), DES-MEETUP-ADDENDUM-closure-report v1.0 (section placement only)
**Boards:** owner-approved canvas of 2026-10-21 ("Game & Tournament View Redesign": Games list, Game view, Invite picker, Pop-ups, Tournament view). Sample names/counts on the boards are illustrative. Repo copies: docs/design/game-view-redesign/.
**Tasks:** gv-backend-web (meetup), gv-mobile (meetup-mobile). Briefs are given in chat only (owner rule 2026-10-20), not committed.

## 1. Background

The closure-report (cr-*) and decline-response (dr-*) features are live (backend 92a634a, PWA v172, mobile versionCode 93 pending upload). Owner feedback on 2026-10-21 reshapes the game and tournament view pages and the Games list. Governing constraint, stated by the owner: **additive only — do not redesign or restyle any screen, and do not change any existing function, beyond the deltas named in §3.** Everything not named stays pixel- and behaviour-identical.

General principle recorded for all future list UIs (GV-P1): **when showing a listing of people or items, group it** (e.g. by response status, registration state), with the "most done" group first.

## 2. Architecture decisions

- **AD-1 No new backend surface for the tournament Registered split.** The tournament Responses block's "Registered" grouping is computed on the client by intersecting `GET /tournaments/{id}/responses` (organizer/committee-only) with `GET /tournaments/{id}/registrations` (authenticated). The responses endpoint keeps returning accepted/pending/declined unchanged.
- **AD-2 Invited-individuals visibility keeps the existing guard.** The invite-type pop-up lists groups (from `group_ids`/`group_names`, already in the event payload, visible to any viewer) and invited individuals (from `GET /events/{event_id}/invitations`, which stays organizer-only). A non-organizer tapping the row sees the groups section only; on a public game the row is a non-tappable "Public" value. Same pattern on tournaments (committee counts as organizer where the endpoint already allows it).
- **AD-3 Responses replaces the Players block only where the viewer may read responses.** `GET /events/{id}/responses` is organizer-only (`can_read_event_responses`). For the organizer, the Players block is replaced by the Responses block; for any other viewer the existing Players block stays exactly as today. Tournaments likewise (organizer/committee).
- **AD-4 Multi-select player invite is a client loop.** The invite picker stages users/emails with + / − and sends once; the client calls the existing `POST /events/{event_id}/invite-user` / `invite-email` per staged entry (as group invite already loops `invite-group`). No new bulk endpoint. Per-entry failures are reported per name; successes stand.
- **AD-5 Venue pop-up reuses venue data already on the event/tournament payload** (`venue_name`, `venue_address`, `venue_lat/lng`, `venue_place_id`, `venue_snapshot`). "Open in Google Maps" builds the URL client-side: `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>` when coordinates exist, else `query=<urlencoded name + address>`; `query_place_id=<venue_place_id>` appended when present. No backend change. The existing venue photos strip and organizer photo actions (VenueDetailCard / vc-m-photos) move into the pop-up unchanged.
- **AD-6 All new user-visible strings are admin-managed labels** (web `web.gv.*`, mobile `mob.gv.*`), seeded by one migration with fallbacks in `core/label_fallbacks_web.py` and `src/labels/defaultLabels.ts`. §6 lists them.
- **AD-7 One combined user pop-up (supersedes user-details-menu UM-06/AD-4 interaction).** The person pop-up shows identity (picture, display name, nickname, and response/role badge when the host screen has it) at the top and the server-returned role actions below it, in one sheet — there is no separate "View Details" step or mode. Tap and long-press (mobile) / click (web) open the same sheet. The card fetch, fail-closed rule, confirmation dialogs, 404 handling and action registry of user-details-menu v1.4 are unchanged; only the presentation merges `menu` and `details`.
- **AD-8 Games list scope and view controls.** Scope chips become, in order, **Mine | Public | All** with **Mine the default** when the Games tab is opened directly; Home entry points that pass a scope param keep their passed scope. "All" keeps its existing meaning (Mine + Public). The Active | All toggle moves into the same row as the scope chips, right-aligned, rendered as a compact two-segment switch (SegmentedSwitch on mobile; the web equivalent), with its existing semantics from dashboard AD-21 and closure AD-21 untouched. Applies to both the Games and Tournaments segments.
- **AD-9 Section order on game and tournament detail (organizer view):** Details card → Responses → Invite → (tournament: Fixtures) → Close game/tournament last. The closure panel/notice and Close action move to the end of the page; their behaviour (enable after end time, contents, flow) is unchanged. Non-organizer order: Details → Players (existing) → existing RSVP/respond actions, unchanged except the venue and invite-type rows in the Details card.
- **AD-10 Tournament Registrations tab is removed as a separate tab;** the Fixtures|Registrations toggle becomes a plain Fixtures section. Registration data is not lost: registered people appear in the Responses block's "Registered" group (with team name where the registration is a team), and the registration-dependent logic (own-registration lookup, closure candidates) keeps using the same API data. Web equivalent: registrations listing folds into Responses the same way.

## 3. Approved deltas (complete list — nothing else changes)

### GV-1 Games list (mobile GamesScreen; web games page)
- Scope chips reordered **Mine, Public, All**; default **mine** (AD-8). Labels stay admin-managed (`mob.games.scope_*`; "Open" already relabelled "Public").
- Active | All toggle moves into the scope-chip row, right-aligned, as a two-segment switch. No other change to the row, chips, sport filter, cards, sorting or data sources.

### GV-2 Details card: venue row (game + tournament detail, web + mobile)
- The boxed VenueDetailCard in the details card is replaced by a plain row: pin icon, venue name (link-styled), chevron. Tap/click opens a bottom sheet (mobile) / modal (web): "Venue" caption, name, full address, map preview (existing map snapshot/pin mechanics where available), the existing venue photos strip and organizer photo actions, **Open in Google Maps** (AD-5) and **Copy address** buttons. No venue data or photo behaviour changes.

### GV-3 Details card: invite-type row (game + tournament detail, web + mobile)
- The group line is replaced by one row: label "Invite type", value `Groups (n) · Players (m)` / `Public` / combinations per data; organizer sees both counts, non-organizer sees groups only (AD-2); public game shows "Public", not tappable.
- Tapping opens the Invited sheet: **Groups** section (name, member count) first, then **People · by response** grouped **Accepted, Declined, Pending** (GV-P1), each person with avatar and source tag (`via <group>`, `individual`, `email`). People rows open the user pop-up (GV-6). Data: groups from the event payload; people from the responses endpoint (organizer) — pending email invites from the invitations endpoint.

### GV-4 Responses block (organizer view, game + tournament, web + mobile)
- Replaces the Players block for the organizer (AD-3). Header "Responses" with **"x of y joined"** right-aligned (going count of capacity; tournament: **"x of y registered"**, registrations count of capacity).
- Groups in order: game **Accepted** (organizer first, Organizer badge; Waitlisted badge on waitlisted), **Declined**, **Pending**; tournament **Registered** (team name tag where applicable), **Accepted, not yet registered**, **Declined**, **Pending** (AD-1, GV-P1). Web `responsesSectionHtml` reorders to match (declined above pending) and gains avatars via the existing `avatarBubbleHtml` user-menu wiring.
- Every person row opens the user pop-up (GV-6). Organizer-remove stays available through the pop-up's existing `remove_player` action; the old inline Remove button on web participants stays as-is for non-replaced views.

### GV-5 Invite section + picker (organizer, game + tournament, web + mobile)
- An "Invite" card below Responses with two entries, **Invite groups** and **Invite players**, replacing the current invite entry buttons in place but reusing the existing forms' logic.
- Both entries open the same picker pattern: search, staged **Selected** chips with −, result rows grouped **Selected / Available / Already in this game** (GV-P1), + stages and − unstages (44px targets), one **Send n invites** button. Groups multi-select behaviour is unchanged; players and emails become multi-select via AD-4. Existing components (GroupInviteList, UserSearchPicker, AddRemoveControl) are extended, not replaced.

### GV-6 Combined user pop-up (web + mobile, everywhere the user menu opens)
- Per AD-7: one sheet with identity on top (incl. nickname and, where the host list knows it, the response/role badge) and role actions below; no "View Details" row or separate details mode. All existing action behaviour, labels and guards unchanged.

### GV-7 Section order + Registrations tab (game + tournament detail)
- Per AD-9 and AD-10. The Close game/tournament card moves to the end; the closure notice text and gating are untouched. Tournament detail drops the Fixtures|Registrations toggle and shows Fixtures as a titled section.

## 4. Non-goals
- No change to decline/accept semantics, closure logic, stats, upcoming window, push actions, access-consistency rules, or any endpoint contract.
- No new backend endpoints, tables or migrations other than the label seed (AD-6).
- No restyle of headers, cards, chips, sport filters, create wizards, dashboards or any screen not named in §3.
- Tournament creation wizard and the app-wide + / − invite-button conversion (lifecycle v1.4 AD-20/AD-19 wizard scope) stay deferred to after the current release; GV-5's + / − applies only inside the new picker.

## 5. Security & privacy
- Invited-individuals and responses data stay behind the existing organizer/committee guards (AD-2, AD-3); nothing widens.
- All new HTML on web goes through `escapeHtml` / the label-escaping pattern of PR #68's fixes; no literal colors — theme tokens only.

## 6. New labels (seeded by gv-backend-web migration; mobile fallbacks mirror)
web.gv / mob.gv: `invite_type` "Invite type", `invite_type_public` "Public", `invited_title` "Invited", `groups_count` "Groups ({count})", `players_count` "Players ({count})", `venue_title` "Venue", `open_in_maps` "Open in Google Maps", `copy_address` "Copy address", `joined_of` "{joined} of {capacity} joined", `registered_of` "{registered} of {capacity} registered", `registered_section` "Registered", `accepted_not_registered` "Accepted, not yet registered", `invite_groups` "Invite groups", `invite_players` "Invite players", `selected` "Selected", `available` "Available", `already_in` "Already in this game", `send_invites` "Send {count} invites", `via_group` "via {group}", `via_individual` "individual", `via_email` "email", `fixtures` "Fixtures".

## 7. Mandated tests (one scoped run per repo; full pytest is the owner's separate session)
- T1 Games list defaults to scope mine; route-param scopes still honoured.
- T2 Responses block renders groups in the §3 order for games and tournaments (incl. tournament Registered split, AD-1).
- T3 Invite-type row: organizer sees both counts; non-organizer sees groups only; public game row inert (AD-2).
- T4 Multi-select player invite loops invite-user/invite-email per staged entry; partial failure reported per entry (AD-4).
- T5 Combined user pop-up shows identity + actions in one sheet; actions remain exactly the server's list (AD-7).
- T6 Venue pop-up builds the Google Maps URL per AD-5 (coords, place_id, fallback).
- T7 Non-organizer game view still shows the Players block unchanged (AD-3).

## 8. Deviations
- **D-1** Supersedes user-details-menu v1.4 UM-06/AD-4 two-step interaction (menu → View Details) with the combined sheet (AD-7). Rationale: owner decision 2026-10-21 — the details are small enough to live in the pop-up itself.
- **D-2** Amends decline-response v1.1 AD-5 display order: Declined renders above Pending (owner decision 2026-10-21); the endpoint payload is unchanged.
- **D-3** Amends dashboard v1.9 AD-21 presentation: the Active|All control sits in the scope-chip row as a segmented switch; semantics unchanged.
- **D-4** Removes the tournament Fixtures|Registrations tab toggle (AD-10), a presentation change to an existing screen, accepted by the owner on the boards ("This is good enough" after the Registrations-tab question).

## 9. Open items
- OI-1 Tournament committee members' view of the Responses block relies on the existing responses-endpoint guard; if committee reads are refused in practice, report, do not widen the guard.
- OI-2 Web board equivalents were approved in mobile form; web implements the same deltas with existing web patterns (modal instead of bottom sheet). Screenshots to be reviewed with the report.

## Review log
| Date | Version | Change |
|---|---|---|
| 2026-10-21 | v1.0 | First version, approved by the owner on the 2026-10-21 boards. |
