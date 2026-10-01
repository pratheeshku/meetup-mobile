# DES-MEETUP-ADDENDUM-email-auth

| Field | Value |
|---|---|
| Doc ID | DES-MEETUP-ADDENDUM-email-auth |
| Version | v1.1 |
| Status | APPROVED (architect approval 2026-10-01; v1.1 approved 2026-10-01) |
| Current tier | T1 |
| Principles | Enterprise Design Principles v1.0 (P1-P17); design-best-practices v1.0 (BP-01 to BP-13) |
| Modifies | Nothing. Additive addendum to DES-MEETUP.md and DES-MEETUP-MOBILE.md; design-only, no REQ addendum (architect instruction) |
| Platforms | Backend + web (`~/meetup`, Claude Code); Android app (`~/Developer/meetup-mobile`, agy). iOS out of scope but the app flow is reusable |
| Requirements basis | Architect decisions of 2026-10-01 (D1-D9, §1) and the backend fact-finding note of the same day |

## Change log

- v1.0: email sign-up fix, verification resend, link-based password reset.
- v1.1: web router rulings (AD-6) after the implementer found the reset route unreachable when signed out; data lineage wording corrected; router and sanitizer tests added; deployment order fixed.

## Decision summary (plain language)

1. Email sign-up works in the app: email, password, display name and nickname, then a 6-digit code from the verification email, then sign in.
2. A user who misses or loses the code can request a new one (Resend), in the app and on the web. Today this is impossible.
3. Forgot password: the reset email contains a one-time link. The link opens the web reset page in the phone's browser, the user sets a new password there, then returns to the app and signs in. The existing 6-digit code stays in the email as a backup.
4. The app says the same thing whether or not an email is registered.
5. A password reset signs the user out of every session.
6. There is no deep linking. The browser handles the link.

## 1. Context and decisions

Facts from the backend note (file and line cited there): sign-up returns no tokens and emails a 6-digit code (10 minutes, 5 attempts); there is no resend endpoint and the web's "Resend code" re-posts sign-up and fails with "Email already registered"; login for an unverified account returns 403 "Email not verified"; the reset email carries only a code and no link; there is no web base URL setting; the web reset page ignores the URL.

- D1 The app signs up with `POST /auth/signup` using email, password, display_name and nickname only. It does not send invitation_token, ref, event_id or invite (shareable-link auto-join is web-only because there is no deep linking).
- D2 The mobile registration screen has no mobile number field for now; the first-run flow asks for it (DES-MEETUP-ADDENDUM-profile-onboarding).
- D3 Sign-up does not log the user in. After verification the user signs in.
- D4 A new endpoint lets an unverified user request a new verification code (AD-1).
- D5 The reset email carries a one-time link and keeps the code as a fallback (AD-2).
- D6 A new endpoint completes a reset by token; the existing reset endpoint is unchanged (AD-3).
- D7 The web reset page reads the token from the link (AD-4).
- D8 The app flows are in AD-5; the same generic messages apply on web.
- D9 Existing endpoints and their contracts are unchanged (P14).

## 2. Architecture decisions

**AD-1 Resend verification.** `POST /auth/resend-verification` with `{email}`. For an existing, local, unverified account it issues a new sign-up code with the existing rules (6 digits, 10 minutes, 5 attempts, at most 3 active unconsumed challenges, the same advisory lock). For any other email (unknown, already verified, OAuth-only, or over the active-challenge limit) it sends nothing. The response is always 200 `{"detail": "If the email needs verification, a new code has been sent."}`. Rate limit 5 per minute per IP (config). The app adds a 60-second client cooldown.

**AD-2 Reset email and token.** `POST /auth/reset-password-request` keeps its contract and generic response. For a registered local account it now also creates a token: `secrets.token_urlsafe(32)`, stored only as a SHA-256 hex digest in a new nullable column `token_hash` on the same challenge row as the code. The reset challenge lifetime is 30 minutes for both token and code (config `PASSWORD_RESET_TTL_MINUTES`, default 30); sign-up codes stay at 10 minutes. The email body has a button "Set a new password" linking to `{WEB_BASE_URL}/#reset-password?token={token}`, states that the link expires in 30 minutes and works once, and keeps the code as a fallback ("or enter this code on the reset page"). The token is the only parameter: no email address in the URL. If `WEB_BASE_URL` is not configured, the email falls back to today's code-only text and the backend logs one warning at startup.

**AD-3 Reset by token.** `POST /auth/reset-password-with-token` with `{token, new_password}`. It hashes the token, finds an unconsumed, unexpired reset challenge by `token_hash`, enforces the same password rule as today (minimum 8 characters), updates the password, marks that challenge consumed, marks every other active reset challenge for the user consumed, and revokes all the user's refresh tokens (same statement the existing endpoint uses). Success: 200 `{"detail": "Password updated"}`. Every failure (unknown, used, expired, short password, non-local user) returns 400 `{"detail": "This link is invalid or has expired."}`. Rate limit 10 per minute per IP (config).

**AD-4 Web reset page.** The existing `reset-password` hash route reads `token` from `location.hash`. When present it removes the token from the address bar immediately (`history.replaceState`), then shows a "Set new password" view with new password and confirmation (minimum 8, show/hide). On success it shows "Password updated. Return to the app and sign in" with a link to the web sign-in. On the 400 error it shows the message and a "Request a new link" button that opens the existing request view. With no token the page shows the existing request view and then the code view (the existing flow). The web "Resend code" in the verification view calls the new resend endpoint instead of re-posting sign-up.

**AD-5 App flows (Android).**
- Sign-up screen: email, password (minimum 8, show/hide), display name, nickname. Request body is exactly those four fields. On 200 go to the Verify screen. Errors from the server (400 "Email already registered", "Nickname already taken", "Password must be at least 8 characters long") show inline. "Email already registered" also offers "Sign in" and "Verify your email".
- Verify screen: shows the email, a 6-digit input, Verify, Resend (60-second cooldown, calls the resend endpoint) and Back. A failed code shows "That code didn't work. Check it or request a new one." (the server answers every failure with "Verification failed"). On success go to the login screen with "Email verified. Sign in." No auto-login.
- Login: a 403 "Email not verified" routes to the Verify screen with the email filled in. 401 shows "Invalid email or password".
- Forgot password: a "Forgot password?" link on the login screen opens an email field. Submit calls `POST /auth/reset-password-request` and always shows "If an account exists for that email, we've sent a reset link. Open it on this phone." with "Back to sign in". The link opens in the phone's browser; the app has no reset-password screen.

**AD-6 Web router (v1.1).** Fact: the web router sends every route except login, signup, event-detail and group-invite to the login page when there is no access token, so the existing `reset-password` route, and the "Forgot password?" link, have been unreachable for signed-out users. It also uses the whole hash as the route key, so `#reset-password?token=...` matches no handler. Rulings: (1) `reset-password` joins the signed-out allowlist. (2) The router ignores the `?query` part of the hash when choosing the route key. Prefer a narrow rule that applies to `reset-password` only; a general rule is acceptable only if tests prove every other route, including the shareable-link routes, resolves exactly as before. The reset page itself reads the token from `location.hash` and removes it with `history.replaceState`. (3) A signed-in user who opens the reset link also sees the reset page, with no redirect.

## 3. Tier and deferred decisions (BP-10)

| Deferred | Reason | Gate (upgrade when) |
|---|---|---|
| Equalise response time between registered and unknown emails | Rate limits already bound enumeration; timing gap accepted at T1 | Unknown-email reset requests exceed 20 per hour for 3 consecutive days |
| Password complexity rules | Unchanged policy (minimum 8) | A security review or user report requires it; separate decision |
| Opening the app from the link (deep links) | Decided out of scope | Architect approves native deep linking |
| Moving off Gmail SMTP | Free Gmail limits sending volume | Daily emails exceed 300 or any bounce or throttle is seen |
| Reset for OAuth-only users | Not requested | Architect approves converting OAuth accounts to passwords |

## 4. Components

- Backend: the two new endpoints; `issue_otp` and the reset email template extended; migration M1; config `WEB_BASE_URL` and `PASSWORD_RESET_TTL_MINUTES`.
- Web: reset page token mode; verification Resend wired to AD-1.
- App: the screens in AD-5; no new native dependency.

## 5. Data contracts

**Migration M1 (human-run, one at a time with `alembic upgrade +1`):** add `token_hash VARCHAR(64) NULL` to `email_otp_challenges` and a partial index on `token_hash` where it is not null. Names are from the fact-finding note; the implementer verifies them against live DDL (gate G1, BP-01).

| Endpoint | Change | Responses |
|---|---|---|
| `POST /auth/resend-verification` | new | 200 generic (AD-1); 429 on the rate limit; 422 on invalid email syntax |
| `POST /auth/reset-password-with-token` | new | 200 `Password updated`; 400 `This link is invalid or has expired.`; 429 |
| `POST /auth/reset-password-request` | email content only | unchanged |
| `POST /auth/reset-password`, `/auth/signup`, `/auth/verify-email`, `/auth/login` | none | unchanged |

**Config (P1; add each explicitly to the api service environment in compose):** `WEB_BASE_URL` (kannapi: `https://meetups.duckdns.org`; empty means code-only emails), `PASSWORD_RESET_TTL_MINUTES` (default 30), `RESEND_VERIFICATION_RATE` (default `5/minute`), `RESET_TOKEN_RATE` (default `10/minute`).

**Sensitive fields (logging):** `token`, `code`, `password`, `new_password` are on the log-sanitizer denylist, in request bodies, query strings, error bodies and outbox payload logs.

**Data lineage:** the plaintext token exists only in the emailed link and, until the email is sent, in the encrypted outbox payload (the same way the OTP code travels); the challenge table holds only its hash. The link is built in the api container and carried in the outbox payload, because the worker that renders the email has no new env vars.

## 6. Security

- Tokens: 256 bits, hashed at rest, single use, short-lived, never logged (P10, P4).
- Same response for registered and unknown emails on resend and reset request (P9). Timing gap deferred (§3).
- A successful reset revokes all sessions and consumes every other active reset challenge.
- The link contains only the token, and the web page removes it from the address bar on load. The URL fragment is not sent to the server.
- Rate limits at the gateway per IP plus the existing 3-active-challenge cap per email (P17).

## 7. Failure modes

- SMTP failure: the outbox retries as today; the API response is unchanged (P7).
- `WEB_BASE_URL` unset: code-only email, startup warning.
- Token reused, expired or altered: 400 with the single generic message.
- App cannot reach the server: inline error with Retry; the Resend cooldown does not start.

## 8. Observability

Existing correlation IDs on the new endpoints. Count resend and reset requests and failures as security-stream events (no email addresses beyond what existing auth events already log). No token or code in any log.

## 9. Test requirements

Risk class: high (credential recovery).

- Resend: identical 200 body for unverified, verified, unknown and OAuth-only emails; only an unverified local account gets a new code; the 4th active challenge is not created; the rate limit returns 429.
- Reset token: single use; expired token rejected; wrong or altered token rejected with the identical generic message; a short password rejected; success updates the password, revokes refresh tokens and consumes the user's other active reset challenges; the old code no longer works after a token reset.
- Email: with `WEB_BASE_URL` set the body contains the link with the token only (no email address) and the code fallback; with it unset the body is code-only.
- Contract: existing endpoints unchanged (compare the OpenAPI before and after); the new endpoints are present.
- Logs: token, code and passwords never appear in logs.
- Web (real browser): the reset page reads the token from the hash and removes it from the address bar; the new-password view; the success view; the invalid-link view with "Request a new link"; with no token the old flow works; Resend calls the new endpoint.
- App: the sign-up request body is exactly the four fields; the Verify, Resend (cooldown) and login-403 routing; the forgot-password screen shows the generic message for any email; no number field on sign-up.

- Web router: `#reset-password` and `#reset-password?token=...` reach the reset page when signed out (real browser); every other route, including login, signup, event-detail, group-invite and the authenticated routes, resolves exactly as before (a regression test over the route table).
- Sanitizer: the new token and code entries only strip echoed input and do not rewrite the 422 messages of existing endpoints.

Tests must execute the code. Run the suite once per implementation report.

## 10. Implementation phases

1. Backend: migration M1, config, endpoints, email template, sanitizer, tests.
2. Web: reset page token mode and verification Resend. Needs phase 1 deployed and migration applied.
3. App: sign-up, Verify, login routing and forgot-password screens. Resend needs phase 1 deployed; the rest can start at once.

## 11. Deployment and rollback

Order: finish the tests, one full run, push the branch, architect review, the architect applies M1 with `alembic upgrade +1`, and only then rebuild and deploy the api container (`docker compose up -d --build api`). Deploying before M1 breaks sign-up and reset, because the code writes `token_hash`. The PWA version is bumped by +1 in all four locations, and the result is verified from outside the VM. Rollback: unset `WEB_BASE_URL` (emails revert to code-only); the new endpoints and column are additive and can stay.

## 12. Principles compliance

| Principle | Element |
|---|---|
| P1 | Base URL, TTL and rate limits in config |
| P4 | Denylist covers token, code and passwords |
| P5 | Resend is safe to retry (capped active challenges) |
| P7 | SMTP failures do not fail the request; the outbox retries |
| P9 | Server-side validation; generic responses |
| P10 | Hashed single-use tokens; sessions revoked |
| P13 | §9 negative tests |
| P14 | All additive; existing contracts untouched |
| P15 | Reset proves email ownership by token or code |
| P17 | Per-IP limits plus the per-email active cap |

No deliberate deviations from either reference file.

## 13. Requirements coverage

Design-only, no R-IDs. Basis: the architect's requests of 2026-10-01 (fix mobile sign-up, add forgot password with a unique link) and the backend fact-finding note.

## 14. Open items

- N1 Gate G1: verify every table, column, function, route and file named here against the live code and DDL before building; blocked report on any mismatch.
- N2 The architect confirms the SMTP volume gate in §3 before public launch.
- N3 Declined-game data, group-card data and the web Profile photo are separate items, not part of this addendum.
- N4 The signed-out web reset route was already broken before this addendum ("Forgot password?" dead-ended at login); AD-6 fixes it.
