# Implementation Report — Create Flow Amendment (FAB consolidation, merged Casual Game/Tournament screen)

*Author's own account, not a certification. Conformance review and the
testing agent must verify independently, in fresh sessions.*

## 0. Read this first

1. **The task brief's premise was wrong on two points, both corrected before
   any code was written** (see §3, Blocked-Report history preserved in the
   session transcript, not reproduced here):
   - It claimed `DES-MEETUP-MOBILE.md` was "already amended" — it was not,
     at the time the brief was given. The actual amendment was negotiated
     and landed on `origin/main` (commit `fab9855`) during this session,
     merged into this branch before any implementation code was touched.
   - It said to source the Tournament field set from the web frontend and,
     if ambiguous, file a blocked report. The web frontend and backend
     turned out to be *inconsistent with each other* on one point (Format:
     Group Stage) — escalated to the user per that exact instruction; the
     resolution (drop Group Stage, 2 options) is folded into the approved
     amendment text itself.
2. **No live create request was sent, and nothing was seen on a device or
   emulator.** This sandbox has `adb` but no attached device and no
   emulator binary (`emulator -list-avds` → command not found). The
   brief's "manual verification: both toggle states submitting
   successfully against the real API (device/emulator, not mocked)"
   requirement **could not be performed** — flagged here, not silently
   skipped. What *was* done against the live host (read-only / rejected,
   no data created): `GET /openapi.json`, and one unauthenticated
   `POST /events` and `POST /tournaments`, each with `{}` → `401` (see §5).
   First real create is a manual/QA step, same as the create-group-
   tournament task's own precedent.
3. **Casual Game creation did not exist in mobile at all before this
   task** — `CreateGameScreen.tsx` was a "Coming Soon" placeholder with no
   form and no API call. The brief's "Casual Game field set (unchanged)...
   Submit → existing create-game endpoint/payload (unchanged)" was false;
   this had to be built from scratch against the live `EventCreate`
   schema, not merged from existing mobile code.
4. **`EventVisibility` had a wrong enum value already shipped**
   (`'invite'`, should be `'invite_only'`) — a pre-existing bug (any real
   private event would have rendered an `undefined` category pill;
   `CreateTournamentScreen`'s own type never triggered it because
   Tournament's value genuinely is `invite`). Fixed as a forced,
   compiler-driven correction — see §4, Deviation D1.
5. **Field sets and every enum value are sourced from `pratheeshku/meetup`
   directly**, not inferred: backend `events/schemas.py` /
   `tournaments/schemas.py` (via `gh api repos/pratheeshku/meetup/contents/...`)
   for the authoritative payload contract and validators, `frontend/app.js`
   for which subset of each schema the web UI exposes, in what order, with
   what defaults. See §3.

## 1. Design reference

- Doc ID: DES-MEETUP-MOBILE — APPROVED (2026-09-13), tier T1.
- Create Flow Amendment, §4.3/§4.5, **architect-approved 2026-09-22**
  (doc status line: "Create-flow amendment (§4.3/§4.5) architect-approved
  2026-09-22"), landed on `origin/main` as commit `fab9855 "Updated
  Design"`, merged into this branch via `merge: pull in Create-flow design
  amendment (§4.3/§4.5) from origin/main`.
- Baseline before change: `tsc` 0 errors, `eslint` 0 errors/warnings,
  Jest 646/646 (58 suites).

## 2. Traceability map

| Amendment item | Files | Notes |
|---|---|---|
| FAB menu: 2 entries (Game, Group) | `src/navigation/CreateMenu.tsx`, `CreateTabButton.tsx`, `__tests__/CreateMenu.test.tsx`, `__tests__/CreateTabButton.test.tsx` | `CreateTarget` narrowed to `'game' \| 'group'`; tournament case removed from `navigateToCreate` |
| Merged Casual/Tournament screen | `src/screens/CreateGameScreen.tsx` (full rewrite) | Toggle via `OptionChips<GameKind>`; both forms' state declared unconditionally so toggling never loses input |
| Casual Game fields → `EventCreate` | `src/types/event.ts` (`CreateEventInput`, `EventSkillLevel`, `EventVisibility` fix), `src/api/events.ts` (`createEvent`) | See §3 for the field-by-field schema/web trace |
| Tournament fields → `TournamentCreate` | `src/types/tournament.ts` (`CreateTournamentInput` extended, `TournamentVisibility`, `TournamentFormat` narrowed), `src/api/tournaments.ts` (docstring only — function already generic) | Group Stage removed from the client-facing type |
| `CreateTournamentScreen` retired | deleted: `src/screens/CreateTournamentScreen.tsx`, `__tests__/CreateTournamentScreen.test.tsx`, `__tests__/TournamentsHeaderNavigation.test.tsx` | Route removed from `TournamentsStackParamList`/`RootNavigator.tsx` |
| Tournaments tab header "+" removed | `src/screens/TournamentsScreen.tsx`, `__tests__/TournamentsScreen.test.tsx` | Entry point moved to Home tab's Create Game screen |
| Cross-tab refresh after create | `src/navigation/types.ts` (`EventsList`/`TournamentsList` `refreshKey`), `src/screens/HomeScreen.tsx` (refreshKey effect, new) | Casual creates `popTo('EventsList', {refreshKey})`; Tournament creates `navigate('Tournaments', {screen:'TournamentsList', params:{refreshKey}})` (cross-tab — no local route to pop to, see Proposed Assumption #4) |
| Quick-select date chips (Casual only) | `src/utils/localDateTime.ts` (`quickDate`, `applyQuickDate`, `parseLocalDate`, `LOCAL_DATE_PLACEHOLDER`), tests in `__tests__/localDateTime.test.ts` | Reproduces web's exact day-of-week math (`\|\| 7` fallback), verified with fake timers across a Wed/Sat/Sun boundary |
| `EventVisibility`/`EventCard` fix | `src/types/event.ts`, `src/components/EventCard.tsx`, `__tests__/EventCard.test.tsx`, `src/utils/__tests__/homeDashboard.test.ts` | Deviation D1, forced by the enum correction — see §4 |

## 3. Field-source trace (per the brief's explicit requirement)

Fetched via `gh api repos/pratheeshku/meetup/contents/<path>` (base64-decoded)
during this session — not assumed, not re-derived from the earlier Casual
screenshot:

- `events/schemas.py` → `EventCreate` (required: `title`, `visibility`,
  `capacity`, `starts_at`; `sport` defaults `'football'`;
  `visibility` enforced by `field_validator` to
  `'public'`/`'group'`/`'invite_only'`; `skill_level_requirement` enforced
  to `'all_levels'`/`'beginner'`/`'intermediate'`/`'expert'`, default
  `all_levels`).
- `tournaments/schemas.py` → `TournamentCreate` (`visibility` documented,
  **not enforced**, as `'public'`/`'group'`/`'invite'` — confirmed a
  genuinely different literal from Event's `invite_only`;
  `participation_mode` enforced `individual`/`team`; `format` enforced
  `knockout`/`round_robin`/`group_stage`, but `group_stage` requires BOTH
  `participation_mode='team'` AND a populated `structured_rules` object,
  per two `model_validator`s).
- `frontend/app.js` → `eventCreateFormHtml`/`submitCreateEvent` (Casual
  Game's exact field list, order, and that it always sends `ends_at:
  null`) and `tournamentCreateFormHtml`/`submitCreateTournament`
  (Tournament's field list — confirms the Format `<select>` has **only 2
  `<option>`s, `knockout`/`round_robin`** — no `group_stage` option exists
  anywhere in the rendered UI, even though `toggleTournamentFormat()` and
  a whole `t-group-stage-rules` panel/payload-construction branch exist
  in the same file, unreachable from the actual form).

**Discrepancy escalated per the brief's own rule** ("if ambiguous or
inconsistent with its own validation, file a blocked report — do not
resolve it yourself"): Format's Group Stage option is fully specified at
the backend contract level and partially built (but unreachable) on web;
mobile's pre-existing 3rd chip offered it without ever collecting
`structured_rules`, guaranteeing a 422 on every real submission. Presented
to the user as a 3-way choice (strict 2-option parity / build the missing
UI / disable with an explanation); **resolved: 2 options, matching web
exactly**, folded into the approved amendment text verbatim. `knockout`/
`round_robin` were already-shipped, unaffected fields — no other
discrepancy against the prior Casual-state screenshot was found.

## 4. Deviations

**D1 — `EventVisibility`'s third value corrected from `'invite'` to
`'invite_only'`, `EventCard`'s `CATEGORY_LABEL` relabelled `'Invite'` →
`'Private'`.** Not requested by the brief, but unavoidable: building
Casual Game's Visibility dropdown required the correct enum (confirmed
against `events/schemas.py`'s validator), and once `EventVisibility`'s
type changed, `tsc` failed on `EventCard.tsx`'s now-incomplete
`Record<EventVisibility, string>` — the compiler forced the fix, not a
choice to expand scope. The new label matches `frontend/app.js`'s own
event-card rendering (`visibility === "invite_only" ? "PRIVATE" : ...`),
confirmed directly rather than reused from the prior (wrong) guess.
Approval reference: none sought separately — reported here per the
Fidelity rules' "check siblings for the same class of gap," folded into
the same approved amendment since it was a direct consequence of building
an amendment-mandated field.

No other deviations from the approved amendment text.

## 5. Verification results

**Type-check:**
```
$ npx tsc --noEmit
(no output — 0 errors)
```

**Lint:**
```
$ npx eslint . --ext .ts,.tsx
(no output — 0 errors/warnings)
```

**Production Android bundle** (Metro, `--dev false`, catches resolution/
syntax issues `tsc`/Jest can miss):
```
$ npx react-native bundle --platform android --dev false --entry-file index.js \
    --bundle-output <scratch>/android-release.bundle --assets-dest <scratch>/android-release-assets
LOG:Writing bundle output to: .../android-release.bundle
LOG:Done writing bundle output
Copying 19 asset files
Done copying assets
```
(Output deleted after the check — build evidence only, not a deliverable.)

**Live backend, read-only / rejected, no data created:**
```
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST https://meetups.duckdns.org/events -H "Content-Type: application/json" -d '{}'
HTTP 401
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST https://meetups.duckdns.org/tournaments -H "Content-Type: application/json" -d '{}'
HTTP 401
```
Confirms both endpoints exist and require auth (fail before reaching field
validation) — not a substitute for the brief's required device-based
manual QA (see §0.2, Known gaps).

**Test evidence (raw, 3 consecutive runs):**
```
$ for i in 1 2 3; do npx jest 2>&1 | tail -6; echo "--- Run $i ---"; done
Test Suites: 58 passed, 58 total
Tests:       659 passed, 659 total
Snapshots:   0 total
Time:        2.26 s, estimated 3 s
Ran all test suites.
--- Run 1 ---

Test Suites: 58 passed, 58 total
Tests:       659 passed, 659 total
Snapshots:   0 total
Time:        1.886 s, estimated 2 s
Ran all test suites.
--- Run 2 ---

Test Suites: 58 passed, 58 total
Tests:       659 passed, 659 total
Snapshots:   0 total
Time:        1.966 s, estimated 2 s
Ran all test suites.
--- Run 3 ---
```
(659 vs. the 646-test baseline: +13 net — new `CreateGameScreen.test.tsx`
suite added many more than it removed from the old placeholder/
`CreateTournamentScreen` suites combined, minus the 3 deleted files'
tests; net count confirmed stable across all 3 runs, no flakiness.)

**Git evidence:**
```
$ git log --oneline -3
1b1... merge: pull in Create-flow design amendment (§4.3/§4.5) from origin/main
7dd908f feat(notifications): bell unread badge and notification history screen
a6015b3 chore(release): bump versionCode to 6
```
(Exact merge-commit hash and this task's own commit hash to be confirmed
in the commit this report is committed alongside — see the immediately
following `git log` in the session.)

**File evidence** (primary change — `createEvent` exists and is wired to
the real endpoint):
```
$ grep -n "export async function createEvent" -A 6 src/api/events.ts
export async function createEvent(
  input: CreateEventInput,
  options?: RequestOptions,
): Promise<Event> {
  const { data } = await apiClient.post<EventApiItem>('/events', input, {
    correlationId: options?.correlationId,
  });
```

## 6. Known gaps / follow-ups

1. **Device/emulator manual QA not performed** (§0.2) — this sandbox has
   no attached device or emulator. A human must run both toggle states
   against the real API on a device before this ships, per the brief's
   own requirement. This is the single largest open item.
2. **Casual Sport treated as optional** (no blocking "must choose"),
   unlike Tournament's required Sport — a Proposed Assumption (§7 #1),
   not literal web parity (web's `<select>` always has *some* value via
   HTML default-selection semantics); flagged for conformance review to
   ratify or reject.
3. **Tournament creation success navigates cross-tab** (`navigate`, not
   `popTo`) without first unwinding the Home stack's `CreateGame` screen
   — if the user returns to the Home tab afterward, `CreateGame` is still
   on top of its stack rather than popped. Minor UX polish, not attempted
   here (not specified by the amendment); flagged as a follow-up.
4. **`GroupStage`/`structured_rules` remains fully unbuildable** on both
   web and mobile per the approved Deferred note — re-entry trigger is
   explicitly "a `structured_rules` UI designed on web first," not owned
   by this task.
5. **`EventCreate`'s `allow_waitlist`, `estimated_cost_cents`/
   `_currency`, `recurrence_*` fields** exist on the live schema but are
   not exposed by web's Casual Game form and were correspondingly not
   built here — consistent with "match web," not an oversight.

## 7. Proposed Assumptions (numbered, conservative readings)

1. **Casual Game's Sport is optional** (chip left unselected omits the
   field, server defaults to `'football'`), while Tournament's Sport
   remains required/blocking — mirrors the amendment's own asterisk
   convention (`Sport` vs. `Sport *`) and the schema's `default` vs. no
   default, over literally replicating web's HTML-select default-to-
   first-option behavior (which the existing chip-UI pattern, already
   shipped for Tournament Sport/Participation Mode, has no equivalent
   for).
2. **Visibility defaults to `public`** for both Casual and Tournament
   (chips pre-selected, not left blank) — matches both the schema
   (`TournamentCreate.visibility` default `'public'`) and web's actual
   `<select>` behavior (first `<option>`, no `selected` override).
3. **Sport/Participation Mode/Format retain their pre-existing "no
   default, user must choose" (Sport, Participation Mode) or "pre-filled
   from the schema default" (Format: `knockout`, Capacity: `8`) behavior**
   for Tournament, unchanged from the already-shipped `CreateTournamentScreen`
   precedent — the amendment specifies which fields exist, not a change to
   this already-approved default-selection UX.
4. **Tournament create-success navigation**: since Tournament creation now
   happens from the Home stack (no local `TournamentsList` route to
   `popTo`), it cross-tab `navigate`s to `Tournaments > TournamentsList`
   with a fresh `refreshKey` — the closest equivalent to the retired
   `CreateTournamentScreen`'s `popTo('TournamentsList', {refreshKey})`,
   not specified by the amendment (a navigation-UX detail, not a
   contract/schema/security item).
5. **Tournament Start Date is interpreted as local midnight** (via the
   new `parseLocalDate`, consistent with `parseLocalDateTime`'s existing
   "device's local time zone" convention), not web's literal `new
   Date('YYYY-MM-DD')` UTC-midnight parsing quirk — kept internally
   consistent with the rest of this app's date handling rather than
   reproducing a web-specific timezone subtlety the amendment doesn't
   call out.
6. **Groups load failure degrades to an empty list** (conditional Group
   picker shows "You don't belong to any groups yet.") rather than
   blocking the whole Create Game form — mirrors `HomeScreen`'s existing
   "groups are secondary" pattern, since most creates never touch
   Visibility = Group.

## Completion Proof

See §5 (Verification results) above for the full raw command output —
type-check, lint, production bundle, live-endpoint existence check, and
3 consecutive full Jest runs (659/659 each time), plus git/file evidence.
