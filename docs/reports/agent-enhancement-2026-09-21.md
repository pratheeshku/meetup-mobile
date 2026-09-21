# Agent enhancement notes — 2026-09-21

Generalizable lessons only.

## 1. A brief's literal code samples can be wrong about third-party event semantics

- **What happened:** The brief's handler matched `type === PRESS` for action-button presses. The installed library's own types show buttons emit a different event (`ACTION_PRESS`), and a related default (`launchActivity`) only applied to one press-action id. Implemented literally, the feature would have built, passed unit tests written from the same assumption, and silently done nothing on device.
- **Why it matters:** Code samples in a brief are the author's belief about a library, not a verified contract. Mocked unit tests inherit the same belief and cannot catch it.
- **Suggested addition** (Fidelity rules): "When a brief names third-party enum values, event types, or defaults, confirm them against the installed package's source/types before coding. Where they conflict, surface the conflict and get a decision; do not implement the literal sample."

## 2. "N tests must still pass" can conflict with a mandated behaviour change

- **What happened:** A required behaviour change (stop showing an in-app banner for two types) broke 8 existing tests that asserted the old behaviour.
- **Why it matters:** The count constraint is a regression guard; tests that encode the superseded behaviour are the one legitimate exception, but silently rewriting them looks like gaming the guard.
- **Suggested addition** (Debugging discipline): "Run the full suite immediately after the behaviour edit. If failures are exactly the tests asserting the behaviour the task removes, update them in place, list each with before/after and the spec sentence that mandates it under Deviations, and flag it for the reviewer."

## 3. Filter-and-grep output can hide the context that decides pass/fail

- **What happened:** `grep notify` on a dependency report surfaced a line containing `FAILED`. Read alone it looked like a linking failure; the surrounding configuration showed every autolinked native module prints the same word there.
- **Why it matters:** A stop-and-report gate was one keyword away from a false alarm, and the reverse (missing a real failure hidden by a filter) is equally possible.
- **Suggested addition** (Pre-code gates): "When a filtered command output contains a failure keyword, capture the full output and read the surrounding block plus the process exit code before reporting or dismissing it."

## 4. Live status file name can collide with a previous task's tracked file

- **What happened:** The prescribed `implementation-status-{DocID}.md` already existed, tracked, from an earlier task on the same design doc, and carried an unresolved Blocked note.
- **Why it matters:** Overwriting would have destroyed a live human-action reminder; the write tool also refused until the file was read.
- **Suggested addition** (Live status file): "Before creating the status file, check whether it already exists and is tracked. If its Blocked/Pending sections are still live, use a task-suffixed name instead of overwriting; archive the old one only when its own report is closed."

## 5. Pre-existing uncommitted changes in the tree need provenance before they're built on

- **What happened:** The tree already held an uncommitted dependency add and a 247-line lockfile diff that the task's Step 1 was supposed to create.
- **Why it matters:** Committing or building on it without checking risks absorbing unrelated changes.
- **Suggested addition** (Pre-code gates, Gate 1): "Inspect `git status`/`git diff` for pre-existing changes before starting. Attribute each to the task (e.g. trace lockfile additions with `npm ls <pkg>`) or exclude it from commits."
