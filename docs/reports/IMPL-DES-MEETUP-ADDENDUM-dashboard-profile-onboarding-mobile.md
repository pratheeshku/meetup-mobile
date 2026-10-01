# Implementation Report — Mobile dashboard, Games tab, mobile number and first-run flow

Not self-certified. This report is the mandatory input to a fresh-session conformance review.

## 1. Design reference

| Doc | Version | Status | Tier |
|---|---|---|---|
| DES-MEETUP-ADDENDUM-dashboard.md | v1.4 | APPROVED | T1 |
| DES-MEETUP-ADDENDUM-profile-onboarding.md | v1.3 | APPROVED-WITH-WAIVERS | T1 |

Branch `feat/mobile-dashboard-onboarding`, from `origin/main` (cf21673 after the docs-only merge of the v1.4/v1.3 addenda). Android only. No merge to main, no `build-release-aab.sh`, `versionCode` untouched (`android/version.properties` has a pre-existing uncommitted change that was never staged).
Step flags used: `NOTIFICATION_STEP: ENABLED`, `PHOTO_STEP: OMIT`.

## 2. Traceability map

| Design item | Files | Commit |
|---|---|---|
| Dashboard AD-1 order, §4 components | `src/screens/HomeScreen.tsx`, `src/components/home/*` | 162b644 |
| AD-2 icons, Appendix A/B | `src/components/icons/DashboardIcons.tsx` (one module; `react-native-svg` already a dependency, not changed) | 162b644 |
| §5 tokens (one module) | `src/theme/dashboardTheme.ts` | 162b644 |
| AD-3 banner icon | `src/assets/shuttlr-icon.png`, `DashboardBanner.tsx` | 162b644 |
| AD-5 / AD-15 Games tab | `src/screens/GamesScreen.tsx`, `src/components/SegmentedSwitch.tsx`, `src/components/TournamentsListContent.tsx` (moved from `TournamentsScreen`, content unchanged), `src/navigation/{RootNavigator,tabIcons,types}.ts(x)` | 162b644 |
| AD-7 / AD-14 list rules, AD-9 chips (ONE shared module) | `src/utils/gameLists.ts`, `src/hooks/useSportFilter.ts`, `src/hooks/useResource.ts` | 162b644 |
| AD-8 group icon rule | `src/components/home/GroupRow.tsx` | 162b644 |
| AD-12 photo, AD-13 greeting | `DashboardBanner.tsx` (photo via `getProfile().avatar_url`) | 162b644 |
| Onboarding AD-9 country picker | `src/components/MobileNumberInput.tsx`, `src/utils/phoneNumber.ts`, `src/hooks/useMobileNumberConfig.ts` | 8cbdf8c |
| AD-1/AD-3 number save, 409/422 | `src/hooks/useMobileNumberSave.ts`, `src/api/mobileNumber.ts` | 8cbdf8c |
| §4.3 Profile screen | `src/components/MobileNumberCard.tsx`, `ProfileScreen.tsx` | 8cbdf8c |
| §4.3 / AD-4 first-run flow | `src/screens/OnboardingScreen.tsx`, `src/onboarding/steps.ts`, `src/components/onboarding/*`, `src/navigation/OnboardingOverlay.tsx`, `src/hooks/useOnboardingRequired.ts`, `src/api/onboarding.ts` | 8cbdf8c |
| D11 shared notification component | `src/components/NotificationPreferencesList.tsx` (used by Settings and the onboarding step) | 8cbdf8c |
| **NOT built:** §4.3 Registration screen field | — | blocked, see §6 |

## 3. Proposed Assumptions

1. **Tile "My games" count** = size of the AD-14 My games set (hosted + going + waitlisted, future only). Previously organised-or-going, not future-filtered. The brief says "today's counts"; AD-14 overrides today's rule.
2. **Next game, My games, Recommended share one `GET /events` call** (as before). They fail and retry together, each showing its own section copy. Groups, sports and profile are independent.
3. **Banner photo and skill sports come from `getProfile()`** (one call that includes `getSkillLevels()`), replacing the former direct `getSkillLevels()` call.
4. **Sports row spread/scroll** is a horizontal `ScrollView` with `flexGrow: 1` + `justifyContent: 'space-between'`. The test renderer does not run layout, so tests assert the style props, not measured positions.
5. **Shared dial code**: country = what libphonenumber resolves for the number if listed (+44 7700… -> GB); else the only country with that code; else, if several share it, the default country when it is one of them, otherwise the first of them. A literal "fall back to the default" would show `SG +65` for a stored `+1…` number and silently change it on re-save, so the dial code is kept consistent. Needs architect confirmation.
6. **Client validation uses `isPossible()`** (looser than `isValid()`); the server is the validator.
7. **Notification step Save only advances** (toggles already save immediately, as in Settings).
8. **Photo step UI is not built** (flag OMIT). The step id stays in the ordered constant; `OnboardingScreen` filters it out, so flipping the flag alone does not add a photo step.
9. **First-run check calls `GET /users/me` itself** (8 s timeout, fail-open) instead of trusting the auth-response user, whose login/OAuth responses are undeclared in OpenAPI.
10. **Interstitial is an opaque overlay** over the app (navigation state and notification deep links stay intact), not a replacement navigator.
11. **Tab route name stays `Tournaments`** (notification routing and the create flow navigate to it); its label is "Games" and `TournamentsList` now hosts `GamesScreen`.
12. **AD-14 excludes only `cancelled`** (literal). The old code also excluded `completed`.
13. **Bell is drawn from Views**: Appendix A has no bell icon and emoji are forbidden.
14. **Withdrawn games** (`rsvp = withdrawn`) are neither My games nor Open, so they have no badge and are not listed.

## 4. Deviations

None approved or taken beyond the Proposed Assumptions above. No design document was edited.

## 5. Verification results

### 5.1 Endpoint probes / contract check (no login, no tokens)

```
$ curl -s https://meetups.duckdns.org/openapi.json  (parsed with python3)
PrivateUserProfile {'mobile_number': True, 'onboarding_required': True}
UserUpdate {'mobile_number': True, 'mobile_consent_version': True}
SignupRequest {'mobile_number': True, 'mobile_consent_version': True}
CountryCodeResponse {'iso2': True, 'name': True, 'dial_code': True}
ConsentResponse {'version': True, 'text': True}
/users/me ['get', 'patch']
/users/me/onboarding/complete ['post']
/public/country-codes ['get']
/public/consent/mobile-number ['get']
/auth/signup ['post']
/auth/register NOT IN OPENAPI
/users/me/avatar ['delete', 'post']

$ curl -s https://meetups.duckdns.org/public/consent/mobile-number
{"version":"mobile-consent-v1","text":"Optional. Meetup administrators may call you on this number if, for example, you accept an event invitation but do not attend. It is not shown to other users. You can remove it at any time in Profile."}
$ curl -s https://meetups.duckdns.org/public/country-codes | first 2 rows + count
[{'iso2': 'SG', 'name': 'Singapore', 'dial_code': '+65', 'sort_order': 1, 'enabled': True}, {'iso2': 'AF', 'name': 'Afghanistan', 'dial_code': '+93', 'sort_order': 2, 'enabled': True}]
rows: 245 first: SG +65

$ curl -s -o /dev/null -w "%{http_code}" -X POST https://meetups.duckdns.org/auth/register -d {}
405
$ ... /users/me (no token)
{"detail":"Missing authentication token"} 401
```

Every contract item listed in the brief matches. `GET /users/me` was verified through the OpenAPI schema (`PrivateUserProfile.mobile_number`, `.onboarding_required`), not a live authenticated call.

### 5.2 Icon

- Path in repo: `src/assets/shuttlr-icon.png` (copied from `~/Downloads/shuttlr-icon.png`; the repo had no assets folder, so `src/assets/` was created). 192x192 RGBA PNG.
- SHA-256: `ced9abb8fd7f1d7f5247b34082f35ea4521044759150404f7fe7b2e5e53e22c7`
- Architect's expected hash: `c6b45fa6e5b565cb2ad4cf8da2fc49e49db58784ad9a03b6329c29828d11c054`
- **They differ.** Per the brief I continued with `shuttlr-icon.png`; the architect decides. The launcher foreground layer was not used.
- Rendered at 34x34 inside a 46x46 white tile, radius 14, no name text (asserted by `homeComponents.test.tsx`).

### 5.3 Differences found against the AD-14 rules (today's behaviour vs rules)

1. My games excluded **waitlisted** games (`isMyGame` = organiser or going). Now included.
2. No **future-only** rule: only `cancelled`/`completed` were dropped, so past games still listed. Now future-only.
3. The old "Your Upcoming Games" list was going/waitlisted only and left out hosted games unless RSVP'd. Replaced by AD-14 My games.
4. **No `created_at` tie-break**; `created_at` was returned by the API but never mapped onto `Event`. Now mapped and used.
5. Recommended kept feed order (no sort). Now sorted by start time, then `created_at`.
6. Sections showed up to **3** rows (`MAX_SECTION_ITEMS`) and "View all" expanded in place. Now 2 rows, and View all opens the Games screen with the right scope.
7. The old "My Games" filtered view (`EventsList` param `filter: 'mine'`) was removed (replaced by the Games screen, scope Mine).
8. **Can a declined game reappear under `rsvp === 'none'`?** Not if the backend returns a non-`none` status for it (the type has `none | going | waitlisted | withdrawn`; there is no `declined` value). But the mapper turns `user_rsvp_status: null` into `'none'`, and `EventResponse` has no invitation-status field. If a declined *invitation* comes back as `null`, that game **would reappear** in Recommended. I could not verify what `GET /events` returns for a declined invite (no credentials; `RSVPRequest.action` is an undeclared string). Needs a backend check.

### 5.4 Orphan sections (AD-11)

- "My Games & Groups" heading: real (backed by the two counts) but redundant; removed. The new tiles section has no heading.
- "Recent Results": **not found anywhere in the app** (never existed in mobile).
- "Your Upcoming Games": replaced by the next-game card.
- Every remaining heading (My games, My groups, Recommended for you) always has rows, an empty text, a skeleton or an error under it (asserted in `HomeScreen.test.tsx`).

### 5.5 G1 mismatches

1. Tournaments tab opened a tournaments-only list (original blocked report) — resolved by v1.4 AD-5/AD-15.
2. **`POST /auth/register` does not exist in the live OpenAPI.** The app (`src/auth/emailAuth.ts`) and `DES-MEETUP-MOBILE.md` §7 call it; a live POST returns 405. The backend route is `POST /auth/signup`, which also requires `display_name` and `nickname` and has an undeclared response schema. Email registration from the app appears broken today. **Registration-screen number field not built (BLOCKED).**
3. `Event.is_organiser` is a stub (known); organiser checks use `organiser_id`.
4. `getMyGroups()` returns no member count and no team/sport data: group rows show no member count, and the team-sport-icon path (AD-8) is built but has no data source.
5. `Sport` carried no `slug`; added from the existing response.
6. `Event.created_at` existed on the wire but was unmapped; added.
7. Icon hash mismatch (5.2).

### 5.6 Tests

Single full run (the brief's "run once" overrides the 3-run loop in the shared Completion Proof format). A baseline run was also taken on the untouched base commit, in a separate git worktree, only to get "before" coverage. Development used targeted per-file runs; nothing besides the baseline and the final run was a full run, except one full run after Part A to check nothing else broke.

Baseline (before, base commit 73ea6b2 + docs):

```
Statements   : 88.59% ( 2393/2701 )
Branches     : 83.01% ( 1315/1584 )
Functions    : 85.56% ( 587/686 )
Lines        : 88.83% ( 2324/2616 )
Test Suites: 1 failed, 74 passed, 75 total
Tests:       1 failed, 951 passed, 952 total
```
(The 1 failure was a 5 s timeout in `CreateGameScreen.test.tsx › defaults to Casual Game and offers a Tournament toggle`, present before my changes; it passed in the final run.)

Final single run (after), verbatim:

```

=============================== Coverage summary ===============================
Statements   : 89.32% ( 2863/3205 )
Branches     : 83.54% ( 1589/1902 )
Functions    : 86.2% ( 731/848 )
Lines        : 89.57% ( 2776/3099 )
================================================================================

Test Suites: 87 passed, 87 total
Tests:       1075 passed, 1075 total
Snapshots:   0 total
Time:        6.733 s, estimated 8 s
Ran all test suites.
```

Coverage is Jest's default (only files imported by a test are counted; there is no `collectCoverageFrom`), so before/after are comparable to each other, not to "whole repo" coverage.

Negative / mutation checks: after the tests passed first time I mutated the code to confirm they fail: 3 rows instead of 2 (3 failed), dropping waitlisted from My games (10 failed), overwriting the sport selection on reload (9 failed), back button returns false (1 failed), swapped step order (12 failed), fail-closed onboarding check (2 failed), no consent refetch on 409 (2 failed). Each was reverted.

`npx tsc --noEmit` and `npx eslint . --ext .ts,.tsx`: no output (clean).

**Every new test EXECUTES code** (renders components/screens, runs hooks and pure functions). There are **no source-string checks**. Limitation: react-test-renderer does not run layout or native rendering, so the chip-spread case asserts the style props (labelled so in the test name), and nothing was seen on an emulator or device.

New tests by file (case titles; `it.each` entries appear once):

**`src/utils/__tests__/gameLists.test.ts`** — EXECUTES code (25 cases)
- includes hosted, going and waitlisted games, earliest first
- never includes past or cancelled games, even when hosted or going
- detects the organiser from organiser_id although is_organiser is always false
- lists only future public games the user does not organise and has not accepted
- excludes hosted, going, waitlisted, declined, cancelled, past and non-public games
- sorts by start time ascending regardless of feed order
- breaks start-time ties by creation time, earliest first
- puts unparseable start times last and keeps the comparator total
- "all" is the union of My games and Open games, earliest first
- "mine" is My games only and "open" is Open games only
- scope combines with the sport filter
- gives exactly one badge: Hosting, Going, Waitlisted or Open
- Hosting wins when the user hosts a game they are also going to
- has no badge for a game that is neither mine nor open
- the next game is the soonest registered game, and My games repeats it
- a single registered game appears as both the next game and in My games
- when filtered, the next game is the soonest matching game
- counts the unfiltered My games set
- builds one option per admin sport, sorted by label, keyed case-insensitively
- toggles a sport on and off; clearing every sport selects All
- All is exclusive: tapping it clears the others
- defaults to the skill sports that exist in the admin list
- defaults to All when the user has no skill sports or none match the admin list
- ignores selected keys that left the admin list, without rewriting them
- writes the filtered-empty message with the selected sport names

**`src/utils/__tests__/formatGameTime.test.ts`** — EXECUTES code (4 cases)
- says Today and Tomorrow, otherwise the short weekday
- returns an empty string for an unparseable date
- formats a time and "weekday, time"
- returns an empty string for an unparseable date

**`src/components/icons/__tests__/DashboardIcons.test.tsx`** — EXECUTES code (7 cases)
- has an icon for %s
- matches the slug case-insensitively and ignoring whitespace
- uses the fallback ball for an unknown, empty or missing slug
- renders the matching icon (not the fallback) for a known slug
- draws on the 48-unit Appendix A viewBox at the requested size
- is hidden from screen readers (decorative)
- uses the Appendix B banner viewBox for the background

**`src/hooks/__tests__/useResource.test.tsx`** — EXECUTES code (4 cases)
- starts loading, then ready with data
- reports an error, then recovers on retry
- keeps existing data on screen during and after a failed reload
- ignores a stale response that resolves after a newer request

**`src/hooks/__tests__/useSportFilter.test.tsx`** — EXECUTES code (8 cases)
- defaults to the skill sports that are in the admin list
- defaults to All when the user has no skill sports
- defaults to All when the profile call failed (settled without data)
- waits for both sources, then applies the default once
- toggles chips, keeps All exclusive, and re-selects All when every sport is cleared
- never overwrites the user's selection after a re-render or a data reload
- lets a tap before the data settles win over the later default
- drops a selected sport that left the admin list without rewriting the choice

**`src/components/home/__tests__/homeComponents.test.tsx`** — EXECUTES code (30 cases)
- greets with plain text "Good to see you" (no emoji) and "Ready to play, {name}?"
- drops the name from the headline when there is none
- shows the app icon at 34x34 in a 46x46 white tile with a 14px radius and no name text
- uses the brand banner at height 208 plus the status-bar inset with 32px bottom corners
- hides the bell badge at zero and shows the count (capped at 99+) otherwise
- shows the uploaded photo (48px, 2px white ring) when a URL exists
- falls back to the letter avatar when there is no photo
- falls back to the letter avatar when the image fails to load
- routes the bell and the avatar presses
- renders All first, then one chip per sport, as buttons
- marks All selected when nothing is, and only the chosen sports otherwise
- draws a 2px brand ring on a selected chip only
- reports taps: sport key for a chip, null for All
- shows an unknown sport with the fallback icon and a known one with its own
- applies the spread-or-scroll layout: horizontal scroller whose content grows to fill and spaces between (props only; layout engine not run)
- shows skeleton tiles while the admin list loads
- shows the title, venue, going count, and the sport icon by slug
- shows no status badge on Home, and the given badge on the Games screen
- uses the fallback icon for an unknown sport
- is a button with at least a 44px target that fires onPress
- shows "Next game", the title and venue, and opens on press
- a Players Group shows the groups icon and its member count, no sport
- a Team shows its sport icon, plus the sport in the meta
- omits the member count when the list item does not carry one
- shows "{n} active" and "{n} groups" and has exactly two tiles (no Tournaments tile)
- uses the singular for one group and drops a count whose source failed
- fires the matching handler
- SectionHeader shows a header-role title and a View all button only when given a handler
- InlineError shows its message and a working Retry
- SkeletonRows renders the requested number of rows; EmptyText renders its copy

**`src/screens/__tests__/HomeScreen.test.tsx`** — EXECUTES code (34 cases)
- renders banner, next game, sports, My games, My groups, Recommended, shortcut tiles — in that order
- shows the three section headings and no orphan or legacy headings (AD-11)
- every heading has content under it in every state (rows, empty text, skeleton or error)
- greets with plain "Good to see you" and the same display name as before (not the nickname)
- falls back to the nickname only when the display name is empty
- shows the uploaded photo when the profile has one
- shows the letter avatar when there is no photo, and when the profile call fails
- shows the unread count on the bell, opens notifications and Profile
- syncs the unread count on mount and when the screen regains focus
- My games shows two rows, earliest first, with going, waitlisted and hosted games eligible
- a hosted game appears in My games when it is among the two earliest
- never shows past or cancelled games anywhere
- Recommended shows two open public games, earliest first, excluding hosted, accepted, declined and non-public
- with a single registered game, the next-game card and My games both show it
- the next-game card is the soonest registered game
- shows skeletons while loading, never a blank page
- shows the empty copy for each section
- events failing shows the games error (with Retry) in its three sections, and leaves groups, chips and banner working
- groups failing shows only the groups error; games sections are unaffected
- sports failing leaves only the All chip; every section still loads
- Retry reloads only the failed section and recovers
- shows All first, then the admin sports, with All selected when the user has no skill sports
- defaults to the user\'s skill sports that are in the admin list
- multi-select: tapping toggles a chip; the lists change with it (asserting the lists, not just the chip)
- All is exclusive; clearing every sport selects All
- clicking All then a sport selects that sport
- keeps the user\'s selection across a re-render and a data reload (pull to refresh)
- never filters My groups or the tile counts
- shows "No {sport} games here — clear the filter to see all" when a filter empties a section
- My games View all opens Games with scope Mine
- Recommended View all opens Games with scope Open
- the My games tile opens Games with scope All; the My groups tile opens the Groups screen
- opens game detail from a row and from the next-game card, and a group from a group row
- My groups View all opens the existing Groups screen

**`src/screens/__tests__/GamesScreen.test.tsx`** — EXECUTES code (17 cases)
- shows a "Games | Tournaments" switch and defaults to Games
- does not load tournaments until the Tournaments segment is opened
- Tournaments shows the existing tournaments list unchanged (name, format, registration badge, counts)
- opens tournament detail from a tournament card
- keeps each segment\'s own state when switching (scope, sport chips, no refetch)
- a failing tournaments call does not affect the Games segment, and vice versa
- a new refreshKey (tournament created) selects Tournaments and reloads it
- is the union of My games and Open games, future and non-cancelled only, earliest first
- shows one badge per row: Hosting, Going, Waitlisted or Open, and the going count
- scope chips All (default), Mine and Open filter the list
- scope chips combine with the sport chips (multi-select, All exclusive)
- uses the same sport defaults as Home: the user\'s skill sports, otherwise All
- shows the filtered-empty message, or the scope\'s own empty copy without a sport filter
- opens game detail from a row
- shows a skeleton while loading and the error copy with a working Retry
- opens on the requested scope from the route params
- a later entry (new entryKey) re-applies its scope and returns to Games, even from Tournaments

**`src/navigation/__tests__/tabIcons.test.tsx`** — EXECUTES code (4 cases)
- maps each tab to its Appendix A icon, with the gamepad for the Games tab
- renames the Tournaments tab to "Games" and keeps the other labels
- renders the icon at 30px
- renders the label at 11px, bold brand when active and muted when idle

**`src/utils/__tests__/phoneNumber.test.ts`** — EXECUTES code (14 cases)
- returns null for an empty field
- returns null for a number that cannot be a phone number (too short / too long)
- keeps the chosen country code even if the digits look international
- always starts with "+" and contains only digits after it
- strips everything but digits
- shows the ISO code and dial code, no emoji flag
- a stored +44 number preselects the UK
- a stored +65 number preselects Singapore
- resolves a shared +1 code by the number itself (US area code)
- falls back to the default country when several countries share a code and the default is one of them
- keeps the dial code consistent when the default does not share it (first sharing country)
- uses the default country when no listed country has the dial code
- returns null for an empty country list
- round-trips: split then build gives the original number

**`src/api/__tests__/mobileNumber.test.ts`** — EXECUTES code (9 cases)
- reads GET /public/consent/mobile-number and returns version and text
- reads GET /public/country-codes, keeps the server order, and drops disabled rows
- PATCHes /users/me with the number and the consent version
- clearing sends mobile_number: null and no consent version
- maps 409 to consent_version_stale and 422 to invalid_number, without reading the body
- maps everything else (network error, 500, null) to other
- reads onboarding_required and whether a number is stored from GET /users/me, never the number
- treats a missing flag as not required and null/empty number as none
- completes via POST /users/me/onboarding/complete

**`src/onboarding/__tests__/steps.test.ts`** — EXECUTES code (7 cases)
- is skills, notifications, mobile number, photo — in ONE constant
- ships with the architect defaults: notification step ENABLED, photo step OMIT
- follows the constant\'s order when everything is on
- with the default flags the photo step is omitted
- omits the notification step when flagged OMIT
- omits the mobile step when a number is stored, or when the consent/country data is unavailable
- always keeps skills

**`src/hooks/__tests__/useMobileNumberConfig.test.tsx`** — EXECUTES code (8 cases)
- is ready with the consent text and the country list; the default is the FIRST row
- takes the default from the server order, not from SG: a different first row becomes the default
- is unavailable when the consent fetch fails
- is unavailable when the country list fails or is empty
- is unavailable when the consent text is empty
- starts as loading
- reloadConsent refetches the consent text and updates it
- reloadConsent reports failure and keeps the old text

**`src/components/__tests__/MobileNumberInput.test.tsx`** — EXECUTES code (11 cases)
- defaults to the first row of the country list: "SG +65"
- shows the consent text passed in (never hardcoded)
- lists the ISO and dial code for every row, with no emoji flags
- builds E.164 from the default code and typed digits
- rebuilds the number when the country changes
- reports an empty field and a null number for junk
- editing a stored +44 number preselects the UK and shows the national part
- editing a stored +65 number preselects Singapore
- a shared dial code falls back to the default when the default shares it
- shows an inline error without the number in it
- never logs the number while typing

**`src/components/__tests__/MobileNumberCard.test.tsx`** — EXECUTES code (14 cases)
- is hidden when the consent text fails to load
- is hidden when the country list fails to load
- is shown when both load
- shows "No mobile number added" and an Add button when none is stored
- shows the stored number with Change and Remove
- sets a number: sends mobile_number (E.164) and the consent version, then reports it saved
- changing a stored +44 number opens with the UK preselected and the national digits filled
- clearing sends mobile_number: null (no consent version) and reports null
- does not call the server for an unusable number and shows an inline error
- Cancel leaves the stored number untouched
- 422 shows an inline error that does not echo the value, and nothing is reported saved
- 409 consent_version_stale refetches the consent text and asks the user to confirm again; the next save uses the new version
- any other failure shows a generic inline error, with no number in it
- the number never appears in console output across save, clear and error paths

**`src/hooks/__tests__/useOnboardingRequired.test.tsx`** — EXECUTES code (5 cases)
- is required only on a definite onboarding_required: true
- is not required when the server says false
- fails open on an error: never required
- fails open on a timeout, and ignores an answer that arrives after it
- does not check without a signed-in user

**`src/screens/__tests__/OnboardingScreen.test.tsx`** — EXECUTES code (20 cases)
- runs skills, notifications, then mobile number, with a step counter
- every step has Save and Skip
- Save advances just like Skip (skills: nothing chosen, notifications: toggles already saved)
- the final Save or Skip calls POST /users/me/onboarding/complete once, then finishes
- a failed complete dismisses locally for the session (fail open)
- is consumed and never dismisses or advances the interstitial
- omits the notification step when NOTIFICATION_STEP is OMIT
- leaves the photo step out by default, and no photo screen exists even if flagged on
- omits the mobile number step when a number is already stored
- omits the mobile number step when the consent text fails to load
- omits the mobile number step when the country list fails to load
- saves the chosen levels through the existing skill-level endpoint
- shows an inline error when a save fails and keeps Skip available
- lets the user continue when the sports list cannot load
- embeds the same list component the Settings screen uses
- shows the device-permission banner only when the permission is not granted, and never re-prompts
- saves a number with the consent version, then completes
- Save with an empty field sends nothing and completes
- a 422 shows an inline error without the value and keeps Skip available
- a 409 refetches the consent text and asks for a fresh confirmation

**`src/navigation/__tests__/OnboardingOverlay.test.tsx`** — EXECUTES code (6 cases)
- shows when onboarding_required is true
- passes whether a number is already stored
- does not show when onboarding_required is false (existing users)
- never shows when GET /users/me errors
- never shows while the answer is pending, nor after a timeout
- goes away when finished and does not come back in the same session

Existing tests changed: `EventDetailScreen.test.tsx` (import path), `RootNavigatorHomeTab.test.tsx` (Home tab press no longer passes `filter`), `api/__tests__/sports.test.ts` (adds `slug`), `ProfileScreen.test.tsx` (mocks the new number endpoints so it never calls the network), `TournamentsScreen.test.tsx` moved to `components/__tests__/TournamentsListContent.test.tsx` (header "+" case dropped with the screen wrapper). Deleted with their code: `AppHeader`, `HomeHeader`, `StatCard`, the old Home section components and `homeDashboard` selectors/tests.

## 6. Known gaps / follow-ups

1. **Registration number field not built** (blocked, 5.5.2). Needs the architect to decide the registration contract (`/auth/signup` vs `/auth/register`, required `display_name`, response/tokens, email verification). The reusable `MobileNumberInput` + `useMobileNumberSave` are ready for it.
2. **Nothing was run on an emulator or device.** Banner overlap with the next-game card, the real chip spread, SVG rendering, the status-bar colour over the banner, tab-bar height with 30 px icons and the first-run overlay layout are unverified visually.
3. Declined-invite behaviour under `rsvp === 'none'` (5.3.8) needs a live backend check.
4. Icon hash differs (5.2).
5. Shared-dial-code rule (Assumption 5) needs confirmation.
6. Photo step UI not built (flag OMIT, Assumption 8). Profile photo upload exists on `main`; G4 (bucket listing) is the architect's.
7. Group rows carry no member count and no team icon data (5.5.4).
8. Active-tab styling: Appendix A icons are fixed-colour, so only the label changes (brand + bold) between active and inactive.
9. `onboarding_required` is read from a second `GET /users/me`; AuthContext's user type does not carry it.
10. Jest prints "A worker process has failed to exit gracefully" (also present in the baseline).

## Completion Proof

**Test evidence** (raw; single run per the brief):

```

=============================== Coverage summary ===============================
Statements   : 89.32% ( 2863/3205 )
Branches     : 83.54% ( 1589/1902 )
Functions    : 86.2% ( 731/848 )
Lines        : 89.57% ( 2776/3099 )
================================================================================

Test Suites: 87 passed, 87 total
Tests:       1075 passed, 1075 total
Snapshots:   0 total
Time:        6.733 s, estimated 8 s
Ran all test suites.
```

**Git evidence**: see the final message of the session (the report's own commit hash cannot be inside itself). Commits before the report: `162b644` (Part A), `8cbdf8c` (Part B). `git status` at report time listed ` M android/version.properties` as the only unstaged change (pre-existing, never committed).

**File evidence**:

```
src/utils/gameLists.ts:30:export const HOME_SECTION_ROWS = 2;
src/utils/gameLists.ts:139:export function selectGames(
src/screens/OnboardingScreen.tsx:56:    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
src/onboarding/steps.ts:12:export const NOTIFICATION_STEP: StepFlag = 'ENABLED';
src/onboarding/steps.ts:13:export const PHOTO_STEP: StepFlag = 'OMIT';
src/onboarding/steps.ts:18:export const ONBOARDING_STEP_ORDER: readonly OnboardingStepId[] = [
src/api/mobileNumber.ts:47:  const { data } = await apiClient.get<CountryCode[]>('/public/country-codes', {
src/api/onboarding.ts:38:  await apiClient.post('/users/me/onboarding/complete', undefined, {
36:  Tournaments: 'Games',
25:    "libphonenumber-js": "1.13.14",
```

**Build evidence**: not applicable (React Native app; no web build). Type-check and lint were clean (5.6).
