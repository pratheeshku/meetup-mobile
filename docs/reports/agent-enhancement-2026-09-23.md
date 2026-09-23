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

## 3. A brief that misremembers a precedent's name is a signal to grep before blocking OR before building

**What happened:** A task brief asked to mirror an "organizer_add/organizer_remove" notification pattern and have a new notification type's action button make a direct mutating API call, "same pattern event_invite's Accept uses." Neither existed anywhere in the codebase — a repo-wide grep for "organizer_add"/"organizer_remove" found nothing but unrelated `organizer_id` fields, and no notification action button anywhere in the codebase performs a direct API call (the only real precedent, `participantHandler.ts`, has purely navigate-or-dismiss actions). This combination — a named precedent that doesn't exist, plus a behavior class (mutating call from a background notification handler, with no session/offline/error-handling story) that would be a real contract risk if invented — was correctly treated as a CRITICAL gap and blocked rather than built. The very next message from the same author corrected both points: the real precedent was `event_participant_added`/`event_participant_removed` (just mislabeled), and the "direct call" framing was simply wrong — the actual ask was ordinary navigation, already unblocked.

**Why it matters generally:** A brief author working from memory across a multi-repo/multi-session task (web backend in one repo, mobile in another) will sometimes misname a prior implementation or overstate a behavior. The correct response is not "trust the label and build toward it" (that risks inventing an ungoverned contract) and not "block on the mismatch without investigating what's actually similar" (that wastes a round trip when the fix is one grep away). The right shape is: grep for the literal name first: if it's absent, check whether a *similarly-shaped* precedent exists under a different name before concluding the whole premise is stale. If the precedent is genuinely absent AND the requested behavior is itself a new contract (new API-call site, new mutating action, new auth/offline surface), block with the specific missing piece named — this makes it cheap for the author to correct a one-word mislabel versus actually needing to design new behavior.

**Suggested addition (Developer Agent instructions, Design document acceptance / Blocked Report format):**
> When a brief cites a named precedent ("mirror X's existing pattern") that a targeted grep doesn't find, before filing a Blocked Report check whether a differently-named implementation matches the *described shape* (same file area, same library, same button/action structure) — name that candidate explicitly in the Blocked Report's "Investigated" section ("no `X` found; the closest match is `Y`, mirrored here only if confirmed") so a one-word correction doesn't require the reader to re-derive the search from scratch.
