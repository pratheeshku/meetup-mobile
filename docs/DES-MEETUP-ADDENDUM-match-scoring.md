# DES-MEETUP-ADDENDUM-MATCH-SCORING

**Doc ID:** DES-MEETUP-ADDENDUM-MATCH-SCORING
**Version:** v1.2
**Status:** **v1.1 amends the APPROVED v1.0 (owner, 2026-10-22).** v1.1 is the architect's correction after the ms-s0 Blocked Report (same day): lifecycle phases 6a and 7 were never built, so this release now **builds the results and advancement substrate itself** to the lifecycle AD-10 specification (tasks S2a/S3a, §10), plus the as-built corrections in §13. No requirement (MS-01..MS-28) changed.
**Owner:** Pratheesh
**Date:** 2026-10-22
**Scale Tier:** T1
**Baseline:** `DES-MEETUP-ADDENDUM-tournament-lifecycle` v1.3 (read from the Project). Design-only addendum, same pattern as the other `DES-MEETUP-ADDENDUM-*` documents. It does **not** edit the lifecycle document; §2 lists what it supersedes or extends.
**Companions:** `DES-FIXTURE-CORE-001` v1.4 (the `fixture_core` library; v1.4 is approved with this document), `DES-MEETUP-ADDENDUM-fixture-workspace` v1.1, the closure-report addendum v1.0 (Played/Won/Hosted semantics, 2026-10-20).
**Governing files:** `Enterprise_Design_Principles.md` v1.1 (P1–P17), `design-best-practices.md` v1.0 (BP-01–BP-13). Both read in full from the Project knowledge base before drafting (Phase 1.5 gate passed).
**Visual source:** Design canvas (claude.ai/artifact/SRavBx8jwnK8kK1QjVovnM), sections "brackets, results, standings and close-out" (boards RSMatches, Enter result, Walkover, Correct, Saved). Per the owner's standing instruction the canvas is updated only after his explicit confirmation; §2 note V lists where this document supersedes what a board shows.

**Process notes (flagged, not silent):**
1. No REQ addendum exists. Requirements were elicited in conversation on 2026-10-22 (with web research on BWF and federation practice) and are restated in §1 as MS-01 to MS-24 (owner statements) and MS-25 to MS-28 (architect-derived from the principles, marked as such). Same departure the lifecycle addendum recorded (its note 1). Approved with this document.
2. This document reconciles three conflicts found in a full history sweep (owner-requested, 2026-10-22); each is an explicit Architecture Decision: AD-S10 (Won semantics, closure-report ruling of 2026-10-20 wins), AD-S7 (live standings supersede the group `standings_publication` maker-checker), AD-S5 (walkover carries no score credit, superseding the canvas board's default 21–0 note).
3. Sequencing is the owner's: build **after the current app release** (2026-10-20 decision on release sizing). Prerequisites in §10.
4. Table and column names must be verified against the live schema in phase S0 (BP-01); §5.1 names follow the lifecycle addendum's as-built reports.
5. **(v1.1)** The ms-s0 verification (`docs/reports/ms-s0-verification-and-blocked-report.md`, 2026-10-22) found that lifecycle phases 6a and 7 were never built: no `tournament_match_results`, no `result_service`, no advancement columns on `tournament_fixtures`, no tournament draft table. v1.0's "existing, extended" wording for those items was drift. v1.1 folds their build into this release (S2a/S3a) rather than building lifecycle 6a's Excel fixture-import first, which §2 already supersedes for groups+knockout. Lifecycle AD-10 and lifecycle §5.1 remain the authoritative specification for what S2a/S3a build.

---

## Plain-language summary

Tournaments get real scoring. After the hard block the organizer downloads a **points Excel** of all registered players, fills in each player's points (blank means unrated) and uploads it back. The system then **generates the fixture itself** — groups then knockout — using the `fixture_core` library: players are split into 2, 4 or 8 groups by snake seeding, the organizer picks whether the top 1 or top 2 of each group advance, and the knockout pairings are fixed so two players from the same group can only meet again in the final. The committee reviews the draft and publishes it with the existing two-person approval.

Scores are captured through a second Excel: the system exports a **scoring workbook** pre-filled with every match, the organizer types the set scores (badminton; free numbers, no rule validation this release) and a result type — Normal, Walkover or Retired — and uploads it. The system derives every winner from the set scores, fills the next round, computes the group tables with BWF-style tiebreakers and shows scores and standings to everyone. The organizer never types a winner's name.

Corrections are safe: a typo fix that keeps the winner goes straight in (logged). A correction that **changes a winner**, a walkover/retired change, or an override of who qualifies from a group needs approval from a **different committee member**, and is blocked until any downstream result that depended on the old outcome is explicitly cleared first. Players get a push when their result is posted, when they advance or qualify, and when a result that affects them is corrected or cleared.

A player's Played count updates as soon as their match result is uploaded. Won stays one per tournament, from the closure report, whose winner and runner-up are pre-filled from the final.

---

## 1. Requirements baseline (from the 2026-10-22 elicitation)

| ID | Requirement | Source |
|---|---|---|
| MS-01 | Scope is badminton only in this release. Scoring is the final score of a match, entered after the match; no live point-by-point scoring. | Owner |
| MS-02 | One score line per match, including team matches. A doubles pair is a team with one score line. No tie made of sub-matches. | Owner |
| MS-03 | Scores are organizer-entered numbers with no badminton rule validation this release (no 21/30/best-of enforcement). Minimum guards only: non-negative integers and no tied set, because winner derivation breaks without them. | Owner; guards architect-accepted by owner |
| MS-04 | Scores are captured via Excel: the system exports the fixture as a pre-populated workbook, the organizer fills set scores and uploads it; the system derives winners from set scores and fills next-round slots. The organizer never types a winner's name. | Owner |
| MS-05 | The fixture Excel is pre-populated per tournament by the system; structure and feeder links are locked; the organizer edits only draw order (within policy), schedule and scores. | Owner |
| MS-06 | This release covers the **groups + knockout** format only. Standalone knockout and standalone round robin are deferred. | Owner |
| MS-07 | Result types Normal, Walkover (WO) and Retired (RET) are tracked and stored on every match, selectable at score entry. | Owner |
| MS-08 | WO/RET counting (option A): the advancing side gets the match win with **no set or point credit** in tiebreakers; for RET the sets already played are kept; a WO or RET counts as Played for the advancing side only, and the other player's record shows the loss. The advancing side is named by the organizer. | Owner |
| MS-09 | A correction that keeps the winner takes effect directly and is logged. A **winner flip** needs approval from a different committee member and is blocked until the downstream result is cleared first. WO/RET changes follow the same approval path. | Owner |
| MS-10 | Group qualifiers: the system ranks each group and the top N advance automatically; the organizer can override a place with a logged reason, subject to the same committee approval as a winner flip (option C). | Owner |
| MS-11 | Group tiebreak order (research-informed, owner-accepted): (1) matches won; (2) if exactly two are tied, head-to-head; (3) if three or more are tied, set difference then point difference, each over **all** of the player's group matches; when a step reduces the tie to exactly two, head-to-head is reapplied; (4) anything unresolved goes to the logged organizer override (MS-10). | Owner |
| MS-12 | Scores and standings are visible to everyone who can view the tournament. | Owner |
| MS-13 | A posted result counts toward a player's Played stat immediately on upload; stats are computed from stored match records, never kept as running counters. Won remains one per tournament won, per the closure-report ruling (AD-S10). | Owner (2026-10-22 + 2026-10-20) |
| MS-14 | Push notifications: result posted (both sides), advancement/qualification (naming the next opponent once known), and approved flip or cleared result (affected players). | Owner (option D) |
| MS-15 | Group structure: players are divided into 2, 4 or 8 groups depending on player count — the largest of 2/4/8 that leaves every group with at least 3 players; the organizer may choose fewer groups, never more. Group sizes differ by at most one. Snake seeding by points; team points are the average of members' points. Qualifiers per group: organizer's choice of top 1 or top 2; the knockout stage (R16/QF/SF/F) follows from groups × qualifiers. | Owner |
| MS-16 | Knockout pairing is fixed cross-group: a group winner meets a runner-up from a different group, and two qualifiers from the same group can meet only in the **final** (fixture_core v1.4 pairing). Top-1-only draws pair winners in fixed order. | Owner-accepted recommendation |
| MS-17 | Freeze rule: a tournament's format version is locked once its fixture is generated, and the fixture cannot be regenerated after the first result is posted. | Owner |
| MS-18 | Fixture generation logic must stay changeable later without touching scoring: the generated fixture is the contract; group allocation, pairing and tiebreak criteria are named, versioned strategies; standings are computed from match rows; every fixture is version-stamped. | Owner |
| MS-19 | Fixture generation runs for real tournaments from the tournament view, off the frozen registration list, after the hard block. | Owner |
| MS-20 | Before generation the organizer downloads a points Excel of all registered players (IDs and names pre-filled and locked, points editable), fills player points and uploads it back, validated. Re-upload is allowed until the fixture is generated. Blank points = unrated, seeded last. | Owner |
| MS-21 | An Excel template capturing the fixture is generated as part of this build (the scoring workbook, §5.4). | Owner |
| MS-22 | Walkover/retired is an option at score entry (a result-type column in the workbook and a field in the correction flow). | Owner |
| MS-23 | Minimum sizes: at least 3 players per group; the knockout stage has at least 4 entrants (so 2 groups require top 2). Fewer than 6 registered players is not valid for this format. | Owner-accepted recommendation |
| MS-24 | Group-stage detail defaults accepted 2026-10-22 (count thresholds, even sizes, snake seeding); the owner may refine before build — a refinement amends this document by version. | Owner |
| MS-25 | Every scoring and points upload is validated against an explicit schema with row-level reason codes; uploads are all-or-nothing (P9, AD-17 precedent). | Architect, P9 |
| MS-26 | Every mutation is attributable and append-only where it already is (AD-10); corrections, overrides and clears are logged with who, when and reason (P6). | Architect, P6 |
| MS-27 | All new notification text is admin-managed through `ui_labels`, grouped in a logical section (owner's standing notification rule, 2026-10-21). | Architect, owner rule |
| MS-28 | Every new endpoint declares its access rule and has an API-level negative test (P15, P13). | Architect |

---

## 2. Relationship to prior designs (supersessions, explicit)

| Prior item | Effect of this addendum |
|---|---|
| Lifecycle TL-32 (committee enters set scores in-app, winner derived) | **Means of entry superseded for this release:** scores arrive via the scoring workbook upload (AD-S4). Winner derivation is unchanged. The in-app entry screens on the canvas are the **end state**, deferred; building them later is additive. |
| Lifecycle TL-21 (single member enters a score, logged) | Kept: one active committee member performs the upload; every posted result is logged with uploader and time. |
| Lifecycle TL-20 / TL-35, `standings_publication` scope `group` (two-person approval to publish group standings and resolve placeholders) | **Superseded for v2 groups+knockout (AD-S7):** group standings are computed live from results and visible to everyone (MS-12); knockout slots resolve automatically when a group completes with no unresolved tie; only a qualification **override** needs two-person involvement (maker + approver). `standings_publication` scope `final` is superseded by the closure report (closure addendum v1.0). |
| Lifecycle AD-10 (append-only results, projection, advancement data, correction guard `DOWNSTREAM_PLAYED`) | **Kept and extended (AD-S6):** the winner-flip path now requires approval by a different committee member; clearing a downstream result becomes an explicit logged committee action; result kinds gain `retired`; the `sets` validator's badminton rule enforcement is relaxed per MS-03 (deviation D-S1). |
| Lifecycle AD-17 (Release 1 fixture import by Excel upload, committee-built fixtures) | **Superseded for groups+knockout:** the fixture comes from the engine (AD-S3); the external fixture upload path remains designed for the deferred standalone formats and is not built in this release. AD-17's file-hardening rules (xlsx-only, values-only read, limits, formula neutralisation, all-or-nothing) are inherited by every workbook in this document. |
| Lifecycle AD-8 (fixture engine in `tournaments/fixture_engine/`) | Already superseded by `DES-MEETUP-ADDENDUM-fixture-workspace` §2: generation comes from the external `fixture_core` library. This document designs the **tournament adapter** (AD-S3). No AI interpreter is in this release's tournament flow, so workspace deviation D-F2's extraction gate is **not** triggered. |
| Lifecycle AD-9 (schedule planner, post-publication edit bounds) | Kept. After publication, schedule changes go through AD-9's per-match edit, never through a re-upload (AD-S4). |
| Lifecycle TL-34 (a player's full record is visible to that player only) | Kept and clarified: per-match scores on the tournament view are public to tournament viewers (MS-12); the aggregated personal record endpoint stays owner-only. |
| Lifecycle §7.2 (group-stage tie fallback: seeded draw) | **Superseded for v2 groups+knockout:** the fallback is the logged organizer override with committee approval (MS-10/MS-11), which the owner chose over a blind draw. |
| Closure-report addendum v1.0, CR-06 / AD-5 (Played, Won and Hosted come **only** from closure reports; the fixture-win query removed; Won = one per game/tournament won) | **Kept for Won and Hosted, and for games entirely; superseded for tournament Played (AD-S10):** Played for tournament matches with posted results is match-result-driven (MS-13, the later owner ruling of 2026-10-22). Won stays one per tournament, from closure player rows with role `winner` — the removed fixture-win query does **not** return. The tournament closure report's winner, runner-up and attendance are pre-filled from the posted match results. |
| Fixture-workspace addendum OI-W2 (deferred Excel export / tournament link; gate: owner asks to feed a tournament) | Gate met by this document. The registration-ID mapping problem OI-W2 named is closed by AD-S2 (registration IDs flow through points, fixture and scoring workbooks). The workspace itself is unchanged. |
| Fixture POC decision "Phase 1 has no approvals" (2026-10-21) | Applied to the **admin workspace** only. Tournament fixture **publication** keeps TL-20 two-person approval (AD-S3); corrections and overrides follow AD-S6. |
| **Note V — canvas boards** | The Walkover board's note "walkover score is set by the format (21–0, 21–0)" is superseded by MS-08 (no score credit). The Enter-result and Correct boards show the in-app end state; this release's entry surface is the workbook. Boards are redrawn only on the owner's explicit confirmation. |

**Deliberate deviations from the two governing files: none.** P9 is met: uploads are schema-validated (type, shape, range, whitelist); MS-03 omits *domain* (badminton rule) validation, which is a product decision recorded as D-S1 against the lifecycle baseline, not a P9 breach. Supersessions of prior addenda are the table above.

---

## 3. Architecture Decisions

**AD-S1 — The generated fixture is the contract (MS-18).** Scoring, standings, advancement and stats read only the stored fixture and result rows; they never call the generator. Changing generation logic later cannot break scoring. Concretely:
- Slots hold references, never names: a side is a registration, `group_place(group, place)` or `winner_of(match)` — the lifecycle's `source_a`/`source_b` model (AD-10), fed by `fixture_core`'s equivalent Refs via the adapter.
- The **format spec** is versioned data inside `rules_snapshot` (AD-3): allowed group counts {2,4,8}, `min_group_size` 3, qualifiers per group {1,2}, knockout minimum 4, pairing strategy name `cross_group_v2`, group-allocation strategy name `snake_by_points`, tiebreak criteria list (MS-11 order). New strategies are new named entries plus a spec version; scoring code is untouched.
- Every fixture records the version domains `fixture_core` already stamps (library, fixture schema, format catalogue, algorithm revision) plus the tournament's template version (BP-08).
- **Freeze (MS-17):** `rules_snapshot` is already immutable (AD-3). Additionally, regeneration is refused once any result exists (`409 FIXTURE_FROZEN`); before that, regeneration follows the draft-version path with an explicit discard warning. Golden tests pin each algorithm revision's output (fixture_core FT-7/FT-20).
- Rejected: a general rules engine or runtime-pluggable strategy switches (BP-12; only the three named strategy points flex).

**AD-S2 — Points round-trip before generation (MS-20).**
- `GET …/points/template` (active committee, phase frozen): server-generated `.xlsx`, one row per frozen registration entrant — `Registration ID` (locked), `Name` (locked, neutralised per AD-17), `Team` (locked, team mode), `Points` (editable, blank allowed). Locked header carries tournament id and a template version.
- `POST …/points` (multipart, active committee): AD-17 file rules apply. Validation, all-or-nothing with row reasons: every frozen registration present exactly once; no unknown or added rows; points blank or a finite non-negative decimal within bounds (`points_min`/`points_max`, config). Blank = unrated → `fixture_core` `seed_last` (MS-20). A passing upload stores one points set per tournament (latest wins), with uploader, time and file hash; re-upload allowed until generation (`409 POINTS_LOCKED` after). Points are seeding input only; they are not shown on public views.
- Registration IDs are the join key across points, fixture and scoring workbooks — never names (AD-17 precedent). This closes the mapping gap OI-W2 recorded.

**AD-S3 — Generation from the tournament view through `fixture_core` (MS-15, MS-16, MS-19).**
- New host adapter `tournaments/fixture_core_adapter.py`: builds the library roster from frozen registrations + the uploaded points (team points = member average, by the library's rule), computes the group count with the library's `suggest_group_count` helper (thresholds from the format spec; the organizer may pick a smaller allowed count, never larger), calls `generate` with format `group_knockout` (algorithm revision 2: pre-final same-group separation), seed = stored `rng_seed`, and maps the returned `Fixture` to a `DraftPayload` with `source='engine'` — the shape AD-17's socket already admits. A round-trip test asserts the mapping (workspace §2 requirement). **(v1.1)** The pin is the **vendored wheel** pattern already in use: build the wheel from the sadhana release tag carrying library v1.4, replace `vendor/fixture_core-*.whl`, and record tag name, tag-object SHA **and commit SHA** in `vendor/fixture_core.SOURCE.txt` (the current file records the tag-object SHA as "Commit"; fix that drift).
- Draft → publication is unchanged lifecycle machinery: `fixture_publication` maker-checker (TL-20) binds `{draft_id, payload_hash}`; materialisation writes `tournament_fixtures` with the advancement links. The schedule planner (AD-9, in the library) proposes times and courts inside the tournament window; the organizer edits in the workbook before results or per match after publication.
- `meetup.tournament.fixture_engine.enabled` gates the routes (existing key, default false until this release ships).
- Requires ≥2 active committee members (AD-7 gate) and a stored points set.
- Rejected: organizer-edited bracket structure (reopens the mistyped-feeder risk the locked template closed); building generation inside `tournaments/` (workspace §2 already moved it to the library).

**AD-S4 — Scoring workbook round-trip (MS-04, MS-05, MS-21, MS-22).**
- `GET …/fixtures/workbook` (active committee, after publication): server-generated `.xlsx`. One sheet per group plus a Knockout sheet. Columns per match row: `Match ID` (locked), `Stage/Round` (locked), `Side A` / `Side B` (locked: registration IDs + display names; placeholders like "Winner of M3" or "A1" until resolved), `Date`, `Start`, `Court`, `Venue` (editable **before publication only**; afterwards shown read-only with a note pointing to the per-match edit), `Result type` (dropdown: Normal, WO, RET), `Set1 A`, `Set1 B`, `Set2 A`, `Set2 B`, `Set3 A`, `Set3 B`, `Advancing side` (A/B; **required for WO and RET, ignored otherwise**). There is **no winner column**: the system derives it. Locked header: tournament id, fixture `payload_hash`, workbook schema version. All user-controlled cells neutralised on write (AD-17).
- `POST …/fixtures/results-upload` (one active committee member, logged — TL-21): AD-17 file rules; header hash must match the published fixture (stale workbook → `409 WORKBOOK_STALE`, re-download). Validation, all-or-nothing with row reasons (`422`): known match IDs only; both sides resolved; sets are non-negative integers; within a set the scores differ (no tied set, MS-03); Normal rows have ≥1 completed set and a derivable winner (more sets won than the other side among entered sets); WO rows have no set scores and an advancing side; RET rows keep entered sets and name the advancing side; a row for a match that already has a result is accepted only if the derived winner, result type and advancing side are **unchanged** (a score-only correction, posted as a new result version with reason `workbook_correction`) — any row that would flip a winner or change WO/RET is rejected with `CORRECTION_NEEDS_APPROVAL`, pointing at the correction flow (AD-S6). Unfilled rows are simply not yet played.
- On success, per new row in one transaction set: append `tournament_match_results` (kind `sets`, `walkover` or `retired`; payload holds sets, result type, advancing side), write the projection, advance the winner one hop (AD-10), enqueue notifications (AD-S8), and update reminder rows **only once lifecycle phase 8 exists** — the reminder dispatch table is not built and phase 8 is out of this release's scope, so result posting must not depend on it (v1.1). Partial fixtures are normal; upload as often as wanted.
- Rejected: partial (row-level) acceptance (ordering ambiguity on failures; AD-17 is all-or-nothing); schedule edits via re-upload after publication (bypasses AD-9's bounds and `fixture_reschedule`).

**AD-S5 — Result types and counting (MS-07, MS-08).**
- `tournament_match_results.kind` gains `retired` (additive CHECK widening). `walkover` exists (AD-10).
- Standings and tiebreakers: a WO or RET gives the advancing side the match win; **no set or point credit to either side** from a WO; for RET only the sets actually played count in set/point difference. Played: the advancing side +1; the other side's match history records the WO/RET loss without a Played increment (MS-08, owner-accepted). Byes stay excluded entirely (lifecycle §7.2).
- The rule is shown on the standings view (one admin-managed label), because federation practice varies and players will ask.
- Supersedes the canvas Walkover board's default-score note (§2 note V).

**AD-S6 — Corrections, flips, overrides and clears (MS-09, MS-10).**
- **Score-only correction** (derived winner, result type and advancing side unchanged): one active committee member, via re-upload (AD-S4) or `POST …/fixtures/{id}/corrections`; new result version with `correction_of_version` and reason; logged (P6). Standings and stats recompute from the rows (AD-S9).
- **Winner flip / WO-RET change / qualification override:** maker-checker through `committee_flow_v2` (AD-7 machinery). Two new action types (additive CHECK): `result_winner_change` (binds fixture id, proposed result payload, reason) and `qualification_override` (binds group key, proposed placement, reason). Approver must be a different active committee member; the maker's own approval is refused (existing rule). While pending, the original result and slot stay in force.
- **Downstream guard (kept, extended):** a flip or override cannot be approved while any dependent fixture has a result or a non-`scheduled` status (`409 DOWNSTREAM_PLAYED`, both winner and loser paths, AD-10). Clearing a dependent result is a new explicit action `POST …/fixtures/{id}/clear-result` — itself a maker-checker `result_winner_change`-class action (it destroys a played result) — which appends a voiding result version, empties the projection and re-opens the slot. Only then can the flip be approved; on execution the new winner replaces the old one in the next slot and notifications go out (AD-S8).
- The organizer qualification override exists for unresolved ties (MS-11 step 4) and exceptional cases; it is logged with reason and surfaces on the standings view as "adjusted by committee".

**AD-S7 — Live standings (MS-11, MS-12).** Group standings are a pure function over current result rows + the snapshot tiebreak list: matches won → head-to-head when exactly two tied (guard: applied only when the tied players met the same number of times — automatic in a single round robin, asserted) → for three or more, set difference then point difference over all group matches, reapplying head-to-head whenever a step leaves exactly two → organizer override. Standings are computed on read (T1 volumes; a group is ≤ a few dozen matches) and shown to every tournament viewer; nothing is snapshotted until close-out. When a group completes with no unresolved tie, the qualifying registrations resolve the knockout `group_place` slots automatically in the same transaction as the final group result; an unresolved tie leaves the slots open and flags the group for override. Supersedes `standings_publication` scope `group` (§2). Rejected: keeping the two-person publish step (contradicts MS-12 and adds a human gate to arithmetic; committee control is preserved where judgment enters — overrides, flips, clears).

**AD-S8 — Notifications (MS-14, MS-27).** New types (additive CHECK + fanout audience + builders + label seeds): `tournament_result_posted` (exists; audience = the fixture's two sides via `tournament_registration_members`), `tournament_advanced` (a side placed into a next match or qualified from a group; names the opponent once both sides are known, else "to be decided"), `tournament_result_corrected` (approved flip, WO/RET change, override or clear; audience = every registration whose slot or result changed). All titles and bodies from `ui_labels`, grouped under a "Tournament scoring" section in admin label management (owner's 2026-10-21 grouping rule) — **(v1.1)** grouping in the admin label editor is by key prefix, so this is a new prefix (for example `tournament_scoring.*`) mapped to the section name in the editor, not a schema change. One notification per event per recipient, deduplicated; no notification for a score-only correction.

**AD-S9 — Stats recompute (MS-13).** Played for tournament matches = count of current result versions where the player's side actually contested (Normal both sides; RET both sides; WO advancing side only — MS-08), read through `tournament_registration_members`, recomputed from rows on read or on a cheap materialised refresh per upload — never incremented counters, so flips, clears and corrections self-correct. Played for **games** stays closure-driven (closure addendum CR-06, unchanged). The dashboard stats strip (Played/Won/Hosted/Groups) picks this up through its existing source. **Won is unchanged:** one per tournament won, from closure player rows with role `winner` (AD-S10); the removed per-fixture win query does not return.

**AD-S10 — Closure reconciliation (owner rulings 2026-10-20 + 2026-10-22).** The closure-report addendum's rules stand for Won and Hosted everywhere and for games entirely: Won = one per game/tournament won (closure player rows, role `winner`); Hosted needs a clean closure; pending-closure items count toward nothing. This document supersedes closure CR-06 in one slice only: a **tournament match with a posted result** counts toward Played immediately (AD-S9), without waiting for closure — the 2026-10-22 owner ruling. The tournament closure report **pre-fills** winner, runner-up and attendance from the posted match results (editable by the committee, as the closure flow allows), so closure becomes a confirmation, not a re-entry. Flagged as the reconciliation of the 2026-10-22 "results feed Played/Won" statement with the earlier, more specific Won ruling; the closure addendum gets a one-line pointer at its next revision (BP-13).

**AD-S11 — End-state sockets.** In-app result entry (the canvas boards), rule-validated badminton scoring (parameters on the format spec), standalone knockout and round robin, and live scoring are all deferred; each lands additively: entry screens post to the same result endpoints the upload uses; rule validation is a format-spec flag the validator reads; new formats are new library strategies (AD-S1). Gates in §12.

---

## 4. Component / Integration Design

| Component (under `tournaments/` unless noted) | Owns | Calls |
|---|---|---|
| `points_io.py` | Points template export, upload parse/validate, stored points set | AD-17 file guards |
| `fixture_core_adapter.py` | Roster build, `suggest_group_count`, `generate`, Fixture→DraftPayload mapping, round-trip test | `fixture_core` (pinned release) |
| `scoring_io.py` | Scoring workbook export, results upload parse/validate, diff against stored results | `result_service` |
| `result_service.py` + `result_validator.py` (**new in this release, v1.1**: built to lifecycle AD-10's specification, then extended per AD-S4..AD-S6) | Append-only result log, projection writer (sole writer of `winner_registration_id`/`score_summary`), one-hop advancement over the new links, clear-result voiding | library structural validator |
| Draft + publication path (**new in this release, v1.1**: lifecycle AD-8/AD-17 socket, engine source only — the Excel fixture-import parser of AD-17 is not built) | `tournament_fixture_drafts` rows, `fixture_publication` binding `{draft_id, payload_hash}`, materialisation into `tournament_fixtures` | `committee_flow_v2` |
| `standings.py` | Pure standings function (MS-11), qualification resolution, override application | result rows |
| `committee_flow_v2.py` (existing, extended) | `result_winner_change`, `qualification_override` action types | `committee_engine` |
| `notifications/fanout` (existing, extended) | AD-S8 audiences | `tournament_registration_members` |

**Endpoints** (all v2 tournaments, active-committee unless stated; denial per lifecycle: 404 hiding; every mutating call idempotent per existing patterns):

| Method and path | Purpose | Actor |
|---|---|---|
| `GET …/points/template` | Points Excel download | active committee, phase frozen |
| `POST …/points` | Points upload | active committee; `409 POINTS_LOCKED` after generation |
| `POST …/fixtures/generate` | Generate draft via fixture_core | active committee, ≥2 active, phase frozen, points present; `409 FIXTURE_FROZEN` after first result |
| `GET …/fixtures/workbook` | Scoring workbook download | active committee, after publication |
| `POST …/fixtures/results-upload` | Scores upload | one active committee member, logged |
| `POST …/fixtures/{id}/corrections` | Score-only correction | one active committee member |
| `POST …/committee/actions` (existing) | `result_winner_change`, `qualification_override` submit/approve | maker + different approver |
| `POST …/fixtures/{id}/clear-result` | Submit a clear (void) of a played result | maker-checker |
| `GET …/standings` | Live group tables + qualification state | any tournament viewer |

Publication, per-match schedule edit and reminders are the existing lifecycle endpoints, unchanged.

**Integration boundaries:** `fixture_core` is pure and bounded (node budget, entrant caps); a generation failure returns the library's coded error and saves nothing; library calls run off the event loop (workspace AD-W8 precedent). No LLM in this flow.

---

## 5. Data Contracts

### 5.1 Schema (additive; migrations written, never executed by agents; names verified in S0 per BP-01)

| Table / change | Columns and constraints |
|---|---|
| `tournament_points_sets` (new) | tournament_id PK/FK, payload JSONB (registration_id → points or null), file_sha256, filename, uploaded_by, uploaded_at, locked_at NULL (set at generation). GRANT SELECT, INSERT, UPDATE to `meetup_app`; no RLS. |
| `tournament_match_results` (**new table, v1.1** — lifecycle phase 7 never ran) | Built to lifecycle AD-10 / lifecycle §5.1: id, fixture_id, version, kind, payload JSONB, winner_registration_id, entered_by, entered_at, correction_of_version, reason; UNIQUE(fixture_id, version); no UPDATE/DELETE path in code. `kind` CHECK = lifecycle's (`sets`, `score`, `draw`, `walkover`) **plus `retired` and `voided`**; this release uses `sets`, `walkover`, `retired`, `voided` only. Payload for sets/walkover/retired carries `{sets:[{a,b}], result_type, advancing_side}` |
| `tournament_fixture_drafts` (**new table, v1.1** — lifecycle phase 6a never ran) | Built to lifecycle §5.1 (id, tournament_id, version, payload, payload_hash, constraints, rng_seed, source_comment_id, status, created_by, source CHECK(upload, engine), source_file_hash, source_filename, uploaded_by). This release writes `source='engine'` only; the upload columns stay NULL and the AD-17 parser is not built |
| `tournament_fixtures` (**columns added, v1.1** — v1.0 wrongly said "unchanged") | Adds lifecycle AD-10's columns: `next_fixture_id`, `next_slot`, `loser_next_fixture_id`, `loser_next_slot`, `source_a` JSONB, `source_b` JSONB, `court_label`, `duration_minutes`; `stage` CHECK gains `third_place` (as-built today: main, group, quarterfinal, semifinal, final) |
| `tournament_approval_requests` | `action_type` CHECK adds `result_winner_change`, `qualification_override` (ms-p5 adds `fixture_publication` first; as-built CHECK today holds the six v1 values only) |
| `tournament_standings_overrides` (new) | id, tournament_id, group_key, payload JSONB (placements), reason, requested_by, approval_request_id, created_at (immutable; latest per group wins) |
| `notification_preferences` (**v1.1**: the type list lives on `chk_notification_preferences_type`, not a `notifications` CHECK) | CHECK adds `tournament_advanced`, `tournament_result_corrected` (verify the live catalog first, OI-7 pattern) |
| `rules_snapshot` (data, not DDL) | format spec v2 fields for `group_knockout`: `allowed_group_counts [2,4,8]`, `min_group_size 3`, `qualify_per_group_options [1,2]`, `knockout_min 4`, `pairing "cross_group_v2"`, `allocation "snake_by_points"`, `tiebreakers ["matches_won","head_to_head","set_difference","point_difference","override"]` (TemplateDefinition schema_version bump, additive) |

### 5.2 Data lineage (one source per field)

| Field | Single source | If it comes from elsewhere, it is a bug |
|---|---|---|
| Seeding points | `tournament_points_sets` (latest, locked at generation) | profile skill levels, the workbook |
| Fixture structure and feeder links | published fixture rows from the engine draft | any cell of an uploaded workbook |
| Match winner, result type, advancing side | derived by the server from the latest result version's sets/type | a typed winner anywhere |
| Group standings and qualifiers | `standings.py` over current result rows + snapshot tiebreakers (+ latest approved override) | a stored table, the old `standings_publication` snapshot |
| Played (tournaments) | recompute over current result versions via `tournament_registration_members` | counters, closure attendance for scored matches |
| Won | closure report (closure addendum) | per-fixture wins |
| Schedule after publication | per-match edits under AD-9 | workbook schedule columns |

### 5.3 Sensitive fields
Workbooks carry names next to registration IDs for usability; files are generated on demand and never stored (AD-17: parsed payload only, file hash kept). Points are hidden from non-committee views. Correction reasons are free text: logged by id and length, shown to committee and affected players only. No new data leaves the system; no AI call exists in this flow.

### 5.4 Workbook schemas (versioned; the locked header carries the version; a mismatch is `WORKBOOK_STALE`)
- **Points workbook v1:** Roster sheet as AD-S2.
- **Scoring workbook v1:** Group and Knockout sheets as AD-S4; exactly up to 3 sets this release (badminton best-of-3 ceiling; free scores within it, MS-03); extra non-empty set cells beyond a decided match are a row error only when they create a second derivable winner — otherwise stored as entered (MS-03 keeps domain rules out).

---

## 6. Security & Compliance Considerations

**Authorization (P15; every endpoint declares its rule; v2 denial 404):** table in §4. Explicitly denied: players and `invited` committee members on every upload/generate/correction path; the maker approving their own flip, override or clear; admin acting as committee (existing rule).

**Threats and controls**
- Rigged seeding or bracket: points are organizer-supplied by design (owner decision), but the structure is locked — the engine places players, pairing is fixed, exchange-set policy in `fixture_core` blocks cross-band swaps, and the fairness validator runs on every draft. The points file is visible to the whole committee (download reflects the stored set).
- Result tampering: append-only log, single-member entry logged, flips/overrides/clears maker-checker, downstream guard, derived winners only.
- Hostile workbooks: AD-17 inherited in full (xlsx-only with magic bytes, values-only read, no formula evaluation, ZIP/XML bombs bounded, size/row caps, `= + - @` neutralised both ways, all-or-nothing).
- Stale-file race: payload-hash header binding (`WORKBOOK_STALE`); uploads serialised under the tournament advisory lock (existing ordering, no new lock pairs).
- Abuse by volume: existing route rate limits (P17) + upload size/row caps.
- PDPA: no new cross-border flow (no AI call); workbooks add no new data category.

---

## 7. Configuration (`app_config`, P1; validated at startup)

| Key | Default | Bounds |
|---|---|---|
| `meetup.tournament.points_upload.max_bytes` / `.max_rows` | 1048576 / 512 | 65536–5242880 / 8–1024 |
| `meetup.tournament.scoring_upload.max_bytes` / `.max_rows` | 2097152 / 1024 | 65536–5242880 / 8–4096 |
| `meetup.tournament.points_min` / `points_max` | "0" / "100000" | decimal strings, max > min |
| `meetup.tournament.fixture_engine.enabled` | existing key; flipped on in phase S4 | boolean |

Format-spec values (group thresholds, qualifiers, tiebreak order) live in the template definition, not config (AD-S1). All keys editable in the admin settings interface (owner principle 2026-10-19).

---

## 8. Observability & Operability

- Correlation id on every upload, generation, correction and approval, through to result rows and notifications (existing pattern).
- Metrics (log-line counters): `tournament_points_upload_total{outcome}`, `tournament_generate_total{outcome}`, `tournament_results_upload_total{outcome}` with row counts, `tournament_result_flip_total{outcome}`, `tournament_qualification_override_total`, `tournament_clear_result_total`, generation duration and search nodes (library stats).
- SLOs: generation p95 < 3 s to 64 entrants (existing bar); results upload p95 < 5 s at 1024 rows.
- Security-event stream: denied correction/override/clear attempts, maker-approves-own refusals, workbook rejections by reason class.
- Runbooks: stale workbook storm (re-download), frozen-fixture regeneration request (explain MS-17; a truly broken bracket is dissolve-and-recreate, existing action), unresolved group tie (override flow).
- Rollback: `fixture_engine.enabled` false hides generation; uploaded data is kept; migrations additive, forward-only.

---

## 9. Test Requirements (P13)

Risk: results upload and derivation **High**; flip/override/clear approvals **High**; standings/tiebreakers **High** (property-tested); points round-trip **Medium-High**; adapter mapping **Medium-High**; workbooks export **Medium**; notifications **Medium**. Library-level tests live in DES-FIXTURE-CORE-001 §8 (FT-20/FT-21 added at v1.4) and are not repeated.

| # | Test |
|---|---|
| S-T1 | Every new endpoint called by a player, an `invited` member, a non-member and anonymous → 404/401/403 per rule; guessed ids included (P15/P13). |
| S-T2 | Points: missing or extra registration row, duplicate, non-numeric/negative/out-of-bounds points, edited locked cells, oversize, non-xlsx, formula cells → 422 row reasons, nothing stored; blank points accepted; re-upload replaces; upload after generation → `POINTS_LOCKED`. |
| S-T3 | Generation: without points → 409; <6 entrants → library `FORMAT_GROUP_TOO_SMALL`; organizer-chosen smaller group count honoured, larger refused; determinism (same seed ⇒ identical payload_hash); adapter round-trip Fixture↔DraftPayload; publication unchanged (maker-checker, stale on re-generate); regenerate after first result → `FIXTURE_FROZEN`. |
| S-T4 | Pairing property (adapter level, on top of FT-20): for every (g,k) in {2,4,8}×{1,2} with g·k≥4, no two qualifiers of one group can meet before the final. |
| S-T5 | Scoring upload: unknown match id, unresolved side, negative/non-integer set, tied set, Normal row with no derivable winner, WO with set scores, WO/RET without advancing side, >3 sets with two derivable winners → 422 row reasons, nothing posted; valid rows post results, derive winners, fill next slots one hop; re-upload with unchanged rows is a no-op; stale header → `WORKBOOK_STALE`. |
| S-T6 | A row flipping a winner or changing WO/RET → `CORRECTION_NEEDS_APPROVAL`, nothing posted; score-only changed row posts a new version with reason. |
| S-T7 | Flip flow: maker approves own → 403; approval while downstream played → `DOWNSTREAM_PLAYED` (winner and loser paths); clear-result voids, reopens slot, is itself maker-checker and logged; then flip approval replaces the slot and notifies; pending flip leaves the original in force. |
| S-T8 | WO/RET counting: standings give the advancing side the win with zero set/point credit (WO) and played-sets-only credit (RET); Played +1 advancing side only; the other side's history shows the loss; byes excluded. |
| S-T9 | Tiebreakers: table tests for 2-way H2H; 3-way resolved by set diff; 3-way where set diff reduces to 2 → H2H reapplied; all-equal → group flagged, slots open, override required; override needs reason + different-member approval and surfaces "adjusted by committee"; equal-count guard asserted. |
| S-T10 | Qualification: group completion auto-resolves `group_place` slots in the same transaction; incomplete group or pending override resolves nothing. |
| S-T11 | Stats: Played recomputes across post, correction, flip and clear (never drifts); Won unchanged until closure; closure report pre-fills winner/runner-up from the final and stays editable. |
| S-T12 | Notifications: result posted to both sides; advancement names the opponent only when both known; corrected/cleared notifies affected sides; score-only correction sends nothing; every string from `ui_labels` (static check), grouped section present in admin. |
| S-T13 | Visibility: any tournament viewer reads scores and standings; non-viewer 404; personal record endpoint stays owner-only (TL-34 regression). |
| S-T14 | Workbook exports: names starting `= + - @` neutralised; locked cells locked; header hash present; v1 tournaments and non-groups-knockout v2 tournaments get 409/404 on the new routes. |
| S-T15 | Concurrency: two simultaneous results uploads serialise under the tournament lock with no corrupt chain; lock ordering unchanged (no new lock pairs). |

---

## 10. Implementation Phases

**Sequencing (owner):** build starts **after the current app release**. **Prerequisites and in-scope substrate (v1.1):** lifecycle Release 1 phases 4 (registration freeze — `tournament_registration_members`) and 5 (committee v2 — `fixture_publication`, action machinery) are built as tasks of this release (ms-p4, ms-p5; no fixture-core dependency). The lifecycle 6a/7 substrate this design relies on is built here too (S2a, S3a), to lifecycle AD-10 / §5.1 as the specification. Lifecycle phase 8 (reminders) stays out of scope. `fixture_core` v1.4, consumed as a rebuilt vendored wheel from a sadhana release tag, precedes S2.

| Phase | Content | Acceptance |
|---|---|---|
| S0 | BP-01 verification: live CHECKs (result kinds, action types, notification types), fixture columns, label sections; record in report | **Done 2026-10-22** (`docs/reports/ms-s0-verification-and-blocked-report.md`); the human re-verifies the two CHECK constraint names against the live catalog before running those migrations |
| ms-p4 / ms-p5 | Lifecycle phases 4 and 5 per the lifecycle addendum (AD-6, AD-7; tests 5–11) | **Done 2026-10-22** (merged `39bf522`; report `docs/reports/ms-p45-report.md`; rulings ratified at v1.2; migrations pending the human) |
| S1 | `fixture_core` v1.4 in Sadhana (pairing revision 2, `suggest_group_count`, min sizes) — separate dispatch per its own doc; release tag cut, wheel re-vendored | FT-20, FT-21 |
| S2a (v1.1) | Draft + publication substrate: `tournament_fixture_drafts` (engine source only), `fixture_publication` flow binding `{draft_id, payload_hash}`, materialisation into `tournament_fixtures` including the new advancement columns | drafts never leak into `tournament_fixtures` without an executed approval; test 10 of lifecycle §9 |
| S2 | Points round-trip + generation adapter + publication wiring (backend/web) | S-T1–S-T4, S-T15 |
| S3a (v1.1) | Results substrate to lifecycle AD-10: `tournament_match_results`, `result_service`/`result_validator` (structural parts: append-only log, projection, one-hop advancement over the links, `DOWNSTREAM_PLAYED`) | lifecycle tests 17–19 structural parts |
| S3 | Scoring workbook, results upload, derivation, corrections/flips/overrides/clears, standings, qualification | S-T5–S-T10, S-T13, S-T14 |
| S4 | Notifications, stats recompute, closure pre-fill, mobile read views (scores, standings, bracket), flip `fixture_engine.enabled` | S-T11, S-T12; owner walkthrough |

Standing rules apply: migrations human-run one at a time; briefs split per repo (backend/web vs mobile); agents compile/import-check only, the owner runs pytest once at the end; implementation reports written back here (BP-13).

---

## 11. Principles & Best-Practices Compliance

| Item | Design element | Status |
|---|---|---|
| P1 | §7 keys admin-managed; format spec in template data; labels in `ui_labels` | Met |
| P5 | Idempotent uploads (hash-bound, no-op rows), existing decision keys | Met |
| P6 | Append-only results incl. voiding versions; overrides immutable; reasons logged | Met |
| P8 | Seeded deterministic generation, pinned library release, golden tests | Met |
| P9 | Workbook schemas, row reason codes, neutralisation both directions | Met |
| P12 | No new retention surface (files not stored); existing OI-6 unchanged | Met |
| P13/P15 | §9 negative tests per declared rule | Met |
| P14 | Additive CHECKs, columns, endpoints, template schema bump | Met |
| BP-01/BP-03/BP-13 | S0 verification; consistency grep done on this draft; phase reports | Planned/Met |
| BP-10 | Gated deferrals in §12 | Met |
| BP-11 | Flip/override intent binds fixture+payload; evidence is the stored result chain | Met |
| BP-12 | No new service, queue or rules engine | Met |

**Deviations from prior approved designs (not from the governing files), flagged:**

| # | Deviation | From | Rationale and gate |
|---|---|---|---|
| D-S1 | No badminton rule validation of set scores (free non-negative integers, untied) | Lifecycle AD-10 `sets` validator rules; canvas boards | Owner decision 2026-10-22 (community formats vary). Gate (BP-10): rule validation returns as format-spec parameters when the owner enables it or after the first disputed impossible score. |
| D-S2 | Fixed cross-group pairing instead of BWF-style draw-by-lot placement | BWF Olympic regulations (research reference, not a governing file) | Locked feeder links (owner decision); same-group separation guaranteed to the final; recorded for transparency. |
| D-S3 | Group standings live, no two-person publication | Lifecycle TL-20/TL-35 scope `group` | Owner decision (MS-12); judgment actions keep maker-checker (AD-S6/AD-S7). Gate to revisit: a disputed auto-qualification incident. |

---

## 12. Open Items

| ID | Item | Severity | Blocking |
|---|---|---|---|
| OI-S1 | Owner said more group-stage details may follow before build (2026-10-22). Defaults in MS-15/MS-23 stand until then; a change amends by version. | 🟡 MEDIUM | No (S2 gate) |
| OI-S2 | Deferred: in-app result entry screens (canvas end state). Gate: owner request, or two organizer complaints about the Excel flow within 60 days of first use. | 🟢 LOW | No |
| OI-S3 | Deferred: standalone knockout and round robin for tournaments. Gate: one real tournament request per format. | 🟢 LOW | No |
| OI-S4 | Deferred: badminton rule validation and per-tournament scoring parameters (D-S1 gate). | 🟢 LOW | No |
| OI-S5 | **Revised at v1.1:** phases 4–5 and the 6a/7 substrate are now in-scope tasks of this release (ms-p4/ms-p5, S2a/S3a), so nothing waits on a Release 1 restart. Residual: `fixture_core` v1.4 release tag (dispatch D, Sadhana) must exist before S2. | 🟠 HIGH | Blocks S2, not approval |
| OI-S6 | Canvas boards for the workbook flow and corrected walkover note: redraw only on the owner's explicit confirmation (standing instruction). | 🟢 LOW | No |

---

## 13. Approval Record

**v1.0 APPROVED by the owner, 2026-10-22.** Approval was given in conversation ahead of drafting ("Generate the design with status as approved"), after the elicitation of 2026-10-22 closed every open question; the full-history sweep and its three reconciliations (process note 2) are part of this version. Companion `DES-FIXTURE-CORE-001` v1.4 approved the same day.

**v1.1 (2026-10-22), architect amendment after the ms-s0 Blocked Report; amends the approved v1.0, no requirement changed.** Changes (BP-13):

| ID | Change | Section |
|---|---|---|
| C1 | Valid HIGH finding accepted: lifecycle phases 6a and 7 were never built; v1.0's "existing/unchanged" wording for `result_service`, `tournament_match_results` and the `tournament_fixtures` advancement columns was drift. This release builds that substrate itself, to lifecycle AD-10 / §5.1 as the specification (tasks S2a, S3a); lifecycle 6a's Excel fixture-import parser is explicitly **not** built (already superseded for groups+knockout, §2). | notes, §4, §5.1, §10 |
| C2 | As-built corrections from ms-s0: the notification-type list is `chk_notification_preferences_type` on `notification_preferences` (not a `notifications` CHECK); `ui_labels` grouping is key-prefix based in the admin editor; the fixture-core pin is a rebuilt vendored wheel, with tag name + tag-object SHA + commit SHA recorded in `vendor/fixture_core.SOURCE.txt`. | AD-S3, AD-S8, §5.1 |
| C3 | Reminder-row updates on result posting are gated on lifecycle phase 8 existing (not built, out of scope); posting must not depend on it. | AD-S4 |
| C4 | §10 task table restated: ms-p4/ms-p5, S2a, S3a added; S0 marked done; OI-S5 revised (residual blocker = the fixture-core v1.4 release tag, dispatch D). | §10, §12 |

**v1.2 (2026-10-22), architect ratification after the ms-p45 build (merged to main at `39bf522`; architect review of the branch passed: maker-checker enforcement, migration self-verification, grants and the OI-5 boundary spot-checked).** The ms-p45 report's nine Proposed Assumptions (R1–R9: member-row shape with surrogate id and `role` default `player`; DELETE grant for roster replacement; the roster-change route, actors and AD-4 invite rule on added members; NULL cut-off v2 rows refused with 409; `fixture_publication` decision target = tournament_id; `otp_hash` NULL in v2; S2a publication ports with 409 until registered; v1 side effects kept on v2 registration; DB-clock boundary testing) and deviations D-1 to D-4 are **ratified as normative**; the report text (`docs/reports/ms-p45-report.md`) is the authoritative wording. New rulings for S2a: register the fixture-publication ports and call `require_min_active_committee` on draft generation (report gap 6), and add a clean 400 guard rejecting step-up challenge requests for v2-only action types (report gap 4). ms-p4/ms-p5 are **done** in §10. Two migrations await the human (`1748c8917ab3`, then `83db8f5d1092`, one at a time; the second self-verifies the live CHECK name). No requirement changed.
