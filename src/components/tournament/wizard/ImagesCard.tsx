/**
 * Banner and logo capture on the first wizard screen (board TV2MobCreateBasics; AD-T1). Both are optional: skipping
 * either one means the admin default is used. The pictures are only kept here; they are uploaded after the tournament
 * is created and a failed upload never blocks creation. The preview below is a stand-in (light text, scrim 40): the
 * real tone and scrim are computed by the server at upload. Theme tokens only; fixed-size boxes for icon rows.
 */
import React from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { dash } from '../../../theme/dashboardTheme';
import { borderWidth, colors, radius, shadows, spacing, typography } from '../../../theme/tokens';
import { isPickerCancelled, pickImage, type PickedImage } from '../../../utils/imagePicker';
import { stripModel, stripTone } from '../../../utils/tournamentExperience';
import { CameraIcon, PlusIcon, TrashIcon } from '../../icons/ActionIcons';
import { InfoIcon } from '../../icons/HomeV2Icons';
import StatusStrip from '../v2/StatusStrip';
import { SectionCard } from './parts';

const BANNER_HEIGHT = 96;
const PREVIEW_HEIGHT = 120;
const LOGO_BOX = 84;
const ROUND_BUTTON = 40;
const SMALL_ROUND = 30;
const ACTION_HEIGHT = 44;
const REMOVE_WIDTH = 96;
const GLYPH = 24;

const BANNER_CROP = { width: 1600, height: 400 };
const LOGO_CROP = { width: 512, height: 512 };

export default function ImagesCard({
  banner,
  logo,
  onBanner,
  onLogo,
  onPickFailed,
}: {
  banner: PickedImage | null;
  logo: PickedImage | null;
  onBanner: (image: PickedImage | null) => void;
  onLogo: (image: PickedImage | null) => void;
  onPickFailed: () => void;
}): React.JSX.Element {
  const t = useT();

  const pick = async (
    kind: 'banner' | 'logo',
    source: 'camera' | 'library',
  ): Promise<void> => {
    try {
      const image =
        kind === 'banner'
          ? await pickImage(source, t('mob.tw.crop_banner'), BANNER_CROP)
          : await pickImage(source, t('mob.tw.crop_logo'), LOGO_CROP);
      if (image) {
        (kind === 'banner' ? onBanner : onLogo)(image);
      }
    } catch (error) {
      if (!isPickerCancelled(error)) {
        onPickFailed();
      }
    }
  };

  const choose = (kind: 'banner' | 'logo'): void => {
    Alert.alert(t(kind === 'banner' ? 'mob.tw.banner_label' : 'mob.tw.logo_label'), undefined, [
      { text: t('mob.common.cancel'), style: 'cancel' },
      { text: t('mob.create_group.take_photo'), onPress: () => pick(kind, 'camera') },
      { text: t('mob.create_group.choose_photo'), onPress: () => pick(kind, 'library') },
    ]);
  };

  const model = stripModel({ lifecycle: 'active', phase: 'open', fixturesPublished: false });
  const { tone, scrim } = stripTone(null, null);

  return (
    <View>
      <SectionCard>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            {t('mob.tw.images_title')}
          </Text>
          <View style={styles.optional}>
            <Text style={styles.optionalText}>{t('mob.tw.images_optional')}</Text>
          </View>
        </View>

        <Text style={styles.label}>{t('mob.tw.banner_label')}</Text>
        <View style={styles.bannerBox} testID="tw-banner-preview">
          {banner ? <Image source={{ uri: banner.path }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mob.tw.banner_upload')}
            onPress={() => choose('banner')}
            style={styles.cameraRound}
          >
            <CameraIcon size={18} color={colors.textPrimary} />
          </Pressable>
        </View>
        <Text style={styles.hint}>{t('mob.tw.banner_hint')}</Text>
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => choose('banner')}
            style={styles.primaryAction}
            testID="tw-banner-upload"
          >
            <View style={styles.glyphBox}>
              <PlusIcon size={16} color={colors.white} />
            </View>
            <Text style={styles.primaryText}>{t(banner ? 'mob.tw.banner_change' : 'mob.tw.banner_upload')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !banner }}
            disabled={!banner}
            onPress={() => onBanner(null)}
            style={[styles.removeAction, !banner ? styles.disabled : null]}
            testID="tw-banner-remove"
          >
            <View style={styles.glyphBox}>
              <TrashIcon size={16} color={colors.error} />
            </View>
            <Text style={styles.removeText}>{t('mob.tw.image_remove')}</Text>
          </Pressable>
        </View>

        <Text style={[styles.label, styles.logoLabel]}>{t('mob.tw.logo_label')}</Text>
        <View style={styles.logoRow}>
          <View style={styles.logoWrap}>
            <View style={styles.logoBox} testID="tw-logo-preview">
              {logo ? <Image source={{ uri: logo.path }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.tw.logo_upload')}
              onPress={() => choose('logo')}
              style={styles.cameraSmall}
            >
              <CameraIcon size={14} color={colors.textPrimary} />
            </Pressable>
          </View>
          <View style={styles.logoSide}>
            <Text style={styles.hint}>{t('mob.tw.logo_hint')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => choose('logo')}
              style={styles.secondaryAction}
              testID="tw-logo-upload"
            >
              <Text style={styles.secondaryText}>{t(logo ? 'mob.tw.logo_change' : 'mob.tw.logo_upload')}</Text>
            </Pressable>
            {logo ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => onLogo(null)}
                hitSlop={8}
                style={styles.removeLink}
                testID="tw-logo-remove"
              >
                <Text style={styles.removeText}>{t('mob.tw.image_remove')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.note}>
          <View style={styles.glyphBox}>
            <InfoIcon size={16} color={dash.brand} />
          </View>
          <Text style={styles.noteText}>{t('mob.tw.images_note')}</Text>
        </View>
      </SectionCard>

      <Text style={[styles.label, styles.previewLabel]}>{t('mob.tw.images_preview')}</Text>
      <View style={styles.preview} testID="tw-banner-live-preview">
        {banner ? <Image source={{ uri: banner.path }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <View style={styles.previewStrip}>
          <StatusStrip model={model} tone={tone} scrim={scrim} testID="tw-preview-strip" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
  optional: { backgroundColor: colors.track, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  optionalText: { ...typography.label, color: colors.textSecondary },
  label: { ...typography.caption, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  logoLabel: { marginTop: spacing.md },
  bannerBox: {
    height: BANNER_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: dash.brandDeep,
  },
  cameraRound: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: ROUND_BUTTON,
    height: ROUND_BUTTON,
    borderRadius: ROUND_BUTTON / 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  actionRow: { flexDirection: 'row', marginTop: spacing.sm },
  primaryAction: {
    flex: 1,
    height: ACTION_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.ctaBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  primaryText: { ...typography.bodyBold, color: colors.white, marginLeft: spacing.xs },
  removeAction: {
    width: REMOVE_WIDTH,
    height: ACTION_HEIGHT,
    borderRadius: radius.md,
    borderWidth: borderWidth.medium,
    borderColor: colors.errorLight,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { ...typography.bodyBold, color: colors.error },
  removeLink: { minHeight: 44, justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  glyphBox: { width: GLYPH - 4, height: GLYPH - 4, alignItems: 'center', justifyContent: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoWrap: { width: LOGO_BOX, height: LOGO_BOX },
  logoBox: {
    width: LOGO_BOX,
    height: LOGO_BOX,
    borderRadius: radius.lg,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.successDark,
    overflow: 'hidden',
    ...shadows.card,
  },
  cameraSmall: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    width: SMALL_ROUND,
    height: SMALL_ROUND,
    borderRadius: SMALL_ROUND / 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  logoSide: { flex: 1, marginLeft: spacing.md },
  secondaryAction: {
    height: ACTION_HEIGHT,
    borderRadius: radius.md,
    borderWidth: borderWidth.medium,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  secondaryText: { ...typography.bodyBold, color: colors.ctaBlue },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  noteText: { ...typography.caption, fontWeight: '600', color: colors.primaryDark, flex: 1, marginLeft: spacing.sm },
  previewLabel: { marginTop: spacing.md },
  preview: {
    height: PREVIEW_HEIGHT,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: dash.brandDeep,
    justifyContent: 'flex-end',
  },
  previewStrip: { padding: spacing.sm },
});
