/**
 * The registration flow of one tournament (DES-MEETUP-ADDENDUM-tournament-registration AD-1, AD-5; teams-payments AD-3, AD-7, boards J2-J6):
 * `start()` opens the confirmation sheet; Confirm posts the registration with `accepted_fee_cents` when a fee applies, once per user action (one
 * `withCorrelationId()`), and the result pop-up reports success (with the number to pay to, when a fee applies) or the label for the server `code`.
 *
 * - Team mode with no tournament team for the sport opens the "Create a tournament team first" prompt (J5); its button opens the Create team form.
 * - FEE_CHANGED (409) carries the current `registration_fee_cents`: the sheet takes it and asks again, no result pop-up.
 * - A fee that cannot be read blocks Confirm. The request is never sent without a known fee.
 * - The refetch after a successful registration is best effort: the registration already happened, so a failed refetch is not a failure.
 * - A 404 closes the flow and hands over to the host's "no longer available" handling.
 */
import React, { useCallback, useRef, useState } from 'react';

import { withCorrelationId } from '../api/correlationId';
import { getMyTeams } from '../api/teams';
import { registerForTournament } from '../api/tournaments';
import {
  CreateTeamPrompt,
  RegistrationConfirmSheet,
  RegistrationResultPopup,
  type RegistrationPaymentInfo,
} from '../components/tournament/RegistrationDialogs';
import { useT } from '../labels/LabelsContext';
import type { Team } from '../types/team';
import type { Tournament, TournamentParticipationMode } from '../types/tournament';
import { isNotFoundError } from '../utils/apiError';
import { formatMoney, hasFee } from '../utils/money';
import { useSportDisplayName } from '../utils/labels';
import {
  classifyRegistrationError,
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
  | { kind: 'noTeam' }
  | { kind: 'result'; failure: RegistrationFailure | null; payment: RegistrationPaymentInfo | null };

interface Options {
  /**
   * Runs after a successful registration (refetch the tournament and registrations), under the same correlation id. Returns the fresh tournament,
   * whose `my_registration` and `payment_contact_number` fill the "pay to" box of the result pop-up.
   */
  onRegistered: (correlationId: string) => Promise<Tournament | void>;
  onNotFound: () => void;
  onOpenSkillLevels: () => void;
  /** Opens the Create team form ("Create a tournament team first", J5). */
  onCreateTeam: () => void;
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
  const sportLabel = useSportDisplayName(target?.sport ?? '');

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
      // Team mode (AD-3): read the caller's teams first. No tournament team for this sport: no confirmation, the "Create a tournament team first"
      // prompt (J5) opens instead. The server stays authoritative (TEAM_REQUIRED).
      withCorrelationId(correlationId => getMyTeams({ correlationId }))
        .then(all => {
          const mine = teamsForSport(all, next.sport);
          if (mine.length === 0) {
            setPhase({ kind: 'noTeam' });
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
          setPhase({ kind: 'result', failure: classifyRegistrationError(error), payment: null });
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
        // A free tournament shows the result at once. With a fee the pop-up waits for the refetch, because the payee number only reaches the
        // person who registered once the server knows they have: it is read from the fresh tournament, never from the registration answer.
        const feeApplies = hasFee(target.feeCents) && Boolean(target.currency);
        if (!feeApplies) {
          setPhase({ kind: 'result', failure: null, payment: null });
        }
        let fresh: Tournament | undefined;
        try {
          const result = await optionsRef.current.onRegistered(correlationId);
          fresh = result ? result : undefined;
        } catch (error) {
          if (isNotFoundError(error)) {
            optionsRef.current.onNotFound();
          }
        }
        if (feeApplies) {
          const mine = fresh ? fresh.my_registration : null;
          const cents = mine?.effective_fee_cents ?? mine?.fee_cents_at_registration ?? target.feeCents;
          setPhase({
            kind: 'result',
            failure: null,
            payment: {
              amount: formatMoney(hasFee(cents) ? cents : (target.feeCents as number), target.currency as string),
              number: mine?.payment_contact_number ?? fresh?.payment_contact_number ?? null,
            },
          });
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
        setPhase({ kind: 'result', failure, payment: null });
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [target, teamId, close, t]);

  if (!target || phase.kind === 'closed') {
    return { start, element: null };
  }

  const teamMode = target.mode === 'team';
  const feeValue = !target.feeReadable
    ? ''
    : hasFee(target.feeCents) && target.currency
    ? t(teamMode ? 'mob.pay.per_team' : 'mob.pay.per_player', { amount: formatMoney(target.feeCents, target.currency) })
    : t('mob.reg.free');
  const paymentNote =
    target.feeReadable && hasFee(target.feeCents) ? t(teamMode ? 'mob.pay.sheet_note_team' : 'mob.pay.sheet_note_individual') : null;
  let element: React.JSX.Element;
  if (phase.kind === 'noTeam') {
    element = (
      <CreateTeamPrompt
        tournamentName={target.name}
        sport={sportLabel}
        onNotNow={close}
        onCreate={() => {
          close();
          optionsRef.current.onCreateTeam();
        }}
      />
    );
  } else if (phase.kind === 'confirm') {
    element = (
      <RegistrationConfirmSheet
        title={teamMode ? t('mob.reg.sheet_title_team') : t('mob.reg.sheet_title_individual', { name: target.name })}
        subtitle={teamMode ? t('mob.reg.sheet_sub_team') : t('mob.reg.sheet_sub_individual')}
        entryLabel={teamMode ? null : t('mob.reg.entry_individual')}
        feeValue={feeValue}
        paymentNote={paymentNote}
        feeReadable={target.feeReadable}
        notice={phase.notice}
        busy={busy}
        teams={
          teams
            ? teams.map(team => ({
                id: team.id,
                label:
                  typeof team.player_count === 'number'
                    ? t('mob.reg.team_option', { name: team.name, sport: sportLabel, count: team.player_count })
                    : t('mob.reg.team_option_no_count', { name: team.name, sport: sportLabel }),
              }))
            : undefined
        }
        selectedTeamId={teamId}
        onSelectTeam={setTeamId}
        onConfirm={submit}
        onCancel={close}
      />
    );
  } else {
    element = (
      <RegistrationResultPopup
        subtitle={t('mob.reg.result_sub', { name: target.name, fee: feeValue })}
        failure={phase.failure}
        payment={phase.payment}
        onRetry={() => {
          // A retry is a new user action with a fresh correlation id. Team mode whose team list never loaded starts over.
          if (teamMode && !teams) {
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
        onChooseTeam={() => setPhase({ kind: 'confirm', notice: null })}
        onClose={close}
      />
    );
  }
  return { start, element };
}
