# DES-MEETUP-ADDENDUM-GROUP-INVITE-EXISTING-ACCOUNTS

**Doc ID:** DES-MEETUP-ADDENDUM-GROUP-INVITE-EXISTING-ACCOUNTS
**Version:** v1.0.1
**Status:** APPROVED by the owner on 2026-11-15. Built on the owner's elicitation decisions of the same day. Architect decisions are listed in §10; the owner may overturn any.
**Owner:** Pratheesh
**Date:** 2026-11-15
**Scale Tier:** T1
**Governing files:** `Enterprise_Design_Principles.md` v1.1 and `design-best-practices.md` v1.0, both found and read in full before drafting. No deviation from either file. Two deviations from project rules (D-1, D-2).
**Codebase read (BP-01):** `pratheeshku/meetup` @ `dcdf770`, `pratheeshku/meetup-mobile` @ `c0f5a26`.
**Closes:** OI-8 of `DES-MEETUP-ADDENDUM-deep-links-desktop-ui`.
**Supersedes in part:** deep-links DL-06 and AD-10 (the sentence "an existing account does not join a group by link"); deep-links DL-12 second sentence and DF-1, for Android install attribution only (GI-09); deep-links §2 "no new third-party library", for one named Android library (D-2).
**Unchanged and relied on:** shareable-links Decision 6 (`invited_email` is never an access condition), Decision 8 (join at account creation, same transaction), Decision 11 (single-use token, atomic claim), Decision 15 (`POST /groups/invitations` response is exactly `token` and `invitation_url`); deep-links AD-2 (claims travel in the fragment), AD-5, AD-6, AD-8.

## 1. Executive Summary

Today a group invitation link only works for a person who creates an account with it. A person who already has an account is not joined, on the app or the web. That also breaks the most likely new-user path: install the app from the store, sign up, then tap the link again.

This addendum adds three things.

1. **Existing accounts can join by link.** A signed-in person who opens a group invitation link sees a confirm screen with the group name and a Join button, on the app and on the web. Join uses the token. The link itself still grants nothing.
2. **Each invitation records who joined and how.** The invitation row already holds who sent it. It now also holds who used it and by which route.
3. **Android install attribution.** When a person reaches the Play Store from our web invitation page, the app can tell which invitation brought them. A join by that person is recorded as "joined via Android install". This is a count for the owner, stored in the database only. iOS has no equivalent and is not tracked.

One database migration (four additive columns). One new API endpoint. One new screen in the app and one new state on the web invitation page.

## 2. Requirements (elicited 2026-11-15)

| ID | Requirement |
|---|---|
| GI-01 | A signed-in person who opens a group invitation link sees the group name with two actions, Join and Not now. Nothing is joined by opening the link. |
| GI-02 | Join adds the person to the group as a member, records the inviter on the membership, uses up the token and opens the group. The token stays single-use: the first person to claim it wins. |
| GI-03 | A person who is already a member of that group is taken to the group. The token is not used up. |
| GI-04 | A token that is unknown or already used, or whose group is deleted, gives one neutral "this invitation is no longer available" message. The message never says which case applies. |
| GI-05 | A signed-out person signs in or signs up first. Sign-up with the token joins on the server exactly as today. After sign-in, the person lands on the GI-01 confirm screen. |
| GI-06 | GI-01 to GI-05 hold on the mobile app and on the web. |
| GI-07 | Links do not expire. `invited_email` stays informational and is never checked. |
| GI-08 | Each invitation records who sent it (already stored), who used it, when, and by which route: sign-up with the link, existing account with the link, or Android install. |
| GI-09 | Android only: a person who reaches the Play Store from the web invitation page and then installs is attributed to that invitation. A join by that person is recorded as "Android install". The attribution grants nothing and joins nobody. |
| GI-10 | The GI-08 and GI-09 data is stored in the database only. No screen shows it in this release. |
| GI-11 | App versions already installed keep working. |

## 3. Scope & Constraints

**In scope:** a join endpoint for signed-in accounts; the confirm screen (app) and confirm state (web); keeping the token through sign-in; four new columns on `group_invitations`; the Play referrer on the web invitation page; reading the referrer in the Android app; recording the join route.

**Out of scope:** link expiry and revocation; reusable or multi-use links; joining automatically after a store install (deep-links DF-1 stays deferred); iOS install attribution; any admin or organizer screen for the new data; game and tournament invitations; any change to who may create an invitation.

**Constraints**
- Authorization stays in `groups/policies.py` and `shared_auth_core`. No new RLS, triggers or database-side validation. The new columns carry no CHECK constraint; the application validates their values.
- One migration, additive only (P14). The owner runs it. Agents write the script and never run it.
- The token is a claim. It travels in a link fragment or a request body, never in a path or query (deep-links AD-2).
- Runtime settings stay in the admin UI. This addendum adds no setting.
- Both apps ship through store review, so the server must accept old apps that send none of the new fields.

## 4. Architecture Decisions

**AD-1: One join endpoint for signed-in accounts (GI-01, GI-02).** `POST /groups/invitations/join`, body `{ "token": "<uuid>" }`. It needs a signed-in caller. Its access rule is declared in `groups/policies.py` as "any authenticated account"; the token is the capability, exactly as it is at sign-up. The inviter's authority was checked when the invitation was created, so it is not rechecked. Rejected: honouring `invitation_token` at ordinary sign-in. That would join on a tap plus a login with no explicit consent, and it contradicts the owner rule that links navigate and grant nothing.

**AD-2: Outcomes and neutral failure (GI-02, GI-03, GI-04).** Success is `200` with `group_id` and `outcome`, where `outcome` is `joined` or `already_member`. Every failure caused by the token (unknown, already used, group deleted) is one `404` with one fixed message and error code. The error code is `invitation_unavailable`. The caller cannot tell the cases apart. A malformed token is a `422` from schema validation.

**AD-3: Order of checks and atomic claim (GI-02, GI-03, P5).**
- The invitation and its group are resolved first. Missing either: the neutral `404`.
- If the caller is already a member of the group, the answer is `already_member` and nothing is written. A retry after a lost response therefore succeeds, because the first call's membership is already committed.
- Otherwise the existing atomic claim runs (`groups/repository.py::claim_group_invitation`: `consumed_at` set only where it is still null). No claim: the neutral `404`. This includes a person who used the token earlier and has since left or been removed: a used token never joins twice.
- The membership row is written in the same transaction as the claim, with `role = member` and `invited_by_user_id` = the inviter. Both commit together or neither does.

**AD-4: Confirm before joining (GI-01).** Opening the link never joins. The app and the web both show the group name from the existing `GET /public/groups/invitations/{token}` and wait for Join. Not now leaves the token unused and opens the Groups list.

**AD-5: The token survives sign-in, in memory only (GI-05).** App: the existing pending target `group_invite` in `src/links/linkStore.ts` is kept through sign-in and opens the confirm screen. This replaces the deep-links AD-10 behaviour of opening the Groups list. Web: the token is kept for the current tab only (the browser's per-tab session storage, never `localStorage`), is taken out of the address bar once read, and is dropped after Join, Not now or a failure. Neither side writes it to persistent storage, logs or analytics.

**AD-6: Join record on the invitation row (GI-08).** Two new columns on `group_invitations`: `consumed_by_user_id` and `joined_via`. Both are written once, in the same statement that sets `consumed_at`, by both join paths (sign-up and AD-1). `joined_via` takes one of three values: `signup_link`, `existing_account_link`, `android_install`. The inviter is the existing `inviter_user_id`; no new column is needed for it. Rows used before this release keep nulls in the new columns.

**AD-7: Attribution code, separate from the token (GI-09).** Fact: `token` is the primary key of `group_invitations`; there is no other identifier. A Play Store address is not a fragment, so the token must not ride in it. New column `attribution_code`: a random, unguessable value created with each new invitation. It identifies an invitation for counting and grants nothing. It is returned as an additive field `attribution_code` (string or null) on `GET /public/groups/invitations/{token}`, so only a holder of the token can learn it. Invitations created before this release have no code and are not attributable. Shape: URL-safe characters only (`A-Z a-z 0-9 _ -`), 22 characters as issued; the server accepts 8 to 64 and the app 1 to 128, and anything else is ignored.

**AD-8: Referrer on the web invitation page (GI-09).** The signed-out web invitation page shows one text link to the Play Store, to visitors on an Android browser only (the page had no store link before; found in the build). On that link it adds `referrer=gi%3D{attribution_code}` to the Play Store address. It does so only when the address host is `play.google.com` and a code exists. Nothing is added to the App Store address.

**AD-9: Reading the referrer in the Android app (GI-09).** While signed out, the Android app asks the Play Install Referrer API for the referrer on a cold start and keeps a `gi` code in memory only. It sends it as an additive optional field `attribution_code` on the account-creation requests that already carry invitation fields (deep-links AD-8: `POST /auth/signup`, `POST /auth/oauth/{provider}/callback`, and through the sign-up ticket to `POST /auth/complete-signup`). It is not sent at ordinary sign-in. The social callback serves sign-in and sign-up alike, so the app sends the code there too; the server ignores it for an account that already exists. iOS never sends it.

**AD-10: Recording the attribution and the route (GI-08, GI-09).** New column `install_attributed_user_id`.
- At account creation with a code that matches an invitation: that invitation's `install_attributed_user_id` is set to the new account if it is still null. First writer wins. Nobody is joined by this.
- An unknown or malformed code is ignored and never fails account creation.
- `joined_via` rule, applied at the claim: `android_install` when the joining account equals `install_attributed_user_id`; otherwise `signup_link` on the account-creation path and `existing_account_link` on AD-1.

**D-1 (deviation from the `AGENTS.md` board rule, not from either governing file).** No design board exists for the confirm screen and none is produced. The app screen reuses the layout, components and theme tokens of the existing `GroupInviteScreen` (same group-name message, two actions). The web state reuses the existing web invitation page. Rationale: it is one message and two buttons on an existing pattern; a board adds a round trip without adding a decision. Agents attach screenshots next to `GroupInviteScreen`.

**D-2 (deviation from deep-links §2 "no new third-party library" and DL-12).** One Android-only dependency is allowed: Google's Play Install Referrer library, the platform's own API for this. No link service, no attribution SDK, no device fingerprinting, no clipboard reads. Rationale: the owner asked for install visibility on Android, and this is the only first-party way to get it. Blast radius is one optional read at start-up that fails closed (AD-9, §7).

**Tier check (BP-05, BP-12).** Not adopted at T1: link expiry, per-link revocation, binding a link to an email or device, signed attribution. No in-scope threat needs them. A link is already a single-use bearer token for one group membership, and attribution is a counter, not a control.

## 5. Component / Integration Design

### 5.1 Data (`group_invitations`, one additive migration)

Existing columns (verified in `groups/models.py`): `token` (PK), `group_id`, `inviter_user_id`, `invited_email`, `created_at`, `consumed_at`.

Four new columns, all nullable:

| Column | Meaning |
|---|---|
| `consumed_by_user_id` | The account that used the token. References `users.id`. |
| `joined_via` | `signup_link`, `existing_account_link` or `android_install`. Validated in the application. |
| `attribution_code` | Random code created with each new invitation. Unique where present. |
| `install_attributed_user_id` | The account created from an Android install attributed to this invitation. References `users.id`. |

Account deletion in this system anonymises and soft-deletes the `users` row (`users/service.py`), so the two new references do not block it. They follow the existing `inviter_user_id` reference.

### 5.2 Backend and web (`pratheeshku/meetup`)

| Area | Change |
|---|---|
| migrations | `bb9a7fad474b` adds the four columns of 5.1 and the uniqueness of `attribution_code`; `c7d3a91e5f24` seeds the four mobile labels. Apply in that order |
| groups/models, repository, service | New columns; code generated at invitation creation; claim records `consumed_by_user_id` and `joined_via`; join service for AD-1 to AD-3 |
| groups/router, policies | `POST /groups/invitations/join` with its declared access rule |
| auth | Optional `attribution_code` accepted on the three account-creation paths (AD-9); AD-10 applied in the same transaction as account creation |
| public | `GET /public/groups/invitations/{token}` gains `attribution_code` (additive) |
| frontend (`frontend/app.js`) | Confirm state for a signed-in person; token kept through sign-in for the tab; Play referrer (AD-8); PWA version bump |
| labels | Mobile keys `mob.group_invite.join_question`, `join_question_generic`, `join`, `not_now` (the unavailable case reuses `mob.group_invite.invalid`); web keys under `web.group_invite_landing.*` |

`POST /groups/invitations` is unchanged: its response stays exactly `token` and `invitation_url`.

### 5.3 Mobile (`pratheeshku/meetup-mobile`)

| Area | Change |
|---|---|
| Links | Pending `group_invite` target kept through sign-in (AD-5) |
| Screens | New signed-in confirm screen (AD-4, D-1); outcomes open the group, or show the neutral message and return to the Groups list |
| API | Join call, one correlation ID per Join tap; `attribution_code` on account-creation calls |
| Android | Play Install Referrer read (AD-9, D-2). No iOS change for attribution |

### 5.4 Journeys

| Person | Path | Recorded `joined_via` |
|---|---|---|
| New, signs up on the web with the link | Unchanged | `signup_link` |
| New, has the app, signs up in the app with the link | Unchanged | `signup_link` |
| Existing account, app or web | Link, confirm, Join | `existing_account_link` |
| New, Android, goes to the Play Store from the web invitation page, installs, signs up, taps the link again, Join | Attribution at sign-up, join at confirm | `android_install` |
| New, iPhone, installs from the App Store, signs up, taps the link again, Join | Join at confirm | `existing_account_link` |

Attributed but not yet joined (installed and signed up, never tapped Join) is visible as `install_attributed_user_id` set with `consumed_at` null.

### 5.5 Compatibility (GI-11, P14)

All API changes are additive: one new endpoint, one new optional request field, one new response field. Old apps never call the endpoint and never send the field; they behave as today (an existing account lands on the Groups list). The migration must be applied before the new backend is deployed.

## 6. Security & Compliance

- **Authorization (P15):** the join endpoint declares its rule in `groups/policies.py` and rejects an unauthenticated caller at the entry point. The token is checked in the application; no database control is relied on.
- **What a link grants:** nothing on open (AD-4). A token held by a signed-in person grants one membership in one group, as it already does at sign-up. No new group of people gains access: anyone who could join by signing up can now join with the account they have.
- **Token handling (P4, P9):** fragment or request body only. The join endpoint takes it in the body so it stays out of access logs. It is validated as a UUID and masked in application logs.
- **No oracle (GI-04):** one failure answer for every token-related cause.
- **Attribution code:** carries no access. It appears in the Play Store address and the device's referrer, so it is treated as public. It is validated for shape and length and matched by exact lookup (P9). It can be forged by someone who holds the invitation; the effect is a wrong count, never access. Accepted at T1.
- **Rate limits (P17):** the existing per-account limits apply to the join endpoint and the existing `/public/*` limit to the preview. A UUID token cannot be guessed at those rates.
- **Privacy:** the new columns store account ids only, no new personal data. The Android app reads the install referrer, which is device data from Google Play; the owner checks the Play Console data-safety form (OI-3).
- **Tests (P13), API-level negative tests:** join without sign-in is refused; a used token gives the neutral `404` and writes no membership; an unknown token and a deleted group give the same answer; a member's token stays unused; a repeated Join by the same member does not error or duplicate; two accounts joining at once yield one member; a person removed after joining cannot rejoin with the same token; an unknown `attribution_code` does not fail sign-up and writes nothing; attribution alone creates no membership.

## 7. Observability & Operability

- Counters without tokens, codes or account ids: join attempts by platform and outcome (`joined`, `already_member`, unavailable); attributions recorded; referrer reads by result (found, none, error).
- One correlation ID per Join tap, carried from the app to the server (existing `withCorrelationId()` rule).
- Failure behaviour (P7): the referrer read is optional. If the Play service is missing, slow or errors, the app continues with no code and shows nothing to the person.
- Reading the numbers (GI-10): from `group_invitations` by query. "Joined via Android install" is `joined_via = android_install`; "sent" is all rows; "joined" is `consumed_at` not null. No endpoint or screen in this release.
- Rollout order: owner runs the migration; backend and web deploy; apps release through the stores. The web and server parts work before the new apps are live.
- Rollback: the previous backend and web run against the new columns unchanged, because every column is nullable and unused by old code. No down-migration is needed to roll back.

## 8. Risks & Mitigations

| Risk | Rating | Mitigation |
|---|---|---|
| A link forwarded beyond the invited person lets someone else join | MEDIUM | Existing behaviour at sign-up and an owner decision (no email binding, GI-07). Single use limits it to one person. The inviter and the joiner are both recorded (AD-6) and an organizer can remove a member |
| Install counts are lower than real installs: a person who goes to the Play Store directly, or opens the link inside a chat app's browser that drops the referrer, is not attributed | MEDIUM | Stated limit of the method. The number is a floor, not a total. No workaround without the techniques D-2 excludes |
| The Play referrer is not delivered to the staging app because it is not installed from a Play track | MEDIUM | OI-1: checked on the owner's Android phone before the feature is relied on |
| Join and a concurrent second Join both succeed | LOW | Atomic claim plus the existing unique constraint on group and user (AD-3); covered by a test |
| New backend deployed before the migration | MEDIUM | Rollout order in §7; the pipeline applies or the owner runs the migration first |
| Confirm screen built without a board drifts from the app's look | LOW | D-1: reuse `GroupInviteScreen`; screenshots in the agent report |

## 9. Open Items

| ID | Item | Gate |
|---|---|---|
| OI-1 | Confirm how the staging Android app reaches the owner's phone. The Play referrer only exists for installs from a Play Store track. If staging is installed another way, attribution can only be checked on a Play track build | Owner answers before the Android task is accepted; does not block the join work |
| OI-2 | Where the GI-08 and GI-09 numbers are shown | Owner decision, later (GI-10) |
| OI-3 | Play Console data-safety form: confirm the install referrer read needs no new declaration | Owner, before the Android release that contains it |
| DF-1 | iOS install attribution | Revisit only if Apple provides a first-party referrer; no measurable gate exists today |
| DF-2 | Link expiry or revocation | Revisit if more than 5 joins in 30 days are removed by an organizer within a day of joining, or on owner request |

## 10. Requirements Traceability and Decision Record

GI-01: AD-1, AD-4. GI-02: AD-1, AD-2, AD-3. GI-03: AD-3. GI-04: AD-2. GI-05: AD-5, deep-links AD-8. GI-06: 5.2, 5.3. GI-07: §3, tier check. GI-08: AD-6, AD-10. GI-09: AD-7, AD-8, AD-9, AD-10, D-2. GI-10: §7. GI-11: 5.5.

**Owner decisions (2026-11-15):** existing accounts join by link; the link stays single-use, one link per invited person; the person may sign up with any email; app and web both; Android install visibility through the Play install referrer, iOS not tracked; data stored in the database only for now; links do not expire; the inviter is recorded.

**Architect decisions (owner may overturn):** confirm screen instead of joining on tap (AD-4); a separate join endpoint with the token in the body (AD-1); one neutral failure answer (AD-2); an existing member's token stays unused, and a used token never joins twice (AD-3); a separate attribution code because the token is the table's only identifier (AD-7); attribution recorded at sign-up and resolved at join (AD-10); no board (D-1); one Google library on Android (D-2).

## Changelog

| Version | Date | Change |
|---|---|---|
| v1.0 | 2026-11-15 | Initial, from the elicitation of 2026-11-15. Approved by the owner the same day. Closes deep-links OI-8. |
| v1.0.1 | 2026-11-15 | Write-back of the Task 1.1 and 3.1 reports (meetup PR 248, meetup-mobile PR 122). AD-2 error code; AD-5 web token storage; AD-7 code shape; AD-8 Play Store link added to the signed-out web page, Android browsers only; AD-9 social callback; 5.2 migration ids and label keys. No owner decision changed. |
