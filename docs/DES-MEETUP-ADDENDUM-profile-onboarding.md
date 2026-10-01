# DES-MEETUP-ADDENDUM-profile-onboarding

| Field | Value |
|---|---|
| Doc ID | DES-MEETUP-ADDENDUM-profile-onboarding |
| Version | v1.3 |
| Status | APPROVED-WITH-WAIVERS (approved by architect 2026-09-29; v1.2 and v1.3 approved 2026-09-30 and 2026-10-01; waivers W1-W2 in §14) |
| Current tier | T1 |
| Principles | Enterprise Design Principles v1.0 (P1-P17); design-best-practices v1.0 (BP-01 to BP-13) |
| Modifies | Nothing. Additive addendum to DES-MEETUP.md and DES-MEETUP-MOBILE.md; design-only, no REQ addendum (architect instruction) |
| Requirements basis | Elicitation record 2026-09-29 (decisions D1-D13, §1) |
| Platforms | Backend + web (`~/meetup`, Claude Code); mobile (`~/Developer/meetup-mobile`, agy). Android only; iOS out of scope |

## Change log

- v1.0 (DRAFT): mobile number and a first-run prompt for skills and the number.
- v1.1 (APPROVED-WITH-WAIVERS): prompt widened to skills, notification preferences, mobile number and, on mobile only, profile photo; reveal confirmed as a single audited click; blockers B1 and B2 converted to waived implementation gates G1-G2; gates G3-G4 added.
- v1.2 (2026-09-30): country-code dropdown on every mobile number field, default +65, with the country list kept in a CSV file and served to web and mobile by one public endpoint.
- v1.3 (2026-10-01): database role name corrected to `meetup_app`; the default country is the first row of the list; gate results recorded (G1 clean, G3 passed, G4 conditional).

## Decision summary (plain language)

1. Users can optionally give a mobile number (any country) at registration, and change or clear it in Profile. Every number field has a country-code dropdown that defaults to +65.
2. Only platform admins can see it, one click at a time, and each view is logged. Organizers and other users never see it.
3. The number is for one thing: an admin may phone a user, outside the app, for example when they accepted an invite but did not attend.
4. Newly registered users see a one-time setup flow: sport skill levels, notification preferences, the optional mobile number (if not yet given) and, on mobile only, a profile photo. Every step has Save and Skip. Existing users never see it.
5. If anything fails, the app lets the user through. The setup screen must never lock anyone out.
6. The number is not verified and there is no OTP. It is never used for login or recovery.

## 1. Context and requirements basis

Locked decisions (all architect-approved in conversation, 2026-09-29):

- D1 Optional at registration and in Profile; international numbers; unverified; no OTP.
- D2 Purpose: admin phones users outside the system. No in-app follow-up flow or queue.
- D3 Visibility: platform admin only. Organizer reveal rejected (see AD-2).
- D4 First-run prompt for newly registered users only; blocking until Save or Skip; purpose is personalization data.
- D5 Prompt covers sport skill levels, notification preferences, the optional mobile number and, on mobile only, the profile photo. Favourite venue and other fields are deferred (§3).
- D6 Cleanup batch job is defined separately by the architect. Retention window not yet set.
- D7 Legal documents (T&C, privacy notice, consent text review) are prepared separately before launch.
- D8 Applies to web and mobile.
- D9 Existing users are excluded from the first-run prompt.
- D10 OAuth signups have no registration form, so the prompt is their capture point.
- D11 The notification step embeds the existing notification settings component; no new preference storage.
- D12 The photo step reuses the existing photo upload; mobile only, since web has no upload.
- D13 Reveal is a single click, audited; no confirmation dialog.
- D14 Every mobile number field has a country-code dropdown defaulting to +65; the list lives in a CSV file for easy maintenance (AD-9).

## 2. Architecture decisions

**AD-1 Field.** `mobile_number` is an optional, unverified E.164 string on the user profile row. Validated server-side (P9). The client builds E.164 from a country picker plus national number, but the server is the authority.

**AD-2 Visibility.** Admin only, through an audited click-to-reveal. Rejected: organizer reveal (any self-registered user can create an event, so strangers would obtain other users' numbers: harassment vector and third-party disclosure); showing the number in the admin detail payload by default (audits page opens, not real views).

**AD-3 Consent.** Setting a number requires the caller to submit the current consent version. The server validates it against config and stores version and timestamp with the number. No consent text available means the client does not offer the field.

**AD-4 First-run prompt.** A server-held flag decides whether to show it. Blocking means the user cannot reach the app until they tap Save or Skip; Skip is always available. Shown once per account across devices. Fail-open on any error. Step order: skills, notifications, mobile number, photo (mobile only); each step has its own Skip.

**AD-5 Orchestration.** The prompt reuses existing endpoints (skill levels, notification preferences, photo upload, profile update). Only one new write endpoint is added, recording completion.

**AD-6 Audit.** New append-only `pii_access_log`. It records events only: no number, no digits, no hash. (A hash of a phone number is recoverable by brute force, so it is not protective.)

**AD-7 Retention.** The number is nulled immediately on clear, on account deletion, and on consent withdrawal. A sweep (defined separately, D6) is a backstop only. Non-use is not a deletion trigger.

**AD-8 No OTP.** Deferred (§3).

**AD-9 Country codes.** The dropdown shows the ISO code and dial code (for example "SG +65"), with no emoji flags. The list comes from `data/country_codes.csv` in the backend repo (columns `iso2,name,dial_code,sort_order,enabled`). The architect maintains it by editing the file; the backend loads it at startup. One unauthenticated endpoint, `GET /public/country-codes`, returns the enabled rows in `sort_order`, so web and mobile share one list. The default country is the first row of the list: the architect keeps SG (+65) first in the CSV and the CSV order is authoritative (`DEFAULT_COUNTRY_ISO` stays in config for documentation, must match, and is not read by clients). The client builds E.164 from the chosen code and the national number; server validation and storage are unchanged (one E.164 string, no schema change). When editing a stored number, the client preselects the country from its dial code, falling back to the default when several countries share a code. If the list cannot be loaded, the number field is hidden, as with the consent text. The initial CSV is generated from the pinned `phonenumbers` metadata and reviewed by the architect.

Rejected: mandatory number (PDPA conditionality risk; breaks OAuth signup path); prompt for all existing users (owner decision); hard block on skills (personalization does not justify a lockout).

## 3. Tier and deferred decisions (BP-10)

| Deferred | Reason | Gate (upgrade when) |
|---|---|---|
| OTP verification of number | No programmatic consumer | First approved feature that consumes the number programmatically (SMS, WhatsApp, 2FA, recovery) |
| Organizer-scoped reveal | Stalking/disclosure risk at open registration | More than 10 admin follow-up calls per week for 4 consecutive weeks, or p90 admin turnaround above 48 hours |
| Masked relay or click-to-call | T2+ control | Organizer reveal is enabled, or any complaint tied to a revealed number |
| Column-level encryption | Volume-level encryption is the T1 posture (BP-12) | Number becomes an authentication factor |
| Favourite venue and other prompt fields | No approved purpose or data model (venue entity unverified) | Each new field needs its own approved purpose, data model and consent review |
| Completed-flow version number (prompt new steps to existing users) | Existing users are excluded (D9) | First approved step that must also reach existing users |
| PII cleanup sweep and dormancy window | Defined separately by architect (D6) | Must exist before Play public release. Dormancy window (24 months suggested, not a legal figure) is an open item |

No-regret confirmation: all changes are additive (P14). Adding OTP later needs a `mobile_verified_at` column and a flow, with no rework of this design.

## 4. Components

### 4.1 Backend
- Registration and profile-update endpoints accept `mobile_number` and `mobile_consent_version` (additive).
- `GET /users/me` returns `mobile_number` (owner only) and `onboarding_required`.
- `POST /users/me/onboarding/complete`: idempotent; sets `onboarding_completed_at = now()` only if NULL.
- `GET /public/consent/mobile-number`: unauthenticated; returns current consent version and text from config. Falls under the existing `/public/*` rate limit.
- `GET /public/country-codes`: unauthenticated; static non-PII list from the CSV (AD-9); same rate limit.
- `POST /admin/users/{user_id}/mobile-number/reveal`: admin only; returns the number and writes the audit row in the same transaction.
- Response-model allowlist: `mobile_number` may appear only in the owner's `/users/me` and the admin reveal response. It must not appear in user search, participant lists, invitations, organizer views, admin list or detail, any `/public/*` payload, notifications, or error bodies.

### 4.2 Web
- Registration form: optional number field with the country-code dropdown (AD-9) and the consent text.
- Profile settings: view, change, clear.
- First-run modal: skills, notification preferences (existing settings component), then optional number (only if none stored). Each step has Save and Skip. No photo step on web.
- Admin user detail: "Reveal mobile number" button, shown next to display name, nickname and email so the admin can confirm identity before calling.

### 4.3 Mobile (Android)
- Registration screen and Profile screen: same field, picker and consent text as web.
- First-run full-screen interstitial: skills, notification preferences (existing component, with a device-permission banner only when permission is not granted), mobile number (only if none stored), then profile photo via the existing upload. Each step has Skip; hardware back does not dismiss it.
- Skill-level writes use the existing live endpoints. No admin UI on mobile.

## 5. Data contracts

**Schema additions** (names on existing tables are UNVERIFIED against live DDL; see §14, BP-01):

`user_profiles` (verify table name):
- `mobile_number` TEXT NULL, CHECK `mobile_number ~ '^\+[1-9][0-9]{6,14}$'`
- `mobile_consent_version` TEXT NULL
- `mobile_consent_at` TIMESTAMPTZ NULL
- `onboarding_completed_at` TIMESTAMPTZ NULL
- CHECK `(mobile_number IS NULL) = (mobile_consent_at IS NULL) AND (mobile_number IS NULL) = (mobile_consent_version IS NULL)` (number present if and only if consent recorded)

`pii_access_log` (new, append-only):
`id` UUID PK, `occurred_at` TIMESTAMPTZ NOT NULL, `actor_user_id` UUID NOT NULL, `actor_role` TEXT NOT NULL, `subject_user_id` UUID NOT NULL, `field` TEXT NOT NULL (`mobile_number`), `action` TEXT NOT NULL CHECK IN (`set`,`change`,`clear`,`admin_reveal`), `correlation_id` TEXT. Application role holds INSERT only; no UPDATE or DELETE grant. Follow the existing append-only audit pattern for RLS.

**Function** `fn_admin_reveal_mobile_number(p_subject UUID) RETURNS TEXT`: SECURITY DEFINER; verifies admin from the same transaction-local context used by existing admin functions; selects the number; inserts the `pii_access_log` row; returns text only. Grantee: `meetup_app` only. Must be proven to work under FORCE RLS as the real application role (a prior guard failed exactly here, see v1.70/v1.71 history). If it cannot, file a blocked report; do not widen any RLS policy.

**API summary**

| Endpoint | Change | Errors |
|---|---|---|
| registration (existing; verify path) | optional `mobile_number`, `mobile_consent_version` | 422 invalid number; 409 `consent_version_stale` |
| profile update (existing; verify path) | `mobile_number: string \| null`. Absent = unchanged; null = clear (also nulls consent columns) | same |
| `GET /users/me` | adds `mobile_number`, `onboarding_required` | none new |
| `POST /users/me/onboarding/complete` | new, idempotent | none |
| `GET /public/consent/mobile-number` | new, unauthenticated | none |
| `GET /public/country-codes` | new, unauthenticated, static list (AD-9) | none |
| `POST /admin/users/{user_id}/mobile-number/reveal` | new | 403 non-admin (security-stream event); 404 `no_mobile_number` |

**Validation:** server parses with a phone-number library (`phonenumbers`, pinned exact version), requires leading `+`, strips spaces and dashes before parsing, requires a valid number, stores normalized E.164. Client uses `libphonenumber-js` (pinned) for the picker only. The 422 body must not echo the submitted value.

**Config keys (P1):** `MOBILE_CONSENT_VERSION` (default `mobile-consent-v1`), `MOBILE_CONSENT_TEXT`, `ONBOARDING_PROMPT_ENABLED` (kill switch; false makes `onboarding_required` always false), `DEFAULT_COUNTRY_ISO` (default `SG`).

Default consent text v1 (subject to legal review, D7): "Optional. Meetup administrators may call you on this number if, for example, you accept an event invitation but do not attend. It is not shown to other users. You can remove it at any time in Profile."

**Sensitive fields (governs logging):** `mobile_number` (PII).

**Data lineage (each field has one source; any other source is a bug)**

| Field | Sole source |
|---|---|
| number stored | `user_profiles.mobile_number` |
| `onboarding_required` | `onboarding_completed_at IS NULL` and `ONBOARDING_PROMPT_ENABLED` |
| consent version required | config `MOBILE_CONSENT_VERSION` |
| consent text shown to users | `GET /public/consent/mobile-number` (clients never hardcode it) |

## 6. Security

- Authorization is checked per request (P15). Owner-only read and write of own number; admin-only reveal.
- Reveal is not gated by the dual-admin flow (reads are not destructive). It is audited instead.
- P9: server-side validation; parameterized queries only.
- The two open findings (`DELETE /admin/users/{user_id}` gate bypass and the `AdminUsers.tsx` frontend twin) must close before public launch, so a weak admin path cannot expose numbers. Tracked separately, not fixed here.
- Encryption at rest (P16): inherits the platform posture. See §14 for verification.

## 7. Failure modes

- Consent endpoint fails: client hides the number field; registration proceeds without it.
- Country list fails to load: the number field is hidden; registration and profile proceed without it.
- `GET /users/me` fails or times out: client treats `onboarding_required` as false. Never block.
- Save fails inside the prompt: inline error; Skip stays available.
- Complete call fails: dismiss locally for the session; prompt reappears at next launch (flag still NULL).
- Reveal for a user with no number: 404, still audited.
- Photo upload fails: inline error; Skip stays available.
- Gate G3 or G4 not passed: that step is omitted from the flow.
- Audit insert failure: the reveal fails and returns no number (atomic, same transaction).
- Dead-man detection: not applicable (no scheduled job in this addendum).

## 8. Observability

- `mobile_number` is added to the log-sanitizer denylist (P4). Request bodies, 422 bodies and exception traces must not contain it.
- Admin reveal denials go to the security-event stream. Correlation ID on every new endpoint.
- Log counts only, never values.

## 9. Test requirements

Risk class: high for reveal, response allowlist and validation; medium for prompt behaviour.

Mandated negative tests:
- Non-admin and organizer calling reveal get 403; user A cannot read user B's number through any endpoint.
- Contract test enumerates every response model and asserts `mobile_number` appears only in the two allowed places.
- Reveal function proven under RLS as the real application role.
- Invalid numbers rejected: no `+`, letters, too short, too long, non-E.164.
- Setting a number without the current consent version returns 409.
- Clearing nulls all three columns; the CHECK constraint rejects a number without consent.
- Log test: number absent from logs on register, update and 422.
- Complete endpoint idempotent; existing users backfilled and never prompted; OAuth signup prompted.
- Fail-open on web and mobile when `/users/me` errors.
- Web: verify the compiled `dist` bundle contains the new UI, not only the source (prior stale-bundle incident).

- Step order and per-step Skip on mobile and web; web never shows the photo step.
- Notification step renders the same component as Settings; an opted-out type produces no delivery (gate G3).
- Photo step uses the existing upload endpoint; an invalid or oversized file shows an inline error.
- Country list: CSV rows parse; disabled rows are not served; order follows sort_order; the default is +65; a malformed CSV row fails startup with a clear error; editing a stored number preselects its country; the field is hidden if the list fails to load.

Test suite is run once per implementation report.

## 10. Implementation phases

1. Backend: migrations M1-M3, endpoints, allowlist, sanitizer, tests. Acceptance: §9 backend tests pass; contract test green.
2. Web: registration field, profile field, first-run modal, admin reveal. Depends on phase 1 deployed.
3. Mobile: registration, profile, first-run interstitial. Depends on phase 1 deployed and confirmed by external curl.

Migrations (developer writes, human runs one at a time with `alembic upgrade +1`; never stamp):
- M1: add four columns, CHECK constraints, backfill `onboarding_completed_at` for all existing rows.
- M2: create `pii_access_log` with INSERT-only grants.
- M3: create `fn_admin_reveal_mobile_number` and its grant.

## 11. Deployment and rollback

Rollback is a config change: `ONBOARDING_PROMPT_ENABLED=false` hides the prompt; clients hide the number field if the consent endpoint is removed. Columns are additive, so nothing needs dropping. Web deploy requires the PWA version-constant bump. Mobile ships to Play internal testing first.

## 12. Principles compliance

| Principle | Element |
|---|---|
| P1 | Consent version and text, kill switch and default country in config; country list in a CSV file |
| P4 | Denylist masking; security-event stream for denied reveals |
| P5 | Completion endpoint idempotent by construction |
| P6 | Append-only `pii_access_log`; no PII in the record |
| P7 | Fail-open prompt; consent failure hides the field |
| P9 | Server-side E.164 validation; response allowlist |
| P10 | Single narrow function, single grantee, INSERT-only audit grants |
| P12 | Immediate nulling on clear, deletion, withdrawal. Sweep deferred (§3) |
| P13 | §9 negative tests |
| P14 | All additive |
| P15 | Per-request authorization |
| P16 | Open item, §14 |
| P17 | Existing `/public/*` limit covers the consent endpoint; reveal endpoint limit set by config default |

No deliberate deviations from either reference file.

## 13. Requirements coverage

No R-IDs (design-only). Decisions D1-D13 map: D1 to AD-1/AD-8; D2-D3 to AD-2; D4-D5, D9-D12 to AD-4/AD-5; D6 to AD-7 and §3; D7 to §14; D8 to §4; D13 to AD-2.

## 14. Open items, waivers and gates

Waivers (architect-approved 2026-09-29, replacing the pre-approval blockers B1 and B2 of v1.0):
- W1 (was B1) Live DDL cannot be checked at design time. It becomes implementation gate G1: verify every existing table, column, endpoint path and function named above against live DDL and code (BP-01), and file a blocked report on any mismatch.
- W2 (was B2) Volume-level encryption of the Postgres data volume and backups on kannapi (P16) is unconfirmed. It becomes gate G2: the architect confirms it before the migrations run in production. Any gap predates this addendum and affects all PII.

Implementation gates:
- G3 Opt-out enforcement: verify that the notification fan-out honours stored per-type preferences. If it does not, the notification step is omitted until fixed, and the defect is reported separately.
- G4 Profile photo object keys are unguessable and not enumerable under the current bucket policy. If not, the photo step is omitted until fixed.

Non-blocking:
- N1 Dormancy window and retention window for the cleanup job (architect).
- N2 In-app account deletion must null the number. The deletion flow is not built and blocks public go-live.
- N3 Privacy notice with a named data-protection contact, T&C and the Play Data Safety declaration (prepared separately).
- N4 Whether the re-platform repo re-implements this under app-layer authorization (the same predicates apply).
- Status (2026-10-01): G1 reported clean in rounds 1 and 3. G3 passed: the fan-out joins notification_preferences and skips opted-out users. G4 conditional: object keys are random (128 bits), but the bucket must also deny anonymous listing before the photo step is enabled. W2 (disk encryption on kannapi) remains with the architect.
