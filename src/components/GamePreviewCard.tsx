/**
 * The 7-field public game preview (deep-links AD-8; shareable-links Decision 4): sport, when, venue,
 * organizer, going and capacity. No participants, no identities beyond the organizer's display name.
 * Display only: any call to action is the caller's.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PublicEventPreview } from '../api/publicLinks';
import { useT } from '../labels/LabelsContext';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import { formatEventDate, formatEventTimeRange } from '../utils/formatEventDateTime';
import { useSportDisplayName } from '../utils/labels';

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function GamePreviewCard({ preview }: { preview: PublicEventPreview }): React.JSX.Element {
  const t = useT();
  const sport = useSportDisplayName(preview.sport ?? '');

  const when = preview.starts_at
    ? `${formatEventDate(preview.starts_at)} · ${formatEventTimeRange(preview.starts_at, preview.ends_at)}`
    : '';
  const going =
    preview.going_count === null
      ? ''
      : preview.capacity !== null
        ? t('mob.link_preview.going_of', { going: preview.going_count, capacity: preview.capacity })
        : t('mob.link_preview.going_only', { going: preview.going_count });

  return (
    <View style={styles.card}>
      {preview.sport ? <Text style={styles.title}>{sport}</Text> : null}
      {when ? <Row label={t('mob.link_preview.when')} value={when} /> : null}
      {preview.venue_name ? <Row label={t('mob.link_preview.venue')} value={preview.venue_name} /> : null}
      {preview.organizer_display_name ? (
        <Row label={t('mob.link_preview.organizer')} value={preview.organizer_display_name} />
      ) : null}
      {going ? <Row label={t('mob.link_preview.going')} value={going} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.md },
  row: { marginBottom: spacing.sm },
  rowLabel: { ...typography.caption, color: colors.textSecondary },
  rowValue: { ...typography.body, color: colors.textPrimary },
});
