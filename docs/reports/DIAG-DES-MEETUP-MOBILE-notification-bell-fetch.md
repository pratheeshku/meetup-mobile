# Diagnosis — Notification bell "Could not load your notifications" fetch failure

**Status: BLOCKED — diagnosis only, no fix applied, nothing to conformance-review.**

## Step 0 — prior investigation
Not investigated before now. The Create Flow session (Task 1: commits `fab9855`/`7a9c4d6`/
`d08bc47`) is a separate session with no memory of this bug; its Implementation Report
(`IMPL-DES-MEETUP-MOBILE-create-flow-amendment.md`) and status file mention nothing about the
bell or a fetch failure. My own prior session built the screen this bug is reported against
(`7dd908f`, `IMPL-DES-MEETUP-MOBILE-notification-history.md`) but did not investigate a failure
in it. No partial work exists to report.

## Step 1 — diagnosis

**Exact failing call:** `getNotificationHistory()` (`src/api/notifications.ts:73`), issuing
`GET /notifications/history`, called from `NotificationHistoryScreen.tsx:96` on mount. Its
`catch` (`:99`) is unconditional — any rejected promise, whatever the cause, produces the
"Could not load your notifications. Please try again." message. The message only appears on a
**rejected promise** (an HTTP error or thrown network error), not a response-shape mismatch:
`page.items`/`page.next_cursor` are read after the `try` succeeds, so a shape mismatch would
surface as a render-time crash on the FlatList/empty-state branch, not this friendly message —
ruling that failure mode out.

**Checked against the live backend** (`curl https://meetups.duckdns.org`, 2026-09-22 22:40 UTC):
- `GET /notifications/history` unauthenticated → clean `401 {"detail":"Missing authentication
  token"}` — endpoint is live, not 404/500.
- Same call with an invalid Bearer token → clean `401 {"detail":"Invalid or expired access
  token"}` — no server crash on a bad token either.
- Re-fetched `/openapi.json` and diffed the `/notifications/history` path against the schema
  used to build the feature yesterday — **no drift**; the client's request shape and response
  types still match.
- `src/api/notifications.ts`'s request construction (`params: cursor ? { cursor } : undefined`)
  is correct against that schema; nothing else in the call is malformed.

**Not reproducible from here:** no Android device or emulator is attached (`adb devices` — empty;
no `emulator` binary), so I cannot log in as Pratheesh and issue the real authenticated request
that is actually failing. I have no access to backend server logs (no SSH/log tooling in this
mobile-repo sandbox) to find the corresponding request server-side, and backend/API changes are
out of scope for this task regardless. The sibling `../meetup/.env` has a `DATABASE_URL`, but
querying the production database directly is outside this task's scope and this agent's role —
not attempted.

**Explicitly separating from the known push-subscription issue:** `GET /notifications/history`
authenticates with a user session **Bearer access token** (`Authorization` header, refreshed via
`POST /auth/refresh`). It has no relationship to `POST /notifications/mobile-subscriptions` (FCM
device-token registration for push delivery) or the ~40 accumulated subscriptions on Pratheesh's
account. That is a push-delivery/registration issue; this is a session/auth or network issue on a
list-fetch call. Not conflated.

## Step 2 — root cause: not established; ambiguous, stopping here

Given what's checked, the plausible causes remaining are indistinguishable from this sandbox:
1. A genuinely expired/invalid session on-device (the access token refresh fails and
   `SessionEndedError` propagates) — the screen would then be behaving correctly, not buggy.
2. A transient network/timeout on-device.
3. A real backend bug that only manifests for a valid, authenticated request (not reproducible
   with the unauthenticated/invalid-token checks above).

These require one of: (a) a device/emulator with Pratheesh's real session to reproduce live, or
(b) a backend engineer checking server logs for the actual failing request (timestamp + user id),
or (c) confirmation of whether the account's session is currently valid. Per the task's own Step
2 instruction, this is ambiguous — filing a Blocked Report rather than guessing a fix.

BLOCKED — cannot proceed safely.
Missing: the actual authenticated request/response (or server log entry) that failed on-device.
Investigated: client call site and error handling; live endpoint reachability, auth-error shape,
and schema drift (none found); ruled out response-parsing as the cause; confirmed no device/
emulator or server-log access in this sandbox to go further.
Required to unblock: either (1) a device/emulator with the real account to capture the actual
HTTP status/error, or (2) a backend engineer pulling the server log for the failing request, or
(3) confirmation the account's session was valid at the time of the failure.
