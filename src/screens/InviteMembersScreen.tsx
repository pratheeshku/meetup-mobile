/**
 * Group creation, step 2: "Invite members" (DES-MEETUP-FEEDBACK-001 C4,
 * R-05 to R-08; design-ref-p23/CreateGroup2.png).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { inviteMember } from '../api/groups';
import { searchUsers } from '../api/users';
import { SearchIcon } from '../components/icons/ActionIcons';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import WizardFooter from '../components/WizardFooter';
import WizardHeader from '../components/WizardHeader';
import { useT } from '../labels/LabelsContext';
import { goToDashboard } from '../navigation/goToDashboard';
import type { GroupsStackParamList } from '../navigation/types';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { UserSearchResult } from '../types/user';

type Props = NativeStackScreenProps<GroupsStackParamList, 'InviteMembers'>;

const AVATAR_TINTS = [
  { bg: colors.avatarTint1, text: colors.avatarTintText1 },
  { bg: colors.avatarTint2, text: colors.avatarTintText2 },
  { bg: colors.avatarTint3, text: colors.avatarTintText3 },
  { bg: colors.avatarTint4, text: colors.avatarTintText4 },
  { bg: colors.avatarTint5, text: colors.avatarTintText5 },
];

function getAvatarTint(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return (name.trim().slice(0, 2) || '?').toUpperCase();
}

export default function InviteMembersScreen({ navigation, route }: Props): React.JSX.Element {
  const { groupId } = route.params;
  const t = useT();

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [added, setAdded] = useState<UserSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef(false);

  const loadUsers = useCallback(
    async (query: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await searchUsers({
          q: query,
          excludeGroupId: groupId,
        });
        setSuggestions(results);
      } catch {
        setError(t('mob.invite.load_error'));
      } finally {
        setIsLoading(false);
      }
    },
    [groupId, t],
  );

  useEffect(() => {
    loadUsers('');
  }, [loadUsers]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    loadUsers(text);
  };

  const handleAdd = async (user: UserSearchResult): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    try {
      await withCorrelationId(correlationId =>
        inviteMember(groupId, user.id, { correlationId }),
      );
      setAdded(current =>
        current.some(item => item.id === user.id) ? current : [...current, user],
      );
      setSuggestions(current => current.filter(item => item.id !== user.id));
    } catch {
      setError(t('mob.invite.add_error'));
    } finally {
      inFlight.current = false;
    }
  };

  const finish = (): void => {
    goToDashboard(t('mob.success.group_created'));
  };

  const displayedSuggestions = suggestions.filter(
    s => !added.some(a => a.id === s.id),
  );

  return (
    <View style={styles.screen}>
      <WizardHeader
        title={t('mob.invite.step_title')}
        currentStep={2}
        totalSteps={2}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAwareScreen
        contentContainerStyle={styles.content}
      >
        <View style={styles.searchContainer}>
          <SearchIcon size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('mob.create_game.search_players_placeholder')}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {added.length > 0 ? (
          <View style={styles.addedCard}>
            <View style={styles.addedHeader}>
              <Text style={styles.addedTitle}>{t('mob.create_game.review_header')}</Text>
              <View style={styles.addedPill}>
                <Text style={styles.addedPillText}>
                  {t('mob.invite.added_pill', { count: added.length })}
                </Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.addedRow}>
              {added.map(user => {
                const tint = getAvatarTint(user.display_name);
                const firstName = user.display_name.trim().split(/\s+/)[0];
                return (
                  <View key={user.id} style={styles.addedItem}>
                    <View style={[styles.avatarCircleLarge, { backgroundColor: tint.bg }]}>
                      <Text style={[styles.avatarTextLarge, { color: tint.text }]}>
                        {getInitials(user.display_name)}
                      </Text>
                    </View>
                    <Text style={styles.addedName} numberOfLines={1}>
                      {firstName}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <Text style={styles.sectionHeading}>{t('mob.invite.suggested_players_header')}</Text>

        <View style={styles.suggestedCard}>
          {isLoading && displayedSuggestions.length === 0 ? (
            <ActivityIndicator style={styles.loader} color={colors.primary} />
          ) : displayedSuggestions.length === 0 ? (
            <Text style={styles.emptyText}>{t('mob.invite.empty')}</Text>
          ) : (
            displayedSuggestions.map((user, idx) => {
              const tint = getAvatarTint(user.display_name);
              const isLast = idx === displayedSuggestions.length - 1;
              return (
                <View
                  key={user.id}
                  style={[styles.memberRow, !isLast && styles.memberRowBorder]}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: tint.bg }]}>
                    <Text style={[styles.avatarText, { color: tint.text }]}>
                      {getInitials(user.display_name)}
                    </Text>
                  </View>

                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {user.display_name}
                    </Text>
                    <Text style={styles.memberSubtitle} numberOfLines={1}>
                      @{user.nickname || user.display_name.toLowerCase().replace(/\s+/g, '')}
                      {user.shared_group ? ` · ${user.shared_group}` : ''}
                    </Text>
                  </View>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('mob.invite.card_a11y', { name: user.display_name })}
                    style={styles.addButton}
                    onPress={() => handleAdd(user)}
                  >
                    <Text style={styles.addButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.helperText}>{t('mob.invite.suggested_players_hint')}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </KeyboardAwareScreen>

      <WizardFooter
        nextLabel={t('mob.invite.create_group_button')}
        backLabel={t('mob.invite.skip_for_now')}
        onNext={finish}
        onBack={finish}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  addedCard: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  addedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addedTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  addedPill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  addedPillText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  addedRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  addedItem: {
    alignItems: 'center',
    width: 60,
  },
  avatarCircleLarge: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  avatarTextLarge: {
    ...typography.bodyBold,
  },
  addedName: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionHeading: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  suggestedCard: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  memberRowBorder: {
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.bodyBold,
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  memberName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  memberSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  loader: {
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.xl,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
