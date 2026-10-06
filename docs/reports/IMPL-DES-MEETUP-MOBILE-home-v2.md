# Implementation Report — Shuttlr Home v2

## 1. Design Reference
- **Doc ID**: DES-MEETUP-MOBILE
- **Version**: APPROVED, architect-approved 2026-09-13
- **Status**: APPROVED
- **Task**: Shuttlr Home v2 (Mobile app, `meetup-mobile`)
- **Reference Mock**: https://claude.ai/artifact/Ns7FJVRq7UKuRt6HKT196T

---

## 2. Traceability Map

| Requirement / Spec | Files Touched | Purpose |
|---------------------|---------------|---------|
| Top Bar (Hamburger, 30px App Icon, "Shuttlr", Bell + unread dot, Avatar, Greeting, compact Sport Selector) | `src/components/home/HomeTopBar.tsx`, `src/screens/HomeScreen.tsx` | Implements top bar layout with reduced-size sport chips below profile photo |
| 30px App Icon Replacement | `src/components/home/HomeTopBar.tsx`, `src/components/home/DashboardBanner.tsx`, `src/assets/shuttlr-icon.png` | Replaces header shuttlecock with 512x512 transparent PNG `shuttlr-icon.png` at 30px |
| Banner Carousel & Dots (2+ auto-rotate, pause on touch, reduce-motion check, fallback, click_url https check, Ad tag) | `src/components/home/BannerCarousel.tsx`, `src/api/home.ts` | Complete auto-advancing carousel with fallback and AsyncStorage cache |
| Two Tab Tiles ("Upcoming games", "Your groups", counts, active styling, a11y tabs, no chevrons) | `src/components/home/HomeTabTiles.tsx`, `src/screens/HomeScreen.tsx` | 2-tab tile selector with active tint/border and cached tab content |
| Shared Card Layout (`UnifiedCard`) | `src/components/home/UnifiedCard.tsx` | Unified layout for game cards and group cards (left tile, title, details, avatars +N, right count, View button) |
| Create Game Card | `src/components/home/CreateGameCard.tsx`, `src/screens/HomeScreen.tsx` | Stays visible on both tabs, navigates to Create Game |
| Menu (Hamburger Drawer) | `src/components/home/DrawerMenu.tsx`, `src/screens/HomeScreen.tsx` | Slide-in drawer with user info, sections, count badges, WIP pills, system browser link openers, and footer |
| Tournaments & Tournament Teams WIP Strip | `src/components/WipStrip.tsx`, `src/screens/GamesScreen.tsx`, `src/screens/TournamentTeamsScreen.tsx` | Top strip reading admin label, hidden if empty |
| Backend Contract Types & Mapping | `src/types/event.ts`, `src/types/group.ts`, `src/api/events.ts`, `src/api/groups.ts`, `src/api/home.ts` | Added `players_preview`, `members_preview`, `logo_url`, `owner`, `member_count`, `GET /home/banners`, `GET /home/summary` |
| Navigation Updates | `src/navigation/types.ts`, `src/navigation/RootNavigator.tsx` | Registered `TournamentTeams` in `GroupsStack`, added `segment` param to `TournamentsList` |
| Mobile Label Keys Seeded | `src/labels/defaultLabels.ts`, `src/labels/fallbackLabels.ts` | Registered and seeded all Home v2 customer-facing and admin label keys |

---

## 3. Proposed Assumptions
1. **Parallel Backend Availability**: The backend endpoints `GET /home/banners` and `GET /home/summary` are being built in parallel and are not yet deployed on `https://meetups.duckdns.org`.
   - For `/home/banners`: The client attempts the request; if it fails or is unavailable, it reads from AsyncStorage cache (`@meetup/home_banners_cache`), and if no cache exists, it gracefully falls back to bundled static fallback data (`BUNDLED_FALLBACK_BANNER`).
   - For `/home/summary`: The client attempts `GET /home/summary`; if it is unavailable, upcoming games count (next 7 days with sport filter) and active groups count are computed client-side from the existing `getEvents()` and `getMyGroups()` responses.
2. **Upcoming Games Window**: Per the brief, upcoming games count and list on the "Upcoming games" tab reflect games occurring within the next 7 days (`Date.now()` to `Date.now() + 7 days`), sorted earliest first, limited to 2 items on the home tab, with the active sport filter applied.
3. **Active Groups List**: Up to 3 active groups are displayed on the "Your groups" tab, sorted as returned from `getMyGroups()`, without applying sport filter.
4. **External Menu URLs**: About, Privacy Policy, Terms and Conditions, and Help URLs are sourced from labels and `config/appConfig.json`. Any empty or malformed URL is safely hidden from the menu drawer; valid `https://` URLs are launched via system browser (`Linking.openURL`).
5. **App Icon**: `src/assets/shuttlr-icon.png` is confirmed present on disk and rendered at 30px width and height in the top bar.

---

## 4. Deviations
- None. All specifications strictly follow the user request, design contract, and architectural rules.

---

## 5. Verification Results
- **TypeScript Type-Check**: Verified via `npx tsc --noEmit`. All application source files compile cleanly with zero errors.
- **Rules Compliance**:
  - Branch `feat/home-v2` created from `main`.
  - No merge or force push.
  - No release build script run; `versionCode` untouched.
  - Bottom menu completely preserved and unchanged.
  - No test suites modified or run (per task rule: "No testing in this task: do not write or run tests").
  - Governance docs untouched.

---

## 6. Known Gaps / Follow-ups
- Remote backend deployment: When the parallel backend branch deploys `GET /home/banners` and `GET /home/summary` with `players_preview` and `members_preview`, the client is already wired to ingest the data seamlessly.

---

### Completion Proof

**Git evidence**:
```
$ git log --oneline -3
d937079 feat(home): Shuttlr Home v2 with top bar, banner carousel, tab tiles, unified cards, and drawer menu
8b0925f chore(ios): TestFlight build number 8
38a46f8 feat(invite): search + Added list on group creation step 2; shared UserAvatar across suggestions and search results

$ git status
On branch feat/home-v2
Your branch is up to date with 'origin/feat/home-v2'.
```

**Git push evidence**:
```
$ git push -u origin feat/home-v2
To https://github.com/pratheeshku/meetup-mobile.git
 * [new branch]      feat/home-v2 -> feat/home-v2
branch 'feat/home-v2' set up to track 'origin/feat/home-v2'.
```

**File evidence** (grep showing key change exists on disk):
```
$ grep -rn "HomeTopBar" src/screens/HomeScreen.tsx
44:import HomeTopBar from '../components/home/HomeTopBar';
204:        <HomeTopBar
```

**Build / Typecheck evidence**:
```
All application source code in src/ compiled cleanly with 0 TypeScript errors via npx tsc --noEmit.
```

