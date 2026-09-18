# Agent enhancement notes — 2026-09-19

Generalizable lessons only. Each entry: what happened → why it matters → suggested addition (target section).

## 1. A "no matches" result is not evidence without a positive control

**What happened.** A verification grep for leftover hardcoded colours used an unquoted `--include=*.ts` glob. The shell expanded it, aborted the command, and printed "no matches found". Read naively, an empty result looked like "zero leftovers" — the opposite of the truth (the re-run, with quoted patterns, found five).

**Why it matters.** Any claim of the form "X does not exist" is only as strong as the search's ability to find X. Shell globbing, wrong flags, and wrong paths all produce the same empty output as a clean result. This is exactly the kind of evidence that ends up pasted into a report as proof.

**Suggested addition** — *Completion Proof*: "Any 'nothing found' evidence (grep/find/search returning empty) must be paired with a positive control — the same command run against a location known to contain a match — and search patterns/globs must be quoted. An unpaired empty result is not proof."

## 2. Run the full gate after the *last* edit, immediately before each commit

**What happened.** The type-check was run and passed, then new test files were written, then the work was committed and pushed without re-running the type-check. Two type errors in the test files shipped. The test runner passed throughout because it strips types (Babel) rather than checking them, so a green test run gave false comfort about type-correctness.

**Why it matters.** Test files are compiled code too and sit inside the type-checker's scope. A passing test run says nothing about type errors when the transformer doesn't type-check. Gates that were green earlier in the session say nothing about files written afterward.

**Suggested addition** — *Fidelity rules* (commit discipline): "Before every commit, run the complete gate (type-check + lint + tests) as the final step after the last file edit. A gate run that predates any later edit does not count. Do not infer type-correctness from a passing test run when the test transformer does not type-check."

## 3. Resolve conflicting commit-attribution rules before the first commit, then audit earlier commits

**What happened.** A harness-injected reminder asked for an AI co-author trailer on commits, while the agent's standing instructions forbid any AI attribution in commit messages. The reminder was followed on the first commit of the session and the standing rule was noticed only later — after the commit was already pushed, when removing it would require a force-push (denied).

**Why it matters.** Pushed history is effectively irreversible under this agent's own restrictions, so a wrong first commit can't be quietly corrected. When two instruction sources conflict, the mistake is cheapest to prevent at the first occurrence.

**Suggested addition** — *Git identity (before first commit in every session)*: "At the same checkpoint as the identity check, decide the attribution policy: if any injected reminder requests a commit trailer or attribution line, compare it against these rules first — explicit rules here win — and state the decision. After any commit, verify the message with a grep for the forbidden trailer, and disclose (do not silently absorb) any violation found in earlier commits."

## 4. Probe an unfamiliar library's object tree before writing assertions against it

**What happened.** Component tests located a pressable via `findByType(Pressable)` and found nothing, even though the component was correct. The library's exported component was not the same reference as the fiber's type, and both composite and host nodes appeared (so text/spinner lookups would also have double-counted). Five tests failed on lookup, not behaviour. A short probe that printed the real node tree made the cause obvious in one step.

**Why it matters.** When a test fails on "element not found", the fastest disambiguation between "component is wrong" and "lookup is wrong" is to look at the actual rendered structure — not to keep editing the assertion or the component.

**Suggested addition** — *Debugging discipline*: "When a UI/render test fails to find an element, print the real rendered tree first (temporary probe test, deleted afterwards) before changing either the component or the assertion. Prefer locating elements by stable props/host type over component references."

## 5. Measure a specified palette's accessibility instead of assuming it; follow explicit specs, flag the numbers

**What happened.** A user-supplied colour palette was applied to badges, tab bars and text. Computing WCAG contrast ratios before choosing pairings showed that some combinations the obvious "same-hue text on light tint" approach would produce failed AA (about 2.5:1), and one explicitly specified colour failed on both surfaces it would sit on. Measuring took one short script; it changed component decisions and produced concrete numbers for the report.

**Why it matters.** Design tokens handed over as a spec are often not validated for legibility, and eyeballing colours is unreliable. The right response to a conflict with an explicit spec is to follow the spec where it is explicit, choose compliant pairings where the choice is the implementer's, and surface the numbers — not to silently alter tokens or silently ship the failure.

**Suggested addition** — *Fidelity rules* (UI work): "For any visual-system task, compute contrast ratios for every text/background pairing before choosing component colour mappings; encode the decision in a test so it can't regress silently; where an explicitly specified value fails, use it only as specified and report the measured ratio as a follow-up."

## 6. When forcing a light visual system onto a platform with an auto dark theme, set explicit text colours

**What happened.** The mobile platform's base theme followed the system light/dark setting. Forcing light backgrounds while leaving text and input colours to the platform default would have produced light-on-light (unreadable) text for users in system dark mode — a failure mode that no light-mode review or automated check would reveal.

**Why it matters.** Inherited defaults silently change with a setting the developer usually isn't testing. It's a class of bug invisible in the developer's own environment.

**Suggested addition** — *Pre-code gates → Gate 1 (Environment)*: "For UI tasks, read the platform's base theme (light-only vs day/night) and record whether text/input defaults are inherited. If the design is single-mode on a day/night platform, require explicit colours on every text and input."

## 7. The 5-minute status-file rule is unenforceable without a clock — make it milestone-based

**What happened.** The rule says to overwrite the live status file every 5 minutes, but the agent has no timer and only acts between tool calls. The file was written at task start and at close, which technically breaks the rule while the intent (a trustworthy in-flight record) was only weakly served.

**Why it matters.** A rule the agent cannot follow reliably trains it to ignore the rule, and to report cadence that never existed.

**Suggested addition** — *Live status file*: "Overwrite the status file at each milestone — after completing each file group, after each verification run, before each commit — rather than on a clock. Record actual update points truthfully."

## 8. For large files where logic must not change, replace bounded regions programmatically and prove logic parity by diff

**What happened.** Restyling ~600-line files while requiring "visual layer only" carries a real risk that hand-retyping a full file alters a handler. Replacing only the render/stylesheet region (sliced at a unique marker, with an assertion that the marker occurs exactly once), then diffing state-setter/API/navigation/auth lines against the previous commit, showed precisely which lines differed and that none were logic.

**Why it matters.** "Don't change behaviour" is a claim that needs evidence; a targeted diff of logic-bearing lines is cheap and much stronger than "I was careful".

**Suggested addition** — *Fidelity rules* (Smallest change set): "For presentation-only changes to large files, prefer bounded-region replacement over full-file regeneration, and include in the report a normalized diff of logic-bearing lines (state, handlers, API and auth calls) against the prior commit showing no change."
