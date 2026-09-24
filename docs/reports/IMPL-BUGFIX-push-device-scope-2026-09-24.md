# Implementation Report — Mobile push notification duplication (device-scoped token registration)

## 1. Design reference

- Doc ID: DES-MEETUP-MOBILE, version APPROVED (architect-approved 2026-09-13)
- Status: APPROVED
- Tier: N/A for this change — bug fix, not a design-gated feature (task
  brief: "This is a bug fix, not a new feature — no requirements/design
  amendment gate")
- Governing sections touched only incidentally: §3.6 / R-070, R-075, R-029
  (FCM registration lifecycle), which this fix extends without altering.

## 2. Traceability map

| Change | File | R-ID / section |
|---|---|---|
| Stable device id sourcing (Android `Settings.Secure.ANDROID_ID` via `react-native-device-info`, memoized) | `src/notifications/deviceId.ts` (new) | R-029, R-075 (registration/rotation lifecycle this fixes) |
| `deviceId` added to every `POST /notifications/mobile-subscriptions` call | `src/notifications/fcm.ts` (`registerDeviceToken`) | R-029; single call site reused by `getToken()`, `onTokenRefresh()`, and `pushRegistration.ts`'s `attempt()` — no other call sites exist |
| Centralised Jest mock for `react-native-device-info` | `jest.setup.js` | matches existing centralised-native-mock convention |
| New dependency | `package.json`, `package-lock.json` | `react-native-device-info@^15.0.2` |
| Tests | `src/notifications/__tests__/deviceId.test.ts` (new), `src/notifications/__tests__/fcm.test.ts`, `src/notifications/__tests__/pushRegistration.test.ts` | payload/memoization/rotation-stability coverage |

No other files needed changes. `registerDeviceToken()` in `fcm.ts` is the
single point every registration path (initial registration, silent
rotation via `onTokenRefresh`, and `pushRegistration.ts`'s foreground
retry loop) already funneled through, so the fix required no changes to
`pushRegistration.ts` itself. `deregisterDeviceToken()` (`DELETE
/notifications/mobile-subscriptions/{device_token}`) was left untouched —
its live OpenAPI contract keys strictly on the path's `device_token`, no
`device_id`, and the task brief scoped the fix to "registration calls"
only (Step 2).

## 3. Dependency added — flagged per deliverable instructions

**`react-native-device-info@^15.0.2` was added as a new dependency.** It
was not already present (checked `package.json`/`node_modules` first, per
Gate 2). Rationale for the version/package choice:

- Peer dependency is `"react-native": "*"` — no conflict with RN 0.86.3.
- Ships `getAndroidId()` (a thin wrapper over
  `Settings.Secure.ANDROID_ID`/`getAndroidId()`), exactly the primitive
  the task brief specifies, not a synthesized/derived identifier.
- Autolinks via this repo's existing `autolinkLibrariesFromCommand()` in
  `android/settings.gradle` — no manual native wiring needed (verified by
  inspection; not build-verified — see §5 "Known gaps").
- `main` entry is CommonJS (`lib/commonjs/index.js`); no
  `transformIgnorePatterns` addition needed in `jest.config.js` (unlike
  the ESM-published libraries CLAUDE.md's Stack Gotchas already calls
  out) — confirmed by running the full suite (§6).
- No New Architecture (TurboModule/Fabric) conflict: `newArchEnabled=true`
  is set in `android/gradle.properties`; `react-native-device-info`
  v10+ supports the new architecture generally, though this was not
  build-verified in this session (no Android emulator/device attached —
  see §5).

## 4. Backend contract verification (critical finding, resolved by direct check)

`docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md` (6 days old at task
start) states, CRITICAL: `POST /notifications/mobile-subscriptions` "does
not exist" on the real backend, which instead implements Web Push
subscriptions (`/notifications/subscriptions`), an entirely different
protocol from FCM device-token registration. Taking that at face value
would have meant this whole task rests on a dead endpoint.

Re-verified live rather than trusting the 6-day-old document, per the
Contract verification gate ("a feature that has always been there is not
evidence it has ever worked" — the inverse also holds: a feature reported
broken 6 days ago is not evidence it still is):

```
$ curl -s https://meetups.duckdns.org/openapi.json | jq '.paths | keys | .[] | select(test("mobile-subscriptions"))'
"/notifications/mobile-subscriptions"
"/notifications/mobile-subscriptions/{device_token}"
```

Both paths now exist — the CRITICAL finding from the 2026-09-18 audit has
been resolved server-side since that audit (likely as a direct response
to that audit's item #11, which posed exactly this as an open
architectural question). Current live `MobilePushTokenRegisterRequest`
schema:

```json
{
  "properties": {
    "deviceToken": {"type": "string", "minLength": 1},
    "platform": {"type": "string"},
    "userAgent": {"anyOf": [{"type": "string"}, {"type": "null"}]}
  },
  "required": ["deviceToken", "platform"],
  "title": "MobilePushTokenRegisterRequest"
}
```

**`deviceId` is not yet declared on the live schema.** This confirms the
task brief's own caveat — the paired backend change (gating
`fn_register_mobile_push_token` on a `device_id` parameter, dispatched
separately) had not deployed at the time of this check. No
`additionalProperties: false` is present on the schema, and FastAPI/
Pydantic ignores unrecognized request fields by default, so sending
`deviceId` now is additive and non-breaking: it is a no-op today and
starts working the moment the backend deploys, with no further mobile
change required.

This is documented as a **known gap**, not a Blocked Report — see §6
"Known gaps / follow-ups". No `docs/` file was edited to record this
(off-limits per CLAUDE.md); the finding lives here and in code comments
(`fcm.ts`) instead.

## 5. Proposed Assumptions

1. **Wire field name `deviceId` (camelCase)**, not `device_id`. The
   existing body already uses camelCase (`deviceToken`, `userAgent`) per
   the live schema; `deviceId` follows that established convention rather
   than the backend brief's snake_case internal parameter name
   (`fn_register_mobile_push_token`'s SQL parameter naming is a DB-layer
   detail, not necessarily the wire-JSON key — FastAPI/Pydantic commonly
   translates camelCase JSON to snake_case Python/SQL). LOW risk: an extra
   field is ignored either way until the backend deploys; if the backend
   ultimately expects a different JSON key, this is a one-line follow-up
   once the live schema is re-checked post-deploy.
2. **In-memory memoization only, no persistence.** The task brief said
   "persist nothing extra client-side... unless the chosen API requires
   caching to avoid repeated native calls." `getAndroidId()` is one native
   bridge call; memoizing the resolved promise in a module-level variable
   satisfies "avoid repeated native calls" without adding
   AsyncStorage/Keychain usage the brief didn't ask for. LOW risk.
3. **Empty string, not `null`/omitted, when `Platform.OS !== 'android'`.**
   The task scoped this Android-only; the app itself has an iOS scaffold
   present but out-of-scope per CLAUDE.md's stack description. An empty
   string keeps the field present (matches the JSON schema's plain
   `string` type, no `nullable`) without ever executing on a platform this
   fix wasn't asked to touch. LOW risk — this branch is dead code on the
   app's only shipped target (Android).

## 6. Deviations

None from the task brief. The one deviation from a *literal* reading of
"confirm backend deployment status" would be treating it as a hard
blocker; it was instead treated as an instruction to verify and document
(see the enhancement note filed this session,
`docs/reports/agent-enhancement-2026-09-24.md` item 6) — not a deviation
from the design doc or an invented contract, just the verification the
brief itself asked for, performed and recorded.

## 7. Verification results

**Type-check:**
```
$ npx tsc --noEmit
(no output, exit 0)
```

**Lint:**
```
$ npx eslint . --ext .ts,.tsx
(no output, exit 0)
```

**Live backend contract check** (see §4 for full detail):
```
$ curl -s https://meetups.duckdns.org/openapi.json -o openapi.json -w "HTTP %{http_code}\n"
HTTP 200
```
`/notifications/mobile-subscriptions` (POST) and
`/notifications/mobile-subscriptions/{device_token}` (DELETE) both
present; `MobilePushTokenRegisterRequest.properties` = `{deviceToken,
platform, userAgent}` only, no `deviceId` yet (device_id not yet a
required/optional field server-side as of this check).

## 8. Known gaps / follow-ups

1. **Backend `device_id` support not yet deployed** (verified §4). This
   client change is inert (extra field, ignored) until the paired backend
   change ships. Re-run the live schema check
   (`curl https://meetups.duckdns.org/openapi.json | jq
   '.components.schemas.MobilePushTokenRegisterRequest'`) after the
   backend deploys to confirm `deviceId`/`device_id` is accepted, and
   confirm via backend logs that repeated registrations from the same
   device now produce an `UPDATE`/`ON CONFLICT`, not a new row — this
   half of the task's own Verification section could not be completed in
   this session (no backend logs access, no live device/emulator
   attached).
2. **Not build-verified on a real device/emulator.** No Android
   emulator/device was available in this session (per the task's own
   `npm run android` prerequisite in CLAUDE.md — "requires an Android
   emulator/device and a configured Android SDK"). `getAndroidId()`'s
   actual native-bridge behavior (autolinking, permission — `ANDROID_ID`
   requires no runtime permission on any API level) was verified by
   reading the library's documented contract and this repo's existing
   autolinking config, not by running the app. Flagging per Gate 1 for
   the human running the next `npm run android` / release build to watch
   for any native-linking surprise.
3. **Field-name assumption** (§5.1, `deviceId` vs `device_id` on the
   wire) should be re-confirmed against the live schema once the backend
   deploys, since that is the first point at which the actual accepted
   key becomes observable.

## Completion Proof

**Test evidence** (raw output, 3 runs):
```
$ for i in 1 2 3; do npx jest 2>&1 | tail -6; echo "--- Run $i ---"; done
Test Suites: 66 passed, 66 total
Tests:       781 passed, 781 total
Snapshots:   0 total
Time:        2.805 s
Ran all test suites.
--- Run 1 ---
Test Suites: 66 passed, 66 total
Tests:       781 passed, 781 total
Snapshots:   0 total
Time:        2.23 s, estimated 3 s
Ran all test suites.
--- Run 2 ---
Test Suites: 66 passed, 66 total
Tests:       781 passed, 781 total
Snapshots:   0 total
Time:        2.193 s
Ran all test suites.
--- Run 3 ---
```

**Git evidence**: see the commit created alongside this report and
`git log`/`git status` output captured immediately after it, in the
session transcript.

**File evidence** (primary change — `deviceId` now sent on every
registration call):
```
$ grep -n "deviceId" src/notifications/fcm.ts src/notifications/deviceId.ts
src/notifications/fcm.ts:  const deviceId = await getDeviceId();
src/notifications/fcm.ts:    deviceId,
src/notifications/deviceId.ts:export function getDeviceId(): Promise<string> {
```

**Migration evidence**: N/A — no migrations in this app or this change.

**Build evidence**: N/A — mobile (Android) app; no `npm run build` script
in this repo (build is `scripts/build-release-aab.sh`, not run in this
session per §8.2 — no Android SDK/emulator attached).
