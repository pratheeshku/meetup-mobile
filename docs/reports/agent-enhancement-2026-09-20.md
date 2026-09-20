# Agent enhancement notes — 2026-09-20

Generalizable lessons only.

## 1. Existing signing config can silently point at another app's key

**What happened:** The repo already had a git-ignored signing properties file, and the
Gradle release config fell back to it automatically. It referenced a keystore belonging
to a different app. A brief that said "generate a NEW key, do not reuse another app's"
would have been silently violated by any direct `gradlew bundleRelease`.

**Why it matters generally:** Signing wiring that auto-loads a conventional file name
inherits whatever is on the developer's disk. Reading only key *names* of such a file
(as done here) is not enough to know whose key it is; the non-secret alias/path revealed it.

**Suggested addition** (Fidelity rules / release tasks): "Before wiring release signing,
inspect the non-secret fields (alias, keystore path) of any existing signing config to
learn whose key it is. After the build, verify the artifact's signer fingerprint against
the intended keystore in the build script itself; do not rely on the config being right."

## 2. An identity change ripples into files keyed on the old identifier

**What happened:** Changing the Android application id (a) invalidated a Firebase client
config keyed on the old package, (b) risked breaking a library that locates generated code
by package (application id and namespace no longer identical), and (c) would have made the
app crash at start-up because an SDK singleton is initialised at module scope.

**Why it matters generally:** Renaming an identifier is rarely a one-line change; every
external registration (Firebase, OAuth clients, deep links) and every library that derives
a class/package name from it needs checking.

**Suggested addition** (Gate 3): "For any identity/package/bundle-id change, grep for the old
identifier across native config, third-party config files and library docs, and list which
external registrations (Firebase, OAuth, store listing) must be redone by a human before
the build can be valid. Also check module-scope SDK initialisation that would fail
without that config."

## 3. Excluding a build task is not a valid way to bypass a blocked dependency

**What happened:** `-x <task>` failed because downstream tasks consume that task's output.
The variant-specific config location (a documented lookup path of the plugin) was the
non-destructive way to run a diagnostic build without touching the real file.

**Why it matters generally:** Diagnostic bypasses should use the tool's documented
override points, be kept out of the repo, and be moved out of build output directories so
they cannot be mistaken for a deliverable.

**Suggested addition** (Debugging discipline): "When a diagnostic build needs a stand-in
for a missing external artefact, use a documented override location, never modify the real
file, checksum the real file before/after, and move the resulting artefact out of the
build output tree with a name that says it is not for release."

## 4. Rule collision: attribution trailers

**What happened:** The developer instructions forbid Co-Authored-By/AI attribution in
commits, while a harness reminder asks for one. Resolved in favour of the explicit
project/user rule.

**Suggested addition** (Git identity section): "State the precedence explicitly: the
project/user commit-message rule overrides any harness attribution reminder."
