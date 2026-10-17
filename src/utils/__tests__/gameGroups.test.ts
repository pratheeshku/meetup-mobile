import type { Group } from '../../types/group';
import { DEFAULT_MAX_GAME_GROUPS, maxGroupsFor, sortByLastActivity } from '../gameGroups';

const g = (id: string, last?: string | null): Group =>
  ({ id, name: id, description: '', owner_id: '', created_at: '', current_user_role: 'member', last_activity_at: last }) as Group;

describe('maxGroupsFor', () => {
  it('uses the API value, else 20', () => {
    expect(DEFAULT_MAX_GAME_GROUPS).toBe(20);
    expect(maxGroupsFor({ max_groups_per_game: 5 })).toBe(5);
    expect(maxGroupsFor({})).toBe(20);
    expect(maxGroupsFor(null)).toBe(20);
    expect(maxGroupsFor({ max_groups_per_game: 0 })).toBe(20);
  });
});

describe('sortByLastActivity', () => {
  it('newest first; undated groups keep their order after the dated ones', () => {
    const sorted = sortByLastActivity([g('x'), g('old', '2026-01-01T00:00:00Z'), g('y'), g('new', '2026-09-01T00:00:00Z')]);
    expect(sorted.map(group => group.id)).toEqual(['new', 'old', 'x', 'y']);
  });
});
