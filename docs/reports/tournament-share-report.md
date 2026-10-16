# tournament-share report

Branch: `feat/tournament-share-invite-respond` (from `origin/main` @ 35b9539). Governing design: tournament-lifecycle addendum v1.2.2, AD-4 (read, not edited). Not merged.

## Files changed
- `src/types/tournament.ts`: `TournamentInviteAccess` ('full' | 'individuals' | 'none'), `TournamentInvitationStatus`, `TournamentInvitation`; `Tournament.my_invite_access?` and `my_invitation_status?`.
- `src/api/tournaments.ts`: mapper reads both fields. `my_invite_access`: anything other than the exact strings `full`/`individuals` (null, absent, unknown) maps to `'none'`; `my_invitation_status`: only `pending`/`accepted`, else `null`. Nothing defaults to a value that shows buttons.
- `src/components/tournament/TournamentInvitePanel.tsx` (new): Share button (+ `ShareActionSheet` + `Toast`) via the existing `useAppShare` / `getShareUrl()`, shown only for `full` or `individuals`. Same label keys as the game (`mob.game_detail.share`, `share_title`).
- `src/screens/TournamentDetailScreen.tsx`: renders the panel from `tournament.my_invite_access` (no use of `isOrganiser` for this).
- Tests: `src/screens/__tests__/TournamentShare.test.tsx` (9), `src/api/__tests__/tournaments.test.ts` (+mapper cases, shared with the other tasks), `src/test-utils/tournamentDetailHarness.tsx` (shared mount helper).
- No new label keys for this task.

## Tests (raw)
```
TournamentShare.test.tsx  Tests: 9 passed, 9 total
 ✓ shows Share for full / individuals
 ✓ hides Share for "none", null, undefined, "bogus" (including flag off)
 ✓ never derives access from being the organiser
 ✓ opens the sheet; copy link, WhatsApp and system share use getShareUrl() and make no API call
 ✓ the URL is the game share URL (/public/share) with no tournament identity
```
"Share calls no tournament route": after mount the API mock is cleared, all three share paths are used, and neither `apiClient.get` nor `post` is called.

## Checks
- `npm run check:labels`: OK - 211 files scanned, 954 default labels checked.
- `npx tsc --noEmit`: clean. `npx eslint` on all changed files: clean.
- Full suite: branch `Test Suites: 15 failed, 126 passed, 141 total` / `Tests: 177 failed, 1607 passed, 1784 total`; `origin/main` baseline `15 failed suites / 177 failed tests`. Failing-suite lists identical (diff empty). The branch adds 5 passing suites and the new tests below.
- No screenshots: no emulator/device in this container.

## Deviations
- The shared URL is the same `getShareUrl()` the game share uses (`<API base>/public/share`); the test asserts that value, not the game screen's `?ref=` event link (the existing game-detail share tests still expect an event URL; that is pre-existing and out of scope, per addendum test 42 note).
