/**
 * One independently loading/failing data source (P7): each dashboard section
 * owns one of these, so a failed request shows that section's error state and
 * never blanks the screen or touches another section.
 *
 * - `loading` only until the first result; a later reload keeps the data it
 *   already has on screen (no skeleton flash, no state reset), and a failed
 *   reload keeps the stale data rather than replacing it with an error.
 * - Does not fetch by itself: the owner calls `load(correlationId?)` (mount,
 *   pull-to-refresh, per-section Retry), so one logical user action can share
 *   one correlation ID (§3.12, R-113).
 *
 * Perf instrumentation (perf-diagnostics task, Item E):
 *   - fetch_start / fetch_end per load() call, with duration_ms.
 *   - focus-triggered refetch count is tracked by callers (FocusCount hook).
 *   - The fetcher name is passed via `resourceName` option for readability.
 */
import { useCallback, useRef, useState } from 'react';
import { startSpan } from '../diagnostics/perfLog';

export interface ResourceOptions {
  correlationId?: string;
  /** Optional human-readable name for perf logging. */
  resourceName?: string;
}

export type ResourceStatus = 'loading' | 'ready' | 'error';

export interface Resource<T> {
  status: ResourceStatus;
  data: T | undefined;
  load: (correlationId?: string) => Promise<void>;
}

interface State<T> {
  status: ResourceStatus;
  data: T | undefined;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || typeof a !== 'object' || b === null || typeof b !== 'object') {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) {
    return false;
  }
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      return false;
    }
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

export function useResource<T>(
  fetcher: (options: ResourceOptions) => Promise<T>,
  resourceName?: string,
): Resource<T> {
  const [state, setState] = useState<State<T>>({ status: 'loading', data: undefined });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const sequence = useRef(0);

  const load = useCallback((correlationId?: string): Promise<void> => {
    const mine = ++sequence.current;
    // First load or retry after an error: show the skeleton. A reload over
    // existing data leaves the data in place.
    setState(previous =>
      previous.data !== undefined ? previous : { status: 'loading', data: undefined },
    );

    // ── Perf: span the fetch ────────────────────────────────────────────────
    const name = resourceName ?? 'resource';
    const endSpan = startSpan('fetch', { resource: name });

    return fetcherRef.current({ correlationId, resourceName: name }).then(
      data => {
        if (sequence.current === mine) {
          endSpan({ result: 'ok' });
          setState(previous => {
            if (previous.status === 'ready' && deepEqual(previous.data, data)) {
              return previous;
            }
            return { status: 'ready', data };
          });
        } else {
          endSpan({ result: 'stale' });
        }
      },
      () => {
        if (sequence.current === mine) {
          endSpan({ result: 'error' });
          setState(previous =>
            previous.data !== undefined ? previous : { status: 'error', data: undefined },
          );
        } else {
          endSpan({ result: 'stale-error' });
        }
      },
    );
  }, [resourceName]); // eslint-disable-line react-hooks/exhaustive-deps

  return { status: state.status, data: state.data, load };
}
