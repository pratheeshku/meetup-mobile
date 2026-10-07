/**
 * Sport chip selection state shared by Home and the Games screen
 * (DES-MEETUP-ADDENDUM-dashboard.md AD-9).
 *
 * - `selection` is `null` until the default has been decided, then a list of
 *   sport keys (`[]` = All).
 * - The skill default is applied exactly once: when both the admin sports
 *   list and the profile have settled (success or failure) for the first
 *   time. If the user taps a chip before that, their choice wins and the
 *   default never applies. After that the stored selection is only ever
 *   changed by the user — re-renders and data reloads never touch it.
 * - Not persisted between visits (state lives and dies with the screen).
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import type { Resource } from './useResource';
import type { Sport } from '../types/sport';
import type { SkillLevel } from '../types/user';
import {
  effectiveSportSelection,
  getDefaultSportSelection,
  getSportOptions,
  toggleSportSelection,
} from '../utils/gameLists';
import type { SportOption } from '../utils/gameLists';

export interface SportFilter {
  options: SportOption[];
  /** Admin sports list is still loading for the first time. */
  isLoading: boolean;
  /** Selected sport keys that exist in the admin list; `[]` = All. */
  selected: string[];
  toggle: (key: string | null) => void;
}

export function useSportFilter(
  sports: Resource<Sport[]>,
  skillLevels: SkillLevel[] | undefined,
  profileSettled: boolean,
): SportFilter {
  const [stored, setStored] = useState<string[] | null>(null);
  const options = useMemo(() => getSportOptions(sports.data ?? []), [sports.data]);

  const sportsSettled = sports.status !== 'loading';
  const canDecide = sportsSettled && profileSettled;

  // Derive the default during render (no effect → no stale first frame):
  // computed only while nothing has been decided and everything has settled.
  let selection = stored;
  if (selection === null && canDecide) {
    selection = getDefaultSportSelection(skillLevels ?? [], options);
    setStored(selection);
  }

  const toggle = useCallback((key: string | null) => {
    setStored(previous => toggleSportSelection(previous ?? [], key));
  }, []);

  const selectedRef = useRef<string[]>([]);
  const selected = useMemo(() => {
    const next = effectiveSportSelection(selection ?? [], options);
    if (
      selectedRef.current.length === next.length &&
      selectedRef.current.every((v, i) => v === next[i])
    ) {
      return selectedRef.current;
    }
    selectedRef.current = next;
    return next;
  }, [selection, options]);

  return { options, isLoading: sports.status === 'loading', selected, toggle };
}
