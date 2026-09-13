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
  owner_nickname: string;
  member_count: number;
  created_at: string;
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
