# ir-t3 Status: Invite reminder, mobile

Branch: `ir-t3`, cut from main 0dcf3dd (includes rn-t3, np-t3, db-t3). Not merged.
Backend: `GET /api/version` = 199 (release r17-1-a151004). Source: DES-MEETUP-ADDENDUM-invite-reminder v1.0.2 (contract block in the task).

## Done so far
- `src/types/event.ts`: Pending-row fields on `ResponsePerson` (`last_reminded_at`, `reminder_count`, `can_remind`, `remind_blocked_reason`, `remind_retry_after_seconds`), `ReminderAck`.
- `src/api/events.ts` `remindEventInvitee`, `src/api/tournaments.ts` `remindTournamentInvitee`: `POST /{events|tournaments}/{id}/reminders` `{user_id}`.
- `src/utils/reminderError.ts`: `parseReminderError` (404 hide, 409 codes, network failure) and `applyReminderAck` (pure).
- `src/labels/defaultLabels.ts`: `mob.remind.*` (10 keys, fallbacks as in the brief).
- `src/components/responses/ResponsesSection.tsx`: `remind` prop; Remind button (existing `Button`, small, secondary) on Pending rows only where `can_remind`; disabled with reason text when `remind_blocked_reason`; nothing when `can_remind` false and no reason; "Reminded <when>" under the name; sending / sent / failed states; 404 hides the control; NOT_PENDING refreshes the list.
- `EventDetailScreen`, `TournamentDetailScreen`: send the POST (one correlation id per tap), patch the row from the 200, refresh on "already replied".

## Tests (affected files only; the full suite was not run)
`npx jest` on 11 files: 11 suites, 181 tests passed. New: `ResponsesSectionRemind.test.tsx` (every state), `reminderError.test.ts`, `reminders.test.ts` (API), `EventDetailReminder.test.tsx`, one case added to `TournamentResponses.test.tsx`. Existing section and screen tests unchanged and passing. `npx tsc --noEmit` clean, `npm run lint` clean, `npm run check:labels` OK (2169 labels).

## Contract notes and assumptions (drift to report)
- The brief names the closed-item 409 code `game_ended` "or the tournament equivalent" without naming it; any other 409 code containing "ended" or "closed" is read as item closed.
- The 409 `code` and `retry_after_seconds` are read from the top of the body or under `detail` (the contract does not say which).
- A 404 hides that row's control (it can also mean the feature switch is off; the list's `can_remind` already hides it in that case).
- `mob.remind.off` ("Reminders are switched off") is defined as required but never shown: the brief says to show nothing when the switch is off.
- `too_soon` text "Try again in {minutes} minutes" reads "1 minutes" for under a minute (the fallback text is as specified); minutes are rounded up.
- New label keys are not seeded server-side.

## Device check (iOS simulator GameOnTest, Release build of this branch)
- Backend vs contract: the live `/openapi.json` (version 199) has `POST /events/{id}/reminders` and `POST /tournaments/{id}/reminders` with `{user_id: uuid}` -> `{sent_at, last_reminded_at, reminder_count}`, and `ResponsePerson` with `last_reminded_at`, `reminder_count`, `can_remind`, `remind_blocked_reason`, `remind_retry_after_seconds`. Matches the contract; no Blocked Report.
- Real data: the test account's only hosted game ("Sunday Doubles", public, closed) shows the Responses section with Accepted 1, Declined 0, Pending 0, so no Remind row can appear there (correct: the server lists nobody). No game was created and no one was invited on production (it could notify real people). No real reminder was sent.
- States were exercised with a local pass-through proxy (not in the repo; `localhost:8765`, build-time `API_BASE_URL` override in the gitignored `.env`, restored afterwards). It forwards everything to production unchanged except: it injects scripted Pending rows into `GET /events/{id}/responses`, and answers `POST /events/{id}/reminders` itself, so no reminder reaches anyone. Verified on the device, with screenshots in the report:
  - can_remind: Remind shown; tap -> sending -> "Reminded Just now" + green "Reminder sent", button disabled.
  - "Reminded 5m ago" under the name when `last_reminded_at` is set.
  - Server reasons from the list: `limit` -> "Reminder limit reached", `too_soon` (240 s) -> "Try again in 4 minutes", `item_closed` -> "This invitation is closed", all disabled; `no_account` on an email invitee with no user id -> "This person has no account yet", disabled.
  - POST answers: 409 TOO_SOON (retry_after_seconds 240) -> "Try again in 4 minutes", disabled; 503 -> red "Could not send reminder" with Remind still enabled; retry -> "Reminder sent"; 409 NOT_PENDING -> "This person has already replied", the list reloads and she is gone (Pending 8 -> 7). Proxy log: five reminder POSTs, then a fresh `GET .../responses`.
  - After a reload, a row shows server data again (the proxy did not remember Tom's send, so his "Reminded" line reset while the local "Reminder sent" text stayed): expected.
- The first launch against the proxy showed "Session expired" (`/users/me`, `/auth/refresh`, sign-out): the saved refresh token was rejected; cause unproven (expired token or the proxy hop; status codes were not logged then). After the test account was signed in again by its owner every proxied call returned 200.
- NOT VERIFIED: reminder push buttons. A push injected with `xcrun simctl push` (`aps.category` `invite_game`, `notification_type` `event_invite`) was accepted by the simulator but no banner and nothing in the shade appeared, likely because this simulator never granted the app notification permission (unconfirmed; it cannot be granted from the command line). Accept/Decline completing a real response needs a real invitation to the test account. The push action code is unchanged by this task (existing push-actions tests unchanged and passing).
- Cleanup done: proxy stopped, `.env` restored (no override left), simulator reinstalled with the normal production Release, `pod install` side effects (`Podfile.lock`, `project.pbxproj`, `PrivacyInfo.xcprivacy`) reverted so only branch changes are committed.

## Fix found during the check
An email invitee with no account yet has no `user_id` but the contract gives them `remind_blocked_reason: no_account`; the first version hid that row. Now a blocked row shows disabled with its reason without a user id (commit 1c9e3ee, test added). Sending still requires a user id.
