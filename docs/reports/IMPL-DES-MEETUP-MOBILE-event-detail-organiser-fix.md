# Implementation Report — EventDetailScreen organiser detection fix

## 0. Read this first: Cancel is now visible but will fail

Making organisers see **Cancel Event** exposes a block that already existed and
was hidden precisely because Cancel was unreachable. The live API schema
(`https://meetups.duckdns.org/openapi.json`, fetched read-only during this
task) declares `POST /events/{event_id}/cancel` with a **required** JSON body
`EventCancelRequest { reason: string, minLength 1, maxLength 500 }`, responses
`200` / `422`. `cancelEvent()` sends **no body**. So an organiser tapping
"Cancel Event" is expected to get a 422 and the screen's existing generic error
("Could not cancel this event. Please try again."). This matches the 2026-09-18
audit (`AUDIT-API-CONTRACTS-2026-09-18.md`, §1 — *BLOCKED*, needs a
cancellation-reason UI, "design decision, not an API-layer fix").

- I did **not** change `cancelEvent()` or add a reason UI (out of scope; an
  architect decision per the audit).
- I implemented what the brief asked (organiser sees Cancel). The failure is
  safe — the server rejects it, nothing changes state — but it is a visible
  control that cannot currently succeed.
- **Not tested against the real backend.** I have no signed-in session, so the
  422 is inferred from the live schema, not observed.
- Decision for you: keep it (honest error), or hide Cancel until the reason UI
  exists (one-line change to `isCancelVisible`).

**Wider context — the whole action surface of this screen is blocked, not just
Cancel.** I checked the other two actions against the same live schema too:

| Button | Call | Live schema says | Expected result |
|---|---|---|---|
| Join | `POST /events/{id}/rsvp`, no body | body `RSVPRequest { action: string }` **required** | 422 |
| Leave | `POST /events/{id}/withdraw` | **no such route** (event sub-paths are only `rsvp`, `participants`, `participants/{user_id}`) | 404 |
| Cancel Event | `POST /events/{id}/cancel`, no body | body `{ reason }` **required** | 422 |

So this fix corrects *which* buttons each user sees; it does not (and was not
scoped to) make any of them work. These are the same items the 2026-09-18 audit
marked BLOCKED (they need design decisions: the accepted `action` values, the
real withdraw mechanism, a cancellation-reason UI). I read the schema only; I
did not call the endpoints.

## 1. Design reference

- Doc ID: DES-MEETUP-MOBILE, APPROVED (architect-approved 2026-09-13), Tier T1
- Sections: §4.3 (Event Detail; organiser-only Cancel), §3.10 / §5.3 /
  R-017 / R-082 (client gating is UX only; backend authoritative), §7.4
  (`POST /events/{id}/cancel`, "Organiser only").
- Code commit: `2483a71`. Follow-up to the bug found in
  `IMPL-DES-MEETUP-MOBILE-home-dashboard.md` §6.
- This report is my own account, not a certification. Conformance review must
  run in a fresh session.

## 2. Traceability map

| Item | Change | File |
|---|---|---|
| Organiser sees Cancel, not RSVP; non-organiser the reverse | `isOrganiser = isOrganiserOf(event, user?.id)` drives `isRsvpVisible` and `isCancelVisible`; `useAuth()` for the user id | `src/screens/EventDetailScreen.tsx` |
| Stale "inert" note on the stub | comment-only rewrite: value is untrustworthy, use `isOrganiserOf` | `src/api/events.ts` |
| Regression tests (14) | real `getEvent`/`mapEventApiItem`, only HTTP client mocked | `src/screens/__tests__/EventDetailScreen.test.tsx` |

## 3. Was the stub used correctly elsewhere? (checked before touching `events.ts`)

`grep` of non-test `is_organiser` readers: `EventDetailScreen` (the bug) and
`src/utils/homeDashboard.ts` `isOrganiserOf` (already correct — ORs the flag
with an id comparison). `types/tournament.ts`/`api/tournaments.ts` carry a
separate tournament flag, unrelated to `Event`. Test fixtures set the field by hand.

**Decision: the stub was left in place.** The mapper cannot derive it (no user
id; importing auth into `src/api` crosses the documented zero-sibling-import
boundary), and *removing* the field would ripple into `types/event.ts`,
`homeDashboard.ts` and four test files, all outside the allowed scope. A cleaner
follow-up is to drop it from `Event` and have everything call `isOrganiserOf`.

## 4. Proposed Assumptions

1. **Reuse `isOrganiserOf` from `src/utils/homeDashboard.ts`** rather than a
   third inline comparison — one tested rule, same behaviour as the dashboard
   (flag OR `organiser_id === user.id`). Trade-off: a generically-named rule
   lives in a dashboard-named file. Follow-up: move to a neutral module (needs
   touching files outside this task's scope).
2. **No signed-in user → never organiser** (falls to the RSVP path; backend
   remains authoritative). In practice unreachable: the screen is only mounted
   in the authenticated stack.
3. **`user.id` and `organizer_id` are comparable.** Both are `format: uuid` in
   the live schema (`PrivateUserProfile.id`, `EventResponse.organizer_id`), and
   `TournamentDetailScreen` already relies on the same comparison. Equality of
   the two *values* for a real organiser is **unverified** (no live session).

## 5. Deviations

None. No approval references needed. (Commit carries no `Co-Authored-By`
trailer, per standing rules; see the Home dashboard report §4 D3 for the
disclosure about earlier commits.)

## 6. Verification results

- **Regression proof both ways:** with the fix, `EventDetailScreen.test.tsx`
  14/14 pass. With the original screen restored, **5 fail** — organiser sees
  Cancel / not Join (×3) and the two Cancel-action tests — while the
  non-organiser tests pass on both (that path was never broken). Fix then
  restored byte-identical (`diff` clean).
- **Premise test:** one test asserts the real mapper still yields
  `is_organiser: false` for an organiser, so if the mapper ever changes, the
  test asks to be revisited rather than passing for the wrong reason.
- **Negative cases:** cancelled/completed events show neither Join nor Cancel
  to an organiser; non-organiser gets Join (or Leave if going) and never
  Cancel; no user ≠ organiser; failed cancel keeps the user on screen with the
  error.
- **Scope check:** changed files are `EventDetailScreen.tsx`, `events.ts`
  (11 changed lines, all comments — verified with a filter that also flagged the
  code lines in the screen as a control), and the new test file.
- **Gate:** `tsc --noEmit` exit 0, `eslint` exit 0, Jest 17 suites / 153 tests
  ×3 (139 before, +14). Raw output below.

## 7. Known gaps / follow-ups

- **Cancel will 422** until a reason UI + `cancelEvent(id, { reason })` exist
  (§0). Also: once it works, Cancel is a single tap with **no confirmation**
  dialog — add one with the reason UI.
- The Cancel-action tests mock the HTTP client, so they prove the screen's
  behaviour, **not** backend acceptance.
- **Not run on a device / not tested live** (no signed-in session).
- Follow-up: remove the dead `is_organiser` field from `Event`; extract
  `isOrganiserOf` to a neutral module.
- Still open from the Home dashboard report: organiser's own events with no
  RSVP row appear in neither Home section (backend auto-RSVP unverified);
  Find a Game and Recent Results deferred; Create Game screen absent.
- **Join and Leave are also blocked** against the live schema (§0 table):
  `rsvpEvent()` needs an `action` body whose accepted values are undocumented,
  and `withdrawEvent()` calls a route that does not exist. Needs architect
  decisions before any fix (audit items 1–2).

**Next:** testing agent (fresh session), then conformance-review.

---

### Completion Proof

**Test evidence** (raw output, run after the last code edit):

```
### tsc --noEmit
tsc exit: 0

### eslint . --ext .ts,.tsx
eslint exit: 0


Test Suites: 17 passed, 17 total
Tests:       153 passed, 153 total
Snapshots:   0 total
Time:        1.338 s
Ran all test suites.
--- Run 1 ---

Test Suites: 17 passed, 17 total
Tests:       153 passed, 153 total
Snapshots:   0 total
Time:        1.143 s
Ran all test suites.
--- Run 2 ---

Test Suites: 17 passed, 17 total
Tests:       153 passed, 153 total
Snapshots:   0 total
Time:        1.097 s
Ran all test suites.
--- Run 3 ---
```

**Regression test against ORIGINAL code (raw, fix reverted):**

```
110:    !event.is_organiser && event.status !== 'cancelled' && event.status !== 'completed';
    ✕ sees "Cancel Event" and does NOT see "Join" (126 ms)
    ✕ sees Cancel and no RSVP control even when they also have an RSVP row (going) (4 ms)
    ✕ sees Cancel for an in-progress (active) event (2 ms)
    ✓ sees neither Cancel nor Join on a cancelled event (2 ms)
    ✓ sees neither Cancel nor Join on a completed event (2 ms)
    ✓ sees "Join" and does NOT see "Cancel Event" (2 ms)
    ✓ sees "Leave" (not Cancel) when already going (1 ms)
    ✓ sees no RSVP control on a cancelled event (2 ms)
    ✓ sees no RSVP control on a completed event (1 ms)
    ✓ is never treated as organiser when there is no signed-in user (2 ms)
    ✓ the real mapper still yields is_organiser=false for an organiser (precondition of the bug)
    ✓ still honours is_organiser if the mapper ever supplies it (forward compatible) (1 ms)
    ✕ calls the cancel endpoint for this event and goes back on success (2 ms)
    ✕ shows the existing error and stays on screen when the request fails (1 ms)
Tests:       5 failed, 9 passed, 14 total
```

**Live-schema evidence** (`openapi.json`, read-only GET, HTTP 200):

```
EventCancelRequest: { "properties": { "reason": { "type": "string", "maxLength": 500, "minLength": 1 } }, "required": ["reason"] }
requestBody.required: true      responses: [ '200', '422' ]
EventResponse organiser fields: [ 'organizer_id', 'organizer_display_name', 'organizer_nickname' ]   (no is_organiser)
PrivateUserProfile.id: {"type":"string","format":"uuid"}    EventResponse.organizer_id: {"type":"string","format":"uuid"}
```

**File evidence:**

```
$ grep -n "isOrganiserOf\|useAuth" src/screens/EventDetailScreen.tsx
14: * `isOrganiserOf(event, currentUserId)`, which also compares `organiser_id`
29:import { useAuth } from '../auth/AuthContext';
39:import { isOrganiserOf } from '../utils/homeDashboard';
45:  const { user } = useAuth();
120:  const isOrganiser = isOrganiserOf(event, user?.id);
```

**Git evidence:** code commit `2483a71` (no trailer: `grep exit: 1`). `git log
--oneline -3` and `git status` after the final push are in the session
hand-off message (they cannot be embedded in the file that describes them).

Migration/build evidence: n/a (no local DB; bare-RN project has no `npm run build`).
