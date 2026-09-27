# DES-MEETUP-ADDENDUM-shareable-links

**Doc ID:** DES-MEETUP-ADDENDUM-shareable-links
**Version:** v1.3 — v1.0 (2026-09-27) APPROVED; v1.1 adds Decision 15 (wire contract); v1.2 corrects Decision 12 via Decision 16 (no `sport` on `groups`); v1.3 adds Decision 17 (registration response returns joined `group_id` for post-auth resume, closing the gap flagged as "Proposed Assumption 11" during backend implementation)
**Status:** APPROVED (2026-09-27)
**Component:** Backend + Web (repo: `pratheeshku/meetup`)
**Scale Tier:** T1
**Relationship to baseline:** Design-only addendum. Does not modify `DES-MEETUP.md` (same pattern as `DES-MEETUP-ADDENDUM-event-reminder.md`). No `REQ-MEETUP.md` addendum accompanies this per standing instruction — requirements for this feature live in the friend-supplied Shutlr backlog (R-277–282), gap-checked against this design below.
**Governing files:** Enterprise Design Principles v1.0; Design Best Practices v1.0.
**Date:** 2026-09-27

**Plain-language summary:** Anyone can view an event's basic details (sport, time, venue, capacity, who's organizing, how many are going) without logging in — no names of who's going, no join capability. Joining always requires an account. Group invites work differently: an organizer generates a real invite link; whoever signs up through it is automatically added to the group. Event links don't need generating — sharing the event's normal page link is enough, with an optional tag identifying who shared it, for tracking only.

---

## 1. Executive Summary

Two related but architecturally distinct mechanisms:

- **Event sharing** — no token, no generation step. Any event's existing URL becomes viewable, unauthenticated, by anyone. An optional `?ref=` query param tags who shared it, for attribution only — it grants no access and blocks nothing.
- **Group invitation** — a real token-based mechanism (groups have no public-view surface to attach a raw-URL scheme to). The token carries `group_id` and `inviter_id`, auto-joins the invitee on successful registration, and is purely additive — it does not replace or gate any existing way to join a group.

Both are read/join-tracking features layered on the existing system, not new authorization models. The one deliberate security-boundary exception is documented in §3, Decision 1.

## 2. Scope & Constraints

**In scope:**
- `GET /public/events/{event_id}` — unauthenticated, metadata-only event view
- Event share = existing canonical URL + optional `?ref=<inviter_user_id>` (client-appended, no backend "create" step)
- `POST /groups/invitations` (authenticated) + `GET /public/groups/invitations/{token}` (unauthenticated landing) — token-based group invite with auto-join on registration
- `"private"` visibility relabeled `"Invite Only"` on web — display-only
- Post-signup/login redirect-to-event (return-to param)
- WhatsApp / native-share link composition on web
- Funnel/attribution logging for both mechanisms

**Out of scope (this addendum):**
- Tournaments (explicitly deferred by Pratheesh)
- Any mobile app change — see `DES-MEETUP-MOBILE-ADDENDUM-shareable-links.md`
- Gateway rate limiting implementation — deferred decision, see §7
- Group visibility ACL redesign — group invite bypasses visibility entirely by design (token-driven, not browse-driven), so the existing group visibility enum is untouched

**Constraints:**
- Existing authenticated RLS/visibility policies for events and groups must not be modified (P10, BP-12)
- Additive only — no breaking change to existing API contracts (P14)
- No schema change to the `event_visibility` (or equivalent) enum — relabel is presentation-layer only

## 3. Architecture Decisions

**Decision 1 — Dedicated public endpoint, not a relaxed authenticated one.**
`GET /public/events/{event_id}` runs outside the existing auth/RLS middleware entirely, via a narrow `SECURITY DEFINER` function (same pattern as `fn_has_active_tournament_registration`, DES-MEETUP.md §5.13) granted to the app role, scoped to an explicit column allowlist — never the full row.

> **⚠ Deliberate deviation — Enterprise Design Principles v1.0, P15 (Zero Trust / Authentication & Authorisation).** P15 requires every request be authenticated before business logic executes. This endpoint is an explicit, bounded exception: read-only, no mutation capability, returns only non-sensitive aggregate/metadata fields (never participant identity — see Decision 3), and is isolated to one narrow function rather than widening any existing policy. Accepted as a named T1 exception per BP-12 (simplicity is a design goal, not a gap) — the product requirement (R-278) is incompatible with universal authentication, and the blast radius is bounded by the field allowlist in Decision 2. This is the only P15 deviation in this addendum; every other endpoint is unchanged.

**Decision 2 — Explicit column allowlist at the query layer, not the serializer.**
The public endpoint's `SELECT` lists exact fields (`sport`, `starts_at`, `ends_at`, `venue_name`, `capacity`, `organizer_display_name`, `going_count`) — never `SELECT *`. Per P14, new fields get added to events over time; none reach this endpoint unless explicitly added here. This is a forward-looking safeguard, not just current-state correctness.

**Decision 3 — No participant identity or RSVP status exposed.**
`going_count` is a scoped `COUNT(*)` over active participant rows — never individual rows. Satisfies the locked PDPA decision. This is a hard constraint on Decision 2's allowlist, not a separate control.

**Decision 4 — Visibility ACL governs listing only; the public detail endpoint is visibility-agnostic.**
`public` / `group` / `"Invite Only"` (formerly `private`) events are all resolvable by `event_id` through the public endpoint. Visibility continues to gate only browse/listing queries, unchanged. Documented explicitly per BP-13 — this is easy to mis-read as a bug against the visibility model if not stated as intentional.

**Decision 5 — "Invite Only" relabel is frontend-only.**
A label map translates the enum value to its display string. No DB, API contract, or version bump. Not a BP-08 version-domain concern — this isn't a second version domain, it's zero new domains.

**Decision 6 — Group invitation: new token table, functional (not access-gating) purpose.**
New table (illustrative — **verify against actual DDL before implementation, BP-01**): `group_invitations(token PK, group_id, inviter_user_id, invited_email NULLABLE, created_at, consumed_at NULLABLE)`.
`invited_email` is captured only if supplied for WhatsApp/share-message personalization — **never** used as a match/access condition at registration, per Pratheesh's explicit decision. The token's only functions are (a) carrying `group_id` context through an unauthenticated registration flow that has no public group page to land on otherwise, and (b) triggering auto-join.

**Decision 7 — Event `?ref=` param is not persisted at "creation."** There is no creation step for event links — the button just appends the param client-side to the canonical URL. It's captured server-side only when it actually arrives on a request (public view hit, or registration/join). No `event_invitations`-style row is written speculatively.

**Decision 8 — Group auto-join executes server-side, atomically with registration completion**, not client-triggered — a dropped client response after signup still results in the join. Token `consumed_at` is set in the same transaction (BP-06: confirm this is a single atomic transaction, not a two-step "register then join" that can partially fail).

**Decision 9 — Event join stays manual; group join is automatic. This is deliberate, not inconsistent** (flagging per BP-13 so a future reviewer doesn't file it as a defect):
- Events have capacity/waitlist state that can race between link-open and registration-completion; joining an event roster is a higher-consequence, visible commitment (organizer notification, roster change).
- Groups have no capacity mechanic; membership is lower-consequence and easily reversible by a group admin.

**Decision 10 — Post-signup/login redirect.** Client stores intended destination (`event_id` + `ref`, or invitation `token`) before redirecting to signup/login; consumed on successful auth to either land on the event page (manual Join still required) or complete group auto-join and land on the group page.

**Decision 11 — Group invitation token: single-use, no expiry.** `consumed_at` set on first successful join; further attempts with the same token are rejected (resolved, not a new join). No time-bounded expiry — consistent with the event link's no-expiry posture (Decision 7 context); single-use alone bounds the leaked/forwarded-link blast radius to one extra join, per §7.

**Decision 12 — Group invite landing page metadata scope: group name only.** ~~name + sport~~ — corrected by Decision 16 below; do not build against the original "+ sport" wording.

**Decision 16 — Correction to Decision 12 (v1.2, architect error).** `groups` (Players Group entity, `POST /groups`) has no `sport` column — only `teams` (Tournament Team entity, `POST /teams`) does. `group_invitations.group_id` targets Players Groups only; Tournament/Team invitations are out of scope, consistent with Tournaments being deferred elsewhere in this addendum's scope. Decision 15's `GET /public/groups/invitations/{token}` response is corrected accordingly:
```json
{ "group_name": "<string>" }
```
No `sport` field. This was caught during implementation via BP-01 schema verification, not invented — the design assumption was wrong, not the build.

**Decision 17 — Registration response returns the joined `group_id` (v1.3 addition).** Decision 16's public landing-page response intentionally excludes `group_id` — no reason to expose an identifier pre-auth that the join step itself will resolve. But the frontend still needs to know where to send the user *after* auto-join completes (Decision 8), and it shouldn't have to re-resolve the token a second time to find out. Fix: when the registration/signup endpoint receives an `invitation_token` that resolves successfully, its success response includes the joined group's id — e.g. `{"joined_group_id": "<uuid>"}` (or nested appropriately in the existing signup response shape; field name is the fixed part, placement in the existing payload is the implementer's call, consistent with existing response conventions). Frontend resume logic (both web and mobile, wherever built) reads this field to redirect straight to the group page — no group_id is stored client-side before this point, and the general "land on groups list" fallback in the current build is superseded by this, not left as an alternate path.

**Decision 13 — Rate limiting: implemented at go-live, not deferred.** Basic IP-based limiting at the Caddy layer for `/public/*` routes, scoped by config (P1 — thresholds externalised, not hardcoded). Supersedes the deferred-gate framing in the original draft; the cost of a basic proxy-level limit is low enough that deferral isn't justified given this feature directly widens the P17 exposure it would guard.

**Decision 14 — No search-engine exclusion on public event pages.** These pages are intentionally public per Decision 4; no `robots.txt` disallow rule added for `/public/events/*`.

**Decision 15 — Wire contract for group-invitation endpoints (v1.1 addition).** Not specified in v1.0 — surfaced as a blocking gap when the mobile agent reached this item in parallel with the backend agent, before either had committed to a shape. `snake_case` JSON, matching this codebase's existing convention elsewhere.

`POST /groups/invitations` (authenticated)
Request:
```json
{ "group_id": "<uuid>" }
```
Response `201`:
```json
{ "token": "<opaque string>", "invitation_url": "<absolute URL, e.g. https://meetups.duckdns.org/groups/invite/{token}>" }
```

`GET /public/groups/invitations/{token}` (unauthenticated)
Response `200`:
```json
{ "group_name": "<string>", "sport": "<string>" }
```
Response `404` if the token doesn't exist. Per Decision 6, the token is not access-gating — this read succeeds even after `consumed_at` is set; single-use (Decision 11) governs the *join* action at registration, not visibility of this landing page.

Registration endpoint extension: accepts optional `invitation_token` in the existing signup payload — field name `invitation_token`, same `snake_case` convention.

## 4. Component / Integration Design

New routes (FastAPI, `pratheeshku/meetup`):
- `GET /public/events/{event_id}` — no auth dependency; allowlisted metadata only
- `POST /groups/invitations` — authenticated (organizer/group-admin); creates `group_invitations` row, returns shareable URL — exact request/response shape in Decision 15
- `GET /public/groups/invitations/{token}` — unauthenticated; resolves token → group name/sport only (Decision 12) for the pre-registration landing page — exact response shape in Decision 15

Registration flow extension: signup endpoint accepts optional `invitation_token`; on success, resolves token → `group_id`, performs join + marks consumed, in one transaction (Decision 8).

Frontend (web): existing event-detail component reused in an unauthenticated render mode (participant list/RSVP hidden, Join CTA redirects to signup with return-to param stored); new group-invitation landing page (no existing equivalent — net-new); WhatsApp (`wa.me` link) and native share buttons on organizer/admin views; visibility label map updated per Decision 5.

## 5. Security & Compliance Considerations

- PDPA: no participant PII on the public path (Decisions 2–3)
- P10: public endpoint's `SECURITY DEFINER` function granted `EXECUTE` to the app role only for this function — not blanket table access. Per **BP-07**, this grant is specified individually, not lumped with other functions' grants.
- P9: `event_id` / `token` validated as well-formed (UUID) before query execution — malformed input rejected pre-query
- Invitation tokens: cryptographically random, sufficient entropy against enumeration/guessing — non-sequential
- Rate limiting (P17) — resolved by Decision 13: IP-based limiting at Caddy for `/public/*` routes, implemented at go-live (not deferred to a gate). Mitigates the pre-existing gateway rate-limiting gap this feature widens (trivial event_id enumeration/scraping otherwise).
- Group invitation token: single-use per Decision 11 — bounds blast radius of a leaked/forwarded link to one extra join

## 6. Observability & Operability

- Structured, correlation-ID-tagged log stream for public-endpoint access, separate from authenticated traffic (P4) — feeds the rate-limiting gate above
- Funnel events (R-282), scoped to what's actually instrumentable:
  - Event links: "opened" (public endpoint hit with `?ref=`) and "registered/joined-via-ref" — no "created" event exists (Decision 7)
  - Group links: full funnel — created / opened / registered-via-invite / joined-via-invite (real token lifecycle supports all four)

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Rate limiting gap widened by new public endpoint | Resolved — Decision 13, implemented at go-live |
| Group invite token forwarded/leaked → uncontrolled joins | Resolved — Decision 11, single-use; admin can still remove unwanted members via existing tooling |
| Public event pages crawlable/indexable by search engines | Resolved — Decision 14, accepted as intentional |

## 8. Requirements Traceability

| R-ID | Disposition |
|---|---|
| R-274 | Unrelated — standalone, no dependency on this addendum |
| R-275, R-276 | Already built (`PATCH /events/{id}`, `event_changed`) — gap-check trigger-field set against DES-MEETUP.md before closing |
| R-277 | Satisfied differently for events (no token — raw URL) vs. groups (token, Decision 6) — flag this split explicitly if R-277 is written back into a requirements doc |
| R-278 | Satisfied — Decision 4 (event), token resolution (group) |
| R-279 | Satisfied — manual for events (Decision 9), auto-join for groups (Decision 8) — deliberate asymmetry, not literal-text compliance for events |
| R-280 | Web: `wa.me` link + native share button (§4). Mobile: separate addendum |
| R-281 | Trivial — clipboard write + confirmation, both platforms |
| R-282 | Partially satisfied — full funnel for groups; partial (no "created" event) for events, per Decision 7 |

## 9. Implementation-Time Checklist (non-blocking)

- **BP-01:** `group_invitations` table/columns in Decision 6 are illustrative — verify against actual DDL before implementation
- Exact DB role/function name for the public endpoint, following the `fn_has_active_tournament_registration` naming convention — assign at implementation time
- Caddy rate-limit thresholds (Decision 13) — specific req/min values to be set as config, not hardcoded (P1)
