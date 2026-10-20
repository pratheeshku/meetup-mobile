# DES-MEETUP-ADDENDUM-DECLINE-RESPONSE

**Doc ID:** DES-MEETUP-ADDENDUM-DECLINE-RESPONSE
**Version:** v1.0
**Status:** APPROVED by the owner, 2026-10-20, as drafted in v0.1 (OI-1 to OI-5 stay open and non-blocking unless marked).
**Owner:** Pratheesh
**Date:** 2026-10-20
**Scale Tier:** T1
**Baseline:** repo `pratheeshku/meetup` `main` (code read 2026-10-20: `events/models.py` `EventInvitation` (line ~78), `EventParticipant` (~97); `tournaments/models.py` `TournamentInvitation` (~240); `events/router.py` `POST /{id}/invitations/respond` (:417), `POST /{id}/rsvp` (:442); `tournaments/router.py` `POST /{id}/invitations/respond` (:1089), `POST /{id}/registrations` (:196), `DELETE /{id}/registrations/{rid}` (:214)). Design-only addendum. Does not edit the baseline.
**Governing files:** `Enterprise_Design_Principles.md` v1.1 (P1-P17), `design-best-practices.md` v1.0 (BP-01-BP-13). Both read in full before drafting.
**Amends (explicit deviation D-1):** `DES-MEETUP-ADDENDUM-push-actions` v1.0 PA-04 and AD-1 (Ignore button) for game and tournament invitations. That document lives in the Architect Project, not in this repo.
**Also touches:** `DES-MEETUP-ADDENDUM-dashboard` v1.9 AD-20/AD-21 (declined items leave the default lists), `DES-MEETUP-ADDENDUM-invitation-response` v1.0 (decline unchanged, now also recorded), `DES-MEETUP-ADDENDUM-closure-report` v1.0 AD-4 (decline is a game write, so it is locked after the end time).
**Sequencing:** `dr-backend` starts after `cr-backend` is merged and deployed (both change `events/service.py`, `events/router.py` and the list filters).

## Plain-language summary

Every game and tournament gets a clear **Accept** and **Decline**.
- Invited to something: Accept or Decline. Accept means you are in (games) or eligible to register (tournaments). Decline says no.
- A public game or tournament you have not joined: Join or Decline. Decline hides it from your lists and tells the organizer.
- Something you already joined: Decline withdraws you.
- You can change your mind: Accept or Join again at any time before the end.

The organizer sees a response list like an Outlook meeting: **Accepted**, **Pending** (invited, no answer yet) and **Declined**. Nobody is notified of a decline; the list just updates. Push notifications for game and tournament invitations now carry **Accept** and **Decline**; Decline records the decline. All button texts are managed in admin.

## 1. Requirements (owner, 2026-10-20)

| ID | Requirement |
|---|---|
| DR-01 | Games and tournaments offer Accept and Decline on invited, public and joined items. On a public item that has not been joined, the positive action stays Join. |
| DR-02 | Declining an invitation records Declined. (Games already set the invitation to `declined`; tournaments the same.) |
| DR-03 | Declining a public item that was not joined hides it from the user's Active games, Public and Upcoming lists. It is remembered for the user and shown to the organizer. |
| DR-04 | Declining an item the user joined withdraws the user and records Declined. |
| DR-05 | A declined user can Accept or Join again; the Declined record is then cleared and the lists update. |
| DR-06 | The organizer sees Accepted, Pending and Declined sections on game and tournament screens. Organizer-only. A decline sends no notification. |
| DR-07 | Tournament Accepted means the invitee said yes to the invitation. Registration stays a separate step and its own list. |
| DR-08 | The push notification for a game or tournament invitation carries Accept and Decline (the Ignore button is removed for these two types); Decline records a decline. Group-addition pushes are unchanged. |
| DR-09 | All new button, section and result texts are label-managed in admin. Declines are frozen from the end time, like every other game write. |

## 2. Scope and constraints

**In scope:** backend `~/meetup` (`events`, `tournaments`, `home`, `notifications` labels), web PWA, mobile app, label keys, two additive tables.
**Out of scope:** notifications to the organizer on decline; decline reasons; bulk or repeat reminders to Pending people; team-registration decline (OI-2); the group-addition push (Leave group, Ignore) which stays as in push-actions v1.0.

**Constraints:** migrations are written, never executed by agents (`AGENTS.md`). Additive only (P14). No RLS, no DB triggers, no DB CHECK or DB-side validation (the two new tables carry none; the existing invitation CHECKs are untouched). Authorization in `policies.py` (P15). Zero sibling imports. T1: one Postgres, one api, one worker (BP-12).

## 3. Architecture Decisions

**AD-1: One Declined record per person and item (DR-02, DR-03, DR-04, BP-09).** Two additive tables, `event_declines` and `tournament_declines`: one row per `(event_id|tournament_id, user_id)`, written for every decline whatever its source (`via`: `invitation`, `public`, `joined`). The Declined section, the list exclusion and `my_declined` all read this one table. The invitation `declined` status keeps being set for compatibility with existing clients and the push-actions result states, but is never read to decide who is Declined.

**AD-2: Re-accepting clears the record, it does not delete it (DR-05).** `cleared_at` is set when the user accepts or joins again; "currently declined" means `cleared_at IS NULL`. The row is reused on the next decline (`declined_at` overwritten, `cleared_at` reset). Only the latest decision is kept; this is a display state, not an audit decision record (P6 not engaged, see section 11).

**AD-3: Two new routes per module, no others (P14).**
- `POST /events/{id}/decline` and `POST /tournaments/{id}/decline`: body empty. Behaviour in one transaction, the event or tournament row `FOR UPDATE` first (access-consistency AD-4 lock order, closure addendum AD-4):
  1. The item must be `active` by closure addendum AD-1 (not past, cancelled or closed); else 409 `game_ended` (games) or the tournament equivalent used by the closure addendum.
  2. If the caller holds a pending invitation: set it `declined` (same code as `respond(accept=false)`).
  3. If the caller is `going` or `waitlisted` (game): withdraw via the existing withdraw path (waitlist promotion unchanged). Tournament: an individual registration owned by the caller is withdrawn via the existing withdraw rules (`can_withdraw_registration`); a refusal aborts the whole decline, nothing is recorded, and the response carries the existing reason.
  4. Upsert the decline row (AD-1).
  5. Idempotent (P5): a second decline returns 200 with the same body and changes nothing.
  Any caller who passes the module's one view rule may decline; no access gives 404 (AC-11).
- `GET /events/{id}/responses` and `GET /tournaments/{id}/responses`: organizer only (tournament: organizer or active committee member, existing rule). Shape in AD-5.
- **No new join or accept route.** Accept on an invitation is `POST .../invitations/respond` `accept: true`; Join is the existing RSVP or registration. Each of those, on success, sets `cleared_at` on the caller's decline row in the same transaction.
- The push Decline for an invitee calls `.../invitations/respond` with `accept: false` (push-actions PA-11 stays true: no new action endpoint). `respond(accept=false)` now also upserts the decline row, so every decline path produces the same record.

**AD-4: Lists and counts (DR-03).** For the caller, items with a current decline row are excluded from: `GET /events` and `GET /tournaments` default and `view=active` result, the Public scope, `GET /home/upcoming`, the Upcoming badge and tab count, and `GET /home/menu` / `GET /home/summary` counts (they use the single upcoming function, closure addendum AD-8). Under `view=all` they are included with the caller's badge `Declined`. Access is unchanged: a declined item still opens by link or notification (no view or access rule changes). Items and detail responses gain additive `my_declined` (bool). `GameBadge` gains the value `Declined`. Old clients that send nothing keep working.

**AD-5: Organizer response list (DR-06, DR-07).** `GET .../responses` returns:

```
{ "accepted": { "total": n, "items": [AvatarPreview + responded_at] },
  "pending":  { "total": n, "items": [...] },
  "declined": { "total": n, "items": [AvatarPreview + declined_at + via] } }
```

| Section | Game | Tournament |
|---|---|---|
| Accepted | `going` and `waitlisted` participants (waitlisted flagged), organizer included | invitations with status `accepted`. People who registered with no invitation are in the existing registrations list, not here (DR-07) |
| Pending | invitations `pending`, not expired or revoked, whose invitee has no current decline row; email invitations not yet claimed show the email | same |
| Declined | current decline rows | same |

Each person appears in exactly one section (precedence: Declined, then Accepted, then Pending). Items sorted by name; each section returns at most 200 items plus its true `total` (no unbounded response, P7). The route is read-only and never mutates. Group-sourced invitations appear in Pending like direct ones.

**AD-6: No decline notification (DR-06).** Decline sends no in-app, push or email notification to anyone. If the existing withdraw path emits an organizer notification (to verify, OI-3), the decline path passes a suppress flag so it does not. The organizer learns by opening the list.

**AD-7: Push buttons (DR-08).** `event_invite` and `tournament_invited` push actions become **Accept** and **Decline**. Ignore is removed for these two types. Decline for an invitee calls the existing respond endpoint with `accept: false` (AD-3). Result messages are label keys: "You declined" (200), "Already answered" (400), "This game is no longer available" (404). `group_invite` keeps Leave group and Ignore. The history `action_state` values already include `declined`, now sourced from the AD-1 table for the three-way consistency of push, list and screen. The iOS category titles come from labels (no server change). Backend payloads are unchanged, so this is a client and label change only.

**AD-8: Locking (DR-09).** From `now >= coalesce(ends_at, starts_at)` the decline routes return 409 like every other game write (closure addendum AD-4); Accept and Join already do. Responses (`GET`) stay available after the end. Tournament decline follows the same end-time test used for the tournament lock in the closure addendum (D-3).

**AD-9: Labels (DR-09).** New keys `web.respond.*` and `mob.respond.*` in `ui_labels` via a seed migration (written, not run) and fallbacks: Accept; Decline; Declined; Join; Accepted (section); Pending (section); Declined (section); Responses; No one yet; Waitlisted; You declined; Already answered; Declined games hidden (empty state of the Declined section is "No one has declined"). The existing Join/Withdraw labels are not renamed; on a joined item the existing withdraw control shows the Decline label (OI-4). Edited later in admin with no deploy.

**AD-10: Sensitive data (P9, P12).** The organizer sees the name and avatar of people who declined a public item they never joined. This is new disclosure to the organizer only, for their own item; nothing is shown to other users and no reason text exists. `via` is shown to the organizer as Invited or Public. No contact data, no email, no mobile number.

## 4. Component / Integration Design

| Component | Change |
|---|---|
| `events/models.py`, `tournaments/models.py` | `EventDecline`, `TournamentDecline` |
| `events/service.py`, `router.py`, `policies.py` | decline service and route; `respond(accept=false)` upserts; RSVP going and `respond(accept=true)` clear; responses route; list exclusion; `my_declined`; policies for responses |
| `tournaments/` | same: decline, responses, list exclusion, `respond` and registration clear |
| `home/service.py` | the single upcoming function excludes declined |
| `notifications/` | labels only; `action_state` `declined` read from `event_declines` and `tournament_declines` via the existing resolvers |
| Web `frontend/` | Accept/Decline/Join controls on game and tournament detail and list rows; Responses section for the organizer; `Declined` badge under All games |
| Mobile | same; push action buttons Accept and Decline; list badge |
| Migration (one, written not run) | `event_declines`, `tournament_declines`, label seed |

Boundary failure behaviour: a decline whose withdraw is refused changes nothing and returns the existing reason; the responses route failing leaves the screen without the section and shows a retry; the list exclusion is a plain query filter and fails with the list.

## 5. Data contracts

### 5.1 Schema (additive; written, not executed)

| Table | Columns |
|---|---|
| `event_declines` | `event_id` FK `events` cascade, `user_id` FK `users` cascade, `declined_at` timestamptz, `via` varchar(20), `cleared_at` timestamptz null. PK `(event_id, user_id)`. Index `(user_id)` where used by list exclusion. |
| `tournament_declines` | same with `tournament_id`. |

No CHECK, no trigger, no RLS, no default values enforced in the DB beyond the primary key. Grants: copy exactly what the latest migrations grant on new tables to the application role (verify in Phase 1, BP-01).

### 5.2 Data lineage

| Field | Single source | Bug if it comes from |
|---|---|---|
| Who is Declined, `my_declined`, list exclusion | `event_declines`, `tournament_declines` (`cleared_at IS NULL`) | invitation status, participant status, client state |
| Accepted (game) | `event_participants` `going`, `waitlisted` | the invitation |
| Accepted (tournament) | `tournament_invitations.status = 'accepted'` | registrations |
| Pending | `*_invitations.status = 'pending'` minus current declines | a counter |

## 6. Security and compliance

| Resource | Allowed | Denied |
|---|---|---|
| Decline | the caller, on an item they can view | no access: 404; ended or cancelled: 409 |
| Responses | game organizer; tournament organizer or active committee | everyone else, including co-members: 404 or 403 per module convention (non-organizer who can view gets 403, no access 404) |

Threats: *Forged push Decline* gets the same denials as a client call. *Decline spam to hide items* only affects the caller's own lists. *Organizer enumerating who rejected a public game* is the owner's accepted design (AD-10). PDPA: no new personal data categories; rows are deleted with the user or item by FK cascade.

## 7. Failure modes and resilience

| Scenario | Behaviour |
|---|---|
| Withdraw refused (tournament registration closed) | Whole decline aborts; reason shown; no record |
| Two devices decline at once | One writes; the other is idempotent |
| Decline after Accept on another device | Last write wins; the item ends Declined and withdrawn |
| Re-accept while game is full | Existing waitlist logic; decline cleared only if the join or waitlist succeeds (same transaction) |
| User deleted | Rows cascade |
| Responses list of 5,000 invitees | Capped at 200 per section with true totals |
| Notification of withdrawal fires from the existing path | Suppressed for decline (AD-6, OI-3) |

## 8. Observability and operability

Correlation id per action (`withCorrelationId()` on clients). Request-log metrics from the existing logging: `decline_total{kind,via}`, `decline_refused_total{reason}`. No new alerts at T1. Runbook note: to un-hide a game for a user, set `cleared_at` (support only, no admin screen).

## 9. Tests (API level; P13, no DB backstop)

| # | Test |
|---|---|
| DR-T1 | Decline a pending game invitation: invitation `declined`, decline row, no participant row, `my_declined` true. Same for tournaments. |
| DR-T2 | Decline a public game never joined: decline row `via=public`; item gone from default list, Public scope, `/home/upcoming` and the badge count; present under `view=all` with badge `Declined`. |
| DR-T3 | Decline a joined game: participant `withdrawn`, waitlist promotion happens, row `via=joined`. |
| DR-T4 | Accept, Join and RSVP going each clear the row (`cleared_at` set) and restore the item to the lists. |
| DR-T5 | Decline twice: second is 200 and writes nothing. |
| DR-T6 | Decline after the end time, on a cancelled or closed item: 409. |
| DR-T7 | Tournament decline of a registered individual with a refused withdraw: nothing recorded, reason returned. |
| DR-T8 | Responses: each person in exactly one section with the precedence rule; counts equal the totals; cap of 200 with true totals; waitlisted flagged; email invitations in Pending. |
| DR-T9 | Responses route: participant who is not the organizer gets 403; no-access user gets 404; tournament committee member allowed. |
| DR-T10 | Decline sends no notification and creates no outbox job; the existing withdraw notification is suppressed. |
| DR-T11 | Push Decline path (`respond` `accept:false`) produces the same decline row as the in-app Decline. |
| DR-T12 | Old client (no new fields) lists and detail unchanged; response additions are additive only. |
| DR-T13 | Closure candidates and Played/Won/Hosted unaffected by declines. |

Mobile and web: control states per item type (invited, public, joined), Declined badge under All games, responses sections, push action buttons Accept and Decline, result messages, `npm run check:labels` / label checks.

## 10. Implementation phases

| Task ID | Content | Starts after |
|---|---|---|
| `dr-backend` | Migration (tables plus label seed, written, not run), routes, service changes, list exclusion, `my_declined`, tests DR-T1 to DR-T13 | `cr-backend` merged and deployed |
| `dr-web` | Controls, responses section, badge, labels | `dr-backend` deployed |
| `dr-mobile` | Controls, responses section, badge, push buttons Accept/Decline, labels. If `pa-clients-mobile` has not started, build the push buttons directly in this form; otherwise this changes them | `dr-backend` deployed |

Rollback: redeploy the previous version; the tables are additive and stay; hidden items reappear when the exclusion code is rolled back.

## 11. Principles compliance

| Principle | Design element | Status |
|---|---|---|
| P1 | Labels from admin | Met |
| P5 Idempotency | Decline idempotent; accept clears | Met |
| P6 Immutable decision context | Declined state is display state, not a decision record; no audit table (D-2) | Deviation D-2 |
| P7 Fault isolation | Capped lists; no new async work | Met |
| P9 Validate at boundary | Server-side end-time and eligibility rules | Met |
| P10 | No new grant beyond table grants | Met |
| P12 | Cascade deletes | Met |
| P13 Negative tests | DR-T6, T7, T9 | Met |
| P14 Additive | New tables, routes, fields, badge value | Met |
| P15 Authz | Declared in `policies.py` | Met |
| P17 Rate limits | Apply the existing per-user limiter to the two decline routes (OI-5) | To verify |
| BP-01 | Table and route names verified in code | Met; Phase 1 re-verifies |
| BP-09 | Section 5.2 | Met |
| BP-10 | Measurable tests | Met |
| BP-12 | Two small tables, no queue | Met |
| BP-13 | Phase reports | Planned |

## 12. Deviations

| ID | Deviation | From | Rationale |
|---|---|---|---|
| D-1 | Push button Ignore removed and Decline records a decline for `event_invite` and `tournament_invited` | push-actions v1.0 PA-04, AD-1 (Ignore never changes an invitation) | Owner decision 2026-10-20: an ignored invite stays Pending forever and the organizer's list cannot be trusted. Accept/Decline replaces Accept/Ignore. `group_invite` unchanged |
| D-2 | Only the latest decline is kept (`cleared_at`, overwritten on re-decline); no decline audit table | P6 | A decline is a user preference, not a controlled decision; the organizer-visible state needs no history at T1. Revisit if disputes arise |
| D-3 | Declined items are hidden from default lists only for the declining user; direct access is unchanged | Dashboard v1.9 AD-20/21 (lists show all active own and open games) | Owner requirement DR-03 |

## 13. Requirements coverage

| Requirement | Section |
|---|---|
| DR-01 | AD-3, AD-9 |
| DR-02 | AD-1, AD-3 |
| DR-03 | AD-1, AD-4 |
| DR-04 | AD-3 |
| DR-05 | AD-2, AD-3 |
| DR-06 | AD-5, AD-6 |
| DR-07 | AD-5 |
| DR-08 | AD-7 |
| DR-09 | AD-8, AD-9 |

## 14. Open items

| ID | Item | Severity | Status |
|---|---|---|---|
| OI-1 | No UI board is drawn for the Accept/Decline controls, Declined badge or the organizer Responses section. Owner decision 2026-10-20: no boards; use existing components and tokens only, screenshots for review. The Games list and dashboard layouts stay as today | 🟡 MEDIUM | Closed |
| OI-2 | Decline of a team registration: only individual registrations in v1; a team registration returns the existing refusal and the user withdraws from the team screen | 🟡 MEDIUM | Closed (owner confirmed 2026-10-20) |
| OI-3 | Verify whether the existing withdraw path notifies the organizer; if so, suppress for decline | 🟡 MEDIUM | Phase 1 verify |
| OI-4 | On a joined item, the existing withdraw/leave control takes the Decline label (owner confirmed 2026-10-20); Phase 1 only checks the screens do not already show both | 🟡 MEDIUM | Closed, Phase 1 check remains |
| OI-5 | P17 rate limit on the new routes | 🟡 MEDIUM | Phase 1 verify |
| OI-6 | `meetup.tournament.invitations.enabled` must be true in production for tournament Accept/Decline (the respond endpoint answers 404 otherwise) | 🟠 HIGH | Verify before `dr-web`; same as push-actions OI-5 |

## 15. Risks and mitigations

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Users decline by mistake and lose the item from lists | Reachable under All games; Accept/Join restores it |
| R-2 | Organizer sees many public strangers in Declined | Section cap and counts; it is the owner's choice (AD-10) |
| R-3 | Collision with `cr-backend` changes | Sequenced after `cr-backend` |
| R-4 | Push-actions client already built with Ignore | `dr-mobile` changes it; flagged in section 10 |

## 16. Review log

| Version | Date | Note |
|---|---|---|
| v1.0 | 2026-10-20 | Approved by the owner, no content change from v0.1. |
| v0.1 | 2026-10-20 | First draft after elicitation (scope all items, option 2 organizer visibility, tournament Accepted = invitation reply, no notification, push Accept/Decline). Code facts read from `meetup` `main`. |
