import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { deleteGroup, getMyGroups } from '../api/groups';
import { requestDeletion, type OwnedGroupInfo } from '../api/profile';
import Button from '../components/Button';
import Card from '../components/Card';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import { WarningIcon } from '../components/icons/ActionIcons';
import { useT } from '../labels/LabelsContext';
import type { ProfileStackParamList } from '../navigation/types';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import { getApiErrorMessage } from '../utils/apiError';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AccountDeletionBlocked'>;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function AccountDeletionBlockedScreen({ navigation, route }: Props): React.JSX.Element {
  const t = useT();
  const [groups, setGroups] = useState<OwnedGroupInfo[]>(route.params.groups ?? []);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  const refreshOwnedGroups = useCallback(async () => {
    try {
      const res = await withCorrelationId(async correlationId => {
        return await getMyGroups({ enrich: true, correlationId });
      });
      const owned = res.items
        .filter(g => g.current_user_role === 'owner')
        .map(g => ({
          id: g.id,
          name: g.name,
          member_count: g.member_count ?? 1,
        }));
      setGroups(owned);
    } catch {
      // Retain current groups on network error
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      refreshOwnedGroups();
    }, [refreshOwnedGroups]),
  );

  const handleDeleteGroup = async (group: OwnedGroupInfo): Promise<void> => {
    setErrorMessage(null);
    setDeletingGroupId(group.id);
    try {
      await withCorrelationId(async correlationId => {
        await deleteGroup(group.id, { correlationId });
      });
      setGroups(prev => prev.filter(g => g.id !== group.id));
    } catch (e) {
      setErrorMessage(getApiErrorMessage(e, t('mob.group_delete.err_delete')));
    } finally {
      setDeletingGroupId(null);
    }
  };

  const handleDeletePress = (group: OwnedGroupInfo): void => {
    Alert.alert(
      t('mob.account_delete.delete_confirm_title', { name: group.name }),
      t('mob.account_delete.delete_confirm_message'),
      [
        { text: t('mob.common.cancel'), style: 'cancel' },
        {
          text: t('mob.common.delete'),
          style: 'destructive',
          onPress: () => handleDeleteGroup(group),
        },
      ],
    );
  };

  const handleTransferPress = (group: OwnedGroupInfo): void => {
    setErrorMessage(null);
    navigation.navigate('TransferGroupOwnership', {
      groupId: group.id,
      groupName: group.name,
    });
  };

  const handleContinuePress = async (): Promise<void> => {
    setErrorMessage(null);
    setIsRequestingDeletion(true);
    try {
      await withCorrelationId(async correlationId => {
        await requestDeletion({ correlationId });
      });
      navigation.replace('AccountDeletionCode');
    } catch (e) {
      setErrorMessage(getApiErrorMessage(e, t('mob.profile.delete_start_error')));
    } finally {
      setIsRequestingDeletion(false);
    }
  };

  const remainingCount = groups.length;
  const countTitle =
    remainingCount === 1
      ? t('mob.account_delete.owns_groups_count', { count: remainingCount })
      : t('mob.account_delete.owns_groups_count_other', { count: remainingCount });

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.warningBadge}>
          <WarningIcon size={32} color={colors.white} />
        </View>
        <Text style={styles.heading}>{countTitle}</Text>
        <Text style={styles.description}>{t('mob.account_delete.blocked_description')}</Text>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {groups.length > 0 ? (
        <Card style={styles.card}>
          {groups.map((group, index) => {
            const isOnlyMember = (group.member_count ?? 1) <= 1;
            const isDeleting = deletingGroupId === group.id;
            const initials = getInitials(group.name);
            const avatarBg = index % 2 === 0 ? colors.primary : colors.success;

            return (
              <View
                key={group.id}
                style={[styles.groupItem, index < groups.length - 1 && styles.groupItemDivider]}
              >
                <View style={[styles.avatarTile, { backgroundColor: avatarBg }]}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>

                <View style={styles.groupInfo}>
                  <Text style={styles.groupName} numberOfLines={1}>
                    {group.name}
                  </Text>
                  <Text style={styles.memberCount}>
                    {isOnlyMember
                      ? t('mob.account_delete.only_you')
                      : t(
                          (group.member_count ?? 1) === 1
                            ? 'mob.group_card.members_one'
                            : 'mob.group_card.members_other',
                          { count: group.member_count ?? 1 },
                        )}
                  </Text>
                </View>

                {isOnlyMember ? (
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDeletePress(group)}
                    disabled={isDeleting || isRequestingDeletion}
                    accessibilityRole="button"
                    accessibilityLabel={t('mob.account_delete.delete_btn')}
                  >
                    <Text style={styles.deleteButtonText}>{t('mob.account_delete.delete_btn')}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.transferButton}
                    onPress={() => handleTransferPress(group)}
                    disabled={isDeleting || isRequestingDeletion}
                    accessibilityRole="button"
                    accessibilityLabel={t('mob.account_delete.transfer_btn')}
                  >
                    <Text style={styles.transferButtonText}>{t('mob.account_delete.transfer_btn')}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </Card>
      ) : null}

      <View style={styles.noticeBanner}>
        <Text style={styles.noticeText}>{t('mob.account_delete.notice_banner')}</Text>
      </View>

      <View style={styles.footerSection}>
        <Button
          label={t('mob.account_delete.continue_btn')}
          variant="primary"
          onPress={handleContinuePress}
          disabled={remainingCount > 0 || isRequestingDeletion}
          loading={isRequestingDeletion}
          style={remainingCount > 0 ? styles.disabledContinueButton : styles.continueButton}
        />
        {remainingCount > 0 ? (
          <Text style={styles.helperText}>{t('mob.account_delete.continue_helper')}</Text>
        ) : null}
      </View>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  warningBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heading: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  card: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  groupItemDivider: {
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  avatarTile: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarInitials: {
    ...typography.bodyBold,
    color: colors.white,
    fontSize: 16,
  },
  groupInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  groupName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  memberCount: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  transferButton: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transferButtonText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: colors.errorLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    ...typography.bodyBold,
    color: colors.error,
    fontSize: 14,
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
  continueButton: {
    width: '100%',
  },
  disabledContinueButton: {
    width: '100%',
    backgroundColor: colors.border,
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
