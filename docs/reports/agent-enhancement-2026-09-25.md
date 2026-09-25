# Agent Enhancement Notes — 2026-09-25

## 1. Live schema auditing before writing frontend clients prevents phantom endpoint wiring

**What happened**: A multi-feature task brief requested frontend wiring for several event lifecycle actions, including an individual invite endpoint (`POST /events/{event_id}/invite-user`) and a list of edit fields including `sport`, `allow_waitlist`, `estimated_cost_cents`, and `estimated_cost_currency`. Independent live contract verification against the backend's `/openapi.json` and a live HTTP probe revealed that `invite-user` was never deployed (returned 405 Method Not Allowed) and the backend's `EventUpdate` schema accepted only a specific subset of 9 fields (`title`, `description`, `venue_name`, `venue_address`, `skill_level_requirement`, `capacity`, `starts_at`, `ends_at`, `visibility`). Halting on Gate 3 and issuing a Blocked Report allowed the user to clarify scope and unblock without writing phantom or broken client code.

**Why it matters generally**: In decoupled client-server setups, feature briefs frequently specify ideal or anticipated API designs that may still be in progress, pending deployment, or shaped differently by backend schema constraints. Writing client forms or API layers against unverified brief specifications risks silent 405/422/500 errors in production that require refactoring both the API types and UI state machines.

**Suggested addition** (target: "Contract verification"): When implementing new client-side API integrations, inspect the live API specification (`/openapi.json`) and run a probe against the target URL before generating types, UI inputs, or mock test fixtures. If an endpoint is absent or its schema fields diverge, resolve the discrepancy immediately rather than writing speculative client adapters.

## 2. Component mount helpers clobbering mock implementations for secondary user actions

**What happened**: A test mount helper (`mount()`) performed initial event retrieval by calling `mockGet.mockResolvedValue({ data: raw })`. Individual test cases that configured `mockGet.mockImplementation(...)` prior to calling `mount()` had their mock implementations clobbered by the helper's default `mockResolvedValue`. This caused downstream user interactions (such as opening the group invite picker, which queries `/settings/groups-owned`) to receive the event detail shape instead of the groups list, silently failing the flow.

**Why it matters generally**: Component mount helpers frequently encapsulate standard initial data fetching for common render setups. However, when a screen performs secondary data fetches during user interactions (such as dropdown population or picker loading), tests must ensure that initial mount mocks do not overwrite the handlers needed for those subsequent calls.

**Suggested addition** (target: "Testing discipline"): In screen test suites with custom mount helpers, configure secondary endpoint mocks after the component has mounted, or design mount helpers to preserve URL-specific route dispatches (`mockImplementation`) across both the initial mount and subsequent interaction phases.

## 3. Strict alignment of client form schemas with backend mutation rules

**What happened**: An event edit form initially displayed immutable metadata (`visibility`) alongside editable fields, relying on backend 409 rejections. Removing immutable fields from the UI completely and aligning with the backend's current 12-field schema (`title`, `description`, `venue_name`, `venue_address`, `skill_level_requirement`, `capacity`, `starts_at`, `ends_at`, `sport`, `allow_waitlist`, `estimated_cost_cents`, `estimated_cost_currency`) matched web parity. Furthermore, proper wire serialization (converting user-entered decimal dollars to integer cents `ge=0`, uppercase 3-letter currency codes, and null-coercing empty strings) prevented FastAPI 422 validation errors.

**Why it matters generally**: Immutable fields presented as inputs create poor UX and confuse users even when disabled. Validating and transforming client input to match exact Pydantic schema constraints (e.g. cents vs. dollars, 3-char ISO currency codes) ensures that network payloads succeed on first submit and server errors are reserved for genuine business conflicts (such as 409 post-start or participant-joined locks).

**Suggested addition** (target: "Contract verification"): Distinguish between editable and immutable entity properties when designing edit forms. Never expose immutable fields as active or disabled form controls unless explicit requirements mandate informational display. Ensure monetary and enumerated fields are transformed into the backend's exact storage types (e.g., integer cents, normalized uppercase codes) prior to wire transmission.

## 4. Multi-select transition with backwards-compatible UI primitives

**What happened**: Transitioning single-select chip groups (`OptionChips`) and search pickers (`UserSearchPicker`) to multi-select required preserving existing single-choice consumer contracts across 6+ other screens. Extending `OptionChipsProps.value` to accept `T | readonly T[] | null` and checking `Array.isArray(value) ? value.includes(option.value) : option.value === value` allowed immediate multi-select highlighting without altering any other call sites.

**Why it matters generally**: Shared UI form primitives are used across many features. When one feature requires multi-select, breaking component props or replacing the component with a divergent primitive introduces unnecessary churn and regression risk. Designing primitives to support scalar or collection values transparently keeps the component library unified.

**Suggested addition** (target: "Design system & component reuse"): When introducing multi-selection to single-selection input components, extend prop types to union scalar and array values (`T | readonly T[] | null`) rather than creating separate multi-select components or breaking single-choice interfaces.


