# Implementation Report — meetup-mobile events module

## 1. Design reference

- **Doc ID**: DES-MEETUP-MOBILE
- **Version / Status**: APPROVED, architect-approved 2026-09-13
- **Tier**: T1
- **Requirements baseline**: REQ-MEETUP-MOBILE, APPROVED (architect-approved 2026-09-13, R-005 corrected 2026-09-13)
- **Sections read**: §3.4 (Token Storage — no new work; confirms the events API relies on the existing Keychain-backed `apiClient` auth injection), §3.10 (Role-Based UI Gating), §3.12 (Correlation ID), §4.2 (Authentication — read for context, not modified), §4.3 (Event Management), §7.4 (Events API contract)
- **R-IDs targeted**: R-021 (browse), R-024 (RSVP/status), R-025 (waitlist-promotion status reflection — passive, via re-fetch after action), R-017/R-082 (organiser-only cancel gate, UX-only)
- **R-ID note**: the task brief also cited R-027 and R-028. Neither exists anywhere in the canonical `docs/REQ-MEETUP-MOBILE.md` (§1.3 Event Management ends at R-026; confirmed via full-document grep). This did not block the task — every endpoint and screen behavior requested (withdraw, organiser cancel) is explicitly named in the design document itself (§4.3's endpoint list and screen inventory), which is the authoritative source for behavior/contracts regardless of requirements-table R-ID numbering gaps. Flagged as a requirements-baseline traceability gap for the architect to reconcile, not treated as a blocker.
- **Scope of this pass**: browse public events, event detail, RSVP, withdraw, organiser cancel. Explicitly excluded per the brief: event creation/edit, invitations, participant management.

## 2. Traceability map

| Brief step | Design section / R-ID | Files | Notes |
|---|---|---|---|
| 1. Types | §4.3, §7.4 | `src/types/event.ts` | See Proposed Assumptions §1–2 |
| 2. Events API | §3.3 (client reuse), §3.12, §4.3, §7.4, R-021, R-024 | `src/api/events.ts` | All calls through the existing `apiClient`; correlation-ID threading added per §3.12/R-113 (see Proposed Assumption §3) |
| 3. Events list screen | §4.3, R-021 | `src/screens/HomeScreen.tsx` | Replaces the scaffold placeholder |
| 4. Event detail screen | §4.3, §3.10, R-021, R-024, R-025 | `src/screens/EventDetailScreen.tsx` | New |
| 5. Navigation | §3.1, §4.3 | `src/navigation/RootNavigator.tsx`, `src/navigation/types.ts` | Nested native-stack (`HomeStack`) inside the Home tab — see Proposed Assumption §4 |
| 6. RSVP/withdraw/cancel flows | §4.3, §3.10, R-024, R-025 | `src/screens/EventDetailScreen.tsx` | RSVP/withdraw refresh detail via a shared correlation ID (§3.12); cancel navigates back per the brief |
| Date/time display | — (implementation mechanics only) | `src/utils/formatEventDateTime.ts` | No date library installed/requested; used platform `Intl`-backed `Date` formatting instead of adding a dependency |

## 3. Proposed Assumptions

1. **`Event.cost` is nullable (`number | null`), not always-present.** The brief's Step 1 field list just says "cost" with no type; Step 4 describes display as conditional ("Cost display if set"), implying optionality. `src/types/event.ts`. Correct against the actual backend contract on conformance review.
2. **Response body shapes for `GET /events`, `GET /events/{id}`, and the RSVP/withdraw/cancel actions.** Not specified in the local design excerpt (§7.4 lists endpoints only, no schemas; parent `DES-MEETUP.md` unavailable — same class of gap already recorded for auth's endpoints). `GET /events` assumed to return exactly the brief's `EventsListResponse` shape (`items`/`total`/`page`/`page_size`); `GET /events/{id}` assumed to return the `Event` object directly; RSVP/withdraw/cancel assumed to return no body worth typing (the screen re-fetches via `GET /events/{id}` afterward per the brief's own literal flow description in Step 6 — "refreshes event detail on success" — rather than relying on the action response). Correct against the actual backend contract on conformance review.
3. **Correlation-ID threading added to `src/api/events.ts`'s functions (an optional trailing `{ correlationId }` param), beyond the brief's literal function signatures.** §3.12/R-113 states a multi-call logical action (e.g. RSVP then re-fetch to refresh) must share one correlation ID, and §3.3's rationale explicitly says this "must hold universally" — not just for auth. Followed the exact pattern already established in `src/notifications/fcm.ts`'s `deregisterDeviceToken`. `EventDetailScreen`'s RSVP/withdraw handlers wrap the act-then-refetch sequence in `withCorrelationId()`. This is additive (every function still matches the brief's stated call signature when called without the option) and not a brief/design conflict — it's a straightforward extension of an already-decided architecture principle.
4. **Home tab wraps a nested native-stack (`HomeStack`: `EventsList` → `EventDetail`) rather than adding `EventDetail` as a sibling top-level screen.** The brief's Step 5 says "Add EventDetailScreen to AppStack" and "Back navigation works correctly" without specifying the exact navigator shape. A bare bottom-tabs navigator has no back-stack concept per tab; nesting a native-stack inside the Home tab is the standard React Navigation pattern for "list → detail with a tab bar still visible on the list" and is the only way to get correct back navigation while keeping `HomeScreen` reachable as a tab. `headerShown: false` is set on the Home tab screen to avoid a duplicate header (tab navigator's default header stacked on top of the nested stack's own header) — a direct, necessary consequence of correct nesting, not an invented UI decision.
5. **RSVP-badge label for `withdrawn` status folded into "None" on the events list card.** The brief names exactly three badge labels ("Going/Waitlisted/None") for a four-value status enum. `withdrawn` reads as "no active RSVP" for feed-display purposes, same as `none`. `src/screens/HomeScreen.tsx`, `RSVP_BADGE_LABEL`.
6. **`EventDetailScreen`'s "Join" button state applies to both `none` and `withdrawn` status**, not just `none` as literally worded in Step 4. A user who withdrew must be able to re-join, and no other button state is described for that value anywhere in the brief. `src/screens/EventDetailScreen.tsx`.

## 4. Deviations

None. (The correlation-ID threading and nested-stack navigation choices above are recorded as Proposed Assumptions, not deviations — both are additive implementations of already-decided design principles, not departures from anything the design or brief states.)

## 5. Verification results

**Type-check** — clean, no errors:
```
$ npx tsc --noEmit
(no output, exit 0)
```

**Lint** — clean, no errors/warnings:
```
$ npx eslint . --ext .ts,.tsx
(no output, exit 0)
```

**Tests**, run 3x for stability (see Completion Proof §8 for the transcript). The existing `__tests__/App.test.tsx` smoke test still passes unchanged — the Keychain mock returns no token, so the app resolves to the Auth Stack and never reaches the events feed, meaning no new Jest mocking was required for this pass (unlike the auth module pass, which needed new native-module mocks).

**No sensitive/logging statements added**:
```
$ grep -rn "console\.\(log\|warn\|error\)" src/api/events.ts src/screens/HomeScreen.tsx src/screens/EventDetailScreen.tsx src/types/event.ts src/utils/formatEventDateTime.ts
(no output — zero logging statements in any new/modified events file)
```

**No auth files modified** (brief rule: "Do not modify auth files"):
```
$ git diff --name-only src/auth/
(no output)
```

**`docs/` untouched** (brief rule: "Do not modify docs/"):
```
$ git diff --name-only docs/DES-MEETUP-MOBILE.md docs/REQ-MEETUP-MOBILE.md
(no output)
```

**No event-creation/invitation/participant-management code introduced** (brief's explicit exclusions):
```
$ grep -rn "invite\|participants'" src/api/events.ts src/screens/HomeScreen.tsx src/screens/EventDetailScreen.tsx
(no output)
```

## 6. Known gaps / follow-ups

1. **No pagination/infinite-scroll on the events feed.** `EventsListResponse` carries `total`/`page`/`page_size`, but `HomeScreen` only fetches page 1 and never requests more. The brief's Step 3 describes fetch-on-mount + pull-to-refresh only, with no "load more" behavior named — not built, flagged here rather than invented.
2. **§4.3's offline behaviour ("Last-fetched data viewable, R-101; mutating controls disabled offline") is not implemented.** No network-connectivity-detection primitive (e.g. `@react-native-community/netinfo`) exists anywhere in this codebase yet, and installing one wasn't in this task's 6 steps. Network failures during RSVP/withdraw/cancel currently surface via the existing inline-error pattern (a failed call shows "Could not ... Please try again") rather than proactively disabling the buttons before the attempt. Flagged for a follow-up task once offline detection is scoped.
3. **R-027/R-028 don't exist in the requirements baseline** — see §1 above. Recommend the architect either add these R-IDs (withdraw, organiser-cancel) to `REQ-MEETUP-MOBILE.md` §1.3 or correct the task-brief template that references them.
4. **`checkin_qr_token` (§7.4's note on `GET /events/{id}`) is not part of the `Event` type or detail screen** — out of scope for this task (a separate, already-partially-scaffolded QR check-in flow, §3.7); not invented here.
5. **No Android SDK/emulator in this environment** — verification is limited to `tsc`, `eslint`, and the Jest smoke test, same constraint as the prior auth-module pass. The actual events feed/detail/RSVP/withdraw/cancel flows have not been exercised against a real device or the live backend.

## 7. Full file tree created/modified in this pass

```
src/types/event.ts (new)
src/api/events.ts (new)
src/utils/formatEventDateTime.ts (new)
src/screens/HomeScreen.tsx (modified — replaced placeholder with the events feed)
src/screens/EventDetailScreen.tsx (new)
src/navigation/types.ts (modified — HomeStackParamList added)
src/navigation/RootNavigator.tsx (modified — nested Home stack, EventDetailScreen wired in)
implementation-status-DES-MEETUP-MOBILE.md (modified — live status)
docs/reports/IMPL-DES-MEETUP-MOBILE-events.md (this file)
```

## 8. Completion Proof

**Test evidence** (raw output, 3 runs):
```
$ for i in 1 2 3; do npx jest 2>&1 | tail -6; echo "--- Run $i ---"; done
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.599 s, estimated 1 s
Ran all test suites.
--- Run 1 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.453 s, estimated 1 s
Ran all test suites.
--- Run 2 ---
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.444 s, estimated 1 s
Ran all test suites.
--- Run 3 ---
```

**Type-check evidence**:
```
$ npx tsc --noEmit
(exit 0, no output)
```

**Git evidence**: see the commit created alongside this report and the follow-up push-evidence addendum (matching the auth-module report's convention).

**File evidence**:
```
$ grep -n "export " src/api/events.ts
export interface GetEventsParams
export async function getEvents(
export async function getEvent(
export async function rsvpEvent(
export async function withdrawEvent(
export async function cancelEvent(
```

**Build evidence**: no Android SDK in this environment (unchanged from prior passes) — `npx tsc --noEmit` and `npx eslint` (both exit 0) stand in as the applicable build-adjacent evidence; a real `npm run android` build has not been exercised for this feature.
