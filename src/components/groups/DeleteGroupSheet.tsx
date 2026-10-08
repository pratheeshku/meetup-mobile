import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../api/correlationId';
import { deleteGroup } from '../../api/groups';
import Button from '../Button';
import BottomSheet from '../skills/BottomSheet';
import { useT } from '../../labels/LabelsContext';
import { colors, spacing, typography } from '../../theme/tokens';
import { getApiErrorMessage } from '../../utils/apiError';

interface DeleteGroupSheetProps {
  groupId: string;
  groupName: string;
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteGroupSheet({
  groupId,
  groupName,
  visible,
  onClose,
  onDeleted,
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
      setDeleteError(getApiErrorMessage(e, t('mob.group_delete.err_delete')));
      setIsDeleting(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} closeLabel={t('mob.group_delete.keep_btn')}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {t('mob.group_delete.sheet_title', { name: groupName })}
        </Text>

        {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}

        <View style={styles.consequencesList}>
          <View style={styles.consequenceRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.consequenceText}>
              {t('mob.group_delete.consequence_upcoming')}
            </Text>
          </View>
          <View style={styles.consequenceRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.consequenceText}>
              {t('mob.group_delete.consequence_past')}
            </Text>
          </View>
          <View style={styles.consequenceRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.consequenceText}>
              {t('mob.group_delete.consequence_disappear')}
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
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  consequencesList: {
    marginBottom: spacing.lg,
  },
  consequenceRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  bullet: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginRight: spacing.sm,
    lineHeight: 22,
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
