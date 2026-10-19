# DES-MEETUP-ADDENDUM-TOURNAMENT-LIFECYCLE

**Doc ID:** DES-MEETUP-ADDENDUM-TOURNAMENT-LIFECYCLE
**Version:** v1.3 (amends v1.2.2; review rounds 1–10: see §15)
**Status:** v1.1 APPROVED (owner, 2026-10-14). **v1.2 APPROVED (owner, 2026-10-16). v1.2.1 (`my_invitation_status`) APPROVED (owner, 2026-10-16). v1.2.2 (implementation rulings) APPROVED (owner, 2026-10-16). v1.3 (creation wizard, +/− controls) APPROVED (owner, 2026-10-19).** Non-blocking open items remain in §14 (OI-5–OI-9, OI-12–OI-16).
**Owner:** Pratheesh
**Date:** 2026-10-19
**Scale Tier:** T1
**Baseline:** `DES-MEETUP.md` v1.75 (read from repo). Design-only addendum, same pattern as `DES-MEETUP-ADDENDUM-event-reminder.md`. Does not edit the baseline.
**Governing files:** `Enterprise_Design_Principles.md` v1.1 (P1–P17), `design-best-practices.md` v1.0 (BP-01–BP-13).
**Visual source:** Design canvas, sections "Tournament creation wizard", "Tournaments: player view…", "committee, fixtures and approvals", "brackets, results, standings and close-out", "Notifications and admin console".

**Process notes (flagged, not silent):**
1. No formal `REQ-MEETUP` addendum exists for this feature. Requirements were elicited in conversation (2026-10-14) and are restated in §1 as proposed IDs `TL-01…TL-70`. Same departure the event-reminder and shareable-links addenda recorded. Approve §1 together with this document, or route §1 into `REQ-MEETUP.md`.
2. `solution-design` references `PRINCIPLES.md` P1–P23. The Project's authoritative file is `Enterprise_Design_Principles.md` v1.1 (P1–P17). P1–P17 are used. P18–P23 were not available.
3. Part A of §10 (groups and games) is a lightweight design so that work can start before this document is approved.
4. **v1.2 requirement changes** (owner decisions, 2026-10-16) are restated in §1 as TL-09 to TL-13 (rewritten), TL-38 (amended), TL-40 (amended) and new TL-71 to TL-73. Same departure as note 1; approved with this version.
5. **Visual source for share and invite.** The canvas boards `TPShareSheet`, `TPInviteGroups`, `TPInviteGroupsCap` and `TPInviteSent` show the v1.1 behaviour (per-tournament link, share sheet). They are superseded by v1.2 and have not been redrawn. Until they are, the visual source is the existing game screens (web `openInviteGroupModal` and the individual-invite search on game detail; the mobile game detail invite and share UI as it was before commit `5f04b95`).

6. **v1.3 requirement changes** (owner decisions, 2026-10-19) are restated in §1 as TL-14 and TL-19 (amended) and new TL-74 to TL-82. Same departure as note 1; approved with this version. The Design canvas boards for the creation wizard are not redrawn until the owner confirms, per his standing instruction; the text of AD-18 and AD-19 governs until then.

---

## Plain-language summary

Tournaments get a complete lifecycle: an organizer creates one from an admin-defined **format** (knockout, round robin, or groups then knockout), invites groups and people, and sets two cut-off dates. Before the **soft block** players register themselves. Between soft and **hard block** only the committee can add players, one by one. After the hard block nothing changes and the committee can make fixtures.

Every tournament has a **committee of at least 2**. The creator is member 1. Big decisions need a second member to approve: publishing fixtures, publishing standings, disqualifying, dissolving, changing the committee. No OTP. Entering a score needs one member and is logged.

Fixtures are made by a **deterministic generator**. The committee reviews the draft and types plain-language comments ("keep Ravi and Daniel apart"). An AI only **translates** the comment into structured rules, shows "I understood: …", and nothing changes until the committee confirms. The generator then applies the rules. Match times and courts are suggested by the program and editable.

Results advance winners automatically. Reminders go out at 2 days, 1 day and 2 hours. A player's full record is visible only to that player. The committee closes the tournament with private feedback.

Existing tournaments keep working as today (a `lifecycle_version` fork, AD-2), except that invitations (AD-4, v1.2) apply to them too. Nothing is migrated destructively.

### v1.1 amendment (what changed)

1. **Release 1 uses Excel upload for fixtures.** The first release does not generate fixtures in the system. The committee builds fixtures outside, fills the downloadable template (a frozen roster with registration IDs), and uploads it. The system checks the file, makes a draft from it, and the existing two-person approval publishes it. The generator, AI interpreter and planner (AD-8, AD-9 generation) are **unchanged and deferred to Release 2**, behind a flag. The end state is not reduced. (The canvas calls these Phase 1 and Phase 2. "Phase" in §10 Part B already means build phase, so this document says Release.)
2. **One navigation rule for every signed-in page** (AD-16). The bottom bar (mobile) and the left rail (web) never disappear, including in wizards and the committee console.
3. New AD-17 (upload import), requirements TL-63–TL-70, schema columns on `tournament_fixture_drafts`, three config keys, tests 26–34, Releases in §10, OI-9, review round 5.

### v1.2 amendment (what changed)

1. **Share is the app link.** The Share action sends the app or Play Store link (the single `/public/share` redirect) with system share, WhatsApp and copy link, exactly as games do. There is no per-tournament link, no token and no link-based access. (Supersedes the v1.1 share link: TL-13, AD-4.)
2. **Invitations follow the game model.** A tournament gets the same invitation mechanism as a game: invite a group (one invitation per member), a person, or an email address; the invitee accepts or declines; the organizer lists and revokes. (Supersedes the v1.1 invitation table and group-level invitation rows.)
3. **Who can invite.** The organizer and active committee members always. On **public** tournaments any user who can see the tournament may also invite individuals, and may invite a group they own or administer. On group and invite tournaments only the organizer and committee invite. Invitations close when registration closes.
4. **Visibility is unchanged:** `public`, `group`, `invite`. No `private` value, no visibility migration.
5. **Existing (v1) tournaments get invitations too**, behind a flag. The one v1 behaviour change: on an `invite` tournament, an invited person who has accepted may register themselves (today only the organizer registers people).
6. Housekeeping: the §10 inconsistency about when v2 creation is enabled is fixed (Phase 10). New TL-71 to TL-73, config keys, tests 35–42, OI-12, OI-13, deviations D-6 and D-7.

### v1.3 amendment (what changed)

1. **Creation wizard (AD-18).** Step 3 captures start and end dates and times, the registration closure date (the soft block) and the hard block date. Step 4 chooses multiple groups. Step 6 adds committee members through the normal player search: the organizer is member 1 and at least one more is required. Step 7 reviews everything and submits once, in one atomic, repeat-safe request.
2. **"+" and "−" instead of Invite buttons (AD-19).** Every Invite button for a person or group, on web and mobile, across games, groups and tournaments, becomes "+". A staged addition shows "−" until submitted. A sent invitation shows its status. Who may invite, the windows and the caps do not change.
3. New TL-74 to TL-82, two config keys, one table, one column, tests 43–52, phases C and P, OI-15, OI-16, review round 10.

---

## 1. Requirements baseline (proposed, from 2026-10-14 elicitation)

| ID | Requirement |
|---|---|
| TL-01 | Participation mode (individual or team) is chosen at creation and never changes. |
| TL-02 | Formats are admin-defined templates on top of supported algorithms: knockout, round_robin, group_stage. |
| TL-03 | A template's rules are snapshotted into the tournament at creation. Later template edits never affect it. |
| TL-04 | The organizer may override only the template fields listed in `organizer_overrides`, within limits. |
| TL-05 | Free-text extra rules are display-only. Anything affecting scoring or pairing is a structured field. |
| TL-06 | Group stage: qualifiers (groups × qualify per group) must be 2, 4, 8 or 16. Group sizes may differ by one. |
| TL-07 | The knockout bracket skeleton is created with placeholders that fill when group standings are published. |
| TL-08 | Draw resolution in knockout is a template setting: penalties or committee decides. Set-based sports never draw. |
| TL-09 | Visibility keeps its three values: `public`, `group`, `invite`. No `private` value. Any invitation grants visibility, as for games. (v1.2, replaces v1.1 text) |
| TL-10 | Until registration closes, the organizer and active committee members may invite individuals and groups. On **public** tournaments any user who can see the tournament may also invite individuals. On group and invite tournaments only the organizer and committee invite. No approval is needed. (v1.2, replaces v1.1 text) |
| TL-11 | Group invites follow the game rule: the organizer or committee may invite any group; any other inviter (public tournaments only) must own or administer that group. A group invite creates one invitation per current member (a snapshot, as for games). The tournament-wide cap is 20 distinct groups (config). (v1.2, replaces v1.1 text) |
| TL-12 | The organizer and active committee members see who invited whom and may revoke a pending invitation. Other inviters cannot list or revoke. (v1.2, replaces v1.1 text) |
| TL-13 | Share is the app or Play Store link (the single `/public/share` redirect), with system share, WhatsApp and copy link, exactly as for games. It carries no tournament identity and grants no access. Shown to the organizer and active committee members always, and to any viewer of a public tournament while registration is open. (v1.2, replaces v1.1 text) |
| TL-14 | Dates: registration closes (soft block) ≤ hard block, and hard block + minimum gap ≤ start. Captured at creation in wizard step 3 (TL-74, TL-75). (v1.3: restated; the rule is AD-5's.) |
| TL-15 | Before the soft block: self-registration plus committee add. Soft to hard: committee adds individuals only. After hard: no add, change or withdrawal. |
| TL-16 | Fixtures can be generated only after the hard block. |
| TL-17 | Team mode: the player creates a tournament team or picks one they belong to. Any active member may register it. Roster frozen at the hard block. On `invite` tournaments every roster member must hold an accepted invitation (AD-4, v1.2). |
| TL-18 | Template has `team_size` min/max. Registration enforces it and requires every member to have a skill level. |
| TL-19 | Committee minimum 2. Creator counts as 1. Other members are `invited` and become `active` only by accepting (consent). Enforced on removal; fixture generation requires ≥2 active. At creation the organizer is member 1 and must add at least one more (TL-78). (v1.3) |
| TL-20 | Maker-checker (two distinct members) applies to: fixture publication, standings publication, disqualification, dissolution, committee changes. |
| TL-21 | Score entry needs one committee member and is logged (who, when, what). |
| TL-22 | OTP step-up is removed from tournament committee approvals. Platform admin approval flows are unchanged. |
| TL-23 | Fixture review: committee writes free text. AI converts it to structured constraints (swap, pin, keep apart, time or venue slot). |
| TL-24 | App shows "I understood: …" and requires confirmation before anything changes. |
| TL-25 | A deterministic generator applies constraints. A validator rejects conflicts. The AI never writes fixtures. |
| TL-26 | If the AI is down, nothing changes and manual edit stays available. |
| TL-27 | The AI provider receives pseudonymous IDs and skill scores. Calls are logged. Regenerations are capped (config). Privacy policy and T&C name the provider. |
| TL-28 | Scheduling: program suggests match times from window, daily hours, one venue with N courts, match length, changeover, minimum rest. Fit check reports shortfall. |
| TL-29 | Committee may edit time, venue and court per match. Conflicts (double-booking, court overlap, round order, outside window) block the save with a reason. |
| TL-30 | A time change after publication updates reminders and notifies participants. |
| TL-31 | Reminders at 2 days, 1 day and 2 hours before each match, to players or teams and committee members. Only once both sides are known. Past-due reminders are skipped. |
| TL-32 | Committee enters set scores (winner derived), a full-time score, or a shoot-out score. Winner advances automatically. |
| TL-33 | A correction that changes a winner is blocked once the next match was played. |
| TL-34 | Each player's record keeps every match, score and tournament outcome, visible to that player only. Others see standings and fixtures. |
| TL-35 | Final standings are published by two-person approval. Then the committee enters feedback and the tournament becomes completed. |
| TL-36 | Feedback is committee-only. Any one member may switch on showing it to players. The platform admin does not see it by default. |
| TL-37 | Walkover and disqualification are the only tools after the hard block for no-shows. |
| TL-38 | Notifications for: invite, added by committee, reminders, time change, fixtures published, result, approval request and outcome. (v1.2: no notification on invite revoked, as for games.) |
| TL-39 | Admin console manages format templates (create, version, publish, retire) and tournament settings. Organizers never see it. |
| TL-40 | Existing tournaments keep their current behaviour, except TL-71 to TL-73 (v1.2). |
| TL-41–TL-62 | Groups and games items 1–5 (Part A, §10). |
| TL-63 | Release 1: fixtures come from an uploaded `.xlsx`. The system does not generate fixtures in Release 1. (v1.1) |
| TL-64 | The committee downloads a template pre-filled with the frozen roster (registration IDs, names) and the tournament window. Players are matched by registration ID, never by name. (v1.1) |
| TL-65 | An upload that fails any check is rejected whole with row-level reasons. Nothing is saved as a draft. (v1.1) |
| TL-66 | A passing upload becomes a draft with `source=upload`. Uploader, time, filename and file hash are kept. Publication approval (TL-20) is unchanged. (v1.1) |
| TL-67 | Replacing the file creates a new draft version and makes any open publication request stale. (v1.1) |
| TL-68 | The committee may still edit single matches (time, venue, court) under TL-29 rules. (v1.1) |
| TL-69 | Web and mobile both offer the upload flow. Web is the primary surface for fixtures. (v1.1) |
| TL-70 | Navigation: on every signed-in page the persistent navigation is visible. Mobile bar: Home, Groups, raised +, Games, Profile. Web: the equivalent left rail. Tournaments sit inside Games as a Games / Tournaments switch. Sticky action footers sit above the bar. (v1.1) |
| TL-71 | Invitations apply to every tournament, v1 and v2, behind `meetup.tournament.invitations.enabled`. Visibility values stay `public`, `group`, `invite`. (v1.2) |
| TL-72 | An invitation by email works for people without an account: the emailed link claims the invitation at sign-up, as for games. Accepting an invitation to an `invite` tournament makes the invitee eligible to register; it does not register them. (v1.2) |
| TL-73 | Invitations are accepted only while registration is open. After that the committee adds individuals (TL-15). (v1.2) |
| TL-74 | Wizard step 3 captures start date, end date, start time, end time, registration closure date and time (the soft block) and hard block date and time. Start time and end time are also the daily playing window. (v1.3) |
| TL-75 | Date rules, checked server-side in this order, each with a reason code: all instants in the future; start before end; daily start time before daily end time; closure ≤ hard block; hard block + minimum gap ≤ start. (v1.3) |
| TL-76 | Wizard step 4 lets the organizer choose multiple groups (1 to 20, config) from groups the organizer belongs to. (v1.3) |
| TL-77 | The selected groups scope visibility: a current member of any selected group can view the tournament. Selecting groups creates no invitations. (v1.3) |
| TL-78 | Wizard step 6 adds committee members through the standard player search, showing suggested and other players. The organizer is committee member 1 by default and cannot be removed. At least one additional member is required. (v1.3) |
| TL-79 | Wizard step 7 shows a review of everything entered, with a way back to each step, and one submit. Creation is atomic. (v1.3) |
| TL-80 | Submitting twice creates one tournament. After a successful submit the app shows a completion screen summarising the submitted fields. (v1.3) |
| TL-81 | Every Invite button for a person or group, on web and mobile, across games, groups and tournaments, becomes "+" (add or invite). A staged addition shows "−" (remove) until submitted. A sent invitation shows its status instead. (v1.3) |
| TL-82 | The "+" and "−" controls have accessible names from admin-managed labels and a touch target of at least 44 pt. (v1.3) |

---

## 2. Scope & Constraints

**In scope:** backend (`~/meetup`): schema additions, services, endpoints, jobs, config, notification types, admin template CRUD. Part A groups/games. **v1.1:** web (`frontend/`) and mobile (`~/Developer/meetup-mobile`) UI for the Release 1 upload flow and the navigation rule (AD-16, AD-17); built from separate build briefs (`docs/briefs/`). **v1.3:** the same for the creation wizard (AD-18) and the "+" and "−" controls (AD-19); the controls also touch the games and groups screens (UI only).

**Out of scope:** replay of drawn matches, multi-venue scheduling (venue is per-match override only), payments/fees, umpire assignment, chat.

**Constraints**
- Migrations are written, never executed by agents. Human runs them (`CLAUDE.md`).
- Additive only (P14). No RLS scripts, no new DB-side validation beyond what exists. Authorization lives in the app layer (P15).
- Zero sibling imports between modules is enforced. `decision_key` stays the one cross-boundary exception.
- Existing committee machinery is heavily reviewed (7+ external rounds). It is **extended through new code paths, not rewritten** (AD-7).
- Tier T1: one Postgres, one api process, one worker process.

---

## 3. Architecture Decisions

**AD-1 — Extend the `tournaments` module; no new service.** New code goes in `tournaments/` (templates, fixture engine, results, invitations, closeout) and `jobs/` (reminders). Rejected: a separate tournament-v2 module, because it would duplicate registration, committee and notification plumbing and break the zero-sibling-import rule when reusing it.

**AD-2 — `lifecycle_version` fork.** `tournaments.lifecycle_version SMALLINT NOT NULL DEFAULT 1`. Existing rows stay 1 and keep today's behaviour (organizer-only schedule/result endpoints, six-action committee with OTP, `group`/`invite` visibility). New tournaments are created as 2. Every new rule below applies to version 2 only, **except AD-4 (invitations, v1.2)**, which applies to both versions behind `meetup.tournament.invitations.enabled`. Rejected: migrating live tournaments. A tournament mid-flow with a 1-member committee cannot satisfy the 2-member rule, and `invite` tournaments rely on organizer-only registration. Contract phase (removing v1 paths) is a later, separately gated change once no non-terminal v1 tournament exists (measurable gate, §11). *This resolves the earlier open question about live invite-only tournaments.*

**AD-3 — Format templates are data, algorithms are code.**
- `tournament_format_templates` (versioned, `draft → active → retired`) holds `definition JSONB`, validated by a Pydantic `TemplateDefinition` (schema_version 1) and an **algorithm registry** (`knockout`, `round_robin`, `group_stage`) that declares which definition fields each algorithm accepts.
- At creation the chosen template version plus the organizer's overrides are resolved into `tournaments.rules_snapshot` (immutable after create; app-enforced, plus `locked_at` pattern already used by `tournament_structured_rules`).
- Validation at template publish: entrants min ≤ max, team_size min ≤ max, every `group_stage.options` entry yields qualifiers ∈ {2,4,8,16}, override limits inside absolute bounds, and `draw_resolution` required for any score-based (non-set) knockout template (set-based sports never draw).
- Rejected: free-form rule engine or expression language (unbounded test surface, no concrete requirement); one table per algorithm (schema churn per new format).
- Template publish/retire is **single-admin, audited** in `admin_action_log`. Not destructive: retire never touches running tournaments. OI-1 closed: single-admin retained.

**AD-4 — Invitations follow the game model; share is the app link (v1.2).** Supersedes v1.1 AD-4 (Public/Private visibility, share token, access grants, `?t=` redemption, group-level invitation rows).
- **Visibility is unchanged.** `tournaments.visibility` stays `public | group | invite`. No `private` value and no CHECK change.
- **`tournament_invitations` mirrors `event_invitations`:** id, tournament_id, invitee_user_id (NULL for an unclaimed email invitation), source_group_id, status (`pending`, `accepted`, `declined`, `revoked`, `expired`), invited_by_user_id, invited_at, responded_at, expires_at, invited_email; UNIQUE(tournament_id, invitee_user_id). Duplicate email invitations are rejected in the application, not by a new constraint.
- **Who may act:**

| Action | `public` tournament | `group` or `invite` tournament |
|---|---|---|
| Invite an individual (user or email) | organizer, active committee member, or any user who can view the tournament | organizer, active committee member |
| Invite a group | organizer or active committee member (any group); any other viewer who owns or administers that group | organizer or active committee member (any group) |
| List invitations, revoke a pending one | organizer, active committee member | organizer, active committee member |
| Accept or decline | the invitee | the invitee |

  "Active committee member" means `committee_memberships.status = 'active'`, for v1 and v2 rows. `invited` members have no rights. A tournament with no committee rows has the organizer only. The group rule is the game rule (organizer, or owner or admin of that group), which is narrower than v1.1's "groups they belong to".
- **Window.** Every invitation route is accepted only while `invites_open(tournament, db_now)` is true: v2 → `registration_phase = open` (AD-5); v1 → `status = 'registration_open'` and (`registration_closes_at` is NULL or DB `now()` is before it). Otherwise `409 INVITES_CLOSED`. **v1.2.2:** this applies to invite, respond and revoke. `GET …/invitations` (organizer and active committee, TL-12) is a read and stays available after registration closes. After the soft block the committee adds individuals (AD-6).
- **Group invite = snapshot.** One invitation per current member, `source_group_id` set, the organizer skipped, existing rows skipped (idempotent), a notification per new row. The bulk insert is sorted by `invitee_user_id` ascending so that concurrent inserts take foreign-key locks in one order (v1.2, review round 7). Later joiners are not invited and leavers keep their row, as for games.
- **Cap.** The number of distinct `source_group_id` over non-revoked invitations of a tournament is at most `meetup.tournament.group_invite_cap` (20). Checked under `pg_advisory_xact_lock(hashtextextended('tinv:'||tournament_id,0))`, held only for the count-and-insert (not a lock on the `tournaments` row: `FOR UPDATE` on the parent conflicts with the `FOR KEY SHARE` taken by every child insert and would stall registrations). A per-user cap, `invite_per_user_cap`, limits how many invitations a user who is not organizer or committee may create per tournament.
- **View rule (`can_view_tournament`, one rule for v1 and v2).** The existing branches (public, organizer, member of any audience group (AD-18, v1.3; for v1 rows, the single `group_id`), **registered (a registration row for the user or, in team mode, a roster membership; v1.2.2: implemented for v2 so that a player added by the committee can open the tournament, and preserved for v1)**, active committee, admin) plus a user holding an invitation that the **game view rule** treats as granting visibility. Phase 1 reads the game rule, records which statuses it accepts, and mirrors them (BP-01); the working assumption is `pending` and `accepted`. Denial responses are unchanged: v1 keeps its existing 403 messages, v2 keeps 404 hiding. The un-wired Phase 1/2 skeleton in `tournaments/policies.py` (`_member_of_invited_group`, `_active_user_invitation`, `_access_grant`, the `kind`-based `tournament_invitations` stub and `can_view_tournament_v2`) is rewritten in Phase 3 to this rule. The list endpoint applies the same rule in its application query (P15: scoping is never left to the data store).
- **Registration eligibility** (replaces the v1 check in `register_participant`, "Only the organizer can register participants for invite-only tournaments"). `invite` tournaments: the organizer or an active committee member may register participants as today; a user may register themselves only with an `accepted` invitation. Accepting does not register (as for games: eligibility, then a separate action). `group`: group membership as today; an invitation grants visibility only. `public`: open. Team mode (v1.2, review round 7): the registering user and **every roster member** must hold an accepted invitation. Otherwise `409 ROSTER_MEMBER_NOT_INVITED`, naming the first member who lacks one (same pattern as the skill-level check, TL-18). The organizer or an active committee member registering a team is exempt, as for individuals.
- **Email invitation.** `invited_email` set, `invitee_user_id` NULL. The emailed link is `{origin}/#tournament-detail/{tournament_id}?invite={invitation_id}`. Sign-up and OAuth claim it atomically through the same `invite` field and the same two call sites as `claim_event_invitation` (`auth/router.py`, `auth/local.py`); the same UUID is tried against event then tournament invitations (v4 UUIDs do not collide); an already-claimed or unknown id is a no-op. The email uses the existing `ui_labels` template with `$entity_type = tournament` and `invite_email_allowed` unchanged. If the repository's sibling-import check rejects the new inline call, the agent STOPS and reports (D-4 precedent).
- **Share is client-side.** The app link is the existing `/public/share` redirect (platform to store URL, admin-editable; DES-MEETUP-FEEDBACK-001 C5). Mobile reuses `useAppShare` and `getShareUrl()`; web uses the same URL its app-download links already use. No backend route, no tournament identity in the link, no access granted. TL-13 says who sees the button.
- **Notifications.** `tournament_invited`, one per invitation, point-in-time like `event_invite`. No revoke notification (games send none).
- **Capability field.** `GET /tournaments/{id}` gains an additive read-only field `my_invite_access`: `full` (organizer or active committee member), `individuals` (any other viewer of a public tournament while invites are open), otherwise `none`. Web and mobile show Invite and Share from this field, because mobile cannot derive committee membership. The server still enforces every rule (P9, P15). Additive only (P14). **v1.2.1:** the same response gains `my_invitation_status`: the caller's own invitation to this tournament, `pending` or `accepted`, otherwise null (none, declined, revoked or expired). It describes only the caller. Web and mobile show Accept and Decline when it is `pending`, and "You're invited" when it is `accepted`; the server still decides on respond (`409 INVITES_CLOSED` after registration closes, TL-73).
- **Backfill.** None. `group`-visibility tournaments keep working through `group_id`.
- Rejected (v1.2): per-tournament share token, access grants and rotation (the app link carries no tournament); live group-membership visibility for invited groups (the game model snapshots members); viewer invites on group and invite tournaments (owner decision, option B); a revoke notification (not in games).

**AD-5 — Dates and registration phase are computed, not stored.**
- Columns: `registration_closes_at` (**is** the soft block for v2; no second column, no alias drift), new `registration_hard_block_at`, existing `starts_at`/`ends_at`.
- `registration_phase(t, now_db)` is the **only** function that decides `open | committee_only | frozen`. It uses the database `now()` (not app server time, not client time). Boundary: `now < soft` open; `soft ≤ now < hard` committee_only; `now ≥ hard` frozen.
- No job flips a stored status at the soft or hard block, so there is no dead-man risk on a cut-off. Stored `status` changes only on explicit actions: generate → `schedule_draft`; fixture publication executed → `published`; first result → `in_progress`; close → `completed`; dissolve/cancel.
- Creation validation: `opens ≤ soft ≤ hard`, `hard + min_gap ≤ starts_at` (config `meetup.tournament.min_gap_hours`), all in the future. (v1.3: the full ordered rule list, the reason codes and the daily-window rule are in AD-18.)

**AD-6 — Registration rules are phase-gated server-side (P9, P15).**

| Action | open | committee_only | frozen |
|---|---|---|---|
| Self-register individual or team | yes | no | no |
| Committee add individual | yes | yes | no |
| Committee add team | no (team registers itself) | no | no |
| Self-withdraw | yes | yes | no |
| Team roster change | yes | yes | no |
| Walkover / disqualification | n/a | n/a | yes (via committee) |

- `tournament_registration_members` freezes **who plays for a registration**. One row per player: the user for individuals, each active member for teams. Audience resolution (notifications, reminders, record) reads this table, never live `team_memberships` (fixes the as-built drift where a roster change after registration changed the audience). Single source: see lineage §5.2.
- Capacity: `entrants_max` from snapshot, checked under its own per-tournament advisory lock (`'treg:'||tournament_id`), independent of the invitation lock.
- Skill level required per player for the sport (existing `user_skill_levels`). Missing → 409 with the member named by id (UI shows name).
- **Invites (v1.2).** Invitations are accepted only while registration is open (AD-4 window). On `invite` tournaments, self-registration needs an accepted invitation (AD-4).

**AD-7 — Committee governance: extend, do not rewrite.**
- New tournaments get committee rows at creation: creator `active`; every other member is `invited` and becomes `active` only when that user accepts (OI-3 closed). The tournament opens for registration immediately. (v1.3: the creation wizard requires at least one invited member besides the creator, AD-18.) **Gate:** draft generation and any `fixture_publication` submit require ≥2 `active` members (the hard block itself is time-computed and is never blocked). The creator may revoke and re-invite at any time, including after the hard block, so an unresponsive invitee cannot strand the tournament. `invited` members have no committee rights. Removal and resignation are blocked when active count would fall below 2 (min floor 2 enforced in code even if config says less).
- **Action catalogue for v2:**

| Action | v1 (unchanged) | v2 |
|---|---|---|
| `score_entry` | maker-checker + OTP | **not an approval**. Single member via `POST …/results`, append-only log (AD-9) |
| `fixture_approval` | per fixture | superseded by `fixture_publication` |
| `fixture_publication` | n/a | **new** whole-draft approval, binds `draft_id` + `payload_hash` |
| `standings_publication` | yes | yes, with `scope` ∈ {`group`,`final`} in payload |
| `team_disqualification` | yes (registration-based) | yes, covers individuals too (payload is `registration_id`) |
| `tournament_dissolution` | yes | yes |
| `committee_membership_change` | yes | yes + min-2 guard |
| `fixture_reschedule` | n/a | **new**, only for moves beyond the single-member bounds (AD-9). Binds `fixture_id` + new time/court. |

- **Flow for v2:** `submit` (maker) → `approve` (checker, different member) → system **executes in the same transaction** as the approval. The OTP relay and the maker `confirm` step are gone (TL-22). Immutable command binding, staleness recompute at approval time, advisory lock and `decision_key` collision checks are kept as they are. If the recomputed precondition hash differs, the request is marked `stale` in its own committed transaction (existing two-transaction pattern).
- Implemented in a **new module** `tournaments/committee_flow_v2.py` reusing `committee_engine` functions (`approve_request`, `mark_executed`, the `apply_*` ports) and `committee_governance.submit_committee_action`. `committee_approval_flow.py` and `committee_step_up.py` are **not modified**; v1 tournaments keep using them. `tournament_approval_requests.action_type` CHECK is widened with `fixture_publication` (additive). `decision_key.FIXED_KIND_MAP` gets `fixture_publication → tournament_lifecycle`.
- **Requirement supersession (explicit):** R-332 (step-up OTP for committee actions) and the OTP leg of R-304–R-307 are superseded for v2 by TL-22. R-333 and R-334 are unchanged.
- Rejected: editing the 795-line v1 flow in place (high regression risk against a thoroughly reviewed state machine); keeping OTP (owner decision: overkill).

**AD-8 — Fixtures: deterministic generator; AI translates only.**
- `tournaments/fixture_engine/` has one generator per algorithm (`knockout`, `round_robin`, `group_stage`) behind the registry. Input: snapshot rules, frozen registrations with seed order, `ConstraintSet`, `rng_seed`. Output: a `DraftPayload`. Same input ⇒ same output (P8 spirit; tested). The hashed `DraftPayload` embeds `rng_seed`, `generator_version`, and the confirmed `ConstraintSet`, so the publication approval binds everything needed to reconstruct the bracket in an audit (v0.2).
- **Drafts are not rows in `tournament_fixtures`.** They live in `tournament_fixture_drafts.payload` (JSONB) until a `fixture_publication` request executes, which materialises rows in `tournament_fixtures`. So the live table only ever holds approved fixtures; the approval binds the exact payload by hash (BP-11: intent = `{draft_id, payload_hash}`, evidence = consequence description + fit report).
- **Constraint model (`ConstraintSet` v1), closed list:** `keep_apart(a,b,until_round)`, `swap(a,b)`, `pin_slot(match_ref, start, court?)`, `block_slot(start,end,court?)`. Anything else is rejected by the interpreter with a reason.
- **Interpreter flow:** `POST …/drafts/{id}/comments` (text) → server pseudonymises → AI call → `proposed_constraints` stored with status `proposed` → app shows "I understood" → `POST …/comments/{cid}/confirm` → generator re-runs with all confirmed constraints → new draft version. If any constraint fails validation (unknown player, impossible slot, conflicting rules) the **whole proposal is rejected** and nothing changes. AI unavailable or malformed ⇒ status `failed`, nothing changes (TL-26).
- **Regeneration cap:** count of drafts with `source_comment_id IS NOT NULL` ≤ `meetup.tournament.fixture_regeneration_cap` (default 3). Manual edits do not count.
- **PII boundary (OI-2):** player names never leave the system. The server replaces participants with opaque tokens (`P01…`) plus skill score. The comment text is the leak vector: the app inserts `@mention` chips that become tokens; as a best-effort second layer the server replaces exact display names and first names of registered players and redacts phone numbers (E.164 and SG 8-digit), RFC 5322 emails, URLs and @handles (`[redacted]`) before the call. The system prompt also instructs the model to ignore names; that is not a control, the pre-filter is. **Provider (OI-2 closed):** Anthropic API, direct, multi-region (US default); Singapore residency requirement dropped; cross-border transfer registered (§6). **Locked privacy policy / T&C wording:** "Tournament administration features utilize third-party automated AI processing to interpret fixture scheduling constraints. Competitor names and known identifiers are replaced with pseudonymized codes where recognized. Contact information, handles, and URLs are stripped prior to transmission. Free-text organizer comments may be processed by the provider to extract structured scheduling rules and are handled subject to standard provider data privacy and retention terms." Must be published before `meetup.tournament.v2_enabled` is turned on. Free text that still names a person is sent as typed. The provider must be named in privacy policy and T&C (existing `meetup-privacy-tnc` work). Requires owner sign-off.
- Provider client: new `constraint_interpreter.py` using the same endpoint/whitelist/timeout configuration discipline as `ai_fixture_engine` (P1 SSRF whitelist), with a simple consecutive-failure circuit breaker (P7), calls written to `external_call_logs` (existing table, §5.22). `ai_fixture_engine.py` is not modified; v1 group-stage tournaments keep it.
- Rejected: AI generating fixtures (non-deterministic, un-auditable, cannot be validated); structured edit UI only (owner chose free text).

**AD-9 — Scheduling planner and match edits.**
- `schedule_planner` assigns `scheduled_at`, `court_label`, `duration_minutes` per match, round by round, from: window (`starts_at`..`ends_at`), `daily_start_time`/`daily_end_time`, `court_count`, `match_minutes` + `changeover_minutes` (snapshot), `min_rest_minutes`. Later rounds are laid out after earlier ones (their participants unknown yet; slots reserved).
- `fit_check(rules, entrants, window)` returns `{matches, required_minutes, available_minutes, shortfall, suggestion}`. Run at creation (with `entrants_max`) and at generation (actual).
- A single `validate_schedule(fixtures)` function returns the first violation per fixture: `PLAYER_DOUBLE_BOOKED`, `COURT_OVERLAP` (keyed on venue + court), `ROUND_ORDER`, `MIN_REST`, `OUTSIDE_WINDOW`. It is used by draft edits, post-publication edits and the interpreter's `pin_slot`/`block_slot` validation. One implementation, three callers.
- Post-publication edits (OI-4 closed): **single active committee member, audited,** only for (a) court change within the same time block and day, or (b) time shift ≤ `meetup.tournament.reschedule_single_member_max_minutes` (default 30) on the same calendar day; both must pass `validate_schedule`. **Any larger shift or a change of calendar date requires `fixture_reschedule` maker-checker.** Approved or permitted edits update the fixture, reschedule that fixture's reminder rows, and send `tournament_match_rescheduled`.

**AD-10 — Results are an append-only log; fixtures hold a projection.**
- `tournament_match_results` is append-only (`UNIQUE(fixture_id, version)`). Latest version is current. A correction is a new version with `correction_of_version`.
- `result_validator` derives winner and validates against the snapshot: `sets` (best_of, points_to_win_set, win_by, cap) rejects impossible sets and extra sets after a decided match; `score` (full time); `draw` handling per `draw_resolution` (`penalties`: shoot-out score kept in payload apart from match score, cannot be level; `committee_decides`: winner + reason required); `walkover`.
- `tournament_fixtures.winner_registration_id` and `score_summary` are a **projection written only by `result_service`** (lineage §5.2). Anything else writing them is a bug.
- **Advancement is data, not index arithmetic.** At generation each fixture stores `next_fixture_id`, `next_slot` (`a`/`b`), `loser_next_fixture_id`, `loser_next_slot` (third place), and `source_a`/`source_b` (JSONB, e.g. `{"type":"group_place","group":"A","place":1}` for placeholders). Replaces the as-built `idx // 2` computation, which cannot express third place or group-to-knockout. `source_a`/`source_b` are the inbound edge and are authoritative for display and validation: `{"type":"winner"|"loser","fixture":"<ref>"}` or `{"type":"group_place",…}`; `next_*` is the denormalised outbound edge. A generation-time test asserts both views agree for every fixture (v0.2).
- Correction rule: if the winner changes and the downstream fixtures are unplayed, replace the slot and notify both; if any downstream fixture has any result or any status other than `scheduled`, reject `409 DOWNSTREAM_PLAYED`. "Downstream" means both `next_fixture_id` (winner) and `loser_next_fixture_id` (third place, where set); both slots are updated in one transaction and both successor rows are locked in ascending id order (v1.2, review round 7). Propagation is exactly one hop (a fixture without a result cannot have filled its own successor), so no recursive traversal is needed. Retroactive walkover/DQ of a played fixture is a correction and takes this same path; it cascades only through the explicit committee-confirmed route when downstream is already played (v0.2).
- Group-stage standings are computed by a pure function from results + snapshot tiebreakers. Publishing them (`standings_publication`, scope `group`) writes an immutable `tournament_standings_snapshots` row and resolves placeholder `source_*` into registrations in the same transaction.
- Auto-completion in v1 `enter_result` (sets `completed` when all fixtures done) is **not** carried over: v2 completes only through close-out (TL-35).

**AD-11 — Player record is derived from the result log.**
`GET /users/me/tournament-record` reads `tournament_match_results` (current versions) joined via `tournament_registration_members`. `users.tournament_participation_history` (JSONB: outcome only, no scores) keeps being maintained by existing hooks for the strength engine and is **not** the record's source (it cannot hold scores and is mutated in place). Rule: `owner_of(user)`; there is no other-player or admin read path.

**AD-12 — Reminders: table-driven poll in the worker process.**
- `tournament_reminder_dispatch_log` has one row per `(fixture_id, offset_minutes)`. Rows are created/updated by the same transactions that set times or fill a slot: publication, advancement (when the second side becomes known), time edit, DQ/walkover/cancel (rows → `cancelled`).
- A new worker loop (`jobs/tournament_reminders.py`, in `worker_main.py` beside the outbox loops) every 60 s claims due rows with `FOR UPDATE SKIP LOCKED`, writes a `push_fanout` outbox row (same hand-off as event reminders, preserving the `meetup_app` / `meetup_worker_login` boundary), marks `sent`. Rows older than the grace (`reminder_past_due_grace_minutes`, default 15) become `skipped_past_due`.
- **Dead-man detection:** the loop writes `meetup.tournament.reminder.last_run` each pass (same pattern as `meetup.scheduler.last_heartbeat`). A watchdog metric and alert fire when `now − last_run > 5 min` **or** pending rows overdue beyond grace exist. A daily reconcile in the same loop recreates missing log rows for fixtures with both sides known and a future time.
- **Deviation from precedent (flagged):** event reminders use per-event APScheduler jobs in the api process (their AD-1). Tournament reminders are table-driven instead, because reminder rows already exist as durable state, times change often, and the worker already hosts polling loops. This adds no jobstore to keep in sync and survives restarts. Not a principle deviation.

**AD-13 — Close-out.** `POST …/close` (single committee member) requires: all fixtures terminal (`completed`, `walkover`, `cancelled`), a published `final` standings snapshot, and feedback with at least one non-empty field. Sets `completed`, writes `tournament_closeouts`. `PATCH …/closeout/visibility` flips `show_to_players` (any active committee member, audited). Feedback read rule: active committee member, or any registered player **only if** `show_to_players`. `admin()` is deliberately excluded and covered by a negative test.

**AD-14 — Config over constants (P1).** All thresholds in `app_config` under `meetup.tournament.*` (§7). Startup validates presence and bounds; missing required key is a hard failure. Code floors (committee min 2) cannot be configured below the floor.

**AD-15 — Notifications.** Reuse `tournament_schedule_published`, `tournament_result_posted`, `tournament_standings_published`, `tournament_cancelled`. Add `tournament_invited`, `tournament_added_by_committee`, `tournament_match_reminder`, `tournament_match_rescheduled`, `tournament_approval_requested`, `tournament_approval_resolved`, `tournament_committee_changed`, `tournament_committee_invited`, `tournament_reschedule_requested`, `tournament_disqualified`, `tournament_dissolved`, `tournament_completed`. Each needs: `notification_type` CHECK widening (additive), audience rule in `notifications/fanout._resolve_recipients` (reading `tournament_registration_members` and committee memberships, deduplicated per user), display builder, and mobile label seeds. The existing `tournament_match_scheduled` stays unused by v2. Verification step in Phase 1: confirm which of these types already exist in the live CHECK before writing the migration (OI-7). v1.2: `tournament_invite_revoked` is dropped from the list; invitation revocation is silent, as for games.

**AD-16 — Navigation consistency (v1.1).**
- Source of truth: the approved dashboard addendum (`DES-MEETUP-ADDENDUM-dashboard.md` v1.8, AD-5, AD-15 and the bottom-bar table). This AD restates the rule; it does not change those destinations.
- **Mobile bar:** Home, Groups, raised + (create), Games, Profile. **Web rail (≥1024px):** same destinations plus a labelled Create button. **Web below 768px:** the same bar as mobile.
- Tournaments are **inside Games** via a `Games | Tournaments` segmented switch. Tournament screens highlight **Games**. No tournament-specific bar or fifth tab is permitted.
- **Rule:** on web, the rail/bar is present on **every signed-in page**, including create/edit wizards, the committee console, upload flow, bracket, results and close-out. It is hidden only when logged out. Implementation: the shell renders it once; pages must not hide or replace it.
- `.form-sticky-footer` (and any sticky action footer) sits **above** the bottom bar and never overlaps it.
- Sections inside a screen (for example the committee console's Overview / People / Fixtures / Results / Committee) are in-page navigation. They never replace or imitate the global bar. One section strip per screen.
- Mobile app: boards show the same bar. Whether the native app shows the bar on wizards and detail screens is **not decided here** (OI-9); the web rule is binding now.
- Acceptance: a test (web e2e or DOM) walks every signed-in route and asserts the nav element is present, visible and not covered by the footer. Colours and icons come from theme tokens only.
- Rejected: a separate bar for the tournament area (the defect found in review; it contradicted the approved dashboard design); hiding the bar on wizards (loses orientation, inconsistent with the rail on desktop).

**AD-17 — Fixture import by Excel upload (Release 1) (v1.1).**
- **Position:** `source=upload` is the first fixture source. `source=engine` (AD-8) is the second. Both produce the same `DraftPayload` shape and go through the same validator, planner checks, maker-checker publication and materialisation. Nothing downstream of the draft knows the source.
- **Template** (`GET …/fixtures/template`, committee only, after the hard block): `.xlsx` generated server-side with a Roster sheet (registration ID, display name, seed, skill) and a Matches sheet with columns: `Match ID, Round, Player A ID, Player B ID, Date, Start, Court, Venue, Winner goes to, Loser goes to`. Tournament id, window and template version sit in a locked header. The sheet carries the advancement links, so the system does not infer a bracket.
- **Upload** (`POST …/fixtures/upload`, multipart, active committee, ≥2 active members as in AD-7): limits `upload_max_bytes` 2 MB, `upload_max_rows` 200. Accept `.xlsx` only (extension, MIME and magic bytes: ZIP signature + `[Content_Types].xml`). Reject `.xls`, `.csv`, `.xlsm`, encrypted files, macros, external links and formulas. Read **values only**, with a library that never evaluates formulas, never resolves external references and has XML entity expansion and ZIP-bomb limits (declared size and ratio checked before inflating). Uploaded content is data, never rendered unescaped. Cells beginning `= + - @` are treated as text on read and never echoed into any generated export. The generated template writes user-controlled values (display names) as text cells, and any value starting with `= + - @` is prefixed with a single quote so that opening the file in a spreadsheet application cannot execute it (v1.2, review round 7).
- **Validation (all-or-nothing, row-level reasons, reason codes):** header and template version match; every Player ID is a registration of this tournament in this frozen roster (names ignored); no player appears twice in a round or at the same time; no court used twice at the same time; dates and times inside the window and daily hours; match length + changeover + minimum rest respected (the same `validate_schedule` as AD-9); every non-final match has winner/loser links to existing matches and slots; one-hop DAG (AD-10 invariant), no cycles, no orphans; counts consistent with the template (round and bracket size). Byes are expressed by an empty Player B with a valid advancement link.
- **Result:** a passing file creates `tournament_fixture_drafts` row with `source='upload'`, `source_file_hash` (SHA-256), `source_filename`, `uploaded_by`, `payload`, `payload_hash`. The original bytes are **not** stored; the parsed payload is. Version increments on each upload. Publication binds `{draft_id, payload_hash}` as in AD-8, so a replaced file makes an open request `stale`.
- **Failure behaviour:** parse or validation failure → 422 with up to 50 row reasons, no draft, no state change. The file is processed in the request within `upload_max_seconds`; timeout → 503 with no draft. Concurrent uploads to the same tournament are serialised by the existing tournament advisory lock (AD-6 ordering).
- **Audit:** `admin_action_log`/committee audit entry per upload (who, when, hash, row count, pass/fail and reason codes). File contents are not logged.
- **Sockets for Release 2:** `source` CHECK already admits `engine`; `meetup.tournament.fixture_engine.enabled` (default false) gates AD-8 endpoints; the draft screen and approval flow are source-agnostic. Enabling the engine is configuration plus the AD-8 build, not a rewrite. OI-2 (AI provider wording and DPA) is **not needed for Release 1**; it must still be confirmed before `fixture_engine.enabled` is turned on.
- Rejected: parsing names (ambiguous, PII-fragile); CSV (encoding and injection ambiguity); storing the raw file (unscanned binary at rest, no benefit since the payload is the evidence); inferring advancement from round order (silently wrong for third-place and groups-then-knockout).


**AD-18 — Creation wizard contract (v1.3).** Applies to `lifecycle_version = 2` creation (not enabled before Phase 10). One request creates everything. The client holds the wizard state; there are no server-side drafts (BP-12), so leaving the wizard discards it. Steps 1, 2 and 5 are unchanged from the canvas section "Tournament creation wizard". This AD fixes steps 3, 4, 6 and 7. New code lives in `tournaments/` (Phase C fixes the module name).

*Step 3 — dates and times.* All required: start date, end date, start time, end time, registration closure date and time, hard block date and time.
- Registration closure **is** the soft block (`registration_closes_at`, AD-5). No new column. The hard block is `registration_hard_block_at`. The wizard pre-fills the hard block with the closure value, which means no committee-only window; the organizer may move it later.
- `starts_at` is start date plus start time; `ends_at` is end date plus end time. Start time and end time are also the **daily playing window** on every day of the tournament: the server derives `daily_start_time` and `daily_end_time` from the local time of `starts_at` and `ends_at` in `HOME_TIMEZONE` (`core/config.py`, Asia/Singapore, the same rule games use; Phase C confirms and records it, BP-01). Overnight windows are out of scope.
- The API takes ISO-8601 instants with offset. Registration opens at creation (DB `now()`), so `opens ≤ soft` holds by rule 1.
- **Server rules (P9), evaluated in this order; the first failure is returned as `422 TOURNAMENT_DATES_INVALID` with `field`, `reason` and `step`:**

| # | Rule | `reason` |
|---|---|---|
| 1 | closure, hard block, start and end are all after DB `now()` | `DATE_IN_PAST` |
| 2 | `starts_at < ends_at` | `END_BEFORE_START` |
| 3 | daily start time < daily end time | `DAILY_WINDOW_INVALID` |
| 4 | `registration_closes_at ≤ registration_hard_block_at` | `REG_CLOSE_AFTER_HARD` |
| 5 | `registration_hard_block_at + min_gap_hours ≤ starts_at` | `HARD_BLOCK_TOO_CLOSE` |

The client mirrors the rules for early feedback; the server is the only authority. Dates are never adjusted silently.

*Step 4 — groups.* Visibility stays `public`, `group` or `invite`. When it is `group` the organizer picks one or more groups with the existing group picker (search, recent-activity order).
- `group_ids` is required (1 to `audience_group_cap`, default 20) when visibility is `group`, and rejected otherwise. The v2 body does not accept the single `group_id`. IDs must be distinct. The caller must be a member of every group (checked in the application through the groups interface AD-4 uses, no sibling import): `403 GROUP_NOT_MEMBER` naming the id; over the cap `422 GROUP_CAP_EXCEEDED`.
- **Meaning:** selected groups define who can see the tournament (TL-77). Selecting a group sends no invitation and no notification; invitations stay under AD-4 (OI-15). Visibility is by **live** membership of any selected group, as the v1 single-group rule is; invitations remain snapshots (AD-4).
- **Storage:** `tournament_audience_groups` (§5.1). `tournaments.group_id` is kept and set to the first selected group so existing readers keep working (P14). Readers of v2 tournaments use the additive `groups` field (`[{id, name}]`) on `GET /tournaments/{id}` and the list; reading `group_id` for a v2 tournament is a bug (§5.2).
- **After creation:** the existing update route also accepts `group_ids` (replace semantics, same rules and cap, organizer only, only while registration is open). Removing a group never revokes invitations or registrations.

*Step 6 — committee.* Same component and endpoint as the app's other player pickers (mobile `UserSearchPicker`, the create-game invite step): one search box, results in **Suggested** and **Other players** sections. The suggested rule is the existing one and is not redefined here (Phase C records it, BP-01).
- The organizer is listed first, labelled, pinned, and cannot be removed (committee member 1, `active`). "+" on a result adds that player to the selected list; "−" removes. Email addresses and non-users are not offered: a committee member is a user.
- At least one additional member is required to leave the step.
- **Server rules:** `committee_user_ids` has 1 to `committee_max − 1` entries, all distinct, none the organizer, each an existing active user. Otherwise `422 COMMITTEE_INVALID` with `reason` (`TOO_FEW`, `TOO_MANY`, `DUPLICATE`, `IS_ORGANIZER`, `USER_UNAVAILABLE`), `user_id` where relevant, and `step`.
- Each additional member is created as `committee_memberships.status = 'invited'` and receives `tournament_committee_invited` (AD-7, AD-15). They become `active` only by accepting. Until two members are active the committee cannot upload or publish fixtures (AD-7, AD-17); step 7 says so.

*Step 7 — review and submit.* A read-only summary of every value from steps 1 to 6, in the order the dates take effect (registration opens now, closes, hard block, starts, ends), with an edit link per section that returns to that step with the entered state kept.
- One Submit button, disabled while the request is in flight. `POST /tournaments` carries `client_request_id` (UUID created when the wizard opens). A replay by the same organizer returns the original tournament with `200` and creates nothing more (P5). Stored in `tournaments.client_request_id` under a partial unique index on `(organizer_id, client_request_id)`; a concurrent second submit loses the race on the index and returns the existing tournament.
- **Atomic:** the tournament, the template snapshot (AD-3), the audience groups, the committee rows and the `tournament_committee_invited` outbox rows (key `tournament_committee_invited:{tournament_id}:{user_id}`) commit in one transaction. Any failure leaves nothing behind.
- A selection that went stale between step and submit (a group left, a user deactivated) is rejected with `field` and `step`; the wizard jumps there. Nothing is corrected automatically.
- Success shows the completion screen that summarises the submitted fields, as the other forms do, then the tournament.
- The create route keeps its existing rate limit (P17). Reading the wizard back never shows another user's data: group and user lookups use the existing scoped endpoints.
- Rejected: server-side wizard drafts (state is cheap to re-enter, adds a table and a purge job, BP-12); inviting the selected groups on submit (changes notification volume, OI-15); a separate daily-hours field pair in step 3 (duplicates the start and end times for the only case the product has).

**AD-19 — Add and remove controls: "+" and "−" (v1.3).** One shared component per platform (web, mobile). No screen draws its own.
- **Scope:** every per-person and per-group Invite button, and every entry button that opens an invite picker, on web and mobile, across games, groups and tournaments. The wizard pickers (steps 4 and 6) and the create-game invite step use the same component.

| State | Control | Meaning |
|---|---|---|
| Not added | "+" | On a screen with a submit step: add to the staged selection. On a screen without one (group view, game detail): send the invitation now. |
| Staged, not yet submitted | "−" | Remove from the selection. Nothing was sent. |
| Invitation sent | status chip (the existing statuses, such as Invited or Accepted) | No "+" or "−". Withdrawing stays the organizer revoke control (TL-12), which this AD does not change. |
| Entry button that opens a picker | "+" | Opens the picker. The accessible label keeps the word "Invite". |

- **Immediate send:** the status chip appears only after the server confirms. A double tap sends once (existing rows are skipped, AD-4). On failure the row returns to "+" and shows the error from `ui_labels`.
- **Labels and access (P1):** the controls are icon-only. Accessible names come from admin-managed `ui_labels` (for example "Invite {name}" and "Remove {name}"), never hardcoded. Touch target at least 44 × 44 pt (px on web). State is carried by the glyph, not by colour alone. Colours come from theme tokens only (AD-16 rule).
- **Nothing else changes:** who may invite, the windows, the caps, notifications and the revoke control stay as AD-4 and the games model define.
- **Inventory first (BP-01):** Phase P starts by listing every current Invite control in both repos. The list goes into the implementation report. A control found outside it is reported, not converted silently.
- Rejected: a text "Add" or "Remove" button (the owner chose the glyph pair); optimistic status chips (a failed invite would show as sent).

---

## 4. Component / Integration Design

| Component (all under `tournaments/` unless noted) | Owns | Calls |
|---|---|---|
| `templates.py` + `TemplateDefinition` | Template CRUD, versioning, publish validation, snapshot resolution | algorithm registry |
| `invitations.py` | Invitations (game model), group cap, `invites_open()`, claim at sign-up | `groups` via existing public interface (no sibling import); called from the `auth` claim hooks |
| `registration_v2.py` | Phase-gated register/withdraw/committee-add, `registration_members` freeze | `registration_phase()` |
| `committee_flow_v2.py` | submit/approve/execute for v2 actions | `committee_engine`, `committee_governance` (reuse) |
| `fixture_engine/` | Generators, `ConstraintSet`, `validate_schedule`, `schedule_planner`, `fit_check` | none (pure) |
| `constraint_interpreter.py` | Pseudonymise → AI call → proposed constraints | AI provider, `external_call_logs` |
| `result_service.py` + `result_validator.py` | Append-only results, projection, advancement, standings compute | `fixture_engine` |
| `closeout.py` | Close-out, feedback, visibility toggle | |
| `jobs/tournament_reminders.py` | Reminder poll loop, reconcile, heartbeat | `job_outbox` |
| `admin` router (existing admin module) | Template admin endpoints, `admin_action_log` | `templates.py` via interface |

**Endpoints (v2, all under `/tournaments`)** — indicative; exact paths fixed in Phase 1 against the router (BP-01).
- Templates (admin): `GET/POST /admin/tournament-templates`, `POST …/{id}/publish`, `POST …/{id}/retire`.
- Lifecycle: `POST /tournaments` (v2 body, AD-18: client_request_id, template_id, overrides, starts_at, ends_at, registration_closes_at, registration_hard_block_at, visibility, group_ids, committee_user_ids), `GET /tournaments/{id}`, `POST …/invite-group`, `POST …/invite-user`, `POST …/invite-email`, `GET …/invitations`, `DELETE …/invitations/{invitation_id}`, `POST …/invitations/respond` (mirrors the game routes; exact paths fixed in Phase 1), `POST …/registrations`, `DELETE …/registrations/{id}`, `POST …/registrations/committee-add`.
- Fixtures: `POST …/drafts` (generate), `GET …/drafts/{id}`, `POST …/drafts/{id}/comments`, `POST …/comments/{cid}/confirm|reject`, `PATCH …/drafts/{id}/matches/{ref}` (manual edit), `POST …/committee/actions` (existing path, new action type).
- Play: `POST …/fixtures/{id}/results`, `PATCH …/fixtures/{id}/schedule`, `POST …/fixtures/{id}/walkover`.
- Close: `POST …/close`, `PATCH …/closeout/visibility`, `GET …/closeout`.
- Me: `GET /users/me/tournament-record`.

**Integration boundaries**

| Boundary | Failure behaviour |
|---|---|
| AI provider | 10 s timeout (config), no retry on 4xx, one retry on 5xx/timeout; breaker opens after N consecutive failures (config) for a cool-down; while open → comment `failed`, UI shows manual edit. Never blocks publish or any other flow. |
| Push outbox | Existing at-least-once `job_outbox` + `fn_materialize_deliveries`; dispatch log row is `sent` only after outbox insert commits. Duplicate-safe via `(fixture_id, offset_minutes)` key. |
| Groups module | Called only via its existing interface. Group membership change after invite does not alter existing registrations. |

---

## 5. Data Contracts

### 5.1 Schema (all additive; migrations written, not executed)

| Table / change | Key columns and constraints |
|---|---|
| `tournament_format_templates` | id, slug, version, status CHECK(draft,active,retired), definition JSONB, schema_version, created_by, UNIQUE(slug,version) |
| `tournaments` + | `lifecycle_version SMALLINT NOT NULL DEFAULT 1`, `template_id`, `template_version`, `rules_snapshot JSONB`, `registration_hard_block_at`, `daily_start_time`, `daily_end_time`, `court_count`, `venue_label` (v1.2: no `share_token`; `visibility` CHECK unchanged) |
| `tournament_invitations` | (v1.2; v1.2.2: the migration also carries `GRANT SELECT, INSERT, UPDATE ON tournament_invitations TO meetup_app;`, no DELETE, as `a91d4e7c2b18` did for its table; owner-approved) (mirrors `event_invitations`) id, tournament_id, invitee_user_id NULL, source_group_id NULL, status CHECK(pending,accepted,declined,revoked,expired), invited_by_user_id, invited_at, responded_at, expires_at NULL, invited_email NULL; UNIQUE(tournament_id, invitee_user_id). Not yet created by any migration. |
| `tournaments` + (v1.3) | `client_request_id UUID NULL`; partial UNIQUE index on `(organizer_id, client_request_id)` WHERE `client_request_id IS NOT NULL`. `group_id` is kept and, for v2, set to the first selected group (AD-18). |
| `tournament_audience_groups` (v1.3) | tournament_id FK, group_id FK, position SMALLINT, added_at; PK(tournament_id, group_id). Named apart from `tournament_stage_groups` (pool A, B, …), which is unrelated. The migration carries `GRANT SELECT, INSERT, DELETE ON tournament_audience_groups TO meetup_app;` (DELETE is needed by replace semantics; owner-approved with v1.3, as the v1.2.2 GRANT was). No RLS. |
| `tournament_registration_members` | registration_id, user_id, role, UNIQUE(registration_id,user_id); written once at registration, mutated only while phase ≠ frozen |
| `tournament_fixture_drafts` | id, tournament_id, version, payload JSONB, payload_hash, constraints JSONB, rng_seed, source_comment_id, status(draft,superseded,published), created_by; **v1.1:** `source` CHECK(upload,engine) NOT NULL, `source_file_hash` (SHA-256, NULL for engine), `source_filename`, `uploaded_by`. For `source=upload`, `constraints`, `rng_seed` and `source_comment_id` are NULL; the regeneration cap does not apply to uploads |
| `tournament_fixture_comments` | id, draft_id, author_id, text, proposed_constraints JSONB, status(proposed,confirmed,rejected,failed), model_ref, confirmed_by |
| `tournament_fixtures` + | `next_fixture_id`, `next_slot`, `loser_next_fixture_id`, `loser_next_slot`, `source_a`, `source_b` JSONB, `court_label`, `duration_minutes`; `stage` adds `third_place` |
| `tournament_match_results` | id, fixture_id, version, kind(sets,score,draw,walkover), payload JSONB, winner_registration_id, entered_by, entered_at, correction_of_version, reason; UNIQUE(fixture_id,version); no UPDATE/DELETE path in code |
| `tournament_standings_snapshots` | id, tournament_id, scope(group,final), group_key, payload JSONB, approval_request_id, created_at (immutable) |
| `tournament_closeouts` | tournament_id PK, feedback JSONB, show_to_players, closed_by, closed_at, visibility_changed_by/at |
| `tournament_reminder_dispatch_log` | partial index `(due_at) WHERE status='pending'`; fixture_id, offset_minutes, due_at, status(pending,sent,skipped_past_due,cancelled), attempts, sent_at, UNIQUE(fixture_id,offset_minutes) |
| `tournament_approval_requests` | `action_type` CHECK adds `fixture_publication` |
| `notifications` | `notification_type` CHECK adds AD-15 types (after OI-7 check) |

Identity columns now (checklist): `payload_hash`, `decision_key` (existing), `(fixture_id, offset_minutes)` idempotency key, `external_call_logs.request_id` for AI calls.

### 5.2 Data lineage (one source per field)

| Field | Single source | "If it comes from elsewhere, it is a bug" |
|---|---|---|
| Registration phase | `registration_phase()` over snapshot dates + DB `now()` | Any stored phase flag, client time, or app-server time |
| Rules in force | `tournaments.rules_snapshot` | Reading the live template row after creation |
| Who plays for a registration | `tournament_registration_members` | Live `team_memberships` for audience, reminders, record |
| Current match result | latest `tournament_match_results` row per fixture | Reading `score_summary` as truth |
| `fixture.winner_registration_id`, `score_summary` | projection written only by `result_service` | Any other writer |
| Published fixture set | `tournament_fixtures` rows created by an executed `fixture_publication` | Rows inserted from a draft without an approval |
| Group qualifiers | `tournament_standings_snapshots` (scope group) | Recomputed standings used for placeholders after publication |
| Player record | result log via `registration_members` | `users.tournament_participation_history` |
| Group invite count | active `tournament_invitations` rows | Cached counter |
| Groups that scope a tournament (v2) | `tournament_audience_groups` | `tournaments.group_id` (a compatibility mirror of the first group, v1.3) |
| Committee at creation (v2) | `committee_memberships` rows written by the create transaction | The request body after commit |
| Committee size | active committee membership rows | Config or a counter |

### 5.3 Sensitive fields (excluded from logs, metrics, error payloads)

| Field | Handling |
|---|---|
| Invitation id in an email link | The id is the claim credential. Never logged next to the email; logged by id only. |
| Comment `text` | Contains potential PII. Logged by id and length only. Retained with the draft; deleted with the tournament per retention (OI-6). |
| AI request body | Pseudonymised tokens only. Mapping `P01→user_id` kept in memory for the call, never persisted. |
| Closeout `feedback` | Committee-only. Excluded from admin reads and exports. |
| Player record, scores per player | Owner-only read. |
| `invited_email` | Stored on the invitation row as for games (D-6). Used to send and shown to the organizer and committee. Never logged. Retention: OI-13. |

---

## 6. Security & Compliance Considerations

**Authorization (app layer, P15), one policy per resource in `policies.py`:**

| Resource | Allowed | Explicitly denied |
|---|---|---|
| Tournament read | per AD-4 (v1 keeps its 403 messages, v2 returns 404) | everyone else |
| Invite individual, group; list and revoke | per the AD-4 table | players on group or invite tournaments (individuals), non-owner or non-admin of the group, `invited` committee members, admin acting as committee |
| Template admin | platform admin | organizers, players |
| Register / withdraw | eligible player per phase | any non-owner of the team for team withdraw |
| Committee add | active committee member, phase ≠ frozen | non-members |
| Fixture draft, comments, publication submit | active committee | players, creator after removal |
| Fixture template download and upload (v1.1) | active committee, ≥2 active, phase ≥ frozen | players, invited-not-active members, admin acting as committee |
| Publication approve | active committee ≠ maker | maker, non-members, admin acting as committee |
| Result entry / schedule edit | active committee | players, admin |
| Create tournament, v2 (v1.3) | any authenticated eligible user; groups the caller belongs to; committee candidates who are active users other than the caller | a group the caller is not a member of (403 `GROUP_NOT_MEMBER`), deactivated users, the organizer as a candidate, a replay by a different organizer |
| Own record | the user | all others including admin |
| Closeout feedback | active committee; players only if `show_to_players` | admin, non-registered users |

**Validation at the boundary (P9):** Pydantic models with extra=forbid; dates normalised to UTC; JSONB payloads validated by typed models before write; scores validated against snapshot; template definition validated at publish.

**Threats and controls**
- Tournament enumeration: v2 denial stays 404 (hiding), v1 keeps its existing responses. No link or token exists (v1.2).
- Invite abuse → cap 20 distinct groups under an advisory lock; viewer invites only on public tournaments; per-user per-tournament cap (`invite_per_user_cap`); the route rate limit games use; organizer and committee revoke; `invited_by_user_id` recorded; invite search uses the existing shared search (non-group users hidden in the default list).
- AI prompt injection via comment text → output is parsed into a closed `ConstraintSet` and validated against real entrants; free text never executed or reflected into any other prompt; failure ⇒ no change.
- PII to AI provider → pseudonymisation (OI-2).
- Maker-checker bypass → same-member check in code and unique decision key; payload hash binds approval to exact draft; staleness check at approval.
- Result tampering → append-only log, attribution, downstream-played guard.
- Share-link leakage: not applicable. Share is the app link and carries no tournament identity or access (v1.2). The invitation id in an email link is the claim credential (UUID v4, single-use claim, existing sign-up rate limits).
- Encryption (P16): TLS in transit as per baseline; at-rest as per baseline storage. No new secrets other than AI provider key via existing secret mechanism.

**Compliance (MAS TRM / PDPA):** audit of every committee decision and result edit; data minimisation to the AI provider; retention OI-6; **cross-border transfer:** comment text (pseudonymised, redacted) is sent to the Anthropic API (direct, multi-region, US default) under the provider's commercial Data Processing Addendum. To be entered in the compliance register as a cross-border transfer under the PDPA Transfer Limitation Obligation; I am not a lawyer, so the DPA terms and the register entry need confirming on your side (OI-2 closed on that basis). Feedback treated as confidential internal data.

**Negative tests (P13) — mandated:** see §9.

---

## 7. Configuration and Failure Modes

### 7.1 `app_config` keys (P1; validated at startup, hard fail if missing)

| Key | Default | Bounds |
|---|---|---|
| `meetup.tournament.min_gap_hours` | 24 | 1–336 |
| `meetup.tournament.group_invite_cap` | 20 | 1–100 |
| `meetup.tournament.audience_group_cap` (v1.3) | 20 | 1–100; most groups selectable in wizard step 4 |
| `meetup.tournament.committee_max` (v1.3) | 10 | 2–25, floor 2 in code; committee size at creation including the organizer |
| `meetup.tournament.invitations.enabled` (v1.2) | false | boolean, parsed explicitly; gates all invitation routes and the v1 `invite` registration rule |
| `meetup.tournament.invite_per_user_cap` (v1.2) | 25 | 1–200; applies to users who are not organizer or committee |
| `meetup.tournament.committee_min` | 2 | floor 2 in code |
| `meetup.tournament.reminder_offsets_minutes` | [2880,1440,120] | 1–20160, max 5 entries |
| `meetup.tournament.reminder_past_due_grace_minutes` | 15 | 1–120 |
| `meetup.tournament.reminder.poll_seconds` | 60 | 15–300 |
| `meetup.tournament.reminder.last_run` | runtime | heartbeat |
| `meetup.tournament.fixture_regeneration_cap` | 3 | 1–10 |
| `meetup.tournament.reschedule_single_member_max_minutes` | 30 | 5–120 |
| `meetup.tournament.fixture_engine.enabled` (v1.1) | false | boolean, parsed explicitly; gates AD-8 generate/comment endpoints |
| `meetup.tournament.fixture_upload.max_bytes` (v1.1) | 2097152 | 65536–5242880 |
| `meetup.tournament.fixture_upload.max_rows` (v1.1) | 200 | 8–500 |
| `meetup.tournament.fixture_upload.max_seconds` (v1.1) | 10 | 2–30 |
| `meetup.tournament.ai.timeout_seconds` | 10 | 2–30 |
| `meetup.tournament.ai.breaker_threshold` / `cooldown_seconds` | 5 / 120 | |
| `meetup.tournament.ai.endpoint_whitelist` | per baseline (Anthropic API host only) | |
| `meetup.tournament.ai.model_primary` / `model_fallback` | set at deploy: small low-latency model primary, larger model fallback; verify current model IDs, never hardcode | non-empty |
| `meetup.tournament.default_changeover_minutes`, `min_rest_minutes` | 5 / 30 | template-overridable within bounds |
| `meetup.tournament.scheduling.async_threshold_ms` | existing | |

### 7.2 Failure-mode table

| Scenario | Behaviour |
|---|---|
| AI down / slow / malformed | Comment `failed`; draft unchanged; manual edit available; breaker protects latency |
| AI returns plausible but wrong constraint | User sees "I understood", must confirm; validator rejects impossible ones |
| Two members approve concurrently | Advisory lock + unique decision key; second sees `already_resolved` |
| Draft edited after submit | Payload hash mismatch → request `stale`, resubmit |
| Worker down at reminder time | Rows remain `pending`; on restart rows within grace send, older are `skipped_past_due`; watchdog alerts |
| Worker up but loop dead | `last_run` stale > 5 min → alert (dead-man) |
| Outbox insert fails | Dispatch row not marked sent; retried next pass (attempts capped) |
| Time edited after reminder sent | Old row stays `sent`; new rows created for future offsets only; participants receive reschedule notice |
| Two inviters push groups past the cap | Advisory lock serialises; loser gets 409 `GROUP_CAP_REACHED` |
| Invite after registration closes | 409 `INVITES_CLOSED` |
| Viewer exceeds `invite_per_user_cap` | 409 `INVITE_LIMIT_REACHED`; organizer and committee are not limited |
| Invitations flag off | Invitation routes return 404; the v1 organizer-only rule for `invite` tournaments is unchanged |
| Result entered twice (retry/double tap) | Idempotency key on request; same payload ⇒ same version returned |
| Correction after next match played | 409 `DOWNSTREAM_PLAYED`; committee must use walkover/DQ or admin override path (existing) |
| Committee drops below 2 | Blocked at removal/resignation; if a member's account is deleted, tournament flagged `needs_committee` and read-only for results until a replacement is approved |
| Group stage tie not resolved by tiebreakers | Template must end with a deterministic final tiebreaker (seeded draw using stored `rng_seed`) to avoid ambiguity; recorded in standings payload |
| Odd entrants / byes | Generator awards byes to top seeds; bye match has `walkover` result type with `auto=true`, excluded from player record as "bye" |
| Clock skew | All phase decisions use DB `now()` |
| Wizard submitted twice (double tap, retry after a timeout) | Same `client_request_id` returns the original tournament; one invitation per committee member (v1.3) |
| A selected group was left, or a selected user deactivated, between the step and submit | 403 or 422 with `field` and `step`; the wizard jumps to that step; nothing is created (v1.3) |
| Wizard left open until a chosen date has passed | `422 TOURNAMENT_DATES_INVALID`, reason `DATE_IN_PAST`; the wizard jumps to step 3; dates are never shifted silently (v1.3) |
| Outbox insert fails during create | The whole transaction rolls back: no tournament, no committee rows (v1.3) |

**Lock ordering (v0.2):** a transaction takes at most these in this order: `tinv` → `treg` → row locks (tournament, registration, fixture, by ascending id) → committee advisory/decision-key locks. Result entry takes the fixture row, then its successor row. Any new code path must not invert this. A concurrency test runs registration + invite + withdraw in parallel and asserts no deadlock.

Ambiguity tie-break: where data cannot decide (tied standings after all tiebreakers, draw in knockout with `committee_decides`), the system never auto-picks silently — seeded draw is deterministic and recorded; committee decision requires a reason.

---

## 8. Observability & Operability

- **Correlation:** request_id propagated to approval request, draft, AI call (`external_call_logs`), result row, outbox row.
- **Metrics:** `tournament_reminder_due_overdue` (gauge), `tournament_reminder_last_run_age_seconds`, `tournament_ai_calls_total{outcome}`, `tournament_ai_breaker_open`, `tournament_approval_pending_age_seconds`, `tournament_publish_total`, `tournament_result_correction_total`, `tournament_invite_cap_rejections_total`.
- **SLIs/SLOs:** reminder delivery within 2 min of `due_at` for 99% of rows; generation < 3 s for ≤64 entrants (sync), async above `async_threshold_ms`; draft interpret p95 < 10 s.
- **Alerts:** reminder loop dead (> 5 min), overdue rows beyond grace, breaker open > 10 min, approval pending > 48 h (notify committee, not page).
- **Security-event stream:** denied maker-checker attempts, failed invitation claims, denied invitation actions (v1.2), admin access to templates.
- **Logging exclusions:** §5.3.
- **Runbooks:** reminder backlog, AI provider outage, stuck approval (admin override path exists in v1).

---

## 9. Test Requirements

Risk classification (blast × exploitability): committee flow v2 **High**, result_service **High**, visibility/invitations **High**, registration_phase **High**, fixture_engine **Medium** (pure, property-tested), constraint_interpreter **Medium**, reminders **Medium**, templates **Medium**, closeout **Low-Medium**.

**Mandated negative tests (P13)**
1. A user who cannot see a v2 tournament calls any invitation route → 404, including with a guessed ID; on a v1 tournament the existing 403 response is unchanged.
2. A user who is not organizer or active committee invites an individual to a group or invite tournament → 403; on a public tournament → success. An `invited` (not active) committee member → 403.
3. A non-organizer, non-committee user invites a group they do not own or administer → 403; a group owner or admin on a public tournament → success; on a group or invite tournament → 403. Organizer or committee may invite any group.
4. 21st distinct group concurrently with another → exactly one succeeds (`GROUP_CAP_REACHED`).
5. Player self-registers during committee_only phase → 409; committee add after hard block → 409.
6. Registration boundary tests at `soft`, `hard`, `soft−1ms`, `hard−1ms` using DB time.
7. Team with member lacking skill level → 409 naming the member.
8. Roster change after hard block → 409; registration_members unchanged.
9. Maker approves own request → 403; same member via second session → 403.
10. Approving a stale/edited draft → `stale`, nothing materialised.
11. Removing the second-last committee member → 409.
12. Admin reads feedback → 403; player reads feedback with toggle off → 403, on → 200; any member toggles.
13. Another user (and admin) reads my tournament record → 403/404.
14. AI returns unknown player, unknown constraint kind, impossible slot → whole proposal rejected, draft unchanged.
15. AI timeout/5xx/malformed JSON → comment `failed`, no draft change, breaker increments.
16. Comment containing a registered player's name → name replaced in the outbound payload (assert on captured request).
17. Result: impossible set score, extra set after decided, level shoot-out, missing reason for committee_decides → 422.
18. Correction changing winner after downstream played → 409; before played → slot replaced and both notified. Semi-final correction with the third-place match played (winner path unplayed) → 409; both slots updated atomically when neither is played. (v1.2)
19. Retried result POST with same idempotency key → same version, no duplicate.
20. Time edit producing court overlap, player double-book, round-order violation, outside window → rejected with reason code.
21. Reminders: no row for fixtures with an unknown side; moved fixture produces new rows; cancelled fixture sends none; past-due beyond grace skipped; killed loop triggers dead-man alert in test.
22. v1 tournament regression suite (existing tests) runs unchanged and green, except the `invite`-tournament registration test, which is replaced by test 38 (v1.2).
23. `invited` member cannot approve, submit, enter results, or read feedback; draft generation with <2 active → 409; re-invite after hard block works.
24. Single member moves a match 31 min, or to another date → rejected, must use `fixture_reschedule`; ≤30 min same-day passes; court change within block passes; all still fail `validate_schedule` violations.
25. `fixture_reschedule` approval by the maker → 403; stale (fixture changed since submit) → `stale`.
26. Upload by player, invited-not-active member or non-member → 403/404; before the hard block → 409; with <2 active members → 409.
27. Upload `.xls`, `.csv`, `.xlsm`, encrypted file, file with formulas, external links or macros, wrong MIME with `.xlsx` name → 422, no draft.
28. Oversize file, >200 rows, ZIP bomb (small declared size, huge inflate), XML entity expansion → rejected within limits, no memory growth beyond bound.
29. Player ID not in this tournament's roster (including another tournament's ID), player in two matches at the same time, court used twice, outside window or daily hours, rest violation → 422 with the row and reason code each; draft count unchanged.
30. Missing, cyclic or dangling advancement link; winner slot taken twice; non-final match without a next match → 422.
30a. Template generated for a roster containing a display name starting with `=`, `+`, `-` or `@` → the cell is text and not a formula. (v1.2)
31. Cells starting `= + - @` are stored as text and never appear unescaped in any response or export.
32. Valid file → draft `source=upload` with hash, uploader, filename; re-upload → version+1, open publication request becomes `stale`; maker approving own upload-based request → 403.
33. Same file uploaded twice concurrently → serialised, two ordered versions or one, never a corrupt draft.
34. Web e2e: for every signed-in route (including create wizard, committee console, upload, bracket, results, close-out) the nav rail/bar is present and visible, the sticky footer does not overlap the bottom bar, and no hardcoded colour is used in nav styles.
35. Invite by any actor after registration closes (v1: status or `registration_closes_at`; v2: soft block, DB time) → 409 `INVITES_CLOSED`. (v1.2)
36. A user who is not organizer or committee exceeds `invite_per_user_cap` → 409 `INVITE_LIMIT_REACHED`; organizer and committee are unaffected. (v1.2)
37. Revoked, declined or expired invitations do not grant visibility (statuses as the game rule, recorded in Phase 1); a pending or accepted one does. List and detail use the same rule. (v1.2)
38. `invite` tournament: self-registration without an accepted invitation → 403; pending only → 403; accepted → success; the organizer registering a participant still works; team mode needs an accepted invitation for the registering user and for every roster member (`409 ROSTER_MEMBER_NOT_INVITED` otherwise); organizer or committee registration is exempt. `group` and `public` rules unchanged. (v1.2)
39. Email invitation: unclaimed row; email and OAuth sign-up with `?invite=` claim it atomically; already-claimed or unknown id → no-op; the address never appears in logs. (v1.2)
40. Group invite creates one invitation per current member, skips the organizer, is idempotent, and a later group joiner gets none. (v1.2)
41. Invitations flag off → routes 404 and the v1 organizer-only `invite` rule holds; flag on → test 38 applies. (v1.2)
42. Share (client tests): the Share action calls no tournament route; the shared URL equals the game share URL on mobile; on web it is the `/public/share` redirect (the web game share sends the event URL, which is existing game behaviour and out of scope; v1.2.2); the button visibility follows `my_invite_access` (`full` or `individuals` shows it, `none` hides it). (v1.2)
42a. `my_invitation_status` is `pending` or `accepted` for the invitee, null for everyone else and for revoked, declined or expired rows; another user's status is never returned. Accept or decline buttons follow it on web and mobile. (v1.2.1)

43. Create dates (v1.3): one case per rule in AD-18 order (past instant, end before start, daily start not before daily end, closure after hard block, hard block closer than `min_gap_hours` to the start) → `422 TOURNAMENT_DATES_INVALID` with the right `reason`, `field` and `step`; exactly at the gap boundary passes (DB time); when two rules fail, the lower-numbered reason is returned; a tournament is never created on failure.
44. Create groups (v1.3): `group_ids` with visibility other than `group` → 422; empty or missing with `group` → 422; duplicate ids → 422; 21 groups → `422 GROUP_CAP_EXCEEDED`; a group the caller is not a member of (including a guessed id) → `403 GROUP_NOT_MEMBER`; a v2 body with the single `group_id` → 422; `tournaments.group_id` equals the first selected group; the update route replaces the list only while registration is open and only for the organizer.
45. Multi-group visibility (v1.3): a current member of any selected group, including the second, can view and list the tournament; a user in none cannot (v1 messages for v1, 404 hiding for v2); a user who leaves the only matching group loses visibility; selecting groups creates no invitation and no notification.
46. Committee at creation (v1.3): no additional member → `COMMITTEE_INVALID/TOO_FEW`; the organizer listed → `IS_ORGANIZER`; duplicate → `DUPLICATE`; deactivated or unknown user → `USER_UNAVAILABLE` naming the id; more than `committee_max − 1` → `TOO_MANY`; success creates the organizer as `active` and each other member as `invited` with exactly one `tournament_committee_invited` notification each; an `invited` member has no committee rights (test 23 stays valid).
47. Atomic create (v1.3): a forced failure in the audience-group insert, the committee insert or the outbox insert leaves no tournament, no committee rows, no audience groups and no outbox rows.
48. Idempotent create (v1.3): the same `client_request_id` twice from the same organizer → one tournament and one set of invitations, second call returns the original with `200`; two concurrent first submits → one tournament; the same id from a different organizer → a separate tournament.
49. Stale selection (v1.3): a group left, or a user deactivated, after the step but before submit → rejected with `field` and `step`; nothing is created; the wizard returns to that step with the other state intact (client test).
50. Wizard (web and mobile client tests, v1.3): step 3 shows all required fields and mirrors the five date rules; step 4 multi-select enforces the cap and shows only the caller's groups; step 6 uses the standard player search with Suggested and Other sections, the organizer is pinned and cannot be removed, "+" adds and "−" removes, and Next is blocked with no additional member; step 7 shows every value from steps 1 to 6 and each edit link returns to the right step with state kept; Submit is disabled while in flight; success shows the completion screen with the submitted fields.
51. "+" and "−" (client tests and a static check, v1.3): "+" stages in a screen with a submit step and sends in one without; "−" removes a staged entry and sends nothing; after a confirmed send the row shows the status chip and no "+" or "−"; a double tap on an immediate "+" sends once; a failed send returns the row to "+" with the label from `ui_labels`; accessible names come from `ui_labels` (no hardcoded strings); touch target is at least 44 pt; the glyph changes, not only the colour; a static check finds no remaining per-person or per-group "Invite" text button outside the shared component, with any exception listed in the Phase P report.
52. Create rate and scope (v1.3): the create route's existing rate limit still applies; a caller cannot read group or user data beyond what the existing scoped lookups return while using the wizard; test 34 now also walks every wizard step and the completion screen.

**Other:** generator determinism (same seed ⇒ identical draft), property tests (no rematch in round 1 of group, byes only top seeds, qualifiers ∈ {2,4,8,16}), template validation table tests, migration up/down tests on a copy, contract tests for AI response schema.

---

## 10. Implementation Phases

Backend, plus (v1.1) the web and mobile UI for the Release 1 flows. Migrations are written per phase; the human runs them. No RLS scripts. Each phase ships behind `lifecycle_version = 2` creation being disabled until Phase 10, so merges are safe. Phase 3 also ships behind `meetup.tournament.invitations.enabled` (default false), because it touches v1 behaviour, and may therefore ship before the rest of Release 1 completes (v1.2).

**Part A — Groups and games (P0, independent of this lifecycle).** TL-41–TL-62 covers:
1. Groups list sorted by `last_activity_at`, with search.
2. Cap of 20 groups per game; `event_groups` many-to-many.
3. `PATCH` on game accepts the full group list (replace semantics, diff computed server-side, cap enforced).
4. Invite/accept flow wiring used by the new screens.
5. Group picker endpoints with membership filter.
Acceptance: existing tests green; new tests for cap, replace semantics, ordering ties, search escaping. Detailed requirement text to be written into REQ when Part A is formalised (OI-8).

**Part B — Tournament lifecycle**

**Releases (v1.1).** Part B ships in two releases. **Release 1 = build phases 1–5, 7–10 plus 6a (upload), C (creation wizard, v1.3) and P ("+" and "−" controls, v1.3).** **Release 2 = 6b (engine, AI interpreter, planner generation).** Release 1 enables `lifecycle_version = 2` creation (phase 10) with `fixture_engine.enabled = false`. Release 2 adds `source=engine` without a schema change (AD-17 sockets).

| Phase | Content | Acceptance |
|---|---|---|
| 1. Verify & foundations | Confirm live CHECKs (notification types, action_type, visibility), `lifecycle_version`, config keys, `registration_phase`, policies skeleton | Schema facts recorded in an implementation report (BP-01); startup validation of config |
| 2. Templates | Table, `TemplateDefinition`, registry, admin endpoints, snapshot on create | Template validation tests; v2 create produces immutable snapshot |
| 3. Invitations (game model) | `tournament_invitations`, invite-group / invite-user / invite-email / list / revoke / respond, `invites_open()`, group cap and per-user cap, view and registration rules for v1 and v2 (AD-4), email claim at sign-up, `tournament_invited` notification, rewrite of the `policies.py` skeleton. Share is client-side and needs no backend. | Negative tests 1–4, 35–41 |
| 4. Registration | Phase-gated flows, team freeze, skill check | Tests 5–8 |
| 5. Committee v2 | `committee_flow_v2`, min-2, `fixture_publication` type, execute-on-approve | Tests 9–11 plus v1 regression |
| 6a. Fixtures: upload (Release 1) | Template download, upload parser and validator (AD-17), `source=upload` drafts, publication materialisation (shared), per-match edit under AD-9 rules | Tests 20, 26–33 |
| 6b. Fixtures: engine (Release 2) | Generators, constraints, planner generation, fit check, interpreter (AD-8) behind `fixture_engine.enabled` | Tests 14–16, determinism |
| N. Navigation (Release 1, web and mobile UI) | AD-16 shell rule on web; mobile boards use the approved bar; Games / Tournaments switch | Test 34 |
| 7. Results & standings | Result log, validator, advancement, standings publication, correction guard | Tests 17–19 |
| 8. Reminders | Table-driven loop, heartbeat, reconcile | Test 21 |
| 9. Record & close-out | Record endpoint, closeout, visibility toggle | Tests 12–13 |
| C. Creation wizard (Release 1, v1.3) | Backend create contract (AD-18): date rules, `group_ids` and `tournament_audience_groups`, committee validation and `invited` rows, `client_request_id`, atomic create, `groups` field; visibility rule widened to any audience group; the two new config keys registered in the admin settings dashboard (runtime configuration is managed through the admin interface, never set by hand in the database; owner principle, 2026-10-19); web and mobile wizard steps 3, 4, 6, 7 and the completion screen. Needs phases 2 and 5. Starts by recording the `HOME_TIMEZONE` rule, the player-search suggested rule and the create idempotency approach (BP-01). | Tests 43–50, 52 |
| P. "+" and "−" controls (Release 1, v1.3) | Inventory of current Invite controls in both repos, one shared component per platform (AD-19), replacement on games, groups and tournaments, label keys in `ui_labels`. UI only; ships independently of the lifecycle phases. | Test 51 |
| 10. Enable | Flip v2 creation on, soak, measure | §11 gate |

Each phase ends with a short implementation report (as-built schema + deviations) written back to this document (BP-13).

### Phase 1 as-built (tl-r1-p1-foundations, 2026-10-14)

Recorded from the Alembic chain ending at `a6ae090d2579`. No live `pg_constraint` catalog was queried. The phase-1 revision `e8c1a4b72d09` is written and was not executed. Approval status of this document is unchanged.

**CHECKs confirmed, not widened**

- `tournaments.visibility` (`chk_tournaments_visibility`, migration `3021d82abdda`): `public`, `group`, `invite`. `private` is not in this CHECK. `205129b7dcd9` adds a separate `chk_tournaments_group_visibility` predicate and does not replace the list.
- `tournament_approval_requests.action_type` (inline CHECK, `465e78ba2dfd`), repeated on `committee_step_up_challenges.action_type` and `committee_elevated_action_tokens.action_type` (`025554379297`): `score_entry`, `fixture_approval`, `standings_publication`, `team_disqualification`, `tournament_dissolution`, `committee_membership_change`. `fixture_publication` and `fixture_reschedule` are absent.
- `notifications.notification_preferences.notification_type` (`chk_notification_preferences_type`, last widened by `d5b9f3c82a10`): the current set includes `tournament_match_scheduled`, `tournament_result_posted`, `tournament_cancelled`, `tournament_schedule_published`, `tournament_standings_published`. There is no separate inbox-table CHECK. AD-15 types still absent, so not widened in this phase: `tournament_invited`, `tournament_added_by_committee`, `tournament_match_reminder`, `tournament_match_rescheduled`, `tournament_approval_requested`, `tournament_approval_resolved`, `tournament_invite_revoked`, `tournament_committee_changed`, `tournament_committee_invited`, `tournament_reschedule_requested`, `tournament_disqualified`, `tournament_dissolved`, `tournament_completed`. `tournament_match_scheduled` stays unused by v2.

**Columns added (migration only)**

- `tournaments.lifecycle_version SMALLINT NOT NULL DEFAULT 1`. It did not exist before `e8c1a4b72d09`. Existing rows stay 1. No code path sets 2.
- `tournaments.registration_hard_block_at TIMESTAMPTZ NULL`. Soft block remains `registration_closes_at`. `registration_phase()` is the only phase decision (AD-5) and refuses version 1.

**Config.** §7.1 keys with stated defaults are seeded (ON CONFLICT DO NOTHING). `fixture_engine.enabled` is seeded `false`. Model ids are not seeded. API lifespan and worker `startup_checks` call `read_and_validate_tournament_config` before serving. Assumptions for unspecified bounds, the empty AI host allowlist, conditional model ids, and the `last_run` heartbeat are in the phase-1 implementation report. `meetup.tournament.v2_enabled` (§11) is not part of §7.1 and was not added.

**OI-5.** v1 still reads live `team_memberships` for tournament audience, registration, history, and "my tournaments" (`tournaments/service.py`, `tournaments/repository.py`, `tournaments/strength_engine.py`, `notifications/fanout.py`, `users/repository.py`, plus `fn_materialize_deliveries` in the notification migrations). AD-2 leaves those paths in place. `tournament_registration_members` is not created in this phase. A test locks that file set so a new module cannot add another read.

**OI-7 audience (Python fan-out, `notifications/fanout.py`).** `tournament_match_scheduled` and `tournament_result_posted`: the fixture's two registered participants, expanded through live `team_memberships`. `tournament_cancelled` and `tournament_schedule_published`: every non-withdrawn registration, same expansion. `tournament_standings_published`: registered registrations, organizer excluded, same expansion. Any other type, including every absent AD-15 type, raises `FanoutError`.

**OI-7 sibling imports of the planned §4 calls.** Not introduced in phase 1. `invitations.py → groups` matches the existing `tournaments → groups` direction; `groups/` does not import `tournaments` (it uses raw SQL for that reason). `committee_flow_v2 → decision_key` stays inside `tournaments/` (`decision_key.py`); `admin/` already imports that module. Phase 2 does not add `admin → templates.py`. The template router lives in `tournaments/` and is mounted from `main.py`, which injects the platform-admin guard and the `admin_action_log` writer.

### Phase 2 as-built (tl-r1-p2-templates)

Migration `a91d4e7c2b18` (revises `e8c1a4b72d09`) is written and was not executed. Approval status of this document is unchanged. No template rows are seeded. `meetup.tournament.v2_enabled` is seeded `false`.

**Table `tournament_format_templates`.** `id UUID`, `slug VARCHAR(80)`, `version INTEGER`, `status VARCHAR(20)` CHECK (`draft`, `active`, `retired`), `definition JSONB`, `schema_version INTEGER`, `created_by UUID` references `users(id)`, `created_at TIMESTAMPTZ`, UNIQUE (`slug`, `version`). GRANT is `SELECT, INSERT, UPDATE` to `meetup_app` only (no DELETE), signed off in the phase-2 review rework. No RLS and no policy.

**`tournaments` columns.** `template_id UUID NULL` references `tournament_format_templates(id)` ON DELETE RESTRICT, `template_version INTEGER NULL`, `rules_snapshot JSONB NULL`, `rules_locked_at TIMESTAMPTZ NULL`. v1 rows stay NULL. `rules_locked_at` is the existing structured-rules `locked_at` pattern under a distinct name.

**Audit.** `chk_admin_action_log_type` gains `tournament_template_create`, `tournament_template_publish`, `tournament_template_retire`. No other action type changed. The insert is a plain row write. It does not set a session user and does not rely on a row-level security policy. RLS on `admin_action_log` and `tournaments` was removed by `f5e50df15ecf` (2026-10-04). The v2 tournament insert does not set `app.current_user_id`.

**Routes.** `GET/POST /admin/tournament-templates`, `POST /admin/tournament-templates/{id}/publish`, `POST /admin/tournament-templates/{id}/retire`, mounted from `main.py`. v2 create is `POST /tournaments/v2` so the existing `POST /tournaments` handler is unchanged. `v2_enabled` false returns 409 and writes nothing. Visibility `private` is refused: the live CHECK still has no `private`.

**Definition schema_version 1.** Closed Pydantic model. Registry accepts `draw_resolution` only for `knockout` and `group_stage` only for `group_stage`. Publish checks are the AD-3 rules. Organizer overrides are limited to `entrants_min`, `entrants_max`, `team_size_min`, `team_size_max`, and each limit must sit inside that pair. Canvas-only controls (third place, seeding, tie-break points) are not fields in this schema.

---

## 11. Deployment & Rollback

- Migrations additive; rollback = leave tables unused (forward-only data), code rollback via redeploy. No column dropped or retyped.
- v2 creation guarded by config flag `meetup.tournament.v2_enabled` (default false). Disabling it hides creation only; running v2 tournaments continue.
- Worker deploy order: migration → api → worker. Phase 1 startup validation makes this mandatory: the API and the worker both refuse to start while a required `meetup.tournament.*` key is missing or out of bounds, so deploying either process before `e8c1a4b72d09` is an outage. A bad tournament key stops the whole worker, including push and event reminders (accepted for phase 1; reassess in phase 8, when the worker first consumes the keys). Rollback of this revision is forward-only: leave the columns and rows, redeploy the previous code. Do not drop the columns on a database that has been deployed. Runbook: `docs/runbooks/tournament-lifecycle-phase1-deploy.md`.
- **v1.3:** the Phase C migration is additive (one table, one nullable column with a partial unique index); rollback leaves them unused. The wizard is reachable only after Phase 10 enables v2 creation. Phase P is UI only; rollback is a client redeploy.
- **Contract gate (v1 removal):** only when zero non-terminal v1 tournaments exist for 30 consecutive days, verified by query. Separate design/approval.
- Rollback of the AI interpreter: set endpoint whitelist empty → breaker/failed path, rest unaffected.
- Rollback of invitations (v1.2): set `meetup.tournament.invitations.enabled = false`. Routes return 404 and the v1 registration rule returns. Rows are kept.

---

## 12. Principles & Best-Practices Compliance

| Principle | Design element | Status |
|---|---|---|
| P1 Config-driven | §7.1, AD-3, AD-14; v1.3: two new keys in the admin settings dashboard, control labels from `ui_labels` | Met |
| P2 | Baseline | Unchanged |
| P3 Shared library | Invitation logic copied from `events/` into `tournaments/` (D-7) | **Deviation** |
| P4 | Baseline | Unchanged |
| P5 Idempotency | Result idempotency key, reminder key, decision key; v1.3: `client_request_id` on create | Met |
| P6 Immutable context | `rules_snapshot`, payload hash, standings snapshots, result log | Met |
| P7 Fault isolation | AI breaker, reminder loop isolated, outbox hand-off | Met |
| P8 Determinism | Seeded generators | Met (spirit) |
| P9 Validate at boundary | §6 | Met |
| P10 Least privilege | Admin excluded from feedback/record; worker role boundary preserved | Met |
| P11 | Baseline | Unchanged |
| P12 Retention | OI-6 open | **Open** |
| P13 Negative tests | §9 | Met |
| P14 Additive evolution | AD-2, §5.1, §11; v1.3: `group_id` kept, `groups` added | Met |
| P15 Shift-left authz | App-layer policies; no RLS added | Met |
| P16 Encryption | Baseline | Met |
| P17 Rate limits | Invite routes (route limit, per-user cap), interpreter calls | Met |
| BP-01 Verify schema | Phase 1 | Planned |
| BP-11 Intent vs evidence | Publication binding | Met |
| BP-12 T1 simplicity | No new service, no queue, no rule engine | Met |
| BP-13 Write-back | Per-phase reports | Planned |

**Deliberate deviations (flagged)**
| # | Deviation | From | Rationale |
|---|---|---|---|
| D-1 | Tournament reminders use a table-driven worker loop instead of per-item APScheduler jobs | `DES-MEETUP-ADDENDUM-event-reminder` AD-1 (precedent, not a principle) | Reminder rows are durable, times change often, worker already polls |
| D-2 | Maker-checker without OTP for v2 | Baseline R-332 | Owner decision; payload binding and distinct-member rule retained |
| D-3 | Single-member score entry and bounded (≤ threshold, same-day) post-publication schedule edits | Baseline score_entry maker-checker | Owner decision; mitigated by append-only log and downstream guard |
| D-4 | `decision_key` is the one cross-module import | "Zero sibling imports" | Already existing exception; no new ones added (verify in Phase 1, OI-7) |
| D-5 | Requirements restated in-document instead of an approved REQ addendum | solution-design precondition | Process note 1 |
| D-6 | `invited_email` stored in plaintext on the invitation row, as games do | v1.1 §5.3 (hashed email) | Claim is by invitation id, so hashing for matching adds nothing, and the organizer list shows the address. Retention is OI-13. |
| D-7 | Invitation logic is a copy of the games pattern inside `tournaments/`, not a shared library | P3 (no duplication across modules); zero sibling imports | Owner decision: same behaviour as games. Gate to extract (BP-10): a third module needs invitations, or one rule change has to be applied in both modules twice within 90 days. |

---

## 13. Requirements Coverage

| Requirements | Section |
|---|---|
| TL-01–TL-08 | AD-3, AD-8, AD-10, §5.1 |
| TL-09–TL-13 | AD-4, §6 |
| TL-14–TL-18 | AD-5, AD-6, AD-18 (TL-14) |
| TL-19–TL-22 | AD-7, AD-18 (TL-19) |
| TL-23–TL-27 | AD-8, §6 |
| TL-28–TL-30 | AD-9 |
| TL-31 | AD-12 |
| TL-32–TL-34 | AD-10, AD-11 |
| TL-35–TL-36 | AD-13 |
| TL-37 | AD-6, AD-10 |
| TL-38 | AD-15 |
| TL-39 | AD-3, §4 |
| TL-40 | AD-2 |
| TL-41–TL-62 | Part A (§10) |
| TL-63–TL-69 | AD-17, §10 phase 6a |
| TL-70 | AD-16, §10 phase N |
| TL-71–TL-73 | AD-4, AD-6, §10 phase 3 |
| TL-74–TL-80 | AD-18, §10 phase C |
| TL-81–TL-82 | AD-19, §10 phase P |

Deferred (named): multi-venue scheduling, fees, umpires, v1 contract phase, Release 2 engine (TL-23–TL-27 are Release 2; Release 1 replaces them with TL-63–TL-69).

---

## 14. Open Items

| ID | Item | Severity | Blocking |
|---|---|---|---|
| OI-1 | Template authority. **CLOSED:** single-admin publish/retire retained (snapshot isolates running tournaments; audited in `admin_action_log`; revisit if ≥2 platform admins exist). | — | No |
| OI-2 | AI provider, region, wording. **CLOSED (owner decision, round 3):** Anthropic API direct/multi-region (US), residency dropped, registered as cross-border transfer under commercial DPA, qualified wording locked in AD-8. Residual: wording must ship before v2 is enabled; DPA/register entry to be confirmed by owner. | — | No |
| OI-3 | Committee consent. **CLOSED:** `invited → active`, gate at draft generation/publication submit (AD-7). Consent only; does not stop a creator-controlled second account. | — | No |
| OI-4 | Post-publication reschedule. **CLOSED:** dual-threshold model (AD-9), `fixture_reschedule` added to the action catalogue. | — | No |
| OI-5 | Teams-module roster edits must have zero effect on `tournament_registration_members` (AD-6). Verify no code path reads live `team_memberships` for tournaments; add test. | 🟡 MEDIUM | No (Phase 1 gate) |
| OI-6 | Proposed default: purge comment text, superseded drafts and AI request logs 90 days after completion; keep results, standings, published payloads (incl. seed). Purge job needs dead-man detection. Owner to confirm and reflect in privacy policy. | 🟡 MEDIUM | No |
| OI-7 | Verify live CHECK constraints and audience rules for notification types; verify zero-sibling-import compliance of planned calls. | 🟡 MEDIUM | No (Phase 1 gate) |
| OI-8 | Part A requirement text and formal REQ addendum. | 🟢 LOW | No |
| OI-9 | Native mobile app: show the bottom bar on wizards, forms and detail screens, or only on top-level screens? AD-16 binds web only. Owner to decide. | 🟡 MEDIUM | No |
| OI-12 | Part A (multi-group games) is not built: `GAME_MAX_GROUPS_V1 = 1` in `events/service.py`. Tournament invitations cap distinct invited groups at 20, independent of the single `tournaments.group_id`. Confirm the cap semantics when Part A lands. | 🟢 LOW | No |
| OI-14 | (v1.2.2) Group invite by a non-organizer group owner or admin is web-only: the groups list exposes no role field, so mobile offers group invite to `full` access only and web lists only groups the user owns. Closes when the groups API exposes the caller's role (additive). Owner: architect. |
| OI-13 | Retention of `invited_email` on unclaimed, declined or expired tournament invitations (P12). Same open question as games. Owner to set a period. | 🟡 MEDIUM | No |
| OI-15 | (v1.3) Wizard step 4 sets visibility scope only: selecting groups sends no invitation and no notification (AD-18). This is an architect assumption, not an owner decision. If selected groups should also be invited on submit, that is an amendment reusing AD-4 group invites (one invitation per member, cap 20). | 🟡 MEDIUM | No |
| OI-16 | (v1.3) `audience_group_cap` (20) and `committee_max` (10) are architect defaults, editable in the admin settings dashboard; confirm or change after the first tournaments. | 🟢 LOW | No |

Status: v1.0 and v1.1 APPROVED by the owner on 2026-10-14. v1.2 APPROVED by the owner on 2026-10-16. v1.3 APPROVED by the owner on 2026-10-19. No blocking items. Phase 1 verification of OI-5 and OI-7 is recorded under §10 "Phase 1 as-built"; this paragraph does not change that approval. OI-5 is not closed: v1 still reads live team membership, which AD-2 keeps until a later phase writes `tournament_registration_members`. OI-7's verify step is done; the CHECK widening and the new audience branches are later phases.

---

## 15. Review Log

**Round 1 (2026-10-14, external review, v0.1 → v0.2)**

| Finding | Classification | Outcome |
|---|---|---|
| Push-based advancement / need recursive CTE | Partly valid | Inbound `source_*` already existed; clarified as authoritative + consistency test. Recursion rejected (one-hop invariant). `in_progress` guard and retroactive DQ path added. |
| Single-member reschedule | OI-4 was open | Threshold model recommended, owner decides. |
| `FOR UPDATE` on tournament row | Valid | Replaced by advisory locks, lock ordering added. Separate counter table rejected (BP-12). |
| Committee consent | Valid (consent), invalid (as hijack control) | OI-3 raised to HIGH, owner decides. |
| OI-1 two-admin | Defended | Not adopted. See response; owner decides. |
| OI-2 regex/prompt | Valid | Pre-filter added. |
| OI-5, OI-6 | Accepted | Severity/default updated. |
| rng_seed in hash, partial index, deadlock analysis | Valid | Added. |

**Round 2 (2026-10-14, v0.2 → v0.3)** Reviewer confirmed locking, one-hop DAG and audit-envelope changes. Recorded: OI-1 closed (single-admin), OI-3 closed (consent, gate at generation not at hard block, since the hard block is time-computed), OI-4 closed (30-minute same-day single-member bound, `fixture_reschedule` otherwise). OI-2 remains open: provider, region and T&C wording need owner confirmation. Status not changed.

**Round 3 (2026-10-14, v0.3 → v0.4)** OI-2 closed per owner decision: provider, region/cross-border treatment, qualified T&C wording. No blocking items remain. Status left DRAFT: approval and the v1.0 bump happen when the owner says so.

**Round 4 (2026-10-14, v0.4 → v1.0)** Owner approved. Next: implementation per §10, Phase 1 first.

**Round 5 (2026-10-14, v1.0 → v1.1, owner-requested amendment)**

| Finding | Classification | Outcome |
|---|---|---|
| Tournament screens showed a bottom bar that differed from the rest of the app | Valid (design error, mine) | Contradicted dashboard v1.8. Canvas fixed (v50). Rule written as AD-16, TL-70, test 34. |
| Release 1 should not generate fixtures; use Excel upload | Owner scope decision | AD-17, TL-63–TL-70, Releases in §10. AD-8 retained as Release 2 because the end state still needs the engine. |
| Excel upload is a new attack surface | New finding | Mitigations in AD-17 (formula/macro/link rejection, size/ratio limits, values-only read, ID-based matching, all-or-nothing validation) and tests 27–31. |
| Advancement links come from the sheet, not inferred | Assumption, confirmed by approval | Recorded in AD-17. |

**Round 6 (2026-10-16, owner decisions in conversation, v1.1 → v1.2)**

| Decision or finding | Classification | Outcome |
|---|---|---|
| Share should be the app or Play Store link, as for games | Owner decision | TL-13 and AD-4 rewritten. Share token, access grants, `?t=` redemption and rotation removed. |
| Invitations should behave exactly as games | Owner decision | AD-4 rewritten to the game model (per-member invitations, email claim, accept or decline, organizer list and revoke). Costs recorded as D-6 (plaintext email) and D-7 (P3 duplication). |
| Who may invite | Owner decision (option B) | Organizer and committee always; any viewer on public tournaments (individuals, and groups they own or administer). The group owner or admin rule is taken from games and is narrower than v1.1's "groups they belong to". |
| v1 `invite` tournaments cannot be discovered or joined by invitees: visibility is organizer or registered, and only the organizer registers people | New finding (BP-01) | AD-4 view and registration rules; one v1 behaviour change, flagged in AD-2 and gated by `invitations.enabled`. |
| Phase 1/2 `policies.py` skeleton assumes `kind`-based invitations and access grants; no migration creates the invitation tables | New finding (BP-01) | Rewritten in Phase 3 (AD-4, §5.1). |
| §10 said v2 creation is enabled at Phase 6 and at Phase 10 | BP-03 defect | Fixed: Phase 10. |

**v1.0 and v1.1 approved by the owner, 2026-10-14**, including the recorded assumption that the sheet carries the advancement links. **Round 7 (2026-10-16, external review of v1.2, then owner approval)**

| Finding | Classification | Outcome |
|---|---|---|
| 1.1 Bulk invitation inserts could deadlock on foreign-key locks | Valid, minor (the described cycle does not occur: FK checks take `FOR KEY SHARE`, which conflicts only with `FOR UPDATE`) | Bulk insert sorted by `invitee_user_id` (AD-4). Severity LOW. |
| 1.2 Team registration let one invitee bring non-invited players into an `invite` tournament | New gap, MEDIUM | Owner chose option B: every roster member needs an accepted invitation (AD-4, TL-17, test 38). |
| 1.3 Advisory lock key namespace (`hashtext` pair) | Deviation challenge, defended | `hashtextextended` is a 64-bit key; a collision only causes false serialisation. The proposed `hashtext` objid is 32 bit and collides more often. Same pattern as the venue feed and OneMap locks. No change. |
| 2.1 Fewer than 2 active committee members at the hard block | Already covered | AD-7: the creator may replace committee members at any time; §7.2 `needs_committee`. A `committee_deficit` state rejected (BP-12). No change. |
| 2.2 Downstream check must include the loser path | Valid, MEDIUM | AD-10 and test 18 now cover `loser_next_fixture_id`. |
| 3 Excel hardening | Mostly already specified | `data_only=True` rejected (it hides formulas, defeating AD-17 and test 27); library choices are implementation detail covered by tests 27 to 31. Valid gap: formula injection through generated template cells; AD-17 and new test 30a. |
| 4 D-7 duplication | Deviation challenge, defended | D-7 already carries a measurable gate; Part A changes `event_groups`, not `event_invitations`. No change. |
| PDPA transfer | Informational | Already in AD-8 and OI-2; not needed for Release 1. |

**Round 8 (2026-10-16, owner decision, v1.2 → v1.2.1)**

| Decision or finding | Classification | Outcome |
|---|---|---|
| The app could not tell whether the viewer holds a pending invitation, so an app-only invitee on an `invite` tournament could not accept and therefore could not register | New gap (client contract), owner chose option A | Additive read-only field `my_invitation_status` on `GET /tournaments/{id}` (AD-4), test 42a. Accept and decline UI built on web and mobile. |

**Round 9 (2026-10-16, implementation reports, v1.2.1 → v1.2.2)**

| Finding | Classification | Outcome |
|---|---|---|
| B1 No GRANT on `tournament_invitations`; routes fail in production | Valid (repo has no default privileges) | Owner-approved GRANT, no DELETE, in the migration (§9 table). |
| B2 Web game share carries identity; test 42 wording | Valid wording defect | Web tournament share uses `/public/share`; test 42 clarified. |
| B3 List blocked after registration closes | Valid design gap | Window rule exempts `GET …/invitations` (AD-4). |
| B4 `registered` view branch not implemented | Valid; the branch was already in AD-4 | Implement for v2, preserve for v1 (AD-4). |
| M1 Mobile group invite for group owners and admins | Deferral | OI-14. |

**v1.2 approved by the owner, 2026-10-16** (after review round 7); **v1.2.1 approved the same day.**

**Round 10 (2026-10-19, owner decisions in conversation, v1.2.2 → v1.3)**

| Decision or finding | Classification | Outcome |
|---|---|---|
| "Registration closure date" in step 3 | Owner decision | It is the existing soft block (`registration_closes_at`); the hard block date is captured as well, as in the design (AD-18, TL-74). |
| Committee at creation | Owner decision | The organizer is committee member 1 by default; at least one additional member is required (TL-78, AD-18). |
| "+" and "−" instead of Invite buttons | Owner decision | App-wide: every Invite button on web and mobile across games, groups and tournaments; behaviour as AD-19. |
| Step 4 multiple groups: `tournaments.group_id` is a single column | New finding (BP-01) | `tournament_audience_groups`; `group_id` mirrored for existing readers (AD-18, §5.1). The table is named apart from `tournament_stage_groups`. |
| What selecting groups does (visibility only, or also invites) | Architect assumption, flagged | Visibility only (OI-15). |
| Meaning of start and end time | Architect ruling | They are the daily playing window as well; no overnight windows (AD-18). |
| A double tap on Submit could create two tournaments | New gap (P5) | `client_request_id` with a partial unique index (AD-18, test 48). |
| New config keys must be editable in the admin interface | Owner principle, 2026-10-19 | Registered in the admin settings dashboard in Phase C. |

**v1.3 approved by the owner, 2026-10-19.**
