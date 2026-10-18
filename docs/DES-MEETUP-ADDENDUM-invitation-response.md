# DES-MEETUP-ADDENDUM-INVITATION-RESPONSE

**Doc ID:** DES-MEETUP-ADDENDUM-INVITATION-RESPONSE
**Version:** v1.0
**Status:** APPROVED by the owner, 2026-10-18, as drafted in v0.1 (OI-1 and OI-2 stay open and non-blocking for `ia-backend`; OI-2 blocks `ia-clients`).
**Owner:** Pratheesh
**Date:** 2026-10-18
**Scale Tier:** T1
**Baseline:** repo `pratheeshku/meetup` `main` (code read 2026-10-18: `events/service.py:556-583` `respond_to_invitation`, `:620-680` `rsvp_to_event_transactional`; `events/router.py:442-462`). Design-only addendum. Does not edit the baseline or other addenda.
**Governing files:** `Enterprise_Design_Principles.md` v1.1 (P1–P17), `design-best-practices.md` v1.0 (BP-01–BP-13).
**Supersedes (explicit deviation D-1):** the baseline decision in `DES-MEETUP.md` (~lines 6331–6334, section 5.7) that accepting an invitation does NOT create an `event_participants` row, and the matching comment in `events/service.py:571-574`.
**Depends on:** `DES-MEETUP-ADDENDUM-access-consistency` v1.2 (AD-1, AD-2, lock order). Implementation starts only after PR `ac-p2-p3` is merged, because both touch `events/service.py` and the RSVP eligibility rule.

## Plain-language summary

Today, when you tap **Accept** on a game invitation, you are not in the game. The app only marks the invitation as accepted and lets you tap Join afterwards. The organizer sees you as "invited", not "going". Most people expect Accept to mean "I'm playing".

After this change, **Accept means "I'm playing"**. In one step you are marked as going, or put on the waitlist if the game is full, and you are told which. **Decline** means you are not playing. If the game cannot take you (cancelled, skill level not met, and so on), nothing changes: the invitation stays open, you see why, and you can still decline. People who accepted before this change are listed for the owner to decide on; they are not joined automatically.

## 1. Requirements (owner, 2026-10-18)

| ID | Requirement |
|---|---|
| IR-01 | Accepting an invitation to a game means the invitee is playing: the outcome is `going`, or `waitlisted` when the game is full, in one atomic action. |
| IR-02 | Declining means not playing. Invitation `declined`; no participant row is created. |
| IR-03 | If the join cannot complete for any reason the RSVP path already refuses (cancelled game, skill requirement, eligibility), nothing changes: the invitation stays `pending`, the user sees the reason and can still decline. No new refusal rules are introduced. |
| IR-04 | Capacity and waitlist order use the existing RSVP logic. The response tells the user which outcome they got. |
| IR-05 | Invitations accepted before this change with no participant row are reported to the owner and are not joined automatically. |
| IR-06 | Direct and group-sourced invitations behave the same. |
| IR-07 | No view or access rule changes. Access stays as defined in the access-consistency addendum. |

## 2. Architecture Decisions

**AD-1: One join path (IR-01, IR-04).** `respond_to_invitation(accept=True)` calls the same join logic as `rsvp_to_event_transactional(action="going")`. Capacity, waitlist and skill checks are not duplicated. The shared logic is extracted so that both entry points call it with the event row already locked.

**AD-2: Atomic, all-or-nothing (IR-03).** One transaction: lock the event row `FOR UPDATE` → read and lock the invitation row → require `pending` → set `accepted` → run the join. Any refusal from the join aborts the transaction; the router commits only on success, so the invitation returns to `pending` with no participant row. Lock order is event row first, then invitation, then participant, the same order as the access-consistency cascade (AD-4 there). Today `respond_to_invitation` reads the invitation without locking the event row; that is the defect to remove, and without it two invitees accepting the last spot could both be `going`.

**AD-3: Response contract, additive (P14).** The respond response keeps every current field and adds `participation_status`: `going`, `waitlisted`, or `null` (decline). Old clients keep working: they still send accept/decline and now also end up joined. Mobile and web must not invent other fields.

**AD-4: Realtime and notifications.** The router already broadcasts `going` after an accept (`events/router.py:456`) although no join happens; that becomes true by this change. The broadcast carries the real outcome (`going` or `waitlisted`). Decline keeps its current broadcast. The organizer notification is whatever the RSVP path emits today, once, from the shared path. No new notification type.

**AD-5: Unchanged behaviour.** Withdraw after joining is unchanged (access-consistency AC-06: withdrawing ends the explicit grant). Organizer add already creates an `accepted` direct invitation and a participant row, and is unchanged. Idempotency: a second accept returns the existing 400 "already accepted" and creates no second row (P5).

**AD-6: Legacy rows (IR-05).** A read-only report script `scripts/report_accepted_without_participation.py`: every `accepted` event invitation with no `going`/`waitlisted` participant row for the same game and user, with game id, status, date, user id and invitation id. Terminal output only, no `--apply`, no writes. The owner decides afterwards (notify, leave, or a separate task). Auto-joining is rejected: it would consume capacity and jump the waitlist on an answer given under the old meaning, possibly for games already past.

**AD-7: Clients.** After Accept the screen shows the outcome (going or waitlisted); after a refusal the invitation remains actionable with the server's reason. Use the existing label system and an existing component. No board exists for the confirmation text: the agent must stop and ask rather than invent (repo rule). Detail and list screens refetch as in the access-consistency AD-8.

## 3. Deviations

| ID | Deviation | From | Rationale |
|---|---|---|---|
| D-1 | Accept now creates the participant row | `DES-MEETUP.md` section 5.7 ("fully decoupled"), comment at `events/service.py:571-574` | The baseline assumed users would treat access and attendance as separate actions. In practice the invitee cannot tell the difference, and the organizer cannot tell who is coming. The access-consistency work already made the invitation the sole access grant (AD-2/AD-3 there), so the invitation no longer needs to double as the answer. |
| D-2 | Behaviour of an existing endpoint changes without a version bump | `Enterprise_Design_Principles.md` P14 (additive evolution) | The schema is additive only; the semantic change is the owner's explicit decision and old clients are not broken by it. Accepted by approval. |

## 4. Mandated tests (API level; P13)

| # | Test |
|---|---|
| IA-1 | Accept on an open game: invitation `accepted`, participant `going`, count +1. |
| IA-2 | Accept on a full game: participant `waitlisted`; response says `waitlisted`; order same as an RSVP at the same moment. |
| IA-3 | Accept on a cancelled game: 400, invitation still `pending`, no participant row. |
| IA-4 | Accept with an unmet skill requirement: 400, invitation still `pending`; decline still works. |
| IA-5 | Decline: `declined`, no participant row, `participation_status` null. |
| IA-6 | Group-sourced invitation: accept → `going` while in the source group; after leaving the group the game is 404 and accept is not reachable (access-consistency rule). |
| IA-7 | Second accept: 400, exactly one participant row. |
| IA-8 | Two invitees accept the last spot concurrently: one `going`, one `waitlisted`; capacity never exceeded. |
| IA-9 | View rule unchanged: pending invitee sees the game; a non-invitee gets 404. |
| IA-10 | Report script lists `accepted` invitations with no participant and changes no rows. |
| IA-11 | Client tests: accept shows going or waitlisted; a refused accept leaves Accept and Decline available. |

## 5. Phases

| Task ID | Content | Acceptance |
|---|---|---|
| `ia-backend` | AD-1 to AD-6; tests IA-1 to IA-10. Starts after `ac-p2-p3` is merged. | Report with raw test output and pass/fail per test |
| `ia-clients` | AD-7 on mobile and web. Starts after `ia-backend` is deployed. | IA-11; screenshots; stop and ask if no board fits |

Rollback is a code redeploy. Participant rows created by accepts are normal RSVP rows and stay.

## 6. Principles and practices check

P5 idempotency: AD-5, IA-7. P13/P15 negative test: IA-9; no access rule changes. P14: D-2. P9: accept payload unchanged, server-side validation reused from the RSVP path. BP-01: table and column names verified against `events/service.py` and the access-consistency addendum (`event_invitations`, `event_participants`). BP-13: decisions written back here.

## 7. Open Items

| ID | Item | Severity | Status |
|---|---|---|---|
| OI-1 | Legacy accepted-without-participant rows: report only (default). Notify them or leave them is the owner's call after the report. | 🟡 MEDIUM | Open, non-blocking |
| OI-2 | No UI board exists for the post-accept outcome message. Reuse the existing toast or completion pattern, or the owner supplies a board. | 🟡 MEDIUM | Open, blocks `ia-clients` only |

## 8. Review Log

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-10-18 | First draft after the owner confirmed that Accept must mean joining. |
| v1.0 | 2026-10-18 | Approved by the owner as drafted. No design content changed. |
