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

## 9. Check a brief's description of the "current state" against the repo before building

**What happened.** The brief said the new layout replaces an "icon-circle/progress-bar approach from the prior task". The card in the repo had neither — the only icon circle was in an unrelated empty-state component, and there was no progress bar anywhere. The brief also specified a data field (skill level) that the data model does not have. Both were discovered only because the existing code and types were read before writing anything.

**Why it matters.** A brief's claims about existing code, and about which data is available, come from memory or from another surface (here, the web app). Acting on them literally either deletes the wrong thing or invents fields to satisfy the spec. Neither is visible in tests, which only test what was built.

**Suggested addition** — *Pre-code gates → Gate 3 (Task confirmation)*: "For every 'replace/remove X' instruction, grep for X and record what was actually found. For every displayed value in the spec, name the model field that supplies it; if none exists, omit the element and report it as a gap — never add a field or placeholder."

## 10. Provenance of "verified" claims must be recorded, not inherited

**What happened.** The brief asked the report to state the layout was "verified against the actual live web app, not inferred". The implementing agent never viewed the web app; the user did and relayed the result as text.

**Why it matters.** A report that says "verified" without saying by whom converts a second-hand statement into apparent first-hand evidence, which downstream review will trust.

**Suggested addition** — *Implementation Report → Verification results*: "Every 'verified'/'observed' statement names the verifier and the medium (e.g. 'supplied by the user from direct inspection; not independently viewed by the implementer'). The implementer may only claim verification it performed itself."

## 11. In react-test-renderer, `.parent` of a host node is usually a composite wrapper

**What happened.** Tests that read a pill's background via `textNode.parent.props.style` got `undefined`: the parent of the host `Text` was the composite `Text` component, not the enclosing `View`. Three tests failed for a test-helper reason, not a product reason.

**Why it matters.** The failure looks like a component bug (style "missing"), which invites changing correct code to satisfy a wrong test.

**Suggested addition** — *Debugging discipline*: "When a style/prop assertion on a rendered tree returns undefined, first check whether the traversal landed on a composite wrapper rather than the host node; walk up to the nearest host element by type before touching the component."

---

# Session 2 (2026-09-19) — feature built on top of existing API adapters

Generalizable lessons only; entries below are new or refine an entry above.

## 8. Trace every field a new feature branches on back to its producer before designing on it

**What happened.** A task's filtering rules were written in terms of a domain field ("exclude events the user organises", keyed on a boolean). The field existed in the type and looked usable, but the API adapter that produces it hard-codes a constant default (the endpoint never returns it), documented only in a comment. Building on the flag alone would have compiled, passed shallow tests, and silently done nothing. Checking the producer also exposed an *existing* consumer elsewhere that already depended on the same dead field, so a shipped feature had been broken all along.

**Why it matters.** A field present in a type is not evidence it carries data. Adapters often stub fields "inert for now", and that stops being true the moment a new consumer arrives. The existing "one dead feature → check its siblings" rule triggers only after something is seen to fail; here nothing had visibly failed.

**Suggested addition** — *Pre-code gates → Contract verification*: "For every field the task filters, sorts, gates or counts on, open its producer (API mapper/adapter) and confirm it maps real wire data rather than a hard-coded default. If it is stubbed, derive the value from real data at the point of use, write a test whose fixture keeps the stub value, and grep existing consumers of the same field — report any that are silently broken instead of assuming they work."

## 9. Read what a library renders by default for the slot you are filling

**What happened.** The brief asked for emoji "in the tab labels". The tab library, when no icon is supplied, renders a placeholder glyph above every label. Putting the emoji in the label alone would have produced placeholder-plus-emoji on every tab. The library source showed this in one grep; nothing in the app's own code hinted at it.

**Why it matters.** Requests are phrased in terms of the visible result the author imagines, not the library's slot model. Following the wording literally can produce a visibly wrong result that no unit test on the app's own code would flag.

**Suggested addition** — *Fidelity rules (UI work)*: "Before adding decoration to a third-party component slot (icon, label, header), read the library's default rendering for that slot when unconfigured. If the literal wording of the request would collide with a default, implement the intent through the slot that gives the intended visible result, and list it as a deviation."

## 10. A specified control with no destination: choose a working minimum or an honest disabled state — never a silent no-op

**What happened.** The brief specified three affordances whose targets don't exist yet ("Create Game", "View all →", a "tap to manage" tile). A silently inert-but-enabled control looks broken to a user and is easy to forget; building a placeholder screen invents scope.

**Why it matters.** This recurs whenever a UI is specified ahead of the screens behind it. Without a rule, each instance gets an ad hoc answer and the inert ones are never recorded.

**Suggested addition** — *Propose & Proceed*: "For a specified control whose destination does not exist: (a) if a small, genuinely working behaviour is available within the same screen, use it and never render the control when it would do nothing; else (b) render it visibly disabled with the handler as an optional prop so wiring is one line later. Never ship an enabled control that does nothing. Record each as a numbered assumption and a follow-up, and flag any specified copy that now misdescribes the control (e.g. 'tap to manage' on an inert tile)."

## 11. Refinement of #1 — the positive control must exercise the same command shape, and the search must report how many inputs it read

**What happened.** Despite lesson #1, an audit grep again produced an empty "(none)" that meant nothing. The control was run against a *different* invocation (a literal path), while the real command took its file list from a shell variable that the shell did not word-split, so grep received one nonexistent filename and searched nothing. Only the stderr warning, easy to skim past beside a friendly "(none)", revealed it.

**Why it matters.** A control that doesn't share the failure surface of the real command can pass while the real command is broken. Any wrapper that appends "(none)" on a non-zero exit also converts a *tool error* into a clean result.

**Suggested addition** — *Completion Proof* (extends the positive-control rule): "Run the positive control through the identical command form (same variable/array expansion), not a hand-typed equivalent. Print the count of input files actually searched next to the result. Use arrays, not strings, for file lists in zsh. Never use `|| echo none` fallbacks; distinguish grep exit 1 (no match) from exit 2 (error)."

## 12. Do not write an environment negative into a status record from a single probe

**What happened.** The status file recorded "no emulator on this machine" after one `which emulator` returned nothing. A later `adb devices` listed a physical device that had been attached all along. The claim was corrected before it reached the report, but it had already been written down as fact.

**Why it matters.** The status file and reports are read as ground truth by later sessions. A negative about the environment ("no device", "no network", "tool not installed") drawn from one probe of one mechanism is a guess, and it directly shapes how much verification gets skipped.

**Suggested addition** — *Live status file / Implementation Report*: "State environment capabilities only from a probe of the capability itself (e.g. list attached devices), not of one particular binary. Write 'not verified' rather than 'not available' unless the direct probe was negative, and state the actual reason verification was skipped (e.g. needs credentials, would modify the user's device)."
