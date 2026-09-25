/**
 * `sport` DOES have a backend display field — but only on
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
 *
 * This file previously (BUG-M02) also carried hardcoded `skill_level` and
 * `*_visibility` label maps. Those had no backend display field at the
 * time; they've since been replaced by the shared `GET /api/labels`
 * endpoint — see `src/labels/LabelsContext.tsx` (`useLabels()`/`getLabel()`)
 * and `src/api/labels.ts`. `sport`'s own display field (`display_name`,
 * above) is unaffected — a separate mechanism, out of scope for that fix.
 */
import { useEffect, useState } from 'react';

import { getSports } from '../api/sports';

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
