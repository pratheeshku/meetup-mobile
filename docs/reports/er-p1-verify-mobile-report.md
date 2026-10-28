# er-p1-verify-mobile report (step 3.0, read-only)

Task ID: `er-p1-verify-mobile`. Machine: Cloud (agent session), repo root `/home/user/meetup-mobile`.
Design: `docs/DES-MEETUP-ADDENDUM-tournament-edit-recurring.md` v1.7 (OI-9 closes here).
Scope kept: no edit to `src/`, `docs/` (other than this file), package files or native config. No test, build, lint, `check:labels` or migration was run. No other agent was dispatched. No version number was chosen. Findings only.

## 0. Sources and limits

- Mobile code: this repo at `main` @ `f850bfd` (the working branch has no other commits).
- Backend: `pratheeshku/meetup` `main` @ `670ad7c`, read by shallow clone (read-only). Reports read: `er-bw-tournament`, `er-bw-shuffle`, `er-bw-series`, `er-web-tournament`, `er-web-series`, `er-config-labels` (all under `docs/reports/`). Where a claim about a response field rests on backend code rather than a report, the backend file is named.
- The live API (`https://meetupaws.duckdns.org`) could not be reached from this session: the agent proxy answered `403` to the CONNECT. So nothing below was checked against the running service, and whether M3 (labels, config keys) has run on production is **not verified here**.
- Line numbers are for the mobile repo unless prefixed `meetup:`.

## 0.1 Headline mismatches against the addendum (OI-9)

1. `tournament_updated` and `tournament_registration_added` are unknown to mobile today: a push of either is dropped, a history row of either does nothing on tap, and neither has a preference row (section 1).
2. Mobile shows the entrant cap to every viewer in five places and has no Full state and no `is_full` read (section 2).
3. Mobile derives `registration_open` itself from `registration_closes_at` (v1 page), and the v2 page reads `registration_phase` expecting `open | committee_only | frozen`. The backend now narrows that to `open | closed` for non-privileged viewers; mobile has no branch for `closed` and renders an empty status block (section 2.4).
4. None of the ten new server codes has a mobile label or mapping (section 4.5).
5. `registrant_withdrawal_locked` is not in the backend `TournamentResponse` (section 3, section 8).
6. No board exists for any of the new screens in either repo. One existing board (`CMAddTeam`) contradicts AD-2/AD-5 and is not in the addendum's superseded list (section 7).

## 1. Notification routing

| Fact | Where |
|---|---|
| One resolver maps a `NotificationType` + `entity_id` to a screen. Exhaustive `switch`; the `default` assigns to `never` and throws on an unhandled type. | `src/notifications/notificationRouting.ts:46-161` (`default` at 154-159) |
| The union has 23 types; `NOTIFICATION_TYPES` is the matching runtime list. Neither contains `tournament_updated` or `tournament_registration_added`. | `src/types/notification.ts:26-49`, `:52-76` |
| Closest existing mappings: `tournament_registration_removed` and the other `tournament_*` types open `Tournaments > TournamentDetail { tournamentId: entityId }`. | `notificationRouting.ts:110-121`, `:133-139` |
| `event_changed` and `event_cancelled` open `Home > EventDetail { eventId: entityId }`. The backend sends series actions as exactly these two types, one per person, with the first affected game as the entity. | `notificationRouting.ts:61-71`; `meetup:events/series_service.py:7`, `:331`, `:342`, `:370` |
| **Push, foreground:** `extractPushPayload` returns `null` when `data.notification_type` is not in `NOTIFICATION_TYPES`; the caller then shows nothing. | `src/notifications/fcm.ts:204-206` (`isKnownNotificationType`), `:220-225`, `:321-324` |
| **Push, background tap:** same extraction; a `null` payload never reaches the handler. | `fcm.ts:405-413`; wiring `src/navigation/RootNavigator.tsx:470-474` |
| **Push, quit-state tap:** same extraction chain, then `resolveNotificationTarget`. | `RootNavigator.tsx:443-459`; `fcm.ts:427-429` |
| **In-app history:** `isKnownType` guards the tap; an unknown type returns with no navigation and no error. | `src/screens/NotificationHistoryScreen.tsx:71-73`, `:104-106`, `:115` |
| **Foreground banner:** calls the resolver directly with the payload type (only reachable for known types). | `src/components/NotificationBanner.tsx:103-110` |
| Handler type lists that gate special rendering do not include either new type. | `src/notifications/eventNotificationHandler.ts:87`, `participantHandler.ts:46`, `pushActions.ts:49` |
| **Preferences:** the row list is `NOTIFICATION_TYPES.map`, so the new types get no toggle. `NOTIFICATION_TYPE_LABEL_KEYS` is `Record<NotificationType, LabelKey>`, so adding a type to the union is a compile error until a key is added there. A server preference of an unknown type is stored in the local map but never rendered. | `src/components/NotificationPreferencesList.tsx:48-72`, `:103-108`, `:191` |
| **Icon:** an unmapped type falls to the generic `notifications` icon. | `src/components/icons/NotificationIcon.tsx:44` |

**Answers.** Would `tournament_updated` / `tournament_registration_added` route anywhere today? No. **Where do unknown types fall?** Push: silently dropped before any handler. History row: tap is a no-op. Preferences: no row. The new types do not reach the resolver's `never` branch because they are filtered earlier.

Not verified: the `entity_id` the backend puts in the two new push payloads (addendum AD-9 line 176 states it is the tournament id; no mobile or report evidence read for this).

## 2. Tournament list card, view and participants: count, cap, block dates

### 2.1 Where the registered count, cap, progress, spots left, Full and block dates are rendered

| Place | What it renders | Fields read | Where |
|---|---|---|---|
| List card (`TournamentsListContent` → `UnifiedTournamentCard`) | "{count}/{max} registered", hidden when count is null | `participant_count` ← `registered_count`; `max_participants` ← `capacity` | `src/components/home/UnifiedCard.tsx:462-468`; label `src/labels/defaultLabels.ts:429`; mapper `src/api/tournaments.ts:186-187`; list wiring `src/components/TournamentsListContent.tsx:120` |
| v1 detail page meta line | "{count}/{max} registered" for every viewer | `registrations.length` (from `GET /tournaments/{id}/registrations`), `max_participants` | `src/screens/TournamentDetailScreen.tsx:887-896` |
| v2 Overview, status card "open" and "closed" | "{count} of {max}" plus a progress bar | `registeredCount` prop = active registrations from the registrations list; `tournament.max_participants` | `src/components/tournament/v2/TournamentOverview.tsx:49-60`, `:92`, `:108`, `:119`; prop set at `TournamentDetailScreen.tsx:770`, `:796`; label `defaultLabels.ts:1296` |
| v2 Overview, Format card | "Max {max}" when no `entrants` rule row, else the rule row "min to max" | `max_participants`; `format_rules.min_participants` / `max_participants` | `TournamentOverview.tsx:365`; `src/utils/tournamentTabs.ts:198-204`; `src/api/tournaments.ts:157`; labels `defaultLabels.ts:1321` |
| v2 Header Register button | sub-line "{count} spots left" (also shows "0 spots left" when full) | `spotsLeft = max(0, max_participants - activeCount)` | `src/components/tournament/v2/TournamentHeader.tsx:99-103`; computed `TournamentDetailScreen.tsx:782`; label `defaultLabels.ts:1269` |
| v2 Participants tab, non-payments view | "{count} of {max}" + "registered" + progress bar, shown to any viewer of the tab (the `paymentsOn` branch is committee-only) | `rows.length`, `max_participants` | `src/components/tournament/v2/tabs/ParticipantsTab.tsx:149`, `:155`, `:392-400`; labels `defaultLabels.ts:1486` |
| Committee/organizer Responses block | "{registered} of {capacity} registered" | active registrations, `max_participants` | `TournamentDetailScreen.tsx:844-847`, `:958-961` (block gated by `canReadResponses`, `:693-696`); label `defaultLabels.ts:1057` |
| Create wizard (organizer) | cap overrides and capacity input | `entrants_max`, `capacity` | `src/types/tournamentWizard.ts:10`, `:34`; `src/types/tournament.ts:387` |

**Full state.** No Full chip, Full pill or "tournament full" banner exists anywhere in `src/`. The only Full text is the refusal label for the code `TOURNAMENT_FULL` (`src/utils/refusal.ts:17`; `defaultLabels.ts:1713`). `canRegisterV2` and the header's register action do not read fullness (`TournamentDetailScreen.tsx:772-786`).

**`is_full`** is not read anywhere. Fullness is not computed from a flag; the only cap arithmetic is `spotsLeft` above and the two progress bars (`TournamentOverview.tsx:51`, `ParticipantsTab.tsx:155`).

**Every place that shows or computes a cap:** the eight rows above, plus `normaliseFormatRules` (`src/api/tournaments.ts:146-159`) and the `Tournament.max_participants` field itself (`src/types/tournament.ts:101`).

### 2.2 Block dates

| Place | Behaviour | Where |
|---|---|---|
| Overview "Key dates" card | Built for every viewer (no committee gate). Rows: `registration_opened_at`; a "Soft block" row from `registration_closes_at` (title key `mob.tournament.v2.kd_soft` = "Soft block", sub "{date} · self-registration ends"); a "Hard block" row **only if** `registration_hard_block_at` is present ("{date} · roster frozen"); fixtures; days. | `TournamentOverview.tsx:235-270`, card `:384-409`; labels `defaultLabels.ts:1323-1324`, `:1566-1567` |
| Overview closed-status card | "Roster frozen {date}" **only if** `roster_frozen_at` is present. | `TournamentOverview.tsx:120-124`; label `defaultLabels.ts:1569` |
| Key-date glyph state | Hard-block row state uses `Boolean(roster_frozen_at)`. | `TournamentOverview.tsx:93`; `src/utils/tournamentExperience.ts:131-145` |
| Participants tab committee note | Committee only: "Add or remove players until the roster is frozen on {date}" using `registration_hard_block_at`, or the frozen note when `phase === 'frozen'`. | `ParticipantsTab.tsx:326-336`; labels `defaultLabels.ts:1481`, `:1484` |
| Participants tab "Register a player" | Hidden when `phase === 'frozen'` and in team mode. | `ParticipantsTab.tsx:106` |
| Mapper | Absent keys map to `null` (`?? null`), so a missing hard block or `roster_frozen_at` does not throw. | `src/api/tournaments.ts:223-225` |
| Open-status copy for everyone | "Self-registration closes {date}. After that only the committee can add players." | `defaultLabels.ts:1293` (used `TournamentOverview.tsx:104`) |

There is no mobile key `Registration closes` for participants; the participant-visible soft row is titled "Soft block".

### 2.3 Registration open / closed

- **v1 page:** `registration_open` is computed on the device: `registration_closes_at === null || Date.parse(registration_closes_at) > Date.now()` (`src/api/tournaments.ts:184-185`). It drives `canRegister`, the closed message and the fee-edit gate (`TournamentDetailScreen.tsx:707-718`). The backend field `registration_open` is not read.
- **v2 page:** `registrationOpen = scoring?.registration_phase === 'open'` (`TournamentDetailScreen.tsx:771`).

### 2.4 `registration_phase` values

Mobile documents and branches on `open | committee_only | frozen` (`src/types/tournamentScoring.ts:48-49`; `tournamentExperience.ts:78-89`, `:114-120`; `FixturesSetup.tsx:111`; `ParticipantsTab.tsx:106`, `:329`). The normaliser passes any string through (`src/utils/tournamentScoring.ts:246-248`). Per `er-bw-tournament-report.md` section 3 and addendum AD-4, `GET /tournaments/{id}/scoring/state` now returns `open` or `closed` to a viewer who may not see the block dates. For `closed`, `stripModel` falls through to its last return (`pill: mob.closure.status.active`, no stepper; `tournamentExperience.ts:89`), `overviewKind` returns `unknown` (`:120`) and the Overview status block renders an empty `<View />` (`TournamentOverview.tsx:174-176`). `canRegisterV2` is false for `closed`, which is correct; the rest of the page has no closed branch for a participant.

## 3. Types: tournament and event

### 3.1 Tournament

Wire type `TournamentApiItem` (`src/api/tournaments.ts:83-140`), app type `Tournament` (`src/types/tournament.ts:86-176`).

| Field the screens need | Mobile today | Backend (`meetup:tournaments/schemas.py`) |
|---|---|---|
| `registered_count` | Read as optional, commented "List endpoint only"; mapped to `participant_count: number | null` (`api/tournaments.ts:97`, `:186`; `types/tournament.ts:99-100`). The type header says it "is not on `TournamentResponse`" and returns 0 (`types/tournament.ts:71-75`), which is stale. v2 screens ignore it and count the registrations list. | `registered_count: Optional[int]` (:268), now set on every route (`er-bw-tournament-report.md` §3 AD-4) |
| `is_full` | **Missing** from both types. | `is_full: Optional[bool]` (:272) |
| `registration_open` | Exists on `Tournament` but is **derived** (see 2.3); not on `TournamentApiItem`. Typed `boolean`, not optional. | `registration_open: Optional[bool]` (:273) |
| `registration_closes_at` | Present, typed `string | null` (`api/tournaments.ts:92`; `types/tournament.ts:104`). | Visible to all |
| Soft block | Same field as above (`registration_closes_at`). There is no separate soft-block field. | n/a |
| Hard block `registration_hard_block_at` | Present, optional/nullable (`api/tournaments.ts:124`, `:224`; `types/tournament.ts:152`). Absence is tolerated. | Key **absent** (not null) for non-privileged viewers (`schemas.py:332-335`) |
| `roster_frozen_at` | Present, same handling (`api/tournaments.ts:125`, `:225`; `types/tournament.ts:153`). | Same |
| `registrant_withdrawal_locked` | **Missing**. | **Not in `TournamentResponse`**: it is a model column (`meetup:tournaments/models.py:77`), read in `registration_v2.py:422`, and absent from `schemas.py` (see section 8) |
| `fixtures_reset` (PATCH answer) | **Missing**; no general PATCH client exists (section 4). | `fixtures_reset: Optional[bool]` (:274), set only by `PATCH /tournaments/{id}` |
| Rule fields | `format_rules` = `{elimination, sets_best_of, points_to_win, courts, min_participants, max_participants}`, each `number | string | null` (`api/tournaments.ts:142-159`; `types/tournament.ts:154-155`, `:196-203`). | Unchanged by this batch (addendum AD-1: capacity/snapshot unchanged) |
| `capacity` | Present; mapped to `max_participants` (`api/tournaments.ts:91`, `:187`). | Kept |
| `lifecycle_version` | Present (`api/tournaments.ts:122`). | Present |

### 3.2 Event

| Field | Mobile today | Backend |
|---|---|---|
| `EventResponse.series` `{rule_id, interval, ends_on, occurrence_limit, index, total, my_membership}` | **Missing** from `EventApiItem` and `Event` (`src/api/events.ts:85-122`; `src/types/event.ts:47-113`). | `SeriesInfo` (`meetup:events/schemas.py:154-161`, field on `EventResponse` at `:225`); `my_membership` is `active | left | none` |
| `recurrence_rule_id` | Read; mapped to `is_recurring: boolean` (`api/events.ts:98`, `:213`; `types/event.ts:67`). `is_recurring` is not used by any other source file. | Present (`schemas.py:191`) |
| Create body recurrence fields (`recurrence_frequency`, `recurrence_interval`, `recurrence_day_of_week`, `recurrence_ends_on`, `recurrence_occurrence_limit`) | **Missing** from `CreateEventInput` (`src/types/event.ts:206-248`). | Present (`meetup:events/schemas.py:51-56`) |
| Series action bodies/answers (`PATCH /events/{id}/series` with `start_time`, `duration_minutes`, ...; leave answer `{left, games_left}`) | No types, no client functions. | `SeriesUpdate` (`schemas.py:570-`), routes `events/router.py:169`, `:189`, `:231` |

## 4. Tournament management

### 4.1 Committee add / remove (registrants)

- **Add:** `committeeAddPlayer(id, userId)` posts `{ user_id }` only (`src/api/tournaments.ts:876-881`). No `team_id` path exists. UI: "Register a player" button, individual tournaments only, hidden when `phase === 'frozen'` (`src/components/tournament/v2/tabs/ParticipantsTab.tsx:106`, `:512-520`); sheet with `UserSearchPicker` (`:550-573`); handler `add` (`:242-245`). Team mode shows only the note "A tournament team registers itself. The committee adds individual players only." (`:521`; `defaultLabels.ts:1892`).
- **Remove:** `withdrawFromTournament` → `DELETE /tournaments/{id}/registrations/{registration_id}` (`api/tournaments.ts:332-342`). UI: per-row "…" for committee, `Alert` menu then confirm dialog (`ParticipantsTab.tsx:214-240`, `:275-281`, `:475-485`, `:539-547`). No phase check in mobile around remove.
- **Committee membership (people on the committee):** chosen in the create wizard (`src/components/tournament/wizard/CommitteeStep.tsx`); the committee invitee accepts via `CommitteeInvitationCard` and `getCommitteeInvitation`/`respondToCommitteeInvitation` (`api/tournaments.ts:706-728`); `getCommitteeMembers` is read-only (`:730`). No add or remove of committee members after creation exists.
- **Teams client:** `src/api/teams.ts` exports `createTeam` (`:47`) and `getMyTeams` (`:58`) only; there is no function that lists teams of a sport for a committee member.

### 4.2 Edit tournament screen

None. No source file contains an edit-tournament screen, and the only `PATCH /tournaments/{id}` client is `updateTournamentFee` (`src/api/tournaments.ts:319-330`), which sends `registration_fee_cents` and optionally `payment_contact_number`. Fee edit UI: `src/components/tournament/FeeEditSheet.tsx`, gated at `TournamentDetailScreen.tsx:717-722` by `registration_open` (the derived value) and status. The organizer tools list on the v2 Overview has invite, prepare fixtures, review, add banner and closure; no edit (`TournamentOverview.tsx:180-233`). The only date validation on mobile is the create wizard's mirror of five rules (`src/utils/tournamentWizard.ts:182-188`, `:189-240`).

### 4.3 Draft / fixtures screen (where "Shuffle again" would go)

`src/components/tournament/v2/tabs/FixturesSetup.tsx`. Steps: points, then the generate controls with a Generate/Regenerate button (`:296-312`, handler `generate` `:195-204`, `runGenerate` `:170-193`, calling `generateFixtureDraft`), then the draft card `setup-draft` (`:318-359`): status chips (`:323-324`), summary (`:327`), group list from the draft (`:333-346`), then either the waiting block or the Submit button (`:348-357`). Regenerate already confirms with an `Alert` (`:195-200`). There is no shuffle client function and no `shuffle_*` string anywhere in `src/`. `DraftDetail` (`src/types/tournamentTabs.ts:171-184`) and `normaliseDraft` (`src/utils/fixturesSetup.ts:131-`) carry no `shuffle_index` / `shuffle_total`. Backend: those two keys are added to the draft payload only by a shuffle (`meetup:tournaments/fixture_core_adapter.py:569-571`, call at `engine_service.py:342`), so a freshly generated draft payload does not carry them.

### 4.4 Draft refusal mapping (existing)

Fixture refusals use `errLabelKey` over a fixed code list that includes `FIXTURE_FROZEN` (`src/utils/fixturesSetup.ts:34`, `:41`) and render through `RefusalList` (`FixturesSetup.tsx:189`, `:233-242`).

### 4.5 Server code mapping

Registration/payment refusals go through `classifyRefusal` and `CODE_LABELS` (`src/utils/refusal.ts:13-62`, `:111-140`). A code not in the table on a 409 or 422 falls to the generic label with `isSystemFault: true`; 401/403, 404 and 429 get their own generic labels (`refusal.ts:131-140`).

| Code | In mobile? | Where |
|---|---|---|
| `ROSTER_LOCKED` | No | n/a |
| `WITHDRAWAL_LOCKED` | No | n/a |
| `SHUFFLE_UNAVAILABLE` (+ `reason`) | No | n/a |
| `TOURNAMENT_DATES_INVALID` | Only inside the create wizard, with `reason` and `field` mapped to wizard issues; the five reasons match the backend list. Not in `refusal.ts`. | `src/utils/tournamentWizard.ts:182-188`, `:590-598` |
| `SERIES_END_INVALID` | No | n/a |
| `SERIES_LIMIT_EXCEEDED` | No | n/a |
| `SERIES_HAS_PARTICIPANTS` | No | n/a |
| `SERIES_ORGANIZER_CANNOT_LEAVE` | No | n/a |
| `REGISTRATION_DATES_REQUIRED` (also new) | No (the similarly named `REGISTRATION_DATES_NOT_SET` exists, `refusal.ts:29`) | n/a |
| `TOURNAMENT_STARTED`, `TOURNAMENT_HAS_RESULTS` (also new) | No | n/a |
| Related, already present | `TOURNAMENT_FULL` (:17), `COMMITTEE_ADD_CLOSED` (:32), `WITHDRAWAL_CLOSED` (:36), `ROSTER_FROZEN` (:39), `FIXTURE_FROZEN` (fixtures list only) | `refusal.ts`, `fixturesSetup.ts:34` |

## 5. Labels

**Mechanism.** Every customer-facing string is a key resolved by `useT()` / `getLabel`: a non-empty remote value whose placeholders can all be filled wins, otherwise the bundled default, otherwise the raw key (`src/labels/LabelsContext.tsx:154-173`). Order: bundled defaults, then AsyncStorage cache, then `GET /api/labels` on launch and on foreground after the TTL (`LabelsContext.tsx:1-14`, `:60-82`). Bundled defaults live in `src/labels/defaultLabels.ts` (1942 lines) plus `BASE_LABELS` in `src/labels/fallbackLabels.ts:27`; `LabelKey` is typed from them, so a `t()` call with an unregistered key does not type-check.

**`npm run check:labels`** (`package.json:7` → `scripts/check-labels.js`; also CI `.github/workflows/label-scan.yml` on push to `main` and every PR). It fails on (a) hardcoded customer text in JSX, listed props, `Alert.alert` and toast calls, (b) a label key used in source (`t`, `currentT`, `bundledT`, `getLabel`, or a `mob.` literal) with no entry in the bundled defaults, (c) a banned glossary term (`docs/glossary.json`) in a default value (`scripts/check-labels.js:4-12`). Exclusions live only in `scripts/check-labels.allowlist.json`. `docs/label-inventory-mobile.json` is the inventory. Not run in this task.

**Which new keys resolve on mobile.** The backend seeds 101 keys (`meetup:core/label_fallbacks_tp.py` `ER_LABEL_FALLBACKS`; report `er-config-labels-report.md` §4). Only two groups carry a `mob.` prefix; `er-config-labels-report.md` D-4 states the mobile screen keys are left to this repo.

| Key group | In `defaultLabels.ts`? | Evidence |
|---|---|---|
| `mob.reg.err.roster_locked`, `withdrawal_locked`, `tournament_started`, `tournament_has_results`, `shuffle_unavailable`, `registration_dates_required`, `series_end_invalid`, `series_limit_exceeded`, `series_has_participants`, `series_organizer_cannot_leave` | **0 of 10** present | `grep` of `defaultLabels.ts` finds none; no `CODE_LABELS` entry either (4.5). Served remotely only if M3 has run (unverified). |
| `mob.notif_pref.type_tournament_updated`, `type_tournament_registration_added` | **0 of 2** | Only `type_team_join_request` and `type_tournament_registration_removed` exist (`defaultLabels.ts:1785-1786`) |
| `notif.tournament_updated.*`, `notif.tournament_registration_added.*` (push text) | Not applicable | Mobile shows the push `title`/`body` it receives (`fcm.ts:227-236`) |
| `web.*` (`web.series.*`, `web.tournament.registered_count`, `web.tournament.full_chip`, `web.tournament_edit.*`, `web.console.shuffle.*`, `web.tournament.v2.kd_registration_closes`, add-team keys) | Not applicable to mobile | `web.` keys; no `mob.` copy exists in the backend seed |
| Mobile equivalents for: count without cap, Full chip, "Registration closes", Edit tournament, Add team, Shuffle again, Repeat weekly, series chip/skip/leave/scope | **None** | No `mob.*` key for any of these in `defaultLabels.ts` |
| OI-14 reworded `mob.reg.err.committee_add_closed`, `withdrawal_closed`, `roster_frozen` | Present but with the **old** "frozen" text; the remote value overrides once M3 has run | `defaultLabels.ts:1747`, `:1784`, `:1771`; backend text `meetup:core/label_fallbacks_tp.py` `ER_REWORDED_LABELS` |
| Mobile-only "frozen" copy outside the M3 reword list | Present, unchanged | `defaultLabels.ts:1481` (committee note), `:1484`, `:1567`, `:1569`, `:1293` ("After that only the committee can add players") |

Existing labels that carry the cap: `mob.tournament.registered_line` `{count}/{max} registered` (`defaultLabels.ts:429`), `mob.tournament.v2.ov_progress` (`:1296`), `mob.tournament.participants.registered_of` (`:1486`), `mob.tournament.v2.register_spots_left` (`:1269`), `mob.gv.registered_of` (`:1057`).

## 6. Create game wizard and the game view

### 6.1 Wizard (`src/screens/CreateGameScreen.tsx`, 1722 lines)

One 6-step wizard shared by game and tournament (`totalSteps={6}`, `:1338`; `mode` is set at step 1, `:403`). `handleNext` is `:406-458`.

| Step | Title key | Render | Notes |
|---|---|---|---|
| 1 | `mob.create_game.step_what` | `renderStep1` `:649` | Choose Game or Tournament |
| 2 | `step_sport` | `:691` | Title, sport (title required, `:413`) |
| 3 | `step_when_where` ("When and where?") | `:745` | Date (`:780` / `:865`), start time (`:876`), duration (game, `:839`), venue (`VenuePicker` `:913`, legacy search `:969-1033`); past-date check `:421-424` |
| 4 | `step_who` | `:1055` | Visibility, groups (group required `:433-436`) |
| 5 | `step_players_skill` | `:1107` | Capacity (min from `gameLimits.players_min`, `:441`), skill, game fee and payee number (`:444-454`) |
| 6 | review header | `:1153` | Invite players and emails; Create button at `:1359`; summary rows `:1261-1319` |

Submit builds `CreateEventInput` at `:516-548` and calls `createEvent` at `:554`. The input has no recurrence fields (3.2).

**Where a "Repeat weekly" control would sit.** The addendum names no mobile position (AD-8, "the create game screens (web and mobile wizard) get Repeat weekly"). The web build placed it under date and time in step 3 and added a line on the review step (`er-web-series-report.md` §2). On mobile, step 3 is the only step holding the start date, time and duration; the review step (6) is where the summary rows live. Game-only branches inside step 3 already exist (`:839-846` vs the tournament branch `:884`).

Limits needed by the control: `GET /config/game-limits` returns `players_min`, `players_max`, `max_groups_per_game` only (`src/api/config.ts:3-8`, `:34-41`; `meetup:client_config_router.py:15`). See section 8.

### 6.2 Game view and its actions (`src/screens/EventDetailScreen.tsx`, 2543 lines)

| Action | Code | API |
|---|---|---|
| View header, organizer Edit and Cancel icons | `isOrganiserActionsVisible` `:1437`; buttons `:1493-1512` (Edit → `handleStartEdit` `:1498`; Cancel → opens the delete modal `:1507`) | n/a |
| Edit | `isEditing` `:207`, edit branch `:989`, `handleSaveEdit` `:611-723` | `updateEvent` → `PATCH /events/{id}` (`src/api/events.ts:335`) |
| Cancel | `handleDeleteGame` `:725-` (reason fixed to `'Deleted by host'`, `:732`); confirm modal `:1866-1893` | `cancelEvent` → `POST /events/{id}/cancel` (`api/events.ts:316-326`) |
| Join / Register | `handleRsvp` (`rsvpEvent` at `:796`; fee path `:767-768`) | `POST /events/{id}/rsvp` `{action: 'going'}` (`api/events.ts:290-301`) |
| Accept (invite-only) | `handleAcceptInvite` `:846-` (`respondToEventInvitation` `:854`) | `POST /events/{id}/invitations/respond` (`api/events.ts:507-519`) |
| Withdraw | `handleWithdraw` `:817-` (`withdrawEvent` `:822`); button labelled `mob.respond.decline` for a going player (`:1718-1726`) | `POST /events/{id}/rsvp` `{action: 'withdrawn'}` (`api/events.ts:303-310`) |
| Decline | `handleDecline` `:874-` (`declineEvent` `:879`) | `POST /events/{id}/decline` (`api/events.ts:559-570`) |
| Non-organizer button block | `:1715-1790` | n/a |

No series chip, no "Repeats weekly" line, no Skip, no Leave series, no scope choice for Edit/Cancel, and no `leave`/`PATCH series`/`series/cancel` client exist. The game list cards (`EventCard`, `UnifiedCard` game branch) show no recurrence.

## 7. Boards

**Where boards live.** In this repo: `docs/design/game-view-redesign/` (`game-view`, `games-list`, `invite-picker`, `popups`, `tournament-view`; png + html), `docs/design-ref-venue/` (`Game3When`, `EditGame2`, `GameDetail`, `TournSched`, `TournSchedErr`, `TournSchedWarn`, `FXEdit*`, `WebCreateBasics`), `design-ref-p23/` (repo root: `Game1Type` to `Game6InviteOnly`, `EditGame` to `EditGame4`, `DeleteGame`, `GameDetail`), `docs/design/notifications/`, `docs/mockups/user-menu/`, `docs/mockups/group-view/`. `docs/INDEX.md` "Design reference (UI)" lists these (lines under that heading).

**Not in this repo.** The three folders the addendum names as the nearest families (`docs/design/tournament-experience`, `docs/design/teams-payments`, `docs/design/tournament-lifecycle`, addendum §4 "Boards") do not exist here. They exist in `pratheeshku/meetup@670ad7c` under `docs/design/`. Mobile source comments cite their board names (for example `TV2MobOpen` in `TournamentOverview.tsx`, `TournCommittee` in `CommitteeStep.tsx:2`). `docs/INDEX.md` does not mention them, so a build agent working only from this repo cannot open them.

| Screen | Board of its own? | Nearest existing board (not opened unless stated) |
|---|---|---|
| Tournament view (count, Full chip, "Registration closes", no block dates) | **No** | Mobile repo `docs/design/game-view-redesign/tournament-view.png`; backend `tournament-experience/TV2MobOpen*`, `TV2MobClosed*`; backend `tournament-lifecycle/TPDetailFull.png` (opened). `TPDetailFull` shows "Full" chip, "18 of 32 players registered", the hard-block row and a disabled "Tournament full" button: it contradicts AD-1 and AD-4 on the count and the block rows and is covered by the addendum's supersession (§4). |
| Edit tournament | **No** | None found by name in either repo. Addendum names `design/tournament-experience` and `tournament-lifecycle` as families. |
| Committee add (individual) after the closure | **No** | Backend `tournament-lifecycle/CMAddPick`, `CMAddDone`, `CMAddFull`, `CMAddSkill`, `CMAddAlready`; `CMAddHard.png` (opened: "Roster is frozen … Nobody can be added") is superseded by AD-5 per addendum §4. |
| Committee add team | **No**, and an existing board disagrees | Backend `tournament-lifecycle/CMAddTeam.png` (opened): "After the soft block the committee adds individuals only. A team must register itself before the soft block." This contradicts AD-2 and AD-5 (committee adds a team in every phase). The addendum's superseded list (§4) names `CMAddHard` and not `CMAddTeam`. |
| Shuffle again | **No** | None by name. Draft boards exist in `tournament-lifecycle/FXDraft*`, `tournament-experience/TV2MobSetupDraw`, `TV2MobReviewFixtures`. |
| Repeat weekly (create game) | **No** | `design-ref-p23/Game3When.png` and `docs/design-ref-venue/Game3When.png` (create step 3). |
| Series chip and series actions (game view) | **No** | `docs/design/game-view-redesign/game-view.png`, `design-ref-p23/GameDetail.png`, `design-ref-p23/DeleteGame.png`, `EditGame*.png`. |

Per ruling B-1 (addendum §4, OI-8 closed) the written addendum is the board of record for the five new screens (Edit tournament, Repeat weekly, series actions, Shuffle again, committee add/remove after the closure). Flag: `AGENTS.md` says "if no board exists, stop and ask", and `docs/INDEX.md` says "build it minimal, then ask the owner to review"; B-1 overrides both for these screens. The `CMAddTeam` conflict above is the one case in this list where an approved board and the addendum disagree outside the two superseded elements.

## 8. Contract gaps (facts; nothing invented)

| # | Need | State |
|---|---|---|
| G1 | Bounds for the Repeat weekly control (`max_interval_weeks`, `max_occurrences`, horizon) | No endpoint returns them: `/config/game-limits` returns `players_min`, `players_max`, `max_groups_per_game` (`meetup:client_config_router.py:15`); `/config/client` carries maps key, venue flag and fee keys (`src/api/config.ts:11-21`). The web build hit the same gap (`er-web-series-report.md` D-1); the server answers `SERIES_LIMIT_EXCEEDED` / `SERIES_END_INVALID` instead. |
| G2 | Initial state of the "registered players can withdraw" control on Edit tournament | `registrant_withdrawal_locked` is not in `TournamentResponse` (`meetup:tournaments/schemas.py`; column at `tournaments/models.py:77`). The web build noted the same (`er-web-tournament-report.md` D-2). |
| G3 | Whether a freshly generated draft can be shuffled / `shuffle_total` before the first shuffle | Payload keys `shuffle_index` / `shuffle_total` exist only on shuffled drafts (`fixture_core_adapter.py:569-571`); the shuffle answer adds `shuffle {index, total}`; generate and read add none (`er-bw-shuffle-report.md` D-4). A single-draw tournament is learned from `409 SHUFFLE_UNAVAILABLE` reason `single_draw`. |
| G4 | Team list for "Add team" | Backend route is `GET /teams` per `er-web-tournament-report.md` §3 and D-6 (not read in code here). Mobile has no client for it; `getMyTeams` returns the caller's teams only (`src/api/teams.ts:58`). |
| G5 | `entity_id` and `entity_type` of `tournament_updated` / `tournament_registration_added` pushes | Not stated in the reports read; addendum AD-9 says the push opens the tournament view. Not verified. |
| G6 | `registration_phase` value `closed` | Returned by the backend for non-privileged viewers (`er-bw-tournament-report.md` §3); not handled by mobile (2.4). Mobile-side reading mismatch rather than a backend omission. |
| G7 | Live check of the above on the deployed API and of M3 labels | Not possible from this session (proxy 403). |

Fields the backend does return that mobile does not yet read, for completeness: `is_full`, `registration_open`, `fixtures_reset`, `registered_count` on detail and `/mine`, `EventResponse.series`, the recurrence create fields, the shuffle answer's `shuffle` block.

## 9. Drift to report (docs/ not edited)

- `docs/INDEX.md` points to `design-ref-p23`, `design-ref`, `design-refs` and mobile board folders but not to the backend `docs/design/{tournament-experience,teams-payments,tournament-lifecycle}` that the addendum and mobile source comments name (section 7).
- `src/types/tournament.ts:71-75` (`participant_count` "not on `TournamentResponse`") and `src/api/tournaments.ts:96` ("List endpoint only") describe the pre-change backend. This is a code comment, not a doc; noted only.
- The addendum (AD-4, line 122) says mobile `TournamentOverview` uses `roster_frozen_at`; confirmed (`TournamentOverview.tsx:93`, `:120-124`). The addendum (AD-8) says mobile maps `recurrence_rule_id` to `is_recurring`; confirmed (`api/events.ts:213`).

## 10. Not done

No code, test, lint, label scan or build was run. No live API call succeeded. No board image other than `CMAddTeam`, `TPDetailFull` and `CMAddHard` was opened. Nothing is self-certified; the architect rates this report.
