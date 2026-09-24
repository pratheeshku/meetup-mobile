# Agent Enhancement Notes — 2026-09-24

## Shape-description comments drift across files when only one file's logic changes

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
