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
import type { Group, GroupDetail, GroupMemberRole, GroupsListResponse } from '../types/group';

interface RequestOptions {
  correlationId?: string;
}

export async function getMyGroups(options?: RequestOptions): Promise<GroupsListResponse> {
  const correlationId = options?.correlationId;
  const [{ data: owned }, { data: member }] = await Promise.all([
    apiClient.get<Group[]>('/settings/groups-owned', { correlationId }),
    apiClient.get<Group[]>('/settings/groups-member', { correlationId }),
  ]);
  const items = [...owned, ...member];
  return { items, total: items.length, page: 1, page_size: items.length };
}

export async function getGroup(id: string, options?: RequestOptions): Promise<GroupDetail> {
  const { data } = await apiClient.get<GroupDetail>(`/groups/${id}`, {
    correlationId: options?.correlationId,
  });
  return data;
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
): Promise<void> {
  await apiClient.post(
    `/groups/${groupId}/invite`,
    { user_id: userId },
    { correlationId: options?.correlationId },
  );
}

export async function updateMemberRole(
  groupId: string,
  userId: string,
  role: GroupMemberRole,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.patch(
    `/groups/${groupId}/members/${userId}/role`,
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
