/**
 * Committee invitation card (tl-c-mobile-3): the web card `WebCommitteeAccept` re-flowed to one 390-wide column, as the
 * owner approved (there is no mobile board). Same content, same order: shield tile, "{organizer} invited you to the
 * committee", what the role means, a summary box (tournament, Sport, Dates, Organizer), then Accept and Decline.
 * The web crumb and page title belong to the web page chrome and are not repeated inside a tournament screen.
 *
 * Presentational only: the screen owns the data and the answer (`useCommitteeInvitationResponse`). People are shown by
 * name; no id reaches this component. A refusal state shows its label inline; Retry appears for `failed` only.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { useT } from '../../labels/LabelsContext';
import type { LabelKey } from '../../labels/fallbackLabels';
import { borderWidth, colors, radius, shadows, sizes, spacing, typography } from '../../theme/tokens';
import type { CommitteeInvitationSummary } from '../../types/tournament';
import { useSportDisplayName } from '../../utils/labels';
import { committeeDateRange, type CommitteeAnswerState } from '../../utils/committeeInvitation';
import Button from '../Button';

const ICON_TILE = 56;
const ICON_GLYPH = 28;

interface Props {
  /** `GET /tournaments/{id}/committee/invitation`; null when it could not be read (a state label then shows alone). */
  summary: CommitteeInvitationSummary | null;
  /** null while the invitation is open; otherwise the state whose label is shown inline. */
  state: CommitteeAnswerState | null;
  messageKey: LabelKey | null;
  busy: 'accept' | 'decline' | null;
  onAccept: () => void;
  onDecline: () => void;
  onRetry: () => void;
}

export default function CommitteeInvitationCard({
  summary,
  state,
  messageKey,
  busy,
  onAccept,
  onDecline,
  onRetry,
}: Props): React.JSX.Element {
  const t = useT();
  const sportName = useSportDisplayName(summary?.sport ?? '');
  const organizer = summary?.organizer_name?.trim() ?? '';
  const open = state === null || state === 'failed';
  const rows = summary
    ? [
        { key: 'sport', label: t('mob.committee_invite.row_sport'), value: sportName },
        {
          key: 'dates',
          label: t('mob.committee_invite.row_dates'),
          value: committeeDateRange(summary.starts_at, summary.ends_at),
        },
        { key: 'organizer', label: t('mob.committee_invite.row_organizer'), value: organizer },
      ].filter(row => row.value)
    : [];

  return (
    <View style={styles.card} testID="committee-invitation-card">
      {summary ? (
        <>
          <View style={styles.iconTile} accessible={false} importantForAccessibility="no-hide-descendants">
            <Svg width={ICON_GLYPH} height={ICON_GLYPH} viewBox="0 0 48 48" fill="none">
              <Path
                d="M24 6l16 6v12c0 9-6.4 15.4-16 18-9.6-2.6-16-9-16-18V12z"
                stroke={colors.white}
                strokeWidth={3.5}
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={styles.heading} accessibilityRole="header" testID="committee-invitation-heading">
            {organizer
              ? t('mob.committee_invite.heading', { organizer })
              : t('mob.committee_invite.heading_anonymous')}
          </Text>
          <Text style={styles.body}>{t('mob.committee_invite.body', { title: summary.title })}</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>{summary.title}</Text>
            {rows.map(row => (
              <View key={row.key} style={styles.row} testID={`committee-invitation-row-${row.key}`}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {messageKey ? (
        <Text style={styles.message} accessibilityRole="alert" testID="committee-invitation-message">
          {t(messageKey)}
        </Text>
      ) : null}

      {summary && open ? (
        <View style={styles.actions}>
          <Button
            label={t('mob.committee_invite.accept')}
            variant="cta"
            onPress={onAccept}
            loading={busy === 'accept'}
            disabled={busy !== null}
            testID="committee-invitation-accept"
          />
          <Button
            label={t('mob.committee_invite.decline')}
            variant="secondary"
            onPress={onDecline}
            loading={busy === 'decline'}
            disabled={busy !== null}
            testID="committee-invitation-decline"
          />
        </View>
      ) : null}

      {state === 'failed' ? (
        <Button
          label={t('mob.common.retry')}
          variant="secondary"
          onPress={onRetry}
          disabled={busy !== null}
          testID="committee-invitation-retry"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: radius.md,
    backgroundColor: colors.ctaBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { ...typography.h2, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  summaryBox: {
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  summaryTitle: { ...typography.bodyBold, color: colors.textPrimary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  rowLabel: { ...typography.body, color: colors.textSecondary },
  rowValue: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  message: { ...typography.body, color: colors.error },
  actions: { gap: spacing.sm, minHeight: sizes.touchTarget },
});
