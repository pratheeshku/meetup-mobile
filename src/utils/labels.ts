/**
 * Shared display labels for the app's fixed backend enums (BUG-M02).
 *
 * `sport` is deliberately NOT covered here: `GET /admin/sports/public`
 * already returns a proper-cased `display_name` distinct from the raw
 * `name`/`slug` (see `types/sport.ts`, `api/sports.ts`), so screens that
 * already fetch the sports list (e.g. `CreateGameScreen`) render that
 * field directly rather than needing a lookup table. Screens that render
 * a bare `sport` string from an `Event`/`Tournament` response (which has
 * no paired display field of its own) are a separate, unresolved gap —
 * see the Implementation Report for BUG-M02.
 *
 * `skill_level` and `visibility` have no backend display field at all, so
 * they need real label maps. Event and Tournament visibility are kept as
 * TWO separate maps, not one shared lookup keyed on a single enum: their
 * literal values genuinely differ (`invite_only` vs `invite` for the same
 * "private" concept) — collapsing them into one map is the exact bug this
 * ticket is fixing (a tournament's `invite` would silently miss a lookup
 * keyed only on the event enum and render blank again).
 */
import type { EventSkillLevel, EventVisibility } from '../types/event';
import type { TournamentVisibility } from '../types/tournament';

export const SKILL_LEVEL_LABELS: Record<EventSkillLevel, string> = {
  all_levels: 'All Levels',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  expert: 'Expert',
};

/** `EventVisibility`'s third value is `invite_only` — see `types/event.ts`. */
export const EVENT_VISIBILITY_LABELS: Record<EventVisibility, string> = {
  public: 'Public',
  invite_only: 'Private',
  group: 'Group',
};

/** `TournamentVisibility`'s third value is `invite`, NOT `invite_only` — see `types/tournament.ts`. */
export const TOURNAMENT_VISIBILITY_LABELS: Record<TournamentVisibility, string> = {
  public: 'Public',
  invite: 'Private',
  group: 'Group Only',
};
