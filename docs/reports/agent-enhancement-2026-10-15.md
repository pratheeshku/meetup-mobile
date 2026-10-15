# Enhancement Document — 2026-10-15

## Pattern 1: Typed Mocks Behind Feature Flag for Pre-Backend Client Work
- **What happened**: Mobile implementation proceeded against an approved addendum (`DES-MEETUP-ADDENDUM-VENUE-CATALOGUE`) while backend endpoints were still unbuilt. By structuring API modules with typed mock fallbacks behind a flag gate (`venue_catalogue_enabled`), all unit tests and visual rendering verified 100% against the spec without modifying external APIs or risking regressions.
- **Why it matters generally**: Decoupled frontend/mobile development often stalls if client agents wait for backend completion or if they mock ad-hoc in every test file. Centralizing typed mocks inside the client API modules with 404/offline fallback enables end-to-end component testing and realistic local developer experience immediately.
- **Suggested addition (Pre-code gates / Architecture)**: Mandate that when working against unbuilt backend specs, client API methods provide typed mock fallback responses mirroring the schema, guarded by client feature flags or 404 interceptors.

## Pattern 2: Component Reuse Across Game and Tournament Workflows
- **What happened**: Both game wizard (`Game3When`, `EditGame2`) and tournament fixtures/schedules (`TournSched*`, `FXEdit*`) required venue selection and detail cards, but had different visual footprint requirements (e.g. 46px compact box in tournament fixtures vs full map preview in games).
- **Why it matters generally**: Creating duplicate components leads to divergence in validation logic (such as postal code validation or sport clearance). Implementing variant switches (`variant="default" | "tournament"`) within single components ensures identical data model adherence across features.
- **Suggested addition (Key Conventions)**: When designs introduce compact variations of a complex picker/card for nested modals or dense lists, prefer a single component with variant props over sibling implementations to guarantee consistent validation and data synchronization.

## Pattern 3: Strict UI Privacy and Attribution Boundaries
- **What happened**: The spec explicitly prohibited showing photo uploader attribution, caching expiring signed URLs, or exposing reporter identities during moderation reporting.
- **Why it matters generally**: Data leakage often occurs via client-side caching of short-lived signed URLs or leaking user IDs in response objects. Enforcing fresh URL retrieval on mount and keeping viewer report workflows completely neutral guarantees compliance with privacy requirements.
- **Suggested addition (Fidelity Rules)**: For user-generated content reporting and media assets with expiring signed tokens, explicitly disallow local cache persistence and prevent client-side attribution display unless explicitly required by the design doc.
