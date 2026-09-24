# Addendum — Mobile Skill-Level Delete Parity

**Doc ID**: ADDENDUM-MOBILE-SKILL-DELETE-001 (standalone — not yet folded into
`REQ-MEETUP-MOBILE.md` / `DES-MEETUP-MOBILE.md`; precedent for this pattern:
Addendum A began as a standalone `requirements-brief-addendum-admin.md` and
was later consolidated into `REQ-MEETUP.md`, per that document's own history)
**Status**: DRAFT — architect-authored, content approved; **IDs and section
numbers below are placeholders**, not assigned against the real mobile docs
(not uploaded to this session — see Merge Instructions)
**Date**: 2026-09-24
**Extends**: `REQ-MEETUP-001` Addendum D v1.11 (R-250.1, R-339) and
`DES-MEETUP-001` v1.71 (`fn_has_active_tournament_registration`, §5.13) —
web-side work, in progress, backend is shared with mobile unchanged.
**Baseline for this addendum**: mobile investigation report, 2026-09-24
(read-only, no code changes made).

---

## 1. Scope & Intent

Web (R-250.1/R-339) added full Add/Modify/Delete for per-sport skill-level
entries. Mobile investigation found Add and Modify **already live** in
production against the same shared backend — only Delete is missing. This
addendum scopes Delete parity for mobile. No new backend work: mobile calls
the same `DELETE /users/me/skill-level/{sport}` endpoint and
`fn_has_active_tournament_registration` guard being built for web under
R-339.

## 2. Investigated & Confirmed (source: mobile investigation report, this session)

- `ProfileScreen.tsx` renders `skill_levels.map(...)` — a full per-sport
  list, same shape as web. No separate Settings screen exists on mobile;
  this is the one screen.
- `getSkillLevels()` → `GET /users/me/skill-levels` and `updateSkillLevel()`
  → `PUT /users/me/skill-level` are both already wired and live. Add and
  Modify work today, unaffected by this addendum.
- No Delete affordance exists in any form — no button, no swipe action, no
  `DELETE` call anywhere in the client.
- `GET /users/me/skill-levels` is undocumented in `DES-MEETUP-MOBILE.md`
  §7.2's Users API table (only `PUT` is listed) — pre-existing doc gap,
  independent of this addendum.
- The GET response shape is an unverified client-side assumption — backend
  OpenAPI has no `response_model` for it. Evidently correct (Add/Modify work
  against it in prod) but undocumented on both sides. **Flagged, not fixed
  here** — separate, smaller finding, own timeline.
- No dedicated Profile-screen section exists in `DES-MEETUP-MOBILE.md` §4;
  closest are §7.2 (Users API table) and §4.13 (App Store Compliance,
  covers account deletion on the same screen).

## 3. Requirements

| ID (placeholder) | Type | Statement | Priority | Tier | Status |
|---|---|---|---|---|---|
| R-MOBILE-SKILL-DELETE-1 | Functional | Mobile Profile screen (`ProfileScreen.tsx`) shall provide a Delete affordance on each entry of the existing per-sport skill-level list, calling the shared `DELETE /users/me/skill-level/{sport}` endpoint (R-339). Guard behavior is identical to web: a 409 response (active/unconcluded tournament registration for that sport) is surfaced to the user verbatim, not swallowed; on success the entry is removed from the list. | Must | T1 | APPROVED (content); ID pending assignment |

**Non-goals for this addendum**: no new backend endpoint or guard logic (R-339 covers both platforms); no change to existing Add/Modify behavior; no fix to the GET response-model documentation gap (§2, tracked separately); no new Settings screen.

## 4. Design

- **Backend**: none. Fully reuses R-339's `DELETE /users/me/skill-level/{sport}`
  and `fn_has_active_tournament_registration` (`DES-MEETUP-001` v1.71,
  §5.13) — same guard, same 409 contract, no mobile-specific branch.
- **Frontend** (`ProfileScreen.tsx`): add a Delete affordance per
  `skill_levels` list entry. On tap: call `DELETE /users/me/skill-level/{sport}`.
  On 409: display the guard's message to the user (same discipline as the
  web brief — do not generic-ize the error). On success: remove the entry
  from local state / re-fetch via `getSkillLevels()`.
- **Placement in `DES-MEETUP-MOBILE.md`** (deferred to merge — see below):
  most likely a new subsection under §4 for the Profile screen (none
  currently exists), with the `DELETE` route added to §7.2's Users API
  table alongside the already-missing `GET` route.

## 5. Merge Instructions (when `REQ-MEETUP-MOBILE.md` / `DES-MEETUP-MOBILE.md` are available)

1. Assign a real sequential requirement ID from the actual current mobile
   requirements doc — replace `R-MOBILE-SKILL-DELETE-1` throughout.
2. Assign a real `§`-number in `DES-MEETUP-MOBILE.md` for the design
   content in Section 4 above — confirm whether it becomes a new Profile
   screen subsection or extends an existing one; this addendum does not
   presume the doc's actual structure.
3. Add the `DELETE` route to §7.2's Users API table — and, while there,
   the pre-existing missing `GET /users/me/skill-levels` row (§2 finding;
   optional cleanup, not blocking this addendum).
4. Bump `DES-MEETUP-MOBILE.md`'s version and document-history table per
   this project's standing convention (see `DES-MEETUP-001` v1.70/v1.71
   entries for the exact style).
5. Retire this standalone file once folded in, per the Addendum A
   precedent.

---

**Not yet dispatched as a build task.** Once merged with real IDs (or you
confirm building against the placeholder is acceptable), the task brief
follows the same shape as the web R-339 brief.
