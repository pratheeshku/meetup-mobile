/**
 * Profile screen (DES-MEETUP-MOBILE.md §4.13, §7.2; R-124).
 *
 * Doubles as the Settings surface per this task's Step 5 — no separate
 * Settings screen/tab exists; the Profile tab is it.
 *
 * Implementation notes (see Implementation Report for full rationale):
 * - The account-deletion "Step 2" code-entry UI is a plain inline
 *   TextInput + button on this screen, not a second native `Alert`.
 *   `Alert.prompt` (the only RN `Alert` API with a text field) is
 *   iOS-only and this app is Android-only (CLAUDE.md) — Android's
 *   `Alert.alert` has no text-input capability at all. Step 1 (a plain
 *   yes/no confirmation) uses `Alert.alert` exactly as specified.
 * - Skill levels ("My sports"): read-only rows; tapping one opens a bottom
 *   sheet for that sport (segmented level control, Save, Remove). "Add sport"
 *   opens the shared sport-picker -> level-card flow in a sheet. Components
 *   live in `components/skills/`; no picker library is involved.
 * - Errors are shown inline (this screen has no navigation back-stack
 *   concept to redirect through) rather than via `Alert`, except the
 *   deletion confirmation dialog itself which the brief explicitly asks
 *   to be an `Alert`.
 *
 * Push-notifications task (§4.8, R-076): now nested inside its own
 * `ProfileStack` (`RootNavigator.tsx`) rather than sitting directly on the
 * tab bar, so it can push `NotificationPreferencesScreen` — this screen's
 * "no navigation back-stack concept" note above predates that change and
 * now only describes this screen's own error-handling style, not its
 * navigation context.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import ImageCropPicker from 'react-native-image-crop-picker';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { withCorrelationId } from '../api/correlationId';
import {
  confirmDeletion,
  deleteAvatar,
  deleteSkillLevel,
  getProfile,
  requestDeletion,
  updateProfile,
  updateSkillLevel,
  uploadAvatar,
} from '../api/profile';
import { getSports } from '../api/sports';
import Button from '../components/Button';
import Card from '../components/Card';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import MySportRow from '../components/skills/MySportRow';
import BottomSheet from '../components/skills/BottomSheet';
import SkillLevelFlow from '../components/skills/SkillLevelFlow';
import type { SkillLevelMap } from '../components/skills/SkillLevelFlow';
import SportLevelSheet from '../components/skills/SportLevelSheet';
import TextField from '../components/TextField';
import TextLink from '../components/TextLink';
import appConfig from '../../config/appConfig.json';
import { getApiErrorMessage } from '../utils/apiError';
import { toHttpsUrl } from '../utils/httpsUrl';
import { openLink } from '../utils/openLink';
import { toSupportLink } from '../utils/supportLink';
import MobileNumberCard from '../components/MobileNumberCard';
import { getDisplayName } from '../utils/displayName';
import { getLabel, useLabels } from '../labels/LabelsContext';
import { useFieldChain } from '../hooks/useFieldChain';
import { borderWidth, colors, radius, shadows, sizes, spacing, typography } from '../theme/tokens';
import type { SkillLevelValue, UserProfile } from '../types/user';
import type { Sport } from '../types/sport';
import type { ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

export default function ProfileScreen({ navigation }: Props): React.JSX.Element {
  const { signOut, updateUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const labels = useLabels();

  // BUG-M05: sport choices for "Add sport", from the same
  // `GET /admin/sports/public` source as `CreateGameScreen`.
  // Secondary/non-blocking (same pattern as that screen's Group picker) — a
  // failure just leaves the picker empty; it never blocks the rest of
  // Profile from loading.
  const [sports, setSports] = useState<Sport[]>([]);

  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  // Skill-level sheets: edit one sport (`editingSkill`) or add sports.
  // `skillLevelError` is shown inside whichever sheet is open — for a delete
  // blocked by an active tournament registration (409) it is the backend's
  // own message, verbatim.
  const [editingSkill, setEditingSkill] = useState<{ sport: string; level: SkillLevelValue } | null>(
    null,
  );
  const [isAddingSport, setIsAddingSport] = useState(false);
  const [isSavingSkillLevel, setIsSavingSkillLevel] = useState(false);
  const [isDeletingSkillLevel, setIsDeletingSkillLevel] = useState(false);
  const [skillLevelError, setSkillLevelError] = useState<string | null>(null);

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [isAwaitingConfirmationCode, setIsAwaitingConfirmationCode] = useState(false);
  const [confirmationCodeDraft, setConfirmationCodeDraft] = useState('');
  const [isConfirmingDeletion, setIsConfirmingDeletion] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);

  // Avatar upload/remove state (DES-MEETUP-ADDENDUM-profile-photo §10.4).
  // `avatarPreviewUri` holds a local file URI for immediate visual feedback
  // while the upload is in progress — reverted on failure (§10.4 step 5).
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  /**
   * §10.4 step 1: Tap avatar → camera/gallery action sheet.
   * Opens react-native-image-crop-picker with cropping enabled (pinch-zoom,
   * reposition, square aspect ratio, rotation). On crop confirmation,
   * shows a local preview and fires the multipart upload.
   */
  const handleAvatarPress = (): void => {
    if (isUploadingAvatar || isRemovingAvatar) {
      return;
    }

    // If there's already an avatar, offer change or remove options
    if (profile?.avatar_url) {
      Alert.alert('Profile Photo', undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take Photo',
          onPress: () => pickImage('camera'),
        },
        {
          text: 'Choose from Library',
          onPress: () => pickImage('library'),
        },
        {
          text: 'Remove Photo',
          style: 'destructive',
          onPress: handleRemoveAvatar,
        },
      ]);
    } else {
      Alert.alert('Profile Photo', undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take Photo',
          onPress: () => pickImage('camera'),
        },
        {
          text: 'Choose from Library',
          onPress: () => pickImage('library'),
        },
      ]);
    }
  };

  const pickImage = async (source: 'camera' | 'library'): Promise<void> => {
    setAvatarError(null);
    try {
      const cropOptions = {
        mediaType: 'photo' as const,
        cropping: true,
        width: 500,
        height: 500,
        compressImageQuality: 0.8,
        // iOS only (ignored on Android): HEIC must never reach the backend.
        forceJpg: true,
        cropperToolbarTitle: 'Edit Photo',
        hideBottomControls: false,
        enableRotationGesture: true,
        cropperRotateButtonsHidden: false,
      };

      const image =
        source === 'camera'
          ? await ImageCropPicker.openCamera(cropOptions)
          : await ImageCropPicker.openPicker(cropOptions);

      if (!image || !image.path) {
        return;
      }

      const fileName =
        image.filename || image.path.split('/').pop() || 'avatar.jpg';
      const fileType = image.mime || 'image/jpeg';

      // §10.4 step 2: local preview (selected URI, pre-upload)
      setAvatarPreviewUri(image.path);
      setIsUploadingAvatar(true);

      // §10.4 step 3: POST /users/me/avatar multipart, same correlation-ID
      // threading already used throughout profile.ts
      await withCorrelationId(async correlationId => {
        await uploadAvatar(image.path, fileName, fileType, { correlationId });
        // §10.4 step 4: re-fetch profile → getAvatarUrl() picks up the new
        // key → FastImage renders it (new key = cache miss = fresh fetch)
        const refreshed = await getProfile({ correlationId });
        setProfile(refreshed);
      });
      // Upload succeeded — clear the local preview; the profile's avatar_url
      // (via getAvatarUrl) now points to the new storage object.
      setAvatarPreviewUri(null);
    } catch (e: any) {
      // User cancelled photo selection or cropping — do nothing
      if (
        e?.code === 'E_PICKER_CANCELLED' ||
        e?.message?.toLowerCase().includes('cancel')
      ) {
        return;
      }

      // §10.4 step 5: on failure, revert preview, reuse the existing
      // getApiErrorMessage pattern already established for the skill-level 409
      setAvatarPreviewUri(null);
      setAvatarError(
        getApiErrorMessage(e, 'Could not upload your photo. Please try again.'),
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  /**
   * DELETE /users/me/avatar → avatar_url → null → existing placeholder
   * renders. Same shape as the upload flow (§10.4).
   */
  const handleRemoveAvatar = async (): Promise<void> => {
    setAvatarError(null);
    setIsRemovingAvatar(true);
    try {
      await withCorrelationId(async correlationId => {
        await deleteAvatar({ correlationId });
        const refreshed = await getProfile({ correlationId });
        setProfile(refreshed);
      });
    } catch (e) {
      setAvatarError(
        getApiErrorMessage(e, 'Could not remove your photo. Please try again.'),
      );
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getProfile();
      setProfile(data);
    } catch {
      setLoadError('Could not load your profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    getSports().then(setSports, () => setSports([]));
  }, [loadProfile]);

  const handleStartEditDisplayName = (): void => {
    if (!profile) {
      return;
    }
    setDisplayNameError(null);
    setDisplayNameDraft(getDisplayName(profile));
    setIsEditingDisplayName(true);
  };

  const handleCancelEditDisplayName = (): void => {
    setIsEditingDisplayName(false);
    setDisplayNameError(null);
  };

  const nameChain = useFieldChain(['displayName']);
  const deletionChain = useFieldChain(['confirmationCode']);

  const handleSaveDisplayName = async (): Promise<void> => {
    if (!displayNameDraft.trim()) {
      setDisplayNameError('Display name cannot be empty.');
      nameChain.focus('displayName');
      return;
    }
    setDisplayNameError(null);
    setIsSavingDisplayName(true);
    try {
      await withCorrelationId(async correlationId => {
        await updateProfile({ display_name: displayNameDraft.trim() }, { correlationId });
        const refreshed = await getProfile({ correlationId });
        setProfile(refreshed);
        // Keep the auth user (Home greeting) in step with what was saved.
        updateUser({ display_name: refreshed.display_name });
      });
      setIsEditingDisplayName(false);
    } catch {
      setDisplayNameError('Could not save your display name. Please try again.');
    } finally {
      setIsSavingDisplayName(false);
    }
  };

  const handleStartAddSkillLevel = (): void => {
    setSkillLevelError(null);
    setIsAddingSport(true);
  };

  const handleStartEditSkillLevel = (sport: string, skillLevel: SkillLevelValue): void => {
    setSkillLevelError(null);
    setEditingSkill({ sport, level: skillLevel });
  };

  const handleCloseSkillLevelSheet = (): void => {
    setEditingSkill(null);
    setIsAddingSport(false);
    setSkillLevelError(null);
  };

  /** Saves the given levels (one PUT each), re-fetches, then closes the open sheet. */
  const handleSaveSkillLevels = async (levels: SkillLevelMap): Promise<void> => {
    setSkillLevelError(null);
    setIsSavingSkillLevel(true);
    try {
      await withCorrelationId(async correlationId => {
        for (const [sport, level] of Object.entries(levels)) {
          await updateSkillLevel(sport, level, { correlationId });
        }
        setProfile(await getProfile({ correlationId }));
      });
      handleCloseSkillLevelSheet();
    } catch {
      setSkillLevelError('Could not save your skill level. Please try again.');
    } finally {
      setIsSavingSkillLevel(false);
    }
  };

  /**
   * ADDENDUM-MOBILE-SKILL-DELETE-001 §4: on 409 (active tournament
   * registration guard), the backend's message is shown verbatim via
   * `getApiErrorMessage` — not swallowed into a generic string — inside the
   * edit sheet, and the entry stays in the list (no optimistic removal). On
   * success, re-fetch via `getProfile()`/`getSkillLevels()`, same refresh
   * pattern as Add/Modify above, and close the sheet.
   */
  const handleDeleteSkillLevel = async (sport: string): Promise<void> => {
    setSkillLevelError(null);
    setIsDeletingSkillLevel(true);
    try {
      await withCorrelationId(async correlationId => {
        await deleteSkillLevel(sport, { correlationId });
        setProfile(await getProfile({ correlationId }));
      });
      handleCloseSkillLevelSheet();
    } catch (e) {
      setSkillLevelError(
        getApiErrorMessage(e, 'Could not remove this skill level. Please try again.'),
      );
    } finally {
      setIsDeletingSkillLevel(false);
    }
  };

  /** Same yes/no confirmation the old per-row Remove link used. */
  const handleDeleteSkillLevelPress = (sport: string, sportLabel: string): void => {
    Alert.alert('Remove Skill Level', `Remove your ${sportLabel} skill level?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => handleDeleteSkillLevel(sport) },
    ]);
  };

  const handleSignOut = async (): Promise<void> => {
    setSignOutError(null);
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      setSignOutError('Could not sign out. Please try again.');
      setIsSigningOut(false);
    }
  };

  const handleRequestDeletion = async (): Promise<void> => {
    setDeletionError(null);
    setIsRequestingDeletion(true);
    try {
      await requestDeletion();
      setIsAwaitingConfirmationCode(true);
    } catch {
      // §4.13: admin self-deletion is rejected server-side with an
      // explicit error — surfaced generically here since the backend
      // owns the actual reason (server is the sole authority, §5.3).
      setDeletionError('Could not start account deletion. Please try again.');
    } finally {
      setIsRequestingDeletion(false);
    }
  };

  // Report form, privacy policy, support contact (DES-MEETUP-ADDENDUM-IOS-App.md
  // §7, §11): each row is hidden unless its configured value is valid.
  const reportFormUrl = toHttpsUrl(appConfig.reportFormUrl);

  const privacyPolicyUrl = toHttpsUrl(appConfig.privacyPolicyUrl);
  const termsOfUseUrl = toHttpsUrl(appConfig.termsOfUseUrl);
  const supportLink = toSupportLink(appConfig.supportContact);

  const handleDeleteAccountPress = (): void => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleRequestDeletion },
      ],
    );
  };

  const handleCancelDeletionCode = (): void => {
    setIsAwaitingConfirmationCode(false);
    setConfirmationCodeDraft('');
    setDeletionError(null);
  };

  const handleConfirmDeletion = async (): Promise<void> => {
    if (!confirmationCodeDraft.trim()) {
      setDeletionError('Enter the confirmation code.');
      deletionChain.focus('confirmationCode');
      return;
    }
    setDeletionError(null);
    setIsConfirmingDeletion(true);
    try {
      await confirmDeletion(confirmationCodeDraft.trim());
      await signOut();
    } catch {
      // Enumeration-safe per §4.13 ("expired/consumed confirmation
      // token") — never distinguish "wrong code" from "expired code".
      setDeletionError('Invalid or expired confirmation code. Please try again.');
      setIsConfirmingDeletion(false);
    }
  };

  if (isLoading) {
    return <LoadingView />;
  }

  if (loadError || !profile) {
    return <ErrorView message={loadError ?? 'Profile not found.'} onRetry={loadProfile} />;
  }

  // `skill_levels` is optional on the canonical `UserProfile` type (it's
  // only present in this module's original shape, pre-consolidation —
  // see docs/reports/IMPL-DES-MEETUP-MOBILE-types-consolidation.md).
  // Treated as empty when absent; no behavioral change versus before the
  // consolidation, since the actual `GET /users/me` response always
  // includes it in practice (Proposed Assumption, unchanged).
  const skillLevels = profile.skill_levels ?? [];
  const declaredSports = new Set(skillLevels.map(item => item.sport));
  const addableSports = sports.filter(item => !declaredSports.has(item.name));

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <Card style={styles.header}>
        <Pressable
          onPress={handleAvatarPress}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          disabled={isUploadingAvatar || isRemovingAvatar}
          style={styles.avatarContainer}
        >
          {avatarPreviewUri ? (
            <View style={styles.avatar}>
              <FastImage
                source={{ uri: avatarPreviewUri }}
                style={styles.avatar}
                resizeMode={FastImage.resizeMode.cover}
              />
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={colors.white} />
              </View>
            </View>
          ) : profile.avatar_url ? (
            <View style={styles.avatar}>
              <FastImage
                source={{ uri: profile.avatar_url, priority: FastImage.priority.normal }}
                style={styles.avatar}
                resizeMode={FastImage.resizeMode.cover}
              />
              {isRemovingAvatar ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color={colors.white} />
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>
                {getDisplayName(profile).charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View
            style={styles.avatarEditBadge}
            testID="avatar-edit-badge"
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill={colors.white}>
              <Path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zm8 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-2a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
            </Svg>
          </View>
        </Pressable>

        {avatarError ? <Text style={styles.errorText}>{avatarError}</Text> : null}

        {isEditingDisplayName ? (
          <View style={styles.editRow}>
            <TextField
              style={styles.input}
              {...nameChain.props('displayName')}
              value={displayNameDraft}
              onChangeText={setDisplayNameDraft}
              editable={!isSavingDisplayName}
              accessibilityLabel="Display name"
              placeholder="Display name"
              autoFocus
            />
            {displayNameError ? <Text style={styles.errorText}>{displayNameError}</Text> : null}
            <View style={styles.editActionsRow}>
              <Button
                label="Save"
                size="sm"
                onPress={handleSaveDisplayName}
                loading={isSavingDisplayName}
                style={styles.actionSpacing}
              />
              <Button
                label="Cancel"
                size="sm"
                variant="secondary"
                onPress={handleCancelEditDisplayName}
                disabled={isSavingDisplayName}
              />
            </View>
          </View>
        ) : (
          <View style={styles.displayNameRow}>
            <Text style={styles.displayName}>{getDisplayName(profile)}</Text>
            <TextLink label="Edit" onPress={handleStartEditDisplayName} />
          </View>
        )}

        <Text style={styles.nicknameLine}>
          Nickname: {profile.nickname} <Text style={styles.nicknameHint}>(can't be changed)</Text>
        </Text>

        <Text style={styles.email}>{profile.email}</Text>
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{getLabel(labels, 'mob_my_sports_title')}</Text>
          <TextLink label={getLabel(labels, 'mob_add_sport')} onPress={handleStartAddSkillLevel} />
        </View>

        {skillLevels.length === 0 ? (
          <Text style={styles.emptyText}>No skill levels declared yet.</Text>
        ) : (
          skillLevels.map(item => (
            <MySportRow
              key={item.sport}
              sport={item.sport}
              skillLevel={item.skill_level}
              onPress={() => handleStartEditSkillLevel(item.sport, item.skill_level)}
            />
          ))
        )}
      </Card>

      {editingSkill ? (
        <SportLevelSheet
          sport={editingSkill.sport}
          initialLevel={editingSkill.level}
          saving={isSavingSkillLevel}
          deleting={isDeletingSkillLevel}
          error={skillLevelError}
          saveLabel="Save"
          deleteLabel="Remove"
          closeLabel="Cancel"
          onSave={level => handleSaveSkillLevels({ [editingSkill.sport]: level })}
          onDelete={sportLabel => handleDeleteSkillLevelPress(editingSkill.sport, sportLabel)}
          onClose={handleCloseSkillLevelSheet}
        />
      ) : null}

      {isAddingSport ? (
        <BottomSheet onClose={handleCloseSkillLevelSheet} closeLabel="Cancel">
          {addableSports.length === 0 ? (
            <Text style={styles.hint}>No sports are available right now.</Text>
          ) : (
            <SkillLevelFlow
              sports={addableSports}
              saving={isSavingSkillLevel}
              error={skillLevelError}
              nextLabel="Next"
              backLabel="Back"
              saveLabel="Save"
              onSave={handleSaveSkillLevels}
            />
          )}
        </BottomSheet>
      ) : null}

      <MobileNumberCard
        storedNumber={profile.mobile_number}
        onSaved={mobileNumber =>
          setProfile(current => (current ? { ...current, mobile_number: mobileNumber } : current))
        }
      />

      <Button
        label="Notification Preferences"
        variant="secondary"
        onPress={() => navigation.navigate('NotificationPreferences')}
        style={styles.stackedButton}
      />

      {signOutError ? <Text style={styles.errorText}>{signOutError}</Text> : null}

      <Button
        label="Sign Out"
        variant="secondary"
        onPress={handleSignOut}
        loading={isSigningOut}
        style={styles.signOutButton}
      />

      {privacyPolicyUrl ? (
        <Button
          label="Privacy Policy"
          variant="secondary"
          onPress={() => openLink(privacyPolicyUrl, 'Could not open the page')}
          style={styles.stackedButton}
        />
      ) : null}

      {termsOfUseUrl ? (
        <Button
          label="Terms of Use"
          variant="secondary"
          onPress={() => openLink(termsOfUseUrl, 'Could not open the page')}
          style={styles.stackedButton}
        />
      ) : null}

      {supportLink ? (
        <Button
          label="Contact support"
          variant="secondary"
          onPress={() => openLink(supportLink, 'Could not open the link')}
          style={styles.stackedButton}
        />
      ) : null}

      {reportFormUrl ? (
        <Button
          label="Report a problem or content"
          variant="secondary"
          onPress={() => openLink(reportFormUrl, 'Could not open the form')}
          style={styles.stackedButton}
        />
      ) : null}

      <View style={styles.dangerZone}>
        {deletionError ? <Text style={styles.errorText}>{deletionError}</Text> : null}

        {isAwaitingConfirmationCode ? (
          <View style={styles.editRow}>
            <Text style={styles.dangerZoneText}>
              Enter the confirmation code sent to your email to proceed.
            </Text>
            <TextField
              style={styles.input}
              placeholder="Confirmation code"
              {...deletionChain.props('confirmationCode')}
              value={confirmationCodeDraft}
              onChangeText={setConfirmationCodeDraft}
              editable={!isConfirmingDeletion}
              autoCapitalize="none"
            />
            <View style={styles.editActionsRow}>
              <Button
                label="Confirm Deletion"
                size="sm"
                variant="destructive"
                onPress={handleConfirmDeletion}
                loading={isConfirmingDeletion}
                style={styles.actionSpacing}
              />
              <Button
                label="Cancel"
                size="sm"
                variant="secondary"
                onPress={handleCancelDeletionCode}
                disabled={isConfirmingDeletion}
              />
            </View>
          </View>
        ) : (
          <Button
            label="Delete Account"
            variant="destructive"
            onPress={handleDeleteAccountPress}
            loading={isRequestingDeletion}
          />
        )}
      </View>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  header: { alignItems: 'center', marginBottom: spacing.md },
  avatarContainer: {
    position: 'relative',
    width: sizes.avatar,
    height: sizes.avatar,
    marginBottom: spacing.md,
  },
  avatar: {
    width: sizes.avatar,
    height: sizes.avatar,
    borderRadius: radius.full,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: { ...typography.h1, color: colors.white },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: borderWidth.thick,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  displayNameRow: { flexDirection: 'row', alignItems: 'center' },
  displayName: { ...typography.h2, color: colors.textPrimary, marginRight: spacing.sm },
  nicknameLine: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  nicknameHint: { ...typography.caption, color: colors.textMuted },
  email: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  section: { marginBottom: spacing.md },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  emptyText: { ...typography.body, color: colors.textSecondary },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  editRow: { marginTop: spacing.sm, width: '100%' },
  input: { marginBottom: spacing.sm },
  editActionsRow: { flexDirection: 'row', marginTop: spacing.xs },
  actionSpacing: { marginRight: spacing.sm },
  stackedButton: { marginBottom: spacing.sm },
  signOutButton: { marginBottom: spacing.xl },
  dangerZone: {
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  dangerZoneText: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.sm },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
