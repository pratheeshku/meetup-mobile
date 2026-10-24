/**
 * The standings board of a tournament page (`GET /tournaments/{id}/standings`) with the live refresh of te-a2
 * (AD-T7, TE-09, D-T6): it is read when the tab opens and again every `live_poll_seconds` (the server's value) while the
 * screen is focused and the app is in the foreground. A newer board replaces the one held only when it differs. An entry
 * response is applied in place (`applyEntry`), so only the affected regions change. Nothing is computed here: ranks,
 * qualification, advancement and winners are the server's.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { withCorrelationId } from '../../../../api/correlationId';
import { getTournamentStandings } from '../../../../api/tournaments';
import type { TournamentStandingsView } from '../../../../types/tournamentScoring';
import type { MatchEntryResponse } from '../../../../types/tournamentTabs';
import { advancedFixtureIds, applyEntry, justSetIds } from '../../../../utils/tournamentTabs';

export interface StandingsBoard {
  view: TournamentStandingsView | null;
  status: 'loading' | 'ready' | 'error';
  /** Knockout matches that got a name just now ("Just set"). */
  justSet: Set<string>;
  reload: () => Promise<void>;
  /** Re-render from a saved score: the entry response of the server. */
  accept: (entry: MatchEntryResponse) => void;
}

export function useStandingsBoard(options: {
  tournamentId: string;
  /** The board is read only while a tab that shows it is open. */
  enabled: boolean;
  /** The open tab keeps itself current (Fixtures, Standings). */
  poll: boolean;
  /** Milliseconds between refreshes (the server's `live_poll_seconds`); 0 = no refresh. */
  pollMs: number;
  /** False while the screen is not the focused one: no refresh then. */
  focused: boolean;
}): StandingsBoard {
  const { tournamentId, enabled, poll, pollMs, focused } = options;
  const [view, setView] = useState<TournamentStandingsView | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [justSet, setJustSet] = useState<Set<string>>(new Set());
  const viewRef = useRef<TournamentStandingsView | null>(null);
  const textRef = useRef<string | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background');

  const swap = useCallback((next: TournamentStandingsView | null, mark: boolean) => {
    if (mark) {
      setJustSet(justSetIds(viewRef.current, next));
    }
    viewRef.current = next;
    textRef.current = next ? JSON.stringify(next) : null;
    setView(next);
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const next = await withCorrelationId(correlationId => getTournamentStandings(tournamentId, { correlationId }));
      if ((next ? JSON.stringify(next) : null) !== textRef.current) {
        swap(next, viewRef.current !== null);
      }
      setStatus('ready');
    } catch {
      setStatus(previous => (previous === 'ready' ? previous : 'error'));
    }
  }, [swap, tournamentId]);

  useEffect(() => {
    if (enabled) {
      reload();
    }
  }, [enabled, reload]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!enabled || !poll || pollMs <= 0 || !focused || !appActive) {
      return undefined;
    }
    const timer = setInterval(() => {
      reload();
    }, pollMs);
    return () => clearInterval(timer);
  }, [enabled, poll, pollMs, focused, appActive, reload]);

  const accept = useCallback(
    (entry: MatchEntryResponse) => {
      const before = viewRef.current;
      const next = applyEntry(before, entry);
      viewRef.current = next;
      textRef.current = next ? JSON.stringify(next) : null;
      setView(next);
      const filled = advancedFixtureIds(entry.advanced);
      setJustSet(new Set([...justSetIds(before, next), ...filled]));
    },
    [],
  );

  return { view, status, justSet, reload, accept };
}
