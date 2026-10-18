import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../api/correlationId';
import { deleteGroup } from '../../api/groups';
import Button from '../Button';
import BottomSheet from '../skills/BottomSheet';
import {
  CheckIcon,
  CrossIcon,
  TrashIcon,
} from '../icons/ActionIcons';
import { useT } from '../../labels/LabelsContext';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { getApiErrorMessage, isNotFoundError } from '../../utils/apiError';

interface DeleteGroupSheetProps {
  groupId: string;
  groupName: string;
  memberCount?: number;
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
  /** The group answered 404 (gone or no longer visible): the screen closes with the neutral message. */
  onNotFound?: () => void;
}

export default function DeleteGroupSheet({
  groupId,
  groupName,
  memberCount,
  visible,
  onClose,
  onDeleted,
  onNotFound,
}: DeleteGroupSheetProps): React.JSX.Element | null {
  const t = useT();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!visible) {
    return null;
  }

  const handleDeleteGroup = async (): Promise<void> => {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await withCorrelationId(async correlationId => {
        await deleteGroup(groupId, { correlationId });
      });
      onClose();
      onDeleted();
    } catch (e) {
      if (isNotFoundError(e) && onNotFound) {
        onClose();
        onNotFound();
      } else {
        setDeleteError(getApiErrorMessage(e, t('mob.group_delete.err_delete')));
      }
      setIsDeleting(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} closeLabel={t('mob.group_delete.keep_btn')}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.trashBadge}>
            <TrashIcon size={24} color={colors.error} />
          </View>
          <View style={styles.headerTextGroup}>
            <Text style={styles.title} numberOfLines={2}>
              {t('mob.group_delete.sheet_title', { name: groupName })}
            </Text>
            {memberCount !== undefined ? (
              <Text style={styles.subtitle}>
                {t(
                  memberCount === 1
                    ? 'mob.group_card.members_one'
                    : 'mob.group_card.members_other',
                  { count: memberCount },
                )}
              </Text>
            ) : null}
          </View>
        </View>

        {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}

        <View style={styles.consequencesList}>
          <View style={styles.consequenceRow}>
            <View style={styles.iconContainer}>
              <CheckIcon size={18} color={colors.success} />
            </View>
            <Text style={styles.consequenceText}>
              {t('mob.group_delete.consequence_upcoming')}
            </Text>
          </View>
          <View style={styles.consequenceRow}>
            <View style={styles.iconContainer}>
              <CheckIcon size={18} color={colors.success} />
            </View>
            <Text style={styles.consequenceText}>
              {t('mob.group_delete.consequence_past')}
            </Text>
          </View>
          <View style={styles.consequenceRow}>
            <View style={styles.iconContainer}>
              <CrossIcon size={18} color={colors.error} />
            </View>
            <Text style={styles.consequenceText}>
              {memberCount !== undefined
                ? t('mob.group_delete.consequence_disappear', { count: memberCount })
                : t('mob.group_delete.consequence_disappear_generic')}
            </Text>
          </View>
        </View>

        <View style={styles.buttonStack}>
          <Button
            label={t('mob.group_delete.delete_btn')}
            variant="destructive"
            onPress={handleDeleteGroup}
            loading={isDeleting}
            disabled={isDeleting}
            style={styles.deleteButton}
          />
          <Button
            label={t('mob.group_delete.keep_btn')}
            variant="secondary"
            onPress={onClose}
            disabled={isDeleting}
            style={styles.keepButton}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  trashBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerTextGroup: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  consequencesList: {
    marginBottom: spacing.xl,
  },
  consequenceRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 1,
  },
  consequenceText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  buttonStack: {
    gap: spacing.sm,
  },
  deleteButton: {
    width: '100%',
  },
  keepButton: {
    width: '100%',
  },
});
