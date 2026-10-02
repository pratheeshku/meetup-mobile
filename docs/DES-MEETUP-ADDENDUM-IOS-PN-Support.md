# DESIGN ADDENDUM — Mobile Push Platform Support (iOS)

**Document:** DES-MEETUP-ADDENDUM-IOS-PN-Support.md
**Version:** 1.2
**Status:** APPROVED
**Approved by:** Pratheesh
**Date:** 2026-10-02
**Supersedes:** v1.1 (2026-10-02)
**Amends:** REQ-MEETUP.md R-004 (superseded by R-004.1); DES-MEETUP.md §5.16, §4.11, §14
**Authority:** this addendum is authoritative until folded into REQ-MEETUP.md / DES-MEETUP.md. It does not itself bump those documents' version numbers.
**Companion:** DES-MEETUP-ADDENDUM-IOS-App.md (mobile client)

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-02 | Original approved design: config-driven platform allowlist, CHECK dropped, platform filter removed from fan-out, iOS alert payloads, per-platform latch requirement (B7 unresolved). |
| 1.1 | 2026-10-02 | Records the implemented and merged design. Adds: per-platform credential latch (B7 resolved), worker-startup builder check (B2 clarified), compose pass-through (B2a), `apns-collapse-id` (B6), narrowed FCM-AMD test rule (B9), implementation record, live-drift record, deployment sequence, documentation reconciliation list. Adds D-3. |
| 1.2 | 2026-10-02 | Records the live deployment: the first migration attempt failed on table ownership; root cause (`MIGRATION_DATABASE_URL` unset, `meetup_app` owns no tables); successful application as `postgres` from the host virtualenv; corrected migration procedure; live-drift item closed; new open items (incomplete migration-role design, plaintext database passwords in git, mixed table ownership). |

---

## Part A — REQUIREMENTS (REQ-MEETUP.md)

**R-004 — SUPERSEDED by R-004.1.**

**R-004.1 — Mobile push platforms.**
1. The system SHALL accept mobile push-token registration for exactly the platforms enabled in configuration. Registration for any other platform value SHALL be rejected.
2. Push delivery SHALL fan out to every active registered token for each qualifying user, regardless of platform.
3. A user on iOS SHALL receive a visible system notification for every notification type, including types delivered to Android as data-only.
4. Android push behaviour, payloads and delivery SHALL be unchanged by this amendment.
5. A credential or configuration fault affecting one platform's delivery SHALL NOT suspend or degrade delivery to any other platform.
6. Missing or invalid platform configuration SHALL be a startup failure, not a silent default.

**Out of scope:** iOS notification action buttons, images and expandable layouts (D-1); client-side changes (see DES-MEETUP-ADDENDUM-IOS-App.md).

---

## Part B — DESIGN (DES-MEETUP.md §5.16, §4.11, §14)

### B1. Decision summary
Platform acceptance is a configuration concern owned by the application layer. The database stores tokens and does not validate platform values. Fan-out does not filter on platform. A credential fault is contained to the platform that caused it, unless the fault concerns the shared Google service-account credential.

### B2. Configuration (P1)
No in-code defaults. Missing, empty or invalid values fail startup.
- `MOBILE_PUSH_PLATFORMS`: comma-separated accepted platforms.
- `FCM_APNS_PRIORITY_ALERT`: APNs priority for alert pushes.
- `FCM_APNS_SOUND`: sound value in the `aps` payload.
- `FCM_FAULT_PAUSE_SECONDS` (existing, default 600): latch pause before a probe. Reused unchanged for every platform.
- The existing TTL setting is reused to derive `apns-expiration`.

**Validation placement (clarification of v1.0).**
- The API process (`main.py`) validates that the three settings are present and non-empty.
- The worker process (`worker_main.py`) additionally verifies that every configured platform has a registered message builder, and fails startup otherwise.
- The API process SHALL NOT import `notifications.mobilepushsender` (enforced by an existing test; prevents FCM credential-handling code reaching the API process). The builder check therefore lives in the worker only.

### B2a. Deployment configuration pass-through
`docker-compose.yml` SHALL forward the three settings to BOTH the `api` and `worker` services, sourced from `.env`, with no in-file defaults (`${NAME}` form), so that a missing value still fails startup.

### B3. Schema
- Drop CHECK `mobile_push_tokens_platform_check` (model constraint `chk_mobile_push_tokens_platform` removed). Column stays `VARCHAR(20) NOT NULL`.
- Unique key `(user_id, platform, device_id)`, the legacy partial index and all other constraints are unchanged.
- Migration `e5f607182301`. Downgrade refuses to run if any row has a platform the old constraint would reject.
- No RLS, grant or policy changes. No new database validation.

### B4. Registration (API boundary, P9)
`MobilePushTokenRegisterRequest` validates `platform` against the configured list. The `("android",)` literal and the "'ios' deferred" message are removed. `device_id` handling is unchanged; the client is responsible for a stable, non-empty value.

### B5. Fan-out (§4.11)
`fn_materialize_deliveries`: the predicate `AND t.platform = 'android'` is removed from the FCM branch (migration `f6a7b8c9d012`, `CREATE OR REPLACE`). Nothing else changes. EXECUTE remains granted solely to the worker login role.

### B6. Sender (`mobilepushsender.py`)
- The worker passes the token's platform into the message builder; a builder registry maps platform to builder.
- **Android:** output is byte-identical to the previous implementation for every notification type, including data-only handling of `event_participant_added` and `event_participant_removed` (verified by golden tests across all 15 types and 60 type/tag/priority combinations).
- **iOS:**
  - Always includes the top-level `notification {title, body}`, including for the two Android data-only types.
  - Retains the `data` block; omits the `android` block.
  - `apns` headers: `apns-push-type: alert`, `apns-priority` from config, `apns-expiration` derived from the TTL; payload `aps` with `sound` from config; no badge.
  - `apns-collapse-id` is set to the existing message tag when a tag is present, mirroring Android's `android.notification.tag` collapse. APNs limits collapse ids to 64 bytes; the longest real tag is 57 bytes. A tag over 64 bytes makes the message invalid (fail closed). It is never truncated.
- Token lifecycle: error classification and deactivation are platform-agnostic and unchanged.

### B7. Per-platform credential latch (resolves v1.0 open item)
**Problem confirmed in code:** a single latch covered the whole `fcm` channel, so a `THIRD_PARTY_AUTH_ERROR` from one iOS token (missing or invalid APNs key) paused all FCM claims and released in-flight Android deliveries. This violated R-004.1 item 5.

**Design (implemented):**
1. One latch per platform, created at startup from `MOBILE_PUSH_PLATFORMS`. No hardcoded platform names. A token whose platform is no longer in configuration gets its own latch on first use, so its faults stay isolated.
2. Fault scope:

| Code | Source | Scope |
|---|---|---|
| `fcm_third_party_auth_error` | response classification | platform |
| `fcm_sender_id_mismatch_trip` | after 5 consecutive, counted per platform | platform |
| `fcm_unauthenticated` (401) | response classification | global |
| `fcm_permission_denied` (403) | response classification | global |
| `fcm_credential_refresh_failed` | non-retryable refresh error | global |
| `fcm_not_initialised` | no runtime exists (no latch to arm) | global |
| any unknown future code | default | global |

3. A platform-scoped fault arms only that platform's latch. A global fault arms every platform latch, so all sending stops, as before this change.
4. Claiming: with no platform paused, the claim query is unchanged. When a platform is paused or probing, the query LEFT JOINs `mobile_push_tokens` on its primary key and excludes only deliveries whose token platform is paused (`platform IS NULL OR platform NOT IN (excluded)`), locking with `FOR UPDATE OF notification_deliveries SKIP LOCKED`. Rows with no token are still claimed (they end as `token_removed`). A probing platform claims exactly one row through a separate single-row query. Cost: one primary-key lookup per candidate row, only while a platform is paused.
5. In-flight rows are checked per row against their own platform's latch; only the paused platform's rows are released.
6. Reset: the existing mechanism is unchanged and applies identically to every latch. After `FCM_FAULT_PAUSE_SECONDS` the latch allows one probe delivery; a successful send clears it; another credential fault re-arms it. A worker restart also clears it.
7. The fault log line includes the platform. Level remains ERROR (not CRITICAL). The alert text says "restart worker", which is accurate but incomplete because recovery is also automatic. Unchanged.

### B8. Architecture decisions
- **AD-iOS-1:** the DB CHECK is removed; the application layer owns platform validation (P1, BP-12). This reduces database defence in depth by design.
- **AD-iOS-2:** fan-out has no platform filter (option A). Accepted consequence: if a platform is removed from configuration, its already-registered tokens keep receiving pushes until deactivated.
- **AD-iOS-3:** the Android path is frozen; changes are additive (P14).
- **AD-iOS-4:** credential faults are contained per platform; shared-credential faults stop everything (P7).
- **AD-iOS-5:** the new settings are forwarded to both containers with no defaults, so a missing value fails startup (P1).
- **Deviation from `design-best-practices.md` or `Enterprise_Design_Principles`:** none.

### B9. Tests
- Registration: configured platforms succeed; unlisted values return 422; empty or invalid configuration fails startup.
- Android message construction: golden-output regression for every notification type.
- iOS message construction: all types carry `notification` and `apns`, with no `android` block; `apns-collapse-id` present when a tag exists and absent otherwise.
- Fan-out: mixed Android and iOS tokens for one user yield one delivery per active token.
- Latch: iOS fault leaves Android sending, and the reverse; a global fault pauses all; the sender-id-mismatch threshold is counted per platform; only the paused platform's in-flight rows are released; the latch set follows configuration; reset behaviour is identical per platform.
- Compose: `docker-compose.yml` forwards all three settings to both services.
- **FCM-AMD hygiene test (narrowed):** the existing rule that `api` carries no FCM-related settings now allows only the two non-secret `FCM_APNS_*` lines, because the API validates them at startup. Credentials and sender code remain worker-only.

---

## Part C — DEFERRED DECISIONS (measurable gates)

- **D-1 iOS rich notifications** (action buttons, images, categories). Gate: more than 20 active iOS tokens, or an explicit product requirement. Upgrade: add `aps.category` and a service extension, scoped separately.
- **D-2 Handling of tokens for a platform removed from configuration.** Gate: more than 25 active tokens for a platform absent from configuration at any time, or any such token active for more than 14 days. Upgrade: a startup deactivation sweep, or a platform-parameterised fan-out.
- **D-3 iOS entry in `GET /app/version-policy`.** Currently returns Android only. Gate: before the first public App Store release. Upgrade: additive iOS entry (minimum version, store URL); the iOS client skips the gate while the entry is absent.

---

## Part D — IMPLEMENTATION RECORD

- **Branch:** `feat/ios-push-platform-support`, merged to `main` and pushed 2026-10-02 (`main` tip `c3fbb13`).
- **Commits:** `87fae1b` (platform support), `a710cee` (alembic head pin), `6ac8690` (reports), `2702886` (status reports and negative display tests), `f8b1664` (per-platform latch, collapse-id, compose pass-through).
- **Migrations:** `e5f607182301` (drop platform CHECK), `f6a7b8c9d012` (fan-out without platform filter). Single alembic head `f6a7b8c9d012` confirmed after merge.
- **Applied to live on 2026-10-02:** both migrations and the three `.env` settings (see Part F).

## Part E — LIVE DATABASE DRIFT RECORD (2026-10-02)

- `notifications.fn_materialize_deliveries` on live was changed outside alembic, between 11:40 and about 13:40 +08, to the `f6a7b8c9d012` body. It is the only catalog object newer than the last alembic run. Actor unattributed: `log_statement` is `none` and no audit extension is installed. Concurrent code changes on the host are the probable cause.
- Read-only comparison against `meetup_test` found no other new drift. Four older unexplained items exist and do not affect the pending migrations: `check_event_organizer` and `check_group_membership` lack `COALESCE` (no runtime effect on PostgreSQL 17); `fn_expire_request` lacks EXECUTE for `meetup_worker_login` on live; the three notification-history functions are owned by `meetup_worker_login` (matches the 2026-09-23 repair and is intended).
- Applying `e5f607182301` and `f6a7b8c9d012` was assessed safe.
- **Resolved 2026-10-02:** applying `f6a7b8c9d012` re-applied the identical function body; the live function and `alembic_version` now agree.

## Part F — DEPLOYMENT RECORD AND PROCEDURE

**Record (2026-10-02):**
1. A pre-change database backup was taken. The merged code (`main` tip `c3fbb13`) was built, and the three settings (`MOBILE_PUSH_PLATFORMS=android,ios`, `FCM_APNS_PRIORITY_ALERT=10`, `FCM_APNS_SOUND=default`) were added to the live `.env`.
2. The first migration attempt, run in the `api` container, failed on `e5f607182301` with `must be owner of table mobile_push_tokens`. The transaction rolled back and `alembic_version` stayed `d4e5f6071823`. The deploy sequence had no stop-on-error, so the api and worker restarted on the new code against the old schema for a short period. Android was unaffected: the api was healthy, and the worker and api logs showed no FCM fault, error or traceback lines.
3. **Root cause:** `MIGRATION_DATABASE_URL` is unset in the live `.env`, so migrations fell back to `DATABASE_URL`, which logs in as `meetup_app`. `meetup_app` owns no tables. `mobile_push_tokens` is owned by `meetup_migrator` (41 tables were transferred by `fef19e6bdd27`), and `fn_materialize_deliveries` is owned by `postgres`.
4. Both migrations were then applied from the host virtualenv as `postgres`: `e5f607182301`, then `f6a7b8c9d012`. Verified: `alembic current` is `f6a7b8c9d012`; the platform CHECK no longer exists; `fn_materialize_deliveries` is owned by `postgres` with its body hash unchanged.
5. No container restart was needed after the migration.

**Procedure (corrected):** migrations run from the host as `postgres`, using the host virtualenv, with `MIGRATION_DATABASE_URL` unset. Print the connection role, host, port and database (never the password) before applying, and run each step individually or with stop-on-error. Do not run migrations in the `api` container as `meetup_app`, and do not hand-apply SQL.

**Still to do:** upload the APNs authentication key in Firebase before the first iOS device test; confirm that a real Android push arrives after the deployment (unconfirmed at the time of writing).

**Rollback:** restore the previous images. Do not run `alembic downgrade`. The dropped CHECK is harmless to older code.

---

## Part G — CONSISTENCY CHECKS AND OPEN ITEMS

**Statements to reconcile (BP-03, BP-09, BP-13):**
- REQ-MEETUP.md: R-026 note (superseded, iOS push via native app); Non-Goals "Native iOS app — deferred"; Open Questions "iOS push delivery in v1".
- DES-MEETUP.md: §5.16 "native iOS deferred… additive CHECK widening"; §9669 (P5 hardening) FCM collapse via `android.notification.tag` (extend to iOS `apns-collapse-id`); §14 "adapter contract is FCM-specific. iOS token format deferred".
- DES-MEETUP-ADDENDUM-dashboard.md line 11 ("iOS out of scope"); shutlr-coverage-check-2026-09-27.md line 26.

**Open items:**
1. `mobilepushsender.py` declares `platform: str = "android"` as a default parameter (three places). Harmless because delivery passes the token's platform, but it is a hardcoded default; remove it in a follow-up so an omission fails loudly.
2. Pre-existing, unrelated to this change: `test_the_real_application_refuses_to_start_without_the_key_and_starts_with_it` fails on `main` in the host workspace because the host `.env` contains `APPROVAL_CONTEXT_SIGNING_KEY`; `test_header_icon_web.py` has a teardown deadlock that errors on `main` and on this branch. Both make the suite non-deterministic (P8).
3. `fn_expire_request` lacks EXECUTE for `meetup_worker_login` on live; confirm whether admin approval requests are expiring.
4. `meetup_test` carries pre-amendment definitions of `fn_register_mobile_push_token` and `fn_register_push_subscription` and lacks two partial indexes; rebuild it from the migrations.
5. Optional: enable `log_statement = 'ddl'` with a user/database prefix so out-of-band DDL can be attributed in future.
6. The migration-role design is incomplete. `meetup_migrator` owns 41 tables, but it cannot run migrations that replace `postgres`-owned functions, and giving it that ownership would reintroduce the RLS regression reverted by `1cbad165523f` (it has no BYPASSRLS). Every migration in the project's history has run as `postgres`. Decide whether to finish or retire the role, and document the real procedure in `CLAUDE.md`.
7. Plaintext database passwords remain in git: `docker-compose.yml` (the `postgres` password and the `meetup_app` password, twice), `tests/conftest.py` and `scripts/run_migrations.py`; older `alembic.ini` credentials remain in history (`ff39484`, `c1b1692`, `8d9927a`). Move them to `.env` and rotate (P10), as a planned task and not during a deployment.
8. Five tables created after `fef19e6bdd27` are owned by `postgres`, not `meetup_migrator`: `apscheduler_jobs`, `event_reminder_dispatch_log`, `group_invitations`, `pii_access_log`, `user_photo_reports`. Resolve together with item 6.
9. The deployment sequence must stop on the first error. Run steps individually or with stop-on-error.
