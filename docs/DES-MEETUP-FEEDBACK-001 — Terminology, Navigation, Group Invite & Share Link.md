# DES-MEETUP-FEEDBACK-001 — Terminology, Navigation, Group Invite & Share Link

Oct 5, 2026 · @Pratheesh

## Document Control

| Field | Value |
| --- | --- |
| Doc ID | DES-MEETUP-FEEDBACK-001 |
| Version | v1.0 |
| Status | APPROVED (on the owner's instruction, 2026-10-05) |
| Document type | Lightweight design: scoped change to existing Meetup/Shuttlr apps |
| Tier | T1 (T1 posture per best-practices BP-05 and BP-12) |
| Principles baseline | Enterprise\_Design\_Principles.md v1.1 (P1–P17) |
| Practices baseline | design-best-practices.md v1.0 (BP-01–BP-13) |
| Pre-draft gate | Both reference files found in the Project knowledge base and read in full |
| Deviations | None. Two deferred decisions named in the Architecture Decisions section |

## Executive Summary

Five changes make the app consistent and easier to use. All customer-facing text will use one glossary, all of it editable from the admin console, and "event" becomes "game" everywhere customers see it.

1. **Consistent terminology:** one canonical term per concept across every customer-facing channel (app screens, errors, push, email, store listing, public pages).
2. **Return to dashboard:** every completed state-changing action returns the user to the dashboard with a success message.
3. **Two-step group creation:** step 1 creates the group; step 2 (optional, skippable) invites members, with up to 5 suggested group members drawn from the caller's own groups.
4. **Share link:** shared links point to the app store (iOS or Android by platform) and ask the recipient to download the app.
5. **Label coverage:** every customer-facing string, call-to-action text included, resolves from the admin-editable label store.

No schema-breaking change, no new infrastructure. One new read endpoint (suggestions) is added, with authorisation enforced in the application (P15).

## Scope & Constraints

Scope covers the Android and iOS apps, the backend APIs they call, and the admin label console. Source of the requirements is feedback from a friend of the owner, refined in the elicitation session of 2026-10-05.

**In scope**

- Glossary and label coverage across all customer-facing channels.
- Post-action navigation to the dashboard.
- Two-step group creation and a suggested-members endpoint.
- App-store share link.

**Out of scope**

- Admin console wording (not customer-facing).
- Renaming internal table, column, API or code identifiers (P14).
- Rewriting user-generated content, such as a group named "Sunday Event".
- Deep-link-after-install (deferred, see Architecture Decisions).
- Admin editing of push and email template text (deferred).

**Constraints**

- Labels edited in the admin console take effect immediately, with no maker/checker (existing decision).
- Authorisation is enforced in the application, never left to the database (P15 v1.1).
- Schema and API changes are additive only (P14).
- The suggested-members add action reuses the existing add-member behaviour unchanged.
- Both iOS and Android must be supported for the share link.

## Architecture Decisions

Every decision below follows the T1 posture: use the simplest mechanism that meets the requirement (BP-12). There are no deviations from either reference file.

| ID | Decision | Rationale | Rejected alternative |
| --- | --- | --- | --- |
| AD-1 | Terminology is enforced through one versioned glossary, the admin-editable label store, and a CI scan. | A label-only fix drifts back. Hardcoded strings bypass the store. | One-off string cleanup with no guard. |
| AD-2 | Internal identifiers (tables, APIs, code) keep "event". | Renaming breaks consumers (P14). Customers never see them. | Full internal rename. |
| AD-3 | All state-changing flows end at the dashboard, except group step 1, which goes to step 2. | Matches the owner's rule: dashboard after each completed action. | Return to the previous screen. |
| AD-4 | Suggestions come from a dedicated read endpoint scoped in the application query. | P15 v1.1: scope in the app, never rely on the database to hide rows. | Client-side filtering. Row-level security as the only control. |
| AD-5 | Tapping a suggestion calls the existing add-member path, unchanged. | Owner decision: same behaviour as today, only the discovery source changes. | A new invite flow. |
| AD-6 | Share link is a single URL that redirects to the iOS or Android store by platform. | One link in share text. Store URLs live in config (P1). | Two links in the share text. |
| AD-7 | Every customer-facing string resolves from the label store, with a bundled default per key. | The app stays usable if the label fetch fails (P7). | Fetch-only labels with no fallback. |

**Deferred decisions (BP-10)**

| ID | Deferred | Upgrade gate | What the upgrade looks like |
| --- | --- | --- | --- |
| DD-1 | Deep link that opens the specific game or group after install. | Recipients report not finding the shared game or group in 3 or more support reports in a month, or the share-to-install conversion goal is raised as a product target. | Deferred deep linking through a link provider, with the destination carried through install. |
| DD-2 | Admin editing of push and email template text. | A template wording change needs a release, or more than 3 such releases in a quarter. | Template text moved to keyed, admin-editable templates under the same label rules. |

**Rejected review posture:** no T2+ controls (dedicated roles, execution tokens) are added. The suggestions feature exposes only data already visible to group members, so a compromised application role is out of scope at T1 (BP-05).

## Component & Integration Design

### C1. Glossary (R-01)

The glossary is the single source of customer-facing terms. It is a versioned file in the repository, owned by the project owner.

| Concept | Canonical term | Avoid |
| --- | --- | --- |
| Standalone scheduled play session | Game | Event, session |
| Fixture inside a tournament | Match | Game, fixture |
| Ongoing community of players | Group | Club, community |
| Multi-match competition | Tournament | Event, league |
| Competing unit in a tournament | Tournament team | Team (bare) |
| Person in a group | Group member | Member (bare) |
| Person joined to a standalone game | Player | Participant |
| Person on a tournament team | Team player | Player (in a match context) |

- The term follows the relationship, not the person. One user can be a group member, a team player and a game player at once. Shared UI names the relationship in play, such as "Group members (12)".
- Verbs: create and cancel for games and matches; invite for people; join and leave consistently.
- Shared screens (scoreboards, notifications) resolve the term from context (game or match), never hardcoded.
- Channels covered: app screens, error messages, push notifications, emails, store listing, public web pages.

### C2. Label coverage (R-02, R-03)

1. **Inventory:** a one-off audit lists every customer-facing string and records whether it is label-backed or hardcoded.
2. **Migration:** each hardcoded string gets a stable, additive label key, seeded with its current text corrected to the glossary. Call-to-action text is included.
3. **Bundled default:** each app release carries a default for every key. A failed fetch or a missing key shows the default, never a blank or a raw key.
4. **Refresh:** the label cache refreshes on app launch and on foreground. The cache duration is a config value (P1).
5. **Placeholders:** dynamic text is stored as a template with named placeholders, such as "Join {game}". The editor validates that placeholders are preserved.
6. **Glossary guard:** the admin editor warns on banned terms at save time. It warns and does not block, because no maker/checker is in force.
7. **CI scan:** the build fails on a hardcoded customer-facing string, a string with no label key, and a banned or bare term ("event", bare "team", bare "member"). Internal identifiers are excluded.
8. **User content:** user-generated content is never rewritten.

### C3. Post-action navigation (R-04)

- Rule: after a state-changing action succeeds, navigate to the dashboard and show a short success message, for example "Game updated".
- Applies to create, edit, cancel and group changes. Read-only navigation is unchanged.
- The dashboard refetches on return so it never shows stale data.
- On failure, stay on the form and show the error. Navigate only on success.
- Exception: group creation step 1 goes to step 2.

### C4. Group creation and suggested members (R-05 to R-08)

**Flow**

1. Step 1: the user creates the group (existing create call).
2. Step 2: the invite screen opens. It is optional and has a Skip action.
3. Skip or Done goes to the dashboard (C3).

**Suggestions**

- The section is titled "Suggested members" and shows up to 5 people.
- Candidates are members of groups where the caller is a member or admin.
- Excluded: the caller, anyone already in or invited to the new group, and blocked or deactivated users.
- Ranking: highest number of shared groups first, most recent shared activity as tie-break.
- Each card shows the user's image (placeholder if none), display name, and nickname below. If the nickname is missing, show the display name only.
- Tapping a card calls the existing add-member path. The server returns the next candidate in the same response so the list stays at 5 until the pool is empty. The client does not re-query the full list.
- The add is idempotent: a double tap never creates a duplicate (P5).

**Suggestions endpoint contract (additive)**

| Item | Specification |
| --- | --- |
| Request | Group ID of the new group. Caller identity from the token. |
| Response fields | user ID, display name, nickname, image URL. No email or mobile number. |
| Limit | Maximum 5 per response. |
| Access rule | Declared on the endpoint. Caller must be an admin of the new group. Candidate scoping applied in the application query (P15). |
| Add response | Carries the next candidate, or none when the pool is empty. |

### C5. Share link (R-09)

- A single share URL resolves to the correct store by platform: Play Store on Android, App Store on iOS, and a neutral download page on other platforms.
- The shared text asks the recipient to download the app. It carries no game or group context at this tier (see DD-1).
- Both store URLs are config values and the share text is a label (P1).

## Security & Compliance Considerations

The suggestions endpoint is the only new data path. It exposes only people who already share a group with the caller, so it adds no new visibility, provided group rosters are already visible to group members (see Open Items).

- **Authorisation (P15 v1.1):** the endpoint declares its rule in code: the caller must be an admin of the new group. Candidate scoping to the caller's groups is applied in the application query. The database is never relied on to filter or deny. Any database control is a backstop only.
- **Existing add-member path:** it must enforce its access rule at the application entry point today. The implementation phase verifies this first. If it relies on the database, that is a defect to fix before suggestions ship.
- **Data minimisation:** the payload carries user ID, display name, nickname and image URL only. No email, mobile number or other profile fields (the mobile number is admin-only by existing decision).
- **Validation (P9):** the group ID is validated against schema and caller ownership. Image URLs are served from the existing media store, not user-supplied hosts.
- **Label editor (P9):** label values are output-encoded when rendered. Placeholder names are validated against a whitelist so an edit cannot inject unexpected content.
- **Share link (P1):** the redirect targets only the two configured store URLs and the neutral page. It accepts no URL parameter as a destination, so it cannot be used as an open redirect.
- **Rate limiting (P17):** the suggestions endpoint and the add action fall under the existing gateway limits per authenticated identity. No new limit policy is introduced.

## Observability & Operability

- **Correlation (P4):** the suggestions call and the add call carry the request correlation ID across app, API and logs.
- **Log content:** log user IDs and counts only. Never log display names, nicknames, image URLs or label text values in request logs. Masking applies before logs reach central storage.
- **Security stream:** a denied suggestions request (caller not an admin of the group) is a security event in the separate security stream.
- **Metrics:** suggestions requests and p95 latency, add-from-suggestion count, empty-pool rate, label-fetch failure rate, count of keys served from bundled defaults, share-link redirects by platform.
- **Alerting (SLO-based):** alert when the label-fetch failure rate or suggestions error rate threatens the target, not on individual errors. Targets are set in config.
- **Operability:** a label edit shows in the app on next launch or foreground with no release. A glossary change is a label edit plus a glossary version bump. The CI scan blocks any release that reintroduces a banned term.

## Test Requirements

Coverage is proportional to blast radius times exploitability (P13). The suggestions endpoint and the add path are the security boundary; the rest is low risk.

| Module | Risk class | Mandatory tests |
| --- | --- | --- |
| Suggestions endpoint | Critical (security boundary) | API-level negative test: a non-admin of the group is denied, with any database backstop disabled or absent. API-level negative test: candidates never include people outside the caller's groups. Exclusion tests: caller, existing members, invited users, blocked and deactivated users. Limit test: never more than 5. |
| Add-from-suggestion | Critical | Idempotency test: a double tap creates one membership or invite. Authorisation negative test on the add path with the database backstop absent. Next-candidate backfill test, including an empty pool. |
| Label store and editor | Medium | Placeholder preservation test. Banned-term warning test. Fallback test: fetch failure shows the bundled default, never blank or a raw key. |
| Navigation rule | Low | Success returns to the dashboard with a message and fresh data. Failure stays on the form. Group step 1 goes to step 2. |
| Share link redirect | Medium | Android, iOS and other platforms each reach the right target. A parameter cannot change the destination. |
| CI terminology scan | Medium | The scan fails on a seeded banned term, a hardcoded string and a missing key. It passes on internal identifiers. |

The API regression suite gains journey tests for two-step group creation and for the dashboard return. The deployment pipeline security gates (static analysis, dependency scan, secrets detection) apply unchanged (P13).

## Risks & Mitigations

| Severity | Risk | Mitigation |
| --- | --- | --- |
| 🟠 High | The existing add-member path relies on the database for authorisation, so suggestions inherit a P15 defect. | Verify first in implementation. Fix before suggestions ship. Negative test with the backstop absent. |
| 🟠 High | A group roster is hidden from non-admins, so suggestions leak membership. | Confirm the roster visibility rule (Open Items). Apply the same visibility check in the suggestions query. |
| 🟠 High | The label store is unreachable, so the app shows blanks. | Bundled default for every key (AD-7). Fallback test. |
| 🟡 Medium | An admin reintroduces a banned term, because there is no maker/checker. | Save-time warning in the editor. Glossary version bump on change. |
| 🟡 Medium | Shared "player" and "team player" screens use the wrong term. | Resolve the term from context. Never hardcode in shared UI. CI scan flags bare terms. |
| 🟡 Medium | The dashboard shows stale data after returning. | Refetch on return. Test for it. |
| 🟡 Medium | A shared link lands the recipient on the store page with no game context. | Accepted at this tier. Gate for DD-1 is defined. |
| 🟢 Low | A missing nickname shows an awkward card. | Display name only as fallback. |

## Principles & Best-Practices Compliance

All applicable principles are met. No deviations from either reference file.

| Principle or practice | Status | Design element |
| --- | --- | --- |
| P1 Config-driven | Met | Store URLs, label cache duration, SLO targets, share text are config or labels. |
| P4 Observability | Met | Correlation IDs, masked logs, security event stream. |
| P5 Idempotency | Met | Idempotent add-from-suggestion. |
| P7 Fault isolation | Met | Bundled label defaults on fetch failure. |
| P9 Validate at every boundary | Met | Group ID and placeholder validation, output encoding, no open redirect. |
| P13 Coverage by risk | Met | API-level negative tests for every declared access rule. |
| P14 Backward compatibility | Met | Additive keys and endpoint. Internal identifiers unchanged. |
| P15 Zero trust, shift-left | Met | Access rule declared on the endpoint. Scoping in the application query. Database is a backstop only. |
| P17 Rate limiting | Met | Existing gateway limits apply. |
| P2, P3, P6, P8, P10, P11, P12, P16 | Not affected | No change to read/write separation, shared libraries, decision context, builds, secrets, passwords, retention or encryption. |
| BP-01 Verify schema | Applied at implementation | Any table or column reference is checked against the DDL before use. |
| BP-02 Requirements vs design | Met | Requirements are stated as outcomes in the coverage table. |
| BP-10 Deferred decisions | Met | DD-1 and DD-2 carry measurable gates. |
| BP-12 T1 simplicity | Met | Application-layer scoping and a CI scan, with no new infrastructure. |
| BP-13 Write back decisions | Met | All elicitation decisions are recorded in this document. |

## Requirements Coverage

Every requirement from the elicitation session maps to a design section or an explicit deferral.

| ID | Requirement | Covered by |
| --- | --- | --- |
| R-01 | One canonical term per concept across all customer-facing channels; "event" becomes "game"; match, group, tournament, tournament team, group member, player and team player as defined. | C1, AD-1, AD-2 |
| R-02 | Every customer-facing string, call-to-action text included, is editable from the admin interface. | C2, AD-7 |
| R-03 | Terminology cannot silently regress. | C2 (guard, CI scan) |
| R-04 | After each completed action the user returns to the dashboard. | C3, AD-3 |
| R-05 | Group creation is two steps: create, then optional invite. | C4 |
| R-06 | Invite step shows up to 5 suggested members from the caller's groups, refilled to 5 on each add. | C4, AD-4 |
| R-07 | Suggestion cards show image if available, display name and nickname. | C4 |
| R-08 | Adding a suggested member behaves as adding a member today. | C4, AD-5 |
| R-09 | Share link points to the app store and asks the recipient to download the app. | C5, AD-6 |
| R-10 | Admin editing of push and email template text. | DEFERRED (DD-2) |
| R-11 | Share link opens the specific game or group after install. | DEFERRED (DD-1) |

## Open Items

No blocking items. The following are verified during implementation and do not hold approval.

1. **Roster visibility assumption:** group rosters are visible to all members of the group. The owner stated there is no privacy concern on this basis. If any group hides its roster from non-admins, apply the same check in the suggestions query.
2. **Add-member authorisation:** verify the existing path enforces its access rule in the application (P15). Fix first if it does not.
3. **Nickname rules:** confirm whether nicknames can be blank. The card falls back to the display name only.
4. **Admin role names:** confirm admin, organiser and host are not used interchangeably across screens. The glossary adds a row if they are.
5. **Deferred-decision gates:** the thresholds in DD-1 and DD-2 are the architect's proposals. The owner may adjust them without a design revision.
6. **Requirement IDs:** R-IDs were assigned in this document because no separate Requirements Brief exists for these items.
