# Agent Enhancement Report — 2026-09-23

## 1. Stash pop contamination

**What happened:** Running `git stash` to verify a pre-existing test failure, then `git stash pop` to restore changes, inadvertently restored a previously-stashed working directory from another task. This mixed changes from two different tasks, causing a test failure that appeared caused by the current task but was actually from unrelated stashed work.

**Why it matters generally:** Any `git stash pop` in a repo where prior sessions may have left stashes can silently introduce unrelated modifications. The developer agent has no reliable way to tell which stash entry contains only the current session's changes, especially when the pre-existing stash was created by a different agent session.

**Suggested addition (Developer Agent instructions, Debugging discipline):**
> Before using `git stash`, check `git stash list`. If stashes already exist, use `git stash push -m "<task-id>"` and `git stash pop stash@{0}` with explicit index verification, not bare `git stash pop`. Alternatively, prefer `git diff > /tmp/patch.diff` + `git checkout .` + `git apply /tmp/patch.diff` to avoid the stash stack entirely.

## 2. Test count tracking as regression guard

**What happened:** The baseline test count was recorded (659 tests) before starting. After implementation, the count rose to 668 (net +9: 16 new tests minus 7 removed from the old suite). This made it trivial to confirm no tests were accidentally lost or broken.

**Why it matters generally:** Tracking the exact before/after test count is a cheap, high-signal guard against accidentally deleting test coverage during a file overwrite.

**Suggested addition (Developer Agent instructions, Completion Proof):**
> When a task modifies test files, record the baseline test count (from the pre-task run) and the final count. The difference must be explainable by tests added/removed by the task.
