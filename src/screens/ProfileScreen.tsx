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
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { withCorrelationId } from '../api/correlationId';
import {
  confirmDeletion,
  getProfile,
  requestDeletion,
  updateProfile,
  updateSkillLevel,
} from '../api/profile';
import type { SkillLevelValue, UserProfile } from '../types/user';

const SKILL_LEVEL_OPTIONS: SkillLevelValue[] = ['Beginner', 'Intermediate', 'Expert'];

export default function ProfileScreen(): React.JSX.Element {
  const { signOut } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

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

  const handleStartEditNickname = (): void => {
    if (!profile) {
      return;
    }
    setNicknameError(null);
    setNicknameDraft(profile.nickname);
    setIsEditingNickname(true);
  };

  const handleCancelEditNickname = (): void => {
    setIsEditingNickname(false);
    setNicknameError(null);
  };

  const handleSaveNickname = async (): Promise<void> => {
    if (!nicknameDraft.trim()) {
      setNicknameError('Nickname cannot be empty.');
      return;
    }
    setNicknameError(null);
    setIsSavingNickname(true);
    try {
      await withCorrelationId(async correlationId => {
        await updateProfile({ nickname: nicknameDraft.trim() }, { correlationId });
        setProfile(await getProfile({ correlationId }));
      });
      setIsEditingNickname(false);
    } catch {
      setNicknameError('Could not save your nickname. Please try again.');
    } finally {
      setIsSavingNickname(false);
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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (loadError || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError ?? 'Profile not found.'}</Text>
        <Pressable style={styles.retryButton} onPress={loadProfile}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
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
      <View style={styles.header}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarPlaceholderText}>
              {profile.nickname.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {isEditingNickname ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.nicknameInput}
              value={nicknameDraft}
              onChangeText={setNicknameDraft}
              editable={!isSavingNickname}
              autoFocus
            />
            {nicknameError ? <Text style={styles.errorText}>{nicknameError}</Text> : null}
            <View style={styles.editActionsRow}>
              <Pressable
                style={[styles.smallButton, isSavingNickname && styles.buttonDisabled]}
                onPress={handleSaveNickname}
                disabled={isSavingNickname}
              >
                {isSavingNickname ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.smallButtonText}>Save</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.smallButtonSecondary, isSavingNickname && styles.buttonDisabled]}
                onPress={handleCancelEditNickname}
                disabled={isSavingNickname}
              >
                <Text style={styles.smallButtonSecondaryText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.nicknameRow}>
            <Text style={styles.nickname}>{profile.nickname}</Text>
            <Pressable onPress={handleStartEditNickname}>
              <Text style={styles.editLink}>Edit</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.email}>{profile.email}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Skill Levels</Text>
          {!isEditingSkillLevel ? (
            <Pressable onPress={handleStartAddSkillLevel}>
              <Text style={styles.editLink}>Add</Text>
            </Pressable>
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
            >
              <Text style={styles.skillLevelSport}>{item.sport}</Text>
              <Text style={styles.skillLevelValue}>{item.skill_level}</Text>
            </Pressable>
          ))
        )}

        {isEditingSkillLevel ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.nicknameInput}
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
              <Pressable
                style={[styles.smallButton, isSavingSkillLevel && styles.buttonDisabled]}
                onPress={handleSaveSkillLevel}
                disabled={isSavingSkillLevel}
              >
                {isSavingSkillLevel ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.smallButtonText}>Save</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.smallButtonSecondary, isSavingSkillLevel && styles.buttonDisabled]}
                onPress={handleCancelEditSkillLevel}
                disabled={isSavingSkillLevel}
              >
                <Text style={styles.smallButtonSecondaryText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {signOutError ? <Text style={styles.errorText}>{signOutError}</Text> : null}

      <Pressable
        style={[styles.signOutButton, isSigningOut && styles.buttonDisabled]}
        onPress={handleSignOut}
        disabled={isSigningOut}
      >
        {isSigningOut ? (
          <ActivityIndicator color="#2563eb" />
        ) : (
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        )}
      </Pressable>

      <View style={styles.dangerZone}>
        {deletionError ? <Text style={styles.errorText}>{deletionError}</Text> : null}

        {isAwaitingConfirmationCode ? (
          <View style={styles.editRow}>
            <Text style={styles.dangerZoneText}>
              Enter the confirmation code sent to your email to proceed.
            </Text>
            <TextInput
              style={styles.nicknameInput}
              placeholder="Confirmation code"
              value={confirmationCodeDraft}
              onChangeText={setConfirmationCodeDraft}
              editable={!isConfirmingDeletion}
              autoCapitalize="none"
            />
            <View style={styles.editActionsRow}>
              <Pressable
                style={[styles.deleteButton, isConfirmingDeletion && styles.buttonDisabled]}
                onPress={handleConfirmDeletion}
                disabled={isConfirmingDeletion}
              >
                {isConfirmingDeletion ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.smallButtonText}>Confirm Deletion</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.smallButtonSecondary, isConfirmingDeletion && styles.buttonDisabled]}
                onPress={handleCancelDeletionCode}
                disabled={isConfirmingDeletion}
              >
                <Text style={styles.smallButtonSecondaryText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            style={[styles.deleteButton, isRequestingDeletion && styles.buttonDisabled]}
            onPress={handleDeleteAccountPress}
            disabled={isRequestingDeletion}
          >
            {isRequestingDeletion ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.smallButtonText}>Delete Account</Text>
            )}
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 12 },
  avatarPlaceholder: {
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  nicknameRow: { flexDirection: 'row', alignItems: 'center' },
  nickname: { fontSize: 20, fontWeight: '700', marginRight: 8 },
  email: { fontSize: 14, color: '#666', marginTop: 4 },
  editLink: { color: '#2563eb', fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  emptyText: { fontSize: 14, color: '#666' },
  skillLevelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  skillLevelSport: { fontSize: 15, color: '#222' },
  skillLevelValue: { fontSize: 15, color: '#555', fontWeight: '600' },
  skillLevelPickerRow: { flexDirection: 'row', marginTop: 8, marginBottom: 4 },
  skillLevelOption: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  skillLevelOptionSelected: { backgroundColor: '#2563eb' },
  skillLevelOptionText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  skillLevelOptionTextSelected: { color: '#fff' },
  editRow: { marginTop: 8, width: '100%' },
  nicknameInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    fontSize: 15,
  },
  editActionsRow: { flexDirection: 'row', marginTop: 4 },
  smallButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  smallButtonSecondary: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonSecondaryText: { color: '#555', fontWeight: '600', fontSize: 14 },
  buttonDisabled: { opacity: 0.6 },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 32,
  },
  signOutButtonText: { color: '#2563eb', fontWeight: '600', fontSize: 16 },
  dangerZone: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 16 },
  dangerZoneText: { fontSize: 14, color: '#444', marginBottom: 8 },
  deleteButton: {
    backgroundColor: '#c0392b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  errorText: { fontSize: 14, color: '#c0392b', marginBottom: 8, textAlign: 'center' },
  retryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
});
