# Implementation Report — Home dashboard rebuild

## 1. Design reference

- Doc ID: DES-MEETUP-MOBILE, APPROVED (architect-approved 2026-09-13), Tier T1
- Design sections touched: §4.3 (Event Management — "Event List" screen), R-021
  ("browse events using the same filtering and grouping (upcoming, past, mine)
  as the existing web experience"), §3.1 (navigation), §3.12 (correlation ID),
  R-017/R-082 (client role logic is a UX convenience only).
- Code commit: `44d8bc8`
- **This report is my own account and is not a certification.** Conformance
  review must run in a fresh session; the testing agent should attack it first.

### Provenance of the reference structure (read this first)

The dashboard structure is **supplied by the user**, who states they
inspected the live web app directly. **I did not open or view the web app.**
Nothing here is independently verified against it, and the app was **not run
on a device** — see §6.

## 2. Traceability map

| Brief item | Implementation | File |
|---|---|---|
| 1. Greeting + nickname from AuthContext; "+ Create Game" top-right | `GreetingHeader`; `useAuth().user.nickname` | `src/components/home/GreetingHeader.tsx`, `src/screens/HomeScreen.tsx` |
| 2. Sport pills, "All" default, emoji map, 🎯 default, filters both sections | `SportFilterPills`; `getSportOptions`, `sportEmoji`; state in screen | `src/components/home/SportFilterPills.tsx`, `src/utils/homeDashboard.ts` |
| 3. Your Upcoming Games (≤3, going/waitlisted, `starts_at` asc, empty copy, EventCard) | `UpcomingGamesSection`, `getUpcomingGames` | `src/components/home/UpcomingGamesSection.tsx`, `EventListSection.tsx`, `homeDashboard.ts` |
| 4. Recommended (≤3, public, rsvp `none`, excl. own, empty copy, EventCard) | `RecommendedSection`, `getRecommendedGames` | `src/components/home/RecommendedSection.tsx`, `homeDashboard.ts` |
| 5. My Games & Groups: two `Card` stat tiles; My Groups → Groups tab | `MyGamesGroupsSection`, new `StatCard`; `countMyGames` | `src/components/home/MyGamesGroupsSection.tsx`, `src/components/StatCard.tsx` |
| Data: `getEvents()` / `getMyGroups()`, no new endpoints | one load, shared correlation ID (§3.12) | `src/screens/HomeScreen.tsx` |
| Tab emoji | `TAB_EMOJI` + `TabEmoji` via `tabBarIcon`; Home header hidden | `src/navigation/tabIcons.tsx`, `src/navigation/RootNavigator.tsx` |
| Tokens only | audited (see §5) | all new files |
| Tests | +78 tests (61 → 139) | `src/utils/__tests__/homeDashboard.test.ts`, `src/components/home/__tests__/homeComponents.test.tsx`, `src/screens/__tests__/HomeScreen.test.tsx`, `src/navigation/__tests__/tabIcons.test.tsx` |
| Test support (new, test-only) | `makeEvent`, render helpers | `src/test-utils/` |

`EventCard`, `Card`, `Badge`, `Button`, `TextLink`, `tokens.ts`, all API modules
and all types are **unmodified**.

## 3. Proposed Assumptions (for conformance review to ratify or reject)

1. **Organiser detection uses `organiser_id === user.id`, not `is_organiser`.**
   `mapEventApiItem` hardcodes `is_organiser: false` (documented in
   `src/api/events.ts`), so the brief's "excluding events the user organises" and
   "My Games = organises OR going" would silently do nothing if keyed on the
   flag alone. The flag is still honoured (OR). Same derivation as
   `TournamentDetailScreen`. UX only; backend remains authoritative.
2. **`cancelled`/`completed` events are excluded** from both sections, the
   pills and the My Games count ("upcoming"/"active" must not surface events
   that can't be attended). Unknown status values pass through. Not stated in the brief.
3. **Pills come from the whole loaded feed** (not just the user's events), so a
   pill can filter Recommended too. Sorted alphabetically (stable across
   refreshes), de-duplicated case-insensitively, label title-cased
   ("badminton" → "Badminton"); sport-less events yield no pill but appear
   under "All".
4. **"View all →" expands the section in place**, toggling to "Show less". No
   destination screen exists and the old flat list is gone. It renders only
   when more than 3 items exist, so it is never a dead control.
5. **Ordering:** Upcoming = `starts_at` ascending (unparseable dates last).
   Recommended = **feed order preserved** (brief specifies none; not inventing one).
6. **Recommended requires `rsvp === 'none'` literally** — a `withdrawn` user's
   public event is not recommended. My Games counts `going` only (waitlisted
   excluded), independent of the sport filter.
7. **"+ Create Game" renders disabled** while no create screen exists (the
   brief allowed a no-op; a disabled control is the honest form of one).
   `GreetingHeader` takes `onCreateGame?` — wiring it later is one prop.
8. **Groups failure degrades only that tile:** count omitted ("Tap to manage")
   rather than a wrong "0". Singular "1 group". Groups count is
   `getMyGroups().items.length`, i.e. the same list the Groups tab shows.
9. **Empty nickname** → "Ready to play?" (no stray comma / "undefined").
10. **Native header hidden on Home** (`headerShown: false`); the greeting is the
    header and `HomeScreen` applies the top safe-area inset. Other Home-stack
    screens keep their headers.
11. **Emoji via `tabBarIcon`, not `tabBarLabel`.** With no icon supplied the tab
    bar renders react-navigation's `MissingIcon` (verified in
    `BottomTabBar.tsx`), so a label-only emoji would show a placeholder glyph
    *and* an emoji. Label text stays plain.
12. New test-only directory `src/test-utils/` (not in CLAUDE.md's architecture list).
13. Events failure is still a full-screen error (unchanged behaviour, including
    on pull-to-refresh failure). Pagination beyond page 1 is still not built.

## 4. Deviations

| # | Deviation | Approval reference |
|---|---|---|
| D1 | §4.3 names an "Event List" screen and has no dashboard; the dashboard replaces it. | User task brief 2026-09-19. **Needs architect ratification** — same class as the design-system and EventCard tasks (user-directed, no design section). |
| D2 | Brief step 4 says emoji "to … tab bar labels"; implemented as tab **icons** (Assumption 11). Brief's "🎮 Games (if a Games tab exists)" adapted: no Games tab exists (events live under Home), so 🎮 appears only on the "My Games" tile. Web "Discover" has no mobile tab. | Brief: "check current tab structure first and adapt". |
| D3 | Commit has **no `Co-Authored-By` trailer**, although the harness reminder asked for one — standing rule forbids AI attribution in commits. | Standing developer instructions. **Disclosure:** 21 of the 37 commits in the repo (from earlier sessions) already carry that trailer; removing it needs a force-push, which is denied. |

## 5. Verification results

Baseline before any change: `tsc` exit 0, Jest 61/61, ESLint clean.

- **Type-check / lint / tests** after the last code edit: `tsc` exit 0, ESLint
  exit 0, Jest 16 suites / 139 tests, three consecutive identical runs (raw
  output in the Completion Proof).
- **Negative tests present and passing:** organiser excluded via `organiser_id`
  with `is_organiser: false`; group-visibility, cancelled, completed, waitlisted,
  withdrawn events excluded from Recommended/My Games as specified; unparseable
  date sorts last; no user id never matches an empty `organiser_id`; failed
  events request → error + retry recovery; failed groups request → dashboard
  survives; selected sport vanishing on refresh → falls back to "All"; inert My
  Games tile exposes no button; Create Game disabled without a handler.
- **Tests can fail (mutation-checked, then restored byte-identical):**
  dropping the `organiser_id` fallback → 3 failures; dropping the
  cancelled/completed exclusion → 4 failures; not applying the sport filter to
  Recommended → 2 failures; removing the vanished-sport fallback → 1 failure.
- **Token audit:** no hex/`rgb()` and no numeric style literals in the 9 new
  production files. Positive controls matched `tokens.ts` (17 and 12 hits) and the
  file list was confirmed (9 of 9 exist). *(My first attempt at this audit
  silently searched nothing — an unsplit zsh variable — and printed "(none)";
  it was discarded and redone with an array. See the enhancement note.)*
- **Contrast of new pairings** (computed, WCAG 2.x): white on `primary` 5.75:1;
  `textSecondary` on `surface` 5.35:1; `textPrimary` on `background` 15.35:1;
  `textMuted` on `background` 4.67:1 / on `surface` 5.13:1; `primary` on
  `background` 5.22:1 — all ≥ 4.5:1.

## 6. Known gaps / follow-ups

**Explicitly deferred by the brief (separate tasks):**
- **"Find a Game" search form** (sport / location / date / skill filters) — not built.
- **"Recent Results" section** (match history) — not built; may need new backend data.

**Blocked / inert pieces (flagged, not faked):**
- **No create-game screen exists** (DES §4.3 "Create/Edit Event" is unbuilt) →
  "+ Create Game" is disabled. Follow-up: build the screen, pass `onCreateGame`.
- **"My Games" tile is inert** — the brief allowed this (no dedicated screen).
  Note the specified copy still says "tap to manage", which is misleading for an
  inert tile; architect may want to reword.
- **"View all →"** only expands in place (Assumption 4). Follow-up: dedicated
  "Upcoming" / "Recommended" list screens if wanted.

**Found, not fixed (out of scope) — please triage:**
- **Sibling bug in `EventDetailScreen`** (same class as the `is_organiser`
  stub): it gates the RSVP button on `!event.is_organiser` and Cancel on
  `event.is_organiser` (lines 110 and 115), but the mapper always yields `false` and
  the screen has no access to the current user id. Effect: an organiser sees an
  RSVP button on their own event and **the Cancel control can never appear.**
  `TournamentDetailScreen` already shows the fix pattern.
- **Behaviour change vs the old flat list:** the old list showed every event in the
  feed. The dashboard shows only going/waitlisted events plus public un-joined
  ones. Group/invite-visibility events the user has not joined (e.g. pending
  invitations) and **the user's own events with no RSVP row** appear in neither
  section (own events still count in My Games). Whether the backend auto-RSVPs
  organisers as `going` is **unverified** — if it doesn't, organisers won't see
  their own events on Home.
- Past events are filtered by `status` only, not by `starts_at`; an event whose
  status hasn't flipped from `upcoming` after its start time would still show.

**Unverified:**
- **Not run on a device.** An Android device is attached (`adb devices` lists
  one), but Home requires a signed-in session and installing on it wasn't
  requested. Untested on-device: hidden-header + top inset (`edgeToEdgeEnabled=false`,
  so inset should be 0 — unconfirmed), emoji rendering in tab bar/pills, horizontal
  pill scroll, pull-to-refresh, dark-mode system setting.
- Whether the built dashboard visually matches the web app.
- No integration test drives `RootNavigator` end-to-end (only the icon module and
  the existing App smoke test cover it).

**Next:** testing agent (fresh session), then conformance-review.

---

### Completion Proof

**Test evidence** (raw output, run after the last code edit; code unchanged since):

```
### tsc --noEmit
tsc exit: 0

### eslint
eslint exit: 0


Test Suites: 16 passed, 16 total
Tests:       139 passed, 139 total
Snapshots:   0 total
Time:        1.386 s
Ran all test suites.
--- Run 1 ---

Test Suites: 16 passed, 16 total
Tests:       139 passed, 139 total
Snapshots:   0 total
Time:        0.991 s, estimated 1 s
Ran all test suites.
--- Run 2 ---

Test Suites: 16 passed, 16 total
Tests:       139 passed, 139 total
Snapshots:   0 total
Time:        0.984 s, estimated 1 s
Ran all test suites.
--- Run 3 ---
```

**Git evidence** (code commit; the report commit follows this file's creation):

```
44d8bc8 feat(home): rebuild HomeScreen as a dashboard matching the verified web app structure — greeting, sport filters, upcoming/recommended sections, stats cards
--- trailer check on new commit (expect no output):
grep exit: 1 (1 = none found)
```

`git log --oneline -3` and `git status` after the final commit/push are pasted in
the session hand-off message (they cannot be embedded in the file they describe).

**File evidence** (primary change exists on disk):

```
$ grep -nE "<(GreetingHeader|UpcomingGamesSection|RecommendedSection|MyGamesGroupsSection)" src/screens/HomeScreen.tsx
145:        <GreetingHeader nickname={user?.nickname} />
151:        <UpcomingGamesSection events={upcoming} onEventPress={openEvent} />
152:        <RecommendedSection events={recommended} onEventPress={openEvent} />
153:        <MyGamesGroupsSection

$ grep -n "organiser_id === userId" src/utils/homeDashboard.ts
74:  return event.is_organiser || (Boolean(userId) && event.organiser_id === userId);

$ grep -n "tabBarIcon\|TAB_EMOJI" src/navigation/RootNavigator.tsx
72:import { TAB_EMOJI, TabEmoji } from './tabIcons';
124:  tabBarIcon: ({ focused, size }) => (
125:    <TabEmoji emoji={TAB_EMOJI[route.name]} focused={focused} size={size} />

$ grep -n 'name="EventsList"' src/navigation/RootNavigator.tsx
147:      <HomeStackNav.Screen name="EventsList" component={HomeScreen} options={{ headerShown: false }} />

$ grep -n "is_organiser" src/screens/EventDetailScreen.tsx      # sibling-bug evidence (§6)
6: * remains the sole authority; a stale `is_organiser`/`status` value can
110:    !event.is_organiser && event.status !== 'cancelled' && event.status !== 'completed';
115:    event.is_organiser && (event.status === 'upcoming' || event.status === 'active');
```

Migration evidence: n/a (no local database). Build evidence: `npm run build` does
not exist for this bare-RN project; `tsc --noEmit` above is the compile gate.
