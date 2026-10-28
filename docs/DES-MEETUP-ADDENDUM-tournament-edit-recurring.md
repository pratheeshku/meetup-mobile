# DES-MEETUP-ADDENDUM-TOURNAMENT-EDIT-RECURRING

**Doc ID:** DES-MEETUP-ADDENDUM-TOURNAMENT-EDIT-RECURRING
**Version:** v1.4
**Status:** **APPROVED by the owner, 2026-10-27** (instruction in conversation: "prepare design & mark it approved. Push to gh repo", given after elicitation of the same day). Approval covers section 1 (requirements, restated from the owner's words) and the assumptions marked **[A]** in sections 3 and 5. Open items are in section 12.
**v1.1 amendment (2026-10-27):** architect amendment after the `er-p1-verify` (step 1.0) report, PR #158. Each 1.0 finding is classified and resolved in the paragraphs marked **[v1.1]** (rulings B-1 to B-8). Issued under the owner's 2026-10-27 instruction "go ahead with step 1"; an objection before the 1.1 build starts reverses the affected ruling.
**v1.2 amendment (2026-10-28):** architect amendment after the `er-bw-tournament` (step 1.1) report, PR #160, merged 2026-10-28. Accepted judgement calls are written back in the paragraphs marked **[v1.2]**; no requirement changed.
**v1.3 amendment (2026-10-28):** architect correction after the `er-bw-shuffle` (step 1.2) report, PR #162: the draw counts of AD-7 and section 5.4 (an arithmetic error of the architect); no requirement or behaviour changed.
**v1.4 amendment (2026-10-28):** architect amendment after the `er-bw-series` (step 1.3) report, PR #164: accepted judgement calls and the contract shapes the clients build on are written back in the paragraphs marked **[v1.4]**; no requirement changed.
**Owner:** Pratheesh
**Date:** 2026-10-28
**Scale Tier:** T1
**Baseline:** repo `pratheeshku/meetup` `main` @ `37258bb` and `pratheeshku/meetup-mobile` `main` @ `fe72b02` (code read 2026-10-27). Design-only addendum. It does not edit other documents; section 9 lists what it amends and each of those gets a one-line pointer at its next revision.
**Governing files:** `Enterprise_Design_Principles.md` v1.1 (P1-P17) and `design-best-practices.md` v1.0 (BP-01-BP-13). Both read in full from the Project knowledge base before drafting (Phase 1.5 gate passed). Neither is deviated from (section 10).
**Depends on:** `DES-MEETUP-ADDENDUM-tournament-lifecycle` v1.4 (AD-5 phases, AD-6 table, TL-14 to TL-16), `-tournament-registration` v1.3, `-teams-payments` v1.2, `-match-scoring` v1.3, `-tournament-experience`, `-decline-response`, `-invitation-response`, `-access-consistency`, `-closure-report`, and `DES-FIXTURE-CORE-001` v1.4 (library 0.2.0, vendored).
**Process notes (flagged):**
1. No `REQ-MEETUP` addendum exists for this batch. The owner's items and answers of 2026-10-27 are restated as `ER-01..ER-32` in section 1.
2. **Weekly recurrence already exists in the backend** (`event_recurrence_rules`, `jobs/recurring_events.py`, create fields `recurrence_*` on `POST /events`) with **no web or mobile screen**. This design adds the series semantics the owner asked for (acceptance for the whole series, skip, leave, edit or cancel this and following, an end rule) and the screens. The cap of 8 future instances is hard-coded in the job today and moves to configuration (AD-8).
3. **Correction to a statement made in conversation:** the owner was told the shuffle needs a library change. Reading the vendored library (0.2.0) shows `apply_edit(swap_entrants)` already permits swaps between groups inside one pot (exchange set, DES-FIXTURE-CORE-001 FD-5, section 4.9). The shuffle is therefore built in the tournament adapter from library edits. A Phase 1 gate proves it; if it fails, a library revision is the fallback (AD-7, OI-1).
4. The owner's decision "participants see only the registration closure date" together with "participants withdraw until the soft block" fixes the normal participant withdrawal cutoff at the **soft block**. This narrows today's rule (self-withdraw allowed until the hard block, lifecycle AD-6). It was inferred from the two statements and is recorded as D-3 so the owner can reverse it.
5. Code facts below were read from the repositories on 2026-10-27 and replace any assumption from conversation. Items not checkable from the backend repo (mobile screens, notification routing on mobile) are checked in Phase 1 of the mobile task (OI-9).
6. Generation of fixtures stays after the hard block (lifecycle TL-16); the committee override (AD-5) only changes who may add or remove entrants after it.

---

## Plain-language summary

- **Recurring games.** An organizer can make a game repeat weekly (every 1 to 4 weeks), ending after a number of games or on a date. Invitees accept **once for the whole series**. A member can skip one game or leave the series. The organizer can edit or cancel one game or "this and the following".
- **Registered count.** Tournament lists and views show how many have registered, with no "/32". A full tournament shows "Full". The cap itself is unchanged: it comes from the tournament template, set by an admin.
- **Edit a tournament until it starts.** The organizer can change dates and venue up to the start time. Changed dates must be in the future. Registrations stay. If the registration closure had already passed, the organizer sets a new future closure date, which reopens registration. Players can withdraw until the closure date unless the organizer switches that off for the edit. Fixtures are reset when dates, venue or the roster change after they were generated.
- **Hard block is internal.** The soft block and hard block dates are visible to the organizer and committee only. Everyone else sees one date, "Registration closes".
- **Committee can still add or remove.** After the registration closure, and after the hard block, the committee can add an individual or a player-created team, and remove one, until the first result is recorded or the tournament starts.
- **Shuffle.** After fixtures are generated, the committee can press "Shuffle again" to see the next balanced draw. Nobody moves group members by hand. The top players stay in separate groups.

---

## 1. Context and Requirements

**Problem.** Games cannot be created as a repeating series from any screen. Tournament lists show "1/32" for every tournament, which comes from a template default and means nothing for group tournaments. A tournament cannot be edited after the schedule is published, hard-block dates are shown to everyone, registration can only be reopened by nobody, and a team cannot be added by the committee after the soft close. The fixture draft is deterministic with no way to ask for another balanced draw.

**Requirements (BP-02: what, not how).** `Owner` means stated by the owner on 2026-10-27; `Architect` means derived by the architect from the principles or the code and approved with this document.

| ID | Requirement | Source |
|---|---|---|
| ER-01 | A game can be created as a recurring invite, like an Outlook recurring meeting. | Owner |
| ER-02 | Recurrence is weekly only for now. | Owner |
| ER-03 | Invitee acceptance applies to the whole series. | Owner |
| ER-04 | A series member can skip one occurrence without leaving the series, and can leave the series. | Architect |
| ER-05 | The organizer can edit or cancel one occurrence or "this and the following". | Architect |
| ER-06 | A series ends after a number of occurrences or on a date, never unbounded from the new screens. The maximum length is admin-configured. | Architect |
| ER-07 | Tournament lists and views for group and public tournaments show the number registered only, not "registered / capacity". | Owner |
| ER-08 | The participant limit comes from the tournament template and is set by an admin. An admin can raise it for new tournaments. | Owner (question), Architect (answer) |
| ER-09 | Fixture generation uses the same entrant limit as registration. | Owner |
| ER-10 | A team event is entered by teams the players have created. A solo player creates their own team. | Owner |
| ER-11 | The organizer or committee can add a team or an individual, matching the event type, after the soft block. | Owner |
| ER-12 | The organizer can edit a tournament until its actual start date and time. | Owner |
| ER-13 | When tournament dates are changed, each changed date must be later than the current date and time. | Owner |
| ER-14 | After an edit, existing player and team registrations stay as they are. | Owner |
| ER-15 | If the soft block has already passed at edit time, the organizer moves it forward to a new future date. | Owner |
| ER-16 | A main reason for a date change is too few participants: extending registration must be the simplest edit. | Owner |
| ER-17 | After an edit, players and teams can withdraw until the (new) soft block. The organizer decides per edit whether to allow it. The organizer can still add or remove entrants until the hard block. | Owner |
| ER-18 | If the date changes after fixtures were generated, the fixtures are reset. | Owner |
| ER-19 | If the organizer judges that adding or removing participants can still be done in time, the system does not block them. | Owner |
| ER-20 | Venue changes after fixtures exist reset them like date changes. | Architect |
| ER-21 | The soft block and hard block dates are visible to the organizer and committee only. Participants see only the registration closure date (the soft block) and the actions that follow from it. | Owner |
| ER-22 | The organizer does not shuffle group members. The organizer can only shuffle the fixtures. | Owner |
| ER-23 | The shuffle keeps the top players in separate groups. | Owner |
| ER-24 | The shuffle is a rotation of columns of the snake draw (a pot is rotated across groups), keeping the snake. | Owner |
| ER-25 | After fixtures are generated, a "Shuffle again" button shows the next fixture with its group placement. | Owner |
| ER-26 | Only balanced draws are offered. | Architect (owner approved the recommendation) |
| ER-27 | Roster changes lock at the first recorded match result or at the start, whichever is first. | Architect |
| ER-28 | Every committee override and every edit is logged (who, when, what, whether fixtures were reset). | Architect, P6 |
| ER-29 | Every changed tournament detail notifies the people it affects, once per person. | Architect |
| ER-30 | Runtime limits (series length, interval, horizon, shuffle tolerance) are managed in the admin interface. | Owner principle (2026-10-19), P1 |
| ER-31 | Every new access rule has an API-level negative test. | P13, P15 |
| ER-32 | Delivery runs in four steps: instruction execution for `meetup`, build for `meetup`, instruction execution for `meetup-mobile`, build the mobile app, tracked with step counts (section 11). | Owner |

---

## 2. Scope and Constraints

**In scope.** Recurring-game creation, series membership and series actions (backend, web, mobile). Registered-count display. Tournament edit until start, including the hard-block field, withdrawal choice, fixture reset and notification. Block-date visibility. Committee add and remove after the soft close, team add by the committee. Shuffle of the fixture draft. Admin configuration keys. Labels. Tests.

**Out of scope.** Daily or monthly recurrence; per-occurrence exceptions beyond skip, edit and cancel; recurring tournaments. Raising the participant cap of an existing tournament (OI-4). Refunds or payment handling beyond the existing paid-entrant removal line (teams-payments AD-12). A library change to `fixture_core` (only a fallback, OI-1). The mobile team journey beyond what `tp-mobile` and `tp-mobile-teams` build. Standalone knockout and round robin formats (not built; the shuffle applies to groups + knockout only).

**Constraints.**
- T1. Modules keep zero sibling imports (enforced). Authorization lives in `policies.py` and `shared_auth_core`. No new RLS, DB triggers or DB-side validation.
- Migrations are written, never run by an agent; the owner runs them one at a time with `alembic upgrade +1` (AGENTS.md).
- Versions are assigned by the architect. Briefs are given in chat and never committed.
- A clean `alembic` chain: new revisions start from the current head, which the agent reads from `migrations/versions` at task start (BP-01).

---

## 3. Architecture Decisions

**AD-1: Registered count without a denominator (ER-07, ER-08, ER-09).**
- Fact: the "1/32" is `tournaments.capacity`, a mirror of the template's `entrants_max` in the immutable `rules_snapshot` (`templates.py`, `registration_v2._entrants_max`). The seeded groups + knockout template (`scripts/seed_template_groups_knockout.py`) sets 32 and has no `organizer_overrides`, so no organizer can change it. Registration refuses the next entrant with 409 `TOURNAMENT_FULL`. In team mode the count is teams.
- Decision: every tournament list row, card, header and view shows `{count} registered` and, when the count has reached the cap, a **Full** chip. The cap number is shown only on the organizer and committee participants screen, which already reads "{count} of {max}". The payload keeps `capacity` and `registered_count` (P14: no field removed) and gains a read-only `is_full` boolean set by the server. Clients must not compute fullness. **[v1.1]** `registered_count` is populated today only by the list route: it and `is_full` are set on **every** route that returns the model (one batched count per request, no per-row queries, P7), `/mine`, `/{id}`, the `settings_dashboard` lists and the create and PATCH answers included. The web stops computing fullness from the registrations list. Organizer-only "{count} of {max}" keys (`web.tournament.participants.registered_of`, `web.gv.registered_of`) stay; only participant-facing keys change (D-5, D-14).
- Labels: new label keys for the count-only text and the Full chip are added; the old keys with a `/{cap}` placeholder stay seeded and unused.
- The admin raises the cap by editing and publishing the template (`entrants_max`), which applies to **new** tournaments only; existing tournaments keep their snapshot (TL-03). No ceiling is added at T1 (BP-12); the generation limit is `len(registered)` (`engine_service.generate_draft` -> `adapter.library_limits`), so fixtures need no separate cap. The library's own bounds (1024 rows, 200000 search nodes) have not been exercised above 128 entrants; the gate is OI-3.
- The `fixture_workspace` module has its own `max_entrants` (4 to 256, default 128). That is the admin CSV workspace, not tournament generation, and is unchanged.

**AD-2: Team events are entered by player-created teams (ER-10, ER-11).**
- Unchanged and confirmed: registration of a team requires a `team_id`; the registering player must be an active player of that team (`NOT_TEAM_MEMBER`); a solo player creates a one-person team where the template's `team_size_min` is 1, or a team of the required size otherwise (teams-payments AD-4, TL-17/TL-18). The organizer never creates teams.
- New: the organizer and active committee members can register an **existing tournament team** (roster as it stands, skill-level check applies per member, capacity applies, invitation check exempt per teams-payments AD-2) until the override ends (AD-5). **[v1.1, B-8 ruling]** The route is the existing `POST /tournaments/{id}/registrations/committee-add`, extended additively with `team_id` (exactly one of `user_id` or `team_id`); the `INDIVIDUAL_ONLY` refusal goes for team events. `POST /registrations` stays self-only; v1.0's wording that the committee sends `team_id` there is superseded (D-1). The registrant is recorded as the committee member. The team (captain and frozen roster) is notified (AD-9).

**AD-3: Edit a tournament until it starts (ER-12 to ER-20).**
- **Who.** The organizer, as today (`update_tournament`). Committee members do not edit tournament details (OI-5, **[A]**). **[v1.2]** The edit rules of this section (window, changed-only dates, reset, withdrawal flag, `registration_hard_block_at`) apply to **lifecycle version 2** tournaments only; a version 1 tournament keeps its old gates and a version 1 request that sends `registration_hard_block_at` or `registrants_may_withdraw` is refused 422. The count fields and the response changes of AD-1 and AD-4 apply to both.
- **Window.** From creation until `starts_at` by the database clock. Today the route refuses only an ended tournament (`refuse_if_tournament_ended`) and locks venue, `starts_at` and `ends_at` once the schedule is `published` (`_SCHEDULE_PUBLISHED_STATUSES`); that second lock is lifted for these three fields, replaced by the reset rule below. A tournament with any recorded result (`fixtures_frozen`) refuses date and venue edits with 409 `TOURNAMENT_HAS_RESULTS`. At and after the start, date and venue edits are refused with 409 `TOURNAMENT_STARTED`.
- **Editable fields.** The existing set (title, description, visibility rules, fee and payee number under their own rules, audience groups while registration is open) plus `starts_at`, `ends_at`, venue, `registration_closes_at` (the soft block) and, new, `registration_hard_block_at` (not in `TournamentUpdate` today). `participation_mode`, `format`, sport, template and capacity stay immutable as today (R-210, §5.15).
- **Date rules (ER-13).** Each date **being changed** must be later than the database `now`. **[v1.1]** The refusal is the existing 422 `TOURNAMENT_DATES_INVALID` with reason `DATE_IN_PAST` (`create_contract.validate_dates`): `DATE_IN_PAST` is a reason, not a code (D-2). `PATCH` has no date validation today and gains a changed-only mode of the same shared validator. Dates left unchanged are not re-validated, so a soft block that has already passed stays valid when only the venue is edited. After the change the merged set must satisfy the existing create rules (start before end, daily window, closure <= hard block <= start). **[v1.2]** Each ordering rule is evaluated only when a date it involves is changed and both of its dates exist, so a deadline-only edit is never failed by stored dates that were already out of order; an explicit null date on a version 2 tournament is read as "not sent". Refusals are raised in this order: `DATE_IN_PAST`, then `REGISTRATION_DATES_REQUIRED`, then the ordering reasons (otherwise a new closure sent after a passed hard block would read as `REG_CLOSE_AFTER_HARD` instead of "set the hard block too"). **[v1.1]** Two existing gates are lifted (D-3): `registration_closes_at` is no longer editable only while `status == 'registration_open'` (the reset rule replaces that gate, so registration can be extended after a draft exists), and the fee-edit closure check reads the closure date as changed by the same request.
- **Soft block already passed (ER-15).** A change to `starts_at`, `ends_at` or venue requires, in the same request, a new `registration_closes_at` in the future (and a new `registration_hard_block_at` if that has passed too, not before the new closure). Otherwise 422 `REGISTRATION_DATES_REQUIRED`. A deadline-only extension needs only the new date(s). Moving the soft block forward reopens self-registration until it; moving the hard block forward ends the frozen state until it (AD-5).
- **Withdrawal (ER-17).** A request that changes dates or venue carries `registrants_may_withdraw` (default true). When false, `tournaments.registrant_withdrawal_locked` is set and self-withdrawal is refused for that tournament (409 `WITHDRAWAL_LOCKED`) until the next edit that sets it true. The committee's removal rights are unchanged (AD-5). A deadline-only extension leaves the flag as it was. **[v1.2]** An explicit `registrants_may_withdraw` is honoured on any edit (that is how "the next edit that sets it true" unlocks); the default of true applies only when the request changes the start, the end or the venue.
- **Registrations (ER-14).** Rows, points, paid state and team rosters are untouched by an edit.
- **Reset (ER-18, ER-20).** If any fixture draft exists and the edit changes `starts_at`, `ends_at` or venue, or moves a block date forward so that the registration phase moves back, the edit resets fixtures in the same transaction: open drafts are superseded, a published fixture set is unpublished and the tournament status returns to the pre-draft status (`registration_open` or `registration_closed`), the points set is unlocked so points can be edited again (it was locked by the first draft, match-scoring S2/ AD-13 of teams-payments), and the committee regenerates. The response states `fixtures_reset: true` and the screen warns before saving. Reset is never done by a roster-only change that leaves the fixture inputs equal. A tournament with recorded results is never reset (`TOURNAMENT_HAS_RESULTS`).
- **Notification (ER-29).** A change to dates or venue notifies, once per person: every registrant (player; for a team its registrant, captain and frozen roster), every invitee with a pending invitation, and every active committee member other than the actor. New notification type `tournament_updated` (AD-9). The text names the tournament and the new start, venue and **registration closure** date; it never contains the hard block. **[v1.2]** It is sent when the start, the end, the closure or the venue changed; a hard-block-only edit and a title-only edit notify nobody (participants cannot see the hard block).
- **Audit (ER-28, P6).** An append-only table `tournament_edit_log` records actor, changed fields with old and new values (dates, venue id or label; no personal data), `fixtures_reset`, `registrant_withdrawal_locked` and the timestamp. No update or delete path.
- **Concurrency.** The edit takes the same advisory lock as registration and generation (`treg:{id}`, then the tournament row, lifecycle §7.2). A concurrent generation either completes first (the edit then resets it) or waits; a draft whose inputs changed is stale by its payload hash.
- **Reminders.** **[v1.1, B-3 ruling]** None exist: the 1.0 report proved lifecycle AD-12 (tournament reminders) was never built — no job, no table, only validated-but-unread config keys. There is nothing to recompute, so this design touches no tournament reminders; the unbuilt AD-12 is recorded as OI-12 for the owner's backlog. Game reminders need no code on an edit (the poll derives the fire time from the current `starts_at`).

**AD-4: Hard block hidden from participants (ER-21).**
- Today `registration_hard_block_at` and `roster_frozen_at` are returned to every viewer who can see a v2 tournament, and the web overview and committee note show them (`frontend/app.js` key-dates card, roster note, tab unlock dates; mobile `TournamentOverview` uses `roster_frozen_at`).
- Decision: the server returns `registration_hard_block_at` and `roster_frozen_at` **only** to the organizer, active committee members and platform admins. For every other viewer the keys are absent (same pattern as the `pending` section, tournament-registration AD-2). **[v1.1, B-4 ruling]** The omission is made once, in the shared serialization path (`experience_fields` / response assembly), so it covers every route that returns the model: the six `tournaments/router.py` routes (list, `/mine`, `/{id}`, create, PATCH, cancel) and the two `settings_dashboard` routes (`/tournaments-organized`, `/tournaments-participating`) (D-6). There is no tournament share-preview route in `public/`; that word is struck. `GET /tournaments/{id}/scoring/state` returns `registration_phase` to every viewer today: for a non-privileged viewer it is mapped to `open` or `closed` (`committee_only` and `frozen` both read `closed`); the key stays, only its values narrow, and mobile's reading of it is checked in step 3.0 (OI-9). `registration_closes_at` stays visible to all and is labelled "Registration closes".
- A new read-only `registration_open` boolean is added for participants (true while self-registration is possible). Clients stop deriving "frozen" or "closed" from the hard block; they use `registration_open` and `is_full`.
- No participant-facing text, error detail, notification or push states the hard block date or the existence of a stage between closure and hard block. **[v1.1]** Labels alone do not cover it: the raw API `detail` of `COMMITTEE_ADD_CLOSED`, `WITHDRAWAL_CLOSED` and `ROSTER_FROZEN` says "frozen" (`registration_v2.py:61-63`), so those three `detail` texts are rewritten to neutral wording ("Registration is closed" / "Withdrawals are closed" / "The team roster can no longer be changed") for every caller; the codes are unchanged (P14, D-7). The committee-only `NOT_FROZEN_DETAIL` on the generation route stays.
- Committee-only fields do not leak through timing either: the participant screen's committee note and tab "unlocks" dates use the closure date or nothing.

**AD-5: Committee override of the roster (ER-11, ER-17, ER-19, ER-27).**
Amends the lifecycle AD-6 table (`registration_v2` header). Phases are still computed from the database clock (AD-5 of the lifecycle: open until the soft block, committee_only until the hard block, frozen after).

| Action | open | committee_only | frozen |
|---|---|---|---|
| Self-register (individual or team) | yes | no | no |
| Self-withdraw | yes, unless locked (AD-3) | no | no |
| Team roster change by the players | yes | no | no |
| Committee add individual | yes | yes | **yes** |
| Committee add team | **yes** | **yes** | **yes** |
| Committee remove individual or team | yes | yes | **yes** |

- Override end: the first recorded match result (`fixtures_frozen`), or `starts_at`, whichever comes first. After that every roster mutation is refused with 409 `ROSTER_LOCKED`.
- Capacity, skill-level and, for team add, team-size rules still apply; there is no exemption. Paid-entrant rules are unchanged: a committee-added entrant of a paid tournament is unpaid until confirmed (teams-payments AD-10); removing a paid entrant logs `removed_paid` and shows the existing refund line.
- **Fixtures.** Generation still requires the frozen phase (lifecycle TL-16, `require_frozen`). A roster change after a draft exists resets it exactly as AD-3 (supersede, unpublish, status back, points unlocked) and the committee regenerates. The screen warns before the change.
- Every override writes a row to `tournament_edit_log` (actor, action, entrant, phase at the time, `fixtures_reset`) and increments a counter (section 7).
- Single committee member, no maker-checker (consistent with score entry, TL-21). The organizer is a committee member.
- **[v1.2]** Fixture inputs are registrations and their points (the engine's entrant is the registration), so a committee change of a team's **members** (`PUT .../members`) leaves the fixtures as they are; only an add or a removal of an entrant resets them. Roster changes by the committee still obey the override end and are written to the edit log.
- Participants can no longer withdraw or change a team roster between the closure and the hard block (D-3).

**AD-6: Reset of fixtures.** One function, `reset_fixtures(db, tournament_id, reason)`, is called by AD-3 and AD-5. It refuses when `fixtures_frozen` is true. It supersedes open drafts, unpublishes the published set, resets the tournament status, unlocks the points set and returns a boolean. It is idempotent: a second call is a no-op returning false. It emits one `fixtures_reset_total` increment and one log line with counts only. **[v1.1, B-5 ruling]** The 1.0 report found none of the three mechanisms exists, so 1.1 builds them (D-4): an unpublish in `fixture_drafts` — the published draft row becomes `superseded` (the status CHECK allows no other value), the tournament's `tournament_fixtures` rows are deleted (safe: `fixtures_frozen` guarantees none has a result), and `schedule_generated_at` and `schedule_published_at` are cleared; a new `points_io.unlock_points_set`, called only here (the lock stays a one-way latch everywhere else); and the reset status is **`registration_open`** — the only pre-draft status a v2 tournament can reach — with the live phase still derived from the block dates. A pending `fixture_publication` approval is left alone: it fails stale by payload hash at execution (existing 409 `NOT_PUBLISHABLE`); no cancel path is added (BP-12). `reset_fixtures` runs under the generation locks (`treg` advisory lock, then the tournament row).

**AD-7: Shuffle again (ER-22 to ER-26).**
- **What it is.** A committee-only action on an unpublished engine draft of a lifecycle v2 groups + knockout tournament. The server picks the next draw from a deterministic list and replaces the draft. The caller sends no draw parameters and cannot choose or edit group members.
- **Pots.** Entrants are ranked once. With g groups, pot j is ranks (j-1)g+1 to jg (DES-FIXTURE-CORE-001 FD-5). The canonical draw is the library's snake deal (pot 1 forward, pot 2 reversed, and so on). Every full pot has exactly one entrant per group, so the top pot is always spread over all groups; the owner's "top x%" is satisfied for every full pot.
- **Draws.** A draw is a rotation r_j in 0..g-1 for each **full** pot relative to the canonical deal, plus a group-label rotation s in 0..g-1 (which renames groups and so changes the knockout paths and the group-stage match order). A partial last pot is left as canonical. Draw 0 is the canonical draw.
- **Balanced draws only.** For each draw the group strength is the sum of the ranks of its members; the draw is kept when `max - min` of those sums is not above the canonical spread plus `meetup.tournament.shuffle.spread_tolerance` (default 0). For 12 entrants in 4 groups this keeps 7 of the 16 relative compositions (28 draws with the 4 label rotations) at tolerance 0; a tolerance of 2 keeps 9 compositions (36 draws) and 3 keeps 13 (52). **[v1.3]** v1.0 to v1.2 said "10 of 16, 40 draws": that was an architect arithmetic error, found by the step 1.2 build; worked example in section 5.4. The enumeration is bounded by `meetup.tournament.shuffle.max_enumeration` (default 4096); above it only single-pot rotations are enumerated.
- **Order and "next".** The kept draws are ordered by SHA-256 of `rng_seed || draw descriptor` ascending (FD-6: no PRNG). The draft payload records `shuffle_index` and `shuffle_total`; each call moves to `(index + 1) mod total` and wraps. Each draft is reproducible from `rng_seed` and `shuffle_index`.
- **How it is built.** The adapter generates the canonical draft, then applies the draw as `apply_edit(swap_entrants)` operations between groups inside each pot (class B, reason `organizer_shuffle:{index}`), and maps the result to the draft payload as today. The library validator re-runs on every edit (`FV_PLACEMENT_DEVIATION` allows permutations inside exchange sets). **[v1.1] The Phase 1 gate PASSED** (1.0 report, G1: 12/4, 13/4 and 24/8 on algorithm revision 2; every in-pot swap accepted class B, cross-pot refused `POLICY_SEED_INTEGRITY`, `group_place` refs untouched, payload round-trips; 60 edits with full validation in 0.48 s). No library change; OI-1 closes. Facts the build must honour: the library does not retain the edit reason, so `shuffle_index` and `shuffle_total` live in the draft payload (new keys; the payload hash changes, which is correct — a shuffle is a new draft) and in the edit log; a rotation costs g-1 swaps per pot; the group-label rotation is a true rename only when group sizes are equal, and a partial pot stays canonical either way.
- **Availability.** Disabled, with a label explaining why, when the draft is published, when any result is recorded (`FIXTURE_FROZEN`), when only one balanced draw exists, or when the draft is not an engine draft. Superseded drafts are kept (versioned), so a shuffle never destroys evidence.
- **No fishing.** The set is finite and wraps, the organizer cannot influence it, and every shuffle is logged with its index.

**AD-8: Recurring games (ER-01 to ER-06).**
- **Existing behaviour (verified).** A rule (`event_recurrence_rules`: frequency `weekly` by CHECK, interval, `day_of_week`, `is_active`, `created_by_event_id`) is created with `POST /events` when `recurrence_frequency` is sent. `jobs/recurring_events.expand_recurring_events` keeps up to a hard-coded **8** future instances per rule, each a normal `events` row with `recurrence_rule_id`, copying fields, groups and fee, and adding the organizer as `going`. It does **not** copy invitations or participants. `PATCH /events/recurrence-rules/{id}` changes frequency, interval, day or `is_active`. Mobile maps `recurrence_rule_id` to `is_recurring`; the web has no recurrence UI.
- **Creation.** The create game screens (web and mobile wizard) get **Repeat weekly**: every 1 to `meetup.game.recurrence.max_interval_weeks` (default 4) weeks, on the weekday of the start date (read-only), ending **after N games** (2 to `max_occurrences`) or **on a date**. One of the two is required from the new screens (**[v1.4]** enforced by the screens only; the server code is `SERIES_END_INVALID`: both end rules at once, a limit below 2, or an end date that leaves fewer than two games); the API still accepts a rule with neither (legacy rolling, as today) so existing callers are not broken (P14). **[v1.4]** A legacy rolling rule now also materialises its games at create, up to the horizon; an end rule without `recurrence_frequency` is 422 `SERIES_END_INVALID`; `occurrence_limit` counts every game of the rule, cancelled and past ones included; `recurrence_occurrence_limit` and `recurrence_ends_on` invite nobody: `invite_user_ids` at create invites on the first game, where the invitee accepts. **[v1.1]** The day-of-week default is new behaviour, not existing: today the column is NOT NULL while the API default is `None`, so a frequency without a day fails at insert (D-9); the default fixes that. `max_occurrences` default 12 includes the first game.
- **Materialisation.** The expansion job keeps up to `meetup.game.recurrence.horizon` (default 8, today's value, now config) future instances and stops at the end rule. At creation the same expansion runs **inside the create transaction** for the new rule, so the first instances exist immediately and an invitee's acceptance covers them. **[v1.1, B-6 ruling]** Three 1.0 findings are fixed here (D-8): the copy source becomes the **latest non-cancelled instance** by `starts_at` (today it is the base game, which would silently revert a "this and the following" edit on instances created later); the copy also carries `venue_id`, the venue snapshot, coordinates, place id and `allow_waitlist` (omitted today); and every new instance — job-created or created in the create transaction — gets `schedule_event_reminders`, which job-created instances never got. Accepted T1 caveat: an edit of only the latest instance propagates to instances created after it (OI-13).
- **Series membership.** New table `event_recurrence_members` (rule, user, `status` `active` or `left`, joined_at; one row per rule and user). Invitations are sent on the base game as today (individuals, email, groups, visibility rules unchanged). **Accepting** an invitation to a recurring game (invitation-response: accept means joining) joins the person to every existing future instance (`going`, or `waitlisted` where the instance is full and `allow_waitlist` is true; where it is full and the waitlist is off that instance is skipped), records a `active` member row, and marks the invitation accepted. The expansion job adds every `active` member to each new instance by the same rule and creates the matching accepted invitation row so that an invite-only game stays visible to its members on every instance (`event_invitations`, access-consistency). One accept action is one transaction.
- **Skip one.** A member withdrawing from one instance uses the existing withdraw; membership stays and the job does not re-add them to that instance (it only adds at instance creation). Skipped instances show in the list as the existing withdrawn state. **[v1.1, B-6 ruling]** The existing withdraw flips a `pending` or `accepted` invitation to `declined` (`events/service.py:1150-1156`), which would hide an invite-only instance from the member and block re-joining. For an **active series member** the withdraw leaves the invitation `accepted`; non-series withdrawals keep today's behaviour.
- **Leave series.** **[v1.4]** The response is `{"left": true, "games_left": n}`; the organizer gets 409 `SERIES_ORGANIZER_CANNOT_LEAVE`. `POST /events/{id}/series/leave` withdraws the caller from every future instance of the rule and sets the member `left`. Past instances are untouched. The organizer cannot leave their own series (cancel it instead).
- **Edit.** **[v1.4]** The body of `PATCH /events/{id}/series` uses `start_time` (a local `HH:MM` that shifts only the time of day, each game keeping its date) and `duration_minutes`; unknown fields, sport and visibility are 422; the venue goes through the existing venue resolver; a rule edit that changes day or interval re-dates the later not-started games in place, and switching between a count and an end date replaces the other. "This game" uses the existing edit route. "This and the following" (`PATCH /events/{id}/series`) applies title, description, time of day, duration, venue, capacity, skill requirement, fee and payee number to this instance and every later future instance of the rule that has not started; sport and visibility are not editable (existing rules). Interval, end rule and day of week are rule edits (the existing rule route is extended with the end rule; changing the day or interval reschedules the future instances not yet started that nobody has joined, and refuses with 409 `SERIES_HAS_PARTICIPANTS` where participants exist). Capacity cannot go below the going count of any affected instance.
- **Cancel.** "This game" uses the existing cancel. "This and the following" (`POST /events/{id}/series/cancel`) cancels this and all later future instances and sets the rule `is_active=false`.
- **Notifications.** At most **one** notification per person per series action (a change or cancel of this and the following), carrying the first affected game, not one per instance. The existing types and the fan-out outbox are reused. **[v1.4]** Each recipient gets their own outbox row (a snapshot audience of one; `notifications/fanout.py` takes `snapshotted_user_ids` for the two event types when the payload carries it) with the key `series_action:{rule_id.hex}:{action_id.hex[:16]}:{user_id.hex}`, 96 characters (the full action id would make 112, over the 100 of `job_outbox.idempotency_key`). Recipients are the going and waitlisted people of the affected games plus active members, minus the actor.
- **Statistics and closure.** Each instance is its own game for the closure report, Played, Hosted and Won (closure-report unchanged).
- **Display.** A game that belongs to a series shows a chip "Weekly · n of N" (N omitted for legacy rolling series), and its view offers: for members Skip this game and Leave series; for the organizer Edit and Cancel with the scope choice "This game" or "This and the following". Labels via admin.

**AD-9: Notifications and labels.**
- New notification types: `tournament_updated` (AD-3) and `tournament_registration_added` (committee add of a team or an individual, to the entrant, captain and roster). **[v1.1]** The only database CHECK is `chk_notification_preferences_type` on the preferences table; `notifications/models.py` mirrors it as documentation and delivery rows carry no type CHECK (D-10). The widening (now in M1, section 5.1) follows the guard pattern of `f4b9d2e6c813`: look the live constraint up in `pg_constraint`, require exactly the 25 current values, re-add with 27. The per-type touch list is the eight files the 1.0 report maps for `tournament_registration_removed` (migration, models mirror, `schemas.NOTIFICATION_TYPES`, `fanout.SNAPSHOT_TYPES`, `delivery` TTL, the enqueue site, label fallbacks, web preference labels). Idempotency keys: `tournament_updated:{tournament_id.hex}:{edit_id.hex}:{chunk}` and `tournament_registration_added:{registration_id.hex}`, keeping each under the 100-character limit (32-hex UUIDs, lifecycle §7.2).
- Recipient lists use the existing chunked fan-out (at most 50 ids per row, tournament-registration AD-10).
- Mobile routing: `tournament_updated` and `tournament_registration_added` open the tournament view; a series notification opens the game. Mobile checks `notificationRouting.ts` first (OI-9).
- All user-facing texts are label keys following `docs/glossary.json` and are seeded by migration M3 or the label seed for the task; no literal text in the clients.

**AD-10: Configuration keys (ER-30, P1).** Stored in `app_config`: `meetup.game.recurrence.max_occurrences` (12, 2 to 52), `.horizon` (8, 1 to 26), `.max_interval_weeks` (4, 1 to 8); `meetup.tournament.shuffle.spread_tolerance` (0, 0 to 100), `.max_enumeration` (4096, 16 to 100000). A missing or malformed value reads as the default and logs a warning (the warning is new code; the fee reader it copies does not log). No value is set by hand in the database. **[v1.1, B-2 ruling]** Editor homes (D-11): the two shuffle keys join the `tournaments/scoring_config.py` registry and surface on the existing admin Tournament settings page; the three game keys get fields on the existing admin `/home-settings` route and page, exactly as `upcoming_window_days` and `upcoming_max_items` do today (`home/admin_router.py`, `home/service.py` clamp-and-default readers), keeping the key names above. `events` and `jobs` read the keys through their own fee-pattern reader (raw `app_config` query, no sibling import); the worker reads via `session_scope` as the expansion loop already does. Startup validation stays optional for all five.

---

## 4. Component and Integration Design

| Module | Change |
|---|---|
| `tournaments` | `update_tournament` and its router: edit window, hard-block field, date rules through the shared validator, `registrants_may_withdraw`, reset call, edit log, notification; response model: omit hard block and `roster_frozen_at` for non-privileged viewers, add `registration_open` and `is_full`; `registration_v2`: override table (AD-5), `ROSTER_LOCKED`, `WITHDRAWAL_LOCKED`, committee team add; `fixture_drafts`/`engine_service`: `reset_fixtures`, `shuffle_draft`; `policies.py`: rules for each new route; `fixture_core_adapter`: draw enumeration and swap application |
| `events` | Create (end rule, immediate expansion), series membership table and routes (`/series/leave`, `/series`, `/series/cancel`), accept-join across instances, rule route extended with the end rule |
| `jobs` | `recurring_events`: config horizon, end rule, copy members and accepted invitations to new instances |
| `notifications` | Two new types, fan-out capture list, push TTL, history display |
| `admin`/`settings_dashboard` | Register the five config keys |
| `frontend/` (web) | Create game: Repeat weekly; game view: series chip and actions; tournament lists and views: count and Full chip; overview, participants and committee screens: hide block dates for non-committee, "Registration closes"; Edit tournament screen; participants screen add team or individual and remove after the closure; fixtures screen: Shuffle again; bump the PWA version constant on deploy |
| `meetup-mobile` | Create game wizard: Repeat weekly; game view series chip and actions; tournament list and view count; overview key dates by `registration_open`; Edit tournament screen; committee add and remove; Shuffle again; push routing |

**Integration surface.** The only external dependency used is the vendored `fixture_core` 0.2.0 wheel, through its public API and the existing adapter. No new library, endpoint outside this repo, or secret.

**Boards. [v1.1, B-1 ruling]** No new boards are made. For the five new screens (Edit tournament, Repeat weekly on create game, series actions on the game view, Shuffle again, committee add and remove after the closure) **this addendum's written specification is the board of record**: they are built from existing components following the nearest approved board families (create game wizard `design-ref-p23`, tournament views `design/tournament-experience`, participants and committee add `docs/design/teams-payments` and `docs/design/tournament-lifecycle`), and the stop-and-ask rule does not apply to them. Where an approved board contradicts this addendum it is **superseded on exactly two elements** for participant-facing screens — the hard block / roster-frozen display (AD-4) and any "N of cap" count (AD-1) — and stays authoritative for everything else; the 1.0 report section 10 lists the affected boards (`TPDetailHard`, `TPRosterFrozen`, `TPWithdrawBlocked`, `CMDashHard`, `CMAddHard`, `WebTV2Open`/`TV2MobOpen`, `game-view-redesign/tournament-view`, the `tournament-experience` "frozen" family). `CMAddHard`'s "Nobody can be added" is superseded by AD-5 for the committee. OI-8 closes (D-13).

---

## 5. Data and Contracts

### 5.1 Migrations (written, never run by an agent; the owner runs them one at a time)

**[v1.1, B-7 ruling]** Renumbered and re-homed after the 1.0 report: each build task writes the migration it needs, the chain stays single and sequential from the current head `f4b9d2e6c813`, and the owner still runs three files one at a time.

| ID | Written in | Content | Notes |
|---|---|---|---|
| M1 | 1.1 | `tournaments`: add `registrant_withdrawal_locked` boolean NOT NULL default false; create `tournament_edit_log` (id, tournament_id FK, actor_id FK, action, changed JSONB, fixtures_reset boolean, created_at); widen `chk_notification_preferences_type` with `tournament_updated` and `tournament_registration_added` (guard pattern of `f4b9d2e6c813`: 25 expected values, re-add with 27) | `down_revision = f4b9d2e6c813`. The edit log is append-only: no UPDATE or DELETE path in code |
| M2 | 1.3 | `event_recurrence_rules`: add `ends_on` date NULL and `occurrence_limit` integer NULL; create `event_recurrence_members` (id, rule_id FK, user_id FK, status CHECK `active`/`left`, joined_at; UNIQUE rule_id + user_id) | `down_revision` = M1. Additive. Existing rules keep both NULL (rolling) |
| M3 | 1.6 | Seed the five `app_config` keys and every new label of 1.1 to 1.5 | `down_revision` = M2. A label-equality test pins the migration's frozen JSON to the bundled fallbacks |

Rollback for M1 to M3 is a restore from the pre-change backup (the additive columns are harmless if the code is rolled back by image tag).

### 5.2 Routes (stable error codes are additive, P14)

| Route | Change |
|---|---|
| `POST /events` | Adds `recurrence_ends_on` (date) and `recurrence_occurrence_limit` (int); at most one; `recurrence_day_of_week` defaults to the weekday of `starts_at` |
| `GET /events/{id}` and list rows | Adds `series` `{rule_id, interval, ends_on, occurrence_limit, index, total, my_membership}` or null |
| `POST /events/{id}/series/leave`, `PATCH /events/{id}/series`, `POST /events/{id}/series/cancel` | New (AD-8) |
| `PATCH /tournaments/{id}` | Adds `registration_hard_block_at` and `registrants_may_withdraw`; response adds `fixtures_reset` |
| `GET /tournaments`, `/mine`, `/{id}` | Adds `registration_open` and `is_full`; hard block and `roster_frozen_at` only for organizer, committee, admin |
| `POST /tournaments/{id}/registrations` | **[v1.1]** Unchanged: self-only (B-8). Phase table per AD-5 |
| `POST /tournaments/{id}/registrations/committee-add` | **[v1.1]** Gains optional `team_id` (exactly one of `user_id`, `team_id`); team events no longer refuse `INDIVIDUAL_ONLY`; allowed in every phase until the override ends (AD-5) |
| `DELETE /tournaments/{id}/registrations/{rid}` | Allowed for the committee in every phase until the override ends |
| `POST /tournaments/{id}/fixtures/shuffle` | New; body empty; returns the new draft payload with `shuffle_index` and `shuffle_total` |

New stable codes (**[v1.1]**: date refusals reuse the existing 422 `TOURNAMENT_DATES_INVALID` with its `reason` field, `DATE_IN_PAST` included): `REGISTRATION_DATES_REQUIRED`, `TOURNAMENT_HAS_RESULTS`, `TOURNAMENT_STARTED`, `ROSTER_LOCKED`, `WITHDRAWAL_LOCKED`, `SHUFFLE_UNAVAILABLE`, `SERIES_END_INVALID` (**[v1.4]** replaces `SERIES_END_REQUIRED` as a server code), `SERIES_LIMIT_EXCEEDED`, `SERIES_HAS_PARTICIPANTS`, `SERIES_ORGANIZER_CANNOT_LEAVE` (**[v1.4]**). Every new code joins `REGISTRATION_CODES` where its route counts refusals.

### 5.3 Errors visible to participants
A non-committee caller refused during the committee-only or frozen stage receives the neutral "Registration is closed" text (code unchanged). `ROSTER_LOCKED` and `TOURNAMENT_STARTED` are committee-facing.

### 5.4 Worked example of the shuffle
12 entrants (ranks 1 to 12), 4 groups, 3 pots. Canonical snake: A {1, 8, 9}, B {2, 7, 10}, C {3, 6, 11}, D {4, 5, 12}; rank sums 18, 19, 20, 21 (spread 3). Rotating pot 1 by one: A {4, 8, 9}, B {1, 7, 10}, C {2, 6, 11}, D {3, 5, 12}; sums 21, 18, 19, 20 (spread 3, kept). Pots 2 and 3 sum to 17 in every group, so a single-pot rotation of pot 1 can never unbalance the draw. Rotating pot 2 alone against pots 1 and 3 can (pot 2 rotated by one gives sums 15, 20, 21, 22: spread 7) and is dropped. **[v1.3]** The 16 compositions by spread: 7 at spread 3 (kept at tolerance 0), 2 at spread 5, 4 at spread 6, 3 at spread 7; with the 4 label rotations that is 28 offered draws at tolerance 0, confirmed by an independent brute-force count in the tests.

---

## 6. Security and Compliance

Every new or changed route declares its access rule in `policies.py` and enforces it at the entry point (P15); no rule relies on the database to hide rows.

| Route or field | Access rule | Negative test |
|---|---|---|
| `PATCH /tournaments/{id}` dates, venue, hard block | Organizer only (admin override as today) | Committee member, registrant, stranger denied (403 or 404 per the tournament view rule) |
| Hard block and `roster_frozen_at` in any tournament response | Organizer, active committee, admin | Registrant, invitee, public viewer: the keys are absent on get, list, mine, create, update, cancel and the two `settings_dashboard` lists (**[v1.1]**; there is no share-preview route) |
| Committee add, remove, team add | Active committee (the organizer included) | Registrant, captain, stranger denied; after override end 409 `ROSTER_LOCKED` |
| `POST /fixtures/shuffle` | Active committee (the organizer is a committee member) | Registrant and stranger denied |
| `POST /events/{id}/series/leave` | An active member | Non-member denied |
| `PATCH /events/{id}/series`, `/series/cancel` | Organizer of the base game | Member and stranger denied |
| Series accept | The invitee | Another user denied; accept on a revoked invitation refused |

- **Access consistency.** A person who is no longer entitled to see a game or tournament keeps no access through series membership: leaving the series, a revoked invitation or a removed group ends view on every instance in the same transaction (access-consistency AC rules; `left` members have no invitation row left accepted).
- **P9.** Dates, `team_id`, `registrants_may_withdraw`, the series fields and the end rule are validated server-side; the end rule values are bounded by the config keys; the shuffle accepts no input.
- **P4 and privacy.** Logs carry ids and counts only, never names, emails or phone numbers. The edit log stores no personal data. A deleted account's rows follow the existing deletion hooks; `event_recurrence_members` rows cascade with the user.
- **P17.** New routes sit under the existing per-user rate limits (100 per minute for series routes; 10 per minute for shuffle).
- **No T2+ controls** are added (BP-05): no maker-checker on committee overrides (TL-21 precedent), no signed approval context.

---

## 7. Observability and Operability

- **Counters** (labels carry no personal data): `tournament_edited_total{kind}`, `tournament_fixtures_reset_total{reason}`, `tournament_roster_override_total{action,phase}`, `tournament_shuffle_total`, `tournament_edit_refused_total{code}`, `game_series_created_total`, `game_series_action_total{action}`, `game_series_instances_created_total`.
- **Logs** on each edit, reset, override, shuffle and series action with correlation id, actor id, tournament or rule id and counts.
- **Alerts and gates.** The job logs a warning per rule when expansion is skipped (existing wording kept). Shuffle p95 above 2 s, or any `SEARCH_BUDGET_EXCEEDED` from the validator during a shuffle, is reviewed (OI-3).
- **Operability.** A support person can explain any fixture from `rng_seed`, `shuffle_index` and the stored versions; any edit from `tournament_edit_log`.

---

## 8. Test Requirements (P13)

**Risk classification.** Block-date visibility and the roster override (access and money paths): High. Edit and reset: High. Series membership and accept-join: Medium-High. Shuffle: Medium-High. Display changes: Low. Agents run only the tests for their affected modules, once; the owner runs the full suite as a separate session.

| # | Test |
|---|---|
| ER-T1 | Count: lists, `/mine` and the view return `is_full`; the full tournament refuses the next registration with `TOURNAMENT_FULL`; client label tests show "n registered" and the Full chip, no slash |
| ER-T2 | Edit: organizer changes `starts_at`, venue and the closure; each changed date in the past is `DATE_IN_PAST`; an unchanged past soft block passes a venue-only edit when the soft block is still open; ordering rules reject closure after hard block and hard block after start |
| ER-T3 | Soft block passed, venue or start changed without a new future closure: 422 `REGISTRATION_DATES_REQUIRED`; with a new future closure: registration reopens, registrations unchanged |
| ER-T4 | Edit at or after the start: 409 `TOURNAMENT_STARTED`; with a recorded result: 409 `TOURNAMENT_HAS_RESULTS`; committee member edit denied |
| ER-T5 | Reset: draft or published fixtures plus a date or venue change reset them (`fixtures_reset: true`, status back, points unlocked); a deadline-only extension that does not move the phase back does not reset; a second reset is a no-op |
| ER-T6 | Withdrawal: default allows self-withdraw while open; `registrants_may_withdraw=false` gives `WITHDRAWAL_LOCKED`; self-withdraw after the closure is refused; the committee can still remove |
| ER-T7 | Visibility: registrant, invitee and public viewer never receive `registration_hard_block_at` or `roster_frozen_at` on any route; organizer, committee and admin do; no refusal detail or notification text contains the hard block |
| ER-T8 | Override: committee adds an individual and a team in the open, committee_only and frozen phases; capacity, skill and team-size rules still hold; paid tournament entrant unpaid; after the first result or the start: 409 `ROSTER_LOCKED`; stranger and registrant denied |
| ER-T9 | Roster change after a draft exists resets it and notifies; removal of a paid entrant logs `removed_paid` |
| ER-T10 | Notifications: `tournament_updated` once per person, hard block absent, chunked recipients, idempotent on retry; `tournament_registration_added` to the entrant, captain and roster once |
| ER-T11 | Edit log: one append-only row per edit and per override; no update or delete path; no personal data |
| ER-T12 | Shuffle: successive calls walk the kept draws in the stored order and wrap; every draw keeps one entrant per group per full pot; every draw's group sizes differ by at most one; spread within tolerance; the library validator passes; `rng_seed` and `shuffle_index` reproduce the draft; unavailable when published, frozen, single-draw or non-engine |
| ER-T13 | Shuffle negative: registrant and stranger denied; no request body is read |
| ER-T14 | Series create: weekly with N or an end date creates instances immediately; both end rules at once rejected; N above the max rejected; the legacy rolling rule still creates |
| ER-T15 | Accept-join: one accept joins every future instance (going or waitlisted by capacity); the job adds the member to later instances with a matching accepted invitation; invite-only instances stay visible to members and hidden from others |
| ER-T16 | Skip one keeps membership and is not re-added; leave series withdraws future instances and ends access; organizer cannot leave |
| ER-T17 | Edit and cancel scope: this game versus this and the following; started instances untouched; capacity below the going count refused; one notification per person per action |
| ER-T18 | Config: each key edited in admin changes behaviour without a restart; a malformed value reads as the default with a warning |
| ER-T19 | Web e2e and mobile: Repeat weekly, series chip and actions, tournament count and Full chip, Registration closes only for a participant, key dates for a committee member, Edit tournament, committee add and remove after the closure, Shuffle again; labels checks pass (`check_labels`, `npm run check:labels`) |

Negative API tests (P13, P15) are ER-T4, ER-T7, ER-T8 and ER-T13 plus one per series route in ER-T16 and ER-T17.

---

## 9. Supersedes and Amends (D-1 to D-7 in section 10)

| Document | Change |
|---|---|
| tournament-lifecycle TL-15 and AD-6 table | After the hard block the committee may add and remove (individuals and teams); participants may not withdraw or change rosters between the closure and the hard block (D-1, D-3) |
| tournament-lifecycle TL-14 | Dates validated on edit by the same shared validator |
| tournament-registration v1.3 AD-2 pattern | Hard block fields omitted for non-committee viewers (D-2) |
| tournament-experience (key dates, tab unlock dates) | Participants see the closure date only |
| tournament-experience / lifecycle: venue and timing "locked once published" | Allowed until the start, with a fixture reset (D-4) |
| teams-payments AD-12 | Committee removal is no longer limited to before the hard block |
| teams-payments AD-4 (teams never committee-added) | The committee may add an existing player-created team (D-5) |
| match-scoring AD-S2 / fixture draft | Shuffle and reset add draft versions; no behaviour of the existing generate route changes |
| game-view-redesign, tournament card text | Count without denominator (D-7) |
| events as-built (`recurring_events` hard-coded 8) | Moves to configuration (AD-10) |

---

## 10. Deviations and Principle Compliance

**No deviation from `Enterprise_Design_Principles.md` or `design-best-practices.md`.** Deliberate deviations from earlier addenda:

| ID | Deviation | Rationale |
|---|---|---|
| D-1 | Committee may add and remove after the hard block (lifecycle TL-15 forbids it) | Owner decision: the organizer judges whether the change fits in time; the lock moves to the first result or the start. Fixtures are reset, so no stale draft survives |
| D-2 | Hard block hidden from participants (te-b3 returned it to everyone) | Owner decision: participants see one closure date. Enforced on the server, not the UI |
| D-3 | Participant self-withdraw and team roster change end at the soft block (lifecycle: until the hard block) | Follows from D-2: participants cannot be bound by a date they cannot see. Inferred from two owner statements, so the owner can reverse it |
| D-4 | Date and venue editable after the schedule is published | Owner decision (edit until start); safe because of the reset and the results lock |
| D-5 | Committee can add a team | Owner decision; the team is still created by its players |
| D-6 | The shuffle is built from library edits, not a library revision | Smaller, no cross-repo release; fallback documented |
| D-7 | Tournament count without a denominator | Owner decision; capacity stays enforced and visible to the committee |

| Item | Design element | Status |
|---|---|---|
| P1 Config-driven | Five keys in admin (AD-10); horizon no longer hard-coded | Met |
| P4 Observability | Counters, correlation ids, no personal data | Met |
| P5 Idempotency | Reset, accept-join, notification keys | Met |
| P6 Immutable context | `tournament_edit_log`, shuffle provenance, draft versions | Met |
| P9 Validation | Server-side on every new field | Met |
| P13 Coverage by risk | Section 8 with negative tests | Met |
| P14 Backward compatibility | Additive fields, columns and codes; legacy rolling rules kept; hard block key omitted only for viewers who must not see it | Met |
| P15 Shift-left authorisation | Section 6 | Met |
| P17 Rate limiting | Section 6 | Met |
| BP-01 | DDL and code facts read on 2026-10-27; the rest are Phase 1 gates | Met, gates open |
| BP-10 | OI-3 measurable gate | Met |
| BP-12 | No maker-checker, no ceiling, no new service | Met |
| BP-13 | Decisions written back in this document | Met |

---

## 11. Coverage and Phases

| Requirement | Section |
|---|---|
| ER-01 to ER-06 | AD-8 |
| ER-07 to ER-09 | AD-1 |
| ER-10, ER-11 | AD-2, AD-5 |
| ER-12 to ER-20 | AD-3, AD-6 |
| ER-21 | AD-4 |
| ER-22 to ER-26 | AD-7 |
| ER-27, ER-28 | AD-5, AD-3 |
| ER-29 | AD-3, AD-9 |
| ER-30 | AD-10 |
| ER-31 | Section 6, section 8 |
| ER-32 | This section |

### Steps and progress tracking (owner's four steps)

**Progress: Step 1.3 of 8 done · overall 4 of 27 (15%). Next: 1.4 `er-web-tournament`.** (1.0 done 2026-10-27, PR #158; 1.1 PR #160; 1.2 PR #162; 1.3 PR #164, all 2026-10-28.)

Tasks are named `{step}.{n} {repo} ({machine}) {task}` and progress is reported as `Step x.y of n · overall d of 27 (p%)`, updated after every step; the end state is all 27 steps done. Machines: Cloud (a Claude or Cursor cloud agent), Mac (`~/Developer/meetup-mobile`), AWS (`/home/ubuntu/meetup`, see `docs/ENVIRONMENTS.md`).

**Step 1: Instruction execution for meetup (backend and web), 8 steps**

| # | Task ID | Content |
|---|---|---|
| 1.0 | `er-p1-verify` | **Done 2026-10-27** (PR #158). G1 shuffle gate PASS; findings B-1 to B-8 resolved in v1.1 |
| 1.1 | `er-bw-tournament` | **Done 2026-10-28** (PR #160, M1 `a7c2e9d41b58`). Edit route, changed-only date validation, withdrawal flag, `reset_fixtures` (unpublish, points unlock), override table, `ROSTER_LOCKED`, committee team add, `is_full` and `registration_open` on every route, hard-block omission, `scoring/state` phase mapping, neutral refusal texts, edit log, notifications; **writes M1 [v1.1]** |
| 1.2 | `er-bw-shuffle` | **Done 2026-10-28** (PR #162). Draw enumeration, swap application, `POST /fixtures/shuffle`, availability rules |
| 1.3 | `er-bw-series` | **Done 2026-10-28** (PR #164, M2 `b3d8f1c27a64`). Create fields, immediate expansion, members table, accept-join, job changes (copy source, venue and waitlist fields, instance reminders), series routes, series notifications; **writes M2 [v1.1]** |
| 1.4 | `er-web-tournament` | Count and Full chip, hidden block dates, Edit tournament, committee add and remove after the closure, Shuffle again, PWA version bump |
| 1.5 | `er-web-series` | Repeat weekly on create game, series chip and actions on the game view |
| 1.6 | `er-config-labels` | **[v1.1]** M3 written (config and label seeds, not run), the two shuffle keys in the tournament settings registry, the three game keys on `/home-settings` and its admin page, label-equality test |
| 1.7 | `er-review-merge` | Reports reviewed by the architect (verified against GitHub), fixes issued, PR merged |

**Step 2: Build for meetup (owner, AWS), 7 steps**

| # | Content |
|---|---|
| 2.0 | Backup and rollback tag recorded (`infra/aws/scripts/backup-db.sh`; previous API image tag kept) |
| 2.1 | `git pull --ff-only` in `/home/ubuntu/meetup` and build the new image (`build api`) |
| 2.2 | Run M1 (`alembic upgrade +1`) |
| 2.3 | Run M2 (`alembic upgrade +1`) |
| 2.4 | Run M3 (`alembic upgrade +1`) |
| 2.5 | Restart `api` and `worker` (`up -d --build --no-deps api worker`); health 200 at `https://meetupaws.duckdns.org`; `/api/version` equals the bumped version |
| 2.6 | Browser verification with throwaway users: recurring game, accept once, skip, leave; tournament count; edit; block-date visibility; committee add after the closure; shuffle |

**Step 3: Instruction execution for meetup-mobile, 7 steps**

| # | Task ID | Content |
|---|---|---|
| 3.0 | `er-p1-verify-mobile` | Read-only: notification routing, tournament and game screens and types, labels, create game wizard, boards, missing contract fields (stop and ask if one is missing) |
| 3.1 | `er-m-tournament-view` | Count and Full chip, key dates by `registration_open`, committee-only block dates, withdrawal notice |
| 3.2 | `er-m-committee` | Committee add and remove after the closure, team add, Edit tournament screen |
| 3.3 | `er-m-shuffle` | Shuffle again on the draft screen |
| 3.4 | `er-m-series` | Repeat weekly in the create game wizard, series chip and actions, push routing for the new types |
| 3.5 | `er-m-labels-report` | `check:labels`, type-check, scoped tests, implementation report |
| 3.6 | `er-m-review-merge` | Reports reviewed and merged by the architect |

**Step 4: Build the mobile app (owner), 5 steps**

| # | Content |
|---|---|
| 4.0 | Mac: `cd ~/Developer/meetup-mobile && git pull --ff-only` (the checkout has been stale before) |
| 4.1 | Mac: Android AAB with `npm run build:aab` (it bumps `versionCode`; commit `version.properties` afterwards) |
| 4.2 | iOS: run the GitHub Actions iOS TestFlight workflow on `main` after the version bump |
| 4.3 | Device test: recurring game, tournament count and edit, committee add, shuffle |
| 4.4 | Release to Play internal testing and TestFlight |

**Totals: 8 + 7 + 7 + 5 = 27 steps.** Order (**[v1.1]**, B-7): strictly sequential — 1.0, then 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, each merged before the next starts, because M1 to M3 chain across tasks and scoped tests run against a database migrated to head; Step 2 starts after 1.7; Step 3 starts after Step 2 (the contract is deployed); Step 4 starts after 3.6. No feature flag is added; the features are live once deployed and the migrations are run.

Every step produces a report; the architect rates it and either accepts it or sends a fix brief immediately. Agents never self-certify, never choose versions and never edit governance documents.

---

## 12. Open Items

| # | Item | Default if unanswered | Gate |
|---|---|---|---|
| OI-1 | **Closed [v1.1].** The 1.0 gate passed on 12/4, 13/4 and 24/8 revision-2 drafts; no library change needed | n/a | n/a |
| OI-2 | Which participants are notified of a block-date-only extension (no start or venue change) | Registrants and pending invitees are notified of the new closure date | Owner may narrow |
| OI-3 | Generation and shuffle have not been exercised above 128 entrants | No ceiling at T1 | Generation or shuffle p95 above 10 s, or any `SEARCH_BUDGET_EXCEEDED` at N entrants: set an admin ceiling below N and revisit the library limits |
| OI-4 | The cap of an existing tournament cannot be raised (snapshot) | Not supported | Two reports of a full tournament that needed more space within 90 days |
| OI-5 | Committee members cannot edit tournament details | Organizer only, as today | Owner request |
| OI-6 | **Closed [v1.1].** No tournament reminder subsystem exists (lifecycle AD-12 unbuilt); nothing to recompute. See OI-12 | n/a | n/a |
| OI-7 | Participant team roster change ends at the soft block (D-3) | As written | Owner may reverse D-3 |
| OI-8 | **Closed [v1.1].** This addendum is the board of record for the five new screens; conflicting boards superseded on the AD-1/AD-4 elements only (section 4) | n/a | n/a |
| OI-9 | Mobile facts not checked from the backend repo: notification routing, the create game wizard fields, existing tournament types | Checked first in step 3.0 | Any mismatch is reported before 3.1 builds |
| OI-10 | Series of games that already have participants cannot change day or interval | Refused with `SERIES_HAS_PARTICIPANTS` | Owner request |
| OI-11 | Recurrence other than weekly | Not supported | Two distinct requests within 90 days |
| OI-12 | **[v1.1]** Lifecycle AD-12 (tournament reminders: table, job, dead-man alert) was never built; its config keys are validated but unread | Not in this batch's scope | The owner schedules it as its own task |
| OI-14 | **[v1.2]** The label texts that still say "frozen" (`web.reg.err.committee_add_closed`, `withdrawal_closed`, `roster_frozen`, seeded by teams-payments M1) and the web client lists of notification types and phase branches | Reworded by the label migration M3 (1.6) and the web task 1.4 | A participant-visible "frozen" text after 1.6 is a defect |
| OI-13 | **[v1.1]** Series copy-from-latest: an edit of only the latest instance propagates to instances created after it | Accepted at T1 | Two organizer complaints within 90 days: store a template snapshot on the rule |

---

## 13. Approval Record

**v1.0 APPROVED by the owner, 2026-10-27.** Requirements ER-01 to ER-32 and the assumptions marked **[A]** (AD-3 who edits, AD-5 participant roster change narrowing, AD-8 series defaults) are approved with this document. Changes from the elicitation conversation are recorded in BP-13 form:

| Change | Section |
|---|---|
| Count without denominator, `is_full`, cap shown to the committee only | AD-1 |
| Edit until start, date rules, soft block reopening, withdrawal choice, reset | AD-3, AD-6 |
| Hard block hidden from participants | AD-4 |
| Committee override after the closure and the hard block, team add | AD-2, AD-5 |
| Shuffle by pot rotation, balanced draws, "Shuffle again" | AD-7 |
| Recurring games: series acceptance, skip, leave, scope edit and cancel, end rule, config | AD-8, AD-10 |
| Four-step delivery plan with 27 tracked steps | Section 11 |
| Library change not needed for the shuffle (correction of a conversation statement) | Process note 3, D-6 |

**v1.1 (2026-10-27), architect amendment after the `er-p1-verify` report (PR #158), under the owner's "go ahead with step 1".** Changes (BP-13):

| ID | Change | Section |
|---|---|---|
| A1 | G1 gate passed; OI-1 closed; shuffle provenance keys live in the draft payload; g-1 swaps per pot | AD-7, §12 |
| A2 | No tournament reminders exist (lifecycle AD-12 unbuilt): reminder bullet struck, OI-6 closed, OI-12 opened (B-3) | AD-3, §12 |
| A3 | Hard-block omission in the shared serialization path; `settings_dashboard` and cancel in scope; share preview struck (no route); `scoring/state` phase mapped to open/closed for non-privileged viewers; three "frozen" `detail` texts rewritten (B-4, D-6, D-7) | AD-4, §6 |
| A4 | Reset mechanics specified: new unpublish, new `unlock_points_set`, reset status `registration_open`, pending publication approvals fail stale (B-5, D-4) | AD-6 |
| A5 | Committee team add on `registrations/committee-add` with `team_id`; `POST /registrations` stays self-only (B-8, D-1) | AD-2, §5.2 |
| A6 | Date refusals are `TOURNAMENT_DATES_INVALID` reasons; PATCH gains the changed-only validator; the `registration_closes_at` status gate and the fee-edit closure check amended (D-2, D-3) | AD-3, §5.2 |
| A7 | Series: copy source = latest non-cancelled instance; venue and waitlist fields copied; reminders for new instances; skip keeps the invitation accepted; day-of-week default is new behaviour (B-6, D-8, D-9) | AD-8 |
| A8 | Config editor homes: shuffle keys in the tournament settings registry; game keys on `/home-settings` (B-2, D-11) | AD-10 |
| A9 | Boards ruling: the addendum is the board of record for the five new screens; conflicting boards superseded on the AD-1/AD-4 elements; OI-8 closed (B-1, D-13) | §4 |
| A10 | Migrations re-homed: M1 in 1.1 (tournaments + notification CHECK), M2 in 1.3 (events), M3 in 1.6 (config and labels); strictly sequential order (B-7) | §5.1, §11 |
| A11 | `registered_count` and `is_full` on every route, batched; organizer-only cap keys kept (D-5, D-14) | AD-1 |
| A12 | Notification CHECK facts: preferences table only; `pg_constraint` guard pattern; eight-file touch list (D-10) | AD-9 |

No requirement changed; every ER of section 1 holds as approved.

**v1.2 (2026-10-28), architect amendment after the `er-bw-tournament` report (PR #160).** Changes (BP-13):

| ID | Change | Section |
|---|---|---|
| A13 | Edit rules apply to lifecycle version 2 only; version 1 keeps its gates | AD-3 |
| A14 | Changed-only ordering rules; null date read as not sent; refusal order `DATE_IN_PAST`, `REGISTRATION_DATES_REQUIRED`, ordering | AD-3 |
| A15 | `registrants_may_withdraw` semantics; `tournament_updated` sent for start, end, closure or venue only | AD-3 |
| A16 | A committee change of a team's members does not reset fixtures; add and removal do | AD-5 |
| A17 | OI-14 opened (label texts and web lists still say "frozen" until 1.6 and 1.4); step 1.1 recorded done, progress 2 of 27 | §11, §12 |

No requirement changed.

**v1.3 (2026-10-28), architect correction after the `er-bw-shuffle` report (PR #162).** Changes (BP-13):

| ID | Change | Section |
|---|---|---|
| A18 | 12 entrants in 4 groups keep 7 of 16 compositions, 28 draws (not 10 and 40) under the written balance rule; the tolerance setting widens it (2 gives 36, 3 gives 52); the pot-2-alone spread is 7 | AD-7, §5.4 |
| A19 | Step 1.2 recorded done, progress 3 of 27 | §11 |

No requirement changed. The rule "balanced = spread within the canonical spread plus tolerance, default 0" stands as the owner approved it.

**v1.4 (2026-10-28), architect amendment after the `er-bw-series` report (PR #164).** Changes (BP-13):

| ID | Change | Section |
|---|---|---|
| A20 | Server code `SERIES_END_INVALID` replaces `SERIES_END_REQUIRED` (screens enforce "end required"); `SERIES_ORGANIZER_CANNOT_LEAVE` added | AD-8, §5.2 |
| A21 | `PATCH /events/{id}/series` body (`start_time`, `duration_minutes`) and the leave response `{left, games_left}` fixed as the client contract | AD-8 |
| A22 | Series notification: one outbox row per recipient, 96-character key, snapshot branch in the fan-out | AD-8 |
| A23 | `occurrence_limit` counts every game of the rule; legacy rolling rules also expand at create; `invite_user_ids` invites on the first game | AD-8 |
| A24 | Step 1.3 recorded done, progress 4 of 27 | §11 |

No requirement changed.
