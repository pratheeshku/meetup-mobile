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
