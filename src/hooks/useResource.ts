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
 */
import { useCallback, useRef, useState } from 'react';

export interface ResourceOptions {
  correlationId?: string;
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

export function useResource<T>(fetcher: (options: ResourceOptions) => Promise<T>): Resource<T> {
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
    return fetcherRef.current({ correlationId }).then(
      data => {
        if (sequence.current === mine) {
          setState({ status: 'ready', data });
        }
      },
      () => {
        if (sequence.current === mine) {
          setState(previous =>
            previous.data !== undefined ? previous : { status: 'error', data: undefined },
          );
        }
      },
    );
  }, []);

  return { status: state.status, data: state.data, load };
}
