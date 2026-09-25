# Agent Enhancement Notes — 2026-09-25

## 1. Live schema auditing before writing frontend clients prevents phantom endpoint wiring

**What happened**: A multi-feature task brief requested frontend wiring for several event lifecycle actions, including an individual invite endpoint (`POST /events/{event_id}/invite-user`) and a list of edit fields including `sport`, `allow_waitlist`, `estimated_cost_cents`, and `estimated_cost_currency`. Independent live contract verification against the backend's `/openapi.json` and a live HTTP probe revealed that `invite-user` was never deployed (returned 405 Method Not Allowed) and the backend's `EventUpdate` schema accepted only a specific subset of 9 fields (`title`, `description`, `venue_name`, `venue_address`, `skill_level_requirement`, `capacity`, `starts_at`, `ends_at`, `visibility`). Halting on Gate 3 and issuing a Blocked Report allowed the user to clarify scope and unblock without writing phantom or broken client code.

**Why it matters generally**: In decoupled client-server setups, feature briefs frequently specify ideal or anticipated API designs that may still be in progress, pending deployment, or shaped differently by backend schema constraints. Writing client forms or API layers against unverified brief specifications risks silent 405/422/500 errors in production that require refactoring both the API types and UI state machines.

**Suggested addition** (target: "Contract verification"): When implementing new client-side API integrations, inspect the live API specification (`/openapi.json`) and run a probe against the target URL before generating types, UI inputs, or mock test fixtures. If an endpoint is absent or its schema fields diverge, resolve the discrepancy immediately rather than writing speculative client adapters.

## 2. Component mount helpers clobbering mock implementations for secondary user actions

**What happened**: A test mount helper (`mount()`) performed initial event retrieval by calling `mockGet.mockResolvedValue({ data: raw })`. Individual test cases that configured `mockGet.mockImplementation(...)` prior to calling `mount()` had their mock implementations clobbered by the helper's default `mockResolvedValue`. This caused downstream user interactions (such as opening the group invite picker, which queries `/settings/groups-owned`) to receive the event detail shape instead of the groups list, silently failing the flow.

**Why it matters generally**: Component mount helpers frequently encapsulate standard initial data fetching for common render setups. However, when a screen performs secondary data fetches during user interactions (such as dropdown population or picker loading), tests must ensure that initial mount mocks do not overwrite the handlers needed for those subsequent calls.

**Suggested addition** (target: "Testing discipline"): In screen test suites with custom mount helpers, configure secondary endpoint mocks after the component has mounted, or design mount helpers to preserve URL-specific route dispatches (`mockImplementation`) across both the initial mount and subsequent interaction phases.
