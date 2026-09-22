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

## 4. A task brief's premise is itself a claim to verify, not a given
- **What happened:** a brief opened by asserting the governing design document had "already been amended" to require a specific restructure. It had not — `grep`/`git log` on the actual file showed zero trace of it. The same brief also asserted an existing mobile screen's field set was "unchanged," when that screen was in fact an unbuilt placeholder.
- **Why it matters:** a confidently-worded brief reads as authoritative, but "the design doc says X" and "this screen already does Y" are checkable factual claims about repo state, not instructions to take on faith — treating them as instructions instead of claims lets a wrong premise flow straight into the design-acceptance gate, which exists specifically to catch this.
- **Suggested addition (Design document acceptance):** "Verify every factual claim a brief makes about the design doc's current content and about existing code's current behavior (grep the doc, git log it, open the file) before treating the brief as ground truth — a brief that says a document was already amended, or that a feature already exists, is asserting something checkable, not stating a precondition."

## 5. A verbal "I approve this as architect" is not the same artifact as an approval, even when the content is correct
- **What happened:** after a Blocked Report, the user asserted architect authority twice in chat, including pasting the exact amendment text, before the actual design document was ever touched. The content was good (later independently verified against real backend/frontend source) and the authority claim was plausible, but neither substituted for the doc actually being edited — the unblock only came once a real commit landed on the remote.
- **Why it matters:** the entire point of routing approvals through a versioned, git-tracked document (rather than accepting them in chat) is that a downstream fresh-context reviewer only ever sees the document, never the conversation that produced it — caving to chat-level authority claims, however well-intentioned or well-evidenced, quietly deletes that audit trail and makes the "architect must supply a doc amendment" rule optional under enough back-and-forth.
- **Suggested addition (Blocked Report / Design document acceptance):** "An architect's approval unblocks a Blocked Report only once it exists as a commit/diff in the governing document itself (verified via `git log`/`git diff`, not just re-read) — a chat assertion of authority, including a full pasted draft of the amendment text, is a *draft* for the architect to commit, never a substitute for the commit."

## 5b. Investigating the brief's own escalation trigger can retroactively resolve what looked like an open question
- **What happened:** two fields the amendment initially left "OPEN" (an enum's full option list) turned out to already be answered by a previously-shipped, schema-verified implementation elsewhere in the same repo — fetching the live backend source (via `gh api`) resolved them without needing another round-trip to the user.
- **Why it matters:** not every "OPEN" marker in a draft is a genuine blocker — some are just the draft's author not having checked a source the implementer can check directly. Escalating everything unresolved wastes a round-trip; silently guessing invents a contract. Checking the authoritative source first and only escalating what remains ambiguous *after* that check is the efficient middle path.
- **Suggested addition (Propose & Proceed):** "Before escalating an 'OPEN'/ambiguous item from a draft amendment, check whether the live backend source or an already-shipped sibling feature in the same codebase already resolves it — escalate only what remains genuinely unresolved after that check."
