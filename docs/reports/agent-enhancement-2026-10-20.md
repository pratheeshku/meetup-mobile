# Developer Agent Enhancement Report — 2026-10-20

## 1. Preserving Accessibility Labels During Visual Action Label Updates

- **What happened**: When changing the visual label of an existing joined/registered control to "Decline" (per design addendum OI-4), legacy test suites failed because test helpers located the button by its original accessible name (`pressableLabelled(root, 'Leave')`). Adding `accessibilityLabel` with the original localized action preserved both the design's new visual label and full test suite backwards compatibility.
- **Why it matters generally**: In mature mobile and web applications, end-to-end tests, accessibility tests, and unit helpers frequently query elements by their semantic accessible name rather than visual text. Decoupling visual text updates from accessibility identifiers prevents unintentional regression across existing screen test suites.
- **Suggested addition**:
  - *Target Section*: `Fidelity rules`
  - *Rule*: "When updating the visual label of an existing action button, preserve the existing `accessibilityLabel` or `testID` unless the specification explicitly directs an accessibility name replacement."

---

## 2. Defensive Structural Validation in Composite Screen Subcomponents

- **What happened**: When mounting a new subcomponent on a complex screen that consumes a secondary endpoint (`GET .../responses`), sibling tests that mocked API calls with generic fallback values (such as `{ data: [] }`) threw unhandled property read exceptions (`TypeError: Cannot read properties of undefined (reading 'total')`).
- **Why it matters generally**: In component trees where multiple endpoints are loaded in parallel, existing unit tests typically mock only the primary resource. Secondary components that perform immediate destructuring without validating nested container shapes cause widespread suite failures across unrelated tests.
- **Suggested addition**:
  - *Target Section*: `Fidelity rules / Component Mechanics`
  - *Rule*: "Components that render nested response structures must guard against malformed, partial, or fallback mock shapes before destructuring nested fields (e.g. checking `Array.isArray` and container existence)."
