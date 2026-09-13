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
