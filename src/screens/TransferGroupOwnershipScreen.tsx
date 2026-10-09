import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { getGroup, transferGroupOwnership } from '../api/groups';
import { parseOwnsGroupsError, requestDeletion } from '../api/profile';
import { useAuth } from '../auth/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';
import ErrorView from '../components/ErrorView';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import LoadingView from '../components/LoadingView';
import { CheckIcon, SearchIcon } from '../components/icons/ActionIcons';
import { useT } from '../labels/LabelsContext';
import type { ProfileStackParamList } from '../navigation/types';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { GroupMember } from '../types/group';
import { getApiErrorMessage } from '../utils/apiError';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TransferGroupOwnership'>;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  colors.avatarTint1,
  colors.avatarTint2,
  colors.avatarTint3,
  colors.avatarTint4,
  colors.avatarTint5,
];

const AVATAR_TEXT_COLORS = [
  colors.avatarTintText1,
  colors.avatarTintText2,
  colors.avatarTintText3,
  colors.avatarTintText4,
  colors.avatarTintText5,
];

export default function TransferGroupOwnershipScreen({ navigation, route }: Props): React.JSX.Element {
  const { groupId, groupName } = route.params;
  const { user } = useAuth();
  const t = useT();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const groupData = await getGroup(groupId);
      // Exclude current user from candidate new owners
      const candidates = groupData.members.filter(m => m.user_id !== user?.id);
      setMembers(candidates);
    } catch {
      setLoadError(t('mob.group_detail.load_error'));
    } finally {
      setIsLoading(false);
    }
  }, [groupId, user?.id, t]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const filteredMembers = members.filter(m => {
    if (!searchQuery.trim()) {
      return true;
    }
    const q = searchQuery.trim().toLowerCase();
    return m.nickname.toLowerCase().includes(q);
  });

  const selectedMember = members.find(m => m.user_id === selectedMemberId);

  const executeTransfer = async (targetMember: GroupMember): Promise<void> => {
    setTransferError(null);
    setIsTransferring(true);
    try {
      await withCorrelationId(async correlationId => {
        await transferGroupOwnership(groupId, targetMember.user_id, { correlationId });
      });
    } catch (e) {
      setTransferError(getApiErrorMessage(e, t('mob.group_transfer.error')));
      setIsTransferring(false);
      return;
    }

    try {
      await withCorrelationId(async deletionCorrelationId => {
        await requestDeletion({ correlationId: deletionCorrelationId });
      });
      navigation.navigate('AccountDeletionCode');
    } catch (err: unknown) {
      const remainingGroups = parseOwnsGroupsError(err);
      if (remainingGroups && remainingGroups.length > 0) {
        navigation.navigate('AccountDeletionBlocked', { groups: remainingGroups });
        return;
      }
      navigation.navigate('AccountDeletionBlocked', {
        notice: getApiErrorMessage(err, t('mob.account_delete.error')),
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const handleConfirmPress = (): void => {
    if (!selectedMember) {
      return;
    }
    Alert.alert(
      t('mob.group_transfer.confirm_prompt', { name: selectedMember.nickname }),
      t('mob.group_transfer.confirm_message'),
      [
        { text: t('mob.common.cancel'), style: 'cancel' },
        {
          text: t('mob.group_transfer.confirm_button'),
          onPress: () => executeTransfer(selectedMember),
        },
      ],
    );
  };

  if (isLoading) {
    return <LoadingView />;
  }

  if (loadError) {
    return <ErrorView message={loadError} onRetry={loadMembers} />;
  }

  const groupInitials = getInitials(groupName);

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <View style={styles.groupHeaderRow}>
        <View style={styles.groupAvatar}>
          <Text style={styles.groupAvatarText}>{groupInitials}</Text>
        </View>
        <View style={styles.groupHeaderInfo}>
          <Text style={styles.groupHeaderName} numberOfLines={1}>
            {groupName}
          </Text>
          <Text style={styles.groupHeaderSubtitle}>{t('mob.group_transfer.choose_owner')}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <SearchIcon size={18} color={colors.textMuted} />
        <TextInput
          placeholder={t('mob.group_transfer.search_placeholder')}
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {transferError ? <Text style={styles.errorText}>{transferError}</Text> : null}

      {members.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t('mob.group_transfer.empty_members')}</Text>
        </Card>
      ) : (
        <Card style={styles.memberCard}>
          {filteredMembers.map((member, index) => {
            const isSelected = member.user_id === selectedMemberId;
            const initials = getInitials(member.nickname);
            const colorIndex = index % AVATAR_COLORS.length;
            const avatarBg = AVATAR_COLORS[colorIndex];
            const avatarTextColor = AVATAR_TEXT_COLORS[colorIndex];

            return (
              <Pressable
                key={member.user_id}
                style={[
                  styles.memberRow,
                  isSelected && styles.memberRowSelected,
                  index < filteredMembers.length - 1 && styles.memberRowDivider,
                ]}
                onPress={() => setSelectedMemberId(member.user_id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <View style={[styles.avatarTile, { backgroundColor: avatarBg }]}>
                  <Text style={[styles.avatarInitial, { color: avatarTextColor }]}>{initials}</Text>
                </View>

                <View style={styles.memberInfo}>
                  <Text style={styles.memberNickname}>{member.nickname}</Text>
                  <Text style={styles.memberHandle}>@{member.nickname.toLowerCase()}</Text>
                </View>

                <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                  {isSelected ? <CheckIcon size={14} color={colors.white} /> : null}
                </View>
              </Pressable>
            );
          })}
        </Card>
      )}

      <View style={styles.noticeBanner}>
        <Text style={styles.noticeText}>
          {selectedMember
            ? t('mob.group_transfer.banner_info', { name: selectedMember.nickname })
            : t('mob.group_transfer.banner_info_generic')}
        </Text>
      </View>

      <View style={styles.footerSection}>
        <Button
          label={
            selectedMember
              ? t('mob.group_transfer.btn_transfer_to', { name: selectedMember.nickname })
              : t('mob.group_transfer.confirm_button')
          }
          variant="primary"
          onPress={handleConfirmPress}
          disabled={!selectedMemberId || isTransferring}
          loading={isTransferring}
          style={styles.confirmButton}
        />
      </View>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    flexGrow: 1,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  groupAvatarText: {
    ...typography.bodyBold,
    color: colors.white,
    fontSize: 16,
  },
  groupHeaderInfo: {
    flex: 1,
  },
  groupHeaderName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  groupHeaderSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  emptyCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  memberCard: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  memberRowSelected: {
    backgroundColor: colors.primaryLight,
  },
  memberRowDivider: {
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  avatarTile: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarInitial: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  memberInfo: {
    flex: 1,
  },
  memberNickname: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  memberHandle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: borderWidth.thick,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircleSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  noticeBanner: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeText: {
    ...typography.body,
    color: colors.primaryDark,
    fontSize: 13,
    lineHeight: 18,
  },
  footerSection: {
    marginTop: 'auto',
    paddingTop: spacing.md,
  },
  confirmButton: {
    width: '100%',
  },
});
