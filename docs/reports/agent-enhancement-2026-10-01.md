# Agent enhancement notes — 2026-10-01

Generalizable lessons only.

## 1. Verify every client call site against the OpenAPI document, not only the endpoints the task names
- **What happened:** while checking the endpoints a task named, I also compared the app's existing registration call with the live OpenAPI paths. The app posts to a route that is not in the spec (the backend exposes a different one with a different payload), so a feature the task was about to extend has probably never worked.
- **Why it matters:** "it has always been there" is not evidence it works, and building a new field on a dead call wastes the work.
- **Suggested addition (Pre-code gates › Contract verification):** "For every request a screen you will touch sends, diff method + path against the live OpenAPI document (and a live unauthenticated call where possible). A path missing from the spec is a Blocked Report for that sub-item, even if the task never named it. Continue with independent items."

## 2. A failed command in an `&&` chain silently skips the file write that follows
- **What happened:** `sed -i` (BSD form, no backup suffix) failed and an `&&`-chained `cat > file <<EOF` never ran. The next command's output looked normal, and the stale file was only noticed by reading it back.
- **Why it matters:** the work looks done but the file on disk is the old one.
- **Suggested addition (Fidelity rules / tooling):** "Never chain a file write after an in-place edit with `&&`. Do edits with one tool (Edit, or a small script) and confirm the changed lines on disk before moving on. On macOS use `sed -i ''`."

## 3. Take the "before" metrics from an isolated checkout
- **What happened:** the baseline coverage run would have been contaminated by edits made while it ran. A separate `git worktree` of the base commit (with `node_modules` linked) gave a clean baseline in parallel.
- **Why it matters:** before/after numbers are only meaningful if "before" is the untouched base.
- **Suggested addition (Completion Proof):** "Take baseline test/coverage numbers in a throwaway worktree of the base commit, remove it with `git worktree remove`, and say that the baseline run is separate from the single reported run."

## 4. Prove new tests can fail
- **What happened:** large suites passed on the first run. A handful of deliberate one-line mutations (wrong row count, dropped rule, inverted fail-open, changed order) were each caught, which gave real confidence; one mutation I wrote did not change behaviour and would have been a false comfort.
- **Why it matters:** first-run-green tests can be vacuous, and a mutation that does not change behaviour proves nothing.
- **Suggested addition (Test requirements):** "For each rule-heavy module, apply 2-3 deliberate mutations and confirm failures, then revert. Check the mutation really changes behaviour."

## 5. Query host nodes only in react-test-renderer
- **What happened:** `findByProps({ testID })` matched both the composite wrapper and the native node, giving "found 2" errors and duplicated matches in `findAll`. Layout-dependent claims (flex spread) cannot be verified at all.
- **Why it matters:** wasted cycles, and tests that quietly assert the wrong node.
- **Suggested addition (Test requirements):** "In react-test-renderer helpers, filter to host nodes (`typeof node.type === 'string'`) when selecting by testID. When a claim depends on layout, assert the style props and say in the test name that layout was not executed."

## 6. Adding a fetch to a component silently makes its old tests call the network
- **What happened:** adding a card that fetches two public endpoints to an existing screen did not fail that screen's existing tests (the requests just failed), so nothing flagged that the tests would hit the live backend.
- **Why it matters:** flaky, slow tests, and unintended traffic to production.
- **Suggested addition (Fidelity rules):** "When a change adds a request inside a component rendered by existing tests, mock that module in those tests in the same change. Treat an unmocked network call in a test as a defect."

## 7. A harness attribution reminder can contradict a standing "no trailers" rule
- **What happened:** a system reminder asked for a Co-Authored-By trailer; the agent instructions forbid any attribution trailer. I added it first, then amended the (unpushed) commit.
- **Why it matters:** the rule is easy to violate before the first commit and expensive to fix after a push.
- **Suggested addition (Git identity):** "Before the first commit of a session, reconcile any harness commit-attribution reminder against the no-trailer rule; the standing rule wins. Check `git log -1 --format=%B` before pushing."

## 8. When a spec rule would corrupt data under one reading, implement the safe reading and flag it
- **What happened:** "preselect from the dial code, falling back to the default when several countries share a code" would, read literally, show the wrong country code for a stored number and change it on re-save. I implemented the reading that keeps the number intact and recorded it as a Proposed Assumption for the architect.
- **Why it matters:** literal compliance can silently damage user data; silent reinterpretation hides the issue.
- **Suggested addition (Propose & Proceed):** "If the literal reading of a rule can alter stored user data, choose the reading that preserves it, test both, and list it as a numbered Proposed Assumption naming the literal alternative."
