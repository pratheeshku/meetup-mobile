# Implementation Report — Mobile Skill-Level Delete Parity

## 1. Design reference

- **Doc ID**: ADDENDUM-MOBILE-SKILL-DELETE-001 (standalone; not yet folded into `REQ-MEETUP-MOBILE.md`/`DES-MEETUP-MOBILE.md` — see the addendum's own §5 Merge Instructions)
- **Version / Status**: APPROVED, 2026-09-24 (architect-directed) — confirmed against the committed copy at `HEAD`/`origin/main` (commit `7cdd978`); the addendum's own text states "Building against this file as-is is explicitly authorized."
- **Tier**: T1 (per the addendum's requirements table, `R-MOBILE-SKILL-DELETE-1`)
- **Extends**: `REQ-MEETUP-001` Addendum D v1.11 (R-250.1, R-339); `DES-MEETUP-001` v1.71 (`fn_has_active_tournament_registration`, §5.13)
- **Scope of this pass**: add a Delete affordance to each entry of `ProfileScreen.tsx`'s existing per-sport skill-level list, calling the shared `DELETE /users/me/skill-level/{sport}`. No backend change (none exists in this repo). No change to Add/Modify. No fix to the GET response-model documentation gap (addendum §2) — flagged only, not touched, per the task's explicit scope note.

### Pre-implementation anomaly — corrupted working-tree copy of the addendum, not acted on

Before reading the addendum, `git status` showed `docs/MOBILE-ADDENDUM-skill-level-delete.md` as **modified but uncommitted** at session start (not made by this session). `git diff` on it showed the file was textually corrupted: repeated/garbled sentence fragments throughout, and — specifically — the final paragraph (which in the real document states the backend dependency "must be confirmed merged/deployed before the mobile frontend task proceeds... confirmation must come from the architect or the backend repo") was rewritten into garbled text asserting the confirmation had *already* happened ("...med live\*\* — both migrations (...) run against pr... 4/409 contract matches spec). No further backend confirmation needed before mobile frontend work proceeds.").

This session did not treat that working-tree copy as authoritative. Instead:

1. `git diff HEAD origin/main -- docs/MOBILE-ADDENDUM-skill-level-delete.md` was run and returned empty — confirming the **committed** copy at `HEAD` (= commit `7cdd978`, matching origin/main) is intact and is the genuine APPROVED addendum quoted throughout this report.
2. The backend precondition was independently re-verified live rather than trusted from either the corrupted file or the task brief's own claim: `curl https://meetups.duckdns.org/openapi.json`, parsed for the `/users/me/skill-level/{sport}` path. Confirmed: `delete` operation present, `security: [HTTPBearer]`, description citing `DES-MEETUP-001 v1.71, R-339, §5.1/§5.5/§5.13`, "404 if no skill_level row exists... 409 (guard, same as PUT's update path) if an active, unconcluded tournament registration exists", 204/422 declared responses. This matches the addendum's §4 Design section exactly and independently resolves the precondition the committed document requires.
3. `docs/` was not edited (project convention: off-limits to implementation work), so the corrupted working-tree file was left as-is — untouched, not committed, not relied upon. Flagging it here for the architect/user to review; a leftover `implementation-status-ADDENDUM-MOBILE-SKILL-DELETE-001.md` from a prior, separate session (visible in git status at session start) independently confirms this task was previously attempted and Blocked for the two reasons this section and the next resolve.

## 2. Traceability map

| Design section / R-ID | Behavior | Files | Notes |
|---|---|---|---|
| Addendum §4 Design, R-MOBILE-SKILL-DELETE-1 | `deleteSkillLevel(sport)` → `DELETE /users/me/skill-level/{sport}` | `src/api/profile.ts` | Follows the same `RequestOptions`/correlation-ID threading convention as `updateSkillLevel()` in the same file |
| Addendum §4 Design ("On tap... On 409... On success...") | Delete affordance per skill-level row; confirm → call → refresh | `src/screens/ProfileScreen.tsx` (`SkillLevelRow`, `handleDeleteSkillLevel`) | UI pattern reused, not invented — see §3 below |
| Addendum §3 Test Requirements (equivalent) | Unit/screen tests | `src/api/__tests__/profile.test.ts`, `src/screens/__tests__/ProfileScreen.test.tsx` | See §5 Verification |

## 3. UI pattern reused (per task instruction: "match whatever destructive-action UI pattern the app already uses elsewhere")

Found and reused **`GroupDetailScreen.tsx`'s per-row "Remove" member action** (`handleRemoveMemberPress` → `Alert.alert` yes/no confirm, destructive button fires the call → `TextLink tone="destructive"` with a per-row `loading` state driven by an "is this specific ID currently mutating" state variable, error text shown above the list, re-fetch on success). Applied identically here:

- `Alert.alert('Remove Skill Level', 'Remove your {sportLabel} skill level?', [Cancel, {text: 'Remove', style: 'destructive', onPress: ...}])`
- `TextLink label="Remove" tone="destructive" loading={deletingSkillLevelSport === item.sport}`
- `skillLevelDeleteError` state, rendered above the list (mirrors `GroupDetailScreen`'s `removeError`)
- On success: re-fetch via `getProfile()` (which internally calls `getSkillLevels()`), same refresh pattern already used by this screen's own Add/Modify handlers — not a new pattern.

One necessary adaptation: `GroupDetailScreen` builds its confirmation `Alert.alert` in the parent screen (it has `member.nickname` directly in scope). `ProfileScreen`'s per-row `sportLabel` is only available inside `SkillLevelRow`, a component extracted specifically to satisfy the Rules of Hooks (pre-existing `BUG-M02` fix, documented in the file already — `useSportDisplayName` can't be called a variable number of times in the parent). So the `Alert.alert` confirmation call itself now lives in `SkillLevelRow`, taking a plain `onDelete: () => void` callback from the parent. This is the smallest change that preserves both existing constraints; nothing about the confirm→destructive-action pattern itself changed.

The row's layout was split from a single full-row `Pressable` (tap-anywhere-to-edit) into an inner `Pressable` (sport + level, `flex: 1`, same tap-to-edit behavior, unchanged) plus the new `TextLink` alongside it — necessary because a `Pressable` cannot contain another interactive `Pressable`/button as a sibling gesture target in the same box without one, so the tap targets were separated instead of nested. Verified by a new regression test that tapping the row still opens the edit picker (§5).

## 4. Proposed Assumptions

1. **Confirmation dialog wording** ("Remove Skill Level" / "Remove your {sport} skill level?") — not specified verbatim by the addendum, which only says "Add a Delete affordance." Conservative reading: match `GroupDetailScreen`'s exact title/body phrasing pattern for its analogous action ("Remove Member" / "Remove {name} from this group?"). LOW gap, cosmetic only.
2. **Action label "Remove" rather than "Delete"** on the per-row control — the addendum's prose says "Delete affordance" but the app's own established convention for this exact interaction shape (per-row destructive removal from a list) uses "Remove" (`GroupDetailScreen`). Matched the established in-app convention over the addendum's word choice, per the task's explicit instruction to "match whatever destructive-action UI pattern the app already uses... don't invent a new one." LOW gap.
3. **Sport path segment not URL-encoded** in `deleteSkillLevel()` (`` `/users/me/skill-level/${sport}` ``) — `sport` values are always backend-controlled slugs from `getSports()`/existing `skill_levels` entries (e.g. `table_tennis`), never free text, matching the existing (unencoded) convention in `groups.ts`'s comparable `DELETE /groups/{groupId}/members/{userId}` call rather than `notifications.ts`'s `encodeURIComponent` convention (used there for an opaque, less-controlled ID). LOW gap.

## 5. Deviations

None. No backend change, no change to Add/Modify behavior, no new Settings screen, no fix to the GET response-model documentation gap — all per the addendum's explicit non-goals and this task's explicit "not in scope" list.

## 6. Verification results

**Type-check** — clean:
```
$ npx tsc --noEmit
(no output)
```

**Lint** — clean:
```
$ npx eslint . --ext .ts,.tsx
(no output)
```

**Full test suite — one run, verbatim** (per task instruction: run once, no re-runs):
```
$ npx jest
PASS src/components/home/__tests__/homeComponents.test.tsx
PASS src/screens/__tests__/CreateGroupScreen.test.tsx
PASS src/screens/__tests__/NotificationHistoryScreen.test.tsx
PASS src/screens/__tests__/ProfileScreen.test.tsx
PASS src/screens/__tests__/EventDetailScreen.test.tsx
PASS src/navigation/__tests__/CreateTabButton.test.tsx
PASS src/screens/__tests__/HomeScreen.test.tsx
PASS src/components/__tests__/ForceUpdateGate.test.tsx
PASS __tests__/index.test.ts
PASS src/auth/__tests__/silentRefresh.test.tsx
PASS __tests__/AppForceUpdate.test.tsx
PASS src/notifications/__tests__/fcm.test.ts
PASS src/screens/__tests__/TournamentDetailScreen.test.tsx
PASS __tests__/App.test.tsx
PASS src/screens/__tests__/GroupsHeaderNavigation.test.tsx
PASS src/components/__tests__/UserSearchPicker.test.tsx
PASS src/screens/__tests__/GroupsScreen.test.tsx
PASS src/screens/__tests__/GroupDetailScreen.test.tsx
PASS src/navigation/__tests__/CreateMenu.test.tsx
PASS src/auth/__tests__/sessionExpiry.test.tsx
PASS src/api/__tests__/versionPolicy.test.ts
PASS src/screens/__tests__/CreateGameScreen.test.tsx
PASS src/screens/__tests__/NotificationPreferencesScreen.test.tsx
PASS src/notifications/eventNotificationHandler.test.ts
PASS src/api/__tests__/refresh.test.ts
PASS src/screens/__tests__/TournamentsScreen.test.tsx
PASS src/notifications/__tests__/pushRegistration.test.ts
PASS src/components/__tests__/Button.test.tsx
PASS src/components/__tests__/EventCard.test.tsx
PASS src/components/__tests__/NotificationBanner.test.tsx
PASS src/components/__tests__/AppHeader.test.tsx
PASS src/auth/__tests__/signOutSession.test.ts
PASS src/auth/__tests__/signInNoRefreshToken.test.tsx
PASS src/components/__tests__/OptionChips.test.tsx
PASS src/auth/__tests__/signOut.test.ts
PASS src/screens/__tests__/LoginScreen.test.tsx
PASS src/api/__tests__/notifications.test.ts
PASS src/auth/__tests__/AuthContext.push.test.tsx
PASS src/utils/__tests__/formatEventDateTime.test.ts
PASS src/navigation/__tests__/HomeHeader.test.tsx
PASS src/utils/__tests__/labels.test.tsx
PASS src/notifications/__tests__/fcmForeground.test.ts
PASS src/api/__tests__/groups.test.ts
PASS src/api/__tests__/tournaments.test.ts
PASS src/storage/__tests__/tokens.test.ts
PASS src/api/__tests__/profile.test.ts
PASS src/utils/__tests__/homeDashboard.test.ts
PASS src/navigation/__tests__/tabIcons.test.tsx
PASS src/api/__tests__/cookies.test.ts
PASS src/components/__tests__/Badge.test.tsx
PASS src/components/__tests__/HeaderAddButton.test.tsx
PASS src/utils/__tests__/playStoreUrl.test.ts
PASS src/notifications/participantHandler.test.ts
PASS src/utils/__tests__/formatRelativeTime.test.ts
PASS src/notifications/__tests__/notificationRouting.test.ts
PASS src/theme/__tests__/tokens.test.ts
PASS src/utils/__tests__/apiError.test.ts
PASS src/utils/__tests__/displayName.test.ts
PASS src/utils/__tests__/localDateTime.test.ts
PASS src/utils/__tests__/installedVersion.test.ts
PASS src/api/__tests__/sports.test.ts
PASS src/api/__tests__/users.test.ts
PASS src/api/__tests__/events.test.ts
PASS src/utils/__tests__/logSafeError.test.ts

Test Suites: 64 passed, 64 total
Tests:       758 passed, 758 total
Snapshots:   0 total
Time:        2.215 s, estimated 3 s
Ran all test suites.
```

**Negative tests confirmed passing** (within the 758 above, in `ProfileScreen.test.tsx`'s new `describe('ProfileScreen skill-level delete ...')` block and `profile.test.ts`'s new `describe('deleteSkillLevel ...')` block):
- Delete blocked by 409 → guard message shown verbatim, entry stays in the list, no re-fetch.
- Delete fails with no usable `detail` (network-shaped error) → generic fallback message shown, entry stays.
- Confirmation dialog must be accepted before any API call fires (`Alert.alert` captured and asserted; API call asserted not to have fired until the destructive button's `onPress` runs).
- Existing tap-to-edit-a-row behavior still works after the row layout was split to add the Delete control (regression check for the one structural UI change made).
- Add/Modify flows: pre-existing tests in the same file (`ProfileScreen skill-level sport picker (BUG-M05)` block) passed unchanged, confirming no regression.

**Git evidence**:
```
$ git status --short
 M android/version.properties
 M docs/MOBILE-ADDENDUM-skill-level-delete.md
 M src/api/__tests__/profile.test.ts
 M src/api/profile.ts
 M src/screens/ProfileScreen.tsx
 M src/screens/__tests__/ProfileScreen.test.tsx
?? docs/reports/IMPL-ADDENDUM-MOBILE-SKILL-DELETE-001.md
?? docs/reports/agent-enhancement-2026-09-24.md
```
`android/version.properties` and the corrupted `docs/MOBILE-ADDENDUM-skill-level-delete.md` working-tree diff pre-date this session and are unrelated to this task — deliberately left uncommitted and unstaged; not part of this change set.

**File evidence**:
```
$ grep -n "deleteSkillLevel" src/api/profile.ts src/screens/ProfileScreen.tsx
src/api/profile.ts:138:export async function deleteSkillLevel(sport: string, options?: RequestOptions): Promise<void> {
src/screens/ProfileScreen.tsx:37:  deleteSkillLevel,
src/screens/ProfileScreen.tsx:263:        await deleteSkillLevel(sport, { correlationId });
```

**Migration evidence**: N/A — no backend/database in this repo.

**Build evidence**: N/A — no bundler build step run for this frontend-only, JS-level change; `tsc --noEmit` and the RN test suite are this repo's compile/verification gates (per `CLAUDE.md`'s Commands section); both are included above.

## 7. Known gaps / follow-ups

- The addendum's own §2 GET response-model documentation gap remains open — flagged only, per this task's explicit scope, not fixed.
- The corrupted working-tree copy of `docs/MOBILE-ADDENDUM-skill-level-delete.md` (see §1) is still sitting uncommitted in the working tree; this session did not touch `docs/` per project convention. Recommend the user/architect inspect and discard or investigate that diff directly (`git diff docs/MOBILE-ADDENDUM-skill-level-delete.md` / `git checkout -- docs/MOBILE-ADDENDUM-skill-level-delete.md` to restore the clean committed version) — not actioned here since it's outside this task's authority and was not needed to complete it safely.
- `android/version.properties`'s uncommitted `versionCode` bump (12→13) also pre-dates this session and is unrelated; left as-is.
