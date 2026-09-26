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
 * - Skill level's "Beginner/Intermediate/Expert picker" is three
 *   selectable buttons, not a native picker component — no picker
 *   library is installed and this task didn't ask for one.
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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
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
import OptionChips from '../components/OptionChips';
import type { ChipOption } from '../components/OptionChips';
import TextField from '../components/TextField';
import TextLink from '../components/TextLink';
import { getApiErrorMessage } from '../utils/apiError';
import { getDisplayName } from '../utils/displayName';
import { useSportDisplayName } from '../utils/labels';
import { borderWidth, colors, radius, sizes, spacing, typography } from '../theme/tokens';
import type { SkillLevelValue, UserProfile } from '../types/user';
import type { Sport } from '../types/sport';
import type { ProfileStackParamList } from '../navigation/types';

const SKILL_LEVEL_OPTIONS: SkillLevelValue[] = ['Beginner', 'Intermediate', 'Expert'];

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

/**
 * `skillLevels.map(...)` can't call `useSportDisplayName` (BUG-M02) directly
 * — a hook call count that varies with the list's length, inside the same
 * component instance, violates the Rules of Hooks. Extracted into its own
 * component instead, one per row, same fix as `TournamentsScreen`'s
 * `TournamentRow`.
 *
 * Delete affordance (ADDENDUM-MOBILE-SKILL-DELETE-001) reuses this app's
 * existing destructive-action pattern verbatim — same as
 * `GroupDetailScreen`'s per-row "Remove" member action: a `TextLink`
 * `tone="destructive"` with a `loading` state, gated behind an
 * `Alert.alert` yes/no confirmation whose destructive button fires the
 * call. The confirmation is built here (not in the parent) because only
 * this row owns the resolved `sportLabel` from `useSportDisplayName`.
 */
function SkillLevelRow({
  sport,
  skillLevel,
  onPress,
  onDelete,
  isDeleting,
}: {
  sport: string;
  skillLevel: SkillLevelValue;
  onPress: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}): React.JSX.Element {
  const sportLabel = useSportDisplayName(sport);

  const handleDeletePress = (): void => {
    Alert.alert('Remove Skill Level', `Remove your ${sportLabel} skill level?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <View style={styles.skillLevelRow}>
      <Pressable style={styles.skillLevelInfo} onPress={onPress} accessibilityRole="button">
        <Text style={styles.skillLevelSport}>{sportLabel}</Text>
        <Text style={styles.skillLevelValue}>{skillLevel}</Text>
      </Pressable>
      <TextLink
        label="Remove"
        tone="destructive"
        onPress={handleDeletePress}
        loading={isDeleting}
        disabled={isDeleting}
        style={styles.skillLevelRemoveLink}
      />
    </View>
  );
}

export default function ProfileScreen({ navigation }: Props): React.JSX.Element {
  const { signOut, updateUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // BUG-M05: sport choices for the skill-level picker, reusing the same
  // `GET /admin/sports/public` source and `OptionChips` component as
  // `CreateGameScreen`. Secondary/non-blocking (same pattern as that
  // screen's Group picker) — a failure just leaves the picker empty; it
  // never blocks the rest of Profile from loading.
  const [sports, setSports] = useState<Sport[]>([]);

  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  const [isEditingSkillLevel, setIsEditingSkillLevel] = useState(false);
  const [sportDraft, setSportDraft] = useState<string | null>(null);
  const [skillLevelDraft, setSkillLevelDraft] = useState<SkillLevelValue>('Beginner');
  const [isSavingSkillLevel, setIsSavingSkillLevel] = useState(false);
  const [skillLevelError, setSkillLevelError] = useState<string | null>(null);

  const [deletingSkillLevelSport, setDeletingSkillLevelSport] = useState<string | null>(null);
  const [skillLevelDeleteError, setSkillLevelDeleteError] = useState<string | null>(null);

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
   * §10.4 step 1: Tap avatar → react-native-image-picker action sheet.
   * Presents a native action sheet with camera/gallery options. On selection,
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
      const result =
        source === 'camera'
          ? await launchCamera({ mediaType: 'photo', quality: 0.8 })
          : await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });

      if (result.didCancel || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.uri || !asset.fileName || !asset.type) {
        setAvatarError('Could not read the selected photo. Please try again.');
        return;
      }

      // §10.4 step 2: local preview (selected URI, pre-upload)
      setAvatarPreviewUri(asset.uri);
      setIsUploadingAvatar(true);

      // §10.4 step 3: POST /users/me/avatar multipart, same correlation-ID
      // threading already used throughout profile.ts
      await withCorrelationId(async correlationId => {
        await uploadAvatar(asset.uri!, asset.fileName!, asset.type!, { correlationId });
        // §10.4 step 4: re-fetch profile → getAvatarUrl() picks up the new
        // key → FastImage renders it (new key = cache miss = fresh fetch)
        const refreshed = await getProfile({ correlationId });
        setProfile(refreshed);
      });
      // Upload succeeded — clear the local preview; the profile's avatar_url
      // (via getAvatarUrl) now points to the new storage object.
      setAvatarPreviewUri(null);
    } catch (e) {
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

  const handleSaveDisplayName = async (): Promise<void> => {
    if (!displayNameDraft.trim()) {
      setDisplayNameError('Display name cannot be empty.');
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
    setSportDraft(null);
    setSkillLevelDraft('Beginner');
    setIsEditingSkillLevel(true);
  };

  const handleStartEditSkillLevel = (sport: string, skillLevel: SkillLevelValue): void => {
    setSkillLevelError(null);
    setSportDraft(sport);
    setSkillLevelDraft(skillLevel);
    setIsEditingSkillLevel(true);
  };

  const handleCancelEditSkillLevel = (): void => {
    setIsEditingSkillLevel(false);
    setSkillLevelError(null);
  };

  const handleSaveSkillLevel = async (): Promise<void> => {
    if (!sportDraft) {
      setSkillLevelError('Choose a sport.');
      return;
    }
    setSkillLevelError(null);
    setIsSavingSkillLevel(true);
    try {
      await withCorrelationId(async correlationId => {
        await updateSkillLevel(sportDraft, skillLevelDraft, { correlationId });
        setProfile(await getProfile({ correlationId }));
      });
      setIsEditingSkillLevel(false);
    } catch {
      setSkillLevelError('Could not save your skill level. Please try again.');
    } finally {
      setIsSavingSkillLevel(false);
    }
  };

  /**
   * ADDENDUM-MOBILE-SKILL-DELETE-001 §4: on 409 (active tournament
   * registration guard), the backend's message is shown verbatim via
   * `getApiErrorMessage` — not swallowed into a generic string — and the
   * entry stays in the list (no optimistic removal). On success, re-fetch
   * via `getProfile()`/`getSkillLevels()`, same refresh pattern already
   * used by Add/Modify above.
   */
  const handleDeleteSkillLevel = async (sport: string): Promise<void> => {
    setSkillLevelDeleteError(null);
    setDeletingSkillLevelSport(sport);
    try {
      await withCorrelationId(async correlationId => {
        await deleteSkillLevel(sport, { correlationId });
        setProfile(await getProfile({ correlationId }));
      });
    } catch (e) {
      setSkillLevelDeleteError(
        getApiErrorMessage(e, 'Could not remove this skill level. Please try again.'),
      );
    } finally {
      setDeletingSkillLevelSport(null);
    }
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
  const sportOptions: ChipOption<string>[] = sports.map(item => ({
    value: item.name,
    label: item.display_name,
  }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.header}>
        <Pressable
          onPress={handleAvatarPress}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          disabled={isUploadingAvatar || isRemovingAvatar}
        >
          {avatarPreviewUri ? (
            <View>
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
            <View>
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
        </Pressable>

        {avatarError ? <Text style={styles.errorText}>{avatarError}</Text> : null}

        {isEditingDisplayName ? (
          <View style={styles.editRow}>
            <TextField
              style={styles.input}
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
          <Text style={styles.sectionTitle}>Skill Levels</Text>
          {!isEditingSkillLevel ? (
            <TextLink label="Add" onPress={handleStartAddSkillLevel} />
          ) : null}
        </View>

        {skillLevelDeleteError ? (
          <Text style={styles.errorText}>{skillLevelDeleteError}</Text>
        ) : null}

        {skillLevels.length === 0 ? (
          <Text style={styles.emptyText}>No skill levels declared yet.</Text>
        ) : (
          skillLevels.map(item => (
            <SkillLevelRow
              key={item.sport}
              sport={item.sport}
              skillLevel={item.skill_level}
              onPress={() => handleStartEditSkillLevel(item.sport, item.skill_level)}
              onDelete={() => handleDeleteSkillLevel(item.sport)}
              isDeleting={deletingSkillLevelSport === item.sport}
            />
          ))
        )}

        {isEditingSkillLevel ? (
          <View style={styles.editRow}>
            {sportOptions.length === 0 ? (
              <Text style={styles.hint}>No sports are available right now.</Text>
            ) : (
              <OptionChips
                options={sportOptions}
                value={sportDraft}
                onChange={setSportDraft}
                disabled={isSavingSkillLevel}
              />
            )}
            <View style={styles.skillLevelPickerRow}>
              {SKILL_LEVEL_OPTIONS.map(option => (
                <Pressable
                  key={option}
                  style={[
                    styles.skillLevelOption,
                    skillLevelDraft === option && styles.skillLevelOptionSelected,
                  ]}
                  onPress={() => setSkillLevelDraft(option)}
                  disabled={isSavingSkillLevel}
                >
                  <Text
                    style={[
                      styles.skillLevelOptionText,
                      skillLevelDraft === option && styles.skillLevelOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
            {skillLevelError ? <Text style={styles.errorText}>{skillLevelError}</Text> : null}
            <View style={styles.editActionsRow}>
              <Button
                label="Save"
                size="sm"
                onPress={handleSaveSkillLevel}
                loading={isSavingSkillLevel}
                style={styles.actionSpacing}
              />
              <Button
                label="Cancel"
                size="sm"
                variant="secondary"
                onPress={handleCancelEditSkillLevel}
                disabled={isSavingSkillLevel}
              />
            </View>
          </View>
        ) : null}
      </Card>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  header: { alignItems: 'center', marginBottom: spacing.md },
  avatar: {
    width: sizes.avatar,
    height: sizes.avatar,
    borderRadius: radius.full,
    marginBottom: spacing.md,
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
  skillLevelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: sizes.controlSmall,
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  skillLevelInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skillLevelRemoveLink: { marginLeft: spacing.sm },
  skillLevelSport: { ...typography.body, color: colors.textPrimary },
  skillLevelValue: { ...typography.bodyBold, color: colors.textSecondary },
  skillLevelPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  skillLevelOption: {
    minHeight: sizes.controlSmall,
    justifyContent: 'center',
    borderWidth: borderWidth.thin,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  skillLevelOptionSelected: { backgroundColor: colors.primary },
  skillLevelOptionText: { ...typography.bodyBold, color: colors.primary },
  skillLevelOptionTextSelected: { color: colors.white },
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
