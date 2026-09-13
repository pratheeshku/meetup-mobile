# Agent Enhancement Notes — 2026-09-13

Generalizable lessons from scaffolding a bare React Native project against
an approved design document. Project-specific names/paths omitted below
where the lesson generalizes.

## 1. "latest" toolchain commands can silently outrun the dev environment

**What happened**: `npx react-native@latest init` resolved to a version
whose own transitive tooling (Metro et al.) requires a newer Node major
than was installed, and the scaffold command failed outright with no
project created — the failure surfaced only as a wall of `npm warn
EBADENGINE` lines, not a clear "this cannot work" message.

**Why it matters generally**: any brief that says "install the latest X"
implicitly assumes the latest X is compatible with the environment it's
being asked to run in. That assumption is often false, and the failure
mode is frequently non-obvious (warnings mixed with success-looking output,
or a silent non-zero exit with no created artifacts). Gate 1 (Environment)
already asks for a runtime/toolchain read before starting — this suggests
explicitly extending that gate to include: after any "init"/scaffold
command with `@latest`, verify the artifact was actually created before
declaring the step done, rather than trusting a scrollback that ends
without an explicit fatal error banner.

**Suggested addition** (target: Pre-code gates → Gate 1 — Environment):
"When a scaffold/init command targets `@latest` and the installed runtime
is older than very recent, check the target package's own `engines` field
first (`npm view <pkg>@latest engines`) and pin to the newest version whose
engines range is satisfied by the installed runtime, rather than attempting
`@latest` and debugging the failure after the fact."

## 2. A brief's literal dependency/config request can conflict with the same task's own governing design document

**What happened**: the task brief asked for a per-HTTP-call correlation ID
comment ("uuid v4 per request"), while the governing design document
explicitly specified per-logical-action correlation IDs and explicitly
named per-call IDs as a rejected alternative ("would fragment a single
action's trace"). The brief's own numbered steps are a delivery checklist,
not itself the source of truth when a governing design document exists.

**Why it matters generally**: task briefs are often written as a quick
checklist and can drift from the design doc they're supposed to implement,
especially on nuanced points. The fidelity rules already say the design
document is authoritative, but that's easy to under-apply when a brief's
wording is concrete and specific-sounding ("uuid v4 per request") versus
the design's more abstract framing — the concrete-sounding instruction can
read as more authoritative than it is.

**Suggested addition** (target: Fidelity rules): "When a task brief's
literal wording conflicts with the governing design document on a
behavioral point (not just phrasing), follow the design document and note
the brief/design discrepancy in the Implementation Report — do not treat
brief wording as an override just because it is more concrete or specific
sounding than the design's own language."

## 3. Deprecated/frozen third-party packages can still install cleanly

**What happened**: a brief-specified native module (last published ~2021,
archived upstream in favor of a successor library) installed with zero
peer-dependency errors and no npm deprecation warning at all — `npm ls`
showed a completely clean tree. Nothing in the install step itself signals
that the package is a maintenance risk for the next phase of work
(native build compatibility with a current Android toolchain / React
Native's New Architecture).

**Why it matters generally**: Gate 2's dependency audit currently checks
for version conflicts and duplicate copies, which this package had none
of — a clean `npm ls`/`npm install` is not the same signal as "this
package is still viable." A staleness check (last-publish date, archived
-repository status) is a different, currently-uncovered check.

**Suggested addition** (target: Pre-code gates → Gate 2 — Dependency
audit): "For any native-module dependency specified in the brief or
design, check last-publish date and upstream repository archive status
(`npm view <pkg> time.modified`, check for an archived-repo banner) in
addition to version/peer-conflict checks. A stale or archived native
module is not a blocking conflict, but it must be flagged as a known risk
in the Implementation Report before the screen that depends on it is
built out."

## 4. A generated scaffold's own config can silently violate an explicit numeric requirement from the design

**What happened**: the RN CLI's own generated `android/build.gradle` set
`minSdkVersion = 24`, while the design document explicitly named API level
26 as the minimum supported OS version (closed as a numbered Assumption in
the requirements baseline, not left ambiguous). Nothing about running the
scaffold command surfaces this mismatch — it silently applies the
tool's own opinionated default over the project's already-decided
requirement.

**Why it matters generally**: scaffold/boilerplate generators embed their
own defaults for values a design document may have already pinned down
(min OS version, permission declarations, etc.). Gate 3's task
confirmation asks to verify "interfaces verified from the design" but
doesn't explicitly prompt a diff of generator-produced config values
against numeric/config requirements named in the design.

**Suggested addition** (target: Pre-code gates → Gate 3 — Task
confirmation): "After running any scaffold/generator command, diff its
generated config values (min OS version, default permissions, etc.)
against every numbered Assumption and R-ID in the design/requirements
baseline that pins a concrete config value — do not assume generator
defaults are compatible with already-decided requirements."

## 5. A design document's characterization of a third-party package's
technical capability can be factually wrong, and reads as authoritative
until checked empirically

**What happened**: the governing design named a specific implementation
vehicle for a feature — "the Universal Sign-In API of `<package>`,
Google's current, recommended replacement for the deprecated legacy
module" — as an architecture decision with rationale and rejected
alternatives, reading exactly like a verified technical fact. Installing
the named package and reading its own README surfaced a direct
contradiction: the free package explicitly still uses the "legacy" SDK
the design said it replaced; the modern API the design described is a
different, commercial product from the same author, not a mode of the
installed package. Confirmed further by grepping the package's native
Android source for the actual imports used.

**Why it matters generally**: a design document's authority (source of
truth for behavior/contracts) is not the same as its correctness about
external facts (a package's current capabilities, licensing model, or
API surface). Confident, specific-sounding design language about a
third-party dependency can still be stale or wrong — package APIs and
product tiers change after a design is approved. Gate 2's dependency
audit checks versions/conflicts but not whether the design's *claims*
about a dependency's capabilities still hold.

**Suggested addition** (target: Pre-code gates → Gate 2 — Dependency
audit): "When the design document asserts a specific technical capability
of a named third-party package (not just 'use package X' but 'X does Y
via mechanism Z'), verify that claim against the installed package's own
current documentation and, for native modules, its actual native source
— before writing code against it. If the claim doesn't hold, this is a
CRITICAL/HIGH gap (architecture + security/cost) requiring a Blocked
Report or explicit user sign-off, not a silent implementation against
either the design's stale claim or the brief's literal (possibly
equally-uninformed) instruction."

## 6. Wiring a previously-inert module into the render tree can silently
break test coverage that never caught the underlying Jest-mock gap

**What happened**: a config-reading module and a Firebase module both
existed in the codebase already, imported by nothing in the app's actual
render tree, so a prior smoke test passed even though the config
module's real implementation throws outright under Jest (native
TurboModule not registered) and the Firebase module was never mocked.
Wiring an unrelated feature (auth) into `App.tsx` pulled both into the
render tree transitively for the first time, and the existing test would
have started failing immediately without additions to the Jest native
-module mock set.

**Why it matters generally**: "the test suite is green" is only informative
about the code paths a test actually exercises. A module that compiles and
type-checks cleanly can still be one import-graph change away from a
runtime throw that no existing test would have caught, because nothing
ever imported it inside a rendered tree. This is a blind spot Gate 3's
"existing patterns grepped" step doesn't currently prompt for.

**Suggested addition** (target: Debugging discipline / Test data hygiene):
"When wiring a new module into an existing render tree (e.g. a Context
Provider into `App.tsx`), check every transitive import it newly pulls in
for native-module Jest-mock coverage before assuming the existing test
suite protects you — a previously-passing smoke test can mean 'this path
was never exercised,' not 'this path works under Jest.'"

## 7. A missing pre-implementation credential gate is often faster to
resolve by asking the reachable user directly than by writing a Blocked
Report

**What happened**: a design's own requirements baseline named a specific
credential-provisioning step as a formal pre-implementation gate, and the
file the task brief pointed to for that credential was empty (the
credential had not actually been provisioned yet, contrary to what the
gate's "CLOSED" status in the design implied). In an interactive session
with the actual user reachable, asking a direct, specific question
("here's exactly what's missing and where I looked — do you have it?")
resolved the blocker in one turn, versus a formal Blocked Report that
would have stopped all work pending an asynchronous response.

**Why it matters generally**: the Blocked Report format is designed for
async/unattended handoff to an architect. When the session is interactive
and the missing input is something the user plausibly has on hand (an API
key, a credential, a config value), a direct, well-scoped question costs
one turn and keeps momentum; a full Blocked Report is the right tool when
the answer requires research or isn't the immediate user's to give.

**Suggested addition** (target: Blocked Report format / Propose & Proceed):
"Before issuing a Blocked Report in an interactive session, consider
whether the missing input is something the present user is likely to have
directly (a credential, a config value, a yes/no architecture call) — if
so, ask a specific, self-contained question first rather than defaulting
to a full stop-and-document Blocked Report. Reserve the formal Blocked
Report for gaps that need research, approval from someone not present, or
that block the entire task rather than one isolated piece."

## 8. A task brief can cite requirement IDs that don't exist in the
canonical requirements baseline — check the design document's explicit
content before treating this as a blocker

**What happened**: a task brief listed two R-IDs among its "governing
requirements" that, on a full-document grep, simply didn't exist
anywhere in the single canonical requirements file. The requested
behavior itself (two specific state-transition actions) was, however,
fully and unambiguously specified in the governing design document's own
endpoint list and screen inventory — just not tied to a requirement
number matching what the brief cited.

**Why it matters generally**: a missing/wrong R-ID citation in a task
brief is a traceability-numbering problem, not automatically a
behavioral gap. Treating every citation mismatch as a CRITICAL blocker
would stop well-specified work over a clerical issue. The right check is
whether the *design document* (the actual source of truth for
behavior/contracts per the fidelity rules) already specifies the
requested behavior unambiguously — if it does, proceed and flag the
numbering gap as a Proposed-Assumption-adjacent note for the
architect to reconcile in the requirements baseline; only escalate to a
Blocked Report if the design document itself is silent or ambiguous on
the actual behavior, not merely on which R-ID owns it.

**Suggested addition** (target: Design document acceptance / Propose &
Proceed): "When a task brief cites an R-ID that doesn't exist in the
requirements baseline, check whether the governing design document
independently and unambiguously specifies the requested behavior
(endpoint, screen, field). If it does, this is a requirements-baseline
traceability gap — proceed, and record it as a note for the architect to
reconcile, not a Blocked Report. Escalate only if the design document is
also silent or ambiguous on the underlying behavior."

## 9. List screens with a detail push need a nested stack navigator
inside their tab, not a bare tab screen

**What happened**: a task brief asked for a list screen (one tab of a
bottom-tabs navigator) to navigate to a new detail screen "with back
navigation working correctly," without specifying the navigator
structure. A bottom-tabs navigator has no back-stack concept per tab on
its own — pushing a second screen onto a tab requires nesting a
native-stack navigator inside that tab and rendering the stack as the
tab's component, not adding the detail screen as a sibling tab-level
screen.

**Why it matters generally**: this is a well-known React Navigation
pattern, but a brief that just says "add screen X to the tab stack" and
"back navigation should work" doesn't spell out the nesting requirement
— it's easy to read literally as "add another screen to the same
navigator" and get either broken back-navigation or an unwanted item
appearing in the tab bar. The nested-stack requirement also has a
follow-on consequence worth remembering: the outer tab screen needs
`headerShown: false` (or equivalent) to avoid a duplicate header stacking
the tab navigator's own header on top of the nested stack's.

**Suggested addition** (target: Fidelity rules / Pre-code gates → Gate 3
— Task confirmation): "When a brief asks for 'list screen navigates to
detail screen, back navigation works correctly' inside a tab-based app,
default to nesting a stack navigator inside that tab (not adding the
detail screen as a sibling tab-level screen) — this is the only
structure that gives correct back-stack behavior while keeping the tab
bar visible on the list. Remember to suppress the outer tab screen's own
header once nested, or the screen renders two stacked headers."

## 10. Every governing citation in a task brief can be wrong at once —
check them all before assuming at least one anchors correctly

**What happened**: a task brief cited two design-document section numbers
and seven requirement IDs as its governing documents. On inspection,
*both* section numbers pointed at unrelated content (one was about push
notifications, the other about a completely different feature area), and
of the seven R-IDs, three were generic platform/scope statements unrelated
to the task, three didn't exist anywhere in the requirements file at all,
and one was simply the wrong number for the intended requirement (the
correct one existed under a different number, already flagged as a
mismatch in an earlier report). Despite this, the actual requested
behavior was fully and unambiguously specified elsewhere in the same
design document, just under different section numbers than cited.

**Why it matters generally**: a single wrong citation invites the
assumption "the rest of the citations are probably fine" — but citation
drift in a brief (likely from an outdated template or a renumbered
document) can affect *every* citation at once, not just one. The
mitigation already established (check whether the design document
independently specifies the behavior before treating a bad citation as a
blocker) still holds, but it needs to be applied per-citation, not
abandoned once one citation turns out to be wrong and the search for the
*real* location succeeds — each subsequent citation in the same brief
should be checked with the same skepticism, not assumed correct by
association with the ones already verified.

**Suggested addition** (target: Design document acceptance): "Verify
every section/R-ID citation in a task brief independently — do not stop
checking once one turns out to be wrong (or once the real location is
found) and assume the rest anchor correctly. Search the design document
by keyword/feature rather than by the brief's cited numbers alone, and
report every mismatch found, not just the first."

## 11. A brief's literal UI mechanism ("Alert") can be impossible on the
target platform even though the underlying interaction is fine

**What happened**: a task brief asked for a two-step confirmation flow
using a native `Alert`, where the second step required the user to type
in a value. On the actual target platform (Android-only, per this
project's own scope), the OS-level alert API has no text-input
capability at all — the one `Alert` variant in the framework that
supports a text field is restricted to the other platform, which this
project explicitly excludes.

**Why it matters generally**: a brief's suggested UI mechanism can be
platform-specific in a way that isn't obvious from the mechanism's name
alone ("Alert" sounds cross-platform; the text-input variant of it is
not). This is a Gate 1 (Environment)-adjacent check that's easy to skip
because it looks like a UI/UX detail rather than an environment
constraint — but it's really the same class of check as "does this
native API exist on the platform we're actually shipping to."

**Suggested addition** (target: Pre-code gates → Gate 1 — Environment /
Fidelity rules): "When a brief specifies a concrete native UI API by
name (Alert, a specific picker, a share sheet, etc.), verify that exact
API variant exists and behaves as described on the project's actual
target platform(s) before implementing it literally — a platform-scoped
capability gap in a named API is a Gate 1-class finding, not just an
implementation detail to route around silently. Implement the closest
platform-correct equivalent and record the substitution as a Deviation
with the specific platform limitation cited, rather than either forcing
the literal API (crashing or no-op'ing on the target platform) or
silently choosing a different mechanism without comment."

## 12. "Make fields optional where they differ" can force a mechanical
fix at existing call sites even under a strict "no behavior change" rule

**What happened**: a task explicitly instructed merging two divergent
type shapes by making every non-common field optional, under a rule
that otherwise forbade any business-logic, API, or UI-behavior change.
Applying the merge exactly as instructed broke the type checker at an
existing call site that had (correctly, at the time) assumed one of
those fields was always present — the type system now honestly reported
what the merge instruction had just made true. A one-line null-coalescing
fallback fixed it with no actual runtime behavior change (the field is
still always present in practice, per the same assumption already on
record), but *some* code edit beyond the type files themselves was
unavoidable.

**Why it matters generally**: a "type-only, no behavior change" framing
for a task can be in tension with its own explicit instructions once
those instructions are followed literally — widening a type's
optionality is itself a behavior-relevant change from the type checker's
point of view, even when the underlying runtime data never actually
changes. Refusing to touch the consuming file to preserve a narrow reading
of "no logic changes" would leave the task's own mandatory verification
step (`tsc --noEmit` passing) failing — the stricter deliverable
(compiles clean) has to win over the narrower one (touch nothing outside
the type files) when they conflict, and the fix should be the smallest
one that changes zero observable behavior (a `?? []`/`?? undefined`-style
guard, not a rewritten code path).

**Suggested addition** (target: Fidelity rules / Propose & Proceed):
"When a scoped refactor's own instructions (e.g. 'make these fields
optional') will mechanically break type-checking at existing call sites,
treat the resulting minimal, behavior-preserving fix (a null/undefined
guard, not a logic rewrite) as an in-scope, required part of the same
task — not a rule violation and not a separate blocked item — since the
task's own mandatory verification step (a clean type-check) cannot be
satisfied otherwise. Document the specific fix and why it changes no
observable behavior in the Implementation Report's Deviations section
rather than silently including it as if no edit were needed outside the
type files."

## 13. A missing endpoint in an API contract table is easier to spot —
and resolve — by comparing it against an analogous resource in the same
table, and by searching other sections before assuming it's absent

**What happened**: a task brief asked for a "list the current user's
[resource]" call against a specific bare collection endpoint. That exact
endpoint didn't exist anywhere in the design's API contract table for
that resource — only a create and a single-item-detail endpoint did.
The same table, a few rows down, listed a bare list endpoint for a
structurally analogous resource. That asymmetry was the tell that the
missing endpoint wasn't just an editorial gap in an otherwise-complete
table. A search of a *different* section of the same document (grouped
by feature area, not by resource) turned up the actual two endpoints
needed to reconstruct the requested listing.

**Why it matters generally**: a design document's API contract is often
organized by primary resource (Events, Groups, Users), but a specific
capability (e.g. "the current user's own groups," "the current user's
own events") can live in a different section organized by feature
(Settings, Dashboard, Me) rather than under the resource's own heading.
Concluding "this endpoint doesn't exist, therefore I must invent one or
follow the brief's guess literally" without a full-document search for
the capability under a different heading skips a cheap, high-value check.
Comparing the resource's row-set against a structurally similar resource
in the same table is also a fast way to notice an asymmetric gap is
probably deliberate, not accidental.

**Suggested addition** (target: Design document acceptance / Fidelity
rules): "When a task brief asks for an endpoint that doesn't appear
under its resource's own section in the API contract, before treating
it as invented or assuming the brief is simply wrong: (1) check whether
a structurally analogous resource in the same table has the endpoint
the current one is missing — an asymmetry is a signal the gap is
deliberate, not an editorial oversight; (2) search the rest of the
document for the same capability under a different heading (Settings/
Dashboard/Me-style sections often hold 'the current user's own X'
endpoints separately from resource X's own CRUD section) before
concluding no path exists."

## 14. A feature can be mentioned consistently across a design document
(screen inventory, a requirement, even a notification-type mapping)
and still have no backing endpoint anywhere in the API contract

**What happened**: a design document referenced a specific feature (a
computed/aggregated view) by name in at least three independent places —
a screen inventory entry, a requirement statement explicitly describing
its data-integrity property, and a push-notification-type-to-screen
mapping table — with consistent, confident language each time. A
full-document search for the feature's own API route turned up nothing:
no endpoint anywhere provides the data that view would need to render.
Two of the three ways to build it anyway were both independently
forbidden — one by the "nothing invented" fidelity rule (no undocumented
endpoint), the other by the very requirement that named the feature (no
client-side computation of exactly this kind of data).

**Why it matters generally**: repetition across a design document is not
the same evidence as a concrete route existing — a feature can be
"real" in every prose sense (the architect clearly intends it, refers
to it by a stable name, ties it into notification routing) while still
being an unbuilt or under-specified backend capability. Don't let
multiple *consistent* mentions substitute for checking the one place
that actually matters for implementation: the API contract table. This
is a stronger and subtly different check than #13 (missing endpoint
under the resource's own heading) — here, the gap isn't that the
endpoint lives elsewhere in the document, it's that it doesn't exist
anywhere in the document at all, despite the feature being named
repeatedly.

**Suggested addition** (target: Design document acceptance / Propose &
Proceed): "When a design document names a specific feature in its
screen inventory, a requirement, or any cross-reference table (not just
the resource's own API contract section), still verify a concrete
endpoint exists for it before treating it as buildable — consistent
mentions across multiple sections is not proof a route exists. If no
task in the current scope actually requires building that specific
feature, it's not a blocker — flag the gap for whichever future task
does need it, rather than resolving it now via an invented endpoint or
a forbidden client-side computation."
