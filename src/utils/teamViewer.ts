/**
 * The viewer state of the tournament team detail (DES-MEETUP-ADDENDUM-team-screens-remarks AD-1). It comes from the caller's own row in the
 * roster, never from a guess: `active` (team player), `invited`, `requested`, or `none` (no usable row; a `403` from the roster route is this
 * case). The server stays the authority: this only chooses which controls to draw.
 */
import type { TeamMembership } from '../types/team';

export type TeamViewerState = 'active' | 'invited' | 'requested' | 'none';

export function viewerStateFromRoster(roster: readonly TeamMembership[] | null, userId: string | undefined): TeamViewerState {
  if (!roster || !userId) {
    return 'none';
  }
  const mine = roster.find(row => row.user_id === userId);
  if (mine?.status === 'active') {
    return 'active';
  }
  if (mine?.status === 'invited') {
    return 'invited';
  }
  if (mine?.status === 'requested') {
    return 'requested';
  }
  return 'none';
}

/** The name a roster row shows: display name, else nickname, else empty (never an id). */
export function memberName(row: Pick<TeamMembership, 'user_display_name' | 'user_nickname'>): string {
  return row.user_display_name || row.user_nickname || '';
}
