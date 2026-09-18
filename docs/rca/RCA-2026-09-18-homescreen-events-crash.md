# RCA — HomeScreen crash: `Cannot read property 'length' of undefined`

## 1. Incident

- **What happened**: after a successful Google Sign-In, `HomeScreen` (the
  events feed, `src/screens/HomeScreen.tsx`) crashed with
  `Cannot read property 'length' of undefined` at line 93
  (`contentContainerStyle={events.length === 0 ? ... : ...}`).
- **Detection**: reported by the user as a runtime crash immediately after
  sign-in, reproducing on first mount of the events feed.
- **Impact**: the events feed — the app's primary post-login screen — is
  unusable; every user hits this on first login.

## 2. Root cause

`HomeScreen.loadEvents()` does:

```ts
const response = await getEvents();
setEvents(response.items);
```

`getEvents()` (`src/api/events.ts`, prior version) called
`apiClient.get<EventsListResponse>('/events', ...)` and returned `data`
as-is, where `EventsListResponse` was defined as
`{ items: Event[]; total: number; page: number; page_size: number }`.
That shape was never confirmed against the real backend — `src/types/event.ts`'s
own header comment already flagged it as a Proposed Assumption made
because the parent backend design (`DES-MEETUP.md`) is not present in
this repo, and the prior events Implementation Report
(`docs/reports/IMPL-DES-MEETUP-MOBILE-events.md`, Proposed Assumption #2)
recorded the same gap and deferred correcting it to conformance review.

**Live confirmation** (this session, 2026-09-18) against the real backend's
self-served OpenAPI schema:

```
$ curl -s https://meetups.duckdns.org/openapi.json | jq '.paths["/events"].get.responses."200".content."application/json".schema'
{
  "type": "array",
  "items": { "$ref": "#/components/schemas/EventResponse" },
  "title": "Response List Events Events Get"
}
```

`GET /events` returns a **bare JSON array** of `EventResponse` objects —
there is no `items`/`total`/`page`/`page_size` envelope. At runtime,
`data` was therefore an array, `data.items` was `undefined`, and
`setEvents(undefined)` overwrote the `useState<Event[]>([])` initial
value. On the next render, `events` was `undefined` and
`events.length` (HomeScreen.tsx:93) threw.

The same OpenAPI check also showed the per-item field names diverge from
what `src/types/event.ts`'s `Event` interface guessed — e.g.
`organizer_id` (not `organiser_id`), `venue_name`/`venue_address` (not
`location`), `going_count` (not `participant_count`),
`user_rsvp_status` (not `current_user_rsvp_status`),
`recurrence_rule_id` (not a boolean `is_recurring`), and no
`waitlist_count`/`is_organiser` fields at all. This is the same class of
gap (invented contract, never reconciled against the real backend), just
manifesting silently (wrong/blank display) rather than as a crash for
fields `HomeScreen` doesn't render.

## 3. Fix

`src/api/events.ts`, `getEvents()` only:

- Requests are now typed as `EventApiItem[]` (the confirmed real wire
  shape, subset needed for `Event`), matching the live schema.
- Each item is passed through a new `mapEventApiItem()` adapter that
  renames/derives fields into the app's existing `Event` shape (see the
  function's own comment for the five numbered Proposed Assumptions this
  introduces — none affect fields `HomeScreen` renders except the ones
  needed to remove the "undefined" display that would otherwise have
  replaced the crash).
- `getEvents()` wraps the mapped array back into
  `{ items, total, page, page_size }` before returning, so
  `EventsListResponse` and `HomeScreen.tsx` needed **no changes** — the
  fix is contained to one file.

`getEvent()` (singular, used only by `EventDetailScreen`) is **unchanged**
— out of scope for this crash and not touched; see Known Gaps below.

### Verification

```
$ npx tsc --noEmit
(no output, exit 0)

$ npx eslint . --ext .ts,.tsx
(no output, exit 0)
```

New regression test, `src/api/__tests__/events.test.ts`, asserts
`getEvents()` always resolves an array `items` (including the empty-feed
case) when the mock backend returns a bare array in the confirmed real
shape, and that field mapping (`location`, `participant_count`,
`current_user_rsvp_status`) is correct:

```
$ for i in 1 2 3; do npx jest 2>&1 | tail -6; echo "--- Run $i ---"; done
PASS src/api/__tests__/events.test.ts
PASS __tests__/App.test.tsx

Test Suites: 2 passed, 2 total
Tests:       3 passed, 3 total
Snapshots:   0 total
Time:        0.626 s, estimated 1 s
Ran all test suites.
--- Run 1 ---
[... identical PASS output on runs 2 and 3 ...]
```

## 4. Lifecycle-stage classification

**Build defect** (primary) — the code shipped an unverified assumption
about an external contract as if it were confirmed, with no runtime
guard for the mismatch. Contributing **test gap** — no test exercised
`getEvents()` against any backend-shaped fixture before this incident,
so the mismatch wasn't caught pre-release.

## 5. Reusable lesson

When a design document's API section lists only method/path/auth (no
response schema) and the parent backend design isn't available in-repo,
treat the assumed response shape as unverified, not merely
"proposed-but-probably-right." If the backend exposes a live OpenAPI
schema (common for FastAPI/uvicorn backends — `GET /openapi.json`),
checking it costs one `curl` and turns a guess into a fact; do this
*before* writing the parsing code, not after a crash forces it. Filed as
a candidate addition to the implementation skill's Gate 2/Gate 3
checklist: for any endpoint whose response schema is unconfirmed in the
design doc, check the live backend's OpenAPI/schema endpoint (if any)
before typing the client function.

## Known gaps / follow-ups (not fixed in this pass — flagged, not actioned)

1. `getEvent()` (singular) and `EventDetailScreen` consume the same
   `EventResponse` shape with the same field-name mismatches
   (`organizer_id`, `venue_name`, `going_count`, `user_rsvp_status`,
   `recurrence_rule_id`, no `waitlist_count`/`is_organiser`). This does
   not crash (no array/`.items` access there) but silently renders wrong
   data (undefined location, wrong going-count, etc.) and needs the same
   mapping treatment. Deliberately not fixed here — out of the reported
   crash's scope, and `is_organiser` cannot be derived correctly without
   reading the current user's id, which is a cross-module (auth) concern
   this task's rules put off-limits.
2. `src/types/event.ts`'s `Event` interface itself still doesn't match
   the real backend field names one-for-one; the mapping layer added in
   `events.ts` compensates for `getEvents()` only. Correcting the shared
   type is a larger change (ripples into `EventDetailScreen`) that
   belongs to a dedicated task, not this crash fix.
3. `cost`/`estimated_cost_cents` unit mismatch (cents vs. a display
   currency amount) is carried through as-is; inert for `HomeScreen`
   (not rendered there) but will need correcting when `getEvent()` is
   fixed per (1).

This RCA and its systemic follow-ups (1–3 above) require user/architect
approval before entering the next work cycle, per the debugging skill's
protocol — no further code changes beyond the crash fix were made in
this pass.
