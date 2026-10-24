/**
 * Tournament page for lifecycle version 2 (DES-MEETUP-ADDENDUM-tournament-experience AD-T5, AD-T6): header, tabs and
 * the Overview. The legacy screen decides which page to show (the server `tabs` object is present only for version 2)
 * and hands over the data and the handlers it already owns, so every action keeps its single correlation id per user
 * action there. The tab bodies other than Overview are te-a2: a neutral placeholder from a label key (the existing
 * scoring entry row stays on Fixtures and Standings so the committee keeps its way to enter scores until te-a2).
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { dash } from '../../../theme/dashboardTheme';
import { borderWidth, colors, radius, spacing, typography } from '../../../theme/tokens';
import type { Tournament, TournamentClosureResponse } from '../../../types/tournament';
import type { TournamentScoringState, TournamentTabKey } from '../../../types/tournamentScoring';
import {
  formatDateRange,
  overviewKind,
  stripModel,
  stripTone,
  tabEntries,
} from '../../../utils/tournamentExperience';
import { useCourtProviders } from '../../court/CourtBookingBlock';
import TournamentScoringEntry from '../../scoring/TournamentScoringEntry';
import LockedPreview from './LockedPreview';
import PeopleSheet from './PeopleSheet';
import TournamentHeader, { type RegisterAction } from './TournamentHeader';
import TournamentOverview from './TournamentOverview';
import TournamentTabs from './TournamentTabs';

export interface TournamentDetailV2Props {
  tournament: Tournament;
  scoring: TournamentScoringState;
  registeredCount: number;
  closure: TournamentClosureResponse | null;
  sportLabel: string;
  isOrganiser: boolean;
  isCommittee: boolean;
  register: RegisterAction;
  secondary: { label: string; loading: boolean; onPress: () => void } | null;
  notice: string | null;
  cancel: { visible: boolean; loading: boolean; error: string | null; onPress: () => void };
  onOpenClosure: () => void;
  /** Cards that sit between the header and the tabs: committee invitation, tournament invitation. */
  banners: React.ReactNode;
  invitePanel: React.ReactNode;
  onOpenScoring: () => void;
  /** Sheets and modals owned by the host screen (closure modal). */
  children?: React.ReactNode;
}

export default function TournamentDetailV2(props: TournamentDetailV2Props): React.JSX.Element | null {
  const t = useT();
  const { tournament, scoring } = props;
  const [selected, setSelected] = useState<TournamentTabKey>('overview');
  const [sheet, setSheet] = useState<'organizer' | 'committee' | null>(null);
  const courtProviders = useCourtProviders();

  const tabs = scoring.tabs;
  if (!tabs) {
    return null;
  }
  const entries = tabEntries(tabs);
  const current = entries.find(entry => entry.key === selected) ?? entries[0];

  const facts = {
    lifecycle: tournament.lifecycle_status,
    closureOutcome: tournament.closure_outcome,
    phase: scoring.registration_phase ?? null,
    fixturesPublished: scoring.fixtures_published === true,
  };
  const strip = stripModel(facts);
  const kind = overviewKind(facts);
  const { tone, scrim } = stripTone(tournament.banner_tone, tournament.banner_scrim);

  const visibilityKey = tournament.visibility ? (`tournament_visibility.${tournament.visibility}` as const) : null;
  const venue = tournament.venue_name || tournament.venue_label || null;
  const metaLine = [
    props.sportLabel,
    formatDateRange(tournament.starts_at, tournament.ends_at),
    venue,
    visibilityKey ? t(visibilityKey) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const committee = tournament.committee ?? [];

  const body = (): React.JSX.Element => {
    if (!current || current.key === 'overview') {
      return (
        <TournamentOverview
          kind={kind}
          tournament={tournament}
          registeredCount={props.registeredCount}
          closure={props.closure}
          tabs={tabs}
          isCommittee={props.isCommittee}
          isOrganiser={props.isOrganiser}
          onSelectTab={setSelected}
          onOpenClosure={props.onOpenClosure}
          invitePanel={props.invitePanel}
          secondary={props.secondary}
          notice={props.notice}
          cancel={props.cancel}
          courtProviders={courtProviders}
        />
      );
    }
    if (current.locked) {
      return <LockedPreview unlocks={current.unlocks} />;
    }
    return (
      <View testID={`tournament-tab-body-${current.key}`}>
        {current.key === 'fixtures' || current.key === 'standings' ? (
          <TournamentScoringEntry tournamentId={tournament.id} onOpen={props.onOpenScoring} />
        ) : null}
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>{t('mob.tournament.v2.tab_placeholder_title')}</Text>
          <Text style={styles.placeholderBody}>{t('mob.tournament.v2.tab_placeholder_body')}</Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} testID="tournament-detail-v2">
      <TournamentHeader
        title={tournament.name}
        metaLine={metaLine}
        bannerUrl={tournament.banner_url}
        logoUrl={tournament.logo_url}
        tone={tone}
        scrim={scrim}
        strip={strip}
        register={props.register}
        organizer={tournament.organizer}
        committee={committee}
        onOpenOrganizer={() => setSheet('organizer')}
        onOpenCommittee={() => setSheet('committee')}
      />
      {props.banners ? <View style={styles.banners}>{props.banners}</View> : null}
      <TournamentTabs entries={entries} selected={current?.key ?? 'overview'} onSelect={setSelected} />
      <View style={styles.panel} testID="tournament-tab-panel">
        {body()}
      </View>
      {sheet === 'organizer' && tournament.organizer ? (
        <PeopleSheet
          title={t('mob.tournament.v2.sheet_organizer')}
          people={[tournament.organizer]}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'committee' ? (
        <PeopleSheet
          title={t('mob.tournament.v2.sheet_committee', { count: committee.length })}
          people={committee}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {props.children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xl, backgroundColor: dash.page },
  banners: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  panel: {
    marginHorizontal: spacing.md,
    padding: spacing.sm + 4,
    backgroundColor: dash.page,
    borderWidth: borderWidth.medium,
    borderColor: dash.panelBorder,
    borderRadius: radius.lg,
    borderTopLeftRadius: 0,
  },
  placeholder: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: dash.cardBorder,
    padding: spacing.lg,
    alignItems: 'center',
  },
  placeholderTitle: { ...typography.h3, color: dash.text, textAlign: 'center' },
  placeholderBody: { ...typography.body, color: dash.textMuted, textAlign: 'center', marginTop: spacing.xs },
});
