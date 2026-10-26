/**
 * The registration flow of one tournament (DES-MEETUP-ADDENDUM-tournament-registration AD-1, AD-5): `start()` opens the confirmation
 * sheet; Confirm posts the registration with `accepted_fee_cents` when a fee applies, once per user action (one `withCorrelationId()`), and
 * the result pop-up reports success or the label for the server `code`.
 *
 * - FEE_CHANGED (409) carries the current `registration_fee_cents`: the sheet takes it and asks again, no result pop-up.
 * - A fee that cannot be read blocks Confirm. The request is never sent without a known fee.
 * - The refetch after a successful registration is best effort: the registration already happened, so a failed refetch is not a failure.
 * - A 404 closes the flow and hands over to the host's "no longer available" handling.
 */
import React, { useCallback, useRef, useState } from 'react';

import { withCorrelationId } from '../api/correlationId';
import { getMyTeams } from '../api/teams';
import { registerForTournament } from '../api/tournaments';
import { RegistrationConfirmSheet, RegistrationResultPopup } from '../components/tournament/RegistrationDialogs';
import { useT } from '../labels/LabelsContext';
import type { Team } from '../types/team';
import type { Tournament, TournamentParticipationMode } from '../types/tournament';
import { isNotFoundError } from '../utils/apiError';
import { hasFee } from '../utils/money';
import {
  TEAM_EMPTY_FAILURE,
  classifyRegistrationError,
  feeLineFor,
  teamsForSport,
  type RegistrationFailure,
} from '../utils/registration';

export interface RegistrationTarget {
  tournamentId: string;
  name: string;
  /** The tournament's sport: team mode keeps only the caller's teams for this sport (case-insensitive). */
  sport: string;
  mode: TournamentParticipationMode | null;
  /** Null or 0 = free. */
  feeCents: number | null;
  currency: string | null;
  /** False when the fee could not be read (for example a fee with no currency): Confirm is blocked. */
  feeReadable: boolean;
}

/** The sheet's input from a loaded tournament. A fee above 0 with no currency cannot be shown, so it cannot be confirmed. */
export function registrationTargetFor(tournament: Tournament): RegistrationTarget {
  const feeCents = tournament.registration_fee_cents ?? null;
  const currency = tournament.registration_fee_currency ?? null;
  return {
    tournamentId: tournament.id,
    name: tournament.name,
    sport: tournament.sport,
    mode: tournament.participation_mode ?? null,
    feeCents,
    currency,
    feeReadable: !hasFee(feeCents) || Boolean(currency),
  };
}

type Phase =
  | { kind: 'closed' }
  | { kind: 'confirm'; notice: string | null }
  | { kind: 'result'; failure: RegistrationFailure | null };

interface Options {
  /** Runs after a successful registration (refetch the tournament and registrations), under the same correlation id. */
  onRegistered: (correlationId: string) => Promise<void>;
  onNotFound: () => void;
  onOpenSkillLevels: () => void;
}

export interface TournamentRegistration {
  start: (target: RegistrationTarget) => void;
  /** Render this once in the host. */
  element: React.JSX.Element | null;
}

export function useTournamentRegistration(options: Options): TournamentRegistration {
  const t = useT();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [target, setTarget] = useState<RegistrationTarget | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'closed' });
  const [busy, setBusy] = useState(false);
  // Team mode: the caller's teams for the sport (null = individual mode or not loaded) and the chosen one.
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const inFlight = useRef(false);

  const close = useCallback(() => {
    setPhase({ kind: 'closed' });
    setTarget(null);
    setTeams(null);
    setTeamId(null);
  }, []);

  const start = useCallback(
    (next: RegistrationTarget) => {
      setTarget(next);
      setTeams(null);
      setTeamId(null);
      if (next.mode !== 'team') {
        setPhase({ kind: 'confirm', notice: null });
        return;
      }
      // Team mode (AD-1, OI-19): read the caller's teams first. No team for this sport: no confirmation, the result pop-up says so.
      withCorrelationId(correlationId => getMyTeams({ correlationId }))
        .then(all => {
          const mine = teamsForSport(all, next.sport);
          if (mine.length === 0) {
            setPhase({ kind: 'result', failure: TEAM_EMPTY_FAILURE });
            return;
          }
          setTeams(mine);
          setTeamId(mine[0].id);
          setPhase({ kind: 'confirm', notice: null });
        })
        .catch(error => {
          if (isNotFoundError(error)) {
            close();
            optionsRef.current.onNotFound();
            return;
          }
          setPhase({ kind: 'result', failure: classifyRegistrationError(error) });
        });
    },
    [close],
  );

  const submit = useCallback(async (): Promise<void> => {
    if (!target || !target.feeReadable || inFlight.current) {
      return;
    }
    if (target.mode === 'team' && !teamId) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      await withCorrelationId(async correlationId => {
        await registerForTournament(target.tournamentId, {
          correlationId,
          acceptedFeeCents: hasFee(target.feeCents) ? target.feeCents : null,
          teamId: target.mode === 'team' ? teamId : null,
        });
        setPhase({ kind: 'result', failure: null });
        try {
          await optionsRef.current.onRegistered(correlationId);
        } catch (error) {
          if (isNotFoundError(error)) {
            optionsRef.current.onNotFound();
          }
        }
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        close();
        optionsRef.current.onNotFound();
        return;
      }
      const failure = classifyRegistrationError(error);
      if (failure.code === 'FEE_CHANGED' && failure.currentFeeCents !== null) {
        const fee = failure.currentFeeCents;
        setTarget(previous => (previous ? { ...previous, feeCents: fee, feeReadable: true } : previous));
        setPhase({ kind: 'confirm', notice: t(failure.labelKey, failure.labelParams) });
      } else {
        setPhase({ kind: 'result', failure });
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [target, teamId, close, t]);

  if (!target || phase.kind === 'closed') {
    return { start, element: null };
  }

  const feeLine = feeLineFor(t, target.feeCents, target.currency, target.mode);
  const element =
    phase.kind === 'confirm' ? (
      <RegistrationConfirmSheet
        name={target.name}
        modeLabel={target.mode === 'team' ? t('mob.reg.mode_team') : t('mob.reg.mode_individual')}
        feeLine={feeLine}
        feeReadable={target.feeReadable}
        notice={phase.notice}
        busy={busy}
        teams={teams ?? undefined}
        selectedTeamId={teamId}
        onSelectTeam={setTeamId}
        onConfirm={submit}
        onCancel={close}
      />
    ) : (
      <RegistrationResultPopup
        feeLine={feeLine}
        failure={phase.failure}
        onRetry={() => {
          // A retry is a new user action with a fresh correlation id. Team mode whose team list never loaded starts over.
          if (target.mode === 'team' && !teams) {
            start(target);
            return;
          }
          setPhase({ kind: 'confirm', notice: null });
          submit();
        }}
        onSkillLevel={() => {
          close();
          optionsRef.current.onOpenSkillLevels();
        }}
        onClose={close}
      />
    );
  return { start, element };
}
