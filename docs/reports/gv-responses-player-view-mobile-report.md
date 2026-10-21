# Report: gv-responses-player-view-mobile

Branch `claude/cool-pascal-84tbeh`, restarted from `origin/main` f0d17fe because PR #46 was already merged. Not self-certified; owner review needed.

## Not available in this environment (please read first)
- `docs/agent-handoff-template.md` is not in this repo, so it was not prepended.
- `~/meetup/docs/DES-MEETUP-ADDENDUM-game-view-redesign.md` v1.1 is not reachable (no `~/meetup` here); the repo copy is v1.0. I worked from the brief's description of v1.1 only. Please check the result against v1.1 (revised AD-3/AD-9/GV-4/GV-5, T7/T8, D-5/D-6).
- The gate (backend task deployed) could not be verified. The change is safe either way: until the backend deploys, a non-organizer's responses call is refused, the screen gets `null`, and the old Players list is kept.
- No screenshots: no emulator or device. No board was changed (D-6).

## Step 1 answers
1. `ResponsesResponse` was `{ accepted; pending; declined }` (all required) in `src/types/event.ts` (re-exported by `tournament.ts`). Now `declined?: ResponseSection`.
2. The switch: `EventDetailScreen` rendered `ResponsesSection` only for `isOrganiser && responses` and the Players card for `!(isOrganiser && responses)`. `TournamentDetailScreen` used `canReadResponses && responses`, otherwise a plain Registrations card. Both removed.
3. Fetch not gated client-side: `loadEvent` / `loadAll` already call `getEventResponses` / `getTournamentResponses` for every viewer with `.catch(() => null)`. No blocker.
4. Invite card was already independent: games use `isOrganiserActionsVisible`, tournaments use `TournamentInvitePanel` with the server's `my_invite_access`. Neither shared the Responses condition. Unchanged.
6. Labels: nothing new; `mob.gv.*` and `mob.respond.*` cover it. `check:labels` OK.

## Changes
- `types/event.ts`: `declined` optional.
- `ResponsesSection.tsx`: validates `declined` only when present; the Declined group is built only when `responses.declined != null`. No `is_organizer` check; the payload shape is the only signal.
- `responseGroups.ts`: declined-safe for game, tournament and Invited-sheet grouping.
- `EventDetailScreen.tsx`, `TournamentDetailScreen.tsx`: Responses renders whenever the payload loaded. If the call fails (null), the old Players list (game) / Registrations card (tournament) is kept as a fallback, as before.
- Not touched: Invite card, user pop-up (the server's action list still decides), venue sheet, Invited sheet gating (`InviteTypeRow` still gets `responses`/`invitations` only for organizer/committee), versions.

Deviation to note: the fallback to the old list when the call fails is kept deliberately; the brief says "never the old Players list" for viewers who get the payload, which this satisfies.

## Tests
`EventDetailGameView`, `TournamentGameView`, `ResponsesSection`: a non-organizer sees Accepted + Pending (tournament: Registered / Accepted not yet registered / Pending), no Declined, no crash, no Invite card, no old list (T7); Declined shows whenever the payload has it (T8); the organizer still sees all groups plus the Invite card; failed call keeps Players.

## Raw output
```
npx tsc --noEmit      -> exit 0
npm run check:labels  -> check-labels: OK - 245 files scanned, 1138 default labels checked.
npx jest --ci --coverage (one run): Test Suites: 14 failed, 174 passed, 188 total
                                    Tests: 162 failed, 2170 passed, 2332 total
Coverage (whole repo): Statements 75.73%  Branches 66.44%  Functions 74.18%  Lines 75.98%
```
Coverage delta: no baseline coverage run exists, so only absolute numbers are given. Failures are the same 14 legacy suites as in gv-mobile-report.md (Profile*, Home, CreateGame, EventDetailScreen legacy cases, keyboardInventory, AppForceUpdate, ForceUpdateGate, appConfig, headerIcon, homeComponents, shareLink); nothing new. Full log: `docs/reports/gv-responses-player-view-mobile-jest-output.txt`.
