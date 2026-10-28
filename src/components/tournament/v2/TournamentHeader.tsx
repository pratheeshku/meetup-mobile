/**
 * Tournament header for lifecycle version 2 (DES-MEETUP-ADDENDUM-tournament-experience AD-T1, AD-T6; boards
 * TV2MobOpen, TV2MobClosedOverview, TV2MobDoneOverview): the banner with the adaptive status strip and the Register
 * action, the logo and title row, and the organizer and committee chips. Names only, never ids. The banner never
 * changes colour with status; only the strip words and stepper do. Theme tokens only; icon-plus-text rows use
 * fixed-size boxes.
 */
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { dash } from '../../../theme/dashboardTheme';
import { borderWidth, colors, radius, shadows, spacing, typography } from '../../../theme/tokens';
import type { TournamentPerson } from '../../../types/tournament';
import type { BannerTone } from '../../../types/tournament';
import { toHttpsUrl } from '../../../utils/httpsUrl';
import { committeeNames, type StripModel } from '../../../utils/tournamentExperience';
import { CheckIcon, ChevronRightIcon, PlusIcon } from '../../icons/ActionIcons';
import { TrophyIcon } from '../../icons/SharedIcons';
import Badge from '../../Badge';
import UserAvatar from '../../UserAvatar';
import StatusStrip from './StatusStrip';

const BANNER_HEIGHT = 214;
const LOGO = 68;
const REGISTER_HEIGHT = 52;
const CHIP_AVATAR = 30;
const CHEVRON_BOX = 20;
const MAX_CHIP_AVATARS = 3;

export type RegisterAction =
  | { kind: 'register'; loading: boolean; onPress: () => void }
  | { kind: 'registered' }
  | null;

function Banner({ url, children }: { url: string | null | undefined; children: React.ReactNode }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  const uri = toHttpsUrl(url);
  return (
    <View style={styles.banner} testID="tournament-banner">
      {uri && !failed ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
      ) : null}
      {children}
    </View>
  );
}

export default function TournamentHeader({
  title,
  metaLine,
  bannerUrl,
  logoUrl,
  tone,
  scrim,
  strip,
  full,
  register,
  organizer,
  committee,
  onOpenOrganizer,
  onOpenCommittee,
}: {
  title: string;
  metaLine: string;
  bannerUrl: string | null | undefined;
  logoUrl: string | null | undefined;
  tone: BannerTone;
  scrim: number;
  strip: StripModel;
  /** The API's `is_full` (AD-1): shows the Full chip; the cap itself is never shown here. */
  full: boolean;
  register: RegisterAction;
  organizer: TournamentPerson | null | undefined;
  committee: readonly TournamentPerson[];
  onOpenOrganizer: () => void;
  onOpenCommittee: () => void;
}): React.JSX.Element {
  const t = useT();
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUri = toHttpsUrl(logoUrl);

  return (
    <View>
      <Banner url={bannerUrl}>
        {register ? (
          <View style={styles.registerWrap} pointerEvents="box-none">
            {register.kind === 'register' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('mob.tournament.register')}
                disabled={register.loading}
                onPress={register.onPress}
                style={({ pressed }) => [styles.registerButton, pressed ? styles.pressed : null]}
                testID="tournament-register-button"
              >
                <View style={styles.registerLine}>
                  <View style={styles.registerGlyph}>
                    <PlusIcon size={16} color={colors.white} />
                  </View>
                  <Text style={styles.registerText}>{t('mob.tournament.register')}</Text>
                </View>
              </Pressable>
            ) : (
              <View style={[styles.registerButton, styles.registeredButton]} testID="tournament-registered-badge">
                <View style={styles.registerLine}>
                  <View style={styles.registerGlyph}>
                    <CheckIcon size={16} color={colors.white} />
                  </View>
                  <Text style={styles.registerText}>{t('mob.tournament.v2.registered_badge')}</Text>
                </View>
              </View>
            )}
          </View>
        ) : null}
        <View style={styles.stripWrap}>
          <StatusStrip model={strip} tone={tone} scrim={scrim} />
        </View>
      </Banner>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.logo} testID="tournament-logo">
            {logoUri && !logoFailed ? (
              <Image
                source={{ uri: logoUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onError={() => setLogoFailed(true)}
                accessibilityLabel={t('mob.tournament.v2.logo_a11y', { title })}
              />
            ) : (
              <TrophyIcon size={32} />
            )}
          </View>
          <View style={styles.titleText}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Text style={styles.meta}>{metaLine}</Text>
            {full ? <Badge label={t('web.tournament.full_chip')} variant="warning" style={styles.fullChip} /> : null}
          </View>
        </View>

        <View style={styles.chips}>
          {organizer ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.tournament.v2.chip_organizer_a11y', { name: organizer.display_name })}
              onPress={onOpenOrganizer}
              style={[styles.chip, styles.chipGap]}
              testID="tournament-organizer-chip"
            >
              <UserAvatar imageUrl={organizer.avatar_url} name={organizer.display_name} size={CHIP_AVATAR} fallback="initials" />
              <View style={styles.chipText}>
                <Text style={styles.chipLabel}>{t('mob.tournament.v2.organized_by')}</Text>
                <Text style={styles.chipValue} numberOfLines={1}>
                  {organizer.display_name}
                </Text>
              </View>
              <View style={styles.chevron}>
                <ChevronRightIcon size={14} color={colors.textMuted} />
              </View>
            </Pressable>
          ) : null}
          {committee.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.tournament.v2.chip_committee_a11y', { names: committeeNames(committee) })}
              onPress={onOpenCommittee}
              style={styles.chip}
              testID="tournament-committee-chip"
            >
              <View style={styles.avatarStack}>
                {committee.slice(0, MAX_CHIP_AVATARS).map((person, index) => (
                  <View key={person.user_id} style={index > 0 ? styles.stacked : null}>
                    <UserAvatar imageUrl={person.avatar_url} name={person.display_name} size={CHIP_AVATAR} fallback="initials" />
                  </View>
                ))}
              </View>
              <View style={styles.chipText}>
                <Text style={styles.chipLabel}>{t('mob.tournament.v2.committee')}</Text>
                <Text style={styles.chipValue} numberOfLines={1}>
                  {committeeNames(committee)}
                </Text>
              </View>
              <View style={styles.chevron}>
                <ChevronRightIcon size={14} color={colors.textMuted} />
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { height: BANNER_HEIGHT, backgroundColor: dash.brandDeep, overflow: 'hidden', justifyContent: 'flex-end' },
  stripWrap: { margin: spacing.sm + 2 },
  registerWrap: { position: 'absolute', right: spacing.sm + 4, bottom: 92 },
  registerButton: {
    height: REGISTER_HEIGHT,
    paddingHorizontal: spacing.lg - 2,
    borderRadius: radius.lg,
    backgroundColor: colors.ctaBlue,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.overlay,
  },
  registeredButton: { backgroundColor: colors.successDark },
  pressed: { opacity: 0.85 },
  registerLine: { flexDirection: 'row', alignItems: 'center' },
  registerGlyph: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', marginRight: spacing.xs },
  registerText: { ...typography.button, fontWeight: '800', color: colors.white },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.sm + 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  logo: {
    width: LOGO,
    height: LOGO,
    borderRadius: 17,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.successDark,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  titleText: { flex: 1, minWidth: 0, marginLeft: spacing.md - 2 },
  title: { fontSize: 21, fontWeight: '800', lineHeight: 25, color: dash.text },
  meta: { ...typography.caption, color: dash.textMuted, marginTop: 3 },
  fullChip: { alignSelf: 'flex-start', marginTop: spacing.xs },
  chips: { flexDirection: 'row', marginTop: spacing.sm + 4 },
  chip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: borderWidth.medium,
    borderColor: dash.cardBorder,
    borderRadius: radius.lg - 2,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: spacing.sm + 2,
    minHeight: 44,
    ...shadows.card,
  },
  chipGap: { marginRight: spacing.sm + 2 },
  chipText: { flex: 1, minWidth: 0, marginLeft: spacing.sm + 2 },
  chipLabel: { fontSize: 10.5, fontWeight: '600', color: dash.textMuted },
  chipValue: { fontSize: 12.5, fontWeight: '800', color: dash.text },
  chevron: { width: CHEVRON_BOX, height: CHEVRON_BOX, alignItems: 'center', justifyContent: 'center' },
  avatarStack: { flexDirection: 'row' },
  stacked: { marginLeft: -10 },
});
