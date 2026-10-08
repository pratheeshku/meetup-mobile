/**
 * Edit profile screen (Phase 2 revamp, EditProfile.png).
 *
 * Controls:
 * - Cover image card: 3:1 preview with "Default banner" badge, "Choose image" and "Use default" buttons
 * - Profile photo card: 72x72 avatar with camera badge, "Profile photo" title and "Change photo" link
 * - Form fields card: Display name (editable), Nickname (read-only), Mobile number (optional) with admin visibility hint
 * - Skill levels card: Badminton, Pickleball, Tennis with segmented pill [Beginner | Inter. | Adv.]
 * - Sticky footer: Cancel and Save buttons
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import ImageCropPicker from 'react-native-image-crop-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  deleteAvatar,
  deleteCover,
  deleteSkillLevel,
  getProfile,
  updateProfile,
  updateSkillLevel,
  uploadAvatar,
  uploadCover,
} from '../api/profile';
import { updateMobileNumber } from '../api/mobileNumber';
import { BannerBackground, SportIcon } from '../components/icons/DashboardIcons';
import { BackArrowIcon, CameraIcon } from '../components/icons/ActionIcons';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import { useSportDisplayName } from '../utils/labels';
import { getDisplayName } from '../utils/displayName';
import { getApiErrorMessage } from '../utils/apiError';
import { useT } from '../labels/LabelsContext';
import {
  borderWidth,
  colors,
  radius,
  spacing,
  typography,
} from '../theme/tokens';
import type { SkillLevelValue, UserProfile } from '../types/user';
import type { ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

const EDITABLE_SPORTS = ['badminton', 'pickleball', 'tennis'];

function getInitials(name?: string | null): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function SkillRowItem({
  sport,
  currentLevel,
  onSelectLevel,
}: {
  sport: string;
  currentLevel: SkillLevelValue | null;
  onSelectLevel: (sport: string, level: SkillLevelValue) => void;
}): React.JSX.Element {
  const sportName = useSportDisplayName(sport);
  const t = useT();

  return (
    <View style={styles.skillRow}>
      <View style={styles.skillLeading}>
        <View style={styles.skillIconCircle}>
          <SportIcon slug={sport} size={20} />
        </View>
        <Text style={styles.skillSportName}>{sportName}</Text>
      </View>

      <View style={styles.segmentContainer}>
        <Pressable
          style={[
            styles.segmentButton,
            currentLevel === 'Beginner' && styles.segmentButtonActive,
          ]}
          onPress={() => onSelectLevel(sport, 'Beginner')}
          accessibilityRole="button"
          accessibilityLabel={`${sportName} ${t('mob.profile.level_beginner')}`}
        >
          <Text
            style={[
              styles.segmentText,
              currentLevel === 'Beginner' && styles.segmentTextActive,
            ]}
          >
            {t('mob.profile.level_beginner')}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.segmentButton,
            currentLevel === 'Intermediate' && styles.segmentButtonActive,
          ]}
          onPress={() => onSelectLevel(sport, 'Intermediate')}
          accessibilityRole="button"
          accessibilityLabel={`${sportName} ${t('mob.profile.level_intermediate')}`}
        >
          <Text
            style={[
              styles.segmentText,
              currentLevel === 'Intermediate' && styles.segmentTextActive,
            ]}
          >
            {t('mob.profile.level_intermediate')}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.segmentButton,
            currentLevel === 'Expert' && styles.segmentButtonActive,
          ]}
          onPress={() => onSelectLevel(sport, 'Expert')}
          accessibilityRole="button"
          accessibilityLabel={`${sportName} ${t('mob.profile.level_expert')}`}
        >
          <Text
            style={[
              styles.segmentText,
              currentLevel === 'Expert' && styles.segmentTextActive,
            ]}
          >
            {t('mob.profile.level_expert')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function EditProfileScreen({ navigation }: Props): React.JSX.Element {
  const t = useT();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  // Cover image states
  const [coverAction, setCoverAction] = useState<'keep' | 'new' | 'default'>('keep');
  const [coverPreviewUri, setCoverPreviewUri] = useState<string | null>(null);
  const [newCoverFile, setNewCoverFile] = useState<{ uri: string; name: string; type: string } | null>(null);

  // Avatar states
  const [avatarAction, setAvatarAction] = useState<'keep' | 'new' | 'remove'>('keep');
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const [newAvatarFile, setNewAvatarFile] = useState<{ uri: string; name: string; type: string } | null>(null);

  // Skills
  const [skillLevels, setSkillLevels] = useState<Record<string, SkillLevelValue | null>>({
    badminton: null,
    pickleball: null,
    tennis: null,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const data = await getProfile();
      setProfile(data);
      setDisplayName(data.display_name || '');
      setMobileNumber(data.mobile_number || '');

      const initialSkills: Record<string, SkillLevelValue | null> = {
        badminton: null,
        pickleball: null,
        tennis: null,
      };
      if (data.skill_levels) {
        for (const item of data.skill_levels) {
          const key = item.sport.toLowerCase();
          initialSkills[key] = item.skill_level;
        }
      }
      setSkillLevels(initialSkills);
    } catch {
      setLoadError(t('mob.profile.load_error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cover picker
  const handleChooseCover = async (): Promise<void> => {
    try {
      const image = await ImageCropPicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        width: 1200,
        height: 400,
        compressImageQuality: 0.85,
        forceJpg: true,
        cropperToolbarTitle: t('mob.profile.photo_crop_cover'),
      });
      if (image && image.path) {
        const name = image.filename || image.path.split('/').pop() || 'cover.jpg';
        const type = image.mime || 'image/jpeg';
        setCoverPreviewUri(image.path);
        setNewCoverFile({ uri: image.path, name, type });
        setCoverAction('new');
      }
    } catch (e: any) {
      if (e?.code === 'E_PICKER_CANCELLED' || e?.message?.toLowerCase().includes('cancel')) {
        return;
      }
      Alert.alert(t('mob.profile.cover_image'), t('mob.profile.photo_upload_error'));
    }
  };

  const handleUseDefaultCover = (): void => {
    setCoverAction('default');
    setCoverPreviewUri(null);
    setNewCoverFile(null);
  };

  // Avatar picker
  const pickAvatar = async (source: 'camera' | 'library'): Promise<void> => {
    try {
      const options = {
        mediaType: 'photo' as const,
        cropping: true,
        width: 500,
        height: 500,
        compressImageQuality: 0.8,
        forceJpg: true,
        cropperToolbarTitle: t('mob.profile.crop_title'),
      };
      const image =
        source === 'camera'
          ? await ImageCropPicker.openCamera(options)
          : await ImageCropPicker.openPicker(options);

      if (image && image.path) {
        const name = image.filename || image.path.split('/').pop() || 'avatar.jpg';
        const type = image.mime || 'image/jpeg';
        setAvatarPreviewUri(image.path);
        setNewAvatarFile({ uri: image.path, name, type });
        setAvatarAction('new');
      }
    } catch (e: any) {
      if (e?.code === 'E_PICKER_CANCELLED' || e?.message?.toLowerCase().includes('cancel')) {
        return;
      }
      Alert.alert(t('mob.profile.profile_photo'), t('mob.profile.photo_upload_error'));
    }
  };

  const handlePhotoPress = (): void => {
    const hasPhoto = avatarAction === 'new' || (avatarAction === 'keep' && Boolean(profile?.avatar_url));
    const buttons = [
      { text: t('mob.common.cancel'), style: 'cancel' as const },
      { text: t('mob.profile.take_photo'), onPress: () => pickAvatar('camera') },
      { text: t('mob.profile.choose_photo'), onPress: () => pickAvatar('library') },
    ];
    if (hasPhoto) {
      buttons.push({
        text: t('mob.profile.remove_photo'),
        style: 'destructive' as const,
        onPress: () => {
          setAvatarAction('remove');
          setAvatarPreviewUri(null);
          setNewAvatarFile(null);
        },
      } as any);
    }
    Alert.alert(t('mob.profile.profile_photo'), undefined, buttons);
  };

  const handleSelectSkillLevel = (sport: string, level: SkillLevelValue): void => {
    setSkillLevels(prev => {
      const current = prev[sport];
      return {
        ...prev,
        [sport]: current === level ? null : level,
      };
    });
  };

  const handleSave = async (): Promise<void> => {
    if (!profile) return;
    try {
      setIsSaving(true);
      setSaveError(null);

      // 1. Display name
      if (displayName.trim() && displayName.trim() !== profile.display_name) {
        await updateProfile({ display_name: displayName.trim() });
      }

      // 2. Cover image
      if (coverAction === 'new' && newCoverFile) {
        await uploadCover(newCoverFile.uri, newCoverFile.name, newCoverFile.type);
      } else if (coverAction === 'default' && profile.cover_url) {
        await deleteCover();
      }

      // 3. Avatar
      if (avatarAction === 'new' && newAvatarFile) {
        await uploadAvatar(newAvatarFile.uri, newAvatarFile.name, newAvatarFile.type);
      } else if (avatarAction === 'remove' && profile.avatar_url) {
        await deleteAvatar();
      }

      // 4. Mobile number
      if (mobileNumber.trim() !== (profile.mobile_number ?? '')) {
        await updateMobileNumber({ mobile_number: mobileNumber.trim() || null });
      }

      // 5. Skill levels
      const initialMap = (profile.skill_levels ?? []).reduce<Record<string, SkillLevelValue>>((acc, sl) => {
        acc[sl.sport.toLowerCase()] = sl.skill_level;
        return acc;
      }, {});

      for (const sport of EDITABLE_SPORTS) {
        const level = skillLevels[sport];
        const initialLevel = initialMap[sport];
        if (level && level !== initialLevel) {
          await updateSkillLevel(sport, level);
        } else if (!level && initialLevel) {
          await deleteSkillLevel(sport).catch(() => {});
        }
      }

      navigation.goBack();
    } catch (e: any) {
      setSaveError(getApiErrorMessage(e, t('mob.profile.save_error')));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingView />;
  }

  if (loadError || !profile) {
    return <ErrorView message={loadError ?? t('mob.profile.not_found')} onRetry={loadData} />;
  }

  const isDefaultCover = coverAction === 'default' || (!profile.cover_url && coverAction === 'keep');
  const coverImageUri = coverAction === 'new' ? coverPreviewUri : coverAction === 'keep' ? profile.cover_url : null;
  const avatarImageUri = avatarAction === 'new' ? avatarPreviewUri : avatarAction === 'keep' ? profile.avatar_url : null;
  const initials = getInitials(displayName || getDisplayName(profile));

  return (
    <View style={styles.screen}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('mob.common.back')}
        >
          <BackArrowIcon size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('mob.profile.edit_profile')}</Text>
      </View>

      <KeyboardAwareScreen contentContainerStyle={styles.scrollContent}>
        {saveError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        ) : null}

        {/* Card 1: Cover image */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{t('mob.profile.cover_image')}</Text>
            <Text style={styles.cardSubtitleMuted}>{t('mob.profile.cover_only_you')}</Text>
          </View>

          <View style={styles.coverPreviewContainer}>
            {coverImageUri ? (
              <Image source={{ uri: coverImageUri }} style={styles.coverPreviewImage} resizeMode="cover" />
            ) : (
              <View style={styles.coverFallback}>
                <BannerBackground width="100%" height="100%" />
              </View>
            )}

            <View style={styles.coverBadge}>
              <Text style={styles.coverBadgeText}>
                {isDefaultCover ? t('mob.profile.default_banner') : t('mob.profile.custom_cover')}
              </Text>
            </View>
          </View>

          <View style={styles.coverActionsRow}>
            <Pressable
              style={styles.chooseImageButton}
              onPress={handleChooseCover}
              accessibilityRole="button"
              accessibilityLabel={t('mob.profile.choose_image')}
            >
              <CameraIcon size={16} color={colors.primary} />
              <Text style={styles.chooseImageText}>{t('mob.profile.choose_image')}</Text>
            </Pressable>

            <Pressable
              style={styles.useDefaultButton}
              onPress={handleUseDefaultCover}
              accessibilityRole="button"
              accessibilityLabel={t('mob.profile.use_default')}
            >
              <Text style={styles.useDefaultText}>{t('mob.profile.use_default')}</Text>
            </Pressable>
          </View>
        </View>

        {/* Card 2: Profile photo */}
        <View style={styles.card}>
          <View style={styles.photoRow}>
            <Pressable
              style={styles.avatarWrapper}
              onPress={handlePhotoPress}
              accessibilityRole="button"
              accessibilityLabel={t('mob.profile.change_photo')}
            >
              {avatarImageUri ? (
                <FastImage source={{ uri: avatarImageUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarInitials}>
                  <Text style={styles.avatarInitialsText}>{initials}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <CameraIcon size={12} color={colors.white} />
              </View>
            </Pressable>

            <View style={styles.photoTextCol}>
              <Text style={styles.cardTitle}>{t('mob.profile.profile_photo')}</Text>
              <Pressable
                onPress={handlePhotoPress}
                accessibilityRole="button"
                accessibilityLabel={t('mob.profile.change_photo')}
              >
                <Text style={styles.changePhotoLink}>{t('mob.profile.change_photo')}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Card 3: Inputs */}
        <View style={styles.card}>
          <View style={styles.inputFieldGroup}>
            <Text style={styles.inputLabel}>{t('mob.profile.display_name')}</Text>
            <TextInput
              style={styles.textInput}
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={100}
              placeholder={t('mob.profile.display_name')}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputFieldGroup}>
            <Text style={styles.inputLabel}>{t('mob.profile.nickname_label')}</Text>
            <View style={styles.disabledInput}>
              <Text style={styles.disabledInputText}>{profile.nickname}</Text>
            </View>
          </View>

          <View style={styles.inputFieldGroup}>
            <Text style={styles.inputLabel}>{t('mob.profile.mobile_optional')}</Text>
            <TextInput
              style={styles.textInput}
              value={mobileNumber}
              onChangeText={setMobileNumber}
              placeholder={t('mob.mobile_number.number_placeholder')}
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
            <Text style={styles.inputHelperText}>{t('mob.profile.mobile_visible_admins')}</Text>
          </View>
        </View>

        {/* Card 4: Skill levels */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, styles.skillsTitle]}>{t('mob.profile.skill_levels_title')}</Text>

          <View style={styles.skillsList}>
            {EDITABLE_SPORTS.map(sport => (
              <SkillRowItem
                key={sport}
                sport={sport}
                currentLevel={skillLevels[sport]}
                onSelectLevel={handleSelectSkillLevel}
              />
            ))}
          </View>
        </View>
      </KeyboardAwareScreen>

      {/* Sticky footer */}
      <View style={styles.footer}>
        <Pressable
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel={t('mob.common.cancel')}
        >
          <Text style={styles.cancelButtonText}>{t('mob.common.cancel')}</Text>
        </Pressable>

        <Pressable
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel={t('mob.common.save')}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>{t('mob.common.save')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 16,
  },
  cardSubtitleMuted: {
    ...typography.caption,
    color: colors.textMuted,
  },
  coverPreviewContainer: {
    height: 120,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    position: 'relative',
    marginBottom: spacing.md,
  },
  coverPreviewImage: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
  },
  coverBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.scrim,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  coverBadgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
  coverActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chooseImageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  chooseImageText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  useDefaultButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  useDefaultText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
    width: 72,
    height: 72,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarInitials: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.avatarTint1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.avatarTintText1,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTextCol: {
    flex: 1,
    gap: spacing.xs,
  },
  changePhotoLink: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  inputFieldGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  textInput: {
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  disabledInput: {
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  disabledInputText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  inputHelperText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  skillsTitle: {
    marginBottom: spacing.md,
  },
  skillsList: {
    gap: spacing.md,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skillLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  skillIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.avatarTint1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillSportName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 3,
  },
  segmentButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.textPrimary,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.white,
  },
});
