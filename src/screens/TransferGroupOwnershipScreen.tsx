import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { getGroup, transferGroupOwnership } from '../api/groups';
import { useAuth } from '../auth/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';
import ErrorView from '../components/ErrorView';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import LoadingView from '../components/LoadingView';
import TextField from '../components/TextField';
import { useT } from '../labels/LabelsContext';
import type { ProfileStackParamList } from '../navigation/types';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { GroupMember } from '../types/group';
import { getApiErrorMessage } from '../utils/apiError';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TransferGroupOwnership'>;

export default function TransferGroupOwnershipScreen({ navigation, route }: Props): React.JSX.Element {
  const { groupId, groupName, onTransferred } = route.params;
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
      if (onTransferred) {
        onTransferred(groupId);
      }
      navigation.goBack();
    } catch (e) {
      setTransferError(getApiErrorMessage(e, t('mob.group_transfer.error')));
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

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.heading}>{t('mob.group_transfer.title')}</Text>
        <Text style={styles.subheading}>
          {t('mob.group_transfer.subtitle', { name: groupName })}
        </Text>
        <Text style={styles.instructions}>{t('mob.group_transfer.select_member')}</Text>

        <TextField
          placeholder={t('mob.group_transfer.search_placeholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {transferError ? <Text style={styles.errorText}>{transferError}</Text> : null}

        {members.length === 0 ? (
          <Text style={styles.emptyText}>{t('mob.group_transfer.empty_members')}</Text>
        ) : (
          <View style={styles.memberList}>
            {filteredMembers.map(member => {
              const isSelected = member.user_id === selectedMemberId;

              return (
                <Pressable
                  key={member.user_id}
                  style={[styles.memberRow, isSelected && styles.memberRowSelected]}
                  onPress={() => setSelectedMemberId(member.user_id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.avatarTile}>
                    <Text style={styles.avatarInitial}>
                      {(member.nickname.charAt(0) || '?').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberNickname}>{member.nickname}</Text>
                    <Text style={styles.memberRole}>
                      {t(
                        member.role === 'admin'
                          ? 'mob.group_role.admin'
                          : 'mob.group_role.member',
                      )}
                    </Text>
                  </View>
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                    {isSelected ? <View style={styles.radioInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.actionsRow}>
          <Button
            label={t('mob.group_transfer.confirm_button')}
            variant="primary"
            onPress={handleConfirmPress}
            disabled={!selectedMemberId || isTransferring}
            loading={isTransferring}
            style={styles.confirmButton}
          />
          <Button
            label={t('mob.common.cancel')}
            variant="secondary"
            onPress={() => navigation.goBack()}
            disabled={isTransferring}
            style={styles.cancelButton}
          />
        </View>
      </Card>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  card: {
    padding: spacing.md,
  },
  heading: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subheading: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  instructions: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  searchInput: {
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  memberList: {
    marginBottom: spacing.lg,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
  },
  memberRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  avatarTile: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarInitial: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  memberInfo: {
    flex: 1,
  },
  memberNickname: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  memberRole: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: borderWidth.thick,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  actionsRow: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  confirmButton: {
    width: '100%',
  },
  cancelButton: {
    width: '100%',
  },
});
