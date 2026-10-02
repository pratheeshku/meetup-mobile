# Agent Enhancement Note — 2026-09-27

## Reflection 1: Upfront Wire Contracts for Concurrent Agent Workstreams

- **What happened**: When frontend/mobile and backend implementations began in parallel from an addendum specification, the mobile agent reached network integration before the backend endpoint was live. While the addendum documented the route and purpose, the exact JSON field names (`group_id` vs `groupId`, `invitation_url` vs `url`) were initially unspecified until Decision 15 was formalized in v1.1.
- **Why it matters generally**: In multi-agent or parallel client-server development, verbal or summary descriptions of endpoints ("creates invite row and returns shareable URL") leave field naming to individual agent discretion. Without explicit wire schemas, agents inevitably diverge (camelCase vs snake_case, parameter names), breaking cross-platform compatibility.
- **Suggested addition**: Add to `Enterprise Design Principles / API Contracts`:
  *"Any endpoint built concurrently across separate clients or backend services must define its exact JSON wire request/response schema (field names and types) in the design document before client-side implementation commences."*

## Reflection 2: Empirical Dependency Audit via Runtime and Test Presets

- **What happened**: Common modern React Native guidance recommends installing community modules (e.g. `@react-native-clipboard/clipboard`) because core `Clipboard` was historically slated for removal. However, checking `node_modules/react-native` and `@react-native/jest-preset` revealed that `Clipboard` was still fully present, functional, and mocked out-of-the-box by the project's Jest preset, avoiding an unnecessary third-party dependency.
- **Why it matters generally**: Assuming external packages are needed based on historical framework deprecation notices without inspecting the local tree can lead to unnecessary native dependency additions, pod/gradle bloat, and CI cache invalidations.
- **Suggested addition**: Add to `Pre-code gates (Gate 2 — Dependency audit)`:
  *"Before proposing new community packages for capabilities that were historically in core (clipboard, linking, sharing), verify local `node_modules` and Jest presets empirically to confirm whether built-in support remains viable."*

## Reflection 3: Distinct Selection Callbacks for Polymorphic Search Autocompletes

- **What happened**: When extending an existing entity-search picker (`UserSearchPicker`) to support invitations to non-registered emails when zero search results are found, routing existing user selections (`POST /groups/{group_id}/invite` and `POST /events/{event_id}/invite-user`) vs non-registered email invitations (`POST /groups/invitations` and `POST /events/{event_id}/invite-email`) required distinct handling. Exposing separate callbacks (`onSelect(user)` vs `onSelectEmail(email)`) with explicit mutual exclusivity in screen state kept the existing user-selection contracts untouched while cleanly routing email invites to their dedicated endpoints.
- **Why it matters generally**: Attempting to overload a single `onSelect(result)` callback with synthetic or polymorphic payload objects (e.g. `{ id: null, email: '...' }`) forces every consumer to implement type-guard switches and risks accidental contract leakage or crashes if a consumer expects a valid registered entity model. Dedicated callbacks preserve backward compatibility and make callers' state transitions explicit.

## Reflection 4: Accessible Disambiguation for List Cards and Header Action Labels

- **What happened**: When adding filter pills (`accessibilityRole="button"`) and contextual empty states to `GroupsScreen`, test assertions using unlabelled role queries (`findByProps({ accessibilityRole: 'button' })`) collided with the new pills, and tests verifying the single header "+" button collided when `EmptyState` also declared a button with identical `actionLabel="Create Group"`. Passing `accessibilityLabel={group.name}` to `Card` and keeping empty states informational resolved both collisions cleanly.
- **Why it matters generally**: In screen compositions featuring filter bars, global header actions, and scrollable cards, relying on bare role selectors creates fragile tests that break whenever secondary actions or filter chips are introduced. Furthermore, duplicate button labels degrade screen reader experience.
- **Suggested addition**: Add to `Testing Discipline & Accessibility Guidelines`:
  *"Always assign explicit, entity-specific accessibility labels to interactive list cards (`accessibilityLabel={item.name}`). Avoid duplicating primary header CTA accessibility labels in empty states, and query elements by explicit accessibility labels rather than bare roles."*

