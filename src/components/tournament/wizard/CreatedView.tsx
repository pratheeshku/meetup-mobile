/**
 * Board TournCreated: the tournament is live. Built from the stored rows the create call returns (a 200 replay
 * returns exactly the original). Not built: the share link, "Share on WhatsApp" and "More" of the board (the
 * response carries no tournament link, and the app has no tournament link to share; see the report).
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '../../../labels/LabelsContext';
import { colors, spacing, typography } from '../../../theme/tokens';
import type { WizardCreateResult } from '../../../types/tournamentWizard';
import Button from '../../Button';
import IconBadge from '../../IconBadge';
import { TrophyIcon } from '../../icons/SharedIcons';
import { Banner, SectionCard } from './parts';
import { formatDay } from './RegistrationStep';

const BADGE = 64;
const DOT = 12;

function day(iso: string): string {
  return formatDay(new Date(iso));
}

export default function CreatedView({
  result,
  hasInvitedCommittee,
  imagesFailed = false,
  onOpen,
}: {
  result: WizardCreateResult;
  hasInvitedCommittee: boolean;
  /** A banner or logo upload failed after the create: the tournament exists and the default shows (AD-T1). */
  imagesFailed?: boolean;
  onOpen: () => void;
}): React.JSX.Element {
  const t = useT();
  const insets = useSafeAreaInsets();
  const steps = [
    { color: colors.primary, title: t('mob.tw.created_next_register'), when: t('mob.tw.created_next_register_when', { date: day(result.registration_closes_at) }) },
    { color: colors.border, title: t('mob.tw.created_next_roster'), when: day(result.registration_hard_block_at) },
    { color: colors.border, title: t('mob.tw.created_next_start'), when: day(result.starts_at) },
  ];
  return (
    <View style={styles.screen} testID="tw-created">
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
        <View style={styles.hero}>
          <IconBadge size={BADGE} color="amber">
            <TrophyIcon size={32} />
          </IconBadge>
          <Text style={styles.title} accessibilityRole="header">
            {t('mob.tw.created_title', { title: result.title })}
          </Text>
          <Text style={styles.sub}>{t('mob.tw.created_sub', { date: day(result.registration_closes_at) })}</Text>
        </View>
        <SectionCard title={t('mob.tw.created_next')}>
          {steps.map((item, index) => (
            <View key={item.title} style={styles.row}>
              <View style={styles.dotColumn}>
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                {index < steps.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowWhen}>{item.when}</Text>
              </View>
            </View>
          ))}
        </SectionCard>
        {hasInvitedCommittee ? <Banner tone="info" message={t('mob.tw.created_committee_note')} /> : null}
        {imagesFailed ? <Banner tone="warning" message={t('mob.tw.created_images_failed')} testID="tw-created-images-failed" /> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Button label={t('mob.tw.created_open')} variant="cta" onPress={onOpen} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  title: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
  sub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  row: { flexDirection: 'row' },
  dotColumn: { width: DOT + spacing.sm, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  line: { width: 2, flex: 1, backgroundColor: colors.border, minHeight: spacing.md },
  rowText: { flex: 1, paddingLeft: spacing.sm, paddingBottom: spacing.sm },
  rowTitle: { ...typography.bodyBold, color: colors.textPrimary },
  rowWhen: { ...typography.caption, color: colors.textSecondary },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
});
