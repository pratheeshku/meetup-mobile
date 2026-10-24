/**
 * Overview tab of the tournament page for lifecycle version 2 (DES-MEETUP-ADDENDUM-tournament-experience AD-T5,
 * AD-T6; boards TV2MobOpen, TV2MobClosedOverview, TV2MobDoneOverview): the status card, the organizer tools, the
 * Format card, Key dates and, last, the Book-a-court block. Every fact shown comes from the server; the glyph state of
 * Key dates follows the server's registration phase and lifecycle status, never a date compared on the device.
 *
 * Not built, reported item by item in the te-a1 report: the Live Overview (no board), the hard-block row and the rules
 * rows of Format (no field on `GET /tournaments/{id}`), and the organizer tools "Edit details", "Add a player" and
 * "Close registration early" (no screen or route in scope).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import type { LabelKey } from '../../../labels/fallbackLabels';
import { dash, dashRadius } from '../../../theme/dashboardTheme';
import { borderWidth, colors, gradientTokens, radius, spacing, typography } from '../../../theme/tokens';
import type { CourtProvider, Tournament, TournamentClosureResponse } from '../../../types/tournament';
import type { TournamentTabKey, TournamentTabs } from '../../../types/tournamentScoring';
import {
  formatClock,
  formatDateRange,
  formatDayShort,
  keyDateStates,
  type OverviewKind,
} from '../../../utils/tournamentExperience';
import { formatRuleRows } from '../../../utils/tournamentTabs';
import type { StageState } from '../../../utils/tournamentExperience';
import Button from '../../Button';
import CourtBookingBlock from '../../court/CourtBookingBlock';
import { CameraIcon, CheckIcon, ChevronRightIcon, EditIcon } from '../../icons/ActionIcons';
import { PersonPlusIcon } from '../../icons/GroupViewIcons';
import { CalendarIcon, MapPinIcon, PeopleGreenIcon } from '../../icons/HomeV2Icons';
import { TrophyIcon } from '../../icons/SharedIcons';

const TILE = 40;
const GLYPH = 20;
const TOOL_CHEVRON = 20;

function Block({ children, testID, style }: { children: React.ReactNode; testID?: string; style?: object }): React.JSX.Element {
  return (
    <View style={[styles.block, style]} testID={testID}>
      {children}
    </View>
  );
}

function Progress({ count, max }: { count: number; max: number }): React.JSX.Element {
  const t = useT();
  const share = max > 0 ? Math.min(1, count / max) : 0;
  return (
    <View testID="overview-progress">
      <Text style={styles.progressText}>{t('mob.tournament.v2.ov_progress', { count, max })}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
      </View>
    </View>
  );
}

export interface OverviewProps {
  kind: OverviewKind;
  tournament: Tournament;
  /** Active registrations (server list). */
  registeredCount: number;
  closure: TournamentClosureResponse | null;
  tabs: TournamentTabs;
  /** The organizer or an active committee member (UX only; the server stays the authority). */
  isCommittee: boolean;
  isOrganiser: boolean;
  onSelectTab: (key: TournamentTabKey) => void;
  onOpenClosure: () => void;
  /** The invite panel, shown inline when the organizer opens "Invite groups or people". */
  invitePanel: React.ReactNode;
  /** Own registration: a secondary action inside the status card. */
  secondary: { label: string; loading: boolean; onPress: () => void } | null;
  notice: string | null;
  cancel: { visible: boolean; loading: boolean; error: string | null; onPress: () => void };
  courtProviders: CourtProvider[] | null;
  /** "Add banner" (AD-T1, te-a2): offered to the committee while the server says the tournament has no banner of its own. */
  banner: { visible: boolean; loading: boolean; error: string | null; onPress: () => void };
}

export default function TournamentOverview(props: OverviewProps): React.JSX.Element {
  const t = useT();
  const { tournament, kind } = props;
  const [inviteOpen, setInviteOpen] = useState(false);

  const range = formatDateRange(tournament.starts_at, tournament.ends_at);
  const venue = tournament.venue_name || tournament.venue_label || null;
  const max = tournament.max_participants;
  const states = keyDateStates(kind, Boolean(tournament.roster_frozen_at));
  const ruleRows = formatRuleRows(tournament.format_rules);
  const entrants = ruleRows.find(row => row.key === 'entrants');

  const status = (() => {
    switch (kind) {
      case 'open':
        return (
          <Block testID="overview-status-open">
            <Text style={styles.cardTitle}>{t('mob.tournament.v2.ov_open_title')}</Text>
            <Text style={styles.body}>
              {t('mob.tournament.v2.ov_open_body', {
                date: tournament.registration_closes_at ? formatDayShort(tournament.registration_closes_at) : '–',
              })}
            </Text>
            <Progress count={props.registeredCount} max={max} />
            <View style={styles.note}>
              <Text style={styles.noteText}>{t('mob.tournament.v2.ov_organizer_note')}</Text>
            </View>
          </Block>
        );
      case 'closed':
        return (
          <Block testID="overview-status-closed">
            <Text style={styles.cardTitle}>{t('mob.tournament.v2.ov_closed_title')}</Text>
            <Text style={styles.body}>{t('mob.tournament.v2.ov_closed_body', { count: props.registeredCount })}</Text>
            <Progress count={props.registeredCount} max={max} />
            {tournament.roster_frozen_at ? (
              <Text style={styles.frozen} testID="overview-roster-frozen">
                {t('mob.tournament.v2.ov_roster_frozen', { date: formatDayShort(tournament.roster_frozen_at) })}
              </Text>
            ) : null}
          </Block>
        );
      case 'done': {
        const closure = props.closure;
        const heldOnly = closure?.outcome !== 'not_held';
        return (
          <Block testID="overview-status-done">
            <Text style={styles.cardTitle}>{t('mob.tournament.v2.ov_done_title')}</Text>
            {heldOnly && closure?.winner ? (
              <View style={styles.champion} testID="overview-champion">
                <View style={styles.championGlyph}>
                  <TrophyIcon size={24} />
                </View>
                <View style={styles.championText}>
                  <Text style={styles.championLabel}>{t('mob.tournament.v2.ov_champion')}</Text>
                  <Text style={styles.championName}>{closure.winner.display_name}</Text>
                </View>
              </View>
            ) : null}
            {!heldOnly ? <Text style={styles.body}>{t('mob.tournament.v2.ov_not_held')}</Text> : null}
            {heldOnly && (closure?.runner_up || closure?.third_place) ? (
              <Text style={styles.body}>
                {[
                  closure?.runner_up ? t('mob.tournament.v2.ov_runner_up', { name: closure.runner_up.display_name }) : null,
                  closure?.third_place ? t('mob.tournament.v2.ov_third', { name: closure.third_place.display_name }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
            {heldOnly ? (
              <View style={styles.chipRow}>
                <View style={styles.chipGreen}>
                  <Text style={styles.chipGreenText}>{t('mob.tournament.v2.ov_standings_final')}</Text>
                </View>
                <View style={styles.chipPurple}>
                  <Text style={styles.chipPurpleText}>{t('mob.tournament.v2.ov_report_submitted')}</Text>
                </View>
              </View>
            ) : null}
          </Block>
        );
      }
      case 'cancelled':
        return (
          <Block testID="overview-status-cancelled">
            <Text style={styles.cardTitle}>{t('mob.tournament.v2.ov_cancelled_title')}</Text>
          </Block>
        );
      default:
        // `live` has no board (te-a1 report, blocked item); `unknown` means the server did not say.
        return <View />;
    }
  })();

  // Organizer tools: only the rows that have a working target in this build.
  type Tool = { key: string; titleKey: LabelKey; subKey?: LabelKey; tone: keyof typeof gradientTokens; icon: React.ReactNode; onPress: () => void };
  const tools: Tool[] = [];
  if (props.isCommittee) {
    if (kind === 'open' || kind === 'closed' || kind === 'live') {
      tools.push({
        key: 'invite',
        titleKey: 'mob.tournament.v2.tool_invite',
        subKey: 'mob.tournament.v2.tool_invite_sub',
        tone: 'teal',
        icon: <PersonPlusIcon size={20} color={colors.white} />,
        onPress: () => setInviteOpen(open => !open),
      });
    }
    if (kind === 'closed' && props.tabs.fixtures) {
      tools.push({
        key: 'prepare',
        titleKey: 'mob.tournament.v2.tool_prepare',
        subKey: 'mob.tournament.v2.tool_prepare_sub',
        tone: 'orange',
        icon: <CalendarIcon size={20} />,
        onPress: () => props.onSelectTab('fixtures'),
      });
    }
    if (props.tabs.approvals) {
      tools.push({
        key: 'review',
        titleKey: 'mob.tournament.v2.tool_review',
        subKey: 'mob.tournament.v2.tool_review_sub',
        tone: 'blue',
        icon: <CheckIcon size={20} color={colors.white} />,
        onPress: () => props.onSelectTab('approvals'),
      });
    }
    if (props.banner.visible) {
      tools.push({
        key: 'banner',
        titleKey: 'mob.tournament.v2.add_banner',
        tone: 'purple',
        icon: <CameraIcon size={20} color={colors.white} />,
        onPress: props.banner.onPress,
      });
    }
    if (props.isOrganiser && (kind === 'done' || tournament.lifecycle_status === 'past')) {
      tools.push({
        key: 'closure',
        titleKey: 'mob.tournament.v2.tool_closure',
        subKey: kind === 'done' ? 'mob.tournament.v2.tool_closure_sub_done' : 'mob.tournament.v2.tool_closure_sub_open',
        tone: 'amber',
        icon: <EditIcon size={20} color={colors.white} />,
        onPress: props.onOpenClosure,
      });
    }
  }

  const keyRows: { key: string; title: string; sub: string; state: StageState }[] = [];
  if (tournament.registration_opened_at) {
    keyRows.push({
      key: 'opened',
      title: t('mob.tournament.v2.kd_opened'),
      sub: formatDayShort(tournament.registration_opened_at),
      state: states.opened,
    });
  }
  keyRows.push({
    key: 'soft',
    title: t('mob.tournament.v2.kd_soft'),
    sub: tournament.registration_closes_at
      ? t('mob.tournament.v2.kd_soft_sub', { date: formatDayShort(tournament.registration_closes_at) })
      : '–',
    state: states.soft,
  });
  if (tournament.registration_hard_block_at) {
    keyRows.push({
      key: 'hard',
      title: t('mob.tournament.v2.kd_hard'),
      sub: t('mob.tournament.v2.kd_hard_sub', { date: formatDayShort(tournament.registration_hard_block_at) }),
      state: states.hard,
    });
  }
  keyRows.push(
    {
      key: 'fixtures',
      title: t('mob.tournament.v2.kd_fixtures'),
      sub: tournament.schedule_published_at
        ? formatDayShort(tournament.schedule_published_at)
        : t('mob.tournament.v2.kd_fixtures_pending'),
      state: states.fixtures,
    },
    { key: 'days', title: t('mob.tournament.v2.kd_days'), sub: range, state: states.days },
  );

  return (
    <View testID="tournament-overview">
      {props.notice ? <Text style={styles.error}>{props.notice}</Text> : null}
      {status}
      {props.secondary ? (
        <Button
          label={props.secondary.label}
          variant="secondary"
          onPress={props.secondary.onPress}
          loading={props.secondary.loading}
          style={styles.secondary}
          testID="tournament-decline-button"
        />
      ) : null}

      {tools.length > 0 ? (
        <Block testID="overview-tools">
          <View style={styles.toolsHead}>
            <Text style={[styles.cardTitle, styles.toolsTitle]}>{t('mob.tournament.v2.tools_title')}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('mob.tournament.v2.tools_badge')}</Text>
            </View>
          </View>
          {tools.map((tool, index) => (
            <View key={tool.key}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tool.subKey ? `${t(tool.titleKey)}. ${t(tool.subKey)}` : t(tool.titleKey)}
                onPress={tool.onPress}
                style={[styles.toolRow, index > 0 ? styles.toolDivider : null]}
                testID={`overview-tool-${tool.key}`}
              >
                <View style={[styles.tile, { backgroundColor: gradientTokens[tool.tone].start }]}>{tool.icon}</View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{t(tool.titleKey)}</Text>
                  {tool.subKey ? <Text style={styles.rowSub}>{t(tool.subKey)}</Text> : null}
                </View>
                <View style={styles.chevronBox}>
                  <ChevronRightIcon size={16} color={colors.textMuted} />
                </View>
              </Pressable>
              {tool.key === 'invite' && inviteOpen ? <View style={styles.invite}>{props.invitePanel}</View> : null}
            </View>
          ))}
        </Block>
      ) : null}

      <Block testID="overview-format">
        <Text style={styles.cardTitle}>{t('mob.tournament.v2.format_title')}</Text>
        <View style={styles.formatRow}>
          <View style={[styles.tile, styles.tileLight]}>
            <CalendarIcon size={22} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{range}</Text>
            {tournament.ends_at ? (
              <Text style={styles.rowSub}>
                {t('mob.tournament.v2.format_daily', {
                  start: formatClock(tournament.starts_at),
                  end: formatClock(tournament.ends_at),
                })}
              </Text>
            ) : null}
          </View>
        </View>
        {venue ? (
          <View style={styles.formatRow}>
            <View style={[styles.tile, styles.tileLight]}>
              <MapPinIcon size={22} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{venue}</Text>
              {tournament.venue_detail ? (
                <Text style={styles.rowSub} testID="overview-venue-detail">
                  {tournament.venue_detail}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
        {tournament.participation_mode ? (
          <View style={styles.formatRow}>
            <View style={[styles.tile, styles.tileLight]}>
              <PeopleGreenIcon size={22} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                {tournament.participation_mode === 'team'
                  ? t('mob.tournament.v2.format_teams')
                  : t('mob.tournament.v2.format_individuals')}
              </Text>
              <Text style={styles.rowSub}>
                {entrants ? t(entrants.labelKey, entrants.params) : t('mob.tournament.v2.format_max', { max })}
              </Text>
            </View>
          </View>
        ) : null}
        {ruleRows
          .filter(row => row.key !== 'entrants')
          .map(row => (
            <View key={row.key} style={styles.formatRow} testID={`format-rule-${row.key}`}>
              <View style={[styles.tile, styles.tileLight]}>
                <TrophyIcon size={22} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t(row.labelKey, row.params)}</Text>
              </View>
            </View>
          ))}
      </Block>

      <Block testID="overview-key-dates">
        <Text style={styles.cardTitle}>{t('mob.tournament.v2.kd_title')}</Text>
        {keyRows.map((row, index) => (
          <View
            key={row.key}
            style={styles.dateRow}
            accessible
            accessibilityLabel={`${row.title}. ${row.sub}. ${t(
              row.state === 'done'
                ? 'mob.tournament.v2.kd_done'
                : row.state === 'current'
                ? 'mob.tournament.v2.kd_current'
                : 'mob.tournament.v2.kd_upcoming',
            )}`}
            testID={`key-date-${row.key}-${row.state}`}
          >
            <View style={styles.dateRail}>
              <View
                style={[
                  styles.dot,
                  row.state === 'done' ? styles.dotDone : row.state === 'current' ? styles.dotCurrent : styles.dotUpcoming,
                ]}
              >
                {row.state === 'done' ? <CheckIcon size={12} color={colors.white} /> : null}
              </View>
              {index < keyRows.length - 1 ? <View style={styles.rail} /> : null}
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowSub}>{row.sub}</Text>
            </View>
          </View>
        ))}
      </Block>

      <CourtBookingBlock providers={props.courtProviders} testID="overview-court-booking" />

      {props.banner.error ? <Text style={styles.error}>{props.banner.error}</Text> : null}
      {props.cancel.visible ? (
        <View style={styles.cancel}>
          {props.cancel.error ? <Text style={styles.error}>{props.cancel.error}</Text> : null}
          <Button
            label={t('mob.tournament.cancel')}
            variant="destructive"
            onPress={props.cancel.onPress}
            loading={props.cancel.loading}
            testID="tournament-cancel-button"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: dash.card,
    borderRadius: dashRadius.card,
    borderWidth: borderWidth.thin,
    borderColor: dash.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: { ...typography.h3, color: dash.text, marginBottom: spacing.xs },
  body: { ...typography.body, color: dash.textMuted, marginBottom: spacing.sm },
  progressText: { ...typography.bodyBold, color: dash.text, marginBottom: spacing.xs },
  track: { height: 8, borderRadius: 4, backgroundColor: dash.skeleton, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: dash.brand },
  note: { marginTop: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.sm },
  noteText: { ...typography.caption, color: colors.primaryDark },
  champion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  championGlyph: { width: TILE, height: TILE, alignItems: 'center', justifyContent: 'center' },
  championText: { flex: 1, marginLeft: spacing.sm },
  championLabel: { ...typography.label, color: colors.warningDark },
  championName: { ...typography.h3, color: colors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  chipGreen: { backgroundColor: colors.successLight, borderRadius: radius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: 4, marginRight: spacing.sm, marginBottom: spacing.xs },
  chipGreenText: { ...typography.label, color: colors.successDark },
  chipPurple: { backgroundColor: colors.avatarTint5, borderRadius: radius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: 4, marginBottom: spacing.xs },
  chipPurpleText: { ...typography.label, color: colors.avatarTintText5 },
  secondary: { marginBottom: spacing.md },
  frozen: { ...typography.caption, color: dash.textMuted, marginTop: spacing.xs },
  toolsHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  toolsTitle: { flex: 1, marginBottom: 0 },
  badge: { backgroundColor: colors.avatarTint5, borderRadius: radius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: 3 },
  badgeText: { ...typography.label, color: colors.avatarTintText5 },
  toolRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: spacing.sm },
  toolDivider: { borderTopWidth: borderWidth.thin, borderTopColor: dash.cardBorder },
  invite: { paddingBottom: spacing.sm },
  tile: { width: TILE, height: TILE, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  tileLight: { backgroundColor: dash.page },
  rowText: { flex: 1, minWidth: 0, marginLeft: spacing.sm + 2 },
  rowTitle: { ...typography.bodyBold, color: dash.text },
  rowSub: { ...typography.caption, color: dash.textMuted },
  chevronBox: { width: TOOL_CHEVRON, height: TOOL_CHEVRON, alignItems: 'center', justifyContent: 'center' },
  formatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs + 2 },
  dateRow: { flexDirection: 'row', minHeight: 52 },
  dateRail: { width: GLYPH, alignItems: 'center' },
  dot: { width: GLYPH, height: GLYPH, borderRadius: GLYPH / 2, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.successDark },
  dotCurrent: { borderWidth: 5, borderColor: dash.brand, backgroundColor: colors.white },
  dotUpcoming: { borderWidth: borderWidth.medium, borderColor: dash.panelBorder },
  rail: { width: 2, flex: 1, backgroundColor: dash.cardBorder, marginVertical: 2 },
  cancel: { marginTop: spacing.sm, paddingTop: spacing.md, borderTopWidth: borderWidth.thin, borderTopColor: dash.cardBorder },
  error: { ...typography.body, color: colors.error, marginBottom: spacing.sm, textAlign: 'center' },
});
