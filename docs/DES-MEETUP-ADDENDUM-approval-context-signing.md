# DES-MEETUP-ADDENDUM-approval-context-signing

| Field | Value |
|---|---|
| Doc ID | DES-MEETUP-ADDENDUM-approval-context-signing |
| Version | v1.0 |
| Status | APPROVED (architect approval 2026-10-02) |
| Current tier | T1 |
| Principles | Enterprise Design Principles v1.0 (P1-P17); design-best-practices v1.0 (BP-01 to BP-13) |
| Modifies | Nothing in DES-MEETUP.md by text. It supplements the dual-admin approval design (the ApprovalExecutionContext verification) by defining how an endpoint trusts that context. The implementer verifies the section numbers (BP-01) |
| Platforms | Backend and the admin frontend (`~/meetup`, Claude Code) |
| Requirements basis | The implementer's forged-header finding of 2026-10-02 and the architect decisions D1-D6 (§1) |

## Decision summary (plain language)

1. A gated destructive action (deleting a user, group, team, event or tournament) must prove it really went through the approval flow: a second admin approved it and the one-time code was checked.
2. Today an endpoint trusts a plain, unsigned header. Any single admin can write that header by hand and delete things alone. This was demonstrated on the test database (a user and a group were deleted).
3. The fix: only the server can create the header, by signing it after the real approval checks pass. Every gated endpoint verifies the signature with one shared helper. A hand-made header is rejected.
4. This covers every gated endpoint, not just user deletion. The admin Delete button for users also switches to the approval flow.
5. No database change. The signing key is a new server secret.

## 1. Context and decisions

Facts (from the implementer's report, with file names as given, to be verified):
- `get_approval_context()` in `admin/entity_management/approval/context.py` reads the `X-Approval-Context` header as plain JSON, with no signature and no database check.
- The router check compares only `target_entity_id` and `action_type`.
- The real verification (`fn_validate_execution_proof`, the one-time code, the staleness check) runs earlier in `admin/approval/service.py` `execute_request`, which then calls the endpoint over loopback.
- On the test database a single admin, sending a direct DELETE with a hand-made header, got 200 for `user_hard_delete` and for `group_hard_delete` (the group row was removed). Teams, events and tournaments copy the same check and are expected to be affected.
- The nine earlier tests of the user-delete gate never forged a header, so they passed.

Threat model at T1: IN scope: a single authenticated admin acting alone, which is the purpose of the dual-admin gate. OUT of scope: compromise of the server process or of its signing key.

- D1 The context is server-signed (HMAC-SHA256). Rejected: a database check inside the endpoint (cannot prove the one-time code step; replayable until marked executed); removing the loopback (largest change, deferred, §3).
- D2 Scope: every gated endpoint, through one shared helper.
- D3 The signing key is configuration, and a missing or short key is a hard startup failure.
- D4 Fail closed: any invalid, missing, expired or mismatched context is rejected with 403 and a security event.
- D5 No database, RLS, trigger, function or CHECK-constraint change.
- D6 The admin Users page sends an approval request instead of calling the delete endpoint (AD-6).

## 2. Architecture decisions

**AD-1 Signed context format.** The header `X-Approval-Context` carries `base64url(payload).base64url(signature)`. The payload is canonical JSON (sorted keys, no spaces) with: `approval_request_id`, `action_type`, `target_entity_id`, `initiator_admin_id`, `approver_admin_id`, `issued_at` and `expires_at` (UTC epoch seconds), and `nonce` (16 random bytes, hex). The signature is HMAC-SHA256 of the payload bytes exactly as transmitted, with the signing key. Lifetime: `APPROVAL_CONTEXT_TTL_SECONDS` (default 60).

**AD-2 Signing.** Only the function that makes the loopback call (`execute_destructive_action` or its equivalent in `execute_request`) signs the context, and only AFTER `fn_validate_execution_proof` has passed. A signature therefore implies the approval and the one-time code were verified.

**AD-3 Verification helper.** One helper, `verify_approval_context(request, *, action_type, target_entity_id)`, replaces every read of the header. It compares the signature in constant time BEFORE using any payload field, then checks `expires_at` (5 seconds of clock skew allowed) and that `action_type` and `target_entity_id` equal the values the route expects. On any failure it raises 403 with the generic detail "Approval required" and emits one security-stream event that contains no header content, no key and no payload. No endpoint parses the header any other way. `get_approval_context()` is removed or reduced to a call to the helper.

**AD-4 Configuration.** `APPROVAL_CONTEXT_SIGNING_KEY` (base64, at least 32 bytes after decoding) and `APPROVAL_CONTEXT_TTL_SECONDS`, both added explicitly to the api service environment in compose. In any non-test environment, a missing or short key stops startup with a clear error (P1). The key and the header name are on the log denylist (P4). Tests use a fixed test key set by a fixture.

**AD-5 Replay.** An admin never sees the internal loopback header. A captured valid header could be replayed only within its lifetime and only for the same action and target. Accepted at T1; the approval row is marked executed as today.

**AD-6 Admin Users page.** `AdminUsers.tsx` must never call `DELETE /admin/users/{id}` directly. After the existing confirm step it submits the approval request through the same `DestructiveActionOverlay` pattern the other four management pages use, with its pending state and messages, and does not remove the row until the deletion is approved and executed. `DELETE /admin/users/{id}` itself requires the signed context like every other gated endpoint; a direct call without it is rejected (AD-3).

## 3. Tier and deferred decisions (BP-10)

| Deferred | Reason | Gate (upgrade when) |
|---|---|---|
| Database check in the endpoint (approved row matches action, target and command hash) | Cannot prove the one-time code step; adds a read to every gated call | The signing key is suspected leaked, or any service other than the api process can reach the loopback |
| Remove the loopback (execute directly inside `execute_request`) | Largest change; no endpoint would trust a header at all | More than 10 gated action types, or a second key-rotation incident |
| Key rotation without a restart (verify against two keys) | T1 rotates by changing the environment and restarting; in-flight approvals can be retried | Before public launch, or on any suspected key exposure |
| Strip `X-Approval-Context` from external requests at Caddy | Defence in depth; the signature already closes the hole | Any change to the reverse-proxy configuration |

## 4. Security

- The signature is verified before any payload field is used. The comparison is constant time (P9).
- The key is a server secret, never in source or committed config, injected at runtime (P10).
- Every gated action keeps the existing audit row and consequence snapshot; a rejected context also writes a security-stream event (P4).

## 5. Failure modes

- Missing or short key: the application does not start (non-test environments).
- Expired or mismatched context: 403, nothing is executed, the approval row is not marked executed by the endpoint.
- A restart while an approval is executing: the loopback call fails; the request can be retried through the approval flow.

## 6. Test requirements

Risk class: critical (credential-class control). All tests execute code. The earlier user-delete gate tests stay.

- Forged header, for EVERY gated endpoint (parametrised over the full list the implementer enumerates: users, groups, teams, events, tournaments, and any other that read the header): no header; malformed header; unsigned plain JSON (the exact attack demonstrated); wrong signature; expired context; payload tampered after signing (target or action changed); a valid signature issued for a different action; a valid signature issued for a different target. Every case returns 403 and changes nothing (for user deletion check `is_deleted`, for other entities check the row).
- The legitimate path: a second admin approves, the real approval flow executes the action exactly once; replaying the same approval is safe.
- The requester cannot approve their own request; a non-admin gets 403; an admin cannot delete themselves or another admin.
- Helper unit tests: sign and verify round trip; constant-time comparison is used; the expiry boundary (with the 5 second skew); startup failure with a missing or short key; the key and the header never appear in logs (with a log canary proving capture works).
- Red then green: run the new forged-header tests on the unfixed tree first to show they return 200 and fail, then on the fixed tree. A targeted run of the new test file for this evidence is allowed in addition to the single full run.
- Frontend, in real headless Chromium against a real uvicorn on meetup_test, signed in as admin with a second admin available: clicking Delete issues the approval request and NOT the DELETE; the pending message shows; the row stays; after the second admin approves through the existing approvals UI the user is gone.
- OpenAPI before and after for the admin routes: list what changed.

## 7. Implementation phases and deployment

1. Backend: the helper, the signer, the config and startup check, every gated endpoint switched to the helper, tests.
2. Frontend: `AdminUsers.tsx` and its tests.
3. Deployment order: the architect generates a key (`openssl rand -base64 48`), adds `APPROVAL_CONTEXT_SIGNING_KEY` to `.env` on kannapi, then rebuilds the api container. Deploying without the key stops the application at startup, by design. No migration.

## 8. Principles compliance

| Principle | Element |
|---|---|
| P1 | Key and lifetime in config; startup hard failure |
| P4 | Key and header on the denylist; security events without payload |
| P9 | Server-side signature verification before use |
| P10 | Secret injected at runtime; no secret in source |
| P13 | Forged-header negative tests over every gated endpoint |
| P15 | Every gated request proves its approval cryptographically |

No deliberate deviations from either reference file.

## 9. Requirements coverage

Design-only, no R-IDs. Basis: the open critical finding `SECURITY-FINDING-user-hard-delete-gate-bypass-20260925` and the implementer's report of 2026-10-02.

## 10. Open items

- N1 Gate G1: verify every function, file and route named here against the live code before building; blocked report on any mismatch.
- N2 The architect adds `APPROVAL_CONTEXT_SIGNING_KEY` to `.env` before the deploy.
- N3 Live exposure until the deploy: on the running site any single admin can forge the header. The exposure check of 2026-09-25 found only the architect's own two admin accounts.
- N4 The other findings of the earlier branch (consequence snapshots for `event_hard_delete` and `event_capacity_bypass`) are already present on the merged tree.
