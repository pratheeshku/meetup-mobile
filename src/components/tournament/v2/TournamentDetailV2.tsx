/**
 * Tournament page for lifecycle version 2 (DES-MEETUP-ADDENDUM-tournament-experience AD-T5 to AD-T10): header, tabs and
 * the tab bodies. The legacy screen decides which page to show (`lifecycle_version`, with the presence of the server
 * `tabs` object as the fallback of an older server) and hands over the data and the handlers it owns, so every action
 * keeps its single correlation id per user action there. Tab state is the server's `tabs` object only; when the scoring
 * state could not be read, only Overview is drawn (it is always open). Every tab body fetches what it shows from the
 * server and computes nothing (winners, standings, advancement and tab state are never worked out on the device).
 */
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { withCorrelationId } from '../../../api/correlationId';
import { uploadTournamentImage } from '../../../api/tournaments';
import { useT } from '../../../labels/LabelsContext';
import { dash } from '../../../theme/dashboardTheme';
import { borderWidth, radius, spacing } from '../../../theme/tokens';
import type { Tournament, TournamentClosureResponse, TournamentRegistration } from '../../../types/tournament';
import type { TournamentScoringState, TournamentTabKey, TournamentTabs as ServerTabs } from '../../../types/tournamentScoring';
import { getApiErrorMessage } from '../../../utils/apiError';
import { isPickerCancelled, pickImage } from '../../../utils/imagePicker';
import {
  formatDateRange,
  overviewKind,
  stripModel,
  stripTone,
  tabEntries,
} from '../../../utils/tournamentExperience';
import { pollMs } from '../../../utils/tournamentTabs';
import { useCourtProviders } from '../../court/CourtBookingBlock';
import KeyboardAwareScreen from '../../KeyboardAwareScreen';
import ApprovalsTab from './tabs/ApprovalsTab';
import FixturesTab from './tabs/FixturesTab';
import MediaTab from './tabs/MediaTab';
import ParticipantsTab from './tabs/ParticipantsTab';
import ResultsTab from './tabs/ResultsTab';
import StandingsTab from './tabs/StandingsTab';
import { useStandingsBoard } from './tabs/useStandingsBoard';
import LockedPreview from './LockedPreview';
import PeopleSheet from './PeopleSheet';
import TournamentHeader, { type RegisterAction } from './TournamentHeader';
import TournamentOverview from './TournamentOverview';
import TournamentTabs from './TournamentTabs';

const BANNER_CROP = { width: 1600, height: 400 };
/** Overview is always open (AD-T5); used only when the scoring state could not be read. */
const OVERVIEW_ONLY: ServerTabs = { overview: { state: 'open' } };

export interface TournamentDetailV2Props {
  tournament: Tournament;
  /** `GET .../scoring/state`; null when it could not be read (Overview only). */
  scoring: TournamentScoringState | null;
  registeredCount: number;
  registrations: TournamentRegistration[];
  closure: TournamentClosureResponse | null;
  sportLabel: string;
  viewerId: string | undefined;
  isOrganiser: boolean;
  isCommittee: boolean;
  /** False while the screen is not the focused one: the live refresh stops. */
  focused: boolean;
  register: RegisterAction;
  secondary: { label: string; loading: boolean; onPress: () => void } | null;
  notice: string | null;
  cancel: { visible: boolean; loading: boolean; error: string | null; onPress: () => void };
  /** Cards that sit between the header and the tabs: committee invitation, tournament invitation. */
  banners: React.ReactNode;
  invitePanel: React.ReactNode;
  /** The Responses block kept inside Participants (addendum section 2). */
  responses: React.ReactNode;
  /** A change was made (a player added or removed, a decision, a saved report, a setup step): the host re-reads the page. */
  onChanged: () => void;
}

export default function TournamentDetailV2(props: TournamentDetailV2Props): React.JSX.Element {
  const t = useT();
  const { tournament, scoring } = props;
  const [selected, setSelected] = useState<TournamentTabKey>('overview');
  const [sheet, setSheet] = useState<'organizer' | 'committee' | null>(null);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const courtProviders = useCourtProviders();

  const tabs = scoring?.tabs ?? OVERVIEW_ONLY;
  const entries = tabEntries(tabs);
  const current = entries.find(entry => entry.key === selected) ?? entries[0];
  const currentKey = current?.key ?? 'overview';
  // The server sends `tabs.approvals` to the organizer and active committee members only: the same signal shows the
  // committee actions (UX only; every write is checked by the server again).
  const isCommittee = Boolean(tabs.approvals) || props.isCommittee;
  const published = scoring?.fixtures_published === true;
  const resultsLocked = tournament.lifecycle_status === 'closed';

  const boardTab = currentKey === 'fixtures' || currentKey === 'standings' || currentKey === 'approvals' || currentKey === 'results';
  const board = useStandingsBoard({
    tournamentId: tournament.id,
    enabled: boardTab && !current?.locked,
    poll: currentKey === 'fixtures' || currentKey === 'standings',
    pollMs: published ? pollMs(scoring) : 0,
    focused: props.focused,
  });

  const facts = {
    lifecycle: tournament.lifecycle_status,
    closureOutcome: tournament.closure_outcome,
    phase: scoring?.registration_phase ?? null,
    fixturesPublished: published,
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

  const addBanner = (): void => {
    if (bannerBusy) {
      return;
    }
    const pick = async (source: 'camera' | 'library'): Promise<void> => {
      try {
        const image = await pickImage(source, t('mob.tw.crop_banner'), BANNER_CROP);
        if (!image) {
          return;
        }
        setBannerBusy(true);
        setBannerError(null);
        await withCorrelationId(correlationId =>
          uploadTournamentImage(tournament.id, 'banner', { uri: image.path, name: image.filename, type: image.mime }, { correlationId }),
        );
        props.onChanged();
      } catch (e) {
        if (!isPickerCancelled(e)) {
          setBannerError(getApiErrorMessage(e, t('mob.tw.images_upload_failed')));
        }
      } finally {
        setBannerBusy(false);
      }
    };
    Alert.alert(t('mob.tw.banner_label'), undefined, [
      { text: t('mob.common.cancel'), style: 'cancel' },
      { text: t('mob.create_group.take_photo'), onPress: () => pick('camera') },
      { text: t('mob.create_group.choose_photo'), onPress: () => pick('library') },
    ]);
  };

  // Registration id (lower case) to display name: the draft and the review sheet carry ids, the screen shows names.
  const names = new Map(props.registrations.map(r => [r.id.toLowerCase(), r.nickname] as const));
  const fileStem =
    tournament.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tournament';
  const hasRegistration = props.registrations.some(r => r.user_id === props.viewerId && r.status === 'registered');

  const body = (): React.JSX.Element => {
    if (!current || currentKey === 'overview') {
      return (
        <TournamentOverview
          kind={kind}
          tournament={tournament}
          registeredCount={props.registeredCount}
          closure={props.closure}
          tabs={tabs}
          isCommittee={isCommittee}
          isOrganiser={props.isOrganiser}
          onSelectTab={setSelected}
          onOpenClosure={() => setSelected('results')}
          invitePanel={props.invitePanel}
          secondary={props.secondary}
          notice={props.notice}
          cancel={props.cancel}
          courtProviders={courtProviders}
          banner={{
            visible:
              isCommittee &&
              tournament.has_custom_banner === false &&
              tournament.lifecycle_status !== 'closed' &&
              tournament.lifecycle_status !== 'cancelled' &&
              tournament.lifecycle_status !== 'past',
            loading: bannerBusy,
            error: bannerError,
            onPress: addBanner,
          }}
        />
      );
    }
    if (current.locked) {
      return <LockedPreview unlocks={current.unlocks} />;
    }
    switch (currentKey) {
      case 'participants':
        return (
          <ParticipantsTab
            tournament={tournament}
            registrations={props.registrations}
            isCommittee={isCommittee}
            phase={scoring?.registration_phase ?? null}
            responses={props.responses}
            onChanged={props.onChanged}
          />
        );
      case 'fixtures':
        return (
          <FixturesTab
            tournamentId={tournament.id}
            board={board}
            fixturesPublished={published}
            isCommittee={isCommittee}
            resultsLocked={resultsLocked}
            onSentForApproval={props.onChanged}
            setup={scoring?.committee ?? null}
            phase={scoring?.registration_phase ?? null}
            names={names}
            fileStem={fileStem}
            onChanged={props.onChanged}
          />
        );
      case 'standings':
        return <StandingsTab board={board} isCommittee={isCommittee} />;
      case 'approvals':
        return <ApprovalsTab tournament={tournament} board={board} viewerId={props.viewerId} names={names} onDecided={props.onChanged} />;
      case 'results':
        return (
          <ResultsTab
            tournament={tournament}
            closure={props.closure}
            registeredCount={props.registeredCount}
            board={board}
            isCommittee={isCommittee}
            onOpenMedia={() => setSelected('media')}
            onSaved={props.onChanged}
          />
        );
      case 'media':
        return <MediaTab tournamentId={tournament.id} canAdd={isCommittee || hasRegistration} />;
      default:
        return <View />;
    }
  };

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container} testID="tournament-detail-v2">
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
      <TournamentTabs entries={entries} selected={currentKey} onSelect={setSelected} />
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
    </KeyboardAwareScreen>
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
});
