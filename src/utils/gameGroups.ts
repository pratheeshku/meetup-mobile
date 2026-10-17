/** Helpers for a game shared with several groups. */
import type { GameLimits } from '../api/config';
import type { Group } from '../types/group';

export const DEFAULT_MAX_GAME_GROUPS = 20;

/** The cap from the API's game limits, else the default (20). */
export function maxGroupsFor(limits?: Pick<GameLimits, 'max_groups_per_game'> | null): number {
  const max = limits?.max_groups_per_game;
  return typeof max === 'number' && max >= 1 ? Math.floor(max) : DEFAULT_MAX_GAME_GROUPS;
}

function activityMs(group: Group): number {
  const ms = group.last_activity_at ? Date.parse(group.last_activity_at) : Number.NaN;
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

/** Most recent activity first; groups without a timestamp keep the API order, after the dated ones. */
export function sortByLastActivity(groups: readonly Group[]): Group[] {
  return groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) => {
      const diff = activityMs(b.group) - activityMs(a.group);
      return diff !== 0 && !Number.isNaN(diff) ? diff : a.index - b.index;
    })
    .map(entry => entry.group);
}

/** A minimal Group for a game's current group (id + name) that is not in the user's own list. */
export function groupFromGame(id: string, name: string | undefined): Group {
  return { id, name: name ?? id, description: '', owner_id: '', created_at: '', current_user_role: 'member' };
}
