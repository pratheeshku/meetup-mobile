# Agent Enhancement Notes — 2026-09-17

Generalizable lessons from implementing a push-notifications module
against an approved design document. Project-specific names/paths
omitted below where the lesson generalizes. See
`agent-enhancement-2026-09-13.md` for prior-session lessons (#1–#14,
not repeated here).

## 15. Running a code formatter across a whole file it has never
formatted before reformats untouched, pre-existing lines too — check
whether the repo's existing files actually already conform before
trusting the formatter to be a no-op on code you didn't mean to touch

**What happened**: a repo had a `.prettierrc` committed, so `npx
prettier --write` was run on a handful of modified/new files after
making a small number of targeted edits to each. On several pre-existing
files, prettier rewrapped many long lines that predated this session's
changes entirely (component props spread across multiple lines instead
of one, etc.) — a follow-up `awk` line-length audit of untouched sibling
files in the same codebase showed lines well over prettier's default
80-column width throughout, proving the codebase's existing files had
never actually been run through `prettier --write` despite the config
file's presence. The net result was several hundred extra diff lines of
pure reformatting noise on code this task never needed to touch, directly
violating the "smallest change set; patches over rewrites" fidelity rule.
Caught only by inspecting `git diff --stat` and finding it far larger
than the actual edits justified, then `git checkout --` to revert and
redo the same edits with the `Edit` tool (which only touches the exact
lines specified) instead of a blanket formatter pass.

**Why it matters generally**: a `.prettierrc` (or any formatter config
file) being present in a repo is not evidence the repo's existing files
were ever actually formatted with it — many projects add the config for
new code going forward, or the config predates a lint/format step being
wired into CI, without ever having run a one-time bulk reformat. Running
a formatter's `--write` mode across a whole file after a small targeted
edit silently expands the diff to cover every line in that file that
doesn't match the formatter's opinion, not just the lines that were
actually changed. `git diff --stat` after any formatter invocation is a
cheap, decisive check for this — a diff size wildly out of proportion to
the described edit is the tell.

**Suggested addition** (target: Fidelity rules): "Before running any
formatter's write/fix mode on a file that already existed before this
session's edits, either (a) verify the surrounding untouched code in
that file already conforms to the formatter's rules (spot-check a few
long lines against its config), or (b) scope the formatter to only the
changed region if the tool supports it, or (c) skip the formatter
entirely and let manual edits match the file's existing local style.
After any formatter run, check `git diff --stat`/`git diff` before
proceeding — a diff far larger than the described edit means the
formatter rewrote untouched code, and the fix is to revert and redo the
edit without the blanket formatting pass, not to keep the larger diff
because it's 'still correct'."

## 16. Before treating a brief's contrary instruction as a deviation
from a design-named third-party dependency, check whether that
dependency was ever actually installed — an unused design decision is a
materially smaller thing to diverge from than a wired-in one

**What happened**: a governing design document named a specific
third-party library as a "fixed technology decision" for one part of a
feature, with documented trade-offs and rejected alternatives — reading
exactly like a settled architectural commitment. The current task's own
brief explicitly and repeatedly forbade using any third-party library for
that same part, asking for a hand-rolled alternative instead. Checking
`package.json` showed the design-named library had never actually been
added as a dependency anywhere in the codebase — no prior task had
installed or wired it in. This made the brief's contrary instruction a
much lower-stakes divergence (no existing integration to rip out, no
native linking to undo, no other code depending on it) than it would have
been had the library already been present and in use elsewhere.

**Why it matters generally**: "the design says X" and "X is already the
codebase's committed reality" are different levels of risk when a task's
own instructions point the other way. A design decision that was never
actually implemented is still authoritative on paper, but diverging from
it costs nothing beyond a documented deviation; diverging from a decision
that's already load-bearing elsewhere in the codebase (other files
import it, native config references it, tests mock it) is a much bigger
and riskier change to make unilaterally. This check doesn't change
*whether* to flag the conflict (still required either way, per the
existing "brief vs. design conflict" rule), but it changes how much
weight the decision to follow the brief instead should carry, and it's a
one-command check (`grep` the dependency in `package.json` and for actual
imports) worth doing before writing the Implementation Report's Deviation
entry.

**Suggested addition** (target: Fidelity rules / Propose & Proceed):
"When a task brief's instruction conflicts with a design-named
third-party dependency, check whether that dependency is actually
installed (`package.json`) and imported anywhere in the codebase before
writing up the conflict. An uninstalled, never-integrated dependency
named only in the design's prose is a materially lower-risk thing to
diverge from than one already wired into other modules — note this
distinction explicitly in the Implementation Report's Deviation entry so
the architect can weigh the actual switching cost, not just the fact of
the conflict."

## 17. When a brief substitutes an existing screen/entity for a design's
named-but-never-built destination, verify the two entities' identifiers
are actually interchangeable before treating the substitution as safe

**What happened**: a design document's notification-type-to-screen
mapping table named a destination screen (backed by its own, distinct
API resource and id space) that had never been built anywhere in the
codebase — only a different, related-but-separate entity's screen
existed. The current task's brief, apparently working around the same
gap, explicitly instructed routing that notification type to the
existing sibling screen instead. Implementing that substitution literally
means passing the *first* entity's id into a screen whose data-fetch call
is typed and implemented against the *second* entity's id space — if
those ids aren't drawn from the same namespace in the real backend
(plausible, since the design treats them as two separate resources with
their own CRUD endpoints), the substituted screen's fetch will 404 or
return the wrong record entirely at runtime, not just render suboptimal
UX.

**Why it matters generally**: this is a sharper version of "a feature can
be named consistently across a design with no backing endpoint" (see
prior session's lesson #14) — here the substitute destination *does*
exist and *does* work in general, which makes it easy to treat the
swap as purely cosmetic (different screen, same idea) rather than
checking whether the id being handed to it actually belongs to that
screen's resource type. A screen that loads fine for its own normal
entry points can still fail specifically for ids arriving via this kind
of cross-entity substitution.

**Suggested addition** (target: Fidelity rules / Propose & Proceed):
"When a task brief substitutes an already-built screen/entity for a
design's named-but-unbuilt destination, explicitly check whether the id
being routed to the substitute screen is drawn from the same identifier
space that screen's own data-fetch call expects — not just whether the
substitute screen exists and renders. If the design treats the two
entities as separate API resources, treat the substitution as a flagged,
architect-reviewable risk (not a safe cosmetic swap) in the
Implementation Report, and make sure the substitute screen's existing
error-handling path degrades safely (a generic load-failure state, not a
crash) for the case where the id turns out not to belong to it."
