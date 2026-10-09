# Agent Enhancement Report — 2026-10-09

## 1. Type Re-exports vs Local Scope in TypeScript

### What Happened
In `src/labels/LabelsContext.tsx`, `export type { LabelKey } from './fallbackLabels'` was used to re-export `LabelKey` for consumers. However, other type definitions within `LabelsContext.tsx` (such as `TranslateFn = (key: LabelKey, params?: LabelParams) => string`) also referenced `LabelKey`. TypeScript gave `TS2304: Cannot find name 'LabelKey'` because an `export type { X } from '...'` statement forwards the type export across the module boundary but does not bring `X` into the file's own scope. Separating into `import type { LabelKey } from './fallbackLabels'` and `export type { LabelKey }` resolved the issue immediately.

### Why It Matters Generally
When refactoring or consolidating types across modules, it is easy to assume that re-exporting a type also makes it available locally in that file. In TypeScript, re-export syntax does not populate local bindings.

### Suggested Addition
In the Developer Agent Shared Instructions under **Pre-code gates (Gate 2/3)**:
> When re-exporting types from companion modules, if the current file's own functions or types also reference that symbol, always import it locally (`import type { T } from '...'`) alongside the re-export (`export type { T }`) rather than relying on `export type { T } from '...'` alone.

---

## 2. Test Helper Filtering and Accessibility Roles

### What Happened
In React Native test utilities, `pressables(root)` was defined to find elements where `accessibilityRole === 'button'` and `onPress` was a function. When testing tab bars, tab pills were implemented with `accessibilityRole="tab"` per WCAG mobile accessibility guidelines. Because `pressableWithText()` internally delegated to `pressables()`, querying the tab pills by label failed with 0 matches. Adding a dedicated query helper (`tabWithText`) targeting `accessibilityRole === 'tab'` allowed accurate interaction testing.

### Why It Matters Generally
Accessible mobile components use diverse roles (`button`, `tab`, `radio`, `link`). Testing utilities that restrict button queries strictly to `accessibilityRole="button"` will miss valid, accessible interactive elements like tabs or segmented controls.

### Suggested Addition
In the Developer Agent Shared Instructions under **Debugging discipline / Test harnesses**:
> Ensure UI test interaction helpers support the full range of interactive accessibility roles (`button`, `tab`, `radio`) or provide specialized role helpers (`tabWithText`, `buttonWithText`) so that accessible components with non-button roles can be located and pressed accurately in test runners.

---

## 3. Local Timezone Date Fixtures in Date Grouping Tests

### What Happened
When testing date grouping logic that partitions notifications into "Today", "Yesterday", and "Earlier" based on the device's local calendar day, test fixtures created using hardcoded UTC strings (e.g. `2026-10-08T18:00:00Z` vs `now = 2026-10-09T15:00:00Z`) evaluated differently depending on the test runner's system timezone. In UTC+8, `2026-10-08T18:00:00Z` is `2026-10-09 02:00:00 AM`, placing it in "Today" instead of "Yesterday". Using relative timestamp offsets from the reference `now` (`now.getTime() - 26 * 3600_000`) made the tests completely resilient across any developer machine or CI timezone.

### Why It Matters Generally
Calendar day boundaries are intrinsically timezone-dependent. Tests asserting local date grouping should always anchor relative to `now` or construct dates using local calendar components (`now.getFullYear(), now.getMonth(), now.getDate() - 1`) rather than fixed UTC ISO strings.

### Suggested Addition
In the Developer Agent Shared Instructions under **Testing discipline**:
> When writing tests for local calendar day grouping ("Today", "Yesterday"), avoid hardcoded UTC timestamps that can straddle local midnight under non-UTC test runners. Always generate test dates relative to the fixture's base `now` Date using millisecond offsets or local calendar getters.
