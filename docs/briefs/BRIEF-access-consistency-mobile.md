# Build Brief: Access Consistency (mobile app)

Prepend `docs/agent-handoff-template.md` (sections 0–end) to this brief. Repo: `~/Developer/meetup-mobile`.

**Design:** DES-MEETUP-ADDENDUM-ACCESS-CONSISTENCY **v1.0** (APPROVED by the owner, 2026-10-18). Only AD-8 and AC-10 apply to mobile. The server decides access; the app never recomputes it.

## Hard rules
- Backend contract comes from `~/meetup`. Do not invent endpoints or fields. If one is missing, STOP and ask.
- Never commit secrets. Theme tokens only. Do not edit `docs/`. Never choose version numbers.
- No new screens and no visual redesign. The one new piece of UI is a neutral "no longer available" message; use the existing label system (`npm run check:labels`) and an existing component, and ask if neither fits.
- If something is not specified, STOP and ask. No conformance review or testing-agent dispatch.

## Task `ac-m-refetch` (one status file)
1. **Audit first (report before changing):** list every place a games, tournaments, groups or notifications list or detail is kept beyond the screen's life: module caches in `src/api` (for example `home.ts`, `groups.ts`), `AsyncStorage`, `useResource`, navigation params that carry full objects, and `src/hooks` game lists. Record file:line for each.
2. **Refetch rule (AC-10):** Home/dashboard, All Games, All Tournaments, Groups, group detail, game detail and tournament detail fetch on every screen focus and on app foreground. No stale rows rendered while the fetch is in flight for lists: show the loading state, not the old rows. Detail screens opened from a push or a deep link always fetch fresh.
3. **Removed access:** a 404 on a game, tournament or group detail fetch closes the screen (goes back) and shows the neutral "no longer available" message once. This also covers a push notification whose target now returns 404. Never show a "forbidden" or "you were removed" message; the server returns 404 for everything denied.
4. **Notifications list:** render exactly what the API returns. Retracted notifications are hidden by the server; do not cache the list across opens and do not compute the unread count locally.
5. **Streams:** the mobile app has no event stream today. Do not add one. If the audit finds one, STOP and report.

## Acceptance
Jest tests: (a) each listed screen refetches on focus; (b) no list renders previous rows after a refetch that returns fewer items; (c) a 404 detail response navigates back and shows the message once; (d) a push for a 404 target shows the message and does not crash. Run `npx jest` once, plus `npx tsc --noEmit`, `npm run lint`, `npm run check:labels`.

## Reporting
Raw test output, coverage delta, the audit list from step 1, screenshots of the "no longer available" message, deviations. Write `docs/reports/ac-m-refetch-report.md` and stop. Starts after backend `ac-p2-view-rule` and `ac-p3-cascade` are deployed, so the 404 behaviour can be exercised end to end.

## Task `ac-m-followup` (stacked on `ac-m-refetch`)
Branch `ac/ac-m-followup` off `ac/ac-m-refetch`; open the PR against `ac/ac-m-refetch`. Closes the gaps listed in `docs/reports/ac-m-refetch-report.md`.
1. **404 on an action:** a 404 returned by an action on an open game, group or tournament detail screen (join, leave, RSVP, withdraw, member changes) goes through the same close-and-message path as a 404 detail fetch. Other errors keep today's handling.
2. **Own actions must not show the notice:** when the user's own successful action (cancel or delete a game, delete or leave a group, withdraw) makes the next fetch 404, show the existing completion flow only, never "no longer available". Trace every create/cancel/delete/leave completion flow in `src/navigation` and `src/screens` and report file:line for each.
3. **Label inventory:** `docs/label-inventory-mobile.json` drifts by one label; do not edit `docs/`. Put the exact entry needed in the report for the owner.
4. Tests for 1 and 2. Run `npx jest` once, `npx tsc --noEmit`, `npm run lint`, `npm run check:labels`; compare failing suites to `main` as before. Report `docs/reports/ac-m-followup-report.md`.

