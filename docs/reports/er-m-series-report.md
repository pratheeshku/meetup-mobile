# er-m-series report (step 3.4)

Task ID: `er-m-series`. Machine: Cloud (agent session), repo root `/home/user/meetup-mobile`. Branch `claude/beautiful-hypatia-1wa00s`, restarted from `origin/main` @ `35390dc` (addendum v1.11; PRs #75, #77, #79 merged).
Design: `docs/DES-MEETUP-ADDENDUM-tournament-edit-recurring.md` v1.11, AD-8 (series), AD-9 (notifications), rulings A20 to A24 (series contract) and A38 to A54. **No board exists; the addendum is the board of record (A38).** Screenshots are taken later on the Mac (A45); none are attached.
Scope kept: tournament view, committee, edit and shuffle code, native config, package files and `docs/` (other than this report) untouched. No version chosen, no build, no force-push, no agent dispatched.

## 1. What was built

| Step | Change | Files |
|---|---|---|
| 1 Create game | "Repeat weekly" on step 3 (game only), under the date and time and above the venue: a switch, the interval in weeks (default 1), the read-only weekday of the start date, and one end rule chosen between "After a number of games" and "On a date". Next is refused until the interval is a whole number of 1 or more and exactly one end rule is chosen and filled. The request adds `recurrence_frequency: "weekly"`, `recurrence_interval` and either `recurrence_occurrence_limit` or `recurrence_ends_on` (never both, no weekday). The copy "Invitations go to the first game..." shows in the control; the review step shows "Repeats {every}, {end}". No bound is kept on the device. `SERIES_END_INVALID` and `SERIES_LIMIT_EXCEEDED` from the create call show their labels on step 3. | `src/components/RepeatWeeklyControl.tsx`, `src/utils/repeatWeekly.ts`, `src/screens/CreateGameScreen.tsx` |
| 2 Game view | Under the time row: chip "Weekly · n of N" (or "Weekly · game n" when the server sent no total) and the line "Repeats weekly" or "Repeats every n weeks", then "Ends after N games" or "Ends on {date}", all from `EventResponse.series` (the date is only formatted). A person who has not joined sees the note that accepting joins the whole series. An active member who is going gets **Skip this game** in place of Decline (the existing withdraw, confirmed first) and **Leave series** (confirmed; `POST /events/{id}/series/leave`; shows the server's `games_left`). The organizer never sees Leave; `SERIES_ORGANIZER_CANNOT_LEAVE` still has its label. | `src/components/series/SeriesParts.tsx`, `src/utils/seriesDisplay.ts`, `src/screens/EventDetailScreen.tsx` |
| 3 Organizer | For a series game the Edit and Cancel icons first ask "This game" or "This and following games". "This game" runs the existing edit form and cancel sheet unchanged. "This and following" edit opens a sheet with start time (`HH:MM`) and duration in minutes and sends `PATCH /events/{id}/series` with those two fields only; "This and following" cancel confirms, then `POST /events/{id}/series/cancel` with a reason. `SERIES_LIMIT_EXCEEDED`, `SERIES_HAS_PARTICIPANTS` and `SERIES_END_INVALID` show labels. A game outside a series shows no scope question. | `SeriesParts.tsx`, `EventDetailScreen.tsx` |
| 4 Types and clients | `EventSeries` and `Event.series`, `series` mapped from the response (null without a rule id; numbers stay null when missing), the five recurrence create fields, `leaveEventSeries`, `updateEventSeries`, `cancelEventSeries`. No new endpoint. | `src/types/event.ts`, `src/api/events.ts` |
| 5 Notifications | `tournament_updated` and `tournament_registration_added` added to the type union and list, so a push is no longer dropped; both route to the tournament (`entity_id`); each has a preference row and an icon. Series actions keep using `event_changed` and `event_cancelled`, untouched. | `src/types/notification.ts`, `src/notifications/notificationRouting.ts`, `src/components/NotificationPreferencesList.tsx`, `src/components/icons/NotificationIcon.tsx` |
| 6 Labels | Seeded keys and wording only (section 4). | `src/labels/defaultLabels.ts`, `src/utils/refusal.ts` |
| 7 Rules | Theme tokens and shared components only; no literal colours; one `withCorrelationId()` per action (create, skip, leave, series edit, series cancel). | n/a |

Diff against main (code and tests, before this report):

```
 src/api/events.ts                                  |  46 ++++
 src/components/NotificationPreferencesList.tsx     |   2 +
 src/components/RepeatWeeklyControl.tsx             | 132 ++++++++++++
 src/components/icons/NotificationIcon.tsx          |   2 +
 src/components/series/SeriesParts.tsx              | 231 +++++++++++++++++++++
 src/labels/defaultLabels.ts                        |  49 +++++
 src/notifications/__tests__/fcmForeground.test.ts  |   6 +
 .../__tests__/notificationRouting.test.ts          |  27 ++-
 src/notifications/notificationRouting.ts           |   4 +
 src/screens/CreateGameScreen.tsx                   |  43 ++++
 src/screens/EventDetailScreen.tsx                  | 110 +++++++++-
 src/screens/__tests__/CreateGameRepeat.test.tsx    | 158 ++++++++++++++
 src/screens/__tests__/EventSeries.test.tsx         | 221 ++++++++++++++++++++
 .../__tests__/NotificationHistoryScreen.test.tsx   |   9 +
 .../NotificationPreferencesScreen.test.tsx         |   4 +-
 src/types/event.ts                                 |  26 +++
 src/types/notification.ts                          |   6 +-
 src/utils/refusal.ts                               |   4 +
 src/utils/repeatWeekly.ts                          |  55 +++++
 src/utils/seriesDisplay.ts                         |  37 ++++
 20 files changed, 1164 insertions(+), 8 deletions(-)
```

Commits (one per logical change): push and history routing; series types, clients and labels; Create game Repeat weekly; game view series actions.

## 2. Checks (each once; raw)

`npx tsc --noEmit`: no output (clean).

`npm run check:labels`:
```
check-labels: OK - 323 files scanned, 2037 default labels checked.
```
No allowlist entry was needed.

`npm run lint` (whole repo): `✖ 35 problems (34 errors, 1 warning)`, **identical to `origin/main`** (diff of the full outputs empty); nothing in a touched file.

`npx jest`, only the files covering the touched modules (the new `EventSeries` and `CreateGameRepeat`, every `CreateGame*`, `EventDetailScreen`, `Access*`, notification preferences, history, routing, foreground and fcm tests, events api, refusal, banner, `TournamentGameView`):
```
FAIL src/screens/__tests__/CreateGameScreen.test.tsx
FAIL src/screens/__tests__/EventDetailScreen.test.tsx (6.481 s)
Test Suites: 2 failed, 23 passed, 25 total
Tests:       71 failed, 355 passed, 426 total
```
All 71 failures are in `CreateGameScreen.test.tsx` and `EventDetailScreen.test.tsx`, and **the same two files fail the same way on `origin/main`** (run there with the same single files: `Test Suites: 2 failed, 2 total`, `Tests: 71 failed, 25 passed, 96 total`; the failing names match, apart from two names whose emoji prints differently). They predate this task (old BUILD-era assertions). The full suite was not run.

New tests: `EventSeries.test.tsx` (13), `CreateGameRepeat.test.tsx` (7), additions in `notificationRouting.test.ts`, `fcmForeground.test.ts`, `NotificationHistoryScreen.test.tsx`; `NotificationPreferencesScreen.test.tsx` had a stale pin (`toHaveLength(19)` against a list of 23, failing on main) and now pins 25 with the two new rows.

## 3. Screenshots

Not taken: no emulator in the cloud session. Taken on the Mac at the 4.3 device test and attached to the 3.6 review (A45).

## 4. Labels (seeded keys, seeded wording; `er-config-labels-report.md` §4, §6 and the M3 seed)

`web.series.*`: `repeat_toggle, every_label, weeks_suffix, weekday_note, end_title, end_count, end_count_label, end_date, end_date_label, end_required, every_invalid, invite_note, review_line, every_one, every_many, end_after, end_on, chip, chip_open, repeats_weekly, repeats_every, ends_after, ends_on, accept_note, skip, skip_confirm, skipped, leave, leave_confirm, left, scope_edit_title, scope_cancel_title, scope_this, scope_following, scope_hint, edit_title, edit_start_time, edit_duration, edit_hint, edit_none, edit_saved, cancel_confirm, cancel_done`; `mob.reg.err.{series_end_invalid, series_limit_exceeded, series_has_participants, series_organizer_cannot_leave}`; `mob.notif_pref.type_tournament_updated` "Tournament dates or venue changed", `mob.notif_pref.type_tournament_registration_added` "Added to a tournament". As in 3.1 to 3.3 (A43) the `web.*` seeded keys are used where no `mob.*` copy is seeded. Existing keys reused: `mob.common.save`, `mob.common.cancel`, `mob.game_detail.{leave_error, cancel_error, edit_error}`. No key renamed or invented; every needed key was seeded.

## 5. Drift and judgement calls (for the architect)

1. **Placement.** The addendum gives no mobile layout (A38). Repeat weekly sits in step 3 under the date and time; the chip and line sit under the time row of the details card; Skip replaces Decline for a going member and Leave series sits under the RSVP buttons; the scope question is an alert on the Edit and Cancel icons.
2. **Count lower bound.** The screen does not stop a small or large number of games; it requires a whole number of 1 or more and lets the server answer (`SERIES_END_INVALID` for fewer than two, `SERIES_LIMIT_EXCEEDED` over the limit), as A29 says. The web report stopped at 2; this keeps no number on the device.
3. **Start time box.** The series edit sheet takes a typed `HH:MM`; there is no time-only picker in the shared field (`DateTimePickerField` has date and date-time only) and no seeded "invalid time" label. A box that is empty or not a valid `HH:MM` is not sent; with nothing to send the sheet shows the seeded "Change the start time or the duration first." The server reads the time as Singapore time (A21, as on the web).
4. **Chip without an index.** If the server sends no `index` the chip is not shown (the line still is); nothing is counted on the device.
5. **Skip scope.** Skip appears for a member who is going. A member who skipped (not going, membership still active) sees Join or Accept again and Leave series.
6. **Series cancel reason.** The series cancel sends the same fixed reason text as the existing single cancel ("Deleted by host"), as `EventCancelRequest` requires a reason.
7. **History taps.** A tournament notification row with no `entity_id` does nothing (the existing rule for every type except `global` and `group_deleted`).
8. **Pre-existing:** the 71 failing tests in two files and the 34 lint errors are untouched.

No CRITICAL or HIGH gap; no Blocked Report. Nothing is self-certified; the architect rates this report.
