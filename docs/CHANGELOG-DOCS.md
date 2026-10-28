# Document amendment history
One section per document. Version and amendment narrative belongs here; document headers keep only Version and Status. Only the architect edits this file.

## DES-MEETUP-MOBILE.md and addenda
Not yet migrated. Amendment narrative still sits in each document's header and review log and moves here in a separate architect edit.

## Amendments by DES-MEETUP-ADDENDUM-decline-response (2026-10-20, owner approved)
- closure-report v1.0 AD-4: decline is a locked game write, responses stay readable. dashboard v1.9 AD-20/21: declined items leave the default Games list and Public scope. invitation-response v1.0 AD-8 (new): decline is also recorded. Wording only on the approved versions; versions not bumped.

## DES-MEETUP-ADDENDUM-team-screens-remarks.md
- v1.0 (2026-10-28): DRAFT written by the architect after the owner's requests of 2026-10-28 (tournament team screens on mobile, optional Remarks on game and tournament creation, venue row). Awaiting owner approval. 19 tracked steps.

## DES-MEETUP-ADDENDUM-tournament-edit-recurring.md
- v1.4 (2026-10-28): series contract live in the backend (meetup PR #164): EventResponse.series, POST /events/{id}/series/leave (returns {left, games_left}), PATCH /events/{id}/series (start_time HH:MM, duration_minutes), POST /events/{id}/series/cancel, codes SERIES_END_INVALID, SERIES_LIMIT_EXCEEDED, SERIES_HAS_PARTICIPANTS, SERIES_ORGANIZER_CANNOT_LEAVE. Full text in this copy.
- v1.3 (2026-10-28): shuffle draw counts corrected (12 entrants in 4 groups: 28 draws at tolerance 0). POST /tournaments/{id}/fixtures/shuffle is live in the backend (meetup PR #162); the response carries shuffle {index, total}. Full text in this copy.
- v1.2 (2026-10-28): architect amendment after the er-bw-tournament report (meetup PR #160). Mobile-relevant: GET /tournaments responses omit registration_hard_block_at and roster_frozen_at (absent, not null) for non-committee viewers and carry is_full, registered_count and registration_open on every route; committee-add accepts team_id; new notification types tournament_updated and tournament_registration_added. Full text in the copy of this file.
- v1.1 (2026-10-27): architect amendment after the er-p1-verify report (meetup PR #158). Mobile-relevant rulings: GET /scoring/state registration_phase reads open/closed for non-privileged viewers (mobile reading checked in step 3.0); hard block and roster_frozen_at absent for non-committee viewers on every route; the addendum is the board of record for the five new screens. Full text: this file's copy and ~/meetup/docs/CHANGELOG-DOCS.md.
- v1.0 (2026-10-27): approved by the owner. Mobile scope: Repeat weekly and series actions, tournament count and Full chip, key dates by `registration_open`, Edit tournament, committee add and remove after the closure, Shuffle again, push routing for `tournament_updated` and `tournament_registration_added`. Full text and amendments: `~/meetup/docs/DES-MEETUP-ADDENDUM-tournament-edit-recurring.md`.

## DES-MEETUP-ADDENDUM-decline-response.md
- v1.0 wording (2026-10-20, owner answers): OI-1 closed (no boards, existing components only), OI-2 and OI-4 confirmed, OI-6 notes the flag is a `platform_config` key editable in admin. No scope change.
- v1.0 (2026-10-20): approved by the owner; no content change from v0.1. Copy of the backend repo's document; the backend copy is the one the owner updates.
- v0.1 (2026-10-20): first draft. Decisions: Accept/Decline on invited, public and joined items; public decline hides the item and tells the organizer; Outlook-style organizer response list; tournament Accepted = invitation reply; no decline notification; push buttons Accept and Decline. Deviations D-1 to D-3.
- v1.1 (2026-10-20): owner decision, option A. New AD-11 (a declined invitee keeps view of the invitation-only game or invite tournament while a current decline record exists) and DR-T14; AD-4 wording; OI-6 corrected (`app_config`, no admin editor, verified true in prod 2026-10-20). Found by `test_dr_t1` in the first full pytest run.

## DES-MEETUP-ADDENDUM-closure-report.md
- v1.0 (2026-10-20): approved by the owner. Copy of the backend repo's document; the backend copy is the one the owner updates. Mobile scope: task cr-mobile, after cr-backend is deployed.

## DES-MEETUP-ADDENDUM-dashboard.md
- v1.9 wording (2026-10-20, owner decision): the "All games" button is a two-segment toggle, Active games | All games; no label flip. No scope change.
- v1.9 (2026-10-20): approved by the owner. Copy of the backend repo's document. AD-20 (Upcoming games), AD-21 (Games screen status filter and chips).

## DES-MEETUP-ADDENDUM-tournament-lifecycle.md
- v1.3 (2026-10-20): approved by the owner. Copy of the backend repo's document. AD-18 (tournament closure report, computed lifecycle status).
- v1.4 (2026-10-20): editorial merge, no decision changes. Copy of the backend repo's document. Creation-wizard amendment (approved 2026-10-19) merged with the closure amendment; wizard ids renumbered AD-18 to AD-20 (AD-19 unchanged), TL-74 to TL-82 to TL-78 to TL-86. Closure ids unchanged (AD-18, TL-74 to TL-77).

## DES-MEETUP-ADDENDUM-invitation-response.md
- v0.1 (2026-10-18): first draft.
- v1.0 (2026-10-18): approved by the owner. Mobile scope: task ia-clients, after ia-backend is deployed and OI-2 (no board for the outcome message) is resolved.

## DES-MEETUP-ADDENDUM-access-consistency.md
- v1.0 (2026-10-18): approved by the owner. Copy of the backend repo's document; the backend copy is the one the owner updates.
- v1.1 (2026-10-18): no CHECK constraints on the new audit table (owner rule: no DB-side validation). Copy of the backend repo's document.
- v1.3 (2026-10-18): group deletion guard and group invitations need membership (backend/web scope; mobile only shows the server's 409 message on delete group). Copy synced from ~/meetup.
- v1.2 (2026-10-18): owner decisions after ac-p1-verify. Copy of the backend repo's document.
- v1.5 (2026-10-18): D-10 test-data exception to the AD-9 membership audit (backend scope; no mobile change). Copy of the backend repo's document.
- v1.6 (2026-10-20): AD-1 gains one narrow view basis for a declined invitee with a current decline record (decline-response AD-11); mandated test 7 updated. The group-leaver and no-record cases still deny.

## DES-MEETUP-ADDENDUM-user-details-menu.md
- v1.0 (2026-10-19): approved by the owner. Reusable user menu (View Details first, role-based actions from per-module card endpoints, one component per platform). Supersedes the PR #39 long-press card (D-1). Phases 3 and 4 gated on a board (OI-6).
- v1.1 (2026-10-19): after ud-p1-verify, tournament actions and the tournament card endpoint removed (owner chose option A; D-3, OI-8); UM-T9 reworded; rate limit via environment setting; user_id added to AvatarPreview; web scope trimmed (OI-10); label texts added; OI-9, OI-10 recorded. Briefs updated.
- v1.2 (2026-10-19): owner decisions on the mobile agent's questions. On mobile, an avatar tap opens View Details and a long-press opens the menu (UM-06 changed, UM-11); owner and organizer lines and tournament registrations get an avatar (UM-12); 22 px home-card avatars are tap only; OI-2 closed; OI-11 and OI-12 added. Backend and web unchanged.
- v1.3 (2026-10-19): owner approved the board (docs/design/user-menu/ and docs/mockups/user-menu/). OI-6 closed; phases 3 and 4 gated on the backend deploy only. Briefs updated to point at the board.
- v1.4 (2026-10-19): UM-12 phased after the mobile OI-11 check; avatars only where data exists today (group owner on GroupDetail, tournament registrations); the other person lines wait for a follow-up backend task. Mobile brief updated.


## DES-MEETUP-ADDENDUM-push-actions.md
- v1.0 (2026-10-18): approved by the owner. Copy of the backend repo's document. Action buttons on push for game invite, tournament invite and group addition. Gate: pa-spike (OI-1) before any client build. Task pa-clients-mobile.

## DES-MEETUP-ADDENDUM-game-view-redesign.md
- v1.0 (2026-10-21): first version, approved by the owner (boards of 2026-10-21). GV-1..GV-7, AD-1..AD-10, D-1 (supersedes user-details-menu v1.4 UM-06 two-step pop-up), D-2 (decline-response AD-5 display order: Declined above Pending), D-3 (dashboard AD-21 toggle placement), D-4 (tournament Registrations tab folded into Responses). Additive-only rule in §1/§4. Mobile task gv-mobile.
