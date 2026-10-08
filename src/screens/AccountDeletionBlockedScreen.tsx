import React, { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { deleteGroup, getMyGroups } from '../api/groups';
import { requestDeletion, type OwnedGroupInfo } from '../api/profile';
import Button from '../components/Button';
import Card from '../components/Card';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import { useT } from '../labels/LabelsContext';
import type { ProfileStackParamList } from '../navigation/types';
import { borderWidth, colors, spacing, typography } from '../theme/tokens';
import { getApiErrorMessage } from '../utils/apiError';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AccountDeletionBlocked'>;

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
      <Card style={styles.card}>
        <Text style={styles.heading}>{countTitle}</Text>
        <Text style={styles.description}>{t('mob.account_delete.blocked_description')}</Text>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <View style={styles.groupList}>
          {groups.map(group => {
            const isOnlyMember = (group.member_count ?? 1) <= 1;
            const isDeleting = deletingGroupId === group.id;

            return (
              <View key={group.id} style={styles.groupItem}>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.memberCount}>
                    {t(
                      (group.member_count ?? 1) === 1
                        ? 'mob.group_card.members_one'
                        : 'mob.group_card.members_other',
                      { count: group.member_count ?? 1 },
                    )}
                  </Text>
                </View>

                {isOnlyMember ? (
                  <Button
                    label={t('mob.account_delete.delete_btn')}
                    variant="destructive"
                    size="sm"
                    onPress={() => handleDeletePress(group)}
                    loading={isDeleting}
                    disabled={isDeleting || isRequestingDeletion}
                  />
                ) : (
                  <Button
                    label={t('mob.account_delete.transfer_btn')}
                    variant="secondary"
                    size="sm"
                    onPress={() => handleTransferPress(group)}
                    disabled={isDeleting || isRequestingDeletion}
                  />
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.footerSection}>
          <Button
            label={t('mob.account_delete.continue_btn')}
            variant="primary"
            onPress={handleContinuePress}
            disabled={remainingCount > 0 || isRequestingDeletion}
            loading={isRequestingDeletion}
            style={styles.continueButton}
          />
          {remainingCount > 0 ? (
            <Text style={styles.helperText}>{t('mob.account_delete.continue_helper')}</Text>
          ) : null}
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
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
  },
  groupList: {
    marginBottom: spacing.lg,
  },
  groupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
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
  footerSection: {
    marginTop: spacing.sm,
  },
  continueButton: {
    width: '100%',
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
