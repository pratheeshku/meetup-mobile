/**
 * Tournament Detail screen (DES-MEETUP-MOBILE.md §4.5, §7.7; R-041, R-042).
 *
 * Fixtures are rendered exactly as returned by the backend (scores,
 * status, round) — no client-side computation of anything derived from
 * them (R-042's "no separate calculation performed by the app itself").
 *
 * Note on the "Standings" tab: §4.5's screen inventory and R-042 both
 * describe a Standings/leaderboard view, but no endpoint for it exists
 * anywhere in the design's API contract (§7.7 has no `.../standings` or
 * `.../leaderboard` route) — confirmed by a full-document search. A
 * client-computed standings table would violate R-042 directly, and an
 * invented endpoint would violate the "nothing invented" fidelity rule.
 * This task's own brief already sidesteps the gap by asking for
 * Fixtures + Registrations tabs only (not Standings) — built exactly
 * that; the underlying design gap is flagged in the Implementation
 * Report for a future task if a real Standings view is ever requested.
 *
 * Game-view redesign (DES-MEETUP-ADDENDUM-game-view-redesign GV-2..GV-5, GV-7, AD-1, AD-9, AD-10):
 * the Fixtures | Registrations toggle is gone. Order: Details (venue row, invite-type row),
 * Responses (Registered / Accepted, not yet registered / Declined / Pending; organizer and
 * committee), Invite, Fixtures, then the closure panel last. A viewer who cannot read the
 * responses keeps a plain Registrations list, so no registration data disappears for them.
 *
 * Role/permission gating here is UX-only (§3.10, §5.3) — every gated
 * action still calls its endpoint normally and the backend remains the
 * sole authority.
 *
 * Cancel has no confirmation dialog, matching this project's own
 * precedent for event cancellation (`EventDetailScreen`) — the brief
 * doesn't ask for one here either, unlike the Groups/Profile modules'
 * explicit "confirmation alert" instructions for their destructive
 * actions.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { withCorrelationId } from '../api/correlationId';
import {
  cancelTournament,
  declineTournament,
  getCommitteeInvitation,
  getFixtures,
  getRegistrations,
  getTournament,
  getTournamentClosure,
  getTournamentInvitations,
  getTournamentResponses,
  getTournamentScoringState,
  putTournamentClosure,
  withdrawFromTournament,
} from '../api/tournaments';
import { getClientConfig } from '../api/config';
import Button from '../components/Button';
import UserAvatar from '../components/UserAvatar';
import UserMenuSheet from '../components/user/UserMenuSheet';
import UserPressable from '../components/user/UserPressable';
import { useUserMenu } from '../hooks/useUserMenu';
import Card from '../components/Card';
import LifecycleStatusChip from '../components/LifecycleStatusChip';
import ResponsesSection from '../components/responses/ResponsesSection';
import ClosureSummaryCard from '../components/closure/ClosureSummaryCard';
import ClosureModal, { type CandidateItem } from '../components/closure/ClosureModal';
import VenueRow from '../components/venue/VenueRow';
import InviteTypeRow from '../components/invite/InviteTypeRow';
import CommitteeInvitationCard from '../components/tournament/CommitteeInvitationCard';
import TournamentFeeLine from '../components/tournament/TournamentFeeLine';
import TournamentInvitationBanner from '../components/tournament/TournamentInvitationBanner';
import TournamentInvitePanel from '../components/tournament/TournamentInvitePanel';
import TournamentScoringEntry from '../components/scoring/TournamentScoringEntry';
import TournamentDetailV2 from '../components/tournament/v2/TournamentDetailV2';
import type { RegisterAction } from '../components/tournament/v2/TournamentHeader';
import type { TournamentScoringState } from '../types/tournamentScoring';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type {
  CommitteeInvitationSummary,
  ResponsesResponse,
  Tournament,
  TournamentClosurePerson,
  TournamentClosureResponse,
  TournamentFixture,
  TournamentInvitation,
  TournamentRegistration,
} from '../types/tournament';
import { showCompletion, type CompletionRow } from '../navigation/showCompletion';
import { useCommitteeInvitationResponse } from '../hooks/useCommitteeInvitationResponse';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';
import { useUnavailableScreen } from '../hooks/useUnavailableScreen';
import { getApiErrorMessage, isNotFoundError } from '../utils/apiError';
import { tournamentCloseButton } from '../components/tournament/TournamentCloseButton';
import { registrationTargetFor, useTournamentRegistration } from '../hooks/useTournamentRegistration';
import { committeeAnswerOutcome, type CommitteeAnswerState } from '../utils/committeeInvitation';
import type { LabelKey } from '../labels/fallbackLabels';
import { isActiveRegistration } from '../utils/responseGroups';
import { usesV2Page } from '../utils/tournamentTabs';
import { useSportDisplayName } from '../utils/labels';
import { formatEventDate } from '../utils/formatEventDateTime';
import type { TournamentsStackParamList } from '../navigation/types';
import { useT } from '../labels/LabelsContext';

type Props = NativeStackScreenProps<TournamentsStackParamList, 'TournamentDetail'>;

/** The viewer's own registration is active and the tournament is still on: the banner shows "You're registered". */
function canWithdrawNow(status: string, ended: boolean): boolean {
  return !ended && status === 'registered';
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const REGISTRATION_AVATAR_SIZE = 40;

export default function TournamentDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const t = useT();
  const { tournamentId } = route.params;
  const { user } = useAuth();
  const currentUserId = user?.id;
  const tRef = useRef(t);
  tRef.current = t;

  // Tournament people open the combined user pop-up from the row: identity only, no card request, no actions in v1.
  const personMenu = useUserMenu({ context: { type: 'tournament', id: tournamentId } });

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [fixtures, setFixtures] = useState<TournamentFixture[]>([]);
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  // `GET .../scoring/state`: its server `tabs` object exists for lifecycle version 2 only, so it also tells which page to show.
  const [scoring, setScoring] = useState<TournamentScoringState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The live refresh of the version 2 tabs runs only while this screen is the focused one.
  const [focused, setFocused] = useState(true);
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener?.('focus', () => setFocused(true));
    const unsubscribeBlur = navigation.addListener?.('blur', () => setFocused(false));
    return () => {
      unsubscribeFocus?.();
      unsubscribeBlur?.();
    };
  }, [navigation]);
  // Called before the loading/error early returns below (Rules of Hooks) —
  // `tournament` is still possibly `null` here.
  const sportLabel = useSportDisplayName(tournament?.sport ?? '');

  const [registerError, setRegisterError] = useState<string | null>(null);

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Closure state
  const [closure, setClosure] = useState<TournamentClosureResponse | null>(null);
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [isClosureSubmitting, setIsClosureSubmitting] = useState(false);
  const [closureError, setClosureError] = useState<string | null>(null);

  // Organizer responses state (dr-mobile / DES-MEETUP-ADDENDUM-decline-response AD-5)
  const [responses, setResponses] = useState<ResponsesResponse | null>(null);
  const [invitations, setInvitations] = useState<TournamentInvitation[] | null>(null);

  const closureCandidates: CandidateItem[] = useMemo(() => {
    if (closure?.candidates && closure.candidates.length > 0) {
      return closure.candidates.map((c: TournamentClosurePerson) => ({
        id: c.registration_id ?? '',
        displayName: c.display_name,
        photoUrl: c.photo_url ?? null,
      }));
    }
    return registrations.map(r => ({
      id: r.id,
      displayName: r.nickname,
      photoUrl: null,
    }));
  }, [closure?.candidates, registrations]);

  // Committee invitation card (tl-c-mobile-3). The card stays up after a refusal so its label can be read; only a
  // successful answer closes it.
  const [committeeCardOpen, setCommitteeCardOpen] = useState(false);
  const [committeeSummary, setCommitteeSummary] = useState<CommitteeInvitationSummary | null>(null);
  const [committeeNote, setCommitteeNote] = useState<{ state: CommitteeAnswerState; labelKey: LabelKey } | null>(null);
  const committeeLoadTried = useRef(false);
  const committeeAnswered = useRef(false);
  const committeeAnswering = useRef(false);
  const committeeAnswerGone = useRef(false);
  const lastCommitteeAnswer = useRef<boolean | null>(null);

  const [venueCatalogueEnabled, setVenueCatalogueEnabled] = useState(false);

  useEffect(() => {
    getClientConfig()
      .then(cfg => {
        setVenueCatalogueEnabled(Boolean(cfg.venue_catalogue_enabled));
      })
      .catch(() => setVenueCatalogueEnabled(false));
  }, []);

  const committeeSummaryRef = useRef<CommitteeInvitationSummary | null>(null);
  /**
   * Reads the invitation card once per visit. A refusal becomes the card's inline state; with `cardOnly` (the tournament
   * itself could not be read) a refusal shows nothing and the caller closes the screen as before.
   */
  const loadCommitteeSummary = useCallback(
    async (cardOnly: boolean = false): Promise<boolean> => {
      if (committeeSummaryRef.current) {
        return true;
      }
      if (committeeLoadTried.current && !cardOnly) {
        return false;
      }
      committeeLoadTried.current = true;
      try {
        const summary = await getCommitteeInvitation(tournamentId);
        committeeSummaryRef.current = summary;
        setCommitteeSummary(summary);
        setCommitteeNote(null);
        setCommitteeCardOpen(true);
        return true;
      } catch (error) {
        if (!cardOnly) {
          const outcome = committeeAnswerOutcome(error);
          setCommitteeNote({
            state: outcome.state,
            labelKey: outcome.labelKey ?? 'mob.committee_invite.failed',
          });
        }
        return false;
      }
    },
    [tournamentId],
  );

  // `silent` refreshes in place (focus / foreground after the first load) instead of flashing
  // the loading view.
  const unavailable = useUnavailableScreen(navigation);
  const loadAll = useCallback(
    async (silent: boolean = false, correlationId?: string) => {
      const options = correlationId ? { correlationId } : undefined;
      if (!silent) {
        setIsLoading(true);
        setLoadError(null);
      }
      try {
        const [tournamentData, fixturesData, registrationsData, closureData, responsesData, invitationsData, scoringData] =
          await Promise.all([
            getTournament(tournamentId, options),
            getFixtures(tournamentId, options),
            getRegistrations(tournamentId, options),
            typeof getTournamentClosure === 'function'
              ? getTournamentClosure(tournamentId, options).catch(() => null)
              : Promise.resolve(null),
            typeof getTournamentResponses === 'function'
              ? getTournamentResponses(tournamentId, options).catch(() => null)
              : Promise.resolve(null),
            typeof getTournamentInvitations === 'function'
              ? getTournamentInvitations(tournamentId, options).catch(() => null)
              : Promise.resolve(null),
            typeof getTournamentScoringState === 'function'
              ? getTournamentScoringState(tournamentId, options).catch(() => null)
              : Promise.resolve(null),
          ]);
        setTournament(tournamentData);
        setFixtures(fixturesData);
        setRegistrations(registrationsData);
        if (closureData) {
          setClosure(closureData);
        }
        if (responsesData && responsesData.accepted) {
          setResponses(responsesData);
        } else {
          setResponses(null);
        }
        setInvitations(Array.isArray(invitationsData) ? invitationsData : null);
        // A failed state read on a silent refresh keeps the page the viewer is on (no flip to the legacy page).
        setScoring(previous => scoringData ?? (silent ? previous : null));
        if (tournamentData.my_committee_invitation === 'pending' && !committeeAnswered.current) {
          setCommitteeCardOpen(true);
          await loadCommitteeSummary();
        }
      } catch (error) {
        // 404 = gone or no longer visible to this user (AC-11, AC-07: a registered player who
        // lost access sees nothing): close with the neutral message, once. An invited committee person may not be
        // able to view the tournament yet; the card read is theirs alone, so the card shows by itself (as on web).
        if (isNotFoundError(error)) {
          if (committeeAnswering.current) {
            committeeAnswerGone.current = true;
          } else if (!committeeAnswered.current && (await loadCommitteeSummary(true))) {
            setTournament(null);
          } else {
            unavailable.onNotFound();
          }
        } else if (!silent) {
          setLoadError(tRef.current('mob.tournament.load_error'));
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [tournamentId, unavailable, loadCommitteeSummary],
  );

  // Fetch on every focus and app foreground (AC-10), including a push that opens a tournament
  // already on the stack.
  const loadedTournamentIdRef = useRef<string | null>(null);
  useRefetchOnFocus(
    navigation,
    useCallback(() => {
      const silent = loadedTournamentIdRef.current === tournamentId;
      if (!silent) {
        unavailable.reset();
        committeeLoadTried.current = false;
        committeeAnswered.current = false;
        committeeSummaryRef.current = null;
        setCommitteeCardOpen(false);
        setCommitteeSummary(null);
        setCommitteeNote(null);
      }
      loadedTournamentIdRef.current = tournamentId;
      loadAll(silent);
    }, [loadAll, tournamentId, unavailable]),
    tournamentId,
  );

  /** Re-reads the tournament so access/invitation status reflect the server. */
  const refreshTournament = useCallback(async (): Promise<void> => {
    try {
      const fresh = await getTournament(tournamentId);
      setTournament(fresh);
    } catch (error) {
      // 404 (for example after declining the invitation): close; other errors surface as before.
      if (isNotFoundError(error)) {
        unavailable.onNotFound();
        return;
      }
      throw error;
    }
  }, [tournamentId, unavailable]);

  // One user action = one correlation id: the hook sends it with the answer and hands it to this re-read.
  const refreshAfterCommitteeAnswer = useCallback(
    (correlationId: string): Promise<void> => loadAll(true, correlationId),
    [loadAll],
  );
  const committeeResponse = useCommitteeInvitationResponse(tournamentId, refreshAfterCommitteeAnswer);

  const answerCommitteeInvitation = async (accept: boolean): Promise<void> => {
    if (committeeAnswering.current) {
      return;
    }
    lastCommitteeAnswer.current = accept;
    committeeAnswering.current = true;
    committeeAnswerGone.current = false;
    setCommitteeNote(null);
    try {
      const outcome = await committeeResponse.respond(accept);
      if (!outcome) {
        return;
      }
      if (outcome.state === 'done') {
        committeeAnswered.current = true;
        setCommitteeCardOpen(false);
        if (committeeAnswerGone.current) {
          // The re-read says the tournament is out of sight (a decline from someone outside its audience).
          if (!accept) {
            unavailable.markOwnAction();
          }
          unavailable.onNotFound();
        }
      } else if (outcome.labelKey) {
        setCommitteeNote({ state: outcome.state, labelKey: outcome.labelKey });
      }
    } finally {
      committeeAnswering.current = false;
    }
  };

  const retryCommitteeInvitation = async (): Promise<void> => {
    if (!committeeSummary) {
      committeeLoadTried.current = false;
      setCommitteeNote(null);
      await loadCommitteeSummary();
    } else if (lastCommitteeAnswer.current !== null) {
      await answerCommitteeInvitation(lastCommitteeAnswer.current);
    }
  };

  const committeeCard = committeeCardOpen ? (
    <CommitteeInvitationCard
      summary={committeeSummary}
      state={committeeNote?.state ?? null}
      messageKey={committeeNote?.labelKey ?? null}
      busy={committeeResponse.busy}
      onAccept={() => answerCommitteeInvitation(true)}
      onDecline={() => answerCommitteeInvitation(false)}
      onRetry={retryCommitteeInvitation}
    />
  ) : null;

  // Register opens the confirmation sheet (AD-5); Confirm posts with the fee the person saw, the result pop-up reports the outcome.
  const registrationFlow = useTournamentRegistration({
    onRegistered: async correlationId => {
      const [tournamentData, registrationsData] = await Promise.all([
        getTournament(tournamentId, { correlationId }),
        getRegistrations(tournamentId, { correlationId }),
      ]);
      setTournament(tournamentData);
      setRegistrations(registrationsData);
    },
    onNotFound: unavailable.onNotFound,
    onOpenSkillLevels: () => {
      (navigation.getParent() as any)?.navigate('Profile', { screen: 'EditSkillLevels' });
    },
  });
  const startRegistration = registrationFlow.start;

  const handleRegister = (): void => {
    if (!tournament) {
      return;
    }
    setRegisterError(null);
    startRegistration(registrationTargetFor(tournament));
  };

  // The X (AD-9): back to the list the person came from, which keeps its scope, Active/All and sport filter (the list screen stays mounted
  // under this one). With no list behind it (push, share link, deep link) it opens Tournaments at its defaults.
  const closeToList = useCallback((): void => {
    const state = navigation.getState?.();
    const previous = state ? state.routes[state.index - 1] : undefined;
    if (previous?.name === 'TournamentsList' && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('TournamentsList', { segment: 'tournaments', scope: 'mine', entryKey: Date.now() });
    }
  }, [navigation]);
  useEffect(() => {
    navigation.setOptions?.({ headerRight: tournamentCloseButton(closeToList) });
  }, [navigation, closeToList]);

  // A tournament invitation push whose Register needs the app (fee above 0 or team mode) lands on the confirmation sheet, once.
  const openRegistration = route.params?.openRegistration === true;
  const handleRegisterRef = useRef(handleRegister);
  handleRegisterRef.current = handleRegister;
  const openedRegistration = useRef(false);
  useEffect(() => {
    if (openRegistration && tournament && !openedRegistration.current) {
      openedRegistration.current = true;
      navigation.setParams({ openRegistration: undefined });
      handleRegisterRef.current();
    }
  }, [openRegistration, tournament, navigation]);

  const handleWithdraw = async (): Promise<void> => {
    setWithdrawError(null);
    const myRegistration = registrations.find(r => r.user_id === currentUserId);
    if (!myRegistration) {
      setWithdrawError(t('mob.tournament.registration_missing'));
      return;
    }
    setIsWithdrawing(true);
    try {
      await withCorrelationId(async correlationId => {
        await withdrawFromTournament(tournamentId, myRegistration.id, { correlationId });
        // The user's own action: a 404 on the refetch below closes the screen quietly.
        unavailable.markOwnAction();
        const [tournamentData, registrationsData] = await Promise.all([
          getTournament(tournamentId, { correlationId }),
          getRegistrations(tournamentId, { correlationId }),
        ]);
        setTournament(tournamentData);
        setRegistrations(registrationsData);
      });
    } catch (e: any) {
      if (isNotFoundError(e)) {
        unavailable.onNotFound();
      } else if (
        e?.response?.status === 409 &&
        (e?.response?.data?.code === 'game_ended' ||
          e?.response?.data?.code === 'tournament_ended' ||
          e?.response?.data?.detail === 'This game has ended and can no longer be changed')
      ) {
        setWithdrawError(t('mob.closure.game_ended'));
      } else {
        const reason = e?.response?.data?.detail || e?.response?.data?.reason;
        setWithdrawError(reason ?? t('mob.tournament.withdraw_error'));
      }
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleDecline = async (): Promise<void> => {
    setWithdrawError(null);
    setIsWithdrawing(true);
    try {
      await withCorrelationId(async correlationId => {
        await declineTournament(tournamentId, { correlationId });
        unavailable.markOwnAction();
        await loadAll(true);
      });
    } catch (e: any) {
      if (isNotFoundError(e)) {
        unavailable.onNotFound();
      } else if (
        e?.response?.status === 409 &&
        (e?.response?.data?.code === 'game_ended' ||
          e?.response?.data?.code === 'tournament_ended' ||
          e?.response?.data?.detail === 'This game has ended and can no longer be changed')
      ) {
        setWithdrawError(t('mob.closure.game_ended'));
      } else {
        const reason = e?.response?.data?.detail || e?.response?.data?.reason;
        setWithdrawError(reason ?? t('mob.tournament.withdraw_error'));
      }
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleSaveClosure = async (payload: {
    outcome: 'completed' | 'not_held';
    attendeeIds: string[];
    winnerId: string | null;
    runnerUpId: string | null;
    expectedVersion: number;
  }) => {
    setIsClosureSubmitting(true);
    setClosureError(null);
    try {
      await withCorrelationId(async correlationId => {
        const updated = await putTournamentClosure(
          tournamentId,
          {
            outcome: payload.outcome,
            attendee_registration_ids: payload.attendeeIds,
            winner_registration_id: payload.winnerId,
            runner_up_registration_id: payload.runnerUpId,
            expected_version: payload.expectedVersion,
          },
          { correlationId },
        );
        setClosure(updated);
        setIsClosureModalOpen(false);
        await loadAll(true);

        const winnerCandidate = updated.candidates?.find(
          c => c.registration_id === payload.winnerId,
        );
        const runnerCandidate = updated.candidates?.find(
          c => c.registration_id === payload.runnerUpId,
        );

        const rows: CompletionRow[] = [
          { label: t('mob.done.f_title'), value: tournament?.name ?? '' },
          {
            label: t('mob.closure.title'),
            value:
              payload.outcome === 'completed'
                ? t('mob.closure.outcome.played')
                : t('mob.closure.outcome.not_held'),
          },
        ];
        if (payload.outcome === 'completed' && winnerCandidate) {
          rows.push({
            label: t('mob.closure.winner'),
            value: winnerCandidate.display_name,
          });
        }
        if (payload.outcome === 'completed' && runnerCandidate) {
          rows.push({
            label: t('mob.closure.runner_up'),
            value: runnerCandidate.display_name,
          });
        }

        showCompletion({
          flow: 'tournament_closed',
          rows,
          primary: 'dashboard',
        });
      });
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const detail = err?.response?.data?.detail;
      if (
        err?.response?.status === 409 &&
        (code === 'version_conflict' || (typeof detail === 'object' && detail?.message))
      ) {
        setClosureError(t('mob.closure.version_conflict'));
        try {
          const reloaded = await getTournamentClosure(tournamentId);
          setClosure(reloaded);
        } catch {
          // Keep current
        }
      } else {
        setClosureError(getApiErrorMessage(err, t('mob.tournament.load_error')));
      }
    } finally {
      setIsClosureSubmitting(false);
    }
  };

  const handleCancel = async (): Promise<void> => {
    setCancelError(null);
    setIsCancelling(true);
    try {
      await cancelTournament(tournamentId);
      // The organiser's own action: any 404 after this closes the screen quietly.
      unavailable.markOwnAction();
      if (tournament) {
        showCompletion({
          flow: 'tournament_cancelled',
          rows: [
            { label: t('mob.done.f_title'), value: tournament.name },
            { label: t('mob.done.f_sport'), value: sportLabel },
            { label: t('mob.done.f_date'), value: formatEventDate(tournament.starts_at) },
            { label: t('mob.done.f_status'), value: t('mob.done.v_cancelled') },
          ],
          primary: 'dashboard',
        });
      }
    } catch (e) {
      if (isNotFoundError(e)) {
        unavailable.onNotFound();
      } else {
        setCancelError(t('mob.tournament.cancel_error'));
      }
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return <LoadingView />;
  }

  // The tournament cannot be read but the invitation card can (an invited person outside its audience): the card alone.
  if (!tournament && committeeCard && !loadError) {
    return <ScrollView contentContainerStyle={styles.container}>{committeeCard}</ScrollView>;
  }

  if (loadError || !tournament) {
    return <ErrorView message={loadError ?? t('mob.tournament.not_found')} onRetry={() => loadAll(false)} />;
  }

  // Full-contract-audit fix (2026-09-18, see
  // docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md): the real backend's
  // `TournamentResponse` has no `current_user_registration_status` or
  // `is_organiser` field, and `api/tournaments.ts` cannot derive either
  // (no access to the signed-in user's id). Computed here instead, from
  // data this screen already loads: `registrations` (for the user's own
  // registration status) and `tournament.organiser_id` vs `currentUserId`
  // (for organiser status) — the same `myRegistration` lookup
  // `handleWithdraw` below already performs.
  const myRegistration = registrations.find(r => r.user_id === currentUserId);
  const currentUserRegistrationStatus = myRegistration?.status ?? 'none';
  const isOrganiser = tournament.organiser_id === currentUserId;
  // Organizer or committee (the server's `my_invite_access`); the responses endpoint stays the authority.
  const canReadResponses =
    isOrganiser ||
    tournament.my_invite_access === 'full' ||
    tournament.my_invite_access === 'individuals';

  const endInstant = tournament.ends_at ? Date.parse(tournament.ends_at) : NaN;
  const isTournamentEnded =
    tournament.lifecycle_status === 'past' ||
    tournament.lifecycle_status === 'closed' ||
    (tournament.lifecycle_status !== 'active' &&
      tournament.status !== 'upcoming' &&
      !Number.isNaN(endInstant) &&
      Date.now() >= endInstant);

  const canRegister =
    !isTournamentEnded &&
    tournament.registration_open &&
    currentUserRegistrationStatus === 'none';
  const canWithdraw = !isTournamentEnded && currentUserRegistrationStatus === 'registered';
  const showRegistrationClosedMessage =
    !isTournamentEnded &&
    !tournament.registration_open &&
    currentUserRegistrationStatus === 'none';
  const canCancel =
    !isTournamentEnded &&
    isOrganiser &&
    tournament.status !== 'completed' &&
    tournament.status !== 'cancelled' &&
    tournament.lifecycle_status !== 'closed';

  // Lifecycle version 2 (`lifecycle_version`; an older server that sends none falls back to the server `tabs` object):
  // header, tabs and tab bodies of the tournament-experience design. Version 1 keeps the page below unchanged.
  if (usesV2Page(tournament, scoring)) {
    const activeCount = registrations.filter(isActiveRegistration).length;
    const registrationOpen = scoring?.registration_phase === 'open';
    const canRegisterV2 =
      !isTournamentEnded &&
      registrationOpen &&
      (currentUserRegistrationStatus === 'none' || Boolean(tournament.my_declined)) &&
      tournament.my_invitation_status !== 'pending';
    const register: RegisterAction = canWithdrawNow(currentUserRegistrationStatus, isTournamentEnded)
      ? { kind: 'registered' }
      : canRegisterV2
      ? {
          kind: 'register',
          spotsLeft: Math.max(0, tournament.max_participants - activeCount),
          loading: false,
          onPress: handleRegister,
        }
      : null;
    const secondary = canWithdraw
      ? { label: t('mob.respond.decline'), loading: isWithdrawing, onPress: handleWithdraw }
      : canRegisterV2 && !tournament.my_declined && tournament.my_invitation_status !== 'accepted'
      ? { label: t('mob.respond.decline'), loading: isWithdrawing, onPress: handleDecline }
      : null;
    return (
      <TournamentDetailV2
        tournament={tournament}
        scoring={scoring}
        registeredCount={activeCount}
        closure={closure}
        sportLabel={sportLabel}
        viewerId={currentUserId}
        registrations={registrations}
        focused={focused}
        isOrganiser={isOrganiser}
        isCommittee={canReadResponses}
        register={register}
        secondary={secondary}
        notice={registerError ?? withdrawError}
        cancel={{ visible: canCancel, loading: isCancelling, error: cancelError, onPress: handleCancel }}
        banners={
          <>
            {committeeCard}
            {registrationFlow.element}
            <TournamentInvitationBanner
              onRegister={handleRegister}
              tournamentId={tournament.id}
              status={tournament.my_invitation_status}
              onResponded={async result => {
                if (result?.accepted === false) {
                  unavailable.markOwnAction();
                }
                await refreshTournament();
              }}
              onNotFound={unavailable.onNotFound}
            />
          </>
        }
        invitePanel={
          <TournamentInvitePanel
            tournamentId={tournament.id}
            access={tournament.my_invite_access}
            title={tournament.name}
            responses={canReadResponses ? responses : null}
            onSent={() => loadAll(true)}
          />
        }
        responses={
          responses ? (
            <View style={styles.block}>
              <ResponsesSection
                responses={responses}
                entity="tournament"
                menu={personMenu}
                summary={t('mob.gv.registered_of', {
                  registered: registrations.filter(isActiveRegistration).length,
                  capacity: tournament.max_participants,
                })}
                organizerId={tournament.organiser_id}
                registrations={registrations}
              />
            </View>
          ) : null
        }
        onChanged={() => loadAll(true)}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {committeeCard}
      <Card style={styles.infoCard}>
        <Text style={styles.title}>{tournament.name}</Text>
        <Text style={styles.meta}>
          {sportLabel} · {tournament.format}
        </Text>
        <View style={styles.statusChipRow}>
          {!isOrganiser && tournament.my_declined ? (
            <View style={styles.declinedPill} testID="tournament-declined-badge">
              <Text style={styles.declinedPillText}>{t('mob.respond.declined')}</Text>
            </View>
          ) : null}
          <LifecycleStatusChip
            status={
              tournament.lifecycle_status ??
              (tournament.status === 'cancelled' ? 'cancelled' : 'active')
            }
            outcome={tournament.closure_outcome}
          />
        </View>
        <Text style={styles.meta}>
          {t('mob.tournament.organised_by', { name: tournament.organiser_nickname })}
        </Text>
        <Text style={styles.meta}>
          {t('mob.tournament.starts', { when: formatDateTime(tournament.starts_at) })}
        </Text>
        {/* `registrations.length` used instead of `tournament.participant_count` —
            the real backend has no such field; this screen already fetches
            the registrations list, so this is exact rather than a
            placeholder (see the audit report / mapTournamentApiItem). */}
        <Text style={styles.meta}>
          {t('mob.tournament.registered_line', {
            count: registrations.length,
            max: tournament.max_participants,
          })}
        </Text>
        <Text style={styles.description}>{tournament.description}</Text>
        {venueCatalogueEnabled ? (
          <VenueRow
            snapshot={tournament.venue_snapshot}
            fallbackText={tournament.venue_label || tournament.name}
            venueName={tournament.venue_name}
            mapsApiKey={null}
            tournamentId={tournament.id}
            isOrganiser={isOrganiser}
          />
        ) : null}
        <InviteTypeRow
          isPublic={tournament.visibility === 'public'}
          groups={
            tournament.visibility === 'group' && tournament.group_name
              ? [{ key: 'group', name: tournament.group_name }]
              : []
          }
          responses={canReadResponses ? responses : null}
          invitations={canReadResponses ? invitations : null}
          organizerId={tournament.organiser_id}
          menuContext={{ type: 'tournament', id: tournamentId }}
          onChanged={() => loadAll(true)}
        />
      </Card>


      {tournament.lifecycle_status === 'closed' && !isOrganiser ? (
        <ClosureSummaryCard
          outcome={tournament.closure_outcome ?? closure?.outcome ?? 'completed'}
          winnerName={closure?.winner?.display_name}
          runnerUpName={closure?.runner_up?.display_name}
          canEdit={isOrganiser && (closure?.can_close ?? true)}
          onEditPress={() => setIsClosureModalOpen(true)}
          entityType="tournament"
        />
      ) : null}

      <TournamentInvitationBanner
        onRegister={handleRegister}
        tournamentId={tournament.id}
        status={tournament.my_invitation_status}
        onResponded={async result => {
          // Declining is the user's own action and can take the tournament out of sight.
          if (result?.accepted === false) {
            unavailable.markOwnAction();
          }
          await refreshTournament();
        }}
        onNotFound={unavailable.onNotFound}
      />

      {/* Organizer / committee: Responses (GV-4, AD-1, AD-3); a refused or failed call keeps today's content. */}
      {responses ? (
        <View style={styles.block}>
          <ResponsesSection
            responses={responses}
            entity="tournament"
            menu={personMenu}
            summary={t('mob.gv.registered_of', {
              registered: registrations.filter(isActiveRegistration).length,
              capacity: tournament.max_participants,
            })}
            organizerId={tournament.organiser_id}
            registrations={registrations}
          />
        </View>
      ) : null}

      <View style={styles.block}>
        <TournamentInvitePanel
          tournamentId={tournament.id}
          access={tournament.my_invite_access}
          title={tournament.name}
          responses={canReadResponses ? responses : null}
          onSent={() => loadAll(true)}
        />
      </View>

      <TournamentFeeLine tournament={tournament} />
      {registrationFlow.element}
      {registerError ? <Text style={styles.errorText}>{registerError}</Text> : null}
      {withdrawError ? <Text style={styles.errorText}>{withdrawError}</Text> : null}

      {!isTournamentEnded ? (
        canWithdraw ? (
          <Button
            label={t('mob.respond.decline')}
            accessibilityLabel={t('mob.respond.decline')}
            variant="secondary"
            onPress={handleWithdraw}
            loading={isWithdrawing}
            style={styles.button}
            testID="tournament-decline-button"
          />
        ) : tournament.my_declined ? (
          // Registering also clears the decline and accepts the invitation (AD-3): Register for tournaments, never Accept.
          <Button
            label={t('mob.reg.register')}
            onPress={handleRegister}
            style={styles.button}
            testID="tournament-recover-button"
          />
        ) : canRegister && tournament.my_invitation_status !== 'pending' ? (
          // Accepted already, or the organizer (who has no one to decline for): Register alone.
          tournament.my_invitation_status === 'accepted' || isOrganiser ? (
            <Button
              label={t('mob.tournament.register')}
              onPress={handleRegister}
                style={styles.button}
              testID="tournament-register-button"
            />
          ) : (
            <View style={styles.buttonPairRow}>
              <Button
                label={t('mob.tournament.register')}
                onPress={handleRegister}
                    style={styles.pairButton}
                testID="tournament-register-button"
              />
              <Button
                label={t('mob.respond.decline')}
                variant="secondary"
                onPress={handleDecline}
                loading={isWithdrawing}
                style={styles.pairButton}
                testID="tournament-decline-button"
              />
            </View>
          )
        ) : null
      ) : null}

      {showRegistrationClosedMessage && !tournament.my_declined ? (
        <Text style={styles.closedNotice}>{t('mob.tournament.registration_closed')}</Text>
      ) : null}

      {/* Viewers without the Responses block keep the registrations list (no data disappears for them). */}
      {!responses ? (
        <Card style={styles.block}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {t('mob.tournament.tab_registrations')}
          </Text>
          {registrations.length === 0 ? (
            <Text style={styles.emptyText}>{t('mob.tournament.no_registrations')}</Text>
          ) : (
            registrations.map(registration => (
              <View key={registration.id} style={styles.listRow}>
                {/* Tournament people open the pop-up from the row only: identity, no card request, no
                    actions (design OI-8). A registration with no user id shows a placeholder avatar. */}
                <UserPressable
                  person={{
                    userId: registration.user_id,
                    displayName: registration.nickname,
                    photoUrl: null,
                  }}
                  menu={personMenu}
                  style={styles.registrationPerson}
                  testID={`registration-${registration.id}`}
                >
                  <UserAvatar
                    name={registration.user_id ? registration.nickname : null}
                    size={REGISTRATION_AVATAR_SIZE}
                    fallback="initials"
                  />
                  <View style={styles.registrationText}>
                    <Text style={styles.memberNickname}>{registration.nickname}</Text>
                    <Text style={styles.fixtureMeta}>
                      {t('mob.tournament.registered_at', {
                        when: formatDateTime(registration.registered_at),
                      })}
                    </Text>
                  </View>
                </UserPressable>
              </View>
          ))
          )}
        </Card>
      ) : null}

      <TournamentScoringEntry
        tournamentId={tournamentId}
        onOpen={() => navigation.navigate('TournamentScoring', { tournamentId })}
      />

      <Card style={styles.block} testID="tournament-fixtures-section">
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {t('mob.gv.fixtures')}
        </Text>
        {fixtures.length === 0 ? (
            <Text style={styles.emptyText}>{t('mob.tournament.no_matches')}</Text>
          ) : (
            fixtures.map(fixture => (
              <View key={fixture.id} style={styles.listRow}>
                <Text style={styles.fixtureRound}>{fixture.round}</Text>
                <Text style={styles.fixtureTeams}>
                  {fixture.home_team} {fixture.home_score ?? '-'} : {fixture.away_score ?? '-'}{' '}
                  {fixture.away_team}
                </Text>
                <Text style={styles.fixtureMeta}>
                  {formatDateTime(fixture.scheduled_at)} · {fixture.status}
                </Text>
              </View>
            ))
          )}
      </Card>

      {canCancel ? (
        <View style={styles.cancelSection}>
          {cancelError ? <Text style={styles.errorText}>{cancelError}</Text> : null}
          <Button
            label={t('mob.tournament.cancel')}
            variant="destructive"
            onPress={handleCancel}
            loading={isCancelling}
          />
        </View>
      ) : null}

      {/* Closure panel / notice and Close action go last (GV-7) */}
      {tournament.lifecycle_status === 'closed' && isOrganiser ? (
        <ClosureSummaryCard
          outcome={tournament.closure_outcome ?? closure?.outcome ?? 'completed'}
          winnerName={closure?.winner?.display_name}
          runnerUpName={closure?.runner_up?.display_name}
          canEdit={isOrganiser && (closure?.can_close ?? true)}
          onEditPress={() => setIsClosureModalOpen(true)}
          entityType="tournament"
        />
      ) : null}

      {tournament.lifecycle_status !== 'closed' && isOrganiser ? (
        !isTournamentEnded ? (
          <View style={styles.closureNoticeBox} testID="tournament-closure-opens-notice">
            <Text style={styles.closureNoticeText}>
              {t('mob.closure.opens_when_ended_tournament')}
            </Text>
          </View>
        ) : (
          <View style={styles.closureActionContainer}>
            <Button
              label={t('mob.closure.action.close_tournament')}
              variant="primary"
              onPress={() => setIsClosureModalOpen(true)}
              testID="close-tournament-button"
            />
          </View>
        )
      ) : null}

      <ClosureModal
        visible={isClosureModalOpen}
        onClose={() => {
          setIsClosureModalOpen(false);
          setClosureError(null);
        }}
        entityType="tournament"
        candidates={closureCandidates}
        initialOutcome={tournament.closure_outcome ?? closure?.outcome}
        initialAttendeeIds={closure?.attendees?.map(a => a.registration_id ?? '').filter(Boolean)}
        initialWinnerId={closure?.winner?.registration_id}
        initialRunnerUpId={closure?.runner_up?.registration_id}
        expectedVersion={closure?.version ?? 0}
        onSubmit={handleSaveClosure}
        isSubmitting={isClosureSubmitting}
        error={closureError}
      />

      <UserMenuSheet menu={personMenu} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  infoCard: { marginBottom: spacing.md },
  block: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm },
  statusChipRow: {
    marginVertical: spacing.xs,
    alignItems: 'flex-start',
  },
  closureNoticeBox: {
    padding: spacing.md,
    backgroundColor: colors.track,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  closureNoticeText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  closureActionContainer: {
    marginBottom: spacing.md,
  },
  meta: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs },
  description: { ...typography.body, color: colors.textPrimary, marginTop: spacing.sm },
  closedNotice: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  button: { marginBottom: spacing.sm },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  listRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  fixtureRound: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  fixtureTeams: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.xs },
  fixtureMeta: { ...typography.caption, color: colors.textSecondary },
  registrationPerson: { flexDirection: 'row', alignItems: 'center' },
  registrationText: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  memberNickname: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.xs },
  cancelSection: {
    marginTop: spacing.lg,
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  declinedPill: {
    backgroundColor: colors.track,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
  declinedPillText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  buttonPairRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pairButton: {
    flex: 1,
    marginTop: 0,
  },
});
