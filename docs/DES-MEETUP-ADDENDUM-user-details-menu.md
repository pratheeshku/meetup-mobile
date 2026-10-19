# DES-MEETUP-ADDENDUM-USER-DETAILS-MENU

**Doc ID:** DES-MEETUP-ADDENDUM-USER-DETAILS-MENU
**Version:** v1.0
**Status:** APPROVED by the owner, 2026-10-19, on his instruction after requirements elicitation. Non-blocking defaults in section 12 are accepted with it. UI build (phases 3 and 4) is gated on a board (OI-6).
**Owner:** Pratheesh
**Date:** 2026-10-19
**Scale Tier:** T1
**Baseline:** repos `pratheeshku/meetup` and `pratheeshku/meetup-mobile`, `main` (code read 2026-10-19). Design-only addendum. Does not edit the baseline or other addenda.
**Governing files:** `Enterprise_Design_Principles.md` v1.1 (P1-P17), `design-best-practices.md` v1.0 (BP-01-BP-13). Both read in full before drafting.
**Depends on:** `DES-MEETUP-ADDENDUM-access-consistency` v1.5 (AD-1 view predicates, AD-8 refetch rule, AC-11 404 on denial); `DES-MEETUP-ADDENDUM-tournament-lifecycle` v1.3 (committee, blocks, two-person approval).
**Supersedes:** the mobile long-press member card of PR #39 (docs/mockups/group-view/2-long-press-member.png: details and actions on one card). Its behaviour becomes the "View Details" view plus a menu (D-1).

**Process notes (flagged, not silent)**
1. No `REQ-MEETUP` addendum exists for this feature. Requirements were stated by the owner in conversation on 2026-10-19 and are restated in section 1 (`UM-01` to `UM-10`), approved with this document. Same departure as the lifecycle, venue and access addenda.
2. `solution-design` references `PRINCIPLES.md` P1-P23. The authoritative file is `Enterprise_Design_Principles.md` v1.1 (P1-P17). P1-P17 are used.
3. BP-01 limit: the role matrix (AD-3) and the list of tap points (section 4.3) are drawn from the code read on 2026-10-19 and from the approved addenda, not from a full audit. Phase 1 (`ud-p1-verify`) re-verifies every claim; where code and this document disagree the agent reports and stops. It does not invent.

---

## Plain-language summary

Everywhere a person's picture or name appears (groups, games, tournaments, invite lists), long-pressing it on mobile, or clicking it on web, opens the same small menu. The first item is always **View Details**, which shows the picture, display name and nickname. Below it come only the actions the person looking is allowed to take on that user in that place: make admin, remove from group, remove player, and so on. A plain member sees View Details only.

All of this is one component per platform. Changing the design later means editing that one component, not every screen. Which actions appear is decided by the server, so the rules live in one place too.

---

## 1. Requirements (owner, 2026-10-19; approved with this document)

| ID | Requirement |
|---|---|
| UM-01 | On every screen that shows a user (groups, games, tournaments, invite and search lists), long-press (mobile) or click (web) on the picture, icon or name opens one menu. |
| UM-02 | The menu's first item is always **View Details**, which shows picture, display name and nickname. |
| UM-03 | Below it, the menu lists only the actions the viewer may take on that user in that context. The viewer's role in the context decides (owner, admin, organizer, committee, member). A member sees View Details only. |
| UM-04 | Implemented once per platform as a reusable component. Every call site uses it. No screen builds its own menu or details view. |
| UM-05 | Every new label is managed through the admin label store (no maker/checker, immediate effect). |
| UM-06 | A plain tap on mobile keeps today's behaviour on each screen. On web the click opens the menu. |
| UM-07 | The viewer's own avatar and name show details only, no actions. |
| UM-08 | Actions that need two-person approval (tournament committee changes, disqualification after the hard block) raise a request. They never act immediately, and their labels say "Request ...". |
| UM-09 | The menu and details view show picture, display name and nickname only. No email, mobile number or other personal data. |
| UM-10 | The menu opens only for people the viewer can already see in that context (access-consistency AD-1). No access means no menu and no details. |

---

## 2. Scope & Constraints

**In scope:** a context-card read endpoint in each of `groups`, `events` and `tournaments`; a shared response schema in `core`; per-module `allowed_user_actions` policy functions; mobile `UserMenuSheet` plus hook; web `user-menu.js`; label keys and a label-seed migration (written, not run); migration of existing call sites.

**Out of scope**
- The admin console (React under `frontend/src/admin`): it has its own user lists and approval flows (OI-1).
- The viewer's own navigation avatars: `HomeTopBar` and `DrawerMenu` on mobile, the top-bar and drawer avatars on web (`avatarCircleHtml`). They keep their current behaviour (UM-07 covers in-list self avatars only).
- New actions. v1 exposes only actions that already have endpoints (matrix in AD-3).
- Chat or comments (none exist).

**Constraints**
- Modules have zero sibling imports (`AGENTS.md`). A central cross-module endpoint is therefore not allowed; each module serves its own context (AD-1).
- Authorisation lives in `policies.py` (P15). No RLS, DB triggers or DB-side validation.
- Migrations are written, never executed by agents. The owner runs them.
- Mobile may not invent endpoints or fields; this addendum is the contract (AD-2).
- Mobile: theme tokens only, no literal colours; UI must match a board (OI-6).
- Additive only (P14): no existing endpoint or field changes.

---

## 3. Architecture Decisions

**AD-1: One endpoint shape, served per module (UM-03, UM-10).**
- `GET /groups/{group_id}/members/{user_id}/card`
- `GET /events/{event_id}/players/{user_id}/card`
- `GET /tournaments/{tournament_id}/people/{user_id}/card`
- All three return the same schema `UserCardOut`, defined once in `core` (shared contract, P3). Each module implements its own rule in its own `policies.py`. This respects the zero-sibling-import rule and avoids a cross-module "users" endpoint.
- Rule for all three, declared in code (P15): the caller must pass the module's current view predicate for the context (access-consistency AD-1), and the target must have a current relationship in that context (group member; game organizer, player, waitlisted or invited; tournament organizer, committee, registrant, team member or invitee). Otherwise **404** (AC-11). No existence leak, no cross-context user lookup.
- Rate limited per authenticated user (P17), config `meetup.user_menu.rate_limit_per_minute`.

**AD-2: Contract (additive, P14).**
```
UserCardOut {
  user_id: UUID
  display_name: string
  nickname: string | null
  photo_url: string | null
  is_self: bool
  relation: string            // "owner" | "admin" | "member" | "organizer" | "committee" | "player" | "waitlisted" | "invited" | "registrant"
  allowed_actions: [ { key: string, requires_approval: bool } ]
}
```
- `allowed_actions[].key` is one of the closed set in AD-3. The client maps each key to a label key, icon and handler. An unknown key is ignored (forward compatible).
- No other user field is ever added to this schema without a design amendment (UM-09). A test asserts the exact key set.

**AD-3: Role matrix (UM-03, UM-07, UM-08).** `allowed_actions` is computed from the viewer's role and the target's relation. The viewer never gets actions on themselves or on the owner.

| Context | Viewer | Target relation | Actions (key) |
|---|---|---|---|
| group | owner | member | `make_admin`, `make_owner`, `remove_from_group` |
| group | owner | admin | `remove_admin`, `make_owner`, `remove_from_group` |
| group | admin | member | `make_admin`, `remove_from_group` |
| group | admin | admin or owner | none |
| group | member | any | none |
| game | organizer | player, waitlisted | `remove_player` |
| game | anyone else | any | none |
| tournament | organizer or committee, before hard block | registrant | `remove_from_tournament` |
| tournament | organizer or committee, after hard block | registrant | `request_disqualification` (requires_approval) |
| tournament | organizer or committee | committee member | `request_committee_remove` (requires_approval) |
| tournament | organizer or committee | non-committee registrant | `request_committee_add` (requires_approval) |
| tournament | anyone else | any | none |

- Every entry maps to an **existing** endpoint (group role change and remove: `groups/router.py` role and remove routes; organizer remove participant; tournament registration withdraw, disqualification request, committee request). Phase 1 verifies each mapping and each gate against the as-built policy. A row with no existing endpoint, or a gate that differs, is reported and held out of v1. It is not built on a guess.
- **Single source (BP-09):** `allowed_user_actions` must call the same policy functions the action endpoints call. The menu may never offer an action the endpoint would refuse. A parity test enforces it (UM-T9).
- The menu is UX. The action endpoint is the authority and re-checks on every call.

**AD-4: Reusable components, one per platform (UM-04).**
- **Mobile:** `UserMenuSheet` (menu plus details view) in `src/components/user/`, driven by hook `useUserMenu(context)`. The hook owns: opening, fetching `UserCardOut` on every open (never cached), the action registry (key to label, icon, tone, handler), the confirmation dialog, executing the action through the existing `src/api` functions, and an `onChanged` callback so the host screen refetches. Callers provide only `{ userId, identity (display name, nickname, photo from the row), context }` and wire `onLongPress`. `MemberActionCard` is absorbed into the details view and removed after migration; `UserAvatar` and `PersonNames` are reused. A helper `<UserPressable>` wraps avatar and name and attaches the long-press, so call sites cannot forget it.
- **Web:** `frontend/user-menu.js` (vanilla module, same pattern as `venue-picker.js`; the end-user web app is `frontend/app.js`, not React). Entry point `UserMenu.open({ userId, identity, context, anchor })`. A single delegated click listener handles any element carrying `data-um-user`, `data-um-ctx`, `data-um-ctx-id`. The shared avatar helpers (`avatarBubbleHtml`, `avatarStackHtml`) emit those attributes, so every avatar rendered through them is covered without touching each screen. Avatar elements become `role="button"` with `tabindex="0"`; Enter or Space opens the menu; Escape closes it. Inside a clickable card, the avatar click stops propagation so the card's own navigation does not fire (OI-3).
- Result: restyling or restructuring the menu is a change to one file per platform.

**AD-5: Fail-closed behaviour (UM-03, UM-10).**
- On open, the menu shows **View Details** immediately, from the identity already on the row, plus a loading state for actions. If the card request fails or times out, the menu stays at View Details only. Actions never appear on a guess.
- A 404 from the card endpoint (access lost, or the user left) closes the menu and shows the neutral "no longer available" notice already used by access-consistency AD-8. The host screen refetches.
- An action that the endpoint now refuses (race between menu open and tap) shows the server's message and refreshes the host screen. Nothing is cached across opens.
- Where the viewer has no context (invite search and suggested-player lists, where the person is not yet in any context of the viewer), the menu offers **View Details** from the row data and no actions, with no card request. Search results already expose display name, nickname and photo; nothing new is exposed (OI-5).

**AD-6: Labels (UM-05, P1).** All visible text is a label key in the admin label store (`ui_labels`), editable in the label editor with immediate effect. One label-seed migration is written per platform set (not run by agents). Keys (mobile `mob.user_menu.*`, web `web.user_menu.*`; existing `mob.group_detail.action_*` keys are reused where the wording is identical, no rename, P14):

| Area | Keys |
|---|---|
| Menu | `view_details`, `menu_a11y` |
| Details view | `details_title`, `no_nickname`, `close` |
| Actions | `make_admin`, `remove_admin`, `make_owner`, `remove_from_group`, `remove_player`, `remove_from_tournament`, `request_disqualification`, `request_committee_add`, `request_committee_remove` |
| Confirmations | `confirm_title`, `confirm_body_<action>` (each with `{name}`), `confirm_yes`, `confirm_cancel` |
| Outcomes | `action_done`, `action_failed`, `request_sent`, `not_available`, `card_load_failed` |

Wording follows the glossary: group member, player, team player, tournament, match. Mobile keys are added to `docs/label-inventory-mobile.json` and pass `npm run check:labels`; the terminology CI scan covers the new keys. Labels are display text only. They never decide which action appears (AD-3).

**AD-7: Own avatar and navigation avatars (UM-07).** `is_self` is returned by the server; the client also compares ids. When true, `allowed_actions` is empty and only View Details shows. Navigation avatars (top bar, drawer) are out of scope and unchanged.

**AD-8: Config (P1).** `meetup.user_menu.rate_limit_per_minute` (default 60, bounds 10-300). Validated at startup; missing or out of bounds is a hard failure. No feature flag on the access rule.

**Alternatives rejected**
- *One central `/users/{id}/card?context=...` endpoint.* Needs `users` to import `groups`, `events` and `tournaments`, which the module rule forbids; it would also tempt a context-free user lookup.
- *Compute actions in the client from role fields (as GroupDetailScreen does today).* Duplicates the rules per screen and per platform; the very drift this addendum removes.
- *Add `allowed_actions` to every list response.* Inflates large member lists and recomputes per row; one lookup on open is cheaper at T1 (BP-12).
- *Open details on long-press and put actions inside it (PR #39 behaviour).* The owner chose a menu with View Details first.
- *Cache the card.* Stale actions after a role change; the refetch-on-open rule (access-consistency AD-8) applies.

---

## 4. Component / Integration Design

### 4.1 Backend
| Component | Change |
|---|---|
| `core` | `UserCardOut` and `AllowedAction` schemas (shared contract). |
| `groups/policies.py`, `groups/router.py`, `groups/service.py` | `allowed_user_actions(group, viewer, target)`; card route. Reuses the role-change and removal policy functions. |
| `events/policies.py`, `events/router.py`, `events/service.py` | Same for games; reuses the organizer-remove rule. |
| `tournaments/policies.py`, `tournaments/router.py`, `tournaments/service.py` | Same for tournaments; reads the hard-block date and committee state; `requires_approval` mirrors the existing maker-checker paths. |
| Label seed migration | `mob.user_menu.*` and `web.user_menu.*` keys (additive, written not run). |

### 4.2 Clients
| Platform | Change |
|---|---|
| Mobile | `UserMenuSheet`, `useUserMenu`, `<UserPressable>`; migrate call sites; remove `MemberActionCard` and the inline `buildActions` logic in `GroupDetailScreen`. |
| Web | `user-menu.js`; avatar helpers emit the data attributes; delegated listener; styles in `app.css` using existing tokens. |

### 4.3 Expected tap points (to be confirmed by `ud-p1-verify`)
- **Mobile** (files that render `UserAvatar` or `PersonNames` today): `GroupDetailScreen` (3 sites, includes the existing long-press at ~line 652), `EventDetailScreen` (2), `InviteMembersScreen`, `CreateGameScreen`, `UserSearchPicker`, `TournamentInvitePanel`, `components/home/UnifiedCard`; also check `NotificationCard`, `TournamentDetailScreen`, `TournamentTeamsScreen` and the fixture and result screens for user names that carry no avatar today. Excluded: `HomeTopBar`, `DrawerMenu`.
- **Web** (`frontend/app.js`): `avatarBubbleHtml` (~:4021) and `avatarStackHtml` (~:4032) used by the home cards (`players_preview`, `members_preview`); the group, game and tournament detail renderers; invite and search results; committee and registrant lists. Excluded: `avatarCircleHtml` (~:3358) top bar and drawer, the profile page avatar.
- The agent returns the authoritative list with file and line for each site, and flags any screen that shows a user without an avatar or name element it can attach to.

---

## 5. Security & Compliance Considerations

| Control | Detail |
|---|---|
| Authorisation (P15) | Card endpoints enforce the module view predicate plus a current-relationship check at the entry point. Denied: 404. Declared per endpoint in `policies.py`. |
| Menu is UX, not authority | Each action endpoint keeps its own rule and re-checks. Parity test UM-T9 prevents drift. |
| No enumeration | The target must relate to the context; a user id from another context returns 404, indistinguishable from a nonexistent id. |
| Data minimisation (UM-09, PDPA) | Exactly six identity fields plus actions. No email, mobile number or other personal data; asserted by test. Fields are already visible in the same context lists. |
| Input validation (P9) | `user_id`, context ids are UUIDs validated server-side. |
| Rate limiting (P17) | Per authenticated user, configurable. |
| Tokens and logs | No new secrets. Display names and nicknames are not written to logs or metric labels (P4). |
| Two-person approval | Actions with `requires_approval` call the existing request endpoints; the menu never performs the approved action itself. |

---

## 6. Failure Modes & Resilience

| Scenario | Behaviour |
|---|---|
| Card request fails or is slow | View Details only; actions hidden; retry on next open. |
| Viewer lost access while the menu is open | Card 404 or action 404: menu closes, neutral notice, host screen refetches. |
| Role changed between open and tap | Action endpoint refuses; server message shown; host refreshes. |
| Unknown action key from a newer backend | Ignored by the client. |
| Backend deployed before clients | Old clients unaffected (new endpoints only). |
| Clients deployed before backend | Card request 404s; clients stay at View Details only (fail-closed). Deploy backend first. |
| Concurrent removal by two admins | Existing endpoint behaviour; second call gets the endpoint's not-found or not-a-member response, shown as a notice. |

---

## 7. Observability & Operability

- Correlation ID per logical user action (`withCorrelationId()` on mobile, existing request header on web) propagates from card fetch to action call (P4).
- Metrics: `user_menu_card_requests_total{context,result}`, `user_menu_action_total{action,result}`, `user_menu_card_denied_total{context}`. No user ids in labels.
- Alert on a sustained rise in `user_menu_card_denied_total` (threshold set in Phase 1 from baseline); a spike means a client is opening menus for people outside the viewer's context or an access bug.
- Security-event stream: denied card reads.

---

## 8. Test Requirements (P13; API-level negative tests with DB backstop absent)

Risk classification: card endpoints and `allowed_user_actions` **High** (authorisation surface); clients **Medium**.

| # | Test |
|---|---|
| UM-T1 | A caller who cannot view the group, game or tournament gets 404 from its card endpoint. |
| UM-T2 | A target with no current relationship in the context gets 404, including a real user id from another context. |
| UM-T3 | Group matrix: every row of AD-3 for owner, admin and member, including no actions on self and none on the owner. |
| UM-T4 | Game matrix: organizer gets `remove_player`; player, waitlisted and invited viewers get none. |
| UM-T5 | Tournament matrix: before and after the hard block; committee versus non-committee; `requires_approval` true on committee changes and post-block disqualification. |
| UM-T6 | After a viewer leaves or is removed, the card endpoint returns 404 (access-consistency AD-1). |
| UM-T7 | Response key set is exactly `UserCardOut`; no email or mobile number appears. |
| UM-T8 | Rate limit returns 429 above the configured rate. |
| UM-T9 | Parity: for every action key offered, the matching action endpoint accepts the same viewer and target; for a key not offered, the endpoint refuses. |
| UM-T10 | Client (mobile jest): long-press opens the menu; View Details first; no actions on card failure; 404 closes with the notice; unknown key ignored; own avatar shows View Details only. |
| UM-T11 | Client (web): click and keyboard open, Escape closes, card click is not triggered by an avatar click. |
| UM-T12 | Mobile `npm run check:labels` and the terminology scan pass with the new keys. |

---

## 9. Implementation Phases (tasks)

Migrations are written per phase; the owner runs them. Each phase ends with an implementation report (as-built schema and deviations) written back here (BP-13).

| Phase | Task | Content | Acceptance |
|---|---|---|---|
| 1 | `ud-p1-verify` (both repos, read-only) | BP-01 audit: confirm AD-3 mappings and gates against as-built policies and endpoints; list every tap point (4.3); check label key collisions; confirm search-picker visibility (OI-5); report drift. No code. | Report with file and line; OI-4 and OI-5 answered |
| 2 | `ud-backend` | `UserCardOut` in `core`, three card routes, `allowed_user_actions` per module reusing action policies, rate limit config, label seed migration (written, not run), tests UM-T1 to T9 | Tests green; migration reviewed by the owner |
| 3 | `ud-mobile` | `UserMenuSheet`, `useUserMenu`, `<UserPressable>`; migrate `GroupDetailScreen` first, then other sites; remove `MemberActionCard`; tests UM-T10, T12. **Starts after the board exists (OI-6) and `ud-backend` is deployed** | Matches the board; screenshots next to the board in the report |
| 4 | `ud-web` | `user-menu.js`, helper attributes, styles, migrate sites; test UM-T11. Same gates as phase 3. Bump the PWA version constant | Matches the board |

Phases 3 and 4 may run in parallel after phase 2 is deployed.

---

## 10. Deployment & Rollback

- Order: migration (labels) run by the owner, then backend, then clients. Backend first (section 6).
- Rollback: redeploy the previous client builds; the card endpoints are additive and harmless if unused. Labels remain.
- Mobile ships through the owner's normal build (he bumps the version and runs the workflow).

---

## 11. Principles & Best-Practices Compliance

| Item | Design element | Status |
|---|---|---|
| P1 Config-driven | AD-8; labels in the admin store | Met |
| P3 Shared library | Shared schema in `core`; one component per platform | Met |
| P4 Observability | Section 7 | Met |
| P5 Idempotency | Card is read-only; actions reuse existing endpoints | Met |
| P7 Fault isolation | AD-5 fail-closed | Met |
| P9 Validate at boundary | UUID validation server-side; client is UX only | Met |
| P10 Least privilege | Six identity fields only | Met |
| P13 Negative tests | Section 8 | Met |
| P14 Additive | New endpoints only; no field removed | Met |
| P15 Shift-left authz | Per-endpoint predicate at the entry point; menu is UX | Met |
| P17 Rate limits | AD-1, AD-8 | Met |
| BP-01 Verify schema | Phase 1; code facts carry file and line | Planned |
| BP-03 Consistency | Section 1 to section 8 mapping below | Met |
| BP-09 Canonical source | AD-3 single policy source, parity test | Met |
| BP-12 T1 simplicity | One read endpoint per module, no new service or queue | Met |
| BP-13 Write-back | Per-phase reports | Planned |

**Deliberate deviations**

| # | Deviation | From | Rationale |
|---|---|---|---|
| D-1 | Replaces the PR #39 long-press card (details and actions together) with menu plus View Details | The mockup `docs/mockups/group-view/2-long-press-member.png` | Owner decision 2026-10-19: View Details first, then role actions |
| D-2 | Requirements restated in-document, not an approved REQ addendum | `solution-design` precondition | Process note 1 |

No deviation from `Enterprise_Design_Principles.md` or `design-best-practices.md`.

**Requirements coverage:** UM-01, UM-04, UM-06 to AD-4; UM-02 to AD-2, AD-4; UM-03, UM-08 to AD-3; UM-05 to AD-6; UM-07 to AD-7; UM-09 to AD-2 and section 5; UM-10 to AD-1. Tests: section 8.

---

## 12. Open Items

| ID | Item | Severity | Status |
|---|---|---|---|
| OI-1 | Admin console user lists are out of v1; they keep their own actions and approval flows. | 🟢 LOW | Default accepted; revisit on owner request |
| OI-2 | A plain tap keeps today's behaviour per screen on mobile. | 🟢 LOW | Default accepted |
| OI-3 | On web, avatars inside clickable home cards open the menu and stop propagation so the card navigation does not fire. | 🟡 MEDIUM | Default accepted; board shows the exact behaviour |
| OI-4 | AD-3 rows are verified against as-built policies and endpoints; rows with no existing endpoint or a differing gate are held out and reported. | 🟠 HIGH | Resolved by `ud-p1-verify` |
| OI-5 | Search and suggested-player lists show View Details from row data with no actions and no card request; Phase 1 confirms search already exposes display name, nickname and photo for those rows. | 🟡 MEDIUM | Resolved by `ud-p1-verify` |
| OI-6 | No board exists for the menu or the details view. Repo rule: UI work must match a board. The owner needs a mockup (menu, details view, web variant, own-avatar case) before phases 3 and 4. Not blocking phases 1 and 2. | 🟠 HIGH | **Open; gates phases 3 and 4** |
| OI-7 | Privacy-policy wording: no change expected (fields already visible to the same viewers). Owner confirms with the `meetup-privacy-tnc` review. | 🟢 LOW | Open, non-blocking |

Status: **APPROVED v1.0.** No blocking items for phases 1 and 2. Phases 3 and 4 gated on OI-6.

---

## 13. Risks & Mitigations

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | A call site is missed and still has its own press behaviour | Phase 1 audit with file and line; `<UserPressable>` and the web attribute helpers make the right thing the default; a grep check in review |
| R-2 | The menu offers an action the endpoint refuses | AD-3 single policy source; parity test UM-T9; endpoint stays the authority |
| R-3 | Long-press has no visible cue on mobile | Accepted by the owner; web has the click target |
| R-4 | Card endpoints become a user-lookup oracle | Current-relationship check, 404 on everything else, rate limit, exact-field test |
| R-5 | Three endpoints drift apart | One shared schema and one parity test per module |

---

## 14. Review Log

| Version | Date | Note |
|---|---|---|
| v1.0 | 2026-10-19 | First version, approved by the owner on his instruction after elicitation (long-press and click open a menu with View Details first, role-based actions, reusable component, labels via admin, tap keeps today's behaviour). Requirements UM-01 to UM-10. Phases 3 and 4 gated on a board (OI-6). |
