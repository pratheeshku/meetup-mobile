# DES-MEETUP-ADDENDUM-social-login

| Field | Value |
|---|---|
| Doc ID | DES-MEETUP-ADDENDUM-social-login |
| Version | v1.0 |
| Status | Approved (2026-10-07). Specified only: not implemented, not applied to any database, not externally reviewed. Ratification is the architect's call. |
| Current tier | T1 |
| Principles | Enterprise Design Principles v1.1 (P1-P17); design-best-practices v1.0 (BP-01 to BP-13) |
| Modifies | Nothing in DES-MEETUP.md text. Additive addendum. Supersedes D-TA-4 of DES-MEETUP-ADDENDUM-TERMS-ACCEPTANCE (AD-9). Reverses the 2026-10-01 iOS v1 decisions "email only, no Google" (D1). |
| Platforms | Backend + web (`~/meetup`, Claude Code); iOS app (`~/Developer/meetup-mobile`); Android app unchanged except regression. Apple Developer portal setup is human work (§11). |
| Requirements basis | Architect decisions of 2026-10-07 (D1-D7, §1). No REQ addendum (architect instruction, as for email-auth); REQ follow-ups listed in §13. |
| Schema verified against | Repo `pratheeshku/meetup` at HEAD `3fb075a`: `users/models.py`, migrations `2c76b6559821` and `895e529a8636` (provider CHECK), `users/repository.py`, `users/service.py`, `auth/router.py`, `auth/oauth.py`, `auth/local.py`, `core/config.py`, `Caddyfile`, `main.py` route order (BP-01). |

## Change log

- v1.0: Sign in with Apple (iOS native, web), Google on iOS, account linking by verified email, Apple token revocation on account deletion.

## Executive summary

1. iOS and web get **Sign in with Apple**. Android does not. Google sign-in comes back on iOS.
2. A Google or Apple login joins an existing account **only when** the provider says the email is verified, our account's email is verified (it already is: every email account verifies by OTP), and exactly one account has that email. Otherwise the login creates a separate account. There is no link or unlink screen.
3. Apple's "hide my email" address never matches an email account, so those users get their own account. This is accepted.
4. Deleting an account now revokes the Apple token at Apple and frees the login so the same person can sign up again. Today a deleted account blocks re-registration with the same provider identity (F-4, §6).
5. One new table (`auth_identities`), one migration, no RLS, no SECURITY DEFINER functions, no new trigger. Android's Google login contract is unchanged.

## 1. Scope, constraints and decisions

**Facts established from the code (not assumed):**
- `users` holds exactly one login identity per row: `oauth_provider` + `oauth_subject_id`, `UNIQUE(oauth_provider, oauth_subject_id)` (`uq_users_oauth`, a full constraint, not partial), CHECK `oauth_provider IN ('google','facebook','local')`. Email-password users are stored with `oauth_provider='local'` and `oauth_subject_id = email`.
- `users.email` has no unique constraint. Login today never merges by email: the same person can already hold a local, a Google and a Facebook account.
- Every OAuth login runs `get_user_by_oauth(provider, sub)`, which excludes soft-deleted users. A soft-deleted user's row still holds the pair, so a returning user would hit `uq_users_oauth` on insert (F-4).
- Account deletion (`users/service.py::confirm_account_deletion`) is a soft delete (`is_deleted = true`) plus session and push cleanup. It does not touch identity data.
- Every OAuth login overwrites `users.email_verified` with the provider's value (`auth/router.py`, existing-user branch).
- The mobile Google path verifies the ID token against one audience, `GOOGLE_MOBILE_CLIENT_ID`.
- `python-jose[cryptography]` and `httpx` are already dependencies. No new library is needed.
- Caddy proxies everything to the API; the SPA catch-all in `main.py` is registered last, so literal routes must be registered before it.
- New tables get explicit `GRANT ... TO meetup_app` in their own migration (no default privileges).

**Decisions (architect, 2026-10-07):**
- D1 Apple on iOS and web; none on Android. Google on iOS, Android, web. This reverses the iOS v1 decision of 2026-10-01 (email only).
- D2 A social login attaches to an existing account only on a matching verified email; otherwise a separate account. Not mandatory beyond that: no Profile link or unlink feature.
- D3 Apple private-relay addresses are not matched; those users get a separate account.
- D4 Apple tokens are revoked at account deletion (App Store 5.1.1(v)).
- D5 The Apple web setup uses the production domain `meetups.duckdns.org` as it stands.
- D6 Facebook is being removed from the web app by the architect as a separate change. Until it ships, Facebook behaves as today and is never linked.
- D7 Email registration already verifies the address by OTP; the database is cleaned before production, so legacy unverified accounts are out of scope.

**Out of scope:** Facebook removal; Apple on Android; Profile linking and unlinking; Apple server-to-server notifications (DD-2); email-change flows; fixing F-1 to F-3 (§6).

## 2. Architecture decisions

**AD-1 Identity model.** New table `auth_identities` (§5.1) is the canonical record of a user's Google and Apple identities. `users.oauth_provider` / `oauth_subject_id` stay as the record of how the account was created and keep being written exactly as today, so `local.py`, the admin views and all existing tests are untouched. Google and Apple logins resolve through `auth_identities` only; local and Facebook resolve as today. A Google-created or Apple-created user always has both a `users` pair and an identity row for that provider, so a rollback of the new code still logs them in (§11). Provider values are validated in application code (P9, P15); the table carries no CHECK, no RLS, no trigger.

**AD-2 Login resolution** (Google and Apple, in one function owned by `users/`, called by `auth/router.py`):
1. Take the lock `pg_advisory_xact_lock(hash(lower(email)))`, the same pattern `issue_otp` uses, so two concurrent first logins for one email cannot both create or both link.
2. Look up `(provider, sub)` in `auth_identities` joined to a non-deleted user. Found: log in. Stop.
3. Evaluate the link rule (AD-3). If it passes, insert the identity row with `link_method='verified_email'` and log in as that user.
4. Otherwise create a new user (provider pair on `users`, profile row, invitation and event-claim handling exactly as the existing new-user branch) and its identity row with `link_method='signup'`.
5. A unique-violation on `(provider, provider_sub)` (a lost race) is caught and the lookup in step 2 is repeated once.

**AD-3 Link rule.** All must hold, else no link (a separate account is created):
- `OAUTH_AUTO_LINK_ENABLED` is true (kill switch, default true; parse the boolean explicitly).
- The provider is Google or Apple. Facebook is never linked.
- The provider's `email_verified` is true (parsed explicitly: Apple and decoded JWTs can send the string `"true"`).
- Exactly one non-deleted `users` row has `lower(email) = lower(provider email)`.
- That row's `email_verified` is true.
- That row has no existing identity for the same provider. A different Google or Apple subject for the same email is not the same person and is never merged.

Every refusal is logged on the security stream with its reason and no email (§8). A refusal is not an error: the user is signed in to a new account.

**AD-4 Email and verified flag.** `users.email` is never overwritten by a provider. `users.email_verified` is set to true when the provider asserts true and is never lowered by a login. This replaces the current overwrite (F-5), which would let a later unverified-flagged provider response downgrade a verified account.

**AD-5 Apple verification: server-side code exchange only.** The backend never accepts an identity token from a client. For both native and web it exchanges the single-use `authorization_code` at Apple's token endpoint and uses the `id_token` returned there. The exchange is itself the freshness and replay control (a used code fails at Apple), which is why no nonce is required.
- `client_secret` is a JWT signed ES256 with the Apple key, minted per call: `iss` Team ID, `sub` the client ID, `aud` `https://appleid.apple.com`, `iat` now, `exp` now plus `APPLE_CLIENT_SECRET_TTL_SECONDS` (default 300). Because it is minted on demand, there is no six-month secret to rotate. Only the key itself (the `.p8`) is a long-lived secret.
- The returned `id_token` is verified: RS256 signature against Apple's key set (cached, refetched once on an unknown `kid`, fail closed if unreachable), `iss` = `https://appleid.apple.com`, `aud` = the client ID used, `exp`, and `sub` present. A missing `email` claim fails the login with the generic error.
- Claims used: `sub`, `email`, `email_verified`. `is_private_email` is not stored.
- The returned `refresh_token` is stored encrypted on the identity row with the client ID that issued it (AD-10). A new login replaces the stored token.

**AD-6 Apple native flow (iOS).** The app obtains the Apple `authorizationCode` (and `fullName`, given by Apple only on a user's first authorisation) and calls `POST /auth/oauth/apple/callback` with `{code, client_kind: "native", full_name?, terms_version?}`. The backend exchanges with `client_id = APPLE_BUNDLE_ID` and no `redirect_uri`. Response: the existing `TokenResponse`, unchanged.

**AD-7 Apple web flow.** It mirrors Google's hand-off so the existing SPA code, the shareable-link claims (invitation, event invite, `ref`) and the post-login handling are reused (P3).
1. `GET /auth/oauth/apple` (existing generic route, extended): generates a random state, sets it in the HttpOnly, Secure cookie `apple_oauth_state` with `SameSite=None`, `Path=/auth/oauth/apple`, 10-minute life, and redirects to Apple's authorize URL with `response_mode=form_post`, `scope=name email`, `client_id=APPLE_SERVICES_ID`, `redirect_uri=<base>/auth/oauth/apple/return`.
   `SameSite=None` is required: Apple returns by a cross-site top-level POST, and a `Lax` cookie is not sent on it (this is why the refresh-token cookie scheme cannot be reused). It is scoped to this one path and expires quickly.
2. `POST /auth/oauth/apple/return` (new, form-encoded, public): compares the form `state` with the cookie (constant time), deletes the cookie, and on success answers `303` to `<base>/#/login?code=<code>&provider=apple[&name=<name>]`. `name` comes from Apple's one-time `user` form field if present. Any mismatch, missing field, or Apple `error` redirects to `<base>/#/login?error=apple_failed` with no detail (cancellation uses `apple_cancelled`).
3. The SPA reads `code`, `provider` and `name` from the hash (the existing handler already strips the hash; it additionally reads `name`) and posts `/auth/oauth/apple/callback` with `{code, client_kind: "web", full_name?}` plus its stored pending extras. The backend exchanges with `client_id = APPLE_SERVICES_ID` and `redirect_uri = <base>/auth/oauth/apple/return`.
4. The login-CSRF weakness of the code-in-fragment hand-off is the same as Google's today (F-1) and is not widened or fixed here (DD-3).

**AD-8 Google on iOS.** The Google ID-token path is unchanged. `GOOGLE_MOBILE_CLIENT_ID` becomes a comma-separated list of accepted audiences (a single value remains valid, P14); `verify_oauth2_token` accepts a list. Whether iOS needs a second entry depends on how the iOS app configures its Google web client ID (OI-1).

**AD-9 Terms capture for social sign-up.** D-TA-4 of the Terms addendum ("OAuth signup dropped when Google and Facebook registration are removed before production") no longer holds, because social registration now ships. Decision: sign-in-wrap. The Google and Apple screens (iOS app and web) show "By continuing you agree to the Terms of Use and Privacy Policy" with both links, and every social callback sends `terms_version` using the same label and the same validation as email sign-up. The backend sets `terms_version` and `terms_accepted_at` only when a new user is created, never on an existing or linked login. The required checkbox stays on the email registration form only. Rationale: the app cannot know whether a social tap is a registration until the server answers, so a checkbox would be shown to returning users.

**AD-10 Account deletion and identity release.** A shared function in `core/identity_release.py` (raw SQL, no sibling imports; `users/` and the admin delete path both call it) does, in the same transaction as the soft delete:
1. Reads the user's identity rows that hold an encrypted provider token (needed for revocation).
2. Deletes all of the user's `auth_identities` rows.
3. Sets `users.oauth_subject_id = 'deleted:' || id` for the user (all providers, including `local` and `facebook`), which releases `uq_users_oauth` so the same person can register again (fixes F-4). `users.email` is left as is.
After the commit, the caller decrypts each stored token and calls Apple's revoke endpoint (`client_id` = the stored client ID, `token_type_hint=refresh_token`) with a bounded timeout (`APPLE_HTTP_TIMEOUT_SECONDS`, default 5). A revoke failure never blocks or rolls back the deletion (P7): it is logged on the security stream and deletion completes. The in-memory token is discarded either way (DD-1).

**AD-11 Password-reset message.** The email-auth AD-7 behaviour (an account that signs in with Google and has no password is told so) is extended: the message names every provider the account has (Google, Apple or both), read from `auth_identities`. Response shape changes only additively (P14).

**AD-12 Provider-token encryption.** `provider_refresh_token_enc` is encrypted with `MultiFernet` using `PROVIDER_TOKEN_FERNET_KEYS` (comma-separated; the first encrypts, all decrypt, so keys rotate without re-encrypting). It is a new, separate key: the existing `get_email_fernet()` falls back to a hardcoded key when its environment variable is missing, which breaks P1 (F-2), so it is not reused. Startup refuses to run with Apple enabled and no valid key (P1).

**AD-13 Provider switchboard (P1).** `OAUTH_PROVIDERS_ENABLED` (default `google,facebook`, so nothing changes until the operator sets it) replaces the three hardcoded `("google","facebook")` checks in `auth/router.py`. Apple is live only when listed. It is also the rollback switch (§11) and the later Facebook-removal switch.

**AD-14 Abuse controls (P17).** The new `return` route and the extended callback use the same limiter and values as the existing OAuth callback (20 per minute per IP). The Apple HTTP calls have explicit timeouts, no automatic retry (the user retries) and a generic failure message to the client.

**AD-15 Domain association file.** `GET /.well-known/apple-developer-domain-association.txt` returns the file Apple issues, as `text/plain`, from `APPLE_DOMAIN_ASSOCIATION_FILE` (a path; 404 when unset). It is registered before the SPA catch-all in `main.py` (the same ordering rule the version-policy endpoint required).

## 3. Deliberate deviations and deferred decisions

**Deviations (explicit, per the engagement rules):**
- **DEV-1: `Enterprise_Design_Principles.md` P6 (immutable decision context).** The link decision is recorded as `link_method` and `email_at_link` on the identity row plus a security-stream log line, not in an append-only table. The row is deleted with the account (AD-10), which P12 requires. Rationale: one low-frequency event, erasure on deletion is mandatory, and the log stream is the durable audit trail. Re-open when a requirement to prove link decisions after deletion appears.
- **DEV-2: `Enterprise_Design_Principles.md` P10 (secret rotation without restart).** `APPLE_PRIVATE_KEY` and `PROVIDER_TOKEN_FERNET_KEYS` are read at startup from the environment; rotation needs a restart until `shared_core` is ratified (DES-SHARED-CONFIG-001). This matches how every provider secret is handled today. The Apple key is not added to the R-118 rotation allowlist at this tier.
- **DEV-3: `Enterprise_Design_Principles.md` P7 hardening (circuit breaker, bulkhead).** No circuit breaker on the Apple calls. Mitigation: hard timeouts, no retries, rate limit (AD-14). Gate in DD-4.

**Deferred decisions (BP-10):**

| ID | Deferred | Gate (any one) | Upgrade |
|---|---|---|---|
| DD-1 | Durable retry of failed Apple revocations | Any `apple_revoke_failed` event in 7 days, or Apple-linked accounts above 200 | New `job_outbox` job type with retry; keep the encrypted token until it succeeds |
| DD-2 | Apple server-to-server notifications (user stops using Apple ID, deletes Apple ID) | Apple-linked accounts above 500, or the first support case about a stale Apple-revoked account | Endpoint that deactivates or deletes the matching identity |
| DD-3 | Bind the OAuth hand-off to the browser (F-1) | Before any production go-live (a go-live gate, not a metric) | Hand-off value tied to the state cookie for all providers |
| DD-4 | Circuit breaker on Apple and Google token calls | p95 token-call latency above 2 s for 10 minutes, or failure rate above 20 percent over 5 minutes | Breaker and bulkhead on the shared HTTP client |
| DD-5 | Per-client Apple tokens (one per client ID) | A user who signs in on both iOS and web leaves an un-revoked token at deletion in a support case | Separate table keyed by identity and client ID |

## 4. Components

| Component | Change |
|---|---|
| `core/apple_signin.py` (new) | Client-secret minting, token exchange, ID-token verification with cached key set, revoke. Reads config only. No mock branch: tests patch the exchange function. |
| `core/identity_release.py` (new) | AD-10 function. Raw SQL. |
| `users/models.py`, `users/repository.py`, `users/identities.py` (new) | `AuthIdentity` model, lookup, link-rule query, AD-2 resolution. |
| `auth/oauth.py` | Apple branch in the provider dispatch; Google audience list (AD-8). |
| `auth/router.py` | Provider switchboard (AD-13), resolution via `users/`, `GET /auth/oauth/apple`, `POST /auth/oauth/apple/return`, new optional body fields, email-verified rule (AD-4). |
| `auth/local.py` | Reset-message extension (AD-11) only. |
| `users/service.py` and admin user-delete service | Call `core/identity_release.py`, then revoke after commit (AD-10). |
| `main.py` | Domain association route before the SPA catch-all (AD-15). |
| `core/config.py` | Settings in §5.3, with startup validation. |
| Migration M1 (§5.1) and label seed M2 | Human-run, one at a time. |
| Web (`frontend/app.js`) | "Continue with Apple" on the login and sign-up screens (Apple branding rules), hash handler reads `name`, `error=apple_*` messages, Terms notice. Labels via the existing label system. |
| iOS app | Apple button using the platform control, Google button un-hidden on iOS, Terms notice, `Sign in with Apple` capability and entitlement. |
| Android app | No change. Apple button never rendered; regression test only. |

## 5. Data contracts

### 5.1 `auth_identities` (new, migration M1)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL | FK `users(id)` ON DELETE CASCADE; index |
| `provider` | VARCHAR(20) NOT NULL | `google` or `apple` (validated in code) |
| `provider_sub` | VARCHAR(255) NOT NULL | provider's stable subject |
| `email_at_link` | VARCHAR(255) NOT NULL | email the provider asserted when this identity was created (decision context, DEV-1) |
| `link_method` | VARCHAR(20) NOT NULL | `signup` or `verified_email` |
| `provider_client_id` | VARCHAR(255) NULL | Apple only: client ID that issued the stored token |
| `provider_refresh_token_enc` | TEXT NULL | Apple only: Fernet ciphertext (AD-12) |
| `created_at` | TIMESTAMPTZ NOT NULL | |

`UNIQUE(provider, provider_sub)`. No RLS, no trigger, no SECURITY DEFINER function, no CHECK. `GRANT SELECT, INSERT, UPDATE, DELETE ON auth_identities TO meetup_app` (DELETE is needed by AD-10). The same migration: (a) backfills one identity row (`link_method='signup'`) for every non-deleted `users` row with `oauth_provider='google'`; (b) replaces `chk_users_oauth_provider` with the same list plus `apple`. Downgrade: drops the table; it refuses to run while any `users` row has `oauth_provider='apple'` and the check list cannot be restored.

### 5.2 API

| Endpoint | Change |
|---|---|
| `GET /auth/oauth/apple` | Redirect to Apple, sets `apple_oauth_state`. Public. 404 `Unsupported OAuth provider` when Apple is not enabled. |
| `POST /auth/oauth/apple/return` | New. Form fields `code`, `state`, optional `user`, optional `error`. Public. Always a 303; never JSON. |
| `POST /auth/oauth/{provider}/callback` | New optional body fields: `client_kind` (`web` or `native`, required and validated for Apple), `full_name` (Apple only, at most 100 characters, control characters stripped, used only when the account is created), `terms_version` (Google and Apple, AD-9). Apple accepts `code` only. Request and response for Google, Facebook and Android are unchanged (P14). |
| `GET /.well-known/apple-developer-domain-association.txt` | New (AD-15). |
| Reset request | Additive message change (AD-11). |

New-account names: `display_name` = `full_name` if given, else `Player`; nickname is derived from the same seed through the existing uniqueness loop. The email local part is never used (Apple relay addresses are random).

### 5.3 Configuration (P1)

| Setting | Default | Notes |
|---|---|---|
| `OAUTH_PROVIDERS_ENABLED` | `google,facebook` | AD-13 |
| `OAUTH_AUTO_LINK_ENABLED` | `true` | AD-3 kill switch |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID` | none | required when Apple is enabled |
| `APPLE_PRIVATE_KEY` | none | secret, the `.p8` PEM; must parse as an EC P-256 key at startup |
| `APPLE_BUNDLE_ID` | none | native client ID, `org.duckdns.meetups` |
| `APPLE_SERVICES_ID` | none | web client ID |
| `APPLE_CLIENT_SECRET_TTL_SECONDS` | `300` | |
| `APPLE_HTTP_TIMEOUT_SECONDS` | `5` | |
| `APPLE_JWKS_CACHE_SECONDS` | `86400` | |
| `APPLE_AUTHORIZE_URL`, `APPLE_TOKEN_URL`, `APPLE_REVOKE_URL`, `APPLE_JWKS_URL` | Apple's published URLs | startup check: host must be `appleid.apple.com` (P1 allowlist) |
| `APPLE_DOMAIN_ASSOCIATION_FILE` | empty | path; AD-15 |
| `PROVIDER_TOKEN_FERNET_KEYS` | none | secret, AD-12 |
| `GOOGLE_MOBILE_CLIENT_ID` | existing | now comma-separated (AD-8) |

If `apple` is in `OAUTH_PROVIDERS_ENABLED` and any required Apple setting or `PROVIDER_TOKEN_FERNET_KEYS` is missing or invalid, the application refuses to start. New variables must be added explicitly to the `environment:` blocks in `docker-compose.yml` (the project does not use `env_file:`).

## 6. Security and compliance

- **Account takeover (the core risk of linking).** Linking needs three independent facts: provider-verified email, our verified email, a single match (AD-3). The pre-hijack case (an attacker registers the victim's email by email first) is blocked because the attacker's row is unverified until the OTP is entered from the victim's mailbox. Duplicates, Facebook, and a conflicting subject never link. A kill switch exists.
- **Identity tokens never trusted from clients** (AD-5); claims validated; keys cached with fail-closed (P9, P15).
- **Authorisation (P15).** All new routes are declared `public()` at the entry point; no data-store rule is relied on. P13: every route has an API-level negative test (§9).
- **Secrets (P10, P11).** Apple key and Fernet keys only from the environment; never logged; the encrypted token never leaves the database layer except into the revoke call.
- **App Store.** 4.8 is met on iOS by offering Sign in with Apple on equal terms with Google. 5.1.1(v) is met by the existing in-app deletion plus AD-10.
- **Pre-existing findings noticed during verification (not fixed here, not widened):**
  - F-1 🟡 The OAuth hand-off is not bound to the browser (`state` is the provider name; code travels in the URL fragment). Login-CSRF is possible for Google today. DD-3.
  - F-2 🟠 `notifications/email_sender.py::get_email_fernet` falls back to a hardcoded key when its environment variable is missing (P1, P10).
  - F-3 🟠 Google and Facebook enter mock mode whenever their client IDs hold the default `mock-...` values. A production `.env` that omits them silently enables code-only login. (Apple has no mock path.)
  - F-4 🟠 Fixed here: a soft-deleted account blocks re-registration with the same provider identity or local email (`uq_users_oauth`), a 500 on the second sign-up.
  - F-5 🟡 Fixed here: the login-time overwrite of `email_verified` (AD-4).
  - F-6 🟠 Open: account deletion is a soft delete and keeps PII in `users`, which the published privacy policy describes as erased (P12). This addendum removes the identity rows and the Apple token but does not change that.
- **Privacy.** The relay email is stored in `users.email` like any other. Apple names are used only at creation. The privacy policy must name Apple as a sign-in provider before submission (§11).

## 7. Failure modes

| Failure | Behaviour |
|---|---|
| Apple token endpoint down or slow | Hard timeout, generic 400 to the client, no retry, security-stream count (P7). Email and Google logins unaffected. |
| Authorization code reused or expired | Apple rejects; generic 400. |
| Apple key set unreachable | Login fails closed; cached keys keep working until expiry. |
| Revoke fails at deletion | Deletion completes; `apple_revoke_failed` logged; token discarded (DD-1). |
| Two simultaneous first logins for one email | Serialised by the advisory lock; at most one new user. |
| Lost unique-violation race on an identity | One retry of the lookup. |
| Apple enabled with bad or missing config | Application refuses to start. |
| Apple cancelled by the user | Web returns to the login page with `apple_cancelled`; the app shows nothing. |
| Provider email missing | Generic failure, never a placeholder email. |
| `apple` removed from `OAUTH_PROVIDERS_ENABLED` | Apple routes answer 404 `Unsupported OAuth provider`. Apple-created accounts keep their data but cannot sign in until Apple is re-enabled (they have no password). Rollback consequence in §11. |

## 8. Observability

Security stream (distinct from operational logs, P4), counts and reasons only, no email, token or code:
`security_event=identity_linked provider=… method=verified_email`, `identity_link_refused reason=provider_email_unverified|account_email_unverified|ambiguous_match|provider_conflict|facebook|disabled`, `apple_login_failed reason=exchange|claims|state|config`, `apple_revoke_failed`, `apple_revoke_ok`.
Every request carries the existing correlation ID. Alert on any `apple_revoke_failed` (DD-1) and on `apple_login_failed reason=config` after deploy. Auto-link volume is visible as `identity_linked` count per day.

## 9. Test requirements

Run once, not repeatedly. All at API level; there is no database backstop to disable, since this feature adds none (P13).
1. Link: verified Google email matching a verified local account links; second login resolves by identity with no email lookup.
2. Link refusals, each as its own test: provider email unverified; account email unverified; two accounts share the email; same provider with a different subject; Facebook; `OAUTH_AUTO_LINK_ENABLED=false`; case differences in email still link when allowed.
3. `email_verified` never lowered by a login; `users.email` never overwritten.
4. Apple: new account (full name used, nickname unique); returning login; private-relay email creates a separate account; missing email fails; bad `client_kind` 400; oversized or control-character `full_name` sanitised; `code` replay rejected (exchange patched to raise); claims failures (wrong `aud`, wrong `iss`, expired) each rejected; Apple disabled gives 404.
5. Web return route: valid state redirects with the code; missing or wrong state, missing cookie, and Apple `error` each redirect to `error=apple_failed|apple_cancelled` with no detail; the response is never JSON.
6. Domain association route returns the file and is not swallowed by the SPA catch-all; 404 when unset.
7. Deletion: identities removed; `oauth_subject_id` released; the same person can sign in again and gets a new account with a new `users` row (also for `local` email and Google); revoke called with the stored client ID; revoke failure does not fail deletion; a deleted user's identity never matches a login.
8. Concurrency: two parallel first logins with one email produce one user.
9. Terms: `terms_version` recorded only on creation; not on an existing or linked login; invalid label handled as in email sign-up.
10. Regression: Android Google `id_token` path and the Google and Facebook `code` paths behave exactly as before; Google audience list accepts each configured value and rejects others; reset message names Apple, Google or both.
11. Startup: Apple enabled with each required setting missing or malformed refuses to start; URL host check.
12. Migration: backfill count equals non-deleted Google users; downgrade refuses while Apple users exist.

## 10. Implementation phases

Briefs are issued per repository, never combined, and only on the architect's request.
1. **Backend** (`~/meetup`): config and startup validation, M1 and M2 migrations (written, not run), `core/` modules, `users/` identities, `auth/` changes, deletion path, route registration, tests.
2. **Web** (`~/meetup`): Apple button, return and error handling, Terms notice, labels.
3. **iOS** (`~/Developer/meetup-mobile`): capability and entitlement, Apple button, Google un-hidden, Terms notice, tests.
4. **Android**: regression run only.
5. **Human setup** (§11) happens before phase 1 can be tested live.

## 11. Deployment and rollback

**Apple Developer portal (human, prerequisites):**
1. Enable Sign in with Apple on the App ID `org.duckdns.meetups` (this regenerates the provisioning profile; do it before the next iOS build or CI signing fails).
2. Create a Services ID (the web client) grouped under that App ID as its primary App ID; set the website domain `meetups.duckdns.org` and the return URL `https://meetups.duckdns.org/auth/oauth/apple/return`.
3. Create a key with Sign in with Apple enabled; record the Key ID and Team ID; keep the `.p8` private.
4. Download Apple's domain association file; put it on the VM at the path in `APPLE_DOMAIN_ASSOCIATION_FILE`; verify the domain in the Services ID.
5. Add Apple to the privacy policy and App Store privacy answers.

**Order:** backend code with `OAUTH_PROVIDERS_ENABLED` unchanged, then migrations M1 then M2 (`alembic upgrade +1`, one at a time, human-run), verify Google and email logins unchanged, then set the Apple variables and `OAUTH_PROVIDERS_ENABLED=google,apple`, then web, then the iOS build.

**Rollback:** remove `apple` from `OAUTH_PROVIDERS_ENABLED` (Apple stops at once). Set `OAUTH_AUTO_LINK_ENABLED=false` to stop new links. The code can be reverted without losing the ability of Google and Apple-created users to sign in, because their `users` pair is still written. A user who joined only through an auto-link loses that secondary login on a code revert. Migration downgrade is blocked while Apple users exist.

## 12. Principles and practices compliance

| Item | Status |
|---|---|
| P1 | Config-driven; startup validation; URL allowlist. F-3 pre-existing. |
| P3 | Hand-off and token path reused. |
| P4 | Security stream, masking, correlation ID (§8). |
| P5 | Login idempotent; race handled by lock and retry. |
| P6 | DEV-1. |
| P7 | Timeouts, no propagation; DEV-3. |
| P9 | Input validated (`client_kind`, `full_name`, claims). |
| P10, P11 | DEV-2; no secrets in logs. |
| P12 | Identity rows erased with the account; F-6 open. |
| P13 | Negative test per rule (§9). |
| P14 | Additive only: new optional fields, new table, extended list, same responses. |
| P15 | Entry-point `public()` on every new route; no database reliance. |
| P16 | Token encrypted at application level; platform-level encryption at rest is outside this document. |
| P17 | Limiter on new routes. |
| BP-01 | Schema verified (header). |
| BP-02 | Design only; REQ follow-ups in §13. |
| BP-03 | Provider list, config names and route paths cross-checked within this document. |
| BP-06 | Cookie `SameSite=None` need and `form_post` return verified as mechanically required; no mid-transaction isolation or abort patterns used. |
| BP-07 | One grant, one grantee. |
| BP-09 | `auth_identities` is canonical for Google and Apple; `users` pair is creation record only. |
| BP-10 | DD-1 to DD-5 with gates. |
| BP-12 | Revoke without retry, no breaker, no linking UI, no S2S: simple at T1. |
| BP-13 | All 2026-10-07 decisions are written into §1. |

## 13. Requirements coverage

R-001 (Google sign-in) extends to iOS. R-002 (Facebook) is retired separately by the architect. R-112 and R-118 are unchanged (Apple key outside the rotation allowlist, DEV-2). R-269 unchanged. Follow-ups outside this document: add a requirement for Apple sign-in on iOS and web and for identity linking by verified email; amend the provider lists in REQ-MEETUP.md Part 1 assumption 3 and R-112.

## 14. Open items

- **OI-1** Confirm in `meetup-mobile` which Google client ID the iOS app uses as its web client ID; if it differs from `GOOGLE_MOBILE_CLIENT_ID`, add it to the list (AD-8). Resolved by the implementer from code, reported before the iOS phase.
- **OI-2** iOS Apple library: the implementer selects a maintained option that returns both `authorizationCode` and `fullName`; if none does, file a blocked report.
- **OI-3** Facebook removal (D6) is a separate change; this document needs no edit when it ships beyond removing `facebook` from `OAUTH_PROVIDERS_ENABLED`.
- **OI-4** Apple private relay delivers email only from senders registered with Apple. Today no email goes to social users (only sign-up and reset emails, to email accounts). If that changes, register the sender domain first.
- **OI-5** F-1, F-2, F-3, F-6 are routed as separate work items.
