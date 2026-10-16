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
 * The Fixtures/Registrations "tabs" are two toggle buttons over one
 * screen, not a tab-navigator component — no tab library
 * (`@react-navigation/material-top-tabs` + `react-native-pager-view`)
 * is installed, and this task didn't ask for one. Same pattern as the
 * profile module's segmented-button skill-level picker (no native
 * picker library installed there either).
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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { withCorrelationId } from '../api/correlationId';
import {
  cancelTournament,
  getFixtures,
  getRegistrations,
  getTournament,
  registerForTournament,
  withdrawFromTournament,
} from '../api/tournaments';
import { getClientConfig } from '../api/config';
import Button from '../components/Button';
import Card from '../components/Card';
import VenueDetailCard from '../components/venue/VenueDetailCard';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import { borderWidth, colors, radius, sizes, spacing, typography } from '../theme/tokens';
import type { Tournament, TournamentFixture, TournamentRegistration } from '../types/tournament';
import { showCompletion } from '../navigation/showCompletion';
import { useSportDisplayName } from '../utils/labels';
import { formatEventDate } from '../utils/formatEventDateTime';
import type { TournamentsStackParamList } from '../navigation/types';
import { useT } from '../labels/LabelsContext';

type Props = NativeStackScreenProps<TournamentsStackParamList, 'TournamentDetail'>;

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function TournamentDetailScreen({ route }: Props): React.JSX.Element {
  const t = useT();
  const { tournamentId } = route.params;
  const { user } = useAuth();
  const currentUserId = user?.id;
  const tRef = useRef(t);
  tRef.current = t;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [fixtures, setFixtures] = useState<TournamentFixture[]>([]);
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fixtures' | 'registrations'>('fixtures');
  // Called before the loading/error early returns below (Rules of Hooks) —
  // `tournament` is still possibly `null` here.
  const sportLabel = useSportDisplayName(tournament?.sport ?? '');

  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [venueCatalogueEnabled, setVenueCatalogueEnabled] = useState(false);

  useEffect(() => {
    getClientConfig()
      .then(cfg => {
        setVenueCatalogueEnabled(Boolean(cfg.venue_catalogue_enabled));
      })
      .catch(() => setVenueCatalogueEnabled(false));
  }, []);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [tournamentData, fixturesData, registrationsData] = await Promise.all([
        getTournament(tournamentId),
        getFixtures(tournamentId),
        getRegistrations(tournamentId),
      ]);
      setTournament(tournamentData);
      setFixtures(fixturesData);
      setRegistrations(registrationsData);
    } catch {
      setLoadError(tRef.current('mob.tournament.load_error'));
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRegister = async (): Promise<void> => {
    setRegisterError(null);
    setIsRegistering(true);
    try {
      await withCorrelationId(async correlationId => {
        await registerForTournament(tournamentId, { correlationId });
        const [tournamentData, registrationsData] = await Promise.all([
          getTournament(tournamentId, { correlationId }),
          getRegistrations(tournamentId, { correlationId }),
        ]);
        setTournament(tournamentData);
        setRegistrations(registrationsData);
      });
    } catch {
      setRegisterError(t('mob.tournament.register_error'));
    } finally {
      setIsRegistering(false);
    }
  };

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
        const [tournamentData, registrationsData] = await Promise.all([
          getTournament(tournamentId, { correlationId }),
          getRegistrations(tournamentId, { correlationId }),
        ]);
        setTournament(tournamentData);
        setRegistrations(registrationsData);
      });
    } catch {
      setWithdrawError(t('mob.tournament.withdraw_error'));
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleCancel = async (): Promise<void> => {
    setCancelError(null);
    setIsCancelling(true);
    try {
      await cancelTournament(tournamentId);
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
    } catch {
      setCancelError(t('mob.tournament.cancel_error'));
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return <LoadingView />;
  }

  if (loadError || !tournament) {
    return <ErrorView message={loadError ?? t('mob.tournament.not_found')} onRetry={loadAll} />;
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

  const canRegister =
    tournament.registration_open && currentUserRegistrationStatus === 'none' && !isOrganiser;
  const canWithdraw = currentUserRegistrationStatus === 'registered';
  const showRegistrationClosedMessage =
    !tournament.registration_open && currentUserRegistrationStatus === 'none' && !isOrganiser;
  const canCancel = isOrganiser && tournament.status !== 'completed' && tournament.status !== 'cancelled';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.infoCard}>
        <Text style={styles.title}>{tournament.name}</Text>
        <Text style={styles.meta}>
          {sportLabel} · {tournament.format}
        </Text>
        <Text style={styles.meta}>
          {t('mob.tournament.status_line', { status: tournament.status })}
        </Text>
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
      </Card>

      {venueCatalogueEnabled ? (
        <VenueDetailCard
          snapshot={tournament.venue_snapshot}
          fallbackText={tournament.venue_label || tournament.name}
          tournamentId={tournament.id}
          isOrganiser={isOrganiser}
        />
      ) : null}

      {registerError ? <Text style={styles.errorText}>{registerError}</Text> : null}
      {withdrawError ? <Text style={styles.errorText}>{withdrawError}</Text> : null}

      {canRegister ? (
        <Button
          label={t('mob.tournament.register')}
          onPress={handleRegister}
          loading={isRegistering}
          style={styles.button}
        />
      ) : null}

      {canWithdraw ? (
        <Button
          label={t('mob.tournament.withdraw')}
          variant="secondary"
          onPress={handleWithdraw}
          loading={isWithdrawing}
          style={styles.button}
        />
      ) : null}

      {showRegistrationClosedMessage ? (
        <Text style={styles.closedNotice}>{t('mob.tournament.registration_closed')}</Text>
      ) : null}

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, activeTab === 'fixtures' && styles.tabButtonActive]}
          onPress={() => setActiveTab('fixtures')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'fixtures' }}
        >
          <Text
            style={[styles.tabButtonText, activeTab === 'fixtures' && styles.tabButtonTextActive]}
          >
            {t('mob.tournament.tab_matches')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'registrations' && styles.tabButtonActive]}
          onPress={() => setActiveTab('registrations')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'registrations' }}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'registrations' && styles.tabButtonTextActive,
            ]}
          >
            {t('mob.tournament.tab_registrations')}
          </Text>
        </Pressable>
      </View>

      <Card>
        {activeTab === 'fixtures' ? (
          fixtures.length === 0 ? (
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
          )
        ) : registrations.length === 0 ? (
          <Text style={styles.emptyText}>{t('mob.tournament.no_registrations')}</Text>
        ) : (
          registrations.map(registration => (
            <View key={registration.id} style={styles.listRow}>
              <Text style={styles.memberNickname}>{registration.nickname}</Text>
              <Text style={styles.fixtureMeta}>
                {t('mob.tournament.registered_at', {
                  when: formatDateTime(registration.registered_at),
                })}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  infoCard: { marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm },
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
  tabRow: { flexDirection: 'row', marginTop: spacing.sm, marginBottom: spacing.md },
  tabButton: {
    flex: 1,
    minHeight: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: borderWidth.thick,
    borderBottomColor: colors.border,
  },
  tabButtonActive: { borderBottomColor: colors.primary },
  tabButtonText: { ...typography.bodyBold, color: colors.textSecondary },
  tabButtonTextActive: { color: colors.primary },
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
});
