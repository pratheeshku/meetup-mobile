/**
 * Shared display labels for the app's fixed backend enums (BUG-M02).
 *
 * `skill_level` and `visibility` have no backend display field at all, so
 * they need real label maps. Event and Tournament visibility are kept as
 * TWO separate maps, not one shared lookup keyed on a single enum: their
 * literal values genuinely differ (`invite_only` vs `invite` for the same
 * "private" concept) — collapsing them into one map is the exact bug this
 * ticket is fixing (a tournament's `invite` would silently miss a lookup
 * keyed only on the event enum and render blank again).
 *
 * `sport`, by contrast, DOES have a backend display field — but only on
 * `GET /admin/sports/public` (`Sport.display_name`, distinct from the raw
 * `name`/slug), not on the `Event`/`Tournament` responses that embed a bare
 * `sport` string with no paired display value of their own. `CreateGameScreen`
 * already renders `Sport.display_name` directly where it fetches that list
 * itself — no fix needed there. Everywhere else (`EventCard`,
 * `EventDetailScreen`, `TournamentDetailScreen`, `TournamentsScreen`,
 * `ProfileScreen`'s skill-levels list) only has the raw slug, so
 * `useSportDisplayName` below resolves it against the same sports list,
 * fetched once and cached module-wide (not per-render, not per-screen) —
 * reusing `getSports()` (`api/sports.ts`) rather than duplicating its
 * fetch logic, per this task's explicit instruction.
 */
import { useEffect, useState } from 'react';

import { getSports } from '../api/sports';
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

// Module-wide cache: `getSports()` is fetched at most once across the whole
// app's lifetime (per process), not once per screen/render. A slower earlier
// fetch racing a faster later one can't matter here — both requests return
// the same list — so, unlike `UserSearchPicker`'s per-query race guard, no
// "latest wins" token is needed, only "don't refetch once we have it".
let sportNamesPromise: Promise<Record<string, string>> | null = null;
let cachedSportNames: Record<string, string> | null = null;

function loadSportNames(): Promise<Record<string, string>> {
  if (!sportNamesPromise) {
    sportNamesPromise = getSports().then(sports => {
      cachedSportNames = Object.fromEntries(sports.map(sport => [sport.name, sport.display_name]));
      return cachedSportNames;
    });
  }
  return sportNamesPromise;
}

/**
 * Resolves a raw `sport` slug (e.g. `table_tennis`) to its `display_name`
 * (e.g. `Table Tennis`) from `GET /admin/sports/public`, cached module-wide.
 * Falls back to the raw slug — same as before this fix — while the list is
 * still loading, or if an unknown slug isn't in it, or if the fetch fails;
 * this never blocks or errors the screen calling it, it only upgrades the
 * label once (if) the list resolves.
 */
export function useSportDisplayName(sport: string): string {
  const [names, setNames] = useState<Record<string, string> | null>(cachedSportNames);

  useEffect(() => {
    if (cachedSportNames) {
      return;
    }
    let cancelled = false;
    loadSportNames().then(
      resolved => {
        if (!cancelled) {
          setNames(resolved);
        }
      },
      () => {
        // Leave `names` as-is; callers fall back to the raw sport value.
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return names?.[sport] ?? sport;
}

/** Test-only: clears the module-wide cache so each test controls its own fetch. */
export function __resetSportDisplayNamesCacheForTests(): void {
  sportNamesPromise = null;
  cachedSportNames = null;
}
