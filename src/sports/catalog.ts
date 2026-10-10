/**
 * The active sports list from `GET /admin/sports/public`.
 *
 * One in-memory copy, shared with display-name lookup. The Edit skill levels
 * screen replaces it with a fresh response so an older copy cannot keep a
 * sport the admin has since removed.
 */
import { useEffect, useState } from 'react';

import { getSports } from '../api/sports';
import type { Sport } from '../types/sport';

let cached: Sport[] | null = null;
let pending: Promise<Sport[]> | null = null;

export function sportLookupKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function findSport(sports: readonly Sport[], key: string | null | undefined): Sport | undefined {
  const normalized = sportLookupKey(key);
  if (!normalized) {
    return undefined;
  }
  return sports.find(
    sport =>
      sportLookupKey(sport.name) === normalized ||
      (sport.slug ? sportLookupKey(sport.slug) === normalized : false),
  );
}

export function rememberSportsCatalog(sports: Sport[]): void {
  cached = sports;
  pending = Promise.resolve(sports);
}

export function invalidateSportsCatalog(): void {
  cached = null;
  pending = null;
}

/** Test-only: install a catalog without a network round-trip. */
export function primeSportsCatalogForTests(sports: Sport[]): void {
  rememberSportsCatalog(sports);
}

export function loadSportsCatalog(): Promise<Sport[]> {
  if (cached) {
    return Promise.resolve(cached);
  }
  if (!pending) {
    pending = getSports()
      .then(sports => {
        cached = sports;
        return sports;
      })
      .catch(error => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

export function useSportRecord(key: string | null | undefined): Sport | undefined {
  const [sports, setSports] = useState<Sport[] | null>(cached);

  useEffect(() => {
    if (cached) {
      setSports(cached);
      return undefined;
    }
    let cancelled = false;
    loadSportsCatalog().then(
      list => {
        if (!cancelled) {
          setSports(list);
        }
      },
      () => {
        if (!cancelled) {
          setSports([]);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  return findSport(sports ?? [], key);
}

export function useSportVisual(key: string | null | undefined): {
  iconKey: string | null;
  color: string | null;
} {
  const record = useSportRecord(key);
  return {
    iconKey: record?.icon_key ?? null,
    color: record?.color ?? null,
  };
}
