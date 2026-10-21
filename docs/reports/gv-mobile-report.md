# Implementation report: gv-mobile

**Task:** gv-mobile, game and tournament view redesign (React Native, Android and iOS)
**Design:** docs/DES-MEETUP-ADDENDUM-game-view-redesign.md v1.0 APPROVED (2026-10-21). Boards: docs/design/game-view-redesign/.
**Branch:** `claude/cool-pascal-84tbeh` (the session designated this branch; the brief named `gv/gv-mobile`, see D-1). Base: `origin/main` a887344.
**State:** implemented and checked, PR open, **not merged**, **not self-certified**. One part of GV-3 is blocked (section 3).

## 1. Outcome in one paragraph

GV-1, GV-2, GV-4, GV-5, GV-6 and GV-7 are built. GV-3 is built except two data-dependent pieces (the individual "Players (m)" count and the per-person "via <group>" / "individual" source tags): no payload the app reads carries them and the app has no client for `GET /events/{id}/invitations`. That is a Blocked item, not an invention. No backend, API contract, auth or guard code was touched. No version bump, no AAB.

## 2. Files touched

New: `src/components/invite/{InviteCard,InvitePicker,InviteTypeRow,InvitedSheet}.tsx`, `src/components/venue/VenueRow.tsx`, `src/utils/mapsUrl.ts`, `src/utils/responseGroups.ts`, status file, this report, `docs/reports/gv-mobile-jest-output.txt` (raw log), and the new test files (section 6).

Changed (source):

| File | Change |
|---|---|
| `src/labels/defaultLabels.ts` | `mob.gv.*` keys (§6 of the design) plus extras (D-5) |
| `src/screens/GamesScreen.tsx`, `src/components/SegmentedSwitch.tsx`, `src/components/TournamentsListContent.tsx` | GV-1 |
| `src/screens/EventDetailScreen.tsx` | GV-2, GV-3, GV-4, GV-5, GV-7 (organizer order); old inline invite forms removed |
| `src/screens/TournamentDetailScreen.tsx`, `src/components/tournament/TournamentInvitePanel.tsx` | same deltas; tab toggle removed |
| `src/components/responses/ResponsesSection.tsx`, `src/utils/responseGroups.ts` | GV-4 |
| `src/components/venue/VenueRow.tsx`, `src/components/venue/VenueDetailCard.tsx` (`variant="sheet"`), `src/utils/mapsUrl.ts`, `src/components/icons/ActionIcons.tsx` (chevron) | GV-2 |
| `src/components/invite/*`, `src/components/AddRemoveControl.tsx` (`GroupInviteList` sections), `src/components/UserSearchPicker.tsx` (`alreadyIn`, `availableHeading`) | GV-3, GV-5 |
| `src/components/user/UserMenuSheet.tsx`, `UserPressable.tsx`, `src/hooks/useUserMenu.ts`, `src/types/userMenu.ts` | GV-6 |

Not touched: backend, any `src/api/*` contract, auth, guards, `docs/` baselines and design docs, `android/`, versions.

## 3. Blocked items and gaps (owner decision needed)

**B-1 (HIGH, part of GV-3): individual-players count and per-person source tags.** GV-3 asks for `Groups (n) · Players (m)` and tags `via <group>` / `individual` / `email`. The app has no client for `GET /events/{id}/invitations`, and its response shape is not documented in this repo (the existing `EventInvitation` type comes from the POST responses). Group invites also create one invitation per member, and nothing in any payload says which invitations were individual. The responses payload has no source field either. Counting or guessing would be inventing a field, which AGENTS.md forbids. Built instead:
- Row value `Groups (n)` for a group game, `Public` (inert) for a public game, and for an organizer with no groups the word "Players". The Players count `(m)` is not shown.
- Invited sheet: Groups first, then People · by response (Accepted, Declined, Pending) from the responses endpoint. Tags shown only where the data carries them: `email` for an email invite, and the existing Invited / Public / Joined tag on a decline. No `via <group>` or `individual` tag, no group member count (the payload has group ids and names only).
To finish B-1: confirm the shape of `GET /events/{id}/invitations` (and tournaments) and whether it carries a source group, then wire `m` and the tags.

**F-1 (finding, outside this task): `mapEventApiItem` (`src/api/events.ts`) drops `venue_snapshot`, `venue_lat`, `venue_lng`, `venue_place_id` and `venue_id`.** So on a game the venue sheet gets name and address text only: no map pin or photos strip, and "Open in Google Maps" uses the AD-5 text fallback (no coordinates, no place id). The same missing mapping already means the existing game `VenueDetailCard` never showed a snapshot and the Edit wizard cannot prefill the catalogue venue. Passing the fields through would change Edit-wizard behaviour, so it was not done under "additive only". Tournaments are mapped, so their sheet gets the snapshot (no maps API key is passed there today, as before). Recommended: a small follow-up task for the mapper.

**G-1 (data gaps, LOW/MEDIUM):**
- Tournament "Team: …" tag in Registered: registrations carry `participant_name` and no team field, so no team tag is shown. "Registered" is the strict intersection of accepted responses and active registrations (AD-1); a team registration with no user id therefore does not appear in that group (it still counts in the "x of y registered" header).
- Responses carry no nickname. Nicknames show after the display name on games (from the participants list the screen already loads); not for declined or pending people.

## 4. Decisions made where the design was silent (please confirm)

- **D-1 Branch.** Developed on `claude/cool-pascal-84tbeh`, the branch the session designated, not `gv/gv-mobile` from the brief (pushing elsewhere needed explicit permission). Rename or retarget if you want the brief's name.
- **D-2 Share kept.** The "Share app link" button stays inside the new Invite card (it is an existing organizer function, not named in any delta).
- **D-3 Registrations for non-readers.** The Fixtures | Registrations toggle is gone (AD-10). Viewers who cannot read the responses (anyone but organizer/committee) would otherwise lose the registrations list, so they keep it as a plain "Registrations" card with the same row testIDs. Organizer/committee get Registered inside Responses instead.
- **D-4 Committee.** `Responses` shows when the viewer is the organizer or the server's `my_invite_access` is `full`/`individuals` and the responses call answered. A refused or failed call degrades to today's content (OI-1): no Responses block, registrations list and Invite card kept. Not verifiable here without a committee account.
- **D-5 Labels beyond §6.** All new strings are labels. Extras the boards need, to be mirrored in the backend seed: `view_active` "Active", `view_all` "All" (compact toggle text; the accessible names stay "Active games" / "All games"), `invite_title`, `invite_hint`, `people_by_response`, `picker_title`, `tab_groups`, `tab_players`, `address_copied`, `invites_sent`, `invites_failed`, `already_in_tournament`. `docs/label-inventory-mobile.json` was not edited (docs rule); it is now behind `defaultLabels.ts`.
- **D-6 Non-organizer details.** Closure summary for a non-organizer of a closed game stays above Players as today; only the organizer's closure panel/notice moved to the end. A failed responses call for an organizer keeps the Players card. Without the venue-catalogue flag the venue row stays the plain text it was.
- **D-7 Tournaments toggle.** TournamentsListContent has no scope chips, so its Active | All switch is only made compact and right-aligned in its own row.
- **D-8 Boards vs. text.** The user pop-up board shows "Display name" / "Nickname" rows; AD-7 and the brief define identity as avatar, display name, nickname and badge, so those rows are not duplicated. The picker board's "… 10 more" truncation is not built (full lists). The game board's "Organizer" row in the Details card is not a GV delta, so it is not added.
- **D-9 Group-line rule.** The Invite type row lists groups only for group visibility, as the old group line did.
- **D-10 Tap now fetches.** Tap and long-press open the same sheet, so a tap now makes the card request (game and group contexts), as the design requires for the actions to be available.

## 5. Traceability

| Requirement | Where | Tests |
|---|---|---|
| GV-1, AD-8 (Mine \| Public \| All, Mine default, route scope honoured, toggle in the chip row) | `GamesScreen.tsx`, `SegmentedSwitch.tsx`, `TournamentsListContent.tsx` | T1: `GamesScreen.test.tsx` |
| GV-2, AD-5 (venue row, sheet, Maps link, Copy) | `VenueRow.tsx`, `VenueDetailCard.tsx`, `mapsUrl.ts` | T6: `mapsUrl.test.ts`, `VenueRow.test.tsx`, `EventDetailGameView.test.tsx` |
| GV-3, AD-2 (Invite type row, Invited sheet) | `InviteTypeRow.tsx`, `InvitedSheet.tsx` | T3: `InviteTypeRow.test.tsx`, `EventDetailGroups.test.tsx`, `DetailGroupRow.test.tsx`; **B-1** open |
| GV-4, AD-3 (Responses for organizer, Declined above Pending, rows open pop-up) | `ResponsesSection.tsx`, `responseGroups.ts` | T2: `ResponsesSection.test.tsx`, `responseGroups.test.ts`, `EventDetailGameView.test.tsx`; T7 non-organizer Players unchanged: `EventDetailGameView.test.tsx` |
| GV-4 tournament, AD-1 (Registered split) | same, `TournamentDetailScreen.tsx` | `TournamentGameView.test.tsx` |
| GV-5, AD-4 (Invite card, picker, one Send, per-entry failures by name) | `InviteCard.tsx`, `InvitePicker.tsx`, `GroupInviteList`, `UserSearchPicker`, `TournamentInvitePanel.tsx` | T4: `EventDetailShareInvite.test.tsx`, `EventDetailScreen.test.tsx` (BUILD 3 / C), `TournamentInvite.test.tsx` |
| GV-6, AD-7 (one combined pop-up, `openDetails` kept) | `UserMenuSheet.tsx`, `useUserMenu.ts`, `UserPressable.tsx` | T5: `UserMenu.test.tsx`, `EventDetailPlayers.test.tsx`, `GroupDetailMembers.test.tsx` |
| GV-7, AD-9, AD-10 (closure last, tab toggle removed) | `EventDetailScreen.tsx`, `TournamentDetailScreen.tsx` | `EventDetailGameView.test.tsx`, `TournamentGameView.test.tsx`, `TournamentRegistrationsMenu.test.tsx` |
| AD-6 labels | `defaultLabels.ts` | `npm run check:labels` |

Rules kept: theme tokens only in new code (no literals), fixed-size icon boxes, one correlation ID per picker send (`withCorrelationId`, AD-4), tokens/Keychain untouched, no standings or counts recomputed (the "x of y" numbers come from `participant_count`, the registrations list the screen already loads, and capacity; the Registered split is the AD-1 intersection), existing testIDs kept (`invite-group-entry`, `invite-player-entry`, `player-<id>`, `registration-<id>`, `close-game-button`, `closure-opens-notice`, `organizer-responses-section`, `responses-section-*`, `*-row-<i>`, `waitlisted-tag-<i>`, `via-tag-<i>`). New testIDs: `venue-row`, `venue-sheet`, `venue-open-maps`, `venue-copy-address`, `invite-type-row`, `invited-sheet`, `invited-group-*`, `invited-section-*`, `invited-person-*`, `invite-card`, `invite-picker`, `invite-picker-send`, `invite-picker-back`, `invite-picker-error`, `invite-picker-selected`, `response-person-*`, `organizer-tag-<i>`, `email-tag-<i>`, `user-menu-badge`, `tournament-fixtures-section`.

## 6. Checks (raw)

Run on the cloud container (Node v22.22.0); no emulator or device was available.

```
$ npx tsc --noEmit            -> exit 0, no output
$ npm run check:labels        -> check-labels: OK - 245 files scanned, 1138 default labels checked.
$ npx eslint src              -> 3 errors, all pre-existing in untouched files:
    src/components/__tests__/NotificationCard.test.tsx   (2 unused imports)
    src/components/icons/__tests__/RegistryIcons.test.tsx (1 unused import)
  (whole-repo `eslint .` adds 28 in jest.setup.js and 1 warning in scripts/check-labels.js, also untouched)
```

**Jest: one scoped run** (`npx jest --ci <73 suites>`: every suite related to the touched source files, plus the two static inventory suites). Full log: `docs/reports/gv-mobile-jest-output.txt`.

```
Test Suites: 9 failed, 64 passed, 73 total
Tests:       152 failed, 762 passed, 914 total
Time:        35.264 s
```

New or changed suites, all passing: `UserMenu`, `UserSearchPicker`, `UnifiedCardAvatars`, `ResponsesSection`, `InviteTypeRow`, `VenueRow`, `mapsUrl`, `responseGroups`, `GamesScreen`, `EventDetailGameView` (new), `TournamentGameView` (new), `EventDetailShareInvite`, `EventDetailGroups`, `EventDetailPlayers`, `EventDetailResponses`, `TournamentInvite`, `TournamentRegistrationsMenu`, `TournamentRespond`, `TournamentResponses`, `TournamentShare`, `InviteSearchConsistency`, `GroupDetailMembers`, `AccessActionNotFound`, `AccessRefetchDetails`, `inviteControlsStatic`.

Failing suites (9):

| Suite | Cause | Mine? |
|---|---|---|
| `DetailGroupRow` (2 tests) | asserted the removed group line (`group-name-item`) | **Yes, superseded by GV-3.** Rewritten for the Invite type row after the run, plus the group-visibility guard (D-9). **Not re-run** (single-run rule); verified by `tsc` and `eslint` only. |
| `ProfileScreen`, `ProfileScreenLinks`, `ProfileScreenReportRow`, `ProfileScreenTerms` | Profile screen text and controls (nickname line, Edit button, avatar) | No: screen not touched. Not verified against `main` (no second run). |
| `HomeScreen` | dashboard sections and banner text not rendered as the test expects (`Ready to play, Sam Smith?` vs `!`, missing section testIDs) | No: Home untouched. Not verified against `main`. |
| `CreateGameScreen` | stale labels (`🎮 Casual Game`) and inputs | No: untouched. Not verified against `main`. |
| `EventDetailScreen` (partly) | legacy suite: labels that exist nowhere in source (`Cancel Event`, `Invite Individual`, `Share Event`, `About this game`); its BUILD 3 / BUILD C invite cases, which I rewrote for the picker, pass | No: the failing cases were already asserting removed UI. Not verified against `main`. |
| `keyboardInventory` | Profile screen lacks `KeyboardAwareScreen`; ten files render a bare `TextInput` (none of mine) | No |

Also: the three root-level suites (`__tests__/App.test.tsx`, `AppForceUpdate.test.tsx`, `index.test.ts`) were left out of the run by mistake (my path filter dropped them); `tsc` covers their imports but they did not run.

Not provided: **screenshots next to the boards.** No Android/iOS runtime exists in this environment, so nothing was rendered on a device. Layout follows the boards' sizes by reading `docs/design/game-view-redesign/*.html` and tokens; it needs the owner's visual check on a device before it is judged against the boards.

## 7. Docs drift to report (docs not edited)

- `docs/INDEX.md` and `docs/DES-MEETUP-ADDENDUM-user-details-menu.md` still describe "tap opens View Details"; superseded by game-view-redesign D-1.
- `docs/label-inventory-mobile.json` lacks the `mob.gv.*` keys.
- Design doc §3 GV-3 names source tags but gives no data source for `via <group>` (B-1).
- `mapEventApiItem` does not map the venue fields AD-5 says are on the payload (F-1).
- Several legacy suites assert UI that no longer exists (`EventDetailScreen`, `HomeScreen`, `CreateGameScreen`, `ProfileScreen*`, `keyboardInventory`); they predate this task.

## 8. Git evidence

See the PR; branch `claude/cool-pascal-84tbeh` off `origin/main` a887344. No `android/key.properties`, `google-services.json` or `.env` in the diff. No `versionCode` / `versionName` change.
