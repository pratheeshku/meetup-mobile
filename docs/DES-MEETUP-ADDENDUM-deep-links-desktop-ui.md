# DES-MEETUP-ADDENDUM-DEEP-LINKS-DESKTOP-UI

**Doc ID:** DES-MEETUP-ADDENDUM-DEEP-LINKS-DESKTOP-UI
**Version:** v1.0.1
**Status:** APPROVED on the owner's elicitation decisions of 2026-11-14 (standing instruction of 2026-10-28 for Meetup amendments). Architect decisions are listed in §10 for the owner's visibility; the owner may overturn any.
**Owner:** Pratheesh
**Date:** 2026-11-14
**Scale Tier:** T1
**Governing files:** `Enterprise_Design_Principles.md` v1.1 and `design-best-practices.md` v1.0, both found in the Project knowledge base and read in full before drafting. No deviation from either file. One deviation from a project rule (D-1).
**Codebase read (BP-01):** `pratheeshku/meetup` @ `ed9187c`, `pratheeshku/meetup-mobile` @ `f77c47f`.
**Supersedes in part:** `DES-MEETUP-ADDENDUM-email-auth` D1 ("no deep linking", app sends no invitation fields); `DES-MEETUP-ADDENDUM-shareable-links` Decision 21 (canonical game URL) and Decision 15 (`invitation_url` format); share-invite build task 1.3 of 2026-11-07 (game share is message only).
**Unchanged and relied on:** shareable-links Decisions 1 to 4 and access-consistency D-7 (public game preview), Decision 11 (group token single use), email-auth AD-2/AD-3/AD-7 (reset token, endpoint, Google-only reply).

## Plain-language summary

Two pieces of work in one release.

1. **Links open the app.** A GameOn SG link tapped on a phone that has the app opens the app at the right place: the new native "set a new password" screen, a game, a tournament, or a group invitation. Without the app, the same link opens the website as it does today. Game and tournament share messages get their link back.
2. **Desktop website layout.** Twelve layout faults found in the review of 2026-11-14 are corrected, and every page moves onto one shared desktop page frame.

## 1. Requirements (elicited 2026-11-14; approved with this document)

| ID | Requirement |
|---|---|
| DL-01 | A GameOn SG link opens the installed app at its target on iOS and Android. Without the app it opens the website. |
| DL-02 | Link kinds in this release: password reset, game, tournament, group invitation, and emailed game and tournament invitations. |
| DL-03 | The app has a native screen to set a new password from the emailed link. After success the user signs in with the new password. No session is created from the link. |
| DL-04 | A game link shows the existing 7-field public preview to anyone, in the app as on the web. Joining follows today's rules. A link grants no access. |
| DL-05 | A tournament link opens the tournament for a person who has access. Anyone else sees the existing "not available" notice. No tournament preview is added. |
| DL-06 | A group invitation link keeps its meaning (single-use token, joins the group) and now also works when the person signs in or signs up inside the app. |
| DL-07 | A signed-out person signs in or signs up first, then lands on the link's target. |
| DL-08 | Game and tournament share messages carry a link again, on web and mobile. |
| DL-09 | The hostname used in generated links is an admin UI setting. Current hosts: `meetupaws.duckdns.org` (production), `meetupstg.duckdns.org` (staging). |
| DL-10 | Moving to a new hostname is planned later, when the owner names it (OI-1). |
| DL-11 | Staging has the same capability with the staging apps. |
| DL-12 | No third-party deep-link service or SDK. No "remember the link through a store install". |
| DL-13 | Every link already sent keeps working on the website. |
| UI-01 to UI-12 | The twelve desktop faults in §4.4 are corrected. Phone-width web layout does not change. |

## 2. Scope & Constraints

**In scope:** link format, verification files, link host setting, link generation in emails and share messages, app link handling, native reset screen, app-side sign-up and sign-in carrying invitation data, the twelve desktop fixes and a shared desktop page frame.

**Out of scope:** the hostname move itself; deferred deep links through the store; tournament public preview; push notification routing (already opens the app); the Admin console layout; desktop pages not yet reviewed (OI-6); any change to who may view or join anything.

**Constraints**
- Authorization stays in `policies.py` and `shared_auth_core`. No new RLS, triggers or DB-side validation. No schema change is expected; if one is found necessary it is a Blocked Report.
- Runtime switches and the link host are admin UI settings, never set by hand in the database.
- No new third-party library in either repo. The app already depends on React Navigation, which includes link handling.
- Hostnames an app opens for are compiled into the app and verified by the phone at install. An admin change cannot add a host to apps already installed.
- Both apps ship through store review. The server must work with old app versions that know nothing of the new links (P14).

## 3. Architecture Decisions

**AD-1: Verified web links only (DL-01, DL-12).** iOS Universal Links and Android App Links on `https`. No custom URL scheme: any app can claim a custom scheme, and a reset token must never be deliverable to another app. Rejected: third-party link services (owner principle, and a new external dependency on the sign-in path).

**AD-2: Path-based link grammar under `/l/` (DL-02, DL-13).** Fact: every link today is a hash link (`/#event-detail/{id}`, `/#reset-password?token=`, `#group-invite/{token}`). Android matches on host and path only, so hash links cannot be claimed without claiming the whole site. New forms:

| Kind | Link |
|---|---|
| Password reset | `/l/reset#token={token}` |
| Game | `/l/game/{event_id}?ref={user_id}`, with `#invite={invitation_id}` on an emailed invitation |
| Tournament | `/l/tournament/{tournament_id}`, with `#invite={invitation_id}` on an emailed invitation |
| Group invitation | `/l/group-invite#token={token}` |

Rule: public identifiers go in the path or query; anything that proves a claim (reset token, group token, invitation id) goes in the fragment, which browsers never send to a server, so it stays out of access logs and referrers, as today. The apps claim `/l/*` only. Ordinary use of the website on a phone never opens the app.

**AD-3: Web fallback and old links (DL-13).** `/l/*` returns the web app, which shows the same page the matching hash link shows today, with the same handling (reset token removed from the address bar at once). Hash links stay valid indefinitely on the web; they are no longer generated when AD-5's switch is on.

**AD-4: Verification files served by the API.** `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` are public, JSON, served without redirect, and registered ahead of the web app's catch-all route (the existing Apple domain file is the precedent). Their content comes from infrastructure configuration: Apple team id, app identifiers, Android package names and signing certificate fingerprints. None of these is a secret. Each environment lists only its own app, so a staging link can never open the production app.

**AD-5: Link host and rollout switch (DL-09, P1).**
- `link_base_url`: admin setting. Precedence: admin value, then `WEB_BASE_URL`, then none (reset email carries the code only, as today). Saved and read values are validated as `https` plus an exact host from an allow-list held in infrastructure configuration (P1 hardening addendum; same pattern as the store URL setting).
- `app_links_enabled`: admin switch, default **off**. Off: links are generated in today's hash form and nothing opens the app. On: links use AD-2. The owner turns it on after the new apps are live. It is also the rollback lever, because phones cache verification files for days and cannot be switched off from the server.

**AD-6: App link handling (DL-01, DL-07).** One resolver maps `/l/*` to screens: `ResetPasswordScreen` (new), `EventDetailScreen`, `TournamentDetailScreen`, and the group invitation landing. It handles both a closed and an already-open app. Identifiers are validated as UUIDs; an unknown or malformed link opens Home with no error. The force-update gate runs before any link is handled. For a signed-out person the target is held in memory, never written to device storage, and resumed after sign-in or sign-up. The reset route needs no sign-in.

**AD-7: Native reset screen (DL-03).** Fields: new password and confirmation. It calls the existing `POST /auth/reset-password-with-token`. The token comes only from the link, lives in memory, and is never logged, stored or sent to analytics. Every failure shows one message with a way back to `ForgotPasswordScreen`. Success returns to `LoginScreen` with a confirmation. If someone is signed in on the device, the screen still works and the device is signed out on success (the server already ends all sessions).

**AD-8: Game link (DL-04).** With access: `EventDetailScreen`. Without access or signed out: the 7 fields of the existing `GET /public/events/{id}` plus the existing call to action. `ref` and `invite` are passed on at sign-up and join exactly as the web does. The app therefore now sends `invitation_token`, `ref`, `event_id` and `invite` at sign-up and social sign-in (supersedes email-auth D1).

**AD-9: Tournament link (DL-05).** With access: `TournamentDetailScreen`. Otherwise the existing access notice. An emailed invitation is claimed as on the web.

**AD-10: Group invitation (DL-06).** The app shows the group name from the existing `GET /public/groups/invitations/{token}`, then joins through the existing server-side flow. `invitation_url` returned by the API takes the AD-2 form when AD-5's switch is on. Token rules are unchanged.

**AD-11: Share messages (DL-08).** Game and tournament shares end with their link on web and mobile, using the `{url}` placeholder the share labels already have. This reverses task 1.3 of 2026-11-07 by owner decision.

**AD-12: Shared desktop page frame (UI-01 to UI-12).** Applies at desktop width only. Every signed-in page uses one frame: the same header (notifications and profile always present), one content width rule, one back control, one title style, one page padding. Existing theme tokens only; no new visual language. The install banner must not add to page height or cover the header.

**D-1 (deviation from the `AGENTS.md` board rule, not from either governing file).** No design board exists for the native reset screen or the desktop fixes, and none is produced. The reset screen follows the layout and tokens of the existing `ForgotPasswordScreen` and `LoginScreen`. For the desktop fixes, §4.4 is the acceptance reference. Rationale: these are corrections and one two-field form; a board would add a round trip without adding a decision. Agents attach before and after screenshots.

**Tier check (BP-05, BP-12).** Not adopted at T1: signed or expiring game links, per-link revocation, device attestation. No in-scope threat requires them, because a link grants nothing (DL-04).

## 4. Component / Integration Design

### 4.1 Backend and web (`pratheeshku/meetup`)

| Area | Change |
|---|---|
| core/config | Link allow-list, Apple and Android association values |
| admin/config | `link_base_url`, `app_links_enabled` in Config Management |
| main | Two `/.well-known` routes; `/l/*` answered by the web app |
| auth | Reset email link built from AD-5 in AD-2 form |
| groups, events, tournaments | Invitation and share links built from AD-5 in AD-2 form |
| frontend | `/l/*` handling; share messages with link; desktop frame and §4.4 fixes; PWA version bump |

### 4.2 Mobile (`pratheeshku/meetup-mobile`)

| Area | Change |
|---|---|
| Android | Verified link declaration for `/l/*` per flavor: production host for `org.duckdns.meetups`, staging host for the staging app |
| iOS | Associated Domains for the same hosts per configuration |
| Navigation | Link resolver (AD-6), pending target after sign-in |
| Screens | New `ResetPasswordScreen`; public game preview state; group invitation landing |
| Auth calls | Invitation fields sent at sign-up and social sign-in (AD-8) |
| Share | Game and tournament links restored; all links from server values, none built from a hard-coded host |

### 4.3 Compatibility

Old app versions keep working: they never receive `/l/` links as app links and the server accepts requests without invitation fields. With the switch off, behaviour is exactly today's.

### 4.4 Desktop fixes (acceptance reference)

| ID | Fault found 2026-11-14 | Required result |
|---|---|---|
| UI-01 | Create game wizard steps 2 and 3 unstyled; venue list dumped inline | Labelled, styled fields; venue chosen through the existing venue picker; Next visible without long scrolling |
| UI-02 | Create menu is a phone bottom sheet cut off on desktop, then asks Game or Tournament again | A centred desktop dialog; the choice is asked once |
| UI-03 | Install banner makes every page 64px taller and hides the header on scroll | No extra page height; header stays visible |
| UI-04 | Header missing on Groups, Games, Profile, game detail | Header on every signed-in page |
| UI-05 | Game detail shows `Date &amp; Time`, a raw timestamp, a clipped Status dropdown, and "Close game" on an ended game | Correct label, the app's standard date format, aligned controls, no close action after the game has ended |
| UI-06 | Tournament Fixtures tab dropdowns collapse to about 15px | Dropdowns show their values |
| UI-07 | Notifications panel text runs together, last item clipped, Escape does nothing | Line breaks kept, list scrolls, Escape and outside click close it |
| UI-08 | Partner logos cropped in Book a court | Whole logo visible |
| UI-09 | Status badge wraps to two lines on cards | One line per badge |
| UI-10 | Content sits in a narrow centred column on some pages and full width on others | One content width rule on all pages (AD-12) |
| UI-11 | Three back-button styles, two title fonts, uneven padding, misaligned group settings fields | One of each; form fields share one width |
| UI-12 | "Groups" stays highlighted on Tournament teams; About and Help open `google.com` | Correct item highlighted; About and Help hidden until a real address is set in admin (OI-5) |

## 5. Security & Compliance

- **Link interception:** only an app whose identity matches the verification file on the host can open `/l/*` (AD-1, AD-4). If verification fails, the link opens the browser, which is the safe outcome.
- **Reset token:** fragment only, never sent to the server by a browser, single use, 30-minute life, same generic failure for every cause (unchanged server rules). Email link scanners cannot consume it because use requires a POST with a new password. In the app it is memory-only (AD-7), excluded from logs and crash reports (P4 masking, P11).
- **Validation (P9):** the resolver accepts four link kinds and UUID-shaped identifiers only. `/l/*` never redirects to another site. The link host is allow-listed (AD-5).
- **Authorization (P15):** unchanged. The new routes are public by nature (verification files, web app shell) and are declared public explicitly. A link changes where a person lands, never what they may see or do. D-7 stays the only preview exception.
- **Tests (P13):** API-level negative tests for: a tournament link opened by a person without access; a game link giving a non-member no join right on a private game; a reused or altered reset token; a link host outside the allow-list; a staging host that lists the production app (must not).
- **Rate limits (P17):** the existing limits on reset endpoints and `/public/*` apply. The verification files are small static answers and may be cached.
- **Privacy:** no new personal data is stored. Link counters carry no identifiers.

## 6. Observability & Operability

- Counters without identifiers or tokens: link opened by kind, platform and outcome (opened target, preview, not available, sign-in first, malformed); verification file requests by result; links generated by form (hash or path).
- Start-up: incomplete association configuration logs a warning and the two files answer 404, so links open in the browser. This mirrors the existing `WEB_BASE_URL` behaviour.
- Rollout order: deploy backend and web with the switch off; release both apps; owner turns `app_links_enabled` on in staging, checks the four link kinds on both phones, then turns it on in production.
- Rollback: switch off. New links return to hash form at once; no deploy needed.

## 7. Risks & Mitigations

| Risk | Rating | Mitigation |
|---|---|---|
| Hostname is `duckdns.org`, not owned; a later move strands app links | HIGH | Owner-accepted (DL-10). Link host is a setting; move planned in OI-1 before any switch |
| Fragment not delivered to the app on one platform | HIGH | Checked on the owner's phones with the staging builds (OI-7) before production is switched on; the fragment parsing sits in one resolver so a change of carrier is a small fix |
| Links tapped inside some in-app browsers (mail or chat webviews) do not open the app | MEDIUM | Web fallback works there; measured by the outcome counter |
| Verification fails because a fingerprint is wrong | MEDIUM | Staging first; owner supplies values from the store consoles (OI-2); failure degrades to browser |
| Old app builds after the switch is on | LOW | They open the web page; server accepts their requests (4.3) |
| Desktop frame changes disturb phone-width web layout | MEDIUM | Desktop width only (AD-12); before and after screenshots at phone and desktop width in the agent report |

## 8. Open Items

| ID | Item | Gate |
|---|---|---|
| OI-1 | Hostname move plan: an app release declaring old and new hosts before the switch, the old host kept serving `/l/*` and its verification file through a transition, treatment of links already sent | Owner names the new hostname |
| OI-2 | Owner supplies Apple team id and the signing certificate fingerprints for the production and staging Android apps | Blocks turning the switch on, not the build |
| OI-3 | Associated Domains capability enabled on both Apple app identifiers | Owner, Apple developer console; blocks the iOS build task |
| OI-4 | Sport name "Picketball" is admin data, not code | Owner corrects it in the admin console |
| OI-5 | Real About and Help addresses | Owner; links stay hidden until set |
| OI-6 | Desktop pages not reviewed: wizard steps 4 to 6, tournament wizard, create group, edit profile, privacy and terms | Architect reviews after the shared frame lands; findings enter as v1.1 |
| OI-7 | Device check that the fragment reaches the app on iOS and Android | Staging app build task, on the owner's phones (cloud agents have no devices). A failure is a Blocked Report against AD-2 and blocks the production switch |
| DF-1 | Deferred deep link through a store install | Revisit if more than 30% of `/l/` web opens over 30 days come from phone browsers |
| DF-2 | Tournament public preview | Owner request only |

## 9. Requirements Traceability

DL-01: AD-1, AD-2, AD-4, AD-6. DL-02: AD-2. DL-03: AD-7. DL-04: AD-8. DL-05: AD-9. DL-06: AD-10, AD-8. DL-07: AD-6. DL-08: AD-11. DL-09: AD-5. DL-10: OI-1. DL-11: AD-4, 4.2. DL-12: AD-1, DF-1. DL-13: AD-3, 4.3. UI-01 to UI-12: AD-12, 4.4.

## 10. Decision Record

**Owner decisions (2026-11-14):** native reset screen in the app; tappable link over an emailed code because deep linking is on the product roadmap; build on the current hostname with the host configurable in the admin UI; hostname move planned later; scope includes share and invitation links; game and tournament share links restored; links navigate and grant nothing; the existing public game preview stays; desktop fixes included in the same work.

**Architect decisions (owner may overturn):** `/l/` path grammar with claims in the fragment (AD-2); the `app_links_enabled` switch, default off (AD-5); each environment lists only its own app (AD-4); no custom URL scheme (AD-1); signed-in device is signed out after a reset (AD-7); app now sends invitation fields at sign-up (AD-8); About and Help hidden until set (UI-12); no boards for this work (D-1).

## Changelog

| Version | Date | Change |
|---|---|---|
| v1.0 | 2026-11-14 | Initial. Approved on the owner's elicitation decisions of the same day. |
| v1.0.1 | 2026-11-14 | OI-7 and its risk row: the device check moves from the first app coding task to the staging app build task, because coding agents run in the cloud without phones. No decision changed. |
