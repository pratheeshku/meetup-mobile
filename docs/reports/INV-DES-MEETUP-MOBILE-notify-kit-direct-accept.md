# Investigation Report — direct-accept RSVP from `eventNotificationHandler.ts`'s background Join action

**Type**: Investigation only. No code changed as part of this report.
**Doc reference**: DES-MEETUP-MOBILE, APPROVED, T1, §4.8.
**Trigger**: mirrors an equivalent same-day investigation done for WEB,
which came back buildable (HttpOnly refresh cookie reachable via
`credentials: 'include'` from a service worker with no open tab). Mobile's
token model was checked the same way here, independently, rather than
assumed from the web answer.

## Questions and findings

### 1. Where does the mobile app store the access/refresh token?

- **Access token**: `src/storage/tokens.ts`, via `react-native-keychain`
  (Android Keystore / iOS Keychain), `accessible:
  WHEN_UNLOCKED_THIS_DEVICE_ONLY`. The file's own header states this is
  intentional (R-014): "never readable while the device is locked."
- **Refresh token**: never stored client-side. `src/api/cookies.ts` and
  `src/api/client.ts` both document that the backend sets it as an
  HttpOnly, Secure cookie (`refresh_token`, Path=`/auth`); the mobile app
  never sees its value. It lives in the native, process-wide cookie jar
  (Android: OkHttp's cookie jar forwarding to
  `android.webkit.CookieManager`), sent automatically by any request with
  `withCredentials: true` (set on both `apiClient` and `refreshClient`).
- No in-memory-only token store exists.

### 2. Can a notify-kit `onBackgroundEvent`/kill-state handler reach that storage?

Mixed:

- **Refresh-token cookie**: reachable in principle, and the closest
  mobile analogue to the web finding. It is OS/process-level, independent
  of both React lifecycle and device-lock state. `fcm.ts`'s
  `registerBackgroundMessageHandler` already proves a headless-JS
  callback (RNFB's `ReactNativeFirebaseMessagingHeadlessService`, the
  same underlying mechanism notify-kit's `onBackgroundEvent` uses) can run
  async native-module calls successfully in this exact context
  (`notifee.cancelNotification`, `displayEventNotification`). Nothing in
  the stack structurally blocks an axios/XHR call from that same context.
  However, **no code in this repo has ever actually issued an
  `apiClient`/`refreshClient` call from inside a headless handler** — this
  is unproven, not just unblocked.
- **Access-token Keychain read/write**: this is the real difference from
  web. `WHEN_UNLOCKED_THIS_DEVICE_ONLY` is documented in this repo as
  "never readable while the device is locked" — and a locked, screen-off
  device is the single most common real-world state for a
  background/killed-state notification press. Whether
  `getGenericPassword`/`setGenericPassword` (the latter needed after a
  refresh, via `saveTokens`) succeed, fail silently, or throw when invoked
  from a headless JS task while locked is **not verifiable from source**
  — it depends on `react-native-keychain` 10.x runtime behavior under
  Android Keystore / iOS Keychain, which this repo has never exercised
  from that code path. Per this project's debugging discipline, this
  needs a live on-device check, not source-level confidence, and no such
  check exists anywhere in this repo.
- **Platform split**: this app ships both `ios/` and `android/`. The
  headless-JS proof above is Android-specific
  (`ReactNativeFirebaseMessagingHeadlessService`). iOS's background/
  kill-state execution model for notification actions is materially
  different (tighter, OS-throttled execution budgets); nothing in this
  repo's iOS project or reports confirms the same background-JS
  capability exists there.

### 3. Is there a working refresh path callable from that context?

Yes, code-reachably: `refreshAccessToken()` in `src/api/client.ts` is a
plain exported async function with no React/foreground dependency —
already single-flight and rotation-safe, and its network call needs no
access-token read at all (only the cookie, handled natively). It could be
imported into `eventNotificationHandler.ts` with no new code. The catch:
its success path calls `saveTokens()`, which writes to the same
`WHEN_UNLOCKED_THIS_DEVICE_ONLY` Keychain entry flagged in Q2 — the
refresh call itself is fine, but persisting its result from a
background/locked context carries the same unverified risk.

### 4. R-101 (RSVP disabled while offline) — connectivity check and fallback

No connectivity-detection primitive exists anywhere in this codebase
today — confirmed by grep (`NetInfo`, `isConnected`,
`isInternetReachable`: zero hits outside test-harness comments) and
independently flagged in
`docs/reports/IMPL-DES-MEETUP-MOBILE-events.md` (#2), which notes even
the **foreground** RSVP button doesn't proactively check connectivity —
it lets the call fail and shows an inline error. Design §3.8/§4.3
describes R-101 as a "network-state listener" driving a global offline
banner — an in-app/React-tree concept that, as designed, has no reach
into a headless handler, and doesn't exist yet regardless.

A background handler therefore has strictly less to work with than the
screen it would mimic: no pre-flight check available, and no screen to
show an inline error on failure. It **can** show a follow-up notification
on failure — mechanically proven buildable, since
`notifee.displayNotification` (the primitive behind
`displayEventNotification`) is already called from this exact background
context in this codebase. But a reactive "couldn't join, try from the
app" notification after a failed call is a materially weaker guarantee
than R-101's literal text (disabled pre-emptively, not attempted and
failed), and whether that substitute is acceptable is a requirements
call, not an engineering one.

## Verdict

**Not safely buildable today without a prerequisite step.** The
refresh-cookie path is more promising than assumed (closer to web's
answer) — that part of the original rejection doesn't hold up unchanged.
The blocking gap is narrower but real:

1. Unverified Keychain read/write behavior from a headless task while the
   device is locked — needs a live on-device test, both platforms, before
   this can be called safe.
2. R-101 has zero implementation to hook into from any context,
   foreground or background.
3. iOS's background-execution story for this is unconfirmed and likely
   more constrained than Android's.

This is a CRITICAL/HIGH-tier gap (touches auth/session guarantees and a
compliance rule, R-101). Per this project's Propose & Proceed rule, it
routes back to the architect as a decision point — specifically whether
an empirical Android Keychain-under-lock spike is worth running, and what
R-101 should mean in a screen-less context — rather than being
implemented on an assumption either way. No code was written or changed
for this investigation.
