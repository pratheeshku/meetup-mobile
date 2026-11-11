# DES-MEETUP-ADDENDUM-TEAM-SIZE-CAPACITY

**Doc ID:** DES-MEETUP-ADDENDUM-TEAM-SIZE-CAPACITY
**Version:** v1.1
**Status:** **APPROVED by the owner, 2026-11-11** (instruction in conversation: "for addendums, please mark the design as approved", given after the v1.0 draft and the fixture review that produced v1.1). Approval covers sections 1 to 11 as written, which settles OI-2 (limits 128 and 11) and OI-3 (a registered user's actionable status is `null`) as proposed. Open items are in section 9.
**Owner:** Pratheesh
**Date:** 2026-11-11
**Scale Tier:** T1
**Baseline:** `pratheeshku/meetup` `main`, architect sandbox clone at `0393e52` (behind `main` by the Task 1.8 web-only merge; none of the backend files cited here changed in it, re-verified in Phase 1) and `pratheeshku/meetup-mobile` `main` @ `0a63c74`. Production data read 2026-11-11 (Tournament PAT: `team_size_min` 1, `team_size_max` 1, `entrants_max` 32).
**Governing files:** `Enterprise_Design_Principles.md` v1.1 (P1-P17) and `design-best-practices.md` v1.0 (BP-01-BP-13). Both read in full from the Project knowledge base before drafting (Phase 1.5 gate passed). One deliberate deviation from P6 is recorded in AD-6 (D-1).
**v1.1 amendment (2026-11-11):** architect amendment after the owner's request to review the code and make sure fixtures work for teams the same way as for individuals, with the team name shown. The review found that fixtures already treat each registration as one entrant and already show the team name, so AD-7 no longer changes the fixture adapter. It withdraws a wrong statement of v1.0 (process note 5). No requirement changed.
**Depends on:** `DES-MEETUP-ADDENDUM-tournament-lifecycle` v1.4 (AD-3 templates, AD-6 snapshot), `-tournament-experience` (AD-T3), `-tournament-edit-recurring` v1.13 (AD-3 edit window, AD-6 fixture reset), `-tournament-registration` v1.3 (AD-3 register accepts an invitation), `-teams-payments` v1.2 (AD-4 player-created teams), `DES-FIXTURE-CORE-001` v1.4 (library 0.2.0).
**Amends (pointer at each document's next revision):** tournament-edit-recurring AD-3 ("capacity ... stay immutable" is replaced by AD-5 here); tournament-experience AD-T3 ("the wizard sends no overrides" is replaced by AD-3 and AD-4 here).

**Process notes (flagged):**
1. No `REQ-MEETUP` document exists for this batch. The owner's statements of 2026-11-11 are restated as `TS-01..TS-06` in section 1.
2. **Corrections to statements I made in conversation today.** (a) I said the wizard lets the organizer set capacity within the template range. It does not: the seeded template lists no `organizer_overrides`, and the mobile wizard sends none, so no organizer can change capacity or team size. (b) I proposed a team-size **range** (min and max) and then said the fixture library forced a single size. That second statement is withdrawn (note 5). This design still offers **one** team size N, on fairness and simplicity grounds (AD-2).
3. **The owner recalled that the organizer can edit "any field".** The approved record says otherwise (edit-recurring A49: participation mode, format, sport, template and capacity immutable) and nothing in notes or past chats records a decision to lift it. The owner agreed on 2026-11-11 to the architect's proposal: lift it for capacity and team size, and keep sport and participation mode locked once the first registration exists. Visibility and the template stay locked (AD-5).
4. Code facts below were read on 2026-11-11 and replace conversation assumptions. Mobile and web screen facts are checked in Phase 1 of the client tasks.
5. **Correction (v1.1).** v1.0 said fixture generation is hard-wired to singles-shaped entrants and needs team entrants built from the registration members. That reading was wrong about the consequence. `adapter.build_roster` makes one entrant per **registration**, whether the registration is a person or a team, and the library never sees team size. Names are resolved afterwards from the registration (`result_service.load_names`: team name for a team registration; `points_io.RosterRow.display`: team name). Nothing in generation, shuffle, scoring or standings gates on participation mode or team size.
---

## 1. Executive Summary

Two defects reported on 2026-11-11 (owner's own registration in Tournament PAT), plus the gap behind the second one.

1. **A registered user still sees "You're invited" with Register and Decline.** Registering as an individual accepts the user's pending invitation in the same transaction. Registering a team does not, so the invitation stays `pending` and the banner stays. Every other member of the team has the same stale banner. The fix is server-side (AD-1).
2. **A team of 2 cannot register.** Team size is not an organizer choice. A tournament takes its team size from the format template at creation, and the default template is singles (1 to 1), with no organizer override. The creation wizard has no team size field. The organizer must be able to choose team size and capacity at creation, and to edit them later (AD-2 to AD-5).

Fixtures need no change for teams: each registration is one entrant and the team name is what is shown (AD-7). A regression test proves it for a team size above 1.

## 2. Requirements (restated from the owner's words, 2026-11-11)

| ID | Requirement |
|---|---|
| TS-01 | A user who has registered, alone or in a team, or who belongs to a registered team, never sees an actionable invitation (Register or Decline) for that tournament. |
| TS-02 | The organizer decides the team size of a team tournament at creation. |
| TS-03 | The organizer decides the capacity (maximum entrants) at creation. |
| TS-04 | The organizer can edit tournament fields until the tournament starts. Sport and participation mode stay locked once the first registration exists (owner-confirmed). |
| TS-05 | Capacity and team size are editable under guards that protect existing registrations. |
| TS-06 | Fixtures for a team tournament work exactly as for individuals, with the team as the entrant and the team name shown. |

## 3. Scope and Constraints

- In scope: version-2 tournaments (`lifecycle_version` 2). Version-1 tournaments are unchanged.
- Out of scope: committee editing of tournament details (edit-recurring OI-5 stands), a team-size range, visibility edits, template editing UI in admin (templates stay published by script), payment and fee rules.
- Constraints: P14 additive-only API changes (older mobile builds in the field must keep working); P9 server-side validation of every new field; P15 shift-left authorization on every edit; no new RLS, DB triggers or DB-side validation (project hard rule); runtime values in admin config, never by hand in the DB.

## 4. Architecture Decisions

**AD-1 The server decides the actionable invitation (TS-01).**
- The tournament response field `my_invitation_status` becomes the **actionable** status: `pending` is returned only while the caller has no active registration (as an entrant or as an active member of a registered team). Otherwise it is `null`. The rule is applied where the response is assembled, **not** inside `invitations.my_invitation_status`, because the view rule (`has_visibility_invitation`) shares that function and must not change.
- Registering a team accepts the **registering actor's** pending, unexpired invitation in the same transaction, the same rule as individual registration (registration AD-3, D-6).
- On invite-only tournaments the actor's pending, unexpired invitation counts as registrable in the team leg, as it already does in the individual leg. Other members still need an accepted invitation (unchanged) and are **not** accepted on their behalf.
- No client computes this. Web and mobile render what the server returns (mobile hard rule: never recompute what the backend returns). Existing stuck users (like the owner in Tournament PAT) are fixed by the response rule with no data change.

**AD-2 One team size, exact (TS-02).**
- A team tournament has one team size N. It is stored as `team_size_min = team_size_max = N` in the snapshot. A tournament where teams differ in size is not a fair contest and every screen needs one number, so a range is not offered.
- Individual tournaments carry 1 and 1 and the wizard shows no team size.
- Registration keeps enforcing the bounds it already enforces (`_validate_team_size`); with min equal to max this is an exact-size check, with the existing refusal text and code `TEAM_SIZE_INVALID`.

**AD-3 Template and limits (TS-02, TS-03).**
- A new version of the default template is published (script, owner-run; the previous version is retired). It carries `organizer_overrides` for `entrants_max` (6 to 128) and for `team_size_min` and `team_size_max` (each 1 to 11), and absolute bounds that contain them. The override mechanism and `resolve_snapshot` already exist and are reused unchanged.
- The limits 128 and 11 are proposals (OI-2). 128 is the largest entrant count the fixture library was exercised at (edit-recurring AD-1 note and its OI-3 gate). 11 is football.
- Existing tournaments keep the template version pinned in their snapshot. Changing the template or the default slug in admin never changes an existing tournament (immutable snapshot, lifecycle AD-6).
- Two admin config keys (P1) hold the defaults used when a client sends no value: `meetup.tournament.default_entrants_max` (32, today's value) and `meetup.tournament.default_team_size` (1, today's value). Both are also returned to clients so the wizard can prefill. Older clients that send no overrides keep creating exactly what they create today (P14).

**AD-4 Create contract (TS-02, TS-03).**
- The create body already accepts `overrides`. The wizards now send `entrants_max`, `team_size_min` and `team_size_max`. Server validation (P9): integers only, inside the template's override limits (`OVERRIDE_OUTSIDE_LIMITS`), `entrants_max` not below the template's `entrants_min`, and in team mode `team_size_min` equal to `team_size_max` (422 `TEAM_SIZE_INVALID`). In individual mode any team size other than 1 is refused with the same code.
- Omitted values fall back to the AD-3 config defaults.

**AD-5 Edit rules for version-2 tournaments (TS-04, TS-05).** Window and actors are unchanged from edit-recurring AD-3: the organizer (and admin override), from creation until `starts_at` by the database clock; 409 `TOURNAMENT_STARTED` at and after the start; 409 `TOURNAMENT_HAS_RESULTS` once a result exists; nothing after the tournament has ended.

| Field | Rule |
|---|---|
| Title, description, dates, soft block, hard block, venue, fee, payee number, audience groups | As today (edit-recurring AD-3, registration-fee, teams-payments). |
| **Capacity** (`entrants_max`) | New. Editable until the start. New value must be at least the number of registered entrants, at least the template `entrants_min`, and inside the template limit. Below the registered count: 409 `CAPACITY_BELOW_REGISTERED` with the count. Replaces the current rule "never once any registration exists". |
| **Team size** | New. Editable only while the tournament has **no registration**. Otherwise 409 `TEAM_SIZE_LOCKED`. Individual tournaments have none. |
| **Participation mode** | New. Editable only while there is **no registration**. Otherwise 409 `FIELD_LOCKED_AFTER_REGISTRATION`. Switching to individual sets team size 1; switching to team requires a team size in the same request (or the AD-3 default). |
| **Sport** | New. Editable only while there is **no registration**. The venue check is re-run for the new sport and the change is notified (`tournament_updated`). Otherwise 409 `FIELD_LOCKED_AFTER_REGISTRATION`. |
| Visibility | Stays locked. Widening or narrowing the audience after people were invited or registered changes who may see the tournament. Not requested. |
| Format and template | Stay locked (R-210). Capacity and team size are the only snapshot values an organizer can amend (AD-6). |

Why team size locks at the first registration: every registered team has exactly the old size, so any new size would invalidate all of them. A rule that lets the organizer change it and then fixes up teams one by one is more machinery than the case justifies (BP-12). The committee can already remove a registration (edit-recurring AD-5) if the organizer genuinely needs to restart.

A capacity or sport or mode change resets existing draft or published fixtures by the existing reset rule (edit-recurring AD-6), because group counts and entrant sets depend on them.

**AD-6 Snapshot amendment and deviation D-1 from P6.**
- The rules snapshot stays pinned to its template and version. One sanctioned amendment path may change exactly three keys inside `definition` (`entrants_max`, `team_size_min`, `team_size_max`) and mirrors `capacity` from `entrants_max`. Every other key stays unchangeable.
- **D-1 (deliberate deviation from `Enterprise_Design_Principles.md` P6, "never update"):** the snapshot is updated in place for these three keys. Rationale: they are organizer-owned parameters whose later change is an explicit requirement (TS-04, TS-05); registration and fixtures read them from the snapshot (`_entrants_max`, `_team_size_bounds`), so a parallel store would create two sources of truth (BP-09). Mitigation: every amendment appends old value, new value, actor and correlation ID to the existing append-only tournament edit log (edit-recurring AD-3, P6), so the creation-time values and the whole history stay recoverable. No new table or column.
- Rationale for not adding an "organizer amendments" table: it needs a migration and a merge rule for readers, for three integers. Revisit if more snapshot keys become editable (BP-10 trigger: a fourth amendable key).

**AD-7 Fixtures for team tournaments (TS-06).**
- Fixtures, shuffle, scoring and standings treat each **registration** as one entrant. For a team registration the entrant is the team, shown by the **team name** in the points workbook, the fixture list, the matches and the standings, exactly as an individual is shown by the player's name. Team size has no effect on any of them.
- **No code change** to the fixture adapter, the engine or the scoring path. The roster stays singles-shaped as the library defines it.
- **Test requirement (P13):** one regression test per layer for a team tournament with team size 2 (and one with 3): points entry shows team names, a draft generates, shuffle again works, the draft publishes, a result posts, standings list team names. If any step shows a member name instead of the team name, or fails on team size, it is raised as a blocked report.
- Not in scope: showing the team's players inside a match card. If wanted, it is a separate request.

**AD-8 Client screens (TS-02 to TS-05).**
- Creation wizard (web and mobile): "Maximum participants" always; "Players per team" only in team mode; both prefilled from the AD-3 defaults the server returns; client range checks are UX only (the server decides).
- Edit screen: the same fields, shown read-only with a plain explanation when the server would refuse them (registration exists, started). The server's refusal text and code are displayed, not re-derived.
- The invitation banner needs no client change (AD-1). The participants block label "1 team players" is replaced by the team's player count from the server.
- **UI work needs a board** (project hard rule). No board exists for these fields. The architect produces the boards after the owner approves this document; no client brief is issued before then (OI-1).

## 5. Component and Integration Design (what changes where)

| Area | Change |
|---|---|
| `tournaments/registration_v2.py` | Team leg accepts the actor's pending invitation; actor's pending counts as registrable in the invite-only team leg (AD-1). |
| Tournament read response assembly | `my_invitation_status` becomes the actionable status (AD-1). `invitations.my_invitation_status` and the view rule are unchanged. |
| Template publish script (owner-run) | New version of the default template with overrides (AD-3). |
| Admin config | Two new keys (AD-3), shown in the existing admin config screen. |
| Create contract | Validate and apply the three overrides (AD-4). |
| `tournaments/service.py` update path | Edit rules of AD-5 and the amendment path of AD-6, under the existing registration lock so a concurrent registration cannot slip past a "no registration" check. |
| Fixtures, engine, scoring | No change. Regression test for team size 2 and 3 (AD-7). |
| Web (`frontend/`) and mobile | Wizard and edit fields, error display (AD-8). |

No database migration is needed: the snapshot is JSON and `capacity` is an existing column. The template change is data, published by script.

## 6. Security and Compliance

- P15: the edit route keeps its organizer-only entry rule. The new fields add no new route. Committee members and other users are refused before any business logic.
- P13: API-level negative tests for each new refusal: non-organizer and committee member cannot edit capacity, team size, sport or mode; capacity below the registered count; team size after a registration; sport or mode after a registration; edit after the start; override outside the template limits; team size min different from max.
- P9: every new field is server-validated (type, range, whitelist). Client checks are UX only.
- No new personal data. No secrets. No change to who can view a tournament (visibility stays locked).

## 7. Observability and Operability

- P4: every amendment writes the edit log row (old, new, actor, correlation ID). Refusals use the existing coded-error stream.
- P6: see D-1 for the one deviation and its log-based mitigation.
- Rollout order matters: **publish the new template version first, then deploy the backend, then the web, then ship the apps.** A wizard that sends overrides before the template lists them is refused with `OVERRIDE_NOT_LISTED`. Older apps send no overrides and keep working (P14).
- Rollback: the previous template version can be made active again; tournaments already created keep their snapshot either way.

## 8. Risks and Mitigations

| ID | Risk | Rating | Mitigation |
|---|---|---|---|
| R-1 | A path that shows a member name instead of the team name was missed in the review | 🟢 LOW | AD-7 regression tests for team size 2 and 3 across workbook, fixtures, matches and standings. |
| R-2 | A concurrent registration passes a "no registration" check while sport, mode or team size is being edited | 🟠 HIGH | Edit takes the existing registration lock; the check and the write are one transaction. |
| R-3 | Capacity above 128 untested by the fixture library | 🟡 MEDIUM | Template limit 128 (OI-2). |
| R-4 | Wizard deployed before the template is published | 🟡 MEDIUM | Rollout order in section 7; the 422 names the missing override. |
| R-5 | Sport edit before the first registration leaves a venue that does not fit | 🟡 MEDIUM | Venue check re-run for the new sport; refused if it fails. |
| R-6 | The snapshot is edited in place (D-1) | 🟡 MEDIUM | Append-only log holds old and new values; only three keys can change. |
| R-7 | Capacity lowered while fixtures exist resets them | 🟢 LOW | Existing reset rule; the organizer sees the existing "fixtures reset" notice. |

## 9. Open Items

| ID | Item | Owner | Needed before |
|---|---|---|---|
| OI-1 | Boards for the wizard fields and the edit screen (web and mobile), produced by the architect after approval | Architect | Client tasks |
| OI-2 | Limits: capacity 6 to 128, team size 1 to 11 | Owner | **Closed 2026-11-11**, approved as proposed |
| OI-3 | A registered user's actionable status is `null` (no "You're invited" pill) | Owner | **Closed 2026-11-11**, approved as proposed |
| OI-4 | Existing tournament Tournament PAT keeps team size 1 (snapshot unchanged). The owner recreates it to test teams of 2. | Owner | Device check |

## 10. Requirements Coverage

| Requirement | Decision |
|---|---|
| TS-01 | AD-1 |
| TS-02 | AD-2, AD-3, AD-4, AD-8 |
| TS-03 | AD-3, AD-4, AD-8 |
| TS-04 | AD-5, AD-6 |
| TS-05 | AD-5, AD-6 |
| TS-06 | AD-7 |

## 11. Deviations from the Governing Files

- **D-1:** `Enterprise_Design_Principles.md` P6 (append-only decision context): three snapshot keys are updated in place. Rationale and mitigation in AD-6. No deviation from `design-best-practices.md`.

## 12. Changelog

| Version | Date | Change |
|---|---|---|
| 1.1 | 2026-11-11 | Approved by the owner. Fixture review (AD-7): fixtures already treat each registration as one entrant and show the team name, so the adapter change is dropped and replaced by a regression-test requirement; R-1 downgraded to LOW; the library argument for a single team size is withdrawn (AD-2, process notes 2 and 5); OI-2 and OI-3 settled as proposed. No requirement changed. |
| 1.0 | 2026-11-11 | First draft. Fixes the stale invitation after team registration (AD-1), adds organizer choice of team size and capacity at creation (AD-2 to AD-4), edit rules (AD-5, AD-6), team fixtures (AD-7), client scope (AD-8). |
