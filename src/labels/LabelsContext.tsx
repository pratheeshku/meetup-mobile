/**
 * Labels context — every customer-facing string resolves through here
 * (DES-MEETUP-FEEDBACK-001 C2, AD-7), by key, with a bundled default per key
 * (`fallbackLabels.ts`). Source of live text: the shared `GET /api/labels`
 * endpoint (DES-MEETUP-MOBILE.md §7.10, §4.9).
 *
 * Precedence:
 *   1. Mount with `FALLBACK_LABELS` (bundled defaults) — never a blank map.
 *   2. The AsyncStorage cache (if any) replaces the in-memory map at once.
 *   3. A fetch runs on app launch (always) and on each return to the
 *      foreground (only when the cached copy is older than
 *      `labelsCacheTtlSeconds` in `config/appConfig.json`, P1).
 *   4. On fetch failure the current map stays; `getLabel` falls back to the
 *      bundled default per key, so the UI never shows a blank or raw key.
 *
 * Label text values are never logged (DES-MEETUP-FEEDBACK-001 Observability).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import appConfig from '../../config/appConfig.json';
import { getLabels } from '../api/labels';
import type { LabelMap } from '../api/labels';
import { FALLBACK_LABELS } from './fallbackLabels';
import type { LabelKey } from './fallbackLabels';
export type { LabelKey };

export const LABELS_CACHE_KEY = '@meetup/labels-cache';
export const LABELS_FETCHED_AT_KEY = '@meetup/labels-fetched-at';

export type LabelParams = Record<string, string | number>;
export type TranslateFn = (key: LabelKey, params?: LabelParams) => string;

// Latest labels held outside React so non-component code (notification
// action buttons, channel names) resolves through the same keys.
let latestLabels: LabelMap = FALLBACK_LABELS;

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

// Default context value: `FALLBACK_LABELS` itself, so `useLabels()` never
// throws or returns undefined for a component rendered without a
// `LabelsProvider` ancestor.
const LabelsContext = createContext<LabelMap>(FALLBACK_LABELS);

function cacheTtlMs(): number {
  const seconds = Number(appConfig.labelsCacheTtlSeconds);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 0;
}

export function LabelsProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [labels, setLabels] = useState<LabelMap>(FALLBACK_LABELS);
  const fetchedAt = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const refresh = useCallback(async (force: boolean) => {
    if (inFlight.current) {
      return;
    }
    if (!force && Date.now() - fetchedAt.current < cacheTtlMs()) {
      return;
    }
    inFlight.current = true;
    try {
      const fetched = await getLabels();
      fetchedAt.current = Date.now();
      if (mounted.current) {
        // Keep the same object when nothing changed, so consumers don't re-render.
        setLabels(current =>
          JSON.stringify(current) === JSON.stringify(fetched) ? current : fetched,
        );
      }
      await AsyncStorage.setItem(LABELS_CACHE_KEY, JSON.stringify(fetched));
      await AsyncStorage.setItem(LABELS_FETCHED_AT_KEY, String(fetchedAt.current));
    } catch {
      // Fetch/cache failure: keep what is showing (cache or bundled
      // defaults); never surface as a screen-level error.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    (async () => {
      try {
        const cachedRaw = await AsyncStorage.getItem(LABELS_CACHE_KEY);
        const cachedAt = await AsyncStorage.getItem(LABELS_FETCHED_AT_KEY);
        if (cachedRaw && mounted.current) {
          setLabels(JSON.parse(cachedRaw) as LabelMap);
          fetchedAt.current = Math.max(fetchedAt.current, Number(cachedAt) || 0);
        }
      } catch {
        // Corrupt/unavailable cache — bundled defaults stay in place.
      }
    })();

    // App launch: always refresh.
    refresh(true);

    // Foreground: refresh when the cache is older than the configured TTL.
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && previous !== 'active') {
        refresh(false);
      }
      previous = next;
    });

    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [refresh]);

  useEffect(() => {
    latestLabels = labels;
  }, [labels]);

  return <LabelsContext.Provider value={labels}>{children}</LabelsContext.Provider>;
}

export function useLabels(): LabelMap {
  return useContext(LabelsContext);
}

/** Fills `{name}` placeholders; an unknown name is replaced with nothing. */
export function formatLabel(template: string, params?: LabelParams): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match, name: string) =>
    params && name in params ? String(params[name]) : '',
  );
}

function placeholdersResolvable(template: string, params?: LabelParams): boolean {
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    if (!params || !(match[1] in params)) {
      return false;
    }
  }
  return true;
}

/**
 * Resolves a label key: the fetched/cached value when it is a non-empty
 * string whose placeholders can all be filled, otherwise the bundled default
 * for that key. Never blank; the raw key is only a last resort for an
 * unregistered key (not reachable for typed `LabelKey`s).
 */
export function getLabel(labels: LabelMap, key: string, params?: LabelParams): string {
  const remote = labels[key];
  const fallback = FALLBACK_LABELS[key];
  let template: string | undefined;
  if (typeof remote === 'string' && remote.trim() !== '' && placeholdersResolvable(remote, params)) {
    template = remote;
  } else {
    template = fallback;
  }
  return formatLabel(template ?? key, params);
}

/** `const t = useT(); t('mob.login.title')` — resolves by key with bundled default. */
export function useT(): TranslateFn {
  const labels = useLabels();
  return useMemo<TranslateFn>(
    () => (key, params) => getLabel(labels, key, params),
    [labels],
  );
}

/** Translator over the most recent labels (bundled defaults until the provider has loaded). */
export const currentT: TranslateFn = (key, params) => getLabel(latestLabels, key, params);

/** Translator over the bundled defaults only — default for pure helpers called without a `t`. */
export const bundledT: TranslateFn = (key, params) => getLabel(FALLBACK_LABELS, key, params);
