# DES-MEETUP-ADDENDUM-TOURNAMENT-REGISTRATION

**Doc ID:** DES-MEETUP-ADDENDUM-TOURNAMENT-REGISTRATION
**Version:** v1.3
**Status:** **APPROVED by the owner, 2026-10-25** (instruction in conversation: "write design addendum, mark it approved & upload to gh", given after elicitation of the same day). Approval covers section 1 (requirements, restated from the owner's words) and the assumptions marked **[A]** in section 3. Open items are in section 12.
**v1.1 amendment (AD-10, TR-17):** approved by the owner 2026-10-25 (instruction "give me instructions", after the gap and the proposed fix were put to the owner). Assumption **[A-10]** (a group added later pushes to its new members only) was the stated default and was not contradicted.
**Owner:** Pratheesh
**Date:** 2026-10-25
**Scale Tier:** T1
**Baseline:** repo `pratheeshku/meetup` `main` @ `3ccb67f` and `pratheeshku/meetup-mobile` `main` @ `071ca51` (code read 2026-10-25). Design-only addendum. It does not edit other documents; section 9 lists what it supersedes and each of those gets a one-line pointer at its next revision.
**Governing files:** `Enterprise_Design_Principles.md` v1.1 (P1-P17) and `design-best-practices.md` v1.0 (BP-01-BP-13). Both read in full before drafting. Neither is deviated from (section 10).
**Depends on:** `DES-MEETUP-ADDENDUM-tournament-lifecycle` v1.4, `-decline-response` v1.1, `-push-actions` v1.0, `-game-view-redesign` v1.2, `-tournament-experience` v1.0, `-access-consistency`.
**Process notes (flagged):**
1. No `REQ-MEETUP` addendum exists for this batch. The owner's 8 items and answers are restated as `TR-01..TR-16` in section 1.
2. Items #1 and #3 are defects whose root cause is **not yet proven**. Section 3 gives the evidence found in the code and a Phase 1 reproduction gate (`tr-p1-repro`). No fix is written from a guess.

---

## Plain-language summary

- **Registering** works for the organizer and committee like anyone else, and when it fails the person is told why (not "please try again").
- **Pending** people on a tournament (invited or in an invited group, no answer yet) are listed for the organizer and committee only.
- **Tournament invitation notifications** carry **Register** and **Decline**. Games keep **Accept** and **Decline**. Public games show only **Register**. Public tournaments have no Pending or Decline.
- **Registration fee** (tournaments only): the organizer can set one. Players see it before registering and confirm it. No fee reads "Free registration". The app does not take payment. After registering, a pop-up says it worked or why it failed.
- **Media tab** is open from the day the tournament is created. The organizer and committee upload; anyone who can see the tournament can view.
- **Tournament list rows** show the venue (with full address) and the invite type, each opening the existing pop-ups.
- **Book a court** buttons are all the app's blue and white. **X** on a tournament closes it and returns to the full list.

---

## 1. Requirements baseline (owner, 2026-10-25; approved with this document)

| ID | Requirement |
|---|---|
| TR-01 | On a tournament open to chosen groups, members of those groups who have not answered show as **Pending**. |
| TR-02 | The Pending and Declined lists are visible to the organizer and committee members only. |
| TR-03 | A public tournament has no Pending or Decline state. |
| TR-04 | A public game shows only a **Register** call to action, never Decline. |
| TR-05 | The individual tournament view has an **X** that returns to the full list. |
| TR-06 | The organizer and committee members can register and play in their own tournament; today the organizer gets "Could not register to the tournament". |
| TR-07 | A tournament invitation notification (including one sent because a group was invited) carries **Register** and **Decline**. Game invitations keep **Accept** and **Decline**. |
| TR-08 | Each tournament row shows the venue with its full address and the invitation type, each on its own line with a small icon. A group invite shows the group name; tapping it opens the existing group pop-up. Venue and people reuse the existing pop-ups. |
| TR-09 | Every Book button in Book a court uses the app's call-to-action blue and white. The Book a court block is one reusable component, used on the Home dashboard. |
| TR-10 | The Media tab is enabled from day one so photos can be uploaded from the start. |
| TR-11 | The organizer and committee members can upload to Media. |
| TR-12 | A tournament can carry a registration fee. Tournaments only, not games. |
| TR-13 | At registration the player sees a confirmation of the fee applicable. No fee shows **Free registration**. |
| TR-14 | After registering, a pop-up shows registration successful or failed. |
| TR-15 | The app does not collect payment. The fee applicable to each registration must be known. |
| TR-16 | An X on the tournament view returns to the full list (TR-05) on web and mobile. |
| TR-17 | Members of a group a tournament is open to receive the same invitation push as a directly invited person, with **Register** and **Decline** (TR-04, owner item 4). |

---

## 2. Scope and constraints

**In scope:** backend `~/meetup` (`tournaments`, `events` read paths, `notifications`, `home`); web; mobile (Android and iOS); one additive migration; label keys; admin config keys.

**Out of scope (v1):** collecting or reconciling payment; refunds; paid/unpaid tracking; fee on games; discounts or per-category fees; changing the Games invitation behaviour; web PWA push buttons.

**Constraints:** migrations are written, never run by agents; additive only (P14); no RLS, no DB triggers; authorisation in `policies.py` at the entry point (P15); zero sibling imports (`tournaments` does not import `events`, `groups`, `notifications`); mobile and web/backend briefs are separate, one per repo; all new text through `ui_labels` (P1).

---

## 3. Architecture decisions

**AD-1: Registration defect, organizer cannot register (TR-06).** Evidence from the code, not yet reproduced:
- **E1.** Mobile `registerForTournament` posts with no body (`src/api/tournaments.ts:237`). Both server paths require `user_id` for individual mode and answer 400 "user_id is required for individual mode" (`tournaments/service.py:260`, `registration_v2.py:207`). If the web client sends `user_id` and mobile does not, mobile individual registration fails for everyone, not only the organizer.
- **E2.** Version-2 individual registration requires a sport skill level (`_require_skill_score`, 409). An organizer who never set a skill level for the sport is refused.
- **E3.** The screen maps every error except "ended" to one string, `mob.tournament.register_error` (`TournamentDetailScreen.tsx:436`). The server reason is never shown, which is why the failure reads as "try again".
- **E4.** Phase gates (`SELF_REGISTRATION_CLOSED`, `REGISTRATION_DATES_NOT_SET`) also return 409.

Decision: (a) `tr-p1-repro` reproduces the organizer failure on the deployed build and records which of E1-E4 fires, before any fix. (b) Whatever the cause, the fixes below are in scope regardless: for individual mode an omitted `user_id` means the caller (additive; a supplied `user_id` must still equal the caller); the registration route returns a stable `code` with every refusal (`REGISTRATION_CLOSED`, `SKILL_LEVEL_REQUIRED`, `ALREADY_REGISTERED`, `TOURNAMENT_FULL`, `INVITATION_REQUIRED`, `TEAM_REQUIRED`, `FEE_CHANGED`, `FEE_ACK_REQUIRED`); the clients show one label per code and never the raw detail. `SKILL_LEVEL_REQUIRED` offers a link to the skill-level screen. (c) No exemption is added for organizer or committee from skill or capacity (owner: they play like anyone).

**AD-2: Pending list (TR-01, TR-02, TR-03).** Finding: `tournament_responses` builds Pending only from `tournament_invitations` rows (`tournaments/decline_service.py:188`). A tournament open to chosen groups stores those groups as audience groups (`service._insert_audience_groups`, `service.py:1007`) and creates no invitation rows, so its group members never appear.
- Pending for such a tournament is **derived, never stored** (BP-09): members of the audience groups, minus anyone registered, with a current decline, or with an accepted invitation, plus the existing pending invitation rows. A person appears in exactly one section (existing precedence: Declined, Accepted, Pending).
- Live membership: someone added to the group after creation becomes Pending; someone who left the group stops being Pending.
- One batched query, capped at `SECTION_CAP` (200) with the true total (P7). The audience-groups table name is re-verified in Phase 1 (BP-01, OI-2).
- **Visibility (TR-02):** the Pending section is returned only for the organizer and active committee (`can_read_tournament_responses`, the Declined guard). For any other viewer the `pending` key is **absent** from the JSON (v1.1 wording: the route omits null fields, exactly as `declined` is today). Clients hide a missing or null section. Supersedes game-view-redesign v1.1/v1.2 for tournament Pending (D-2).
- **Public tournament (TR-03):** no Pending and no Declined section is returned or shown.

**AD-3: Invitation actions (TR-04, TR-07).**

| Item | Buttons (in app and in push) |
|---|---|
| Game invitation | Accept, Decline (unchanged) |
| Tournament invitation (direct or via a group) | **Register**, Decline |
| Public game | **Register** only. No Decline, so nothing is hidden or recorded. |
| Public tournament | **Register** only. |
| Joined or registered item | Existing withdraw. Unchanged. |

- **Register on an invitation** registers and accepts in one transaction: a caller with a pending invitation who registers has that invitation set to `accepted` by `POST /tournaments/{id}/registrations`. No new endpoint (push-actions PA-11 holds) and no two-call race from a headless handler. This amends decline-response DR-07 (D-6): Accepted is now implied by registering; a person can still Decline or later withdraw.
- **Push, fee and the confirmation (TR-13):** a one-tap push cannot show a fee. The server therefore sets `register_mode` in the push data: `direct` only when the tournament is free, individual mode and the token supports it; otherwise `open_app`, which opens the registration confirmation (AD-5). iOS cannot vary an action per notification, so the server selects the category: `invite_tournament_register` (direct) or `invite_tournament_confirm` (opens the app). Android reads `register_mode` from the data-only message.
- **Capability gate (push-actions AD-3 pattern):** tokens carry `push_actions_version`. Version 2 apps know the new categories and `register_mode`; version 1 apps keep Accept and Decline, which stay valid because respond remains. Flag off or version 1 changes nothing.
- **Result messages** (labels): registered; registered, free; "Open the app to confirm the fee"; refusal by `code` (AD-1); "Already registered".
- **Notification history:** `action_state` for `tournament_invited` gains `registered` (precedence over `accepted`); the old values stay.
- **Public items:** the Decline option on a public game or tournament that was not joined is removed (D-3). Existing `via=public` decline rows stay in force and are cleared by Register, as today (OI-9).

**AD-4: Registration fee (TR-12, TR-13, TR-15).**
- **Data.** `tournaments.registration_fee_cents INTEGER NULL` (NULL or 0 means free; no CHECK, no DB validation). `tournament_registrations.fee_cents_at_registration INTEGER NULL`: the fee the player confirmed, written once at registration (P6). Currency is one value, config key `meetup.tournament.fee.currency` (default `SGD`). Validation server-side in the application (P9): whole cents, `0 <= fee <= meetup.tournament.fee.max_cents` (default 100000, set in admin, P1).
- **Basis [A].** The fee is per entry: per player in individual mode, per team in team mode. The label states which.
- **Set and edit.** Optional field in the create wizard registration step (the boards `WebCreateReg2` and `WebCreateReg2Err`; OI-10) and on tournament edit by the organizer, until registration closes (the soft block). A change when registrations exist shows the organizer a warning and is logged. Registrations already made keep their snapshot.
- **Kill switch.** `meetup.tournament.fee.enabled` (admin, default false). The fee control is hidden and any stored fee is ignored while it is false. It is switched on only after the app release is live (old apps cannot send the acknowledgement, AD-5). **Client config (v1.0 wording, 2026-10-25):** clients learn the switch from `GET /config/client`, which gains three additive fields beside `venue_catalogue_enabled`: `tournament_fee_enabled` (boolean), `tournament_fee_currency` (string) and `tournament_fee_max_cents` (integer). Clients hide the fee control when `tournament_fee_enabled` is false; the tournament payload carries a null fee while the flag is off.
- **Display.** `GET /tournaments` and `GET /tournaments/{id}` return `registration_fee_cents` and `registration_fee_currency` (additive). Clients format the amount and show "Registration fee: S$x per player" or "Free registration" on the tournament view, the registration confirmation and the result pop-up. The organizer and committee, and the registrant for their own row, see `fee_cents_at_registration` on the registrations list. Nobody else does.
- **Wording [A].** Because the app takes no payment, the confirmation says the fee is applicable and is arranged with the organizer outside the app. It never says "pay now", promises a refund, or shows a payment button.

**AD-5: Registration confirmation and result pop-up (TR-13, TR-14).**
- Every in-app **Register** opens one reusable confirmation sheet: tournament name, mode, fee or "Free registration", **Confirm** and **Cancel**. Confirm sends `POST /tournaments/{id}/registrations` with `accepted_fee_cents`.
- **Server check (P9).** If the fee is greater than 0 the field is required and must equal the current fee, else 409 `FEE_ACK_REQUIRED` or `FEE_CHANGED` (the response carries the current fee and the client re-shows the sheet). If the tournament is free the field is optional, so old apps still register for free tournaments (P14).
- **Result pop-up** (success or failure, one component, TR-14): success shows "You're registered" with the fee line; failure shows the label for the `code` (AD-1) with Retry where a retry can work. It replaces the inline `register_error` text.
- Web and mobile use the same component names and labels (`web.reg.*`, `mob.reg.*`).

**AD-6: Media (TR-10, TR-11).** Amends tournament-experience AD-T10, TE-15 gating and D-T2 (D-4).
- The Media tab is `open` from creation for everyone who can view the tournament (not from `starts_at`). It is read-only on a cancelled tournament. The `tabs.media` state in `scoring/state` no longer returns `locked` or an `unlocks` code.
- **Upload:** the organizer and active committee members only (a policy in `tournaments/policies.py`, shift-left at the route, P15). Registered participants do not upload.
- **Remove:** the uploader or any active committee member. **View:** anyone who can view the tournament.
- Unchanged: photo rules, video flag (default off), the 60-item cap, `tournament_media` schema, account deletion keeps media (uploader set null).
- Because only the organizer and committee upload, this adds no user-generated content from strangers; the existing app report control still applies to everything people can see.

**AD-7: Tournament list rows (TR-08).**
- Each row gets two lines with small icons from the existing icon set: **Venue** (pin icon, venue name and full address; tap opens the existing venue pop-up of game-view-redesign GV-2) and **Invite type** (icon, then `Public`, the group name(s), or `Invite only`).
- A group name is tappable and opens the existing group pop-up: name and member count, as the Invited sheet's Groups section (game-view-redesign GV-3, AD-2). A person who is not in the group sees name and count only. Several groups show the first name and "+n"; tapping lists all.
- **No per-row requests (P7).** The row uses fields in the list payload: `venue_name`, `venue_address`, coordinates and place id for the venue pop-up (additive if absent), and `group_names` with `group_ids`. The group pop-up fetches on tap only. Phase 1 confirms what `GET /tournaments` already returns (OI-3).
- People shown on a row open the existing user pop-up unchanged (AD-7 of game-view-redesign).

**AD-8: Book a court buttons (TR-09).** `CourtBookingBlock` cycles the button colour per row between blue, green and orange (`CourtBookingBlock.tsx:25-29`). All Book buttons use the call-to-action blue (`colors.ctaBlue`) with white text on mobile, and the equivalent token on web. The block is already one component shared by Home and the tournament Overview on mobile (verified: `HomeScreen.tsx`, `TournamentOverview.tsx`); the colour lives in one place. Web is checked in Phase 1 and made a single shared component if the Home block is not already (OI-4). The logo fallback tiles keep their colours; only the buttons change.

**AD-9: Close the tournament view (TR-05, TR-16).** The individual tournament view has an **X** in the header on web and mobile. It returns to the list the person came from with scope (Mine, Public, All), Active or All and sport filter kept. Scroll position is kept on web. On mobile it is NOT kept (v1.2 wording): access-consistency AC-10 requires the list to refetch on every open and never render cached rows, which is an access-safety rule and wins over scroll position. With no list behind it (opened from a push, a share link or a deep link) it goes to the Tournaments list at its defaults. The X does not replace the system back gesture.

**AD-10: Group-audience invitation push (TR-17).** Finding (architect review of `tr-backend-web` Stage A, 2026-10-25): the `tournament_invited` push is enqueued only for a person with an invitation row (`invitations.py` -> `notify_invited`). A tournament open to chosen groups stores audience groups and creates no invitation rows, so group members never received any push, and AD-3's buttons reached no one. This is a gap in v1.0, not an implementation defect.
- **Recipients:** the live members of an audience group, minus the organizer, minus anyone who already has an invitation row for the tournament (any status), minus anyone registered or with a current decline. Computed at enqueue time (v1.1 wording: the recipient ids are stored in the outbox row, so the list is fixed when the row is written).
- **When:** a lifecycle v2 tournament has no draft or publish step: `create_tournament_wizard` inserts it as `registration_open` and writes the audience groups in the same transaction, so the push is enqueued there (same transaction). Later, and, **[A-10]**, when an organizer adds a group through `_replace_audience_groups` (the PATCH that changes `group_ids`), only the members of the newly added groups (new set minus old set) are notified. Removing a group sends nothing. A cancelled, closed or otherwise terminal tournament sends nothing.
- **Message and buttons:** the existing `tournament_invited` type, label and URL, with the AD-3 buttons and `register_mode` rules unchanged. Notification preferences and quiet hours apply as they do today.
- **Idempotency and chunking (v1.1 wording, decided after the `tr-group-push` Blocked Report):** the outbox row carries its recipients in `snapshotted_user_ids`, capped at 3072 bytes (about 63 ids). Recipients are therefore written in **chunks of at most 50 ids**, sorted by user id so a replay produces the same chunks, one `push_fanout` row per chunk, in the same transaction as the create or the group edit. Idempotency key `tournament_invited_group:{tournament_id.hex}:{group_id.hex}:{chunk_index}` (UUIDs as 32 hex digits: the dashed form is 99 characters at a one-digit index and 100 at two, and `job_outbox.idempotency_key` is VARCHAR(100)). No migration. A person in two groups, or already pushed through an invitation row, is notified once (the recipient list is de-duplicated and the invitation-row exclusion above applies). No migration.
- **Scale:** the fan-out reuses the existing outbox and worker. No group size cap exists today; none is added here. The enqueue logs the recipient count per event (counts only, no ids). Gate to revisit: if any event enqueues more than 20 chunks (1,000 recipients), the owner decides on a group size cap or a send-time lookup (which needs a migration) before more is built.
- **Action state (v1.3, found after the Stage A deploy):** `resolve_tournament_invited_action_states` (`tournaments/service.py`) reads only `tournament_invitations`, so a group member with no invitation row resolved to `unavailable`, and the group push showed no actionable state in the notification history. Rule: for a viewer who is a live member of an audience group of the tournament, has no invitation row, is not registered and has no current decline, the state is `pending`, or `closed` when the tournament is not `registration_open`. `registered` and `declined` win as today; an invitation row, when present, decides as today. One batched query for the page, raw SQL, no sibling import. New test TR-T13.
- **Privacy:** no new personal data. Group members already see the tournament (view rule).

---

## 4. Component and integration design

| Component | Change |
|---|---|
| `tournaments/service.py`, `registration_v2.py`, `router.py` | Omitted `user_id` means caller; stable `code`; fee ack check; accept-and-register in one transaction; fee fields on create, edit, read |
| `tournaments/decline_service.py` | Derived Pending for audience groups; `pending` absent for non-privileged; none for public |
| `tournaments/policies.py`, `media_router.py`, `tabs.py` | Upload policy (organizer, committee); media tab always open |
| `notifications/` | `register_mode`, category selection, `push_actions_version` 2, `action_state` `registered` |
| `home/` | Config keys via admin; no schema change |
| Migration (one) | `tournaments.registration_fee_cents`, `tournament_registrations.fee_cents_at_registration`, label seeds, config key seeds |
| Web | List rows, X, confirmation and result pop-ups, fee field, Book button token, pending visibility |
| Mobile | Same, plus push categories and handler for Register and Decline |

**Failure behaviour:** a failed fee read shows the registration screen without the fee line and blocks Confirm (never confirms an unknown fee); a failed Pending derivation returns the invitation-based Pending only and logs; the push handler makes one attempt and shows the result message.

---

## 5. Data and contracts

| Field | Single source | If it comes from elsewhere, it is a bug |
|---|---|---|
| Fee applicable | `tournaments.registration_fee_cents` (while the flag is on) | a client constant or label |
| Fee confirmed by a player | `tournament_registrations.fee_cents_at_registration` | recomputing from the current fee |
| Pending for a group tournament | audience groups and `group_memberships`, derived | a stored list |
| Whether a push registers directly | server `register_mode` | a client guess |

Contract additions (all additive): `registration_fee_cents`, `registration_fee_currency` on the tournament; `tournament_fee_enabled`, `tournament_fee_currency`, `tournament_fee_max_cents` on `GET /config/client`; `accepted_fee_cents` on the registration request; `code` on registration errors; `pending` may be absent; `register_mode` in push data; `action_state` `registered`.

---

## 6. Security and compliance

| Resource | Allowed | Denied |
|---|---|---|
| Pending and Declined sections | organizer, active committee | everyone else: key absent |
| Media upload | organizer, active committee | participants and viewers: 403 |
| Media remove | uploader, active committee | others |
| Fee confirmation | the registrant for their own registration | forged or missing ack: 409 |
| Register from push | the existing registration rule | same denials as an in-app call |

- A forged push action reaches the same checks as a client call (push-actions AD-10).
- No card or payment data exists in the system. A fee shown for a real-world sporting event arranged outside the app is a display of information; the app-store position is confirmed at submission (OI-5).
- Pending exposes group member names only to the organizer and committee for their own tournament; no new personal data category (PDPA).

---

## 7. Observability and operability

- Correlation id from the app through the registration route (existing).
- Metrics (no personal data): `tournament_register_total{source=app|push, outcome=<code>}`, `tournament_fee_set_total`, `push_register_mode_total{mode}`.
- Alert on a sustained rise in `outcome=SKILL_LEVEL_REQUIRED` or an unclassified error (indicates a regression of AD-1), not on each error.
- Kill switches (admin interface, P1): `meetup.tournament.fee.enabled`; the push gate flag of push-actions AD-9. Runbook entry: switch on the fee only after the app release is live.

---

## 8. Test requirements

Risk: registration and fee **High**; Pending visibility **High** (disclosure); media policy **Medium**; layout **Low**. API-level negative tests with the database backstop absent (P13).

| # | Test |
|---|---|
| TR-T1 | Organizer registers in their own individual tournament with a skill level: 200, one registration. Without a skill level: 409 `SKILL_LEVEL_REQUIRED`. |
| TR-T2 | Individual self-registration with no `user_id` registers the caller; a different `user_id` is 403. |
| TR-T3 | Each refusal returns its stable `code`. |
| TR-T4 | Group tournament: members of the audience groups with no answer appear in `pending`; registered, declined and accepted people appear once in their own section; a member added later appears; a member who left does not. |
| TR-T5 | `pending` is absent (or null) for a participant and a stranger; present for organizer and committee. A public tournament returns no Pending or Declined. |
| TR-T6 | Fee greater than 0: registration without `accepted_fee_cents` is 409 `FEE_ACK_REQUIRED`; with a stale value 409 `FEE_CHANGED` carrying the current fee; with the right value 200 and `fee_cents_at_registration` set. |
| TR-T7 | Fee null or 0: registration with or without the field succeeds. Flag off: stored fee ignored, no ack needed. |
| TR-T8 | Fee over `max_cents`, negative or fractional: 422. Edit after registration closes: refused. |
| TR-T9 | Registering with a pending invitation sets it `accepted` in the same transaction; failure leaves both unchanged. |
| TR-T10 | Push: free individual tournament, supported token: `register_mode=direct`, category `invite_tournament_register`; fee greater than 0 or team mode: `open_app`, category `invite_tournament_confirm`; version 1 token: unchanged Accept and Decline. |
| TR-T11 | Media: participant upload 403; organizer and committee upload 200; tab is open before `starts_at`; read-only when cancelled; remove by uploader and committee only. |
| TR-T13 | A group member with no invitation row: the history row of the group push reads `pending` (or `closed` once registration is not open), `registered` after registering, `declined` after declining; a non-member of the group reads `unavailable`. |
| TR-T12 | `fee_cents_at_registration` is visible to the registrant and organizer or committee and to no one else. |

Mobile and web: confirmation sheet and result pop-up for each `code`, X returns with filters and scroll kept, list rows (venue pop-up, group pop-up, "+n"), all Book buttons the same colour, label checks, Register and Decline push actions on a physical Android phone and iPhone.

---

## 9. Supersedes and amends (D-1 to D-7 in section 10)

| Document | Change |
|---|---|
| push-actions v1.0 AD-1; decline-response D-1 | Tournament invitation buttons are Register and Decline (was Accept and Decline) |
| game-view-redesign v1.1/v1.2 | Tournament Pending is organizer and committee only (was any viewer) |
| decline-response DR-01, DR-03 | No Decline on public games or public tournaments not joined |
| decline-response DR-07 | Registering also accepts the invitation |
| tournament-experience AD-T10, TE-15, D-T2, tabs table | Media open from creation; organizer and committee upload; participants do not |
| tournament-experience AD-T2 | All Book buttons the call-to-action colour |

---

## 10. Deviations and principle compliance

**No deviation from `Enterprise_Design_Principles.md` or `design-best-practices.md`.** Deliberate changes to earlier approved addenda, all by owner decision on 2026-10-25:

| # | Change | Rationale |
|---|---|---|
| D-1 | Tournament push buttons Register and Decline | Owner requirement TR-07 |
| D-2 | Pending narrowed to organizer and committee | Owner requirement TR-02; names of people who have not answered are not for every viewer |
| D-3 | No Decline on public items | Owner requirement TR-03, TR-04 |
| D-4 | Media open from day one, uploaders organizer and committee | Owner requirements TR-10, TR-11; D-T2 was an unconfirmed assumption |
| D-5 | Fee displayed, not collected | Owner requirement TR-15; keeps payment regulation out of T1 |
| D-6 | Registering accepts the invitation | One atomic call; avoids a two-step race in a headless push handler |
| D-7 | Server selects the push category by `register_mode` | iOS actions cannot vary per notification |
| D-8 | Mobile X does not keep scroll | AC-10 (access-consistency) forbids rendering cached rows; the list refetches and unmounts. Safety rule wins over a convenience (TR-16 asks only to return to the list) |

| Principle | Element | Status |
|---|---|---|
| P1 | Fee flag, currency and cap in admin config | Met |
| P4 | Metrics and correlation id, no personal data | Met |
| P5 | Register idempotent (409 already registered); fee ack replays safely | Met |
| P6 | Fee snapshot per registration | Met |
| P7 | Batched Pending, no per-row requests, capped sections | Met |
| P9 | Server validates fee, ack, `user_id` | Met |
| P13 | Negative tests TR-T5, TR-T6, TR-T11 | Met |
| P14 | Additive fields and columns; old apps keep working; flag gates the fee | Met |
| P15 | Rules declared at the route; Pending guard in the application query | Met |
| P2, P3, P8, P10-P12, P16, P17 | No change (rate limit on the registration route is checked, OI-7) | Unchanged |
| BP-01 | Names checked against code with file and line; remaining items in OI-2, OI-3 | Met, Phase 1 re-verifies |
| BP-03 | Requirement coverage in section 11 | Met |
| BP-09 | Section 5 lineage | Met |
| BP-10 | Deferred decisions below carry measurable gates | Met |
| BP-12 | One migration, one flag, one derived query; no queue or service | Met |
| BP-13 | Decisions written back here before the session ends | Met |

**Deferred decisions (BP-10; the numbers are architect proposals the owner can change)**

| Deferred | Gate |
|---|---|
| In-app payment collection | More than 10 tournaments with a fee in 30 days, or an organizer reports a fee dispute more than 3 times |
| Paid/unpaid tracking per registration | Same gate |
| Fee on games | Owner request |
| Notification on a fee change after registrations | A fee changed on a tournament with registrations more than 5 times in 30 days |

---

## 11. Coverage and phases

| Requirement | Section |
|---|---|
| TR-01, TR-02, TR-03 | AD-2 |
| TR-04, TR-07 | AD-3 |
| TR-05, TR-16 | AD-9 |
| TR-06 | AD-1 |
| TR-08 | AD-7 |
| TR-09 | AD-8 |
| TR-10, TR-11 | AD-6 |
| TR-12, TR-15 | AD-4 |
| TR-13, TR-14 | AD-4, AD-5 |

| Task | Content | Starts after |
|---|---|---|
| `tr-p1-repro` | Reproduce the organizer failure (E1-E4), confirm audience-group table, list payload fields, web Home block; a report only, no code | nothing |
| `tr-backend-web` | AD-1 server and web, AD-2, AD-4, AD-5, AD-6, AD-7, AD-8, AD-9 on web; one migration (human runs it, `alembic upgrade +1`) | `tr-p1-repro` |
| `tr-mobile` | Same on mobile plus AD-3 push handler | `tr-backend-web` deployed |
| `tr-group-push` | AD-10 backend only; no migration; no client change (the clients already handle the buttons) | `tr-backend-web` merged (PR #148) |
| `tr-enable` | Owner switches `meetup.tournament.fee.enabled` on in the admin console | app release live |

Two separate briefs (one per repo), in chat only, not committed. Each phase ends with an implementation report written back here.

---

## 12. Open items

| ID | Item | Severity | Status |
|---|---|---|---|
| OI-1 | Root cause of the organizer registration failure (E1-E4) | 🔴 CRITICAL | E1-E4 could not be reproduced against the deployed build. E1 (omitted `user_id`) and E2/E3 (stable codes, mapped messages) are fixed in code by `tr-backend-web`; closes only when tester test TR-T1 passes and the owner registers as organizer after deploy |
| OI-2 | Re-verify the audience-groups table and columns before the Pending query | 🟡 MEDIUM | Closed: names checked against the models in the architect review; first execution is the tester's |
| OI-3 | What `GET /tournaments` already returns for venue address, coordinates and group names | 🟡 MEDIUM | Open; Phase 1 |
| OI-4 | Web Home Book a court block: one shared component or a copy | 🟡 MEDIUM | Open; Phase 1 |
| OI-5 | App-store position on showing a fee for an event arranged outside the app, checked at submission | 🟠 HIGH | Open; before `tr-enable` |
| OI-6 | Fee editable until registration closes even with registrations made; players keep their snapshot | 🟢 LOW | Assumption **[A]**, approved with this document |
| OI-7 | Rate limit on `POST /tournaments/{id}/registrations` | 🟡 MEDIUM | Closed: 30 per minute per user, in `tr-backend-web` |
| OI-8 | The push-actions client build (`pa-clients-mobile`) must be shipped before the Register category | 🟠 HIGH | Open; sequencing |
| OI-9 | Existing `via=public` decline rows keep hiding items until the user registers | 🟢 LOW | Accepted |
| OI-10 | Where the fee field sits in the mobile wizard (the web boards place it in the registration step) | 🟢 LOW | Open; follow the web placement |
| OI-11 | Public game call to action reads "Register" (owner's word); admin can edit the label | 🟢 LOW | Accepted |
| OI-12 | The X on a game view for parity with tournaments | 🟢 LOW | Not requested; owner to decide |
| OI-13 | On a lifecycle v1 tournament the registration route lets a viewer register another `user_id`; v2 refuses with 403. Existed before this change | 🟡 MEDIUM | Deferred, own task. Gate: before any new v1 tournament is created, or at the next security review, whichever is first |
| OI-14 | A group added after registration has closed still pushes its members (AD-10 excludes terminal states only) | 🟢 LOW | Accepted |
| OI-15 | The admin console must render the new `string` setting type (fee currency) | 🟡 MEDIUM | Assigned to `tr-backend-web` Stage B (admin client check) |
| OI-16 | Group-audience push has no live in-app nudge (AD-10 specifies the outbox push only) | 🟢 LOW | Accepted |
| OI-18 | Mobile X does not keep scroll position (AD-9 vs AC-10) | 🟢 LOW | Accepted (D-8). Gate: reopen if the owner finds it a problem; fix would be a refetch-in-place design that never shows another user's or revoked rows |
| OI-19 | Mobile team-mode registration: no team picker; the app sends no `team_id`, a team tournament ends in `TEAM_REQUIRED` | 🟠 HIGH | Existing limitation, now visible. Own task before team tournaments are offered on mobile |
| OI-20 | Mobile has no tournament edit screen: the fee can be set only at creation (web edits it) | 🟢 LOW | Accepted |
| OI-21 | Eight mobile label keys exist only in the app fallbacks (`mob.reg.mode_individual`, `mode_team`, `fee_unknown`, `mob.notif_action_state.registered`, four `mob.tw.fee_*`); the server label `mob.tournament.media.who_note` is now untrue | 🟡 MEDIUM | Owner edits `who_note` in the admin console now; the eight keys are seeded in the next label migration (own task) |
| OI-22 | Two tests fail identically on main before this change: `test_fixup_registered_branch_team_roster_v2` (404 instead of 200) and `test_fixup_registered_branch_is_in_the_one_view_rule_v2_only_and_aliased` (pins SQL text the view rule no longer produces) | 🟡 MEDIUM | Not caused by this work; own diagnosis task |
| OI-23 | `AGENTS.md` in both repos names `~/meetup`; on the Mac the backend is `~/Developer/meetup` | 🟢 LOW | Owner edits `AGENTS.md` (project instructions) |
| OI-17 | Committee-added registrations carry no fee snapshot (the committee cannot acknowledge for someone else) | 🟢 LOW | Accepted |

---

## 13. Risks and mitigations

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | The failure is something other than E1-E4 | `tr-p1-repro` gates the fix |
| R-2 | An organizer sets a fee before the app release | Flag off until `tr-enable` |
| R-3 | A player thinks the fee was charged | Wording in AD-4; no payment control anywhere |
| R-4 | Derived Pending is slow for very large groups | Single batched query, capped sections |
| R-5 | Old apps and the new push categories | Capability gate by `push_actions_version` |

---

## 14. Review log

| Version | Date | Note |
|---|---|---|
| v1.3 | 2026-10-25 | Owner asked whether the backend missed anything after the Stage A deploy. Found: AD-10 left `action_state` unresolved for group members without an invitation row (`unavailable`). Added to AD-10 and TR-T13. Task `tr-group-push-2`. Architect miss: the second time AD-10 was specified without tracing the delivered artifact end to end (the notification history state). |
| v1.2 | 2026-10-25 | Architect review of `tr-mobile` and the backend test run. AD-9 mobile scroll relaxed (AC-10 wins; deviation D-8). OI-18 to OI-23 recorded. Atomic UPDATE in `accept_pending_on_register` accepted (the module forbids row locks). `test_38` change accepted: AD-3 reverses "pending only is 403". Mobile gaps found: in-app invitation banner (AD-3), fee line on the tournament view (AD-4 Display), organizer on the legacy v1 page (TR-06) go to a fix-up task `tr-mobile-2`; the `tr-mobile` M list omitted them (architect brief gap). |
| v1.1 wording | 2026-10-25 | After the AD-10 review: `pending` absent (not null) for non-privileged viewers to match the built route; idempotency key written with 32-hex UUIDs (VARCHAR(100) limit); OI-1, OI-2, OI-7 statuses updated; OI-13 to OI-17 recorded. |
| v1.1 wording | 2026-10-25 | AD-10 corrected after the `tr-group-push` Blocked Report (valid finding): recipients are fixed at enqueue time, not send time; the transition is creation and the group-edit PATCH; chunks of 50 ids per outbox row (about 63 fit in 3072 bytes) with the chunk index in the idempotency key; send-time lookup rejected (needs a migration and moves recipient logic into delivery SQL). |
| v1.1 | 2026-10-25 | AD-10 and TR-17 added after the Stage A review found that audience-group members never received the tournament invitation push. Default [A-10] recorded. No other section changed. |
| v1.0 wording | 2026-10-25 | Before the build briefs: AD-4 and section 5 add the three fee fields on `GET /config/client` so clients can read the flag (gap found while writing the mobile brief; no scope change). |
| v1.0 | 2026-10-25 | Drafted after elicitation of 2026-10-25 (8 items, 7 questions), approved by the owner the same day. Findings recorded while drafting: Pending is invitation-only so audience-group members never appear (AD-2); mobile posts the registration with no body (AD-1 E1); the Book button colour cycles per row (AD-8); Media gating and upload rights are changed from tournament-experience (AD-6). |
