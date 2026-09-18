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
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import type { Tournament, TournamentFixture, TournamentRegistration } from '../types/tournament';
import type { TournamentsStackParamList } from '../navigation/types';

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
  const { tournamentId } = route.params;
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [fixtures, setFixtures] = useState<TournamentFixture[]>([]);
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fixtures' | 'registrations'>('fixtures');

  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

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
      setLoadError('Could not load this tournament. Please try again.');
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
      setRegisterError('Could not register for this tournament. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleWithdraw = async (): Promise<void> => {
    setWithdrawError(null);
    const myRegistration = registrations.find(r => r.user_id === currentUserId);
    if (!myRegistration) {
      setWithdrawError('Could not find your registration. Please try again.');
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
      setWithdrawError('Could not withdraw from this tournament. Please try again.');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleCancel = async (): Promise<void> => {
    setCancelError(null);
    setIsCancelling(true);
    try {
      const tournamentData = await cancelTournament(tournamentId).then(() =>
        getTournament(tournamentId),
      );
      setTournament(tournamentData);
    } catch {
      setCancelError('Could not cancel this tournament. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (loadError || !tournament) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError ?? 'Tournament not found.'}</Text>
        <Pressable style={styles.retryButton} onPress={loadAll}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
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
      <Text style={styles.title}>{tournament.name}</Text>
      <Text style={styles.meta}>
        {tournament.sport} · {tournament.format}
      </Text>
      <Text style={styles.meta}>Status: {tournament.status}</Text>
      <Text style={styles.meta}>Organised by {tournament.organiser_nickname}</Text>
      <Text style={styles.meta}>Starts {formatDateTime(tournament.starts_at)}</Text>
      {/* `registrations.length` used instead of `tournament.participant_count` —
          the real backend has no such field; this screen already fetches
          the registrations list, so this is exact rather than a
          placeholder (see the audit report / mapTournamentApiItem). */}
      <Text style={styles.meta}>
        {registrations.length}/{tournament.max_participants} registered
      </Text>
      <Text style={styles.description}>{tournament.description}</Text>

      {registerError ? <Text style={styles.errorText}>{registerError}</Text> : null}
      {withdrawError ? <Text style={styles.errorText}>{withdrawError}</Text> : null}

      {canRegister ? (
        <Pressable
          style={[styles.button, isRegistering && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isRegistering}
        >
          {isRegistering ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Register</Text>
          )}
        </Pressable>
      ) : null}

      {canWithdraw ? (
        <Pressable
          style={[styles.button, isWithdrawing && styles.buttonDisabled]}
          onPress={handleWithdraw}
          disabled={isWithdrawing}
        >
          {isWithdrawing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Withdraw</Text>
          )}
        </Pressable>
      ) : null}

      {showRegistrationClosedMessage ? (
        <Text style={styles.closedNotice}>Registration is closed for this tournament.</Text>
      ) : null}

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, activeTab === 'fixtures' && styles.tabButtonActive]}
          onPress={() => setActiveTab('fixtures')}
        >
          <Text
            style={[styles.tabButtonText, activeTab === 'fixtures' && styles.tabButtonTextActive]}
          >
            Fixtures
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'registrations' && styles.tabButtonActive]}
          onPress={() => setActiveTab('registrations')}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === 'registrations' && styles.tabButtonTextActive,
            ]}
          >
            Registrations
          </Text>
        </Pressable>
      </View>

      {activeTab === 'fixtures' ? (
        fixtures.length === 0 ? (
          <Text style={styles.emptyText}>No fixtures yet.</Text>
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
        <Text style={styles.emptyText}>No one has registered yet.</Text>
      ) : (
        registrations.map(registration => (
          <View key={registration.id} style={styles.listRow}>
            <Text style={styles.memberNickname}>{registration.nickname}</Text>
            <Text style={styles.fixtureMeta}>
              Registered {formatDateTime(registration.registered_at)}
            </Text>
          </View>
        ))
      )}

      {canCancel ? (
        <View style={styles.cancelSection}>
          {cancelError ? <Text style={styles.errorText}>{cancelError}</Text> : null}
          <Pressable
            style={[styles.cancelButton, isCancelling && styles.buttonDisabled]}
            onPress={handleCancel}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Cancel Tournament</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  meta: { fontSize: 15, color: '#444', marginBottom: 4 },
  description: { fontSize: 15, color: '#222', marginTop: 8, marginBottom: 16 },
  closedNotice: { fontSize: 14, color: '#b8860b', marginBottom: 16 },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  tabRow: { flexDirection: 'row', marginTop: 12, marginBottom: 12 },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#eee',
  },
  tabButtonActive: { borderBottomColor: '#2563eb' },
  tabButtonText: { fontSize: 14, fontWeight: '600', color: '#666' },
  tabButtonTextActive: { color: '#2563eb' },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 12 },
  listRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  fixtureRound: { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 2 },
  fixtureTeams: { fontSize: 15, color: '#222', marginBottom: 2 },
  fixtureMeta: { fontSize: 13, color: '#666' },
  memberNickname: { fontSize: 15, color: '#222', marginBottom: 2 },
  cancelSection: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 16 },
  cancelButton: {
    backgroundColor: '#c0392b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  errorText: { fontSize: 14, color: '#c0392b', marginBottom: 8, textAlign: 'center' },
  retryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
});
