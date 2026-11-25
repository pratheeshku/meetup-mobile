/**
 * Optional game banner on Create game and Edit game (DES-MEETUP-ADDENDUM-nov24-enhancements NV-03, AD-5; D-1: the
 * tournament wizard's banner field, banner only, no logo and no status strip). The picture is cropped to 4:1
 * (1600 x 400) like a tournament banner; the server checks type and size, strips EXIF and crops again. The picked
 * picture is only kept here; the screen uploads it after the game is saved. Theme tokens only; fixed-size boxes for
 * icon rows.
 */
import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../labels/LabelsContext';
import { dash } from '../theme/dashboardTheme';
import { borderWidth, colors, radius, shadows, spacing, typography } from '../theme/tokens';
import { isPickerCancelled, pickImage, type PickedImage } from '../utils/imagePicker';
import { CameraIcon, PlusIcon, TrashIcon } from './icons/ActionIcons';

const BANNER_ASPECT = 4;
const ROUND_BUTTON = 40;
const ACTION_HEIGHT = 44;
const REMOVE_WIDTH = 96;
const GLYPH = 20;

export const GAME_BANNER_CROP = { width: 1600, height: 400 };

export default function GameBannerField({
  previewUri,
  onPick,
  onRemove,
  disabled = false,
}: {
  /** What the box shows: the newly picked picture, else the game's current banner, else nothing. */
  previewUri: string | null;
  onPick: (image: PickedImage) => void;
  onRemove: () => void;
  disabled?: boolean;
}): React.JSX.Element {
  const t = useT();
  const [pickFailed, setPickFailed] = useState(false);

  const pick = async (source: 'camera' | 'library'): Promise<void> => {
    setPickFailed(false);
    try {
      const image = await pickImage(source, t('mob.tw.crop_banner'), GAME_BANNER_CROP);
      if (image) {
        onPick(image);
      }
    } catch (error) {
      if (!isPickerCancelled(error)) {
        setPickFailed(true);
      }
    }
  };

  const choose = (): void => {
    Alert.alert(t('mob.create_game.banner'), undefined, [
      { text: t('mob.common.cancel'), style: 'cancel' },
      { text: t('mob.create_group.take_photo'), onPress: () => pick('camera') },
      { text: t('mob.create_group.choose_photo'), onPress: () => pick('library') },
    ]);
  };

  return (
    <View testID="game-banner-field">
      <Text style={styles.label}>{t('mob.create_game.banner')}</Text>
      <View style={styles.bannerBox} testID="game-banner-preview">
        {previewUri ? <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(previewUri ? 'mob.tw.banner_change' : 'mob.tw.banner_upload')}
          onPress={choose}
          disabled={disabled}
          style={styles.cameraRound}
        >
          <CameraIcon size={18} color={colors.textPrimary} />
        </Pressable>
      </View>
      {pickFailed ? (
        <Text style={styles.error} accessibilityRole="alert" testID="game-banner-pick-failed">
          {t('mob.tw.images_pick_failed')}
        </Text>
      ) : null}
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          onPress={choose}
          disabled={disabled}
          style={styles.primaryAction}
          testID="game-banner-upload"
        >
          <View style={styles.glyphBox}>
            <PlusIcon size={16} color={colors.white} />
          </View>
          <Text style={styles.primaryText}>{t(previewUri ? 'mob.tw.banner_change' : 'mob.tw.banner_upload')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !previewUri || disabled }}
          disabled={!previewUri || disabled}
          onPress={onRemove}
          style={[styles.removeAction, !previewUri ? styles.disabled : null]}
          testID="game-banner-remove"
        >
          <View style={styles.glyphBox}>
            <TrashIcon size={16} color={colors.error} />
          </View>
          <Text style={styles.removeText}>{t('mob.tw.image_remove')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.caption, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  bannerBox: {
    width: '100%',
    aspectRatio: BANNER_ASPECT,
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
  error: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
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
  disabled: { opacity: 0.5 },
  glyphBox: { width: GLYPH, height: GLYPH, alignItems: 'center', justifyContent: 'center' },
});
