# DES-MEETUP-MOBILE-ADDENDUM-shareable-links

**Doc ID:** DES-MEETUP-MOBILE-ADDENDUM-shareable-links
**Version:** v1.0
**Status:** APPROVED (2026-09-27)
**Component:** Mobile (repo: `pratheeshku/meetup-mobile`)
**Scale Tier:** T1
**Relationship to baseline:** Design-only addendum to `DES-MEETUP-MOBILE.md` — not yet folded in.
**Depends on:** `DES-MEETUP-ADDENDUM-shareable-links.md` (backend endpoints this UI calls)
**Governing files:** Enterprise Design Principles v1.0; Design Best Practices v1.0.
**Date:** 2026-09-27

**Plain-language summary:** The app itself barely changes. Organizers get a Share button on their events/groups that hands off to WhatsApp or the phone's normal share sheet, plus a copy-link button. Tapping a received link on a phone always opens the browser — the app does not intercept it, even if installed. That's a deliberate choice, not a gap.

---

## 1. Executive Summary

This feature's mobile footprint is **composition only** — an authenticated organizer/admin generating and sharing a link from inside the app they're already logged into. **Receiving** a shareable link is explicitly out of scope for the native app; it always falls through to the system browser (PWA), regardless of whether the app is installed. This was decided, reversed twice, and finalized in the parent elicitation session (see `DES-MEETUP-ADDENDUM-shareable-links.md` Decision 1 context).

## 2. Scope & Constraints

**In scope:**
- Event share button (organizer view): appends `?ref=<user_id>` to the canonical web event URL, hands off to native share
- Group invite button (organizer/admin view): calls `POST /groups/invitations` (backend addendum §4), hands off resulting URL to native share
- WhatsApp-specific share option (pre-filled, editable message)
- Copy-link action with confirmation
- `"private"` → `"Invite Only"` display relabel, mirrored from the web decision

**Explicitly out of scope:**
- Any App Links / Universal Links registration or domain verification
- Any new unauthenticated screen or nav-stack entry for receiving links
- Any auth-aware deep-link routing logic

**Constraint:** zero new backend auth surface — every action here originates from an already-authenticated session; the backend already enforces organizer/admin authorization on `POST /groups/invitations` per the parent addendum.

## 3. Architecture Decisions

**Decision 1 — No native deep-link interception (reaffirmed).**
Documented here per BP-13 to prevent this being re-litigated as an oversight: the app does not register as a handler for event or group-invite URLs. A user with the app installed who taps a shared link is bounced to the system browser (PWA), same as a user without the app. Rationale: avoids App Links/Universal Links domain verification, a new unauthenticated nav stack (the existing Login/Signup stack does not cover this — it has no auth-aware branching for "same URL, different destination by session state"), and a post-signup return-to-app redirect mechanism — for a cost that is UX-only (one extra browser hop), not functional.

**Decision 2 — Event link composition is client-side only.**
No backend call to "generate" an event link — the Share button reads the event's existing canonical URL and appends `?ref=<current_user_id>` before handing off. Mirrors backend addendum Decision 7 (no creation step exists for event links).

**Decision 3 — Group link composition calls the backend.**
`POST /groups/invitations` (authenticated) returns the shareable URL; the mobile UI then hands that URL to the same native-share code path as event links. No mobile-side token generation or storage.

**Decision 4 — Native share integration.**
- Generic share sheet: `Share.share({ message, url })` (React Native core)
- WhatsApp-specific button: `whatsapp://send?text=<encoded message + link>` via `Linking`, with `Linking.canOpenURL` fallback to `https://wa.me/?text=...` if WhatsApp isn't installed
- Both paths use the same message-composition logic (inviter name, event/group info, link) — single source of truth for the message template, not duplicated per button

**Decision 5 — Copy link.**
Clipboard write via the app's existing clipboard dependency (verify which is already in use — **open item**, §7) + toast/snackbar confirmation, consistent with existing in-app feedback patterns. No new dependency should be needed; confirm before adding one.

**Decision 6 — "Invite Only" relabel mirrored on mobile, in scope now.**
Same label-map change as web (backend addendum Decision 5) — display string only, no schema/API impact. The original instruction ("customer facing screens") wasn't platform-scoped; mobile screens are customer-facing, so this is included rather than deferred to a separate pass. Zero incremental cost beyond the string map itself.

**Decision 7 — WhatsApp/share message template.**
Default composition: `"{inviter_display_name} invited you to {event_or_group_name} on Shuttlr — {link}"`, using the same variable set (inviter name, event/group info, link) across both the WhatsApp and generic-share paths (Decision 4's single source of truth). This is content, not architecture — the content/product owner can refine copy at implementation time without a design change.

## 4. Component / Integration Design

- New UI: Share button + action sheet (native share / WhatsApp / copy link) on the organizer's event-detail screen and the group-admin's group-detail screen
- New network call: `POST /groups/invitations` (group flow only — event flow is client-side URL composition)
- No new screens for receiving links (Decision 1)
- No new navigation routes, no new permissions (share sheet and clipboard access are standard, already-granted capabilities on both platforms)

## 5. Security & Compliance Considerations

No new attack surface: every action originates from an authenticated session; the backend enforces authorization on invite creation (organizer/group-admin only), unchanged from existing patterns. No unauthenticated code path is added to the mobile app by this addendum — Decision 1 is precisely what keeps this true.

## 6. Observability & Operability

None mobile-specific. Funnel/attribution tracking (created/opened/registered/joined) is entirely server-side per the backend addendum §6 — mobile only constructs and hands off URLs; it does not need to log share events itself for this feature to function.

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| UX inconsistency — app-installed users always bounce to browser on received links | Accepted trade-off, Decision 1. Not a defect; documented to prevent re-opening without new information (per the architect's review-feedback posture: revisit only if a new constraint emerges) |

## 8. Requirements Traceability

| R-ID | Disposition |
|---|---|
| R-277 | Mobile-side trigger only (calls backend for group case; client-composes for event case) |
| R-278, R-279 | Not applicable to mobile per Decision 1 — satisfied via browser/PWA fallback (see backend addendum) |
| R-280 | Primary scope of this addendum — WhatsApp + native share, §3 Decision 4 |
| R-281 | Copy link, §3 Decision 5 |

## 9. Implementation-Time Checklist (non-blocking)

- Confirm existing clipboard library/dependency in `pratheeshku/meetup-mobile` before assuming Decision 5 needs no new package — verify against the actual repo, not assumed
- Message template copy (Decision 7) — default specified; content owner may refine wording without a design change
