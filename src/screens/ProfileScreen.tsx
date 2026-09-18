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
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { withCorrelationId } from '../api/correlationId';
import {
  confirmDeletion,
  getProfile,
  requestDeletion,
  updateProfile,
  updateSkillLevel,
} from '../api/profile';
import Button from '../components/Button';
import Card from '../components/Card';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import TextField from '../components/TextField';
import TextLink from '../components/TextLink';
import { getDisplayName } from '../utils/displayName';
import { borderWidth, colors, radius, sizes, spacing, typography } from '../theme/tokens';
import type { SkillLevelValue, UserProfile } from '../types/user';
import type { ProfileStackParamList } from '../navigation/types';

const SKILL_LEVEL_OPTIONS: SkillLevelValue[] = ['Beginner', 'Intermediate', 'Expert'];

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

export default function ProfileScreen({ navigation }: Props): React.JSX.Element {
  const { signOut, updateUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  const [isEditingSkillLevel, setIsEditingSkillLevel] = useState(false);
  const [sportDraft, setSportDraft] = useState('');
  const [skillLevelDraft, setSkillLevelDraft] = useState<SkillLevelValue>('Beginner');
  const [isSavingSkillLevel, setIsSavingSkillLevel] = useState(false);
  const [skillLevelError, setSkillLevelError] = useState<string | null>(null);

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [isAwaitingConfirmationCode, setIsAwaitingConfirmationCode] = useState(false);
  const [confirmationCodeDraft, setConfirmationCodeDraft] = useState('');
  const [isConfirmingDeletion, setIsConfirmingDeletion] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);

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
    setSportDraft('');
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
    if (!sportDraft.trim()) {
      setSkillLevelError('Enter a sport.');
      return;
    }
    setSkillLevelError(null);
    setIsSavingSkillLevel(true);
    try {
      await withCorrelationId(async correlationId => {
        await updateSkillLevel(sportDraft.trim(), skillLevelDraft, { correlationId });
        setProfile(await getProfile({ correlationId }));
      });
      setIsEditingSkillLevel(false);
    } catch {
      setSkillLevelError('Could not save your skill level. Please try again.');
    } finally {
      setIsSavingSkillLevel(false);
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.header}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarPlaceholderText}>
              {getDisplayName(profile).charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

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

        {skillLevels.length === 0 ? (
          <Text style={styles.emptyText}>No skill levels declared yet.</Text>
        ) : (
          skillLevels.map(item => (
            <Pressable
              key={item.sport}
              style={styles.skillLevelRow}
              onPress={() => handleStartEditSkillLevel(item.sport, item.skill_level)}
              accessibilityRole="button"
            >
              <Text style={styles.skillLevelSport}>{item.sport}</Text>
              <Text style={styles.skillLevelValue}>{item.skill_level}</Text>
            </Pressable>
          ))
        )}

        {isEditingSkillLevel ? (
          <View style={styles.editRow}>
            <TextField
              style={styles.input}
              placeholder="Sport"
              value={sportDraft}
              onChangeText={setSportDraft}
              editable={!isSavingSkillLevel}
              autoCapitalize="none"
            />
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
  skillLevelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: sizes.controlSmall,
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
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
