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
