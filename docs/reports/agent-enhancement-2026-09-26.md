# Agent Enhancement Notes — 2026-09-26

## 1. Verifying comparative premises in task briefs before implementing divergent behavior

**What happened**: A task brief requested adding system-tray notification display handling for a new notification type (`event_reminder`) by instructing to "mirror `event_changed`'s simpler single-action pattern, NOT `group_event_created`'s dual Join/OK pattern — deliberate, see context above, don't add a second button." The brief included an explicit tripwire: "Blocked report, not invented workaround, if ... `event_changed`'s actual single-action pattern doesn't match what's assumed here." Upon inspecting the codebase, `event_changed` did not have a single-action pattern; it already used a dual-action pattern (`View` + `OK`), identical to `participantHandler.ts`. Halting immediately and raising a structured Blocked Report allowed the architect to unblock the task cleanly by ratifying Option B (confirming dual-action `View` + `OK` matching `event_changed`), ensuring that notification dismissal and navigation actions remained standardized across the notification subsystem without introducing one-off divergent button configurations.

**Why it matters generally**: Task briefs often describe comparative requirements by referencing other parts of the codebase as models (e.g., "mirror X's pattern Y"). However, the brief's mental model of X may be outdated, simplified, or factually inaccurate relative to recent commits or addenda. If an agent attempts to reconcile such contradictions autonomously by either implementing the false premise or silently ignoring the explicit negative instruction ("don't add a second button"), it risks creating architectural drift or violating explicit constraints.

**Suggested addition** (target: "Gate 3 — Task confirmation" / "Fidelity rules"): When a task brief instructs you to replicate another component's or handler's pattern, verify that reference implementation in the current codebase before writing any code. If the brief's factual claim about the reference implementation is false or contradicts another explicit instruction in the brief, treat the contradiction as a stop condition: issue a Blocked Report detailing the discrepancy and required unblocking decision rather than guessing or smoothing over the conflict.

## 2. Handling unmaintained package references in design documents

**What happened**: The design document specified `react-native-fast-image` by name. During Gate 2 dependency audit, verification against the project's modern environment (React Native 0.86, React 19) revealed that the original repository has been unmaintained since 2022 and lacks support for modern architecture. An actively maintained drop-in community fork (`@d11/react-native-fast-image`) existed providing identical API contracts and Glide caching on Android. Adopting the fork resolved compatibility while preserving all design document requirements, documented as a low-risk Proposed Assumption.

**Why it matters generally**: Mobile and web frontend ecosystems evolve rapidly, and design documents may specify library names that were standard when drafted but have since been superseded by community forks. Halting for an architect decision when an identical, drop-in replacement exists under an updated scope/namespace creates unnecessary blocking on mechanical dependency details.

**Suggested addition** (target: "Gate 2 — Dependency audit"): When an approved design document specifies an external library whose original repository is unmaintained or incompatible with the runtime version, but an actively maintained community fork exists with identical API contracts and semantics, adopt the fork, verify its compatibility in Gate 2, and document the package replacement as a numbered Proposed Assumption in the Implementation Report.

## 3. Synchronizing test fixtures when unblocking previously blocked fields

**What happened**: An earlier contract audit left `avatar_url: null` hardcoded with an explicit comment and a corresponding test asserting `expect(result.avatar_url).toBeNull()`. When the addendum provided the URL construction scheme and unblocked the field, running the test suite immediately caught the assertion failure.

**Why it matters generally**: Codebases adhering to strict contract discipline often have tests asserting that blocked, stubbed, or unsupported fields remain empty/null to prevent regression. When unblocking a field per an approved addendum, failing to inspect existing contract regression tests for that specific field leads to predictable test failures late in the cycle.

**Suggested addition** (target: "Gate 3 — Task confirmation"): When unblocking a previously blocked field or contract finding, search the test suite for existing regression assertions enforcing the blocked state (e.g., `toBeNull()`, `toBeUndefined()`) and include their updates in the planned change set.
