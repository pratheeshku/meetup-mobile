# Addendum — Mobile Home Screen Sports Filter Pre-Selection

**Doc ID**: ADDENDUM-MOBILE-SPORTS-FILTER-PRESELECT-001 (standalone — not yet
folded into `REQ-MEETUP-MOBILE.md` / `DES-MEETUP-MOBILE.md`; same pattern as
`ADDENDUM-MOBILE-SKILL-DELETE-001`, which began standalone and is itself
still pending merge)
**Status**: APPROVED (2026-09-24, architect-directed) — content and scope
approved for implementation against the placeholder ID below; real ID and
section numbers are assigned at merge time (§5).
**Date**: 2026-09-24
**Related, web-side counterpart**: `REQ-MEETUP-001` Addendum D v1.11, R-340
(home page sports filter pre-select, web) — same underlying goal, different
UI model on mobile (see §1). Not a shared requirement; scoped separately
because the two platforms' filter implementations are structurally
different, not just visually.

---

## 1. Scope & Intent, and Why This Differs From Web's R-340

Investigated (2026-09-24, read-only) and confirmed mobile's Home screen
sports filter (`SportFilterPills`, `HomeScreen.tsx`) is **not** a parity
case with web — two independent structural differences, not one:

1. **Selection model**: mobile is single-select (`selectedSport: string |
   null` — one value or "All", never a set). Web is multi-select checkboxes.
   Decision (architect-directed): do **not** rebuild mobile's UI to
   multi-select. This requirement changes only the *default value* within
   the existing single-select model.
2. **Filter-options data source**: mobile's pills are derived from
   `getSportOptions(events)` — sports present in the *current event feed*,
   not from the user's own declared sports. Web's equivalent reads directly
   from `user_skill_levels`. Decision (architect-directed): do **not**
   change mobile's options source. A sport the user has a skill level for
   but with no current event in the feed will not appear as a pill and
   therefore cannot be pre-selected, regardless of this requirement.

Both are deliberate scope boundaries, not oversights — see the requirement
statement (§3) for the exact fallback behavior when they interact.

## 2. Investigated & Confirmed (source: mobile investigation report, 2026-09-24)

- `HomeScreen.tsx`, registered as route `EventsList` in `HomeStack`
  (`RootNavigator.tsx`), mounted as the `Home` tab.
- `SportFilterPills`: horizontal scroll row, single-select only. State:
  `const [selectedSport, setSelectedSport] = useState<string | null>(null)`.
  Tapping another pill replaces the selection; tapping the active pill does
  not deselect it; selecting zero sports is not currently possible.
- Default today: always `null` ("All"). Neither Upcoming nor Recommended
  sections are sport-filtered in this default state.
- `getSportOptions(events)` (`homeDashboard.ts`) computes pill options by
  scanning the current `getEvents()` result for distinct, attendable sport
  values — purely event-feed-derived, no call to
  `GET /users/me/skill-levels`, `GET /admin/sports/public`, or
  `getProfile()` anywhere in this screen.
- If a pull-to-refresh returns a feed without the currently-selected
  sport, `selectedSport` already falls back to `null` — existing behavior,
  unaffected by this requirement.
- `GET /users/me/skill-levels` (same endpoint the web Settings/Delete
  feature already uses) is confirmed live and already used elsewhere in
  this app (`ProfileScreen.tsx`) — no new backend call needed, no backend
  work at all for this requirement.

## 3. Requirement

| ID (placeholder) | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-MOBILE-SPORTS-FILTER-PRESELECT-1 | Functional | Mobile Home screen's `SportFilterPills` shall default `selectedSport` to a sport derived from the caller's `user_skill_levels` on load, instead of always defaulting to `null` ("All"). **Algorithm**: rank the caller's sports by skill level (`expert` > `intermediate` > `beginner`); if exactly one sport occupies the top tier, pre-select it; if multiple sports tie at the top tier, pre-select whichever tied row has the most recent `updated_at` (existing column, no new storage); if the caller has zero `user_skill_levels` rows, default remains `null` ("All"), unchanged from today. This is a default only — the user may still freely tap any pill, including "All", afterward; nothing is restricted. If the algorithm selects a sport with no corresponding pill currently rendered (per §1.2's options-source boundary), `selectedSport` falls back to `null` ("All") rather than referencing a nonexistent pill. | Must | T1 | APPROVED (content); ID pending assignment |

**Explicitly out of scope (architect-directed, deliberately deferred, not silently dropped)**:
- Multi-select rework of `SportFilterPills` (§1.1) — a user tied at the top skill tier across multiple sports will still only ever see one pre-selected, never both.
- Changing the filter-options data source to `user_skill_levels` (§1.2) — a played sport with no current event in the feed still won't appear as a pill, pre-selectable or not.
- A stored, explicit user-chosen default-sport preference — the tiebreak above is the "free" (no new storage, no new Settings UI) alternative; an explicit preference would require reviving `user_profiles` (confirmed dead code — 0 rows, no model/schema/endpoint/UI anywhere) or new storage, plus a Settings UI. Deferred as a separate, larger feature if the `updated_at` tiebreak proves unsatisfactory in practice.

**Known limitation, accepted deliberately**: the `updated_at` tiebreak reflects when a skill-level row was last *edited*, not necessarily current activity level — a user correcting an old typo in one tied sport's skill level will flip the default to that sport. Accepted as a reasonable tradeoff against the cost of the explicit-preference alternative above.

## 4. Design

- **Backend**: none. Fully reuses the existing, live `GET /users/me/skill-levels` endpoint — same one `ProfileScreen.tsx` already calls.
- **Frontend** (`HomeScreen.tsx`): on screen load (alongside the existing `getEvents()`/`getMyGroups()` fetch), also fetch `getSkillLevels()`. Run the ranking/tiebreak algorithm from §3 against the result. Set `selectedSport`'s initial value from the algorithm's output instead of hardcoding `null`, with the nonexistent-pill fallback to `null` as specified. No change to `SportFilterPills`' rendering, tap behavior, or `getSportOptions(events)` — only the initial value fed into existing state.
- **Placement in `DES-MEETUP-MOBILE.md`** (deferred to merge — see §5): wherever the Home screen / `SportFilterPills` is documented, if anywhere; investigation did not confirm an existing design-doc section for this component.

## 5. Merge Instructions (when `REQ-MEETUP-MOBILE.md` / `DES-MEETUP-MOBILE.md` are available)

1. Assign a real sequential requirement ID — replace `R-MOBILE-SPORTS-FILTER-PRESELECT-1` throughout.
2. Assign a real `§`-number in `DES-MEETUP-MOBILE.md` for the design content in §4 above.
3. Bump `DES-MEETUP-MOBILE.md`'s version and document-history table per this project's standing convention.
4. Retire this standalone file once folded in, same as `ADDENDUM-MOBILE-SKILL-DELETE-001`'s own §5 precedent.

---

**Approved for dispatch 2026-09-24.** No backend dependency — `GET /users/me/skill-levels` is already live and already used elsewhere in this app. Frontend-only change, scoped to `HomeScreen.tsx`'s initial `selectedSport` value.
