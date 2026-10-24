/**
 * Small pieces shared by the tab bodies of the tournament page for lifecycle version 2 (te-a2): the white card, the
 * "Committee only" note, a text chip and a fixed-size count badge. Theme tokens only.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useT } from '../../../../labels/LabelsContext';
import { dash, dashRadius } from '../../../../theme/dashboardTheme';
import { borderWidth, colors, radius, spacing, typography } from '../../../../theme/tokens';

export function TabCard({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.JSX.Element {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

export function CardHead({ title, badge }: { title: string; badge?: string | null }): React.JSX.Element {
  return (
    <View style={styles.head}>
      <Text style={styles.headTitle} accessibilityRole="header">
        {title}
      </Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The purple "Committee only" note of the boards: a text tag plus the sentence (state is carried by the words). */
export function CommitteeNote({ text, testID }: { text: string; testID?: string }): React.JSX.Element {
  const t = useT();
  return (
    <View style={styles.note} testID={testID}>
      <Text style={styles.noteTag}>{t('mob.tournament.v2.committee_only')}</Text>
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

export function Chip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'amber' | 'purple' | 'green' | 'teal';
}): React.JSX.Element {
  return (
    <View style={[styles.chip, toneStyles[tone].box]}>
      <Text style={[styles.chipText, toneStyles[tone].text]}>{label}</Text>
    </View>
  );
}

export function EmptyLine({ text }: { text: string }): React.JSX.Element {
  return <Text style={styles.empty}>{text}</Text>;
}

const toneStyles = {
  neutral: { box: { backgroundColor: dash.page }, text: { color: dash.text } },
  amber: { box: { backgroundColor: colors.ownerChipBg }, text: { color: colors.ownerChipText } },
  purple: { box: { backgroundColor: colors.avatarTint5 }, text: { color: colors.avatarTintText5 } },
  green: { box: { backgroundColor: colors.successLight }, text: { color: colors.successDark } },
  teal: { box: { backgroundColor: colors.avatarTint3 }, text: { color: colors.avatarTintText3 } },
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: dash.card,
    borderRadius: dashRadius.card,
    borderWidth: borderWidth.thin,
    borderColor: dash.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  headTitle: { ...typography.h3, color: dash.text, flex: 1 },
  badge: { backgroundColor: colors.avatarTint5, borderRadius: radius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: 3 },
  badgeText: { ...typography.label, color: colors.avatarTintText5 },
  note: { backgroundColor: colors.avatarTint5, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  noteTag: { ...typography.label, color: colors.avatarTintText5, marginBottom: spacing.xs },
  noteText: { ...typography.bodyBold, color: colors.avatarTintText5 },
  chip: { borderRadius: radius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: 3, marginRight: spacing.xs, marginTop: spacing.xs },
  chipText: { ...typography.label },
  empty: { ...typography.body, color: dash.textMuted, textAlign: 'center', paddingVertical: spacing.md },
});
