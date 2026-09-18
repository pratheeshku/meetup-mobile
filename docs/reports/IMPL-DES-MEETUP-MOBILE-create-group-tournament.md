# Implementation Report — Create Group & Create Tournament (direct entry points)

*Author's own account, not a certification. Conformance review and the testing
agent must verify independently, in fresh sessions.*

## 0. Read this first

1. **No create request was ever sent to the live backend, and nothing was seen on
   a device.** Creating records on production would leave test data I may not
   delete (raw `DELETE` is denied). What *was* done against the live host, all
   read-only or rejected: `GET /openapi.json`, `GET /admin/sports/public`, and one
   unauthenticated `POST /groups` with `{}` (→ `401`, nothing created). So the
   request bodies are verified **against the published schema, not against a
   successful server round-trip**. Jest (mocked API), `tsc`, ESLint and a
   production Android bundle pass. First real create is a manual/QA step (§6.1).
2. **The brief's premise about the FAB is wrong for this codebase.** It says the
   center FAB "offers Game/Group/Tournament creation as a menu". What was built in
   the previous task, and what is on `main`, opens Create Game directly — there is
   no menu. Not built here (not asked for in this brief); see F1.
3. **The brief's guess `members_can_invite` is not a create field.** Live
   `GroupCreate` has only `name` and `description`; `members_can_invite` exists
   only on `GroupResponse`. It was not built.
4. **Flags for the architect are in §6.2 (F1–F8).** None was severe enough to stop
   under the brief's rule (no undocumented enum *values* for a required field), but
   F2, F4, F5 and F7 involve judgement calls I made and want ratified.
5. **Several files beyond the brief's list were added** (D1). Each is small and
   required, but none was explicitly approved.
6. **No Co-Authored-By trailer** (`git log -1 --format=%B | grep -ci co-authored`
   returned `0`).

## 1. Design reference

- Doc ID: DES-MEETUP-MOBILE — APPROVED (2026-09-13), tier T1.
- §4.4 (Create Group screen; `POST /groups`, §7.3), §4.5 (Create Tournament
  screen; `POST /tournaments`, §7.7), §7 row `GET /admin/sports/public`
  (unauthenticated). Requirements: R-030 (create groups), R-040 (create a
  tournament with a group-stage structure — see F7).
- Baseline before change: `tsc` 0 errors, Jest 174/174 (21 suites).

## 2. Schema verification evidence

Source: `curl -s https://meetups.duckdns.org/openapi.json` (HTTP 200, 138,321
bytes, API "Sports Meetup Platform API" 1.0.0), fetched 2026-09-19. The brief's
schema names (`GroupCreateRequest`, `TournamentCreateRequest`) do not exist; the
`POST /groups` and `POST /tournaments` `requestBody` `$ref`s resolve to
**`GroupCreate`** and **`TournamentCreate`**. Both return `200` (not `201`) on
success and `422 HTTPValidationError` (`detail: [{loc, msg, type}]`) on failure.

Dump produced by a script over the saved JSON (not transcribed):

```
### GroupCreate  (required: ['name'])
name: string; minLength=1; maxLength=100
description: string | null;

### TournamentCreate  (required: ['sport', 'participation_mode'])
title: string; minLength=1; maxLength=150; default=Test Tourney
sport: string; minLength=1; maxLength=30
description: string | null;
group_id: string(uuid) | null;
visibility: string; default=public; description='public', 'group', or 'invite'
participation_mode: string; description='individual' or 'team'
format: string; default=knockout; description='knockout', 'round_robin', or 'group_stage'
capacity: integer; exclusiveMinimum=1.0; default=8
venue_name: string | null;
venue_address: string | null;
registration_closes_at: string(date-time) | null;
starts_at: string(date-time);
ends_at: string(date-time) | null;
structured_rules: StructuredRulesCreate | null;
```

`GET /admin/sports/public` → `SportResponse[]` `{id, name, slug, display_name,
is_active}`. Live values (all `name == slug`, lower-case, all active):
`badminton, basketball, football, others, tennis`.

### Create Group — field mapping

| Schema field | Required | Form / payload |
|---|---|---|
| `name` | yes, 1–100 | text field, `maxLength=100`, trimmed, blank rejected locally |
| `description` | no (nullable) | multiline; omitted from the body when empty |
| *(`members_can_invite`)* | — not in `GroupCreate` | **not built** |

### Create Tournament — field mapping

| Schema field | Schema says | Form / payload |
|---|---|---|
| `title` | optional, 1–150, **default "Test Tourney"** | required in form, `maxLength=150`, trimmed, **always sent** |
| `sport` | required, 1–30 | chips from `/admin/sports/public` (active only); no preselection; sends sport `name` (F5) |
| `participation_mode` | required, values in description text | chips `individual` / `team`; **no preselection** (no schema default) |
| `format` | default `knockout`; 3 values in description | chips `knockout` / `round_robin` / `group_stage`; preselected to the default |
| `capacity` | integer, `exclusiveMinimum: 1`, default 8 | numeric field, prefilled `8`; whole number ≥ 2 |
| `starts_at` | date-time, **not in `required`, no default, not nullable** | required in form, always sent (F2) |
| `registration_closes_at` | optional, nullable date-time | optional field; key omitted when blank |
| `description`, `group_id`, `visibility`, `venue_name`, `venue_address`, `ends_at`, `structured_rules` | optional | **not offered**; omitted so server defaults apply (F7) |

## 3. Every file created / modified (commit `c13c941`)

**Created (17):**
`src/screens/CreateGroupScreen.tsx`, `src/screens/CreateTournamentScreen.tsx`,
`src/api/sports.ts`, `src/types/sport.ts`, `src/components/HeaderAddButton.tsx`,
`src/components/OptionChips.tsx`, `src/utils/apiError.ts`,
`src/utils/localDateTime.ts`; tests:
`src/screens/__tests__/{CreateGroupScreen,CreateTournamentScreen,GroupsScreen,TournamentsScreen}.test.tsx`,
`src/components/__tests__/{HeaderAddButton,OptionChips}.test.tsx`,
`src/api/__tests__/sports.test.ts`,
`src/utils/__tests__/{apiError,localDateTime}.test.ts`.

**Modified (10):**
`src/api/groups.ts` (+`createGroup`), `src/api/tournaments.ts`
(+`createTournament`), `src/types/group.ts` (+`CreateGroupInput`),
`src/types/tournament.ts` (+format/participation types, `CreateTournamentInput`),
`src/navigation/types.ts` (+`CreateGroup`/`CreateTournament` routes,
`refreshKey` param on the two list routes), `src/navigation/RootNavigator.tsx`
(both screens added to their tab stacks), `src/screens/GroupsScreen.tsx`,
`src/screens/TournamentsScreen.tsx` (header "+" and refresh-on-return),
`src/api/__tests__/groups.test.ts`, `src/api/__tests__/tournaments.test.ts`
(+`createGroup` / `createTournament` tests, `post` added to the mocked client).

## 4. Traceability map

| Brief step | Files |
|---|---|
| 1 Groups "+" | `GroupsScreen.tsx` (`GroupsHeaderAction` via `headerRight`), `HeaderAddButton.tsx` |
| 2 Create Group | `CreateGroupScreen.tsx`, `api/groups.ts` `createGroup`, `types/group.ts` |
| 3 Tournaments "+" | `TournamentsScreen.tsx`, `HeaderAddButton.tsx` |
| 4 Create Tournament | `CreateTournamentScreen.tsx`, `api/tournaments.ts` `createTournament`, `api/sports.ts`, `OptionChips.tsx`, `utils/localDateTime.ts`, `types/tournament.ts`, `types/sport.ts` |
| 5 Navigation wiring | `navigation/types.ts`, `navigation/RootNavigator.tsx` |
| Inline errors | `utils/apiError.ts` (used by both screens) |

Behaviour: success → `navigation.popTo('<List>', { refreshKey: Date.now() })`;
the list screen re-fetches (pull-to-refresh style, list stays visible) once per new
`refreshKey`. One `withCorrelationId` per submit. While in flight, the button shows
its loading state and all inputs/chips are locked.

## 5. Proposed Assumptions

- **A1 (LOW)** — Header "+" uses native-stack `headerRight` set from each list
  screen. The brief said to match an established pattern; **none exists**
  (Home's header is the branded `AppHeader` with no create action; Groups and
  Tournaments had plain titled headers).
- **A2 (LOW)** — `refreshKey` route param + `popTo` is how "navigate back and
  refresh" is done (rather than refetch-on-every-focus, which would also flash a
  loader on every return from a detail screen).
- **A3 (LOW)** — Only fields with a documented schema default are prefilled
  (`format`, `capacity`). `sport` and `participation_mode` must be chosen.
- **A4 (LOW)** — Dates are typed as local `YYYY-MM-DD HH:mm` and sent as UTC ISO
  (`Date.toISOString()`); impossible dates (2026-02-31, DST-skipped times) are
  rejected, not rolled over.
- **A5 (LOW)** — Server-provided text is shown inline only for 4xx responses
  (string `detail`, or 422 `field: message` lines); 5xx/network → generic message.
- **A6 (LOW)** — After a successful create the form stays in its "loading" state
  until the screen unmounts (prevents a double-tap during the transition).
- **A7 (LOW)** — No client-side rule that registration must close before the
  start, or that the start must be in the future: not in the schema, and the
  backend is the authority (its message is shown).
- **A8 (LOW)** — No UI role/permission gate on the "+" (§4.5 says create is
  "organiser only"; the backend enforces it, a `403` shows a permission message).

## 6. Flags and follow-ups

### 6.1 Verification gaps
1. **First real create is untested** (see §0.1). Confirm on a device/test
   environment that `POST /groups` and `POST /tournaments` accept the payloads
   (especially each `format` and both `participation_mode` values) and that the new
   record then appears in the list.
2. Device-only, unverified: header "+" placement/tap target, form layout with the
   keyboard open, chip wrapping, `popTo` transition.
3. `RootNavigator` wiring (the two `Screen` entries) has no unit test; covered by
   `tsc` and the bundle only.

### 6.2 Flagged for architect input (none blocked the build)
- **F1 — FAB "menu" premise.** The brief describes a Game/Group/Tournament menu on
  the FAB; the shipped FAB goes straight to Create Game. Decide whether a menu is
  wanted (a separate task).
- **F2 — `starts_at` requiredness is ambiguous in the schema.** Not in `required`,
  no default, non-nullable (and `TournamentResponse` likewise omits it from
  `required`). Built as *required in the form* (conservative: never omitted).
  Confirm the backend's true behaviour when it is missing.
- **F3 — `title` default is `"Test Tourney"`.** A test artefact in a production
  schema: any client omitting `title` silently creates a tournament with that name.
  This client always sends it. Worth raising with the backend owner.
- **F4 — `format`, `participation_mode`, `visibility` are plain strings.** The
  valid values exist only as text in the field `description`, not as an enum. The
  documented values were used verbatim; the server may or may not validate them.
- **F5 — `sport` value: `name` vs `slug`.** Schema is an unconstrained string
  (max 30). Live `name == slug` for all five sports, so it is unobservable today;
  I send `name`. Confirm which the backend keys on (matters if they ever diverge).
- **F6 — Date entry is free text.** No date-picker package is installed; adding
  one is a native-dependency decision. A picker would be a UX improvement.
- **F7 — Form is a subset of `TournamentCreate`.** R-040 says "a tournament with a
  group-stage structure, matching existing web setup". `group_stage` can be chosen,
  but `structured_rules` (points for win/draw/loss, tiebreakers, `match_format`
  which is required *within* it) and `visibility`/`group_id`/venue/description/`ends_at`
  are not offered, so the mobile setup is narrower than the web. Architect to
  decide whether they are in scope.
- **F8 — "Organiser only" gating.** See A8; UI is ungated by design (R-017/R-082).
- Minor: the FAB-size token gap from the previous report is unchanged.

## 7. Deviations

- **D1 — files beyond the brief's list, no explicit approval.** The brief named
  `GroupsScreen`, `TournamentsScreen`, the two new screens and the two API files.
  Also added, each needed by the above: `api/sports.ts` + `types/sport.ts` (source
  of valid sport values, from the design's own §7 endpoint, instead of hardcoding),
  `components/HeaderAddButton.tsx`, `components/OptionChips.tsx` (single-choice
  chips; none existed), `utils/apiError.ts`, `utils/localDateTime.ts`, type
  additions, `navigation/types.ts`. Please ratify or reject.
- **D2 — `Card` not used.** The brief said to use existing Button/Card/TextField;
  the forms use `Button`, `TextField` (and `ErrorView`/`LoadingView`) directly on
  the screen — there is no content to put in a Card.

## 8. Verification results

- `tsc --noEmit` rc 0; ESLint whole repo rc 0 with **no warnings** (an interim
  `react/no-unstable-nested-components` warning on an inline `headerRight` was
  fixed by a module-level component, following `HomeHeader`'s convention). An
  interim `tsc` failure in the *test* files (Jest does not type-check) was found by
  re-running `tsc` after writing tests, and fixed.
- Jest ×3: 30 suites, 236 tests, each run (was 21 / 174).
- **Mutation checks** (each edit applied, the relevant suite run, file restored):

| Mutation | Result |
|---|---|
| send `members_can_invite` in `createGroup` | 2 failed |
| disable refresh-after-create in `GroupsScreen` | 1 failed |
| capacity minimum 2 → 1 | 1 failed |
| stop trimming the tournament title | 1 failed |
| remove `popTo` after Create Group | 2 failed |
| show 5xx `detail` to the user | 1 failed |
| let impossible dates roll over | 4 failed |

- Production Android JS bundle built (`Done writing bundle output`, 1,477,668
  bytes); contains both screens/labels/routes and the `popTo(...refreshKey...)`
  calls. A first grep returned `0` for `accessibilityLabel:"Create Group"` —
  a pattern mismatch (the label is now a `label:` prop), confirmed by re-searching
  with the correct pattern (`label:"Create Group"` → 2), not treated as absence.

## Completion Proof

**Test evidence** (raw output):

```
$ npx tsc --noEmit; echo "tsc rc=$?"
tsc rc=0

Test Suites: 30 passed, 30 total
Tests:       236 passed, 236 total
Snapshots:   0 total
--- Run 1 ---
Test Suites: 30 passed, 30 total
Tests:       236 passed, 236 total
Snapshots:   0 total
--- Run 2 ---
Test Suites: 30 passed, 30 total
Tests:       236 passed, 236 total
Snapshots:   0 total
--- Run 3 ---

$ npx eslint . --ext .ts,.tsx
eslint rc=0
```

**Git evidence** (after the feature commit, before this report's commit):

```
c13c941 feat(create): add Create Group and Create Tournament screens with direct entry points from their respective tabs
3752693 docs(report): implementation report and reflection for Create Game center FAB
19553b4 feat(navigation): move Create Game to a raised center FAB in the bottom tab bar
?? .claude/
```

(`.claude/` is a pre-existing untracked directory.) Post-report `git log` and push
output are in the session's final message.

**File evidence**:

```
$ grep -rnE 'name="CreateGroup"|name="CreateTournament"' src/navigation/RootNavigator.tsx
src/navigation/RootNavigator.tsx:189:        name="CreateGroup"
src/navigation/RootNavigator.tsx:211:        name="CreateTournament"
$ grep -n "export async function create" src/api/groups.ts src/api/tournaments.ts
src/api/groups.ts:202:export async function createGroup(
src/api/tournaments.ts:203:export async function createTournament(
```

**Build evidence** (frontend changed):

```
LOG:Done writing bundle output
label:"Create Group" -> 2
label:"Create Tournament" -> 2
name:"CreateGroup" -> 1
name:"CreateTournament" -> 1
popTo('GroupsList',{refreshKey:Date.now()
popTo('TournamentsList',{refreshKey:Date.now()
```
