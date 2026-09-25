/**
 * Labels context — bug fix / architecture correction replacing BUG-M02's
 * hardcoded label maps in `src/utils/labels.ts` with the shared
 * `GET /api/labels` endpoint (DES-MEETUP-MOBILE.md §7.10, §4.9), so label
 * text has one source of truth instead of two.
 *
 * Same context/provider shape as `src/auth/AuthContext.tsx` (this repo's
 * established pattern for app-wide fetched state), mounted once at the top
 * of `App.tsx` so the fetch starts at true cold start, independent of auth
 * state — `/api/labels` is unauthenticated by design.
 *
 * Precedence, cold start or stale cache:
 *   1. Component mounts with `FALLBACK_LABELS` (bundled snapshot) as the
 *      initial state — never a blank/undefined map.
 *   2. The AsyncStorage cache (if any) is read and, if present, replaces
 *      the in-memory map immediately — this is the "stale cache" case:
 *      whatever the last successful fetch returned, shown without waiting
 *      on the network.
 *   3. A fresh `GET /api/labels` fetch runs concurrently. On success, its
 *      unwrapped `response.labels` map (§7.10 shape correction, see
 *      `src/api/labels.ts`) replaces the in-memory map AND is written back
 *      to AsyncStorage, so the next cold start's step 2 sees it.
 *   4. On fetch failure, whatever is already showing (AsyncStorage cache,
 *      or else the FALLBACK_LABELS the provider mounted with) is left
 *      untouched — this is the "both network and cache unavailable" case
 *      collapsing to FALLBACK_LABELS by construction, never an error.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getLabels } from '../api/labels';
import type { LabelMap } from '../api/labels';
import { FALLBACK_LABELS } from './fallbackLabels';

export const LABELS_CACHE_KEY = '@meetup/labels-cache';

// Default context value: `FALLBACK_LABELS` itself, so `useLabels()` never
// throws or returns undefined for a component rendered without a
// `LabelsProvider` ancestor (e.g. most existing screen unit tests, which
// don't exercise label-fetching behaviour and shouldn't have to).
const LabelsContext = createContext<LabelMap>(FALLBACK_LABELS);

export function LabelsProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [labels, setLabels] = useState<LabelMap>(FALLBACK_LABELS);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cachedRaw = await AsyncStorage.getItem(LABELS_CACHE_KEY);
        if (cachedRaw && !cancelled) {
          setLabels(JSON.parse(cachedRaw) as LabelMap);
        }
      } catch {
        // Corrupt/unavailable cache — leave FALLBACK_LABELS in place;
        // the network fetch below still runs regardless.
      }
    })();

    (async () => {
      try {
        const fetched = await getLabels();
        if (!cancelled) {
          setLabels(fetched);
        }
        await AsyncStorage.setItem(LABELS_CACHE_KEY, JSON.stringify(fetched));
      } catch {
        // Network unavailable — keep whatever's already showing (cache or
        // FALLBACK_LABELS); never surface this as a screen-level error.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <LabelsContext.Provider value={labels}>{children}</LabelsContext.Provider>;
}

export function useLabels(): LabelMap {
  return useContext(LabelsContext);
}

/**
 * Looks up a dotted label key in a fetched/cached map, falling back to the
 * bundled snapshot's value for that key, and finally to the key itself —
 * defensive against a future backend response that's missing a key this
 * app expects (never blank UI text).
 */
export function getLabel(labels: LabelMap, key: string): string {
  return labels[key] ?? FALLBACK_LABELS[key] ?? key;
}
