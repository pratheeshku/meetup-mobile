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

## 4. Empirical verification of native SDK capabilities before assuming frontend workarounds

**What happened**: When tasked with adding crop/zoom/flip via `react-native-image-crop-picker`, investigation of the underlying native controllers (`TOCropViewController` on iOS and `uCrop` on Android) confirmed that both expose crop (pinch-zoom, reposition) and rotate (90-degree buttons, angle dial), but neither natively exposes horizontal or vertical flip. Verifying this directly against the native library source prevented pulling in heavyweight dependencies (`react-native-gesture-handler`, `react-native-reanimated`, plus a transform library) and enabled clean documentation for the architect's design write-back under Propose & Proceed.

**Why it matters generally**: Cross-platform wrapper libraries wrap disparate native UI controllers that frequently have feature parity gaps or omit specific transformations (like mirroring). Rather than guessing or silently pulling in heavyweight custom gesture/transform engines to emulate the missing feature in JS, inspecting the native controllers' exposed APIs and source allows the developer to cleanly isolate what is natively supported and record the limitation for architect ratification.

**Suggested addition** (target: "Gate 2 — Dependency audit / Fidelity rules"): When integrating native third-party UI modules for editing or media manipulation, inspect the underlying native platform libraries (iOS Pod / Android AAR/Gradle dependencies) to confirm what actions (crop, rotate, flip, filter) are natively supported by the platform controllers before designing or pulling in custom JavaScript fallback pipelines.

## 5. Non-interactive overlay affordances on compound interactive components

**What happened**: When adding a visual edit affordance (an edit icon overlay badge) to an existing tappable circular avatar, placing the decorative badge within the existing `Pressable` rather than introducing a nested or sibling touch target ensured that tapping either the avatar or the badge triggered the exact same action handler without redundant logic or hit-test conflicts. In addition, marking the overlay with `accessibilityElementsHidden` and `importantForAccessibility="no"` ensured that assistive technologies continue to announce the single well-labelled button action without confusing duplicate or unlabelled nodes.

**Why it matters generally**: Secondary visual cues (edit pencils, camera badges, status indicators) placed over primary pressable targets can easily introduce subtle UX bugs: nested buttons firing unexpected events, z-index tap-blocking, or screen reader announcements of extraneous unlabelled icons. Keeping overlays strictly non-interactive and internal to the parent interactive element ensures full hit-test consistency and clean accessibility trees.

**Suggested addition** (target: "Fidelity rules / Accessibility"): When adding visual affordance badges or icon overlays to existing interactive components, keep the badge strictly decorative (non-interactive) inside the existing interactive container unless the specification explicitly mandates independent interaction. Always mark purely decorative overlay icons with `accessibilityElementsHidden` and `importantForAccessibility="no"` so accessibility labels on the parent component remain the single source of truth.

## 6. Scoping negative test assertions to container nodes when introducing new read-only fields

**What happened**: When adding a new "Visibility" row to the read-only "Event Details" card on `EventDetailScreen`, an existing regression test asserting that the edit form does not expose visibility (`it('does not render visibility in edit form (immutable post-creation)')`) failed. The test originally used a global screen-wide string assertion (`expect(has(root, 'Visibility')).toBe(false)`). Because `EventDetailScreen` renders inline organiser form cards while keeping underlying read-only details cards mounted below, introducing "Visibility" to the read view caused the screen-wide check to fail even though the edit form itself never exposed the field. Scoping the assertion to the specific edit form card node (`texts(editForm).includes('Visibility')`) preserved the test's contract invariant without false failures.

**Why it matters generally**: Screen-wide text assertions (`texts(root).includes(...)`) are brittle in views that mount modal sheets, collapsible panels, or inline editing forms alongside read-only details. Negative assertions that check for absence across the entire component tree will inadvertently break whenever domain terms or labels are introduced into sibling read-only cards.

**Suggested addition** (target: "Test Requirements / Testing discipline"): When writing negative assertions to verify that a form or dialog omits specific fields or actions, scope the assertion to the specific form container or panel under test rather than the entire component root, preventing false failures when sibling read-only components display those same domain terms elsewhere on the screen.


