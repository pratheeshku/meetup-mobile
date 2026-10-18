# DES-MEETUP-ADDENDUM-ACCESS-CONSISTENCY

**Doc ID:** DES-MEETUP-ADDENDUM-ACCESS-CONSISTENCY
**Version:** v1.4
**Status:** APPROVED by the owner, 2026-10-18 (v1.1 amendment, same day: owner constraint on DB-side validation). v1.2 (same day) records the owner's decisions after `ac-p1-verify` (D-5 to D-8, approved 2026-10-18). The Phase 6 policy removal is gated on OI-10 (live counts and the reconcile); all other phases are unblocked. v1.3 (same day) records the owner's decisions on group deletion and group invitations (AC-15, AC-16, AD-13, AD-14, D-9, tests 23-29) and repairs the v1.2 edit, which had dropped rows D-4 and OI-8 and left two tables malformed. v1.4 (same day, owner approved) adds the recurring-games job to the attach paths of AD-13, fixes the tournament status list (no draft status; `dissolved` is closed) and adds test 30 (task `ac-bug-2b`).
**Owner:** Pratheesh
**Date:** 2026-10-18
**Scale Tier:** T1
**Baseline:** repo `pratheeshku/meetup` `main` @ `cab80e3` (code read 2026-10-18). Design-only addendum. Does not edit the baseline or other addenda.
**Governing files:** `Enterprise_Design_Principles.md` v1.1 (P1–P17), `design-best-practices.md` v1.0 (BP-01–BP-13).
**Amends:** the 2026-10-13 rule "removed groups lose access except people already going/waitlisted/invited"; the tournament `_registered` view branch added in lifecycle v1.2.2.

**Process notes (flagged, not silent):**
1. No formal `REQ-MEETUP` addendum exists. Requirements were stated by the owner in conversation on 2026-10-18 and are restated in §1 as `AC-01…AC-14`. Same departure as the lifecycle and venue addenda (their D-5 / D-2). §1 is approved together with this document.
2. `solution-design` references `PRINCIPLES.md` P1–P23. The authoritative file is `Enterprise_Design_Principles.md` v1.1 (P1–P17). P1–P17 are used.
3. **BP-01 limit (important).** The Project copy of `DES-MEETUP-ADDENDUM-tournament-lifecycle.md` was v1.1; the repo holds v1.2.2, where AD-4 was rewritten (no share token, no access grants, per-user invitations like games, a `registered` view branch). This addendum is designed against the **as-built code** (`tournaments/policies.py`, `events/policies.py`, `events/service.py`, `groups/service.py` at `cab80e3`), not the stale Project copy. Every claim about code carries a file and line. Phase 1 re-verifies all of them.
4. **Evidence base (incident, 2026-10-17/18).** A game "Group Join Test" appeared for a person who had left its group. Database facts: invitation `declined`, participant `withdrawn`, no group membership, and no record of when they left. The server did not return the game to them at the time of checking, so the incident itself is not a proven leak. It exposed two real defects: (a) leaving or removal writes no audit record; (b) the view rules grant access from rows that outlive group membership (below).

---

## Plain-language summary

One rule everywhere: **if you no longer have access, you no longer see it.** Whoever ended your access (you left, an admin removed you, the owner removed you, the group was taken off the game), the result is the same.

Today three kinds of rows keep a game or tournament visible after you leave a group: a "going" spot, an invitation the group created for you, and a tournament registration. This design stops that. Access comes only from a *current* relationship: being in the group, being the organizer, or being explicitly and directly invited. A group's automatic invitations count only while you are still in that group.

When you leave a group, your spots in that group's upcoming games are released in the same step and the waitlist moves up. Tournaments are different because rosters freeze: your registration stays so fixtures do not change silently, you stop seeing the tournament, and the committee is told so they can decide (walkover or disqualification) with the normal two-person approval.

Notifications are only sent to people who can still see the item, and old ones are withdrawn. Open live screens close within a minute. The apps must re-fetch each time a screen opens and never show cached rows.

Group membership changes (added, removed, left, role changed, ownership moved, admin override) are written to a permanent audit table, so "who was removed, when, by whom" can always be answered.

---

## 1. Requirements baseline (owner, 2026-10-18; approved with this document)

| ID | Requirement |
|---|---|
| AC-01 | Access is decided from current relationships at the time of every read. No stored status or grant may outlive the relationship that created it. |
| AC-02 | The rule applies to every path: lists, detail, search, home and dashboard counts, live streams, notifications, deep links and client caches, for games and tournaments. |
| AC-03 | Access basis per visibility class is defined once (AD-1). Rows that record participation (participant, registration, roster) never grant view. |
| AC-04 | The outcome is identical whoever ended the relationship: self leave, owner or group admin removal, platform admin override, a group removed from a game, or a group deleted. |
| AC-05 | When group-derived access ends, the user's group-derived spots and pending invitations in affected upcoming games are released in the same transaction, and the waitlist is promoted among currently eligible users only. |
| AC-06 | Explicit grants (a direct invitation, an organizer add) persist until the organizer revokes them or the person declines or withdraws. They do not depend on group membership. |
| AC-07 | Tournaments: a registered player who loses access keeps the registration, loses all view, and the organizer and active committee are notified. No fixture changes silently. |
| AC-08 | Notification audiences are filtered by current eligibility at send time. Existing notifications about content the user can no longer see are withdrawn. |
| AC-09 | Open live streams for content the user can no longer see end within a bounded time. |
| AC-10 | Clients re-fetch on every dashboard, All Games and All Tournaments open and never render cached rows. A 404 on a detail screen closes it. |
| AC-11 | A denied read returns 404, never 403 (no existence leak). |
| AC-12 | Group membership changes are audited: added, removed, left, role changed, ownership transferred, admin override. Append-only. Survives account deletion without copying personal data. |
| AC-13 | Existing data that violates AC-01 is reconciled once, dry-run first, by the human. |
| AC-14 | Every access rule has an API-level negative test with the database backstop absent (P13). |
| AC-15 | A group cannot be deleted while an active game or an open tournament references it. (Owner, 2026-10-18.) |
| AC-16 | A person can invite a group's members to a game only if they belong to that group. Inviting an individual is unrestricted. (Owner, 2026-10-18.) |

**Supersession:** AC-04 and AC-05 supersede the 2026-10-13 rule that people already going, waitlisted or invited keep access when a group is removed from a game.

---

## 2. Scope & Constraints

**In scope:** backend `~/meetup` (`events`, `groups`, `tournaments`, `notifications`, `home`, `settings_dashboard`, `core/realtime`); one additive migration; web (`frontend/`) and mobile app refetch rules; admin read endpoint for the audit.

**Out of scope:** chat or comments (none exist); public games and public tournaments (visible to every signed-in user by design, unchanged); teams module changes beyond the roster read in AD-5; recalling push notifications already delivered to a device (R-3).

**Constraints**
- Migrations are written, never executed by agents. The human runs them (`AGENTS.md`).
- Additive only (P14). No RLS, no DB triggers, no DB-side validation. Authorisation lives in `policies.py` (P15).
- Zero sibling imports. `groups` must not import `events` or `tournaments`. The cascade is invoked through registered callbacks (AD-4), the same interface pattern used for groups elsewhere.
- Tier T1: one Postgres, one api process, one worker process. No new service or queue (BP-12).

---

## 3. Architecture Decisions

**AD-1: One view rule per visibility class (AC-01, AC-03, AC-11).** The view rule is a single predicate per object type, in that module's `policies.py`, used by detail, list, search, counts, streams and notification audience.

| Class | Who can view (current relationships only) |
|---|---|
| Game `public` | any signed-in user |
| Game `group` | organizer; platform admin; current member of **any** attached group (`event_groups`, legacy `group_id` as fallback); holder of a **direct** invitation in `pending` or `accepted`; holder of a **group-sourced** invitation in `pending` or `accepted` **and** a current member of its `source_group_id` |
| Game `invite_only` | organizer; platform admin; holder of a **direct** invitation in `pending` or `accepted`; holder of a **group-sourced** invitation in `pending` or `accepted` **and** a current member of its `source_group_id` (`invite-group` creates these on any game; D-6) |
| Tournament `public` | any signed-in user |
| Tournament `group` (v1) | organizer; active committee; platform admin; current member of its group |
| Tournament `invite` | organizer; active committee; platform admin; invitation in `pending` or `accepted` where, if group-sourced, the user is a current member of the source group |

Participant rows, registration rows and team roster rows **never** grant view. A denied read is 404. Every group-membership basis also requires `groups.is_deleted = false` (D-5).
**Code today (BP-01):** `events/policies.py:64` ORs `_participant` (line 57) and `_invited` (line 51, status only); `tournaments/policies.py:134` ORs `_registered` (line 119) and `_invited` (line 95). These are the defects. The inline invite check in `events/router.py:170` and the inline pre-filter in `events/repository.py:64-70` duplicate the rule and are removed so one rule remains (lineage §5.2).

**AD-2: Derived versus explicit access (AC-06).**
- *Derived access* follows a relationship that can end: group membership, and invitations created by a group fan-out (`source_group_id` set, `events/service.py:106-134`).
- *Explicit access* is a deliberate act by a person and is not tied to a group: a direct invitation (`source_group_id` NULL) and an organizer add.
- The view predicate for a group-sourced invitation therefore adds `EXISTS group_memberships (source_group_id, user)`. No stored status is trusted past its relationship.
- **Organizer add on group games (gap found):** `organizer_add_participant` writes no invitation for `group` or `public` games (`events/service.py:854-878`; the invitation sync is `invite_only` only). Such a person sees the game today only via the participant row. Because participant rows stop granting view (AD-1), organizer add on a `group` game now also upserts an `accepted` **direct** invitation (the existing `upsert_event_invitation_accepted`, same transaction). Organizer remove revokes it. `upsert_event_invitation_accepted` keeps `source_group_id` on an existing row today (`events/repository.py:376-417`); for organizer add it must set `source_group_id` to NULL, otherwise the player stays group-sourced.
- **RSVP aligned to the view rule (drift fix):** the RSVP check for group games requires current membership only (`events/service.py:634-647`). The owner decided on 2026-10-17 that the invite field applies to all visibilities "same behaviour as invite-only", so a direct invitee of a group game must be able to RSVP after accepting. RSVP rule for `group` games becomes: current member of an attached group, or `accepted` direct invitation. Confirmed by approval (OI-7).

**AD-3: Participation rows grant nothing (AC-03).** `event_participants`, `tournament_registrations` and roster rows record *attendance*, not *authority to see*. Removing them from the view rule is safe only because AD-2 gives every legitimate participant an explicit or derived basis. The reconcile in AD-10 repairs legacy rows that have none.

**AD-4: Atomic cascade when group access ends, games (AC-04, AC-05).** One function `release_group_derived_access(db, group_id, user_ids, reason)` in `events/service.py`, registered with `groups` through a callback registry (`groups` calls registered hooks, never imports `events`). Callers inside the same transaction as the membership change:
1. self leave (`groups/service.py:191`),
2. administrative removal and platform-admin override removal (`:211`),
3. group removed from a game (organizer edit, `set_event_groups`, `events/service.py:137`),
4. group soft-deleted (D-5, below).

Steps, in this order (lock ordering is mandatory):
1. Select affected upcoming, non-cancelled `group` games: attached to the group and with the user holding a participant, waitlist or invitation row. Lock those event rows `FOR UPDATE` in ascending id. This serialises against RSVP, which already locks the event first (`events/service.py:627`), so a concurrent RSVP either completes before the cascade sees it or sees the membership gone.
2. Delete the membership row (or apply the group edit).
3. For each game, keep the user's access if another attached group still gives eligibility or they hold a direct invitation. Otherwise: set group-sourced `pending`/`accepted` invitations to `revoked`; set `going`/`waitlisted` to `withdrawn`; log an `event_participant_actions` row with `actor_type='system'`, `action='access_revoked'` (new value; CHECK widened, additive); write the membership audit row (AD-9).
4. Promote the waitlist **after** all withdrawals, and only users who pass the current RSVP eligibility check (a promoted user must be currently eligible).
5. Commit. Failure at any step rolls back the whole membership change; the user stays a member and the caller gets an error (safe: no half state).

Past or cancelled games: no status change (nothing to release). The view rule alone hides them, which is why AD-1 is the primary control and the cascade is hygiene plus capacity.

**Group soft delete (D-5, owner 2026-10-18).** `soft_delete_group_service` (`groups/service.py:235`) and `detach_upcoming_games` (`groups/repository.py:129`) change: the deleted group is removed from `event_groups` (not only `events.group_id`); if other groups remain the game stays `group` and `events.group_id` is repointed to a remaining group (consistent with `set_event_groups`); only when none remain does it become `invite_only` (today's detach). `release_group_derived_access` then runs in the same transaction for every user who lost their last basis. Tournaments detach as today; the policy change covers their view. Hard delete by a platform admin fails today on foreign keys for any group that ever had a game; that is a separate bug (OI-11).

**AD-5: Tournaments, owner decision (a) (AC-07).**
- The `_registered` branch is removed as an independent view basis (AD-1). A registered player sees a `group` or `invite` tournament only through a current basis.
- Registration rows are **not** withdrawn after the hard block (roster freeze, AD-6 of the lifecycle addendum is untouched). On access loss the system writes a `tournament_registrant_access_lost` record and notifies the organizer and every active committee member (one notice per tournament per day, de-duplicated). The committee acts through the existing `team_disqualification` or walkover paths (maker-checker, unchanged).
- Before the hard block a person who lost access may self-withdraw if they can reach the withdraw endpoint; otherwise the committee removes them. The cascade does not auto-withdraw, so there is one behaviour at all phases.
- Fan-out audiences (reminders, results, fixture notices) are filtered by AD-6, so an ineligible registrant receives nothing. The committee notice is the compensating control.
- **Gate decision (owner, 2026-10-18, after `ac-p1-verify` found the gate not cleared):** (1) registration in a `group` tournament requires a current basis for every person registered: the individual, or each active roster member, must be a group member, an invitee or active committee; individuals register themselves only (`req.user_id` equals the caller; also a stand-alone bug, OI-12); (2) existing registrants with no basis (live queries G1–G3, OI-10) receive an `accepted` direct tournament invitation from a human-run, dry-run-first reconcile; (3) only after that reconcile has run is `_registered` removed from the view rule. The order 1, 2, 3 is mandatory. The invitation basis works only if `meetup.tournament.invitations.enabled` is true in production (default false in code); `ac-p6` verifies it and reports if it is false. Tournament slice only; games are unaffected.

**AD-6: Notifications (AC-08).**
- The central audience resolver `notifications/fanout._resolve_recipients` applies the object's current view predicate to every candidate recipient before inserting deliveries. One filter, one place.
- On cascade (AD-4) and on a tournament access loss, notifications belonging to the user whose payload names the affected game or tournament are marked `retracted` (additive column `retracted_at` on `notifications.notification_deliveries`, filtered at the seven list/count query sites in `notifications/service.py`). History for other objects is untouched.
- Pushes already delivered to a device cannot be recalled (R-3).

**AD-7: Live streams (AC-09).** The event stream authorises only at connect (`events/router.py:490-531`, `_load_stream_event`). The stream loop re-checks the view predicate every `meetup.access.stream_recheck_seconds` (default 60) and ends the stream with a terminal `access_revoked` event. Group streams re-check membership the same way. Implementation shape (`ac-p1-verify` 4.4): pass the actor id into the generator, open a fresh `session_scope()` per re-check (never hold a session across the stream), and add the re-check as a periodic branch in the existing 30-second `wait_for` timeout loop (a 60-second default fits without a new task). `_broadcast_rsvp_update` (`events/router.py` ~:372-436) must stop sending `realtime_refresh` (event id, user id, action) to `withdrawn` participants and `declined` invitees; recipients are filtered by the view predicate. The notification stream (`notifications/router.py:31-70`) is per-user and needs no re-check.

**AD-8: Client rule (AC-10).** Web and mobile: dashboard, All Games, All Tournaments, group and detail screens fetch on every open and on app foreground. List rows are not persisted past the screen. A 404 or an `access_revoked` stream event pops the detail screen and shows a neutral "no longer available" message. Mobile and web changes follow separate build briefs.

**AD-9: Membership audit (AC-12).** New append-only table `group_membership_audit`, written in the same transaction as the change (§5.1). Write sites found at `cab80e3` (BP-01): `groups/repository.py:54` (group creation, owner), `groups/service.py:109` (invitation accepted or add), `groups/service.py:336` (verify purpose in Phase 1), `groups/service.py:191` and `:211` (leave, removal), role change and ownership transfer in `groups/service.py` (~`:173`, `transfer_ownership`), and admin override paths. No UPDATE or DELETE path exists in code. Written by a single function `record_membership_change(...)` called by every site; a test enumerates `add_group_membership`/`remove_group_membership`/role-update call sites so a new site cannot skip it.

**AD-10: One-time reconcile of existing data (AC-13).** A script `scripts/reconcile_group_access.py`, human-run, **dry-run by default**. For every `group` game with a `going`/`waitlisted` participant who is neither organizer, nor a current member of an attached group, nor a holder of a direct invitation:
- action log shows `organizer_add` → create an `accepted` direct invitation (keeps their spot, grants view);
- otherwise → apply the AD-4 release (spot withdrawn, waitlist promoted);
and revoke group-sourced invitations whose source group membership is gone. The dry run prints counts and ids per game for owner review before the real run. Idempotent. Run after the policy deploy (AD-1) because the policy already hides the games; the reconcile cleans capacity.

**AD-11: Config (P1).** `meetup.access.stream_recheck_seconds` (default 60, bounds 15–300); `meetup.access.membership_audit.retention_months` (default 12, bounds 6–120, OI-1). Validated at startup, hard failure if missing or out of bounds. No feature flag on the view rule itself: a flag that re-opens access would defeat AC-01.

**AD-12: Worker read grants (AC-08, D-8).** The outbox worker role has no SELECT on `event_groups`, `event_invitations`, `group_memberships`, `groups`, `tournament_invitations` and `tournament_committee_memberships` (`ac-p1-verify` 4.1), so the AD-6 filter cannot run there. One migration grants read-only SELECT on exactly those six tables to the worker role. No write grant, no RLS, no function. Human-run before `ac-p5` ships its filter.

**AD-13: Group deletion guard (AC-15; amends D-5).** A group cannot be deleted while it is referenced by an active game or an open tournament.
- *Active game:* attached through `event_groups` (or the legacy `events.group_id`), status not `cancelled`, and not yet ended (`ends_at`, or `starts_at` when there is no end, is in the future). *Open tournament:* references the group (`tournaments.group_id`) and its status is none of `completed`, `cancelled`, `dissolved` (the committee-dissolved terminal state, owner decision 2026-10-18). There is no draft status. The task lists every reference site and the exact status values it used (BP-01).
- Applies to the app's soft delete and to the admin delete path.
- Refusal: HTTP 409, `detail` "This group is used by upcoming games or open tournaments. Cancel or finish them first.", plus additive fields `blocker_count` and `blockers` (up to 20 items of `type`, `id`, `title`, `starts_at`). The caller is a member or a platform admin and can already view these items; nothing else is returned.
- Race: delete locks the group row `FOR UPDATE`, then checks references. Every path that attaches a group (create or edit a game or tournament, `invite-group`, and the recurring-games job in `jobs/recurring_events.py`, which copies a base game's groups into each generated game; the job skips a deleted group, and skips generating a group game left with no group, with a log line) takes `FOR SHARE` on the group row (ascending id) before writing, and refuses a deleted group. Lock order extends AD-4: group row, then membership rows, then event rows.
- Admin hard delete runs the same guard first. If any reference remains at all (including past games), it answers 409 "This group has history and cannot be purged" instead of the foreign-key error (OI-11). A real purge is out of scope.
- D-5's detach and release stay for the references the guard allows (past or cancelled games, where no spot is at stake). No code is removed.

**AD-14: Inviting a group (AC-16, D-9).** `invite_group_members_service` (`events/service.py:582`) authorises only a current member of the group who is also the game's organizer or an owner or admin of the group (owner or admin implies membership). Today an organizer needs no membership. A non-member gets 404 "Group not found", the same answer as for a nonexistent or deleted group, so the route no longer reveals whether a group id exists. Denial creates no invitation and no notification. The rule is declared in `events/policies.py`. If an equivalent group-invitation route exists for tournaments, the same rule applies there, found and reported by the task; the tournament view predicates stay untouched until Phase 6.

**Alternatives rejected**
- *Keep the view rule and only fix the cascade.* The cascade can miss rows (race, legacy data, a new membership path). The predicate must be correct on its own (AC-01).
- *Database row-level security.* Forbidden by P15 (shift-left) and the repo hard rule. The predicate is app-layer.
- *Revoke everything on leave, including direct invitations and organizer adds.* Wrong: those are explicit grants by a person (AC-06).
- *Auto-withdraw tournament registrations on access loss.* Breaks published fixtures and the roster freeze; owner chose (a).
- *Nightly reconcile job now.* Not needed while the predicate is the control (BP-12). Deferred with a measurable gate (§13).
- *Soft-delete membership rows (an `ended_at` column).* Would put history in the operational table and risk readers treating ended rows as active. The audit table keeps history instead.

**Consistency model:** the view predicate is evaluated per request against committed rows (read committed). The cascade runs in the same transaction as the membership change. A reader sees either the old state or the new state, never a mix.

---

## 4. Component / Integration Design

| Component | Change |
|---|---|
| `events/policies.py` | New `can_view_event` per AD-1; `_participant` removed; `_invited` split into direct and group-sourced. One `visible_events_filter`. |
| `events/router.py`, `events/repository.py` | Delete the inline invite check (router :170) and inline pre-filter (repo :64-70); call the policy only. The inline check returns 403 (:192); every denied read becomes 404. |
| `events/service.py` | `release_group_derived_access`, RSVP rule, organizer add writes direct invitation, waitlist promotion eligibility, `set_event_groups` calls the cascade. |
| `groups/service.py`, `groups/router.py` | Remove, leave, role, transfer, add, delete call `record_membership_change` and the cascade hooks inside their transaction. |
| `groups/audit.py` (new) | `record_membership_change`, admin read endpoint. |
| `tournaments/policies.py`, `tournaments/` | AD-1 rule, drop `_registered`, `tournament_registrant_access_lost` notice. |
| `notifications/fanout.py` | Audience filter (AD-6), retraction. |
| `core/realtime`, `events/router.py` stream, `groups/router.py` streams | Periodic re-check (AD-7). |
| `settings_dashboard/service.py`, `users/repository.py` | Route `/settings/participating` (:29-43), `/settings/invitations` (:73-88) and `recent_games` in profile-summary (:262-272) through the visibility policy. `home/service.py` already uses it. |
| `frontend/`, `meetup-mobile` | AD-8, from separate briefs. |

**Endpoint (new):** `GET /groups/{id}/membership-audit?cursor=` and `GET /admin/groups/{id}/membership-audit`. Rule: group owner or group admin of that group, or platform admin. Members and non-members: 404. Paged, rate limited (P17). Rule declared per endpoint in `policies.py`.

**Integration boundaries**

| Boundary | Failure behaviour |
|---|---|
| Cascade inside the membership transaction | Any failure rolls back the whole change; user remains a member; caller sees an error. Never a partial release. |
| Notification fan-out | Existing outbox, at-least-once. A failed filter query fails the job closed (no delivery) and retries. |
| Stream re-check | A failed re-check query ends the stream (fail closed). |
| Realtime broadcast after commit | Best effort; the re-check (AD-7) is the guarantee. |

---

## 5. Data Contracts

### 5.1 Schema (additive; migrations written, not executed)

| Change | Detail |
|---|---|
| `group_membership_audit` (new) | `id UUID PK`, `group_id UUID NOT NULL` (no FK: the group may be deleted), `user_id UUID NOT NULL` (no FK: survives account deletion), `action` (text; app-validated: `added`,`removed`,`left`,`role_changed`,`ownership_transferred`), `actor_user_id UUID NULL` (no FK), `actor_type` (text; app-validated: `user`,`system`,`admin_override`), `old_role`, `new_role` (text or NULL; app-validated), `source` (text, app-validated; exact list fixed by `ac-p1-verify` 4.7: `creator`, `member_invite`, `invite_link`, `leave`, `owner_remove`, `admin_remove`, `admin_override`, `role_change`, `ownership_transfer`; an admin-override removal of an owner writes two rows), `occurred_at TIMESTAMPTZ NOT NULL`, `correlation_id`. Indexes `(group_id, occurred_at)` and `(user_id, occurred_at)`. **No CHECK constraints on this table** (no DB-side validation; values are validated in `record_membership_change`). Only PK, NOT NULL and indexes. No UPDATE or DELETE path in code (P6). |
| `event_participant_actions.action` | The existing CHECK is widened with `access_revoked` (additive; unavoidable, otherwise the insert is rejected). No other new CHECK is added anywhere. Verify the live CHECK first (BP-01). |
| `notifications.notification_deliveries` | `retracted_at TIMESTAMPTZ NULL`. No CHECK widening: `tournament_registrant_access_lost` has no preference toggle and `notification_deliveries.notification_type` has no CHECK (`ac-p1-verify` 4.1). |
| Grants | Read-only SELECT for the worker role on six tables (AD-12). |
| Existing tables | No column removed or retyped. `event_invitations.status` already admits `revoked`. |

Identity columns now: `correlation_id` on audit rows; the cascade is idempotent on `(event_id, user_id)` (a second run finds nothing to release).

### 5.2 Data lineage (one source per field)

| Field | Single source | "If it comes from elsewhere, it is a bug" |
|---|---|---|
| May this user view this game or tournament | the module's `can_view_*` predicate | an inline check in a router or repository, a client filter, or a participant/registration row |
| Is the user in the group | `group_memberships` | a participant row, an invitation status, a notification |
| Why the user has an invitation | `event_invitations.source_group_id` (NULL = direct) | inferring it from timestamps |
| Who changed membership, when | `group_membership_audit` | application logs, `group_memberships.joined_at` |
| Notification recipient eligibility | the predicate at send time | the audience snapshot taken at event creation |
| Tournament registrant lost access | derived by the predicate at read time; the committee notice is a signal, not the source | a stored "ineligible" flag |

### 5.3 Sensitive fields (excluded from logs, metrics, error payloads)

| Field | Handling |
|---|---|
| Audit `user_id`, `actor_user_id` | Ids only; no names, emails or phone copied into the table. Never logged in aggregate metrics. Readable only via the endpoint rules in §4. |
| Notification retraction payloads | Ids only. |
| Reconcile dry-run output | Printed to the human's terminal only; not logged to aggregation. |

---

## 6. Security & Compliance Considerations

**Authorisation (app layer, P15), one policy per resource:**

| Resource | Allowed | Explicitly denied |
|---|---|---|
| Game or tournament read (all paths) | per AD-1 | everyone else → 404 |
| Membership audit read | group owner, group admin of that group, platform admin | members, non-members, other group admins → 404 |
| Cascade functions | internal callers only, no route | any HTTP exposure |
| Reconcile script | human operator with DB access | n/a |

**Threats and controls**
- *Stale grant after leaving* (this incident) → AD-1, AD-2, AD-4; negative tests 1–8.
- *Race: RSVP concurrent with removal* → event row lock first, ascending id (AD-4 step 1); test 9.
- *Open stream or cached rows after removal* → AD-7, AD-8.
- *Enumeration through status codes* → 404 only (AC-11).
- *Audit tampering* → append-only in code, written in the same transaction, admin read only; tampering at the DB layer is the same T1 trust boundary as the rest of the system (flagged, not new).
- *Admin override removal leaves no trace* → audited with `actor_type='admin_override'`.
- *Over-revocation* (a legitimate explicit grant lost) → AD-2 keeps direct invitations and organizer adds; test 5; reconcile dry-run (AD-10) before any change.
- *Public share link* → `/public/events/{id}` stays visibility-agnostic by the shareable-links addendum (Decision 4): the organizer's explicit act, 7 non-identifying fields, no participants, no auth. Documented exception to AC-02 and AC-11 (D-7).

**Compliance (PDPA):** the audit stores ids only. After account deletion the ids cannot be linked to a person, so no erasure action is needed on audit rows (P12). Retention period OI-1. The privacy policy should state that group membership changes are recorded (owner to confirm wording, same item as `meetup-privacy-tnc`).

---

## 7. Failure Modes & Resilience

| Scenario | Behaviour |
|---|---|
| Cascade throws mid-way | Transaction rolls back; membership unchanged; error returned. |
| Concurrent RSVP and removal | RSVP holds the event lock first, so the cascade waits and sees the row (releases it), or the cascade holds it first and RSVP then fails the membership check. No orphan `going` row. |
| Waitlist candidate no longer eligible | Skipped at promotion; next candidate considered. |
| Many affected games | Bounded by the group's upcoming games (T1 scale). Statement timeout from existing config; on timeout the whole change rolls back. |
| Policy bug hides too much | Visible quickly (users report missing games); rollback by redeploy (§11). Over-hiding is the safe failure. |
| Reconcile run twice | Idempotent; second run reports zero changes. |
| Worker down | Fan-out delayed, and the eligibility filter is applied when it runs, so nothing is sent to a user who lost access in the meantime. |
| Tied or unknowable origin of a legacy participant | Conservative rule (AD-10): only `organizer_add` in the action log keeps access; everyone else is released. The dry-run is reviewed by the owner before the real run. |
| Group soft-deleted | D-5: deleted group removed from `event_groups`, game stays `group` if other groups remain, AD-4 release for users who lost their last basis. |

**Lock ordering (mandatory):** group membership row → event rows by ascending id → invitation and participant rows. No code path may invert this. A concurrency test (test 9) asserts no deadlock.

Dead-man detection: there is no new scheduled job. The one-time reconcile is human-run and reports its own counts. A nightly orphan check is deferred (§13).

---

## 8. Observability & Operability

- Correlation id from the request propagates to the audit row, the participant action rows and the retraction.
- Metrics: `access_cascade_total{reason}`, `access_cascade_released_spots_total`, `access_cascade_failed_total`, `stream_access_revoked_total`, `notification_filtered_total{reason="ineligible"}`.
- Alert on a non-zero `access_cascade_failed_total` rate (threshold, not per error). Wording of the threshold set in Phase 1 with current baseline.
- Security-event stream: admin override removals and denied audit reads.
- Logging exclusions: §5.3. No user ids in metric labels.
- Runbook: running the reconcile (dry-run first), reading the audit for an incident.

---

## 9. Test Requirements

Risk classification (blast × exploitability): view policies **High**; cascade **High**; fan-out filter **High**; audit **Medium**; stream re-check **Medium**; reconcile **Medium** (human-run, dry-run).

**Mandated negative tests (P13, API level, DB backstop absent).** For each, assert on list, detail, home counts, search and (where present) stream.
1. A user who leaves a group sees none of its group games, with a prior `going` row, and with a prior `pending`, `accepted` and `declined` group-sourced invitation.
2. Same outcome when the owner removes the user, when a group admin removes the user, and under platform admin override.
3. A game with two attached groups: leaving one keeps access through the other; leaving both removes it.
4. Removing a group from a game (organizer edit) removes access for users who had it only through that group; users with a direct invitation or the organizer keep it.
5. A direct invitee and an organizer-added participant of a group game keep access and can RSVP after leaving or never being in the group.
6. Participant, registration and roster rows alone grant no view (public aside), for games and tournaments.
7. `invite_only` game: a `declined` or `revoked` invitation denies; a pending or accepted one allows.
8. Denied reads return 404 and never 403.
9. Concurrent RSVP and removal: no orphan `going` row and no deadlock.
10. Cascade failure rolls back the membership change.
11. Waitlist promotion skips an ineligible waitlisted user and never exceeds capacity.
12. Notification fan-out sends nothing to a user who lost access between event and send; retraction hides existing items.
13. Tournament: a registered player who loses access sees nothing, the registration row remains, the committee receives one notice, reminders are not sent to the player.
14. Audit: every add, remove, leave, role change, ownership transfer and admin override writes exactly one row; a meta-test fails if a new membership write site skips `record_membership_change`; audit read by a member or non-member → 404; account deletion leaves audit rows.
15. Stream: after removal the open stream receives `access_revoked` and closes within the re-check interval.
16. Reconcile dry-run changes nothing; real run is idempotent; an `organizer_add` participant keeps access.
17. `/settings/participating`, `/settings/invitations` and `recent_games` show nothing the user can no longer view (stale `going` row, stale group-sourced invitation).
18. `invite-group` on an `invite_only` game: the invitee sees it while in the source group and loses it on leaving; a direct invitee keeps it.
19. Group soft delete: members lose view of its upcoming games unless another attached group or a direct invitation applies; a multi-group game stays `group`; derived spots are released.
20. Organizer add over an existing group-sourced invitation clears `source_group_id`; the player keeps access after leaving the group.
21. `realtime_refresh` is not sent to withdrawn participants or declined invitees.
22. Registration in a `group` tournament is refused for a person without a basis (individual or any roster member) and for a `req.user_id` other than the caller.
23. Deleting a group (app and admin path) that has an upcoming `group` game returns 409 with `blockers`; the group, memberships and game are unchanged.
24. Deleting a group whose only games are cancelled or past succeeds; detach and release behave as in test 19.
25. A group tournament in `registration_open` or `registration_closed` blocks deletion; `completed`, `cancelled` or `dissolved` does not.
26. Concurrent delete and attach (create or edit a game): exactly one wins, a deleted group is never attached to an active game, no deadlock.
27. `invite-group` by an organizer who is not a group member returns the same 404 as a nonexistent group; no invitation and no notification is created.
28. `invite-group` by an organizer who is a member, and by a group owner or admin who is not the organizer, still succeed.
29. Admin hard delete of a group with any game reference returns 409, not a database error; nothing is deleted.
30. Recurring-games job: with the group deleted before generation, the generated game is not attached to it (a game left with no group is skipped and logged); with the group alive, generation is unchanged.

**Other:** v1 tournament and existing game regression suites run unchanged and green except tests that asserted the old rule (listed and justified in the implementation report); migration up and down on a copy.

---

## 10. Implementation Phases

Migrations are written per phase; the human runs them. Each phase ends with an implementation report (as-built schema and deviations) written back here (BP-13). Phases 2 and 3 deploy together.

| Phase | Content | Acceptance |
|---|---|---|
| 1. Verify | BP-01: live CHECKs (`event_participant_actions.action`, `notification_type`), the write sites in AD-9, `groups/service.py:336`, stream loop, which lists and counts bypass the policy (home, settings_dashboard, groups pages), group delete behaviour, team roster registration path (AD-5 gate) | Schema and code facts recorded; OI-4, OI-5, OI-8 answered |
| 2. View rule (games only) | AD-1, AD-2 (organizer add invitation, RSVP), remove duplicate inline rules, 404 everywhere, settings and profile paths. `tournaments/policies.py` untouched | Tests 1–8 (view part), 5–7, 17, 18, 20 |
| 3. Cascade | AD-4 with callers, waitlist promotion eligibility, group soft delete (D-5) | Tests 2–4, 9–11, 19 |
| 4. Audit | Table, `record_membership_change`, all write sites, read endpoint | Test 14 |
| 5. Notifications and streams | AD-6, AD-7, AD-12 (grants migration run by the owner first) | Tests 12, 15, 21 |
| 6. Tournaments | AD-5 in order: (1) registration basis rule and caller check, (2) tournament reconcile script, human-run, (3) view predicate without `_registered` and the registrant notice. Step 3 ships only after the owner confirms step 2 ran | Tests 13, 22 |
| 7. Clients | Web and mobile refetch rule (AD-8), from separate briefs | e2e: removed user's list shows nothing after reopening |
| 8. Reconcile and enable | Script, dry-run, owner review, real run | Dry-run reviewed; counts zero on second run |
| 9. Group guards (tasks `ac-bug-2`, `ac-bug-2b`) | AD-13, AD-14; `ac-bug-2b` covers the recurring-games job. Independent of phases 4 to 8; may ship any time after phases 2 and 3 | Tests 23-29 (`ac-bug-2`, merged as PR #50), test 30 (`ac-bug-2b`) |

---

## 11. Deployment & Rollback

- Migration (audit table, CHECK widenings, `retracted_at`) → api → worker. Phases 2 and 3 ship together so no window exists where access is hidden but spots are not released.
- Rollback is a code redeploy. The old rule would re-widen visibility until redeployed again; accepted as a temporary state. Data effects of the cascade (withdrawn spots, revoked invitations) are **not** reversed by rollback; they are recorded in `event_participant_actions` (`access_revoked`) and the membership audit, which is enough to restore by hand if ever required.
- The reconcile (AD-10) is a separate human step after deploy, dry-run first.
- No backfill of historical membership changes is possible (R-2). The audit starts at deploy; current members get no synthetic history.

---

## 12. Principles & Best-Practices Compliance

| Principle | Design element | Status |
|---|---|---|
| P1 Config-driven | AD-11, startup validation | Met |
| P2–P4 | Baseline; §8 | Unchanged / Met |
| P5 Idempotency | Cascade and reconcile idempotent | Met |
| P6 Immutable context | Audit append-only; action log rows | Met |
| P7 Fault isolation | Fail-closed filters, rollback on cascade failure | Met |
| P9 Validate at boundary | Server-side predicate; clients are UX only | Met |
| P10 Least privilege | Audit read limited; cascade has no route | Met |
| P12 Retention | OI-1 resolved: 12 months default, config-driven | Met |
| P13 Negative tests | §9, tests 1–16 | Met |
| P14 Additive evolution | §5.1, §11 | Met |
| P15 Shift-left authz | AD-1 (one predicate at the entry point, applied to list, search, stream); no RLS | Met; **closes the P15 gap found on the list and stream paths** |
| P16 | Baseline | Unchanged |
| P17 Rate limits | Audit read endpoint | Met |
| BP-01 Verify schema | Phase 1; code facts carry file and line | Planned |
| BP-03 Consistency | §1 ↔ §13 mapping | Met |
| BP-09 Canonical source | §5.2 lineage; duplicate inline rules removed | Met |
| BP-10 Measurable gates | §13 | Met |
| BP-12 T1 simplicity | No new service, queue, flag on the rule, or job | Met |
| BP-13 Write-back | Per-phase reports | Planned |

**Deliberate deviations (flagged)**

| # | Deviation | From | Rationale |
|---|---|---|---|
| D-1 | Supersedes the 2026-10-13 keep-access rule | Owner rule of 2026-10-13 | Owner principle of 2026-10-18: no access means no view, whoever ended it |
| D-2 | Removes the `_registered` view branch added in lifecycle v1.2.2 | Lifecycle addendum v1.2.2 (owner-approved implementation ruling) | AC-03 and AC-07: participation rows must not grant view. Needs the Phase 1 gate (AD-5) |
| D-3 | Requirements restated in-document, not an approved REQ addendum | `solution-design` precondition | Process note 1 |
| D-4 | Organizer keeps access to a game they created after leaving an attached group (OI-2) | AC-01 literal reading | Authorship is an explicit relationship; the organizer cannot be locked out of their own game |
| D-5 | Group soft delete: deleted group removed from `event_groups`; game stays `group` if other groups remain; view rule checks `groups.is_deleted` | Current behaviour (`groups/service.py:235`, `groups/repository.py:129-143`) | AC-04: deleting a group must end access like any other removal; today members keep view and multi-group games lose their other groups |
| D-6 | AD-1 `invite_only` accepts group-sourced invitations while the user is in the source group | AD-1 v1.0 text (\"direct only\") | `invite-group` already creates them; AC-04 requires leaving the group to end that access |
| D-7 | `/public/events/{id}` stays visibility-agnostic | AC-02 and AC-11 as written | Approved exception in the shareable-links addendum (Decision 4); organizer's explicit act; 7 non-identifying fields; no participants |
| D-8 | Worker role gets read-only SELECT on six tables | Repo rule: grant changes need prior sign-off | Needed to run the AD-6 filter in the worker; signed off 2026-10-18 |
| D-9 | `invite-group` now requires the caller to belong to the group; group deletion is refused while active games or open tournaments reference it (amends D-5) | OI-9 "no change to `invite-group`"; D-5 (deletion ends access through the cascade) | Owner, 2026-10-18: inviting a random individual is fine, contacting a random group is not; and a group in active use must not disappear under its players |

---

## 13. Requirements Coverage and Deferred Decisions

| Requirement | Section |
|---|---|
| AC-01, AC-03, AC-11 | AD-1 |
| AC-02 | AD-1, AD-6, AD-7, AD-8, Phase 1 audit of lists |
| AC-04, AC-05 | AD-4 |
| AC-06 | AD-2 |
| AC-07 | AD-5 |
| AC-08 | AD-6 |
| AC-09 | AD-7 |
| AC-10 | AD-8 |
| AC-12 | AD-9, §5.1 |
| AC-13 | AD-10 |
| AC-14 | §9 |
| AC-15 | AD-13 |
| AC-16 | AD-14 |

**Deferred decisions (BP-10)**

| Deferred | Why | Gate to revisit |
|---|---|---|
| Nightly orphan-eligibility check (worker job with dead-man alert) | The predicate is the control; a job adds moving parts at T1 | Any orphan found by the AD-10 dry-run, or any user report of seeing content after access ended, or `access_cascade_failed_total` above zero in 7 days |
| Membership audit export or UI beyond the read endpoint | Not requested | Owner requests, or more than 20 audit reads per week |
| Audit backfill of past membership | Source data does not exist | None |
| Recall of delivered push notifications | Platform limitation | Not possible |

---

## 14. Open Items

On approval (2026-10-18) the owner accepted the proposed defaults for OI-1, OI-2, OI-3, OI-4 (subject to the Phase 1 check), OI-7 and OI-8.

| ID | Item | Severity | Status |
|---|---|---|---|
| OI-1 | Audit retention 12 months (config); readable by group owner, group admins of that group and platform admin. Privacy-policy wording to follow (`meetup-privacy-tnc`). | 🟡 MEDIUM | Resolved |
| OI-2 | If an organizer is no longer in an attached group, they keep access and control of their own game (D-4). | 🟡 MEDIUM | Resolved |
| OI-3 | A player's own counters and tournament record (Played, Won, owner-only record) are their own data and stay after access ends. Game and tournament detail do not. | 🟢 LOW | Resolved |
| OI-4 | Group deleted. Decision D-5 (AD-4). | 🟡 MEDIUM | Resolved |
| OI-5 | Phase 1 gates (streams, lists, roster path). Answered by `ac-p1-verify`; the gate decision is in AD-5. | 🟠 HIGH | Resolved; live counts are OI-10 |
| OI-6 | The Project copy of the tournament lifecycle addendum was v1.1; the repo holds v1.2.2. Sync the Project copy. | 🟡 MEDIUM | Open, non-blocking (architect) |
| OI-7 | RSVP for direct invitees of group games follows the 2026-10-17 invite decision (AD-2). | 🟡 MEDIUM | Resolved |
| OI-8 | Source values and the exact action list for the audit table are fixed by the Phase 1 verification of the write sites. | 🟢 LOW | Resolved, fixed in Phase 1 |
| OI-9 | `invite-group` creates group-sourced invitations on any game visibility. Decision: AD-1 applies the group-sourced rule on every class; no change to `invite-group` (D-6). | 🟡 MEDIUM | Resolved |
| OI-10 | Live counts of registrants with no basis: queries G1–G3 in the `ac-p1-verify` report section 4.9, run by the owner. Gates Phase 6 step 3. | 🟠 HIGH | **Open; gates Phase 6 step 3** |
| OI-11 | Admin hard delete of any group that ever had a game fails on foreign keys. v1.3 (AD-13): it now refuses with a clear 409. A real purge stays out of scope. | 🟢 LOW | Partly resolved |
| OI-12 | `register_participant` has no `req.user_id == caller` check for `group`/`public` tournaments. Separate bug brief AC-BUG-1; AD-5 step 1 depends on it. | 🟠 HIGH | Separate task |

Status: **APPROVED v1.4** (D-5 to D-9 approved by the owner 2026-10-18). No blocking items for Phases 2–5, 7, 8. Phase 6 step 3 is gated on OI-10.

---

## 15. Risks & Mitigations

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Over-revocation: a legitimate participant loses access or spot | Explicit grants kept (AD-2); reconcile dry-run reviewed by the owner; audit and action log allow manual restore |
| R-2 | No history for membership changes before deploy | Accepted; audit starts at deploy |
| R-3 | A push notification already on a device still shows the old title | Accepted; cannot be recalled; the deep link returns 404 |
| R-4 | A list or count path was missed and still bypasses the predicate | Phase 1 audit of every list; negative tests on each path; meta-test over declared routes |
| R-5 | Tournament registrants lose view while still playing | Committee notice and normal two-person approval (AD-5); owner decision (a) |
| R-6 | Cascade on a very large group is slow | Bounded by the group's upcoming games at T1; statement timeout rolls back whole change |

---

## 16. Review Log

| Version | Date | Note |
|---|---|---|
| v0.1 | 2026-10-18 | First draft. Requirements stated by the owner 2026-10-18 and tournament decision (a) accepted. Incident analysis and code reading recorded in process note 4. |
| v1.0 | 2026-10-18 | Approved by the owner as drafted. Proposed defaults for OI-1–4, 7, 8 accepted; Phase 6 remains gated on OI-5. §14 and Status updated; no design content changed. |
| v1.1 | 2026-10-18 | Owner constraint (no DB-side validation): removed the CHECK constraints from the new `group_membership_audit` table; values are validated in application code. Existing CHECKs are only widened where the insert would otherwise fail. Status stays APPROVED, Phase 6 still gated on OI-5. |
| v1.2 | 2026-10-18 | Owner decisions after `ac-p1-verify` (PR #47): AD-5 gate decision and order, D-5 group soft delete, D-6 group-sourced invitations on every class, D-7 public share exception, D-8 worker grants (AD-12), no preference CHECK widening. Added AD-12, tests 17–22, OI-9 to OI-12. Corrected `notifications` to `notifications.notification_deliveries` and the audit `source` list. Phase 2 is games only; tournament view change moves to Phase 6 step 3. |
| v1.3 | 2026-10-18 | Owner decisions: a group cannot be deleted while active games or open tournaments reference it (AC-15, AD-13, amends D-5); inviting a group's members requires membership of that group (AC-16, AD-14, D-9). Tests 23-29, Phase 9 (`ac-bug-2`). Repaired the v1.2 edit, which had dropped rows D-4 and OI-8 and left two tables malformed (BP-03). Approved by the owner as proposed. |
| v1.4 | 2026-10-18 | After PR #50 (`ac-bug-2`): the recurring-games job added to the AD-13 attach paths (a gap in the v1.3 list, found by the implementing agent); tournament status list corrected from the code (`registration_open`, `registration_closed`, `completed`, `cancelled`, `dissolved`; no draft; `dissolved` closed by owner decision); test 30 and task `ac-bug-2b`. Approved by the owner. |
