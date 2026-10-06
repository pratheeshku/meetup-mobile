/**
 * Users API — `GET /users/search` (BUG-M01).
 *
 * Not listed in DES-MEETUP-MOBILE.md §7.2 (Users) or §7.3 (Groups & Teams)
 * — the same class of local-design-excerpt gap already resolved for
 * `GET /admin/sports/public` (this project's own §7 provenance note:
 * "committee-governance and admin sports/config endpoint paths verified
 * directly against the running backend codebase"). Verified the same way
 * here, directly against `pratheeshku/meetup`'s `users/router.py`
 * (`search_users`) and `users/schemas.py` (`UserSearchResult`) via `gh api`:
 * - Query params: `q` (required), `exclude_group_id`, `exclude_event_id`,
 *   `exclude_team_id` (all three optional, independent, uuid) — the
 *   group-context exclude param exists as its own literal, not inferred
 *   or assumed from the event one.
 * - Auth: `search_users` has no `Depends(get_current_user)` — unauthenticated,
 *   like `GET /admin/sports/public`.
 * - Response: `list[UserSearchResult]`, capped at 10 server-side
 *   (`stmt.limit(10)`), matched on `nickname`/`display_name` via `ILIKE`.
 * - Empty `q` is valid: the server returns the default list (up to 10 people
 *   who share a group with the caller). Typed text is filtered server-side
 *   (people sharing a group first, then everyone else), max 10 in total.
 * - Additive result fields `in_my_groups` (boolean), `shared_group`
 *   (string | null), `shared_group_count` (integer). An older backend omits
 *   them: they map to `in_my_groups = false` (plain list, no sections).
 */
import { apiClient } from './client';
import type { UserSearchResult } from '../types/user';

export interface SearchUsersParams {
  q: string;
  excludeGroupId?: string;
  excludeEventId?: string;
  excludeTeamId?: string;
}

interface RequestOptions {
  correlationId?: string;
}

interface UserSearchResultApiItem {
  id: string;
  display_name: string;
  nickname: string;
  avatar_storage_key: string | null;
  theme_preference: string;
  created_at: string;
  pending: boolean;
  image_url?: string | null;
  in_my_groups?: boolean;
  shared_group?: string | null;
  shared_group_count?: number;
}

export async function searchUsers(
  params: SearchUsersParams,
  options?: RequestOptions,
): Promise<UserSearchResult[]> {
  const { data } = await apiClient.get<UserSearchResultApiItem[]>('/users/search', {
    params: {
      q: params.q,
      exclude_group_id: params.excludeGroupId,
      exclude_event_id: params.excludeEventId,
      exclude_team_id: params.excludeTeamId,
    },
    correlationId: options?.correlationId,
  });
  return data.map(item => ({
    id: item.id,
    display_name: item.display_name,
    nickname: item.nickname,
    pending: item.pending,
    image_url: item.image_url ?? null,
    in_my_groups: item.in_my_groups === true,
    shared_group: item.shared_group ?? null,
    shared_group_count: item.shared_group_count ?? 0,
    has_group_info: typeof item.in_my_groups === 'boolean',
  }));
}
