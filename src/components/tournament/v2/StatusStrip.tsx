/**
 * The adaptive status strip drawn over the bottom of a tournament banner (DES-MEETUP-ADDENDUM-tournament-experience
 * AD-T1, AD-T6; boards TV2MobOpen, TV2MobClosedOverview, TV2MobDoneOverview and the creation preview of
 * TV2MobCreateBasics). Text colour and scrim come from the server's `banner_tone` and `banner_scrim`; nothing is
 * measured on the device. State is carried by the pill words and by the stepper glyph (check, ring, empty circle),
 * never by colour alone. Every glyph sits in a fixed-size box.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import type { BannerTone } from '../../../types/tournament';
import {
  STAGE_LABEL,
  STAGE_ORDER,
  type PillDot,
  type StageKey,
  type StageState,
  type StripModel,
} from '../../../utils/tournamentExperience';
import { CheckIcon } from '../../icons/ActionIcons';

const GLYPH = 20;
const DOT = 8;

const DOT_COLOR: Record<PillDot, string> = {
  open: colors.success,
  closed: colors.warning,
  live: colors.accentPurple,
  done: colors.accentPurple,
  none: colors.textMuted,
};

export default function StatusStrip({
  model,
  tone,
  scrim,
  testID = 'status-strip',
}: {
  model: StripModel;
  tone: BannerTone;
  /** 0 to 60 percent, from the server. */
  scrim: number;
  testID?: string;
}): React.JSX.Element {
  const t = useT();
  const ink = tone === 'dark' ? colors.textPrimary : colors.white;
  const wash = tone === 'dark' ? colors.white : colors.textPrimary;
  const pillText = t(model.pill);
  const stages = model.stages;

  return (
    <View style={styles.strip} testID={testID}>
      <View style={[StyleSheet.absoluteFill, styles.scrim, { backgroundColor: wash, opacity: scrim / 100 }]} />
      <View style={styles.pillRow}>
        <View style={styles.pill} accessibilityRole="text" testID="status-pill">
          {model.dot !== 'none' ? <View style={[styles.dot, { backgroundColor: DOT_COLOR[model.dot] }]} /> : null}
          <Text style={styles.pillText}>{pillText}</Text>
        </View>
        {model.chip ? (
          <View style={[styles.chip, { borderColor: ink }]} testID="status-chip">
            <Text style={[styles.chipText, { color: ink }]}>{t(model.chip)}</Text>
          </View>
        ) : null}
      </View>
      {stages ? (
        <View style={styles.stepper} testID="status-stepper">
          {STAGE_ORDER.map((key, index) => (
            <React.Fragment key={key}>
              <StagePoint stage={key} state={stages[key]} ink={ink} />
              {index < STAGE_ORDER.length - 1 ? <View style={[styles.link, { backgroundColor: ink }]} /> : null}
            </React.Fragment>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StagePoint({ stage, state, ink }: { stage: StageKey; state: StageState; ink: string }): React.JSX.Element {
  const t = useT();
  const name = t(STAGE_LABEL[stage]);
  const a11yKey =
    state === 'done'
      ? 'mob.tournament.v2.stage_done'
      : state === 'current'
      ? 'mob.tournament.v2.stage_current'
      : 'mob.tournament.v2.stage_upcoming';
  return (
    <View style={styles.point} accessible accessibilityLabel={t(a11yKey, { stage: name })} testID={`stage-${stage}-${state}`}>
      <View
        style={[
          styles.glyph,
          state === 'done' ? { backgroundColor: ink } : null,
          state === 'current' ? styles.glyphCurrent : null,
          state === 'upcoming' ? styles.glyphUpcoming : null,
          state !== 'done' ? { borderColor: ink } : null,
        ]}
      >
        {state === 'done' ? <CheckIcon size={12} color={ink === colors.white ? colors.textPrimary : colors.white} /> : null}
      </View>
      <Text style={[styles.pointText, { color: ink }, state === 'current' ? styles.pointTextOn : null]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { borderRadius: radius.md, padding: spacing.sm, overflow: 'hidden' },
  scrim: { borderRadius: radius.md },
  pillRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 4,
    minHeight: 28,
    marginRight: spacing.sm,
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, marginRight: spacing.xs + 3 },
  pillText: { ...typography.label, fontWeight: '800', color: colors.textPrimary },
  chip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm + 4, minHeight: 28, justifyContent: 'center' },
  chipText: { ...typography.label, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  point: { flexDirection: 'row', alignItems: 'center' },
  glyph: {
    width: GLYPH,
    height: GLYPH,
    borderRadius: GLYPH / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  glyphCurrent: { borderWidth: 3 },
  glyphUpcoming: { borderWidth: 1 },
  pointText: { fontSize: 10.5, fontWeight: '600' },
  pointTextOn: { fontWeight: '800' },
  link: { flex: 1, height: 3, borderRadius: 2, marginHorizontal: spacing.xs, minWidth: spacing.sm, opacity: 0.4 },
});
