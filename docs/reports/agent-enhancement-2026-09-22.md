# Agent enhancement notes — 2026-09-22

## 1. Verify brief-named endpoints against the live schema before Gate 3
- **What happened:** a brief named endpoints the design and backend did not have; a schema fetch caught it before any code was written. Once live, the schema also differed from the brief's types (nullable fields, `string` vs enum).
- **Why it matters:** coding to a brief's types yields runtime null crashes and 404s that unit tests with mocks never see.
- **Suggested addition (Fidelity rules / Contract verification):** "When a brief names endpoints or response fields, fetch the live schema first and treat it as the contract; note every difference from the brief as a Proposed Assumption."

## 2. Measure the test baseline before quoting it
- **What happened:** the brief and status file said 610 tests; the real baseline was 615.
- **Why it matters:** a wrong baseline either hides a deleted test or triggers a false alarm.
- **Suggested addition (Gate 3):** "Run the suite once before editing and record the count; reconcile any mismatch with the brief in the report."

## 3. Timer-driven list components need fake timers in tests
- **What happened:** a FlatList test spammed "not wrapped in act" warnings from the list's internal batching timer, though assertions passed.
- **Why it matters:** warning noise trains people to ignore real act() problems.
- **Suggested addition (Test requirements):** "Screens with virtualised lists: use fake timers and flush pending timers inside act() in afterEach; the suite must stay warning-free."
