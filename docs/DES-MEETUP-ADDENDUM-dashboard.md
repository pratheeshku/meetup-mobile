# DES-MEETUP-ADDENDUM-dashboard

| Field | Value |
|---|---|
| Doc ID | DES-MEETUP-ADDENDUM-dashboard |
| Version | v1.0 |
| Status | APPROVED (architect approval 2026-09-29) |
| Current tier | T1 |
| Principles | Enterprise Design Principles v1.0 (P1-P17); design-best-practices v1.0 (BP-01 to BP-13) |
| Modifies | Nothing. Display-only addendum that supersedes the home screen layout in DES-MEETUP.md and DES-MEETUP-MOBILE.md (implementer verifies section numbers) |
| Platforms | Web desktop, web mobile, Android app. Backend + web: `~/meetup` (Claude Code). App: `~/Developer/meetup-mobile` (agy). iOS out of scope |
| Visual reference | Architect-only mockup canvas. This document and its appendices are the source of truth |

## Decision summary (plain language)

1. The home screen gets a blue and white banner with the app icon, notification bell with count, profile picture, and a greeting.
2. Sports, games and groups are shown with large, colourful icons and small text.
3. Order on phones: banner, next game, sport icons, My games (2), My groups (2), Recommended for you, then two shortcut tiles. Bottom bar stays as today, with "Tournaments" renamed "Games".
4. Desktop web gets a side navigation and a two-column layout with the same content.
5. This is a display change only. No new backend endpoints or data are expected.
6. Each section loads and fails on its own, so one failing call never blanks the screen.

## 1. Context

Users said the home screen feels dull. The current screen (baseline screenshot, 2026-09-29) has a ball-emoji header with the name "Meetup", a greeting, text sport pills, "Your Upcoming Games", "Recommended for You", a "My Games & Groups" pair of tiles, and a bottom bar of Home, Groups, a raised + button, Tournaments, Profile. Emoji icons vary by device and read as unfinished.

## 2. Architecture decisions

**AD-1 Order (phone web and app).** Banner; next-game card overlapping the banner; sports row; My games (2, View all); My groups (2, View all); Recommended for you (existing behaviour, retained); shortcut tiles (My games, My groups); bottom bar. Recommended for you is not in the mockup; it is an existing feature and must not be deleted. Its cards use the same row pattern as My games.

**AD-2 Icons.** One illustrated icon set as inline SVG (Appendix A). No emoji, no raster images, no icon-font dependency. Sport icons are chosen by sport slug. Unknown slugs use the generic ball icon.

**AD-3 App icon.** The implementer locates the existing Shuttlr icon in the repo (app: launcher icon source or app assets; web: PWA manifest icons or public directory), reports the path found, and renders it at 34x34 logical px inside a 46x46 white tile with 14px corner radius. No app name text beside it. If no usable icon is found, file a blocked report. Do not substitute the mockup's shuttlecock, which is a placeholder.

**AD-4 Display only.** Every element reads from existing sources (§5). If a section needs data the current endpoints cannot supply, file a blocked report. Do not add endpoints.

**AD-5 Rename.** The bottom bar label "Tournaments" becomes "Games". The destination stays whatever the tab opens today. If that destination is tournament-specific and not a games list, file a blocked report. The Tournaments shortcut tile is removed.

**AD-6 Typography.** Use each client's existing font. The mockup's typefaces are illustrative only, and no font dependency is added (avoids external font requests).

**AD-7 No duplicate game.** The next-game card shows the soonest upcoming game the user is registered for. My games shows the next two after it. Fewer results show fewer rows.

**AD-8 Group icon.** A Players Group shows the groups icon (groups have no sport column, DES-MEETUP-ADDENDUM-shareable-links Decision 16). A Tournament Team shows its sport icon. Group meta shows member count, plus sport only for teams.

**AD-9 Sport filter.** Same behaviour as today: chips come from the admin public sports list, "All" first, one selected at a time, filtering the games lists. The selected chip has a 2px brand-colour ring. Overflow scrolls horizontally.

**AD-10 Desktop.** Below 1024px use the phone layout, centred at a maximum width of 640px, with the bottom bar. At 1024px and above: left navigation rail (Home, Groups, Games, Profile, and a Create button at the top); the banner spans the content area as a rounded card; the app icon sits at the top of the rail; sports row full width; then two columns: left (7 of 12) next game, My games, Recommended for you; right (5 of 12) My groups and the two shortcut tiles side by side.

## 3. Tier and deferred decisions (BP-10)

| Deferred | Reason | Gate (upgrade when) |
|---|---|---|
| Dark mode | Not designed; light only at T1 | 10 or more user requests, or a Play review requesting it |
| Filter pre-selected from user skills | Existing blocked item, separate decision | Architect approves the sports-filter pre-select requirement |
| Animations and carousels | Not requested | Never without a request |

No-regret confirmation: all changes are display-only and additive. The icon set is a socket for new sports (add one entry).

## 4. Components

| Component | Behaviour |
|---|---|
| Banner | Height 208 on phone. Left: app icon tile. Right: bell (44px target, red count badge, hidden at zero) and profile picture (48px circle, 2px white ring). Below: greeting "Good to see you" and headline "Ready to play, {display name}?" Profile picture is the user's uploaded photo if present, otherwise today's default avatar |
| Next-game card | White card, radius 22, overlaps banner by 40px. Sport icon tile, "Next game" and day, title, time and venue, chevron. Tap opens game detail. Hidden when none, replaced by the existing empty message |
| Sports row | See AD-9. Tile 60x60 radius 20, icon 38px, label 11px |
| Section header | Title, and "View all" in brand colour |
| Game row | 44px sport icon tile, title, date and venue, right badge "x/y going". Tap opens game detail |
| Group row | See AD-8. Tap opens the group |
| Shortcut tiles | Two equal tiles: My games (gamepad icon, "{n} active") and My groups (groups icon, "{n} groups"). Counts are today's counts |
| Bottom bar | Home, Groups, raised + button, Games, Profile. Icons 30px, labels 11px, active label in brand colour and bold. + opens today's create flow |
| Desktop rail | Same destinations as the bottom bar. Create is a labelled button |

Navigation targets are unchanged: View all and tiles open the existing My Games and My Groups screens; the bell opens notifications; the avatar opens Profile.

## 5. Data contracts

**Sources (existing; names unverified, gate G1):** upcoming registered games; the user's games list and active count; the user's groups and count; admin public sports list (`GET /admin/sports/public`); recommended public games; notification unread count; profile picture URL; display name.

**Tokens (one theme module per client; P1):**

| Token | Value |
|---|---|
| brand | #1E5BD6 |
| brand-deep | #0B3FA8 |
| brand-light | #3B82F6 |
| page | #F5F8FF |
| card | #FFFFFF |
| card-border | #E3EAF8 |
| text | #0F2350 |
| text-muted | #5B6B8C |
| nav-inactive | #64748B |
| badge-red | #DC2626 |
| going-bg / going-text | #DCFCE7 / #166534 |
| radii | card 18-22, tile 20-22, chip 20, button-circle 50% |

Sport tile colours: badminton #DBEAFE, basketball #FFEDD5, football #DCFCE7, tennis #EDE9FE, All #F1F5F9, fallback #E2E8F0.

**Sport slug map:** badminton, basketball, football, tennis, plus fallback. Slug matching is case-insensitive on the admin sports slug. Adding a sport icon is one map entry.

**States (sentence case, no terminal punctuation on labels):**

| Section | Loading | Empty | Error |
|---|---|---|---|
| Next game | Skeleton card | "No upcoming games yet — join one below or create your own." | Inline "Couldn't load your games" with Retry |
| My games | 2 skeleton rows | Same message as above | Same as above |
| My groups | 2 skeleton rows | "You haven't joined any groups yet." | "Couldn't load your groups" with Retry |
| Recommended for you | 2 skeleton rows | "No public games to recommend right now." | "Couldn't load recommendations" with Retry |

**Data lineage:** each displayed value has one source: the same call that powers the matching screen today. Counts must match the destination screens.

## 6. Security

- No new data exposure. The banner shows only the signed-in user's own name and photo.
- The mobile number and any other PII never appear on this screen.
- Profile picture URLs come from the existing photo feature. No new bucket or policy changes here.

## 7. Failure modes

- Each section fetches independently (P7). One failure shows that section's error state only.
- Missing sport icon slug: generic ball icon. Missing profile photo: default avatar.
- Icon asset not found in the repo (AD-3): blocked report.
- Slow network: skeletons, never a blank page.

## 8. Observability

No new logging. Do not log display names or photo URLs. Client errors use the existing error reporting with correlation ID where present (P4).

## 9. Test requirements

Risk class: low (display only), medium for navigation and counts.

- Section order on phone and desktop breakpoints.
- Each section's loading, empty and error states, and that one failing section does not affect the others.
- Sport map: known slugs, unknown slug fallback, filter selection behaviour.
- Next game and My games never show the same game (AD-7).
- Group icon rule (AD-8).
- Counts on tiles equal the destination screen counts.
- Bottom bar label reads "Games" and no Tournaments tile appears.
- Web: verify the compiled `dist` bundle contains the new UI, not only the source.
- Accessibility: touch targets at least 44px, chips are buttons with pressed state, decorative icons hidden from screen readers, bell announces its count, text contrast at least 4.5:1.

The test suite is run once per implementation report.

## 10. Implementation phases

1. Shared assets per client: theme tokens and the icon set from Appendix A. Acceptance: icons render identically to the appendix at 24-48px.
2. Web (phone layout, then desktop layout). Acceptance: §9 web tests; PWA version constant bumped.
3. App. Adds `react-native-svg` at an exact pinned version if not already present (approved for this change). Acceptance: §9 app tests; no versionCode change by the agent.

Order: phases 2 and 3 are independent and use separate briefs.

## 11. Deployment and rollback

Web: PWA version bump; verify with an external request to the public URL. App: Play internal testing first. Rollback is a revert of the client change, since no backend or data changed.

## 12. Principles compliance

| Principle | Element |
|---|---|
| P1 | Tokens and icon map in one theme module per client |
| P4 | No PII in logs |
| P7 | Independent section failures |
| P13 | §9 negative and state tests |
| P14 | Display-only; the label rename does not change routes |
| P15 | Screen only reads the signed-in user's data via existing authorised calls |

No deliberate deviations from either reference file.

## 13. Requirements coverage

Design-only, no R-IDs. Basis: user feedback that the home screen feels dull, plus decisions made in the design review of 2026-09-29.

## 14. Open items

Non-blocking:
- N1 Gate G1: verify every data source, endpoint, screen name and doc section named above against live code before building.
- N2 Confirm what the Tournaments tab opens today (AD-5). Blocked report if it is tournament-specific.
- N3 Sport icons beyond badminton, basketball, football and tennis use the fallback until added.

## Appendix A: icon set (viewBox 0 0 48 48, use verbatim)

Badminton:
```svg
<path d="M17 33L9 9c6-3 24-3 30 0l-8 24z" fill="#FFFFFF" stroke="#64748B" stroke-width="1.6" stroke-linejoin="round"/><path d="M20.5 33L15.5 9M24 33V7M27.5 33L32.5 9" stroke="#94A3B8" stroke-width="1.4"/><path d="M10.5 14c8.5-2.4 18.5-2.4 27 0" stroke="#94A3B8" stroke-width="1.4" fill="none"/><ellipse cx="24" cy="37.5" rx="7.5" ry="6" fill="#EF4444"/><path d="M17 34.5h14" stroke="#B91C1C" stroke-width="1.4"/>
```
Basketball:
```svg
<circle cx="24" cy="24" r="20" fill="#F97316"/><path d="M24 4v40M4 24h40" stroke="#7C2D12" stroke-width="2"/><path d="M9.5 9.5c7 5 7 24 0 29M38.5 9.5c-7 5-7 24 0 29" stroke="#7C2D12" stroke-width="2" fill="none"/><circle cx="24" cy="24" r="20" fill="none" stroke="#7C2D12" stroke-width="2"/>
```
Football:
```svg
<circle cx="24" cy="24" r="20" fill="#FFFFFF" stroke="#1F2937" stroke-width="2"/><path d="M24 15l8 5.8-3 9.4H19l-3-9.4z" fill="#1F2937"/><path d="M24 15V6M32 20.8l8.5-2.8M29 30.2l5.3 7.2M19 30.2l-5.3 7.2M16 20.8l-8.5-2.8" stroke="#1F2937" stroke-width="2" stroke-linecap="round"/><path d="M18.5 5.5L24 4l5.5 1.5L28 10h-8z" fill="#1F2937"/><path d="M5 18l4.5-3.5 3.5 4-1.5 5.5H5.2z" fill="#1F2937"/><path d="M43 18l-4.5-3.5-3.5 4 1.5 5.5h5.8z" fill="#1F2937"/>
```
Tennis:
```svg
<circle cx="24" cy="24" r="20" fill="#D9F04A"/><path d="M7 12c8 4 8 20 0 24M41 12c-8 4-8 20 0 24" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="24" cy="24" r="20" fill="none" stroke="#A3B825" stroke-width="1.5"/>
```
All:
```svg
<rect x="6" y="6" width="16" height="16" rx="4" fill="#3B82F6"/><rect x="26" y="6" width="16" height="16" rx="4" fill="#22C55E"/><rect x="6" y="26" width="16" height="16" rx="4" fill="#F97316"/><rect x="26" y="26" width="16" height="16" rx="4" fill="#A855F7"/>
```
Fallback ball:
```svg
<circle cx="24" cy="24" r="20" fill="#94A3B8"/><path d="M4.5 20c12 5 27 5 39 0" stroke="#FFFFFF" stroke-width="2.5" fill="none"/><circle cx="24" cy="24" r="20" fill="none" stroke="#64748B" stroke-width="1.5"/>
```
Home:
```svg
<path d="M9 23l15-13 15 13v17H9z" fill="#FDE68A"/><path d="M5 25L24 8l19 17" stroke="#DC2626" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="20" y="28" width="8" height="12" rx="2" fill="#B45309"/><rect x="12" y="27" width="6" height="6" rx="1" fill="#60A5FA"/><rect x="30" y="27" width="6" height="6" rx="1" fill="#60A5FA"/>
```
Groups:
```svg
<circle cx="32" cy="15" r="6" fill="#EC4899"/><path d="M21 39c0-6.5 4.5-10.5 11-10.5s11 4 11 10.5z" fill="#EC4899"/><circle cx="18" cy="17" r="7" fill="#6366F1"/><path d="M5 40c0-8 5.5-12.5 13-12.5S31 32 31 40z" fill="#6366F1"/>
```
Games (gamepad):
```svg
<path d="M12 14h24a9 9 0 0 1 9 9v6a7 7 0 0 1-12 5l-4-4H19l-4 4a7 7 0 0 1-12-5v-6a9 9 0 0 1 9-9z" fill="#334155"/><path d="M15 20v8M11 24h8" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/><circle cx="33" cy="21" r="2.4" fill="#F87171"/><circle cx="38" cy="26" r="2.4" fill="#4ADE80"/><circle cx="28" cy="26" r="2.4" fill="#FACC15"/><circle cx="33" cy="31" r="2.4" fill="#60A5FA"/>
```
Profile:
```svg
<circle cx="24" cy="16" r="8" fill="#F59E0B"/><path d="M8 43c0-9.5 7-15 16-15s16 5.5 16 15z" fill="#0EA5E9"/>
```

## Appendix B: banner background (viewBox 0 0 390 208, clipped to the banner, decorative)

```svg
<circle cx="340" cy="40" r="120" fill="#3B82F6" fill-opacity="0.45"/><circle cx="385" cy="170" r="70" fill="#93C5FD" fill-opacity="0.25"/><circle cx="-10" cy="208" r="110" fill="#0B3FA8" fill-opacity="0.4"/><g stroke="#FFFFFF" stroke-opacity="0.2" stroke-width="1.5" fill="none" transform="rotate(-16 285 110)"><rect x="205" y="30" width="160" height="200" rx="6"/><path d="M205 96h160"/><path d="M205 164h160"/><path d="M285 30v66M285 164v66"/></g>
```
Banner base fill is brand (#1E5BD6), bottom corners radius 32 on phone; on desktop the whole banner is a card with radius 28. White text on the banner sits on brand or brand-light only.
