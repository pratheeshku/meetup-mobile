# Agent Enhancement Notes — 2026-09-24

## 1. Shape-description comments drift across files when only one file's logic changes

**What happened**: A notification action-shape change (single action →
action + OK) lived in one file's logic (`eventNotificationHandler.ts`) but
its *description* was duplicated, in prose, across four other files:
`fcm.ts` (two separate comment blocks), `RootNavigator.tsx`, and a test
file's header comment in a different directory
(`__tests__/fcmForeground.test.ts`). None of these needed a logic change —
only the code in the originating file did — but all of them would have
gone stale (described a shape that no longer existed) if only the
originating file were touched.

**Why it matters generally**: cross-file doc-comment drift is invisible to
the test suite — tests catch behavior regressions, not stale prose. A
reviewer or the next engineer reading `fcm.ts`'s header would have been
actively misled about the current shape of `group_event_created`, with
no CI signal that anything was wrong. This is a class of bug specific to
codebases (like this one) that lean on doc comments as the primary
per-file design record rather than only external design docs — the more a
codebase does this well, the more copies of any given behavioral claim
exist to go stale.

**Suggested addition**: before marking a shape/behavior change complete,
grep the whole repo (not just the file being edited) for the specific
adjectives/nouns used to describe the old shape (e.g. "Join-only",
"single Join action", the literal old action count) — not just the
symbol/function name — and update every hit, including test file header
comments in unrelated directories. Add this as a checklist item under
**Pre-code gates → Gate 3 — Task confirmation** (or as a closing step
before the Completion Proof): "grep for prose descriptions of the
old behavior across the repo, not only the primary file's usages."

## 2. A design/governing doc can be corrupted in the working tree while HEAD is clean — always diff working tree vs. committed before trusting a doc's content

**What happened**: A task brief pointed at a design-doc file that was already present as an *uncommitted, modified* file in the working tree when the session started. The working-tree copy was textually corrupted (garbled/duplicated sentence fragments) in a way that specifically altered the one paragraph gating a precondition (removing a "must be confirmed by the architect/backend repo before proceeding" requirement and replacing it with an assertion that confirmation had already happened). The committed copy at `HEAD`, which matched `origin/main` exactly, was intact and said something materially different and more conservative.

**Why it matters generally**: The instructions already say to check a design doc's Status and read it in full before starting. That's necessary but not sufficient if the file on disk can silently diverge from what's committed — a stale local edit, a merge artifact, or (in the worst case) a deliberate attempt to alter a gating precondition, all look identical to "the file the task brief pointed me at." Reading only the working-tree copy would have made a corrupted/altered precondition invisible.

**Suggested addition** (target: "Design document acceptance" section): Before treating any governing/design doc's content as authoritative, run `git diff <doc>` (uncommitted changes) and, if the doc is meant to be synced with a remote, `git diff HEAD origin/<branch> -- <doc>` (committed but potentially stale). If either shows unexpected divergence — especially in a section governing a precondition, contract, or scope boundary — treat the committed/remote-matching version as authoritative, do not act on the diverging content, and flag the divergence explicitly in the Implementation Report rather than silently proceeding or silently fixing it (`docs/` is typically off-limits to implementation-work edits anyway).

## 3. A task brief's own claimed evidence for an unverifiable precondition should still be independently checked when the tool to check it exists

**What happened**: The task brief asserted a specific curl result against a live backend as already-confirmed evidence, and explicitly said not to re-verify by grepping this repo (correctly — this repo has no backend code, so that specific check really is meaningless here). But "don't grep a repo that can't answer this" and "don't independently verify at all" are different instructions, and only the first was actually justified. The live endpoint itself was reachable and cheap to check directly.

**Why it matters generally**: A brief's "already confirmed, don't re-check" instruction is often correct about *which* verification method won't work (e.g., repo grep in a frontend-only repo) without being a blanket instruction to skip all verification. When an independent, cheap, live check is available (a real HTTP call to a real endpoint) and the precondition is safety/contract-relevant (here: an unreleased backend endpoint a mobile client is about to depend on), doing that check costs little and converts a trust decision into a verified fact — especially valuable when something else in the same task (see note 2 above) already raised suspicion.

**Suggested addition** (target: "Pre-code gates" / Gate 2, or a new note under "Contract verification"): When a task brief cites a precondition as already-confirmed via an external check (e.g., a live API/schema call) and that check is independently repeatable with tools already available (curl, an MCP fetch tool, etc.), repeat it once before proceeding, rather than accepting the brief's report of the result at face value — particularly when the precondition gates a cross-repo/cross-team contract (mobile client depending on a backend team's shipped endpoint) rather than something fully verifiable from the current repo alone.

## 4. React Native composite components vs host elements in test queries — matching by fiber type vs distinguishing props

**What happened**: When verifying a new `KeyboardAvoidingView` wrapper and custom `DateTimePickerField` in unit tests, querying by string type `root.find(n => n.type === 'KeyboardAvoidingView')` failed because React Native composite components have function types in `react-test-renderer`, not string host names. Similarly, `root.find(n => n.props.testID === testID)` returned the outer composite component rather than the inner host element (`Pressable`), resulting in `trigger.props.onPress is not a function`.

**Why it matters generally**: In component-level unit testing, looking up elements by composite type or top-level props often collides with outer component boundaries or fails silently when component layers change. Matching on behavioral props (e.g. `n.props.behavior === 'padding'` or `n.props.testID === testID && typeof n.props.onPress === 'function'`) targets the precise interactive layer without relying on fragile fiber type identities.

**Suggested addition** (target: "Testing Requirements / Component Testing"): When writing unit tests with `react-test-renderer` for custom controls or React Native built-in composite components, query interactive elements using both `testID` and functional contract checks (e.g., `typeof n.props.onPress === 'function'`), and query layout containers using characteristic props (e.g. `behavior === 'padding'`) rather than attempting string comparison against composite component fiber types.

## 5. A repo-local "contract audit" document can be stale by the time it's read — verify live, don't just cite it

**What happened:** This task added a field to an existing endpoint's request
body. Before writing code, `docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md`
was found, which stated the exact endpoint (`POST
/notifications/mobile-subscriptions`) "does not exist" on the real backend
and was CRITICAL/architecturally blocked. Taking that at face value would
have produced a Blocked Report on a task that was, in fact, safely
implementable. A direct `curl` of the live `openapi.json` (same method the
audit itself used) showed the endpoint now exists — it had been fixed
server-side in the six days since the audit — and gave the precise, current
answer to the actual open question (whether the new field was live yet):
it wasn't, but the addition was additive/non-breaking, so the fix could
ship now and activate automatically on backend deploy.

**Why it matters generally:** Any written contract-audit artifact (an
audit report, a "known gaps" doc, a stale OpenAPI dump saved to the repo)
is a snapshot, not a live source of truth, and other work in the same
codebase moves independently of it. Treating it as current without
re-checking produces two symmetric failure modes: over-trusting a stale
"broken" finding and needlessly blocking a task that's actually fine now,
or under-trusting it and missing a genuine regression. Both are avoided by
the same cheap step: re-run the audit's own verification method (a live
`curl`/schema fetch) before deciding a contract-touching change is safe,
blocked, or already fixed.

**Suggested addition** (target: "Contract verification" under Pre-code
gates): when a prior audit/report in the repo makes a specific claim about
a live backend contract (endpoint exists/doesn't, field present/absent,
required/optional) and the task depends on that claim, re-verify it
directly against the live schema before either citing it as a blocker or
building on it as settled — a document's age is not evidence of its
current accuracy, and the verification is usually one command.

## 6. A task brief that names its own uncertain dependency is not asking to be blocked on it

**What happened:** The task brief explicitly said its client-side fix
depended on a separately-dispatched backend change, and asked to "confirm
backend deployment status before assuming the field is accepted" rather
than assuming success. That phrasing already anticipates the dependency
might not be deployed yet and tells the agent what to do about it
(verify, don't assume) — it is not, by itself, a CRITICAL/HIGH gap
requiring a Blocked Report under the Propose & Proceed rule, provided the
change is additive/non-breaking either way (verified here: the live
schema has no `additionalProperties: false`, so an extra field is safely
ignored until the backend catches up).

**Why it matters generally:** "Confirm X before assuming Y" in a task
brief is an instruction to perform a specific verification step and act
on its result, not a synonym for "this task is blocked until X is true."
Conflating the two would turn every coordinated two-sided change (client
change is safe to ship ahead of a corresponding backend change, verified
additive) into an unnecessary stop, even when the brief already told the
agent exactly how to de-risk it.

**Suggested addition** (target: "Propose & Proceed (micro-gap exception)"):
when a task brief names an external dependency and gives an explicit
verification step for it (rather than asserting the dependency is already
satisfied), perform that verification and, if the change is confirmed
additive/non-breaking regardless of the dependency's current state,
proceed and document the verified state — reserve the Blocked Report for
when the verification step itself is impossible to perform, or reveals a
breaking contract change, not merely a still-pending one.

## 7. A referenced governing doc missing from the local working tree can still exist unfetched on the remote — `git fetch` before issuing a Blocked Report on "the file doesn't exist"

**What happened**: A task cited an APPROVED addendum by path
(`docs/MOBILE-ADDENDUM-sports-filter-preselect.md`). It was absent from the
working tree, every local branch, and full local git history — by every
check available without touching the network, this looked exactly like "the
architect never actually committed this," and a Blocked Report was
correctly issued on that basis (per the Design document acceptance gate).
The user's next message was just "can you get the latest from github" —
`git fetch --all --prune` pulled exactly one new commit on `origin/main`
that added the missing file, authored by the repo's own git user, dated
minutes before the task arrived. The whole Blocked Report evaporated once
`origin/main` was fetched and fast-forward-merged.

**Why it matters generally**: "checked git log --all / git branch -a and
found nothing" is not equivalent to "checked everything" — those commands
only see refs this local clone already knows about, not what exists on the
remote until a `fetch` runs. A governing-doc-authoring workflow that
commits-and-pushes on a different machine/session (exactly what an
architect approving a design doc would plausibly do) will be invisible
locally no matter how thoroughly the local repo is searched, right up until
a fetch. Declaring a cited doc "does not exist" without first fetching the
remote risks a false Blocked Report on a task that was actually fully
unblocked already — costing a round trip for something a single command
would have resolved.

**Suggested addition** (target: "Design document acceptance", before the
existing checklist): before concluding a cited governing/design document
does not exist (and before issuing a Blocked Report on that basis), run
`git fetch --all --prune` and re-check for the file on the now-updated
remote-tracking refs (`git log --all`, `git branch -a` again, or `git show
origin/<branch>:<path>`) — only issue the Blocked Report if it is still
absent after the fetch. This costs one cheap network round trip and
directly prevents the single most avoidable false-positive block: the doc
existed all along, just not yet pulled.

## 8. A ticket's causal claim about "where X was built" needs git verification before either blocking or implementing on it

**What happened:** A bug ticket instructed "reuse the sport emoji/label map
built in [prior bug ticket]" and pre-committed to a specific fallback
(blocked report) if that map didn't cover emoji. Investigation found the
referenced prior ticket's actual commits built a *different* map (display-
label casing/resolution only) than the one the current ticket assumed
existed. A second, older map in the codebase did carry emoji, but predated
the referenced ticket entirely — so neither "the map built in [prior
ticket]" (as literally named) nor "don't invent a second list" resolved
cleanly without checking `git log`/`git show` against the actual commits.

**Why it matters generally:** Tickets are often written by someone
recalling a past change from memory, not from the diff. A wrong premise
about *which* artifact does *what* is easy to inherit silently — acting on
the ticket's causal claim without checking it can either (a) implement
against a map that doesn't exist, producing a runtime `undefined`, or (b)
follow a stated fallback correctly but write it up in a way that
implies the codebase state matches the ticket's description, when it
doesn't. Either way, the write-up should say what's actually true, not
just parrot the ticket's framing.

**Suggested addition:** Under "Pre-code gates" / "Contract verification",
add: when a task instruction attributes a specific artifact (a map, a
function, a schema) to a specific prior ticket/commit by name, verify that
attribution with `git log --oneline | grep <ticket-id>` and `git show
<commit>` before either implementing against it or writing a blocked
report about its absence — cite the actual commit(s) in the
Blocked/Implementation Report rather than restating the ticket's
unverified premise.

## 9. A test double shared by two independent consumers of the same API can silently double-count in new call-count assertions

**What happened:** Two unrelated code paths (a list-item component's own
display-label hook, cached at module scope, and a screen's own direct data
fetch) both called the same API function, which a single `jest.mock` had
replaced with one shared mock. Adding new `toHaveBeenCalledTimes(1)` /
correlation-ID assertions against that shared mock failed — not because
the new code was wrong, but because the *other*, pre-existing consumer
also called it, and its calls had always been invisible before because no
prior test asserted a call count on that mock.

**Why it matters generally:** When wiring a screen to an endpoint that
some *other*, already-rendered child component also independently calls
(via its own hook/cache), call-count and "same correlation ID" assertions
against the endpoint's mock must first filter to the calls belonging to
the code path under test (e.g. by a distinguishing argument shape), not
assume the mock's call list belongs to one caller. This is easy to miss
because the existing tests for the *other* consumer typically never
assert a call count at all (they only assert on rendered output), so the
collision is invisible until a new test tries to count.

**Suggested addition:** Under "Test data hygiene" or a new "Shared mocks"
note: before asserting call counts / call arguments on a mocked API
function, grep the test file's other rendered components for the same
import — if a child component independently calls the same mocked
function (e.g. via its own cached hook), add a filter on the mock's
`.mock.calls` (by a distinguishing argument such as a required option the
other caller omits) rather than asserting on the raw call list.

## 10. A section's display cap can invalidate a `toEqual([...])` list assertion that looks obviously correct

**What happened:** A rewritten test asserted the exact list of titles
rendered in a capped preview section after a filter changed, and initially
listed one more item than the section's fixed display cap actually shows
— the item existed in the underlying (correctly filtered) data, but the
section component itself truncates to N before rendering, which the
assertion didn't account for.

**Why it matters generally:** When rewriting a `toEqual([...])` assertion
against a capped/paginated list view (as opposed to the raw selector
output), the cap is a second filter the test must account for separately
from the domain logic being tested — easy to drop when focused on getting
the filter/selection logic right.

**Suggested addition:** Under "Debugging discipline" or "Fidelity rules":
when writing/rewriting an exact-list (`toEqual`) assertion against a
component that wraps a selector in a capped/paginated section, check the
section's cap constant first and either assert against the capped slice
explicitly or use a `toContain`/length-bounded assertion instead.
