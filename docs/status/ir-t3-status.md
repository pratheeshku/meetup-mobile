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

## Still to do
Device check (UI on the simulator, reminder-push buttons), report.
