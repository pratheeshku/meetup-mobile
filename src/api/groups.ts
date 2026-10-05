/**
 * Groups API (DES-MEETUP-MOBILE.md §4.4, §7.3, §7.5; R-030, R-031).
 *
 * All calls go through the shared `apiClient` (`src/api/client.ts`) —
 * auth header injection, correlation ID propagation, and the 401
 * refresh-and-retry flow are already handled there and are not
 * duplicated here.
 *
 * Each function accepts an optional trailing `{ correlationId }` so a
 * caller performing a multi-call logical action (e.g. change a role,
 * then re-fetch the group to refresh its member list) can thread one
 * shared correlation ID through both calls per §3.12/R-113 — the same
 * pattern already established in `src/api/events.ts` and
 * `src/api/profile.ts`.
 *
 * Proposed Assumption — `getMyGroups()`'s actual source endpoint: the
 * task brief specifies `getMyGroups() -> GET /groups`, but no bare
 * `GET /groups` (list) endpoint exists anywhere in the design's API
 * contract — §7.3 lists only `POST /groups` and `GET /groups/{id}`.
 * §7.5 (Settings) does list exactly the two endpoints needed to browse
 * "groups the user belongs to": `GET /settings/groups-owned` and
 * `GET /settings/groups-member`. `getMyGroups()` below calls both and
 * merges the results, keeping the brief's single-function call shape
 * (and its `GroupsListResponse` return type) while sourcing data from
 * the endpoints that actually exist. See the Implementation Report for
 * the full discrepancy write-up.
 */
import { apiClient } from './client';
import type {
  CreateGroupInput,
  Group,
  GroupDetail,
  GroupInvitationResponse,
  GroupMember,
  GroupMemberRole,
  GroupRole,
  GroupsListResponse,
  InviteMemberResult,
  SuggestedMember,
} from '../types/group';

interface RequestOptions {
  correlationId?: string;
}

/**
 * Full-contract-audit fix (2026-09-18, see
 * docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md), confirmed against the
 * live backend's OpenAPI schema. `GroupResponse` (`GET /settings/groups-owned`,
 * `GET /settings/groups-member`, `GET /groups/{group_id}` all return this
 * shape, bare-array for the first two — already correctly typed as such
 * here, so no envelope bug like `events.ts` had) is:
 * `{ id, name, description, owner_id, members_can_invite, created_at }` —
 * no `owner_nickname`, `member_count`, or `current_user_role` field
 * exists on it at all.
 */
interface GroupApiItem {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

/**
 * `GET /groups/{group_id}/members` — confirmed to exist (the prior
 * Implementation Report's Proposed Assumption that no member-listing
 * endpoint exists was wrong; corrected here). Returns
 * `GroupMembershipResponse[]`: `{ id, group_id, user_id, role, joined_at,
 * user_display_name, user_nickname }`.
 */
interface GroupMembershipApiItem {
  user_id: string;
  role: string;
  joined_at: string;
  user_display_name: string | null;
  user_nickname: string | null;
}

function mapGroupMember(raw: GroupMembershipApiItem): GroupMember {
  return {
    user_id: raw.user_id,
    nickname: raw.user_nickname ?? raw.user_display_name ?? '',
    role: raw.role as GroupMemberRole,
    joined_at: raw.joined_at,
  };
}

/**
 * Proposed Assumption: `current_user_role` is set per the caller's own
 * knowledge of which source list an item came from ('owner' for
 * `/settings/groups-owned`, 'member' for `/settings/groups-member') —
 * see `getMyGroups()`. `owner_nickname`/`member_count` are left
 * `undefined` here: deriving them accurately needs the group's member
 * list, which would mean an N+1 fan-out call per group for a list
 * screen — flagged in the audit report as needing an architect decision,
 * not implemented.
 */
function mapGroupApiItem(raw: GroupApiItem, currentUserRole: GroupRole): Group {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? '',
    owner_id: raw.owner_id,
    created_at: raw.created_at,
    current_user_role: currentUserRole,
  };
}

export interface GetMyGroupsOptions extends RequestOptions {
  enrich?: boolean;
}

export async function getMyGroups(options?: GetMyGroupsOptions): Promise<GroupsListResponse> {
  const correlationId = options?.correlationId;
  const [{ data: owned }, { data: member }] = await Promise.all([
    apiClient.get<GroupApiItem[]>('/settings/groups-owned', { correlationId }),
    apiClient.get<GroupApiItem[]>('/settings/groups-member', { correlationId }),
  ]);
  const rawItems = [
    ...owned.map(raw => ({ raw, role: 'owner' as GroupRole })),
    ...member.map(raw => ({ raw, role: 'member' as GroupRole })),
  ];

  const uniqueMap = new Map<string, { raw: GroupApiItem; role: GroupRole }>();
  for (const item of rawItems) {
    if (!uniqueMap.has(item.raw.id) || item.role === 'owner') {
      uniqueMap.set(item.raw.id, item);
    }
  }
  const uniqueItems = Array.from(uniqueMap.values());

  if (options?.enrich) {
    const enrichedItems = await Promise.all(
      uniqueItems.map(async ({ raw, role }) => {
        try {
          const { data: rawMembers } = await apiClient.get<GroupMembershipApiItem[]>(
            `/groups/${raw.id}/members`,
            { correlationId },
          );
          const members = rawMembers.map(mapGroupMember);
          const owner = members.find(m => m.user_id === raw.owner_id);
          return {
            ...mapGroupApiItem(raw, role),
            owner_nickname: owner?.nickname ?? '',
            member_count: members.length,
          };
        } catch {
          return mapGroupApiItem(raw, role);
        }
      }),
    );
    return { items: enrichedItems, total: enrichedItems.length, page: 1, page_size: enrichedItems.length };
  }

  const items = uniqueItems.map(({ raw, role }) => mapGroupApiItem(raw, role));
  return { items, total: items.length, page: 1, page_size: items.length };
}

/**
 * `current_user_role` on the returned `GroupDetail` is always `'none'` —
 * `api/groups.ts` has no access to the signed-in user's id (reading it
 * here would cross the documented zero-sibling-import boundary between
 * `src/api` and auth/session state). `GroupDetailScreen` computes the
 * authoritative value itself from `members` (now correctly populated
 * below) plus the id it already reads via `useAuth()`.
 */
export async function getGroup(id: string, options?: RequestOptions): Promise<GroupDetail> {
  const correlationId = options?.correlationId;
  const [{ data: raw }, { data: rawMembers }] = await Promise.all([
    apiClient.get<GroupApiItem>(`/groups/${id}`, { correlationId }),
    apiClient.get<GroupMembershipApiItem[]>(`/groups/${id}/members`, { correlationId }),
  ]);
  const members = rawMembers.map(mapGroupMember);
  const owner = members.find(m => m.user_id === raw.owner_id);
  return {
    ...mapGroupApiItem(raw, 'none'),
    owner_nickname: owner?.nickname ?? '',
    member_count: members.length,
    members,
  };
}

/**
 * Proposed Assumption — the invite input. The brief's Step 4 describes
 * "input for nickname/user search," but `inviteMember`'s own signature
 * (Step 2) takes a raw `userId`, and no user-search-by-nickname endpoint
 * exists anywhere in the design's API contract. Rather than inventing an
 * undocumented search endpoint, or assuming (unverified) that this
 * backend's invite endpoint accepts a nickname interchangeably with a
 * user ID, the screen collects a literal user ID — see
 * `GroupDetailScreen`'s invite form and the Implementation Report.
 */
export async function inviteMember(
  groupId: string,
  userId: string,
  options?: RequestOptions,
): Promise<InviteMemberResult> {
  const response = await apiClient.post<{ next_candidate?: SuggestedMemberApiItem | null } | null>(
    `/groups/${groupId}/invite`,
    { user_id: userId },
    { correlationId: options?.correlationId },
  );
  // DES-MEETUP-FEEDBACK-001 C4: the add response carries the next suggested
  // candidate (or none when the pool is empty). Callers that don't use
  // suggestions ignore the result.
  const next = response?.data?.next_candidate;
  return { nextCandidate: next ? mapSuggestedMember(next) : null };
}

/**
 * Suggested-member card as returned by the suggestions endpoint
 * (DES-MEETUP-FEEDBACK-001 C4 contract: user ID, display name, nickname,
 * image URL). Field names follow the backend's snake_case convention; the
 * exact wire names are an integration-check item (see the Implementation
 * Report's blocked note).
 */
interface SuggestedMemberApiItem {
  user_id: string;
  display_name: string | null;
  nickname: string | null;
  image_url: string | null;
}

function mapSuggestedMember(raw: SuggestedMemberApiItem): SuggestedMember {
  return {
    user_id: raw.user_id,
    display_name: raw.display_name ?? '',
    nickname: raw.nickname ?? '',
    image_url: raw.image_url ?? null,
  };
}

/** Max cards shown in "Suggested members" (DES-MEETUP-FEEDBACK-001 C4). */
export const MAX_SUGGESTED_MEMBERS = 5;

/**
 * Suggested members for a newly created group (DES-MEETUP-FEEDBACK-001 C4):
 * group ID in; up to 5 `{ user_id, display_name, nickname, image_url }` out.
 * Caller identity comes from the token; the backend enforces that the caller
 * is an admin of the group.
 */
export async function getSuggestedMembers(
  groupId: string,
  options?: RequestOptions,
): Promise<SuggestedMember[]> {
  const { data } = await apiClient.get<SuggestedMemberApiItem[]>(
    `/groups/${groupId}/suggested-members`,
    { correlationId: options?.correlationId },
  );
  return data.slice(0, MAX_SUGGESTED_MEMBERS).map(mapSuggestedMember);
}

/**
 * Full-contract-audit fix: the real endpoint is
 * `PATCH /groups/{group_id}/members/{user_id}` — there is no `/role`
 * suffix (confirmed against the live OpenAPI schema; the prior path
 * 404'd on the real backend). The request body shape (`{ role }`,
 * matching `GroupRoleUpdateRequest`) was already correct.
 */
export async function updateMemberRole(
  groupId: string,
  userId: string,
  role: GroupMemberRole,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.patch(
    `/groups/${groupId}/members/${userId}`,
    { role },
    { correlationId: options?.correlationId },
  );
}

export async function removeMember(
  groupId: string,
  userId: string,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.delete(`/groups/${groupId}/members/${userId}`, {
    correlationId: options?.correlationId,
  });
}

/**
 * `POST /groups` (DES §4.4, §7.3; R-030). Request body is the live
 * `GroupCreate` schema — `{ name, description? }` only. The caller becomes
 * the owner, so the returned `Group` is mapped with `current_user_role:
 * 'owner'`. An empty description is omitted rather than sent as `""`.
 */
export async function createGroup(
  input: CreateGroupInput,
  options?: RequestOptions,
): Promise<Group> {
  const body: { name: string; description?: string } = { name: input.name };
  if (input.description) {
    body.description = input.description;
  }
  const { data } = await apiClient.post<GroupApiItem>('/groups', body, {
    correlationId: options?.correlationId,
  });
  return mapGroupApiItem(data, 'owner');
}

/**
 * `POST /groups/invitations` (DES-MEETUP-ADDENDUM-shareable-links Decision 15, Decision 24).
 * Authenticated; creates group invitation token and returns shareable URL.
 * When `invitedEmail` is specified, attaches `invited_email` to the request body.
 */
export async function createGroupInvitation(
  groupId: string,
  options?: RequestOptions & { invitedEmail?: string | null },
): Promise<GroupInvitationResponse> {
  const body: { group_id: string; invited_email?: string } = { group_id: groupId };
  if (options?.invitedEmail) {
    body.invited_email = options.invitedEmail;
  }
  const { data } = await apiClient.post<GroupInvitationResponse>(
    '/groups/invitations',
    body,
    { correlationId: options?.correlationId },
  );
  return data;
}
