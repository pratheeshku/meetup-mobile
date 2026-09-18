/**
 * Group domain types (DES-MEETUP-MOBILE.md §4.4, §7.3, §7.5; R-030, R-031).
 *
 * Field list and enum values as specified in the task brief. The local
 * design excerpt's API contract (§7.3, §7.5) lists Groups endpoints
 * (method/path/auth-required) only, not response body schemas — the
 * parent backend design (DES-MEETUP.md) is not available in this repo,
 * the same class of gap already recorded for every other module's
 * endpoints in this project. Correct against the actual backend
 * contract on conformance review.
 */
export type GroupMemberRole = 'owner' | 'admin' | 'member';
export type GroupRole = GroupMemberRole | 'none';

export interface GroupMember {
  user_id: string;
  nickname: string;
  role: GroupMemberRole;
  joined_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  /**
   * Full-contract-audit finding (2026-09-18, see
   * docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md): the real backend's
   * `GroupResponse` (confirmed via live OpenAPI schema) has no
   * `owner_nickname`/`member_count` fields at all — only `getGroup()`
   * (which also fetches the member list) can derive these accurately.
   * `getMyGroups()`'s list items cannot, without an N+1 fan-out call per
   * group (flagged for an architect decision, not implemented), so both
   * are optional here.
   */
  owner_nickname?: string;
  member_count?: number;
  created_at: string;
  /**
   * On `getMyGroups()` list items: a Proposed Assumption ('owner' for
   * items sourced from `/settings/groups-owned`, 'member' for items from
   * `/settings/groups-member` — the real backend gives no way to tell
   * 'admin' apart from 'member' for the latter without an extra
   * per-group members-list call). Cosmetic only — this list screen does
   * not gate any action on it.
   * On `GroupDetail` from `getGroup()`: not reliable (`api/groups.ts` has
   * no access to the current user's id) — screens must compute the
   * authoritative value themselves from `members` + the signed-in user's
   * id (see `GroupDetailScreen`).
   */
  current_user_role: GroupRole;
}

/**
 * Proposed Assumption: `GroupDetail` (an addition beyond the brief's
 * single, literal `Group` interface) extends `Group` with the member
 * list. The brief's own Step 4 requires displaying a "Members list with
 * role badges" on the Group Detail screen, but no separate "list group
 * members" endpoint exists anywhere in the design's API contract (§7.3
 * lists only `GET /groups/{id}`, invite/role/remove — no member-listing
 * GET). Assumed `GET /groups/{id}` embeds the member list — the only
 * plausible data source, the same resolution already used for
 * `UserProfile.skill_levels` in the profile module. Kept as a separate
 * type from `Group` (rather than adding `members` directly to `Group`)
 * because `Group` is also the item shape returned by the lightweight
 * `getMyGroups()` list, which has no reason to embed every group's full
 * member roster — only `getGroup()`'s single-item detail fetch does.
 */
export interface GroupDetail extends Group {
  members: GroupMember[];
}

export interface GroupsListResponse {
  items: Group[];
  total: number;
  page: number;
  page_size: number;
}
